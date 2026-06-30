export const SETTINGS_SYNC_STATUS_EVENT = "zhinote:settings-sync-status";
export const SETTINGS_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD = 3;

export type SettingsSyncTableName =
  | "workspace_settings"
  | "account_settings"
  | "module_settings";

export interface SettingsSyncEntryLike {
  tableName: string;
  rowId: string;
  status: string;
  attemptCount: number;
  timestamp: string;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
}

export interface SettingsCloudSyncStatus {
  enabled: boolean;
  totalPending: number;
  waiting: number;
  inFlight: number;
  failed: number;
  manualReviewCount: number;
  manualReviewFailureThreshold: number;
  workspaceSettingsPending: number;
  accountSettingsPending: number;
  moduleSettingsPending: number;
  oldestPendingAt: string | null;
  lastChangeAt: string | null;
  lastAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  sampleRowIds: string[];
  manualReviewSampleRowIds: string[];
  boundary: {
    reads_sync_log_metadata: true;
    reads_workspace_settings_values: false;
    reads_account_settings_values: false;
    reads_module_settings_values: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    mutates_sync_log: false;
  };
}

const SETTINGS_SYNC_STATUS_BOUNDARY: SettingsCloudSyncStatus["boundary"] = {
  reads_sync_log_metadata: true,
  reads_workspace_settings_values: false,
  reads_account_settings_values: false,
  reads_module_settings_values: false,
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_bytes: false,
  uploads_workspace_data: false,
  mutates_sync_log: false,
};

export function isSettingsSyncTableName(
  value: string
): value is SettingsSyncTableName {
  return (
    value === "workspace_settings" ||
    value === "account_settings" ||
    value === "module_settings"
  );
}

export function buildEmptySettingsCloudSyncStatus(
  enabled = true
): SettingsCloudSyncStatus {
  return {
    enabled,
    totalPending: 0,
    waiting: 0,
    inFlight: 0,
    failed: 0,
    manualReviewCount: 0,
    manualReviewFailureThreshold:
      SETTINGS_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD,
    workspaceSettingsPending: 0,
    accountSettingsPending: 0,
    moduleSettingsPending: 0,
    oldestPendingAt: null,
    lastChangeAt: null,
    lastAttemptAt: null,
    lastFailureAt: null,
    lastFailureMessage: null,
    sampleRowIds: [],
    manualReviewSampleRowIds: [],
    boundary: SETTINGS_SYNC_STATUS_BOUNDARY,
  };
}

export function summarizeSettingsCloudSyncStatus(
  entries: SettingsSyncEntryLike[],
  enabled = true
): SettingsCloudSyncStatus {
  const settingsEntries = entries.filter((entry) =>
    isSettingsSyncTableName(entry.tableName)
  );
  if (settingsEntries.length === 0) {
    return buildEmptySettingsCloudSyncStatus(enabled);
  }

  let waiting = 0;
  let inFlight = 0;
  let failed = 0;
  let manualReviewCount = 0;
  let workspaceSettingsPending = 0;
  let accountSettingsPending = 0;
  let moduleSettingsPending = 0;
  let oldestPendingAt: string | null = null;
  let lastChangeAt: string | null = null;
  let lastAttemptAt: string | null = null;
  let lastFailureAt: string | null = null;
  let lastFailureMessage: string | null = null;
  const sampleRowIds: string[] = [];
  const manualReviewSampleRowIds: string[] = [];

  for (const entry of settingsEntries) {
    if (entry.tableName === "workspace_settings") workspaceSettingsPending += 1;
    if (entry.tableName === "account_settings") accountSettingsPending += 1;
    if (entry.tableName === "module_settings") moduleSettingsPending += 1;

    if (entry.status === "failed") {
      failed += 1;
      if (
        entry.attemptCount >= SETTINGS_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD
      ) {
        manualReviewCount += 1;
        if (manualReviewSampleRowIds.length < 4) {
          manualReviewSampleRowIds.push(entry.rowId);
        }
      }
      if (!lastFailureAt || entry.timestamp > lastFailureAt) {
        lastFailureAt = entry.timestamp;
        lastFailureMessage = entry.lastError;
      }
    } else if (entry.status === "in_flight") {
      inFlight += 1;
    } else {
      waiting += 1;
    }

    if (sampleRowIds.length < 6) sampleRowIds.push(entry.rowId);
    if (!oldestPendingAt || entry.timestamp < oldestPendingAt) {
      oldestPendingAt = entry.timestamp;
    }
    if (!lastChangeAt || entry.timestamp > lastChangeAt) {
      lastChangeAt = entry.timestamp;
    }
    if (entry.lastAttemptAt && (!lastAttemptAt || entry.lastAttemptAt > lastAttemptAt)) {
      lastAttemptAt = entry.lastAttemptAt;
    }
  }

  return {
    enabled,
    totalPending: settingsEntries.length,
    waiting,
    inFlight,
    failed,
    manualReviewCount,
    manualReviewFailureThreshold:
      SETTINGS_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD,
    workspaceSettingsPending,
    accountSettingsPending,
    moduleSettingsPending,
    oldestPendingAt,
    lastChangeAt,
    lastAttemptAt,
    lastFailureAt,
    lastFailureMessage,
    sampleRowIds,
    manualReviewSampleRowIds,
    boundary: SETTINGS_SYNC_STATUS_BOUNDARY,
  };
}

export function emitSettingsSyncStatusEvent(
  detail?: SettingsCloudSyncStatus
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SettingsCloudSyncStatus | undefined>(
      SETTINGS_SYNC_STATUS_EVENT,
      { detail }
    )
  );
}
