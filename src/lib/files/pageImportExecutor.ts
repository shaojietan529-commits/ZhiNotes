// Confirmed batch importer that turns a previewed PageImportPlan into real
// local pages, with rollback if any step fails.
//
// This runs ONLY after the user has reviewed the plan and explicitly confirmed
// in the UI (batch page creation is a high-risk action). It never uploads raw
// file bytes or calls AI. Markdown/plain-text/RTF/notebook become real page
// bodies; created page records then follow the user's account page-sync setting. Other
// page-import / local-retain files become local file pages with a metadata
// preview block; spreadsheets and unknown formats are skipped here and routed
// to their own confirmed flows (database column mapping / owner review).

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
import { convertNotebookToHtml } from "@/lib/files/notebook";
import { convertRtfToHtml } from "@/lib/files/rtf";
import type { PageImportPlan, PageImportPlanItem } from "./pageImportPlan";

export interface PageImportExecutionResult {
  status: "completed" | "rolled-back";
  created_pages: number;
  retained_file_pages: number;
  skipped_database: number;
  skipped_blocked: number;
  failed: number;
  rolled_back_pages: number;
  first_page_id: string | null;
  notes: string[];
  boundaries: {
    reads_file_bytes_now: true;
    creates_pages_now: true;
    uploads_file_bytes: false;
    syncs_page_records_to_account_cloud: true;
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
  const notes: string[] = [];
  let createdPages = 0;
  let retainedFilePages = 0;
  let skippedDatabase = 0;
  let skippedBlocked = 0;

  const total = plan.items.length;

  const finish = (status: PageImportExecutionResult["status"], failed: number, rolledBack: number): PageImportExecutionResult => ({
    status,
    created_pages: createdPages,
    retained_file_pages: retainedFilePages,
    skipped_database: skippedDatabase,
    skipped_blocked: skippedBlocked,
    failed,
    rolled_back_pages: rolledBack,
    first_page_id: createdPageIds[0] ?? null,
    notes,
    boundaries: {
      reads_file_bytes_now: true,
      creates_pages_now: true,
      uploads_file_bytes: false,
      syncs_page_records_to_account_cloud: true,
      uploads_data: false,
      enables_ai: false,
    },
  });

  const rollback = async (): Promise<number> => {
    let undone = 0;
    for (const id of [...createdPageIds].reverse()) {
      try {
        await deletePageWithCloud(id);
        undone += 1;
      } catch (err) {
        console.error("[Zhinote] rollback failed for page", id, err);
      }
    }
    return undone;
  };

  try {
    for (let i = 0; i < plan.items.length; i++) {
      const item = plan.items[i];
      const file = files[item.index - 1];
      opts?.onProgress?.(i, total);

      if (item.lane === "database-import") {
        skippedDatabase += 1;
        continue;
      }
      if (item.lane === "blocked-review") {
        skippedBlocked += 1;
        continue;
      }
      if (!file) {
        notes.push(`第 ${item.index} 个文件缺失，已跳过。`);
        continue;
      }

      const stored = await savePageFile(file);

      if (item.lane === "page-import" && stored.kind === "markdown") {
        const text = stored.textContent ?? "";
        const html = markdownToHtml(text);
        const page = await createPageWithCloud({
          title: deriveTitle(stored.name, text),
          icon: "MD",
        });
        await updatePageWithCloud(page.id, { content_text: html });
        createdPageIds.push(page.id);
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
        await updatePageWithCloud(page.id, { content_text: html });
        createdPageIds.push(page.id);
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
        await updatePageWithCloud(page.id, { content_text: html });
        createdPageIds.push(page.id);
        createdPages += 1;
        notes.push("RTF 已本地转换为可编辑页面；没有上传文件内容。");
        continue;
      }

      if (item.lane === "page-import" && stored.kind === "notebook") {
        const text = stored.textContent ?? "";
        const html = convertNotebookToHtml(text);
        const page = await createPageWithCloud({
          title: deriveNotebookTitle(stored.name, text),
          icon: "NOTE",
        });
        await updatePageWithCloud(page.id, { content_text: html });
        createdPageIds.push(page.id);
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
      await updatePageWithCloud(page.id, {
        content_text: buildFileLibraryPageContent(stored),
      });
      createdPageIds.push(page.id);
      retainedFilePages += 1;
    }

    opts?.onProgress?.(total, total);
    return finish("completed", 0, 0);
  } catch (err) {
    console.error("[Zhinote] batch import failed; rolling back:", err);
    const undone = await rollback();
    notes.push(
      `导入中途失败，已回退 ${undone} 个本次创建的页面。文件没有上传或外发。`
    );
    return finish("rolled-back", 1, undone);
  }
}

/** Count how many plan items the executor will actually create in this stage. */
export function countExecutableItems(plan: PageImportPlan): number {
  return plan.items.filter(
    (item: PageImportPlanItem) =>
      item.lane === "page-import" || item.lane === "local-retain"
  ).length;
}
