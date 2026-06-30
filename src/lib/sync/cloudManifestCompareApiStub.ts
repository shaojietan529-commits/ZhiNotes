import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";
import {
  buildCloudManifestDomainContractReport,
  type CloudManifestDomainContractReport,
} from "@/lib/sync/cloudManifestDomainContract";

export type CloudManifestCompareFieldStatus = "allowed" | "forbidden";
export type CloudManifestCompareValidationStatus = "accepted" | "rejected";

export interface CloudManifestCompareField {
  field: string;
  status: CloudManifestCompareFieldStatus;
  reason: string;
}

export interface CloudManifestCompareValidatorFixture {
  id: string;
  expected_status: CloudManifestCompareValidationStatus;
  actual_status: CloudManifestCompareValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface CloudManifestCompareValidatorReport {
  format: "zhinote-cloud-manifest-compare-api-validator-fixtures";
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
  fixtures: CloudManifestCompareValidatorFixture[];
}

export interface CloudManifestCompareApiDisabledResponse {
  format: "zhinote-cloud-manifest-compare-api-disabled";
  format_version: 1;
  api_id: "cloud-manifest-compare";
  path: "/api/cloud/manifest/compare?workspaceId=:workspaceId";
  method: "GET";
  stub_status: "disabled-local-stub";
  can_compare_manifest_now: false;
  can_read_query_now: false;
  can_connect_cloud_now: false;
  can_read_remote_manifest_now: false;
  can_read_workspace_content_now: false;
  can_write_server_data_now: false;
  can_upload_workspace_data_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_query: false;
    connects_cloud_services: false;
    reads_remote_manifest: false;
    reads_workspace_content: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    writes_server_data: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    deletes_local_rows: false;
    overwrites_local_cache: false;
    returns_manifest_counts: false;
    returns_missing_ids: false;
    returns_workspace_content: false;
    requires_authenticated_session_before_enablement: true;
    requires_workspace_membership_before_enablement: true;
    requires_metadata_only_manifest_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_rate_limit_before_enablement: true;
    requires_owner_review_before_migration: true;
  };
  request_schema: {
    schema_status: "planned-query-metadata-only";
    allowed_fields: CloudManifestCompareField[];
    forbidden_fields: CloudManifestCompareField[];
  };
  response_schema: {
    schema_status: "planned-manifest-summary-only";
    allowed_fields: CloudManifestCompareField[];
    forbidden_fields: CloudManifestCompareField[];
  };
  local_validator_report: CloudManifestCompareValidatorReport;
  domain_contract_report: CloudManifestDomainContractReport;
  disabled_response_contract: {
    http_status: 501;
    returns_manifest_report: false;
    returns_missing_ids: false;
    returns_page_body_text: false;
    returns_database_row_values: false;
    returns_comment_bodies: false;
    returns_file_bytes: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    returns_required_review: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const CLOUD_MANIFEST_ALLOWED_REQUEST_FIELDS: CloudManifestCompareField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated actor id for audit metadata."),
  allowed("device_id", "Registered local device id for cache provenance."),
  allowed("domain_ids", "Requested metadata domains such as pages, databases, files, comments, versions, and settings."),
  allowed("local_manifest_report_id", "Opaque local reconcile report id, not the report payload."),
  allowed("local_watermark", "Local metadata watermark for incremental compare."),
  allowed("remote_watermark", "Optional last known remote metadata watermark."),
  allowed("include_missing_ids", "Future boolean for id-only gaps after owner review."),
  allowed("permission_decision_id", "Server permission decision reference."),
  allowed("audit_event_envelope_id", "Metadata-only audit envelope reference."),
  allowed("idempotency_key", "Prevents duplicate compare jobs after retries."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const CLOUD_MANIFEST_FORBIDDEN_REQUEST_FIELDS: CloudManifestCompareField[] = [
  forbidden("page_body_text", "Manifest compare must not accept page body text."),
  forbidden("block_text", "Block text is content, not metadata."),
  forbidden("database_cell_values", "Database values must not be included in compare requests."),
  forbidden("comment_body", "Comments may contain private discussion and must not be posted."),
  forbidden("version_snapshot", "Version snapshots are content, not manifest metadata."),
  forbidden("file_bytes", "Files must stay in private storage flows."),
  forbidden("backup_payload", "Backups must not pass through manifest compare."),
  forbidden("raw_local_manifest", "Raw local reports may include sensitive identifiers and need reviewed export."),
  forbidden("raw_remote_manifest", "Raw remote manifests must not be accepted from clients."),
  forbidden("signed_upload_url", "Signed upload URLs are forbidden."),
  forbidden("signed_download_url", "Signed download URLs are forbidden."),
  forbidden("local_file_path", "Local paths can reveal private folder names."),
  forbidden("token", "Tokens must never be included in manifest compare requests."),
  forbidden("cookie", "Cookies must never be included in manifest compare requests."),
  forbidden("password", "Passwords must never be included."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
  forbidden("apply_migration", "Manifest compare cannot apply migrations."),
  forbidden("overwrite_cloud", "Compare cannot promote local cache to cloud."),
  forbidden("overwrite_local", "Compare cannot overwrite local cache."),
  forbidden("delete_remote", "Compare cannot delete cloud rows."),
  forbidden("delete_local", "Compare cannot delete local rows."),
];

const CLOUD_MANIFEST_ALLOWED_RESPONSE_FIELDS: CloudManifestCompareField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled cloud manifest compare API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-review, or compared."),
  allowed("compare_receipt_id", "Future receipt id after server compare is enabled."),
  allowed("domain_summaries", "Future count-only summaries by data domain."),
  allowed("local_watermark", "Future local metadata watermark echo."),
  allowed("remote_watermark", "Future remote metadata watermark."),
  allowed("domain_contract_report", "Local metadata-only domain contract for future cloud/local compare."),
  allowed("required_gates", "Gate ids that block manifest compare."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const CLOUD_MANIFEST_FORBIDDEN_RESPONSE_FIELDS: CloudManifestCompareField[] = [
  forbidden("page_body_text", "Manifest compare responses must never return page text."),
  forbidden("block_text", "Manifest compare responses must never return block text."),
  forbidden("database_cell_values", "Manifest compare responses must never return database values."),
  forbidden("comment_body", "Manifest compare responses must never return comment bodies."),
  forbidden("version_snapshot", "Manifest compare responses must never return version snapshots."),
  forbidden("file_bytes", "Manifest compare responses must never return file bytes."),
  forbidden("backup_payload", "Manifest compare responses must never return backup payloads."),
  forbidden("signed_upload_url", "Manifest compare responses must never return signed upload URLs."),
  forbidden("signed_download_url", "Manifest compare responses must never return signed download URLs."),
  forbidden("token", "Manifest compare responses must never return tokens."),
  forbidden("cookie", "Manifest compare responses must never return cookies."),
  forbidden("secret_values", "Manifest compare responses must never return secrets."),
];

export function buildCloudManifestCompareApiDisabledResponse(): CloudManifestCompareApiDisabledResponse {
  return {
    format: "zhinote-cloud-manifest-compare-api-disabled",
    format_version: 1,
    api_id: "cloud-manifest-compare",
    path: "/api/cloud/manifest/compare?workspaceId=:workspaceId",
    method: "GET",
    stub_status: "disabled-local-stub",
    can_compare_manifest_now: false,
    can_read_query_now: false,
    can_connect_cloud_now: false,
    can_read_remote_manifest_now: false,
    can_read_workspace_content_now: false,
    can_write_server_data_now: false,
    can_upload_workspace_data_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not read query values, connect cloud services, read remote manifests, read workspace content, write server data, upload workspace data, overwrite local cache, delete rows, or return private content.",
    base_stub: buildWebBetaApiStubResponse("cloud-manifest-compare"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_query: false,
      connects_cloud_services: false,
      reads_remote_manifest: false,
      reads_workspace_content: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      writes_server_data: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      deletes_local_rows: false,
      overwrites_local_cache: false,
      returns_manifest_counts: false,
      returns_missing_ids: false,
      returns_workspace_content: false,
      requires_authenticated_session_before_enablement: true,
      requires_workspace_membership_before_enablement: true,
      requires_metadata_only_manifest_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_rate_limit_before_enablement: true,
      requires_owner_review_before_migration: true,
    },
    request_schema: {
      schema_status: "planned-query-metadata-only",
      allowed_fields: buildCloudManifestCompareRequestFields(),
      forbidden_fields: buildCloudManifestCompareForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-manifest-summary-only",
      allowed_fields: buildCloudManifestCompareResponseFields(),
      forbidden_fields: buildCloudManifestCompareForbiddenResponseFields(),
    },
    local_validator_report: buildCloudManifestCompareValidatorReport(),
    domain_contract_report: buildCloudManifestDomainContractReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_manifest_report: false,
      returns_missing_ids: false,
      returns_page_body_text: false,
      returns_database_row_values: false,
      returns_comment_bodies: false,
      returns_file_bytes: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      returns_required_review: true,
    },
    enablement_gates: [
      {
        id: "authenticated-session",
        title: "Authenticated session",
        required_before_enablement:
          "Manifest compare needs a server-authenticated actor and device session before it can read cloud metadata.",
      },
      {
        id: "workspace-membership",
        title: "Workspace membership",
        required_before_enablement:
          "The server must prove workspace membership and role before returning cloud metadata.",
      },
      {
        id: "metadata-only-manifest",
        title: "Metadata-only manifest",
        required_before_enablement:
          "Cloud manifest responses must expose counts, hashes, watermarks, and optional ids only; never bodies or file bytes.",
      },
      {
        id: "permission-check",
        title: "Permission check",
        required_before_enablement:
          "The manifest compare route must call the server permission check before returning any workspace-scoped result.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Each compare run must create a metadata-only audit event linked to the actor, workspace, and domain list.",
      },
      {
        id: "rate-limit",
        title: "Rate limit",
        required_before_enablement:
          "Manifest compare must be rate-limited because it can reveal workspace inventory even without content.",
      },
      {
        id: "owner-review",
        title: "Owner review",
        required_before_enablement:
          "Missing/extra id reports must be reviewed before any migration, overwrite, or cache rebuild action.",
      },
    ],
  };
}

export function buildCloudManifestCompareRequestFields(): CloudManifestCompareField[] {
  return CLOUD_MANIFEST_ALLOWED_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildCloudManifestCompareForbiddenFields(): CloudManifestCompareField[] {
  return CLOUD_MANIFEST_FORBIDDEN_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildCloudManifestCompareResponseFields(): CloudManifestCompareField[] {
  return CLOUD_MANIFEST_ALLOWED_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildCloudManifestCompareForbiddenResponseFields(): CloudManifestCompareField[] {
  return CLOUD_MANIFEST_FORBIDDEN_RESPONSE_FIELDS.map((field) => ({
    ...field,
  }));
}

export function buildCloudManifestCompareValidatorReport(): CloudManifestCompareValidatorReport {
  const fixtures: CloudManifestCompareValidatorFixture[] = [
    {
      id: "metadata-manifest-compare-request",
      expected_status: "accepted",
      actual_status: "accepted",
      contains_forbidden_payload: false,
      forbidden_field_names: [],
      reason:
        "Contains only workspace, actor, domain ids, watermarks, and receipt ids needed for a future metadata-only compare.",
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
        "version_snapshot",
      ],
      reason:
        "Manifest compare must not accept page text, blocks, database values, comments, or version snapshots.",
    },
    {
      id: "file-and-backup-payload-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "file_bytes",
        "backup_payload",
        "signed_upload_url",
        "signed_download_url",
        "local_file_path",
      ],
      reason:
        "Files, backups, signed URLs, and local paths do not belong in manifest compare payloads.",
    },
    {
      id: "credential-fields-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["token", "cookie", "password", "secret_values"],
      reason:
        "Credentials and secret values are rejected from manifest compare requests and responses.",
    },
    {
      id: "write-and-delete-actions-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "apply_migration",
        "overwrite_cloud",
        "overwrite_local",
        "delete_remote",
        "delete_local",
      ],
      reason:
        "Manifest compare is read-only; migration, overwrite, and delete commands are blocked.",
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
    format: "zhinote-cloud-manifest-compare-api-validator-fixtures",
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

function allowed(field: string, reason: string): CloudManifestCompareField {
  return {
    field,
    status: "allowed",
    reason,
  };
}

function forbidden(field: string, reason: string): CloudManifestCompareField {
  return {
    field,
    status: "forbidden",
    reason,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
