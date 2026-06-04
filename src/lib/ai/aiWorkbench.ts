import type { AiContextPacket } from "@/lib/ai/aiContextPacket";
import type {
  AiExecutionGateStatus,
  AiExecutionPolicy,
} from "@/lib/ai/aiExecutionPolicy";
import type { AiOutputReviewContract } from "@/lib/ai/aiOutputReview";
import type { AiPayloadPreview } from "@/lib/ai/aiPayloadPreview";
import type { AiPromptBlueprint } from "@/lib/ai/aiPromptBlueprint";
import type { AiResearchRunbook } from "@/lib/ai/aiResearchRunbook";
import type { AiWorkflowReadinessReport } from "@/lib/ai/aiWorkflowReadiness";

export type AiWorkbenchLaneId =
  | "workflow-scope"
  | "context-selection"
  | "payload-review"
  | "provider-permission"
  | "prompt-and-output"
  | "audit-retention"
  | "privacy-boundary";

export type AiWorkbenchPriority = "high" | "medium" | "low";

export interface AiWorkbenchLane {
  id: AiWorkbenchLaneId;
  title: string;
  description: string;
  route: string;
  action_count: number;
  high_priority_count: number;
  privacy_boundary: string;
}

export interface AiWorkbenchAction {
  id: string;
  lane_id: AiWorkbenchLaneId;
  title: string;
  priority: AiWorkbenchPriority;
  status: AiExecutionGateStatus;
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  requires_manual_confirmation: boolean;
  blocks_ai_run: boolean;
  writes_workspace_data: false;
  calls_model_provider: false;
  uploads_data: false;
  includes_page_titles: false;
  includes_page_body_text: false;
  includes_prompt_text: false;
  includes_file_bytes: false;
  privacy_boundary: string;
}

export interface AiWorkbenchEnablementStep {
  id: string;
  order: number;
  title: string;
  status: AiExecutionGateStatus;
  route: string;
  reason: string;
  completion_signal: string;
}

export interface AiWorkbenchPacket {
  format: "zhinote-ai-workbench-packet";
  format_version: 1;
  packet_status: "local-ai-workbench-only";
  can_run_ai_now: false;
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_workflow_metadata: true;
    reads_payload_preview_summary: true;
    reads_execution_policy_summary: true;
    reads_prompt_blueprint_summary: true;
    reads_context_packet_summary: true;
    reads_runbook_summary: true;
    reads_output_review_summary: true;
    reads_page_titles: false;
    reads_page_body_text: false;
    reads_prompt_text: false;
    reads_file_bytes: false;
    includes_page_titles: false;
    includes_page_body_text: false;
    includes_prompt_text: false;
    includes_file_bytes: false;
    includes_holdings_or_trading_plans: false;
    includes_client_info: false;
    includes_tokens_or_secrets: false;
    writes_workspace_data: false;
    creates_pages: false;
    updates_databases: false;
    stores_ai_output: false;
    calls_model_provider: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    workflows: number;
    selected_pages: number;
    files_available: number;
    prompt_provided: boolean;
    payload_approvals_required: number;
    execution_gates: number;
    blocked_execution_gates: number;
    manual_confirmation_gates: number;
    prompt_sections: number;
    output_fields: number;
    context_items: number;
    runbook_steps: number;
    output_destinations: number;
    disabled_write_paths: number;
    actions: number;
    high_priority_actions: number;
    blocked_actions: number;
    manual_confirmation_actions: number;
  };
  lanes: AiWorkbenchLane[];
  actions: AiWorkbenchAction[];
  enablement_sequence: AiWorkbenchEnablementStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  AiWorkbenchLaneId,
  Omit<AiWorkbenchLane, "action_count" | "high_priority_count">
> = {
  "workflow-scope": {
    id: "workflow-scope",
    title: "任务范围",
    description: "先确认 AI 工作流、研究问题、输出用途和敏感范围。",
    route: "/modules/ai",
    privacy_boundary:
      "只读取 workflow metadata 和 prompt 字符数，不导出 prompt 正文。",
  },
  "context-selection": {
    id: "context-selection",
    title: "上下文选择",
    description: "把页面、文件和数据库上下文停留在候选状态，等待逐项确认。",
    route: "/modules/ai",
    privacy_boundary:
      "工作台只导出上下文数量，不导出页面标题、页面正文或文件 bytes。",
  },
  "payload-review": {
    id: "payload-review",
    title: "Payload 预览",
    description: "发送前必须展示真实 outbound payload，metadata-only 不能等同授权。",
    route: "/modules/ai",
    privacy_boundary:
      "只读取 payload preview summary，不包含最终 prompt、页面正文或文件内容。",
  },
  "provider-permission": {
    id: "provider-permission",
    title: "Provider 和权限",
    description: "模型 provider、账号边界、权限检查和审计事件必须先定义。",
    route: "/modules/sync",
    privacy_boundary:
      "不会连接 provider、不会调用模型、不会上传 workspace 数据。",
  },
  "prompt-and-output": {
    id: "prompt-and-output",
    title: "Prompt 和输出",
    description: "把 prompt 蓝图、输出 schema、引用规则和保存门禁串起来。",
    route: "/modules/ai",
    privacy_boundary:
      "只读取蓝图和输出合同 summary，不读取 prompt 正文或 AI 输出正文。",
  },
  "audit-retention": {
    id: "audit-retention",
    title: "审计和保留",
    description: "AI 启用前必须定义 retention、删除、回滚和 redacted audit event。",
    route: "/modules/sync",
    privacy_boundary:
      "只提示缺口，不写审计日志、不保存 AI 输出、不创建页面或数据库 row。",
  },
  "privacy-boundary": {
    id: "privacy-boundary",
    title: "隐私边界",
    description: "敏感投研信息、账号凭证、外部资源和云同步默认排除。",
    route: "/modules/ai",
    privacy_boundary:
      "持仓、交易计划、客户信息、未公开交易、token 和 secret 默认禁止进入 packet。",
  },
};

const FORBIDDEN_ACTIONS = [
  "export_ai_selected_page_titles_from_workbench",
  "export_ai_page_body_text_from_workbench",
  "export_ai_prompt_text_from_workbench",
  "export_ai_file_bytes_from_workbench",
  "export_ai_output_text_from_workbench",
  "export_holdings_or_trading_plans_from_workbench",
  "export_client_info_from_workbench",
  "export_tokens_or_secrets_from_workbench",
  "call_model_provider",
  "enable_ai_run_endpoint",
  "send_payload_to_ai_provider",
  "upload_ai_context_to_cloud",
  "auto_create_ai_output_page",
  "auto_update_database_rows_from_ai",
  "store_ai_output_without_review",
  "sync_ai_output_without_confirmation",
];

export function buildAiWorkbenchPacket(input: {
  workflowReadiness: AiWorkflowReadinessReport;
  payloadPreview: AiPayloadPreview;
  executionPolicy: AiExecutionPolicy;
  promptBlueprint: AiPromptBlueprint;
  contextPacket: AiContextPacket;
  researchRunbook: AiResearchRunbook;
  outputReview: AiOutputReviewContract;
}): AiWorkbenchPacket {
  const actions = buildActions(input);

  return {
    format: "zhinote-ai-workbench-packet",
    format_version: 1,
    packet_status: "local-ai-workbench-only",
    can_run_ai_now: false,
    privacy_note:
      "Generated locally from AI workflow, payload-preview, execution-policy, prompt-blueprint, context-packet, runbook, and output-review summary metadata only. It does not include selected page titles, page body text, prompt text, file bytes, AI output text, holdings, trading plans, client information, tokens, secrets, cloud data, or credentials; it does not call a model provider, upload data, write workspace data, save AI output, create pages, update databases, connect cloud services, or enable AI.",
    boundary: {
      local_packet_only: true,
      reads_workflow_metadata: true,
      reads_payload_preview_summary: true,
      reads_execution_policy_summary: true,
      reads_prompt_blueprint_summary: true,
      reads_context_packet_summary: true,
      reads_runbook_summary: true,
      reads_output_review_summary: true,
      reads_page_titles: false,
      reads_page_body_text: false,
      reads_prompt_text: false,
      reads_file_bytes: false,
      includes_page_titles: false,
      includes_page_body_text: false,
      includes_prompt_text: false,
      includes_file_bytes: false,
      includes_holdings_or_trading_plans: false,
      includes_client_info: false,
      includes_tokens_or_secrets: false,
      writes_workspace_data: false,
      creates_pages: false,
      updates_databases: false,
      stores_ai_output: false,
      calls_model_provider: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      workflows: input.workflowReadiness.summary.workflows,
      selected_pages: input.payloadPreview.summary.selected_pages,
      files_available: input.payloadPreview.summary.files_available,
      prompt_provided: input.payloadPreview.prompt.provided,
      payload_approvals_required:
        input.payloadPreview.summary.approvals_required,
      execution_gates: input.executionPolicy.summary.gates,
      blocked_execution_gates: input.executionPolicy.summary.blocked,
      manual_confirmation_gates:
        input.executionPolicy.summary.manual_confirmation,
      prompt_sections: input.promptBlueprint.summary.prompt_sections,
      output_fields: input.promptBlueprint.summary.output_fields,
      context_items: input.contextPacket.summary.context_items,
      runbook_steps: input.researchRunbook.summary.steps,
      output_destinations: input.outputReview.summary.destinations,
      disabled_write_paths: input.outputReview.summary.disabled_write_paths,
      actions: actions.length,
      high_priority_actions: actions.filter(
        (action) => action.priority === "high"
      ).length,
      blocked_actions: actions.filter((action) => action.status === "blocked")
        .length,
      manual_confirmation_actions: actions.filter(
        (action) => action.status === "manual-confirmation"
      ).length,
    },
    lanes: buildLanes(actions),
    actions,
    enablement_sequence: buildEnablementSequence(input),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_verification_commands: [
      "npm run verify:ai",
      "npm run verify:modules",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildActions(input: {
  workflowReadiness: AiWorkflowReadinessReport;
  payloadPreview: AiPayloadPreview;
  executionPolicy: AiExecutionPolicy;
  promptBlueprint: AiPromptBlueprint;
  contextPacket: AiContextPacket;
  researchRunbook: AiResearchRunbook;
  outputReview: AiOutputReviewContract;
}): AiWorkbenchAction[] {
  const actions: AiWorkbenchAction[] = [];
  const hasPrompt = input.payloadPreview.prompt.provided;
  const hasPages = input.payloadPreview.summary.selected_pages > 0;
  const hasFiles = input.payloadPreview.summary.files_available > 0;

  actions.push(
    action({
      id: "confirm-ai-workflow-scope",
      lane_id: "workflow-scope",
      title: hasPrompt ? "复核研究问题范围" : "补充研究问题或输出目标",
      priority: hasPrompt ? "medium" : "high",
      status: hasPrompt ? "manual-confirmation" : "planned",
      evidence: hasPrompt
        ? `已有 ${input.payloadPreview.prompt.character_count} 个字符的研究问题，但正文未进入工作台导出。`
        : "当前没有研究问题或 memo 目标，AI 任务范围仍不明确。",
      next_action:
        "在请求草稿中明确研究目标、输出用途、禁止内容和是否涉及敏感投研信息。",
      requires_manual_confirmation: hasPrompt,
      blocks_ai_run: true,
    })
  );

  actions.push(
    action({
      id: "confirm-selected-page-context",
      lane_id: "context-selection",
      title: hasPages ? "逐页确认页面正文范围" : "选择候选页面上下文",
      priority: hasPages ? "high" : "medium",
      status: hasPages ? "manual-confirmation" : "planned",
      evidence: `${input.payloadPreview.summary.selected_pages} 个页面处于候选上下文；工作台导出不包含页面标题或正文。`,
      next_action:
        "只在用户确认后，才允许页面正文进入最终 outbound payload。",
      requires_manual_confirmation: hasPages,
      blocks_ai_run: true,
    })
  );

  actions.push(
    action({
      id: "confirm-file-context",
      lane_id: "context-selection",
      title: hasFiles ? "逐类确认文件内容" : "等待文件内容确认",
      priority: hasFiles ? "high" : "low",
      status: hasFiles ? "manual-confirmation" : "planned",
      evidence: `${input.payloadPreview.summary.files_available} 个本地文件可用，但文件 bytes 仍被排除。`,
      next_action:
        "按 HTML、Markdown、PDF、Excel、Word 等类型逐项确认内容、外部资源、retention 和删除策略。",
      requires_manual_confirmation: hasFiles,
      blocks_ai_run: hasFiles,
    })
  );

  actions.push(
    action({
      id: "show-final-outbound-payload",
      lane_id: "payload-review",
      title: "展示最终 outbound payload",
      priority: "high",
      status: "manual-confirmation",
      evidence: `当前 payload preview 有 ${input.payloadPreview.summary.approvals_required} 个确认项；metadata-only 不是最终外发内容。`,
      next_action:
        "AI 启用前必须展示真实会发送的 prompt、页面正文范围和文件内容范围。",
      requires_manual_confirmation: true,
      blocks_ai_run: true,
    })
  );

  for (const gate of input.executionPolicy.gates.filter(
    (item) => item.status !== "planned"
  )) {
    actions.push(
      action({
        id: `execution-gate-${gate.id}`,
        lane_id:
          gate.id === "provider-selection" ||
          gate.id === "permission-and-audit"
            ? "provider-permission"
            : gate.id === "retention-policy"
              ? "audit-retention"
              : "payload-review",
        title: gate.title,
        priority: gate.status === "blocked" ? "high" : "medium",
        status: gate.status,
        evidence: gate.evidence,
        next_action: gate.required_action,
        requires_manual_confirmation: gate.status === "manual-confirmation",
        blocks_ai_run: true,
      })
    );
  }

  actions.push(
    action({
      id: "review-prompt-blueprint",
      lane_id: "prompt-and-output",
      title: "复核 Prompt 蓝图和输出 schema",
      priority: "medium",
      status:
        input.promptBlueprint.summary.blockers > 0
          ? "blocked"
          : "manual-confirmation",
      evidence: `${input.promptBlueprint.summary.prompt_sections} 个 prompt 段、${input.promptBlueprint.summary.output_fields} 个输出字段、${input.promptBlueprint.summary.citation_rules} 条引用规则。`,
      next_action:
        "确认蓝图能约束总结、问答、报告、对比或框架输出，不允许编造来源和数值。",
      requires_manual_confirmation: true,
      blocks_ai_run: input.promptBlueprint.summary.blockers > 0,
    })
  );

  actions.push(
    action({
      id: "review-output-save-contract",
      lane_id: "prompt-and-output",
      title: "确认 AI 输出保存合同",
      priority: "high",
      status:
        input.outputReview.summary.blocked_gates > 0
          ? "blocked"
          : "manual-confirmation",
      evidence: `${input.outputReview.summary.disabled_write_paths} 条写入路径仍禁用；${input.outputReview.summary.blocked_gates} 个保存门禁阻塞。`,
      next_action:
        "AI 输出保存到页面、数据库或报告前，必须先预览正文、核对来源、检查敏感信息并生成审计事件。",
      requires_manual_confirmation: true,
      blocks_ai_run: true,
    })
  );

  actions.push(
    action({
      id: "implement-audit-retention",
      lane_id: "audit-retention",
      title: "定义 retention、删除和审计事件",
      priority: "high",
      status: "blocked",
      evidence: `${input.researchRunbook.summary.blocked_steps} 个 runbook 步骤阻塞，包含 provider、权限审计和输出保留策略。`,
      next_action:
        "Web Beta 前实现 server-side permission check、redacted audit event、output retention 和删除/回滚流程。",
      action_route: "/modules/sync",
      route_label: "打开同步与权限",
      requires_manual_confirmation: false,
      blocks_ai_run: true,
    })
  );

  actions.push(
    action({
      id: "keep-sensitive-boundary",
      lane_id: "privacy-boundary",
      title: "保持敏感投研信息默认排除",
      priority: "high",
      status: "manual-confirmation",
      evidence: `${input.contextPacket.summary.sensitive_exclusions} 条默认敏感排除仍生效；AI 工作台不导出页面标题、prompt 正文或文件 bytes。`,
      next_action:
        "任何 AI 外发前，先确认持仓、交易计划、客户信息、未公开交易、token 和 secret 没有进入 payload。",
      requires_manual_confirmation: true,
      blocks_ai_run: true,
    })
  );

  return actions.sort(sortActions);
}

function action(input: {
  id: string;
  lane_id: AiWorkbenchLaneId;
  title: string;
  priority: AiWorkbenchPriority;
  status: AiExecutionGateStatus;
  evidence: string;
  next_action: string;
  action_route?: string;
  route_label?: string;
  requires_manual_confirmation: boolean;
  blocks_ai_run: boolean;
}): AiWorkbenchAction {
  return {
    id: input.id,
    lane_id: input.lane_id,
    title: input.title,
    priority: input.priority,
    status: input.status,
    evidence: input.evidence,
    next_action: input.next_action,
    action_route: input.action_route ?? LANE_META[input.lane_id].route,
    route_label: input.route_label ?? "打开 AI 工作台",
    requires_manual_confirmation: input.requires_manual_confirmation,
    blocks_ai_run: input.blocks_ai_run,
    writes_workspace_data: false,
    calls_model_provider: false,
    uploads_data: false,
    includes_page_titles: false,
    includes_page_body_text: false,
    includes_prompt_text: false,
    includes_file_bytes: false,
    privacy_boundary: LANE_META[input.lane_id].privacy_boundary,
  };
}

function buildLanes(actions: AiWorkbenchAction[]): AiWorkbenchLane[] {
  return Object.values(LANE_META).map((lane) => {
    const laneActions = actions.filter((action) => action.lane_id === lane.id);
    return {
      ...lane,
      action_count: laneActions.length,
      high_priority_count: laneActions.filter(
        (action) => action.priority === "high"
      ).length,
    };
  });
}

function buildEnablementSequence(input: {
  payloadPreview: AiPayloadPreview;
  executionPolicy: AiExecutionPolicy;
  outputReview: AiOutputReviewContract;
}): AiWorkbenchEnablementStep[] {
  return [
    {
      id: "scope-and-sensitive-boundary",
      order: 1,
      title: "确认任务范围和敏感边界",
      status: input.payloadPreview.prompt.provided
        ? "manual-confirmation"
        : "planned",
      route: "/modules/ai",
      reason: "没有明确任务范围时，AI 很容易把普通整理变成不受控的投研外发。",
      completion_signal:
        "研究目标、输出用途、禁止内容和敏感信息边界已由用户确认。",
    },
    {
      id: "context-and-payload",
      order: 2,
      title: "确认上下文和最终 payload",
      status: "manual-confirmation",
      route: "/modules/ai",
      reason: `当前有 ${input.payloadPreview.summary.selected_pages} 个页面和 ${input.payloadPreview.summary.files_available} 个文件处于候选状态。`,
      completion_signal:
        "最终 outbound payload 可见，页面正文、prompt 正文和文件内容范围已逐项确认。",
    },
    {
      id: "provider-and-permission",
      order: 3,
      title: "选择 provider 并通过权限检查",
      status:
        input.executionPolicy.summary.blocked > 0 ? "blocked" : "manual-confirmation",
      route: "/modules/sync",
      reason: "当前没有 provider、模型、账号边界、server-side permission check 或 audit event。",
      completion_signal:
        "Provider、模型、账号边界、计费边界、权限检查和 redacted audit event 已实现。",
    },
    {
      id: "run-and-review-output",
      order: 4,
      title: "执行后复核输出",
      status:
        input.outputReview.summary.blocked_gates > 0
          ? "blocked"
          : "manual-confirmation",
      route: "/modules/ai",
      reason: "AI 输出不能自动写入页面、数据库或报告，需要先完成来源和敏感信息检查。",
      completion_signal:
        "输出正文、来源引用、事实核查、retention、删除策略和保存目标已确认。",
    },
  ];
}

function sortActions(a: AiWorkbenchAction, b: AiWorkbenchAction) {
  const priorityOrder: Record<AiWorkbenchPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const statusOrder: Record<AiExecutionGateStatus, number> = {
    blocked: 0,
    "manual-confirmation": 1,
    planned: 2,
  };

  return (
    priorityOrder[a.priority] - priorityOrder[b.priority] ||
    statusOrder[a.status] - statusOrder[b.status] ||
    a.title.localeCompare(b.title)
  );
}
