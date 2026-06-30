import {
  buildCloudManifestCompareHandshakeGateReport,
  type CloudManifestCompareHandshakeGateReport,
} from "@/lib/sync/cloudManifestCompareHandshakeGate";

export type CloudManifestCompareOwnerReviewStatus =
  | "local-ready"
  | "owner-decision"
  | "blocked";

export interface CloudManifestCompareOwnerReviewDecision {
  id: string;
  title: string;
  status: CloudManifestCompareOwnerReviewStatus;
  answer: "yes" | "no";
  evidence: string;
  owner_prompt: string;
  required_before_compare: string;
}

export interface CloudManifestCompareOwnerReviewChecklistItem {
  id: string;
  title: string;
  status: CloudManifestCompareOwnerReviewStatus;
  source: string;
  evidence: string;
  required_before_compare: string;
}

export interface CloudManifestCompareOwnerReviewPacket {
  format: "zhinote-cloud-manifest-compare-owner-review-packet";
  format_version: 1;
  packet_status: "local-owner-review-only";
  compare_verdict: "not-ready";
  decision: "continue-local-prep-no-cloud-compare";
  required_confirmation_phrase: "APPROVE CLOUD MANIFEST ID-ONLY COMPARE";
  can_export_packet_now: true;
  can_request_owner_review_now: true;
  can_run_cloud_manifest_compare_now: false;
  can_return_missing_ids_now: false;
  can_rebuild_cache_now: false;
  can_enable_cloud_sync_now: false;
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_handshake_gate_metadata: true;
    uses_synthetic_fixtures_only: true;
    reads_route_response_over_http: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    reads_remote_manifest: false;
    reads_workspace_content: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    returns_raw_values: false;
    returns_missing_ids: false;
    rebuilds_cache: false;
    enables_sync: false;
    enables_ai: false;
    requires_owner_confirmation_before_compare: true;
    requires_separate_enabled_route: true;
  };
  local_evidence: {
    handshake_gate_status: CloudManifestCompareHandshakeGateReport["gate_status"];
    request_fixtures: number;
    request_rejections: number;
    response_fixtures: number;
    response_rejections: number;
    handshake_checks: number;
    handshake_blocked_checks: number;
    handshake_ready_for_owner_review_checks: number;
    api_guard_enablement_gates: number;
    api_guard_response_forbidden_fields: number;
  };
  summary: {
    decisions: number;
    yes: number;
    no: number;
    checklist_items: number;
    local_ready: number;
    owner_decision: number;
    blocked: number;
    forbidden_actions: number;
    excluded_payload_classes: number;
    required_verification_commands: number;
  };
  decisions: CloudManifestCompareOwnerReviewDecision[];
  checklist: CloudManifestCompareOwnerReviewChecklistItem[];
  required_verification_commands: string[];
  forbidden_actions_before_owner_approval: string[];
  excluded_payload_classes: string[];
}

const REQUIRED_VERIFICATION_COMMANDS = [
  "npm run verify:cloud-manifest-request",
  "npm run verify:cloud-manifest-response",
  "npm run verify:cloud-manifest-handshake",
  "npm run verify:cloud-manifest-owner-review",
  "npm run verify:cloud-manifest-api",
  "npm run verify:cloud-manifest-route",
  "npm run verify:web-beta",
  "npm run verify:web-beta:smoke",
  "npm run lint",
  "npm run build",
];

const FORBIDDEN_ACTIONS_BEFORE_OWNER_APPROVAL = [
  "run_cloud_manifest_compare",
  "return_missing_ids",
  "return_extra_ids",
  "rebuild_cache_from_cloud_manifest",
  "overwrite_local_cache",
  "mark_local_rows_synced",
  "enable_sync_push",
  "enable_sync_pull",
  "connect_cloud_database",
  "read_remote_manifest",
  "read_workspace_content",
  "upload_workspace_data",
  "write_server_data",
  "enable_ai_execution",
];

const EXCLUDED_PAYLOAD_CLASSES = [
  "page_body_text",
  "database_row_values",
  "comment_bodies",
  "version_snapshots",
  "file_names",
  "file_bytes",
  "backup_payloads",
  "sync_log_payloads",
  "raw_request_bodies",
  "raw_response_values",
  "remote_row_ids",
  "missing_ids",
  "extra_ids",
  "tokens",
  "cookies",
  "secret_values",
  "cloud_connection_strings",
];

export function buildCloudManifestCompareOwnerReviewPacket(): CloudManifestCompareOwnerReviewPacket {
  const handshakeGate = buildCloudManifestCompareHandshakeGateReport();
  const decisions = buildDecisions(handshakeGate);
  const checklist = buildChecklist(handshakeGate);
  const checklistStatuses = checklist.map((item) => item.status);

  return {
    format: "zhinote-cloud-manifest-compare-owner-review-packet",
    format_version: 1,
    packet_status: "local-owner-review-only",
    compare_verdict: "not-ready",
    decision: "continue-local-prep-no-cloud-compare",
    required_confirmation_phrase: "APPROVE CLOUD MANIFEST ID-ONLY COMPARE",
    can_export_packet_now: true,
    can_request_owner_review_now: true,
    can_run_cloud_manifest_compare_now: false,
    can_return_missing_ids_now: false,
    can_rebuild_cache_now: false,
    can_enable_cloud_sync_now: false,
    privacy_note:
      "Generated locally from the cloud manifest compare handshake gate. This owner review packet reads only synthetic validation summaries and disabled API guard metadata. It does not read route responses, send network requests, connect cloud services, read remote manifests, read workspace content, return missing ids, rebuild cache, upload data, write server data, enable sync, or enable AI.",
    boundary: {
      local_packet_only: true,
      reads_handshake_gate_metadata: true,
      uses_synthetic_fixtures_only: true,
      reads_route_response_over_http: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      reads_remote_manifest: false,
      reads_workspace_content: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      returns_raw_values: false,
      returns_missing_ids: false,
      rebuilds_cache: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_compare: true,
      requires_separate_enabled_route: true,
    },
    local_evidence: {
      handshake_gate_status: handshakeGate.gate_status,
      request_fixtures: handshakeGate.summary.request_fixtures,
      request_rejections: handshakeGate.summary.request_rejections,
      response_fixtures: handshakeGate.summary.response_fixtures,
      response_rejections: handshakeGate.summary.response_rejections,
      handshake_checks: handshakeGate.summary.checks,
      handshake_blocked_checks: handshakeGate.summary.blocked_checks,
      handshake_ready_for_owner_review_checks:
        handshakeGate.summary.ready_for_owner_review_checks,
      api_guard_enablement_gates:
        handshakeGate.summary.api_guard_enablement_gates,
      api_guard_response_forbidden_fields:
        handshakeGate.summary.api_guard_response_forbidden_fields,
    },
    summary: {
      decisions: decisions.length,
      yes: decisions.filter((decision) => decision.answer === "yes").length,
      no: decisions.filter((decision) => decision.answer === "no").length,
      checklist_items: checklist.length,
      local_ready: checklistStatuses.filter((status) => status === "local-ready")
        .length,
      owner_decision: checklistStatuses.filter(
        (status) => status === "owner-decision"
      ).length,
      blocked: checklistStatuses.filter((status) => status === "blocked")
        .length,
      forbidden_actions: FORBIDDEN_ACTIONS_BEFORE_OWNER_APPROVAL.length,
      excluded_payload_classes: EXCLUDED_PAYLOAD_CLASSES.length,
      required_verification_commands: REQUIRED_VERIFICATION_COMMANDS.length,
    },
    decisions,
    checklist,
    required_verification_commands: REQUIRED_VERIFICATION_COMMANDS,
    forbidden_actions_before_owner_approval:
      FORBIDDEN_ACTIONS_BEFORE_OWNER_APPROVAL,
    excluded_payload_classes: EXCLUDED_PAYLOAD_CLASSES,
  };
}

function buildDecisions(
  handshakeGate: CloudManifestCompareHandshakeGateReport
): CloudManifestCompareOwnerReviewDecision[] {
  return [
    {
      id: "continue-local-prep",
      title: "Continue local manifest compare preparation",
      status: "local-ready",
      answer: "yes",
      evidence:
        "Request validation, response validation, disabled API guard, and handshake gate can all be evaluated locally.",
      owner_prompt:
        "Continue local safety work without connecting cloud services or returning missing ids.",
      required_before_compare:
        "No owner approval is needed for local-only preparation.",
    },
    {
      id: "return-id-only-diff",
      title: "Return id-only missing/extra ids now",
      status: "owner-decision",
      answer: "no",
      evidence: `${handshakeGate.summary.blocked_checks} handshake checks remain blocked, and returns_missing_ids remains false.`,
      owner_prompt:
        "Only approve this after metadata-only remote manifests, auth, permissions, audit, rate limits, and response validation are proven.",
      required_before_compare:
        "Owner must approve id-only diff exposure with the exact confirmation phrase.",
    },
    {
      id: "run-cloud-manifest-compare",
      title: "Run cloud manifest compare now",
      status: "blocked",
      answer: "no",
      evidence: `Handshake status is ${handshakeGate.gate_status}; compare_handshake_can_start_now is false.`,
      owner_prompt:
        "Do not connect cloud until the dedicated route is enabled behind auth, permissions, audit, and rate limits.",
      required_before_compare:
        "Replace the disabled route only after a separate owner-approved enablement change.",
    },
    {
      id: "rebuild-cache-from-cloud-manifest",
      title: "Rebuild local cache from cloud manifest now",
      status: "blocked",
      answer: "no",
      evidence:
        "Cache rebuild remains blocked until a validated metadata-only response and durable ACK proof exist.",
      owner_prompt:
        "Do not rebuild local cache from cloud state until the cloud response is validated and the user explicitly confirms.",
      required_before_compare:
        "Run cache rebuild preflight and owner confirmation after id-only compare is approved.",
    },
    {
      id: "enable-cloud-sync",
      title: "Enable cloud sync now",
      status: "blocked",
      answer: "no",
      evidence: "cloud_sync_can_start_now remains false in the handshake gate.",
      owner_prompt:
        "Keep sync disabled until compare, cache rebuild, conflict handling, rollback, and audit evidence are complete.",
      required_before_compare:
        "Owner must approve cloud sync in a separate high-risk confirmation flow.",
    },
  ];
}

function buildChecklist(
  handshakeGate: CloudManifestCompareHandshakeGateReport
): CloudManifestCompareOwnerReviewChecklistItem[] {
  return handshakeGate.checks.map((check) => ({
    id: check.id,
    title: check.title,
    status:
      check.status === "ready-for-owner-review"
        ? "local-ready"
        : "blocked",
    source: "cloud-manifest-handshake-gate",
    evidence: check.evidence,
    required_before_compare: check.required_before_enablement,
  }));
}
