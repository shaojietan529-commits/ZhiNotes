"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseSupabaseAuthHash,
  readCloudSession,
  type ZhiNotesCloudSession,
  writeCloudSession,
} from "@/lib/cloud/clientSession";
import {
  buildCloudWorkspaceBootstrapProof,
  linkLocalWorkspaceToCloud,
  readLocalWorkspaceIdentity,
} from "@/lib/sync/workspaceIdentity";

const AUTH_CALLBACK_CLOUD_REQUEST_TIMEOUT_MS = 4500;

type CallbackState =
  | {
      status: "checking";
      title: string;
      detail: string;
    }
  | {
      status: "ready";
      title: string;
      detail: string;
    }
  | {
      status: "error";
      title: string;
      detail: string;
    };

type CloudRole = "owner" | "researcher" | "viewer";

type CloudHandoffRecoveryStatus =
  | "recovered"
  | "workspace-choice"
  | "no-workspace"
  | "metadata-unavailable"
  | "failed";

interface CloudHandoffRecoveryResult {
  status: CloudHandoffRecoveryStatus;
  title: string;
  detail: string;
  session: ZhiNotesCloudSession;
}

interface AuthCallbackCloudWorkspace {
  id: string;
  name: string;
  beta_status: string;
  role?: CloudRole;
  created_at?: string;
  updated_at?: string;
}

export default function CloudAuthCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>({
    status: "checking",
    title: "正在完成登录",
    detail: "ZhiNotes 正在读取 Supabase 返回的登录结果。",
  });

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: number | null = null;

    const handleCallback = async () => {
      const result = parseSupabaseAuthHash(window.location.hash);

      if (result.status === "authenticated") {
        writeCloudSession(result.session);
        window.history.replaceState(null, "", "/auth/callback");
        setState({
          status: "checking",
          title: "云端登录已连接",
          detail:
            "已保存本地云 session，正在尝试恢复云 workspace 接力。这个过程只读取账号和 workspace metadata。",
        });

        const recovery = await recoverCloudHandoffFromSession(result.session);
        if (cancelled) return;

        writeCloudSession(recovery.session);
        setState({
          status: "ready",
          title: recovery.title,
          detail: recovery.detail,
        });

        redirectTimer = window.setTimeout(() => {
          router.replace(
            `/modules/sync?cloud=connected&handoff=${recovery.status}`
          );
        }, recovery.status === "recovered" ? 800 : 1200);
        return;
      }

      if (result.status === "error") {
        window.history.replaceState(null, "", "/auth/callback");
        setState({
          status: "error",
          title: "登录没有完成",
          detail: `${result.error}: ${result.description}`,
        });
        return;
      }

      const existing = readCloudSession();
      if (existing) {
        setState({
          status: "ready",
          title: "云端 session 已存在",
          detail: "浏览器里已经有本地云 session，可以回到 Web Sync 模块继续。",
        });
        return;
      }

      setState({
        status: "error",
        title: "没有找到登录结果",
        detail:
          "请从 ZhiNotes 的 Web Sync 模块重新发送登录链接，并使用同一个浏览器打开邮件链接。",
      });
    };

    const effectTimer = window.setTimeout(() => {
      void handleCallback();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(effectTimer);
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [router]);

  const isReady = state.status === "ready";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div
          className={`mb-4 h-1.5 w-16 rounded-full ${
            state.status === "checking"
              ? "bg-blue-500"
              : isReady
                ? "bg-green-500"
                : "bg-red-500"
          }`}
        />
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          ZhiNotes Cloud Alpha
        </p>
        <h1 className="mt-2 text-xl font-semibold">{state.title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {state.detail}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.replace("/modules/sync")}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            回到 Web Sync
          </button>
          {!isReady && (
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              回到首页
            </button>
          )}
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-400">
          这个 Alpha 回调只保存登录 token，并可只读恢复 workspace
          metadata；不读取本地笔记、文件或数据库，也不会上传内容。
        </p>
      </section>
    </main>
  );
}

async function recoverCloudHandoffFromSession(
  session: ZhiNotesCloudSession
): Promise<CloudHandoffRecoveryResult> {
  try {
    const sessionResponse = await fetchAuthCallbackCloudApi(
      "/api/auth/session",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );
    const sessionBody = await readCloudCallbackBody(sessionResponse);
    if (!sessionResponse.ok) {
      return buildRecoveryResult({
        status: "metadata-unavailable",
        session,
        title: "云端登录已连接",
        detail:
          "登录已保存，但云端 session metadata 暂时不可用；不会自动登出，稍后可在同步中心手动恢复云接力。",
      });
    }

    if (!getRecordBoolean(sessionBody, "authenticated")) {
      return buildRecoveryResult({
        status: "failed",
        session,
        title: "云端登录已保存",
        detail:
          "本地 token 已保存，但云端暂时没有确认认证状态；不会自动登出，请稍后在同步中心检查会话。",
      });
    }

    const user = getCloudSessionUser(sessionBody);
    if (!user?.id) {
      return buildRecoveryResult({
        status: "metadata-unavailable",
        session,
        title: "云端登录已保存",
        detail:
          "云端没有返回可绑定的 user id；不会自动登出，稍后可在同步中心手动检查会话。",
      });
    }

    const sessionWithUser: ZhiNotesCloudSession = {
      ...session,
      user,
    };

    const workspaceResponse = await fetchAuthCallbackCloudApi(
      "/api/workspaces",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionWithUser.accessToken}`,
        },
      }
    );
    const workspaceBody = await readCloudCallbackBody(workspaceResponse);
    if (!workspaceResponse.ok) {
      return buildRecoveryResult({
        status: "metadata-unavailable",
        session: sessionWithUser,
        title: "云端登录已连接",
        detail:
          "登录已保存，但 workspace metadata 暂时不可用；不会自动登出，也不会上传本地内容。",
      });
    }

    const workspaces = getCloudWorkspaces(workspaceBody);
    if (workspaces.length === 0) {
      return buildRecoveryResult({
        status: "no-workspace",
        session: sessionWithUser,
        title: "云端登录已连接",
        detail:
          "当前账号还没有可恢复的云 workspace。可以在同步中心创建空 workspace；本地内容仍保留在本机。",
      });
    }

    const localIdentity = readLocalWorkspaceIdentity();
    const preferredWorkspaceId = localIdentity?.cloud_workspace_id ?? "";
    const targetWorkspace =
      (preferredWorkspaceId
        ? workspaces.find((workspace) => workspace.id === preferredWorkspaceId)
        : null) ?? (workspaces.length === 1 ? workspaces[0] : null);

    if (!targetWorkspace) {
      return buildRecoveryResult({
        status: "workspace-choice",
        session: sessionWithUser,
        title: "云端登录已连接",
        detail:
          `找到 ${workspaces.length} 个可访问 workspace。为避免接错研究空间，请回到同步中心手动选择一个；不会自动上传本地内容。`,
      });
    }

    const workspaceId = targetWorkspace.id;
    const bootstrapResponse = await fetchAuthCallbackCloudApi(
      `/api/workspaces/${workspaceId}/bootstrap`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionWithUser.accessToken}`,
        },
      }
    );
    const bootstrapBody = await readCloudCallbackBody(bootstrapResponse);
    if (!bootstrapResponse.ok) {
      return buildRecoveryResult({
        status: "metadata-unavailable",
        session: sessionWithUser,
        title: "云端登录已连接",
        detail:
          "登录已保存，但 workspace 启动检查暂时不可用；不会自动登出，也不会上传本地内容。",
      });
    }

    const workspace = getCloudWorkspace(bootstrapBody) ?? targetWorkspace;
    const membership = getCloudMembership(bootstrapBody);
    const syncState = getCloudSyncState(bootstrapBody);
    const role = membership?.role ?? targetWorkspace.role ?? "owner";
    const cloudUserId = membership?.user_id || sessionWithUser.user?.id;
    if (!cloudUserId) {
      return buildRecoveryResult({
        status: "metadata-unavailable",
        session: sessionWithUser,
        title: "云端登录已连接",
        detail:
          "启动检查没有返回 user id；不会自动登出，稍后可在同步中心手动恢复云接力。",
      });
    }

    const proof = buildCloudWorkspaceBootstrapProof({
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      user: {
        id: cloudUserId,
      },
      role,
      moduleCount: getCloudModuleCount(bootstrapBody),
      syncPushEnabled: syncState.push_enabled,
      syncPullEnabled: syncState.pull_enabled,
    });

    linkLocalWorkspaceToCloud({
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      user: {
        id: cloudUserId,
      },
      role,
      bootstrapProof: proof,
    });

    return buildRecoveryResult({
      status: "recovered",
      session: sessionWithUser,
      title: "云接力已恢复",
      detail:
        `已把这台设备接回 ${workspace.name}。这里只恢复账号/workspace metadata，不上传页面、数据库、文件或同步队列。`,
    });
  } catch (error) {
    return buildRecoveryResult({
      status: "metadata-unavailable",
      session,
      title: "云端登录已连接",
      detail:
        error instanceof Error
          ? `登录已保存，但自动恢复云接力失败：${error.message}。不会自动登出，也不会上传本地内容。`
          : "登录已保存，但自动恢复云接力失败；不会自动登出，也不会上传本地内容。",
    });
  }
}

function buildRecoveryResult(input: CloudHandoffRecoveryResult) {
  return input;
}

async function fetchAuthCallbackCloudApi(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, AUTH_CALLBACK_CLOUD_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readCloudCallbackBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      message: text,
    };
  }
}

function getCloudSessionUser(body: Record<string, unknown> | null) {
  const user = getRecordValue(body, "user");
  if (!user) return null;
  const id = getRecordString(user, "id");
  if (!id) return null;

  return {
    id,
    email: getRecordString(user, "email") || null,
  };
}

function getCloudWorkspaces(body: Record<string, unknown> | null) {
  const value = body?.workspaces;
  if (!Array.isArray(value)) return [];

  const workspaces: AuthCallbackCloudWorkspace[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = getRecordString(record, "id");
    const name = getRecordString(record, "name");
    if (!id || !name) continue;
    workspaces.push({
      id,
      name,
      beta_status: getRecordString(record, "beta_status") || "private-alpha",
      role: getCloudRole(record.role),
      created_at: getRecordString(record, "created_at") || undefined,
      updated_at: getRecordString(record, "updated_at") || undefined,
    });
  }

  return workspaces;
}

function getCloudWorkspace(body: Record<string, unknown> | null) {
  const workspace = getRecordValue(body, "workspace");
  if (!workspace) return null;
  const id = getRecordString(workspace, "id");
  const name = getRecordString(workspace, "name");
  if (!id || !name) return null;

  return {
    id,
    name,
    beta_status: getRecordString(workspace, "beta_status") || "private-alpha",
    created_at: getRecordString(workspace, "created_at") || undefined,
    updated_at: getRecordString(workspace, "updated_at") || undefined,
  } satisfies AuthCallbackCloudWorkspace;
}

function getCloudMembership(body: Record<string, unknown> | null) {
  const membership = getRecordValue(body, "membership");
  if (!membership) return null;

  return {
    user_id: getRecordString(membership, "user_id"),
    role: getCloudRole(membership.role),
  };
}

function getCloudModuleCount(body: Record<string, unknown> | null) {
  const modules = body?.modules;
  return Array.isArray(modules) ? modules.length : 0;
}

function getCloudSyncState(body: Record<string, unknown> | null) {
  const sync = getRecordValue(body, "sync");
  return {
    push_enabled: getRecordBoolean(sync, "push_enabled"),
    pull_enabled: getRecordBoolean(sync, "pull_enabled"),
  };
}

function getCloudRole(value: unknown): CloudRole | undefined {
  return value === "owner" || value === "researcher" || value === "viewer"
    ? value
    : undefined;
}

function getRecordString(
  record: Record<string, unknown> | null,
  key: string
) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function getRecordBoolean(
  record: Record<string, unknown> | null,
  key: string
) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : false;
}

function getRecordValue(
  record: Record<string, unknown> | null,
  key: string
) {
  const value = record?.[key];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
