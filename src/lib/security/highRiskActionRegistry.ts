import type { HighRiskActionId } from "@/lib/security/typedConfirmation";

export type HighRiskActionCoverage =
  | "local-receipt-available"
  | "planned"
  | "blocked";

export type HighRiskActionCategory =
  | "sync"
  | "restore"
  | "ai"
  | "file-preview"
  | "database"
  | "sharing"
  | "delete";

export interface HighRiskActionDefinition {
  action_id: HighRiskActionId;
  title: string;
  category: HighRiskActionCategory;
  module_surface: string;
  required_phrase: string;
  coverage: HighRiskActionCoverage;
  can_execute_today: boolean;
  disabled_endpoint: string | null;
  local_receipt_file_prefix: string;
  risk_summary: string;
  current_boundary: string;
  next_required_controls: string[];
}

export interface HighRiskActionRegistryReport {
  format: "zhinote-high-risk-action-registry";
  format_version: 1;
  registry_status: "local-policy-registry";
  privacy_note: string;
  boundary: {
    uploads_data: false;
    writes_workspace_data: false;
    calls_external_service: false;
    deletes_data: false;
    includes_page_text: false;
    includes_file_bytes: false;
    stores_secret_values: false;
    enables_actions: false;
  };
  summary: {
    actions: number;
    local_receipt_available: number;
    planned: number;
    blocked: number;
    executable_today_after_confirmation: number;
    disabled_endpoints: number;
  };
  actions: HighRiskActionDefinition[];
}

export const HIGH_RISK_CONFIRMATION_PHRASES: Record<
  HighRiskActionId,
  string
> = {
  "cloud-sync-first-push": "ENABLE PRIVATE ALPHA SYNC",
  "remote-baseline-stage-replay": "ENABLE DISPOSABLE REPLAY",
  "restore-writeback": "ENABLE RESTORE WRITEBACK",
  "ai-external-run": "ENABLE AI EXTERNAL RUN",
  "external-resource-load": "ENABLE EXTERNAL RESOURCES",
  "bulk-import": "ENABLE BULK IMPORT",
  "bulk-delete": "ENABLE BULK DELETE",
  "sharing-enable": "ENABLE SHARING",
};

export const HIGH_RISK_ACTION_REGISTRY: HighRiskActionDefinition[] = [
  {
    action_id: "cloud-sync-first-push",
    title: "Cloud sync first push",
    category: "sync",
    module_surface: "/modules/sync",
    required_phrase: HIGH_RISK_CONFIRMATION_PHRASES["cloud-sync-first-push"],
    coverage: "local-receipt-available",
    can_execute_today: false,
    disabled_endpoint: "/api/sync/push",
    local_receipt_file_prefix: "zhinote-high-risk-confirmation",
    risk_summary:
      "Future first cloud push can transmit private local workspace metadata and content after enablement.",
    current_boundary:
      "Local receipt and payload preview exist, but push API remains disabled and does not read request bodies.",
    next_required_controls: [
      "Server permission check",
      "Remote baseline and conflict review",
      "Audit event",
      "Idempotent acknowledgement",
      "Rollback proof",
    ],
  },
  {
    action_id: "remote-baseline-stage-replay",
    title: "Remote baseline disposable replay",
    category: "sync",
    module_surface: "/modules/sync",
    required_phrase:
      HIGH_RISK_CONFIRMATION_PHRASES["remote-baseline-stage-replay"],
    coverage: "local-receipt-available",
    can_execute_today: false,
    disabled_endpoint: "/api/sync/replay-test",
    local_receipt_file_prefix: "zhinote-remote-baseline-replay-confirmation",
    risk_summary:
      "Future disposable replay can connect to an empty disposable database to prove remote baseline stage schema, RLS isolation, cursor monotonicity, idempotency, and rollback.",
    current_boundary:
      "Local receipt and replay/RLS proof contract exist, but replay endpoint remains disabled and does not create databases, apply SQL, read remote data, stage rows, or upload workspace data.",
    next_required_controls: [
      "Empty disposable workspace fixture",
      "Payload denylist proof",
      "RLS isolation proof",
      "Cursor monotonicity proof",
      "Rollback proof",
      "Redacted audit event",
    ],
  },
  {
    action_id: "restore-writeback",
    title: "Restore write-back",
    category: "restore",
    module_surface: "/modules/sync",
    required_phrase: HIGH_RISK_CONFIRMATION_PHRASES["restore-writeback"],
    coverage: "local-receipt-available",
    can_execute_today: false,
    disabled_endpoint: "/api/backup/restore-apply",
    local_receipt_file_prefix: "zhinote-restore-confirmation-receipt",
    risk_summary:
      "Future restore write-back can overwrite or add pages, databases, comments, versions, files, favorites, and locks.",
    current_boundary:
      "Dry-run preview, rollback plan, write-back contract, and local receipt exist; apply API remains disabled.",
    next_required_controls: [
      "Fresh rollback snapshot",
      "Restore scope review",
      "Server permission check",
      "Audit event",
      "Failed-restore recovery proof",
    ],
  },
  {
    action_id: "ai-external-run",
    title: "AI external run",
    category: "ai",
    module_surface: "/modules/ai",
    required_phrase: HIGH_RISK_CONFIRMATION_PHRASES["ai-external-run"],
    coverage: "local-receipt-available",
    can_execute_today: false,
    disabled_endpoint: "/api/ai/run",
    local_receipt_file_prefix: "zhinote-ai-confirmation-receipt",
    risk_summary:
      "Future AI execution can send selected page text, prompt text, and approved file content to a model provider.",
    current_boundary:
      "Payload preview, execution policy, and local receipt exist; AI run API remains disabled and does not read request bodies.",
    next_required_controls: [
      "Provider and model selection",
      "Retention policy",
      "Final outbound payload preview",
      "Server permission check",
      "AI audit event",
    ],
  },
  {
    action_id: "external-resource-load",
    title: "HTML external resource load",
    category: "file-preview",
    module_surface: "HTML file preview block",
    required_phrase: HIGH_RISK_CONFIRMATION_PHRASES["external-resource-load"],
    coverage: "local-receipt-available",
    can_execute_today: true,
    disabled_endpoint: null,
    local_receipt_file_prefix: "zhinote-external-resource-confirmation",
    risk_summary:
      "Trusted HTML previews can request remote images, scripts, styles, frames, fonts, media, or network endpoints.",
    current_boundary:
      "External resources are blocked by default and require typed phrase plus local confirmation before a preview can enable them.",
    next_required_controls: [
      "Optional allowlist",
      "Audit event",
      "Per-file visible state",
      "Easy disable control",
    ],
  },
  {
    action_id: "bulk-import",
    title: "Spreadsheet bulk import",
    category: "database",
    module_surface: "Spreadsheet file preview block",
    required_phrase: HIGH_RISK_CONFIRMATION_PHRASES["bulk-import"],
    coverage: "local-receipt-available",
    can_execute_today: true,
    disabled_endpoint: null,
    local_receipt_file_prefix: "zhinote-bulk-import-confirmation",
    risk_summary:
      "Spreadsheet import can create a new local database, local fields, and local rows from spreadsheet data.",
    current_boundary:
      "Bulk import requires typed phrase, local receipt export option, and a second range confirmation before creating local rows.",
    next_required_controls: [
      "Rollback snapshot",
      "Undo/import history",
      "Audit event",
      "Larger-file progress and cancellation",
    ],
  },
  {
    action_id: "bulk-delete",
    title: "Bulk delete",
    category: "delete",
    module_surface: "Future pages/databases/files cleanup",
    required_phrase: HIGH_RISK_CONFIRMATION_PHRASES["bulk-delete"],
    coverage: "planned",
    can_execute_today: false,
    disabled_endpoint: null,
    local_receipt_file_prefix: "zhinote-bulk-delete-confirmation",
    risk_summary:
      "Future bulk delete can remove many pages, rows, files, comments, or module records at once.",
    current_boundary:
      "No bulk-delete runner is implemented; this registry reserves the confirmation phrase and control requirements.",
    next_required_controls: [
      "Exact delete scope preview",
      "Rollback snapshot",
      "Two-step confirmation",
      "Audit event",
      "Soft-delete default",
    ],
  },
  {
    action_id: "sharing-enable",
    title: "Sharing enablement",
    category: "sharing",
    module_surface: "Future shared workspaces and links",
    required_phrase: HIGH_RISK_CONFIRMATION_PHRASES["sharing-enable"],
    coverage: "planned",
    can_execute_today: false,
    disabled_endpoint: null,
    local_receipt_file_prefix: "zhinote-sharing-confirmation",
    risk_summary:
      "Future sharing can expose pages, databases, reports, files, or portfolio context to another user or workspace.",
    current_boundary:
      "Sharing is not implemented; this registry reserves the confirmation phrase and permission controls.",
    next_required_controls: [
      "Recipient and scope preview",
      "Server permission check",
      "Audit event",
      "Revocation path",
      "Link expiry policy",
    ],
  },
];

export function getHighRiskActionDefinition(actionId: HighRiskActionId) {
  return HIGH_RISK_ACTION_REGISTRY.find(
    (action) => action.action_id === actionId
  );
}

export function getHighRiskRequiredPhrase(actionId: HighRiskActionId) {
  return HIGH_RISK_CONFIRMATION_PHRASES[actionId];
}

export function buildHighRiskActionRegistryReport(): HighRiskActionRegistryReport {
  return {
    format: "zhinote-high-risk-action-registry",
    format_version: 1,
    registry_status: "local-policy-registry",
    privacy_note:
      "Generated locally. This registry contains only high-risk action rules and confirmation phrases. It does not include page text, prompts, spreadsheet cell values, report URLs, file bytes, tokens, credentials, or private research content.",
    boundary: {
      uploads_data: false,
      writes_workspace_data: false,
      calls_external_service: false,
      deletes_data: false,
      includes_page_text: false,
      includes_file_bytes: false,
      stores_secret_values: false,
      enables_actions: false,
    },
    summary: {
      actions: HIGH_RISK_ACTION_REGISTRY.length,
      local_receipt_available: HIGH_RISK_ACTION_REGISTRY.filter(
        (action) => action.coverage === "local-receipt-available"
      ).length,
      planned: HIGH_RISK_ACTION_REGISTRY.filter(
        (action) => action.coverage === "planned"
      ).length,
      blocked: HIGH_RISK_ACTION_REGISTRY.filter(
        (action) => action.coverage === "blocked"
      ).length,
      executable_today_after_confirmation: HIGH_RISK_ACTION_REGISTRY.filter(
        (action) => action.can_execute_today
      ).length,
      disabled_endpoints: HIGH_RISK_ACTION_REGISTRY.filter(
        (action) => action.disabled_endpoint
      ).length,
    },
    actions: HIGH_RISK_ACTION_REGISTRY,
  };
}
