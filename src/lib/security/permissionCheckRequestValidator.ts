import {
  buildPermissionCheckForbiddenFields,
  buildPermissionCheckRequestFields,
} from "@/lib/security/permissionCheckEnvelope";

export type PermissionCheckRequestValidationStatus =
  | "metadata-only-accepted"
  | "rejected-forbidden-payload"
  | "rejected-unknown-field"
  | "rejected-invalid-shape";

export interface PermissionCheckRequestValidationResult {
  format: "zhinote-permission-check-request-validation";
  format_version: 1;
  validation_status: PermissionCheckRequestValidationStatus;
  can_execute_permission_now: false;
  echoes_values: false;
  stores_raw_request: false;
  accepted_field_names: string[];
  forbidden_field_paths: string[];
  unknown_field_names: string[];
  missing_required_fields: string[];
  invalid_field_names: string[];
  rejection_reasons: string[];
  privacy_boundary: {
    metadata_only_validation: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_prompt_text: false;
    reads_secret_values: false;
    exposes_secret_values: false;
    uploads_workspace_data: false;
    returns_raw_values: false;
  };
}

export interface PermissionCheckValidatorFixture {
  id: string;
  title: string;
  request: unknown;
  expected_status: PermissionCheckRequestValidationStatus;
  expected_forbidden_fields: string[];
}

export interface PermissionCheckValidatorFixtureResult {
  id: string;
  title: string;
  expected_status: PermissionCheckRequestValidationStatus;
  actual_status: PermissionCheckRequestValidationStatus;
  passed: boolean;
  forbidden_field_paths: string[];
  unknown_field_names: string[];
  missing_required_fields: string[];
  invalid_field_names: string[];
}

export interface PermissionCheckValidatorReport {
  format: "zhinote-permission-check-validator-report";
  format_version: 1;
  report_status: "local-fixture-only";
  can_execute_permission_now: false;
  reads_request_body_now: false;
  stores_fixture_values: false;
  privacy_note: string;
  summary: {
    fixtures: number;
    accepted: number;
    rejected_forbidden_payload: number;
    rejected_unknown_field: number;
    rejected_invalid_shape: number;
    passed: number;
    failed: number;
  };
  fixture_results: PermissionCheckValidatorFixtureResult[];
}

const REQUIRED_PERMISSION_CHECK_REQUEST_FIELDS = [
  "request_id",
  "workspace_id",
  "actor_user_id",
  "actor_role_id",
  "resource_type",
  "resource_id",
  "action_id",
  "risk_action_id",
  "confirmation_receipt_id",
  "audit_event_envelope_id",
  "idempotency_key",
  "created_at",
];

const NULLABLE_PERMISSION_CHECK_REQUEST_FIELDS = new Set([
  "resource_id",
  "risk_action_id",
  "confirmation_receipt_id",
  "audit_event_envelope_id",
]);

export const PERMISSION_CHECK_REQUEST_VALIDATOR_FIXTURES: PermissionCheckValidatorFixture[] =
  [
    {
      id: "metadata-only-owner-sync",
      title: "Owner cloud sync metadata only",
      request: metadataOnlyRequest(),
      expected_status: "metadata-only-accepted",
      expected_forbidden_fields: [],
    },
    {
      id: "page-body-text-blocked",
      title: "Page body text is rejected",
      request: {
        ...metadataOnlyRequest(),
        page_body_text: "PRIVATE_NOTE_TEXT",
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["page_body_text"],
    },
    {
      id: "nested-prompt-text-blocked",
      title: "Nested prompt text is rejected",
      request: {
        ...metadataOnlyRequest(),
        ai_context: {
          prompt_text: "PRIVATE_PROMPT_TEXT",
        },
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["ai_context.prompt_text"],
    },
    {
      id: "token-blocked",
      title: "Token field is rejected",
      request: {
        ...metadataOnlyRequest(),
        token: "PRIVATE_TOKEN",
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["token"],
    },
    {
      id: "database-cell-values-blocked",
      title: "Database row values are rejected",
      request: {
        ...metadataOnlyRequest(),
        database_cell_values: {
          row_id: "row_fixture",
          thesis: "PRIVATE_DATABASE_VALUE",
        },
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["database_cell_values"],
    },
    {
      id: "comment-body-blocked",
      title: "Comment body is rejected",
      request: {
        ...metadataOnlyRequest(),
        review: {
          comment_body: "PRIVATE_COMMENT_BODY",
        },
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["review.comment_body"],
    },
    {
      id: "file-bytes-blocked",
      title: "Nested file bytes are rejected",
      request: {
        ...metadataOnlyRequest(),
        upload: {
          file_bytes: "PRIVATE_FILE_BYTES",
        },
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["upload.file_bytes"],
    },
    {
      id: "cookie-blocked",
      title: "Cookie field is rejected",
      request: {
        ...metadataOnlyRequest(),
        cookie: "PRIVATE_COOKIE",
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["cookie"],
    },
    {
      id: "signed-url-blocked",
      title: "Signed download URL is rejected",
      request: {
        ...metadataOnlyRequest(),
        file_access: {
          signed_download_url: "https://signed.example.invalid/private",
        },
      },
      expected_status: "rejected-forbidden-payload",
      expected_forbidden_fields: ["file_access.signed_download_url"],
    },
    {
      id: "unknown-payload-field-blocked",
      title: "Unknown payload field is rejected",
      request: {
        ...metadataOnlyRequest(),
        payload_preview_id: "preview_001",
      },
      expected_status: "rejected-unknown-field",
      expected_forbidden_fields: [],
    },
    {
      id: "missing-actor-blocked",
      title: "Missing actor id is rejected",
      request: withoutField(metadataOnlyRequest(), "actor_user_id"),
      expected_status: "rejected-invalid-shape",
      expected_forbidden_fields: [],
    },
  ];

export function validatePermissionCheckMetadataRequest(
  request: unknown
): PermissionCheckRequestValidationResult {
  const allowedFieldNames = new Set(
    buildPermissionCheckRequestFields().map((field) => field.field)
  );
  const forbiddenFieldNames = new Set(
    buildPermissionCheckForbiddenFields().map((field) => field.field)
  );

  if (!isPlainObject(request)) {
    return buildValidationResult({
      validationStatus: "rejected-invalid-shape",
      acceptedFieldNames: [],
      forbiddenFieldPaths: [],
      unknownFieldNames: [],
      missingRequiredFields: REQUIRED_PERMISSION_CHECK_REQUEST_FIELDS,
      invalidFieldNames: ["request"],
      rejectionReasons: ["Request must be a plain metadata object."],
    });
  }

  const fieldNames = Object.keys(request);
  const acceptedFieldNames = fieldNames.filter((fieldName) =>
    allowedFieldNames.has(fieldName)
  );
  const forbiddenFieldPaths = collectForbiddenFieldPaths(
    request,
    forbiddenFieldNames
  );
  const unknownFieldNames = fieldNames.filter(
    (fieldName) =>
      !allowedFieldNames.has(fieldName) && !forbiddenFieldNames.has(fieldName)
  );
  const missingRequiredFields =
    REQUIRED_PERMISSION_CHECK_REQUEST_FIELDS.filter(
      (fieldName) => !(fieldName in request)
    );
  const invalidFieldNames = acceptedFieldNames.filter(
    (fieldName) => !isValidAllowedFieldValue(fieldName, request[fieldName])
  );
  const validationStatus = getValidationStatus({
    forbiddenFieldPaths,
    unknownFieldNames,
    missingRequiredFields,
    invalidFieldNames,
  });

  return buildValidationResult({
    validationStatus,
    acceptedFieldNames,
    forbiddenFieldPaths,
    unknownFieldNames,
    missingRequiredFields,
    invalidFieldNames,
    rejectionReasons: buildRejectionReasons({
      forbiddenFieldPaths,
      unknownFieldNames,
      missingRequiredFields,
      invalidFieldNames,
    }),
  });
}

export function buildPermissionCheckValidatorReport(): PermissionCheckValidatorReport {
  const fixtureResults = PERMISSION_CHECK_REQUEST_VALIDATOR_FIXTURES.map(
    (fixture) => {
      const result = validatePermissionCheckMetadataRequest(fixture.request);
      const expectedForbiddenPaths = fixture.expected_forbidden_fields;
      const forbiddenPathsMatch =
        expectedForbiddenPaths.length === result.forbidden_field_paths.length &&
        expectedForbiddenPaths.every((fieldPath) =>
          result.forbidden_field_paths.includes(fieldPath)
        );

      return {
        id: fixture.id,
        title: fixture.title,
        expected_status: fixture.expected_status,
        actual_status: result.validation_status,
        passed:
          fixture.expected_status === result.validation_status &&
          forbiddenPathsMatch,
        forbidden_field_paths: result.forbidden_field_paths,
        unknown_field_names: result.unknown_field_names,
        missing_required_fields: result.missing_required_fields,
        invalid_field_names: result.invalid_field_names,
      };
    }
  );

  return {
    format: "zhinote-permission-check-validator-report",
    format_version: 1,
    report_status: "local-fixture-only",
    can_execute_permission_now: false,
    reads_request_body_now: false,
    stores_fixture_values: false,
    privacy_note:
      "Generated locally from fixed fixtures. The report stores field names and rejection paths only; it does not store request values, read page text, read files, read prompts, expose secrets, upload data, or execute permissions.",
    summary: {
      fixtures: fixtureResults.length,
      accepted: fixtureResults.filter(
        (result) => result.actual_status === "metadata-only-accepted"
      ).length,
      rejected_forbidden_payload: fixtureResults.filter(
        (result) => result.actual_status === "rejected-forbidden-payload"
      ).length,
      rejected_unknown_field: fixtureResults.filter(
        (result) => result.actual_status === "rejected-unknown-field"
      ).length,
      rejected_invalid_shape: fixtureResults.filter(
        (result) => result.actual_status === "rejected-invalid-shape"
      ).length,
      passed: fixtureResults.filter((result) => result.passed).length,
      failed: fixtureResults.filter((result) => !result.passed).length,
    },
    fixture_results: fixtureResults,
  };
}

function buildValidationResult(input: {
  validationStatus: PermissionCheckRequestValidationStatus;
  acceptedFieldNames: string[];
  forbiddenFieldPaths: string[];
  unknownFieldNames: string[];
  missingRequiredFields: string[];
  invalidFieldNames: string[];
  rejectionReasons: string[];
}): PermissionCheckRequestValidationResult {
  return {
    format: "zhinote-permission-check-request-validation",
    format_version: 1,
    validation_status: input.validationStatus,
    can_execute_permission_now: false,
    echoes_values: false,
    stores_raw_request: false,
    accepted_field_names: input.acceptedFieldNames,
    forbidden_field_paths: input.forbiddenFieldPaths,
    unknown_field_names: input.unknownFieldNames,
    missing_required_fields: input.missingRequiredFields,
    invalid_field_names: input.invalidFieldNames,
    rejection_reasons: input.rejectionReasons,
    privacy_boundary: {
      metadata_only_validation: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_prompt_text: false,
      reads_secret_values: false,
      exposes_secret_values: false,
      uploads_workspace_data: false,
      returns_raw_values: false,
    },
  };
}

function getValidationStatus(input: {
  forbiddenFieldPaths: string[];
  unknownFieldNames: string[];
  missingRequiredFields: string[];
  invalidFieldNames: string[];
}): PermissionCheckRequestValidationStatus {
  if (input.forbiddenFieldPaths.length > 0) {
    return "rejected-forbidden-payload";
  }

  if (input.unknownFieldNames.length > 0) {
    return "rejected-unknown-field";
  }

  if (
    input.missingRequiredFields.length > 0 ||
    input.invalidFieldNames.length > 0
  ) {
    return "rejected-invalid-shape";
  }

  return "metadata-only-accepted";
}

function buildRejectionReasons(input: {
  forbiddenFieldPaths: string[];
  unknownFieldNames: string[];
  missingRequiredFields: string[];
  invalidFieldNames: string[];
}): string[] {
  const reasons: string[] = [];

  if (input.forbiddenFieldPaths.length > 0) {
    reasons.push("Request contains forbidden private payload fields.");
  }

  if (input.unknownFieldNames.length > 0) {
    reasons.push("Request contains fields outside the metadata-only schema.");
  }

  if (input.missingRequiredFields.length > 0) {
    reasons.push("Request is missing required metadata fields.");
  }

  if (input.invalidFieldNames.length > 0) {
    reasons.push("Request contains metadata fields with invalid value shapes.");
  }

  return reasons;
}

function collectForbiddenFieldPaths(
  value: unknown,
  forbiddenFieldNames: Set<string>,
  path: string[] = []
): string[] {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return [];
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);

  return entries.flatMap(([key, child]) => {
    const childPath = [...path, key];
    const directMatch = forbiddenFieldNames.has(key) ? [childPath.join(".")] : [];

    return [
      ...directMatch,
      ...collectForbiddenFieldPaths(child, forbiddenFieldNames, childPath),
    ];
  });
}

function isValidAllowedFieldValue(fieldName: string, value: unknown): boolean {
  if (NULLABLE_PERMISSION_CHECK_REQUEST_FIELDS.has(fieldName) && value === null) {
    return true;
  }

  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function metadataOnlyRequest(): Record<string, unknown> {
  return {
    request_id: "req_permission_check_fixture",
    workspace_id: "workspace_fixture",
    actor_user_id: "user_fixture",
    actor_role_id: "owner",
    resource_type: "sync",
    resource_id: "sync_fixture",
    action_id: "sync",
    risk_action_id: "cloud-sync",
    confirmation_receipt_id: "receipt_fixture",
    audit_event_envelope_id: "audit_fixture",
    idempotency_key: "idem_fixture",
    created_at: "2026-06-04T00:00:00.000Z",
  };
}

function withoutField(
  source: Record<string, unknown>,
  fieldName: string
): Record<string, unknown> {
  const clone = { ...source };
  delete clone[fieldName];
  return clone;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
