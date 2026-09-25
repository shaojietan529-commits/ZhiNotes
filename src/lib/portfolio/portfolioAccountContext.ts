import {
  ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY,
  ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY,
  getLastAuthenticatedAccount,
} from "@/lib/account/clientSession";

export interface PortfolioAccountContext {
  accountId: string | null;
  identity: string;
}

// This is an in-memory request guard, not authentication or cache ownership.
// Check both stores: another tab can change the cookie/local identity while
// this tab still has the previous account in sessionStorage.
export function capturePortfolioAccountContext(): PortfolioAccountContext {
  const account = getLastAuthenticatedAccount();
  const stores = [window.localStorage, window.sessionStorage];
  const ids = stores.map((storage) => {
    const raw = storage.getItem(ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY);
    if (!raw) return null;
    const id: unknown = JSON.parse(raw)?.account?.id;
    if (typeof id !== "string" || !id) throw new Error("无法确认组合所属账号；本机数据未修改。");
    return id;
  });
  const logout = stores.map((storage) => storage.getItem(ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY));
  return {
    accountId: account && !logout.some(Boolean) && ids.every((id) => id === null || id === account.id)
      ? account.id : null,
    identity: JSON.stringify([account?.id ?? null, ids, logout]),
  };
}

export function isPortfolioAccountContextCurrent(context: PortfolioAccountContext): boolean {
  try {
    return capturePortfolioAccountContext().identity === context.identity;
  } catch {
    return false;
  }
}
