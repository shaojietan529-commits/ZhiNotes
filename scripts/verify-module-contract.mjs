#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  registry: "src/lib/modules/registry.ts",
  actions: "src/lib/modules/actions.ts",
  manifest: "src/lib/modules/moduleManifest.ts",
  onboarding: "src/lib/modules/moduleOnboarding.ts",
  starterPack: "src/lib/modules/moduleStarterPack.ts",
  health: "src/lib/modules/moduleHealth.ts",
  roadmap: "src/lib/modules/moduleRoadmap.ts",
  projectProgressSnapshot: "src/lib/modules/projectProgressSnapshot.ts",
  projectFields: "src/lib/modules/researchProjectFields.ts",
  researchTemplateStarters: "src/lib/modules/researchTemplateStarters.ts",
  routeSmoke: "scripts/verify-route-smoke.mjs",
  dashboard: "src/components/modules/ModuleDashboard.tsx",
  notesShell: "src/components/modules/NotesShell.tsx",
  companyResearchShell: "src/components/modules/CompanyResearchShell.tsx",
  meetingsShell: "src/components/modules/MeetingsShell.tsx",
  reportsShell: "src/components/modules/ReportsShell.tsx",
  portfolioShell: "src/components/modules/PortfolioShell.tsx",
  projectsShell: "src/components/modules/ProjectsShell.tsx",
  databaseProvider: "src/components/providers/DatabaseProvider.tsx",
  databaseShell: "src/components/database/DatabaseShell.tsx",
  databasesShell: "src/components/modules/DatabasesShell.tsx",
  sidebar: "src/components/sidebar/Sidebar.tsx",
  quickSearch: "src/components/sidebar/QuickSearch.tsx",
  readme: "README.md",
};

const requiredPlatformModuleFields = [
  "id: string;",
  "title: string;",
  "shortTitle: string;",
  "description: string;",
  "category: ModuleCategory;",
  "status: ModuleStatus;",
  "usageTier: ModuleUsageTier;",
  "route: string | null;",
  "icon: string;",
  "stableUseNote: string;",
  "developmentBoundary: string;",
  "capabilities: string[];",
  "dataSurfaces: string[];",
  "extensionSlots: string[];",
  "starter: ModuleStarter | null;",
];

const requiredSlots = [
  "sidebar.navigation",
  "quick-search.actions",
  "page.blocks",
  "database.views",
  "file.renderers",
];

const requiredStarterTypes = [
  'type: "route"',
  'type: "page"',
  'type: "database"',
  'type: "workspace"',
];

const requiredOnboardingSteps = [
  "stable-registry-entry",
  "route-before-first-class-module",
  "starter-safety",
  "extension-slot-selection",
  "data-surface-boundary",
  "high-risk-action-gates",
  "module-docs",
  "module-verification",
];

const requiredHealthAreas = [
  "module-platform",
  "notes",
  "databases",
  "files-reports",
  "company-research",
  "meetings",
  "projects",
  "portfolio",
  "research-graph",
  "ai",
  "web-beta",
];

const requiredStarterPackFiles = [
  "src/lib/modules/registry.ts",
  "src/app/(workspace)/modules/<module-id>/page.tsx",
  "src/components/modules/<ModuleName>Shell.tsx",
  "src/lib/<domain>/<moduleContract>.ts",
  "src/lib/modules/actions.ts",
  "scripts/verify-module-contract.mjs",
  "README.md",
];

const requiredStarterPackChecklist = [
  "define-module-identity",
  "declare-data-surfaces",
  "choose-extension-slots",
  "add-local-route-shell",
  "wire-safe-starter",
  "document-user-workflow",
  "extend-verification",
  "gate-high-risk-actions",
];

const requiredStarterPackRiskGates = [
  "cloud-sync",
  "ai-execution",
  "external-assets",
  "bulk-or-destructive-action",
];

const requiredResearchTemplateGroups = [
  '"notes"',
  '"company"',
  '"report"',
  '"meeting"',
  '"portfolio"',
];

const requiredResearchTemplateNames = [
  '"报告摄取清单"',
  '"行业对比"',
  '"投研决策日志"',
  '"专家电话纪要"',
  '"管理层会议纪要"',
];

const requiredResearchTemplateActionIds = [
  '"new-company-profile"',
  '"new-investment-memo"',
  '"new-earnings-review"',
  '"new-industry-comparison"',
  '"new-valuation-assumptions"',
  '"new-key-metrics"',
  '"new-research-decision-log"',
  '"new-position-memo"',
  '"new-watchlist-note"',
  '"new-catalyst-risk-review"',
  '"new-meeting-note"',
  '"new-meeting-transcript"',
  '"new-meeting-action-items"',
  '"new-expert-call-note"',
  '"new-management-meeting-note"',
  '"new-report-note"',
  '"new-report-intake-checklist"',
];

const requiredBoundarySnippets = [
  "local_contract_only: true",
  "creates_modules: false",
  "writes_workspace_data: false",
  "reads_page_text: false",
  "reads_database_rows: false",
  "reads_file_bytes: false",
  "connects_cloud_services: false",
  "uploads_data: false",
  "enables_ai: false",
];

const requiredStarterPackBoundarySnippets = [
  "local_contract_only: true",
  "creates_files_now: false",
  "creates_modules_now: false",
  "writes_workspace_data: false",
  "reads_page_text: false",
  "reads_database_rows: false",
  "reads_file_bytes: false",
  "connects_cloud_services: false",
  "uploads_data: false",
  "enables_ai: false",
  "enables_external_assets: false",
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

function assertExcludes(sourceLabel, source, snippet, message) {
  if (source.includes(snippet)) {
    failures.push(`${sourceLabel} must not include ${snippet}: ${message}`);
  }
}

function assertFileExists(relativePath, message) {
  if (!existsSync(path.join(root, relativePath))) {
    failures.push(`${message}: ${relativePath}`);
  }
}

function extractModuleIds(registrySource) {
  const moduleArray = extractPlatformModulesArray(registrySource);
  return [
    ...moduleArray.matchAll(/\{\s*id:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"/g),
  ].map((match) => match[1]);
}

function extractModuleBlock(registrySource, moduleId) {
  const moduleArray = extractPlatformModulesArray(registrySource);
  const match = moduleArray.match(
    new RegExp(`\\{\\s*id:\\s*"${moduleId}"[\\s\\S]*?\\n\\s*\\},`)
  );
  if (!match) {
    failures.push(`Unable to locate module block ${moduleId}.`);
    return "";
  }
  return match[0];
}

function extractModuleRoutes(registrySource) {
  const moduleArray = extractPlatformModulesArray(registrySource);
  return [
    ...moduleArray.matchAll(/route:\s*"([^"]+)"/g),
  ].map((match) => match[1]);
}

function routeFileForModuleRoute(route) {
  return path.join("src/app/(workspace)", route, "page.tsx");
}

function extractPlatformModulesArray(registrySource) {
  const match = registrySource.match(
    /export const PLATFORM_MODULES: PlatformModule\[] = \[([\s\S]*?)\];\n\nexport function/
  );
  if (!match) {
    failures.push("Unable to locate PLATFORM_MODULES array in module registry.");
    return "";
  }
  return match[1];
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const registry = readProjectFile(files.registry);
  const actions = readProjectFile(files.actions);
  const manifest = readProjectFile(files.manifest);
  const onboarding = readProjectFile(files.onboarding);
  const starterPack = readProjectFile(files.starterPack);
  const health = readProjectFile(files.health);
  const roadmap = readProjectFile(files.roadmap);
  const projectProgressSnapshot = readProjectFile(files.projectProgressSnapshot);
  const projectFields = readProjectFile(files.projectFields);
  const researchTemplateStarters = readProjectFile(
    files.researchTemplateStarters
  );
  const routeSmoke = readProjectFile(files.routeSmoke);
  const dashboard = readProjectFile(files.dashboard);
  const notesShell = readProjectFile(files.notesShell);
  const companyResearchShell = readProjectFile(files.companyResearchShell);
  const meetingsShell = readProjectFile(files.meetingsShell);
  const reportsShell = readProjectFile(files.reportsShell);
  const portfolioShell = readProjectFile(files.portfolioShell);
  const projectsShell = readProjectFile(files.projectsShell);
  const databaseProvider = readProjectFile(files.databaseProvider);
  const databaseShell = readProjectFile(files.databaseShell);
  const databasesShell = readProjectFile(files.databasesShell);
  const sidebar = readProjectFile(files.sidebar);
  const quickSearch = readProjectFile(files.quickSearch);
  const readme = readProjectFile(files.readme);

  assertIncludes(
    files.packageJson,
    packageJson,
    "verify:modules",
    "Module contract must be runnable from npm scripts."
  );
  assertIncludes(
    files.registry,
    registry,
    "export interface PlatformModule",
    "Module registry must expose a typed platform module contract."
  );
  for (const snippet of [
    "export type ModuleUsageTier",
    '"stable-use"',
    '"beta-hardening"',
    '"owner-gated-experiment"',
    "getModulesByUsageTier",
    "getModuleUsageTierLabel",
  ]) {
    assertIncludes(
      files.registry,
      registry,
      snippet,
      "Module registry must classify stable use, beta hardening, and owner-gated experiment tiers."
    );
  }
  for (const field of requiredPlatformModuleFields) {
    assertIncludes(
      files.registry,
      registry,
      field,
      "PlatformModule must preserve required module metadata fields."
    );
  }

  const moduleIds = extractModuleIds(registry);
  for (const moduleId of moduleIds) {
    const moduleBlock = extractModuleBlock(registry, moduleId);
    for (const snippet of ["usageTier:", "stableUseNote:", "developmentBoundary:"]) {
      assertIncludes(
        files.registry,
        moduleBlock,
        snippet,
        `Module ${moduleId} must declare stable-use tier and development boundary.`
      );
    }
  }
  for (const snippet of [
    "STABLE_USE_MODULE_REGISTRY",
    "DEVELOPMENT_STABILITY_PLAN",
    "assertStableUseModuleRoutesCovered",
    "assertDevelopmentStabilityRoutesCovered",
    "extractStableUseModuleRoutes",
    "extractDevelopmentStabilityRoutes",
    "extractStableEntrypointsArray",
    "normalizeSmokePath",
    'usageTier: "stable-use"',
    "STABLE_USE_ENTRYPOINTS",
    "Development stability routes missing from route smoke",
    "Stable-use module routes missing from route smoke",
    "/modules/notes",
    "/page/zhinote-route-prefetch",
  ]) {
    assertIncludes(
      files.routeSmoke,
      routeSmoke,
      snippet,
      "Route smoke must derive stable-use module route coverage from the shared module registry."
    );
  }
  const duplicateIds = moduleIds.filter(
    (id, index) => moduleIds.indexOf(id) !== index
  );
  if (duplicateIds.length > 0) {
    failures.push(`Duplicate module ids: ${duplicateIds.join(", ")}`);
  }

  for (const slot of requiredSlots) {
    assertIncludes(
      files.registry,
      registry,
      `id: "${slot}"`,
      `Module extension slot ${slot} must stay registered.`
    );
  }
  assertIncludes(
    files.onboarding,
    onboarding,
    "required_extension_slots",
    "Module onboarding must export required extension slot coverage."
  );
  assertIncludes(
    files.onboarding,
    onboarding,
    "MODULE_EXTENSION_SLOTS.map",
    "Module onboarding must derive extension slots from the shared registry."
  );

  for (const starterType of requiredStarterTypes) {
    assertIncludes(
      files.registry,
      registry,
      starterType,
      `ModuleStarter must preserve ${starterType}.`
    );
  }
  for (const preset of [
    "project-tracker",
    "company-research",
    "meeting-tracker",
    "report-library",
    "portfolio-tracker",
  ]) {
    assertIncludes(
      files.registry,
      registry,
      `preset: "${preset}"`,
      `Workspace starter preset ${preset} must remain registered.`
    );
    assertIncludes(
      files.actions,
      actions,
      `"${preset}"`,
      `Workspace starter preset ${preset} must remain executable.`
    );
  }

  const moduleRoutes = extractModuleRoutes(registry);
  for (const route of moduleRoutes) {
    assertFileExists(
      routeFileForModuleRoute(route),
      `Registered module route ${route} is missing a Next.js page file`
    );
  }

  for (const snippet of requiredBoundarySnippets) {
    assertIncludes(
      files.onboarding,
      onboarding,
      snippet,
      "Module onboarding contract must preserve local-only boundaries."
    );
  }
  for (const snippet of requiredStarterPackBoundarySnippets) {
    assertIncludes(
      files.starterPack,
      starterPack,
      snippet,
      "Module starter pack must preserve local-only boundaries."
    );
  }
  for (const snippet of [
    "local_report_only: true",
    "reads_registry_metadata_only: true",
    "reads_page_text: false",
    "reads_database_rows: false",
    "reads_file_bytes: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.health,
      health,
      snippet,
      "Module health report must preserve local-only boundaries."
    );
  }
  for (const snippet of [
    'format: "zhinote-module-roadmap"',
    "buildModuleRoadmapReport",
    'roadmap_status: "local-module-roadmap-only"',
    "local_report_only: true",
    "reads_registry_metadata_only: true",
    "reads_manifest_metadata: true",
    "reads_onboarding_contract: true",
    "reads_starter_pack_contract: true",
    "reads_health_report: true",
    "reads_page_text: false",
    "reads_database_rows: false",
    "reads_file_bytes: false",
    "reads_secret_values: false",
    "writes_workspace_data: false",
    "creates_modules_now: false",
    "changes_routes_now: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "decision_summary",
    "local-module-design-only",
    "can_design_new_module_now: true",
    "can_add_registry_contract_now: true",
    "can_add_safe_local_route_now: true",
    "can_enable_high_risk_actions_now: false",
    "can_connect_cloud_or_ai_now: false",
    "can_launch_web_module_now: false",
    "new-module-design",
    "route-shell-scaffold",
    "safe-starter",
    "high-risk-actions",
    "web-cloud-ai-boundary",
    "可以继续本地设计新模块",
    '"active-now"',
    '"beta-hardening"',
    '"planned-contracts"',
    '"web-launch-blockers"',
    "required_before_new_module",
    "required_verification_commands",
  ]) {
    assertIncludes(
      files.roadmap,
      roadmap,
      snippet,
      "Module roadmap report must preserve local-only queue, gaps, and verification boundaries."
    );
  }
  for (const snippet of [
    'format: "zhinote-project-progress-snapshot"',
    "buildProjectProgressSnapshot",
    'snapshot_status: "local-owner-progress-review"',
    "local_report_only: true",
    "reads_registry_metadata_only: true",
    "reads_health_metadata: true",
    "reads_roadmap_metadata: true",
    "reads_page_count_only: true",
    "reads_database_count_only: true",
    "reads_page_text: false",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_file_bytes: false",
    "reads_secret_values: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "current_stage",
    "current_conclusion",
    "stable_use_status",
    "ProjectStableUseStatus",
    "getDevelopmentStableUseRoutes",
    "getDevelopmentExperimentalRoutes",
    "getDevelopmentOwnerGatedActions",
    "development_channel",
    "production_interruptions_should_be_batched",
    "experimental_changes_go_to_staging_first",
    "stable_route_source",
    "stable_route_count",
    "experimental_route_count",
    "owner_gated_action_count",
    "user_can_keep_working",
    "local_input_priority",
    "web_beta_can_launch_now: false",
    "cloud_sync_can_start_now: false",
    "protected_boundaries",
    "stable_entrypoints",
    "buildStableUseStatus",
    "当前版本可继续稳定使用",
    "本地输入优先保存",
    "Web Beta、云同步、AI 和高风险写回仍保持 owner-gated",
    "实验改动先在本地或 staging 验证",
    "线上变更成批进入稳定版本",
    "completed_foundation",
    "in_progress_hardening",
    "owner_gated_work",
    "recommended_sleep_run_work",
    "trial_routes",
    "owner_gate_routes",
    "required_verification_commands",
    "阶段 3：投研核心模块 beta hardening",
    "文件预览路由",
    "getTrialRoute",
    "/modules/notes#notes-workbench",
    "/modules/company-research#company-dossier",
    "/modules/files#files-preview-routing",
    "/modules/meetings#meeting-research-queue",
    "/modules/portfolio#portfolio-workbench",
    "/modules/projects#project-launcher",
    "/modules/reports#reports-preview-routing",
    "/modules/databases#databases-import-export-readiness",
    "/modules/research-graph#research-graph-workbench",
    "/modules/ai#ai-payload-review",
    "/modules/sync#web-beta-owner-review",
    "直达笔记工作台",
    "直达公司研究 dossier",
    "直达文件预览路由总控",
    "直达会议研究队列",
    "直达组合工作台",
    "直达项目 launcher",
    "直达研究图谱工作台",
    "直达 AI payload review",
    "直达 Web Beta owner review",
    "创建项目页并入库",
    "项目 handoff",
  ]) {
    assertIncludes(
      files.projectProgressSnapshot,
      projectProgressSnapshot,
      snippet,
      "Project progress snapshot must preserve owner-facing progress, trial routes, and local-only boundaries."
    );
  }
  for (const step of requiredOnboardingSteps) {
    assertIncludes(
      files.onboarding,
      onboarding,
      `id: "${step}"`,
      `Module onboarding contract must keep step ${step}.`
    );
  }
  for (const area of requiredHealthAreas) {
    assertIncludes(
      files.health,
      health,
      `id: "${area}"`,
      `Module health report must map product goal area ${area}.`
    );
  }

  assertIncludes(
    files.manifest,
    manifest,
    "buildModuleManifestReport",
    "Module manifest report must remain available."
  );
  assertIncludes(
    files.starterPack,
    starterPack,
    'format: "zhinote-module-starter-pack"',
    "Module starter pack must expose a stable export format."
  );
  assertIncludes(
    files.starterPack,
    starterPack,
    "buildModuleStarterPackContract",
    "Module starter pack must expose a reusable builder."
  );
  for (const snippet of [
    'contract_status: "local-new-module-starter-contract"',
    "creates_files_now: false",
    "creates_modules_now: false",
    "enables_external_assets: false",
    "required_registry_fields",
    "allowed_starter_types",
    "verification_commands",
    "npm run verify:modules",
    "npm run verify:research-workflow",
    "npm run verify:web-beta",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.starterPack,
      starterPack,
      snippet,
      "Module starter pack must preserve starter contract, boundaries, and verification commands."
    );
  }
  for (const filePath of requiredStarterPackFiles) {
    assertIncludes(
      files.starterPack,
      starterPack,
      filePath,
      `Module starter pack must include required file template ${filePath}.`
    );
  }
  for (const checklistItem of requiredStarterPackChecklist) {
    assertIncludes(
      files.starterPack,
      starterPack,
      `"${checklistItem}"`,
      `Module starter pack must include checklist item ${checklistItem}.`
    );
  }
  for (const riskGate of requiredStarterPackRiskGates) {
    assertIncludes(
      files.starterPack,
      starterPack,
      `"${riskGate}"`,
      `Module starter pack must include risk gate ${riskGate}.`
    );
  }
  for (const snippet of [
    "RESEARCH_TEMPLATE_STARTERS",
    "RESEARCH_TEMPLATE_QUICK_ACTIONS",
    "getResearchTemplateStarters",
  ]) {
    assertIncludes(
      files.researchTemplateStarters,
      researchTemplateStarters,
      snippet,
      "Research template starters must stay centralized for module pages and quick search."
    );
  }
  for (const group of requiredResearchTemplateGroups) {
    assertIncludes(
      files.researchTemplateStarters,
      researchTemplateStarters,
      group,
      `Research template starter group ${group} must stay registered.`
    );
  }
  for (const templateName of requiredResearchTemplateNames) {
    assertIncludes(
      files.researchTemplateStarters,
      researchTemplateStarters,
      templateName,
      `Research template ${templateName} must stay available from the shared starter catalog.`
    );
  }
  for (const actionId of requiredResearchTemplateActionIds) {
    assertIncludes(
      files.researchTemplateStarters,
      researchTemplateStarters,
      actionId,
      `Quick action ${actionId} must stay available from the shared starter catalog.`
    );
  }
  for (const [sourceLabel, source, group] of [
    [files.notesShell, notesShell, "notes"],
    [files.companyResearchShell, companyResearchShell, "company"],
    [files.meetingsShell, meetingsShell, "meeting"],
    [files.reportsShell, reportsShell, "report"],
    [files.portfolioShell, portfolioShell, "portfolio"],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      `getResearchTemplateStarters("${group}")`,
      `Module shell must reuse the shared ${group} research template starter group.`
    );
  }
  assertIncludes(
    files.dashboard,
    dashboard,
    "buildModuleOnboardingContract",
    "Module center must build the onboarding contract."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "buildModuleStarterPackContract",
    "Module center must build the starter pack contract."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "buildModuleHealthReport",
    "Module center must build the module health report."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "buildModuleRoadmapReport",
    "Module center must build the module roadmap report."
  );
  for (const snippet of [
    "countActivePages",
    "countActiveDatabases",
    "refreshWorkspaceCounts",
    "subscribePagesUpdated",
    "subscribeDatabasesUpdated",
    "scheduleCountRefresh",
    "upsertPages([page])",
    "setPageCount((count) => count + 1)",
    "setDatabaseCount((count) => count + 1)",
  ]) {
    assertIncludes(
      files.dashboard,
      dashboard,
      snippet,
      "Module center must read only lightweight workspace counts and update optimistic local counts after creation."
    );
  }
  for (const snippet of [
    'from "@/hooks/usePages"',
    'from "@/hooks/useDatabases"',
    "const { pages, refresh } = usePages()",
    "const { databases, refresh: refreshDatabases } = useDatabases()",
    "await refresh()",
    "await refreshDatabases()",
  ]) {
    assertExcludes(
      files.dashboard,
      dashboard,
      snippet,
      "Module center must not auto-load page/database lists just to render counts or create starters."
    );
  }
  assertIncludes(
    files.dashboard,
    dashboard,
    "新模块接入清单",
    "Module center must render the onboarding panel."
  );
  for (const snippet of [
    "ProjectStableUsePanel",
    'data-testid="project-stable-use-status"',
    "data-stable-use-status={stableUse.status}",
    "data-development-channel={stableUse.development_channel}",
    "data-user-can-keep-working={stableUse.user_can_keep_working}",
    "data-production-interruptions-should-be-batched={",
    "data-experimental-changes-go-to-staging-first={",
    "data-web-beta-can-launch-now={stableUse.web_beta_can_launch_now}",
    "data-cloud-sync-can-start-now={stableUse.cloud_sync_can_start_now}",
    "data-stable-route-source={stableUse.stable_route_source}",
    "data-stable-route-count={stableUse.stable_route_count}",
    "data-experimental-route-count={stableUse.experimental_route_count}",
    "data-owner-gated-action-count={stableUse.owner_gated_action_count}",
    "稳定使用状态",
    "输入策略：本地优先",
    "Web Beta：未批准上线",
    "云同步：需确认",
    "实验改动先本地 / staging",
    "线上变更成批进入",
    "高风险动作需确认",
  ]) {
    assertIncludes(
      files.dashboard,
      dashboard,
      snippet,
      "Module center must show a stable-use status panel so development state is visible without blocking use."
    );
  }
  for (const snippet of [
    "getModulesByUsageTier",
    "module-stable-use-tier-summary",
    "data-stable-use-modules",
    "data-beta-hardening-modules",
    "data-owner-gated-experiment-modules",
    "data-module-usage-tier={module.usageTier}",
    "ModuleUsageTierPill",
    "稳定使用说明",
    "开发边界",
  ]) {
    assertIncludes(
      files.dashboard,
      dashboard,
      snippet,
      "Module center must expose stable-use tiers and development boundaries before users open modules."
    );
  }
  assertIncludes(
    files.dashboard,
    dashboard,
    "平台目标健康度",
    "Module center must render the module health panel."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "模块接入路线图",
    "Module center must render the module roadmap panel."
  );
  for (const snippet of [
    "const [contentScanEnabled, setContentScanEnabled] = useState(false)",
    "includeContent: contentScanEnabled",
    "deferContent: true",
    "{ bodyScanEnabled: contentScanEnabled }",
    "buildSyncedBlockRegistryReport(pages, {",
    "scanEnabled: contentScanEnabled",
    "setContentScanEnabled(true)",
    "upsertPages([page])",
	    "upsertPages([result.page])",
	    "void loadCounts()",
	    "const loadPageMutationModule = () =>",
	    'import("@/lib/pages/cloudPageMutations")',
	    "const loadModuleStarterActions = () =>",
	    'import("@/lib/modules/actions")',
	    "扫描正文结构",
	  ]) {
    assertIncludes(
      files.notesShell,
      notesShell,
      snippet,
      "Notes module must keep first paint metadata-only, make body scans explicit, and update newly created pages optimistically."
    );
  }
  for (const snippet of [
    "includeContent: true",
    "await refresh()",
    'from "@/lib/pages/cloudPageMutations"',
    'from "@/lib/modules/actions"',
	  ]) {
    assertExcludes(
      files.notesShell,
      notesShell,
      snippet,
      "Notes module must not auto-hydrate every page body or block create/open on full page refresh."
    );
  }
  for (const [sourceLabel, source, moduleLabel] of [
    [files.quickSearch, quickSearch, "Quick search"],
    [files.companyResearchShell, companyResearchShell, "Company research"],
    [files.meetingsShell, meetingsShell, "Meetings"],
    [files.reportsShell, reportsShell, "Reports"],
    [files.portfolioShell, portfolioShell, "Portfolio"],
    [files.projectsShell, projectsShell, "Projects"],
    [files.notesShell, notesShell, "Notes"],
    [files.databasesShell, databasesShell, "Databases"],
    [files.dashboard, dashboard, "Module center"],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      'import("@/lib/modules/actions")',
      `${moduleLabel} starter actions must lazy-load only after starter intent.`
    );
    assertExcludes(
      sourceLabel,
      source,
      'from "@/lib/modules/actions"',
      `${moduleLabel} starter actions must stay out of the first paint bundle.`
    );
  }
  for (const snippet of [
    "upsertPages([createdPage])",
    "upsertPages([result.page])",
  ]) {
    assertIncludes(
      files.projectsShell,
      projectsShell,
      snippet,
      "Projects module must optimistically add newly created project pages instead of refreshing the full page list."
    );
  }
  assertExcludes(
    files.projectsShell,
    projectsShell,
    "await refreshPages()",
    "Projects module create/intake flows must not wait for a full page-list refresh."
  );
  for (const snippet of [
    "PROJECT_DATABASE_STATUS_LIMIT = 12",
    "databases.slice(0, PROJECT_DATABASE_STATUS_LIMIT)",
    "visibleDatabases.map(async (database)",
    "visibleDatabases.map((database)",
    "hiddenDatabaseCount",
  ]) {
    assertIncludes(
      files.projectsShell,
      projectsShell,
      snippet,
      "Projects module must keep database status scans and tracker rendering bounded for large workspaces."
    );
  }
  assertExcludes(
    files.projectsShell,
    projectsShell,
    "databases.map(async (database)",
    "Projects module must not scan every database when loading project graph snapshots."
  );
  for (const snippet of [
    "buildProjectProgressSnapshot",
    "ProjectProgressSnapshotPanel",
    "module-progress-snapshot",
    "当前项目进度快照",
    "导出进度快照",
    "ProjectProgressStatusPill",
    "上线前 owner gate",
    "module-decision-summary",
    "新模块接入决策摘要",
    "ModuleDecisionSummaryPanel",
    "ModuleDecisionCard",
    "ModuleDecisionStatusPill",
    "导出路线图",
    "导出接入清单",
    "导出 Starter Pack",
    "module-manifest",
    "module-onboarding",
    "module-starter-pack",
  ]) {
    assertIncludes(
      files.dashboard,
      dashboard,
      snippet,
      "Module center must render the new-module decision summary."
    );
  }
  assertIncludes(
    files.dashboard,
    dashboard,
    "导出接入清单",
    "Module center must export the onboarding contract."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "新模块 Starter Pack",
    "Module center must render the starter pack panel."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "导出 Starter Pack",
    "Module center must export the starter pack contract."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "导出健康度",
    "Module center must export the module health report."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "导出路线图",
    "Module center must export the module roadmap report."
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
      "Project relation field aliases must stay centralized for project module and database handoff."
    );
  }
  for (const snippet of [
    "handleCreateProjectPageAndTrackerRow",
    "buildResearchProjectTrackerIntakeDraft",
    "findExistingResearchProjectTrackerRow",
    "addRow",
    "isResearchProjectPageRelationField",
    "project-launcher",
    "project-tracker-panel",
    "创建项目页并入库",
    "trackerIntakeMessage",
    "项目页关系字段",
    "handoff=projects-module",
    "跨模块关系仍需手动补",
  ]) {
    assertIncludes(
      files.projectsShell,
      projectsShell,
      snippet,
      "Projects module must expose explicit local project page plus tracker row intake."
    );
  }
  for (const snippet of [
    "relationHandoffSource",
    "getRelationCompletionFields(fields, focusPage, relationHandoffSource)",
    "getRelationCompletionRows(",
    "relationCompletionFields",
    "alreadyLinkedToFocus",
    "isProjectModuleHandoff",
    "isProjectPageRelationFieldName",
    "RESEARCH_PROJECT_PAGE_FIELD_ALIASES",
    "matchesResearchProjectFieldAlias",
    "投研项目模块",
    "Project tracker 下一步",
    "不会自动写跨模块 relation",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database handoff must filter project module relation completion to project page fields."
    );
  }
  assertIncludes(
    files.sidebar,
    sidebar,
    "PLATFORM_MODULES",
    "Sidebar navigation must read from the module registry."
  );
  for (const snippet of ["导出 MD", "导出 ZIP"]) {
    assertIncludes(
      files.sidebar,
      sidebar,
      snippet,
      "Sidebar local export controls must keep Chinese action labels."
    );
  }
  assertIncludes(
    files.databaseProvider,
    databaseProvider,
    "正在打开 Zhinote...",
    "The local app loading shell must keep a Chinese status label."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "PLATFORM_MODULES",
    "Quick search must read module actions from the module registry."
  );
  for (const snippet of [
    "RESEARCH_TEMPLATE_QUICK_ACTIONS",
    "templateQuickActions",
    "handleModuleStarter(action.starter)",
  ]) {
    assertIncludes(
      files.quickSearch,
      quickSearch,
      snippet,
      "Quick search must read page template actions from the shared starter catalog."
    );
  }
  assertIncludes(
    files.readme,
    readme,
    "Module Architecture",
    "README must document module architecture."
  );
  assertIncludes(
    files.readme,
    readme,
    "module health",
    "README must document module health reporting."
  );
  assertIncludes(
    files.readme,
    readme,
    "project progress snapshot",
    "README must document the project progress snapshot."
  );
  assertIncludes(
    files.readme,
    readme,
    "npm run verify:modules",
    "README must document module verification."
  );

  const summary = {
    modules: moduleIds.length,
    routable_modules: moduleRoutes.length,
    extension_slots: requiredSlots.length,
    starter_types: requiredStarterTypes.length,
    onboarding_steps: requiredOnboardingSteps.length,
    starter_pack_files: requiredStarterPackFiles.length,
    starter_pack_checklist: requiredStarterPackChecklist.length,
    starter_pack_risk_gates: requiredStarterPackRiskGates.length,
    health_areas: requiredHealthAreas.length,
    research_template_groups: requiredResearchTemplateGroups.length,
    research_template_quick_actions: requiredResearchTemplateActionIds.length,
    roadmap_lanes: 4,
    project_progress_snapshot: 1,
    projects_shell_intake: 1,
    database_project_handoff: 1,
    boundary_checks: requiredBoundarySnippets.length,
  };

  if (failures.length > 0) {
    console.error("Module contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Module contract verification passed");
  console.log(JSON.stringify(summary, null, 2));
}

run();
