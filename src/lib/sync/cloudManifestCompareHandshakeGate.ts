import { buildCloudManifestCompareApiDisabledResponse } from "@/lib/sync/cloudManifestCompareApiStub";
import { buildCloudManifestCompareRequestValidatorReport } from "@/lib/sync/cloudManifestCompareRequestValidator";
import { buildCloudManifestCompareResponseValidatorReport } from "@/lib/sync/cloudManifestCompareResponseValidator";

export type CloudManifestCompareHandshakeGateStatus =
  | "blocked"
  | "ready-for-owner-review";

export interface CloudManifestCompareHandshakeGateCheck {
  id: string;
  title: string;
  status: CloudManifestCompareHandshakeGateStatus;
  evidence: string;
  required_before_enablement: string;
}

export interface CloudManifestCompareHandshakeGateReport {
  format: "zhinote-cloud-manifest-compare-handshake-gate";
  format_version: 1;
  gate_status: "local-handshake-gate-only";
  compare_handshake_can_start_now: false;
  cloud_compare_can_execute_now: false;
  cache_rebuild_can_start_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_report_only: true;
    uses_synthetic_fixtures_only: true;
    reads_route_response_over_http: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    reads_remote_manifest: false;
    reads_workspace_content: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    returns_raw_values: false;
    returns_missing_ids: false;
    rebuilds_cache: false;
    enables_sync: false;
    enables_ai: false;
    requires_owner_review_before_enablement: true;
  };
  summary: {
    request_fixtures: number;
    request_rejections: number;
    request_forbidden_fields_covered: number;
    response_fixtures: number;
    response_rejections: number;
    response_forbidden_fields_covered: number;
    api_guard_enablement_gates: number;
    api_guard_response_forbidden_fields: number;
    checks: number;
    blocked_checks: number;
    ready_for_owner_review_checks: number;
  };
  checks: CloudManifestCompareHandshakeGateCheck[];
}

export function buildCloudManifestCompareHandshakeGateReport(): CloudManifestCompareHandshakeGateReport {
  const requestReport = buildCloudManifestCompareRequestValidatorReport();
  const responseReport = buildCloudManifestCompareResponseValidatorReport();
  const apiGuard = buildCloudManifestCompareApiDisabledResponse();
  const checks = buildHandshakeChecks({
    requestForbiddenFieldsCovered:
      requestReport.summary.forbidden_fields_covered,
    responseForbiddenFieldsCovered:
      responseReport.summary.forbidden_fields_covered,
    apiGuardEnablementGates: apiGuard.enablement_gates.length,
    apiGuardForbiddenResponseFields:
      apiGuard.response_schema.forbidden_fields.length,
  });
  const blockedChecks = checks.filter((check) => check.status === "blocked")
    .length;
  const readyForOwnerReviewChecks = checks.filter(
    (check) => check.status === "ready-for-owner-review"
  ).length;

  return {
    format: "zhinote-cloud-manifest-compare-handshake-gate",
    format_version: 1,
    gate_status: "local-handshake-gate-only",
    compare_handshake_can_start_now: false,
    cloud_compare_can_execute_now: false,
    cache_rebuild_can_start_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "This local gate cross-checks synthetic request validation, synthetic response validation, and the disabled manifest compare API guard before any future cloud manifest compare handshake. It does not send network requests, connect cloud services, read route responses, read workspace content, upload data, rebuild cache, enable sync, or enable AI.",
    boundary: {
      local_report_only: true,
      uses_synthetic_fixtures_only: true,
      reads_route_response_over_http: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      reads_remote_manifest: false,
      reads_workspace_content: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      returns_raw_values: false,
      returns_missing_ids: false,
      rebuilds_cache: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_review_before_enablement: true,
    },
    summary: {
      request_fixtures: requestReport.summary.fixtures,
      request_rejections: requestReport.summary.rejected,
      request_forbidden_fields_covered:
        requestReport.summary.forbidden_fields_covered,
      response_fixtures: responseReport.summary.fixtures,
      response_rejections: responseReport.summary.rejected,
      response_forbidden_fields_covered:
        responseReport.summary.forbidden_fields_covered,
      api_guard_enablement_gates: apiGuard.enablement_gates.length,
      api_guard_response_forbidden_fields:
        apiGuard.response_schema.forbidden_fields.length,
      checks: checks.length,
      blocked_checks: blockedChecks,
      ready_for_owner_review_checks: readyForOwnerReviewChecks,
    },
    checks,
  };
}

function buildHandshakeChecks(input: {
  requestForbiddenFieldsCovered: number;
  responseForbiddenFieldsCovered: number;
  apiGuardEnablementGates: number;
  apiGuardForbiddenResponseFields: number;
}): CloudManifestCompareHandshakeGateCheck[] {
  return [
    {
      id: "request-validator-before-cloud",
      title: "Request validator blocks private payloads",
      status: "ready-for-owner-review",
      evidence: `${input.requestForbiddenFieldsCovered} forbidden request field classes are covered by local synthetic fixtures.`,
      required_before_enablement:
        "Keep request validation in front of any future cloud manifest compare endpoint.",
    },
    {
      id: "response-validator-before-cache",
      title: "Response validator blocks private payloads",
      status: "ready-for-owner-review",
      evidence: `${input.responseForbiddenFieldsCovered} forbidden response field classes are covered by local synthetic fixtures.`,
      required_before_enablement:
        "Validate cloud responses before exposing missing ids, starting cache rebuild, or showing remote metadata.",
    },
    {
      id: "disabled-api-guard",
      title: "API guard remains disabled",
      status: "blocked",
      evidence: "The manifest compare API guard still reports disabled-local-stub and HTTP 501 expectations.",
      required_before_enablement:
        "Replace the disabled stub only after auth, permissions, audit, rate limit, metadata-only schema, and owner review are implemented.",
    },
    {
      id: "owner-review-before-missing-ids",
      title: "Missing ids require owner review",
      status: "blocked",
      evidence: `${input.apiGuardEnablementGates} enablement gates are still required, including owner review and metadata-only manifests.`,
      required_before_enablement:
        "Do not return missing or extra ids until owner review explicitly allows id-only reports.",
    },
    {
      id: "no-cache-rebuild-before-validated-response",
      title: "Cache rebuild remains blocked",
      status: "blocked",
      evidence: `${input.apiGuardForbiddenResponseFields} forbidden response field classes remain excluded from manifest compare responses.`,
      required_before_enablement:
        "Only rebuild local cache after a validated metadata-only response, durable ACK proof, and explicit owner confirmation.",
    },
  ];
}
