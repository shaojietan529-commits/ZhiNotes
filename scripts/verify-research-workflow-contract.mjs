#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  workflow: "src/lib/modules/researchWorkflow.ts",
  graph: "src/lib/modules/researchGraph.ts",
  connectionsPanel: "src/components/modules/ResearchConnectionsPanel.tsx",
  graphShell: "src/components/modules/ResearchGraphShell.tsx",
  schemaPanel: "src/components/modules/ResearchWorkflowSchemaPanel.tsx",
  companyShell: "src/components/modules/CompanyResearchShell.tsx",
  reportsShell: "src/components/modules/ReportsShell.tsx",
  meetingsShell: "src/components/modules/MeetingsShell.tsx",
  portfolioShell: "src/components/modules/PortfolioShell.tsx",
  registry: "src/lib/modules/registry.ts",
  moduleActions: "src/lib/modules/actions.ts",
  readme: "README.md",
};

const requiredKinds = [
  {
    kind: "company",
    route: "/modules/company-research",
    preset: "company-research",
    relationKinds: ["report", "meeting"],
    keyFields: ["Ticker", "Company page", "Valuation assumptions"],
  },
  {
    kind: "report",
    route: "/modules/reports",
    preset: "report-library",
    relationKinds: ["company", "meeting"],
    keyFields: ["Report page", "Company page", "Key takeaways"],
  },
  {
    kind: "meeting",
    route: "/modules/meetings",
    preset: "meeting-tracker",
    relationKinds: ["company", "report"],
    keyFields: ["Meeting note", "Transcript page", "Action items"],
  },
  {
    kind: "portfolio",
    route: "/modules/portfolio",
    preset: "portfolio-tracker",
    relationKinds: ["company", "report", "meeting"],
    keyFields: ["Target weight", "Conviction", "Risk notes"],
  },
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
  const graph = readProjectFile(files.graph);
  const connectionsPanel = readProjectFile(files.connectionsPanel);
  const graphShell = readProjectFile(files.graphShell);
  const schemaPanel = readProjectFile(files.schemaPanel);
  const companyShell = readProjectFile(files.companyShell);
  const reportsShell = readProjectFile(files.reportsShell);
  const meetingsShell = readProjectFile(files.meetingsShell);
  const portfolioShell = readProjectFile(files.portfolioShell);
  const registry = readProjectFile(files.registry);
  const moduleActions = readProjectFile(files.moduleActions);
  const readme = readProjectFile(files.readme);

  assertIncludes(
    files.packageJson,
    packageJson,
    "verify:research-workflow",
    "Research workflow contract must be runnable from npm scripts."
  );
  assertIncludes(
    files.workflow,
    workflow,
    "RESEARCH_WORKFLOW_SPECS",
    "A shared research workflow schema must exist."
  );
  assertIncludes(
    files.graph,
    graph,
    "getExpectedRelationKinds",
    "Research graph schema gaps must read expected relation kinds from the shared schema."
  );
  assertIncludes(
    files.graph,
    graph,
    "getResearchModuleRoute",
    "Research graph completion targets must read module routes from the shared schema."
  );
  assertIncludes(
    files.graph,
    graph,
    "export { getResearchAssetKindLabel }",
    "Research graph must preserve the existing asset-label export for callers."
  );
  assertIncludes(
    files.connectionsPanel,
    connectionsPanel,
    "getResearchModuleRoute",
    "Cross-module panels must route through the shared workflow schema."
  );
  assertIncludes(
    files.graphShell,
    graphShell,
    "getResearchModuleRoute",
    "Research graph page must route through the shared workflow schema."
  );
  assertIncludes(
    files.schemaPanel,
    schemaPanel,
    "getResearchWorkflowSpec",
    "Reader-facing modules must render the shared workflow schema."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    'ResearchWorkflowSchemaPanel kind="company"',
    "Company module must show its object model."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    'ResearchWorkflowSchemaPanel kind="report"',
    "Reports module must show its object model."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    'ResearchWorkflowSchemaPanel kind="meeting"',
    "Meetings module must show its object model."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    'ResearchWorkflowSchemaPanel kind="portfolio"',
    "Portfolio module must show its object model."
  );

  for (const requirement of requiredKinds) {
    assertIncludes(
      files.workflow,
      workflow,
      `${requirement.kind}: {`,
      `Workflow schema must define ${requirement.kind}.`
    );
    assertIncludes(
      files.workflow,
      workflow,
      `module_route: "${requirement.route}"`,
      `${requirement.kind} must expose the correct module route.`
    );
    assertIncludes(
      files.workflow,
      workflow,
      `primary_database_preset: "${requirement.preset}"`,
      `${requirement.kind} must map to its starter preset.`
    );
    assertIncludes(
      files.registry,
      registry,
      `preset: "${requirement.preset}"`,
      `${requirement.kind} preset must remain in the module registry.`
    );
    assertIncludes(
      files.moduleActions,
      moduleActions,
      `"${requirement.preset}"`,
      `${requirement.kind} preset must remain executable.`
    );

    for (const relationKind of requirement.relationKinds) {
      assertIncludes(
        files.workflow,
        workflow,
        `"${relationKind}"`,
        `${requirement.kind} must declare expected ${relationKind} relations.`
      );
    }

    for (const field of requirement.keyFields) {
      assertIncludes(
        files.workflow,
        workflow,
        `"${field}"`,
        `${requirement.kind} must document key tracker field ${field}.`
      );
    }
  }

  assertIncludes(
    files.readme,
    readme,
    "Research Workflow Schema",
    "README must document the shared research workflow contract."
  );
  assertIncludes(
    files.readme,
    readme,
    "npm run verify:research-workflow",
    "README useful checks must include the research workflow verifier."
  );

  if (failures.length > 0) {
    console.error("Research workflow contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Research workflow contract verification passed");
  console.log(
    JSON.stringify(
      {
        workflow_kinds: requiredKinds.length,
        relation_contracts: requiredKinds.reduce(
          (total, item) => total + item.relationKinds.length,
          0
        ),
        shared_routes: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
