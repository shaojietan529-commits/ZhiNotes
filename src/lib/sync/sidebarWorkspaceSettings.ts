export const SIDEBAR_PRIMARY_ORDER_SETTING_KEY = "sidebar.primaryOrder.v1";
export const SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY =
  "sidebar.primaryCustomization.v1";

export const SIDEBAR_PRIMARY_ORDER_CLOUD_FIELD = "sidebar_primary_order";
export const SIDEBAR_PRIMARY_CUSTOMIZATION_CLOUD_FIELD =
  "sidebar_primary_customization";

export type SidebarWorkspaceSettingKey =
  | typeof SIDEBAR_PRIMARY_ORDER_SETTING_KEY
  | typeof SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY;

export interface SidebarPrimaryCustomizationValue {
  icon?: string;
  label?: string;
}

export type SidebarWorkspaceSettingsCloudPayload =
  | {
      setting_key: typeof SIDEBAR_PRIMARY_ORDER_SETTING_KEY;
      client_pending_row_id: typeof SIDEBAR_PRIMARY_ORDER_SETTING_KEY;
      order: string[];
    }
  | {
      setting_key: typeof SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY;
      client_pending_row_id: typeof SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY;
      customizations: Record<string, SidebarPrimaryCustomizationValue>;
    };

export interface ParsedSidebarWorkspaceSettingsCloudValues {
  order: {
    setting_found: boolean;
    cloud_value_valid: boolean;
    saved_at: string | null;
    order: string[];
  };
  customizations: {
    setting_found: boolean;
    cloud_value_valid: boolean;
    saved_at: string | null;
    customizations: Record<string, SidebarPrimaryCustomizationValue>;
  };
}

export interface SidebarWorkspaceSettingsCloudReceipt {
  format: "zhinote-sidebar-settings-cloud-receipt";
  format_version: 1;
  setting_key: SidebarWorkspaceSettingKey;
  cloud_target:
    | "workspaces.settings.sidebar_primary_order"
    | "workspaces.settings.sidebar_primary_customization";
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    acknowledges_pending_row: SidebarWorkspaceSettingKey;
    saved_item_count: number;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: SidebarWorkspaceSettingKey;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type SidebarWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: SidebarWorkspaceSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

export function isSidebarWorkspaceSettingKey(
  value: unknown
): value is SidebarWorkspaceSettingKey {
  return (
    value === SIDEBAR_PRIMARY_ORDER_SETTING_KEY ||
    value === SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY
  );
}

export function sidebarWorkspaceSettingCloudField(
  settingKey: SidebarWorkspaceSettingKey
) {
  return settingKey === SIDEBAR_PRIMARY_ORDER_SETTING_KEY
    ? SIDEBAR_PRIMARY_ORDER_CLOUD_FIELD
    : SIDEBAR_PRIMARY_CUSTOMIZATION_CLOUD_FIELD;
}

export function sidebarWorkspaceSettingCloudTarget(
  settingKey: SidebarWorkspaceSettingKey
) {
  return settingKey === SIDEBAR_PRIMARY_ORDER_SETTING_KEY
    ? "workspaces.settings.sidebar_primary_order"
    : "workspaces.settings.sidebar_primary_customization";
}

export function validateSidebarWorkspaceSettingsCloudPayload(
  body: unknown
): SidebarWorkspaceSettingsValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      message: "请求体必须是 JSON object。",
    };
  }

  const record = body as Record<string, unknown>;
  if (!isSidebarWorkspaceSettingKey(record.setting_key)) {
    return {
      ok: false,
      message:
        "setting_key 必须是 sidebar.primaryOrder.v1 或 sidebar.primaryCustomization.v1。",
    };
  }

  if (record.setting_key === SIDEBAR_PRIMARY_ORDER_SETTING_KEY) {
    if (!Array.isArray(record.order)) {
      return {
        ok: false,
        message: "sidebar.primaryOrder.v1 需要提供 order 数组。",
      };
    }
    return {
      ok: true,
      payload: {
        setting_key: SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
        client_pending_row_id: SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
        order: normalizeSidebarPrimaryOrder(record.order),
      },
    };
  }

  if (
    !record.customizations ||
    typeof record.customizations !== "object" ||
    Array.isArray(record.customizations)
  ) {
    return {
      ok: false,
      message: "sidebar.primaryCustomization.v1 需要提供 customizations 对象。",
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
      client_pending_row_id: SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
      customizations: normalizeSidebarPrimaryCustomizations(
        record.customizations
      ),
    },
  };
}

export function buildSidebarWorkspaceSettingsCloudValue(
  payload: SidebarWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-sidebar-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-sidebar-settings-ui",
    value:
      payload.setting_key === SIDEBAR_PRIMARY_ORDER_SETTING_KEY
        ? { order: payload.order }
        : { customizations: payload.customizations },
    privacy_boundary:
      "Settings metadata only. No page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parseSidebarWorkspaceSettingsCloudValues(
  settings: Record<string, unknown> | null
): ParsedSidebarWorkspaceSettingsCloudValues {
  const order = parseSidebarCloudValue(
    settings?.[SIDEBAR_PRIMARY_ORDER_CLOUD_FIELD],
    SIDEBAR_PRIMARY_ORDER_SETTING_KEY
  );
  const customizations = parseSidebarCloudValue(
    settings?.[SIDEBAR_PRIMARY_CUSTOMIZATION_CLOUD_FIELD],
    SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY
  );

  return {
    order: {
      setting_found: order.setting_found,
      cloud_value_valid: order.cloud_value_valid,
      saved_at: order.saved_at,
      order: normalizeSidebarPrimaryOrder(order.value?.order),
    },
    customizations: {
      setting_found: customizations.setting_found,
      cloud_value_valid: customizations.cloud_value_valid,
      saved_at: customizations.saved_at,
      customizations: normalizeSidebarPrimaryCustomizations(
        customizations.value?.customizations
      ),
    },
  };
}

export function buildSidebarWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: SidebarWorkspaceSettingsCloudPayload;
}): SidebarWorkspaceSettingsCloudReceipt {
  const savedItemCount =
    input.payload.setting_key === SIDEBAR_PRIMARY_ORDER_SETTING_KEY
      ? input.payload.order.length
      : Object.keys(input.payload.customizations).length;

  return {
    format: "zhinote-sidebar-settings-cloud-receipt",
    format_version: 1,
    setting_key: input.payload.setting_key,
    cloud_target: sidebarWorkspaceSettingCloudTarget(input.payload.setting_key),
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      acknowledges_pending_row: input.payload.client_pending_row_id,
      saved_item_count: savedItemCount,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only sidebar settings metadata was saved to workspaces.settings. It does not upload notes, files, database rows, comments, versions, or local cache dumps.",
  };
}

function normalizeSidebarPrimaryOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    if (order.length >= 48) break;
  }
  return order;
}

function normalizeSidebarPrimaryCustomizations(
  value: unknown
): Record<string, SidebarPrimaryCustomizationValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, SidebarPrimaryCustomizationValue> = {};
  for (const [rawId, rawCustomization] of Object.entries(value)) {
    if (
      !rawCustomization ||
      typeof rawCustomization !== "object" ||
      Array.isArray(rawCustomization)
    ) {
      continue;
    }
    const id = rawId.trim().slice(0, 80);
    if (!id) continue;

    const record = rawCustomization as Record<string, unknown>;
    const icon =
      typeof record.icon === "string" ? record.icon.trim().slice(0, 8) : "";
    const label =
      typeof record.label === "string"
        ? record.label.trim().replace(/\s+/g, " ").slice(0, 24)
        : "";
    output[id] = {
      ...(icon ? { icon } : {}),
      ...(label ? { label } : {}),
    };
    if (Object.keys(output).length >= 48) break;
  }
  return output;
}

function parseSidebarCloudValue(
  value: unknown,
  expectedSettingKey: SidebarWorkspaceSettingKey
): {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
  value: Record<string, unknown> | null;
} {
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      value: null,
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      value: null,
    };
  }

  const nestedValue = isPlainRecord(value.value) ? value.value : null;
  return {
    setting_found: true,
    cloud_value_valid:
      value.format === "zhinote-sidebar-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === expectedSettingKey &&
      Boolean(nestedValue),
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    value: nestedValue,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
