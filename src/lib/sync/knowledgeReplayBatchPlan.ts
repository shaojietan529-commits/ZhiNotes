import type { SyncLogEntry } from "@/lib/db/local/queries";
import type { CommentVersionReplayAckGate } from "@/lib/sync/commentVersionReplayAckGate";
import type { CommentVersionReplayReceiptDraft } from "@/lib/sync/commentVersionReplayReceipt";
import type { SyncPayloadPreview } from "@/lib/sync/syncPayloadPreview";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type KnowledgeReplaySurfaceId = "comments" | "versions" | "wiki-links";
export type KnowledgeReplaySurfaceStatus =
  | "ready-for-owner-gated-replay"
  | "no-local-pending";

export interface KnowledgeReplayBatchRow {
  sync_log_id: number;
  table_name: "page_comments" | "block_comments" | "page_versions" | "wiki_links";
  row_id: string;
  operation: string;
  changed_field_names: string[];
  queued_at: string;
  status: string;
  attempt_count: number;
  source: string;
  idempotency_key: string;
}

export interface KnowledgeReplaySurfacePlan {
  id: KnowledgeReplaySurfaceId;
  title: string;
  status: KnowledgeReplaySurfaceStatus;
  local_tables: KnowledgeReplayBatchRow["table_name"][];
  cloud_target: "cloud.comments" | "cloud.page_versions" | "cloud.wiki_links";
  pending_rows: number;
  operation_counts: Array<{ operation: string; count: number }>;
  changed_field_names: string[];
  row_ids_only: true;
  content_payload_policy: string;
  ack_policy: string;
}

export interface KnowledgeReplayBatchPlan {
  format: "zhinote-knowledge-replay-batch-plan";
  format_version: 1;
  plan_status: "local-metadata-only-owner-gated";
  architecture_target: "cloud-master-local-hot-cache";
  generated_at: string;
  batch_id: string;
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    reads_sync_log_metadata: true;
    reads_sync_log_payloads: false;
    reads_comment_bodies: false;
    reads_block_comment_bodies: false;
    reads_version_snapshots: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    can_acknowledge_rows_now: false;
    row_ids_only: true;
  };
  workspace_identity: {
    workspace_id: string | null;
    device_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
  };
  summary: {
    surfaces: number;
    pending_rows: number;
    row_ids: number;
    operation_kinds: number;
    changed_field_names: number;
    idempotency_keys: number;
    high_risk_tables: number;
    medium_risk_tables: number;
    can_send_to_cloud_now: false;
    can_acknowledge_any_rows_now: false;
  };
  surfaces: KnowledgeReplaySurfacePlan[];
  batch_rows: KnowledgeReplayBatchRow[];
  replay_request_envelope: {
    schema_status: "planned-row-id-and-idempotency-only";
    allowed_fields: string[];
    forbidden_fields: string[];
  };
  ack_policy: {
    receipt_status: CommentVersionReplayReceiptDraft["receipt_status"];
    ack_gate_status: CommentVersionReplayAckGate["gate_status"];
    can_acknowledge_any_rows_now: false;
    local_rows_remain_pending: true;
    required_remote_evidence: string[];
    forbidden_client_actions: string[];
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
  next_action: string;
}

const KNOWLEDGE_REPLAY_TABLES = [
  "page_comments",
  "block_comments",
  "page_versions",
  "wiki_links",
] as const;

type KnowledgeReplayTableName = (typeof KNOWLEDGE_REPLAY_TABLES)[number];

export function buildKnowledgeReplayBatchPlan(input: {
  syncEntries: SyncLogEntry[];
  syncPayloadPreview: SyncPayloadPreview;
  workspaceIdentity: LocalWorkspaceIdentity | null;
  receipt: CommentVersionReplayReceiptDraft;
  ackGate: CommentVersionReplayAckGate;
  generatedAt?: string;
}): KnowledgeReplayBatchPlan {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const batchRows = input.syncEntries
    .filter(isKnowledgeReplayEntry)
    .map((entry) => buildBatchRow(entry));
  const surfaces = [
    buildSurface("comments", "评论和 block comments", ["page_comments", "block_comments"], "cloud.comments", batchRows),
    buildSurface("versions", "版本历史", ["page_versions"], "cloud.page_versions", batchRows),
    buildSurface("wiki-links", "页面关系 / backlinks", ["wiki_links"], "cloud.wiki_links", batchRows),
  ];
  const operationKinds = new Set(batchRows.map((row) => row.operation)).size;
  const changedFieldNames = unique(batchRows.flatMap((row) => row.changed_field_names));
  const localWatermark = latestTimestamp(batchRows);
  const batchId = `knowledge-replay-local-${stableHash([
    input.workspaceIdentity?.workspace_id ?? "local",
    input.workspaceIdentity?.device_id ?? "device",
    localWatermark,
    String(batchRows.length),
    batchRows.map((row) => row.idempotency_key).join("|"),
  ].join("::"))}`;
  const highRiskTables = input.syncPayloadPreview.tables.filter(
    (table) =>
      table.sensitivity === "high" &&
      ["page_comments", "block_comments", "page_versions"].includes(
        table.table_name
      )
  ).length;
  const mediumRiskTables = input.syncPayloadPreview.tables.filter(
    (table) => table.sensitivity === "medium" && table.table_name === "wiki_links"
  ).length;

  return {
    format: "zhinote-knowledge-replay-batch-plan",
    format_version: 1,
    plan_status: "local-metadata-only-owner-gated",
    architecture_target: "cloud-master-local-hot-cache",
    generated_at: generatedAt,
    batch_id: batchId,
    privacy_note:
      "Generated locally from sync_log metadata only. The plan lists table names, row ids, operations, changed field names, status, attempt counts, and idempotency keys for comments, page_versions, and wiki_links. It does not read comment bodies, block comment bodies, version snapshots, page text, database row values, file names, file bytes, cloud manifests, request bodies, tokens, cookies, or secrets; it does not connect cloud services, upload workspace data, write server data, or acknowledge sync rows.",
    boundary: {
      local_plan_only: true,
      reads_sync_log_metadata: true,
      reads_sync_log_payloads: false,
      reads_comment_bodies: false,
      reads_block_comment_bodies: false,
      reads_version_snapshots: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      can_acknowledge_rows_now: false,
      row_ids_only: true,
    },
    workspace_identity: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
    },
    summary: {
      surfaces: surfaces.length,
      pending_rows: batchRows.length,
      row_ids: new Set(batchRows.map((row) => row.row_id)).size,
      operation_kinds: operationKinds,
      changed_field_names: changedFieldNames.length,
      idempotency_keys: new Set(batchRows.map((row) => row.idempotency_key)).size,
      high_risk_tables: highRiskTables,
      medium_risk_tables: mediumRiskTables,
      can_send_to_cloud_now: false,
      can_acknowledge_any_rows_now: false,
    },
    surfaces,
    batch_rows: batchRows,
    replay_request_envelope: {
      schema_status: "planned-row-id-and-idempotency-only",
      allowed_fields: [
        "workspace_id",
        "device_id",
        "batch_id",
        "sync_log_id",
        "table_name",
        "row_id",
        "operation",
        "changed_field_names",
        "queued_at",
        "status",
        "attempt_count",
        "idempotency_key",
        "owner_confirmation_receipt_id",
        "permission_decision_id",
        "audit_event_envelope_id",
      ],
      forbidden_fields: [
        "comment_body",
        "block_comment_body",
        "anchor_text",
        "version_snapshot",
        "content_text",
        "content_yjs",
        "page_body_text",
        "database_row_values",
        "file_name",
        "file_bytes",
        "raw_sync_log_payload",
        "raw_request_body",
        "force_acknowledge",
        "mark_synced",
        "overwrite_cloud",
        "delete_remote",
        "token",
        "cookie",
        "password",
        "secret_values",
      ],
    },
    ack_policy: {
      receipt_status: input.receipt.receipt_status,
      ack_gate_status: input.ackGate.gate_status,
      can_acknowledge_any_rows_now: false,
      local_rows_remain_pending: true,
      required_remote_evidence: [
        ...input.receipt.ack_policy.required_remote_evidence,
        "cloud.wiki_links manifest count for accepted relationship rows",
        "durable batch replay receipt id that references every accepted sync_log_id",
        "server-generated ack cursor after the full batch transaction commits",
      ],
      forbidden_client_actions: [
        ...input.ackGate.sync_log_update_contract.forbidden_client_actions,
        "send comment bodies from the metadata batch plan",
        "send version snapshots from the metadata batch plan",
        "send wiki link target text instead of row ids",
        "acknowledge partial batches without rejected row receipts",
      ],
    },
    enablement_gates: [
      {
        id: "owner-confirmation",
        title: "Owner content-sync confirmation",
        required_before_enablement:
          "User must review the concrete content classes and approve sending comment bodies, version snapshots, or link targets separately from this metadata plan.",
      },
      {
        id: "permission-check",
        title: "Workspace permission decision",
        required_before_enablement:
          "Server must prove the actor can replay knowledge metadata for the target workspace.",
      },
      {
        id: "idempotency",
        title: "Idempotency and retry proof",
        required_before_enablement:
          "Each sync_log row must be protected by a stable idempotency key and replayed safely after retries.",
      },
      {
        id: "manifest-counts",
        title: "Cloud manifest counts",
        required_before_enablement:
          "cloud.comments, cloud.page_versions, and cloud.wiki_links counts must match accepted row counts before local ack.",
      },
      {
        id: "audit-event",
        title: "Metadata-only audit envelope",
        required_before_enablement:
          "Audit records must store ids, counts, hashes, and decisions, never private bodies or raw payloads.",
      },
      {
        id: "rollback-proof",
        title: "Rollback and dead-letter path",
        required_before_enablement:
          "Rejected rows need a durable dead-letter record and rollback path before any local sync_log mutation.",
      },
    ],
    next_action:
      batchRows.length > 0
        ? "Keep the knowledge rows pending. Next implement an owner-gated server replay that accepts this row-id-only batch, returns durable counts, and opens ACK only after manifest counts match."
        : "No local knowledge metadata rows are pending. Keep the plan available so future comment, version, and backlink changes have a deterministic replay envelope.",
  };
}

function isKnowledgeReplayEntry(
  entry: SyncLogEntry
): entry is SyncLogEntry & { tableName: KnowledgeReplayTableName } {
  return (
    (KNOWLEDGE_REPLAY_TABLES as readonly string[]).includes(entry.tableName) &&
    entry.synced === 0 &&
    entry.status !== "synced"
  );
}

function buildBatchRow(
  entry: SyncLogEntry & { tableName: KnowledgeReplayTableName }
): KnowledgeReplayBatchRow {
  return {
    sync_log_id: entry.id,
    table_name: entry.tableName,
    row_id: entry.rowId,
    operation: entry.operation,
    changed_field_names: unique(entry.changedCols),
    queued_at: entry.timestamp,
    status: entry.status,
    attempt_count: entry.attemptCount,
    source: entry.source,
    idempotency_key: buildIdempotencyKey(entry),
  };
}

function buildSurface(
  id: KnowledgeReplaySurfaceId,
  title: string,
  tables: KnowledgeReplayBatchRow["table_name"][],
  cloudTarget: KnowledgeReplaySurfacePlan["cloud_target"],
  rows: KnowledgeReplayBatchRow[]
): KnowledgeReplaySurfacePlan {
  const surfaceRows = rows.filter((row) => tables.includes(row.table_name));
  return {
    id,
    title,
    status:
      surfaceRows.length > 0
        ? "ready-for-owner-gated-replay"
        : "no-local-pending",
    local_tables: tables,
    cloud_target: cloudTarget,
    pending_rows: surfaceRows.length,
    operation_counts: countOperations(surfaceRows),
    changed_field_names: unique(
      surfaceRows.flatMap((row) => row.changed_field_names)
    ),
    row_ids_only: true,
    content_payload_policy:
      "This batch carries only sync_log ids and row ids. Private bodies, snapshots, link target text, and row values are loaded only by a future owner-gated sender after permission and audit gates pass.",
    ack_policy:
      "No row can be marked synced from this local plan. ACK requires a durable remote receipt, manifest counts for the cloud target, idempotency proof, and an ack cursor after commit.",
  };
}

function countOperations(rows: KnowledgeReplayBatchRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.operation, (counts.get(row.operation) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([operation, count]) => ({ operation, count }))
    .sort((a, b) => b.count - a.count || a.operation.localeCompare(b.operation));
}

function buildIdempotencyKey(entry: SyncLogEntry) {
  return `knowledge-replay:v1:${entry.tableName}:${entry.rowId}:${entry.operation}:${entry.timestamp}:${entry.id}`;
}

function latestTimestamp(rows: KnowledgeReplayBatchRow[]) {
  return rows.reduce(
    (latest, row) => (row.queued_at > latest ? row.queued_at : latest),
    ""
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function stableHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
