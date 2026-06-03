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
  dashboard: "src/components/modules/ModuleDashboard.tsx",
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
  const dashboard = readProjectFile(files.dashboard);
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
  for (const step of requiredOnboardingSteps) {
    assertIncludes(
      files.onboarding,
      onboarding,
      `id: "${step}"`,
      `Module onboarding contract must keep step ${step}.`
    );
  }

  assertIncludes(
    files.manifest,
    manifest,
    "buildModuleManifestReport",
    "Module manifest report must remain available."
  );
  assertIncludes(
    files.dashboard,
    dashboard,
    "buildModuleOnboardingContract",
    "Module center must build the onboarding contract."
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
    "Export onboarding",
    "Module center must export the onboarding contract."
  );
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
    "npm run verify:modules",
    "README must document module verification."
  );

  const summary = {
    modules: moduleIds.length,
    routable_modules: moduleRoutes.length,
    extension_slots: requiredSlots.length,
    starter_types: requiredStarterTypes.length,
    onboarding_steps: requiredOnboardingSteps.length,
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
