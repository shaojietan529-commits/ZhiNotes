export interface WorkspaceRestorePreview {
  valid: boolean;
  format: string | null;
  formatVersion: number | null;
  exportedAt: string | null;
  privacyNote: string | null;
  counts: {
    activePages: number;
    deletedPages: number;
    pageVersions: number;
    pageComments: number;
    blockComments: number;
    databases: number;
    databaseFields: number;
    databaseRows: number;
    databaseViews: number;
    uploadedFiles: number;
    favoritePages: number;
    lockedPages: number;
  };
  issues: string[];
  warnings: string[];
}

const SUPPORTED_BACKUP_FORMAT = "zhinote-workspace-backup";
const SUPPORTED_FORMAT_VERSION = 1;

export function analyzeWorkspaceBackupJson(input: string): WorkspaceRestorePreview {
  const fallbackCounts = emptyRestoreCounts();
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    return {
      valid: false,
      format: null,
      formatVersion: null,
      exportedAt: null,
      privacyNote: null,
      counts: fallbackCounts,
      issues: ["This file is not valid JSON."],
      warnings: [],
    };
  }

  if (!isRecord(parsed)) {
    return {
      valid: false,
      format: null,
      formatVersion: null,
      exportedAt: null,
      privacyNote: null,
      counts: fallbackCounts,
      issues: ["The backup root must be a JSON object."],
      warnings: [],
    };
  }

  const format = getString(parsed.format);
  const formatVersion = getNumber(parsed.format_version);
  const issues: string[] = [];
  const warnings: string[] = [
    "This is a dry-run preview only. It does not restore, overwrite, upload, or delete workspace data.",
  ];

  if (format !== SUPPORTED_BACKUP_FORMAT) {
    issues.push("Backup format is not zhinote-workspace-backup.");
  }
  if (formatVersion !== SUPPORTED_FORMAT_VERSION) {
    issues.push("Backup format version is not supported.");
  }

  const pages = getArray(parsed.pages);
  const deletedPages = getArray(parsed.deleted_pages);
  const databases = getArray(parsed.databases);
  const uploadedFiles = getArray(parsed.uploaded_files);
  const localPreferences = isRecord(parsed.local_preferences)
    ? parsed.local_preferences
    : {};

  if (!Array.isArray(parsed.pages)) {
    issues.push("Missing pages array.");
  }
  if (!Array.isArray(parsed.deleted_pages)) {
    warnings.push("Missing deleted_pages array; trash restore scope may be incomplete.");
  }
  if (!Array.isArray(parsed.databases)) {
    warnings.push("Missing databases array; database restore scope may be incomplete.");
  }
  if (!Array.isArray(parsed.uploaded_files)) {
    warnings.push("Missing uploaded_files array; file restore scope may be incomplete.");
  }

  const counts = {
    activePages: pages.length,
    deletedPages: deletedPages.length,
    pageVersions: countRecordArrays(parsed.page_versions),
    pageComments: countRecordArrays(parsed.page_comments),
    blockComments: countRecordArrays(parsed.block_comments),
    databases: databases.length,
    databaseFields: databases.reduce<number>(
      (sum, entry) => sum + getArrayFromRecord(entry, "fields").length,
      0
    ),
    databaseRows: databases.reduce<number>(
      (sum, entry) => sum + getArrayFromRecord(entry, "rows").length,
      0
    ),
    databaseViews: databases.reduce<number>(
      (sum, entry) => sum + getArrayFromRecord(entry, "views").length,
      0
    ),
    uploadedFiles: uploadedFiles.length,
    favoritePages: getArray(localPreferences.favorite_page_ids).length,
    lockedPages: getArray(localPreferences.locked_page_ids).length,
  };

  if (counts.activePages + counts.deletedPages === 0) {
    warnings.push("This backup does not contain any pages.");
  }
  if (counts.uploadedFiles > 0) {
    warnings.push("Uploaded file records may contain private file data.");
  }
  if (counts.databases > 0 && counts.databaseRows === 0) {
    warnings.push("The backup contains database definitions but no database rows.");
  }

  return {
    valid: issues.length === 0,
    format,
    formatVersion,
    exportedAt: getString(parsed.exported_at),
    privacyNote: getString(parsed.privacy_note),
    counts,
    issues,
    warnings,
  };
}

function emptyRestoreCounts(): WorkspaceRestorePreview["counts"] {
  return {
    activePages: 0,
    deletedPages: 0,
    pageVersions: 0,
    pageComments: 0,
    blockComments: 0,
    databases: 0,
    databaseFields: 0,
    databaseRows: 0,
    databaseViews: 0,
    uploadedFiles: 0,
    favoritePages: 0,
    lockedPages: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getArrayFromRecord(value: unknown, key: string) {
  if (!isRecord(value)) return [];
  return getArray(value[key]);
}

function countRecordArrays(value: unknown) {
  if (!isRecord(value)) return 0;
  return Object.values(value).reduce<number>(
    (sum, item) => sum + getArray(item).length,
    0
  );
}
