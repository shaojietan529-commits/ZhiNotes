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
import { HOT_CACHE_PREFERENCES_SETTING_KEY } from "@/lib/sync/hotCacheSelectionSettings";
import {
  HOT_CACHE_SETTINGS_CLOUD_PAYLOAD_MAX_BYTES,
  buildHotCacheSettingsCloudReceipt,
  buildHotCacheSettingsCloudReadReceipt,
  buildHotCacheSettingsCloudValue,
  parseHotCacheSettingsCloudValue,
  validateHotCacheSettingsCloudPayload,
} from "@/lib/sync/hotCacheSettingsCloud";
import {
  SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
  SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
  buildSidebarWorkspaceSettingsCloudReceipt,
  buildSidebarWorkspaceSettingsCloudValue,
  isSidebarWorkspaceSettingKey,
  parseSidebarWorkspaceSettingsCloudValues,
  sidebarWorkspaceSettingCloudField,
  validateSidebarWorkspaceSettingsCloudPayload,
} from "@/lib/sync/sidebarWorkspaceSettings";
import {
  PAGE_FAVORITES_CLOUD_FIELD,
  PAGE_FAVORITES_SETTING_KEY,
  buildPageFavoritesWorkspaceSettingsCloudReceipt,
  buildPageFavoritesWorkspaceSettingsCloudValue,
  isPageFavoritesWorkspaceSettingKey,
  parsePageFavoritesWorkspaceSettingsCloudValue,
  validatePageFavoritesWorkspaceSettingsCloudPayload,
} from "@/lib/sync/pageFavoritesWorkspaceSettings";

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

export async function GET(
  request: Request,
  context: WorkspaceSettingsContext
) {
  const disabled = cloudNotConfiguredResponse("workspace-settings-read");
  if (disabled) return disabled;

  const accessToken = getBearerToken(request);
  if (!accessToken) return authRequiredResponse();

  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) {
    return badRequestResponse("workspaceId 必须是 UUID。");
  }

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

    const parsed = parseHotCacheSettingsCloudValue(
      isPlainObject(workspace.settings) ? workspace.settings : null
    );
    const sidebarSettings = parseSidebarWorkspaceSettingsCloudValues(
      isPlainObject(workspace.settings) ? workspace.settings : null
    );
    const pageFavorites = parsePageFavoritesWorkspaceSettingsCloudValue(
      isPlainObject(workspace.settings) ? workspace.settings : null
    );

    return NextResponse.json(
      {
        ...buildHotCacheSettingsCloudReadReceipt({
          workspaceId,
          role: membership.role,
          readAt: new Date().toISOString(),
          parsed,
        }),
        supported_setting_keys: [
          HOT_CACHE_PREFERENCES_SETTING_KEY,
          SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
          SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
          PAGE_FAVORITES_SETTING_KEY,
        ],
        sidebar_settings: sidebarSettings,
        page_favorites: pageFavorites,
      }
    );
  } catch (error) {
    return supabaseErrorResponse(error);
  }
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

  const record = isPlainObject(body.value) ? body.value : null;
  const settingKey = record?.setting_key;
  const validatedPayload =
    settingKey === HOT_CACHE_PREFERENCES_SETTING_KEY
      ? validateHotCacheSettingsCloudPayload(body.value)
      : isSidebarWorkspaceSettingKey(settingKey)
        ? validateSidebarWorkspaceSettingsCloudPayload(body.value)
        : isPageFavoritesWorkspaceSettingKey(settingKey)
          ? validatePageFavoritesWorkspaceSettingsCloudPayload(body.value)
          : {
              ok: false as const,
              message:
                "setting_key 必须是 hot_cache_preferences.v1、sidebar.primaryOrder.v1、sidebar.primaryCustomization.v1 或 page.favorites.v1。",
            };
  if (!validatedPayload.ok) {
    return badRequestResponse(validatedPayload.message);
  }

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
          message: "viewer 只能读取 workspace，不能修改工作区设置。",
        },
        { status: 403 }
      );
    }

    const savedAt = new Date().toISOString();
    const nextSettings = {
      ...(isPlainObject(workspace.settings) ? workspace.settings : {}),
    };

    if (
      validatedPayload.payload.setting_key === HOT_CACHE_PREFERENCES_SETTING_KEY
    ) {
      nextSettings.hot_cache_preferences = buildHotCacheSettingsCloudValue(
        validatedPayload.payload,
        savedAt
      );
    } else if (
      validatedPayload.payload.setting_key === SIDEBAR_PRIMARY_ORDER_SETTING_KEY ||
      validatedPayload.payload.setting_key ===
        SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY
    ) {
      nextSettings[
        sidebarWorkspaceSettingCloudField(validatedPayload.payload.setting_key)
      ] = buildSidebarWorkspaceSettingsCloudValue(
        validatedPayload.payload,
        savedAt
      );
    } else {
      nextSettings[PAGE_FAVORITES_CLOUD_FIELD] =
        buildPageFavoritesWorkspaceSettingsCloudValue(
          validatedPayload.payload,
          savedAt
        );
    }

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

    if (
      validatedPayload.payload.setting_key === HOT_CACHE_PREFERENCES_SETTING_KEY
    ) {
      return NextResponse.json(
        buildHotCacheSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

    if (
      validatedPayload.payload.setting_key === SIDEBAR_PRIMARY_ORDER_SETTING_KEY ||
      validatedPayload.payload.setting_key ===
        SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY
    ) {
      return NextResponse.json(
        buildSidebarWorkspaceSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

    return NextResponse.json(
      buildPageFavoritesWorkspaceSettingsCloudReceipt({
        workspaceId,
        role: membership.role,
        savedAt,
        payload: validatedPayload.payload,
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

  if (
    new TextEncoder().encode(text).length >
    HOT_CACHE_SETTINGS_CLOUD_PAYLOAD_MAX_BYTES
  ) {
    return {
      ok: false,
      message: "请求体过大。工作区设置同步只接受小型设置元数据。",
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
