import type {
  SyncPayloadPreview,
  SyncPayloadTablePreview,
} from "@/lib/sync/syncPayloadPreview";

export type CommentVersionReplaySurfaceId = "comments" | "versions";
export type CommentVersionReplaySurfaceStatus =
  | "ready-for-owner-gated-replay"
  | "no-local-pending";

export interface CommentVersionReplaySurface {
  id: CommentVersionReplaySurfaceId;
  title: string;
  status: CommentVersionReplaySurfaceStatus;
  local_tables: string[];
  cloud_target: "cloud.comments" | "cloud.page_versions";
  pending_rows: number;
  included_rows: number;
  operations: SyncPayloadTablePreview["operations"];
  content_fields: string[];
  metadata_fields: string[];
  deletion_rule: string;
  replay_rule: string;
  conflict_rule: string;
  privacy_boundary: string;
  next_action: string;
}

export interface CommentVersionCloudReplayContract {
  format: "zhinote-comment-version-cloud-replay-contract";
  format_version: 1;
  contract_status: "owner-gated-content-sync-contract";
  architecture_target: "cloud-master-local-hot-cache";
  privacy_note: string;
  boundary: {
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_page_body_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    ordinary_sync_pending_only: true;
    sync_log_contains_row_ids_only: true;
    content_payload_loaded_only_after_owner_confirmation: true;
    metadata_reports_must_exclude_content: true;
  };
  summary: {
    surfaces: number;
    pending_rows: number;
    included_rows: number;
    owner_gated_surfaces: number;
    append_only_surfaces: number;
    tombstone_ready_surfaces: number;
  };
  surfaces: CommentVersionReplaySurface[];
  required_cloud_tables: Array<{
    table: "comments" | "page_versions";
    key_rule: string;
    required_indexes: string[];
    retention_rule: string;
  }>;
  blocked_until_owner_gate: string[];
}

export function buildCommentVersionCloudReplayContract(input: {
  syncPayloadPreview: SyncPayloadPreview;
}): CommentVersionCloudReplayContract {
  const surfaces = [
    buildCommentsSurface(input.syncPayloadPreview),
    buildVersionsSurface(input.syncPayloadPreview),
  ];
  const pendingRows = surfaces.reduce(
    (total, surface) => total + surface.pending_rows,
    0
  );
  const includedRows = surfaces.reduce(
    (total, surface) => total + surface.included_rows,
    0
  );

  return {
    format: "zhinote-comment-version-cloud-replay-contract",
    format_version: 1,
    contract_status: "owner-gated-content-sync-contract",
    architecture_target: "cloud-master-local-hot-cache",
    privacy_note:
      "Generated locally. This contract maps comment and version pending rows to future cloud replay rules. It does not read comment bodies, version snapshots, page text, or upload data.",
    boundary: {
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_page_body_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      ordinary_sync_pending_only: true,
      sync_log_contains_row_ids_only: true,
      content_payload_loaded_only_after_owner_confirmation: true,
      metadata_reports_must_exclude_content: true,
    },
    summary: {
      surfaces: surfaces.length,
      pending_rows: pendingRows,
      included_rows: includedRows,
      owner_gated_surfaces: surfaces.length,
      append_only_surfaces: 1,
      tombstone_ready_surfaces: surfaces.length,
    },
    surfaces,
    required_cloud_tables: [
      {
        table: "comments",
        key_rule:
          "Use stable local comment id as client_id plus workspace_id; replay inserts, updates resolved/body, and soft-deletes by deleted_at.",
        required_indexes: [
          "workspace_id, page_id, resolved, updated_at",
          "workspace_id, client_id",
        ],
        retention_rule:
          "Keep deleted comments recoverable during beta; never expose comment bodies in metadata manifests.",
      },
      {
        table: "page_versions",
        key_rule:
          "Use stable local version id as client_id plus workspace_id; replay is append-only except soft delete tombstones.",
        required_indexes: [
          "workspace_id, page_id, version_num",
          "workspace_id, client_id",
          "workspace_id, deleted_at",
        ],
        retention_rule:
          "Keep version snapshots private and append-only; deleted_at is a tombstone for cloud reconciliation.",
      },
    ],
    blocked_until_owner_gate: [
      "Create server routes that require authenticated workspace membership and owner-gated content sync confirmation.",
      "Fetch comment bodies and version snapshots from local tables only at send time, never from sync_log previews or metadata manifests.",
      "Add cloud manifest counts for comments and page_versions before acknowledging local pending rows.",
      "Prove replay idempotency, retry behavior, and rollback on a disposable workspace before enabling real uploads.",
    ],
  };
}

function buildCommentsSurface(
  preview: SyncPayloadPreview
): CommentVersionReplaySurface {
  const tables = getTables(preview, ["page_comments", "block_comments"]);
  const operations = mergeOperations(tables);
  const pendingRows = sumTables(tables, "pending_count");
  const includedRows = sumTables(tables, "included_count");
  return {
    id: "comments",
    title: "评论和 block comments",
    status:
      pendingRows > 0 ? "ready-for-owner-gated-replay" : "no-local-pending",
    local_tables: ["page_comments", "block_comments"],
    cloud_target: "cloud.comments",
    pending_rows: pendingRows,
    included_rows: includedRows,
    operations,
    content_fields: ["body", "anchor_text"],
    metadata_fields: [
      "id",
      "page_id",
      "block_ref",
      "owner_id",
      "resolved",
      "created_at",
      "updated_at",
      "deleted_at",
    ],
    deletion_rule:
      "Local comment deletes are soft deletes through deleted_at, so cloud replay can preserve a recoverable tombstone.",
    replay_rule:
      "Only explicit sync_log rows for page_comments and block_comments are eligible. The future sender must read the current local row by id at send time after owner confirmation.",
    conflict_rule:
      "Append new comments by timestamp; for same comment id, cloud wins unless a local unsynced row exists, in which case preserve both and ask for review.",
    privacy_boundary:
      "This contract and metadata preview never include comment bodies or anchor text values.",
    next_action:
      "Implement an owner-gated comments replay route with manifest acknowledgement before marking local rows synced.",
  };
}

function buildVersionsSurface(
  preview: SyncPayloadPreview
): CommentVersionReplaySurface {
  const tables = getTables(preview, ["page_versions"]);
  const operations = mergeOperations(tables);
  const pendingRows = sumTables(tables, "pending_count");
  const includedRows = sumTables(tables, "included_count");
  return {
    id: "versions",
    title: "版本历史",
    status:
      pendingRows > 0 ? "ready-for-owner-gated-replay" : "no-local-pending",
    local_tables: ["page_versions"],
    cloud_target: "cloud.page_versions",
    pending_rows: pendingRows,
    included_rows: includedRows,
    operations,
    content_fields: ["title", "content_text", "summary", "content_yjs"],
    metadata_fields: [
      "id",
      "page_id",
      "owner_id",
      "version_num",
      "created_at",
      "deleted_at",
    ],
    deletion_rule:
      "page_versions now uses deleted_at as a soft tombstone; cloud replay must not rely on hard deletes.",
    replay_rule:
      "Version replay is append-only for inserts and soft-delete-only for deletes. Ordinary page body sync must not overwrite page_versions.",
    conflict_rule:
      "Keep both local and cloud versions when version_num collides; mark the duplicate for manual review instead of overwriting a snapshot.",
    privacy_boundary:
      "This contract and metadata preview never include version title, summary, content_text, content_yjs, or page body text.",
    next_action:
      "Implement page_versions cloud table replay after manifest counts and rollback proof exist.",
  };
}

function getTables(
  preview: SyncPayloadPreview,
  tableNames: string[]
): SyncPayloadTablePreview[] {
  const names = new Set(tableNames);
  return preview.tables.filter((table) => names.has(table.table_name));
}

function sumTables(
  tables: SyncPayloadTablePreview[],
  field: "pending_count" | "included_count"
) {
  return tables.reduce((total, table) => total + table[field], 0);
}

function mergeOperations(tables: SyncPayloadTablePreview[]) {
  const counts = new Map<string, number>();
  for (const table of tables) {
    for (const operation of table.operations) {
      counts.set(
        operation.operation,
        (counts.get(operation.operation) ?? 0) + operation.count
      );
    }
  }
  return Array.from(counts.entries())
    .map(([operation, count]) => ({ operation, count }))
    .sort((a, b) => b.count - a.count || a.operation.localeCompare(b.operation));
}
