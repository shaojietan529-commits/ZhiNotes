import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type SyncPullApiFieldStatus = "allowed" | "forbidden";
export type SyncPullApiValidationStatus = "accepted" | "rejected";

export interface SyncPullApiField {
  field: string;
  status: SyncPullApiFieldStatus;
  reason: string;
}

export interface SyncPullApiValidatorFixture {
  id: string;
  expected_status: SyncPullApiValidationStatus;
  actual_status: SyncPullApiValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface SyncPullApiValidatorReport {
  format: "zhinote-sync-pull-api-validator-fixtures";
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
  fixtures: SyncPullApiValidatorFixture[];
}

export interface SyncPullApiDisabledResponse {
  format: "zhinote-sync-pull-api-disabled";
  format_version: 1;
  api_id: "sync-pull";
  path: "/api/sync/pull?cursor=:cursor";
  method: "GET";
  stub_status: "disabled-local-stub";
  can_pull_now: false;
  can_read_cursor_query_now: false;
  can_connect_cloud_now: false;
  can_read_remote_data_now: false;
  can_fetch_remote_baseline_now: false;
  can_stage_remote_rows_now: false;
  can_apply_remote_rows_now: false;
  can_acknowledge_remote_rows_now: false;
  can_write_workspace_data_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_cursor_query: false;
    connects_cloud_services: false;
    reads_remote_data: false;
    fetches_remote_rows: false;
    fetches_remote_baseline: false;
    stages_remote_rows: false;
    applies_remote_changes: false;
    acknowledges_remote_rows: false;
    writes_workspace_data: false;
    overwrites_local_data: false;
    deletes_local_rows: false;
    uploads_workspace_data: false;
    returns_remote_rows: false;
    returns_page_body_text: false;
    returns_database_row_values: false;
    returns_comment_bodies: false;
    returns_file_bytes: false;
    reads_secret_values: false;
    requires_authenticated_session_before_enablement: true;
    requires_workspace_membership_before_enablement: true;
    requires_cursor_contract_before_enablement: true;
    requires_remote_baseline_staging_before_enablement: true;
    requires_side_by_side_review_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_rollback_snapshot_before_apply: true;
    requires_owner_confirmation_before_apply: true;
  };
  request_schema: {
    schema_status: "planned-query-metadata-only";
    allowed_fields: SyncPullApiField[];
    forbidden_fields: SyncPullApiField[];
  };
  response_schema: {
    schema_status: "planned-stage-receipt-only";
    allowed_fields: SyncPullApiField[];
    forbidden_fields: SyncPullApiField[];
  };
  local_validator_report: SyncPullApiValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_pull_receipt: false;
    returns_remote_rows: false;
    returns_remote_baseline: false;
    returns_workspace_content: false;
    stages_remote_rows: false;
    writes_workspace_data: false;
    acknowledges_remote_rows: false;
    returns_required_review: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const SYNC_PULL_ALLOWED_REQUEST_FIELDS: SyncPullApiField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated actor id, never a free-form name."),
  allowed("device_id", "Registered device id for local sync provenance."),
  allowed("cursor", "Workspace-scoped cursor from the last staged baseline."),
  allowed("since_cursor", "Optional lower-bound cursor for replay tests."),
  allowed("table_names", "Requested table names for remote baseline metadata."),
  allowed("conflict_surface_ids", "Conflict surfaces that need side-by-side remote metadata."),
  allowed("remote_baseline_request_id", "Local request contract id for future fetch."),
  allowed("permission_decision_id", "Server permission decision reference for pull."),
  allowed("audit_event_envelope_id", "Metadata-only audit envelope reference."),
  allowed("replay_proof_id", "Disposable replay proof id before private beta pull."),
  allowed("idempotency_key", "Prevents duplicate staging jobs after retries."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const SYNC_PULL_FORBIDDEN_REQUEST_FIELDS: SyncPullApiField[] = [
  forbidden("remote_rows_payload", "Client requests must not submit remote rows to the pull route."),
  forbidden("raw_response_body", "Raw remote responses must not be retained in request metadata."),
  forbidden("page_body_text", "Page text must not be part of a pull request."),
  forbidden("block_text", "Block text is private content, not pull metadata."),
  forbidden("database_cell_values", "Database row values must not be accepted by the disabled pull route."),
  forbidden("comment_body", "Comments may contain private discussion and must not be logged or echoed."),
  forbidden("file_bytes", "Files must stay in private storage flows, not pull metadata."),
  forbidden("signed_download_url", "Signed file URLs must not pass through pull request metadata."),
  forbidden("token", "Tokens must never be included in sync pull requests."),
  forbidden("cookie", "Cookies must never be included in sync pull requests."),
  forbidden("password", "Passwords must never be included in sync pull requests."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
  forbidden("local_file_path", "Local paths can disclose private folder names."),
  forbidden("apply_now", "Pull routes must not trigger local apply."),
  forbidden("accept_remote", "Accepting remote rows requires side-by-side review."),
  forbidden("overwrite_local", "Broad local overwrite flags require a dedicated reviewed runner."),
  forbidden("mark_acknowledged", "Acknowledgement must only happen after durable staging/apply rules."),
  forbidden("delete_local", "Local deletes require explicit conflict and permission handling."),
  forbidden("cursor_override", "Cursor override requires a reviewed recovery workflow."),
];

const SYNC_PULL_ALLOWED_RESPONSE_FIELDS: SyncPullApiField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled sync pull API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-review, or staged."),
  allowed("pull_receipt_id", "Future server-generated receipt id only after pull is enabled."),
  allowed("stage_receipt_id", "Future staging receipt id for side-by-side review."),
  allowed("remote_cursor", "Future cursor after staged remote baseline."),
  allowed("staged_counts", "Future count-only staged rows summary."),
  allowed("required_gates", "Gate ids that block sync pull."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const SYNC_PULL_FORBIDDEN_RESPONSE_FIELDS: SyncPullApiField[] = [
  forbidden("remote_rows", "Pull responses must not return full remote rows before staging contract exists."),
  forbidden("remote_rows_payload", "Pull responses must not echo remote row payloads."),
  forbidden("page_body_text", "Pull responses must never return page text."),
  forbidden("database_cell_values", "Pull responses must never return database values."),
  forbidden("comment_body", "Pull responses must never return comment bodies."),
  forbidden("file_bytes", "Pull responses must never return file bytes."),
  forbidden("signed_download_url", "Pull responses must never return signed URLs."),
  forbidden("raw_response_body", "Pull responses must never return raw remote responses."),
  forbidden("token", "Pull responses must never return tokens."),
  forbidden("cookie", "Pull responses must never return cookies."),
  forbidden("secret_values", "Pull responses must never return secrets."),
];

export function buildSyncPullApiDisabledResponse(): SyncPullApiDisabledResponse {
  return {
    format: "zhinote-sync-pull-api-disabled",
    format_version: 1,
    api_id: "sync-pull",
    path: "/api/sync/pull?cursor=:cursor",
    method: "GET",
    stub_status: "disabled-local-stub",
    can_pull_now: false,
    can_read_cursor_query_now: false,
    can_connect_cloud_now: false,
    can_read_remote_data_now: false,
    can_fetch_remote_baseline_now: false,
    can_stage_remote_rows_now: false,
    can_apply_remote_rows_now: false,
    can_acknowledge_remote_rows_now: false,
    can_write_workspace_data_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not read cursor queries, connect cloud services, fetch remote rows, stage remote baselines, apply remote changes, acknowledge rows, write workspace data, overwrite local data, delete local rows, or return remote payloads.",
    base_stub: buildWebBetaApiStubResponse("sync-pull"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_cursor_query: false,
      connects_cloud_services: false,
      reads_remote_data: false,
      fetches_remote_rows: false,
      fetches_remote_baseline: false,
      stages_remote_rows: false,
      applies_remote_changes: false,
      acknowledges_remote_rows: false,
      writes_workspace_data: false,
      overwrites_local_data: false,
      deletes_local_rows: false,
      uploads_workspace_data: false,
      returns_remote_rows: false,
      returns_page_body_text: false,
      returns_database_row_values: false,
      returns_comment_bodies: false,
      returns_file_bytes: false,
      reads_secret_values: false,
      requires_authenticated_session_before_enablement: true,
      requires_workspace_membership_before_enablement: true,
      requires_cursor_contract_before_enablement: true,
      requires_remote_baseline_staging_before_enablement: true,
      requires_side_by_side_review_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_rollback_snapshot_before_apply: true,
      requires_owner_confirmation_before_apply: true,
    },
    request_schema: {
      schema_status: "planned-query-metadata-only",
      allowed_fields: buildSyncPullRequestFields(),
      forbidden_fields: buildSyncPullForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-stage-receipt-only",
      allowed_fields: buildSyncPullResponseFields(),
      forbidden_fields: buildSyncPullForbiddenResponseFields(),
    },
    local_validator_report: buildSyncPullValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_pull_receipt: false,
      returns_remote_rows: false,
      returns_remote_baseline: false,
      returns_workspace_content: false,
      stages_remote_rows: false,
      writes_workspace_data: false,
      acknowledges_remote_rows: false,
      returns_required_review: true,
    },
    enablement_gates: [
      {
        id: "authenticated-session",
        title: "Authenticated session",
        required_before_enablement:
          "Pull must prove the current actor and device are authenticated before any remote fetch.",
      },
      {
        id: "workspace-membership",
        title: "Workspace membership",
        required_before_enablement:
          "Remote rows must be scoped by workspace membership and RLS before any pull.",
      },
      {
        id: "cursor-contract",
        title: "Cursor contract",
        required_before_enablement:
          "Cursor monotonicity, expiry, replay behavior, and recovery must be defined before fetch.",
      },
      {
        id: "remote-baseline-staging",
        title: "Remote baseline staging",
        required_before_enablement:
          "Fetched metadata must stage into a review store, not write directly to local workspace tables.",
      },
      {
        id: "side-by-side-review",
        title: "Side-by-side review",
        required_before_enablement:
          "Remote changes that touch content surfaces must appear in side-by-side review before apply.",
      },
      {
        id: "permission-check",
        title: "Permission check",
        required_before_enablement:
          "Pull must pass server permission checks before reading workspace-scoped remote metadata.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Remote baseline fetch and staging must link to metadata-only audit events.",
      },
      {
        id: "rollback-snapshot",
        title: "Rollback snapshot",
        required_before_enablement:
          "Applying staged remote rows requires a local rollback snapshot first.",
      },
      {
        id: "owner-confirmation",
        title: "Owner confirmation",
        required_before_enablement:
          "Applying remote conflict decisions needs visible confirmation for high-risk surfaces.",
      },
    ],
  };
}

export function buildSyncPullRequestFields(): SyncPullApiField[] {
  return SYNC_PULL_ALLOWED_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPullForbiddenFields(): SyncPullApiField[] {
  return SYNC_PULL_FORBIDDEN_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPullResponseFields(): SyncPullApiField[] {
  return SYNC_PULL_ALLOWED_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPullForbiddenResponseFields(): SyncPullApiField[] {
  return SYNC_PULL_FORBIDDEN_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPullValidatorReport(): SyncPullApiValidatorReport {
  const fixtures: SyncPullApiValidatorFixture[] = [
    {
      id: "metadata-sync-pull-request",
      expected_status: "accepted",
      actual_status: "accepted",
      contains_forbidden_payload: false,
      forbidden_field_names: [],
      reason:
        "Contains only metadata needed to describe a future remote baseline pull request.",
    },
    {
      id: "remote-payload-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["remote_rows_payload", "raw_response_body"],
      reason:
        "Remote payloads and retained raw responses are blocked from the disabled pull API.",
    },
    {
      id: "workspace-content-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "page_body_text",
        "block_text",
        "database_cell_values",
        "comment_body",
      ],
      reason:
        "Workspace content fields must stay out of pull API requests and disabled responses.",
    },
    {
      id: "file-url-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["file_bytes", "signed_download_url", "local_file_path"],
      reason:
        "File bytes, signed URLs, and local paths must stay in private file/storage flows.",
    },
    {
      id: "credential-fields-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["token", "cookie", "password", "secret_values"],
      reason:
        "Credential and secret fields are rejected from sync pull requests.",
    },
    {
      id: "apply-ack-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "apply_now",
        "accept_remote",
        "overwrite_local",
        "mark_acknowledged",
        "delete_local",
        "cursor_override",
      ],
      reason:
        "Pull requests cannot apply remote rows, accept conflicts, overwrite local data, acknowledge rows, delete local rows, or override cursors.",
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
    format: "zhinote-sync-pull-api-validator-fixtures",
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

function allowed(field: string, reason: string): SyncPullApiField {
  return {
    field,
    status: "allowed",
    reason,
  };
}

function forbidden(field: string, reason: string): SyncPullApiField {
  return {
    field,
    status: "forbidden",
    reason,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
