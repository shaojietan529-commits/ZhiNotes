#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  workflow: "src/lib/modules/researchWorkflow.ts",
  graph: "src/lib/modules/researchGraph.ts",
  companyCoverage: "src/lib/company/companyCoverage.ts",
  meetingFollowUp: "src/lib/meetings/meetingFollowUp.ts",
  portfolioReview: "src/lib/portfolio/portfolioReview.ts",
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

const requiredCompanyCoverageAreas = [
  "company-home",
  "investment-memo",
  "earnings-review",
  "valuation",
  "key-metrics",
  "related-reports",
  "related-meetings",
  "tracker-database",
];

const requiredMeetingFollowUpStages = [
  "prep",
  "transcript-review",
  "action-items",
  "research-linking",
  "done",
];

const requiredPortfolioReviewAreas = [
  "position-memo",
  "watchlist",
  "sizing-discipline",
  "conviction",
  "catalyst",
  "risk-notes",
  "thesis",
  "research-links",
  "tracker-database",
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
  const companyCoverage = readProjectFile(files.companyCoverage);
  const meetingFollowUp = readProjectFile(files.meetingFollowUp);
  const portfolioReview = readProjectFile(files.portfolioReview);
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
    files.companyCoverage,
    companyCoverage,
    'format: "zhinote-company-coverage-report"',
    "Company coverage must define a local export format."
  );
  assertIncludes(
    files.companyCoverage,
    companyCoverage,
    "buildCompanyCoverageReport",
    "Company coverage must expose a reusable builder."
  );
  for (const snippet of [
    "local_report_only: true",
    "reads_local_page_html: true",
    "reads_database_metadata: true",
    "includes_page_text: false",
    "includes_database_row_values: false",
    "reads_file_bytes: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.companyCoverage,
      companyCoverage,
      snippet,
      "Company coverage must preserve local-only boundaries."
    );
  }
  for (const area of requiredCompanyCoverageAreas) {
    assertIncludes(
      files.companyCoverage,
      companyCoverage,
      `id: "${area}"`,
      `Company coverage must keep area ${area}.`
    );
  }
  assertIncludes(
    files.meetingFollowUp,
    meetingFollowUp,
    'format: "zhinote-meeting-follow-up-report"',
    "Meeting follow-up must define a local export format."
  );
  assertIncludes(
    files.meetingFollowUp,
    meetingFollowUp,
    "buildMeetingFollowUpReport",
    "Meeting follow-up must expose a reusable builder."
  );
  for (const snippet of [
    "local_report_only: true",
    "reads_local_page_html: true",
    "reads_database_metadata: true",
    "includes_page_text: false",
    "includes_database_row_values: false",
    "reads_file_bytes: false",
    "joins_calls: false",
    "records_audio: false",
    "publishes_notes: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.meetingFollowUp,
      meetingFollowUp,
      snippet,
      "Meeting follow-up must preserve local-only boundaries."
    );
  }
  for (const stage of requiredMeetingFollowUpStages) {
    assertIncludes(
      files.meetingFollowUp,
      meetingFollowUp,
      `id: "${stage}"`,
      `Meeting follow-up must keep stage ${stage}.`
    );
  }
  assertIncludes(
    files.portfolioReview,
    portfolioReview,
    'format: "zhinote-portfolio-review-report"',
    "Portfolio review must define a local export format."
  );
  assertIncludes(
    files.portfolioReview,
    portfolioReview,
    "buildPortfolioReviewReport",
    "Portfolio review must expose a reusable builder."
  );
  for (const snippet of [
    "local_report_only: true",
    "reads_local_page_html: true",
    "reads_database_metadata: true",
    "includes_page_text: false",
    "includes_page_titles: false",
    "includes_database_row_values: false",
    "includes_position_names: false",
    "includes_tickers: false",
    "includes_weights: false",
    "includes_trading_plans: false",
    "includes_transactions: false",
    "reads_file_bytes: false",
    "connects_brokerage_accounts: false",
    "fetches_prices: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.portfolioReview,
      portfolioReview,
      snippet,
      "Portfolio review must preserve local-only privacy boundaries."
    );
  }
  for (const area of requiredPortfolioReviewAreas) {
    assertIncludes(
      files.portfolioReview,
      portfolioReview,
      `id: "${area}"`,
      `Portfolio review must keep area ${area}.`
    );
  }
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
    files.companyShell,
    companyShell,
    "buildCompanyCoverageReport",
    "Company module must build the company coverage report."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "公司覆盖雷达",
    "Company module must render the coverage radar."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "Export coverage",
    "Company module must export the coverage report."
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
    files.meetingsShell,
    meetingsShell,
    "buildMeetingFollowUpReport",
    "Meetings module must build the follow-up report."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "会议 follow-up 队列",
    "Meetings module must render the follow-up queue."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "Export follow-up",
    "Meetings module must export the follow-up report."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    'ResearchWorkflowSchemaPanel kind="portfolio"',
    "Portfolio module must show its object model."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "buildPortfolioReviewReport",
    "Portfolio module must build the review report."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "组合复盘雷达",
    "Portfolio module must render the review radar."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "Export review",
    "Portfolio module must export the review report."
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
    "company coverage radar",
    "README must document company coverage reporting."
  );
  assertIncludes(
    files.readme,
    readme,
    "meeting follow-up queue",
    "README must document meeting follow-up reporting."
  );
  assertIncludes(
    files.readme,
    readme,
    "portfolio review radar",
    "README must document portfolio review reporting."
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
        company_coverage_areas: requiredCompanyCoverageAreas.length,
        meeting_follow_up_stages: requiredMeetingFollowUpStages.length,
        portfolio_review_areas: requiredPortfolioReviewAreas.length,
        shared_routes: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
