import {
  buildCloudManifestCompareForbiddenResponseFields,
  buildCloudManifestCompareResponseFields,
} from "@/lib/sync/cloudManifestCompareApiStub";
import { buildCloudManifestDomainContracts } from "@/lib/sync/cloudManifestDomainContract";

export type CloudManifestCompareResponseValidationStatus =
  | "accepted"
  | "rejected";

export interface CloudManifestCompareResponseValidationIssue {
  field: string;
  reason_code:
    | "missing-required-field"
    | "forbidden-field"
    | "unknown-field"
    | "invalid-type"
    | "invalid-value";
  reason: string;
}

export interface CloudManifestCompareResponseValidationResult {
  format: "zhinote-cloud-manifest-compare-response-validation";
  format_version: 1;
  validator_status: "metadata-only-local-validator";
  validation_status: CloudManifestCompareResponseValidationStatus;
  safe_to_apply_cloud_compare_now: false;
  can_rebuild_cache_now: false;
  can_write_local_cache_now: false;
  can_return_workspace_content_now: false;
  can_return_missing_ids_now: false;
  boundary: {
    validates_shape_only: true;
    returns_raw_values: false;
    permits_manifest_counts_only: true;
    permits_ids_only_after_owner_review: false;
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
  issues: CloudManifestCompareResponseValidationIssue[];
}

export interface CloudManifestCompareResponseValidatorFixture {
  id: string;
  expected_status: CloudManifestCompareResponseValidationStatus;
  actual_status: CloudManifestCompareResponseValidationStatus;
  reason: string;
  forbidden_field_names: string[];
  issue_count: number;
}

export interface CloudManifestCompareResponseValidatorReport {
  format: "zhinote-cloud-manifest-compare-response-validator-report";
  format_version: 1;
  report_status: "local-fixture-report-only";
  validator_status: "metadata-only-local-validator";
  cloud_compare_can_apply_now: false;
  cache_rebuild_can_start_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: CloudManifestCompareResponseValidationResult["boundary"];
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
  fixtures: CloudManifestCompareResponseValidatorFixture[];
}

const REQUIRED_METADATA_FIELDS = [
  "format",
  "api_id",
  "decision_status",
  "domain_summaries",
  "local_watermark",
  "remote_watermark",
  "required_gates",
  "reason_codes",
] as const;

const OPTIONAL_METADATA_FIELDS = [
  "stub_status",
  "compare_receipt_id",
  "domain_contract_report",
] as const;

const ALLOWED_DECISION_STATUSES = [
  "disabled",
  "denied",
  "requires-review",
  "compared",
] as const;

const ALLOWED_DOMAIN_DIFF_STATUSES = [
  "matched",
  "missing-local",
  "missing-remote",
  "mismatch",
  "blocked",
] as const;

const TEXT_FIELD_MAX_LENGTH = 240;
const WATERMARK_FIELD_MAX_LENGTH = 160;

export function validateCloudManifestCompareResponse(
  value: unknown
): CloudManifestCompareResponseValidationResult {
  const allowedFields = buildAllowedFieldNames();
  const forbiddenFields = buildForbiddenFieldNames();
  const requiredFields = [...REQUIRED_METADATA_FIELDS];
  const optionalFields = [...OPTIONAL_METADATA_FIELDS];
  const issues: CloudManifestCompareResponseValidationIssue[] = [];

  if (!isPlainRecord(value)) {
    issues.push({
      field: "$root",
      reason_code: "invalid-type",
      reason: "Response must be a plain metadata object.",
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
        reason: "Required metadata response field is missing.",
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
        "Forbidden content, credential, file, or private payload field is not allowed in manifest compare responses.",
    });
  }

  for (const key of keys) {
    if (forbiddenFields.includes(key)) continue;
    if (!allowedFields.includes(key)) {
      issues.push({
        field: key,
        reason_code: "unknown-field",
        reason: "Unknown response fields are rejected so private payloads cannot ride along.",
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
      (key) =>
        allowedFields.includes(key) &&
        !issues.some((issue) => issue.field === key)
    ),
    issues,
  });
}

export function buildCloudManifestCompareResponseValidatorReport(): CloudManifestCompareResponseValidatorReport {
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
    format: "zhinote-cloud-manifest-compare-response-validator-report",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "metadata-only-local-validator",
    cloud_compare_can_apply_now: false,
    cache_rebuild_can_start_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "This report validates synthetic metadata-only manifest compare response shapes. It returns field names and issue codes only; it does not return raw values, page bodies, database rows, comments, version snapshots, file names, file bytes, secrets, tokens, remote ids, missing ids, signed URLs, or cloud data. It does not send network requests, connect cloud services, write server data, upload workspace data, rebuild cache, enable sync, or enable AI.",
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

function buildValidatorFixtures(): CloudManifestCompareResponseValidatorFixture[] {
  const cases: Array<{
    id: string;
    expected_status: CloudManifestCompareResponseValidationStatus;
    value: unknown;
    reason: string;
  }> = [
    {
      id: "metadata-only-response-accepted",
      expected_status: "accepted",
      value: buildAcceptedMetadataResponse(),
      reason:
        "Only response status, receipt id, count-only domain summaries, watermarks, gates, and reason codes are present.",
    },
    {
      id: "workspace-content-response-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataResponse(),
        page_body_text: "redacted synthetic text",
        block_text: "redacted synthetic block",
        database_cell_values: "redacted synthetic values",
        comment_body: "redacted synthetic comment",
        version_snapshot: "redacted synthetic snapshot",
      },
      reason:
        "Cloud manifest compare responses cannot return page text, blocks, database values, comments, or versions.",
    },
    {
      id: "file-and-backup-response-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataResponse(),
        file_bytes: "redacted synthetic bytes",
        backup_payload: "redacted synthetic backup",
        signed_upload_url: "https://example.invalid/redacted-upload",
        signed_download_url: "https://example.invalid/redacted-download",
      },
      reason:
        "File bytes, backups, and signed URLs must not appear in manifest compare responses.",
    },
    {
      id: "credential-response-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataResponse(),
        token: "redacted synthetic token",
        cookie: "redacted synthetic cookie",
        secret_values: "redacted synthetic secret",
      },
      reason: "Credentials and secrets cannot be returned from compare responses.",
    },
    {
      id: "nested-forbidden-response-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataResponse(),
        domain_summaries: [
          {
            ...buildDomainSummary("pages"),
            page_body_text: "redacted synthetic nested text",
          },
        ],
      },
      reason:
        "Nested forbidden fields are rejected before any future cache rebuild or owner review.",
    },
    {
      id: "missing-ids-response-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataResponse(),
        missing_ids: ["page_private_demo"],
      },
      reason:
        "Missing ids are not allowed until owner review explicitly enables id-only reports.",
    },
    {
      id: "invalid-domain-summary-rejected",
      expected_status: "rejected",
      value: {
        ...buildAcceptedMetadataResponse(),
        domain_summaries: [
          {
            ...buildDomainSummary("private-content-export"),
          },
        ],
      },
      reason: "Domain summaries must use known metadata-only manifest domains.",
    },
    {
      id: "missing-required-response-rejected",
      expected_status: "rejected",
      value: {
        format: "zhinote-cloud-manifest-compare-result",
        api_id: "cloud-manifest-compare",
      },
      reason: "Required status, domain summaries, watermarks, gates, and reason codes are missing.",
    },
  ];

  return cases.map((testCase) => {
    const result = validateCloudManifestCompareResponse(testCase.value);
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

function buildAcceptedMetadataResponse() {
  return {
    format: "zhinote-cloud-manifest-compare-result",
    api_id: "cloud-manifest-compare",
    decision_status: "requires-review",
    compare_receipt_id: "compare-demo",
    domain_summaries: [
      buildDomainSummary("pages"),
      buildDomainSummary("daily-notes"),
      buildDomainSummary("meetings"),
    ],
    local_watermark: "local-watermark-demo",
    remote_watermark: "remote-watermark-demo",
    required_gates: ["owner-review"],
    reason_codes: ["owner-review-required"],
  };
}

function buildDomainSummary(domainId: string) {
  return {
    domain_id: domainId,
    local_count: 12,
    remote_count: 12,
    local_watermark: "local-domain-watermark-demo",
    remote_watermark: "remote-domain-watermark-demo",
    manifest_hash_match: true,
    diff_status: "matched",
    missing_ids_count: 0,
    extra_ids_count: 0,
  };
}

function validateAllowedField(
  field: string,
  fieldValue: unknown
): CloudManifestCompareResponseValidationIssue[] {
  if (field === "domain_summaries") return validateDomainSummaries(fieldValue);
  if (field === "required_gates" || field === "reason_codes") {
    return validateStringArray(field, fieldValue);
  }
  if (field === "decision_status") {
    return typeof fieldValue === "string" &&
      ALLOWED_DECISION_STATUSES.includes(
        fieldValue as (typeof ALLOWED_DECISION_STATUSES)[number]
      )
      ? []
      : [
          {
            field,
            reason_code: "invalid-value",
            reason: "decision_status must be a known manifest compare status.",
          },
        ];
  }
  if (field === "domain_contract_report") {
    return isPlainRecord(fieldValue)
      ? []
      : [
          {
            field,
            reason_code: "invalid-type",
            reason: "domain_contract_report must be an object if included.",
          },
        ];
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

function validateDomainSummaries(
  value: unknown
): CloudManifestCompareResponseValidationIssue[] {
  if (!Array.isArray(value)) {
    return [
      {
        field: "domain_summaries",
        reason_code: "invalid-type",
        reason: "domain_summaries must be an array.",
      },
    ];
  }
  if (value.length === 0 || value.length > buildAllowedDomainIds().length) {
    return [
      {
        field: "domain_summaries",
        reason_code: "invalid-value",
        reason: "domain_summaries must include one entry per known domain at most.",
      },
    ];
  }
  const issues: CloudManifestCompareResponseValidationIssue[] = [];
  const seenDomainIds = new Set<string>();
  const allowedDomainIds = buildAllowedDomainIds();
  value.forEach((item, index) => {
    if (!isPlainRecord(item)) {
      issues.push({
        field: `domain_summaries[${index}]`,
        reason_code: "invalid-type",
        reason: "Each domain summary must be an object.",
      });
      return;
    }
    const domainId = item.domain_id;
    if (typeof domainId !== "string" || !allowedDomainIds.includes(domainId)) {
      issues.push({
        field: "domain_summaries.domain_id",
        reason_code: "invalid-value",
        reason: "Domain summary id must be in the metadata-only manifest contract.",
      });
    } else if (seenDomainIds.has(domainId)) {
      issues.push({
        field: "domain_summaries.domain_id",
        reason_code: "invalid-value",
        reason: "Domain summary ids must be unique.",
      });
    } else {
      seenDomainIds.add(domainId);
    }
    for (const countField of [
      "local_count",
      "remote_count",
      "missing_ids_count",
      "extra_ids_count",
    ]) {
      if (!isNonNegativeInteger(item[countField])) {
        issues.push({
          field: `domain_summaries.${countField}`,
          reason_code: "invalid-type",
          reason: `${countField} must be a non-negative integer.`,
        });
      }
    }
    for (const watermarkField of ["local_watermark", "remote_watermark"]) {
      if (!isNonEmptyString(item[watermarkField], WATERMARK_FIELD_MAX_LENGTH)) {
        issues.push({
          field: `domain_summaries.${watermarkField}`,
          reason_code: "invalid-type",
          reason: `${watermarkField} must be a bounded non-empty string.`,
        });
      }
    }
    if (typeof item.manifest_hash_match !== "boolean") {
      issues.push({
        field: "domain_summaries.manifest_hash_match",
        reason_code: "invalid-type",
        reason: "manifest_hash_match must be a boolean.",
      });
    }
    if (
      typeof item.diff_status !== "string" ||
      !ALLOWED_DOMAIN_DIFF_STATUSES.includes(
        item.diff_status as (typeof ALLOWED_DOMAIN_DIFF_STATUSES)[number]
      )
    ) {
      issues.push({
        field: "domain_summaries.diff_status",
        reason_code: "invalid-value",
        reason: "diff_status must be a known metadata-only compare status.",
      });
    }
    const allowedDomainSummaryFields = [
      "domain_id",
      "local_count",
      "remote_count",
      "local_watermark",
      "remote_watermark",
      "manifest_hash_match",
      "diff_status",
      "missing_ids_count",
      "extra_ids_count",
    ];
    for (const field of Object.keys(item)) {
      if (!allowedDomainSummaryFields.includes(field)) {
        issues.push({
          field: `domain_summaries.${field}`,
          reason_code: "unknown-field",
          reason: "Domain summaries may contain counts and watermarks only.",
        });
      }
    }
  });
  return issues;
}

function validateStringArray(
  field: string,
  value: unknown
): CloudManifestCompareResponseValidationIssue[] {
  if (!Array.isArray(value)) {
    return [
      {
        field,
        reason_code: "invalid-type",
        reason: `${field} must be an array of bounded strings.`,
      },
    ];
  }
  const values = value.filter((item): item is string => typeof item === "string");
  if (
    values.length !== value.length ||
    values.some((item) => item.trim().length === 0 || item.length > TEXT_FIELD_MAX_LENGTH)
  ) {
    return [
      {
        field,
        reason_code: "invalid-type",
        reason: `${field} must contain only bounded non-empty strings.`,
      },
    ];
  }
  if (new Set(values).size !== values.length) {
    return [
      {
        field,
        reason_code: "invalid-value",
        reason: `${field} must not contain duplicates.`,
      },
    ];
  }
  return [];
}

function buildValidationResult(input: {
  allowedFields: string[];
  requiredFields: string[];
  optionalFields: string[];
  forbiddenFields: string[];
  acceptedFieldNames: string[];
  issues: CloudManifestCompareResponseValidationIssue[];
}): CloudManifestCompareResponseValidationResult {
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
    format: "zhinote-cloud-manifest-compare-response-validation",
    format_version: 1,
    validator_status: "metadata-only-local-validator",
    validation_status: uniqueIssues.length === 0 ? "accepted" : "rejected",
    safe_to_apply_cloud_compare_now: false,
    can_rebuild_cache_now: false,
    can_write_local_cache_now: false,
    can_return_workspace_content_now: false,
    can_return_missing_ids_now: false,
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
  return buildCloudManifestCompareResponseFields().map((field) => field.field);
}

function buildForbiddenFieldNames(): string[] {
  return buildCloudManifestCompareForbiddenResponseFields().map(
    (field) => field.field
  );
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

function buildBoundary(): CloudManifestCompareResponseValidationResult["boundary"] {
  return {
    validates_shape_only: true,
    returns_raw_values: false,
    permits_manifest_counts_only: true,
    permits_ids_only_after_owner_review: false,
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function dedupeIssues(
  issues: CloudManifestCompareResponseValidationIssue[]
): CloudManifestCompareResponseValidationIssue[] {
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
