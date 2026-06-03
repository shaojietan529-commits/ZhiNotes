import type { AiExecutionGateStatus, AiExecutionPolicy } from "@/lib/ai/aiExecutionPolicy";
import type { AiPayloadPreview } from "@/lib/ai/aiPayloadPreview";
import type { AiResearchRunbook } from "@/lib/ai/aiResearchRunbook";
import type { AiWorkflowSpec } from "@/lib/ai/aiWorkflowContract";

export type AiOutputDestinationId =
  | "new-page-draft"
  | "append-to-existing-page"
  | "database-row-draft"
  | "report-page-draft"
  | "download-only";

export interface AiOutputDestination {
  id: AiOutputDestinationId;
  title: string;
  status: AiExecutionGateStatus;
  write_status: "disabled";
  default_behavior: string;
  required_confirmation: string;
}

export interface AiOutputAcceptanceGate {
  id: string;
  title: string;
  status: AiExecutionGateStatus;
  evidence: string;
  required_action: string;
  blocks_output_save: boolean;
}

export interface AiOutputReviewContractInput {
  workflow: AiWorkflowSpec;
  payloadPreview: AiPayloadPreview;
  executionPolicy: AiExecutionPolicy;
  researchRunbook: AiResearchRunbook;
}

export interface AiOutputReviewContract {
  format: "zhinote-ai-output-review-contract";
  format_version: 1;
  contract_status: "local-output-review-only";
  can_save_ai_output_now: false;
  can_overwrite_workspace_now: false;
  privacy_note: string;
  workflow: {
    id: string;
    title: string;
    expected_output: string;
  };
  boundary: {
    local_contract_only: true;
    calls_model_provider: false;
    reads_ai_output_text: false;
    includes_ai_output_text: false;
    reads_page_body_text: false;
    includes_page_body_text: false;
    includes_prompt_text: false;
    includes_file_bytes: false;
    includes_holdings_or_trading_plans: false;
    includes_client_info: false;
    includes_tokens_or_secrets: false;
    writes_workspace_data: false;
    creates_pages: false;
    overwrites_pages: false;
    updates_databases: false;
    uploads_output: false;
    syncs_output: false;
    requires_manual_output_preview: true;
    requires_source_attribution: true;
    requires_retention_decision: true;
    requires_audit_event_before_write: true;
  };
  summary: {
    destinations: number;
    disabled_write_paths: number;
    acceptance_gates: number;
    blocked_gates: number;
    manual_confirmation_gates: number;
    selected_pages: number;
    available_files: number;
  };
  destinations: AiOutputDestination[];
  acceptance_gates: AiOutputAcceptanceGate[];
  final_enablement_conditions: string[];
}

export function buildAiOutputReviewContract(
  input: AiOutputReviewContractInput
): AiOutputReviewContract {
  const destinations = buildDestinations();
  const gates = buildAcceptanceGates(input);

  return {
    format: "zhinote-ai-output-review-contract",
    format_version: 1,
    contract_status: "local-output-review-only",
    can_save_ai_output_now: false,
    can_overwrite_workspace_now: false,
    privacy_note:
      "本地生成。这个 AI 输出接收合同不调用模型 provider、不读取 AI 输出正文、不包含页面正文、prompt 正文、文件 bytes、持仓、交易计划、客户信息、token 或 secret，也不会创建页面、覆盖页面、更新数据库、上传或同步输出。",
    workflow: {
      id: input.workflow.id,
      title: input.workflow.title,
      expected_output: input.workflow.output,
    },
    boundary: {
      local_contract_only: true,
      calls_model_provider: false,
      reads_ai_output_text: false,
      includes_ai_output_text: false,
      reads_page_body_text: false,
      includes_page_body_text: false,
      includes_prompt_text: false,
      includes_file_bytes: false,
      includes_holdings_or_trading_plans: false,
      includes_client_info: false,
      includes_tokens_or_secrets: false,
      writes_workspace_data: false,
      creates_pages: false,
      overwrites_pages: false,
      updates_databases: false,
      uploads_output: false,
      syncs_output: false,
      requires_manual_output_preview: true,
      requires_source_attribution: true,
      requires_retention_decision: true,
      requires_audit_event_before_write: true,
    },
    summary: {
      destinations: destinations.length,
      disabled_write_paths: destinations.length,
      acceptance_gates: gates.length,
      blocked_gates: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation_gates: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      selected_pages: input.payloadPreview.summary.selected_pages,
      available_files: input.payloadPreview.summary.files_available,
    },
    destinations,
    acceptance_gates: gates,
    final_enablement_conditions: [
      "AI run endpoint 已启用，并且 provider、payload、retention、权限和审计门禁全部通过。",
      "展示完整 AI 输出正文、引用来源、生成时间、provider、模型和输入摘要。",
      "用户选择保存目标：新页面草稿、追加到现有页面、数据库 row 草稿、报告页草稿或仅下载。",
      "页面覆盖、数据库写入、文件上传和云同步必须保持独立确认，不能由 AI 输出自动触发。",
      "保存前完成敏感投研扫描，确认不含未授权持仓、交易计划、客户信息、token 或 secret。",
      "写入前生成 audit event；写入后保留删除或回滚路径。",
    ],
  };
}

function buildDestinations(): AiOutputDestination[] {
  return [
    {
      id: "new-page-draft",
      title: "新建页面草稿",
      status: "manual-confirmation",
      write_status: "disabled",
      default_behavior: "只允许先进入预览，不自动创建页面。",
      required_confirmation: "确认标题、目标父页面、引用来源和 retention 后才能写入。",
    },
    {
      id: "append-to-existing-page",
      title: "追加到现有页面",
      status: "manual-confirmation",
      write_status: "disabled",
      default_behavior: "默认禁止覆盖，只能在用户选择位置后追加。",
      required_confirmation: "确认目标页面、插入位置和可回滚快照后才能写入。",
    },
    {
      id: "database-row-draft",
      title: "数据库 row 草稿",
      status: "manual-confirmation",
      write_status: "disabled",
      default_behavior: "只生成字段映射计划，不自动写数据库 row values。",
      required_confirmation: "确认目标数据库、字段映射、row 标题和敏感字段后才能写入。",
    },
    {
      id: "report-page-draft",
      title: "报告页草稿",
      status: "manual-confirmation",
      write_status: "disabled",
      default_behavior: "可以作为报告结构候选，但不自动替换 HTML/PDF/Word 原件。",
      required_confirmation: "确认报告格式、来源引用和原文件保留策略后才能写入。",
    },
    {
      id: "download-only",
      title: "仅下载",
      status: "planned",
      write_status: "disabled",
      default_behavior: "优先作为低风险出口，不写入当前 workspace。",
      required_confirmation: "下载前仍需确认输出正文和敏感信息扫描结果。",
    },
  ];
}

function buildAcceptanceGates(
  input: AiOutputReviewContractInput
): AiOutputAcceptanceGate[] {
  return [
    {
      id: "ai-run-completed",
      title: "AI 执行已完成",
      status: "blocked",
      evidence: `${input.executionPolicy.disabled_endpoint} 仍是 disabled local stub；当前不能生成真实 AI 输出。`,
      required_action: "在 provider、payload、权限和审计全部通过前，保持 AI 输出保存禁用。",
      blocks_output_save: true,
    },
    {
      id: "output-text-preview",
      title: "输出正文预览",
      status: "manual-confirmation",
      evidence: "当前合同不读取或包含 AI 输出正文。",
      required_action: "保存前展示完整输出正文，不能只展示摘要、标题或 metadata。",
      blocks_output_save: true,
    },
    {
      id: "source-attribution-review",
      title: "来源引用复核",
      status: "manual-confirmation",
      evidence: `${input.payloadPreview.summary.selected_pages} 个页面和 ${input.payloadPreview.summary.files_available} 个文件是候选上下文，但正文和文件 bytes 仍未进入 payload。`,
      required_action: "输出保存前必须显示本地来源、引用范围和未引用材料。",
      blocks_output_save: true,
    },
    {
      id: "hallucination-risk-check",
      title: "投研事实核查",
      status: "manual-confirmation",
      evidence: "AI 输出可能包含未验证事实、估值假设或投资结论。",
      required_action: "保存前标记未经验证的事实、估值、管理层表述和投资判断。",
      blocks_output_save: true,
    },
    {
      id: "sensitive-content-scan",
      title: "敏感信息扫描",
      status: "manual-confirmation",
      evidence: "合同默认排除持仓、交易计划、客户信息、token 和 secret。",
      required_action: "写入前确认输出不含未授权敏感投研信息或密钥。",
      blocks_output_save: true,
    },
    {
      id: "retention-delete-policy",
      title: "保留与删除策略",
      status: "blocked",
      evidence: "尚未实现 AI output retention、删除、回滚或版本策略。",
      required_action: "定义输出保存位置、保留期限、删除流程和版本快照。",
      blocks_output_save: true,
    },
    {
      id: "permission-audit-before-write",
      title: "写入前权限与审计",
      status: "blocked",
      evidence: `${input.researchRunbook.summary.blocked_steps} 个 runbook 步骤仍阻塞；server-side audit event 尚未启用。`,
      required_action: "写入页面或数据库前，先通过角色权限检查并记录 redacted audit event。",
      blocks_output_save: true,
    },
  ];
}
