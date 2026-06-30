import {
  buildCloudManifestCompareForbiddenFields,
  buildCloudManifestCompareRequestFields,
} from "@/lib/sync/cloudManifestCompareApiStub";
import { buildCloudManifestDomainContracts } from "@/lib/sync/cloudManifestDomainContract";

export type CloudManifestCompareRequestValidationStatus =
  | "accepted"
  | "rejected";

export interface CloudManifestCompareRequestValidationIssue {
  field: string;
  reason_code:
    | "missing-required-field"
    | "forbidden-field"
    | "unknown-field"
    | "invalid-type"
    | "invalid-value";
  reason: string;
}

export interface CloudManifestCompareRequestValidationResult {
  format: "zhinote-cloud-manifest-compare-request-validation";
  format_version: 1;
  validator_status: "metadata-only-local-validator";
  validation_status: CloudManifestCompareRequestValidationStatus;
  safe_to_execute_cloud_compare_now: false;
  can_connect_cloud_now: false;
  can_read_remote_manifest_now: false;
  can_read_workspace_content_now: false;
  can_write_server_data_now: false;
  can_upload_workspace_data_now: false;
  boundary: {
    validates_shape_only: true;
    returns_raw_values: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
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
  issues: CloudManifestCompareRequestValidationIssue[];
}

export interface CloudManifestCompareRequestValidatorFixture {
  id: string;
  expected_status: CloudManifestCompareRequestValidationStatus;
  actual_status: CloudManifestCompareRequestValidationStatus;
  reason: string;
  forbidden_field_names: string[];
  issue_count: number;
}

export interface CloudManifestCompareRequestValidatorReport {
  format: "zhinote-cloud-manifest-compare-request-validator-report";
  format_version: 1;
  report_status: "local-fixture-report-only";
  validator_status: "metadata-only-local-validator";
  cloud_compare_can_execute_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: CloudManifestCompareRequestValidationResult["boundary"];
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
  fixtures: CloudManifestCompareRequestValidatorFixture[];
}

const REQUIRED_METADATA_FIELDS = [
  "workspace_id",
  "actor_user_id",
  "device_id",
  "domain_ids",
  "local_manifest_report_id",
  "local_watermark",
  "permission_decision_id",
  "audit_event_envelope_id",
  "idempotency_key",
  "created_at",
] as const;

const OPTIONAL_METADATA_FIELDS = ["remote_watermark", "include_missing_ids"] as const;

const TEXT_FIELD_MAX_LENGTH = 240;
const WATERMARK_FIELD_MAX_LENGTH = 160;
const IDEMPOTENCY_KEY_MAX_LENGTH = 160;

export function validateCloudManifestCompareRequest(
  value: unknown
): CloudManifestCompareRequestValidationResult {
  const allowedFields = buildAllowedFieldNames();
  const forbiddenFields = buildForbiddenFieldNames();
  const requiredFields = [...REQUIRED_METADATA_FIELDS];
  const optionalFields = [...OPTIONAL_METADATA_FIELDS];
  const issues: CloudManifestCompareRequestValidationIssue[] = [];

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

  const keys = Object.keys(value);
  for (const field of requiredFields) {
    if (!(field in value)) {
      issues.push({
        field,
        reason_code: "missing-required-field",
        reason: "Required metadata field is missing.",
      });
    }
  }

  const recursivelyForbiddenFields = findForbiddenFieldsRecursively(
    value,
    forbiddenFields
  );
  for (const field of recursivelyForbiddenFields) {
    issues.push({
      field,
      reason_code: "forbidden-field",
      reason:
        "Forbidden content, credential, mutation, or raw manifest field is not allowed in manifest compare requests.",
    });
  }

  for (const key of keys) {
    if (forbiddenFields.includes(key)) continue;
    if (!allowedFields.includes(key)) {
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
    acceptedFieldNames: keys.filter(
      (key) => allowedFields.includes(key) && !issues.some((issue) => issue.field === key)
    ),
    issues,
  });
}

export function buildCloudManifestCompareRequestValidatorReport(): CloudManifestCompareRequestValidatorReport {
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
  const allowedFields = buildAllowedFieldNames();
  const forbiddenFields = buildForbiddenFieldNames();

  return {
    format: "zhinote-cloud-manifest-compare-request-validator-report",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "metadata-only-local-validator",
    cloud_compare_can_execute_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "This report validates synthetic metadata-only manifest compare request shapes. It returns field names and issue codes only; it does not return raw values, read page bodies, database rows, comments, version snapshots, file names, file bytes, secrets, tokens, remote manifests, or cloud data. It does not send network requests, connect cloud services, write server data, upload workspace data, enable sync, or enable AI.",
    boundary: buildBoundary(),
    summary: {
      fixtures: fixtures.length,
      accepted,
      rejected,
      forbidden_fields_covered: coveredForbiddenFields.length,
      allowed_fields: allowedFields.length,
      required_fields: REQUIRED_METADATA_FIELDS.length,
      optional_fields: OPTIONAL_METADATA_FIELDS.length,
      forbidden_fields: forbiddenFields.length,
    },
    fixtures,
  };
}

function buildValidatorFixtures(): CloudManifestCompareRequestValidatorFixture[] {
  const cases: Array<{
    id: string;
    expected_status: CloudManifestCompareRequestValidationStatus;
    value: unknown;
    reason: string;
  }> = [
    {
      id: "metadata-only-request-accepted",
      expected_status: "accepted",
      value: buildAcceptedMetadataRequest(),
      reason:
        "Only workspace, actor, device, domain ids, watermarks, permission/audit ids, idempotency key, and timestamp are present.",
    },
    {
      id: "workspace-content-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataRequest(),
        page_body_text: "redacted synthetic text",
        block_text: "redacted synthetic block",
        database_cell_values: "redacted synthetic values",
        comment_body: "redacted synthetic comment",
        version_snapshot: "redacted synthetic snapshot",
      },
      reason:
        "Page bodies, database values, comments, and version snapshots cannot enter manifest compare requests.",
    },
    {
      id: "file-and-raw-manifest-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataRequest(),
        file_bytes: "redacted synthetic bytes",
        backup_payload: "redacted synthetic backup",
        raw_local_manifest: "redacted synthetic manifest",
        raw_remote_manifest: "redacted synthetic manifest",
        signed_upload_url: "https://example.invalid/redacted-upload",
        signed_download_url: "https://example.invalid/redacted-download",
        local_file_path: "/private/path/redacted",
      },
      reason:
        "File bytes, local paths, and raw manifests are not metadata-only compare fields.",
    },
    {
      id: "credential-fields-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataRequest(),
        token: "redacted synthetic token",
        cookie: "redacted synthetic cookie",
        password: "redacted synthetic password",
        secret_values: "redacted synthetic secret",
      },
      reason: "Credentials and secrets cannot enter compare requests.",
    },
    {
      id: "write-action-fields-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataRequest(),
        apply_migration: true,
        overwrite_cloud: true,
        overwrite_local: true,
        delete_remote: true,
        delete_local: true,
      },
      reason: "Compare requests cannot carry write, overwrite, migration, or delete actions.",
    },
    {
      id: "nested-forbidden-field-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataRequest(),
        unexpected_payload: {
          page_body_text: "redacted synthetic nested text",
        },
      },
      reason:
        "Nested forbidden fields and unknown payload containers are rejected before future route enablement.",
    },
    {
      id: "invalid-domain-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataRequest(),
        domain_ids: ["pages", "private-page-body-export"],
      },
      reason: "Domain ids must be one of the metadata-only cloud manifest domains.",
    },
    {
      id: "missing-required-rejected",
      expected_status: "rejected",
      value: {
        workspace_id: "workspace_demo",
        domain_ids: ["pages"],
      },
      reason: "Required actor, device, manifest, permission, audit, idempotency, and timestamp fields are missing.",
    },
  ];

  return cases.map((testCase) => {
    const result = validateCloudManifestCompareRequest(testCase.value);
    return {
      id: testCase.id,
      expected_status: testCase.expected_status,
      actual_status: result.validation_status,
      reason: testCase.reason,
      forbidden_field_names: result.forbidden_field_names,
      issue_count: result.summary.issue_count,
    };
  });
}

function buildAcceptedMetadataRequest() {
  return {
    workspace_id: "workspace_demo",
    actor_user_id: "user_demo",
    device_id: "device_demo",
    domain_ids: ["pages", "daily-notes", "meetings", "databases"],
    local_manifest_report_id: "local-manifest-demo",
    local_watermark: "local-watermark-demo",
    remote_watermark: "remote-watermark-demo",
    include_missing_ids: false,
    permission_decision_id: "permission-demo",
    audit_event_envelope_id: "audit-demo",
    idempotency_key: "manifest-compare-demo",
    created_at: "2026-06-30T00:00:00.000Z",
  };
}

function validateAllowedField(
  field: string,
  fieldValue: unknown
): CloudManifestCompareRequestValidationIssue[] {
  if (field === "domain_ids") return validateDomainIds(fieldValue);
  if (field === "include_missing_ids") {
    return typeof fieldValue === "boolean"
      ? []
      : [
          {
            field,
            reason_code: "invalid-type",
            reason: "include_missing_ids must be a boolean.",
          },
        ];
  }
  if (field === "created_at") {
    if (!isNonEmptyString(fieldValue, TEXT_FIELD_MAX_LENGTH)) {
      return [
        {
          field,
          reason_code: "invalid-type",
          reason: "created_at must be a non-empty ISO timestamp string.",
        },
      ];
    }
    return Number.isNaN(Date.parse(fieldValue))
      ? [
          {
            field,
            reason_code: "invalid-value",
            reason: "created_at must parse as a timestamp.",
          },
        ]
      : [];
  }
  if (field === "local_watermark" || field === "remote_watermark") {
    return isNonEmptyString(fieldValue, WATERMARK_FIELD_MAX_LENGTH)
      ? []
      : [
          {
            field,
            reason_code: "invalid-type",
            reason: `${field} must be a bounded non-empty string.`,
          },
        ];
  }
  if (field === "idempotency_key") {
    return isNonEmptyString(fieldValue, IDEMPOTENCY_KEY_MAX_LENGTH)
      ? []
      : [
          {
            field,
            reason_code: "invalid-type",
            reason: "idempotency_key must be a bounded non-empty string.",
          },
        ];
  }
  return isNonEmptyString(fieldValue, TEXT_FIELD_MAX_LENGTH)
    ? []
    : [
        {
          field,
          reason_code: "invalid-type",
          reason: `${field} must be a bounded non-empty string.`,
        },
      ];
}

function validateDomainIds(value: unknown): CloudManifestCompareRequestValidationIssue[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      {
        field: "domain_ids",
        reason_code: "invalid-type",
        reason: "domain_ids must be a non-empty array.",
      },
    ];
  }
  if (value.length > buildAllowedDomainIds().length) {
    return [
      {
        field: "domain_ids",
        reason_code: "invalid-value",
        reason: "domain_ids cannot include more entries than known manifest domains.",
      },
    ];
  }
  const allowedDomainIds = buildAllowedDomainIds();
  const ids = value.filter((item): item is string => typeof item === "string");
  if (ids.length !== value.length || ids.some((id) => id.trim().length === 0)) {
    return [
      {
        field: "domain_ids",
        reason_code: "invalid-type",
        reason: "domain_ids must contain only non-empty strings.",
      },
    ];
  }
  if (new Set(ids).size !== ids.length) {
    return [
      {
        field: "domain_ids",
        reason_code: "invalid-value",
        reason: "domain_ids must be unique.",
      },
    ];
  }
  const unknownIds = ids.filter((id) => !allowedDomainIds.includes(id));
  return unknownIds.length === 0
    ? []
    : [
        {
          field: "domain_ids",
          reason_code: "invalid-value",
          reason: "domain_ids includes a domain outside the metadata-only manifest contract.",
        },
      ];
}

function buildValidationResult(input: {
  allowedFields: string[];
  requiredFields: string[];
  optionalFields: string[];
  forbiddenFields: string[];
  acceptedFieldNames: string[];
  issues: CloudManifestCompareRequestValidationIssue[];
}): CloudManifestCompareRequestValidationResult {
  const uniqueIssues = dedupeIssues(input.issues);
  const missingRequiredFieldNames = unique(
    uniqueIssues
      .filter((issue) => issue.reason_code === "missing-required-field")
      .map((issue) => issue.field)
  );
  const forbiddenFieldNames = unique(
    uniqueIssues
      .filter((issue) => issue.reason_code === "forbidden-field")
      .map((issue) => issue.field)
  );
  const unknownFieldNames = unique(
    uniqueIssues
      .filter((issue) => issue.reason_code === "unknown-field")
      .map((issue) => issue.field)
  );
  const invalidFieldNames = unique(
    uniqueIssues
      .filter(
        (issue) =>
          issue.reason_code === "invalid-type" ||
          issue.reason_code === "invalid-value"
      )
      .map((issue) => issue.field)
  );

  return {
    format: "zhinote-cloud-manifest-compare-request-validation",
    format_version: 1,
    validator_status: "metadata-only-local-validator",
    validation_status: uniqueIssues.length === 0 ? "accepted" : "rejected",
    safe_to_execute_cloud_compare_now: false,
    can_connect_cloud_now: false,
    can_read_remote_manifest_now: false,
    can_read_workspace_content_now: false,
    can_write_server_data_now: false,
    can_upload_workspace_data_now: false,
    boundary: buildBoundary(),
    summary: {
      allowed_fields: input.allowedFields.length,
      required_fields: input.requiredFields.length,
      optional_fields: input.optionalFields.length,
      forbidden_fields: input.forbiddenFields.length,
      accepted_fields: input.acceptedFieldNames.length,
      issue_count: uniqueIssues.length,
    },
    accepted_field_names: unique(input.acceptedFieldNames),
    missing_required_field_names: missingRequiredFieldNames,
    forbidden_field_names: forbiddenFieldNames,
    unknown_field_names: unknownFieldNames,
    invalid_field_names: invalidFieldNames,
    issues: uniqueIssues,
  };
}

function buildAllowedFieldNames(): string[] {
  return buildCloudManifestCompareRequestFields().map((field) => field.field);
}

function buildForbiddenFieldNames(): string[] {
  return buildCloudManifestCompareForbiddenFields().map((field) => field.field);
}

function buildAllowedDomainIds(): string[] {
  return buildCloudManifestDomainContracts().map((contract) => contract.id);
}

function findForbiddenFieldsRecursively(
  value: unknown,
  forbiddenFields: string[]
): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return unique(
      value.flatMap((item) =>
        findForbiddenFieldsRecursively(item, forbiddenFields)
      )
    );
  }
  return unique(
    Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
      ...(forbiddenFields.includes(key) ? [key] : []),
      ...findForbiddenFieldsRecursively(child, forbiddenFields),
    ])
  );
}

function buildBoundary(): CloudManifestCompareRequestValidationResult["boundary"] {
  return {
    validates_shape_only: true,
    returns_raw_values: false,
    reads_page_body_text: false,
    reads_database_row_values: false,
    reads_comment_bodies: false,
    reads_version_snapshots: false,
    reads_file_names: false,
    reads_file_bytes: false,
    reads_secret_values: false,
    sends_network_requests: false,
    connects_cloud_services: false,
    writes_server_data: false,
    uploads_workspace_data: false,
    enables_sync: false,
    enables_ai: false,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function dedupeIssues(
  issues: CloudManifestCompareRequestValidationIssue[]
): CloudManifestCompareRequestValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}:${issue.reason_code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
