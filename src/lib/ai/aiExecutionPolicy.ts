import type { AiPayloadPreview } from "@/lib/ai/aiPayloadPreview";

export type AiExecutionGateStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface AiExecutionPolicyInput {
  payloadPreview: AiPayloadPreview;
}

export interface AiExecutionGate {
  id: string;
  title: string;
  status: AiExecutionGateStatus;
  evidence: string;
  required_action: string;
}

export interface AiExecutionPolicy {
  format: "zhinote-ai-execution-policy";
  format_version: 1;
  policy_status: "local-policy-only";
  can_run_ai_now: false;
  disabled_endpoint: "/api/ai/run";
  privacy_note: string;
  boundary: {
    local_policy_only: true;
    calls_model_provider: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    stores_ai_output: false;
    requires_final_payload_preview: true;
  };
  summary: {
    gates: number;
    blocked: number;
    manual_confirmation: number;
    planned: number;
    payload_approvals_required: number;
  };
  gates: AiExecutionGate[];
}

export interface AiRunDisabledResponse {
  format: "zhinote-ai-run-disabled-response";
  format_version: 1;
  endpoint: "/api/ai/run";
  status: "disabled-local-stub";
  can_run_ai_now: false;
  reads_request_body: false;
  calls_model_provider: false;
  uploads_page_content: false;
  uploads_file_bytes: false;
  stores_ai_output: false;
  privacy_note: string;
  required_before_enablement: string[];
}

export const AI_RUN_DISABLED_HTTP_STATUS = 501;

export function buildAiExecutionPolicy(
  input: AiExecutionPolicyInput
): AiExecutionPolicy {
  const gates = buildExecutionGates(input.payloadPreview);

  return {
    format: "zhinote-ai-execution-policy",
    format_version: 1,
    policy_status: "local-policy-only",
    can_run_ai_now: false,
    disabled_endpoint: "/api/ai/run",
    privacy_note:
      "本地生成。这个 AI 执行策略不会调用模型 provider、读取页面正文、读取文件 bytes、上传 workspace 数据、保存 AI 输出或分享笔记。",
    boundary: {
      local_policy_only: true,
      calls_model_provider: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      uploads_workspace_data: false,
      stores_ai_output: false,
      requires_final_payload_preview: true,
    },
    summary: {
      gates: gates.length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      planned: gates.filter((gate) => gate.status === "planned").length,
      payload_approvals_required:
        input.payloadPreview.summary.approvals_required,
    },
    gates,
  };
}

export function buildAiRunDisabledResponse(): AiRunDisabledResponse {
  return {
    format: "zhinote-ai-run-disabled-response",
    format_version: 1,
    endpoint: "/api/ai/run",
    status: "disabled-local-stub",
    can_run_ai_now: false,
    reads_request_body: false,
    calls_model_provider: false,
    uploads_page_content: false,
    uploads_file_bytes: false,
    stores_ai_output: false,
    privacy_note:
      "这个本地 route 已禁用。它不会读取 request body、调用模型 provider、上传页面内容、上传文件 bytes、保存 AI 输出或分享 workspace 数据。",
    required_before_enablement: [
      "选择模型 provider 和账号边界。",
      "确认最终 outbound payload 预览。",
      "确认 retention 和 logging policy。",
      "增加 server-side permission checks 和 audit events。",
    ],
  };
}

function buildExecutionGates(payloadPreview: AiPayloadPreview): AiExecutionGate[] {
  return [
    {
      id: "provider-selection",
      title: "模型 provider 选择",
      status: "blocked",
      evidence: "尚未定义 AI provider、模型、目标服务或账号边界。",
      required_action:
        "任何外发请求前，先选择 provider、模型、目标服务、计费边界和数据处理条款。",
    },
    {
      id: "final-payload-preview",
      title: "最终 payload 预览",
      status: "manual-confirmation",
      evidence: `当前需要 ${payloadPreview.summary.approvals_required} 个 payload 确认项。`,
      required_action:
        "发送前展示精确最终 payload，并要求显式确认。",
    },
    {
      id: "page-context-confirmation",
      title: "页面上下文确认",
      status:
        payloadPreview.summary.selected_pages > 0
          ? "manual-confirmation"
          : "planned",
      evidence: `${payloadPreview.summary.selected_pages} 个页面被选为候选上下文，但页面正文仍被排除。`,
      required_action:
        "页面正文进入 AI request 前，先确认正文包含范围和引用方式。",
    },
    {
      id: "file-content-confirmation",
      title: "文件内容确认",
      status:
        payloadPreview.summary.files_available > 0
          ? "manual-confirmation"
          : "planned",
      evidence: `${payloadPreview.summary.files_available} 个本地文件可用，但文件 bytes 仍被排除。`,
      required_action:
        "文件内容进入 AI request 前，先确认文件类型、文件名、bytes 包含范围和 retention。",
    },
    {
      id: "retention-policy",
      title: "Retention 和 logging policy",
      status: "blocked",
      evidence: "尚未定义 retention、prompt storage、output storage 或 deletion policy。",
      required_action:
        "定义 prompt retention、output retention、本地保存行为和删除流程。",
    },
    {
      id: "permission-and-audit",
      title: "权限和审计检查",
      status: "blocked",
      evidence: "尚未实现 server-side AI permission check 或 AI audit event。",
      required_action:
        "Web Beta 启用 AI 执行前，必须加入角色检查和 audit event。",
    },
  ];
}
