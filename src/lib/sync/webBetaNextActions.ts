import type { DeploymentGateContract } from "@/lib/sync/webBetaContract";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { WebBetaLaunchChecklist } from "@/lib/sync/webBetaLaunchChecklist";
import type {
  WebBetaReadinessGate,
  WebBetaReadinessReport,
} from "@/lib/sync/webBetaReadiness";

export type WebBetaNextActionPriority = "p0" | "p1" | "p2";
export type WebBetaNextActionPhase =
  | "account"
  | "cloud-schema"
  | "sync"
  | "recovery"
  | "permissions"
  | "deployment";
export type WebBetaNextActionStatus =
  | "ready-to-build"
  | "needs-owner-decision"
  | "blocked-by-missing-cloud";
export type WebBetaNextActionOwner = "owner" | "developer" | "cloud-admin";
export type WebBetaNextActionExecutionPath =
  | "local-first"
  | "cloud-required"
  | "owner-decision";
export type WebBetaNextActionCloudDependency =
  | "none"
  | "auth-provider"
  | "supabase"
  | "private-storage"
  | "deployment-env";

export interface WebBetaNextActionPlanInput {
  readinessReport: WebBetaReadinessReport;
  launchChecklist: WebBetaLaunchChecklist;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
  deploymentGates: DeploymentGateContract[];
}

export interface WebBetaNextAction {
  id: string;
  phase: WebBetaNextActionPhase;
  priority: WebBetaNextActionPriority;
  status: WebBetaNextActionStatus;
  title: string;
  evidence: string;
  required_action: string;
  unlocks: string;
  source: string;
  privacy_boundary: string;
  owner: WebBetaNextActionOwner;
  execution_path: WebBetaNextActionExecutionPath;
  can_start_locally: boolean;
  cloud_dependency: WebBetaNextActionCloudDependency;
  verification_commands: string[];
  completion_evidence: string[];
  forbidden_until_confirmed: string[];
}

export interface WebBetaNextActionPlan {
  format: "zhinote-web-beta-next-action-plan";
  format_version: 1;
  plan_status: "local-action-plan-only";
  launch_verdict: "not-ready";
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    deploys_app: false;
    creates_accounts: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
  };
  summary: {
    actions: number;
    p0: number;
    p1: number;
    p2: number;
    ready_to_build: number;
    needs_owner_decision: number;
    blocked_by_missing_cloud: number;
    local_first: number;
    cloud_required: number;
    owner_decision: number;
    missing_environment_required: number;
    blocked_launch_tracks: number;
    blocked_deployment_gates: number;
    verification_commands: number;
  };
  actions: WebBetaNextAction[];
}

type WebBetaNextActionExecutionMeta = Pick<
  WebBetaNextAction,
  | "owner"
  | "execution_path"
  | "can_start_locally"
  | "cloud_dependency"
  | "verification_commands"
  | "completion_evidence"
  | "forbidden_until_confirmed"
>;

const DEFAULT_FORBIDDEN_ACTIONS = [
  "Do not enable sync push or pull.",
  "Do not upload workspace data.",
  "Do not expose file bytes or page bodies.",
  "Do not create production accounts or server data.",
];

const ACTION_EXECUTION_META: Record<string, WebBetaNextActionExecutionMeta> = {
  "choose-auth-session-model": {
    owner: "owner",
    execution_path: "owner-decision",
    can_start_locally: true,
    cloud_dependency: "auth-provider",
    verification_commands: ["npm run verify:web-beta"],
    completion_evidence: [
      "Auth provider and session model are selected.",
      "Workspace membership and device revoke behavior are documented.",
      "Owner confirmation exists before local-to-cloud linking.",
    ],
    forbidden_until_confirmed: DEFAULT_FORBIDDEN_ACTIONS,
  },
  "configure-web-beta-environment": {
    owner: "cloud-admin",
    execution_path: "cloud-required",
    can_start_locally: false,
    cloud_dependency: "deployment-env",
    verification_commands: ["npm run verify:web-beta", "npm run build"],
    completion_evidence: [
      "Required environment variables pass presence-only preflight.",
      "No secret values are exposed in the preflight output.",
      "Preview origin and app URL are explicitly scoped.",
    ],
    forbidden_until_confirmed: DEFAULT_FORBIDDEN_ACTIONS,
  },
  "create-reversible-cloud-migrations": {
    owner: "developer",
    execution_path: "local-first",
    can_start_locally: true,
    cloud_dependency: "supabase",
    verification_commands: ["npm run verify:web-beta", "npm run build"],
    completion_evidence: [
      "Versioned migrations exist for the contracted cloud tables.",
      "Rollback/RLS proof is captured on disposable beta data.",
      "Migration apply remains disabled until owner confirmation.",
    ],
    forbidden_until_confirmed: DEFAULT_FORBIDDEN_ACTIONS,
  },
  "implement-server-permission-checks": {
    owner: "developer",
    execution_path: "local-first",
    can_start_locally: true,
    cloud_dependency: "none",
    verification_commands: ["npm run verify:web-beta", "npm run build"],
    completion_evidence: [
      "Permission request validator rejects forbidden payload classes.",
      "Owner, Researcher, and Viewer matrix tests are represented.",
      "The API route stays disabled until authenticated enforcement exists.",
    ],
    forbidden_until_confirmed: [
      "Do not trust client-only permission checks.",
      "Do not allow restore, sync, sharing, AI, or file access without server checks.",
    ],
  },
  "build-private-file-storage": {
    owner: "cloud-admin",
    execution_path: "cloud-required",
    can_start_locally: true,
    cloud_dependency: "private-storage",
    verification_commands: ["npm run verify:web-beta"],
    completion_evidence: [
      "Private bucket policy blocks public listing.",
      "Signed URL flow enforces size, MIME, checksum, and audit metadata.",
      "File sync remains disabled until storage proof is complete.",
    ],
    forbidden_until_confirmed: [
      "Do not store reports, PDFs, Office files, archives, or notebooks in public storage.",
      "Do not include file bytes in generic sync payloads.",
    ],
  },
  "implement-sync-push-pull-replay": {
    owner: "developer",
    execution_path: "local-first",
    can_start_locally: true,
    cloud_dependency: "supabase",
    verification_commands: [
      "npm run verify:web-beta",
      "npm run verify:replay-harness",
      "npm run build",
    ],
    completion_evidence: [
      "Push/pull contracts include cursor, acknowledgement, retry, and idempotency.",
      "Disposable replay evidence proves denylist, RLS scope, and rollback.",
      "Owner sync opt-in receipt exists before real cloud sync starts.",
    ],
    forbidden_until_confirmed: DEFAULT_FORBIDDEN_ACTIONS,
  },
  "build-conflict-review-ui": {
    owner: "developer",
    execution_path: "local-first",
    can_start_locally: true,
    cloud_dependency: "none",
    verification_commands: ["npm run verify:web-beta", "npm run build"],
    completion_evidence: [
      "Side-by-side conflict review covers page, database, file, permission, and restore conflicts.",
      "No conflict resolution applies changes without explicit review.",
      "Disposable replay stays empty-fixture until owner confirmation.",
    ],
    forbidden_until_confirmed: [
      "Do not auto-merge conflicts.",
      "Do not acknowledge remote rows before conflict review succeeds.",
    ],
  },
  "prove-restore-writeback-rollback": {
    owner: "developer",
    execution_path: "local-first",
    can_start_locally: true,
    cloud_dependency: "none",
    verification_commands: ["npm run verify:web-beta", "npm run build"],
    completion_evidence: [
      "Fresh rollback backup is required before restore apply.",
      "Restore scope review, permission check, audit event, and second confirmation are represented.",
      "Failed-restore recovery proof exists before write-back is enabled.",
    ],
    forbidden_until_confirmed: [
      "Do not enable /api/backup/restore-apply.",
      "Do not overwrite or delete workspace data from preview alone.",
    ],
  },
  "implement-audit-events": {
    owner: "developer",
    execution_path: "local-first",
    can_start_locally: true,
    cloud_dependency: "none",
    verification_commands: ["npm run verify:web-beta", "npm run build"],
    completion_evidence: [
      "Audit envelope validation rejects forbidden payloads.",
      "Retention, owner-only export, and incident review are specified.",
      "Server writes stay disabled until authenticated audit route exists.",
    ],
    forbidden_until_confirmed: [
      "Do not write page bodies, file bytes, tokens, cookies, or secret values into audit events.",
    ],
  },
  "automate-deployment-gates": {
    owner: "developer",
    execution_path: "local-first",
    can_start_locally: true,
    cloud_dependency: "deployment-env",
    verification_commands: [
      "npm run lint",
      "npm run verify:web-beta",
      "npm run verify:web-beta:smoke",
      "npm run build",
    ],
    completion_evidence: [
      "CI or release checklist runs local verification gates.",
      "Preview route checks pass before owner go/no-go.",
      "Rollback and export escape hatches are included.",
    ],
    forbidden_until_confirmed: [
      "Do not deploy public beta before P0/P1 gates pass.",
      "Do not enable sync, AI, external assets, or restore write-back from deployment alone.",
    ],
  },
  "owner-beta-launch-decision": {
    owner: "owner",
    execution_path: "owner-decision",
    can_start_locally: false,
    cloud_dependency: "deployment-env",
    verification_commands: [
      "npm run verify:web-beta",
      "npm run verify:web-beta:smoke",
      "npm run build",
    ],
    completion_evidence: [
      "Owner approves private beta scope, data boundary, rollback plan, and support process.",
      "P0/P1 blockers have evidence attached.",
      "Cloud sync and AI remain opt-in after launch.",
    ],
    forbidden_until_confirmed: DEFAULT_FORBIDDEN_ACTIONS,
  },
};

export function buildWebBetaNextActionPlan(
  input: WebBetaNextActionPlanInput
): WebBetaNextActionPlan {
  const actions = buildActions(input).sort(sortActions);
  const summary = summarizeActions(input, actions);

  return {
    format: "zhinote-web-beta-next-action-plan",
    format_version: 1,
    plan_status: "local-action-plan-only",
    launch_verdict: "not-ready",
    privacy_note:
      "Generated locally. This action plan reads readiness contracts, route checks, environment presence results, and local counts only. It does not deploy the app, create accounts, connect cloud services, write server data, upload workspace data, read page bodies, or read file bytes.",
    boundary: {
      local_plan_only: true,
      deploys_app: false,
      creates_accounts: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
    },
    summary,
    actions,
  };
}

function buildActions(
  input: WebBetaNextActionPlanInput
): WebBetaNextAction[] {
  const gatesById = new Map(
    input.readinessReport.gates.map((gate) => [gate.id, gate])
  );
  const tracksById = new Map(
    input.launchChecklist.tracks.map((track) => [track.id, track])
  );

  return [
    fromGate({
      id: "choose-auth-session-model",
      phase: "account",
      priority: "p0",
      gate: gatesById.get("account-session-boundary"),
      fallbackTitle: "Choose account and session model",
      fallbackEvidence:
        "Private beta cannot start until account login, session storage, workspace membership, and local-to-cloud linking are specified.",
      fallbackAction:
        "Choose auth provider, session cookie design, device revoke behavior, workspace membership rules, and owner confirmation for local-to-cloud linking.",
      status: "needs-owner-decision",
      unlocks: "Login, workspace membership, cloud workspace linking, and server-side permission checks.",
    }),
    fromGate({
      id: "configure-web-beta-environment",
      phase: "deployment",
      priority: "p0",
      gate: gatesById.get("environment-preflight"),
      fallbackTitle: "Configure Web Beta environment",
      fallbackEvidence:
        "Environment preflight has not produced a complete required-variable pass.",
      fallbackAction:
        "Configure auth, cloud database, private file storage, app URL, allowed origin, audit retention, and optional monitoring variables.",
      status:
        input.environmentPreflight?.summary.missing_required === 0
          ? "ready-to-build"
          : "blocked-by-missing-cloud",
      unlocks: "Private beta deployment checks and cloud route enablement.",
    }),
    fromGate({
      id: "create-reversible-cloud-migrations",
      phase: "cloud-schema",
      priority: "p0",
      gate: gatesById.get("cloud-schema"),
      fallbackTitle: "Create reversible cloud migrations",
      fallbackEvidence:
        "Cloud schema contract exists locally, but no applied migration is proven.",
      fallbackAction:
        "Turn contracted tables into versioned migrations, run them on disposable beta data, and prove rollback before enabling migration apply.",
      status: "ready-to-build",
      unlocks: "Cloud persistence for pages, databases, files, sync_log, permissions, and audit events.",
    }),
    fromGate({
      id: "implement-server-permission-checks",
      phase: "permissions",
      priority: "p0",
      gate: gatesById.get("permission-policy"),
      fallbackTitle: "Implement server permission checks",
      fallbackEvidence:
        "Local role decisions, a metadata-only permission check envelope, local validator fixtures, a server permission test matrix, a server permission readiness report, and a dedicated disabled /api/permissions/check schema guard exist, but server endpoints do not enforce roles.",
      fallbackAction:
        "Move Owner, Researcher, and Viewer decisions into authenticated server checks only after the route runs validator-backed forbidden payload rejection, server matrix tests, readiness gates, and high-risk actions stay owner-confirmed.",
      status: "ready-to-build",
      unlocks: "Safe auth routes, sync push/pull, restore, file access, sharing, and AI gates.",
    }),
    fromTrack({
      id: "build-private-file-storage",
      phase: "cloud-schema",
      priority: "p0",
      track: tracksById.get("private-file-storage"),
      fallbackTitle: "Build private file storage",
      fallbackEvidence:
        "HTML reports, PDFs, Office files, archives, and notebooks need private storage before sync.",
      fallbackAction:
        "Configure private buckets, signed URLs, checksums, size limits, blocked public listing, and file audit events.",
      status: "blocked-by-missing-cloud",
      unlocks: "Safe cloud handling for reports, PDFs, Excel, Word, PPT, archives, and notebooks.",
    }),
    fromGate({
      id: "implement-sync-push-pull-replay",
      phase: "sync",
      priority: "p1",
      gate: gatesById.get("sync-api"),
      fallbackTitle: "Implement sync push and pull replay",
      fallbackEvidence:
        "Sync routes are disabled stubs; no cursor, acknowledgement, retry, or durable remote persistence exists.",
      fallbackAction:
        "Implement push, pull, cursor, acknowledgement, retry/idempotency, dead-letter state, and audit events after payload preview.",
      status: "ready-to-build",
      unlocks: "First private-alpha cloud sync after owner confirmation.",
    }),
    fromGate({
      id: "build-conflict-review-ui",
      phase: "sync",
      priority: "p1",
      gate: gatesById.get("conflict-resolution"),
      fallbackTitle: "Run disposable remote baseline replay",
      fallbackEvidence:
        "Conflict policies, side-by-side preview, remote baseline request/staging/schema contracts, disposable replay/RLS proof contract, local replay confirmation receipt, empty-fixture replay package, harness preflight, and disabled runner skeleton exist, but no actual empty-fixture replay has run.",
      fallbackAction:
        "Export owner confirmation, the empty-fixture package, harness preflight, and disabled runner skeleton, then run disposable replay with empty workspace fixtures to prove payload denylist, RLS scope, cursor monotonicity, idempotency, and rollback while keeping apply disabled.",
      status: "ready-to-build",
      unlocks: "Multi-device editing without silent overwrites.",
    }),
    fromGate({
      id: "prove-restore-writeback-rollback",
      phase: "recovery",
      priority: "p1",
      gate: gatesById.get("restore-writeback-contract"),
      fallbackTitle: "Prove restore write-back and rollback",
      fallbackEvidence:
        "Restore write-back remains disabled until rollback snapshot, permission, audit, sync safety, and recovery proof exist.",
      fallbackAction:
        "Implement restore apply only after fresh rollback backup, scope review, permission check, audit event, second confirmation, and failed-restore recovery proof.",
      status: "ready-to-build",
      unlocks: "Safe backup restore for private beta users.",
    }),
    fromGate({
      id: "implement-audit-events",
      phase: "permissions",
      priority: "p1",
      gate: gatesById.get("audit-trail-policy"),
      fallbackTitle: "Implement audit events",
      fallbackEvidence:
        "Audit policy and metadata-only audit event envelope exist locally, but server audit writes and retention are disabled.",
      fallbackAction:
        "Implement authenticated audit_events writes only after envelope validation rejects forbidden payloads, then add retention, owner-only export, and incident review.",
      status: "ready-to-build",
      unlocks: "Traceability for login, export, restore, sync, file, AI, permission, and admin actions.",
    }),
    fromTrack({
      id: "automate-deployment-gates",
      phase: "deployment",
      priority: "p2",
      track: tracksById.get("deployment-gates"),
      fallbackTitle: "Automate deployment gates",
      fallbackEvidence:
        "Deployment gates are documented, but not automated as tests or owner approval checks.",
      fallbackAction:
        "Turn auth, migration, sync replay, conflict, restore, file storage, payload preview, and export gates into CI or release checklist checks.",
      status: "ready-to-build",
      unlocks: "Repeatable private beta launch procedure.",
    }),
    {
      id: "owner-beta-launch-decision",
      phase: "deployment",
      priority: "p2",
      status: "needs-owner-decision",
      title: "Owner beta launch decision",
      evidence: `${input.readinessReport.summary.blocked} readiness gates, ${input.launchChecklist.summary.blocked} launch tracks, and ${input.deploymentGates.filter((gate) => gate.status === "blocked").length} deployment gates remain blocked.`,
      required_action:
        "After P0/P1 items are proven, require an owner review of beta scope, data boundaries, rollback plan, and support process before launch.",
      unlocks: "Private beta go/no-go.",
      source: "readiness-summary",
      privacy_boundary:
        "Decision record should cite counts and checklist status only, not private note text, file bytes, secrets, or holdings.",
      ...getExecutionMeta("owner-beta-launch-decision"),
    },
  ];
}

function fromGate({
  id,
  phase,
  priority,
  gate,
  fallbackTitle,
  fallbackEvidence,
  fallbackAction,
  status,
  unlocks,
}: {
  id: string;
  phase: WebBetaNextActionPhase;
  priority: WebBetaNextActionPriority;
  gate: WebBetaReadinessGate | undefined;
  fallbackTitle: string;
  fallbackEvidence: string;
  fallbackAction: string;
  status: WebBetaNextActionStatus;
  unlocks: string;
}): WebBetaNextAction {
  return {
    id,
    phase,
    priority,
    status,
    title: gate?.title ?? fallbackTitle,
    evidence: gate?.evidence ?? fallbackEvidence,
    required_action: gate?.nextAction ?? fallbackAction,
    unlocks,
    source: gate ? `readiness:${gate.id}` : "readiness:fallback",
    privacy_boundary:
      "Action planning uses local readiness evidence only and does not include page bodies, database row values, file bytes, tokens, secrets, or cloud data.",
    ...getExecutionMeta(id),
  };
}

function fromTrack({
  id,
  phase,
  priority,
  track,
  fallbackTitle,
  fallbackEvidence,
  fallbackAction,
  status,
  unlocks,
}: {
  id: string;
  phase: WebBetaNextActionPhase;
  priority: WebBetaNextActionPriority;
  track: WebBetaLaunchChecklist["tracks"][number] | undefined;
  fallbackTitle: string;
  fallbackEvidence: string;
  fallbackAction: string;
  status: WebBetaNextActionStatus;
  unlocks: string;
}): WebBetaNextAction {
  return {
    id,
    phase,
    priority,
    status,
    title: track?.title ?? fallbackTitle,
    evidence: track?.evidence ?? fallbackEvidence,
    required_action: track?.required_action ?? fallbackAction,
    unlocks,
    source: track ? `launch-checklist:${track.id}` : "launch-checklist:fallback",
    privacy_boundary:
      "Action planning uses launch checklist metadata only and does not include private workspace content.",
    ...getExecutionMeta(id),
  };
}

function getExecutionMeta(id: string): WebBetaNextActionExecutionMeta {
  return (
    ACTION_EXECUTION_META[id] ?? {
      owner: "developer",
      execution_path: "local-first",
      can_start_locally: true,
      cloud_dependency: "none",
      verification_commands: ["npm run verify:web-beta", "npm run build"],
      completion_evidence: [
        "Local contract and UI evidence are present.",
        "No private payload leaves the browser-local workspace.",
      ],
      forbidden_until_confirmed: DEFAULT_FORBIDDEN_ACTIONS,
    }
  );
}

function summarizeActions(
  input: WebBetaNextActionPlanInput,
  actions: WebBetaNextAction[]
) {
  return {
    actions: actions.length,
    p0: actions.filter((action) => action.priority === "p0").length,
    p1: actions.filter((action) => action.priority === "p1").length,
    p2: actions.filter((action) => action.priority === "p2").length,
    ready_to_build: actions.filter(
      (action) => action.status === "ready-to-build"
    ).length,
    needs_owner_decision: actions.filter(
      (action) => action.status === "needs-owner-decision"
    ).length,
    blocked_by_missing_cloud: actions.filter(
      (action) => action.status === "blocked-by-missing-cloud"
    ).length,
    local_first: actions.filter((action) => action.execution_path === "local-first")
      .length,
    cloud_required: actions.filter(
      (action) => action.execution_path === "cloud-required"
    ).length,
    owner_decision: actions.filter(
      (action) => action.execution_path === "owner-decision"
    ).length,
    missing_environment_required:
      input.environmentPreflight?.summary.missing_required ?? 0,
    blocked_launch_tracks: input.launchChecklist.summary.blocked,
    blocked_deployment_gates: input.deploymentGates.filter(
      (gate) => gate.status === "blocked"
    ).length,
    verification_commands: new Set(
      actions.flatMap((action) => action.verification_commands)
    ).size,
  };
}

function sortActions(a: WebBetaNextAction, b: WebBetaNextAction) {
  const priorityDelta =
    priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const statusDelta = statusRank(a.status) - statusRank(b.status);
  if (statusDelta !== 0) return statusDelta;

  return a.phase.localeCompare(b.phase);
}

function priorityRank(priority: WebBetaNextActionPriority) {
  if (priority === "p0") return 0;
  if (priority === "p1") return 1;
  return 2;
}

function statusRank(status: WebBetaNextActionStatus) {
  if (status === "ready-to-build") return 0;
  if (status === "needs-owner-decision") return 1;
  return 2;
}
