import type { CloudPortfolioData } from "./cloudSync";

export interface PortfolioCloudVersion {
  scope: string;
  revision: string | null;
}

export interface PortfolioPushGuard {
  protocol: 2;
  requestId: string;
  base: PortfolioCloudVersion | null;
}

type Mode = "account" | "passcode";
const BASE_KEY = "zhinote.portfolio.sync.base.v2";
export const PORTFOLIO_CONFLICT_EVENT = "zhinote:portfolio-conflict";
export const PORTFOLIO_ACTIVE_CONFLICT_KEY = "zhinote.portfolio.sync.conflict.v1";

export function readActivePortfolioConflict(mode: Mode): PortfolioCloudVersion | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${PORTFOLIO_ACTIVE_CONFLICT_KEY}.${mode}`);
  if (!raw) return null;
  const version = parsePortfolioCloudVersion(JSON.parse(raw));
  if (!version) throw new Error("组合冲突记录无法读取；本机数据已保留。");
  return version;
}

export function clearActivePortfolioConflict(mode: Mode, expected: PortfolioCloudVersion): void {
  const current = readActivePortfolioConflict(mode);
  if (current?.scope !== expected.scope || current?.revision !== expected.revision) return;
  window.localStorage.removeItem(`${PORTFOLIO_ACTIVE_CONFLICT_KEY}.${mode}`);
  window.dispatchEvent(new Event(PORTFOLIO_CONFLICT_EVENT));
}

export function parsePortfolioCloudVersion(value: unknown): PortfolioCloudVersion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.scope !== "string" || !/^[a-f0-9]{64}$/.test(candidate.scope)) return null;
  if (candidate.revision !== null &&
      (typeof candidate.revision !== "string" || !/^[a-f0-9]{64}$/.test(candidate.revision))) return null;
  return { scope: candidate.scope, revision: candidate.revision };
}

export function readPortfolioCloudBase(mode: Mode): PortfolioCloudVersion | null {
  const raw = window.localStorage.getItem(`${BASE_KEY}.${mode}`);
  if (!raw) return null;
  const version = parsePortfolioCloudVersion(JSON.parse(raw));
  if (!version) throw new Error("组合版本记录无法读取；已停止上传，保留本机数据。");
  return version;
}

// Call only after applying a complete pull, never merely after receiving it.
export function rememberPortfolioCloudBase(mode: Mode, version: PortfolioCloudVersion): void {
  window.localStorage.setItem(`${BASE_KEY}.${mode}`, JSON.stringify(version));
}

export function createPortfolioPushGuard(mode: Mode): PortfolioPushGuard {
  return { protocol: 2, requestId: crypto.randomUUID(), base: readPortfolioCloudBase(mode) };
}

export function acceptPortfolioCloudVersion(mode: Mode, guard: PortfolioPushGuard, version: PortfolioCloudVersion): boolean {
  const current = readPortfolioCloudBase(mode);
  const same = (a: PortfolioCloudVersion | null, b: PortfolioCloudVersion | null) =>
    a?.scope === b?.scope && a?.revision === b?.revision;
  // A delayed receipt cannot move a different tab's newer baseline backwards.
  if (!same(current, guard.base) && !same(current, version)) return false;
  rememberPortfolioCloudBase(mode, version);
  return true;
}

export function retainPortfolioConflict(mode: Mode, local: CloudPortfolioData, response: Record<string, unknown>): void {
  const version = parsePortfolioCloudVersion(response.version);
  if (!version || !("data" in response)) throw new Error("云端冲突版本无法确认；本地数据未清除。");
  // Private recovery data stays in this browser, not in diagnostic/status exports.
  const key = `zhinote.portfolio.conflict.v2.${mode}.${version.scope}.${version.revision ?? "empty"}`;
  if (window.localStorage.getItem(key) === null) {
    window.localStorage.setItem(key, JSON.stringify({ local, cloud: response.data, version, savedAt: new Date().toISOString() }));
  }
  window.localStorage.setItem(`${PORTFOLIO_ACTIVE_CONFLICT_KEY}.${mode}`, JSON.stringify(version));
  window.dispatchEvent(new Event(PORTFOLIO_CONFLICT_EVENT));
}
