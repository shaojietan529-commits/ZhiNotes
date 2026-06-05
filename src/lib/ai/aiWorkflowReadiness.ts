import { AI_WORKFLOWS, type AiWorkflowId } from "@/lib/ai/aiWorkflowContract";

export type AiWorkflowReadinessStatus =
  | "local-ready"
  | "manual-confirmation"
  | "blocked-external-run";

export interface AiWorkflowReadinessItem {
  id: AiWorkflowId;
  title: string;
  output: string;
  status: AiWorkflowReadinessStatus;
  required_context: string[];
  prompt_sections: string[];
  privacy_boundary: string;
  confirmation_gates: string[];
  default_exclusions: string[];
  next_action: string;
}

export interface AiWorkflowReadinessReport {
  format: "zhinote-ai-workflow-readiness";
  format_version: 1;
  report_status: "local-workflow-metadata-only";
  privacy_note: string;
  boundary: {
    local_catalog_only: true;
    reads_workflow_metadata: true;
    reads_page_body_text: false;
    reads_prompt_text: false;
    reads_file_bytes: false;
    includes_page_body_text: false;
    includes_prompt_text: false;
    includes_file_bytes: false;
    includes_holdings_or_trading_plans: false;
    includes_client_info: false;
    includes_tokens_or_secrets: false;
    calls_model_provider: false;
    writes_workspace_data: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    workflows: number;
    local_ready: number;
    manual_confirmation: number;
    blocked_external_run: number;
    confirmation_gates: number;
    default_exclusions: number;
  };
  items: AiWorkflowReadinessItem[];
}

const DEFAULT_EXCLUSIONS = [
  "页面正文默认不进入外发内容",
  "提示词正文默认不进入导出确认收据",
  "文件字节默认不进入外发内容",
  "持仓、交易计划、客户信息、token 和 secret 默认排除",
  "HTML 外部资源、云同步和数据库写入需要独立确认",
];

export function buildAiWorkflowReadinessReport(): AiWorkflowReadinessReport {
  const items = AI_WORKFLOWS.map((workflow): AiWorkflowReadinessItem => {
    const confirmationGates = getWorkflowConfirmationGates(workflow.id);
    return {
      id: workflow.id,
      title: workflow.title,
      output: workflow.output,
      status: "blocked-external-run",
      required_context: workflow.required_context,
      prompt_sections: workflow.prompt_sections,
      privacy_boundary: workflow.privacy_boundary,
      confirmation_gates: confirmationGates,
      default_exclusions: DEFAULT_EXCLUSIONS,
      next_action:
        "先选择本地上下文并导出外发内容预览；外发前再确认模型服务、保留规则、最终外发内容和确认收据。",
    };
  });

  return {
    format: "zhinote-ai-workflow-readiness",
    format_version: 1,
    report_status: "local-workflow-metadata-only",
    privacy_note:
      "本地生成。这个 AI 工作流就绪度报告只读取工作流元数据；不读取页面正文、提示词正文、文件字节、持仓、交易计划、客户信息、token、secret、云端数据或 AI 输出。",
    boundary: {
      local_catalog_only: true,
      reads_workflow_metadata: true,
      reads_page_body_text: false,
      reads_prompt_text: false,
      reads_file_bytes: false,
      includes_page_body_text: false,
      includes_prompt_text: false,
      includes_file_bytes: false,
      includes_holdings_or_trading_plans: false,
      includes_client_info: false,
      includes_tokens_or_secrets: false,
      calls_model_provider: false,
      writes_workspace_data: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      workflows: items.length,
      local_ready: items.filter((item) => item.status === "local-ready").length,
      manual_confirmation: items.filter(
        (item) => item.status === "manual-confirmation"
      ).length,
      blocked_external_run: items.filter(
        (item) => item.status === "blocked-external-run"
      ).length,
      confirmation_gates: items.reduce(
        (total, item) => total + item.confirmation_gates.length,
        0
      ),
      default_exclusions: DEFAULT_EXCLUSIONS.length,
    },
    items,
  };
}

function getWorkflowConfirmationGates(id: AiWorkflowId) {
  const common = [
    "最终外发内容预览",
    "模型服务 / 账号 / 保留规则",
    "用户确认收据",
  ];

  if (id === "summary") {
    return [...common, "页面正文范围", "输出用途"];
  }
  if (id === "qa") {
    return [...common, "研究问题正文", "引用方式"];
  }
  if (id === "report") {
    return [...common, "报告类型", "文件内容引用", "输出保存位置"];
  }
  if (id === "compare") {
    return [...common, "至少两个对比对象", "每类文件内容"];
  }
  return [...common, "研究主题", "模板输出用途"];
}
