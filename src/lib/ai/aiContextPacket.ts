import type { AiExecutionGateStatus } from "@/lib/ai/aiExecutionPolicy";
import type {
  AiPayloadPreview,
  AiPayloadRisk,
} from "@/lib/ai/aiPayloadPreview";
import type { AiPromptBlueprint } from "@/lib/ai/aiPromptBlueprint";
import type { AiWorkflowSpec } from "@/lib/ai/aiWorkflowContract";

export interface AiContextPacketInput {
  workflow: AiWorkflowSpec;
  payloadPreview: AiPayloadPreview;
  promptBlueprint: AiPromptBlueprint;
}

export interface AiContextPacketItem {
  id: string;
  title: string;
  kind: "workflow" | "prompt" | "page" | "file";
  status: AiExecutionGateStatus;
  risk: AiPayloadRisk;
  included_in_packet: "metadata-only";
  content_included: false;
  required_decision: string;
}

export interface AiContextPacketRule {
  id: string;
  title: string;
  status: AiExecutionGateStatus;
  rule: string;
}

export interface AiContextPacketChecklistItem {
  id: string;
  title: string;
  status: AiExecutionGateStatus;
  required_action: string;
}

export interface AiContextPacket {
  format: "zhinote-ai-context-packet";
  format_version: 1;
  packet_status: "local-context-packet-only";
  can_run_ai_now: false;
  privacy_note: string;
  workflow: {
    id: string;
    title: string;
    output: string;
  };
  boundary: {
    local_context_packet_only: true;
    reads_workflow_metadata: true;
    reads_payload_preview_metadata: true;
    reads_prompt_blueprint_metadata: true;
    reads_prompt_text: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    includes_prompt_text: false;
    includes_page_body_text: false;
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
    context_items: number;
    selected_pages: number;
    file_kinds: number;
    files_available: number;
    required_decisions: number;
    sensitive_exclusions: number;
    outbound_checklist_items: number;
  };
  context_items: AiContextPacketItem[];
  sensitive_exclusions: string[];
  source_policy: AiContextPacketRule[];
  outbound_payload_checklist: AiContextPacketChecklistItem[];
  packet_ready_notes: string[];
}

export function buildAiContextPacket(
  input: AiContextPacketInput
): AiContextPacket {
  const contextItems = buildContextItems(input);
  const sourcePolicy = buildSourcePolicy(input);
  const outboundChecklist = buildOutboundChecklist(input);
  const sensitiveExclusions = [
    "持仓和交易计划默认排除。",
    "客户信息和个人联系信息默认排除。",
    "未公开交易、IPO、融资或尽调材料默认排除。",
    "token、secret、API key、cookie 和账号凭证默认排除。",
    "文件字节、页面正文和提示词正文默认排除。",
  ];

  return {
    format: "zhinote-ai-context-packet",
    format_version: 1,
    packet_status: "local-context-packet-only",
    can_run_ai_now: false,
    privacy_note:
      "本地生成。这个 AI 上下文包只打包工作流、外发内容预览和提示词蓝图元数据；不读取提示词正文、页面正文、文件字节、持仓、交易计划、客户信息、token 或 secret，也不调用模型服务。",
    workflow: {
      id: input.workflow.id,
      title: input.workflow.title,
      output: input.workflow.output,
    },
    boundary: {
      local_context_packet_only: true,
      reads_workflow_metadata: true,
      reads_payload_preview_metadata: true,
      reads_prompt_blueprint_metadata: true,
      reads_prompt_text: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      includes_prompt_text: false,
      includes_page_body_text: false,
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
      context_items: contextItems.length,
      selected_pages: input.payloadPreview.summary.selected_pages,
      file_kinds: input.payloadPreview.summary.file_kinds_available,
      files_available: input.payloadPreview.summary.files_available,
      required_decisions: contextItems.filter(
        (item) => item.status !== "planned"
      ).length,
      sensitive_exclusions: sensitiveExclusions.length,
      outbound_checklist_items: outboundChecklist.length,
    },
    context_items: contextItems,
    sensitive_exclusions: sensitiveExclusions,
    source_policy: sourcePolicy,
    outbound_payload_checklist: outboundChecklist,
    packet_ready_notes: [
      "这个上下文包可以导出给用户审核，但不能直接发送给 AI 模型服务。",
      "最终外发内容必须展示真实将被发送的正文和文件范围。",
      "仅元数据上下文包不等于用户授权发送页面正文、提示词正文或文件字节。",
    ],
  };
}

function buildContextItems(input: AiContextPacketInput): AiContextPacketItem[] {
  const items: AiContextPacketItem[] = [
    {
      id: `workflow-${input.workflow.id}`,
      title: input.workflow.title,
      kind: "workflow",
      status: "planned",
      risk: "low",
      included_in_packet: "metadata-only",
      content_included: false,
      required_decision: "确认本次 AI 任务类型和输出用途。",
    },
    {
      id: "prompt-metadata",
      title: input.payloadPreview.prompt.provided
        ? "研究问题元数据"
        : "未填写研究问题",
      kind: "prompt",
      status: input.payloadPreview.prompt.provided
        ? "manual-confirmation"
        : "planned",
      risk: input.payloadPreview.prompt.provided ? "medium" : "low",
      included_in_packet: "metadata-only",
      content_included: false,
      required_decision:
        "确认提示词正文是否允许进入最终外发内容；当前只记录字符数。",
    },
  ];

  for (const page of input.payloadPreview.selected_pages) {
    items.push({
      id: `page-${page.page_id}`,
      title: page.title,
      kind: "page",
      status: "manual-confirmation",
      risk: page.risk,
      included_in_packet: "metadata-only",
      content_included: false,
      required_decision:
        "确认该页面正文是否允许进入最终外发内容，以及引用方式。",
    });
  }

  for (const file of input.payloadPreview.available_files) {
    items.push({
      id: `file-kind-${file.kind}`,
      title: `${file.kind}: ${file.count} files`,
      kind: "file",
      status: "manual-confirmation",
      risk: file.risk,
      included_in_packet: "metadata-only",
      content_included: false,
      required_decision:
        "逐类确认文件内容、外部资源、保留规则和删除策略；当前不包含文件字节。",
    });
  }

  return items;
}

function buildSourcePolicy(input: AiContextPacketInput): AiContextPacketRule[] {
  return [
    {
      id: "authorized-context-only",
      title: "只使用授权上下文",
      status: "manual-confirmation",
      rule: "最终回答只能基于用户确认进入外发内容的页面正文、文件内容和提示词正文。",
    },
    {
      id: "metadata-is-not-evidence",
      title: "元数据不是证据",
      status: "manual-confirmation",
      rule: "页面标题、文件类型和字符数只能用于任务准备，不能作为事实证据。",
    },
    {
      id: "blueprint-schema-required",
      title: "遵守输出结构",
      status: "planned",
      rule: `输出必须覆盖 ${input.promptBlueprint.summary.output_fields} 个输出字段和 ${input.promptBlueprint.summary.citation_rules} 条引用规则。`,
    },
  ];
}

function buildOutboundChecklist(
  input: AiContextPacketInput
): AiContextPacketChecklistItem[] {
  return [
    {
      id: "final-payload-visible",
      title: "最终外发内容可见",
      status: "manual-confirmation",
      required_action:
        "发送前展示真实外发内容，不能只展示本地上下文包。",
    },
    {
      id: "page-body-confirmed",
      title: "页面正文逐项确认",
      status:
        input.payloadPreview.summary.selected_pages > 0
          ? "manual-confirmation"
          : "planned",
      required_action:
        "逐页确认正文范围、引用规则和是否允许外发给模型服务。",
    },
    {
      id: "file-bytes-confirmed",
      title: "文件内容逐类确认",
      status:
        input.payloadPreview.summary.files_available > 0
          ? "manual-confirmation"
          : "planned",
      required_action:
        "逐类确认 HTML、Markdown、PDF、Excel、Word 等文件是否允许进入外发内容。",
    },
    {
      id: "sensitive-exclusions-reviewed",
      title: "敏感信息排除复核",
      status: "manual-confirmation",
      required_action:
        "确认持仓、交易计划、客户信息、未公开交易信息、token 和 secret 未进入外发内容。",
    },
    {
      id: "provider-retention-selected",
      title: "模型服务和保留规则已选",
      status: "blocked",
      required_action:
        "选择模型服务、账号边界、提示词/输出保存策略和删除流程。",
    },
  ];
}
