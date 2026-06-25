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
import {
  HOT_CACHE_SETTINGS_CLOUD_PAYLOAD_MAX_BYTES,
  buildHotCacheSettingsCloudReceipt,
  buildHotCacheSettingsCloudValue,
  validateHotCacheSettingsCloudPayload,
} from "@/lib/sync/hotCacheSettingsCloud";

export const dynamic = "force-dynamic";

interface WorkspaceSettingsContext {
  params: Promise<{
    workspaceId: string;
  }>;
}

interface CloudWorkspaceRow {
  id: string;
  settings: Record<string, unknown> | null;
}

interface CloudMembershipRow {
  role: "owner" | "researcher" | "viewer";
}

export async function PATCH(
  request: Request,
  context: WorkspaceSettingsContext
) {
  const disabled = cloudNotConfiguredResponse("workspace-settings-update");
  if (disabled) return disabled;

  const writesDisabled = requireCloudWritesResponse("workspace-settings-update");
  if (writesDisabled) return writesDisabled;

  const accessToken = getBearerToken(request);
  if (!accessToken) return authRequiredResponse();

  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) {
    return badRequestResponse("workspaceId 必须是 UUID。");
  }

  const body = await readBoundedJsonBody(request);
  if (!body.ok) return badRequestResponse(body.message);

  const validation = validateHotCacheSettingsCloudPayload(body.value);
  if (!validation.ok) return badRequestResponse(validation.message);

  try {
    const user = await getSupabaseUser(accessToken);
    const [workspaceRows, membershipRows] = await Promise.all([
      requestSupabaseRest<CloudWorkspaceRow[]>(
        `/workspaces?id=eq.${encodeURIComponent(
          workspaceId
        )}&select=id,settings`,
        { method: "GET" },
        accessToken
      ),
      requestSupabaseRest<CloudMembershipRow[]>(
        `/workspace_members?workspace_id=eq.${encodeURIComponent(
          workspaceId
        )}&user_id=eq.${encodeURIComponent(user.id)}&select=role`,
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
          error: "workspace-not-found-or-forbidden",
          message: "没有找到该 workspace，或当前用户没有访问权限。",
        },
        { status: 404 }
      );
    }

    if (membership.role === "viewer") {
      return NextResponse.json(
        {
          format: "zhinote-cloud-error",
          error: "workspace-settings-readonly-role",
          message: "viewer 只能读取 workspace，不能修改热缓存偏好。",
        },
        { status: 403 }
      );
    }

    const savedAt = new Date().toISOString();
    const nextSettings = {
      ...(isPlainObject(workspace.settings) ? workspace.settings : {}),
      hot_cache_preferences: buildHotCacheSettingsCloudValue(
        validation.payload,
        savedAt
      ),
    };

    await requestSupabaseRest<null>(
      `/workspaces?id=eq.${encodeURIComponent(workspaceId)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          settings: nextSettings,
          updated_at: savedAt,
        }),
      },
      accessToken
    );

    return NextResponse.json(
      buildHotCacheSettingsCloudReceipt({
        workspaceId,
        role: membership.role,
        savedAt,
        payload: validation.payload,
      })
    );
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}

async function readBoundedJsonBody(request: Request): Promise<
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      message: string;
    }
> {
  const text = await request.text();
  if (!text.trim()) {
    return {
      ok: false,
      message: "请求体不能为空。",
    };
  }

  if (new TextEncoder().encode(text).length > HOT_CACHE_SETTINGS_CLOUD_PAYLOAD_MAX_BYTES) {
    return {
      ok: false,
      message: "请求体过大。热缓存偏好同步只接受小型设置元数据。",
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(text) as unknown,
    };
  } catch {
    return {
      ok: false,
      message: "请求体需要是 JSON。",
    };
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
