import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type CommentVersionReplayFieldStatus = "allowed" | "forbidden";
export type CommentVersionReplayValidationStatus = "accepted" | "rejected";

export interface CommentVersionReplayField {
  field: string;
  status: CommentVersionReplayFieldStatus;
  reason: string;
}

export interface CommentVersionReplayValidatorFixture {
  id: string;
  expected_status: CommentVersionReplayValidationStatus;
  actual_status: CommentVersionReplayValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface CommentVersionReplayValidatorReport {
  format: "zhinote-comment-version-replay-api-validator-fixtures";
  format_version: 1;
  report_status: "local-fixture-report-only";
  validator_status: "not-executing-route";
  summary: {
    fixtures: number;
    accepted: number;
    rejected: number;
    forbidden_payload_rejections: number;
    forbidden_fields_covered: number;
  };
  fixtures: CommentVersionReplayValidatorFixture[];
}

export interface CommentVersionReplayApiDisabledResponse {
  format: "zhinote-comment-version-replay-api-disabled";
  format_version: 1;
  api_id: "comment-version-replay";
  path: "/api/sync/comment-version-replay";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_replay_now: false;
  can_read_request_body_now: false;
  can_read_comment_bodies_now: false;
  can_read_version_snapshots_now: false;
  can_upload_workspace_data_now: false;
  can_write_server_data_now: false;
  can_acknowledge_rows_now: false;
  can_mark_local_rows_synced_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_request_body: false;
    accepts_comment_body_payload: false;
    accepts_version_snapshot_payload: false;
    accepts_page_body_payload: false;
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_page_body_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    acknowledges_sync_rows: false;
    mutates_local_sync_status: false;
    connects_cloud_services: false;
    returns_comment_bodies: false;
    returns_version_snapshots: false;
    returns_page_body_text: false;
    returns_remote_rows: false;
    requires_owner_confirmation_before_replay: true;
    requires_manifest_counts_before_ack: true;
    requires_comment_manifest_count_before_ack: true;
    requires_page_versions_manifest_count_before_ack: true;
    requires_idempotency_before_enablement: true;
    requires_retry_dead_letter_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_rollback_proof_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-owner-gated-row-id-only";
    allowed_fields: CommentVersionReplayField[];
    forbidden_fields: CommentVersionReplayField[];
  };
  response_schema: {
    schema_status: "planned-count-and-ack-receipt-only";
    allowed_fields: CommentVersionReplayField[];
    forbidden_fields: CommentVersionReplayField[];
  };
  local_validator_report: CommentVersionReplayValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_replay_receipt: false;
    returns_manifest_counts: false;
    returns_comment_bodies: false;
    returns_version_snapshots: false;
    returns_remote_rows: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    returns_required_owner_confirmation: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const COMMENT_VERSION_REPLAY_ALLOWED_REQUEST_FIELDS: CommentVersionReplayField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated actor id, not a free-form label."),
  allowed("device_id", "Registered device id for local provenance."),
  allowed("owner_confirmation_receipt_id", "Proof that the user reviewed the content-sync boundary."),
  allowed("comment_version_contract_id", "Opaque id of the reviewed comment/version replay contract."),
  allowed("sync_log_row_ids", "Explicit reviewed row ids from pending sync_log only."),
  allowed("surface_ids", "Limited to comments and versions, not arbitrary tables."),
  allowed("operation_counts", "Count-only create/update/delete summary."),
  allowed("changed_field_names", "Field names without values."),
  allowed("idempotency_key", "Prevents duplicate replay after retries."),
  allowed("local_manifest_watermark", "Metadata watermark for count comparison."),
  allowed("permission_decision_id", "Server permission decision reference."),
  allowed("audit_event_envelope_id", "Metadata-only audit event reference."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const COMMENT_VERSION_REPLAY_FORBIDDEN_REQUEST_FIELDS: CommentVersionReplayField[] = [
  forbidden("comment_body", "Comment bodies are loaded only by the future sender after owner confirmation, never accepted by this disabled route."),
  forbidden("anchor_text", "Anchor text can reveal private research and must not be posted as metadata."),
  forbidden("version_snapshot", "Version snapshots can contain full page history and must not be posted to the guard."),
  forbidden("content_text", "Page/version content text is private content, not route metadata."),
  forbidden("content_yjs", "Yjs payloads can contain full editor state and are forbidden here."),
  forbidden("page_body_text", "Page body text must not be part of replay route requests."),
  forbidden("page_snapshot_json", "Raw page snapshots are content payloads."),
  forbidden("raw_sync_log_payload", "Full sync_log payloads must not be posted."),
  forbidden("raw_request_body", "Raw request body retention is forbidden."),
  forbidden("force_acknowledge", "Clients cannot force acknowledgement without durable cloud counts."),
  forbidden("mark_synced", "Clients cannot mark local rows synced from a request."),
  forbidden("overwrite_cloud", "Replay cannot broadly overwrite cloud rows."),
  forbidden("delete_remote", "Remote deletes need separate reviewed conflict handling."),
  forbidden("local_file_path", "Local paths can disclose private folder names."),
  forbidden("token", "Tokens must never be included."),
  forbidden("cookie", "Cookies must never be included."),
  forbidden("password", "Passwords must never be included."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
];

const COMMENT_VERSION_REPLAY_ALLOWED_RESPONSE_FIELDS: CommentVersionReplayField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled replay API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-owner-confirmation, or accepted."),
  allowed("replay_receipt_id", "Future server-generated receipt id after replay is enabled."),
  allowed("manifest_count_summary", "Future count-only cloud.comments and cloud.page_versions comparison."),
  allowed("accepted_counts", "Future count-only accepted rows summary."),
  allowed("rejected_counts", "Future count-only rejected rows summary."),
  allowed("ack_cursor", "Future acknowledgement cursor after durable cloud write."),
  allowed("required_gates", "Gate ids that block replay."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const COMMENT_VERSION_REPLAY_FORBIDDEN_RESPONSE_FIELDS: CommentVersionReplayField[] = [
  forbidden("comment_body", "Replay responses must never return comment bodies."),
  forbidden("anchor_text", "Replay responses must never return anchor text."),
  forbidden("version_snapshot", "Replay responses must never return version snapshots."),
  forbidden("content_text", "Replay responses must never return page or version text."),
  forbidden("content_yjs", "Replay responses must never return Yjs payloads."),
  forbidden("page_body_text", "Replay responses must never return page body text."),
  forbidden("remote_rows", "Replay responses must not return full remote rows."),
  forbidden("raw_sync_log_payload", "Replay responses must not echo sync payloads."),
  forbidden("raw_request_body", "Replay responses must not echo raw request bodies."),
  forbidden("token", "Replay responses must never return tokens."),
  forbidden("cookie", "Replay responses must never return cookies."),
  forbidden("secret_values", "Replay responses must never return secrets."),
];

export function buildCommentVersionReplayApiDisabledResponse(): CommentVersionReplayApiDisabledResponse {
  return {
    format: "zhinote-comment-version-replay-api-disabled",
    format_version: 1,
    api_id: "comment-version-replay",
    path: "/api/sync/comment-version-replay",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_replay_now: false,
    can_read_request_body_now: false,
    can_read_comment_bodies_now: false,
    can_read_version_snapshots_now: false,
    can_upload_workspace_data_now: false,
    can_write_server_data_now: false,
    can_acknowledge_rows_now: false,
    can_mark_local_rows_synced_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not read request bodies, read comment bodies, read version snapshots, upload workspace data, write server data, acknowledge sync rows, mark local rows synced, connect cloud services, or return private content.",
    base_stub: buildWebBetaApiStubResponse("comment-version-replay"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_request_body: false,
      accepts_comment_body_payload: false,
      accepts_version_snapshot_payload: false,
      accepts_page_body_payload: false,
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_page_body_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      acknowledges_sync_rows: false,
      mutates_local_sync_status: false,
      connects_cloud_services: false,
      returns_comment_bodies: false,
      returns_version_snapshots: false,
      returns_page_body_text: false,
      returns_remote_rows: false,
      requires_owner_confirmation_before_replay: true,
      requires_manifest_counts_before_ack: true,
      requires_comment_manifest_count_before_ack: true,
      requires_page_versions_manifest_count_before_ack: true,
      requires_idempotency_before_enablement: true,
      requires_retry_dead_letter_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_rollback_proof_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-owner-gated-row-id-only",
      allowed_fields: buildCommentVersionReplayRequestFields(),
      forbidden_fields: buildCommentVersionReplayForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-count-and-ack-receipt-only",
      allowed_fields: buildCommentVersionReplayResponseFields(),
      forbidden_fields: buildCommentVersionReplayForbiddenResponseFields(),
    },
    local_validator_report: buildCommentVersionReplayValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_replay_receipt: false,
      returns_manifest_counts: false,
      returns_comment_bodies: false,
      returns_version_snapshots: false,
      returns_remote_rows: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      returns_required_owner_confirmation: true,
    },
    enablement_gates: [
      {
        id: "owner-confirmation",
        title: "Owner confirmation",
        required_before_enablement:
          "The user must review the comment/version content-sync boundary before any body or snapshot can be loaded.",
      },
      {
        id: "workspace-membership",
        title: "Workspace membership",
        required_before_enablement:
          "Server auth must prove workspace membership and role before any replay job can start.",
      },
      {
        id: "manifest-counts",
        title: "Manifest counts",
        required_before_enablement:
          "cloud.comments and cloud.page_versions counts must match the accepted replay receipt before local rows can be marked synced.",
      },
      {
        id: "idempotency",
        title: "Idempotency",
        required_before_enablement:
          "Replay needs idempotency keys so retries cannot duplicate comments or page_versions.",
      },
      {
        id: "retry-dead-letter",
        title: "Retry and dead-letter",
        required_before_enablement:
          "Failed replay jobs need retry caps, visible dead-letter state, and recovery steps.",
      },
      {
        id: "permission-check",
        title: "Permission check",
        required_before_enablement:
          "Comment/version replay must pass server permission checks before content is loaded or written.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Every replay job must link to a metadata-only audit event envelope.",
      },
      {
        id: "rollback-proof",
        title: "Rollback proof",
        required_before_enablement:
          "Partial replay and failed ack behavior must be reversible in a disposable workspace before enablement.",
      },
    ],
  };
}

export function buildCommentVersionReplayRequestFields(): CommentVersionReplayField[] {
  return COMMENT_VERSION_REPLAY_ALLOWED_REQUEST_FIELDS.map((field) => ({
    ...field,
  }));
}

export function buildCommentVersionReplayForbiddenFields(): CommentVersionReplayField[] {
  return COMMENT_VERSION_REPLAY_FORBIDDEN_REQUEST_FIELDS.map((field) => ({
    ...field,
  }));
}

export function buildCommentVersionReplayResponseFields(): CommentVersionReplayField[] {
  return COMMENT_VERSION_REPLAY_ALLOWED_RESPONSE_FIELDS.map((field) => ({
    ...field,
  }));
}

export function buildCommentVersionReplayForbiddenResponseFields(): CommentVersionReplayField[] {
  return COMMENT_VERSION_REPLAY_FORBIDDEN_RESPONSE_FIELDS.map((field) => ({
    ...field,
  }));
}

export function buildCommentVersionReplayValidatorReport(): CommentVersionReplayValidatorReport {
  const fixtures: CommentVersionReplayValidatorFixture[] = [
    {
      id: "metadata-owner-gated-replay-request",
      expected_status: "accepted",
      actual_status: "accepted",
      contains_forbidden_payload: false,
      forbidden_field_names: [],
      reason:
        "Contains only reviewed row ids, count metadata, idempotency, permission, audit, and owner confirmation references.",
    },
    {
      id: "comment-content-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["comment_body", "anchor_text", "raw_request_body"],
      reason:
        "Comment bodies, anchor text, and raw retained request bodies must stay out of the disabled replay API.",
    },
    {
      id: "version-snapshot-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "version_snapshot",
        "content_text",
        "content_yjs",
        "page_snapshot_json",
      ],
      reason:
        "Version snapshots and editor payloads are private content and require a later owner-gated sender.",
    },
    {
      id: "ack-mutation-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "force_acknowledge",
        "mark_synced",
        "overwrite_cloud",
        "delete_remote",
      ],
      reason:
        "Replay requests cannot force cloud acknowledgement, mutate local status, overwrite cloud rows, or delete remote data.",
    },
    {
      id: "credential-fields-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["token", "cookie", "password", "secret_values"],
      reason:
        "Credentials and connection secrets are rejected from comment/version replay requests.",
    },
  ];

  const accepted = fixtures.filter(
    (fixture) => fixture.actual_status === "accepted"
  ).length;
  const rejected = fixtures.filter(
    (fixture) => fixture.actual_status === "rejected"
  ).length;
  const forbiddenPayloadRejections = fixtures.filter(
    (fixture) =>
      fixture.actual_status === "rejected" &&
      fixture.contains_forbidden_payload
  ).length;
  const forbiddenFieldsCovered = unique(
    fixtures.flatMap((fixture) => fixture.forbidden_field_names)
  ).length;

  return {
    format: "zhinote-comment-version-replay-api-validator-fixtures",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "not-executing-route",
    summary: {
      fixtures: fixtures.length,
      accepted,
      rejected,
      forbidden_payload_rejections: forbiddenPayloadRejections,
      forbidden_fields_covered: forbiddenFieldsCovered,
    },
    fixtures,
  };
}

function allowed(field: string, reason: string): CommentVersionReplayField {
  return {
    field,
    status: "allowed",
    reason,
  };
}

function forbidden(field: string, reason: string): CommentVersionReplayField {
  return {
    field,
    status: "forbidden",
    reason,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
