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
  dashboard: "src/components/modules/ModuleDashboard.tsx",
  projectsShell: "src/components/modules/ProjectsShell.tsx",
  databaseShell: "src/components/database/DatabaseShell.tsx",
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
  "route: string | null;",
  "icon: string;",
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
  const dashboard = readProjectFile(files.dashboard);
  const projectsShell = readProjectFile(files.projectsShell);
  const databaseShell = readProjectFile(files.databaseShell);
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
  for (const field of requiredPlatformModuleFields) {
    assertIncludes(
      files.registry,
      registry,
      field,
      "PlatformModule must preserve required module metadata fields."
    );
  }

  const moduleIds = extractModuleIds(registry);
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
    "completed_foundation",
    "in_progress_hardening",
    "owner_gated_work",
    "recommended_sleep_run_work",
    "trial_routes",
    "required_verification_commands",
    "阶段 3：投研核心模块 beta hardening",
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
  assertIncludes(
    files.dashboard,
    dashboard,
    "新模块接入清单",
    "Module center must render the onboarding panel."
  );
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
    "buildProjectProgressSnapshot",
    "ProjectProgressSnapshotPanel",
    "module-progress-snapshot",
    "当前项目进度快照",
    "导出进度快照",
    "ProjectProgressStatusPill",
    "module-decision-summary",
    "新模块接入决策摘要",
    "ModuleDecisionSummaryPanel",
    "ModuleDecisionCard",
    "ModuleDecisionStatusPill",
    "Export roadmap",
    "Export onboarding",
    "Export starter pack",
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
    "Export onboarding",
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
    "Export starter pack",
    "Module center must export the starter pack contract."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "Export health",
    "Module center must export the module health report."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "Export roadmap",
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
    "创建项目页并入库",
    "trackerIntakeMessage",
    "Project page / 项目页",
    "handoff=projects-module",
    "跨模块 relation 仍需手动补",
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
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "PLATFORM_MODULES",
    "Quick search must read module actions from the module registry."
  );
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
