export type KnowledgeReplayBatchValidationStatus = "accepted" | "rejected";
export type KnowledgeReplayBatchIssueCode =
  | "missing-required-field"
  | "forbidden-field"
  | "unknown-field"
  | "invalid-type"
  | "invalid-value";

export interface KnowledgeReplayBatchValidationIssue {
  field: string;
  reason_code: KnowledgeReplayBatchIssueCode;
  reason: string;
}

export interface KnowledgeReplayBatchValidationResult {
  format: "zhinote-knowledge-replay-batch-validation";
  format_version: 1;
  validator_status: "metadata-only-local-validator";
  validation_status: KnowledgeReplayBatchValidationStatus;
  safe_to_execute_replay_now: false;
  can_connect_cloud_now: false;
  can_upload_workspace_data_now: false;
  can_write_server_data_now: false;
  can_acknowledge_rows_now: false;
  boundary: {
    validates_shape_only: true;
    returns_raw_values: false;
    reads_comment_bodies: false;
    reads_block_comment_bodies: false;
    reads_version_snapshots: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    enables_sync: false;
    enables_ai: false;
  };
  summary: {
    allowed_fields: number;
    required_fields: number;
    optional_fields: number;
    forbidden_fields: number;
    accepted_fields: number;
    issue_count: number;
  };
  accepted_field_names: string[];
  missing_required_field_names: string[];
  forbidden_field_names: string[];
  unknown_field_names: string[];
  invalid_field_names: string[];
  issues: KnowledgeReplayBatchValidationIssue[];
}

export interface KnowledgeReplayBatchValidatorFixture {
  id: string;
  expected_status: KnowledgeReplayBatchValidationStatus;
  actual_status: KnowledgeReplayBatchValidationStatus;
  reason: string;
  forbidden_field_names: string[];
  issue_count: number;
}

export interface KnowledgeReplayBatchValidatorReport {
  format: "zhinote-knowledge-replay-batch-validator-report";
  format_version: 1;
  report_status: "local-fixture-report-only";
  validator_status: "metadata-only-local-validator";
  replay_can_execute_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: KnowledgeReplayBatchValidationResult["boundary"];
  summary: {
    fixtures: number;
    accepted: number;
    rejected: number;
    forbidden_fields_covered: number;
    allowed_fields: number;
    required_fields: number;
    optional_fields: number;
    forbidden_fields: number;
  };
  fixtures: KnowledgeReplayBatchValidatorFixture[];
}

const REQUIRED_FIELDS = [
  "workspace_id",
  "device_id",
  "batch_id",
  "rows",
  "owner_confirmation_receipt_id",
  "permission_decision_id",
  "audit_event_envelope_id",
  "created_at",
] as const;

const OPTIONAL_FIELDS = ["local_manifest_watermark", "receipt_status"] as const;

const ALLOWED_ROW_FIELDS = [
  "sync_log_id",
  "table_name",
  "row_id",
  "operation",
  "changed_field_names",
  "queued_at",
  "status",
  "attempt_count",
  "idempotency_key",
] as const;

const ALLOWED_TABLE_NAMES = [
  "page_comments",
  "block_comments",
  "page_versions",
  "wiki_links",
] as const;

const FORBIDDEN_FIELDS = [
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
] as const;

const TEXT_MAX_LENGTH = 240;
const ROW_ID_MAX_LENGTH = 160;
const IDEMPOTENCY_KEY_MAX_LENGTH = 220;
const MAX_ROWS_PER_BATCH = 500;

export function validateKnowledgeReplayBatchRequest(
  value: unknown
): KnowledgeReplayBatchValidationResult {
  const allowedFields = buildAllowedFieldNames();
  const requiredFields = [...REQUIRED_FIELDS];
  const optionalFields = [...OPTIONAL_FIELDS];
  const forbiddenFields = [...FORBIDDEN_FIELDS];
  const issues: KnowledgeReplayBatchValidationIssue[] = [];

  if (!isPlainRecord(value)) {
    issues.push({
      field: "$root",
      reason_code: "invalid-type",
      reason: "Request must be a plain metadata object.",
    });
    return buildValidationResult({
      allowedFields,
      requiredFields,
      optionalFields,
      forbiddenFields,
      acceptedFieldNames: [],
      issues,
    });
  }

  for (const field of requiredFields) {
    if (!(field in value)) {
      issues.push({
        field,
        reason_code: "missing-required-field",
        reason: "Required metadata field is missing.",
      });
    }
  }

  for (const field of findForbiddenFieldsRecursively(value, forbiddenFields)) {
    issues.push({
      field,
      reason_code: "forbidden-field",
      reason:
        "Forbidden content, credential, mutation, raw payload, or ACK field is not allowed in knowledge replay batch requests.",
    });
  }

	  for (const key of Object.keys(value)) {
	    if ((forbiddenFields as string[]).includes(key)) continue;
	    if (!allowedFieldsAsStrings(allowedFields).includes(key)) {
      issues.push({
        field: key,
        reason_code: "unknown-field",
        reason: "Unknown fields are rejected so private payloads cannot ride along.",
      });
      continue;
    }
    issues.push(...validateAllowedField(key, value[key]));
  }

  return buildValidationResult({
    allowedFields,
    requiredFields,
    optionalFields,
    forbiddenFields,
	    acceptedFieldNames: Object.keys(value).filter(
	      (key) =>
	        allowedFieldsAsStrings(allowedFields).includes(key) &&
	        !issues.some((issue) => issue.field === key)
	    ),
    issues,
  });
}

export function buildKnowledgeReplayBatchValidatorReport(): KnowledgeReplayBatchValidatorReport {
  const fixtures = buildValidatorFixtures();
  const accepted = fixtures.filter(
    (fixture) => fixture.actual_status === "accepted"
  ).length;
  const rejected = fixtures.filter(
    (fixture) => fixture.actual_status === "rejected"
  ).length;
  const coveredForbiddenFields = unique(
    fixtures.flatMap((fixture) => fixture.forbidden_field_names)
  );

  return {
    format: "zhinote-knowledge-replay-batch-validator-report",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "metadata-only-local-validator",
    replay_can_execute_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "This report validates synthetic row-id-only knowledge replay batch request shapes. It returns field names and issue codes only; it does not return raw values, read comment bodies, block comment bodies, version snapshots, page bodies, database rows, file names, file bytes, secrets, tokens, cloud data, or credentials. It does not send network requests, connect cloud services, write server data, upload workspace data, mutate sync_log, enable sync, or enable AI.",
    boundary: buildBoundary(),
    summary: {
      fixtures: fixtures.length,
      accepted,
      rejected,
      forbidden_fields_covered: coveredForbiddenFields.length,
      allowed_fields: buildAllowedFieldNames().length,
      required_fields: REQUIRED_FIELDS.length,
      optional_fields: OPTIONAL_FIELDS.length,
      forbidden_fields: FORBIDDEN_FIELDS.length,
    },
    fixtures,
  };
}

function buildValidatorFixtures(): KnowledgeReplayBatchValidatorFixture[] {
  const cases: Array<{
    id: string;
    expected_status: KnowledgeReplayBatchValidationStatus;
    value: unknown;
    reason: string;
  }> = [
    {
      id: "row-id-only-batch-accepted",
      expected_status: "accepted",
      value: buildAcceptedRequest(),
      reason:
        "Only workspace/device ids, batch id, row ids, changed field names, idempotency keys, confirmation ids, permission id, audit id, and timestamp are present.",
    },
    {
      id: "comment-and-version-content-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedRequest(),
        rows: [
          {
            ...buildAcceptedRow(),
            comment_body: "synthetic private comment",
            version_snapshot: "synthetic private snapshot",
            content_yjs: "synthetic yjs",
          },
        ],
      },
      reason:
        "Comment bodies, version snapshots, and editor state cannot enter the row-id-only batch.",
    },
    {
      id: "page-database-file-payloads-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedRequest(),
        page_body_text: "synthetic page body",
        database_row_values: { rating: "synthetic" },
        file_name: "model.xlsx",
        file_bytes: "base64",
      },
      reason:
        "Page bodies, database values, file names, and file bytes are outside the metadata batch boundary.",
    },
    {
      id: "ack-and-credential-fields-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedRequest(),
        force_acknowledge: true,
        mark_synced: true,
        token: "synthetic-token",
        cookie: "synthetic-cookie",
        secret_values: "synthetic-secret",
      },
      reason:
        "Client ACK mutation and credential fields are forbidden before durable remote receipt and manifest counts.",
    },
    {
      id: "invalid-row-shape-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedRequest(),
        rows: [
          {
            ...buildAcceptedRow(),
            table_name: "pages",
            sync_log_id: "not-a-number",
            idempotency_key: "",
          },
        ],
      },
      reason:
        "Rows must be explicit knowledge tables with numeric sync_log ids and non-empty idempotency keys.",
    },
  ];

  return cases.map((fixture) => {
    const result = validateKnowledgeReplayBatchRequest(fixture.value);
    return {
      id: fixture.id,
      expected_status: fixture.expected_status,
      actual_status: result.validation_status,
      reason: fixture.reason,
      forbidden_field_names: result.forbidden_field_names,
      issue_count: result.summary.issue_count,
    };
  });
}

function validateAllowedField(
  key: string,
  value: unknown
): KnowledgeReplayBatchValidationIssue[] {
  switch (key) {
    case "workspace_id":
    case "device_id":
    case "batch_id":
    case "owner_confirmation_receipt_id":
    case "permission_decision_id":
    case "audit_event_envelope_id":
    case "local_manifest_watermark":
    case "receipt_status":
    case "created_at":
      return validateTextField(key, value, TEXT_MAX_LENGTH);
    case "rows":
      return validateRows(value);
    default:
      return [];
  }
}

function validateRows(value: unknown): KnowledgeReplayBatchValidationIssue[] {
  const issues: KnowledgeReplayBatchValidationIssue[] = [];
  if (!Array.isArray(value)) {
    return [
      {
        field: "rows",
        reason_code: "invalid-type",
        reason: "rows must be an array of row-id-only metadata records.",
      },
    ];
  }
  if (value.length === 0 || value.length > MAX_ROWS_PER_BATCH) {
    issues.push({
      field: "rows",
      reason_code: "invalid-value",
      reason: `rows must include 1-${MAX_ROWS_PER_BATCH} metadata records.`,
    });
  }

  value.forEach((row, index) => {
    const prefix = `rows.${index}`;
    if (!isPlainRecord(row)) {
      issues.push({
        field: prefix,
        reason_code: "invalid-type",
        reason: "Each row must be a plain metadata object.",
      });
      return;
    }

    for (const field of ALLOWED_ROW_FIELDS) {
      if (!(field in row)) {
        issues.push({
          field: `${prefix}.${field}`,
          reason_code: "missing-required-field",
          reason: "Required row metadata field is missing.",
        });
      }
    }
    for (const key of Object.keys(row)) {
      if (!(ALLOWED_ROW_FIELDS as readonly string[]).includes(key)) {
        issues.push({
          field: `${prefix}.${key}`,
          reason_code: (FORBIDDEN_FIELDS as readonly string[]).includes(key)
            ? "forbidden-field"
            : "unknown-field",
          reason:
            "Rows may contain only sync_log id, table name, row id, operation, changed field names, status, attempt count, queued time, and idempotency key.",
        });
      }
    }

    issues.push(...validateRowValue(prefix, row));
  });

  return issues;
}

function validateRowValue(
  prefix: string,
  row: Record<string, unknown>
): KnowledgeReplayBatchValidationIssue[] {
  const issues: KnowledgeReplayBatchValidationIssue[] = [];
  if (!isPositiveInteger(row.sync_log_id)) {
    issues.push(invalid(prefix, "sync_log_id", "sync_log_id must be a positive integer."));
  }
  if (
    typeof row.table_name !== "string" ||
    !(ALLOWED_TABLE_NAMES as readonly string[]).includes(row.table_name)
  ) {
    issues.push(
      invalid(prefix, "table_name", "table_name must be a knowledge replay table.")
    );
  }
  if (!isBoundedText(row.row_id, ROW_ID_MAX_LENGTH)) {
    issues.push(invalid(prefix, "row_id", "row_id must be a bounded string."));
  }
  if (!isBoundedText(row.operation, TEXT_MAX_LENGTH)) {
    issues.push(invalid(prefix, "operation", "operation must be a bounded string."));
  }
  if (!Array.isArray(row.changed_field_names)) {
    issues.push(
      invalid(
        prefix,
        "changed_field_names",
        "changed_field_names must be an array of field names."
      )
    );
  } else {
    row.changed_field_names.forEach((field, index) => {
      if (!isBoundedText(field, TEXT_MAX_LENGTH)) {
        issues.push(
          invalid(
            prefix,
            `changed_field_names.${index}`,
            "changed field names must be bounded strings."
          )
        );
      }
    });
  }
  if (!isBoundedText(row.queued_at, TEXT_MAX_LENGTH)) {
    issues.push(invalid(prefix, "queued_at", "queued_at must be a bounded string."));
  }
  if (!isBoundedText(row.status, TEXT_MAX_LENGTH)) {
    issues.push(invalid(prefix, "status", "status must be a bounded string."));
  }
  if (!isNonNegativeInteger(row.attempt_count)) {
    issues.push(
      invalid(prefix, "attempt_count", "attempt_count must be a non-negative integer.")
    );
  }
  if (!isBoundedText(row.idempotency_key, IDEMPOTENCY_KEY_MAX_LENGTH)) {
    issues.push(
      invalid(
        prefix,
        "idempotency_key",
        "idempotency_key must be a bounded non-empty string."
      )
    );
  }
  return issues;
}

function buildValidationResult(input: {
  allowedFields: string[];
  requiredFields: string[];
  optionalFields: string[];
  forbiddenFields: string[];
  acceptedFieldNames: string[];
  issues: KnowledgeReplayBatchValidationIssue[];
}): KnowledgeReplayBatchValidationResult {
  const missingRequiredFieldNames = unique(
    input.issues
      .filter((issue) => issue.reason_code === "missing-required-field")
      .map((issue) => issue.field)
  );
  const forbiddenFieldNames = unique(
    input.issues
      .filter((issue) => issue.reason_code === "forbidden-field")
      .map((issue) => issue.field.split(".").pop() ?? issue.field)
  );
  const unknownFieldNames = unique(
    input.issues
      .filter((issue) => issue.reason_code === "unknown-field")
      .map((issue) => issue.field)
  );
  const invalidFieldNames = unique(
    input.issues
      .filter((issue) => issue.reason_code === "invalid-type" || issue.reason_code === "invalid-value")
      .map((issue) => issue.field)
  );

  return {
    format: "zhinote-knowledge-replay-batch-validation",
    format_version: 1,
    validator_status: "metadata-only-local-validator",
    validation_status: input.issues.length === 0 ? "accepted" : "rejected",
    safe_to_execute_replay_now: false,
    can_connect_cloud_now: false,
    can_upload_workspace_data_now: false,
    can_write_server_data_now: false,
    can_acknowledge_rows_now: false,
    boundary: buildBoundary(),
    summary: {
      allowed_fields: input.allowedFields.length,
      required_fields: input.requiredFields.length,
      optional_fields: input.optionalFields.length,
      forbidden_fields: input.forbiddenFields.length,
      accepted_fields: input.acceptedFieldNames.length,
      issue_count: input.issues.length,
    },
    accepted_field_names: input.acceptedFieldNames,
    missing_required_field_names: missingRequiredFieldNames,
    forbidden_field_names: forbiddenFieldNames,
    unknown_field_names: unknownFieldNames,
    invalid_field_names: invalidFieldNames,
    issues: input.issues,
  };
}

function buildAllowedFieldNames() {
  return [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
}

function allowedFieldsAsStrings(fields: ReturnType<typeof buildAllowedFieldNames>) {
  return fields as readonly string[];
}

function buildBoundary(): KnowledgeReplayBatchValidationResult["boundary"] {
  return {
    validates_shape_only: true,
    returns_raw_values: false,
    reads_comment_bodies: false,
    reads_block_comment_bodies: false,
    reads_version_snapshots: false,
    reads_page_body_text: false,
    reads_database_row_values: false,
    reads_file_names: false,
    reads_file_bytes: false,
    reads_secret_values: false,
    sends_network_requests: false,
    connects_cloud_services: false,
    writes_server_data: false,
    uploads_workspace_data: false,
    mutates_local_sync_log: false,
    enables_sync: false,
    enables_ai: false,
  };
}

function buildAcceptedRequest() {
  return {
    workspace_id: "workspace-local-demo",
    device_id: "device-local-demo",
    batch_id: "knowledge-replay-local-demo",
    rows: [buildAcceptedRow()],
    owner_confirmation_receipt_id: "owner-confirmation-demo",
    permission_decision_id: "permission-decision-demo",
    audit_event_envelope_id: "audit-event-demo",
    local_manifest_watermark: "2026-06-30T00:00:00.000Z",
    created_at: "2026-06-30T00:00:00.000Z",
  };
}

function buildAcceptedRow() {
  return {
    sync_log_id: 1,
    table_name: "page_comments",
    row_id: "comment-local-demo",
    operation: "update",
    changed_field_names: ["resolved", "updated_at"],
    queued_at: "2026-06-30T00:00:00.000Z",
    status: "pending",
    attempt_count: 0,
    idempotency_key:
      "knowledge-replay:v1:page_comments:comment-local-demo:update:2026-06-30T00:00:00.000Z:1",
  };
}

function validateTextField(
  field: string,
  value: unknown,
  maxLength: number
): KnowledgeReplayBatchValidationIssue[] {
  if (!isBoundedText(value, maxLength)) {
    return [
      {
        field,
        reason_code: "invalid-type",
        reason: "Metadata field must be a bounded non-empty string.",
      },
    ];
  }
  return [];
}

function invalid(
  prefix: string,
  field: string,
  reason: string
): KnowledgeReplayBatchValidationIssue {
  return {
    field: `${prefix}.${field}`,
    reason_code: "invalid-value",
    reason,
  };
}

function findForbiddenFieldsRecursively(
  value: unknown,
  forbiddenFields: readonly string[],
  path: string[] = []
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenFieldsRecursively(item, forbiddenFields, [...path, String(index)])
    );
  }
  if (!isPlainRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const nextPath = [...path, key];
    const self = forbiddenFields.includes(key) ? [nextPath.join(".")] : [];
    return [
      ...self,
      ...findForbiddenFieldsRecursively(child, forbiddenFields, nextPath),
    ];
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isBoundedText(value: unknown, maxLength: number) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}
