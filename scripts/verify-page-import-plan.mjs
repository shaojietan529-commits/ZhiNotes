#!/usr/bin/env node

// Verifies the batch page-import planner contract:
// - The planner module exists and stays metadata-only (no byte/content reads).
// - It routes Markdown/HTML/text to page-import, spreadsheets to database-import,
//   preview-first files to local-retain, and unknown formats to blocked-review.
// - It exposes a per-file preview route so the UI can explain whether the file
//   becomes editable body, a native/converted file page, database mapping, or review.
// - It builds a rollback plan and an exportable manifest that redacts file names.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const planFile = "src/lib/files/pageImportPlan.ts";

const errors = [];
function check(condition, message) {
  if (!condition) errors.push(message);
}

const fullPath = path.join(root, planFile);
check(existsSync(fullPath), `${planFile} 不存在`);

const source = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";

// ── Required exported API ────────────────────────────────────
const requiredExports = [
  "buildPageImportPlan",
  "buildExportablePageImportManifest",
  "classifyImportFile",
  "getFileExtension",
];
for (const name of requiredExports) {
  check(source.includes(`export function ${name}`), `缺少导出函数 ${name}`);
}

// ── Required lanes ───────────────────────────────────────────
const requiredLanes = [
  "page-import",
  "database-import",
  "local-retain",
  "blocked-review",
];
for (const lane of requiredLanes) {
  check(source.includes(`"${lane}"`), `缺少导入车道 ${lane}`);
}

// ── Routing coverage ─────────────────────────────────────────
const requiredExtensions = [
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".txt",
  ".csv",
  ".xlsx",
  ".pdf",
  ".docx",
  ".pptx",
  ".rtf",
  ".epub",
  ".ipynb",
  ".zip",
  ".pages",
  ".numbers",
];
for (const ext of requiredExtensions) {
  check(source.includes(`"${ext}"`), `路由缺少扩展名 ${ext}`);
}

// ── Preview routes ───────────────────────────────────────────
const requiredPreviewRoutes = [
  "editable-page-body",
  "file-page-native-preview",
  "file-page-converted-preview",
  "database-mapping",
  "local-metadata-review",
  "blocked-owner-review",
];
for (const route of requiredPreviewRoutes) {
  check(source.includes(`"${route}"`), `缺少预览路线 ${route}`);
}
check(
  source.includes("preview_route: PageImportPreviewRoute"),
  "PageImportPlanItem 必须暴露 preview_route"
);
check(
  source.includes("execution_note: string"),
  "PageImportPlanItem 必须暴露 execution_note"
);
check(
  source.includes("Notebook 会在本地解析") &&
    source.includes("不执行代码") &&
    source.includes("notebook-pages"),
  "Notebook 路线必须说明本地可编辑导入和不执行代码"
);
check(
  source.includes("RTF 会在本地提取纯文本段落") &&
    source.includes("rtf-pages"),
  "RTF 路线必须说明本地可编辑导入"
);
check(
  source.includes("EPUB 会在本地解析目录和章节") &&
    source.includes("epub-pages"),
  "EPUB 路线必须说明本地可编辑导入"
);
check(
  source.includes("DOCX/ODT 会在本地转换为可编辑页面") &&
    source.includes("word-pages") &&
    source.includes("旧版 .doc 不伪装成可编辑导入") &&
    source.includes("legacy-word-retain"),
  "Word 路线必须区分新版可编辑导入和旧版本地留存"
);
check(
  source.includes("PPTX/ODP 会在本地提取幻灯片文本") &&
    source.includes("presentation-pages") &&
    source.includes("旧版 .ppt 不伪装成可编辑导入") &&
    source.includes("legacy-presentation-retain"),
  "PowerPoint 路线必须区分新版可编辑导入和旧版本地留存"
);
check(
  source.includes("PDF 先创建本地文件页"),
  "PDF 路线必须说明先创建本地文件页"
);

// ── Rollback plan ────────────────────────────────────────────
check(source.includes("rollback_plan"), "缺少 rollback_plan 字段");
check(
  source.includes("soft-delete-page") &&
    source.includes("soft-delete-database") &&
    source.includes("soft-delete-database-row"),
  "回退动作必须覆盖软删除页面、数据库和数据库行"
);
check(
  source.includes("buildRollbackPlan"),
  "缺少 buildRollbackPlan 内部构建逻辑"
);

// ── Required gates ───────────────────────────────────────────
const requiredGates = [
  "batch-page-confirmation",
  "html-external-resource-review",
  "database-column-mapping",
  "rollback-ready",
];
for (const gate of requiredGates) {
  check(source.includes(`"${gate}"`), `缺少必经确认 gate ${gate}`);
}

// ── Privacy boundaries ───────────────────────────────────────
const requiredBoundaryFlags = [
  "reads_file_bytes_now: false",
  "parses_file_contents_now: false",
  "creates_pages_now: false",
  "creates_databases_now: false",
  "uploads_data: false",
  "enables_ai: false",
];
for (const flag of requiredBoundaryFlags) {
  check(source.includes(flag), `缺少安全边界开关 ${flag}`);
}

// Exportable manifest must redact names + contents.
check(
  source.includes("returns_file_names: false") &&
    source.includes("returns_file_contents: false"),
  "导出清单必须声明不返回文件名和内容"
);
check(
  source.includes("extension_groups"),
  "导出清单必须按扩展名分组（不含文件名）"
);

// The exportable manifest type must NOT expose a per-file source_name list.
const manifestTypeMatch = source.match(
  /export interface ExportablePageImportManifest \{[\s\S]*?\n\}/
);
check(manifestTypeMatch !== null, "缺少 ExportablePageImportManifest 类型定义");
if (manifestTypeMatch) {
  check(
    !manifestTypeMatch[0].includes("source_name"),
    "导出清单类型不得包含 source_name（文件名必须从导出中剔除）"
  );
}

// ── Executor contract ────────────────────────────────────────
const executorFile = "src/lib/files/pageImportExecutor.ts";
const executorPath = path.join(root, executorFile);
check(existsSync(executorPath), `${executorFile} 不存在`);
const executorSource = existsSync(executorPath)
  ? readFileSync(executorPath, "utf8")
  : "";
const panelFile = "src/components/modules/PageImportPlanPanel.tsx";
const panelPath = path.join(root, panelFile);
check(existsSync(panelPath), `${panelFile} 不存在`);
const panelSource = existsSync(panelPath)
  ? readFileSync(panelPath, "utf8")
  : "";
const receiptFile = "src/lib/files/pageImportReceipts.ts";
const receiptPath = path.join(root, receiptFile);
check(existsSync(receiptPath), `${receiptFile} 不存在`);
const receiptSource = existsSync(receiptPath)
  ? readFileSync(receiptPath, "utf8")
  : "";

check(
  executorSource.includes("export async function executePageImportPlan"),
  "缺少 executePageImportPlan 执行器"
);
check(
  executorSource.includes("export function countExecutableItems"),
  "缺少 countExecutableItems 辅助函数"
);
check(
  executorSource.includes("created_page_metadata") &&
    executorSource.includes("toPageMetadata") &&
    executorSource.includes("content_text: null") &&
    executorSource.includes("rememberCreatedPage"),
  "执行器必须返回不含正文的 created_page_metadata，供导入完成后乐观合并页面索引"
);
check(
  executorSource.includes("editable_page_imports") &&
    executorSource.includes("markdown_editable_pages") &&
    executorSource.includes("html_native_preview_pages") &&
    executorSource.includes("local_preview_pages") &&
    executorSource.includes("Markdown 已本地转换为可编辑页面") &&
    executorSource.includes("HTML 已创建为报告文件页"),
  "执行器必须区分可编辑页面、Markdown 可编辑页、HTML 沙盒预览页和其他本地预览页"
);
// Rollback must exist and soft-delete created pages.
check(
  executorSource.includes("rollback") && executorSource.includes("deletePage"),
  "执行器必须在失败时回退并软删除已创建页面"
);
check(
  executorSource.includes('"rolled-back"'),
  "执行器必须能返回 rolled-back 状态"
);
// Executor must not upload raw files or call AI; created page records follow
// the account page-sync setting when the user is signed in and sync is enabled.
check(
  executorSource.includes("uploads_data: false") &&
    executorSource.includes("uploads_file_bytes: false") &&
    executorSource.includes("syncs_page_records_to_account_cloud: true") &&
    executorSource.includes("syncs_database_records_to_account_cloud: true") &&
    executorSource.includes("creates_databases_now: true") &&
    executorSource.includes("enables_ai: false"),
  "执行器必须声明不上传原始文件、不调用 AI，并明确页面/数据库记录跟随账号同步"
);
check(
  executorSource.includes("convertNotebookToHtml") &&
    executorSource.includes('stored.kind === "notebook"') &&
    executorSource.includes("未执行"),
  "执行器必须把 Notebook 本地转换为可编辑页面，并声明不执行代码"
);
check(
  executorSource.includes("convertRtfToHtml") &&
    executorSource.includes('stored.kind === "rtf"') &&
    executorSource.includes("RTF 已本地转换为可编辑页面"),
  "执行器必须把 RTF 本地转换为可编辑页面"
);
check(
  executorSource.includes("convertEpubToHtml") &&
    executorSource.includes('stored.kind === "epub"') &&
    executorSource.includes("EPUB 已本地解析为可编辑页面") &&
    executorSource.includes("没有加载远程资源"),
  "执行器必须把 EPUB 本地转换为可编辑页面并声明不加载远程资源"
);
check(
  executorSource.includes("convertWordToHtml") &&
    executorSource.includes('stored.kind === "word"') &&
    executorSource.includes("Word/ODT 已本地转换为可编辑页面"),
  "执行器必须把新版 Word/ODT 本地转换为可编辑页面"
);
check(
  executorSource.includes("convertPresentationToHtml") &&
    executorSource.includes('stored.kind === "presentation"') &&
    executorSource.includes("PowerPoint/ODP 已本地转换为可编辑页面"),
  "执行器必须把新版 PowerPoint/ODP 本地转换为可编辑页面"
);
// Spreadsheets become real local databases; unknown formats stay skipped.
check(
  executorSource.includes("importSpreadsheetAsDatabase") &&
    executorSource.includes('stored.kind !== "spreadsheet"') &&
    executorSource.includes("created_databases") &&
    executorSource.includes("first_database_id") &&
    executorSource.includes("表格已本地导入为数据库"),
  "执行器必须把表格本地导入为数据库并返回数据库入口"
);
check(
  executorSource.includes("rollbackSpreadsheetDatabase") &&
    executorSource.includes("rolled_back_databases"),
  "执行器必须能在失败时回退本次创建的数据库"
);
check(
  executorSource.includes('item.lane === "database-import"') &&
    executorSource.includes('item.lane === "local-retain"'),
  "countExecutableItems 必须把数据库导入纳入确认执行数量"
);
check(
  executorSource.includes("skippedBlocked"),
  "执行器必须跳过待复核文件"
);
check(
  panelSource.includes("const { upsertPages } = usePages({ autoLoad: false })") &&
    panelSource.includes("upsertPages(res.created_page_metadata)") &&
    panelSource.includes('openPage(firstPage, { source: "module-create" })') &&
    !panelSource.includes("refreshPages()"),
  "PageImportPlanPanel 执行导入后必须乐观合并页面 metadata，不能刷新全局页面列表"
);
check(
  panelSource.includes("result.editable_page_imports") &&
    panelSource.includes("result.markdown_editable_pages") &&
    panelSource.includes("result.html_native_preview_pages") &&
    panelSource.includes("HTML 外部资源默认继续阻止"),
  "PageImportPlanPanel 必须展示 Markdown/HTML 导入后的具体落地结果"
);
check(
  receiptSource.includes('format: "zhinote-page-import-execution-receipt"') &&
    receiptSource.includes('receipt_status: "local-batch-import-metadata-only"') &&
    receiptSource.includes("buildPageImportExecutionReceipt") &&
    receiptSource.includes("appendPageImportExecutionReceipt") &&
    receiptSource.includes("listPageImportExecutionReceipts") &&
    receiptSource.includes("buildExportablePageImportManifest") &&
    receiptSource.includes("includes_file_names: false") &&
    receiptSource.includes("includes_file_bytes: false") &&
    receiptSource.includes("includes_file_text: false") &&
    receiptSource.includes("includes_page_body_text: false") &&
    receiptSource.includes("includes_spreadsheet_cell_values: false") &&
    receiptSource.includes("includes_page_ids: false") &&
    receiptSource.includes("includes_database_ids: false") &&
    receiptSource.includes("uploads_data: false") &&
    receiptSource.includes("calls_external_service: false") &&
    receiptSource.includes("receipt_writes_workspace_data: false"),
  "批量导入 receipt 必须存在，并保持本地 metadata-only、脱敏、无上传边界"
);
check(
  panelSource.includes("buildPageImportExecutionReceipt") &&
    panelSource.includes("appendPageImportExecutionReceipt") &&
    panelSource.includes("导出批量导入 receipt") &&
    panelSource.includes("导出回退 receipt"),
  "PageImportPlanPanel 必须在执行后生成并导出批量导入 receipt"
);
check(
  panelSource.includes("ImportProgressState") &&
    panelSource.includes("EMPTY_IMPORT_PROGRESS") &&
    panelSource.includes("setImportProgress") &&
    panelSource.includes("onProgress: (done, total)") &&
    panelSource.includes("导入进度队列") &&
    panelSource.includes("visibleProgressItems") &&
    panelSource.includes("正在处理第") &&
    panelSource.includes("正在收尾并生成本地 receipt") &&
    panelSource.includes("导入完成，已生成本地 receipt"),
  "PageImportPlanPanel 必须把执行器 onProgress 接成用户可见的批量导入进度队列"
);

if (errors.length > 0) {
  console.error("Page import plan contract verification FAILED:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log("Page import plan contract verification passed");
console.log(
  JSON.stringify(
    {
      planner_exports: requiredExports.length,
      lanes: requiredLanes.length,
      routed_extensions: requiredExtensions.length,
      required_gates: requiredGates.length,
      preview_routes: requiredPreviewRoutes.length,
      boundary_flags: requiredBoundaryFlags.length,
      redacts_file_names_in_export: true,
      raw_file_bytes_local_only: true,
      page_records_follow_account_sync: true,
      database_records_follow_account_sync: true,
      result_distinguishes_markdown_html_pages: true,
      local_batch_import_receipt: true,
      visible_batch_import_progress_queue: true,
    },
    null,
    2
  )
);
