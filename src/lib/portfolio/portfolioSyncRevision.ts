import type { CloudPortfolioData } from "./cloudSync";
import { afterPortfolioStorageCommit, getPortfolioStorageScope, portfolioStorage } from "./portfolioStorageScope";

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

export function readActivePortfolioConflict(mode: Mode, scope = getPortfolioStorageScope()): PortfolioCloudVersion | null {
  if (typeof window === "undefined") return null;
  const raw = portfolioStorage(scope).getItem(`${PORTFOLIO_ACTIVE_CONFLICT_KEY}.${mode}`);
  if (!raw) return null;
  const version = parsePortfolioCloudVersion(JSON.parse(raw));
  if (!version) throw new Error("组合冲突记录无法读取；本机数据已保留。");
  return version;
}

export function clearActivePortfolioConflict(mode: Mode, expected: PortfolioCloudVersion, scope = getPortfolioStorageScope()): void {
  const current = readActivePortfolioConflict(mode, scope);
  if (current?.scope !== expected.scope || current?.revision !== expected.revision) return;
  portfolioStorage(scope).removeItem(`${PORTFOLIO_ACTIVE_CONFLICT_KEY}.${mode}`);
  afterPortfolioStorageCommit(scope, () => window.dispatchEvent(new Event(PORTFOLIO_CONFLICT_EVENT)));
}

export function parsePortfolioCloudVersion(value: unknown): PortfolioCloudVersion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.scope !== "string" || !/^[a-f0-9]{64}$/.test(candidate.scope)) return null;
  if (candidate.revision !== null &&
      (typeof candidate.revision !== "string" || !/^[a-f0-9]{64}$/.test(candidate.revision))) return null;
  return { scope: candidate.scope, revision: candidate.revision };
}

export function readPortfolioCloudBase(mode: Mode, scope = getPortfolioStorageScope()): PortfolioCloudVersion | null {
  const raw = portfolioStorage(scope).getItem(`${BASE_KEY}.${mode}`);
  if (!raw) return null;
  const version = parsePortfolioCloudVersion(JSON.parse(raw));
  if (!version) throw new Error("组合版本记录无法读取；已停止上传，保留本机数据。");
  return version;
}

// Call only after applying a complete pull, never merely after receiving it.
export function rememberPortfolioCloudBase(mode: Mode, version: PortfolioCloudVersion, scope = getPortfolioStorageScope()): void {
  portfolioStorage(scope).setItem(`${BASE_KEY}.${mode}`, JSON.stringify(version));
}

export function createPortfolioPushGuard(mode: Mode, scope = getPortfolioStorageScope()): PortfolioPushGuard {
  return { protocol: 2, requestId: crypto.randomUUID(), base: readPortfolioCloudBase(mode, scope) };
}

export function acceptPortfolioCloudVersion(mode: Mode, guard: PortfolioPushGuard, version: PortfolioCloudVersion, scope = getPortfolioStorageScope()): boolean {
  const current = readPortfolioCloudBase(mode, scope);
  const same = (a: PortfolioCloudVersion | null, b: PortfolioCloudVersion | null) =>
    a?.scope === b?.scope && a?.revision === b?.revision;
  // A delayed receipt cannot move a different tab's newer baseline backwards.
  if (!same(current, guard.base) && !same(current, version)) return false;
  rememberPortfolioCloudBase(mode, version, scope);
  return true;
}

export function retainPortfolioConflict(mode: Mode, local: CloudPortfolioData, response: Record<string, unknown>, scope = getPortfolioStorageScope()): void {
  const version = parsePortfolioCloudVersion(response.version);
  if (!version || !("data" in response)) throw new Error("云端冲突版本无法确认；本地数据未清除。");
  // Private recovery data stays in this browser, not in diagnostic/status exports.
  const key = `zhinote.portfolio.conflict.v2.${mode}.${version.scope}.${version.revision ?? "empty"}`;
  if (portfolioStorage(scope).getItem(key) === null) {
    portfolioStorage(scope).setItem(key, JSON.stringify({ local, cloud: response.data, version, savedAt: new Date().toISOString() }));
  }
  portfolioStorage(scope).setItem(`${PORTFOLIO_ACTIVE_CONFLICT_KEY}.${mode}`, JSON.stringify(version));
  afterPortfolioStorageCommit(scope, () => window.dispatchEvent(new Event(PORTFOLIO_CONFLICT_EVENT)));
}
