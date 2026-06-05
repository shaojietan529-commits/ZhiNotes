import type { AiPayloadPreview } from "@/lib/ai/aiPayloadPreview";
import type { AiWorkflowId, AiWorkflowSpec } from "@/lib/ai/aiWorkflowContract";

export type AiPromptBlueprintStatus =
  | "local-ready"
  | "manual-confirmation"
  | "blocked-external-run";

export interface AiPromptBlueprintSection {
  id: string;
  title: string;
  required: boolean;
  purpose: string;
  inclusion_rule: string;
}

export interface AiPromptOutputField {
  id: string;
  label: string;
  required: boolean;
  validation_rule: string;
}

export interface AiPromptCitationRule {
  id: string;
  title: string;
  rule: string;
}

export interface AiPromptBlueprint {
  format: "zhinote-ai-prompt-blueprint";
  format_version: 1;
  blueprint_status: "local-prompt-blueprint-only";
  can_run_ai_now: false;
  privacy_note: string;
  workflow: {
    id: AiWorkflowId;
    title: string;
    output: string;
  };
  boundary: {
    local_blueprint_only: true;
    reads_workflow_metadata: true;
    reads_payload_preview_metadata: true;
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
    prompt_sections: number;
    output_fields: number;
    citation_rules: number;
    validation_checks: number;
    selected_pages: number;
    available_files: number;
    blockers: number;
  };
  system_role: string;
  task_instruction_template: string;
  context_policy: string[];
  prompt_sections: AiPromptBlueprintSection[];
  output_schema: AiPromptOutputField[];
  citation_rules: AiPromptCitationRule[];
  validation_checklist: string[];
  blockers: string[];
}

export function buildAiPromptBlueprint(input: {
  workflow: AiWorkflowSpec;
  payloadPreview: AiPayloadPreview;
}): AiPromptBlueprint {
  const outputSchema = getOutputSchema(input.workflow.id);
  const citationRules = getCitationRules(input.workflow.id);
  const validationChecklist = getValidationChecklist(input.workflow.id);
  const blockers = buildBlockers(input.payloadPreview);

  return {
    format: "zhinote-ai-prompt-blueprint",
    format_version: 1,
    blueprint_status: "local-prompt-blueprint-only",
    can_run_ai_now: false,
    privacy_note:
      "本地生成。这个 AI 提示词蓝图只读取工作流元数据和外发内容预览元数据；不读取提示词正文、页面正文、文件字节、持仓、交易计划、客户信息、token、secret、云端数据或 AI 输出，也不会调用模型服务。",
    workflow: {
      id: input.workflow.id,
      title: input.workflow.title,
      output: input.workflow.output,
    },
    boundary: {
      local_blueprint_only: true,
      reads_workflow_metadata: true,
      reads_payload_preview_metadata: true,
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
      prompt_sections: input.workflow.prompt_sections.length,
      output_fields: outputSchema.length,
      citation_rules: citationRules.length,
      validation_checks: validationChecklist.length,
      selected_pages: input.payloadPreview.summary.selected_pages,
      available_files: input.payloadPreview.summary.files_available,
      blockers: blockers.length,
    },
    system_role:
      "你是投资研究助手，只能基于用户明确授权进入外发内容的材料回答；不确定时必须标注不确定性，不得补全未提供事实。",
    task_instruction_template: getTaskInstructionTemplate(input.workflow.id),
    context_policy: [
      "默认只把页面标题、文件类型和工作流元数据作为本地蓝图输入。",
      "页面正文进入最终提示词前必须由用户逐项确认。",
      "文件字节、HTML 外部资源、notebook 输出和数据库行数据默认排除。",
      "持仓、交易计划、客户信息、未公开交易信息、token 和 secret 默认排除。",
    ],
    prompt_sections: input.workflow.prompt_sections.map((section, index) => ({
      id: normalizeSectionId(section, index),
      title: section,
      required: true,
      purpose: getSectionPurpose(section),
      inclusion_rule: getSectionInclusionRule(section),
    })),
    output_schema: outputSchema,
    citation_rules: citationRules,
    validation_checklist: validationChecklist,
    blockers,
  };
}

function getTaskInstructionTemplate(id: AiWorkflowId) {
  const templates: Record<AiWorkflowId, string> = {
    summary:
      "生成一页投研摘要，先给结论，再列关键证据、风险、未确认事项和下一步。",
    qa: "回答一个明确研究问题；每个关键判断都要绑定来源或标注无法从授权材料确认。",
    report:
      "生成结构化报告草稿，包含 thesis、证据、模型影响、风险、开放问题和后续行动。",
    compare:
      "比较两个或多个对象的变化、差异、冲突和投资含义，并拆分确定事实与推断。",
    framework:
      "生成可复用研究框架，包含模块、检查清单、数据需求、质量门槛和复盘节奏。",
  };

  return templates[id];
}

function getOutputSchema(id: AiWorkflowId): AiPromptOutputField[] {
  const common: AiPromptOutputField[] = [
    field("scope", "任务范围", true, "必须说明回答覆盖什么、不覆盖什么。"),
    field("sources", "来源说明", true, "必须标明哪些结论来自授权材料，哪些是推断。"),
    field("uncertainty", "不确定性", true, "必须列出无法确认、冲突或需要人工复核的点。"),
  ];

  const map: Record<AiWorkflowId, AiPromptOutputField[]> = {
    summary: [
      field("executive-summary", "核心摘要", true, "先给 3-5 条最高优先级结论。"),
      field("thesis-impact", "Thesis 影响", true, "说明增强、削弱或待验证的投资假设。"),
      field("next-actions", "下一步", true, "输出可执行的研究跟进项。"),
    ],
    qa: [
      field("direct-answer", "直接回答", true, "先回答问题，不绕开问题。"),
      field("evidence", "证据", true, "每条关键判断必须有来源或说明缺失。"),
      field("follow-up", "后续问题", true, "列出还需要补充的材料。"),
    ],
    report: [
      field("report-outline", "报告结构", true, "输出可落到 ZhiNotes page 的章节结构。"),
      field("model-impact", "模型影响", true, "明确模型假设或指标影响，不能编造数值。"),
      field("risk-section", "风险与反证", true, "列出主要风险、反向证据和监控项。"),
    ],
    compare: [
      field("objects", "对比对象", true, "列出被比较对象和比较维度。"),
      field("deltas", "差异变化", true, "区分事实差异、口径差异和推断差异。"),
      field("investment-implication", "投资含义", true, "说明对 thesis、风险和下一步的影响。"),
    ],
    framework: [
      field("modules", "研究模块", true, "输出可复用模块，而不是一次性回答。"),
      field("checklist", "检查清单", true, "每个模块必须有检查项。"),
      field("review-cadence", "复盘节奏", true, "说明何时更新和触发条件。"),
    ],
  };

  return [...map[id], ...common];
}

function getCitationRules(id: AiWorkflowId): AiPromptCitationRule[] {
  const base: AiPromptCitationRule[] = [
    {
      id: "authorized-context-only",
      title: "只引用授权上下文",
      rule: "只能引用最终外发内容中明确包含的页面正文、文件内容或用户输入。",
    },
    {
      id: "separate-fact-and-inference",
      title: "事实和推断分离",
      rule: "事实、管理层表述、模型假设和 AI 推断必须分开标注。",
    },
    {
      id: "no-sensitive-defaults",
      title: "敏感信息默认排除",
      rule: "不得主动加入持仓、交易计划、客户信息、未公开交易信息、token 或 secret。",
    },
  ];

  if (id === "qa" || id === "compare") {
    return [
      ...base,
      {
        id: "answer-gap-labeling",
        title: "缺口标注",
        rule: "如果授权材料不足以回答，必须明确说缺什么材料。",
      },
    ];
  }

  if (id === "report") {
    return [
      ...base,
      {
        id: "report-source-trace",
        title: "报告来源追踪",
        rule: "报告草稿中的关键结论必须能追溯到来源段落或手动标注的假设。",
      },
    ];
  }

  return base;
}

function getValidationChecklist(id: AiWorkflowId) {
  const common = [
    "确认最终外发内容已展示，不只是元数据摘要。",
    "确认输出没有新增未提供的事实、数值或来源。",
    "确认敏感投研信息、token 和 secret 未进入提示词或输出。",
    "确认输出保存路径、保留规则和删除策略。",
  ];

  const map: Record<AiWorkflowId, string[]> = {
    summary: ["摘要是否先给结论。", "是否列出 thesis 影响和下一步。"],
    qa: ["是否直接回答问题。", "无法确认的点是否明确标注。"],
    report: ["章节是否可落到页面模板。", "模型影响是否避免编造数值。"],
    compare: ["比较对象和维度是否清楚。", "事实差异和推断差异是否分开。"],
    framework: ["框架是否可复用。", "是否包含数据需求和复盘节奏。"],
  };

  return [...map[id], ...common];
}

function buildBlockers(payloadPreview: AiPayloadPreview) {
  const blockers = [
    "AI 模型服务、模型、账号边界和保留规则尚未确认。",
    "/api/ai/run 仍是禁用的本地占位接口。",
    "服务端权限检查和 AI 审计事件尚未启用。",
  ];

  if (payloadPreview.summary.selected_pages > 0) {
    blockers.push("已选页面只是候选上下文；页面正文仍未确认进入外发内容。");
  }
  if (payloadPreview.summary.files_available > 0) {
    blockers.push("本地文件只是可用资源；文件字节仍未确认进入外发内容。");
  }
  if (payloadPreview.prompt.provided) {
    blockers.push("研究问题文本未包含在导出蓝图里；最终外发前仍需确认。");
  }

  return blockers;
}

function field(
  id: string,
  label: string,
  required: boolean,
  validationRule: string
): AiPromptOutputField {
  return {
    id,
    label,
    required,
    validation_rule: validationRule,
  };
}

function normalizeSectionId(section: string, index: number) {
  return `${index + 1}-${section
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function getSectionPurpose(section: string) {
  if (section.includes("目标") || section.includes("问题")) {
    return "定义任务边界，避免模型把未授权上下文扩展成事实。";
  }
  if (section.includes("上下文")) {
    return "列出最终外发内容中允许使用的本地材料。";
  }
  if (section.includes("输出")) {
    return "约束输出格式，让结果能进入 ZhiNotes 页面、报告或数据库草稿。";
  }
  if (section.includes("引用") || section.includes("不确定")) {
    return "要求模型标注来源、推断和不确定性。";
  }
  return "补充工作流特定约束。";
}

function getSectionInclusionRule(section: string) {
  if (section.includes("上下文")) {
    return "只允许包含用户最终确认的页面正文、文件内容或数据库字段。";
  }
  if (section.includes("目标") || section.includes("问题")) {
    return "研究问题文本进入外发内容前必须再次确认。";
  }
  return "只包含模板说明；不自动加入页面正文、文件字节或提示词正文。";
}
