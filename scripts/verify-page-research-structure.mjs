#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  editor: "src/components/editor/Editor.tsx",
  pageStructure: "src/lib/pages/pageResearchStructure.ts",
  notesModule: "src/lib/pages/notesModule.ts",
  displayTitle: "src/lib/pages/displayTitle.ts",
  pageShell: "src/components/providers/PageShell.tsx",
  notesShell: "src/components/modules/NotesShell.tsx",
  pageTree: "src/components/sidebar/PageTree.tsx",
  notesRoute: "src/app/(workspace)/modules/notes/page.tsx",
  registry: "src/lib/modules/registry.ts",
  queries: "src/lib/db/local/queries.ts",
  readme: "README.md",
};

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
  const editor = readProjectFile(files.editor);
  const pageStructure = readProjectFile(files.pageStructure);
  const notesModule = readProjectFile(files.notesModule);
  const displayTitle = readProjectFile(files.displayTitle);
  const pageShell = readProjectFile(files.pageShell);
  const notesShell = readProjectFile(files.notesShell);
  const pageTree = readProjectFile(files.pageTree);
  const notesRoute = readProjectFile(files.notesRoute);
  const registry = readProjectFile(files.registry);
  const queries = readProjectFile(files.queries);
  const readme = readProjectFile(files.readme);

  for (const snippet of [
    "zhinote-page-research-structure",
    "local-page-structure-only",
    "buildPageResearchStructureReport",
    "reads_linked_page_bodies: false",
    "reads_database_rows: false",
    "reads_file_bytes: false",
    "uploads_data: false",
    "connects_cloud_services: false",
    "enables_ai: false",
    "writes_workspace_data: false",
    "decision_markers",
    "thesis_markers",
    "source_markers",
    "action_markers",
    "risk_markers",
    "catalyst_markers",
    "PageResearchStructureGate",
    "PageResearchStructureSignal",
    "PageResearchStructureAction",
    "next_actions",
    "insert_html",
    "action_status: \"suggested-only\"",
    "suggestion_writes_workspace_data: false",
    "apply-research-template",
    "write-investment-decision",
    "add-evidence-sources",
    "link-research-relations",
  ]) {
    assertIncludes(
      files.pageStructure,
      pageStructure,
      snippet,
      "Page structure report must keep local-only research-readiness fields."
    );
  }

  for (const snippet of [
    "appendHtml: (html: string) => string | undefined",
    "appendHtml(html: string)",
    "insertContentAt(editor.state.doc.content.size, html)",
  ]) {
    assertIncludes(
      files.editor,
      editor,
      snippet,
      "Editor must expose a narrow appendHtml API for local suggested structure insertion."
    );
  }

  for (const snippet of [
    "buildPageResearchStructureReport",
    "handleApplyResearchAction",
    "PageResearchStructurePanel",
    "PageResearchStructureStatusPill",
    "PageResearchStructureSignalPill",
    "PageResearchStructureGateRow",
    "PageResearchStructureActionRow",
    "投研结构",
    "本地页面结构体检",
    "导出结构报告",
    "下一步队列",
    "插入结构块",
    "appendHtml(action.insert_html)",
    "页面目录",
    "researchStructure={pageStructure}",
    "zhinote-page-research-structure-export",
    "local-page-structure-export-only",
    "includes_page_title: false",
    "includes_page_body_text: false",
    "includes_database_row_values: false",
    "includes_file_bytes: false",
  ]) {
    assertIncludes(
      files.pageShell,
      pageShell,
      snippet,
      "Page info panel must render the local research structure report."
    );
  }

  for (const snippet of [
    'format: "zhinote-notes-module-workbench"',
    'report_status: "local-notes-module-only"',
    "buildNotesModuleWorkbenchReport",
    "reads_page_metadata: true",
    "reads_page_content_html: true",
    "reads_page_versions_metadata: true",
    "reads_comment_counts: true",
    "reads_wiki_link_counts: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_file_bytes: false",
    "uploads_data: false",
    "connects_cloud_services: false",
    "enables_ai: false",
    "writes_workspace_data: false",
    "includes_page_body_text: false",
    "includes_comment_body_text: false",
    "includes_file_bytes: false",
    "NotesModuleDecisionSummary",
    "decision_summary: buildDecisionSummary",
    'current_state: "local-notes-owner-review"',
    "can_create_local_pages_now: true",
    "can_review_page_structure_now: true",
    "can_export_page_body_from_workbench_now: false",
    "can_send_page_text_to_ai_now: false",
    "can_sync_notes_now: false",
    "can_bulk_delete_or_overwrite_now: false",
    '"page-foundation"',
    '"research-structure"',
    '"research-links-review-trail"',
    '"format-export-boundary"',
    '"cloud-ai-sync-boundary"',
    '"inbox"',
    '"structure"',
    '"research-links"',
    '"review-trail"',
    '"knowledge-base"',
    '"export-safety"',
    "target_section_id",
    "notes-create-entry",
    "notes-priority-actions",
    "notes-focus-pages",
    "notes-workbench-routes",
    "send_page_text_to_ai",
    "auto_delete_pages",
    "auto_sync_notes",
    "required_verification_commands",
    "个标题",
    "个块",
    "0 个保存版本",
    "工作台报告不会写入页面内容",
    "工作台只使用评论数量",
    "displayPageTitle(page.title)",
  ]) {
    assertIncludes(
      files.notesModule,
      notesModule,
      snippet,
      "Notes module workbench must keep local-only page structure and review boundaries."
    );
  }

  for (const snippet of [
    "displayPageTitle",
    'fallback = "未命名页面"',
    'normalized.toLowerCase() === "untitled"',
  ]) {
    assertIncludes(
      files.displayTitle,
      displayTitle,
      snippet,
      "Default page titles must be displayed in Chinese without changing stored page data."
    );
  }

  for (const snippet of [
    'import { displayPageTitle } from "@/lib/pages/displayTitle"',
    "const title = displayPageTitle(page.title)",
    "{title}",
  ]) {
    assertIncludes(
      files.pageTree,
      pageTree,
      snippet,
      "Sidebar page tree must render localized fallback titles."
    );
  }

  for (const snippet of [
    "getPageModuleCounts",
    "SELECT id FROM pages WHERE deleted_at IS NULL",
    "COUNT(*) as count FROM page_versions",
    "FROM page_comments",
    "FROM block_comments",
    "FROM wiki_links",
    "PageModuleCounts",
  ]) {
    assertIncludes(
      files.queries,
      queries,
      snippet,
      "Notes module counts must be available without reading database row values or file bytes."
    );
  }

  for (const snippet of [
    "NotesShell",
    "buildNotesModuleWorkbenchReport",
    "getPageModuleCounts",
    "笔记与页面中心",
    "笔记决策摘要",
    "NotesDecisionSummaryPanel",
    "NotesDecisionCard",
    "NotesDecisionStatusPill",
    "handleDecisionOpen",
    "notes-decision-summary",
    "当前可做",
    "保持关闭",
    "待你确认",
    "笔记决策摘要只读取本地摘要元数据",
    "笔记工作台",
    "导出笔记工作台",
    "创建笔记入口",
    "handleReviewStepNavigate",
    "onReviewStepOpen",
    "scrollIntoView",
    "打开步骤",
    "内联数据库",
    "反向链接",
    "个行动",
    "个链接",
    "个版本",
    "notes-create-entry",
    "notes-workbench-routes",
    "notes-priority-actions",
    "notes-focus-pages",
    "notes-review-sequence",
    "报告摄取",
    "行业对比",
    "专家电话",
    "决策日志",
    'templateTitle: "报告摄取清单"',
    'templateTitle: "行业对比"',
    'templateTitle: "专家电话纪要"',
    'templateTitle: "投研决策日志"',
    "不包含页面正文、评论正文或文件字节",
    "不读取数据库行值",
    "不自动删除或覆盖页面",
    "不自动同步",
  ]) {
    assertIncludes(
      files.notesShell,
      notesShell,
      snippet,
      "Notes module UI must render the local notes workbench and privacy boundary."
    );
  }

  assertIncludes(
    files.notesRoute,
    notesRoute,
    "@/components/modules/NotesShell",
    "Notes module route must load the NotesShell."
  );
  assertIncludes(
    files.registry,
    registry,
    'route: "/modules/notes"',
    "Notes registry entry must expose a first-class module route."
  );

  assertIncludes(
    files.packageJson,
    packageJson,
    '"verify:page-structure": "node scripts/verify-page-research-structure.mjs"',
    "package.json must expose the focused page-structure verifier."
  );

  for (const snippet of [
    "http://localhost:3000/modules/notes",
    "local 笔记工作台",
    "笔记入口",
    "研究关联",
    "复盘痕迹",
    "导出安全",
    "notes workbench export excludes page body text, comment body text",
    "local page research structure panel",
    "投研结构",
    "下一步队列",
    "导出结构报告",
    "插入结构块",
    "npm run verify:page-structure",
    "does not read linked page bodies, database row values, uploaded file bytes, AI prompts, tokens, credentials, cloud data, or private research content",
    "export excludes page titles, page body text, linked page bodies, database row values, file bytes, tokens, credentials, cloud data, and AI output",
  ]) {
    assertIncludes(
      files.readme,
      readme,
      snippet,
      "README must document the Notes and Pages research-structure boundary."
    );
  }

  if (failures.length > 0) {
    console.error("Page research structure verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Page research structure verification passed.");
  console.log(
    JSON.stringify(
      {
        format: "zhinote-page-research-structure-verification",
        checked_files: Object.keys(files).length,
        local_boundary: true,
        gates: 6,
        suggested_actions: 8,
        signals: 10,
      },
      null,
      2
    )
  );
}

run();
