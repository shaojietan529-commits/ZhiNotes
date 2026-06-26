"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getFields,
} from "@/lib/db/local/queries";
import {
  addField,
  addRow,
  createDatabase,
  updateField,
} from "@/lib/database/cloudDatabaseMutations";
import {
  formatFileSize,
  getStoredPageFile,
  type PageFileKind,
  type StoredPageFile,
} from "@/lib/files/localStore";
import {
  getFilePreviewCapabilityByKind,
  type FilePreviewCapability,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import {
  buildFilePreviewStructure,
  type FilePreviewStructureReport,
  type FilePreviewStructureSignal,
  type FilePreviewStructureStatus,
} from "@/lib/files/filePreviewStructure";
import { highlightCodeToHtml } from "@/lib/codeHighlight";
import { convertZipToHtml } from "@/lib/files/archive";
import { dataUrlToArrayBuffer } from "@/lib/files/dataUrl";
import { convertEpubToHtml } from "@/lib/files/epub";
import { convertNotebookToHtml } from "@/lib/files/notebook";
import { convertOdpToHtml, convertOdtToHtml } from "@/lib/files/openDocument";
import { convertPptxToHtml } from "@/lib/files/presentation";
import { convertRtfToHtml } from "@/lib/files/rtf";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
import { getHighRiskRequiredPhrase } from "@/lib/security/highRiskActionRegistry";
import { buildHighRiskConfirmationReceipt } from "@/lib/security/typedConfirmation";
import {
  appendFilePreviewActionReceipt,
  buildFilePreviewActionReceipt,
  type FilePreviewActionKind,
  type FilePreviewActionReceipt,
} from "@/lib/files/filePreviewActionReceipts";

export interface FilePreviewAttrs {
  fileId: string;
  fileName: string;
  mimeType: string;
  kind: PageFileKind;
  size: number;
  allowExternalResources?: boolean;
}

type ConvertedPreview =
  | { status: "idle" | "loading" }
  | { status: "ready"; srcDoc: string }
  | { status: "error"; message: string };

type SpreadsheetCell = string | number | boolean | null;
type SpreadsheetFieldType = "text" | "number" | "date" | "checkbox" | "url";

const PREVIEW_CSP =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; frame-src data: blob:; child-src data: blob:; connect-src 'none';";
const SPREADSHEET_DATABASE_ROW_LIMIT = 500;
const SPREADSHEET_DATABASE_COLUMN_LIMIT = 50;
const BULK_IMPORT_CONFIRMATION_PHRASE =
  getHighRiskRequiredPhrase("bulk-import");
const EXTERNAL_RESOURCE_CONFIRMATION_PHRASE = getHighRiskRequiredPhrase(
  "external-resource-load"
);
const FILE_KIND_LABELS: Record<PageFileKind, string> = {
  html: "HTML",
  markdown: "Markdown",
  opml: "OPML",
  rtf: "RTF",
  epub: "EPUB",
  archive: "ZIP",
  pdf: "PDF",
  image: "图片",
  audio: "音频",
  video: "视频",
  text: "文本",
  notebook: "Notebook",
  spreadsheet: "表格",
  word: "Word",
  presentation: "PPT",
  pages: "Pages",
  numbers: "Numbers",
  keynote: "Keynote",
  unknown: "未知",
};

function FilePreviewComponent({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const router = useRouter();
  const attrs = node.attrs as FilePreviewAttrs;
  const allowExternalResources = Boolean(attrs.allowExternalResources);
  const [file, setFile] = useState<StoredPageFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(attrs.kind === "html");
  const [importing, setImporting] = useState(false);
  const [databaseImporting, setDatabaseImporting] = useState(false);
  const [bulkImportPhrase, setBulkImportPhrase] = useState("");
  const [exportingBulkImportReceipt, setExportingBulkImportReceipt] =
    useState(false);
  const [externalResourcePhrase, setExternalResourcePhrase] = useState("");
  const [exportingExternalReceipt, setExportingExternalReceipt] =
    useState(false);
  const [lastActionReceipt, setLastActionReceipt] =
    useState<FilePreviewActionReceipt | null>(null);
  const [exportingActionReceipt, setExportingActionReceipt] = useState(false);
  const [convertedPreview, setConvertedPreview] = useState<ConvertedPreview>({
    status: "idle",
  });
  const capability = useMemo(
    () => getFilePreviewCapabilityByKind(attrs.kind),
    [attrs.kind]
  );
  const supportLevel = useMemo(
    () => getEffectivePreviewSupportLevel(attrs.kind, attrs.fileName, capability),
    [attrs.fileName, attrs.kind, capability]
  );

  useEffect(() => {
    let active = true;

    getStoredPageFile(attrs.fileId)
      .then((stored) => {
        if (!active) return;
        setFile(stored);
      })
      .catch((err) => {
        console.error("[Zhinote] Failed to load file preview:", err);
        if (active) setFile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attrs.fileId]);

  const srcDoc = useMemo(() => {
    if (!file) return "";
    if (file.kind === "html") {
      return normalizeHtmlDocument(
        file.textContent ?? "",
        !allowExternalResources
      );
    }
    if (file.kind === "markdown") {
      return createPreviewDocument(markdownToHtml(file.textContent ?? ""));
    }
    if (file.kind === "opml") {
      return createPreviewDocument(convertOpmlToHtml(file.textContent ?? ""));
    }
    if (file.kind === "rtf") {
      return createPreviewDocument(convertRtfToHtml(file.textContent ?? ""));
    }
    if (file.kind === "notebook") {
      return createPreviewDocument(convertNotebookToHtml(file.textContent ?? ""));
    }
    return "";
  }, [allowExternalResources, file]);

  useEffect(() => {
    if (
      !file ||
      (file.kind !== "spreadsheet" &&
        file.kind !== "word" &&
        file.kind !== "presentation" &&
        file.kind !== "epub" &&
        file.kind !== "archive")
    ) {
      return;
    }

    let active = true;

    void (async () => {
      await Promise.resolve();
      if (!active) return;

      if (isLegacyOfficeFile(file)) {
        setConvertedPreview({
          status: "error",
          message:
            file.kind === "word"
              ? "旧版 .doc 文件暂不支持本地转换预览。请转为 .docx 后再导入为可编辑块。"
              : "旧版 .ppt 文件暂不支持本地转换预览。请转为 .pptx 后再导入为可编辑块。",
        });
        return;
      }

      setConvertedPreview({ status: "loading" });

      try {
        const body =
          file.kind === "spreadsheet"
            ? await convertSpreadsheetToHtml(file)
            : file.kind === "word"
              ? await convertWordToHtml(file)
              : file.kind === "presentation"
                ? await convertPresentationToHtml(file)
                : file.kind === "epub"
                  ? await convertEpubToHtml(await dataUrlToArrayBuffer(file.dataUrl))
                  : convertZipToHtml(await dataUrlToArrayBuffer(file.dataUrl));
        if (!active) return;
        setConvertedPreview({
          status: "ready",
          srcDoc: createPreviewDocument(body),
        });
      } catch (err) {
        if (!active) return;
        setConvertedPreview({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "这个文件无法生成预览。",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [file]);

  const canExpand =
    file?.kind === "html" ||
    file?.kind === "markdown" ||
    file?.kind === "opml" ||
    file?.kind === "rtf" ||
    file?.kind === "notebook" ||
    file?.kind === "spreadsheet" ||
    file?.kind === "word" ||
    file?.kind === "presentation" ||
    file?.kind === "epub" ||
    file?.kind === "archive";
  const heightClass = expanded ? "h-[720px]" : "h-[360px]";
  const externalResourceReceipt = useMemo(
    () =>
      buildHighRiskConfirmationReceipt({
        actionId: "external-resource-load",
        requiredPhrase: EXTERNAL_RESOURCE_CONFIRMATION_PHRASE,
        typedPhrase: externalResourcePhrase,
        scopeSummary: `HTML 文件预览块；大小 ${formatFileSize(
          attrs.size
        )}；外部资源当前${
          allowExternalResources ? "已允许" : "已阻止"
        }；不包含文件名；不包含 HTML 内容。`,
        riskSummary:
          "允许外部资源后，这个 HTML 报告可能请求文件中引用的远程图片、脚本、样式、frame、字体、媒体或网络端点。",
        destinationSummary:
          "HTML 文档引用的远程资源；这个本地 receipt 不列出具体 URL。",
      }),
    [allowExternalResources, attrs.size, externalResourcePhrase]
  );
  const bulkImportReceipt = useMemo(
    () =>
      buildHighRiskConfirmationReceipt({
        actionId: "bulk-import",
        requiredPhrase: BULK_IMPORT_CONFIRMATION_PHRASE,
        typedPhrase: bulkImportPhrase,
        scopeSummary: `表格文件预览块；最多导入 ${SPREADSHEET_DATABASE_ROW_LIMIT} 行；最多导入 ${SPREADSHEET_DATABASE_COLUMN_LIMIT} 列；大小 ${formatFileSize(
          attrs.size
        )}；不包含文件名；不包含单元格值。`,
        riskSummary:
          "批量表格导入会在明确确认后，根据表格数据创建一个新的本地数据库、本地字段和本地数据库行。",
        destinationSummary:
          "当前本地浏览器工作区；这个导入不会上传到云端或外部服务。",
      }),
    [attrs.size, bulkImportPhrase]
  );
  const fileStructure = useMemo(() => {
    if (!file) return null;
    return buildFilePreviewStructure({
      file,
      previewHtml: getStructurePreviewHtml(file, srcDoc, convertedPreview),
    });
  }, [convertedPreview, file, srcDoc]);

  const recordActionReceipt = (
    actionKind: FilePreviewActionKind,
    details: Partial<
      Pick<
        FilePreviewActionReceipt["action"],
        | "writes_page_content"
        | "creates_database"
        | "creates_database_rows"
        | "changes_preview_network_boundary"
        | "external_resources_allowed"
        | "confirmation_required"
        | "confirmation_matched"
        | "rows_written"
        | "fields_written"
        | "note"
      >
    > = {}
  ) => {
    if (!file) return null;

    const receipt = buildFilePreviewActionReceipt({
      file,
      action_kind: actionKind,
      writes_page_content: details.writes_page_content,
      creates_database: details.creates_database,
      creates_database_rows: details.creates_database_rows,
      changes_preview_network_boundary:
        details.changes_preview_network_boundary,
      external_resources_allowed: details.external_resources_allowed,
      confirmation_required: details.confirmation_required,
      confirmation_matched: details.confirmation_matched,
      rows_written: details.rows_written,
      fields_written: details.fields_written,
      note: details.note,
    });
    appendFilePreviewActionReceipt(receipt);
    setLastActionReceipt(receipt);
    return receipt;
  };

  const handleImportMarkdown = () => {
    if (!file || file.kind !== "markdown") return;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, markdownToHtml(file.textContent ?? ""))
      .run();
    recordActionReceipt("editable-import", {
      writes_page_content: true,
      note: "Markdown 已在本地转换，并插入到文件预览块之后。",
    });
  };

  const handleImportOpml = () => {
    if (!file || file.kind !== "opml") return;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, convertOpmlToHtml(file.textContent ?? ""))
      .run();
    recordActionReceipt("editable-import", {
      writes_page_content: true,
      note: "OPML 已在本地转换，并插入为可编辑大纲块。",
    });
  };

  const handleImportRtf = () => {
    if (!file || file.kind !== "rtf") return;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, convertRtfToHtml(file.textContent ?? ""))
      .run();
    recordActionReceipt("editable-import", {
      writes_page_content: true,
      note: "RTF 已在本地转换，并插入为可编辑文本块。",
    });
  };

  const handleImportNotebook = () => {
    if (!file || file.kind !== "notebook") return;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        pos + node.nodeSize,
        convertNotebookToHtml(file.textContent ?? "")
      )
      .run();
    recordActionReceipt("editable-import", {
      writes_page_content: true,
      note: "Notebook 单元格已在本地转换，并插入为可编辑块。",
    });
  };

  const handleImportText = () => {
    if (!file || file.kind !== "text") return;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        pos + node.nodeSize,
        renderTextFileAsCodeBlock(file.name, file.textContent ?? "")
      )
      .run();
    recordActionReceipt("editable-import", {
      writes_page_content: true,
      note: "文本文件已在本地插入为可编辑代码块。",
    });
  };

  const handleImportHtml = () => {
    if (!file || file.kind !== "html") return;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;

    const ok = window.confirm(
      "要把这个 HTML 导入为可编辑块吗？复杂报告布局、脚本和部分样式可能会丢失。原始预览块会保留。"
    );
    if (!ok) return;

    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, extractEditableHtml(file.textContent ?? ""))
      .run();
    recordActionReceipt("editable-import", {
      writes_page_content: true,
      confirmation_required: true,
      confirmation_matched: true,
      note: "HTML 已在本地清理，并在用户确认后插入为可编辑块。",
    });
  };

  const handleImportConverted = async () => {
    if (
      !file ||
      (file.kind !== "spreadsheet" &&
        file.kind !== "word" &&
        file.kind !== "presentation" &&
        file.kind !== "epub")
    ) {
      return;
    }
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;

    setImporting(true);
    try {
      const html =
        file.kind === "spreadsheet"
          ? await convertSpreadsheetToHtml(file)
          : file.kind === "word"
            ? await convertWordToHtml(file)
            : file.kind === "presentation"
              ? await convertPresentationToHtml(file)
              : await convertEpubToHtml(await dataUrlToArrayBuffer(file.dataUrl));
      editor.chain().focus().insertContentAt(pos + node.nodeSize, html).run();
      recordActionReceipt("editable-import", {
        writes_page_content: true,
        confirmation_required: true,
        confirmation_matched: true,
        note: `${getFileKindLabel(file.kind)} 已在本地转换，并插入为可编辑块。`,
      });
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "这个文件无法导入为可编辑内容。"
      );
    } finally {
      setImporting(false);
    }
  };

  const handleImportSpreadsheetDatabase = async () => {
    if (!file || file.kind !== "spreadsheet") return;

    if (!bulkImportReceipt.typed_phrase_matches) {
      window.alert(
        `请输入确认短语 ${BULK_IMPORT_CONFIRMATION_PHRASE} 后再批量导入为数据库。`
      );
      return;
    }

    setDatabaseImporting(true);
    try {
      const table = await readSpreadsheetTable(file);
      if (table.rows.length === 0) {
        window.alert(
          "这个表格没有可导入的数据行。第一个非空行会被当作表头。"
        );
        return;
      }

      const importedRows = table.rows.slice(0, SPREADSHEET_DATABASE_ROW_LIMIT);
      const ok = window.confirm(
        `要把这个表格批量导入为新数据库吗？将创建 1 个本地数据库、最多 ${table.headers.length} 个字段和 ${importedRows.length} 行。原始文件保留在本地，不会上传。`
      );
      if (!ok) return;

      const database = await createDatabase({
        title: spreadsheetDatabaseTitle(file.name),
      });
      const fields = await getFields(database.id);
      const nameField = fields[0];
      if (nameField) {
        await updateField(nameField.id, { name: table.headers[0] || "名称" });
      }

      const dataFields = [];
      for (let columnIndex = 1; columnIndex < table.headers.length; columnIndex += 1) {
        const values = importedRows.map((row) => stringifySpreadsheetCell(row[columnIndex]));
        const fieldType = inferSpreadsheetFieldType(values);
        const field = await addField(database.id, {
          name: table.headers[columnIndex],
          fieldType,
        });
        dataFields.push({ field, columnIndex, fieldType });
      }

      for (let rowIndex = 0; rowIndex < importedRows.length; rowIndex += 1) {
        const row = importedRows[rowIndex];
        const title = stringifySpreadsheetCell(row[0]).trim() || `第 ${rowIndex + 1} 行`;
        const fieldValues: Record<string, unknown> = {};

        for (const { field, columnIndex, fieldType } of dataFields) {
          const value = coerceSpreadsheetFieldValue(
            stringifySpreadsheetCell(row[columnIndex]),
            fieldType
          );
          if (value !== "" && value !== null) {
            fieldValues[field.id] = value;
          }
        }

        await addRow(database.id, { title, fieldValues });
      }

      if (table.rows.length > importedRows.length) {
        window.alert(
          `已把前 ${importedRows.length} 行导入到新数据库。还有 ${table.rows.length - importedRows.length} 行保留在原始文件预览中，避免页面卡住。`
        );
      }

      recordActionReceipt("database-import", {
        creates_database: true,
        creates_database_rows: true,
        confirmation_required: true,
        confirmation_matched: bulkImportReceipt.typed_phrase_matches,
        rows_written: importedRows.length,
        fields_written: table.headers.length,
        note: "表格行已在输入确认短语后导入到新的本地数据库。",
      });

      router.push(`/database/${database.id}`);
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "这个表格无法导入为数据库。"
      );
    } finally {
      setDatabaseImporting(false);
    }
  };

  const handleToggleExternalResources = () => {
    if (!allowExternalResources) {
      if (!externalResourceReceipt.typed_phrase_matches) {
        window.alert(
          `请输入确认短语 ${EXTERNAL_RESOURCE_CONFIRMATION_PHRASE} 后再开启外部资源。`
        );
        return;
      }

      const ok = window.confirm(
        "要允许这个 HTML 报告加载外部图片、脚本、样式和其他远程资源吗？这些请求可能访问互联网，只建议对可信文件开启。"
      );
      if (!ok) return;
    }
    const nextAllowExternalResources = !allowExternalResources;
    updateAttributes({ allowExternalResources: nextAllowExternalResources });
    recordActionReceipt(
      nextAllowExternalResources
        ? "external-resource-enable"
        : "external-resource-disable",
      {
        changes_preview_network_boundary: true,
        external_resources_allowed: nextAllowExternalResources,
        confirmation_required: nextAllowExternalResources,
        confirmation_matched: nextAllowExternalResources
          ? externalResourceReceipt.typed_phrase_matches
          : true,
        note: nextAllowExternalResources
          ? "HTML 预览已在输入确认短语后允许外部资源。"
          : "HTML 预览已在本地重新阻止外部资源。",
      }
    );
  };

  const handleRecordDownloadRetainReceipt = () => {
    if (!file) return;
    recordActionReceipt("download-retain", {
      writes_page_content: false,
      creates_database: false,
      creates_database_rows: false,
      confirmation_required: false,
      confirmation_matched: true,
      note:
        "文件已保留在本地，用于 metadata 或仅下载预览。没有运行转换、上传、云同步或 AI 动作。",
    });
  };

  const handleOpenFileRouteHub = () => {
    router.push("/modules/files#files-preview-routing");
  };

  const handleExportLastActionReceipt = () => {
    if (!lastActionReceipt) return;
    setExportingActionReceipt(true);
    try {
      downloadJsonFile(
        `zhinote-file-preview-action-receipt-${fileSafeTimestamp()}.json`,
        lastActionReceipt
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export file action receipt:", err);
      window.alert("文件动作 receipt 导出失败，请查看控制台。");
    } finally {
      setExportingActionReceipt(false);
    }
  };

  const handleExportExternalResourceReceipt = () => {
    setExportingExternalReceipt(true);
    try {
      downloadJsonFile(
        `zhinote-external-resource-confirmation-${fileSafeTimestamp()}.json`,
        {
          ...externalResourceReceipt,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export external resource confirmation:",
        err
      );
      window.alert(
        "外部资源确认导出失败，请查看控制台。"
      );
    } finally {
      setExportingExternalReceipt(false);
    }
  };

  const handleExportBulkImportReceipt = () => {
    setExportingBulkImportReceipt(true);
    try {
      downloadJsonFile(
        `zhinote-bulk-import-confirmation-${fileSafeTimestamp()}.json`,
        {
          ...bulkImportReceipt,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export bulk import confirmation:", err);
      window.alert(
        "Bulk import confirmation export failed. Please check the console."
      );
    } finally {
      setExportingBulkImportReceipt(false);
    }
  };

  return (
    <NodeViewWrapper className="my-4" data-type="file-preview">
      <div
        className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        contentEditable={false}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {getFileKindLabel(attrs.kind)}
          </span>
          <FilePreviewSupportPill level={supportLevel} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {attrs.fileName}
            </div>
            <div className="text-[11px] text-zinc-400">
              {attrs.mimeType || "未知类型"} · {formatFileSize(attrs.size)}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-400">
              {getPreviewNote(attrs.kind, attrs.fileName)}
            </div>
          </div>
          {file?.kind === "markdown" && (
            <button
              type="button"
              onClick={handleImportMarkdown}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              导入为可编辑块
            </button>
          )}
          {file?.kind === "opml" && (
            <button
              type="button"
              onClick={handleImportOpml}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              导入为可编辑块
            </button>
          )}
          {file?.kind === "rtf" && (
            <button
              type="button"
              onClick={handleImportRtf}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              导入为可编辑块
            </button>
          )}
          {file?.kind === "notebook" && (
            <button
              type="button"
              onClick={handleImportNotebook}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              导入为可编辑块
            </button>
          )}
          {file?.kind === "text" && (
            <button
              type="button"
              onClick={handleImportText}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              导入为可编辑块
            </button>
          )}
          {file?.kind === "html" && (
            <button
              type="button"
              onClick={handleImportHtml}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              导入为可编辑块
            </button>
          )}
          {(file?.kind === "spreadsheet" ||
            file?.kind === "word" ||
            file?.kind === "presentation" ||
            file?.kind === "epub") &&
            supportsEditableConvertedImport(file) && (
            <button
              type="button"
              onClick={handleImportConverted}
              disabled={importing}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {importing ? "正在导入..." : "导入为可编辑块"}
            </button>
          )}
          {file?.kind === "spreadsheet" && (
            <button
              type="button"
              onClick={handleImportSpreadsheetDatabase}
              disabled={databaseImporting}
              className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
            >
              {databaseImporting ? "正在创建..." : "导入为数据库"}
            </button>
          )}
          {file?.kind === "html" && (
            <button
              type="button"
              onClick={handleToggleExternalResources}
              className={`rounded border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                allowExternalResources
                  ? "border-amber-200 text-amber-600 hover:text-amber-700 dark:border-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                  : "border-zinc-200 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              title={
                allowExternalResources
                  ? "阻止这个 HTML 报告加载外部资源"
                  : "允许可信 HTML 报告加载外部资源"
              }
            >
              {allowExternalResources ? "外部资源已开" : "外部资源已关"}
            </button>
          )}
          {file && shouldShowDownloadRetainReceiptAction(file, supportLevel) && (
            <button
              type="button"
              onClick={handleRecordDownloadRetainReceipt}
              className="rounded border border-amber-200 px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950 dark:hover:text-amber-300"
            >
              记录留存 receipt
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenFileRouteHub}
            className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title="打开文件库里的原生预览、可编辑导入、表格入库和留存路线总控"
          >
            查看文件路线
          </button>
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {expanded ? "收起" : "展开"}
            </button>
          )}
          {file?.dataUrl && (
            <a
              href={file.dataUrl}
              download={file.name}
              rel="noreferrer"
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 no-underline hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              下载
            </a>
          )}
        </div>

        <FilePreviewCapabilityStrip
          capability={capability}
          kind={attrs.kind}
          fileName={attrs.fileName}
          supportLevel={supportLevel}
        />

        {fileStructure && (
          <FilePreviewStructureStrip structure={fileStructure} />
        )}

        {attrs.kind === "spreadsheet" && (
          <div className="border-b border-blue-100 bg-blue-50/70 px-3 py-3 dark:border-blue-950 dark:bg-blue-950/30">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`bulk-import-phrase-${attrs.fileId}`}
                  className="text-xs font-semibold text-blue-900 dark:text-blue-200"
                >
                  批量导入确认短语
                </label>
                <input
                  id={`bulk-import-phrase-${attrs.fileId}`}
                  value={bulkImportPhrase}
                  onChange={(event) => setBulkImportPhrase(event.target.value)}
                  placeholder={BULK_IMPORT_CONFIRMATION_PHRASE}
                  className="mt-1 w-full rounded-md border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 dark:border-blue-900 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <button
                type="button"
                onClick={handleExportBulkImportReceipt}
                disabled={exportingBulkImportReceipt}
                className="w-fit rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-blue-900 dark:bg-zinc-950 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                {exportingBulkImportReceipt
                  ? "导出中..."
                  : "导出导入 receipt"}
              </button>
            </div>
            <div className="mt-2 grid gap-2 text-[11px] leading-5 text-blue-800 dark:text-blue-200 md:grid-cols-3">
              <span>
                短语匹配：{bulkImportReceipt.typed_phrase_matches ? "是" : "否"}
              </span>
              <span>
                限制：最多 {SPREADSHEET_DATABASE_ROW_LIMIT} 行、{" "}
                {SPREADSHEET_DATABASE_COLUMN_LIMIT} 列
              </span>
              <span>receipt 不含表格单元格值或文件 bytes。</span>
            </div>
          </div>
        )}

        {attrs.kind === "html" && (
          <div className="border-b border-amber-100 bg-amber-50/70 px-3 py-3 dark:border-amber-950 dark:bg-amber-950/30">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`external-resource-phrase-${attrs.fileId}`}
                  className="text-xs font-semibold text-amber-900 dark:text-amber-200"
                >
                  外部资源确认短语
                </label>
                <input
                  id={`external-resource-phrase-${attrs.fileId}`}
                  value={externalResourcePhrase}
                  onChange={(event) =>
                    setExternalResourcePhrase(event.target.value)
                  }
                  placeholder={EXTERNAL_RESOURCE_CONFIRMATION_PHRASE}
                  className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-amber-500 dark:border-amber-900 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <button
                type="button"
                onClick={handleExportExternalResourceReceipt}
                disabled={exportingExternalReceipt}
                className="w-fit rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60 dark:border-amber-900 dark:bg-zinc-950 dark:text-amber-300 dark:hover:bg-amber-950"
              >
                {exportingExternalReceipt
                  ? "导出中..."
                  : "导出资源 receipt"}
              </button>
            </div>
            <div className="mt-2 grid gap-2 text-[11px] leading-5 text-amber-800 dark:text-amber-200 md:grid-cols-3">
              <span>
                短语匹配：{externalResourceReceipt.typed_phrase_matches ? "是" : "否"}
              </span>
              <span>
                当前状态：{allowExternalResources ? "已允许外部资源" : "默认阻止"}
              </span>
              <span>receipt 不含报告文本、URL、token 或文件 bytes。</span>
            </div>
          </div>
        )}

        {lastActionReceipt && (
          <div className="border-b border-emerald-100 bg-emerald-50/70 px-3 py-3 dark:border-emerald-950 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  最近文件动作 receipt
                </div>
                <p className="mt-1 text-[11px] leading-5 text-emerald-800 dark:text-emerald-200">
                  {getFilePreviewActionLabel(lastActionReceipt.action_kind)} ·{" "}
                  {formatFileActionReceiptTime(lastActionReceipt.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportLastActionReceipt}
                disabled={exportingActionReceipt}
                className="w-fit rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-900 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950"
              >
                {exportingActionReceipt ? "导出中..." : "导出动作 receipt"}
              </button>
            </div>
            <div className="mt-2 grid gap-2 text-[11px] leading-5 text-emerald-800 dark:text-emerald-200 md:grid-cols-4">
              <span>格式：{getFileKindLabel(lastActionReceipt.file.kind)}</span>
              <span>大小：{lastActionReceipt.file.size_label}</span>
              <span>
                本地写入：{" "}
                {lastActionReceipt.boundary.action_may_write_local_workspace_data
                  ? "是"
                  : "否"}
              </span>
              <span>不含文件名、正文、bytes 或表格值。</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex h-32 items-center justify-center text-sm text-zinc-400">
            正在加载文件...
          </div>
        )}

        {!loading && !file && (
          <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
            文件内容不在本地存储中。请重新上传文件以恢复这个预览。
          </div>
        )}

        {!loading && file && (
          <FilePreviewBody
            file={file}
            srcDoc={srcDoc}
            convertedPreview={convertedPreview}
            heightClass={heightClass}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

function FilePreviewCapabilityStrip({
  capability,
  kind,
  fileName,
  supportLevel,
}: {
  capability: FilePreviewCapability | undefined;
  kind: PageFileKind;
  fileName: string;
  supportLevel: FilePreviewSupportLevel;
}) {
  const isLegacyFallback = isLegacyPreviewFallback(kind, fileName);
  const previewRoute = isLegacyFallback
    ? "旧版 Office 文件暂不转换预览；原文件保留在本地，可下载后处理。"
    : capability?.preview ?? "这个格式当前仅保留本地附件和下载入口。";
  const importRoute = isLegacyFallback
    ? "请先转为 .docx 或 .pptx，再作为可编辑块导入。"
    : capability?.editable_import ?? "暂不支持转换为可编辑块。";
  const privacyRoute =
    capability?.privacy_boundary ??
    "文件保存在浏览器本地存储；当前不上传、不调用 AI、不连接云服务。";

  return (
    <div className="border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="grid gap-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400 lg:grid-cols-3">
        <CapabilityRouteItem label="预览路径" value={previewRoute} />
        <CapabilityRouteItem label="转换/导入" value={importRoute} />
        <CapabilityRouteItem
          label="隐私边界"
          value={privacyRoute}
          suffix={getSupportLevelLabel(supportLevel)}
        />
      </div>
    </div>
  );
}

function CapabilityRouteItem({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="min-w-0">
      <span className="font-semibold text-zinc-700 dark:text-zinc-200">
        {label}：
      </span>
      <span>{value}</span>
      {suffix && (
        <span className="ml-1 text-zinc-400 dark:text-zinc-500">
          {suffix}
        </span>
      )}
    </div>
  );
}

function FilePreviewStructureStrip({
  structure,
}: {
  structure: FilePreviewStructureReport;
}) {
  return (
    <div className="border-b border-zinc-100 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              文档结构
            </span>
            <FilePreviewStructureStatusPill status={structure.structure_status} />
            <span className="text-[11px] text-zinc-400">
              {structure.summary.words} words · {structure.summary.lines} lines
            </span>
          </div>
          {structure.outline.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {structure.outline.map((item) => (
                <span
                  key={item.id}
                  className="max-w-full truncate rounded bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  title={item.title}
                >
                  H{item.level} {item.title}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] leading-5 text-zinc-400">
              暂未识别标题。可以继续使用原生预览，或导入后补目录/章节结构。
            </p>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
          {structure.signals.slice(0, 6).map((signal) => (
            <FilePreviewStructureSignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] leading-5 text-zinc-400 dark:border-zinc-800">
        {structure.privacy_note}
      </p>
    </div>
  );
}

function FilePreviewStructureSignalCard({
  signal,
}: {
  signal: FilePreviewStructureSignal;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-300">
          {signal.label}
        </span>
        <FilePreviewStructureSignalPill status={signal.status} />
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {signal.value}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-zinc-400">
        {signal.detail}
      </p>
    </div>
  );
}

function FilePreviewStructureStatusPill({
  status,
}: {
  status: FilePreviewStructureStatus;
}) {
  const labels: Record<FilePreviewStructureStatus, string> = {
    ready: "Ready",
    "converted-preview": "Converted",
    "metadata-only": "Metadata",
    unsupported: "Unsupported",
  };
  const className =
    status === "ready"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "converted-preview"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "metadata-only"
          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[status]}
    </span>
  );
}

function FilePreviewStructureSignalPill({
  status,
}: {
  status: FilePreviewStructureSignal["status"];
}) {
  const labels: Record<FilePreviewStructureSignal["status"], string> = {
    ready: "Ready",
    review: "Review",
    empty: "Empty",
  };
  const className =
    status === "ready"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "review"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function FilePreviewSupportPill({
  level,
}: {
  level: FilePreviewSupportLevel;
}) {
  const labels: Record<FilePreviewSupportLevel, string> = {
    native: "原生预览",
    converted: "本地转换",
    metadata: "元数据",
    "download-only": "仅下载",
  };
  const className =
    level === "native"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : level === "converted"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : level === "metadata"
          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`rounded px-2 py-1 text-[11px] font-medium ${className}`}>
      {labels[level]}
    </span>
  );
}

function getEffectivePreviewSupportLevel(
  kind: PageFileKind,
  fileName: string,
  capability: FilePreviewCapability | undefined
): FilePreviewSupportLevel {
  if (isLegacyPreviewFallback(kind, fileName) || kind === "unknown") {
    return "download-only";
  }
  return capability?.support_level ?? "download-only";
}

function getSupportLevelLabel(level: FilePreviewSupportLevel) {
  const labels: Record<FilePreviewSupportLevel, string> = {
    native: "native",
    converted: "converted",
    metadata: "metadata",
    "download-only": "download-only",
  };
  return labels[level];
}

function isLegacyPreviewFallback(kind: PageFileKind, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    (kind === "word" && lowerName.endsWith(".doc")) ||
    (kind === "presentation" && lowerName.endsWith(".ppt"))
  );
}

function getPreviewNote(kind: PageFileKind, fileName = "") {
  const lowerName = fileName.toLowerCase();
  switch (kind) {
    case "html":
      return "沙盒报告预览；默认阻止外部资源";
    case "markdown":
      return "在页面内预览；可导入为可编辑块";
    case "opml":
      return "大纲预览；可导入为可编辑列表";
    case "rtf":
      return "RTF 转换预览；可导入为可编辑块";
    case "notebook":
      return "Notebook 单元格预览；可导入为可编辑块";
    case "pdf":
      return "浏览器原生 PDF 预览";
    case "spreadsheet":
      return "表格转换预览；原文件保留在本地";
    case "word":
      if (lowerName.endsWith(".doc")) {
        return "旧版 Word 已本地保存；暂不转换预览";
      }
      return "Word 转换预览；原文件保留在本地";
    case "presentation":
      if (lowerName.endsWith(".ppt")) {
        return "旧版 PPT 已本地保存；暂不转换预览";
      }
      return "PPT 文本转换预览；原文件保留在本地";
    case "epub":
      return "EPUB 章节转换预览；原文件保留在本地";
    case "archive":
      return "ZIP 内容预览；原文件保留在本地";
    case "image":
      return "图片原生预览";
    case "audio":
      return "浏览器原生音频预览";
    case "video":
      return "浏览器原生视频预览";
    case "text":
      return "纯文本预览";
    default:
      return "已本地保存；暂未提供原生渲染器";
  }
}

function isLegacyOfficeFile(file: StoredPageFile) {
  return isLegacyPreviewFallback(file.kind, file.name);
}

function supportsEditableConvertedImport(file: StoredPageFile) {
  return !isLegacyOfficeFile(file);
}

function shouldShowDownloadRetainReceiptAction(
  file: StoredPageFile,
  supportLevel: FilePreviewSupportLevel
) {
  return (
    supportLevel === "download-only" ||
    supportLevel === "metadata" ||
    file.kind === "archive" ||
    isLegacyOfficeFile(file)
  );
}

function getStructurePreviewHtml(
  file: StoredPageFile,
  srcDoc: string,
  convertedPreview: ConvertedPreview
) {
  if (
    file.kind === "html" ||
    file.kind === "markdown" ||
    file.kind === "opml" ||
    file.kind === "rtf" ||
    file.kind === "notebook"
  ) {
    return srcDoc;
  }

  if (convertedPreview.status === "ready") {
    return convertedPreview.srcDoc;
  }

  if (file.kind === "text") {
    return createPreviewDocument(renderTextFileAsCodeBlock(file.name, file.textContent ?? ""));
  }

  return undefined;
}

function getFileKindLabel(kind: PageFileKind) {
  return FILE_KIND_LABELS[kind] ?? kind;
}

function getFilePreviewActionLabel(actionKind: FilePreviewActionKind) {
  const labels: Record<FilePreviewActionKind, string> = {
    "native-preview": "本地原生预览",
    "download-retain": "本地留存下载",
    "editable-import": "导入为可编辑块",
    "database-import": "导入为数据库",
    "external-resource-enable": "开启 HTML 外部资源",
    "external-resource-disable": "关闭 HTML 外部资源",
  };
  return labels[actionKind];
}

function formatFileActionReceiptTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FilePreviewBody({
  file,
  srcDoc,
  convertedPreview,
  heightClass,
}: {
  file: StoredPageFile;
  srcDoc: string;
  convertedPreview: ConvertedPreview;
  heightClass: string;
}) {
  if (
    file.kind === "html" ||
    file.kind === "markdown" ||
    file.kind === "opml" ||
    file.kind === "rtf" ||
    file.kind === "notebook"
  ) {
    return (
      <iframe
        title={file.name}
        srcDoc={srcDoc}
        sandbox="allow-forms allow-popups allow-scripts"
        className={`block w-full border-0 bg-white ${heightClass}`}
      />
    );
  }

  if (file.kind === "pdf") {
    return (
      <iframe
        title={file.name}
        src={file.dataUrl}
        className="block h-[640px] w-full border-0 bg-zinc-50 dark:bg-zinc-950"
      />
    );
  }

  if (file.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.dataUrl}
        alt={file.name}
        className="block max-h-[720px] w-full object-contain bg-zinc-50 dark:bg-zinc-950"
      />
    );
  }

  if (file.kind === "audio") {
    return (
      <div className="bg-zinc-50 p-4 dark:bg-zinc-950">
        <audio controls src={file.dataUrl} className="w-full">
          当前浏览器无法播放这个音频文件。
        </audio>
      </div>
    );
  }

  if (file.kind === "video") {
    return (
      <video
        controls
        src={file.dataUrl}
        className="block max-h-[720px] w-full bg-black"
      >
        当前浏览器无法播放这个视频文件。
      </video>
    );
  }

  if (file.kind === "text") {
    return <TextFilePreview file={file} />;
  }

  if (
    file.kind === "spreadsheet" ||
    file.kind === "word" ||
    file.kind === "presentation" ||
    file.kind === "epub" ||
    file.kind === "archive"
  ) {
    if (convertedPreview.status === "loading" || convertedPreview.status === "idle") {
      return (
        <div className="flex h-32 items-center justify-center text-sm text-zinc-400">
          正在生成预览...
        </div>
      );
    }

    if (convertedPreview.status === "ready") {
      return (
        <iframe
          title={file.name}
          srcDoc={convertedPreview.srcDoc}
          sandbox="allow-popups"
          className={`block w-full border-0 bg-white ${heightClass}`}
        />
      );
    }

    if (convertedPreview.status === "error") {
      return (
        <div className="p-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {convertedPreview.message} 文件仍保存在本地，可从这个块下载。
        </div>
      );
    }
  }

  return (
    <div className="p-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      {file.kind === "unknown" &&
        "这个文件已保存在本地，但 ZhiNotes 暂时还没有对应的原生渲染器。"}
    </div>
  );
}

function TextFilePreview({ file }: { file: StoredPageFile }) {
  const language = getTextFileLanguage(file.name);
  const highlightedHtml = useMemo(
    () => highlightCodeToHtml(file.textContent ?? "", language),
    [file.textContent, language]
  );

  return (
    <pre className="max-h-[520px] overflow-auto bg-zinc-50 p-4 text-sm leading-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <code
        className={language ? `language-${language}` : undefined}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </pre>
  );
}

function normalizeHtmlDocument(html: string, blockExternalResources = true) {
  if (/<html[\s>]/i.test(html) || /<!doctype/i.test(html)) {
    return blockExternalResources ? injectPreviewCsp(html) : html;
  }
  return createPreviewDocument(html, blockExternalResources);
}

function extractEditableHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll("script, style, link, meta, iframe, object, embed")
    .forEach((node) => node.remove());
  sanitizeEditableHtml(doc.body);
  const body = doc.body.innerHTML.trim();
  return body || escapeHtml(html);
}

function sanitizeEditableHtml(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith("on") || name === "srcdoc" || name === "style") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "href" || name === "xlink:href") {
        if (!isSafeEditableLink(value)) element.removeAttribute(attribute.name);
        continue;
      }

      if (
        name === "src" ||
        name === "poster" ||
        name === "action" ||
        name === "formaction" ||
        name === "srcset"
      ) {
        if (!isSafeEditableResource(value)) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  });
}

function isSafeEditableLink(value: string) {
  return /^(https?:|mailto:|#|\/)/i.test(value);
}

function isSafeEditableResource(value: string) {
  return /^(data:|blob:|#|\/)/i.test(value);
}

function convertOpmlToHtml(opml: string) {
  const doc = new DOMParser().parseFromString(opml, "application/xml");
  if (doc.querySelector("parsererror")) {
    return `<p>这个 OPML 文件无法解析。</p><pre><code>${escapeHtml(
      opml
    )}</code></pre>`;
  }

  const title =
    doc.querySelector("head > title")?.textContent?.trim() ||
    doc.querySelector("title")?.textContent?.trim();
  const outlineNodes = Array.from(
    doc.querySelectorAll("body > outline, opml > body > outline")
  );

  if (outlineNodes.length === 0) {
    return `<p>这个 OPML 文件不包含大纲条目。</p>`;
  }

  return `${title ? `<h2>${escapeHtml(title)}</h2>` : ""}<ul>${outlineNodes
    .map(renderOpmlOutline)
    .join("")}</ul>`;
}

function renderOpmlOutline(node: Element): string {
  const text =
    node.getAttribute("text") ||
    node.getAttribute("title") ||
    node.textContent?.trim() ||
    "未命名";
  const childOutlines = Array.from(node.children).filter(
    (child) => child.tagName.toLowerCase() === "outline"
  );
  const children = childOutlines.length
    ? `<ul>${childOutlines.map(renderOpmlOutline).join("")}</ul>`
    : "";

  return `<li>${escapeHtml(text)}${children}</li>`;
}

function renderTextFileAsCodeBlock(fileName: string, text: string) {
  const language = getTextFileLanguage(fileName);
  const languageClass = language ? ` class="language-${language}"` : "";
  return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>`;
}

function getTextFileLanguage(fileName: string) {
  const lowerName = fileName.toLowerCase();
  const baseName = lowerName.split(/[\\/]/).pop() ?? lowerName;
  if (
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".jsonl") ||
    lowerName.endsWith(".ipynb")
  ) {
    return "json";
  }
  if (
    lowerName.endsWith(".xml") ||
    lowerName.endsWith(".xbrl") ||
    lowerName.endsWith(".xsd") ||
    lowerName.endsWith(".xsl") ||
    lowerName.endsWith(".xslt")
  ) {
    return "xml";
  }
  if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) return "yaml";
  if (lowerName.endsWith(".toml")) return "toml";
  if (
    lowerName.endsWith(".ini") ||
    lowerName.endsWith(".conf") ||
    lowerName.endsWith(".properties") ||
    lowerName.endsWith(".env") ||
    baseName.startsWith(".env.")
  ) {
    return "ini";
  }
  if (
    lowerName.endsWith(".log") ||
    lowerName.endsWith(".lock") ||
    lowerName.endsWith(".srt") ||
    lowerName.endsWith(".vtt") ||
    lowerName.endsWith(".webvtt") ||
    lowerName.endsWith(".sbv") ||
    lowerName.endsWith(".lrc") ||
    lowerName.endsWith(".ttml")
  ) {
    return "log";
  }
  if (lowerName.endsWith(".tex")) return "latex";
  if (lowerName.endsWith(".bib")) return "bibtex";
  if (lowerName.endsWith(".ris")) return "ris";
  if (lowerName.endsWith(".rst") || lowerName.endsWith(".adoc")) {
    return "markdown";
  }
  if (lowerName.endsWith(".asciidoc") || lowerName.endsWith(".org")) {
    return "markdown";
  }
  if (lowerName.endsWith(".mmd") || lowerName.endsWith(".mermaid")) {
    return "mermaid";
  }
  if (lowerName.endsWith(".do")) return "stata";
  if (lowerName.endsWith(".sas")) return "sas";
  if (lowerName.endsWith(".jl")) return "julia";
  if (
    lowerName.endsWith(".js") ||
    lowerName.endsWith(".jsx") ||
    lowerName.endsWith(".mjs") ||
    lowerName.endsWith(".cjs")
  ) {
    return "javascript";
  }
  if (
    lowerName.endsWith(".ts") ||
    lowerName.endsWith(".tsx") ||
    lowerName.endsWith(".mts") ||
    lowerName.endsWith(".cts")
  ) {
    return "typescript";
  }
  if (
    lowerName.endsWith(".css") ||
    lowerName.endsWith(".scss") ||
    lowerName.endsWith(".less")
  ) {
    return "css";
  }
  if (lowerName.endsWith(".vue") || lowerName.endsWith(".svelte")) return "html";
  if (lowerName.endsWith(".sql")) return "sql";
  if (lowerName.endsWith(".graphql") || lowerName.endsWith(".gql")) return "graphql";
  if (lowerName.endsWith(".py")) return "python";
  if (lowerName.endsWith(".r")) return "r";
  if (
    lowerName.endsWith(".sh") ||
    lowerName.endsWith(".bash") ||
    lowerName.endsWith(".zsh")
  ) {
    return "bash";
  }
  if (lowerName.endsWith(".java")) return "java";
  if (
    lowerName.endsWith(".c") ||
    lowerName.endsWith(".cpp") ||
    lowerName.endsWith(".h") ||
    lowerName.endsWith(".hpp")
  ) {
    return "cpp";
  }
  if (lowerName.endsWith(".go")) return "go";
  if (lowerName.endsWith(".rs")) return "rust";
  if (lowerName.endsWith(".php")) return "php";
  if (lowerName.endsWith(".rb")) return "ruby";
  if (lowerName.endsWith(".swift")) return "swift";
  if (lowerName.endsWith(".kt") || lowerName.endsWith(".kts")) return "kotlin";
  if (lowerName.endsWith(".dart")) return "dart";
  if (lowerName.endsWith(".lua")) return "lua";
  if (lowerName.endsWith(".pl") || lowerName.endsWith(".pm")) return "perl";
  if (lowerName.endsWith(".proto")) return "protobuf";
  if (lowerName.endsWith(".gradle")) return "groovy";
  if (baseName === "dockerfile" || baseName.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  if (baseName === "makefile") return "makefile";
  return "";
}

function createPreviewDocument(body: string, blockExternalResources = true) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${blockExternalResources ? previewCspMeta() : ""}
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      padding: 24px;
      color: #18181b;
      background: #ffffff;
      font: 14px/1.65 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    h1, h2, h3 { line-height: 1.25; margin: 1.1em 0 0.45em; }
    h1 { font-size: 28px; }
    h2 { font-size: 22px; }
    h3 { font-size: 18px; }
    p, ul, ol, blockquote, pre, table { margin: 0.7em 0; }
    a { color: #2563eb; }
    blockquote { border-left: 3px solid #d4d4d8; color: #52525b; padding-left: 12px; }
    code { background: #f4f4f5; border-radius: 4px; padding: 2px 4px; }
    pre { background: #f4f4f5; border-radius: 8px; overflow: auto; padding: 12px; }
    pre code { background: transparent; padding: 0; }
    [data-type="inline-equation"] {
      background: #f4f4f5;
      border: 1px solid #e4e4e7;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      padding: 1px 5px;
    }
    [data-type="wiki-reference"] {
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 4px;
      color: #1d4ed8;
      font-weight: 600;
      padding: 1px 5px;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; }
    th { background: #f4f4f5; }
    img, svg, canvas, video { max-width: 100%; }
    [data-type="toggle-block"],
    [data-type="callout-block"],
    [data-type="equation-block"] {
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      margin: 14px 0;
      padding: 12px;
    }
    [data-type="toggle-block"] {
      border-color: transparent;
      padding: 4px 0;
    }
    [data-toggle-summary] {
      font-weight: 700;
      margin-bottom: 6px;
    }
    [data-toggle-summary]::before {
      content: "> ";
      color: #71717a;
    }
    [data-toggle-content] {
      border-left: 2px solid #e4e4e7;
      margin-left: 12px;
      padding-left: 14px;
    }
    [data-type="callout-block"] {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e3a8a;
      position: relative;
    }
    [data-type="callout-block"]::before {
      content: attr(data-icon);
      float: left;
      font-weight: 700;
      margin-right: 10px;
      min-width: 18px;
      text-align: center;
    }
    [data-type="callout-block"][data-tone="neutral"] {
      background: #f4f4f5;
      border-color: #d4d4d8;
      color: #3f3f46;
    }
    [data-type="callout-block"][data-tone="yellow"] {
      background: #fefce8;
      border-color: #fde68a;
      color: #854d0e;
    }
    [data-type="callout-block"][data-tone="green"] {
      background: #f0fdf4;
      border-color: #bbf7d0;
      color: #166534;
    }
    [data-type="callout-block"][data-tone="red"] {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }
    [data-type="equation-block"] {
      background: #fafafa;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      overflow-x: auto;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function injectPreviewCsp(html: string) {
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n  ${previewCspMeta()}`);
  }

  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>${previewCspMeta()}</head>`);
  }

  return `${previewCspMeta()}${html}`;
}

function previewCspMeta() {
  return `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}" />`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function convertSpreadsheetToHtml(file: StoredPageFile) {
  const XLSX = await import("xlsx");
  const { input, options } = await getSpreadsheetInput(file);
  const workbook = XLSX.read(input, {
    type: typeof input === "string" ? "string" : "array",
    ...options,
  });

  if (workbook.SheetNames.length === 0) {
    return "<p>这个表格文件没有工作表。</p>";
  }

  const renderedSheets = workbook.SheetNames.slice(0, 5).map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(
      worksheet,
      {
        header: 1,
        blankrows: false,
        raw: false,
      }
    );
    const visibleRows = rows.slice(0, 200);
    const visibleColumnCount = Math.max(
      1,
      Math.min(
        50,
        visibleRows.reduce((max, row) => Math.max(max, row.length), 0)
      )
    );

    if (visibleRows.length === 0) {
      return `<section><h2>${escapeHtml(sheetName)}</h2><p>这个工作表为空。</p></section>`;
    }

    const headerRow = visibleRows[0] ?? [];
    const bodyRows = visibleRows.slice(1);
    const headerCells = Array.from({ length: visibleColumnCount }, (_value, index) => {
      const value = String(headerRow[index] ?? "").trim() || `列 ${index + 1}`;
      return `<th scope="col">${escapeHtml(value)}</th>`;
    }).join("");
    const tableRows =
      bodyRows.length > 0
        ? bodyRows
            .map((row) => {
              const cells = Array.from(
                { length: visibleColumnCount },
                (_value, index) => `<td>${escapeHtml(String(row[index] ?? ""))}</td>`
              ).join("");
              return `<tr>${cells}</tr>`;
            })
            .join("")
        : `<tr><td colspan="${visibleColumnCount}">这个工作表没有数据行。</td></tr>`;
    const summary = `<p><small>工作表预览：共 ${rows.length} 行，显示 ${visibleRows.length} 行、${visibleColumnCount} 列。</small></p>`;

    const truncated =
      rows.length > visibleRows.length
        ? `<p><small>仅显示前 ${visibleRows.length} 行。</small></p>`
        : "";

    return `<section><h2>${escapeHtml(sheetName)}</h2>${summary}${truncated}<table><thead>${headerCells}</thead><tbody>${tableRows}</tbody></table></section>`;
  });

  const sheetNotice =
    workbook.SheetNames.length > 5
      ? `<p><small>仅显示 ${workbook.SheetNames.length} 个工作表中的前 5 个。</small></p>`
      : "";

  return `${sheetNotice}${renderedSheets.join("\n")}`;
}

async function readSpreadsheetTable(file: StoredPageFile) {
  const XLSX = await import("xlsx");
  const { input, options } = await getSpreadsheetInput(file);
  const workbook = XLSX.read(input, {
    type: typeof input === "string" ? "string" : "array",
    ...options,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("这个表格文件没有可导入的工作表。");
  }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<SpreadsheetCell>>(worksheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: "",
    });
    const normalizedRows = rows
      .map((row) => row.map(normalizeSpreadsheetCell))
      .filter((row) => row.some((cell) => stringifySpreadsheetCell(cell).trim()));

    if (normalizedRows.length === 0) continue;

    const columnCount = Math.min(
      SPREADSHEET_DATABASE_COLUMN_LIMIT,
      normalizedRows.reduce((max, row) => Math.max(max, row.length), 0)
    );
    const headers = dedupeSpreadsheetHeaders(
      Array.from({ length: columnCount }, (_value, index) => {
        const header = stringifySpreadsheetCell(normalizedRows[0][index]).trim();
        return header || `列 ${index + 1}`;
      })
    );
    const dataRows = normalizedRows
      .slice(1)
      .map((row) =>
        Array.from({ length: columnCount }, (_value, index) =>
          normalizeSpreadsheetCell(row[index] ?? "")
        )
      )
      .filter((row) => row.some((cell) => stringifySpreadsheetCell(cell).trim()));

    return { sheetName, headers, rows: dataRows };
  }

  throw new Error("这个表格文件不包含可见行。");
}

async function getSpreadsheetInput(file: StoredPageFile) {
  const lowerName = file.name.toLowerCase();
  if (
    (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) &&
    file.textContent
  ) {
    return {
      input: file.textContent,
      options: lowerName.endsWith(".tsv") ? { FS: "\t" } : {},
    };
  }

  return { input: await dataUrlToArrayBuffer(file.dataUrl), options: {} };
}

function normalizeSpreadsheetCell(value: unknown): SpreadsheetCell {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function stringifySpreadsheetCell(value: SpreadsheetCell | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function dedupeSpreadsheetHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `列 ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function inferSpreadsheetFieldType(values: string[]): SpreadsheetFieldType {
  const nonEmpty = values.map((value) => value.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every(isBooleanValue)) return "checkbox";
  if (nonEmpty.every(isIsoDateValue)) return "date";
  if (nonEmpty.every(isNumberValue)) return "number";
  if (nonEmpty.every(isUrlValue)) return "url";
  return "text";
}

function coerceSpreadsheetFieldValue(value: string, fieldType: SpreadsheetFieldType) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (fieldType === "checkbox") return parseBooleanValue(trimmed);
  if (fieldType === "date") return normalizeDateValue(trimmed);
  if (fieldType === "number") return Number(trimmed.replace(/,/g, ""));

  return trimmed;
}

function isBooleanValue(value: string) {
  return /^(true|false|yes|no|y|n|1|0)$/i.test(value.trim());
}

function parseBooleanValue(value: string) {
  return /^(true|yes|y|1)$/i.test(value.trim());
}

function isIsoDateValue(value: string) {
  return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value.trim());
}

function normalizeDateValue(value: string) {
  const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isNumberValue(value: string) {
  return /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(value.trim());
}

function isUrlValue(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function spreadsheetDatabaseTitle(fileName: string) {
  const title = fileName.replace(/\.[^.]+$/, "").trim();
  return title ? `${title} 数据库` : "导入的表格数据库";
}

async function convertWordToHtml(file: StoredPageFile) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".doc")) {
    throw new Error("暂不支持旧版 .doc 文件。请使用 .docx。");
  }

  if (lowerName.endsWith(".odt")) {
    return convertOdtToHtml(await dataUrlToArrayBuffer(file.dataUrl));
  }

  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({
    arrayBuffer: await dataUrlToArrayBuffer(file.dataUrl),
  });

  if (!result.value.trim()) {
    return "<p>这个 Word 文档没有生成可见内容。</p>";
  }

  return result.value;
}

async function convertPresentationToHtml(file: StoredPageFile) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".ppt")) {
    throw new Error("暂不支持旧版 .ppt 文件。请使用 .pptx。");
  }

  if (lowerName.endsWith(".odp")) {
    return convertOdpToHtml(await dataUrlToArrayBuffer(file.dataUrl));
  }

  if (!lowerName.endsWith(".pptx")) {
    throw new Error("暂不支持这个演示文稿格式。");
  }

  return convertPptxToHtml(await dataUrlToArrayBuffer(file.dataUrl));
}

function downloadJsonFile(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    filePreview: {
      insertFilePreview: (attrs: FilePreviewAttrs) => ReturnType;
    };
  }
}

export const FilePreviewNode = Node.create({
  name: "filePreview",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      fileId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-file-id"),
        renderHTML: (attributes) => ({ "data-file-id": attributes.fileId }),
      },
      fileName: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-file-name"),
        renderHTML: (attributes) => ({ "data-file-name": attributes.fileName }),
      },
      mimeType: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mime-type"),
        renderHTML: (attributes) => ({ "data-mime-type": attributes.mimeType }),
      },
      kind: {
        default: "unknown",
        parseHTML: (element) => element.getAttribute("data-kind"),
        renderHTML: (attributes) => ({ "data-kind": attributes.kind }),
      },
      size: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-size") ?? 0),
        renderHTML: (attributes) => ({ "data-size": attributes.size }),
      },
      allowExternalResources: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute("data-allow-external-resources") === "true",
        renderHTML: (attributes) => ({
          "data-allow-external-resources": String(
            Boolean(attributes.allowExternalResources)
          ),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-preview"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-preview" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FilePreviewComponent);
  },

  addCommands() {
    return {
      insertFilePreview:
        (attrs: FilePreviewAttrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run(),
    };
  },
});
