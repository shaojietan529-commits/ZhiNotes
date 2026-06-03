import type { SyncLogEntry, SyncLogSummary } from "@/lib/db/local/queries";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type SyncPayloadRisk = "low" | "medium" | "high";

export interface SyncPayloadPreviewInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  syncSummary: SyncLogSummary | null;
  entries: SyncLogEntry[];
}

export interface SyncPayloadTablePreview {
  table_name: string;
  pending_count: number;
  included_count: number;
  operations: Array<{
    operation: string;
    count: number;
  }>;
  changed_fields: string[];
  sensitivity: SyncPayloadRisk;
  privacy_boundary: string;
}

export interface SyncPayloadPreview {
  format: "zhinote-sync-payload-preview";
  format_version: 1;
  preview_status: "local-only";
  requires_confirmation: true;
  privacy_note: string;
  workspace_identity: {
    workspace_id: string | null;
    device_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
  };
  payload_boundary: {
    metadata_only: true;
    contains_page_text: false;
    contains_file_bytes: false;
    creates_account: false;
    connects_cloud: false;
    uploads_data: false;
  };
  summary: {
    pending_count: number;
    included_count: number;
    truncated: boolean;
    high_risk_tables: number;
    medium_risk_tables: number;
    low_risk_tables: number;
  };
  tables: SyncPayloadTablePreview[];
}

export function buildSyncPayloadPreview(
  input: SyncPayloadPreviewInput
): SyncPayloadPreview {
  const tableGroups = new Map<string, SyncLogEntry[]>();

  for (const entry of input.entries) {
    const group = tableGroups.get(entry.tableName) ?? [];
    group.push(entry);
    tableGroups.set(entry.tableName, group);
  }

  const tables = Array.from(tableGroups.entries())
    .map(([tableName, entries]) => buildTablePreview(tableName, entries, input))
    .sort((a, b) => {
      const riskDelta = riskWeight(b.sensitivity) - riskWeight(a.sensitivity);
      return riskDelta || b.included_count - a.included_count || a.table_name.localeCompare(b.table_name);
    });

  const highRiskTables = tables.filter((table) => table.sensitivity === "high");
  const mediumRiskTables = tables.filter(
    (table) => table.sensitivity === "medium"
  );
  const lowRiskTables = tables.filter((table) => table.sensitivity === "low");
  const pendingCount = input.syncSummary?.pending ?? input.entries.length;

  return {
    format: "zhinote-sync-payload-preview",
    format_version: 1,
    preview_status: "local-only",
    requires_confirmation: true,
    privacy_note:
      "Generated locally. This preview summarizes pending sync metadata only. It does not create accounts, connect cloud services, upload notes, sync files, restore backups, or share workspace data.",
    workspace_identity: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
    },
    payload_boundary: {
      metadata_only: true,
      contains_page_text: false,
      contains_file_bytes: false,
      creates_account: false,
      connects_cloud: false,
      uploads_data: false,
    },
    summary: {
      pending_count: pendingCount,
      included_count: input.entries.length,
      truncated: pendingCount > input.entries.length,
      high_risk_tables: highRiskTables.length,
      medium_risk_tables: mediumRiskTables.length,
      low_risk_tables: lowRiskTables.length,
    },
    tables,
  };
}

function buildTablePreview(
  tableName: string,
  entries: SyncLogEntry[],
  input: SyncPayloadPreviewInput
): SyncPayloadTablePreview {
  const summaryTable = input.syncSummary?.tables.find(
    (table) => table.tableName === tableName
  );

  return {
    table_name: tableName,
    pending_count: summaryTable?.pending ?? entries.length,
    included_count: entries.length,
    operations: countOperations(entries),
    changed_fields: collectChangedFields(entries),
    sensitivity: getTableSensitivity(tableName),
    privacy_boundary: getTablePrivacyBoundary(tableName),
  };
}

function countOperations(entries: SyncLogEntry[]) {
  const counts = entries.reduce<Record<string, number>>((result, entry) => {
    result[entry.operation] = (result[entry.operation] ?? 0) + 1;
    return result;
  }, {});

  return Object.entries(counts)
    .map(([operation, count]) => ({ operation, count }))
    .sort((a, b) => b.count - a.count || a.operation.localeCompare(b.operation));
}

function collectChangedFields(entries: SyncLogEntry[]) {
  const fields = new Set<string>();
  for (const entry of entries) {
    for (const column of entry.changedCols) {
      fields.add(column);
    }
  }
  return Array.from(fields).sort();
}

function getTableSensitivity(tableName: string): SyncPayloadRisk {
  if (
    [
      "pages",
      "page_versions",
      "page_comments",
      "block_comments",
      "database_rows",
    ].includes(tableName)
  ) {
    return "high";
  }

  if (
    [
      "databases",
      "database_fields",
      "database_views",
      "files",
      "wiki_links",
    ].includes(tableName)
  ) {
    return "medium";
  }

  return "low";
}

function getTablePrivacyBoundary(tableName: string) {
  switch (tableName) {
    case "pages":
      return "Page rows can reference private note bodies; preview excludes page text.";
    case "page_versions":
      return "Version rows can contain historical page snapshots; preview excludes snapshot content.";
    case "page_comments":
    case "block_comments":
      return "Comments can contain research discussion; preview excludes comment bodies.";
    case "database_rows":
      return "Rows can contain thesis, rating, sizing, and research fields; preview excludes row values.";
    case "files":
      return "Files can include reports and models; preview excludes file bytes.";
    case "databases":
    case "database_fields":
    case "database_views":
      return "Database metadata can reveal tracker structure; preview includes table metadata only.";
    case "wiki_links":
      return "Page relationships can reveal research connections; preview excludes page text.";
    default:
      return "Preview includes sync metadata only for this table.";
  }
}

function riskWeight(risk: SyncPayloadRisk) {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}
