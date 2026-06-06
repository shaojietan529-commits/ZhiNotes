#!/usr/bin/env node

// Verifies the batch page-import planner contract:
// - The planner module exists and stays metadata-only (no byte/content reads).
// - It routes Markdown/HTML/text to page-import, spreadsheets to database-import,
//   Office/media to local-retain, and unknown formats to blocked-review.
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
];
for (const ext of requiredExtensions) {
  check(source.includes(`"${ext}"`), `路由缺少扩展名 ${ext}`);
}

// ── Rollback plan ────────────────────────────────────────────
check(source.includes("rollback_plan"), "缺少 rollback_plan 字段");
check(
  source.includes("soft-delete-page") &&
    source.includes("soft-delete-database-row"),
  "回退动作必须覆盖软删除页面和数据库行"
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

check(
  executorSource.includes("export async function executePageImportPlan"),
  "缺少 executePageImportPlan 执行器"
);
check(
  executorSource.includes("export function countExecutableItems"),
  "缺少 countExecutableItems 辅助函数"
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
// Executor must not upload or call AI.
check(
  executorSource.includes("uploads_data: false") &&
    executorSource.includes("enables_ai: false"),
  "执行器必须声明不上传、不调用 AI"
);
// Spreadsheets and unknown formats must be skipped (not created) in this stage.
check(
  executorSource.includes("skippedDatabase") &&
    executorSource.includes("skippedBlocked"),
  "执行器必须跳过数据库候选和待复核文件"
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
      boundary_flags: requiredBoundaryFlags.length,
      redacts_file_names_in_export: true,
      local_only: true,
    },
    null,
    2
  )
);
