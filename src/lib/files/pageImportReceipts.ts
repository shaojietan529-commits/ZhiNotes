"use client";

import {
  buildExportablePageImportManifest,
  type ExportablePageImportManifest,
  type PageImportPlan,
} from "@/lib/files/pageImportPlan";
import type { PageImportExecutionResult } from "@/lib/files/pageImportExecutor";

export const PAGE_IMPORT_EXECUTION_RECEIPT_EVENT =
  "zhinote:page-import-execution-receipt";

const STORAGE_KEY = "zhinote.pageImport.executionReceipts";
const MAX_RECEIPTS = 50;

export interface PageImportExecutionReceiptInput {
  plan: PageImportPlan;
  result: PageImportExecutionResult;
  confirmation_checked: boolean;
}

export interface PageImportExecutionReceiptItem {
  index: number;
  extension: string;
  lane: PageImportExecutionResult["item_results"][number]["lane"];
  target_kind: PageImportExecutionResult["item_results"][number]["target_kind"];
  preview_route: PageImportExecutionResult["item_results"][number]["preview_route"];
  status: PageImportExecutionResult["item_results"][number]["status"];
  action: PageImportExecutionResult["item_results"][number]["action"];
  retryable: boolean;
  created_workspace_data: boolean;
  rolled_back: boolean;
  file_name_included: false;
}

export interface PageImportExecutionReceipt {
  format: "zhinote-page-import-execution-receipt";
  format_version: 1;
  receipt_id: string;
  receipt_status: "local-batch-import-metadata-only";
  created_at: string;
  action_status: PageImportExecutionResult["status"];
  failure_mode: PageImportExecutionResult["failure_mode"];
  privacy_note: string;
  confirmation: {
    user_checked_import_plan: boolean;
    required_gates_reviewed: number;
    rollback_plan_steps: number;
  };
  manifest: ExportablePageImportManifest;
  result_summary: {
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
    retryable_items: number;
    rolled_back_item_results: number;
    item_status_counts: {
      completed: number;
      skipped: number;
      failed: number;
      rolled_back: number;
      not_run: number;
    };
    notes_count: number;
  };
  item_results: PageImportExecutionReceiptItem[];
  boundary: {
    local_receipt_only: true;
    stored_in_browser_local_storage: true;
    includes_file_names: false;
    includes_file_bytes: false;
    includes_file_text: false;
    includes_page_body_text: false;
    includes_spreadsheet_cell_values: false;
    includes_page_ids: false;
    includes_database_ids: false;
    includes_tokens_or_credentials: false;
    uploads_data: false;
    calls_external_service: false;
    writes_server_audit_log: false;
    receipt_writes_workspace_data: false;
    action_may_write_local_workspace_data: true;
  };
  next_review: string[];
}

export function buildPageImportExecutionReceipt({
  plan,
  result,
  confirmation_checked,
}: PageImportExecutionReceiptInput): PageImportExecutionReceipt {
  const manifest = buildExportablePageImportManifest(plan);
  return {
    format: "zhinote-page-import-execution-receipt",
    format_version: 1,
    receipt_id: createReceiptId(),
    receipt_status: "local-batch-import-metadata-only",
    created_at: new Date().toISOString(),
    action_status: result.status,
    failure_mode: result.failure_mode,
    privacy_note:
      "批量导入后在本地生成。这个 receipt 只记录导入计划和执行结果的统计 metadata，不包含文件名、文件 bytes、文件文本、页面正文、表格单元格值、页面 id、数据库 id、token、credential、prompt、云端数据或 AI 输出。",
    confirmation: {
      user_checked_import_plan: confirmation_checked,
      required_gates_reviewed: plan.required_gates.length,
      rollback_plan_steps: plan.rollback_plan.length,
    },
    manifest,
    result_summary: {
      created_pages: result.created_pages,
      editable_page_imports: result.editable_page_imports,
      markdown_editable_pages: result.markdown_editable_pages,
      html_native_preview_pages: result.html_native_preview_pages,
      local_preview_pages: result.local_preview_pages,
      created_databases: result.created_databases,
      retained_file_pages: result.retained_file_pages,
      skipped_database: result.skipped_database,
      skipped_blocked: result.skipped_blocked,
      failed: result.failed,
      rolled_back_pages: result.rolled_back_pages,
      rolled_back_databases: result.rolled_back_databases,
      preserved_successful_items: result.preserved_successful_items,
      retryable_items: result.retryable_items,
      rolled_back_item_results: result.rolled_back_item_results,
      item_status_counts: countItemStatuses(result),
      notes_count: result.notes.length,
    },
    item_results: result.item_results.map((item) => ({
      index: item.index,
      extension: item.extension,
      lane: item.lane,
      target_kind: item.target_kind,
      preview_route: item.preview_route,
      status: item.status,
      action: item.action,
      retryable: item.retryable,
      created_workspace_data: item.created_workspace_data,
      rolled_back: item.rolled_back,
      file_name_included: false,
    })),
    boundary: {
      local_receipt_only: true,
      stored_in_browser_local_storage: true,
      includes_file_names: false,
      includes_file_bytes: false,
      includes_file_text: false,
      includes_page_body_text: false,
      includes_spreadsheet_cell_values: false,
      includes_page_ids: false,
      includes_database_ids: false,
      includes_tokens_or_credentials: false,
      uploads_data: false,
      calls_external_service: false,
      writes_server_audit_log: false,
      receipt_writes_workspace_data: false,
      action_may_write_local_workspace_data: true,
    },
    next_review: buildNextReview(result),
  };
}

export function appendPageImportExecutionReceipt(
  receipt: PageImportExecutionReceipt
) {
  if (!canUseLocalStorage()) return;

  const receipts = [receipt, ...listPageImportExecutionReceipts()].slice(
    0,
    MAX_RECEIPTS
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  window.dispatchEvent(
    new CustomEvent(PAGE_IMPORT_EXECUTION_RECEIPT_EVENT, { detail: receipt })
  );
}

export function listPageImportExecutionReceipts(): PageImportExecutionReceipt[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPageImportExecutionReceipt);
  } catch {
    return [];
  }
}

function buildNextReview(result: PageImportExecutionResult) {
  const review: string[] = [];
  if (result.retryable_items > 0) {
    review.push("按导入明细处理可重试项；receipt 只记录序号和类型，不含文件名。");
  }
  if (result.status === "partially-completed") {
    review.push("成功项已保留在工作区；可以只重试失败、未执行或已回退的项目。");
  }
  if (result.rolled_back_item_results > 0) {
    review.push("已回退项没有保留在工作区，可缩小批次后重新导入。");
  }
  if (result.html_native_preview_pages > 0) {
    review.push("逐个复核 HTML 报告页，外部资源默认保持阻止。");
  }
  if (result.markdown_editable_pages > 0) {
    review.push("抽查 Markdown 可编辑正文，确认标题、列表、链接和表格转换符合预期。");
  }
  if (result.created_databases > 0) {
    review.push("复核新数据库字段、行数上限和表头映射。");
  }
  if (result.status === "rolled-back") {
    review.push("导入已回退，重新选择更小批次或先处理异常格式。");
  }
  if (review.length === 0) {
    review.push("把新页面关联到公司、会议、报告、组合或项目。");
  }
  return review;
}

function countItemStatuses(result: PageImportExecutionResult) {
  return result.item_results.reduce(
    (counts, item) => {
      switch (item.status) {
        case "completed":
          counts.completed += 1;
          break;
        case "skipped":
          counts.skipped += 1;
          break;
        case "failed":
          counts.failed += 1;
          break;
        case "rolled-back":
          counts.rolled_back += 1;
          break;
        case "not-run":
          counts.not_run += 1;
          break;
      }
      return counts;
    },
    {
      completed: 0,
      skipped: 0,
      failed: 0,
      rolled_back: 0,
      not_run: 0,
    }
  );
}

function isPageImportExecutionReceipt(
  value: unknown
): value is PageImportExecutionReceipt {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PageImportExecutionReceipt>;
  return (
    record.format === "zhinote-page-import-execution-receipt" &&
    record.receipt_status === "local-batch-import-metadata-only" &&
    Boolean(record.receipt_id) &&
    Boolean(record.created_at)
  );
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function createReceiptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `page-import-receipt-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
