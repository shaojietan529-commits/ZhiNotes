import type {
  WebBetaNextAction,
  WebBetaNextActionPlan,
} from "@/lib/sync/webBetaNextActions";
import type { WebBetaOwnerReviewPacket } from "@/lib/sync/webBetaOwnerReviewPacket";
import type { WebLaunchWorkbenchPacket } from "@/lib/sync/webLaunchWorkbench";

export type WebBetaAutonomyQueueStatus =
  | "continue-locally"
  | "hold-for-owner"
  | "hold-for-cloud"
  | "forbidden";

export type WebBetaAutonomyQueueSource =
  | "next-action"
  | "owner-review"
  | "forbidden-action";

export interface WebBetaAutonomyQueueItem {
  id: string;
  source: WebBetaAutonomyQueueSource;
  status: WebBetaAutonomyQueueStatus;
  priority: WebBetaNextAction["priority"] | "blocked";
  phase: WebBetaNextAction["phase"] | "approval";
  title: string;
  evidence: string;
  next_action: string;
  hold_reason: string;
  owner: WebBetaNextAction["owner"] | "owner";
  cloud_dependency: WebBetaNextAction["cloud_dependency"] | "none";
  can_start_without_owner: boolean;
  can_start_without_cloud: boolean;
  verification_commands: string[];
  completion_evidence: string[];
  forbidden_until_confirmed: string[];
}

export interface WebBetaAutonomyQueue {
  format: "zhinote-web-beta-autonomy-queue";
  format_version: 1;
  queue_status: "local-autonomy-queue-only";
  launch_verdict: "not-ready";
  can_continue_local_code_work: true;
  web_beta_can_launch_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_queue_only: true;
    reads_next_action_metadata: true;
    reads_owner_review_metadata: true;
    reads_workbench_metadata: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_tokens_or_cookies: false;
    reads_holdings_or_trading_plans: false;
    deploys_app: false;
    creates_accounts: false;
    connects_cloud_services: false;
    writes_workspace_data: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enables_sync: false;
    enables_ai: false;
    requires_owner_confirmation_before_cloud: true;
  };
  summary: {
    items: number;
    continue_locally: number;
    hold_for_owner: number;
    hold_for_cloud: number;
    forbidden: number;
    verification_commands: number;
    completion_evidence: number;
    excluded_payload_classes: number;
  };
  recommended_local_batch: string[];
  required_verification_commands: string[];
  excluded_payload_classes: string[];
  items: WebBetaAutonomyQueueItem[];
}

export function buildWebBetaAutonomyQueue(input: {
  nextActionPlan: WebBetaNextActionPlan;
  ownerReviewPacket: WebBetaOwnerReviewPacket;
  workbench: WebLaunchWorkbenchPacket;
}): WebBetaAutonomyQueue {
  const items = [
    ...buildContinueLocalItems(input.nextActionPlan),
    ...buildOwnerHoldItems(input.nextActionPlan),
    ...buildCloudHoldItems(input.nextActionPlan),
    ...buildForbiddenItems(input),
  ];
  const continueLocalItems = items.filter(
    (item) => item.status === "continue-locally"
  );
  const requiredVerificationCommands = unique(
    continueLocalItems.flatMap((item) => item.verification_commands)
  );

  return {
    format: "zhinote-web-beta-autonomy-queue",
    format_version: 1,
    queue_status: "local-autonomy-queue-only",
    launch_verdict: "not-ready",
    can_continue_local_code_work: true,
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally from Web Beta next-action, owner-review, and workbench metadata. This queue is for overnight/local development triage only: it does not read page body text, database row values, file names, file bytes, secret values, tokens, cookies, holdings, trading plans, cloud data, or credentials; it does not deploy the app, create accounts, connect cloud services, write server data, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_queue_only: true,
      reads_next_action_metadata: true,
      reads_owner_review_metadata: true,
      reads_workbench_metadata: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_tokens_or_cookies: false,
      reads_holdings_or_trading_plans: false,
      deploys_app: false,
      creates_accounts: false,
      connects_cloud_services: false,
      writes_workspace_data: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_cloud: true,
    },
    summary: summarizeItems(
      items,
      requiredVerificationCommands,
      input.workbench.excluded_payload_classes
    ),
    recommended_local_batch: continueLocalItems
      .slice(0, 4)
      .map((item) => item.id),
    required_verification_commands: requiredVerificationCommands,
    excluded_payload_classes: input.workbench.excluded_payload_classes,
    items,
  };
}

function buildContinueLocalItems(
  nextActionPlan: WebBetaNextActionPlan
): WebBetaAutonomyQueueItem[] {
  return nextActionPlan.actions
    .filter(
      (action) =>
        action.status === "ready-to-build" &&
        action.can_start_locally &&
        action.execution_path === "local-first" &&
        action.cloud_dependency === "none" &&
        action.owner === "developer"
    )
    .map((action) =>
      actionToQueueItem({
        action,
        status: "continue-locally",
        holdReason:
          "用户不在时可以本地实现，因为不需要云账号、不需要部署、不上传数据，也不需要用户确认。",
        canStartWithoutOwner: true,
        canStartWithoutCloud: true,
      })
    );
}

function buildOwnerHoldItems(
  nextActionPlan: WebBetaNextActionPlan
): WebBetaAutonomyQueueItem[] {
  return nextActionPlan.actions
    .filter(
      (action) =>
        action.status === "needs-owner-decision" ||
        action.execution_path === "owner-decision" ||
        action.owner === "owner"
    )
    .map((action) =>
      actionToQueueItem({
        action,
        status: "hold-for-owner",
        holdReason:
          "等待用户确认产品范围、云端边界、上线风险或账号/session 方案。",
        canStartWithoutOwner: false,
        canStartWithoutCloud: action.cloud_dependency === "none",
      })
    );
}

function buildCloudHoldItems(
  nextActionPlan: WebBetaNextActionPlan
): WebBetaAutonomyQueueItem[] {
  return nextActionPlan.actions
    .filter(
      (action) =>
        action.cloud_dependency !== "none" ||
        action.execution_path === "cloud-required" ||
        action.status === "blocked-by-missing-cloud"
    )
    .filter(
      (action) =>
        action.status !== "needs-owner-decision" &&
        action.execution_path !== "owner-decision"
    )
    .map((action) =>
      actionToQueueItem({
        action,
        status: "hold-for-cloud",
        holdReason:
          "等待云环境，因为这需要云服务商、部署环境、私有存储或 Supabase 证明，不适合在用户不在时处理。",
        canStartWithoutOwner: action.owner !== "owner",
        canStartWithoutCloud: false,
      })
    );
}

function buildForbiddenItems(input: {
  ownerReviewPacket: WebBetaOwnerReviewPacket;
  workbench: WebLaunchWorkbenchPacket;
}): WebBetaAutonomyQueueItem[] {
  return unique([
    ...input.ownerReviewPacket.forbidden_actions_before_owner_approval,
    ...input.workbench.forbidden_actions_before_owner_approval,
  ]).map((actionId) => ({
    id: actionId,
    source: "forbidden-action",
    status: "forbidden",
    priority: "blocked",
    phase: "approval",
    title: actionId,
    evidence:
      "这个动作在 Web Beta 用户复核或上线工作台里被明确标记为确认前禁止。",
    next_action:
      "本地自主工作期间不要执行；等待用户确认并通过上线门禁。",
    hold_reason:
      "需要用户确认，因为这个动作可能部署、连云、上传工作区数据、启用同步、启用 AI 或暴露敏感载荷。",
    owner: "owner",
    cloud_dependency: "none",
    can_start_without_owner: false,
    can_start_without_cloud: false,
    verification_commands: [],
    completion_evidence: [],
    forbidden_until_confirmed: [actionId],
  }));
}

function actionToQueueItem({
  action,
  status,
  holdReason,
  canStartWithoutOwner,
  canStartWithoutCloud,
}: {
  action: WebBetaNextAction;
  status: WebBetaAutonomyQueueStatus;
  holdReason: string;
  canStartWithoutOwner: boolean;
  canStartWithoutCloud: boolean;
}): WebBetaAutonomyQueueItem {
  return {
    id: action.id,
    source: "next-action",
    status,
    priority: action.priority,
    phase: action.phase,
    title: action.title,
    evidence: action.evidence,
    next_action: action.required_action,
    hold_reason: holdReason,
    owner: action.owner,
    cloud_dependency: action.cloud_dependency,
    can_start_without_owner: canStartWithoutOwner,
    can_start_without_cloud: canStartWithoutCloud,
    verification_commands: action.verification_commands,
    completion_evidence: action.completion_evidence,
    forbidden_until_confirmed: action.forbidden_until_confirmed,
  };
}

function summarizeItems(
  items: WebBetaAutonomyQueueItem[],
  requiredVerificationCommands: string[],
  excludedPayloadClasses: string[]
) {
  return {
    items: items.length,
    continue_locally: items.filter((item) => item.status === "continue-locally")
      .length,
    hold_for_owner: items.filter((item) => item.status === "hold-for-owner")
      .length,
    hold_for_cloud: items.filter((item) => item.status === "hold-for-cloud")
      .length,
    forbidden: items.filter((item) => item.status === "forbidden").length,
    verification_commands: requiredVerificationCommands.length,
    completion_evidence: unique(
      items.flatMap((item) => item.completion_evidence)
    ).length,
    excluded_payload_classes: excludedPayloadClasses.length,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
