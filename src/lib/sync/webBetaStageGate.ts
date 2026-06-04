import type { SyncOptInGateReport } from "@/lib/sync/syncOptInGate";
import type { WebBetaDeploymentTarget } from "@/lib/sync/webBetaDeploymentTarget";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { WebBetaLaunchChecklist } from "@/lib/sync/webBetaLaunchChecklist";
import type {
  WebBetaReadinessGate,
  WebBetaReadinessReport,
  WebBetaReadinessStatus,
} from "@/lib/sync/webBetaReadiness";
import type { WebBetaRoutePreflightReport } from "@/lib/sync/webBetaRoutePreflight";

export type WebBetaStageGateStatus = WebBetaReadinessStatus;

export type WebBetaStageGateId =
  | "local-workbench"
  | "auth-session"
  | "cloud-database"
  | "private-file-storage"
  | "sync-push-pull"
  | "backup-restore"
  | "permissions-audit"
  | "deployment-release"
  | "owner-beta-decision";

export interface WebBetaStageGateInput {
  readinessReport: WebBetaReadinessReport;
  launchChecklist: WebBetaLaunchChecklist;
  deploymentTarget: WebBetaDeploymentTarget;
  routePreflight: WebBetaRoutePreflightReport;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
  syncOptInGate: SyncOptInGateReport;
}

export interface WebBetaStageGate {
  id: WebBetaStageGateId;
  title: string;
  status: WebBetaStageGateStatus;
  stage_type:
    | "local"
    | "account"
    | "cloud"
    | "storage"
    | "sync"
    | "recovery"
    | "security"
    | "deployment"
    | "decision";
  current_state: string;
  missing_before_web_beta: string;
  next_action: string;
  source: string;
}

export interface WebBetaStageGateReport {
  format: "zhinote-web-beta-stage-gate";
  format_version: 1;
  gate_status: "local-stage-gate-only";
  launch_verdict: "not-ready";
  local_app_can_continue_now: true;
  web_beta_can_launch_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_environment_metadata: true;
    reads_route_contracts: true;
    reads_payload_preview_metadata: true;
    reads_page_body_text: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    connects_cloud_services: false;
    deploys_app: false;
    creates_accounts: false;
    writes_workspace_data: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enables_sync: false;
    enables_ai: false;
    requires_owner_confirmation_before_cloud: true;
  };
  summary: {
    stages: number;
    ready: number;
    partial: number;
    manual_confirmation: number;
    blocked: number;
    p0_blockers: number;
    required_environment_missing: number;
    readiness_blocked: number;
    launch_blocked: number;
    route_mismatch_or_missing: number;
    deployment_blocked: number;
    sync_opt_in_blocked: number;
  };
  stage_order: WebBetaStageGateId[];
  gates: WebBetaStageGate[];
  decisions: Array<{
    label: string;
    answer: "yes" | "no";
    detail: string;
  }>;
}

export function buildWebBetaStageGateReport(
  input: WebBetaStageGateInput
): WebBetaStageGateReport {
  const gates = buildStageGates(input);
  const summary = summarizeStageGates(input, gates);

  return {
    format: "zhinote-web-beta-stage-gate",
    format_version: 1,
    gate_status: "local-stage-gate-only",
    launch_verdict: "not-ready",
    local_app_can_continue_now: true,
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally from readiness, route, environment, deployment, and sync opt-in metadata. This report does not read page body text, file bytes, secret values, or private research payloads; it does not connect cloud services, deploy the app, create accounts, write server data, upload workspace data, enable sync, or enable AI execution.",
    boundary: {
      local_report_only: true,
      reads_environment_metadata: true,
      reads_route_contracts: true,
      reads_payload_preview_metadata: true,
      reads_page_body_text: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      connects_cloud_services: false,
      deploys_app: false,
      creates_accounts: false,
      writes_workspace_data: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_cloud: true,
    },
    summary,
    stage_order: gates.map((gate) => gate.id),
    gates,
    decisions: [
      {
        label: "Can continue local work now",
        answer: "yes",
        detail:
          "Local pages, modules, backups, previews, and planning reports remain usable as the source of truth.",
      },
      {
        label: "Can launch Web Beta now",
        answer: "no",
        detail: `${summary.blocked} stage gates remain blocked, including ${summary.p0_blockers} P0 blockers.`,
      },
      {
        label: "Can start real cloud sync now",
        answer: "no",
        detail:
          "Cloud sync remains disabled until account, permission, audit, payload, remote baseline, private storage, and rollback gates pass.",
      },
    ],
  };
}

function buildStageGates(input: WebBetaStageGateInput): WebBetaStageGate[] {
  const readiness = (id: string) => findReadinessGate(input, id);
  const launch = (id: string) =>
    input.launchChecklist.tracks.find((track) => track.id === id);
  const routeGaps =
    input.routePreflight.summary.missing +
    input.routePreflight.summary.status_mismatch;
  const missingRequiredEnv =
    input.environmentPreflight?.summary.missing_required ?? 0;
  const environmentEvidence = input.environmentPreflight
    ? `${input.environmentPreflight.summary.present_required}/${input.environmentPreflight.summary.required} required environment settings are present.`
    : "Environment preflight has not loaded.";

  const localGate = readiness("local-data-foundation");
  const accountGate = readiness("cloud-auth");
  const schemaGate = readiness("cloud-schema");
  const syncGate = readiness("sync-api");
  const restoreGate = readiness("restore-writeback-contract");
  const permissionGate = readiness("permission-policy");
  const auditGate = readiness("audit-trail-policy");
  const deploymentGate = readiness("deployment-target-contract");
  const fileTrack = launch("private-file-storage");

  return [
    {
      id: "local-workbench",
      title: "Local workbench",
      status: "ready",
      stage_type: "local",
      current_state:
        localGate?.evidence ??
        `${input.readinessReport.local_scope.active_pages} active pages and ${input.readinessReport.local_scope.databases} databases are available locally.`,
      missing_before_web_beta:
        "Nothing blocks continued local work; cloud launch still needs the downstream gates.",
      next_action:
        "Keep local workspace as the source of truth while Web Beta gates are cleared.",
      source: "web-beta-readiness.local-data-foundation",
    },
    {
      id: "auth-session",
      title: "Auth, session, and workspace membership",
      status: accountGate?.status ?? "blocked",
      stage_type: "account",
      current_state:
        accountGate?.evidence ??
        "No server-side login, session refresh, workspace membership, or role enforcement is enabled.",
      missing_before_web_beta:
        "Auth provider, secure session storage, workspace membership checks, device revoke, and server-side role enforcement.",
      next_action:
        accountGate?.nextAction ??
        "Choose and implement the account layer before cloud workspace launch.",
      source: "web-beta-readiness.cloud-auth",
    },
    {
      id: "cloud-database",
      title: "Cloud database, migrations, and RLS",
      status: missingRequiredEnv > 0 ? "blocked" : (schemaGate?.status ?? "blocked"),
      stage_type: "cloud",
      current_state: `${schemaGate?.evidence ?? "Cloud schema is not ready."} ${environmentEvidence}`,
      missing_before_web_beta:
        "Supabase project, reversible migrations, row-level security, disposable replay, rollback proof, and required environment settings.",
      next_action:
        "Create migrations and prove rollback/RLS on a disposable cloud project before applying anything to beta data.",
      source: "web-beta-readiness.cloud-schema + environment-preflight",
    },
    {
      id: "private-file-storage",
      title: "Private file storage",
      status: fileTrack?.status ?? "blocked",
      stage_type: "storage",
      current_state:
        fileTrack?.evidence ??
        "Local files are not backed by private cloud object storage.",
      missing_before_web_beta:
        "Private buckets, signed URLs, checksums, size limits, blocked public listing, and file audit events.",
      next_action:
        fileTrack?.required_action ??
        "Keep file sync disabled until private storage policy is implemented.",
      source: "web-beta-launch-checklist.private-file-storage",
    },
    {
      id: "sync-push-pull",
      title: "Sync push, pull, and remote baseline",
      status: "blocked",
      stage_type: "sync",
      current_state: `${syncGate?.evidence ?? "Sync API is disabled."} Sync opt-in has ${input.syncOptInGate.summary.blocked} blocked gates and can_start_cloud_sync is false.`,
      missing_before_web_beta:
        "Push/pull endpoints, cursors, acknowledgements, retry/idempotency, remote baseline fetch, conflict review, audit events, and owner confirmation.",
      next_action:
        syncGate?.nextAction ??
        "Implement sync only after payload preview, permission, audit, conflict, and rollback gates are proven.",
      source: "web-beta-readiness.sync-api + sync-opt-in-gate",
    },
    {
      id: "backup-restore",
      title: "Backup, restore, and rollback",
      status: restoreGate?.status ?? "manual-confirmation",
      stage_type: "recovery",
      current_state:
        restoreGate?.evidence ??
        "Restore write-back is disabled and rollback proof is not complete.",
      missing_before_web_beta:
        "Fresh rollback backup, restore scope review, permission check, audit event, sync safety, second confirmation, and failed-restore recovery proof.",
      next_action:
        restoreGate?.nextAction ??
        "Keep restore apply disabled until write-back and rollback gates are proven.",
      source: "web-beta-readiness.restore-writeback-contract",
    },
    {
      id: "permissions-audit",
      title: "Permissions, audit, and high-risk actions",
      status:
        permissionGate?.status === "blocked" || auditGate?.status === "blocked"
          ? "blocked"
          : "partial",
      stage_type: "security",
      current_state: `${permissionGate?.evidence ?? "Permission policy is missing."} ${auditGate?.evidence ?? "Audit policy is missing."}`,
      missing_before_web_beta:
        "Server-side permission enforcement, metadata validators, audit event writes, retention, owner-only audit export, and high-risk confirmation wiring.",
      next_action:
        "Move local policy into authenticated server checks only after validators, audit envelopes, and server test matrix pass.",
      source: "web-beta-readiness.permission-policy + audit-trail-policy",
    },
    {
      id: "deployment-release",
      title: "Deployment, route preflight, and rollback",
      status:
        input.deploymentTarget.summary.blocked > 0 ||
        input.launchChecklist.summary.blocked > 0 ||
        routeGaps > 0
          ? "blocked"
          : (deploymentGate?.status ?? "manual-confirmation"),
      stage_type: "deployment",
      current_state: `${deploymentGate?.evidence ?? "Deployment target is incomplete."} Route preflight has ${routeGaps} missing or mismatched route contracts.`,
      missing_before_web_beta:
        "Preview deployment, environment settings, provider rollback, route smoke tests, cloud writes disabled by default, and owner approval.",
      next_action:
        "Run deployment gates as repeatable checks before any private preview is shared.",
      source:
        "web-beta-deployment-target + web-beta-launch-checklist + route-preflight",
    },
    {
      id: "owner-beta-decision",
      title: "Owner beta launch decision",
      status: "manual-confirmation",
      stage_type: "decision",
      current_state:
        "The app can continue locally, but Web Beta launch still requires an explicit owner go/no-go after P0 gates pass.",
      missing_before_web_beta:
        "Owner review of beta scope, data boundaries, rollback plan, support path, and residual privacy risk.",
      next_action:
        "Make the launch decision only after blocked P0 gates are cleared and verified.",
      source: "stage-gate-summary",
    },
  ];
}

function summarizeStageGates(
  input: WebBetaStageGateInput,
  gates: WebBetaStageGate[]
) {
  const p0GateIds: WebBetaStageGateId[] = [
    "auth-session",
    "cloud-database",
    "private-file-storage",
    "sync-push-pull",
    "permissions-audit",
    "deployment-release",
  ];

  return gates.reduce(
    (summary, gate) => {
      summary.stages += 1;
      if (gate.status === "ready") summary.ready += 1;
      if (gate.status === "partial") summary.partial += 1;
      if (gate.status === "manual-confirmation") {
        summary.manual_confirmation += 1;
      }
      if (gate.status === "blocked") {
        summary.blocked += 1;
        if (p0GateIds.includes(gate.id)) summary.p0_blockers += 1;
      }
      return summary;
    },
    {
      stages: 0,
      ready: 0,
      partial: 0,
      manual_confirmation: 0,
      blocked: 0,
      p0_blockers: 0,
      required_environment_missing:
        input.environmentPreflight?.summary.missing_required ?? 0,
      readiness_blocked: input.readinessReport.summary.blocked,
      launch_blocked: input.launchChecklist.summary.blocked,
      route_mismatch_or_missing:
        input.routePreflight.summary.missing +
        input.routePreflight.summary.status_mismatch,
      deployment_blocked: input.deploymentTarget.summary.blocked,
      sync_opt_in_blocked: input.syncOptInGate.summary.blocked,
    }
  );
}

function findReadinessGate(
  input: Pick<WebBetaStageGateInput, "readinessReport">,
  id: string
): WebBetaReadinessGate | null {
  return input.readinessReport.gates.find((gate) => gate.id === id) ?? null;
}
