// Client helpers for account-scoped portfolio cloud sync. Used when the
// browser is signed in (session cookie); devices that are not signed in
// keep using the passcode-based cloudSync helpers.

import { checkAccountCloudSyncGate } from "@/lib/account/accountCloudSyncGate";
import { portfolioCloudAckConfirmsPush, type CloudPortfolioData } from "./cloudSync";
import type { TagMap } from "./positionReport";
import {
  acceptPortfolioCloudVersion, createPortfolioPushGuard, parsePortfolioCloudVersion,
  retainPortfolioConflict, type PortfolioCloudVersion,
} from "./portfolioSyncRevision";
import { capturePortfolioAccountContext, isPortfolioAccountContextCurrent, type PortfolioAccountContext } from "./portfolioAccountContext";
import { assertPortfolioScopeCurrent, getPortfolioStorageScope, type PortfolioStorageScope } from "./portfolioStorageScope";

const ACCOUNT_PORTFOLIO_SYNC_REQUEST_TIMEOUT_MS = 12000;

export type AccountSyncResult<T> =
  | { status: "ok"; data: T; version?: PortfolioCloudVersion }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | { status: "forbidden" }
  | { status: "error"; message?: string; retryable?: boolean; code?: "account-changed" };

function accountChangedResult(): AccountSyncResult<never> {
  return { status: "error", code: "account-changed", retryable: false,
    message: "登录账号已改变，已停止处理旧账号的组合同步结果；本机数据和待上传记录仍保留。" };
}

async function call<T>(
  body: Record<string, unknown>,
  pick: (json: Record<string, unknown>) => T,
  scope?: PortfolioStorageScope
): Promise<AccountSyncResult<T>> {
  let context: PortfolioAccountContext | undefined;
  try {
    context = capturePortfolioAccountContext();
    if (scope) {
      assertPortfolioScopeCurrent(scope);
      if (scope !== `account:${context.accountId}`) return accountChangedResult();
    }
    const accountGate = await checkAccountCloudSyncGate();
    if (!isPortfolioAccountContextCurrent(context)) return accountChangedResult();
    if (accountGate.status === "unconfigured") return { status: "unconfigured" };
    if (accountGate.status === "signed-out") return { status: "unauthenticated" };
    if (accountGate.status === "unconfirmed") {
      return {
        status: "error",
        message:
          "账号登录状态暂时无法确认；组合数据仍保留在本地，稍后可重试。",
      };
    }
    if (accountGate.status === "error") {
      return {
        status: "error",
        message:
          "账号状态暂时无法确认；组合数据仍保留在本地，稍后可重试。",
      };
    }
    if (!context.accountId) {
      return { status: "error", message: "账号身份暂时无法确认，未发送组合数据；请在账号页确认登录。" };
    }
    const res = await fetchAccountPortfolioSync({ ...body, expectedAccountId: context.accountId });
    if (!isPortfolioAccountContextCurrent(context)) return accountChangedResult();
    if (res.status === 501) return { status: "unconfigured" };
    if (res.status === 401) {
      return {
        status: "error",
        message:
          "组合同步接口暂时无法确认账号权限；本地组合数据未删除，请稍后重试。",
      };
    }
    if (res.status === 403) return { status: "forbidden" };
    const json = await res.json().catch(() => ({}));
    if (!isPortfolioAccountContextCurrent(context) || json.code === "account-changed") return accountChangedResult();
    if ((res.ok || json.code === "portfolio-conflict") && json.accountId !== context.accountId) {
      throw new Error("组合同步结果缺少匹配的账号确认；未应用云端数据，待上传记录仍保留。");
    }
    if (!res.ok) {
      if (res.status === 409 && json.code === "portfolio-conflict" && body.action === "push") {
        retainPortfolioConflict("account", body.data as CloudPortfolioData, json, scope);
      }
      return {
        status: "error",
        message: typeof json.error === "string" ? json.error : undefined,
        retryable: res.status !== 409 && res.status !== 428,
      };
    }
    return { status: "ok", data: pick(json), version: parsePortfolioCloudVersion(json.version) ?? undefined };
  } catch (error) {
    if (context && !isPortfolioAccountContextCurrent(context)) return accountChangedResult();
    return {
      status: "error",
      message: isAbortError(error)
        ? "组合同步请求超时；本地组合数据已保留，会稍后重试。"
        : error instanceof Error
          ? error.message
          : undefined,
    };
  }
}

async function fetchAccountPortfolioSync(
  body: Record<string, unknown>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ACCOUNT_PORTFOLIO_SYNC_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch("/api/portfolio/account-sync", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

export function accountPullCloud(
  from?: string
): Promise<AccountSyncResult<CloudPortfolioData | null>> {
  return call({ action: "pull", from }, (json) => {
    if (!json.readOnly && !parsePortfolioCloudVersion(json.version)) throw new Error("云端版本暂时无法确认，请稍后重试。");
    return json.data ? (json.data as CloudPortfolioData) : null;
  });
}

// Returns only labels confirmed by this version-bound cloud receipt.
export async function accountPushCloud(
  data: CloudPortfolioData,
  reviewedVersion?: PortfolioCloudVersion,
  scope = getPortfolioStorageScope()
): Promise<AccountSyncResult<TagMap | null>> {
  assertPortfolioScopeCurrent(scope);
  const localGuard = createPortfolioPushGuard("account", scope);
  if (reviewedVersion && localGuard.base && reviewedVersion.scope !== localGuard.base.scope) {
    return { status: "error", retryable: false, message: "账号已改变，未上传冲突处理结果。" };
  }
  const guard = reviewedVersion ? { ...localGuard, base: reviewedVersion } : localGuard;
  return call({ action: "push", data, ...guard }, (json) => {
    const ack = json.ack;
    if (!portfolioCloudAckConfirmsPush(ack, data, guard)) {
      throw new Error(
        "组合同步缺少云端 ACK；本地组合数据已保留，会稍后重试。"
      );
    }
    if (!acceptPortfolioCloudVersion("account", localGuard, parsePortfolioCloudVersion(ack)!, scope)) {
      throw new Error("组合云端版本已变化；保留待上传修改，下次同步重新核对。");
    }
    // v2 persists the exact submitted document; it no longer unions tags.
    return data.tagMap;
  }, scope);
}

export interface ShareInfo {
  members: string[]; // emails I shared my portfolio with
  sharedWithMe: string[]; // owners who shared their portfolio with me
}

export function fetchShares(): Promise<AccountSyncResult<ShareInfo>> {
  return call({ action: "shares" }, (json) => ({
    members: Array.isArray(json.members) ? (json.members as string[]) : [],
    sharedWithMe: Array.isArray(json.sharedWithMe)
      ? (json.sharedWithMe as string[])
      : [],
  }));
}

export function addShareEmail(
  email: string
): Promise<AccountSyncResult<string[]>> {
  return call({ action: "share-add", email }, (json) =>
    Array.isArray(json.members) ? (json.members as string[]) : []
  );
}

export function removeShareEmail(
  email: string
): Promise<AccountSyncResult<string[]>> {
  return call({ action: "share-remove", email }, (json) =>
    Array.isArray(json.members) ? (json.members as string[]) : []
  );
}
