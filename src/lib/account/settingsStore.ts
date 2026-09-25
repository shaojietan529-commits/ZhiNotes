import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { getAccountIdentityConfig, getSessionAccount, readSessionToken } from "./server";
import { accountSessionUnconfirmedResponse } from "./sessionResponses";

type Settings = Record<string, unknown>;

// Use the existing email account and Redis instance. Each setting gets its own
// hash field so simultaneous edits to different settings cannot overwrite it.
export async function openAccountSettings(request: Request, workspaceId: string) {
  const config = getAccountIdentityConfig();
  if (!config) return { ok: false as const, response: NextResponse.json(
    { error: "account system not configured" }, { status: 501 }
  ) };
  const token = readSessionToken(request);
  if (!token) return { ok: false as const, response: NextResponse.json(
    { error: "请先登录。" }, { status: 401 }
  ) };
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) {
    return { ok: false as const, response: NextResponse.json(
      { error: "cross-origin settings write rejected" }, { status: 403 }
    ) };
  }
  try {
    const account = await getSessionAccount(config, token);
    if (!account) return { ok: false as const, response: accountSessionUnconfirmedResponse() };
    if (workspaceId !== `account-${account.id}`) {
      return { ok: false as const, response: NextResponse.json(
        { error: "workspace-not-found-or-forbidden" }, { status: 404 }
      ) };
    }
    const redis = new Redis({ url: config.kv.url, token: config.kv.token,
      signal: () => AbortSignal.timeout(10_000), retry: false });
    const key = `zhinotes:account:settings:${account.id}`;
    const fields = await redis.hgetall<Record<string, unknown>>(key) ?? {};
    const settings: Settings = {};
    for (const [field, value] of Object.entries(fields)) {
      const path: unknown = JSON.parse(field);
      if (!isSettingPath(path)) {
        throw new Error("Invalid stored settings path");
      }
      let target = settings;
      for (const part of path.slice(0, -1)) {
        if (!isRecord(target[part])) target[part] = {};
        target = target[part] as Settings;
      }
      target[path[path.length - 1]] = value;
    }
    return {
      ok: true as const,
      workspace: { id: workspaceId, settings },
      membership: { role: "owner" as const },
      async save(next: Settings) {
        const changed: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(next)) {
          if (settings[field] === value) continue;
          if (field === "account_settings" && isRecord(value)) {
            const before = isRecord(settings[field]) ? settings[field] : {};
            for (const [setting, entry] of Object.entries(value)) {
              if (before[setting] !== entry) changed[JSON.stringify([field, setting])] = entry;
            }
          } else if (field === "module_settings" && isRecord(value)) {
            const before = isRecord(settings[field]) ? settings[field] : {};
            for (const [moduleId, bucket] of Object.entries(value)) {
              if (!isRecord(bucket) || before[moduleId] === bucket) continue;
              const oldBucket = isRecord(before[moduleId]) ? before[moduleId] : {};
              for (const [setting, entry] of Object.entries(bucket)) {
                if (oldBucket[setting] !== entry) changed[JSON.stringify([field, moduleId, setting])] = entry;
              }
            }
          } else {
            changed[JSON.stringify([field])] = value;
          }
        }
        if (Object.keys(changed).length === 0) throw new Error("No setting to save");
        for (const field of Object.keys(changed)) {
          if (!isSettingPath(JSON.parse(field))) throw new Error("Invalid setting path");
        }
        try {
          await redis.hset(key, changed);
        } catch {
          throw new Error("设置云端写入失败；本地待上传记录已保留，请稍后重试。");
        }
      },
    };
  } catch {
    return { ok: false as const, response: accountSessionUnconfirmedResponse(
      "设置云存储暂时不可用；登录和本地待上传数据均已保留。"
    ) };
  }
}

function isSettingPath(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 3 &&
    value.every((part) => typeof part === "string" && part.length > 0 &&
      !["__proto__", "constructor", "prototype"].includes(part));
}

function isRecord(value: unknown): value is Settings {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
