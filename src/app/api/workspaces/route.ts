import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  authRequiredResponse,
  badRequestResponse,
  cloudNotConfiguredResponse,
  getBearerToken,
  requireCloudWritesResponse,
  supabaseErrorResponse,
} from "@/lib/cloud/api";
import { getSupabaseUser, requestSupabaseRest } from "@/lib/cloud/supabaseRest";

export const dynamic = "force-dynamic";

interface WorkspaceCreateBody {
  name?: unknown;
}

interface CloudWorkspaceRow {
  id: string;
  name: string;
  beta_status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CloudMembershipRow {
  workspace_id?: string;
  role: "owner" | "researcher" | "viewer";
  created_at: string;
}

interface CloudWorkspaceListItem extends CloudWorkspaceRow {
  role: "owner" | "researcher" | "viewer";
  membership_created_at: string;
}

export async function GET(request: Request) {
  const disabled = cloudNotConfiguredResponse("workspace-list");
  if (disabled) return disabled;

  const accessToken = getBearerToken(request);
  if (!accessToken) return authRequiredResponse();

  try {
    const user = await getSupabaseUser(accessToken);
    const memberships = await requestSupabaseRest<CloudMembershipRow[]>(
      `/workspace_members?user_id=eq.${encodeURIComponent(
        user.id
      )}&select=workspace_id,role,created_at&order=created_at.desc`,
      { method: "GET" },
      accessToken
    );

    const workspaceIds = memberships
      .map((membership) => membership.workspace_id)
      .filter((id): id is string => Boolean(id));

    if (workspaceIds.length === 0) {
      return NextResponse.json({
        format: "zhinote-cloud-workspace-list",
        user: {
          id: user.id,
          email: user.email,
        },
        workspaces: [],
        sync: {
          push_enabled: false,
          pull_enabled: false,
          note:
            "当前账号还没有可访问的 cloud workspace；本地内容没有上传。",
        },
        privacy_note:
          "该接口只读取 workspace membership 元数据，不读取本地笔记、文件或数据库。",
      });
    }

    const workspaceRows = await requestSupabaseRest<CloudWorkspaceRow[]>(
      `/workspaces?id=in.(${workspaceIds
        .map((id) => encodeURIComponent(id))
        .join(",")})&select=id,name,beta_status,settings,created_at,updated_at`,
      { method: "GET" },
      accessToken
    );
    const workspaceMap = new Map(
      workspaceRows.map((workspace) => [workspace.id, workspace])
    );
    const workspaces: CloudWorkspaceListItem[] = memberships
      .map((membership) => {
        const workspace = membership.workspace_id
          ? workspaceMap.get(membership.workspace_id)
          : null;
        if (!workspace) return null;
        return {
          ...workspace,
          role: membership.role,
          membership_created_at: membership.created_at,
        };
      })
      .filter((workspace): workspace is CloudWorkspaceListItem =>
        Boolean(workspace)
      );

    return NextResponse.json({
      format: "zhinote-cloud-workspace-list",
      user: {
        id: user.id,
        email: user.email,
      },
      workspaces,
      sync: {
        push_enabled: false,
        pull_enabled: false,
        note:
          "该接口只列出 workspace 元数据；不会上传或拉取本地页面正文、文件、数据库 rows 或 sync queue。",
      },
      privacy_note:
        "该接口只读取 Supabase workspace 和 membership 元数据。",
    });
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const disabled = cloudNotConfiguredResponse("workspace-create");
  if (disabled) return disabled;

  const writesDisabled = requireCloudWritesResponse("workspace-create");
  if (writesDisabled) return writesDisabled;

  const accessToken = getBearerToken(request);
  if (!accessToken) return authRequiredResponse();

  let body: WorkspaceCreateBody = {};
  try {
    body = (await request.json()) as WorkspaceCreateBody;
  } catch {
    return badRequestResponse("请求体需要是 JSON。");
  }

  const name = normalizeWorkspaceName(body.name);
  const workspaceId = randomUUID();
  const now = new Date().toISOString();

  try {
    const user = await getSupabaseUser(accessToken);

    await requestSupabaseRest<null>(
      "/users?on_conflict=id",
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          updated_at: now,
        }),
      },
      accessToken
    );

    await requestSupabaseRest<null>(
      "/workspaces",
      {
        method: "POST",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: workspaceId,
          owner_id: user.id,
          name,
          settings: {
            created_from: "zhinotes-cloud-alpha",
            local_sync_enabled: false,
          },
        }),
      },
      accessToken
    );

    await requestSupabaseRest<null>(
      "/workspace_members",
      {
        method: "POST",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          user_id: user.id,
          role: "owner",
        }),
      },
      accessToken
    );

    const [workspaceRows, membershipRows] = await Promise.all([
      requestSupabaseRest<CloudWorkspaceRow[]>(
        `/workspaces?id=eq.${encodeURIComponent(
          workspaceId
        )}&select=id,name,beta_status,settings,created_at,updated_at`,
        { method: "GET" },
        accessToken
      ),
      requestSupabaseRest<CloudMembershipRow[]>(
        `/workspace_members?workspace_id=eq.${encodeURIComponent(
          workspaceId
        )}&user_id=eq.${encodeURIComponent(user.id)}&select=role,created_at`,
        { method: "GET" },
        accessToken
      ),
    ]);

    const workspace = workspaceRows[0] ?? null;
    const membership = membershipRows[0] ?? null;

    if (!workspace || !membership) {
      return NextResponse.json(
        {
          format: "zhinote-cloud-error",
          error: "workspace-create-verification-failed",
          message: "Workspace 已创建请求已发送，但创建结果没有通过 RLS 验证。",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      format: "zhinote-cloud-workspace-create",
      workspace,
      membership: {
        user_id: user.id,
        role: membership.role,
        created_at: membership.created_at,
      },
      sync: {
        push_enabled: false,
        pull_enabled: false,
        note:
          "第一阶段只创建空 workspace；不会上传本地页面正文、文件、数据库 rows 或 sync queue。",
      },
      privacy_note:
        "该接口只写入 Supabase 用户 profile、workspace 元数据和 owner membership。",
    });
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}

function normalizeWorkspaceName(value: unknown) {
  if (typeof value !== "string") return "ZhiNotes Workspace";
  const trimmed = value.trim();
  if (!trimmed) return "ZhiNotes Workspace";
  return trimmed.slice(0, 80);
}
