import { getLastAuthenticatedAccount } from "@/lib/account/clientSession";
import { capturePortfolioAccountContext } from "./portfolioAccountContext";

export type PortfolioStorageScope = "local" | "legacy" | `account:${string}`;
const PREFIX = "zhinote.portfolio.";

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
  return {
    getItem: (key: string) => window.localStorage.getItem(portfolioStorageKey(key, scope)),
    setItem: (key: string, value: string) => window.localStorage.setItem(portfolioStorageKey(key, scope), value),
    removeItem: (key: string) => window.localStorage.removeItem(portfolioStorageKey(key, scope)),
  };
}
