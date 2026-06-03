#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  databaseShell: "src/components/database/DatabaseShell.tsx",
  databaseModuleShell: "src/components/modules/DatabasesShell.tsx",
  databaseModuleRoute: "src/app/(workspace)/modules/databases/page.tsx",
  databaseModuleDashboard: "src/lib/database/databaseModuleDashboard.ts",
  queries: "src/lib/db/local/queries.ts",
  databaseExport: "src/lib/export/databaseExport.ts",
  moduleActions: "src/lib/modules/actions.ts",
  registry: "src/lib/modules/registry.ts",
  filePreviewNode: "src/components/editor/extensions/FilePreviewNode.tsx",
  relationEditor: "src/components/database/RelationFieldEditor.tsx",
  display: "src/lib/database/display.ts",
  types: "src/lib/utils/types.ts",
};

const requiredViews = [
  "table",
  "list",
  "kanban",
  "calendar",
  "gallery",
  "timeline",
  "chart",
  "form",
  "feed",
];

const requiredWorkspacePresets = [
  "company-research",
  "meeting-tracker",
  "report-library",
  "portfolio-tracker",
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

function assertViewFile(viewType) {
  const fileName = `${viewType[0].toUpperCase()}${viewType.slice(1)}View.tsx`;
  const relativePath = `src/components/database/views/${fileName}`;
  if (!existsSync(path.join(root, relativePath))) {
    failures.push(`Missing view component for ${viewType}: ${relativePath}`);
  }
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const databaseShell = readProjectFile(files.databaseShell);
  const databaseModuleShell = readProjectFile(files.databaseModuleShell);
  const databaseModuleRoute = readProjectFile(files.databaseModuleRoute);
  const databaseModuleDashboard = readProjectFile(files.databaseModuleDashboard);
  const queries = readProjectFile(files.queries);
  const databaseExport = readProjectFile(files.databaseExport);
  const moduleActions = readProjectFile(files.moduleActions);
  const registry = readProjectFile(files.registry);
  const filePreviewNode = readProjectFile(files.filePreviewNode);
  const relationEditor = readProjectFile(files.relationEditor);
  const display = readProjectFile(files.display);
  const types = readProjectFile(files.types);

  assertIncludes(
    files.packageJson,
    packageJson,
    '"xlsx"',
    "Excel import/export requires the xlsx dependency."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "exportDatabaseAsCsv",
    "Database must retain local CSV export."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "exportDatabaseAsXlsx",
    "Database must support local Excel export."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "aoa_to_sheet",
    "Excel export must write visible database rows to a worksheet."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "exportDatabaseAsCsv",
    "Database UI must expose CSV export."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "exportDatabaseAsXlsx",
    "Database UI must expose XLSX export."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "DatabaseTemplateButton",
    "Database UI must retain template-row entry points."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "RelationCompletionAssistant",
    "Research database relation completion must remain available."
  );
  assertIncludes(
    files.registry,
    registry,
    'route: "/modules/databases"',
    "Database module must expose a first-class module route."
  );
  assertIncludes(
    files.databaseModuleRoute,
    databaseModuleRoute,
    "@/components/modules/DatabasesShell",
    "Database module route must load the DatabasesShell."
  );
  assertIncludes(
    files.queries,
    queries,
    "getDatabaseRowCount",
    "Database module dashboard must be able to count rows without reading values."
  );
  assertIncludes(
    files.queries,
    queries,
    "SELECT COUNT(*) as count FROM database_rows",
    "Database row count query must use COUNT rather than getRows."
  );
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    'format: "zhinote-database-module-dashboard"',
    "Database module dashboard must define a stable local export format."
  );
  for (const snippet of [
    "local_dashboard_only: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseModuleDashboard,
      databaseModuleDashboard,
      snippet,
      "Database module dashboard must preserve local-only metadata boundaries."
    );
  }
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    "DATABASE_MODULE_VIEW_TYPES",
    "Database module dashboard must track view coverage."
  );
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    "buildDatabaseModuleDashboardReport",
    "Database module dashboard must expose a reusable report builder."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseModuleDashboardReport",
    "Databases module UI must build the dashboard report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "投研数据库中心",
    "Databases module UI must render the Chinese module title."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "导出数据库总览",
    "Databases module UI must export the dashboard report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "不读取 row values",
    "Databases module UI must make the row-value privacy boundary visible."
  );
  assertIncludes(
    files.filePreviewNode,
    filePreviewNode,
    "handleImportSpreadsheetDatabase",
    "Spreadsheet files must remain importable into local databases."
  );
  assertIncludes(
    files.filePreviewNode,
    filePreviewNode,
    "BULK_IMPORT_CONFIRMATION_PHRASE",
    "Spreadsheet database import must keep typed confirmation."
  );
  assertIncludes(
    files.relationEditor,
    relationEditor,
    "RelationFieldEditor",
    "Relation fields must keep a dedicated editor."
  );

  for (const viewType of requiredViews) {
    assertViewFile(viewType);
    assertIncludes(
      files.types,
      types,
      `"${viewType}"`,
      `DatabaseView type must include ${viewType}.`
    );
    assertIncludes(
      files.display,
      display,
      `${viewType}:`,
      `Display labels must include ${viewType}.`
    );
    assertIncludes(
      files.databaseShell,
      databaseShell,
      `view_type === "${viewType}"`,
      `DatabaseShell must render ${viewType} views.`
    );
  }

  for (const preset of requiredWorkspacePresets) {
    assertIncludes(
      files.moduleActions,
      moduleActions,
      `"${preset}"`,
      `Workspace starter preset ${preset} must exist.`
    );
    assertIncludes(
      files.registry,
      registry,
      `preset: "${preset}"`,
      `Module registry must expose ${preset} starter.`
    );
  }

  if (failures.length > 0) {
    console.error("Database contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Database contract verification passed");
  console.log(
    JSON.stringify(
      {
        view_types: requiredViews.length,
        workspace_presets: requiredWorkspacePresets.length,
        csv_export: true,
        xlsx_export: true,
        spreadsheet_import_requires_confirmation: true,
      },
      null,
      2
    )
  );
}

run();
