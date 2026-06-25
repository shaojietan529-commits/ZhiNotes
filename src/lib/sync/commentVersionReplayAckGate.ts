import type {
  CommentVersionReplayManifestCount,
  CommentVersionReplayReceiptDraft,
} from "@/lib/sync/commentVersionReplayReceipt";

export type CommentVersionReplayAckGateStatus =
  | "blocked-until-durable-remote-receipt"
  | "blocked-until-cloud-counts-match";

export type CommentVersionReplayAckCheckStatus = "missing" | "blocked";

export interface CommentVersionReplayAckCheck {
  id: string;
  label: string;
  status: CommentVersionReplayAckCheckStatus;
  blocks_ack: true;
  local_expected_rows: number | null;
  remote_evidence: null;
  reason: string;
}

export interface CommentVersionReplayAckGate {
  format: "zhinote-comment-version-replay-ack-gate";
  format_version: 1;
  gate_status: CommentVersionReplayAckGateStatus;
  architecture_target: "cloud-master-local-hot-cache";
  privacy_note: string;
  boundary: {
    local_gate_only: true;
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_page_body_text: false;
    reads_sync_log_payloads: false;
    reads_cloud_manifest: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    can_mark_local_rows_synced_now: false;
  };
  summary: {
    local_pending_rows: number;
    required_checks: number;
    missing_remote_evidence: number;
    ack_ready_checks: 0;
  };
  checks: CommentVersionReplayAckCheck[];
  sync_log_update_contract: {
    can_update_sync_log_now: false;
    allowed_update_scope: "none";
    required_before_mark_synced: string[];
    forbidden_client_actions: string[];
  };
}

export function buildCommentVersionReplayAckGate(
  receipt: CommentVersionReplayReceiptDraft
): CommentVersionReplayAckGate {
  const checks = buildAckChecks(receipt);

  return {
    format: "zhinote-comment-version-replay-ack-gate",
    format_version: 1,
    gate_status:
      receipt.summary.local_pending_rows > 0
        ? "blocked-until-durable-remote-receipt"
        : "blocked-until-cloud-counts-match",
    architecture_target: "cloud-master-local-hot-cache",
    privacy_note:
      "Generated locally from the replay receipt draft. It does not read comment bodies, version snapshots, page text, sync_log payloads, cloud manifests, or upload data. The gate stays closed until durable server evidence proves the replay and manifest counts.",
    boundary: {
      local_gate_only: true,
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_page_body_text: false,
      reads_sync_log_payloads: false,
      reads_cloud_manifest: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      can_mark_local_rows_synced_now: false,
    },
    summary: {
      local_pending_rows: receipt.summary.local_pending_rows,
      required_checks: checks.length,
      missing_remote_evidence: checks.filter(
        (check) => check.remote_evidence === null
      ).length,
      ack_ready_checks: 0,
    },
    checks,
    sync_log_update_contract: {
      can_update_sync_log_now: false,
      allowed_update_scope: "none",
      required_before_mark_synced: [
        "durable replay receipt id from /api/sync/comment-version-replay",
        "cloud.comments manifest count equals accepted comment rows",
        "cloud.page_versions manifest count equals accepted version rows",
        "ack cursor returned after the server transaction commits",
        "idempotency proof that retry attempts did not duplicate rows",
        "audit event envelope id for the replay job",
      ],
      forbidden_client_actions: [
        "mark synced from a local draft receipt",
        "acknowledge sync_log rows without cloud manifest counts",
        "force acknowledge with client-provided counts",
        "clear pending rows after a disabled API response",
      ],
    },
  };
}

function buildAckChecks(
  receipt: CommentVersionReplayReceiptDraft
): CommentVersionReplayAckCheck[] {
  return [
    {
      id: "durable-replay-receipt-id",
      label: "durable replay receipt",
      status: "missing",
      blocks_ack: true,
      local_expected_rows: receipt.summary.local_pending_rows,
      remote_evidence: null,
      reason: "Server has not returned a durable replay receipt id.",
    },
    {
      id: "ack-cursor",
      label: "ack cursor",
      status: "missing",
      blocks_ack: true,
      local_expected_rows: receipt.summary.local_pending_rows,
      remote_evidence: null,
      reason: "No server acknowledgement cursor exists after a committed write.",
    },
    {
      id: "idempotency-proof",
      label: "idempotency proof",
      status: "missing",
      blocks_ack: true,
      local_expected_rows: receipt.summary.local_pending_rows,
      remote_evidence: null,
      reason: "Retries cannot be proven duplicate-safe yet.",
    },
    ...receipt.manifest_counts.map((count) => buildCountCheck(count)),
  ];
}

function buildCountCheck(
  count: CommentVersionReplayManifestCount
): CommentVersionReplayAckCheck {
  return {
    id: `${count.id}-manifest-count`,
    label: `${count.cloud_target} manifest count`,
    status: count.local_pending_rows > 0 ? "missing" : "blocked",
    blocks_ack: true,
    local_expected_rows: count.expected_cloud_delta_rows,
    remote_evidence: null,
    reason:
      count.local_pending_rows > 0
        ? `${count.cloud_target} cloud_manifest_count is still null.`
        : `${count.cloud_target} has no local pending rows, so no ack can be opened.`,
  };
}
