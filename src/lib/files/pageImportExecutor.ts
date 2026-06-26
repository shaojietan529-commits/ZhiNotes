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

export interface PageImportExecutionResult {
  status: "completed" | "rolled-back";
  created_pages: number;
  created_databases: number;
  retained_file_pages: number;
  skipped_database: number;
  skipped_blocked: number;
  failed: number;
  rolled_back_pages: number;
  rolled_back_databases: number;
  first_page_id: string | null;
  first_database_id: string | null;
  created_page_metadata: Page[];
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
 * Execute a confirmed batch import. Pages created during the run are tracked so
 * that, if any item throws, every page already created in this run is rolled
 * back (soft-deleted) before returning a rolled-back result.
 */
export async function executePageImportPlan(
  files: File[],
  plan: PageImportPlan,
  opts?: { onProgress?: (done: number, total: number) => void }
): Promise<PageImportExecutionResult> {
  const createdPageIds: string[] = [];
  const createdPageMetadata: Page[] = [];
  const createdDatabaseIds: string[] = [];
  const notes: string[] = [];
  let createdPages = 0;
  let createdDatabases = 0;
  let retainedFilePages = 0;
  let skippedDatabase = 0;
  let skippedBlocked = 0;

  const total = plan.items.length;

  const finish = (
    status: PageImportExecutionResult["status"],
    failed: number,
    rolledBackPages: number,
    rolledBackDatabases: number
  ): PageImportExecutionResult => ({
    status,
    created_pages: createdPages,
    created_databases: createdDatabases,
    retained_file_pages: retainedFilePages,
    skipped_database: skippedDatabase,
    skipped_blocked: skippedBlocked,
    failed,
    rolled_back_pages: rolledBackPages,
    rolled_back_databases: rolledBackDatabases,
    first_page_id: createdPageIds[0] ?? null,
    first_database_id: createdDatabaseIds[0] ?? null,
    created_page_metadata:
      status === "completed" ? createdPageMetadata : [],
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
      const file = files[item.index - 1];
      opts?.onProgress?.(i, total);

      if (item.lane === "blocked-review") {
        skippedBlocked += 1;
        continue;
      }
      if (!file) {
        notes.push(`第 ${item.index} 个文件缺失，已跳过。`);
        continue;
      }

      const stored = await savePageFile(file);

      if (item.lane === "database-import") {
        if (stored.kind !== "spreadsheet") {
          skippedDatabase += 1;
          continue;
        }
        const result = await importSpreadsheetAsDatabase(stored);
        createdDatabaseIds.push(result.database_id);
        createdDatabases += 1;
        notes.push(
          `表格已本地导入为数据库「${result.database_title}」：${result.rows_imported} 行、${result.columns_imported} 列；没有上传文件内容。`
        );
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
        notes.push("RTF 已本地转换为可编辑页面；没有上传文件内容。");
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
        notes.push("EPUB 已本地解析为可编辑页面；没有加载远程资源或上传文件内容。");
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
        notes.push("Word/ODT 已本地转换为可编辑页面；没有上传文件内容。");
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
        notes.push("PowerPoint/ODP 已本地转换为可编辑页面；没有上传文件内容。");
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
        notes.push("Notebook 已本地解析为可编辑页面；代码单元格只作为文本保留，未执行。");
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
      retainedFilePages += 1;
    }

    opts?.onProgress?.(total, total);
    return finish("completed", 0, 0, 0);
  } catch (err) {
    console.error("[Zhinote] batch import failed; rolling back:", err);
    const undone = await rollback();
    notes.push(
      `导入中途失败，已回退 ${undone.rolledBackPages} 个本次创建的页面、${undone.rolledBackDatabases} 个数据库。文件没有上传或外发。`
    );
    return finish("rolled-back", 1, undone.rolledBackPages, undone.rolledBackDatabases);
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
