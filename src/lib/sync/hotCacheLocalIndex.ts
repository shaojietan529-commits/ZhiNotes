import { getDb } from "@/lib/db/local/client";
import type {
  HotCacheWarmupReceipt,
  HotCacheWarmupReceiptJob,
} from "@/lib/sync/hotCacheWarmupReceipt";

const HOT_CACHE_SCOPE = "hot-cache-warmup";
const HOT_CACHE_ENTRY_TTL_DAYS = 30;

export interface HotCacheLocalIndexWriteReceipt {
  format: "zhinote-hot-cache-local-index-write-receipt";
  format_version: 1;
  status: "metadata-cache-index-updated";
  architecture_target: "cloud-master-local-hot-cache";
  source_receipt_format: HotCacheWarmupReceipt["format"];
  source_plan_hash: string;
  written_at: string;
  privacy_boundary: string;
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enters_sync_log: false;
    mutates_local_hot_cache_index: true;
    stores_source_of_truth: false;
    records_metadata_only: true;
  };
  summary: {
    indexed_jobs: number;
    indexed_rows: number;
    indexed_route_targets: number;
    estimated_metadata_records: number;
    pending_rows_protected: number;
    failed_routes: number;
  };
  rows: Array<{
    id: string;
    job_id: string;
    route_target: string;
    receipt_status: HotCacheWarmupReceiptJob["status"];
  }>;
}

export interface HotCacheLocalIndexSummary {
  format: "zhinote-hot-cache-local-index-summary";
  format_version: 1;
  status: "metadata-cache-index-readable";
  architecture_target: "cloud-master-local-hot-cache";
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enters_sync_log: false;
    mutates_local_hot_cache_index: false;
    stores_source_of_truth: false;
    records_metadata_only: true;
  };
  summary: {
    rows: number;
    distinct_route_targets: number;
    total_metadata_records: number;
    prefetched_rows: number;
    failed_routes: number;
    latest_warmed_at: string | null;
  };
}

interface HotCacheEntryRow {
  id: string;
  scope: string;
  planHash: string;
  jobId: string;
  routeTarget: string;
  receiptStatus: HotCacheWarmupReceiptJob["status"];
  sourceStatus: HotCacheWarmupReceiptJob["source_status"];
  attemptedRoutes: number;
  failedRoutes: number;
  estimatedMetadataRecords: number;
  warmedAt: string;
  expiresAt: string;
  metadataJson: string;
}

export async function writeHotCacheWarmupReceiptToLocalIndex(
  receipt: HotCacheWarmupReceipt
): Promise<HotCacheLocalIndexWriteReceipt> {
  const db = await getDb();
  const warmedAt = receipt.finished_at;
  const expiresAt = addDays(warmedAt, HOT_CACHE_ENTRY_TTL_DAYS);
  const rows = buildRows(receipt, warmedAt, expiresAt);

  for (const row of rows) {
    db.run(
      `INSERT INTO hot_cache_entries (
         id,
         scope,
         plan_hash,
         job_id,
         route_target,
         receipt_status,
         source_status,
         attempted_routes,
         failed_routes,
         estimated_metadata_records,
         warmed_at,
         expires_at,
         source_receipt_format,
         metadata_json
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         scope = excluded.scope,
         plan_hash = excluded.plan_hash,
         route_target = excluded.route_target,
         receipt_status = excluded.receipt_status,
         source_status = excluded.source_status,
         attempted_routes = excluded.attempted_routes,
         failed_routes = excluded.failed_routes,
         estimated_metadata_records = excluded.estimated_metadata_records,
         warmed_at = excluded.warmed_at,
         expires_at = excluded.expires_at,
         source_receipt_format = excluded.source_receipt_format,
         metadata_json = excluded.metadata_json`,
      [
        row.id,
        row.scope,
        row.planHash,
        row.jobId,
        row.routeTarget,
        row.receiptStatus,
        row.sourceStatus,
        row.attemptedRoutes,
        row.failedRoutes,
        row.estimatedMetadataRecords,
        row.warmedAt,
        row.expiresAt,
        receipt.format,
        row.metadataJson,
      ]
    );
  }

  return {
    format: "zhinote-hot-cache-local-index-write-receipt",
    format_version: 1,
    status: "metadata-cache-index-updated",
    architecture_target: "cloud-master-local-hot-cache",
    source_receipt_format: receipt.format,
    source_plan_hash: receipt.plan_hash,
    written_at: new Date().toISOString(),
    privacy_boundary:
      "This write updates only the rebuildable local hot_cache_entries metadata index. It does not read page bodies, database row values, comment bodies, file bytes, file text, tokens, or raw cache dumps. It does not enter sync_log and is not a cloud source of truth.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enters_sync_log: false,
      mutates_local_hot_cache_index: true,
      stores_source_of_truth: false,
      records_metadata_only: true,
    },
    summary: {
      indexed_jobs: receipt.jobs.length,
      indexed_rows: rows.length,
      indexed_route_targets: new Set(rows.map((row) => row.routeTarget).filter(Boolean))
        .size,
      estimated_metadata_records: rows.reduce(
        (total, row) => total + row.estimatedMetadataRecords,
        0
      ),
      pending_rows_protected: receipt.summary.pending_rows_protected,
      failed_routes: receipt.summary.failed_routes,
    },
    rows: rows.map((row) => ({
      id: row.id,
      job_id: row.jobId,
      route_target: row.routeTarget,
      receipt_status: row.receiptStatus,
    })),
  };
}

export async function getHotCacheLocalIndexSummary(): Promise<HotCacheLocalIndexSummary> {
  const db = await getDb();
  const rows = db.query(
    `SELECT
       COUNT(*) AS row_count,
       COUNT(DISTINCT NULLIF(route_target, '')) AS distinct_route_targets,
       COALESCE(SUM(estimated_metadata_records), 0) AS total_metadata_records,
       COALESCE(SUM(CASE WHEN receipt_status = 'prefetched' THEN 1 ELSE 0 END), 0) AS prefetched_rows,
       COALESCE(SUM(failed_routes), 0) AS failed_routes,
       MAX(warmed_at) AS latest_warmed_at
     FROM hot_cache_entries
     WHERE scope = ?`,
    [HOT_CACHE_SCOPE]
  );
  const row = rows[0] ?? {};

  return {
    format: "zhinote-hot-cache-local-index-summary",
    format_version: 1,
    status: "metadata-cache-index-readable",
    architecture_target: "cloud-master-local-hot-cache",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enters_sync_log: false,
      mutates_local_hot_cache_index: false,
      stores_source_of_truth: false,
      records_metadata_only: true,
    },
    summary: {
      rows: toNumber(row.row_count),
      distinct_route_targets: toNumber(row.distinct_route_targets),
      total_metadata_records: toNumber(row.total_metadata_records),
      prefetched_rows: toNumber(row.prefetched_rows),
      failed_routes: toNumber(row.failed_routes),
      latest_warmed_at: row.latest_warmed_at
        ? String(row.latest_warmed_at)
        : null,
    },
  };
}

function buildRows(
  receipt: HotCacheWarmupReceipt,
  warmedAt: string,
  expiresAt: string
): HotCacheEntryRow[] {
  return receipt.jobs.flatMap((job) => {
    const routeTargets = job.route_targets.length > 0 ? job.route_targets : [""];
    return routeTargets.map((routeTarget, index) => ({
      id: buildRowId(job.job_id, routeTarget),
      scope: HOT_CACHE_SCOPE,
      planHash: receipt.plan_hash,
      jobId: job.job_id,
      routeTarget,
      receiptStatus: job.status,
      sourceStatus: job.source_status,
      attemptedRoutes: job.attempted_routes,
      failedRoutes: job.failed_routes,
      estimatedMetadataRecords: index === 0 ? job.estimated_metadata_records : 0,
      warmedAt,
      expiresAt,
      metadataJson: JSON.stringify({
        format: "zhinote-hot-cache-local-index-metadata",
        records_metadata_only: true,
        title: job.title,
        reason: job.reason,
        source_receipt_status: receipt.receipt_status,
      }),
    }));
  });
}

function buildRowId(jobId: string, routeTarget: string): string {
  return `warmup:${jobId}:${routeTarget ? stableHash(routeTarget) : "job"}`;
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
