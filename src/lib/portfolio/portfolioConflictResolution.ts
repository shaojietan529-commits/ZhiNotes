import { accountPullCloud } from "./accountSync";
import { loadSyncPasscode, pullCloudData, type CloudPortfolioData } from "./cloudSync";
import {
  DEFAULT_GMV_ALLOCATION, DEFAULT_MAX_NET_PCT, loadAllocation, loadDataUpdatedAt, loadLastEmailMessageId,
  loadMaxNetPct, loadSnapshot, loadTagMap, readPortfolioLocalFingerprint,
  saveAllocation, saveDataUpdatedAt, saveLastEmailMessageId, saveMaxNetPct, saveSnapshot, saveTagMap,
} from "./portfolioStore";
import { parsePortfolioCloudVersion, readActivePortfolioConflict, readPortfolioCloudBase, retainPortfolioConflict, type PortfolioCloudVersion } from "./portfolioSyncRevision";
import { assertPortfolioScopeCurrent, getPortfolioStorageScope, portfolioStorage, type PortfolioStorageScope } from "./portfolioStorageScope";
import { hasUnsyncedPortfolioChanges } from "./portfolioSyncStatus";

export type PortfolioConflictMode = "account" | "passcode";
export type PortfolioConflictChoice = "local" | "cloud";
export interface PortfolioConflictField { id: string; label: string; local: string; cloud: string }
export interface PortfolioConflictReview {
  id: string;
  mode: PortfolioConflictMode;
  storageScope: PortfolioStorageScope;
  version: PortfolioCloudVersion;
  local: CloudPortfolioData;
  cloud: CloudPortfolioData;
  fingerprint: string;
  fields: PortfolioConflictField[];
  legacyFingerprint?: string;
  previousLocal?: CloudPortfolioData;
}
export interface PortfolioConflictResolution {
  review: PortfolioConflictReview;
  data: CloudPortfolioData;
  state: "queued" | "applying" | "applied";
}
const RESOLUTION_KEY = "zhinote.portfolio.sync.resolution.v1";
export const PORTFOLIO_LEGACY_REVIEWED_KEY = "zhinote.portfolio.legacy-reviewed.v1";

export function hasUnreviewedLegacyPortfolio(scope = getPortfolioStorageScope()): boolean {
  const fingerprint = readPortfolioLocalFingerprint("legacy");
  if (portfolioStorage(scope).getItem(PORTFOLIO_LEGACY_REVIEWED_KEY) === fingerprint) return false;
  return (JSON.parse(fingerprint) as (string | null)[]).some((value) => value !== null);
}

export async function prepareLegacyPortfolioReview(scope = getPortfolioStorageScope()): Promise<PortfolioConflictReview> {
  assertPortfolioScopeCurrent(scope);
  if (!scope.startsWith("account:")) throw new Error("请先登录，再确认旧版本机组合的归属。");
  if (hasUnsyncedPortfolioChanges(scope)) throw new Error("当前账号仍有待上传或待处理的修改，请先完成同步再核对旧版本。");
  const fingerprint = readPortfolioLocalFingerprint(scope);
  const legacyFingerprint = readPortfolioLocalFingerprint("legacy");
  if (!(JSON.parse(legacyFingerprint) as (string | null)[]).some((value) => value !== null)) throw new Error("没有待核对的旧版本机组合。");
  const local = readLocalPortfolioData("legacy");
  const previousLocal = readLocalPortfolioData(scope);
  const result = await accountPullCloud();
  assertPortfolioScopeCurrent(scope);
  if (result.status !== "ok" || !result.version) throw new Error("无法确认当前账号云端版本，未处理旧版本机组合。");
  if (readPortfolioLocalFingerprint(scope) !== fingerprint || hasUnsyncedPortfolioChanges(scope) ||
      readPortfolioLocalFingerprint("legacy") !== legacyFingerprint) throw new Error("核对期间本机有新修改，请重新读取差异。");
  const cloud = result.data ?? { snapshot: null, tagMap: {}, allocation: DEFAULT_GMV_ALLOCATION,
    maxNetPct: DEFAULT_MAX_NET_PCT, lastEmailMessageId: null, updatedAt: new Date().toISOString() };
  return { id: crypto.randomUUID(), mode: "account", storageScope: scope, version: result.version,
    local, cloud, previousLocal, fingerprint, legacyFingerprint, fields: portfolioConflictFields(local, cloud) };
}

export function readLocalPortfolioData(scope = getPortfolioStorageScope()): CloudPortfolioData {
  // A damaged cache must not become default/empty values in a merge decision.
  const raw = JSON.parse(readPortfolioLocalFingerprint(scope)) as (string | null)[];
  const snapshot = raw[0] === null ? null : JSON.parse(raw[0]);
  const tags = raw[1] === null ? {} : JSON.parse(raw[1]);
  if ((snapshot !== null && (!snapshot || !Array.isArray(snapshot.positions))) ||
      !tags || typeof tags !== "object" || Array.isArray(tags) ||
      !Object.values(tags).every((tag) => typeof tag === "string") ||
      (raw[2] !== null && (!Number.isFinite(Number(raw[2])) || Number(raw[2]) <= 0)) ||
      (raw[3] !== null && (!Number.isFinite(Number(raw[3])) || Number(raw[3]) <= 0 || Number(raw[3]) > 100))) {
    throw new Error("本机组合格式异常，未用空值替代原始内容，请先恢复备份。");
  }
  return { snapshot: loadSnapshot(scope), tagMap: loadTagMap(scope), allocation: loadAllocation(scope),
    maxNetPct: loadMaxNetPct(scope), lastEmailMessageId: loadLastEmailMessageId(scope),
    updatedAt: loadDataUpdatedAt(scope) ?? new Date().toISOString() };
}

export function saveLocalPortfolioData(data: CloudPortfolioData, scope = getPortfolioStorageScope()): void {
  saveSnapshot(data.snapshot, scope);
  saveTagMap(data.tagMap, scope);
  saveAllocation(data.allocation, scope);
  saveMaxNetPct(data.maxNetPct ?? DEFAULT_MAX_NET_PCT, scope);
  saveLastEmailMessageId(data.lastEmailMessageId ?? null, scope);
  saveDataUpdatedAt(data.updatedAt, scope);
}

function tagValue(data: CloudPortfolioData, key: string): string | null {
  return Object.hasOwn(data.tagMap, key) ? data.tagMap[key] : null;
}

export function portfolioConflictFields(local: CloudPortfolioData, cloud: CloudPortfolioData): PortfolioConflictField[] {
  const fields: PortfolioConflictField[] = [];
  const add = (id: string, label: string, a: unknown, b: unknown) => {
    const value = (item: unknown) => item === null ? "无" : typeof item === "string" ? item : JSON.stringify(item, null, 2);
    if (JSON.stringify(a) !== JSON.stringify(b)) fields.push({ id, label, local: value(a), cloud: value(b) });
  };
  // A report and its import marker are one unit; never combine positions from different reports.
  add("report", "持仓报告", { snapshot: local.snapshot, lastEmailMessageId: local.lastEmailMessageId },
    { snapshot: cloud.snapshot, lastEmailMessageId: cloud.lastEmailMessageId });
  add("allocation", "资金规模", local.allocation, cloud.allocation);
  add("maxNetPct", "最大净敞口 (%)", local.maxNetPct ?? DEFAULT_MAX_NET_PCT, cloud.maxNetPct ?? DEFAULT_MAX_NET_PCT);
  for (const key of [...new Set([...Object.keys(local.tagMap), ...Object.keys(cloud.tagMap)])].sort()) {
    add(`tag:${key}`, `标签 · ${key}`, tagValue(local, key), tagValue(cloud, key));
  }
  return fields;
}

export async function preparePortfolioConflictReview(mode: PortfolioConflictMode, scope = getPortfolioStorageScope()): Promise<PortfolioConflictReview> {
  assertPortfolioScopeCurrent(scope);
  const fingerprint = readPortfolioLocalFingerprint(scope);
  const result = mode === "account" ? await accountPullCloud() : await pullCloudData(loadSyncPasscode(scope) ?? "");
  assertPortfolioScopeCurrent(scope);
  if (result.status !== "ok" || !result.version || !result.data) {
    throw new Error("暂时无法取得完整云端版本；未改动本机数据，请稍后重试。");
  }
  if (readPortfolioLocalFingerprint(scope) !== fingerprint) throw new Error("本机组合刚有新修改，请重新读取差异。");
  const base = readPortfolioCloudBase(mode, scope);
  const active = readActivePortfolioConflict(mode, scope);
  if ((base && base.scope !== result.version.scope) || (active && active.scope !== result.version.scope)) {
    throw new Error("登录账号或同步空间已改变，未进行跨账号合并。");
  }
  const local = readLocalPortfolioData(scope);
  retainPortfolioConflict(mode, local, { data: result.data, version: result.version }, scope);
  return { id: crypto.randomUUID(), mode, storageScope: scope, version: result.version, local, cloud: result.data,
    fingerprint, fields: portfolioConflictFields(local, result.data) };
}

export function stagePortfolioConflictResolution(review: PortfolioConflictReview, choices: Record<string, PortfolioConflictChoice>): PortfolioConflictResolution {
  assertPortfolioScopeCurrent(review.storageScope);
  if (readPortfolioLocalFingerprint(review.storageScope) !== review.fingerprint) throw new Error("本机内容已变化，旧选择未应用，请重新读取差异。");
  const active = readActivePortfolioConflict(review.mode, review.storageScope);
  if (review.legacyFingerprint) {
    if (readPortfolioLocalFingerprint("legacy") !== review.legacyFingerprint || hasUnsyncedPortfolioChanges(review.storageScope)) {
      throw new Error("旧版本或当前账号有新修改，请重新核对。");
    }
  } else if (!active || active.scope !== review.version.scope || active.revision !== review.version.revision) {
    throw new Error("冲突版本已变化，请重新读取差异。");
  }
  const data: CloudPortfolioData = { ...review.local, tagMap: { ...review.local.tagMap }, updatedAt: new Date().toISOString() };
  for (const field of review.fields) {
    const choice = choices[field.id];
    if (choice !== "local" && choice !== "cloud") throw new Error("请为每一项差异选择保留版本。");
    if (choice === "local") continue;
    if (field.id === "report") { data.snapshot = review.cloud.snapshot; data.lastEmailMessageId = review.cloud.lastEmailMessageId; }
    else if (field.id === "allocation") data.allocation = review.cloud.allocation;
    else if (field.id === "maxNetPct") data.maxNetPct = review.cloud.maxNetPct ?? DEFAULT_MAX_NET_PCT;
    else {
      const key = field.id.slice(4);
      const value = tagValue(review.cloud, key);
      if (value === null) delete data.tagMap[key];
      else Object.defineProperty(data.tagMap, key, { value, enumerable: true, writable: true, configurable: true });
    }
  }
  const resolution: PortfolioConflictResolution = { review, data, state: "queued" };
  // Immutable recovery pair first; the live portfolio is untouched until an ACK.
  portfolioStorage(review.storageScope).setItem(`zhinote.portfolio.conflict.review.v1.${review.id}`, JSON.stringify(resolution));
  writePortfolioConflictResolution(resolution);
  return resolution;
}

export function readPortfolioConflictResolution(mode: PortfolioConflictMode, scope = getPortfolioStorageScope()): PortfolioConflictResolution | null {
  const raw = portfolioStorage(scope).getItem(`${RESOLUTION_KEY}.${mode}`);
  if (!raw) return null;
  const resolution = JSON.parse(raw) as PortfolioConflictResolution;
  if (resolution.review?.mode !== mode || resolution.review.storageScope !== scope || !parsePortfolioCloudVersion(resolution.review.version) ||
      !resolution.data || !["queued", "applying", "applied"].includes(resolution.state)) {
    throw new Error("组合处理记录无法读取；原始版本仍保留，未继续上传。");
  }
  return resolution;
}

export function writePortfolioConflictResolution(resolution: PortfolioConflictResolution): void {
  portfolioStorage(resolution.review.storageScope).setItem(`${RESOLUTION_KEY}.${resolution.review.mode}`, JSON.stringify(resolution));
}

export function finishPortfolioConflictResolution(mode: PortfolioConflictMode, id: string, scope = getPortfolioStorageScope()): void {
  if (readPortfolioConflictResolution(mode, scope)?.review.id !== id) return;
  // Only remove the retry pointer. Immutable recovery copies remain untouched.
  portfolioStorage(scope).removeItem(`${RESOLUTION_KEY}.${mode}`);
}
