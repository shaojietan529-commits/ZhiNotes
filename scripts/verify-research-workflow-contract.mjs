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
  companyDossier: "src/lib/company/companyResearchDossier.ts",
  companyPlaybook: "src/lib/company/companyResearchPlaybook.ts",
  companyTrackerIntake: "src/lib/company/companyTrackerIntake.ts",
  meetingFollowUp: "src/lib/meetings/meetingFollowUp.ts",
  meetingDecisionLedger: "src/lib/meetings/meetingDecisionLedger.ts",
  meetingResearchQueue: "src/lib/meetings/meetingResearchQueue.ts",
  meetingPlaybook: "src/lib/meetings/meetingResearchPlaybook.ts",
  meetingTrackerIntake: "src/lib/meetings/meetingTrackerIntake.ts",
  portfolioReview: "src/lib/portfolio/portfolioReview.ts",
  portfolioTrackerIntake: "src/lib/portfolio/portfolioTrackerIntake.ts",
  reportConnectionPlan: "src/lib/reports/reportConnectionPlan.ts",
  connectionsPanel: "src/components/modules/ResearchConnectionsPanel.tsx",
  graphShell: "src/components/modules/ResearchGraphShell.tsx",
  schemaPanel: "src/components/modules/ResearchWorkflowSchemaPanel.tsx",
  companyShell: "src/components/modules/CompanyResearchShell.tsx",
  reportsShell: "src/components/modules/ReportsShell.tsx",
  meetingsShell: "src/components/modules/MeetingsShell.tsx",
  portfolioShell: "src/components/modules/PortfolioShell.tsx",
  registry: "src/lib/modules/registry.ts",
  moduleActions: "src/lib/modules/actions.ts",
  noteTemplates: "src/lib/templates/noteTemplates.ts",
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

const requiredMeetingDecisionSignals = [
  "decision-summary",
  "thesis-impact",
  "model-impact",
  "risk-watch",
  "catalyst-follow-up",
  "open-questions",
];

const requiredMeetingResearchQueueWorkstreams = [
  "transcript-review",
  "decision-capture",
  "model-update",
  "risk-catalyst",
  "open-question",
  "relation-linking",
  "tracker-intake",
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
  const companyDossier = readProjectFile(files.companyDossier);
  const companyPlaybook = readProjectFile(files.companyPlaybook);
  const companyTrackerIntake = readProjectFile(files.companyTrackerIntake);
  const meetingFollowUp = readProjectFile(files.meetingFollowUp);
  const meetingDecisionLedger = readProjectFile(files.meetingDecisionLedger);
  const meetingResearchQueue = readProjectFile(files.meetingResearchQueue);
  const meetingPlaybook = readProjectFile(files.meetingPlaybook);
  const meetingTrackerIntake = readProjectFile(files.meetingTrackerIntake);
  const portfolioReview = readProjectFile(files.portfolioReview);
  const portfolioTrackerIntake = readProjectFile(files.portfolioTrackerIntake);
  const reportConnectionPlan = readProjectFile(files.reportConnectionPlan);
  const connectionsPanel = readProjectFile(files.connectionsPanel);
  const graphShell = readProjectFile(files.graphShell);
  const schemaPanel = readProjectFile(files.schemaPanel);
  const companyShell = readProjectFile(files.companyShell);
  const reportsShell = readProjectFile(files.reportsShell);
  const meetingsShell = readProjectFile(files.meetingsShell);
  const portfolioShell = readProjectFile(files.portfolioShell);
  const registry = readProjectFile(files.registry);
  const moduleActions = readProjectFile(files.moduleActions);
  const noteTemplates = readProjectFile(files.noteTemplates);
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
    "buildResearchGraphHealthSummary",
    "Research graph must expose a reusable local health summary builder."
  );
  assertIncludes(
    files.graph,
    graph,
    "health_summary",
    "Research graph export must include per-module connection health."
  );
  assertIncludes(
    files.graph,
    graph,
    "priority_queue",
    "Research graph export must include prioritized relation repair work."
  );
  assertIncludes(
    files.graph,
    graph,
    "export { getResearchAssetKindLabel }",
    "Research graph must preserve the existing asset-label export for callers."
  );
  for (const snippet of [
    "needs-tracker",
    "needs-schema",
    "needs-links",
    "required_relation_kinds",
    "missing_relation_kinds",
    "priority_queue_items",
    "high_priority_unlinked_assets",
    "actionable_priority_items",
    "buildResearchGraphPriorityQueue",
    "ResearchGraphPriorityLevel",
    "writes_workspace_data",
  ]) {
    assertIncludes(
      files.graph,
      graph,
      snippet,
      "Research graph health summary must explain setup, schema, link, and write boundaries."
    );
  }
  for (const snippet of [
    "连接健康摘要",
    "断点优先队列",
    "PriorityQueuePanel",
    "PriorityPill",
    "高优先级",
    "可直接补关系",
    "getHealthStatusLabel",
    "本地 metadata only",
    "formatRelationLabels",
  ]) {
    assertIncludes(
      files.graphShell,
      graphShell,
      snippet,
      "Research graph shell must render the local connection health summary."
    );
  }
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
  assertIncludes(
    files.companyPlaybook,
    companyPlaybook,
    'format: "zhinote-company-research-playbook"',
    "Company research playbook must define a local export format."
  );
  assertIncludes(
    files.companyPlaybook,
    companyPlaybook,
    "buildCompanyResearchPlaybook",
    "Company research playbook must expose a reusable builder."
  );
  assertIncludes(
    files.companyDossier,
    companyDossier,
    'format: "zhinote-company-research-dossier-plan"',
    "Company research dossier must define a local export format."
  );
  assertIncludes(
    files.companyDossier,
    companyDossier,
    "buildCompanyResearchDossierPlan",
    "Company research dossier must expose a reusable builder."
  );
  for (const snippet of [
    "local_plan_only: true",
    "reads_company_coverage_report: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_database_row_values: false",
    "reads_file_bytes: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.companyDossier,
      companyDossier,
      snippet,
      "Company research dossier must preserve local-only privacy boundaries."
    );
  }
  for (const snippet of [
    "CompanyCoverageAreaId",
    "getCoverageAreaLabel",
    "missing_memos",
    "missing_earnings_reviews",
    "missing_related_reports",
    "missing_related_meetings",
    '"related-reports"',
    '"related-meetings"',
    '"tracker-database"',
    "review-company-dossiers",
  ]) {
    assertIncludes(
      files.companyDossier,
      companyDossier,
      snippet,
      "Company research dossier must preserve company-level dossier sections and relation gates."
    );
  }
  for (const snippet of [
    "buildCompanyResearchDossierPlan",
    "公司研究 Dossier",
    "handleExportDossier",
    "导出 Dossier",
    "CompanyDossierCard",
    "CompanyDossierActionCard",
    "CompanyDossierStatusPill",
  ]) {
    assertIncludes(
      files.companyShell,
      companyShell,
      snippet,
      "Company module must render and export the company research dossier plan."
    );
  }
  for (const snippet of [
    "local_playbook_only: true",
    "reads_company_coverage_report: true",
    "reads_research_workflow_schema: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_database_row_values: false",
    "includes_file_bytes: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.companyPlaybook,
      companyPlaybook,
      snippet,
      "Company research playbook must preserve local-only privacy boundaries."
    );
  }
  for (const actionId of [
    "create-company-home",
    "create-investment-memo",
    "create-earnings-review",
    "build-assumption-and-metrics",
    "link-research-context",
    "create-company-tracker",
    "review-company-candidates",
  ]) {
    assertIncludes(
      files.companyPlaybook,
      companyPlaybook,
      actionId,
      `Company research playbook must keep action ${actionId}.`
    );
  }
  assertIncludes(
    files.companyTrackerIntake,
    companyTrackerIntake,
    'format: "zhinote-company-tracker-intake-draft"',
    "Company tracker intake must define a local row draft format."
  );
  assertIncludes(
    files.companyTrackerIntake,
    companyTrackerIntake,
    "buildCompanyTrackerIntakeDraft",
    "Company tracker intake must expose a reusable draft builder."
  );
  assertIncludes(
    files.companyTrackerIntake,
    companyTrackerIntake,
    "findExistingCompanyTrackerRow",
    "Company tracker intake must avoid duplicate company-page rows."
  );
  assertIncludes(
    files.reportConnectionPlan,
    reportConnectionPlan,
    'format: "zhinote-report-connection-plan"',
    "Report connection plan must define a local export format."
  );
  assertIncludes(
    files.reportConnectionPlan,
    reportConnectionPlan,
    "buildReportConnectionPlan",
    "Report connection plan must expose a reusable builder."
  );
  for (const snippet of [
    "local_plan_only: true",
    "reads_report_intake_metadata: true",
    "reads_database_metadata: true",
    "reads_page_text: false",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.reportConnectionPlan,
      reportConnectionPlan,
      snippet,
      "Report connection plan must preserve local-only privacy boundaries."
    );
  }
  for (const snippet of [
    "report-to-company",
    "report-to-meeting",
    "report-to-memo",
    "missing_company_links",
    "missing_meeting_links",
    "missing_memo_links",
    "Report page",
    "Company page",
    "Related meetings",
    "Related reports",
    "Related memo",
    "manual-confirmation",
    "blocked",
  ]) {
    assertIncludes(
      files.reportConnectionPlan,
      reportConnectionPlan,
      snippet,
      "Report connection plan must preserve relation targets, fields, and manual gates."
    );
  }
  for (const snippet of [
    "buildReportConnectionPlan",
    "报告关联计划",
    "handleExportConnectionPlan",
    "导出关联计划",
    "ReportConnectionSuggestionCard",
    "ReportConnectionFieldSetRow",
    "ReportConnectionActionPill",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render and export the report connection plan."
    );
  }
  for (const snippet of [
    'title: "估值假设"',
    'title: "关键指标看板"',
    'title: "会议转录稿"',
    'title: "会议行动项"',
    'title: "持仓备忘录"',
    'title: "观察名单"',
    'title: "催化剂与风险复盘"',
    "Valuation Assumptions",
    "Key Metrics",
    "Meeting Transcript",
    "Meeting Action Items",
    "Position Memo",
    "Watchlist",
    "Catalyst Risk Review",
    "单位经济",
    "关联研究",
  ]) {
    assertIncludes(
      files.noteTemplates,
      noteTemplates,
      snippet,
      "Company research templates must include valuation and key-metric assets."
    );
  }
  for (const snippet of [
    "Transcript",
    "待复核片段",
    "开放问题",
    "后续跟踪",
  ]) {
    assertIncludes(
      files.noteTemplates,
      noteTemplates,
      snippet,
      "Meeting templates must include transcript and action-item structure."
    );
  }
  for (const snippet of [
    "仓位纪律",
    "目标权重",
    "当前权重",
    "确信度",
    "降权或退出条件",
    "进入正式研究的触发条件",
  ]) {
    assertIncludes(
      files.noteTemplates,
      noteTemplates,
      snippet,
      "Portfolio templates must include position discipline, watchlist, catalyst, and risk structure."
    );
  }
  for (const snippet of [
    "local_row_draft_only: true",
    "reads_company_coverage_candidate: true",
    "reads_database_fields: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_database_row_values: false",
    "includes_file_bytes: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.companyTrackerIntake,
      companyTrackerIntake,
      snippet,
      "Company tracker intake draft must preserve local-only privacy boundaries."
    );
  }
  for (const fieldName of [
    "Company page",
    "Ticker",
    "Status",
    "Thesis",
    "Valuation assumptions",
    "Key metrics",
  ]) {
    assertIncludes(
      files.companyTrackerIntake,
      companyTrackerIntake,
      fieldName,
      `Company tracker intake must map ${fieldName}.`
    );
  }
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
    files.meetingDecisionLedger,
    meetingDecisionLedger,
    'format: "zhinote-meeting-decision-ledger"',
    "Meeting decision ledger must define a local export format."
  );
  assertIncludes(
    files.meetingDecisionLedger,
    meetingDecisionLedger,
    "buildMeetingDecisionLedgerReport",
    "Meeting decision ledger must expose a reusable builder."
  );
  for (const snippet of [
    "local_report_only: true",
    "reads_local_page_html: true",
    "reads_database_metadata: true",
    "includes_page_text: false",
    "includes_transcript_text: false",
    "includes_recording_bytes: false",
    "includes_participant_details: false",
    "includes_meeting_passcodes: false",
    "includes_database_row_values: false",
    "includes_holdings_or_trading_plans: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.meetingDecisionLedger,
      meetingDecisionLedger,
      snippet,
      "Meeting decision ledger must preserve local-only privacy boundaries."
    );
  }
  for (const signal of requiredMeetingDecisionSignals) {
    assertIncludes(
      files.meetingDecisionLedger,
      meetingDecisionLedger,
      `"${signal}"`,
      `Meeting decision ledger must keep signal ${signal}.`
    );
  }
  assertIncludes(
    files.meetingResearchQueue,
    meetingResearchQueue,
    'format: "zhinote-meeting-research-queue"',
    "Meeting research queue must define a local export format."
  );
  assertIncludes(
    files.meetingResearchQueue,
    meetingResearchQueue,
    "buildMeetingResearchQueue",
    "Meeting research queue must expose a reusable builder."
  );
  for (const snippet of [
    "local_queue_only: true",
    "reads_meeting_follow_up_report: true",
    "reads_meeting_decision_ledger: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_transcript_text: false",
    "includes_recording_bytes: false",
    "includes_participant_details: false",
    "includes_meeting_passcodes: false",
    "includes_database_row_values: false",
    "includes_holdings_or_trading_plans: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.meetingResearchQueue,
      meetingResearchQueue,
      snippet,
      "Meeting research queue must preserve local-only privacy boundaries."
    );
  }
  for (const workstream of requiredMeetingResearchQueueWorkstreams) {
    assertIncludes(
      files.meetingResearchQueue,
      meetingResearchQueue,
      `"${workstream}"`,
      `Meeting research queue must keep workstream ${workstream}.`
    );
  }
  for (const gate of [
    "queue-built-from-local-reports",
    "transcript-review-gate",
    "decision-capture-gate",
    "model-update-gate",
    "risk-catalyst-gate",
    "relation-linking-gate",
  ]) {
    assertIncludes(
      files.meetingResearchQueue,
      meetingResearchQueue,
      `"${gate}"`,
      `Meeting research queue must keep gate ${gate}.`
    );
  }
  assertIncludes(
    files.meetingPlaybook,
    meetingPlaybook,
    'format: "zhinote-meeting-research-playbook"',
    "Meeting research playbook must define a local export format."
  );
  assertIncludes(
    files.meetingPlaybook,
    meetingPlaybook,
    "buildMeetingResearchPlaybook",
    "Meeting research playbook must expose a reusable builder."
  );
  for (const snippet of [
    "local_playbook_only: true",
    "reads_meeting_follow_up_report: true",
    "reads_research_workflow_schema: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_transcript_text: false",
    "includes_recording_bytes: false",
    "includes_participant_details: false",
    "includes_meeting_passcodes: false",
    "includes_database_row_values: false",
    "joins_calls: false",
    "records_audio: false",
    "publishes_notes: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.meetingPlaybook,
      meetingPlaybook,
      snippet,
      "Meeting research playbook must preserve local-only privacy boundaries."
    );
  }
  for (const actionId of [
    "add-meeting-context",
    "attach-transcript-page",
    "extract-action-items",
    "link-company-page",
    "link-related-report",
    "create-meeting-tracker",
    "review-follow-up-candidates",
  ]) {
    assertIncludes(
      files.meetingPlaybook,
      meetingPlaybook,
      actionId,
      `Meeting research playbook must keep action ${actionId}.`
    );
  }
  assertIncludes(
    files.meetingTrackerIntake,
    meetingTrackerIntake,
    'format: "zhinote-meeting-tracker-intake-draft"',
    "Meeting tracker intake must define a local row draft format."
  );
  assertIncludes(
    files.meetingTrackerIntake,
    meetingTrackerIntake,
    "buildMeetingTrackerIntakeDraft",
    "Meeting tracker intake must expose a reusable draft builder."
  );
  assertIncludes(
    files.meetingTrackerIntake,
    meetingTrackerIntake,
    "findExistingMeetingTrackerRow",
    "Meeting tracker intake must avoid duplicate meeting-note rows."
  );
  for (const snippet of [
    "local_row_draft_only: true",
    "reads_meeting_follow_up_item: true",
    "reads_database_fields: true",
    "reads_page_text: false",
    "reads_transcript_text: false",
    "reads_recording_bytes: false",
    "includes_participant_details: false",
    "includes_meeting_passcodes: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.meetingTrackerIntake,
      meetingTrackerIntake,
      snippet,
      "Meeting tracker intake draft must preserve local-only privacy boundaries."
    );
  }
  for (const fieldName of [
    "Meeting note",
    "Status",
    "Follow-up needed",
    "Action items",
  ]) {
    assertIncludes(
      files.meetingTrackerIntake,
      meetingTrackerIntake,
      fieldName,
      `Meeting tracker intake must map ${fieldName}.`
    );
  }
  for (const snippet of [
    "新建转录稿",
    "新建行动项",
    "templateTitle: \"会议转录稿\"",
    "templateTitle: \"会议行动项\"",
  ]) {
    assertIncludes(
      files.meetingsShell,
      meetingsShell,
      snippet,
      "Meetings module must expose transcript and action-item page starters."
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
    files.portfolioTrackerIntake,
    portfolioTrackerIntake,
    'format: "zhinote-portfolio-tracker-intake-draft"',
    "Portfolio tracker intake must define a local row draft format."
  );
  assertIncludes(
    files.portfolioTrackerIntake,
    portfolioTrackerIntake,
    "buildPortfolioTrackerIntakeDraft",
    "Portfolio tracker intake must expose a reusable draft builder."
  );
  assertIncludes(
    files.portfolioTrackerIntake,
    portfolioTrackerIntake,
    "findExistingPortfolioTrackerRow",
    "Portfolio tracker intake must avoid duplicate related-memo rows."
  );
  for (const snippet of [
    "local_row_draft_only: true",
    "reads_portfolio_review_item: true",
    "reads_database_fields: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_page_titles: false",
    "includes_database_row_values: false",
    "includes_position_names: false",
    "includes_tickers: false",
    "includes_weights: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "includes_transactions: false",
    "connects_brokerage_accounts: false",
    "fetches_prices: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.portfolioTrackerIntake,
      portfolioTrackerIntake,
      snippet,
      "Portfolio tracker intake draft must preserve local-only privacy boundaries."
    );
  }
  for (const fieldName of [
    "Related memo",
    "Status",
    "Conviction",
    "Thesis",
    "Risk notes",
  ]) {
    assertIncludes(
      files.portfolioTrackerIntake,
      portfolioTrackerIntake,
      fieldName,
      `Portfolio tracker intake must map ${fieldName}.`
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
    "buildCompanyResearchPlaybook",
    "Company module must build the company research playbook."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "buildCompanyTrackerIntakeDraft",
    "Company module must build local tracker intake drafts."
  );
  for (const snippet of [
    "新建估值假设",
    "新建关键指标",
    'templateTitle: "估值假设"',
    'templateTitle: "关键指标看板"',
    'Metric label="估值假设"',
    'Metric label="关键指标"',
  ]) {
    assertIncludes(
      files.companyShell,
      companyShell,
      snippet,
      "Company module must expose valuation and key-metric starter assets."
    );
  }
  assertIncludes(
    files.companyShell,
    companyShell,
    "findExistingCompanyTrackerRow",
    "Company module must check existing tracker rows before writing."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "公司入库台",
    "Company module must render the tracker intake desk."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "创建 tracker row",
    "Company module must expose a tracker-row creation action."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "本地单条写入",
    "Company module must label tracker intake as a single local write."
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
    "公司研究 Playbook",
    "Company module must render the research playbook panel."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "Export coverage",
    "Company module must export the coverage report."
  );
  assertIncludes(
    files.companyShell,
    companyShell,
    "导出 Playbook",
    "Company module must export the research playbook."
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
    "buildMeetingDecisionLedgerReport",
    "Meetings module must build the decision ledger report."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "buildMeetingResearchQueue",
    "Meetings module must build the meeting research queue."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "buildMeetingResearchPlaybook",
    "Meetings module must build the research playbook."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "buildMeetingTrackerIntakeDraft",
    "Meetings module must build local tracker intake drafts."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "findExistingMeetingTrackerRow",
    "Meetings module must check existing tracker rows before writing."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "会议入库台",
    "Meetings module must render the tracker intake desk."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "创建 tracker row",
    "Meetings module must expose a tracker-row creation action."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "本地单条写入",
    "Meetings module must label tracker intake as a single local write."
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
    "会议投研闭环",
    "Meetings module must render the decision ledger panel."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "导出闭环",
    "Meetings module must export the decision ledger report."
  );
  for (const snippet of [
    "会议研究任务队列",
    "导出任务队列",
    "meetingResearchQueue",
    "handleExportResearchQueue",
    "MeetingResearchQueueGateRow",
    "MeetingResearchQueueItemCard",
    "MeetingResearchQueueStatusPill",
    "MeetingResearchQueueRiskPill",
    "MeetingResearchQueueWorkstreamPill",
    "Research queue gates",
    "Top research tasks",
    "不包含会议正文",
  ]) {
    assertIncludes(
      files.meetingsShell,
      meetingsShell,
      snippet,
      "Meetings module must render and export the local meeting research queue."
    );
  }
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "会议研究 Playbook",
    "Meetings module must render the research playbook panel."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "Export follow-up",
    "Meetings module must export the follow-up report."
  );
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "导出 Playbook",
    "Meetings module must export the research playbook."
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
    "buildPortfolioTrackerIntakeDraft",
    "Portfolio module must build local tracker intake drafts."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "findExistingPortfolioTrackerRow",
    "Portfolio module must check existing tracker rows before writing."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "组合入库台",
    "Portfolio module must render the tracker intake desk."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "脱敏标签",
    "Portfolio module must show redacted tracker intake labels."
  );
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "本地单条写入",
    "Portfolio module must label tracker intake as a single local write."
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
  for (const snippet of [
    "新建观察名单",
    "新建催化剂复盘",
    "templateTitle: \"持仓备忘录\"",
    "templateTitle: \"观察名单\"",
    "templateTitle: \"催化剂与风险复盘\"",
  ]) {
    assertIncludes(
      files.portfolioShell,
      portfolioShell,
      snippet,
      "Portfolio module must expose position, watchlist, catalyst, and risk page starters."
    );
  }

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
    "company intake desk",
    "README must document company tracker intake."
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
    "meeting research playbook",
    "README must document meeting research playbook exports."
  );
  assertIncludes(
    files.readme,
    readme,
    "meeting decision ledger",
    "README must document meeting decision ledger exports."
  );
  assertIncludes(
    files.readme,
    readme,
    "meeting research task queue",
    "README must document meeting research task queue exports."
  );
  assertIncludes(
    files.readme,
    readme,
    "meeting intake desk",
    "README must document meeting tracker intake."
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
    "portfolio intake desk",
    "README must document portfolio tracker intake."
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
        company_tracker_intake_fields: 6,
        meeting_follow_up_stages: requiredMeetingFollowUpStages.length,
        meeting_decision_signals: requiredMeetingDecisionSignals.length,
        meeting_research_queue_workstreams:
          requiredMeetingResearchQueueWorkstreams.length,
        meeting_research_queue: true,
        meeting_playbook_actions: 7,
        meeting_tracker_intake_fields: 4,
        portfolio_review_areas: requiredPortfolioReviewAreas.length,
        portfolio_tracker_intake_fields: 5,
        shared_routes: true,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
