// Confirmed batch importer that turns a previewed PageImportPlan into real
// local pages, with rollback if any step fails.
//
// This runs ONLY after the user has reviewed the plan and explicitly confirmed
// in the UI (batch page creation is a high-risk action). It never uploads raw
// file bytes or calls AI. Markdown/plain-text/RTF/EPUB/notebook/new Office files
// become real page bodies; spreadsheets become real local databases; created
// page/database records then follow the user's account sync settings. Other
// page-import / local-retain files become local file pages with a metadata
// preview block; unknown formats are skipped here and routed to owner review.

import {
  createPageWithCloud,
  deletePageWithCloud,
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import { savePageFile } from "@/lib/files/localStore";
import {
  buildFileLibraryPageTitle,
  buildFileLibraryPageContent,
} from "@/lib/files/filePage";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
import { dataUrlToArrayBuffer } from "@/lib/files/dataUrl";
import { convertEpubToHtml } from "@/lib/files/epub";
import { convertNotebookToHtml } from "@/lib/files/notebook";
import { convertPresentationToHtml } from "@/lib/files/presentationImport";
import { convertRtfToHtml } from "@/lib/files/rtf";
import {
  importSpreadsheetAsDatabase,
  rollbackSpreadsheetDatabase,
} from "@/lib/files/spreadsheet";
import { convertWordToHtml } from "@/lib/files/word";
import type { PageImportPlan, PageImportPlanItem } from "./pageImportPlan";
import type { Page } from "@/lib/utils/types";

export type PageImportItemExecutionStatus =
  | "completed"
  | "skipped"
  | "failed"
  | "rolled-back"
  | "not-run";

export type PageImportFailureMode = "rollback-all" | "keep-successful";

export interface PageImportItemExecutionResult {
  index: number;
  extension: string;
  lane: PageImportPlanItem["lane"];
  target_kind: PageImportPlanItem["target_kind"];
  preview_route: PageImportPlanItem["preview_route"];
  status: PageImportItemExecutionStatus;
  action:
    | "created-editable-page"
    | "created-html-preview-page"
    | "created-local-preview-page"
    | "created-database"
    | "skipped-owner-review"
    | "skipped-missing-file"
    | "skipped-database-kind-mismatch"
    | "failed-during-import"
    | "not-run";
  retryable: boolean;
  created_workspace_data: boolean;
  rolled_back: boolean;
  file_name_included: false;
  note: string;
}

export interface PageImportExecutionResult {
  status: "completed" | "partially-completed" | "rolled-back";
  failure_mode: PageImportFailureMode;
  created_pages: number;
  editable_page_imports: number;
  markdown_editable_pages: number;
  html_native_preview_pages: number;
  local_preview_pages: number;
  created_databases: number;
  retained_file_pages: number;
  skipped_database: number;
  skipped_blocked: number;
  failed: number;
  rolled_back_pages: number;
  rolled_back_databases: number;
  preserved_successful_items: number;
  first_page_id: string | null;
  first_database_id: string | null;
  created_page_metadata: Page[];
  item_results: PageImportItemExecutionResult[];
  retryable_items: number;
  rolled_back_item_results: number;
  notes: string[];
  boundaries: {
    reads_file_bytes_now: true;
    creates_pages_now: true;
    creates_databases_now: true;
    uploads_file_bytes: false;
    syncs_page_records_to_account_cloud: true;
    syncs_database_records_to_account_cloud: true;
    uploads_data: false;
    enables_ai: false;
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function deriveTitle(fileName: string, text: string): string {
  const heading = text.match(/^\s{0,3}#{1,6}\s+(.+)$/m);
  if (heading) {
    const cleaned = heading[1].replace(/[#*`_]/g, "").trim();
    if (cleaned) return cleaned.slice(0, 120);
  }
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || "未命名页面";
}

function deriveNotebookTitle(fileName: string, text: string): string {
  try {
    const parsed = JSON.parse(text) as {
      cells?: Array<{ cell_type?: string; source?: string | string[] }>;
    };
    const headingLine = parsed.cells
      ?.filter((cell) => cell.cell_type === "markdown")
      .map((cell) =>
        Array.isArray(cell.source) ? cell.source.join("") : cell.source ?? ""
      )
      .flatMap((source) => source.split(/\r?\n/))
      .find((line) => /^\s{0,3}#{1,6}\s+/.test(line));
    const cleaned = headingLine?.replace(/^\s{0,3}#{1,6}\s+/, "").trim();
    if (cleaned) return cleaned.replace(/[#*`_]/g, "").slice(0, 120);
  } catch {
    // Fall back to file name for malformed notebooks; conversion will render
    // the parse failure inside the page body for review.
  }
  return deriveTitle(fileName, "");
}

function toPageMetadata(page: Page): Page {
  return {
    ...page,
    content_yjs: null,
    content_text: null,
  };
}

function textToParagraphs(text: string): string {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
  return html || "<p></p>";
}

/**
 * Execute a confirmed batch import. Pages and databases created during the run
 * are tracked so failures can either roll back the whole batch or keep the
 * successful items and leave failed/not-run items retryable.
 */
export async function executePageImportPlan(
  files: File[],
  plan: PageImportPlan,
  opts?: {
    failureMode?: PageImportFailureMode;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<PageImportExecutionResult> {
  const createdPageIds: string[] = [];
  const createdPageMetadata: Page[] = [];
  const createdDatabaseIds: string[] = [];
  const notes: string[] = [];
  let createdPages = 0;
  let editablePageImports = 0;
  let markdownEditablePages = 0;
  let htmlNativePreviewPages = 0;
  let localPreviewPages = 0;
  let createdDatabases = 0;
  let retainedFilePages = 0;
  let skippedDatabase = 0;
  let skippedBlocked = 0;
  let currentItem: PageImportPlanItem | null = null;
  const failureMode = opts?.failureMode ?? "rollback-all";

  const total = plan.items.length;
  const itemResults: PageImportItemExecutionResult[] = plan.items.map((item) => ({
    index: item.index,
    extension: item.extension,
    lane: item.lane,
    target_kind: item.target_kind,
    preview_route: item.preview_route,
    status: "not-run",
    action: "not-run",
    retryable: false,
    created_workspace_data: false,
    rolled_back: false,
    file_name_included: false,
    note: "尚未执行。",
  }));

  const recordItem = (
    item: PageImportPlanItem,
    patch: Partial<
      Omit<
        PageImportItemExecutionResult,
        | "index"
        | "extension"
        | "lane"
        | "target_kind"
        | "preview_route"
        | "file_name_included"
      >
    >
  ) => {
    const result = itemResults.find((entry) => entry.index === item.index);
    if (!result) return;
    Object.assign(result, patch);
  };

  const finish = (
    status: PageImportExecutionResult["status"],
    failed: number,
    rolledBackPages: number,
    rolledBackDatabases: number
  ): PageImportExecutionResult => ({
    status,
    failure_mode: failureMode,
    created_pages: createdPages,
    editable_page_imports: editablePageImports,
    markdown_editable_pages: markdownEditablePages,
    html_native_preview_pages: htmlNativePreviewPages,
    local_preview_pages: localPreviewPages,
    created_databases: createdDatabases,
    retained_file_pages: retainedFilePages,
    skipped_database: skippedDatabase,
    skipped_blocked: skippedBlocked,
    failed,
    rolled_back_pages: rolledBackPages,
    rolled_back_databases: rolledBackDatabases,
    preserved_successful_items:
      status === "partially-completed"
        ? itemResults.filter(
            (item) => item.status === "completed" && item.created_workspace_data
          ).length
        : 0,
    first_page_id: createdPageIds[0] ?? null,
    first_database_id: createdDatabaseIds[0] ?? null,
    created_page_metadata:
      status === "rolled-back" ? [] : createdPageMetadata,
    item_results: itemResults,
    retryable_items: itemResults.filter((item) => item.retryable).length,
    rolled_back_item_results: itemResults.filter((item) => item.rolled_back)
      .length,
    notes,
    boundaries: {
      reads_file_bytes_now: true,
      creates_pages_now: true,
      creates_databases_now: true,
      uploads_file_bytes: false,
      syncs_page_records_to_account_cloud: true,
      syncs_database_records_to_account_cloud: true,
      uploads_data: false,
      enables_ai: false,
    },
  });

  const rollback = async (): Promise<{
    rolledBackPages: number;
    rolledBackDatabases: number;
  }> => {
    let rolledBackPages = 0;
    let rolledBackDatabases = 0;
    for (const id of [...createdPageIds].reverse()) {
      try {
        await deletePageWithCloud(id);
        rolledBackPages += 1;
      } catch (err) {
        console.error("[Zhinote] rollback failed for page", id, err);
      }
    }
    for (const id of [...createdDatabaseIds].reverse()) {
      try {
        await rollbackSpreadsheetDatabase(id);
        rolledBackDatabases += 1;
      } catch (err) {
        console.error("[Zhinote] rollback failed for database", id, err);
      }
    }
    return { rolledBackPages, rolledBackDatabases };
  };

  const rememberCreatedPage = (page: Page) => {
    createdPageIds.push(page.id);
    createdPageMetadata.push(toPageMetadata(page));
  };

  try {
    for (let i = 0; i < plan.items.length; i++) {
      const item = plan.items[i];
      currentItem = item;
      const file = files[item.index - 1];
      opts?.onProgress?.(i, total);

      if (item.lane === "blocked-review") {
        skippedBlocked += 1;
        recordItem(item, {
          status: "skipped",
          action: "skipped-owner-review",
          retryable: true,
          note: "需要人工复核后再导入。",
        });
        continue;
      }
      if (!file) {
        notes.push(`第 ${item.index} 个文件缺失，已跳过。`);
        recordItem(item, {
          status: "skipped",
          action: "skipped-missing-file",
          retryable: true,
          note: "本次选择里没有找到对应文件；可重新选择后重试。",
        });
        continue;
      }

      const stored = await savePageFile(file);

      if (item.lane === "database-import") {
        if (stored.kind !== "spreadsheet") {
          skippedDatabase += 1;
          recordItem(item, {
            status: "skipped",
            action: "skipped-database-kind-mismatch",
            retryable: true,
            note: "计划为数据库导入，但本地识别不是表格文件。",
          });
          continue;
        }
        const result = await importSpreadsheetAsDatabase(stored);
        createdDatabaseIds.push(result.database_id);
        createdDatabases += 1;
        notes.push(
          `表格已本地导入为数据库「${result.database_title}」：${result.rows_imported} 行、${result.columns_imported} 列；没有上传文件内容。`
        );
        recordItem(item, {
          status: "completed",
          action: "created-database",
          retryable: false,
          created_workspace_data: true,
          note: "已创建本地数据库。",
        });
        if (result.truncated_rows) {
          notes.push(
            `表格 ${result.rows_available - result.rows_imported} 行未导入，保留在原始文件预览中以避免卡顿。`
          );
        }
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "markdown") {
        const text = stored.textContent ?? "";
        const html = markdownToHtml(text);
        const page = await createPageWithCloud({
          title: deriveTitle(stored.name, text),
          icon: "MD",
        });
        const updatedPage = await updatePageWithCloud(page.id, {
          content_text: html,
        });
        rememberCreatedPage(updatedPage ?? page);
        createdPages += 1;
        editablePageImports += 1;
        markdownEditablePages += 1;
        notes.push("Markdown 已本地转换为可编辑页面；没有上传文件内容。");
        recordItem(item, {
          status: "completed",
          action: "created-editable-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建 Markdown 可编辑页面。",
        });
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "text") {
        const text = stored.textContent ?? "";
        const html = textToParagraphs(text);
        const page = await createPageWithCloud({
          title: deriveTitle(stored.name, text),
          icon: "TXT",
        });
        const updatedPage = await updatePageWithCloud(page.id, {
          content_text: html,
        });
        rememberCreatedPage(updatedPage ?? page);
        createdPages += 1;
        editablePageImports += 1;
        recordItem(item, {
          status: "completed",
          action: "created-editable-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建文本可编辑页面。",
        });
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "rtf") {
        const text = stored.textContent ?? "";
        const html = convertRtfToHtml(text);
        const page = await createPageWithCloud({
          title: deriveTitle(stored.name, ""),
          icon: "RTF",
        });
        const updatedPage = await updatePageWithCloud(page.id, {
          content_text: html,
        });
        rememberCreatedPage(updatedPage ?? page);
        createdPages += 1;
        editablePageImports += 1;
        notes.push("RTF 已本地转换为可编辑页面；没有上传文件内容。");
        recordItem(item, {
          status: "completed",
          action: "created-editable-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建 RTF 可编辑页面。",
        });
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "epub") {
        const html = await convertEpubToHtml(
          await dataUrlToArrayBuffer(stored.dataUrl)
        );
        const page = await createPageWithCloud({
          title: deriveTitle(stored.name, ""),
          icon: "EPUB",
        });
        const updatedPage = await updatePageWithCloud(page.id, {
          content_text: html,
        });
        rememberCreatedPage(updatedPage ?? page);
        createdPages += 1;
        editablePageImports += 1;
        notes.push("EPUB 已本地解析为可编辑页面；没有加载远程资源或上传文件内容。");
        recordItem(item, {
          status: "completed",
          action: "created-editable-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建 EPUB 可编辑页面。",
        });
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "word") {
        const html = await convertWordToHtml(stored);
        const page = await createPageWithCloud({
          title: deriveTitle(stored.name, ""),
          icon: "DOC",
        });
        const updatedPage = await updatePageWithCloud(page.id, {
          content_text: html,
        });
        rememberCreatedPage(updatedPage ?? page);
        createdPages += 1;
        editablePageImports += 1;
        notes.push("Word/ODT 已本地转换为可编辑页面；没有上传文件内容。");
        recordItem(item, {
          status: "completed",
          action: "created-editable-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建 Word/ODT 可编辑页面。",
        });
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "presentation") {
        const html = await convertPresentationToHtml(stored);
        const page = await createPageWithCloud({
          title: deriveTitle(stored.name, ""),
          icon: "PPT",
        });
        const updatedPage = await updatePageWithCloud(page.id, {
          content_text: html,
        });
        rememberCreatedPage(updatedPage ?? page);
        createdPages += 1;
        editablePageImports += 1;
        notes.push("PowerPoint/ODP 已本地转换为可编辑页面；没有上传文件内容。");
        recordItem(item, {
          status: "completed",
          action: "created-editable-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建 PowerPoint/ODP 可编辑页面。",
        });
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "notebook") {
        const text = stored.textContent ?? "";
        const html = convertNotebookToHtml(text);
        const page = await createPageWithCloud({
          title: deriveNotebookTitle(stored.name, text),
          icon: "NOTE",
        });
        const updatedPage = await updatePageWithCloud(page.id, {
          content_text: html,
        });
        rememberCreatedPage(updatedPage ?? page);
        createdPages += 1;
        editablePageImports += 1;
        notes.push("Notebook 已本地解析为可编辑页面；代码单元格只作为文本保留，未执行。");
        recordItem(item, {
          status: "completed",
          action: "created-editable-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建 Notebook 可编辑页面；代码未执行。",
        });
        continue;
      }

      // Remaining page-import (e.g. HTML, which needs external-resource review
      // before inlining) and all local-retain files become local file pages
      // with a safe metadata preview block.
      const page = await createPageWithCloud({
        title: buildFileLibraryPageTitle(stored),
        icon: "FILE",
      });
      const updatedPage = await updatePageWithCloud(page.id, {
        content_text: buildFileLibraryPageContent(stored),
      });
      rememberCreatedPage(updatedPage ?? page);
      if (item.lane === "page-import" && stored.kind === "html") {
        htmlNativePreviewPages += 1;
        notes.push("HTML 已创建为报告文件页；沙盒原生预览默认阻止外部资源。");
        recordItem(item, {
          status: "completed",
          action: "created-html-preview-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建 HTML 报告沙盒预览页。",
        });
      } else {
        localPreviewPages += 1;
        recordItem(item, {
          status: "completed",
          action: "created-local-preview-page",
          retryable: false,
          created_workspace_data: true,
          note: "已创建本地文件预览页。",
        });
      }
      retainedFilePages += 1;
    }

    opts?.onProgress?.(total, total);
    return finish("completed", 0, 0, 0);
  } catch (err) {
    console.error("[Zhinote] batch import failed:", err);
    if (currentItem) {
      recordItem(currentItem, {
        status: "failed",
        action: "failed-during-import",
        retryable: true,
        note:
          failureMode === "rollback-all"
            ? "导入此项时发生异常；本次写入会整体回退。"
            : "导入此项时发生异常；已成功的项目会保留，可稍后只重试失败项。",
      });
    }
    let undone = { rolledBackPages: 0, rolledBackDatabases: 0 };
    if (failureMode === "rollback-all") {
      undone = await rollback();
    }
    for (const item of itemResults) {
      if (
        failureMode === "rollback-all" &&
        item.status === "completed" &&
        item.created_workspace_data
      ) {
        item.status = "rolled-back";
        item.rolled_back = true;
        item.retryable = true;
        item.note = "此项本次已创建，但因后续异常已回退；可重试。";
      } else if (item.status === "not-run") {
        item.retryable = true;
        item.note = "本次还没有执行到此项；处理异常后可重试。";
      }
    }
    if (failureMode === "rollback-all") {
      notes.push(
        `导入中途失败，已回退 ${undone.rolledBackPages} 个本次创建的页面、${undone.rolledBackDatabases} 个数据库。文件没有上传或外发。`
      );
    } else {
      const preserved = itemResults.filter(
        (item) => item.status === "completed" && item.created_workspace_data
      ).length;
      notes.push(
        `导入中途失败，已保留 ${preserved} 个成功创建的对象；失败和未执行项目可单独重试。文件没有上传或外发。`
      );
    }
    return finish(
      failureMode === "rollback-all" ? "rolled-back" : "partially-completed",
      1,
      undone.rolledBackPages,
      undone.rolledBackDatabases
    );
  }
}

/** Count how many plan items the executor will actually create in this stage. */
export function countExecutableItems(plan: PageImportPlan): number {
  return plan.items.filter(
    (item: PageImportPlanItem) =>
      item.lane === "page-import" ||
      item.lane === "local-retain" ||
      item.lane === "database-import"
  ).length;
}
