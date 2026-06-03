import { NextResponse } from "next/server";
import {
  authRequiredResponse,
  cloudNotConfiguredResponse,
  getBearerToken,
  supabaseErrorResponse,
} from "@/lib/cloud/api";
import { getSupabaseUser, requestSupabaseRest } from "@/lib/cloud/supabaseRest";
import { getRoutableModules } from "@/lib/modules/registry";

export const dynamic = "force-dynamic";

interface WorkspaceBootstrapContext {
  params: Promise<{
    workspaceId: string;
  }>;
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
  role: "owner" | "researcher" | "viewer";
}

export async function GET(
  request: Request,
  context: WorkspaceBootstrapContext
) {
  const disabled = cloudNotConfiguredResponse("workspace-bootstrap");
  if (disabled) return disabled;

  const accessToken = getBearerToken(request);
  if (!accessToken) return authRequiredResponse();

  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) {
    return NextResponse.json(
      {
        format: "zhinote-cloud-error",
        error: "invalid-workspace-id",
        message: "workspaceId 必须是 UUID。",
      },
      { status: 400 }
    );
  }

  try {
    const user = await getSupabaseUser(accessToken);
    const workspaceRows = await requestSupabaseRest<CloudWorkspaceRow[]>(
      `/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=id,name,beta_status,settings,created_at,updated_at`,
      { method: "GET" },
      accessToken
    );
    const membershipRows = await requestSupabaseRest<CloudMembershipRow[]>(
      `/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&select=role`,
      { method: "GET" },
      accessToken
    );

    const workspace = workspaceRows[0] ?? null;
    const membership = membershipRows[0] ?? null;
    if (!workspace || !membership) {
      return NextResponse.json(
        {
          format: "zhinote-cloud-error",
          error: "workspace-not-found-or-forbidden",
          message: "没有找到该 workspace，或当前用户没有访问权限。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      format: "zhinote-cloud-workspace-bootstrap",
      workspace,
      membership: {
        user_id: user.id,
        role: membership.role,
      },
      sync: {
        cursor: null,
        push_enabled: false,
        pull_enabled: false,
        note:
          "第一阶段只返回 workspace 元数据；页面正文、文件和数据库 rows 仍需通过后续 sync API 显式开启。",
      },
      modules: getRoutableModules().map((module) => ({
        id: module.id,
        title: module.title,
        route: module.route,
        status: module.status,
      })),
    });
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
