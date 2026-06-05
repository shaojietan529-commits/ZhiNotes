import type {
  AiExecutionGateStatus,
  AiExecutionPolicy,
} from "@/lib/ai/aiExecutionPolicy";
import type { AiPayloadPreview } from "@/lib/ai/aiPayloadPreview";
import type { AiWorkflowSpec } from "@/lib/ai/aiWorkflowContract";

export interface AiResearchRunbookInput {
  workflow: AiWorkflowSpec;
  payloadPreview: AiPayloadPreview;
  executionPolicy: AiExecutionPolicy;
}

export interface AiResearchRunbookStep {
  id: string;
  phase:
    | "scope"
    | "context"
    | "payload"
    | "provider"
    | "confirmation"
    | "audit"
    | "output";
  title: string;
  status: AiExecutionGateStatus;
  owner: "researcher" | "system" | "future-provider";
  evidence: string;
  required_decision: string;
  blocks_ai_run: boolean;
}

export interface AiResearchRunbookApproval {
  id: string;
  title: string;
  status: AiExecutionGateStatus;
  reason: string;
}

export interface AiResearchRunbook {
  format: "zhinote-ai-research-runbook";
  format_version: 1;
  runbook_status: "local-runbook-only";
  can_run_ai_now: false;
  privacy_note: string;
  workflow: {
    id: string;
    title: string;
    output: string;
  };
  boundary: {
    local_runbook_only: true;
    calls_model_provider: false;
    uploads_workspace_data: false;
    includes_page_body_text: false;
    includes_prompt_text: false;
    includes_file_bytes: false;
    includes_holdings_or_trading_plans: false;
    includes_client_info: false;
    includes_tokens_or_secrets: false;
    requires_owner_confirmation: true;
  };
  summary: {
    steps: number;
    blocked_steps: number;
    manual_confirmation_steps: number;
    planned_steps: number;
    approval_queue_items: number;
    selected_pages: number;
    available_files: number;
  };
  approval_queue: AiResearchRunbookApproval[];
  steps: AiResearchRunbookStep[];
  final_enablement_conditions: string[];
}

export function buildAiResearchRunbook(
  input: AiResearchRunbookInput
): AiResearchRunbook {
  const steps = buildRunbookSteps(input);
  const approvalQueue = buildApprovalQueue(input);

  return {
    format: "zhinote-ai-research-runbook",
    format_version: 1,
    runbook_status: "local-runbook-only",
    can_run_ai_now: false,
    privacy_note:
      "本地生成。这个 AI 研究运行手册不调用模型服务、不上传工作区数据、不包含页面正文、提示词正文、文件字节、持仓、交易计划、客户信息、token 或 secret。",
    workflow: {
      id: input.workflow.id,
      title: input.workflow.title,
      output: input.workflow.output,
    },
    boundary: {
      local_runbook_only: true,
      calls_model_provider: false,
      uploads_workspace_data: false,
      includes_page_body_text: false,
      includes_prompt_text: false,
      includes_file_bytes: false,
      includes_holdings_or_trading_plans: false,
      includes_client_info: false,
      includes_tokens_or_secrets: false,
      requires_owner_confirmation: true,
    },
    summary: {
      steps: steps.length,
      blocked_steps: steps.filter((step) => step.status === "blocked").length,
      manual_confirmation_steps: steps.filter(
        (step) => step.status === "manual-confirmation"
      ).length,
      planned_steps: steps.filter((step) => step.status === "planned").length,
      approval_queue_items: approvalQueue.length,
      selected_pages: input.payloadPreview.summary.selected_pages,
      available_files: input.payloadPreview.summary.files_available,
    },
    approval_queue: approvalQueue,
    steps,
    final_enablement_conditions: [
      "选择模型服务、模型、账号边界和数据处理条款。",
      "展示最终外发内容，并由用户显式确认。",
      "确认页面正文、提示词正文和每一种文件类型是否允许进入外发内容。",
      "确认持仓、交易计划、客户信息、token 和 secret 不进入外发内容。",
      "实现服务端权限检查、AI 审计事件、保留规则和删除流程。",
      "保持 /api/ai/run 在以上条件全部满足前为禁用的本地占位接口。",
    ],
  };
}

function buildRunbookSteps(
  input: AiResearchRunbookInput
): AiResearchRunbookStep[] {
  const hasPages = input.payloadPreview.summary.selected_pages > 0;
  const hasFiles = input.payloadPreview.summary.files_available > 0;
  const hasPrompt = input.payloadPreview.prompt.provided;

  return [
    {
      id: "scope-research-task",
      phase: "scope",
      title: "确认研究任务范围",
      status: hasPrompt ? "manual-confirmation" : "planned",
      owner: "researcher",
      evidence: hasPrompt
        ? `已有 ${input.payloadPreview.prompt.character_count} 个字符的研究问题，但提示词正文未进入预览。`
        : "尚未填写研究问题或 memo 目标。",
      required_decision:
        "确认任务目标、输出用途和是否涉及持仓、交易计划或客户信息。",
      blocks_ai_run: true,
    },
    {
      id: "context-page-selection",
      phase: "context",
      title: "确认页面上下文",
      status: hasPages ? "manual-confirmation" : "planned",
      owner: "researcher",
      evidence: `${input.payloadPreview.summary.selected_pages} 个页面被选为候选上下文；页面正文仍被排除。`,
      required_decision: "确认哪些页面正文可以进入最终外发内容，以及引用方式。",
      blocks_ai_run: true,
    },
    {
      id: "context-file-selection",
      phase: "context",
      title: "确认文件上下文",
      status: hasFiles ? "manual-confirmation" : "planned",
      owner: "researcher",
      evidence: `${input.payloadPreview.summary.files_available} 个本地文件可用；文件字节仍被排除。`,
      required_decision:
        "逐类确认 HTML、Markdown、PDF、Excel、Word 等文件是否允许进入外发内容。",
      blocks_ai_run: true,
    },
    {
      id: "payload-final-preview",
      phase: "payload",
      title: "最终外发内容预览",
      status: "manual-confirmation",
      owner: "system",
      evidence: `当前外发内容预览有 ${input.payloadPreview.summary.approvals_required} 个确认项。`,
      required_decision:
        "在发送前展示精确最终外发内容，不能只展示摘要或元数据。",
      blocks_ai_run: true,
    },
    {
      id: "sensitive-finance-exclusions",
      phase: "payload",
      title: "敏感投研信息排除",
      status: "manual-confirmation",
      owner: "researcher",
      evidence: "Runbook 明确不包含持仓、交易计划、客户信息、token 或 secret。",
      required_decision:
        "确认最终外发内容不包含未显式授权的持仓、交易计划、客户信息和未公开交易信息。",
      blocks_ai_run: true,
    },
    {
      id: "provider-and-model-policy",
      phase: "provider",
      title: "模型服务与模型政策",
      status: "blocked",
      owner: "researcher",
      evidence: "尚未选择模型服务、模型、账号边界、计费边界或数据处理条款。",
      required_decision:
        "选择模型服务，并确认是否允许服务方保存提示词/输出。",
      blocks_ai_run: true,
    },
    {
      id: "owner-final-confirmation",
      phase: "confirmation",
      title: "Owner 最终确认",
      status: "manual-confirmation",
      owner: "researcher",
      evidence: "AI 外部执行仍需要输入确认短语并生成确认收据。",
      required_decision:
        "在最终外发内容、模型服务和保留规则确认后，再输入高风险确认短语。",
      blocks_ai_run: true,
    },
    {
      id: "permission-audit-events",
      phase: "audit",
      title: "权限与审计事件",
      status: "blocked",
      owner: "system",
      evidence: `${input.executionPolicy.summary.blocked} 个执行策略门禁仍处于阻塞状态。`,
      required_decision:
        "实现服务端权限检查、工作区角色检查和 AI 审计事件。",
      blocks_ai_run: true,
    },
    {
      id: "output-retention-save-policy",
      phase: "output",
      title: "输出保存与删除政策",
      status: "blocked",
      owner: "system",
      evidence: "尚未定义 AI output 是否保存到页面、数据库、文件或日志。",
      required_decision:
        "确认输出保留规则、本地保存位置、引用来源和删除流程。",
      blocks_ai_run: true,
    },
  ];
}

function buildApprovalQueue(
  input: AiResearchRunbookInput
): AiResearchRunbookApproval[] {
  const approvals: AiResearchRunbookApproval[] = [
    {
      id: "provider-approval",
      title: "选择 AI 模型服务",
      status: "blocked",
      reason: "没有模型服务、模型和账号边界时，不能启用 AI 执行。",
    },
    {
      id: "payload-owner-approval",
      title: "最终外发内容用户确认",
      status: "manual-confirmation",
      reason: "最终外发内容必须由用户确认，仅元数据预览不等于授权发送。",
    },
    {
      id: "sensitive-scope-approval",
      title: "敏感投研边界确认",
      status: "manual-confirmation",
      reason:
        "持仓、交易计划、客户信息和 token/secret 默认排除，除非当前任务明确授权。",
    },
  ];

  if (input.payloadPreview.summary.selected_pages > 0) {
    approvals.push({
      id: "page-body-approval",
      title: "页面正文确认",
      status: "manual-confirmation",
      reason: "已选页面只是候选上下文；正文进入外发内容前需要单独确认。",
    });
  }

  if (input.payloadPreview.summary.files_available > 0) {
    approvals.push({
      id: "file-bytes-approval",
      title: "文件内容确认",
      status: "manual-confirmation",
      reason: "HTML、Markdown、PDF、Excel、Word 等文件字节默认不外发。",
    });
  }

  if (input.payloadPreview.prompt.provided) {
    approvals.push({
      id: "prompt-text-approval",
      title: "提示词正文确认",
      status: "manual-confirmation",
      reason: "研究问题文本可能包含敏感判断，发送前需要最终确认。",
    });
  }

  return approvals;
}
