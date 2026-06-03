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
      "Generated locally. This AI execution policy does not call model providers, read page body text, read file bytes, upload workspace data, store AI output, or share notes.",
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
      "This local route is disabled. It does not read request bodies, call model providers, upload page content, upload file bytes, store AI output, or share workspace data.",
    required_before_enablement: [
      "Choose model provider and account boundary.",
      "Confirm final outbound payload preview.",
      "Confirm retention and logging policy.",
      "Add server-side permission checks and audit events.",
    ],
  };
}

function buildExecutionGates(payloadPreview: AiPayloadPreview): AiExecutionGate[] {
  return [
    {
      id: "provider-selection",
      title: "Model provider selection",
      status: "blocked",
      evidence: "No AI provider, model, destination, or account boundary exists.",
      required_action:
        "Choose provider, model, destination, billing boundary, and data processing terms before any outbound request.",
    },
    {
      id: "final-payload-preview",
      title: "Final payload preview",
      status: "manual-confirmation",
      evidence: `${payloadPreview.summary.approvals_required} payload approvals are currently required.`,
      required_action:
        "Show the exact final payload and require explicit confirmation immediately before sending.",
    },
    {
      id: "page-context-confirmation",
      title: "Page context confirmation",
      status:
        payloadPreview.summary.selected_pages > 0
          ? "manual-confirmation"
          : "planned",
      evidence: `${payloadPreview.summary.selected_pages} pages are selected as possible context, but page body text is excluded.`,
      required_action:
        "Confirm selected page body inclusion and citation behavior before page text can enter an AI request.",
    },
    {
      id: "file-content-confirmation",
      title: "File content confirmation",
      status:
        payloadPreview.summary.files_available > 0
          ? "manual-confirmation"
          : "planned",
      evidence: `${payloadPreview.summary.files_available} local files are available, but file bytes are excluded.`,
      required_action:
        "Confirm file kind, file name, byte inclusion, and retention before file content can enter an AI request.",
    },
    {
      id: "retention-policy",
      title: "Retention and logging policy",
      status: "blocked",
      evidence: "No retention, prompt storage, output storage, or deletion policy exists.",
      required_action:
        "Define prompt retention, output retention, local save behavior, and deletion workflow.",
    },
    {
      id: "permission-and-audit",
      title: "Permission and audit checks",
      status: "blocked",
      evidence: "No server-side AI permission check or AI audit event exists.",
      required_action:
        "Require role checks and audit events before enabling AI execution in Web Beta.",
    },
  ];
}
