import type {
  CommentVersionCloudReplayContract,
  CommentVersionReplaySurface,
} from "@/lib/sync/commentVersionCloudReplayContract";
import type { CommentVersionReplayApiDisabledResponse } from "@/lib/sync/commentVersionReplayApiStub";

export type CommentVersionReplayReceiptStatus =
  | "blocked-until-cloud-manifest-counts"
  | "no-local-pending";

export type CommentVersionReplayManifestCountStatus =
  | "missing-cloud-count"
  | "local-empty";

export interface CommentVersionReplayManifestCount {
  id: CommentVersionReplaySurface["id"];
  cloud_target: CommentVersionReplaySurface["cloud_target"];
  local_tables: string[];
  local_pending_rows: number;
  local_included_rows: number;
  expected_cloud_delta_rows: number;
  cloud_manifest_count: null;
  cloud_manifest_watermark: null;
  status: CommentVersionReplayManifestCountStatus;
  can_acknowledge_rows: false;
  ack_blockers: string[];
}

export interface CommentVersionReplayReceiptDraft {
  format: "zhinote-comment-version-replay-receipt-draft";
  format_version: 1;
  receipt_status: CommentVersionReplayReceiptStatus;
  architecture_target: "cloud-master-local-hot-cache";
  privacy_note: string;
  boundary: {
    local_draft_only: true;
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_page_body_text: false;
    reads_request_body: false;
    connects_cloud_services: false;
    reads_cloud_manifest: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    can_acknowledge_without_cloud_counts: false;
    can_mark_local_rows_synced: false;
  };
  summary: {
    surfaces: number;
    local_pending_rows: number;
    local_included_rows: number;
    cloud_targets: number;
    missing_cloud_manifest_counts: number;
    ack_ready_surfaces: number;
  };
  manifest_counts: CommentVersionReplayManifestCount[];
  replay_receipt_schema: {
    schema_status: "planned-count-and-ack-receipt-only";
    required_fields_before_ack: string[];
    forbidden_fields: string[];
  };
  ack_policy: {
    can_acknowledge_any_rows_now: false;
    local_rows_remain_pending: true;
    required_remote_evidence: string[];
    ack_blockers: string[];
  };
}

export function buildCommentVersionReplayReceiptDraft(input: {
  contract: CommentVersionCloudReplayContract;
  apiGuard: CommentVersionReplayApiDisabledResponse;
}): CommentVersionReplayReceiptDraft {
  const manifestCounts = input.contract.surfaces.map((surface) =>
    buildManifestCount(surface)
  );
  const localPendingRows = manifestCounts.reduce(
    (total, count) => total + count.local_pending_rows,
    0
  );
  const localIncludedRows = manifestCounts.reduce(
    (total, count) => total + count.local_included_rows,
    0
  );
  const missingCloudManifestCounts = manifestCounts.filter(
    (count) => count.status === "missing-cloud-count"
  ).length;

  return {
    format: "zhinote-comment-version-replay-receipt-draft",
    format_version: 1,
    receipt_status:
      missingCloudManifestCounts > 0 || localPendingRows > 0
        ? "blocked-until-cloud-manifest-counts"
        : "no-local-pending",
    architecture_target: "cloud-master-local-hot-cache",
    privacy_note:
      "Generated locally from pending metadata only. It does not read comment bodies, version snapshots, page body text, request bodies, cloud manifests, or upload data. Local rows remain pending until cloud.comments and cloud.page_versions manifest counts and a durable replay ack exist.",
    boundary: {
      local_draft_only: true,
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_page_body_text: false,
      reads_request_body: false,
      connects_cloud_services: false,
      reads_cloud_manifest: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      can_acknowledge_without_cloud_counts: false,
      can_mark_local_rows_synced: false,
    },
    summary: {
      surfaces: manifestCounts.length,
      local_pending_rows: localPendingRows,
      local_included_rows: localIncludedRows,
      cloud_targets: new Set(manifestCounts.map((count) => count.cloud_target))
        .size,
      missing_cloud_manifest_counts: missingCloudManifestCounts,
      ack_ready_surfaces: manifestCounts.filter(
        (count) => count.can_acknowledge_rows
      ).length,
    },
    manifest_counts: manifestCounts,
    replay_receipt_schema: {
      schema_status: input.apiGuard.response_schema.schema_status,
      required_fields_before_ack: [
        "workspace_id",
        "owner_confirmation_receipt_id",
        "comment_version_contract_id",
        "idempotency_key",
        "cloud.comments manifest count",
        "cloud.page_versions manifest count",
        "accepted_counts",
        "rejected_counts",
        "ack_cursor",
        "audit_event_envelope_id",
      ],
      forbidden_fields: input.apiGuard.response_schema.forbidden_fields.map(
        (field) => field.field
      ),
    },
    ack_policy: {
      can_acknowledge_any_rows_now: false,
      local_rows_remain_pending: true,
      required_remote_evidence: [
        "cloud.comments manifest count for accepted comment rows",
        "cloud.page_versions manifest count for accepted version rows",
        "durable replay receipt id from the server",
        "ack cursor after the server write commits",
        "idempotency proof that retries did not duplicate rows",
      ],
      ack_blockers: buildAckBlockers(input.contract, input.apiGuard),
    },
  };
}

function buildManifestCount(
  surface: CommentVersionReplaySurface
): CommentVersionReplayManifestCount {
  const hasPendingRows = surface.pending_rows > 0;
  return {
    id: surface.id,
    cloud_target: surface.cloud_target,
    local_tables: [...surface.local_tables],
    local_pending_rows: surface.pending_rows,
    local_included_rows: surface.included_rows,
    expected_cloud_delta_rows: surface.pending_rows,
    cloud_manifest_count: null,
    cloud_manifest_watermark: null,
    status: hasPendingRows ? "missing-cloud-count" : "local-empty",
    can_acknowledge_rows: false,
    ack_blockers: hasPendingRows
      ? [
          `${surface.cloud_target} manifest count is missing.`,
          "No durable replay receipt exists.",
          "Local sync_log rows must stay pending.",
        ]
      : ["No local pending rows are available for this surface."],
  };
}

function buildAckBlockers(
  contract: CommentVersionCloudReplayContract,
  apiGuard: CommentVersionReplayApiDisabledResponse
): string[] {
  return [
    "Replay API remains disabled-local-stub.",
    "Cloud manifest counts are not read by this local draft.",
    "No server replay receipt exists.",
    "Local sync_log acknowledgement is forbidden until remote counts match.",
    ...contract.blocked_until_owner_gate,
    ...apiGuard.enablement_gates.map(
      (gate) => `${gate.title}: ${gate.required_before_enablement}`
    ),
  ];
}
