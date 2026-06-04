#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  workflow: "src/lib/ai/aiWorkflowContract.ts",
  workflowReadiness: "src/lib/ai/aiWorkflowReadiness.ts",
  payloadPreview: "src/lib/ai/aiPayloadPreview.ts",
  executionPolicy: "src/lib/ai/aiExecutionPolicy.ts",
  promptBlueprint: "src/lib/ai/aiPromptBlueprint.ts",
  contextPacket: "src/lib/ai/aiContextPacket.ts",
  aiWorkbench: "src/lib/ai/aiWorkbench.ts",
  researchRunbook: "src/lib/ai/aiResearchRunbook.ts",
  outputReview: "src/lib/ai/aiOutputReview.ts",
  aiShell: "src/components/modules/AiWorkbenchShell.tsx",
  aiRoute: "src/app/api/ai/run/route.ts",
  highRiskRegistry: "src/lib/security/highRiskActionRegistry.ts",
  readme: "README.md",
};

const requiredWorkflows = ["summary", "qa", "report", "compare", "framework"];
const requiredPolicyGates = [
  "provider-selection",
  "final-payload-preview",
  "page-context-confirmation",
  "file-content-confirmation",
  "retention-policy",
  "permission-and-audit",
];
const requiredRunbookSteps = [
  "scope-research-task",
  "context-page-selection",
  "context-file-selection",
  "payload-final-preview",
  "sensitive-finance-exclusions",
  "provider-and-model-policy",
  "owner-final-confirmation",
  "permission-audit-events",
  "output-retention-save-policy",
];
const requiredOutputDestinations = [
  "new-page-draft",
  "append-to-existing-page",
  "database-row-draft",
  "report-page-draft",
  "download-only",
];
const requiredOutputGates = [
  "ai-run-completed",
  "output-text-preview",
  "source-attribution-review",
  "hallucination-risk-check",
  "sensitive-content-scan",
  "retention-delete-policy",
  "permission-audit-before-write",
];

const failures = [];

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function assertIncludes(sourceLabel, source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(`${sourceLabel} missing ${snippet}: ${message}`);
  }
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const workflow = readProjectFile(files.workflow);
  const workflowReadiness = readProjectFile(files.workflowReadiness);
  const payloadPreview = readProjectFile(files.payloadPreview);
  const executionPolicy = readProjectFile(files.executionPolicy);
  const promptBlueprint = readProjectFile(files.promptBlueprint);
  const contextPacket = readProjectFile(files.contextPacket);
  const aiWorkbench = readProjectFile(files.aiWorkbench);
  const researchRunbook = readProjectFile(files.researchRunbook);
  const outputReview = readProjectFile(files.outputReview);
  const aiShell = readProjectFile(files.aiShell);
  const aiRoute = readProjectFile(files.aiRoute);
  const highRiskRegistry = readProjectFile(files.highRiskRegistry);
  const readme = readProjectFile(files.readme);

  assertIncludes(
    files.packageJson,
    packageJson,
    "verify:ai",
    "AI contract must be runnable from npm scripts."
  );
  assertIncludes(
    files.workflow,
    workflow,
    "AI_WORKFLOWS",
    "AI workflows must live in a reusable contract file."
  );
  assertIncludes(
    files.workflowReadiness,
    workflowReadiness,
    'format: "zhinote-ai-workflow-readiness"',
    "AI workflow readiness must define a stable local export format."
  );
  assertIncludes(
    files.workflowReadiness,
    workflowReadiness,
    "buildAiWorkflowReadinessReport",
    "AI workflow readiness must expose a reusable builder."
  );
  for (const snippet of [
    "AI_WORKFLOWS",
    "local_catalog_only: true",
    "reads_workflow_metadata: true",
    "reads_page_body_text: false",
    "reads_prompt_text: false",
    "reads_file_bytes: false",
    "includes_page_body_text: false",
    "includes_prompt_text: false",
    "includes_file_bytes: false",
    "includes_holdings_or_trading_plans: false",
    "includes_client_info: false",
    "includes_tokens_or_secrets: false",
    "calls_model_provider: false",
    "writes_workspace_data: false",
    "uploads_data: false",
    "enables_ai: false",
    "blocked-external-run",
  ]) {
    assertIncludes(
      files.workflowReadiness,
      workflowReadiness,
      snippet,
      "AI workflow readiness must preserve local-only workflow boundaries."
    );
  }
  assertIncludes(
    files.aiShell,
    aiShell,
    "@/lib/ai/aiWorkflowContract",
    "AI Workbench must consume the shared workflow contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "@/lib/ai/aiWorkflowReadiness",
    "AI Workbench must consume the shared workflow readiness contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "@/lib/ai/aiResearchRunbook",
    "AI Workbench must consume the shared research runbook contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "@/lib/ai/aiPromptBlueprint",
    "AI Workbench must consume the shared prompt blueprint contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "@/lib/ai/aiOutputReview",
    "AI Workbench must consume the shared output review contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "@/lib/ai/aiContextPacket",
    "AI Workbench must consume the shared context packet contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "AI 工作台",
    "AI Workbench UI should use the Chinese product language."
  );
  for (const snippet of [
    "AI workflow readiness",
    "AiWorkflowReadinessPanel",
    "ReadinessStatusPill",
    "五类 AI 投研能力",
    "不读取页面正文、prompt 正文、文件 bytes",
    "默认排除",
  ]) {
    assertIncludes(
      files.aiShell,
      aiShell,
      snippet,
      "AI Workbench must render workflow readiness and default exclusions."
    );
  }
  for (const snippet of [
    "buildAiPromptBlueprint",
    "handleExportPromptBlueprint",
    "AI Prompt 蓝图",
    "导出蓝图",
    "PromptBlueprintSectionCard",
    "PromptOutputFieldCard",
    "PromptChecklistPanel",
    "不读取 prompt 正文、页面正文或文件 bytes",
  ]) {
    assertIncludes(
      files.aiShell,
      aiShell,
      snippet,
      "AI Workbench must render and export the prompt blueprint."
    );
  }
  for (const snippet of [
    "buildAiContextPacket",
    "handleExportContextPacket",
    "AI 上下文包",
    "导出上下文包",
    "ContextPacketItemRow",
    "metadata-only context packet",
    "不读取 prompt 正文、页面正文或文件 bytes",
  ]) {
    assertIncludes(
      files.aiShell,
      aiShell,
      snippet,
      "AI Workbench must render and export the AI context packet."
    );
  }
  assertIncludes(
    files.aiShell,
    aiShell,
    "@/lib/ai/aiWorkbench",
    "AI Workbench shell must consume the local AI workbench packet."
  );
  for (const snippet of [
    "buildAiWorkbenchPacket",
    "handleExportAiWorkbench",
    "AI 工作台总控",
    "导出 AI 工作台",
    "工作台 lanes",
    "优先动作",
    "启用顺序",
    "导出不包含页面标题",
    "AiWorkbenchLaneCard",
    "AiWorkbenchActionCard",
    "AiEnablementStepCard",
    "AiWorkbenchPriorityPill",
  ]) {
    assertIncludes(
      files.aiShell,
      aiShell,
      snippet,
      "AI Workbench must render and export the local AI workbench packet."
    );
  }

  for (const workflowId of requiredWorkflows) {
    assertIncludes(
      files.workflow,
      workflow,
      `id: "${workflowId}"`,
      `AI workflow ${workflowId} must be declared.`
    );
  }

  assertIncludes(
    files.payloadPreview,
    payloadPreview,
    "can_run_ai_now: false",
    "AI payload preview must not enable AI execution."
  );
  assertIncludes(
    files.payloadPreview,
    payloadPreview,
    "includes_page_body_text: false",
    "AI payload preview must exclude page body text."
  );
  assertIncludes(
    files.payloadPreview,
    payloadPreview,
    "includes_file_bytes: false",
    "AI payload preview must exclude file bytes."
  );
  assertIncludes(
    files.payloadPreview,
    payloadPreview,
    "calls_model_provider: false",
    "AI payload preview must not call model providers."
  );
  assertIncludes(
    files.executionPolicy,
    executionPolicy,
    "AI_RUN_DISABLED_HTTP_STATUS = 501",
    "AI run endpoint must remain a disabled stub."
  );
  assertIncludes(
    files.executionPolicy,
    executionPolicy,
    "reads_request_body: false",
    "Disabled AI route must not read request bodies."
  );
  assertIncludes(
    files.executionPolicy,
    executionPolicy,
    "calls_model_provider: false",
    "Disabled AI route must not call providers."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "format: \"zhinote-ai-research-runbook\"",
    "AI research runbook must use a stable export format."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "can_run_ai_now: false",
    "AI research runbook must not enable AI execution."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "includes_page_body_text: false",
    "AI research runbook must exclude page body text."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "includes_prompt_text: false",
    "AI research runbook must exclude prompt text."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "includes_file_bytes: false",
    "AI research runbook must exclude file bytes."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "includes_holdings_or_trading_plans: false",
    "AI research runbook must exclude holdings and trading plans by default."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "includes_client_info: false",
    "AI research runbook must exclude client information by default."
  );
  assertIncludes(
    files.researchRunbook,
    researchRunbook,
    "includes_tokens_or_secrets: false",
    "AI research runbook must exclude tokens and secrets."
  );
  assertIncludes(
    files.aiRoute,
    aiRoute,
    "buildAiRunDisabledResponse",
    "AI run route must return the disabled response."
  );

  for (const gateId of requiredPolicyGates) {
    assertIncludes(
      files.executionPolicy,
      executionPolicy,
      `id: "${gateId}"`,
      `AI execution policy gate ${gateId} must exist.`
    );
  }

  assertIncludes(
    files.promptBlueprint,
    promptBlueprint,
    'format: "zhinote-ai-prompt-blueprint"',
    "AI prompt blueprint must define a stable local export format."
  );
  assertIncludes(
    files.promptBlueprint,
    promptBlueprint,
    "buildAiPromptBlueprint",
    "AI prompt blueprint must expose a reusable builder."
  );
  for (const snippet of [
    'blueprint_status: "local-prompt-blueprint-only"',
    "can_run_ai_now: false",
    "local_blueprint_only: true",
    "reads_workflow_metadata: true",
    "reads_payload_preview_metadata: true",
    "reads_prompt_text: false",
    "reads_page_body_text: false",
    "reads_file_bytes: false",
    "includes_prompt_text: false",
    "includes_page_body_text: false",
    "includes_file_bytes: false",
    "includes_holdings_or_trading_plans: false",
    "includes_client_info: false",
    "includes_tokens_or_secrets: false",
    "calls_model_provider: false",
    "writes_workspace_data: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.promptBlueprint,
      promptBlueprint,
      snippet,
      "AI prompt blueprint must preserve local-only prompt boundaries."
    );
  }
  for (const snippet of [
    "getOutputSchema",
    "getCitationRules",
    "getValidationChecklist",
    "authorized-context-only",
    "separate-fact-and-inference",
    "no-sensitive-defaults",
    "executive-summary",
    "direct-answer",
    "report-outline",
    "investment-implication",
    "review-cadence",
  ]) {
    assertIncludes(
      files.promptBlueprint,
      promptBlueprint,
      snippet,
      "AI prompt blueprint must define reusable schemas for every workflow."
    );
  }

  assertIncludes(
    files.contextPacket,
    contextPacket,
    'format: "zhinote-ai-context-packet"',
    "AI context packet must define a stable local export format."
  );
  assertIncludes(
    files.contextPacket,
    contextPacket,
    "buildAiContextPacket",
    "AI context packet must expose a reusable builder."
  );
  for (const snippet of [
    'packet_status: "local-context-packet-only"',
    "can_run_ai_now: false",
    "local_context_packet_only: true",
    "reads_workflow_metadata: true",
    "reads_payload_preview_metadata: true",
    "reads_prompt_blueprint_metadata: true",
    "reads_prompt_text: false",
    "reads_page_body_text: false",
    "reads_file_bytes: false",
    "includes_prompt_text: false",
    "includes_page_body_text: false",
    "includes_file_bytes: false",
    "includes_holdings_or_trading_plans: false",
    "includes_client_info: false",
    "includes_tokens_or_secrets: false",
    "calls_model_provider: false",
    "writes_workspace_data: false",
    "uploads_data: false",
    "enables_ai: false",
    "metadata-is-not-evidence",
    "final-payload-visible",
    "provider-retention-selected",
  ]) {
    assertIncludes(
      files.contextPacket,
      contextPacket,
      snippet,
      "AI context packet must preserve metadata-only outbound boundaries."
    );
  }

  assertIncludes(
    files.aiWorkbench,
    aiWorkbench,
    'format: "zhinote-ai-workbench-packet"',
    "AI workbench packet must define a stable local export format."
  );
  assertIncludes(
    files.aiWorkbench,
    aiWorkbench,
    "buildAiWorkbenchPacket",
    "AI workbench packet must expose a reusable builder."
  );
  for (const snippet of [
    'packet_status: "local-ai-workbench-only"',
    "can_run_ai_now: false",
    "local_packet_only: true",
    "reads_workflow_metadata: true",
    "reads_payload_preview_summary: true",
    "reads_execution_policy_summary: true",
    "reads_prompt_blueprint_summary: true",
    "reads_context_packet_summary: true",
    "reads_runbook_summary: true",
    "reads_output_review_summary: true",
    "reads_page_titles: false",
    "reads_page_body_text: false",
    "reads_prompt_text: false",
    "reads_file_bytes: false",
    "includes_page_titles: false",
    "includes_page_body_text: false",
    "includes_prompt_text: false",
    "includes_file_bytes: false",
    "includes_holdings_or_trading_plans: false",
    "includes_client_info: false",
    "includes_tokens_or_secrets: false",
    "writes_workspace_data: false",
    "creates_pages: false",
    "updates_databases: false",
    "stores_ai_output: false",
    "calls_model_provider: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "workflow-scope",
    "context-selection",
    "payload-review",
    "provider-permission",
    "prompt-and-output",
    "audit-retention",
    "privacy-boundary",
    "export_ai_selected_page_titles_from_workbench",
    "call_model_provider",
    "send_payload_to_ai_provider",
    "auto_create_ai_output_page",
  ]) {
    assertIncludes(
      files.aiWorkbench,
      aiWorkbench,
      snippet,
      "AI workbench packet must preserve local-only AI enablement boundaries."
    );
  }

  for (const stepId of requiredRunbookSteps) {
    assertIncludes(
      files.researchRunbook,
      researchRunbook,
      `id: "${stepId}"`,
      `AI research runbook step ${stepId} must exist.`
    );
  }

  assertIncludes(
    files.outputReview,
    outputReview,
    'format: "zhinote-ai-output-review-contract"',
    "AI output review must use a stable export format."
  );
  assertIncludes(
    files.outputReview,
    outputReview,
    "buildAiOutputReviewContract",
    "AI output review must expose a reusable builder."
  );
  assertIncludes(
    files.outputReview,
    outputReview,
    "can_save_ai_output_now: false",
    "AI output review must not allow saving AI output yet."
  );
  assertIncludes(
    files.outputReview,
    outputReview,
    "can_overwrite_workspace_now: false",
    "AI output review must not allow workspace overwrite."
  );
  for (const snippet of [
    "local_contract_only: true",
    "calls_model_provider: false",
    "reads_ai_output_text: false",
    "includes_ai_output_text: false",
    "reads_page_body_text: false",
    "includes_page_body_text: false",
    "includes_prompt_text: false",
    "includes_file_bytes: false",
    "includes_holdings_or_trading_plans: false",
    "includes_client_info: false",
    "includes_tokens_or_secrets: false",
    "writes_workspace_data: false",
    "creates_pages: false",
    "overwrites_pages: false",
    "updates_databases: false",
    "uploads_output: false",
    "syncs_output: false",
    "requires_manual_output_preview: true",
    "requires_source_attribution: true",
    "requires_retention_decision: true",
    "requires_audit_event_before_write: true",
  ]) {
    assertIncludes(
      files.outputReview,
      outputReview,
      snippet,
      "AI output review must preserve local-only output boundaries."
    );
  }
  for (const destinationId of requiredOutputDestinations) {
    assertIncludes(
      files.outputReview,
      outputReview,
      `id: "${destinationId}"`,
      `AI output review destination ${destinationId} must exist.`
    );
  }
  for (const gateId of requiredOutputGates) {
    assertIncludes(
      files.outputReview,
      outputReview,
      `id: "${gateId}"`,
      `AI output review gate ${gateId} must exist.`
    );
  }
  assertIncludes(
    files.aiShell,
    aiShell,
    "AI 输出接收合同",
    "AI Workbench must render the output review contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "不读取 AI 输出正文",
    "AI Workbench must explain output text is not read."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "不自动覆盖页面",
    "AI Workbench must block automatic page overwrite."
  );

  assertIncludes(
    files.highRiskRegistry,
    highRiskRegistry,
    '"ai-external-run"',
    "AI external run must remain registered as a high-risk action."
  );
  assertIncludes(
    files.highRiskRegistry,
    highRiskRegistry,
    "ENABLE AI EXTERNAL RUN",
    "AI external run must require a typed confirmation phrase."
  );
  assertIncludes(
    files.readme,
    readme,
    "AI Workflow Contract",
    "README must document the AI workflow contract."
  );
  assertIncludes(
    files.readme,
    readme,
    "AI Research Runbook",
    "README must document the AI research runbook."
  );
  assertIncludes(
    files.readme,
    readme,
    "AI prompt blueprint",
    "README must document the AI prompt blueprint."
  );
  assertIncludes(
    files.readme,
    readme,
    "AI Context Packet",
    "README must document the AI context packet."
  );
  assertIncludes(
    files.readme,
    readme,
    "AI Output Review Contract",
    "README must document the AI output review contract."
  );
  assertIncludes(
    files.readme,
    readme,
    "npm run verify:ai",
    "README useful checks must include the AI verifier."
  );

  if (failures.length > 0) {
    console.error("AI contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("AI contract verification passed");
  console.log(
    JSON.stringify(
      {
        workflows: requiredWorkflows.length,
        execution_gates: requiredPolicyGates.length,
        prompt_blueprint_workflows: requiredWorkflows.length,
        context_packet: true,
        ai_workbench_packet: true,
        research_runbook_steps: requiredRunbookSteps.length,
        output_destinations: requiredOutputDestinations.length,
        output_review_gates: requiredOutputGates.length,
        run_endpoint_disabled: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
