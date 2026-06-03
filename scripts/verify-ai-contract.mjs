#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  workflow: "src/lib/ai/aiWorkflowContract.ts",
  payloadPreview: "src/lib/ai/aiPayloadPreview.ts",
  executionPolicy: "src/lib/ai/aiExecutionPolicy.ts",
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
  const payloadPreview = readProjectFile(files.payloadPreview);
  const executionPolicy = readProjectFile(files.executionPolicy);
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
    files.aiShell,
    aiShell,
    "@/lib/ai/aiWorkflowContract",
    "AI Workbench must consume the shared workflow contract."
  );
  assertIncludes(
    files.aiShell,
    aiShell,
    "AI 工作台",
    "AI Workbench UI should use the Chinese product language."
  );

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
        run_endpoint_disabled: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
