export type CoreManifestReceiptOverallStatus =
  | "matched"
  | "needs-sync"
  | "blocked"
  | "mismatch";

export type CoreManifestReceiptDomainStatus =
  | "matched"
  | "needs-sync"
  | "blocked"
  | "mismatch";

export interface CoreManifestReceiptSummaryInput {
  matched: number;
  needsSync: number;
  mismatch: number;
  blocked: number;
  rebuildReady: number;
  ownerReviewRequired: number;
  pendingRows: number;
  absoluteCountDelta: number;
  absoluteDeletedDelta: number;
  domainsWithWatermarkMismatch: number;
  dateBucketsCompared: number;
  dateBucketsWithDiff: number;
  dateDiffRowsShown: number;
}

export interface CoreManifestReceiptDomainInput {
  id: string;
  title: string;
  status: CoreManifestReceiptDomainStatus;
  localCount: number;
  cloudCount: number | null;
  localDeleted: number;
  cloudDeleted: number | null;
  localWatermark: string;
  cloudWatermark: string | null;
  pending: number;
  countDelta: number | null;
  deletedDelta: number | null;
  watermarkMatches: boolean | null;
  rebuildGate: string;
  canRebuildFromCloudManifest: boolean;
  ownerReviewRequired: boolean;
  nextAction: string;
  safetyInvariant: string;
}

export interface CoreManifestReceiptDateDiffInput {
  comparedDates: number;
  datesWithDiff: number;
  rowsShown: number;
  truncated: boolean;
  blockedDomains: string[];
}

export interface CoreManifestCompareReceiptInput {
  checkedAt: string;
  status: CoreManifestReceiptOverallStatus;
  summary: CoreManifestReceiptSummaryInput;
  domains: CoreManifestReceiptDomainInput[];
  dateDiffReport: CoreManifestReceiptDateDiffInput;
  privacyNote: string;
  message?: string;
}

export interface CoreManifestCompareReceipt {
  format: "zhinote-core-manifest-compare-receipt";
  format_version: 1;
  receipt_status: "metadata-only-local-receipt";
  receipt_id: string;
  checked_at: string;
  generated_at: string;
  status: CoreManifestReceiptOverallStatus;
  privacy_note: string;
  message?: string;
  boundary: {
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    deletes_local_rows: false;
    overwrites_local_cache: false;
    includes_raw_workspace_content: false;
    includes_only_counts_watermarks_and_gates: true;
  };
  summary: CoreManifestReceiptSummaryInput & {
    domains: number;
    receipt_hash: string;
  };
  domains: Array<{
    id: string;
    title: string;
    status: CoreManifestReceiptDomainStatus;
    local_count: number;
    cloud_count: number | null;
    local_deleted: number;
    cloud_deleted: number | null;
    local_watermark: string;
    cloud_watermark: string | null;
    pending: number;
    count_delta: number | null;
    deleted_delta: number | null;
    watermark_matches: boolean | null;
    rebuild_gate: string;
    can_rebuild_from_cloud_manifest: boolean;
    owner_review_required: boolean;
    next_action: string;
    safety_invariant: string;
  }>;
  date_diff: CoreManifestReceiptDateDiffInput;
  owner_review: {
    required: boolean;
    required_domains: string[];
    next_actions: string[];
  };
}

export function buildCoreManifestCompareReceipt(
  input: CoreManifestCompareReceiptInput
): CoreManifestCompareReceipt {
  const domains = input.domains.map((domain) => ({
    id: domain.id,
    title: domain.title,
    status: domain.status,
    local_count: domain.localCount,
    cloud_count: domain.cloudCount,
    local_deleted: domain.localDeleted,
    cloud_deleted: domain.cloudDeleted,
    local_watermark: domain.localWatermark,
    cloud_watermark: domain.cloudWatermark,
    pending: domain.pending,
    count_delta: domain.countDelta,
    deleted_delta: domain.deletedDelta,
    watermark_matches: domain.watermarkMatches,
    rebuild_gate: domain.rebuildGate,
    can_rebuild_from_cloud_manifest: domain.canRebuildFromCloudManifest,
    owner_review_required: domain.ownerReviewRequired,
    next_action: domain.nextAction,
    safety_invariant: domain.safetyInvariant,
  }));
  const receiptHash = stableHash({
    checked_at: input.checkedAt,
    status: input.status,
    summary: input.summary,
    domains,
    date_diff: input.dateDiffReport,
  });
  const requiredDomains = domains
    .filter((domain) => domain.owner_review_required)
    .map((domain) => domain.id);

  return {
    format: "zhinote-core-manifest-compare-receipt",
    format_version: 1,
    receipt_status: "metadata-only-local-receipt",
    receipt_id: `core-manifest:${receiptHash}`,
    checked_at: input.checkedAt,
    generated_at: new Date().toISOString(),
    status: input.status,
    privacy_note: input.privacyNote,
    message: input.message,
    boundary: {
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      deletes_local_rows: false,
      overwrites_local_cache: false,
      includes_raw_workspace_content: false,
      includes_only_counts_watermarks_and_gates: true,
    },
    summary: {
      ...input.summary,
      domains: domains.length,
      receipt_hash: receiptHash,
    },
    domains,
    date_diff: {
      comparedDates: input.dateDiffReport.comparedDates,
      datesWithDiff: input.dateDiffReport.datesWithDiff,
      rowsShown: input.dateDiffReport.rowsShown,
      truncated: input.dateDiffReport.truncated,
      blockedDomains: [...input.dateDiffReport.blockedDomains],
    },
    owner_review: {
      required: requiredDomains.length > 0,
      required_domains: requiredDomains,
      next_actions: domains
        .filter((domain) => domain.owner_review_required)
        .map((domain) => domain.next_action),
    },
  };
}

function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
