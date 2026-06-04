import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type FilePresignFieldStatus = "allowed" | "forbidden";
export type FilePresignValidationStatus = "accepted" | "rejected";

export interface FilePresignField {
  field: string;
  status: FilePresignFieldStatus;
  reason: string;
}

export interface FilePresignValidatorFixture {
  id: string;
  expected_status: FilePresignValidationStatus;
  actual_status: FilePresignValidationStatus;
  contains_forbidden_payload: boolean;
  reason: string;
}

export interface FilePresignValidatorReport {
  format: "zhinote-file-presign-validator-fixtures";
  format_version: 1;
  report_status: "local-fixture-report-only";
  validator_status: "not-executing-route";
  summary: {
    fixtures: number;
    accepted: number;
    rejected: number;
    forbidden_payload_rejections: number;
  };
  fixtures: FilePresignValidatorFixture[];
}

export interface FilePresignApiDisabledResponse {
  format: "zhinote-file-presign-api-disabled";
  format_version: 1;
  api_id: "file-presign";
  path: "/api/files/presign";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_create_signed_urls_now: false;
  can_create_signed_upload_url_now: false;
  can_create_signed_download_url_now: false;
  can_read_request_body_now: false;
  can_read_file_metadata_now: false;
  can_read_file_bytes_now: false;
  can_upload_files_now: false;
  can_expose_public_urls_now: false;
  can_connect_storage_now: false;
  can_write_audit_events_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    reads_request_body: false;
    metadata_only_request: true;
    executes_actions: false;
    reads_file_metadata: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_prompt_text: false;
    reads_secret_values: false;
    creates_signed_urls: false;
    creates_public_urls: false;
    connects_storage_service: false;
    uploads_files: false;
    writes_server_audit_log: false;
    uploads_workspace_data: false;
    requires_private_bucket_before_enablement: true;
    requires_authenticated_actor_before_enablement: true;
    requires_workspace_membership_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_checksum_before_enablement: true;
    requires_owner_confirmation_before_enablement: true;
    requires_audit_event_envelope_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-metadata-only";
    allowed_fields: FilePresignField[];
    forbidden_fields: FilePresignField[];
  };
  response_schema: {
    schema_status: "planned-no-url-body";
    allowed_fields: FilePresignField[];
    forbidden_fields: FilePresignField[];
  };
  local_validator_report: FilePresignValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_signed_upload_url: false;
    returns_signed_download_url: false;
    returns_public_url: false;
    returns_storage_credentials: false;
    returns_file_bytes: false;
    returns_required_confirmation: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const FILE_PRESIGN_ALLOWED_REQUEST_FIELDS: FilePresignField[] = [
  allowed("workspace_id", "Cloud workspace id after authenticated membership."),
  allowed("file_id", "Local file id or remote file metadata id."),
  allowed("storage_key", "Server-side storage object key for download requests."),
  allowed("operation", "upload or download intent, never an executable action."),
  allowed("file_kind", "Normalized file kind such as html, pdf, spreadsheet, word, presentation, notebook, archive, or media."),
  allowed("mime_type", "Declared MIME type for validation only."),
  allowed("size_bytes", "File size metadata for upload limit checks."),
  allowed("sha256", "Checksum metadata for upload integrity checks."),
  allowed("requested_ttl_seconds", "Requested signed URL lifetime, capped by policy."),
  allowed("confirmation_receipt_id", "Owner confirmation receipt for first file sync or high-risk upload."),
  allowed("permission_decision_id", "Server permission decision reference before signing."),
  allowed("audit_envelope_id", "Metadata-only audit envelope reference."),
];

const FILE_PRESIGN_FORBIDDEN_FIELDS: FilePresignField[] = [
  forbidden("file_bytes", "File content must never be posted to the presign endpoint."),
  forbidden("data_url", "Browser data URLs can contain full file bytes."),
  forbidden("base64", "Base64 payloads can contain full file bytes."),
  forbidden("signed_upload_url", "Signed URL values must not enter request or audit payloads."),
  forbidden("signed_download_url", "Signed URL values must not enter request or audit payloads."),
  forbidden("public_url", "Public storage URLs are forbidden for private research files."),
  forbidden("file_text", "Converted or extracted file text must stay out of presign metadata."),
  forbidden("page_body_text", "Page text is unrelated to URL signing and must stay out."),
  forbidden("database_cell_values", "Database values must stay out of file signing metadata."),
  forbidden("prompt_text", "AI prompts must stay out of file signing metadata."),
  forbidden("token", "Tokens must never be accepted by the route body."),
  forbidden("cookie", "Cookies must never be accepted by the route body."),
  forbidden("secret", "Secrets must never be accepted by the route body."),
  forbidden("request_body_raw", "Raw request body retention is forbidden."),
];

const FILE_PRESIGN_ALLOWED_RESPONSE_FIELDS: FilePresignField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled file-presign API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, requires-confirmation, or denied."),
  allowed("max_ttl_seconds", "Policy maximum TTL metadata only."),
  allowed("max_upload_size_mb", "Policy maximum size metadata only."),
  allowed("allowed_operations", "Future operation labels without URLs."),
  allowed("required_gates", "Gate ids that block signing."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const FILE_PRESIGN_FORBIDDEN_RESPONSE_FIELDS: FilePresignField[] = [
  forbidden("signed_upload_url", "Disabled and audit responses must not expose upload URLs."),
  forbidden("signed_download_url", "Disabled and audit responses must not expose download URLs."),
  forbidden("public_url", "Public URLs are forbidden for private files."),
  forbidden("storage_credentials", "Storage credentials must never be returned."),
  forbidden("file_bytes", "File bytes must never be returned by presign."),
  forbidden("token", "Tokens must never be returned by presign."),
  forbidden("secret", "Secrets must never be returned by presign."),
];

export function buildFilePresignApiDisabledResponse(): FilePresignApiDisabledResponse {
  return {
    format: "zhinote-file-presign-api-disabled",
    format_version: 1,
    api_id: "file-presign",
    path: "/api/files/presign",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_create_signed_urls_now: false,
    can_create_signed_upload_url_now: false,
    can_create_signed_download_url_now: false,
    can_read_request_body_now: false,
    can_read_file_metadata_now: false,
    can_read_file_bytes_now: false,
    can_upload_files_now: false,
    can_expose_public_urls_now: false,
    can_connect_storage_now: false,
    can_write_audit_events_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not read request bodies, inspect file metadata, read file names, read file bytes, create signed URLs, expose public URLs, connect storage services, write audit logs, upload files, or upload workspace data.",
    base_stub: buildWebBetaApiStubResponse("file-presign"),
    boundary: {
      no_request_argument: true,
      reads_request_body: false,
      metadata_only_request: true,
      executes_actions: false,
      reads_file_metadata: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_prompt_text: false,
      reads_secret_values: false,
      creates_signed_urls: false,
      creates_public_urls: false,
      connects_storage_service: false,
      uploads_files: false,
      writes_server_audit_log: false,
      uploads_workspace_data: false,
      requires_private_bucket_before_enablement: true,
      requires_authenticated_actor_before_enablement: true,
      requires_workspace_membership_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_checksum_before_enablement: true,
      requires_owner_confirmation_before_enablement: true,
      requires_audit_event_envelope_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-metadata-only",
      allowed_fields: buildFilePresignRequestFields(),
      forbidden_fields: buildFilePresignForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-no-url-body",
      allowed_fields: buildFilePresignResponseFields(),
      forbidden_fields: buildFilePresignForbiddenResponseFields(),
    },
    local_validator_report: buildFilePresignValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_signed_upload_url: false,
      returns_signed_download_url: false,
      returns_public_url: false,
      returns_storage_credentials: false,
      returns_file_bytes: false,
      returns_required_confirmation: true,
    },
    enablement_gates: [
      {
        id: "authenticated-workspace-membership",
        title: "Authenticated workspace membership",
        required_before_enablement:
          "Server session and workspace membership must pass before file signing can inspect metadata.",
      },
      {
        id: "private-bucket-policy",
        title: "Private bucket policy",
        required_before_enablement:
          "Supabase Storage bucket must block public listing and scope objects by workspace.",
      },
      {
        id: "checksum-and-size-validation",
        title: "Checksum and size validation",
        required_before_enablement:
          "File metadata must include sha256 and size_bytes before upload URLs can be signed.",
      },
      {
        id: "server-permission-check",
        title: "Server permission check",
        required_before_enablement:
          "The permission-check route must reject forbidden payloads and return server-side decisions.",
      },
      {
        id: "metadata-only-audit-envelope",
        title: "Metadata-only audit envelope",
        required_before_enablement:
          "Every signing decision must link to an audit envelope that excludes signed URLs and file bytes.",
      },
      {
        id: "owner-file-sync-confirmation",
        title: "Owner file sync confirmation",
        required_before_enablement:
          "First cloud file sync must require an explicit owner confirmation receipt.",
      },
    ],
  };
}

export function buildFilePresignRequestFields(): FilePresignField[] {
  return FILE_PRESIGN_ALLOWED_REQUEST_FIELDS;
}

export function buildFilePresignForbiddenFields(): FilePresignField[] {
  return FILE_PRESIGN_FORBIDDEN_FIELDS;
}

export function buildFilePresignResponseFields(): FilePresignField[] {
  return FILE_PRESIGN_ALLOWED_RESPONSE_FIELDS;
}

export function buildFilePresignForbiddenResponseFields(): FilePresignField[] {
  return FILE_PRESIGN_FORBIDDEN_RESPONSE_FIELDS;
}

export function buildFilePresignValidatorReport(): FilePresignValidatorReport {
  const fixtures: FilePresignValidatorFixture[] = [
    fixture(
      "metadata-upload-request",
      "accepted",
      false,
      "Workspace, file id, kind, MIME type, size, checksum, operation, and confirmation metadata are allowed in the future schema."
    ),
    fixture(
      "download-request-with-storage-key",
      "accepted",
      false,
      "Download requests may reference storage_key and permission decision metadata after auth is implemented."
    ),
    fixture(
      "file-bytes-blocked",
      "rejected",
      true,
      "file_bytes and data_url are forbidden because they can contain private report content."
    ),
    fixture(
      "signed-url-blocked",
      "rejected",
      true,
      "signed_upload_url, signed_download_url, and public_url must not appear in request, response, audit, or sync payloads."
    ),
    fixture(
      "secret-token-blocked",
      "rejected",
      true,
      "token, cookie, and secret fields are forbidden in route payloads."
    ),
  ];

  return {
    format: "zhinote-file-presign-validator-fixtures",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "not-executing-route",
    summary: {
      fixtures: fixtures.length,
      accepted: fixtures.filter((item) => item.actual_status === "accepted")
        .length,
      rejected: fixtures.filter((item) => item.actual_status === "rejected")
        .length,
      forbidden_payload_rejections: fixtures.filter(
        (item) => item.contains_forbidden_payload
      ).length,
    },
    fixtures,
  };
}

function allowed(field: string, reason: string): FilePresignField {
  return { field, status: "allowed", reason };
}

function forbidden(field: string, reason: string): FilePresignField {
  return { field, status: "forbidden", reason };
}

function fixture(
  id: string,
  status: FilePresignValidationStatus,
  containsForbiddenPayload: boolean,
  reason: string
): FilePresignValidatorFixture {
  return {
    id,
    expected_status: status,
    actual_status: status,
    contains_forbidden_payload: containsForbiddenPayload,
    reason,
  };
}
