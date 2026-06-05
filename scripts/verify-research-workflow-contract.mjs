#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  workflow: "src/lib/modules/researchWorkflow.ts",
  graph: "src/lib/modules/researchGraph.ts",
  workbench: "src/lib/modules/researchWorkbench.ts",
  projectBrief: "src/lib/modules/researchProjectBrief.ts",
  projectFields: "src/lib/modules/researchProjectFields.ts",
  projectTrackerIntake: "src/lib/modules/researchProjectTrackerIntake.ts",
  companyCoverage: "src/lib/company/companyCoverage.ts",
  companyDossier: "src/lib/company/companyResearchDossier.ts",
  companyPlaybook: "src/lib/company/companyResearchPlaybook.ts",
  companyWorkbench: "src/lib/company/companyResearchWorkbench.ts",
  companyTrackerIntake: "src/lib/company/companyTrackerIntake.ts",
  meetingFollowUp: "src/lib/meetings/meetingFollowUp.ts",
  meetingDecisionLedger: "src/lib/meetings/meetingDecisionLedger.ts",
  meetingResearchQueue: "src/lib/meetings/meetingResearchQueue.ts",
  meetingPlaybook: "src/lib/meetings/meetingResearchPlaybook.ts",
  meetingWorkbench: "src/lib/meetings/meetingWorkbench.ts",
  meetingTrackerIntake: "src/lib/meetings/meetingTrackerIntake.ts",
  portfolioReview: "src/lib/portfolio/portfolioReview.ts",
  portfolioWorkbench: "src/lib/portfolio/portfolioWorkbench.ts",
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
	    keyFields: ["会议页", "转录稿页面", "行动项"],
	  },
  {
    kind: "portfolio",
    route: "/modules/portfolio",
    preset: "portfolio-tracker",
    relationKinds: ["company", "report", "meeting"],
    keyFields: ["目标权重", "确信度", "风险笔记"],
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
  const workbench = readProjectFile(files.workbench);
  const projectBrief = readProjectFile(files.projectBrief);
  const projectFields = readProjectFile(files.projectFields);
  const projectTrackerIntake = readProjectFile(files.projectTrackerIntake);
  const companyCoverage = readProjectFile(files.companyCoverage);
  const companyDossier = readProjectFile(files.companyDossier);
  const companyPlaybook = readProjectFile(files.companyPlaybook);
  const companyWorkbench = readProjectFile(files.companyWorkbench);
  const companyTrackerIntake = readProjectFile(files.companyTrackerIntake);
  const meetingFollowUp = readProjectFile(files.meetingFollowUp);
  const meetingDecisionLedger = readProjectFile(files.meetingDecisionLedger);
  const meetingResearchQueue = readProjectFile(files.meetingResearchQueue);
  const meetingPlaybook = readProjectFile(files.meetingPlaybook);
  const meetingWorkbench = readProjectFile(files.meetingWorkbench);
  const meetingTrackerIntake = readProjectFile(files.meetingTrackerIntake);
  const portfolioReview = readProjectFile(files.portfolioReview);
  const portfolioWorkbench = readProjectFile(files.portfolioWorkbench);
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
    "relation_handoff_packets",
    "Research graph export must include manual relation handoff packets."
  );
  assertIncludes(
    files.graph,
    graph,
    "buildResearchGraphRelationHandoffPackets",
    "Research graph must expose reusable relation handoff packet builder."
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
    "relation_handoff_packets",
    "ResearchGraphRelationHandoffPacket",
    "source_page_route",
    "target_database_title",
    "manual_relation_completion",
    "handoff: \"research-graph\"",
    "auto_writes_relation_values: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
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
    "投研工作台行动包",
    "导出工作台行动包",
    "ResearchWorkbenchPanel",
    "WorkbenchActionRow",
    "WorkbenchStatusPill",
    "PriorityQueuePanel",
    "PriorityPill",
    "Relation 补全手册",
    "RelationHandoffPanel",
    "HandoffStepList",
    "手动补 relation",
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
  for (const snippet of [
    "ModuleRelationHandoffPanel",
    "Relation 补全手册",
    "不自动写 relation",
    "打开目标库",
    "handoff: \"module-connections\"",
  ]) {
    assertIncludes(
      files.connectionsPanel,
      connectionsPanel,
      snippet,
      "Research connections panel must render per-module relation handoff cards."
    );
  }
  assertIncludes(
    files.workbench,
    workbench,
    'format: "zhinote-research-workbench-packet"',
    "Research workbench must define a stable local packet format."
  );
  assertIncludes(
    files.workbench,
    workbench,
    "buildResearchWorkbenchPacket",
    "Research workbench must expose a reusable builder."
  );
  for (const snippet of [
    'packet_status: "local-research-workbench-only"',
    "local_packet_only: true",
    "reads_research_graph_report: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "reads_database_rows: false",
    "includes_database_row_values: false",
    "reads_file_names: false",
    "reads_file_bytes: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "writes_workspace_data: false",
    "creates_relation_values: false",
    "creates_schema_fields: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "ResearchWorkbenchDecisionSummary",
    "decision_summary: buildDecisionSummary",
    'current_state: "local-research-graph-owner-review"',
    "can_review_graph_coverage_now: true",
    "can_open_relation_handoffs_now: true",
    "can_create_schema_fields_without_confirmation_now: false",
    "can_auto_write_relation_values_now: false",
    "can_bulk_update_database_rows_now: false",
    "can_send_graph_context_to_ai_now: false",
    "can_sync_graph_data_now: false",
    '"graph-coverage-review"',
    '"manual-relation-handoff"',
    '"schema-field-setup"',
    '"module-follow-up-queue"',
    '"cloud-ai-bulk-boundary"',
  ]) {
    assertIncludes(
      files.workbench,
      workbench,
      snippet,
      "Research workbench must preserve local-only privacy and write boundaries."
    );
  }
  for (const snippet of [
    '"company-context"',
    '"report-linking"',
    '"meeting-follow-up"',
    '"portfolio-review"',
    '"schema-setup"',
	    "module_rollups",
	    "review_sequence",
	    "公司资产已经具备报告和会议 relation 路径",
	    "高优先级未连接资产已经完成复核或路由",
	    "缺失 relation 字段会阻塞报告到公司",
	    "forbidden_actions",
    "required_verification_commands",
    "auto_write_relation_values",
    "bulk_update_database_rows",
    "send_page_text_to_ai",
    "read_file_bytes_for_linking",
    "npm run verify:research-workflow",
    "npm run verify:modules",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.workbench,
      workbench,
      snippet,
      "Research workbench must keep cross-module lanes, forbidden actions, and verification commands."
    );
  }
  assertIncludes(
    files.projectBrief,
    projectBrief,
    'format: "zhinote-research-project-brief"',
    "Research project brief must define a stable local export format."
  );
  assertIncludes(
    files.projectBrief,
    projectBrief,
    "buildResearchProjectBrief",
    "Research project brief must expose a reusable builder."
  );
  assertIncludes(
    files.projectBrief,
    projectBrief,
    "buildResearchProjectBriefPageHtml",
    "Research project brief must expose a reusable local page renderer."
  );
  assertIncludes(
    files.projectBrief,
    projectBrief,
    "buildResearchProjectPageTitle",
    "Research project brief must expose a reusable local page title builder."
  );
  for (const snippet of [
    'brief_status: "local-project-brief-only"',
    "RESEARCH_PROJECT_MODE_OPTIONS",
    '"initiation"',
    '"earnings-review"',
    '"variant-view"',
    '"meeting-follow-up"',
    '"portfolio-review"',
    "local_brief_only: true",
    "reads_research_graph_report: true",
    "reads_research_workbench_packet: true",
    "includes_owner_entered_topic",
    "reads_page_text: false",
    "includes_page_text: false",
    "reads_database_rows: false",
    "includes_database_row_values: false",
    "reads_file_names: false",
    "reads_file_bytes: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "writes_workspace_data: false",
    "creates_pages: false",
    "creates_database_rows: false",
    "creates_relation_values: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "module_plans",
    "checklist",
    "review_sequence",
    "blocked_actions",
    "required_owner_decisions",
    "项目设置",
    "核心仪表盘",
    "模块准备度",
    "项目 Checklist",
    "Owner 待确认",
    "隐私边界",
    "auto_create_research_project_pages",
    "send_project_context_to_ai",
    "sync_project_assets_to_cloud",
    "npm run verify:research-workflow",
    "npm run verify:modules",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.projectBrief,
      projectBrief,
      snippet,
      "Research project brief must keep local-only project planning boundaries."
    );
  }
  assertIncludes(
    files.projectTrackerIntake,
    projectTrackerIntake,
    'format: "zhinote-research-project-tracker-intake-draft"',
    "Research project tracker intake must define a stable local draft format."
  );
  assertIncludes(
    files.projectTrackerIntake,
    projectTrackerIntake,
    "buildResearchProjectTrackerIntakeDraft",
    "Research project tracker intake must expose a reusable draft builder."
  );
  assertIncludes(
    files.projectTrackerIntake,
    projectTrackerIntake,
    "findExistingResearchProjectTrackerRow",
    "Research project tracker intake must expose existing-row detection."
  );
  for (const snippet of [
    "RESEARCH_PROJECT_PAGE_FIELD_ALIASES",
    "Project page",
    "项目页",
    "项目页面",
    "投研项目页",
    "isResearchProjectPageRelationField",
    "matchesResearchProjectFieldAlias",
  ]) {
    assertIncludes(
      files.projectFields,
      projectFields,
      snippet,
      "Research project field aliases must preserve shared Project page matching."
    );
  }
  for (const snippet of [
    'draft_status: "local-project-tracker-row-draft"',
    "local_row_draft_only: true",
    "reads_project_brief_metadata: true",
    "reads_database_fields: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_database_row_values: false",
    "includes_file_names: false",
    "includes_file_bytes: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "writes_workspace_data: false",
    "creates_database_rows: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "Project page",
    "RESEARCH_PROJECT_PAGE_FIELD_ALIASES",
    "Status",
    "Project mode",
    "Priority",
    "Horizon",
    "Research question",
    "Owner confirmation",
    "Next action",
    "project-page-relation",
    "mapped_fields",
    "missing_fields",
  ]) {
    assertIncludes(
      files.projectTrackerIntake,
      projectTrackerIntake,
      snippet,
      "Research project tracker intake must preserve local-only row draft fields and privacy boundaries."
    );
  }
  for (const snippet of [
    "buildResearchWorkbenchPacket",
    "workbenchPacket",
    "buildResearchProjectBrief",
    "projectBrief",
    "handleExportProjectBrief",
    "handleCreateProjectPage",
    "creatingProjectPage",
    "ResearchProjectBriefPanel",
    "ResearchProjectModuleCard",
    "ResearchProjectChecklistRow",
    "ResearchProjectStatusPill",
    "投研项目启动器",
    "创建项目页",
    "导出 Brief",
    "research-project-brief",
    "buildResearchProjectBriefPageHtml",
    "buildResearchProjectPageTitle",
    "handleExportWorkbenchPacket",
    "handleDecisionOpen",
    "研究图谱决策摘要",
    "ResearchGraphDecisionSummaryPanel",
    "ResearchGraphDecisionCard",
    "ResearchGraphDecisionStatusPill",
    "research-graph-decision-summary",
    "research-graph-health-summary",
    "research-graph-relation-handoff",
    "research-graph-schema-gaps",
    "research-graph-workbench",
    "当前可做",
    "保持关闭",
    "Owner 待确认",
    "研究图谱决策摘要只读取本地 summary metadata",
	    "导出工作台行动包",
	    "ResearchWorkbenchPanel",
	    "投研工作台行动包",
	    "复核顺序",
	    "就绪",
	    "需复核",
	    "缺失",
	    "阻塞",
	    "关系",
	    "结构",
	    "跟踪表",
	    "复核",
	    "不自动写 relation",
	  ]) {
    assertIncludes(
      files.graphShell,
      graphShell,
      snippet,
      "Research graph shell must build, render, and export the research workbench packet."
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
    files.companyWorkbench,
    companyWorkbench,
    'format: "zhinote-company-research-workbench-packet"',
    "Company research workbench must define a local packet format."
  );
  assertIncludes(
    files.companyWorkbench,
    companyWorkbench,
    "buildCompanyResearchWorkbenchPacket",
    "Company research workbench must expose a reusable builder."
  );
  for (const snippet of [
    'packet_status: "local-company-workbench-only"',
    "local_packet_only: true",
    "reads_company_coverage_report: true",
    "reads_company_playbook: true",
    "reads_company_dossier_plan: true",
    "reads_tracker_intake_metadata: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_page_titles: false",
    "reads_database_rows: false",
    "includes_database_row_values: false",
    "reads_file_names: false",
    "reads_file_bytes: false",
    "includes_file_bytes: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "writes_workspace_data: false",
    "creates_pages: false",
    "creates_database_rows: false",
    "updates_relation_values: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "CompanyResearchDecisionSummary",
    "decision_summary: buildDecisionSummary",
    'current_state: "local-company-owner-review"',
    "can_create_local_research_assets_now: true",
    "can_review_coverage_now: true",
    "can_review_dossier_now: true",
    "can_write_tracker_rows_without_manual_click_now: false",
    "can_auto_link_reports_meetings_now: false",
    "can_send_company_research_to_ai_now: false",
    "can_sync_company_research_now: false",
    '"company-foundation"',
    '"thesis-dossier"',
    '"earnings-valuation"',
    '"links-tracker-intake"',
    '"cloud-ai-sync-boundary"',
  ]) {
    assertIncludes(
      files.companyWorkbench,
      companyWorkbench,
      snippet,
      "Company research workbench must preserve local-only privacy and write boundaries."
    );
  }
  for (const snippet of [
    '"company-foundation"',
    '"thesis-workflow"',
    '"earnings-valuation"',
    '"research-links"',
    '"tracker-intake"',
    '"review-cadence"',
    '"privacy-boundary"',
    "target_section_id",
    "company-create-assets",
    "company-coverage-radar",
    "company-playbook",
    "company-tracker-intake",
    "forbidden_actions",
    "required_verification_commands",
    "export_company_names_from_workbench",
    "export_page_titles_from_workbench",
    "auto_create_tracker_rows",
    "auto_write_relation_values",
    "send_company_research_to_ai",
    "sync_company_research_to_cloud",
    "npm run verify:research-workflow",
    "npm run verify:modules",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.companyWorkbench,
      companyWorkbench,
      snippet,
      "Company research workbench must keep lanes, forbidden actions, and verification commands."
    );
  }
  for (const snippet of [
    "buildCompanyResearchWorkbenchPacket",
    "companyWorkbench",
    "handleExportWorkbench",
    "公司研究决策摘要",
    "CompanyDecisionSummaryPanel",
    "CompanyDecisionCard",
    "CompanyDecisionStatusPill",
    "handleDecisionOpen",
    "company-decision-summary",
    "当前可做",
    "保持关闭",
    "Owner 待确认",
    "公司研究决策摘要只读取本地 summary metadata",
    "公司研究工作台",
    "导出公司工作台",
    "CompanyWorkbenchLaneCard",
    "CompanyWorkbenchActionCard",
    "CompanyWorkbenchReviewStepCard",
    "handleReviewStepNavigate",
    "scrollIntoView",
    "打开步骤",
    "company-create-assets",
    "company-coverage-radar",
    "company-playbook",
    "company-tracker-intake",
    "company-research-connections",
    "导出不包含公司名称、页面标题",
  ]) {
    assertIncludes(
      files.companyShell,
      companyShell,
      snippet,
      "Company module must render and export the company research workbench packet."
    );
  }
  assertIncludes(
    files.companyShell,
    companyShell,
    "handoff=company-workbench",
    "Company module tracker handoff must tell the database page its source."
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
    files.meetingWorkbench,
    meetingWorkbench,
    'format: "zhinote-meeting-workbench-packet"',
    "Meeting workbench must define a local packet format."
  );
  assertIncludes(
    files.meetingWorkbench,
    meetingWorkbench,
    "buildMeetingWorkbenchPacket",
    "Meeting workbench must expose a reusable builder."
  );
  for (const snippet of [
    'packet_status: "local-meeting-workbench-only"',
    "local_packet_only: true",
    "reads_meeting_follow_up_report: true",
    "reads_meeting_decision_ledger: true",
    "reads_meeting_research_queue: true",
    "reads_meeting_playbook: true",
    "reads_tracker_intake_metadata: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_page_titles: false",
    "reads_transcript_text: false",
    "includes_transcript_text: false",
    "reads_recording_bytes: false",
    "includes_recording_bytes: false",
    "includes_participant_details: false",
    "includes_meeting_passcodes: false",
    "reads_database_rows: false",
    "includes_database_row_values: false",
    "includes_holdings_or_trading_plans: false",
    "writes_workspace_data: false",
    "creates_pages: false",
    "creates_database_rows: false",
    "updates_relation_values: false",
    "joins_calls: false",
    "records_audio: false",
    "publishes_notes: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "MeetingDecisionSummary",
    "decision_summary: buildDecisionSummary",
    'current_state: "local-meeting-owner-review"',
    "can_create_local_meeting_assets_now: true",
    "can_review_transcript_structure_now: true",
    "can_review_decision_ledger_now: true",
    "can_write_tracker_rows_without_manual_click_now: false",
    "can_join_calls_now: false",
    "can_record_audio_now: false",
    "can_publish_notes_now: false",
    "can_send_meeting_context_to_ai_now: false",
    "can_sync_meeting_data_now: false",
    '"meeting-capture"',
    '"transcript-review"',
    '"decision-ledger"',
    '"links-tracker-intake"',
    '"automation-cloud-ai-boundary"',
  ]) {
    assertIncludes(
      files.meetingWorkbench,
      meetingWorkbench,
      snippet,
      "Meeting workbench must preserve local-only privacy, meeting, and write boundaries."
    );
  }
  for (const snippet of [
    '"meeting-capture"',
    '"transcript-review"',
    '"decision-ledger"',
    '"research-queue"',
    '"tracker-intake"',
    '"relation-linking"',
    '"privacy-boundary"',
    "target_section_id",
    "meeting-create-assets",
	    "meeting-research-queue",
	    "meeting-tracker-intake",
	    "tracker 行",
	    "forbidden_actions",
    "required_verification_commands",
    "join_calls_from_meeting_workbench",
    "record_audio_from_meeting_workbench",
    "publish_notes_from_meeting_workbench",
    "export_meeting_titles_from_workbench",
    "export_transcript_text_from_meeting_workbench",
    "export_meeting_passcodes_from_workbench",
    "auto_create_tracker_rows",
    "auto_write_relation_values",
    "send_meeting_context_to_ai",
    "sync_meeting_data_to_cloud",
    "npm run verify:research-workflow",
    "npm run verify:modules",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.meetingWorkbench,
      meetingWorkbench,
      snippet,
      "Meeting workbench must keep lanes, forbidden actions, and verification commands."
    );
  }
  for (const snippet of [
    "buildMeetingWorkbenchPacket",
    "meetingWorkbench",
    "handleExportWorkbench",
    "会议决策摘要",
    "MeetingDecisionSummaryPanel",
    "MeetingDecisionCard",
    "MeetingSummaryStatusPill",
    "handleDecisionOpen",
    "meeting-decision-summary",
    "当前可做",
    "保持关闭",
    "Owner 待确认",
    "会议决策摘要只读取本地 summary metadata",
    "会议工作台",
    "导出会议工作台",
    "MeetingWorkbenchLaneCard",
    "MeetingWorkbenchActionCard",
    "MeetingWorkbenchReviewStepCard",
    "handleReviewStepNavigate",
    "scrollIntoView",
    "打开步骤",
    "meeting-create-assets",
    "meeting-research-queue",
    "meeting-tracker-intake",
    "meeting-follow-up",
    "meeting-decision-ledger",
    "meeting-research-connections",
    "导出不包含会议标题",
  ]) {
    assertIncludes(
      files.meetingsShell,
      meetingsShell,
      snippet,
      "Meetings module must render and export the meeting workbench packet."
    );
  }
  assertIncludes(
    files.meetingsShell,
    meetingsShell,
    "handoff=meeting-workbench",
    "Meeting module tracker handoff must tell the database page its source."
  );
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
    files.portfolioWorkbench,
    portfolioWorkbench,
    'format: "zhinote-portfolio-workbench-packet"',
    "Portfolio workbench must define a local packet format."
  );
  assertIncludes(
    files.portfolioWorkbench,
    portfolioWorkbench,
    "buildPortfolioWorkbenchPacket",
    "Portfolio workbench must expose a reusable builder."
  );
  for (const snippet of [
    'packet_status: "local-portfolio-workbench-only"',
    "local_packet_only: true",
    "reads_portfolio_review_report: true",
    "reads_tracker_intake_metadata: true",
    "reads_page_text: false",
    "includes_page_text: false",
    "includes_page_titles: false",
    "reads_database_rows: false",
    "includes_database_row_values: false",
    "includes_position_names: false",
    "includes_tickers: false",
    "includes_weights: false",
    "includes_holdings: false",
    "includes_trading_plans: false",
    "includes_transactions: false",
    "reads_file_bytes: false",
    "connects_brokerage_accounts: false",
    "fetches_prices: false",
    "writes_workspace_data: false",
    "creates_pages: false",
    "creates_database_rows: false",
    "updates_relation_values: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "PortfolioWorkbenchDecisionSummary",
    "decision_summary: buildDecisionSummary",
    'current_state: "local-portfolio-owner-review"',
    "can_create_local_portfolio_assets_now: true",
    "can_review_position_discipline_now: true",
    "can_review_research_links_now: true",
    "can_write_tracker_rows_without_manual_click_now: false",
    "can_connect_brokerage_accounts_now: false",
    "can_fetch_live_prices_now: false",
    "can_send_portfolio_context_to_ai_now: false",
    "can_sync_portfolio_data_now: false",
    "can_bulk_update_database_rows_now: false",
    '"local-portfolio-asset-intake"',
    '"position-discipline-thesis-risk"',
    '"catalyst-research-link-review"',
    '"tracker-row-intake"',
    '"brokerage-price-ai-cloud-boundary"',
  ]) {
    assertIncludes(
      files.portfolioWorkbench,
      portfolioWorkbench,
      snippet,
      "Portfolio workbench must preserve local-only privacy, broker, price, and write boundaries."
    );
  }
  for (const snippet of [
    '"idea-intake"',
    '"position-discipline"',
    '"thesis-risk"',
    '"catalyst-review"',
    '"research-links"',
    '"tracker-intake"',
    '"privacy-boundary"',
    "target_section_id",
    "portfolio-create-assets",
    "portfolio-review-radar",
    "portfolio-tracker-intake",
    "portfolio-privacy-boundary",
    "forbidden_actions",
    "required_verification_commands",
    "export_portfolio_page_titles_from_workbench",
    "export_position_names_from_workbench",
    "export_tickers_from_workbench",
    "export_weights_from_workbench",
    "export_holdings_from_workbench",
    "connect_brokerage_accounts",
    "fetch_live_prices",
    "auto_create_tracker_rows",
    "auto_write_relation_values",
    "send_portfolio_context_to_ai",
    "sync_portfolio_data_to_cloud",
    "npm run verify:research-workflow",
    "npm run verify:modules",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.portfolioWorkbench,
      portfolioWorkbench,
      snippet,
      "Portfolio workbench must keep lanes, forbidden actions, and verification commands."
    );
  }
  for (const snippet of [
    "buildPortfolioWorkbenchPacket",
    "portfolioWorkbench",
    "portfolioWorkbench.decision_summary",
    "handleExportWorkbench",
    "handleDecisionOpen",
    "组合决策摘要",
    "PortfolioDecisionSummaryPanel",
    "PortfolioDecisionCard",
    "PortfolioDecisionStatusPill",
    "portfolio-decision-summary",
    "当前可做",
    "保持关闭",
    "Owner 待确认",
    "组合决策摘要只读取本地 summary metadata",
    "组合工作台",
    "导出组合工作台",
    "PortfolioWorkbenchLaneCard",
    "PortfolioWorkbenchActionCard",
    "PortfolioWorkbenchReviewStepCard",
    "handleReviewStepNavigate",
    "scrollIntoView",
    "打开步骤",
    "portfolio-create-assets",
    "portfolio-review-radar",
    "portfolio-tracker-intake",
    "portfolio-research-connections",
    "导出不包含页面标题",
  ]) {
    assertIncludes(
      files.portfolioShell,
      portfolioShell,
      snippet,
      "Portfolio module must render and export the portfolio workbench packet."
    );
  }
  assertIncludes(
    files.portfolioShell,
    portfolioShell,
    "handoff=portfolio-workbench",
    "Portfolio module tracker handoff must tell the database page its source."
  );
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
    "关联备忘录",
    "状态",
    "确信度",
    "投资假设",
    "风险笔记",
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
	  "创建 tracker 行",
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
	    "研究队列",
	    "阻塞",
	    "高优先级",
	    "研究队列闸门",
	    "优先研究任务",
	    "就绪",
	    "部分就绪",
	    "缺失",
	    "转录稿",
	    "行动项",
	  "meetingResearchQueue",
    "handleExportResearchQueue",
    "MeetingResearchQueueGateRow",
    "MeetingResearchQueueItemCard",
    "MeetingResearchQueueStatusPill",
	    "MeetingResearchQueueRiskPill",
	    "MeetingResearchQueueWorkstreamPill",
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
	  "导出 follow-up",
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
    "导出复盘",
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
        research_workbench_lanes: 5,
        research_workbench_local_only: true,
        research_project_tracker_intake_fields: 8,
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
