import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import {
  DEFAULT_PERMISSION_RULES,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  PERMISSION_ROLES,
  RISKY_PERMISSION_ACTIONS,
  type PermissionActionId,
  type PermissionResourceId,
  type PermissionRoleId,
} from "@/lib/security/permissionPolicy";

export type PermissionDecisionStatus =
  | "local-allowed"
  | "local-denied"
  | "needs-confirmation"
  | "server-blocked";

export interface PermissionDecisionInput {
  roleId: PermissionRoleId;
  resourceId: PermissionResourceId;
  actionId: PermissionActionId;
  riskActionId?: string;
}

export interface PermissionDecision {
  role_id: PermissionRoleId;
  resource_id: PermissionResourceId;
  action_id: PermissionActionId;
  risk_action_id: string | null;
  decision_status: PermissionDecisionStatus;
  local_rule_allows: boolean;
  requires_manual_confirmation: boolean;
  requires_server_permission_check: true;
  requires_audit_event: true;
  server_enforcement_ready: false;
  disabled_endpoint: "/api/permissions/check";
  reason: string;
  required_before_enablement: string;
  privacy_boundary: string;
}

export interface PermissionDecisionScenario {
  id: string;
  title: string;
  roleId: PermissionRoleId;
  resourceId: PermissionResourceId;
  actionId: PermissionActionId;
  riskActionId?: string;
}

export interface PermissionDecisionReport {
  format: "zhinote-permission-decision-report";
  format_version: 1;
  report_status: "local-decision-preview";
  can_enforce_server_permissions: false;
  disabled_endpoint: "/api/permissions/check";
  privacy_note: string;
  boundary: {
    local_decision_preview_only: true;
    creates_users: false;
    grants_access: false;
    revokes_access: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    writes_server_audit_log: false;
    requires_server_enforcement_before_beta: true;
  };
  summary: {
    roles: number;
    resources: number;
    actions: number;
    matrix_decisions: number;
    high_risk_scenarios: number;
    needs_confirmation: number;
    local_denied: number;
    server_blocked: number;
  };
  matrix: PermissionDecision[];
  high_risk_scenarios: Array<
    PermissionDecisionScenario & {
      decision: PermissionDecision;
    }
  >;
  gates: Array<{
    id: string;
    title: string;
    status: "blocked" | "manual-confirmation" | "planned";
    evidence: string;
    required_action: string;
  }>;
}

const HIGH_RISK_ACTION_IDS = new Set<PermissionActionId>([
  "sync",
  "ai",
  "share",
  "admin",
]);

export const DEFAULT_PERMISSION_DECISION_SCENARIOS: PermissionDecisionScenario[] =
  [
    {
      id: "owner-cloud-sync",
      title: "Owner starts cloud sync",
      roleId: "owner",
      resourceId: "sync",
      actionId: "sync",
      riskActionId: "cloud-sync",
    },
    {
      id: "researcher-cloud-sync",
      title: "Researcher starts cloud sync",
      roleId: "researcher",
      resourceId: "sync",
      actionId: "sync",
      riskActionId: "cloud-sync",
    },
    {
      id: "viewer-export-page",
      title: "Viewer exports a research page",
      roleId: "viewer",
      resourceId: "pages",
      actionId: "export",
    },
    {
      id: "viewer-run-ai",
      title: "Viewer runs AI on selected context",
      roleId: "viewer",
      resourceId: "ai",
      actionId: "ai",
      riskActionId: "ai-execution",
    },
    {
      id: "researcher-run-ai",
      title: "Researcher runs AI on selected context",
      roleId: "researcher",
      resourceId: "ai",
      actionId: "ai",
      riskActionId: "ai-execution",
    },
    {
      id: "researcher-share-report",
      title: "Researcher shares a report",
      roleId: "researcher",
      resourceId: "reports",
      actionId: "share",
      riskActionId: "sharing",
    },
    {
      id: "owner-change-permissions",
      title: "Owner changes workspace permissions",
      roleId: "owner",
      resourceId: "sync",
      actionId: "admin",
      riskActionId: "sharing",
    },
    {
      id: "viewer-edit-portfolio",
      title: "Viewer edits portfolio data",
      roleId: "viewer",
      resourceId: "portfolio",
      actionId: "edit",
    },
  ];

export function evaluatePermissionDecision(
  input: PermissionDecisionInput
): PermissionDecision {
  const rule = DEFAULT_PERMISSION_RULES.find(
    (item) =>
      item.roleId === input.roleId && item.resourceId === input.resourceId
  );
  const localRuleAllows = Boolean(rule?.actions.includes(input.actionId));
  const highRisk =
    HIGH_RISK_ACTION_IDS.has(input.actionId) || Boolean(input.riskActionId);
  const requiresManualConfirmation = localRuleAllows && highRisk;
  const decisionStatus = getDecisionStatus(
    localRuleAllows,
    requiresManualConfirmation
  );

  return {
    role_id: input.roleId,
    resource_id: input.resourceId,
    action_id: input.actionId,
    risk_action_id: input.riskActionId ?? null,
    decision_status: decisionStatus,
    local_rule_allows: localRuleAllows,
    requires_manual_confirmation: requiresManualConfirmation,
    requires_server_permission_check: true,
    requires_audit_event: true,
    server_enforcement_ready: false,
    disabled_endpoint: "/api/permissions/check",
    reason: getDecisionReason(input, localRuleAllows, highRisk),
    required_before_enablement:
      "Move this local decision to an authenticated server-side permission check, then write a redacted audit event before the action executes.",
    privacy_boundary:
      "Permission decisions use role, resource, action, risk type, and ids only; they do not require page body text, prompt text, file bytes, or secret values.",
  };
}

export function buildPermissionDecisionReport(input?: {
  auditTrailPolicy?: AuditTrailPolicy | null;
}): PermissionDecisionReport {
  const matrix = PERMISSION_ROLES.flatMap((role) =>
    PERMISSION_RESOURCES.flatMap((resource) =>
      PERMISSION_ACTIONS.map((action) =>
        evaluatePermissionDecision({
          roleId: role.id,
          resourceId: resource.id,
          actionId: action.id,
        })
      )
    )
  );
  const highRiskScenarios = DEFAULT_PERMISSION_DECISION_SCENARIOS.map(
    (scenario) => ({
      ...scenario,
      decision: evaluatePermissionDecision({
        roleId: scenario.roleId,
        resourceId: scenario.resourceId,
        actionId: scenario.actionId,
        riskActionId: scenario.riskActionId,
      }),
    })
  );
  const allDecisions = [
    ...matrix,
    ...highRiskScenarios.map((scenario) => scenario.decision),
  ];

  return {
    format: "zhinote-permission-decision-report",
    format_version: 1,
    report_status: "local-decision-preview",
    can_enforce_server_permissions: false,
    disabled_endpoint: "/api/permissions/check",
    privacy_note:
      "Generated locally. This report previews permission decisions only; it does not create users, grant access, revoke access, read page text, read file bytes, upload workspace data, or write server audit logs.",
    boundary: {
      local_decision_preview_only: true,
      creates_users: false,
      grants_access: false,
      revokes_access: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      uploads_workspace_data: false,
      writes_server_audit_log: false,
      requires_server_enforcement_before_beta: true,
    },
    summary: {
      roles: PERMISSION_ROLES.length,
      resources: PERMISSION_RESOURCES.length,
      actions: PERMISSION_ACTIONS.length,
      matrix_decisions: matrix.length,
      high_risk_scenarios: highRiskScenarios.length,
      needs_confirmation: allDecisions.filter(
        (item) => item.decision_status === "needs-confirmation"
      ).length,
      local_denied: allDecisions.filter(
        (item) => item.decision_status === "local-denied"
      ).length,
      server_blocked: allDecisions.filter(
        (item) => item.decision_status === "server-blocked"
      ).length,
    },
    matrix,
    high_risk_scenarios: highRiskScenarios,
    gates: [
      {
        id: "server-enforcement",
        title: "Server-side permission enforcement",
        status: "blocked",
        evidence:
          "The local permission matrix exists, but /api/permissions/check is still a disabled stub.",
        required_action:
          "Implement authenticated server checks for every export, restore, sync, sharing, AI, file, and admin action before private beta.",
      },
      {
        id: "manual-confirmation",
        title: "Manual confirmation for high-risk actions",
        status: "manual-confirmation",
        evidence: `${RISKY_PERMISSION_ACTIONS.length} high-risk action groups require visible confirmation before execution.`,
        required_action:
          "Require payload preview, restore scope review, AI provider/retention review, or sharing confirmation before allowed high-risk actions execute.",
      },
      {
        id: "audit-integration",
        title: "Audit integration",
        status: input?.auditTrailPolicy ? "planned" : "blocked",
        evidence: input?.auditTrailPolicy
          ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but server audit writes are disabled.`
          : "No audit policy is attached to this permission decision report.",
        required_action:
          "Write a redacted audit event for every permission decision once the server audit trail exists.",
      },
    ],
  };
}

function getDecisionStatus(
  localRuleAllows: boolean,
  requiresManualConfirmation: boolean
): PermissionDecisionStatus {
  if (!localRuleAllows) return "local-denied";
  if (requiresManualConfirmation) return "needs-confirmation";
  return "local-allowed";
}

function getDecisionReason(
  input: PermissionDecisionInput,
  localRuleAllows: boolean,
  highRisk: boolean
) {
  if (!localRuleAllows) {
    return `${input.roleId} does not have ${input.actionId} permission on ${input.resourceId} in the local policy draft.`;
  }

  if (highRisk) {
    return `${input.roleId} is locally allowed, but ${input.actionId} on ${input.resourceId} is high risk and needs visible confirmation plus server enforcement before execution.`;
  }

  return `${input.roleId} is locally allowed to ${input.actionId} ${input.resourceId}, but private beta still requires server-side enforcement before trusting the decision.`;
}
