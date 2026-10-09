import { getLastAuthenticatedAccount } from "@/lib/account/clientSession";
import { capturePortfolioAccountContext } from "./portfolioAccountContext";
import { cachedPortfolioRecord, changePortfolioRecord, readPortfolioRecord, PORTFOLIO_LOCAL_VALUE_KEYS, PORTFOLIO_OPTIONAL_VALUE_KEYS, type PortfolioLocalRecord } from "./portfolioLocalDatabase";

export type PortfolioStorageScope = "local" | "legacy" | `account:${string}`;
const PREFIX = "zhinote.portfolio.";
export const PORTFOLIO_STATE_KEY = `${PREFIX}state.v2`;
export const PORTFOLIO_STORAGE_EVENT = "zhinote:portfolio-storage";
const PING_KEY = `${PREFIX}local-commit.v1`;
const STATE_KEYS = PORTFOLIO_LOCAL_VALUE_KEYS;
type Values = Record<string, string | null>;
const active = new Map<PortfolioStorageScope, { values: Values; notifications: (() => void)[] }>();
const hydration = new Map<PortfolioStorageScope, Promise<void>>();

export function portfolioStorageLockName(scope: PortfolioStorageScope): string {
  return `zhinote.portfolio.write.v1.${encodeURIComponent(scope)}`;
}

function legacySource(scope: PortfolioStorageScope): Values {
  const prefix = portfolioStorageKey(PREFIX, scope);
  const values: Values = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(prefix) && key !== `${prefix}syncPasscode.v1`) {
      values[PREFIX + key.slice(prefix.length)] = window.localStorage.getItem(key);
    }
  }
  for (const key of STATE_KEYS) values[key] ??= window.localStorage.getItem(portfolioStorageKey(key, scope));
  values[PORTFOLIO_STATE_KEY] = window.localStorage.getItem(portfolioStorageKey(PORTFOLIO_STATE_KEY, scope));
  return values;
}

function importScopedRecord(scope: PortfolioStorageScope): PortfolioLocalRecord {
  const source = legacySource(scope);
  const values = { ...source };
  const raw = values[PORTFOLIO_STATE_KEY];
  if (raw !== null) {
    const parsed = JSON.parse(raw);
    if (parsed?.format !== 2 || !parsed.values || typeof parsed.values !== "object" ||
        STATE_KEYS.some((key) => !(PORTFOLIO_OPTIONAL_VALUE_KEYS.includes(key) && parsed.values[key] === undefined) &&
          parsed.values[key] !== null && typeof parsed.values[key] !== "string")) {
      throw new Error("旧版组合保存记录无法读取，原始记录已保留，未自动迁移。");
    }
    for (const key of STATE_KEYS) values[key] = parsed.values[key] ?? null;
  }
  delete values[PORTFOLIO_STATE_KEY];
  // Import only the selected account's cache. Unscoped data needs explicit review.
  return { format: 1, scope, revision: 1, values, legacySource: source };
}

export function isPortfolioStorageReady(scope: PortfolioStorageScope): boolean {
  return scope === "legacy" || Boolean(cachedPortfolioRecord(scope));
}

export function hydratePortfolioStorage(scope = getPortfolioStorageScope()): Promise<void> {
  assertPortfolioScopeCurrent(scope);
  const existing = hydration.get(scope);
  if (existing) return existing;
  const task = (async () => {
    const before = cachedPortfolioRecord(scope)?.revision;
    const found = await readPortfolioRecord(scope);
    assertPortfolioScopeCurrent(scope);
    if (!found) await withPortfolioStorageLock(scope, () => undefined);
    if (before !== cachedPortfolioRecord(scope)?.revision) emitStorageChange(scope);
  })().finally(() => { if (hydration.get(scope) === task) hydration.delete(scope); });
  hydration.set(scope, task);
  return task;
}

// Keep the existing short lock to coordinate callers; IndexedDB, not the lock
// or the display cache, provides the authoritative fresh read and atomic commit.
export async function withPortfolioStorageLock<T>(scope: PortfolioStorageScope, write: () => T): Promise<T> {
  assertPortfolioScopeCurrent(scope);
  const run = async () => {
    let notifications: (() => void)[] = [];
    let changed = false;
    const result = await changePortfolioRecord(scope, (stored) => {
      assertPortfolioScopeCurrent(scope);
      const current = stored ?? importScopedRecord(scope);
      const batch = { values: { ...current.values }, notifications: [] as (() => void)[] };
      active.set(scope, batch);
      try {
        const result = write();
        if (result && typeof (result as { then?: unknown }).then === "function") throw new Error("Portfolio storage callbacks must be synchronous");
        assertPortfolioScopeCurrent(scope);
        changed = !stored || JSON.stringify(batch.values) !== JSON.stringify(current.values);
        notifications = batch.notifications;
        return { result, record: changed ? { ...current, values: batch.values, revision: current.revision + 1 } : current };
      } finally { active.delete(scope); }
    });
    // No UI success/queue wake-up is emitted before the native transaction completes.
    for (const notify of notifications) notify();
    if (changed) {
      emitStorageChange(scope);
      try { window.localStorage.setItem(PING_KEY, JSON.stringify({ scope, nonce: crypto.randomUUID() })); } catch { /* Focus/poll refresh remains available. */ }
    }
    return result;
  };
  if (!navigator.locks?.request) return run();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try { return await navigator.locks.request(portfolioStorageLockName(scope), { signal: controller.signal }, run); }
  finally { clearTimeout(timeout); }
}

export function batchPortfolioStorage<T>(scope: PortfolioStorageScope, write: () => T): T {
  assertPortfolioScopeCurrent(scope);
  if (!active.has(scope)) throw new Error("组合写入未取得本机保存锁，未改动数据。");
  return write();
}

export function afterPortfolioStorageCommit(scope: PortfolioStorageScope, notify: () => void): void {
  const batch = active.get(scope);
  if (batch) batch.notifications.push(notify);
  else notify();
}

function emitStorageChange(scope: PortfolioStorageScope) {
  window.dispatchEvent(new CustomEvent(PORTFOLIO_STORAGE_EVENT, { detail: { scope } }));
}

export function subscribePortfolioStorage(scope: PortfolioStorageScope, listener: () => void): () => void {
  const updated = (event: Event) => { if ((event as CustomEvent).detail?.scope === scope) listener(); };
  const refresh = () => { if (isPortfolioScopeCurrent(scope)) void hydratePortfolioStorage(scope).catch(listener); };
  const storage = (event: StorageEvent) => { if (event.key === PING_KEY || event.key === null) refresh(); };
  window.addEventListener(PORTFOLIO_STORAGE_EVENT, updated);
  window.addEventListener("storage", storage);
  window.addEventListener("focus", refresh);
  const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000);
  return () => {
    window.removeEventListener(PORTFOLIO_STORAGE_EVENT, updated);
    window.removeEventListener("storage", storage);
    window.removeEventListener("focus", refresh);
    window.clearInterval(timer);
  };
}

export function readPortfolioStorageCheckpoint(scope: PortfolioStorageScope): string {
  assertPortfolioScopeCurrent(scope);
  return JSON.stringify(STATE_KEYS.map((key) => portfolioStorage(scope).getItem(key)));
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
  try { return scope !== "legacy" && scope === getPortfolioStorageScope(); } catch { return false; }
}

export function assertPortfolioScopeCurrent(scope: PortfolioStorageScope): void {
  if (!isPortfolioScopeCurrent(scope)) throw new Error("组合所属账号已改变，未跨账号读写本机数据。");
}

export function portfolioStorage(scope = getPortfolioStorageScope()) {
  const getItem = (key: string): string | null => {
    if (scope === "legacy" || key === `${PREFIX}syncPasscode.v1`) return window.localStorage.getItem(portfolioStorageKey(key, scope));
    const values = active.get(scope)?.values ?? cachedPortfolioRecord(scope)?.values;
    if (!values) throw new Error("组合本机数据尚未读取完成，未使用空值替代。");
    return values[key] ?? null;
  };
  const change = (key: string, value: string | null) => {
    assertPortfolioScopeCurrent(scope);
    if (key === `${PREFIX}syncPasscode.v1`) {
      if (value === null) window.localStorage.removeItem(portfolioStorageKey(key, scope));
      else window.localStorage.setItem(portfolioStorageKey(key, scope), value);
      return;
    }
    const batch = active.get(scope);
    if (!batch) throw new Error("组合写入未取得本机保存锁，未改动数据。");
    batch.values[key] = value;
  };
  return { getItem, setItem: (key: string, value: string) => change(key, value), removeItem: (key: string) => change(key, null) };
}
