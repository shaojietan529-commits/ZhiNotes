import { getLastAuthenticatedAccount } from "@/lib/account/clientSession";
import { capturePortfolioAccountContext } from "./portfolioAccountContext";

export type PortfolioStorageScope = "local" | "legacy" | `account:${string}`;
const PREFIX = "zhinote.portfolio.";
export const PORTFOLIO_STATE_KEY = `${PREFIX}state.v2`;
const STATE_KEYS = [
  "snapshot.v1", "tags.v1", "allocation.v1", "maxNetPct.v1", "lastEmailMessage.v1", "updatedAt.v1",
  "sync.status.v1", "sync.base.v2.account", "sync.base.v2.passcode",
  "sync.resolution.v1.account", "sync.resolution.v1.passcode",
  "sync.conflict.v1.account", "sync.conflict.v1.passcode", "legacy-reviewed.v1",
].map((key) => `${PREFIX}${key}`);
type StateValues = Record<string, string | null>;
const batches = new Map<PortfolioStorageScope, { values: StateValues; notifications: (() => void)[] }>();
const cache = new Map<string, { raw: string; values: StateValues }>();

function readState(scope: PortfolioStorageScope): StateValues | null {
  if (scope === "legacy") return null;
  const key = portfolioStorageKey(PORTFOLIO_STATE_KEY, scope);
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  if (cache.get(key)?.raw === raw) return cache.get(key)!.values;
  const parsed = JSON.parse(raw);
  if (parsed?.format !== 2 || !parsed.values || typeof parsed.values !== "object" ||
      STATE_KEYS.some((name) => parsed.values[name] !== null && typeof parsed.values[name] !== "string")) {
    throw new Error("本机组合保存记录无法读取，原始记录已保留。");
  }
  cache.set(key, { raw, values: parsed.values });
  return parsed.values;
}

// One native setItem is the commit boundary. Old individual keys are retained
// untouched; no rollback, replay engine or second storage provider is needed.
export function batchPortfolioStorage<T>(scope: PortfolioStorageScope, write: () => T): T {
  assertPortfolioScopeCurrent(scope);
  if (batches.has(scope)) return write();
  const key = portfolioStorageKey(PORTFOLIO_STATE_KEY, scope);
  const before = window.localStorage.getItem(key);
  const values = { ...(readState(scope) ?? Object.fromEntries(STATE_KEYS.map((name) =>
    [name, window.localStorage.getItem(portfolioStorageKey(name, scope))]))) };
  const batch = { values, notifications: [] as (() => void)[] };
  let result: T;
  batches.set(scope, batch);
  try {
    result = write();
    if (result instanceof Promise) throw new Error("Portfolio storage batches must be synchronous");
    assertPortfolioScopeCurrent(scope);
    const raw = JSON.stringify({ format: 2, values });
    // Detect an already changed snapshot; this is not a cross-tab writer lock.
    if (window.localStorage.getItem(key) !== before) throw new Error("另一标签页刚保存了组合，请重试本次修改。");
    window.localStorage.setItem(key, raw);
    cache.set(key, { raw, values });
  } finally { batches.delete(scope); }
  for (const notify of batch.notifications) notify();
  return result;
}

export function afterPortfolioStorageCommit(scope: PortfolioStorageScope, notify: () => void): void {
  const batch = batches.get(scope);
  if (batch) batch.notifications.push(notify);
  else notify();
}

export function getPortfolioStorageScope(): PortfolioStorageScope {
  if (typeof window === "undefined") return "local";
  const context = capturePortfolioAccountContext();
  if (context.accountId) return `account:${context.accountId}`;
  if (getLastAuthenticatedAccount()) throw new Error("登录账号正在切换，组合本机缓存未改动。");
  return "local";
}

export function portfolioStorageKey(key: string, scope = getPortfolioStorageScope()): string {
  if (!key.startsWith(PREFIX)) throw new Error("Invalid portfolio storage key");
  return scope === "legacy" ? key : `${PREFIX}scoped.v1.${encodeURIComponent(scope)}.${key.slice(PREFIX.length)}`;
}

export function isPortfolioScopeCurrent(scope: PortfolioStorageScope): boolean {
  try { return scope !== "legacy" && scope === getPortfolioStorageScope(); }
  catch { return false; }
}

export function assertPortfolioScopeCurrent(scope: PortfolioStorageScope): void {
  if (!isPortfolioScopeCurrent(scope)) throw new Error("组合所属账号已改变，未跨账号读写本机数据。");
}

export function portfolioStorage(scope = getPortfolioStorageScope()) {
  const grouped = (key: string) => scope !== "legacy" && STATE_KEYS.includes(key);
  const change = (key: string, value: string | null) => {
    const batch = batches.get(scope);
    if (grouped(key) && batch) { batch.values[key] = value; return; }
    if (grouped(key) && readState(scope)) {
      batchPortfolioStorage(scope, () => { batches.get(scope)!.values[key] = value; });
      return;
    }
    if (value === null) window.localStorage.removeItem(portfolioStorageKey(key, scope));
    else window.localStorage.setItem(portfolioStorageKey(key, scope), value);
  };
  return {
    getItem: (key: string) => {
      const state = grouped(key) ? (batches.get(scope)?.values ?? readState(scope)) : null;
      return state ? state[key] : window.localStorage.getItem(portfolioStorageKey(key, scope));
    },
    setItem: (key: string, value: string) => change(key, value),
    removeItem: (key: string) => change(key, null),
  };
}
