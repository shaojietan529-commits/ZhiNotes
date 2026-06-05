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
  target_section_id: string;
  reason: string;
  completion_signal: string;
}

export type AiWorkbenchDecisionStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

export interface AiWorkbenchDecision {
  id:
    | "local-owner-review"
    | "final-payload-review"
    | "external-model-run"
    | "ai-output-writeback"
    | "provider-cloud-boundary";
  title: string;
  status: AiWorkbenchDecisionStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: string;
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocks_ai_run: boolean;
  writes_workspace_data: false;
  calls_model_provider: false;
  uploads_data: false;
}

export interface AiWorkbenchDecisionSummary {
  current_state: "local-owner-review-only";
  current_conclusion: string;
  can_continue_local_review_now: true;
  can_send_payload_now: false;
  can_run_model_now: false;
  can_save_output_now: false;
  can_sync_ai_output_now: false;
  safe_local_work: string[];
  blocked_external_work: string[];
  top_blockers: string[];
  required_owner_decisions: string[];
  decisions: AiWorkbenchDecision[];
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
  decision_summary: AiWorkbenchDecisionSummary;
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
      "只读取工作流元数据和提示词字符数，不导出提示词正文。",
  },
  "context-selection": {
    id: "context-selection",
    title: "上下文选择",
    description: "把页面、文件和数据库上下文停留在候选状态，等待逐项确认。",
    route: "/modules/ai",
    privacy_boundary:
      "工作台只导出上下文数量，不导出页面标题、页面正文或文件字节。",
  },
  "payload-review": {
    id: "payload-review",
    title: "外发内容预览",
    description: "发送前必须展示真实外发内容，仅元数据预览不能等同授权。",
    route: "/modules/ai",
    privacy_boundary:
      "只读取外发内容预览摘要，不包含最终提示词、页面正文或文件内容。",
  },
  "provider-permission": {
    id: "provider-permission",
    title: "模型服务和权限",
    description: "模型服务、账号边界、权限检查和审计事件必须先定义。",
    route: "/modules/sync",
    privacy_boundary:
      "不会连接模型服务、不会调用模型、不会上传工作区数据。",
  },
  "prompt-and-output": {
    id: "prompt-and-output",
    title: "提示词和输出",
    description: "把提示词蓝图、输出结构、引用规则和保存门禁串起来。",
    route: "/modules/ai",
    privacy_boundary:
      "只读取蓝图和输出合同摘要，不读取提示词正文或 AI 输出正文。",
  },
  "audit-retention": {
    id: "audit-retention",
    title: "审计和保留",
    description: "AI 启用前必须定义保留规则、删除、回滚和脱敏审计事件。",
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
      "本地生成。这个 AI 工作台动作包只读取工作流、外发内容预览、执行策略、提示词蓝图、上下文包、运行手册和输出复核摘要元数据；不包含已选页面标题、页面正文、提示词正文、文件字节、AI 输出正文、持仓、交易计划、客户信息、token、secret、云端数据或凭证；不会调用模型服务、上传数据、写入工作区、保存 AI 输出、创建页面、更新数据库、连接云服务或启用 AI。",
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
    decision_summary: buildDecisionSummary(input, actions),
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

function buildDecisionSummary(
  input: {
    workflowReadiness: AiWorkflowReadinessReport;
    payloadPreview: AiPayloadPreview;
    executionPolicy: AiExecutionPolicy;
    outputReview: AiOutputReviewContract;
  },
  actions: AiWorkbenchAction[]
): AiWorkbenchDecisionSummary {
  const blockedActions = actions.filter((action) => action.status === "blocked");
  const manualActions = actions.filter(
    (action) => action.requires_manual_confirmation
  );

  return {
    current_state: "local-owner-review-only",
    current_conclusion:
      "可以继续本地草拟、选择上下文和用户复核；AI 执行、外发内容、外部模型服务、输出写回和云同步仍然关闭。",
    can_continue_local_review_now: true,
    can_send_payload_now: false,
    can_run_model_now: false,
    can_save_output_now: false,
    can_sync_ai_output_now: false,
    safe_local_work: [
      "选择 AI 工作流和研究问题。",
      "选择候选页面上下文并导出仅元数据外发内容预览。",
      "复核提示词蓝图、上下文包、研究运行手册和输出复核合同。",
      "导出本地 AI 工作台动作包给用户决策。",
    ],
    blocked_external_work: [
      "不能调用模型服务。",
      "不能上传页面正文、提示词正文或文件字节。",
      "不能把 AI 输出写回页面、数据库、报告或云端。",
      "不能启用 /api/ai/run。",
    ],
    top_blockers: blockedActions.slice(0, 4).map((action) => action.title),
    required_owner_decisions: manualActions
      .slice(0, 4)
      .map((action) => action.next_action),
    decisions: [
      {
        id: "local-owner-review",
        title: "本地用户复核",
        status: "available-local",
        answer: "可以继续",
        evidence: `${input.workflowReadiness.summary.workflows} 个工作流已进入本地目录，${actions.length} 个动作已排队。`,
        next_action:
          "继续在本地选择工作流、上下文和研究问题，并导出 AI 工作台动作包。",
        route: "/modules/ai",
        target_section_id: "ai-workbench",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocks_ai_run: false,
        writes_workspace_data: false,
        calls_model_provider: false,
        uploads_data: false,
      },
      {
        id: "final-payload-review",
        title: "最终外发内容",
        status: "requires-owner-confirmation",
        answer: "只可预览",
        evidence: `${input.payloadPreview.summary.approvals_required} 个外发确认项；仅元数据预览不能等同外发授权。`,
        next_action:
          "AI 启用前必须展示真实外发内容，并逐项确认页面正文、提示词正文和文件内容范围。",
        route: "/modules/ai",
        target_section_id: "ai-payload-review",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_ai_run: true,
        writes_workspace_data: false,
        calls_model_provider: false,
        uploads_data: false,
      },
      {
        id: "external-model-run",
        title: "模型执行",
        status: "blocked",
        answer: "保持关闭",
        evidence: `${input.executionPolicy.summary.blocked} 个执行门禁仍阻塞，/api/ai/run 是禁用的本地占位接口。`,
        next_action:
          "先定义模型服务、模型、账号边界、权限检查、审计事件和保留规则。",
        route: "/modules/sync",
        target_section_id: "sync-ai-provider-boundary",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_ai_run: true,
        writes_workspace_data: false,
        calls_model_provider: false,
        uploads_data: false,
      },
      {
        id: "ai-output-writeback",
        title: "AI 输出写回",
        status: "blocked",
        answer: "保持关闭",
        evidence: `${input.outputReview.summary.disabled_write_paths} 条输出写入路径仍禁用，${input.outputReview.summary.blocked_gates} 个保存门禁阻塞。`,
        next_action:
          "先实现输出预览、来源核对、敏感信息检查、保留规则、删除/回滚和写入前审计。",
        route: "/modules/ai",
        target_section_id: "ai-output-review",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_ai_run: true,
        writes_workspace_data: false,
        calls_model_provider: false,
        uploads_data: false,
      },
      {
        id: "provider-cloud-boundary",
        title: "模型服务 / 云同步",
        status: "blocked",
        answer: "保持关闭",
        evidence:
          "当前动作包不连接云服务，不上传工作区数据，也不启用外部资源。",
        next_action:
          "Web Beta 前在同步与权限模块确认模型服务、云服务、保留规则、审计和删除边界。",
        route: "/modules/sync",
        target_section_id: "sync-ai-provider-boundary",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_ai_run: true,
        writes_workspace_data: false,
        calls_model_provider: false,
        uploads_data: false,
      },
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
        : "当前没有研究问题或备忘录目标，AI 任务范围仍不明确。",
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
        "只在用户确认后，才允许页面正文进入最终外发内容。",
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
      evidence: `${input.payloadPreview.summary.files_available} 个本地文件可用，但文件字节仍被排除。`,
      next_action:
        "按 HTML、Markdown、PDF、Excel、Word 等类型逐项确认内容、外部资源、保留规则和删除策略。",
      requires_manual_confirmation: hasFiles,
      blocks_ai_run: hasFiles,
    })
  );

  actions.push(
    action({
      id: "show-final-outbound-payload",
      lane_id: "payload-review",
      title: "展示最终外发内容",
      priority: "high",
      status: "manual-confirmation",
      evidence: `当前外发内容预览有 ${input.payloadPreview.summary.approvals_required} 个确认项；仅元数据预览不是最终外发内容。`,
      next_action:
        "AI 启用前必须展示真实会发送的提示词、页面正文范围和文件内容范围。",
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
      title: "复核提示词蓝图和输出结构",
      priority: "medium",
      status:
        input.promptBlueprint.summary.blockers > 0
          ? "blocked"
          : "manual-confirmation",
      evidence: `${input.promptBlueprint.summary.prompt_sections} 个提示词段、${input.promptBlueprint.summary.output_fields} 个输出字段、${input.promptBlueprint.summary.citation_rules} 条引用规则。`,
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
      title: "定义保留规则、删除和审计事件",
      priority: "high",
      status: "blocked",
      evidence: `${input.researchRunbook.summary.blocked_steps} 个运行手册步骤阻塞，包含模型服务、权限审计和输出保留策略。`,
      next_action:
        "Web Beta 前实现服务端权限检查、脱敏审计事件、输出保留规则和删除/回滚流程。",
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
      evidence: `${input.contextPacket.summary.sensitive_exclusions} 条默认敏感排除仍生效；AI 工作台不导出页面标题、提示词正文或文件字节。`,
      next_action:
        "任何 AI 外发前，先确认持仓、交易计划、客户信息、未公开交易、token 和密钥没有进入外发内容。",
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
      target_section_id: "ai-workflow-scope",
      reason: "没有明确任务范围时，AI 很容易把普通整理变成不受控的投研外发。",
      completion_signal:
        "研究目标、输出用途、禁止内容和敏感信息边界已由用户确认。",
    },
    {
      id: "context-and-payload",
      order: 2,
      title: "确认上下文和最终外发内容",
      status: "manual-confirmation",
      route: "/modules/ai",
      target_section_id: "ai-payload-review",
      reason: `当前有 ${input.payloadPreview.summary.selected_pages} 个页面和 ${input.payloadPreview.summary.files_available} 个文件处于候选状态。`,
      completion_signal:
        "最终外发内容可见，页面正文、提示词正文和文件内容范围已逐项确认。",
    },
    {
      id: "provider-and-permission",
      order: 3,
      title: "选择模型服务并通过权限检查",
      status:
        input.executionPolicy.summary.blocked > 0 ? "blocked" : "manual-confirmation",
      route: "/modules/sync",
      target_section_id: "sync-ai-provider-boundary",
      reason: "当前没有模型服务、模型、账号边界、服务端权限检查或审计事件。",
      completion_signal:
        "模型服务、模型、账号边界、计费边界、权限检查和脱敏审计事件已实现。",
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
      target_section_id: "ai-output-review",
      reason: "AI 输出不能自动写入页面、数据库或报告，需要先完成来源和敏感信息检查。",
      completion_signal:
        "输出正文、来源引用、事实核查、保留规则、删除策略和保存目标已确认。",
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
