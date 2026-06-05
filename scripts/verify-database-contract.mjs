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
  databaseTemplateCatalog: "src/lib/database/databaseTemplateCatalog.ts",
  databaseTemplateRows: "src/lib/database/databaseTemplateRows.ts",
  databaseTemplateRowReadiness:
    "src/lib/database/databaseTemplateRowReadiness.ts",
  databaseViewReadiness: "src/lib/database/databaseViewReadiness.ts",
  databaseImportExportReadiness:
    "src/lib/database/databaseImportExportReadiness.ts",
  databaseWorkbench: "src/lib/database/databaseWorkbench.ts",
  queries: "src/lib/db/local/queries.ts",
  databaseExport: "src/lib/export/databaseExport.ts",
  databaseImport: "src/lib/database/databaseImport.ts",
  databaseFields: "src/lib/database/fields.ts",
  databaseMultiSelect: "src/lib/database/multiSelectValues.ts",
  databaseNumberValues: "src/lib/database/numberValues.ts",
  databaseSystemFields: "src/lib/database/systemFields.ts",
  inlineDatabaseNode: "src/components/editor/extensions/InlineDatabaseNode.tsx",
  tableView: "src/components/database/views/TableView.tsx",
  listView: "src/components/database/views/ListView.tsx",
  calendarView: "src/components/database/views/CalendarView.tsx",
  galleryView: "src/components/database/views/GalleryView.tsx",
  formView: "src/components/database/views/FormView.tsx",
  chartView: "src/components/database/views/ChartView.tsx",
  timelineView: "src/components/database/views/TimelineView.tsx",
  feedView: "src/components/database/views/FeedView.tsx",
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
  const databaseTemplateCatalog = readProjectFile(files.databaseTemplateCatalog);
  const databaseTemplateRows = readProjectFile(files.databaseTemplateRows);
  const databaseTemplateRowReadiness = readProjectFile(
    files.databaseTemplateRowReadiness
  );
  const databaseViewReadiness = readProjectFile(files.databaseViewReadiness);
  const databaseImportExportReadiness = readProjectFile(
    files.databaseImportExportReadiness
  );
  const databaseWorkbench = readProjectFile(files.databaseWorkbench);
  const queries = readProjectFile(files.queries);
  const databaseExport = readProjectFile(files.databaseExport);
  const databaseImport = readProjectFile(files.databaseImport);
  const databaseFields = readProjectFile(files.databaseFields);
  const databaseMultiSelect = readProjectFile(files.databaseMultiSelect);
  const databaseNumberValues = readProjectFile(files.databaseNumberValues);
  const databaseSystemFields = readProjectFile(files.databaseSystemFields);
  const inlineDatabaseNode = readProjectFile(files.inlineDatabaseNode);
  const tableView = readProjectFile(files.tableView);
  const listView = readProjectFile(files.listView);
  const calendarView = readProjectFile(files.calendarView);
  const galleryView = readProjectFile(files.galleryView);
  const formView = readProjectFile(files.formView);
  const chartView = readProjectFile(files.chartView);
  const timelineView = readProjectFile(files.timelineView);
  const feedView = readProjectFile(files.feedView);
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
  for (const snippet of [
    '{ value: "email", label: "邮箱" }',
    '{ value: "phone", label: "电话" }',
    '{ value: "multi_select", label: "多选" }',
    "DATABASE_CREATED_TIME_FIELD",
    "DATABASE_LAST_EDITED_TIME_FIELD",
    "DATABASE_UNIQUE_ID_FIELD",
    "DATABASE_NUMBER_FORMATS",
    "getDatabaseNumberFormat",
    'fieldType === "multi_select"',
    'fieldType === "number"',
  ]) {
    assertIncludes(
      files.databaseFields,
      databaseFields,
      snippet,
      "Database field picker must expose common Notion-like email, phone, and multi-select fields."
    );
  }
  for (const snippet of [
    'email: "邮箱"',
    'phone: "电话"',
    'multi_select: "多选"',
    'created_time: "创建时间"',
    'last_edited_time: "最后编辑时间"',
    'unique_id: "唯一 ID"',
  ]) {
    assertIncludes(
      files.display,
      display,
      snippet,
      "Database field display labels must include email, phone, multi-select, and system time fields."
    );
  }
  for (const snippet of [
    "DATABASE_CREATED_TIME_FIELD",
    "DATABASE_LAST_EDITED_TIME_FIELD",
    "DATABASE_UNIQUE_ID_FIELD",
    "isDatabaseSystemFieldType",
    "isDatabaseSystemTimeFieldType",
    "isDatabaseSystemTimeField",
    "getDatabaseSystemFieldValue",
    "getDatabaseSystemFieldDateKey",
  ]) {
    assertIncludes(
      files.databaseSystemFields,
      databaseSystemFields,
      snippet,
      "System time fields must share one read-only row/page timestamp helper."
    );
  }
  for (const snippet of [
    "normalizeMultiSelectValue",
    "toggleMultiSelectValue",
    "stringifyMultiSelectValue",
  ]) {
    assertIncludes(
      files.databaseMultiSelect,
      databaseMultiSelect,
      snippet,
      "Multi-select values must share one parser/stringifier across database views."
    );
  }
  for (const snippet of [
    "formatDatabaseNumberValue",
    "getDatabaseNumberFormat",
    '"percent"',
    '"currency_usd"',
    '"currency_cny"',
    '"multiple"',
    "formatCompactNumber(number)}%",
  ]) {
    assertIncludes(
      files.databaseNumberValues,
      databaseNumberValues,
      snippet,
      "Number fields must share one display formatter for percentages, currencies, and multiples."
    );
  }
  for (const snippet of [
    'field.field_type === "email"',
    'field.field_type === "phone"',
    'field.field_type === "multi_select"',
    'field.field_type === "number"',
    'type={inputType}',
    'mailto:${linkValue}',
    'tel:${linkValue}',
    "toggleMultiSelectValue",
    "formatDatabaseNumberValue",
    "isDatabaseSystemField",
    "isDatabaseSystemTimeField",
    "getDatabaseSystemFieldValue",
  ]) {
    assertIncludes(
      files.tableView,
      tableView,
      snippet,
      "Table view must edit and display email/phone/multi-select fields."
    );
  }
  for (const snippet of [
    'field.field_type === "email"',
    'field.field_type === "phone"',
    'field.field_type === "multi_select"',
    '? "email"',
    '? "tel"',
    "toggleMultiSelectValue",
    "isDatabaseSystemField",
    "创建行后自动生成",
  ]) {
    assertIncludes(
      files.formView,
      formView,
      snippet,
      "Form view must use native email/phone inputs and multi-select chips."
    );
  }
  for (const [sourceLabel, source] of [
    [files.listView, listView],
    [files.galleryView, galleryView],
    [files.timelineView, timelineView],
    [files.calendarView, calendarView],
    [files.feedView, feedView],
  ]) {
    for (const snippet of ["isDatabaseSystemField", "getDatabaseSystemField"]) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Database views must read created/edited system fields from row/page metadata."
      );
    }
  }
  for (const [sourceLabel, source] of [
    [files.databaseShell, databaseShell],
    [files.listView, listView],
    [files.galleryView, galleryView],
    [files.timelineView, timelineView],
    [files.feedView, feedView],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "formatDatabaseNumberValue",
      "Formatted number fields must display consistently across database search and summary views."
    );
  }
  for (const snippet of [
    "DATABASE_NUMBER_FORMATS",
    "数字格式",
    "只改变显示方式，原始值仍按数字保存。",
    "buildFieldConfig(nextType, options, numberFormat)",
    "buildFieldConfig(type, options, numberFormat)",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Field settings and add-field UI must expose number display formats without changing stored values."
    );
  }
  for (const snippet of [
    '| "email"',
    '| "phone"',
    '| "multi_select"',
    '| "created_time"',
    '| "last_edited_time"',
    '| "unique_id"',
    "isEmailValue",
    "isPhoneValue",
    "parseMultiSelectValue",
    'fieldType === "email"',
    'fieldType === "phone"',
    'fieldType === "multi_select"',
    "isDatabaseSystemFieldType",
  ]) {
    assertIncludes(
      files.databaseImport,
      databaseImport,
      snippet,
      "Spreadsheet import should infer/preserve email, phone, and multi-select field types locally."
    );
  }
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "stringifyMultiSelectValue",
    "CSV/XLSX export must render multi-select arrays as readable text."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "getDatabaseSystemFieldValue",
    "CSV/XLSX export must include read-only database system timestamps."
  );
  for (const snippet of ["normalizeMultiSelectValue", '"multi_select"']) {
    assertIncludes(
      files.chartView,
      chartView,
      snippet,
      "Chart view must group multi-select fields by selected option."
    );
  }
  for (const snippet of [
    "getDatabaseSystemFieldValue",
    '"created_time"',
    '"last_edited_time"',
    "isDatabaseSystemTimeField",
  ]) {
    assertIncludes(
      files.chartView,
      chartView,
      snippet,
      "Chart view must group read-only system time fields by month."
    );
  }
  for (const [sourceLabel, source] of [
    [files.timelineView, timelineView],
    [files.calendarView, calendarView],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "fields.find(isDatabaseSystemTimeField)",
      "Timeline and calendar fallbacks must use system time fields, not unique ID fields."
    );
  }
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
    files.databaseImport,
    databaseImport,
    'format: "zhinote-database-direct-import-preview"',
    "Database direct import must define a local preview format."
  );
  assertIncludes(
    files.databaseImport,
    databaseImport,
    'format: "zhinote-database-direct-import-receipt"',
    "Database direct import must define a metadata-only receipt format."
  );
  for (const snippet of [
    "DATABASE_DIRECT_IMPORT_ROW_LIMIT = 500",
    "DATABASE_DIRECT_IMPORT_COLUMN_LIMIT = 50",
    "buildDatabaseImportPreview",
    "applyDatabaseImportPreview",
    "local_preview_only: true",
    "reads_selected_file_values: true",
    "requires_typed_confirmation_before_write: true",
    "uploads_data: false",
    "calls_external_service: false",
    "enables_ai: false",
    "receipt_status: \"local-database-import-metadata-only\"",
    "file_name_included: false",
    "includes_file_name: false",
    "includes_file_bytes: false",
    "includes_file_text: false",
    "includes_spreadsheet_cell_values: false",
    "writes_workspace_data: true",
    "addField(databaseId",
    "addRow(databaseId",
  ]) {
    assertIncludes(
      files.databaseImport,
      databaseImport,
      snippet,
      "Database direct import must preserve local confirmation and metadata boundaries."
    );
  }
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
  for (const snippet of [
    "DATABASE_IMPORT_ACCEPT",
    "DATABASE_IMPORT_CONFIRMATION_PHRASE",
    "handleDatabaseImportFileSelected",
    "handleApplyDatabaseImport",
    "DatabaseImportPreviewPanel",
    "DatabaseImportReceiptPanel",
    "追加导入当前数据库",
    "导出导入 receipt",
    "不保存文件名、文件 bytes、表格单元格或页面正文",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database UI must expose direct spreadsheet import into the current database."
    );
  }
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "DatabaseTemplateButton",
    "Database UI must retain template-row entry points."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "buildDatabaseTemplateRowDraft",
    "Database UI must create template rows with local structural field drafts."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "buildDatabaseTemplateRowReceipt",
    "Database UI must create local template-row write receipts."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "appendDatabaseTemplateRowReceipt",
    "Database UI must append local template-row write receipts."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "fieldValues: draft.field_values",
    "Database template rows must write safe structural field defaults."
  );
  for (const snippet of [
    "fields={fields}",
    "预填 {draft.applied_fields.length}",
    "手动 {draft.skipped_fields.length}",
    "不含敏感投资字段",
    "摘要只看模板 metadata 和字段 schema",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database template row menu must preview safe field draft coverage before writing."
    );
  }
  for (const snippet of [
    "DatabaseTemplateRowReceiptPanel",
    "templateRowReceipt",
    "handleExportTemplateRowReceipt",
    "导出模板行 receipt",
    "不包含数据库标题、row values、field names、页面正文",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database page must expose the latest local template-row receipt."
    );
  }
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "buildDatabaseTemplateRowDraft",
    "Inline database UI must share template-row field draft logic."
  );
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "buildDatabaseTemplateRowReceipt",
    "Inline database UI must create local template-row write receipts."
  );
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "appendDatabaseTemplateRowReceipt",
    "Inline database UI must append local template-row write receipts."
  );
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "fieldValues: draft.field_values",
    "Inline database template rows must write safe structural field defaults."
  );
  for (const snippet of [
    "fields={fields}",
    "预填 {draft.applied_fields.length}",
    "手动 {draft.skipped_fields.length}",
    "只看模板 metadata 和字段 schema",
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline template row menu must preview safe field draft coverage before writing."
    );
  }
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "RelationCompletionAssistant",
    "Research database relation completion must remain available."
  );
  for (const snippet of [
    "RelationHandoffContextPanel",
    "Relation handoff",
    "getRelationHandoffSourceLabel",
    "handoff",
    "候选行",
    "可写入字段",
    "清除 handoff",
    "不读页面正文",
    "不包含持仓或交易计划",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database page must show focused relation handoff context before manual relation writes."
    );
  }
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
    files.databaseTemplateCatalog,
    databaseTemplateCatalog,
    'format: "zhinote-database-template-catalog"',
    "Database template catalog must define a stable local export format."
  );
  assertIncludes(
    files.databaseTemplateCatalog,
    databaseTemplateCatalog,
    "buildDatabaseTemplateCatalogReport",
    "Database template catalog must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    'format: "zhinote-database-template-row-draft"',
    "Database template row drafts must define a stable local format."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "buildDatabaseTemplateRowDraft",
    "Database template row drafts must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    'format: "zhinote-database-template-row-receipt"',
    "Database template row receipts must define a stable local format."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "buildDatabaseTemplateRowReceipt",
    "Database template row receipts must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "appendDatabaseTemplateRowReceipt",
    "Database template row receipts must expose a local append helper."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "listDatabaseTemplateRowReceipts",
    "Database template row receipts must expose local receipt history."
  );
  for (const snippet of [
    'draft_status: "local-template-row-structure-only"',
    'receipt_status: "local-template-row-metadata-only"',
    "DATABASE_TEMPLATE_ROW_RECEIPT_EVENT",
    "inferTemplateRowGroupId",
    "getStatusCandidates",
    "getSelectCandidates",
    "isSensitiveInvestmentField",
    "reads_template_metadata: true",
    "reads_database_schema: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "includes_private_investment_details: false",
    "includes_holdings: false",
    "includes_tickers: false",
    "includes_position_sizes: false",
    "includes_prices: false",
    "includes_trading_plan: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "stored_in_browser_local_storage: true",
    "includes_database_title: false",
    "includes_row_title: false",
    "includes_page_title: false",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_body_text: false",
    "includes_tokens_or_credentials: false",
    "receipt_writes_workspace_data: false",
    "action_writes_local_workspace_data: true",
    '"敏感或方向性投资字段必须由用户手动填写。"',
  ]) {
    assertIncludes(
      files.databaseTemplateRows,
      databaseTemplateRows,
      snippet,
      "Database template row drafts must preserve safe local-only structural defaults."
    );
  }
  assertIncludes(
    files.databaseViewReadiness,
    databaseViewReadiness,
    'format: "zhinote-database-view-readiness"',
    "Database view readiness must define a stable local export format."
  );
  assertIncludes(
    files.databaseViewReadiness,
    databaseViewReadiness,
    "buildDatabaseViewReadinessReport",
    "Database view readiness must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRowReadiness,
    databaseTemplateRowReadiness,
    'format: "zhinote-database-template-row-readiness"',
    "Database template row readiness must define a stable local export format."
  );
  assertIncludes(
    files.databaseTemplateRowReadiness,
    databaseTemplateRowReadiness,
    "buildDatabaseTemplateRowReadinessReport",
    "Database template row readiness must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-template-row-schema-only"',
    "TEMPLATE_ROW_REQUIREMENTS",
    "reads_template_metadata: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    '"ready"',
    '"partial"',
    '"needs-schema"',
    '"template-row-schema-map"',
    '"template-row-ready-groups"',
    '"relation-backed-templates"',
    '"recommended-database-fit"',
    '"local-row-write-boundary"',
  ]) {
    assertIncludes(
      files.databaseTemplateRowReadiness,
      databaseTemplateRowReadiness,
      snippet,
      "Database template row readiness must preserve schema-only boundaries and gates."
    );
  }
  for (const groupId of ["company", "report", "meeting", "portfolio"]) {
    assertIncludes(
      files.databaseTemplateRowReadiness,
      databaseTemplateRowReadiness,
      `group_id: "${groupId}"`,
      `Database template row readiness must include ${groupId}.`
    );
  }
  for (const snippet of [
    'report_status: "local-view-readiness-only"',
    "DATABASE_VIEW_READINESS_REQUIREMENTS",
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
    '"configured"',
    '"configured-limited"',
    '"ready-to-add"',
    '"needs-schema"',
    '"date-driven-views"',
    '"status-workflow-views"',
    '"chartable-fields"',
    '"schema-gaps"',
  ]) {
    assertIncludes(
      files.databaseViewReadiness,
      databaseViewReadiness,
      snippet,
      "Database view readiness must preserve schema-only boundaries and view gates."
    );
  }
  assertIncludes(
    files.databaseImportExportReadiness,
    databaseImportExportReadiness,
    'format: "zhinote-database-import-export-readiness"',
    "Database import/export readiness must define a stable local export format."
  );
  assertIncludes(
    files.databaseImportExportReadiness,
    databaseImportExportReadiness,
    "buildDatabaseImportExportReadinessReport",
    "Database import/export readiness must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-import-export-readiness-only"',
    'readiness_verdict: "ready-with-manual-value-gates"',
    "local_report_only: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "writes_workspace_data: false",
    "exports_row_values: false",
    "imports_file_values: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseImportExportReadiness,
      databaseImportExportReadiness,
      snippet,
      "Database import/export readiness must preserve metadata-only boundaries."
    );
  }
  for (const snippet of [
    '"module-metadata-only"',
    '"value-export-confirmation"',
    '"spreadsheet-import-confirmation"',
    '"empty-database-bootstrap"',
    '"schema-matching"',
    '"cloud-ai-boundary"',
    "typed_confirmation_required_for_import: true",
    "values_included_on_export",
    "csv_export_route",
    "xlsx_export_route",
	    "append_import_route",
	    "创建首批行",
	    "还没有行",
	  ]) {
    assertIncludes(
      files.databaseImportExportReadiness,
      databaseImportExportReadiness,
      snippet,
      "Database import/export readiness must expose value gates and routes."
    );
  }
  assertIncludes(
    files.databaseWorkbench,
    databaseWorkbench,
    'format: "zhinote-database-workbench-packet"',
    "Database workbench must define a stable local export format."
  );
  assertIncludes(
    files.databaseWorkbench,
    databaseWorkbench,
    "buildDatabaseWorkbenchPacket",
    "Database workbench must expose a reusable packet builder."
  );
  for (const snippet of [
    'packet_status: "local-database-workbench-only"',
    'workbench_verdict: "ready-for-local-research-database-review"',
    "reads_database_dashboard: true",
    "reads_view_readiness: true",
    "reads_template_row_readiness: true",
    "reads_import_export_readiness: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_text: false",
    "writes_workspace_data: false",
    "creates_database_rows: false",
    "creates_schema_fields: false",
    "exports_row_values: false",
    "imports_file_values: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseWorkbench,
      databaseWorkbench,
      snippet,
      "Database workbench must preserve metadata-only local boundaries."
    );
  }
  for (const snippet of [
    '"tracker-fit"',
    '"relation-setup"',
    '"template-intake"',
    '"view-design"',
    '"import-export"',
    '"manual-review"',
    "DatabaseWorkbenchDecisionSummary",
    "decision_summary: buildDecisionSummary",
    'current_state: "local-database-owner-review"',
    "can_review_schema_now: true",
    "can_review_views_now: true",
    "can_create_template_rows_without_manual_click_now: false",
    "can_bulk_import_spreadsheet_now: false",
    "can_export_row_values_from_module_now: false",
    "can_send_database_values_to_ai_now: false",
    "can_sync_database_values_now: false",
    '"schema-view-review"',
    '"relation-schema-review"',
    '"template-row-intake"',
    '"spreadsheet-import-export"',
    '"cloud-ai-sync-boundary"',
    "target_section_id",
    "databases-create-workspace",
    "databases-template-readiness",
    "databases-view-readiness",
    "databases-import-export-readiness",
    "databases-workbench-databases",
    "auto_create_database_rows_from_packet",
    "auto_create_schema_fields_from_packet",
    "bulk_import_spreadsheet_without_typed_confirmation",
    "read_database_row_values_from_module_center",
	    "send_database_values_to_ai",
	    "required_verification_commands",
	    "创建本地行",
	    "本地模板行",
	    "视图覆盖只使用元数据计数",
	    "创建行或字段",
	  ]) {
    assertIncludes(
      files.databaseWorkbench,
      databaseWorkbench,
      snippet,
      "Database workbench must expose research database lanes and forbidden actions."
    );
  }
  for (const viewType of requiredViews) {
    assertIncludes(
      files.databaseViewReadiness,
      databaseViewReadiness,
      `"${viewType}"`,
      `Database view readiness must include ${viewType}.`
    );
  }
  for (const snippet of [
    "NOTE_TEMPLATES",
    "local_catalog_only: true",
    "reads_template_metadata: true",
    "template_rows_read_workspace_data: false",
    "reads_database_rows: false",
    "includes_database_row_values: false",
    "includes_page_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "公司研究跟踪表",
    "报告库跟踪表",
    "会议跟踪表",
    "组合跟踪表",
    "持仓名、ticker、权重、交易计划",
  ]) {
    assertIncludes(
      files.databaseTemplateCatalog,
      databaseTemplateCatalog,
      snippet,
      "Database template catalog must preserve template groups and privacy boundaries."
    );
  }
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseModuleDashboardReport",
    "Databases module UI must build the dashboard report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseTemplateCatalogReport",
    "Databases module UI must build the template row catalog."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseViewReadinessReport",
    "Databases module UI must build the view readiness report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseTemplateRowReadinessReport",
    "Databases module UI must build the template row readiness report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseImportExportReadinessReport",
    "Databases module UI must build the import/export readiness report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseWorkbenchPacket",
    "Databases module UI must build the database workbench packet."
  );
  for (const snippet of [
    "数据库决策摘要",
    "DatabaseDecisionSummaryPanel",
    "DatabaseDecisionCard",
    "DatabaseDecisionStatusPill",
    "handleDecisionOpen",
    "onOpenDecision",
    "database-decision-summary",
    "当前可做",
    "保持关闭",
    "待你确认",
    "数据库决策摘要只读取本地摘要元数据",
    "数据库工作台",
    "导出工作台包",
    "DatabaseWorkbenchPanel",
    "DatabaseWorkbenchLaneCard",
    "DatabaseWorkbenchActionCard",
    "DatabaseWorkbenchDatabaseCard",
    "DatabaseWorkbenchStepRow",
    "handleWorkbenchStepNavigate",
    "onReviewStepOpen",
    "scrollIntoView",
	    "打开步骤",
	    "分数",
	    "个字段",
	    "个视图",
	    "databases-workbench",
    "databases-workbench-routes",
    "databases-priority-actions",
    "databases-workbench-databases",
    "databases-review-sequence",
    "不读取行值、页面正文或表格单元格",
    "不从模块页读取行值",
    "不批量导入",
    "不自动建",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export the local database workbench."
    );
  }
  for (const snippet of [
	    "模板行就绪",
	    "导出模板行就绪",
	    "TemplateRowReadinessPanel",
	    "TemplateRowDatabaseCard",
	    "模板行闸门",
	    "已就绪",
	    "部分就绪",
	    "不包含字段名、行值或页面正文",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export template row readiness."
    );
  }
  for (const snippet of [
    "DATABASE_TEMPLATE_ROW_RECEIPT_EVENT",
    "listDatabaseTemplateRowReceipts",
    "templateRowReceipts",
    "handleExportTemplateRowReceipts",
    "模板行记录",
    "导出记录",
    'format: "zhinote-database-template-row-receipt-history"',
    'history_status: "local-metadata-only"',
    "TemplateRowReceiptHistoryPanel",
    "TemplateRowReceiptCard",
    "summarizeTemplateRowReceipts",
    "不含字段名",
    "页面正文或敏感投资字段",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_body_text: false",
    "includes_tokens_or_credentials: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export local template-row receipt history."
    );
  }
  for (const snippet of [
    "导入/导出就绪",
    "导出导入/导出就绪",
    "DatabaseImportExportReadinessPanel",
    "DatabaseImportExportGateRow",
    "DatabaseImportExportCard",
    "DatabaseImportExportStatusPill",
	    "DatabaseImportExportRiskPill",
	    "handleExportImportExportReadiness",
	    "导入/导出闸门",
	    "label=\"导入\"",
	    "不读取行值",
    "真实导入/导出仍在具体数据库页手动触发",
    "导出含行值",
    "导入需确认短语",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export import/export readiness."
    );
  }
  for (const snippet of [
    "视图适配就绪",
    "导出视图就绪",
    "ViewReadinessGateRow",
    "ViewReadinessDatabaseCard",
    "ViewReadinessStatusPill",
    "不读取行值或页面正文",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export view readiness."
    );
  }
  for (const snippet of [
    "投研模板行目录",
    "TemplateCatalogPanel",
    "CatalogMetric",
    "具体数据库页的「+ 模板行」菜单",
    "不读取行值",
    "隐私边界",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render the template row catalog."
    );
  }
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
    "不读取行值",
    "Databases module UI must make the row-value privacy boundary visible."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "追加导入当前数据库",
    "Databases module UI must document direct database import."
  );
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    "数据库页面追加导入当前数据库",
    "Database module dashboard must document direct spreadsheet import."
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
  for (const snippet of [
    "relationPages",
    "getTimelineDisplayFields",
    "formatTimelineFieldValue",
    "stringifyRelationValue",
    "getDatabaseFieldDisplayName",
    "新建行",
  ]) {
    assertIncludes(
      files.timelineView,
      timelineView,
      snippet,
      "Timeline view must support investment tracker context fields and row creation."
    );
  }
  for (const snippet of [
    "FeedCard",
    "FeedFieldChip",
    "getFeedFields",
    "compareFeedFields",
    "getRelationPages",
    "getDatabaseFieldDisplayName",
    "getFieldOptions",
    "onUpdateRow",
    "onOpenPage",
    "relationPages",
    "formatUrlLabel",
    'field.field_type === "email"',
    'field.field_type === "phone"',
    'field.field_type === "multi_select"',
    "stringifyMultiSelectValue",
    "mailto:${String(value)}",
    "tel:${String(value)}",
    "更新于",
    "删除",
  ]) {
    assertIncludes(
      files.feedView,
      feedView,
      snippet,
      "Feed view must show investment tracker field context, relation chips, and quick follow-up toggles."
    );
  }

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
        direct_spreadsheet_import: true,
        spreadsheet_import_requires_confirmation: true,
        view_readiness_gates: 6,
        template_row_readiness: true,
        template_row_field_drafts: true,
        template_row_receipts: true,
        template_row_receipt_history: true,
        import_export_readiness: true,
        feed_field_context: true,
        database_workbench: true,
      },
      null,
      2
    )
  );
}

run();
