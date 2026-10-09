import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { parsePortfolioCloudVersion } from "./portfolioSyncRevision";
import { isAiExposureMap } from "./positionReport";

type KvConfig = { url: string; token: string };
type PushBody = { data?: unknown; protocol?: unknown; requestId?: unknown; base?: unknown };

// The comparison and both writes run in one Redis operation. A concurrent
// request cannot slip a write between our version check and persistence.
// A transport retry can replay EVAL with its original expected value after
// the first call committed. Only an exact desired-value match is safe to replay.
export const PORTFOLIO_COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if (current or '') ~= ARGV[1] and current ~= ARGV[2] then
  return {0, current or ''}
end
redis.call('SET', KEYS[1], ARGV[2])
if #KEYS > 1 then redis.call('SET', KEYS[2], ARGV[3]) end
return {1, ARGV[2]}
`;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function portfolioCloudEnvelope(raw: string | null, key: string) {
  return {
    data: raw === null ? null : JSON.parse(raw),
    version: { scope: digest(key), revision: raw === null ? null : digest(`${key}\n${raw}`) },
  };
}

function validPortfolio(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (data.snapshot === null || (typeof data.snapshot === "object" && data.snapshot !== null &&
      Array.isArray((data.snapshot as Record<string, unknown>).positions))) &&
    !!data.tagMap && typeof data.tagMap === "object" && !Array.isArray(data.tagMap) &&
    Object.values(data.tagMap).every((tag) => typeof tag === "string") &&
    (data.aiExposureMap === undefined || isAiExposureMap(data.aiExposureMap)) &&
    typeof data.allocation === "number" && Number.isFinite(data.allocation) && data.allocation > 0 &&
    (data.maxNetPct === undefined || (typeof data.maxNetPct === "number" && data.maxNetPct > 0 && data.maxNetPct <= 100)) &&
    (data.lastEmailMessageId === undefined || data.lastEmailMessageId === null || typeof data.lastEmailMessageId === "string") &&
    typeof data.updatedAt === "string" && Number.isFinite(Date.parse(data.updatedAt));
}

export async function writeVersionedPortfolio(
  config: KvConfig,
  key: string,
  body: PushBody,
  metadata?: { key: string; owner: string }
): Promise<{ status: number; body: Record<string, unknown> }> {
  const reply = (status: number, response: Record<string, unknown>) => ({ status, body: response });
  // Old clients must not bypass the write guard during a rolling deployment.
  if (body.protocol !== 2 || typeof body.requestId !== "string" ||
      !/^[a-zA-Z0-9-]{1,128}$/.test(body.requestId) ||
      !(body.base === null || parsePortfolioCloudVersion(body.base))) {
    return reply(428, { error: "请刷新页面后重试同步；本机数据未被删除。" });
  }
  if (!validPortfolio(body.data)) return reply(400, { error: "组合数据格式无效；未覆盖云端。" });
  const serialized = JSON.stringify(body.data);
  if (Buffer.byteLength(serialized, "utf8") > 1024 * 1024) return reply(413, { error: "数据过大" });
  const redis = new Redis({ ...config, automaticDeserialization: false, retry: false,
    signal: () => AbortSignal.timeout(8000) });
  const raw = await redis.get<string>(key);
  const current = portfolioCloudEnvelope(raw, key);
  // An old tab cannot acknowledge an exact-document write that drops this new field.
  if (body.data.aiExposureMap === undefined && Object.keys(current.data?.aiExposureMap ?? {}).length > 0) {
    return reply(428, { error: "云端已有 AI Exposure；请刷新页面后重试同步，本机修改已保留。" });
  }
  const base = parsePortfolioCloudVersion(body.base);
  if (base && base.scope !== current.version.scope) {
    return reply(409, { error: "账号或同步空间已改变；本机组合已保留，请先确认账号。", code: "scope-mismatch" });
  }
  const conflict = (value: string | null) => reply(409, {
    error: "另一台设备已修改组合；本机和云端版本已保留，需要确认冲突。",
    code: "portfolio-conflict", ...portfolioCloudEnvelope(value, key),
  });
  // An exact replay is safe after a lost response. Never infer ordering from a device clock.
  if (raw !== serialized && (base?.revision ?? null) !== current.version.revision) return conflict(raw);
  const version = portfolioCloudEnvelope(serialized, key).version;
  const savedMetadata = metadata ? JSON.stringify({
    format: "zhinote-portfolio-account-cloud-metadata", format_version: 1,
    metadata_status: "acknowledged", owner: metadata.owner, updated_at: body.data.updatedAt,
    last_ack_at: new Date().toISOString(), has_data: true, stores_portfolio_content: false,
  }) : "";
  const [accepted, actual] = await redis.eval<[string, string, string], [number, string]>(
    PORTFOLIO_COMPARE_AND_SET, metadata ? [key, metadata.key] : [key], [raw ?? "", serialized, savedMetadata]
  );
  if (accepted !== 1) return conflict(actual || null);
  return reply(200, {
    ok: true, tagMap: body.data.tagMap, version,
    ack: { format: "zhinote-portfolio-cloud-ack-receipt", format_version: 2,
      ack_status: "acknowledged", accepted: true, request_id: body.requestId,
      scope: version.scope, revision: version.revision, updated_at: body.data.updatedAt },
  });
}
