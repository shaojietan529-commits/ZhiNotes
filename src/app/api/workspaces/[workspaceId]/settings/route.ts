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
import {
  PAGE_VIEW_PREFERENCES_CLOUD_FIELD,
  PAGE_VIEW_PREFERENCES_SETTING_KEY,
  buildPageViewPreferencesWorkspaceSettingsCloudReceipt,
  buildPageViewPreferencesWorkspaceSettingsCloudValue,
  isPageViewPreferencesWorkspaceSettingKey,
  parsePageViewPreferencesWorkspaceSettingsCloudValue,
  validatePageViewPreferencesWorkspaceSettingsCloudPayload,
} from "@/lib/sync/pageViewPreferencesWorkspaceSettings";
import {
  QUICK_SEARCH_SAVED_SEARCHES_CLOUD_FIELD,
  QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
  buildQuickSearchSavedSearchesWorkspaceSettingsCloudReceipt,
  buildQuickSearchSavedSearchesWorkspaceSettingsCloudValue,
  isQuickSearchSavedSearchesWorkspaceSettingKey,
  parseQuickSearchSavedSearchesWorkspaceSettingsCloudValue,
  validateQuickSearchSavedSearchesWorkspaceSettingsCloudPayload,
} from "@/lib/sync/quickSearchWorkspaceSettings";
import {
  CALENDAR_VIEW_STATE_CLOUD_FIELD,
  CALENDAR_VIEW_STATE_SETTING_KEY,
  buildCalendarViewStateWorkspaceSettingsCloudReceipt,
  buildCalendarViewStateWorkspaceSettingsCloudValue,
  isCalendarViewStateWorkspaceSettingKey,
  parseCalendarViewStateWorkspaceSettingsCloudValue,
  validateCalendarViewStateWorkspaceSettingsCloudPayload,
} from "@/lib/sync/calendarViewStateWorkspaceSettings";
import {
  MEETING_REVIEW_STATE_CLOUD_FIELD,
  MEETING_REVIEW_STATE_SETTING_KEY,
  buildMeetingReviewStateWorkspaceSettingsCloudReceipt,
  buildMeetingReviewStateWorkspaceSettingsCloudValue,
  isMeetingReviewStateWorkspaceSettingKey,
  parseMeetingReviewStateWorkspaceSettingsCloudValue,
  validateMeetingReviewStateWorkspaceSettingsCloudPayload,
} from "@/lib/sync/meetingReviewStateWorkspaceSettings";
import {
  MEETING_DELETION_TOMBSTONES_CLOUD_FIELD,
  MEETING_DELETION_TOMBSTONES_SETTING_KEY,
  buildMeetingDeletionTombstonesWorkspaceSettingsCloudReceipt,
  buildMeetingDeletionTombstonesWorkspaceSettingsCloudValue,
  isMeetingDeletionTombstonesWorkspaceSettingKey,
  parseMeetingDeletionTombstonesWorkspaceSettingsCloudValue,
  validateMeetingDeletionTombstonesWorkspaceSettingsCloudPayload,
} from "@/lib/sync/meetingDeletionTombstonesWorkspaceSettings";
import {
  ACCOUNT_DISPLAY_NAME_SETTING_KEY,
  ACCOUNT_SETTINGS_CLOUD_FIELD,
  ACCOUNT_UI_PREFERENCES_SETTING_KEY,
  MODULE_DASHBOARD_LAYOUT_SETTING_KEY,
  MODULE_PINNED_ITEMS_SETTING_KEY,
  MODULE_SETTINGS_CLOUD_FIELD,
  buildAccountModuleSettingCloudValue,
  buildAccountModuleSettingsCloudReceipt,
  isSupportedAccountSettingSyncKey,
  isSupportedModuleSettingSyncKey,
  parseAccountModuleSettingsCloudValues,
  validateAccountModuleSettingCloudPayload,
} from "@/lib/sync/accountModuleSettingsPendingSync";

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
    const pageViewPreferences =
      parsePageViewPreferencesWorkspaceSettingsCloudValue(
        isPlainObject(workspace.settings) ? workspace.settings : null
      );
    const quickSearchSavedSearches =
      parseQuickSearchSavedSearchesWorkspaceSettingsCloudValue(
        isPlainObject(workspace.settings) ? workspace.settings : null
      );
    const calendarViewState =
      parseCalendarViewStateWorkspaceSettingsCloudValue(
        isPlainObject(workspace.settings) ? workspace.settings : null
      );
    const meetingReviewState =
      parseMeetingReviewStateWorkspaceSettingsCloudValue(
        isPlainObject(workspace.settings) ? workspace.settings : null
      );
    const meetingDeletionTombstones =
      parseMeetingDeletionTombstonesWorkspaceSettingsCloudValue(
        isPlainObject(workspace.settings) ? workspace.settings : null
      );
    const accountModuleSettings = parseAccountModuleSettingsCloudValues(
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
          PAGE_VIEW_PREFERENCES_SETTING_KEY,
          QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
          CALENDAR_VIEW_STATE_SETTING_KEY,
          MEETING_REVIEW_STATE_SETTING_KEY,
          MEETING_DELETION_TOMBSTONES_SETTING_KEY,
          ACCOUNT_DISPLAY_NAME_SETTING_KEY,
          ACCOUNT_UI_PREFERENCES_SETTING_KEY,
          MODULE_PINNED_ITEMS_SETTING_KEY,
          MODULE_DASHBOARD_LAYOUT_SETTING_KEY,
        ],
        sidebar_settings: sidebarSettings,
        page_favorites: pageFavorites,
        page_view_preferences: pageViewPreferences,
        quick_search_saved_searches: quickSearchSavedSearches,
        calendar_view_state: calendarViewState,
        meeting_review_state: meetingReviewState,
        meeting_deletion_tombstones: meetingDeletionTombstones,
        account_module_settings: accountModuleSettings,
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
          : isPageViewPreferencesWorkspaceSettingKey(settingKey)
            ? validatePageViewPreferencesWorkspaceSettingsCloudPayload(body.value)
            : isQuickSearchSavedSearchesWorkspaceSettingKey(settingKey)
              ? validateQuickSearchSavedSearchesWorkspaceSettingsCloudPayload(
                  body.value
                )
              : isCalendarViewStateWorkspaceSettingKey(settingKey)
                ? validateCalendarViewStateWorkspaceSettingsCloudPayload(
                    body.value
                  )
                : isMeetingReviewStateWorkspaceSettingKey(settingKey)
                  ? validateMeetingReviewStateWorkspaceSettingsCloudPayload(
                      body.value
                    )
                  : isMeetingDeletionTombstonesWorkspaceSettingKey(settingKey)
                    ? validateMeetingDeletionTombstonesWorkspaceSettingsCloudPayload(
                        body.value
                      )
                    : typeof settingKey === "string" &&
                        (isSupportedAccountSettingSyncKey(settingKey) ||
                          isSupportedModuleSettingSyncKey(settingKey))
                      ? validateAccountModuleSettingCloudPayload(body.value)
                    : {
                        ok: false as const,
                        message:
                          "setting_key 必须是 hot_cache_preferences.v1、sidebar.primaryOrder.v1、sidebar.primaryCustomization.v1、page.favorites.v1、page.viewPreferences.v1、quick_search.savedSearches.v1、calendar.viewState.v1、meeting.reviewState.v1、meeting.deletionTombstones.v1、account_profile.display_name.v1、account_preferences.ui.v1、module_settings.pinned_items.v1 或 module_settings.dashboard_layout.v1。",
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

    if ("table_name" in validatedPayload.payload) {
      if (validatedPayload.payload.table_name === "account_settings") {
        const existingAccountSettingsValue =
          nextSettings[ACCOUNT_SETTINGS_CLOUD_FIELD];
        const existingAccountSettings: Record<string, unknown> = isPlainObject(
          existingAccountSettingsValue
        )
          ? existingAccountSettingsValue
          : {};
        nextSettings[ACCOUNT_SETTINGS_CLOUD_FIELD] = {
          ...existingAccountSettings,
          [validatedPayload.payload.setting_key]:
            buildAccountModuleSettingCloudValue(
              validatedPayload.payload,
              savedAt
            ),
        };
      } else {
        const existingModuleSettingsValue =
          nextSettings[MODULE_SETTINGS_CLOUD_FIELD];
        const existingModuleSettings: Record<string, unknown> = isPlainObject(
          existingModuleSettingsValue
        )
          ? existingModuleSettingsValue
          : {};
        const existingModuleBucketValue =
          existingModuleSettings[validatedPayload.payload.module_id];
        const existingModuleBucket: Record<string, unknown> = isPlainObject(
          existingModuleBucketValue
        )
          ? existingModuleBucketValue
          : {};
        nextSettings[MODULE_SETTINGS_CLOUD_FIELD] = {
          ...existingModuleSettings,
          [validatedPayload.payload.module_id]: {
            ...existingModuleBucket,
            [validatedPayload.payload.setting_key]:
              buildAccountModuleSettingCloudValue(
                validatedPayload.payload,
                savedAt
              ),
          },
        };
      }
    } else if (
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
    } else if (
      validatedPayload.payload.setting_key === PAGE_FAVORITES_SETTING_KEY
    ) {
      nextSettings[PAGE_FAVORITES_CLOUD_FIELD] =
        buildPageFavoritesWorkspaceSettingsCloudValue(
          validatedPayload.payload,
          savedAt
        );
    } else if (
      validatedPayload.payload.setting_key === PAGE_VIEW_PREFERENCES_SETTING_KEY
    ) {
      nextSettings[PAGE_VIEW_PREFERENCES_CLOUD_FIELD] =
        buildPageViewPreferencesWorkspaceSettingsCloudValue(
          validatedPayload.payload,
          savedAt
        );
    } else if (
      validatedPayload.payload.setting_key ===
      QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY
    ) {
      nextSettings[QUICK_SEARCH_SAVED_SEARCHES_CLOUD_FIELD] =
        buildQuickSearchSavedSearchesWorkspaceSettingsCloudValue(
          validatedPayload.payload,
          savedAt
        );
    } else if (
      validatedPayload.payload.setting_key === CALENDAR_VIEW_STATE_SETTING_KEY
    ) {
      nextSettings[CALENDAR_VIEW_STATE_CLOUD_FIELD] =
        buildCalendarViewStateWorkspaceSettingsCloudValue(
          validatedPayload.payload,
          savedAt
        );
    } else if (
      validatedPayload.payload.setting_key === MEETING_REVIEW_STATE_SETTING_KEY
    ) {
      nextSettings[MEETING_REVIEW_STATE_CLOUD_FIELD] =
        buildMeetingReviewStateWorkspaceSettingsCloudValue(
          validatedPayload.payload,
          savedAt
        );
    } else {
      nextSettings[MEETING_DELETION_TOMBSTONES_CLOUD_FIELD] =
        buildMeetingDeletionTombstonesWorkspaceSettingsCloudValue(
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

    if ("table_name" in validatedPayload.payload) {
      return NextResponse.json(
        buildAccountModuleSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

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

    if (validatedPayload.payload.setting_key === PAGE_FAVORITES_SETTING_KEY) {
      return NextResponse.json(
        buildPageFavoritesWorkspaceSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

    if (
      validatedPayload.payload.setting_key === PAGE_VIEW_PREFERENCES_SETTING_KEY
    ) {
      return NextResponse.json(
        buildPageViewPreferencesWorkspaceSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

    if (
      validatedPayload.payload.setting_key ===
      QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY
    ) {
      return NextResponse.json(
        buildQuickSearchSavedSearchesWorkspaceSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

    if (validatedPayload.payload.setting_key === CALENDAR_VIEW_STATE_SETTING_KEY) {
      return NextResponse.json(
        buildCalendarViewStateWorkspaceSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

    if (
      validatedPayload.payload.setting_key === MEETING_REVIEW_STATE_SETTING_KEY
    ) {
      return NextResponse.json(
        buildMeetingReviewStateWorkspaceSettingsCloudReceipt({
          workspaceId,
          role: membership.role,
          savedAt,
          payload: validatedPayload.payload,
        })
      );
    }

    return NextResponse.json(
      buildMeetingDeletionTombstonesWorkspaceSettingsCloudReceipt({
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
