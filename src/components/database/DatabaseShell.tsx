"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ChangeEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePages } from "@/hooks/usePages";
import {
  getDatabase,
  getFields,
  getRows,
  getViews,
  addField,
  addRow,
  updateRow,
  deleteRow,
  deleteField,
  updateField,
  addView,
  updateView,
  updateDatabase,
} from "@/lib/db/local/queries";
import type { Database, DatabaseField, DatabaseRow, DatabaseView } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import {
  exportDatabaseAsCsv,
  exportDatabaseAsXlsx,
} from "@/lib/export/databaseExport";
import { NOTE_TEMPLATES, type NoteTemplate } from "@/lib/templates/noteTemplates";
import TableView from "./views/TableView";
import ListView from "./views/ListView";
import KanbanView from "./views/KanbanView";
import CalendarView from "./views/CalendarView";
import GalleryView from "./views/GalleryView";
import TimelineView from "./views/TimelineView";
import ChartView from "./views/ChartView";
import FormView from "./views/FormView";
import FeedView from "./views/FeedView";
import {
  normalizeRelationValue,
  stringifyRelationValue,
} from "@/lib/database/relationValues";
import {
  classifyResearchPage,
  getResearchAssetKindLabel,
  getResearchRelationFieldLabel,
  inferResearchKindFromRelationField,
} from "@/lib/modules/researchGraph";
import {
  getDatabaseFieldDisplayName,
  getDatabaseFieldTypeLabel,
  getDatabaseViewDisplayName,
  getDatabaseViewTypeLabel,
} from "@/lib/database/display";
import {
  buildFieldConfig,
  DATABASE_FIELD_TYPES,
  formatFieldOptions,
  isSelectLikeFieldType,
} from "@/lib/database/fields";
import {
  applyDatabaseImportPreview,
  buildDatabaseImportPreview,
  DATABASE_DIRECT_IMPORT_COLUMN_LIMIT,
  DATABASE_DIRECT_IMPORT_ROW_LIMIT,
  type DatabaseImportColumnPlan,
  type DatabaseImportPreview,
  type DatabaseImportReceipt,
} from "@/lib/database/databaseImport";
import {
  appendDatabaseTemplateRowReceipt,
  buildDatabaseTemplateRowDraft,
  buildDatabaseTemplateRowReceipt,
  type DatabaseTemplateRowReceipt,
} from "@/lib/database/databaseTemplateRows";
import { getHighRiskRequiredPhrase } from "@/lib/security/highRiskActionRegistry";

interface DatabaseShellProps {
  databaseId: string;
}

const DATABASE_IMPORT_ACCEPT =
  ".xlsx,.xls,.csv,.tsv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,application/vnd.oasis.opendocument.spreadsheet";
const DATABASE_IMPORT_CONFIRMATION_PHRASE =
  getHighRiskRequiredPhrase("bulk-import");

type RowWithPage = DatabaseRow & { page: Page };
type SortDirection = "asc" | "desc";
interface DatabaseViewConfig {
  rowSearch: string;
  filterFieldId: string;
  filterValue: string;
  sortKey: string;
  sortDirection: SortDirection;
  hiddenFieldIds: string[];
  chartGroupFieldId: string;
}

export default function DatabaseShell({ databaseId }: DatabaseShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pages: workspacePages } = usePages();
  const initialRowSearch = searchParams.get("q") ?? "";
  const focusPageId = searchParams.get("focus") ?? "";
  const relationHandoffSource = searchParams.get("handoff") ?? "";
  const [database, setDatabase] = useState<Database | null>(null);
  const [fields, setFields] = useState<DatabaseField[]>([]);
  const [rows, setRows] = useState<RowWithPage[]>([]);
  const [views, setViews] = useState<DatabaseView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [rowSearch, setRowSearch] = useState(initialRowSearch);
  const [filterFieldId, setFilterFieldId] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [sortKey, setSortKey] = useState("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [hiddenFieldIds, setHiddenFieldIds] = useState<string[]>([]);
  const [chartGroupFieldId, setChartGroupFieldId] = useState("");
  const [relationCompletionBusyId, setRelationCompletionBusyId] =
    useState<string | null>(null);
  const [databaseImportPreview, setDatabaseImportPreview] =
    useState<DatabaseImportPreview | null>(null);
  const [databaseImportPhrase, setDatabaseImportPhrase] = useState("");
  const [databaseImportBusy, setDatabaseImportBusy] = useState(false);
  const [databaseImportReceipt, setDatabaseImportReceipt] =
    useState<DatabaseImportReceipt | null>(null);
  const [exportingDatabaseImportReceipt, setExportingDatabaseImportReceipt] =
    useState(false);
  const [templateRowReceipt, setTemplateRowReceipt] =
    useState<DatabaseTemplateRowReceipt | null>(null);
  const [exportingTemplateRowReceipt, setExportingTemplateRowReceipt] =
    useState(false);
  const databaseImportInputRef = useRef<HTMLInputElement | null>(null);

  const applyViewConfig = useCallback((configValue: string) => {
    const config = parseDatabaseViewConfig(configValue);
    setRowSearch(initialRowSearch || config.rowSearch);
    setFilterFieldId(config.filterFieldId);
    setFilterValue(config.filterValue);
    setSortKey(config.sortKey);
    setSortDirection(config.sortDirection);
    setHiddenFieldIds(config.hiddenFieldIds);
    setChartGroupFieldId(config.chartGroupFieldId);
  }, [initialRowSearch]);

  const reload = useCallback(async () => {
    const [db, f, r, v] = await Promise.all([
      getDatabase(databaseId),
      getFields(databaseId),
      getRows(databaseId),
      getViews(databaseId),
    ]);
    setDatabase(db);
    setFields(f);
    setRows(r);
    setViews(v);
    if (db) setTitle(db.title);
    if (v.length > 0 && !activeViewId) {
      setActiveViewId(v[0].id);
      applyViewConfig(v[0].config);
    }
    setLoading(false);
  }, [databaseId, activeViewId, applyViewConfig]);

  useEffect(() => {
    queueMicrotask(() => {
      reload();
    });
  }, [reload]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      await updateDatabase(databaseId, { title: newTitle });
    },
    [databaseId]
  );

  const handleAddField = useCallback(
    async (name: string, fieldType: string, config?: string) => {
      await addField(databaseId, { name, fieldType, config });
      reload();
    },
    [databaseId, reload]
  );

  const handleDeleteField = useCallback(
    async (fieldId: string) => {
      await deleteField(fieldId);
      reload();
    },
    [reload]
  );

  const handleUpdateField = useCallback(
    async (
      fieldId: string,
      updates: Partial<
        Pick<DatabaseField, "name" | "field_type" | "config">
      >
    ) => {
      await updateField(fieldId, updates);
      reload();
    },
    [reload]
  );

  const handleAddRow = useCallback(async () => {
    await addRow(databaseId);
    reload();
  }, [databaseId, reload]);

  const handleAddAndOpenRow = useCallback(async () => {
    const row = await addRow(databaseId);
    await reload();
    router.push(`/page/${row.page_id}`);
  }, [databaseId, reload, router]);

  const handleCreateRow = useCallback(
    async (rowTitle: string, fieldValues: Record<string, unknown>) => {
      await addRow(databaseId, {
        title: rowTitle,
        fieldValues,
      });
      reload();
    },
    [databaseId, reload]
  );

  const handleAddTemplateRow = useCallback(
    async (template: NoteTemplate) => {
      const draft = buildDatabaseTemplateRowDraft(template, fields);
      const row = await addRow(databaseId, {
        title: template.title,
        fieldValues: draft.field_values,
        contentText: template.html,
      });
      const receipt = buildDatabaseTemplateRowReceipt({
        template,
        draft,
        row,
        source_surface: "database-page",
      });
      appendDatabaseTemplateRowReceipt(receipt);
      setTemplateRowReceipt(receipt);
      reload();
    },
    [databaseId, fields, reload]
  );

  const handleUpdateRow = useCallback(
    async (rowId: string, fieldValues: Record<string, unknown>) => {
      await updateRow(rowId, { fieldValues });
      reload();
    },
    [reload]
  );

  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      await deleteRow(rowId);
      reload();
    },
    [reload]
  );

  const handleAddView = useCallback(
    async (name: string, viewType: DatabaseView["view_type"]) => {
      const view = await addView(databaseId, { name, viewType });
      setActiveViewId(view.id);
      reload();
    },
    [databaseId, reload]
  );

  const handleOpenRow = useCallback(
    (pageId: string) => {
      router.push(`/page/${pageId}`);
    },
    [router]
  );

  const handleOpenPage = useCallback(
    (pageId: string) => {
      router.push(`/page/${pageId}`);
    },
    [router]
  );

  const handleClearRelationHandoff = useCallback(() => {
    router.push(`/database/${databaseId}`);
  }, [databaseId, router]);

  const activeView = views.find((v) => v.id === activeViewId) || views[0];
  const visibleFields = useMemo(
    () => getVisibleFields(fields, hiddenFieldIds),
    [fields, hiddenFieldIds]
  );
  const focusPage = useMemo(
    () =>
      focusPageId
        ? rows.find((row) => row.page_id === focusPageId)?.page ??
          workspacePages.find((page) => page.id === focusPageId) ??
          null
        : null,
    [focusPageId, rows, workspacePages]
  );

  const visibleRows = useMemo(
    () =>
      getVisibleRows({
        rows,
        fields,
        relationPages: workspacePages,
        search: rowSearch,
        filterFieldId,
        filterValue,
        sortKey,
        sortDirection,
      }),
    [
      rows,
      fields,
      workspacePages,
      rowSearch,
      filterFieldId,
      filterValue,
      sortKey,
      sortDirection,
    ]
  );

  const handleExportXlsx = useCallback(async () => {
    if (!database) return;
    try {
      await exportDatabaseAsXlsx(database, fields, visibleRows, workspacePages);
    } catch (err) {
      console.error("[Zhinote] Failed to export database XLSX:", err);
      window.alert("Excel 导出失败，请查看控制台。");
    }
  }, [database, fields, visibleRows, workspacePages]);

  const handleChooseDatabaseImportFile = useCallback(() => {
    databaseImportInputRef.current?.click();
  }, []);

  const handleDatabaseImportFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;

      setDatabaseImportBusy(true);
      setDatabaseImportReceipt(null);
      try {
        const preview = await buildDatabaseImportPreview(file, fields);
        setDatabaseImportPreview(preview);
        setDatabaseImportPhrase("");
      } catch (err) {
        console.error("[Zhinote] Failed to preview database import:", err);
        window.alert(
          err instanceof Error
            ? err.message
            : "这个文件无法生成数据库导入预览。"
        );
      } finally {
        setDatabaseImportBusy(false);
      }
    },
    [fields]
  );

  const handleApplyDatabaseImport = useCallback(async () => {
    if (!databaseImportPreview) return;

    if (databaseImportPhrase.trim() !== DATABASE_IMPORT_CONFIRMATION_PHRASE) {
      window.alert(
        `请输入确认短语 ${DATABASE_IMPORT_CONFIRMATION_PHRASE} 后再导入当前数据库。`
      );
      return;
    }

    const ok = window.confirm(
      `要把这个表格追加导入当前数据库吗？将写入 ${databaseImportPreview.summary.rows_planned} 行，并创建 ${databaseImportPreview.summary.new_fields_planned} 个缺失字段。原文件不会上传。`
    );
    if (!ok) return;

    setDatabaseImportBusy(true);
    try {
      const receipt = await applyDatabaseImportPreview(
        databaseId,
        databaseImportPreview,
        DATABASE_IMPORT_CONFIRMATION_PHRASE,
        databaseImportPhrase
      );
      setDatabaseImportReceipt(receipt);
      setDatabaseImportPreview(null);
      setDatabaseImportPhrase("");
      await reload();
    } catch (err) {
      console.error("[Zhinote] Failed to apply database import:", err);
      window.alert(
        err instanceof Error ? err.message : "导入当前数据库失败，请查看控制台。"
      );
    } finally {
      setDatabaseImportBusy(false);
    }
  }, [databaseId, databaseImportPhrase, databaseImportPreview, reload]);

  const handleExportDatabaseImportReceipt = useCallback(() => {
    if (!databaseImportReceipt) return;
    setExportingDatabaseImportReceipt(true);
    try {
      downloadJsonFile(
        `zhinote-database-import-receipt-${fileSafeTimestamp()}.json`,
        databaseImportReceipt
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export database import receipt:", err);
      window.alert("数据库导入 receipt 导出失败，请查看控制台。");
    } finally {
      setExportingDatabaseImportReceipt(false);
    }
  }, [databaseImportReceipt]);

  const handleExportTemplateRowReceipt = useCallback(() => {
    if (!templateRowReceipt) return;
    setExportingTemplateRowReceipt(true);
    try {
      downloadJsonFile(
        `zhinote-database-template-row-receipt-${fileSafeTimestamp()}.json`,
        templateRowReceipt
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export template row receipt:", err);
      window.alert("模板行 receipt 导出失败，请查看控制台。");
    } finally {
      setExportingTemplateRowReceipt(false);
    }
  }, [templateRowReceipt]);

  const relationCompletionFields = useMemo(
    () => getRelationCompletionFields(fields, focusPage, relationHandoffSource),
    [fields, focusPage, relationHandoffSource]
  );
  const relationCompletionRows = useMemo(
    () => getRelationCompletionRows(rows, visibleRows, focusPageId),
    [focusPageId, rows, visibleRows]
  );

  const handleAddFocusRelation = useCallback(
    async (row: RowWithPage, field: DatabaseField) => {
      if (!focusPageId) return;
      const actionId = `${row.id}:${field.id}`;
      setRelationCompletionBusyId(actionId);
      try {
        const fieldValues = parseFieldValues(row.field_values);
        const currentIds = normalizeRelationValue(fieldValues[field.id]);
        if (!currentIds.includes(focusPageId)) {
          await updateRow(row.id, {
            fieldValues: {
              ...fieldValues,
              [field.id]: [...currentIds, focusPageId],
            },
          });
        }
        await reload();
      } finally {
        setRelationCompletionBusyId(null);
      }
    },
    [focusPageId, reload]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!database) {
    return <p className="text-zinc-400 text-sm">数据库不存在。</p>;
  }

  const allFieldViewProps = {
    fields,
    rows: visibleRows,
    onAddRow: handleAddRow,
    onUpdateRow: handleUpdateRow,
    onDeleteRow: handleDeleteRow,
    onOpenRow: handleOpenRow,
    onOpenPage: handleOpenPage,
    relationPages: workspacePages,
    focusPageId,
    focusPage,
  };
  const visibleFieldViewProps = {
    ...allFieldViewProps,
    fields: visibleFields,
  };

  return (
    <div>
      {/* Database header */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-2xl">{database.icon || "🗄️"}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="数据库标题"
          className="text-2xl font-bold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 flex-1"
        />
        <button
          type="button"
          onClick={handleAddAndOpenRow}
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          title="新建一条记录，并立即打开它的页面"
        >
          新建并打开
        </button>
        <button
          type="button"
          onClick={() =>
            exportDatabaseAsCsv(database, fields, visibleRows, workspacePages)
          }
          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="导出当前可见行为 CSV"
        >
          CSV
        </button>
        <button
          type="button"
          onClick={() => void handleExportXlsx()}
          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="导出当前可见行为 Excel 文件"
        >
          XLSX
        </button>
        <button
          type="button"
          onClick={handleChooseDatabaseImportFile}
          disabled={databaseImportBusy}
          className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
          title="把 CSV / Excel / ODS 追加导入当前数据库"
        >
          {databaseImportBusy ? "处理中..." : "导入"}
        </button>
        <input
          ref={databaseImportInputRef}
          type="file"
          accept={DATABASE_IMPORT_ACCEPT}
          className="hidden"
          onChange={(event) => void handleDatabaseImportFileSelected(event)}
        />
      </div>

      {/* View tabs + add view */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 mb-4">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => {
              setActiveViewId(view.id);
              applyViewConfig(view.config);
            }}
            className={`px-3 py-1.5 text-sm rounded-t-md transition-colors ${
              activeView?.id === view.id
                ? "bg-white dark:bg-zinc-800 border border-b-0 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium -mb-px"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {view.view_type === "table" && "⊞ "}
            {view.view_type === "list" && "☰ "}
            {view.view_type === "kanban" && "▥ "}
            {view.view_type === "calendar" && "📅 "}
            {view.view_type === "gallery" && "▦ "}
            {view.view_type === "timeline" && "↔ "}
            {view.view_type === "chart" && "▤ "}
            {view.view_type === "form" && "□ "}
            {view.view_type === "feed" && "☷ "}
            {getDatabaseViewDisplayName(view)}
          </button>
        ))}
        {/* Add view dropdown */}
        <AddViewButton onAdd={handleAddView} />
      </div>

      {/* Field management bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-zinc-400">字段：</span>
        {fields.map((field) => (
          <span
            key={field.id}
            className="inline-flex items-center gap-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded px-2 py-0.5"
          >
            {getDatabaseFieldDisplayName(field)}
            <span className="text-zinc-400 dark:text-zinc-500">
              ({getDatabaseFieldTypeLabel(field.field_type)})
            </span>
            <FieldSettingsButton field={field} onUpdate={handleUpdateField} />
            {field.position !== 0 && (
              <button
                onClick={() => handleDeleteField(field.id)}
                className="text-zinc-400 hover:text-red-500 ml-0.5"
                title="删除字段"
              >
                x
              </button>
            )}
          </span>
        ))}
        <AddFieldButton onAdd={handleAddField} />
        <DatabaseTemplateButton fields={fields} onSelect={handleAddTemplateRow} />
      </div>

      <DatabaseViewControls
        activeViewType={activeView?.view_type}
        fields={fields}
        rowSearch={rowSearch}
        initialRowSearch={initialRowSearch}
        onRowSearchChange={setRowSearch}
        filterFieldId={filterFieldId}
        onFilterFieldChange={setFilterFieldId}
        filterValue={filterValue}
        onFilterValueChange={setFilterValue}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
        hiddenFieldIds={hiddenFieldIds}
        onHiddenFieldIdsChange={setHiddenFieldIds}
        chartGroupFieldId={chartGroupFieldId}
        onChartGroupFieldChange={setChartGroupFieldId}
        onSaveView={async () => {
          if (!activeView) return;
          await updateView(activeView.id, {
            config: JSON.stringify({
              rowSearch,
              filterFieldId,
              filterValue,
              sortKey,
              sortDirection,
              hiddenFieldIds,
              chartGroupFieldId,
            }),
          });
          reload();
        }}
        visibleCount={visibleRows.length}
        totalCount={rows.length}
      />

      {databaseImportPreview && (
        <DatabaseImportPreviewPanel
          preview={databaseImportPreview}
          confirmationPhrase={databaseImportPhrase}
          requiredPhrase={DATABASE_IMPORT_CONFIRMATION_PHRASE}
          busy={databaseImportBusy}
          onConfirmationPhraseChange={setDatabaseImportPhrase}
          onCancel={() => {
            setDatabaseImportPreview(null);
            setDatabaseImportPhrase("");
          }}
          onApply={() => void handleApplyDatabaseImport()}
        />
      )}

      {databaseImportReceipt && (
        <DatabaseImportReceiptPanel
          receipt={databaseImportReceipt}
          exporting={exportingDatabaseImportReceipt}
          onExport={handleExportDatabaseImportReceipt}
        />
      )}

      {templateRowReceipt && (
        <DatabaseTemplateRowReceiptPanel
          receipt={templateRowReceipt}
          exporting={exportingTemplateRowReceipt}
          onExport={handleExportTemplateRowReceipt}
        />
      )}

      {focusPageId && (
        <RelationHandoffContextPanel
          database={database}
          focusPage={focusPage}
          focusPageId={focusPageId}
          sourceLabel={getRelationHandoffSourceLabel(relationHandoffSource)}
          rowSearch={rowSearch}
          fields={relationCompletionFields}
          candidateRows={relationCompletionRows}
          onOpenFocusPage={handleOpenPage}
          onClearHandoff={handleClearRelationHandoff}
        />
      )}

      {focusPageId && focusPage && (
        <RelationCompletionAssistant
          focusPage={focusPage}
          rows={relationCompletionRows}
          fields={relationCompletionFields}
          busyId={relationCompletionBusyId}
          onAddRelation={(row, field) => void handleAddFocusRelation(row, field)}
          onOpenRow={(pageId) => router.push(`/page/${pageId}`)}
        />
      )}

      {/* Active view */}
      {activeView?.view_type === "table" && <TableView {...visibleFieldViewProps} />}
      {activeView?.view_type === "list" && <ListView {...visibleFieldViewProps} />}
      {activeView?.view_type === "kanban" && <KanbanView {...allFieldViewProps} />}
      {activeView?.view_type === "calendar" && <CalendarView {...allFieldViewProps} />}
      {activeView?.view_type === "gallery" && <GalleryView {...visibleFieldViewProps} />}
      {activeView?.view_type === "timeline" && <TimelineView {...allFieldViewProps} />}
      {activeView?.view_type === "chart" && (
        <ChartView
          fields={fields}
          rows={visibleRows}
          chartGroupFieldId={chartGroupFieldId}
          relationPages={workspacePages}
          onOpenRow={handleOpenRow}
        />
      )}
      {activeView?.view_type === "form" && (
        <FormView
          fields={visibleFields}
          relationPages={workspacePages}
          onOpenPage={handleOpenPage}
          onCreateRow={handleCreateRow}
        />
      )}
      {activeView?.view_type === "feed" && <FeedView {...allFieldViewProps} />}
    </div>
  );
}

function DatabaseViewControls({
  activeViewType,
  fields,
  rowSearch,
  initialRowSearch,
  onRowSearchChange,
  filterFieldId,
  onFilterFieldChange,
  filterValue,
  onFilterValueChange,
  sortKey,
  onSortKeyChange,
  sortDirection,
  onSortDirectionChange,
  hiddenFieldIds,
  onHiddenFieldIdsChange,
  chartGroupFieldId,
  onChartGroupFieldChange,
  onSaveView,
  visibleCount,
  totalCount,
}: {
  activeViewType?: DatabaseView["view_type"];
  fields: DatabaseField[];
  rowSearch: string;
  initialRowSearch: string;
  onRowSearchChange: (value: string) => void;
  filterFieldId: string;
  onFilterFieldChange: (value: string) => void;
  filterValue: string;
  onFilterValueChange: (value: string) => void;
  sortKey: string;
  onSortKeyChange: (value: string) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
  hiddenFieldIds: string[];
  onHiddenFieldIdsChange: (value: string[]) => void;
  chartGroupFieldId: string;
  onChartGroupFieldChange: (value: string) => void;
  onSaveView: () => void;
  visibleCount: number;
  totalCount: number;
}) {
  const hasControls =
    rowSearch ||
    filterValue ||
    sortKey !== "position" ||
    hiddenFieldIds.length > 0 ||
    chartGroupFieldId;
  const chartableFields = fields.filter(isChartableField);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-zinc-100 py-2 text-xs dark:border-zinc-800">
      <input
        type="search"
        value={rowSearch}
        onChange={(event) => onRowSearchChange(event.target.value)}
        placeholder="搜索行"
        className="h-8 w-44 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
      />
      {initialRowSearch && rowSearch === initialRowSearch && (
        <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-300">
          来自关联补全
        </span>
      )}
      <select
        value={filterFieldId}
        onChange={(event) => onFilterFieldChange(event.target.value)}
        aria-label="筛选字段"
        className="h-8 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <option value="all">所有字段</option>
        {fields.map((field) => (
          <option key={field.id} value={field.id}>
            {getDatabaseFieldDisplayName(field)}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={filterValue}
        onChange={(event) => onFilterValueChange(event.target.value)}
        placeholder="筛选包含"
        className="h-8 w-40 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
      />
      <select
        value={sortKey}
        onChange={(event) => onSortKeyChange(event.target.value)}
        aria-label="排序行"
        className="h-8 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <option value="position">手动排序</option>
        <option value="name">名称</option>
        <option value="created">创建时间</option>
        <option value="updated">更新时间</option>
        {fields.slice(1).map((field) => (
          <option key={field.id} value={`field:${field.id}`}>
            {getDatabaseFieldDisplayName(field)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() =>
          onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")
        }
        className="h-8 rounded border border-zinc-200 px-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        title="切换排序方向"
      >
        {sortDirection === "asc" ? "升序" : "降序"}
      </button>
      <DatabasePropertiesButton
        fields={fields}
        hiddenFieldIds={hiddenFieldIds}
        onHiddenFieldIdsChange={onHiddenFieldIdsChange}
      />
      {activeViewType === "chart" && (
        <select
          value={chartGroupFieldId}
          onChange={(event) => onChartGroupFieldChange(event.target.value)}
          aria-label="图表分组字段"
          className="h-8 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="">自动分组</option>
          {chartableFields.map((field) => (
            <option key={field.id} value={field.id}>
              图表：{getDatabaseFieldDisplayName(field)}
            </option>
          ))}
        </select>
      )}
      <span className="text-zinc-400">
        {visibleCount}/{totalCount}
      </span>
      <button
        type="button"
        onClick={onSaveView}
        className="h-8 rounded border border-zinc-200 px-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        保存视图
      </button>
      {hasControls && (
        <button
          type="button"
          onClick={() => {
            onRowSearchChange("");
            onFilterFieldChange("all");
            onFilterValueChange("");
            onSortKeyChange("position");
            onSortDirectionChange("asc");
            onHiddenFieldIdsChange([]);
            onChartGroupFieldChange("");
          }}
          className="h-8 rounded px-2 text-xs text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          清除
        </button>
      )}
    </div>
  );
}

function RelationHandoffContextPanel({
  database,
  focusPage,
  focusPageId,
  sourceLabel,
  rowSearch,
  fields,
  candidateRows,
  onOpenFocusPage,
  onClearHandoff,
}: {
  database: Database;
  focusPage: Page | null;
  focusPageId: string;
  sourceLabel: string;
  rowSearch: string;
  fields: DatabaseField[];
  candidateRows: RowWithPage[];
  onOpenFocusPage: (pageId: string) => void;
  onClearHandoff: () => void;
}) {
  const focusKind = focusPage ? classifyResearchPage(focusPage) : null;
  const focusTitle = focusPage?.title || "指定页面";
  const fieldLabels = fields.map((field) =>
    getResearchRelationFieldLabel(field.name)
  );

  return (
    <section className="mb-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-300">
            Relation handoff
          </p>
          <h2 className="mt-1 text-sm font-semibold text-blue-950 dark:text-blue-100">
            {sourceLabel}交接来的补关系任务
          </h2>
          <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">
            聚焦资产：{focusPage?.icon ? `${focusPage.icon} ` : ""}
            {focusTitle}
            {focusKind ? ` · ${getResearchAssetKindLabel(focusKind)}` : ""}。
            当前目标库是「{database.title}」，搜索条件是「{rowSearch || "未设置"}」。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {focusPage && (
            <button
              type="button"
              onClick={() => onOpenFocusPage(focusPage.id)}
              className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-zinc-950 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              打开聚焦页
            </button>
          )}
          <button
            type="button"
            onClick={onClearHandoff}
            className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-zinc-950 dark:text-blue-300 dark:hover:bg-blue-950"
          >
            清除 handoff
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <RelationHandoffMetric label="候选行" value={candidateRows.length} />
        <RelationHandoffMetric label="可写入字段" value={fields.length} />
        <RelationHandoffMetric label="聚焦页面 id" value={focusPageId ? 1 : 0} />
        <RelationHandoffMetric label="自动写入" value={0} />
      </div>

      {fieldLabels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {fieldLabels.map((label) => (
            <span
              key={label}
              className="rounded bg-white px-2 py-1 text-[11px] text-blue-700 dark:bg-zinc-950 dark:text-blue-300"
            >
              {label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          当前库还没有可用于这个资产的 relation 字段。先添加 relation 字段，再回来补具体关系。
        </p>
      )}

      {candidateRows.length === 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          当前搜索没有候选行。可以清除搜索、新建一行，或确认是否打开了正确的 tracker。
        </p>
      )}

      <ol className="mt-3 grid gap-2 lg:grid-cols-3">
        <RelationHandoffStep
          order={1}
          title="确认目标 row"
          detail="先看候选行是不是这次要补关系的研究对象。"
        />
        <RelationHandoffStep
          order={2}
          title="选择 relation 字段"
          detail="优先使用和聚焦资产类型匹配的字段，只处理一个最准确的字段。"
        />
        <RelationHandoffStep
          order={3}
          title="手动加入"
          detail="点击下方按钮才会写入一条本地 relation 值，不会批量修改。"
        />
      </ol>

      <p className="mt-3 border-t border-blue-100 pt-2 text-[11px] leading-5 text-blue-700 dark:border-blue-900 dark:text-blue-300">
        本面板只读取 URL 参数、页面标题和字段 schema；不读页面正文、不导出表格行值、
        不读取文件 bytes、不包含持仓或交易计划、不上传、不调用 AI。真正写入只发生在下方
        “加入 relation 字段”按钮被点击时。
      </p>
    </section>
  );
}

function RelationHandoffMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md bg-white px-3 py-2 text-xs dark:bg-zinc-950">
      <div className="font-semibold text-blue-950 dark:text-blue-100">
        {value}
      </div>
      <div className="text-blue-700 dark:text-blue-300">{label}</div>
    </div>
  );
}

function RelationHandoffStep({
  order,
  title,
  detail,
}: {
  order: number;
  title: string;
  detail: string;
}) {
  return (
    <li className="rounded-md bg-white px-3 py-2 text-xs dark:bg-zinc-950">
      <div className="font-semibold text-blue-950 dark:text-blue-100">
        {order}. {title}
      </div>
      <p className="mt-1 leading-5 text-blue-700 dark:text-blue-300">{detail}</p>
    </li>
  );
}

function RelationCompletionAssistant({
  focusPage,
  rows,
  fields,
  busyId,
  onAddRelation,
  onOpenRow,
}: {
  focusPage: Page;
  rows: RowWithPage[];
  fields: DatabaseField[];
  busyId: string | null;
  onAddRelation: (row: RowWithPage, field: DatabaseField) => void;
  onOpenRow: (pageId: string) => void;
}) {
  const focusKind = classifyResearchPage(focusPage);

  return (
    <section className="mb-4 rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-900 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Relation 补全助手
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            当前聚焦：{focusPage.icon ? `${focusPage.icon} ` : ""}
            {focusPage.title || "未命名页面"}
            {focusKind ? ` · ${getResearchAssetKindLabel(focusKind)}` : ""}。
            点击按钮后只会把这个页面加入所选行的 relation 字段。
          </p>
        </div>
        <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-300">
          本地单条写入
        </span>
      </div>

      {fields.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          当前数据库没有可用的 relation 字段。请先添加 relation 字段，再补关系。
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          没有找到候选行。可以先清除搜索、创建新行，或打开正确的跟踪表。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {rows.map((row) => (
            <RelationCompletionRow
              key={row.id}
              row={row}
              fields={fields}
              focusPageId={focusPage.id}
              busyId={busyId}
              onAddRelation={onAddRelation}
              onOpenRow={onOpenRow}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DatabaseImportPreviewPanel({
  preview,
  confirmationPhrase,
  requiredPhrase,
  busy,
  onConfirmationPhraseChange,
  onCancel,
  onApply,
}: {
  preview: DatabaseImportPreview;
  confirmationPhrase: string;
  requiredPhrase: string;
  busy: boolean;
  onConfirmationPhraseChange: (value: string) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const phraseMatches = confirmationPhrase.trim() === requiredPhrase;

  return (
    <section className="mb-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-blue-950 dark:text-blue-100">
            追加导入当前数据库
          </h2>
          <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">
            本地预览 {preview.source.file_name} / {preview.source.sheet_name}：
            将写入 {preview.summary.rows_planned} 行，匹配{" "}
            {preview.summary.existing_fields_matched} 个字段，新增{" "}
            {preview.summary.new_fields_planned} 个字段。不会上传、不会调用 AI。
          </p>
        </div>
        <span className="w-fit rounded bg-white px-2 py-1 text-xs text-blue-700 dark:bg-zinc-950 dark:text-blue-300">
          上限 {DATABASE_DIRECT_IMPORT_ROW_LIMIT} 行 /{" "}
          {DATABASE_DIRECT_IMPORT_COLUMN_LIMIT} 列
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <ImportMetric label="可导入行" value={preview.summary.rows_planned} />
        <ImportMetric label="可导入列" value={preview.summary.planned_columns} />
        <ImportMetric label="新增字段" value={preview.summary.new_fields_planned} />
        <ImportMetric
          label="已匹配字段"
          value={preview.summary.existing_fields_matched}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {preview.columns.map((column) => (
          <span
            key={`${column.source_column_index}:${column.source_header}`}
            className="rounded bg-white px-2 py-1 text-[11px] text-blue-700 dark:bg-zinc-950 dark:text-blue-300"
          >
            {column.source_header} {"->"} {column.target_field_name} ·{" "}
            {getImportColumnStatusLabel(column.target_status)}
          </span>
        ))}
      </div>
      {(preview.source.truncated_rows || preview.source.truncated_columns) && (
        <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          文件较大，当前只导入前 {DATABASE_DIRECT_IMPORT_ROW_LIMIT} 行和前{" "}
          {DATABASE_DIRECT_IMPORT_COLUMN_LIMIT} 列。完整原文件不上传、不修改。
        </p>
      )}
      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <div>
          <label
            htmlFor="database-direct-import-confirmation"
            className="text-xs font-semibold text-blue-950 dark:text-blue-100"
          >
            批量导入确认短语
          </label>
          <input
            id="database-direct-import-confirmation"
            value={confirmationPhrase}
            onChange={(event) =>
              onConfirmationPhraseChange(event.target.value)
            }
            placeholder={requiredPhrase}
            className="mt-1 w-full rounded-md border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 dark:border-blue-900 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900 dark:bg-zinc-950 dark:text-blue-300 dark:hover:bg-blue-950"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={busy || !phraseMatches}
          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "导入中..." : "确认导入"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-blue-700 dark:text-blue-300">
        当前预览会读取所选文件的表格值；写入前必须确认。receipt 只保存元数据，
        不保存文件名、文件 bytes、表格单元格或页面正文。
      </p>
    </section>
  );
}

function DatabaseImportReceiptPanel({
  receipt,
  exporting,
  onExport,
}: {
  receipt: DatabaseImportReceipt;
  exporting: boolean;
  onExport: () => void;
}) {
  return (
    <section className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
            数据库导入 receipt
          </h2>
          <p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
            已本地写入 {receipt.write_summary.rows_written} 行，新增{" "}
            {receipt.write_summary.fields_created} 个字段，匹配{" "}
            {receipt.write_summary.fields_matched} 个字段。
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="w-fit rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-900 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950"
        >
          {exporting ? "导出中..." : "导出导入 receipt"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-emerald-800 dark:text-emerald-200">
        receipt 不包含文件名、文件 bytes、文件文本、表格单元格、token、凭证或云端数据。
      </p>
    </section>
  );
}

function DatabaseTemplateRowReceiptPanel({
  receipt,
  exporting,
  onExport,
}: {
  receipt: DatabaseTemplateRowReceipt;
  exporting: boolean;
  onExport: () => void;
}) {
  return (
    <section className="mb-4 rounded-lg border border-teal-100 bg-teal-50/70 p-3 dark:border-teal-900 dark:bg-teal-950/30">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-teal-950 dark:text-teal-100">
            模板行 receipt
          </h2>
          <p className="mt-1 text-xs leading-5 text-teal-800 dark:text-teal-200">
            已本地创建 {receipt.template.template_title} 模板行；预填{" "}
            {receipt.field_draft_summary.fields_prefilled} 个结构字段，保留{" "}
            {receipt.field_draft_summary.fields_left_manual} 个字段手动填写。
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="w-fit rounded-md border border-teal-200 bg-white px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-wait disabled:opacity-60 dark:border-teal-900 dark:bg-zinc-950 dark:text-teal-300 dark:hover:bg-teal-950"
        >
          {exporting ? "导出中..." : "导出模板行 receipt"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-teal-800 dark:text-teal-200">
        receipt 不包含数据库标题、row values、field names、页面正文、ticker、持仓、
        仓位、价格、交易计划、token、凭证或云端数据。
      </p>
    </section>
  );
}

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 text-xs dark:bg-zinc-950">
      <div className="font-semibold text-blue-950 dark:text-blue-100">
        {value}
      </div>
      <div className="text-blue-700 dark:text-blue-300">{label}</div>
    </div>
  );
}

function getImportColumnStatusLabel(
  status: DatabaseImportColumnPlan["target_status"]
) {
  if (status === "title-field") return "标题";
  if (status === "existing-field") return "匹配";
  return "新增";
}

function RelationCompletionRow({
  row,
  fields,
  focusPageId,
  busyId,
  onAddRelation,
  onOpenRow,
}: {
  row: RowWithPage;
  fields: DatabaseField[];
  focusPageId: string;
  busyId: string | null;
  onAddRelation: (row: RowWithPage, field: DatabaseField) => void;
  onOpenRow: (pageId: string) => void;
}) {
  const fieldValues = parseFieldValues(row.field_values);

  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {row.page?.title || "未命名行"}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            选择字段后加入当前聚焦页面
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenRow(row.page_id)}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开行
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {fields.map((field) => {
          const actionId = `${row.id}:${field.id}`;
          const existingIds = normalizeRelationValue(fieldValues[field.id]);
          const alreadyLinked = existingIds.includes(focusPageId);

          return (
            <button
              key={field.id}
              type="button"
              disabled={alreadyLinked || busyId === actionId}
              onClick={() => onAddRelation(row, field)}
              className="rounded-md border border-blue-200 px-2 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-default disabled:border-zinc-200 disabled:text-zinc-400 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950 dark:disabled:border-zinc-800 dark:disabled:text-zinc-500"
              title={getDatabaseFieldDisplayName(field)}
            >
              {alreadyLinked
                ? `${getResearchRelationFieldLabel(field.name)} 已有`
                : busyId === actionId
                  ? "加入中..."
                  : `加入 ${getResearchRelationFieldLabel(field.name)}`}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function DatabasePropertiesButton({
  fields,
  hiddenFieldIds,
  onHiddenFieldIdsChange,
}: {
  fields: DatabaseField[];
  hiddenFieldIds: string[];
  onHiddenFieldIdsChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const hiddenFieldSet = new Set(hiddenFieldIds);
  const visibleCount = fields.filter(
    (field) => field.position === 0 || !hiddenFieldSet.has(field.id)
  ).length;

  const toggleField = (field: DatabaseField) => {
    if (field.position === 0) return;
    if (hiddenFieldSet.has(field.id)) {
      onHiddenFieldIdsChange(hiddenFieldIds.filter((id) => id !== field.id));
      return;
    }
    onHiddenFieldIdsChange([...hiddenFieldIds, field.id]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-8 rounded border border-zinc-200 px-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        title="选择当前视图显示哪些属性"
      >
        属性 {visibleCount}/{fields.length}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-2 px-1 text-[11px] font-medium text-zinc-400">
            当前视图显示的属性
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {fields.map((field) => {
              const checked =
                field.position === 0 || !hiddenFieldSet.has(field.id);
              return (
                <label
                  key={field.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={field.position === 0}
                    onChange={() => toggleField(field)}
                    className="rounded border-zinc-300"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {getDatabaseFieldDisplayName(field)}
                  </span>
                  <span className="shrink-0 text-[11px] text-zinc-400">
                    {getDatabaseFieldTypeLabel(field.field_type)}
                  </span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onHiddenFieldIdsChange([])}
            className="mt-2 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            全部显示
          </button>
        </div>
      )}
    </div>
  );
}

function FieldSettingsButton({
  field,
  onUpdate,
}: {
  field: DatabaseField;
  onUpdate: (
    fieldId: string,
    updates: Partial<Pick<DatabaseField, "name" | "field_type" | "config">>
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(getDatabaseFieldDisplayName(field));
  const [type, setType] = useState(field.field_type);
  const [options, setOptions] = useState(formatFieldOptions(field));
  const isTitleField = field.position === 0;

  useEffect(() => {
    setName(getDatabaseFieldDisplayName(field));
    setType(field.field_type);
    setOptions(formatFieldOptions(field));
  }, [field]);

  const handleSave = () => {
    const nextName = name.trim() || getDatabaseFieldDisplayName(field);
    const nextType = isTitleField ? field.field_type : type;
    onUpdate(field.id, {
      name: nextName,
      field_type: nextType,
      config: buildFieldConfig(nextType, options),
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        title="编辑字段属性"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                字段设置
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                已有单元格值会保留，只改变字段解释方式。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1 text-xs text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              关闭
            </button>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">
              字段名
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">
              类型
            </span>
            <select
              value={type}
              disabled={isTitleField}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {DATABASE_FIELD_TYPES.map((fieldType) => (
                <option key={fieldType.value} value={fieldType.value}>
                  {fieldType.label}
                </option>
              ))}
            </select>
            {isTitleField && (
              <span className="mt-1 block text-[11px] text-zinc-400">
                名称字段负责打开页面，类型固定为文本。
              </span>
            )}
          </label>
          {isSelectLikeFieldType(type) && (
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-medium text-zinc-500">
                选项，用英文逗号分隔
              </span>
              <input
                type="text"
                value={options}
                onChange={(event) => setOptions(event.target.value)}
                placeholder="未开始, 进行中, 已完成"
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddFieldButton({
  onAdd,
}: {
  onAdd: (name: string, type: string, config?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("未开始, 进行中, 已完成");

  const handleSubmit = () => {
    if (!name.trim()) return;
    const config = buildFieldConfig(type, options) ?? undefined;
    onAdd(name.trim(), type, config);
    setName("");
    setType("text");
    setOptions("未开始, 进行中, 已完成");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
      >
        + 字段
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="字段名"
        autoFocus
        className="text-xs px-2 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-24 outline-none"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="text-xs px-1 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
      >
        {DATABASE_FIELD_TYPES.map((ft) => (
          <option key={ft.value} value={ft.value}>
            {ft.label}
          </option>
        ))}
      </select>
      {isSelectLikeFieldType(type) && (
        <input
          type="text"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="选项"
          className="text-xs px-2 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-48 outline-none"
        />
      )}
      <button onClick={handleSubmit} className="text-xs text-blue-500 hover:text-blue-600">
        添加
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600">
        取消
      </button>
    </div>
  );
}

function DatabaseTemplateButton({
  fields,
  onSelect,
}: {
  fields: DatabaseField[];
  onSelect: (template: NoteTemplate) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
      >
        + 模板行
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {NOTE_TEMPLATES.map((template) => {
            const draft = buildDatabaseTemplateRowDraft(template, fields);
            return (
              <button
                key={template.title}
                type="button"
                onClick={() => {
                  onSelect(template);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  {template.title}
                </span>
                <span className="block text-[11px] text-zinc-400">
                  {template.description}
                </span>
                <span className="mt-1 flex flex-wrap gap-1 text-[10px] text-zinc-400">
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    预填 {draft.applied_fields.length}
                  </span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    手动 {draft.skipped_fields.length}
                  </span>
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    不含敏感投资字段
                  </span>
                </span>
              </button>
            );
          })}
          <div className="border-t border-zinc-100 px-3 py-2 text-[10px] leading-4 text-zinc-400 dark:border-zinc-700">
            摘要只看模板 metadata 和字段 schema，不读取 row values 或页面正文。
          </div>
        </div>
      )}
    </div>
  );
}

function AddViewButton({
  onAdd,
}: {
  onAdd: (name: string, viewType: DatabaseView["view_type"]) => void;
}) {
  const [open, setOpen] = useState(false);

  const viewTypes: { type: DatabaseView["view_type"]; label: string; icon: string }[] = [
    { type: "table", label: getDatabaseViewTypeLabel("table"), icon: "⊞" },
    { type: "list", label: getDatabaseViewTypeLabel("list"), icon: "☰" },
    { type: "kanban", label: getDatabaseViewTypeLabel("kanban"), icon: "▥" },
    { type: "calendar", label: getDatabaseViewTypeLabel("calendar"), icon: "📅" },
    { type: "gallery", label: getDatabaseViewTypeLabel("gallery"), icon: "▦" },
    { type: "timeline", label: getDatabaseViewTypeLabel("timeline"), icon: "↔" },
    { type: "chart", label: getDatabaseViewTypeLabel("chart"), icon: "▤" },
    { type: "form", label: getDatabaseViewTypeLabel("form"), icon: "□" },
    { type: "feed", label: getDatabaseViewTypeLabel("feed"), icon: "☷" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-1.5"
      >
        + 视图
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1 w-36">
          {viewTypes.map((vt) => (
            <button
              key={vt.type}
              onClick={() => {
                onAdd(vt.label, vt.type);
                setOpen(false);
              }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-2"
            >
              <span>{vt.icon}</span>
              {vt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getRelationCompletionFields(
  fields: DatabaseField[],
  focusPage: Page | null,
  handoffSource = ""
) {
  const relationFields = fields.filter((field) => field.field_type === "relation");
  if (isProjectModuleHandoff(handoffSource)) {
    const projectPageFields = relationFields.filter((field) =>
      isProjectPageRelationFieldName(field.name)
    );
    return projectPageFields.length > 0 ? projectPageFields : relationFields;
  }
  if (!focusPage) return relationFields;

  const focusKind = classifyResearchPage(focusPage);
  if (!focusKind) return relationFields;

  const preferredFields = relationFields.filter(
    (field) => inferResearchKindFromRelationField(field.name) === focusKind
  );
  return preferredFields.length > 0 ? preferredFields : relationFields;
}

function getRelationCompletionRows(
  rows: RowWithPage[],
  visibleRows: RowWithPage[],
  focusPageId: string
) {
  const nextRows = new Map<string, RowWithPage>();
  const focusedRow = rows.find((row) => row.page_id === focusPageId);
  if (focusedRow) nextRows.set(focusedRow.id, focusedRow);

  const sourceRows = visibleRows.length > 0 ? visibleRows : rows;
  for (const row of sourceRows.slice(0, 5)) {
    nextRows.set(row.id, row);
  }

  return Array.from(nextRows.values()).slice(0, 5);
}

function getRelationHandoffSourceLabel(source: string) {
  if (source === "research-graph") return "研究图谱";
  if (source === "module-connections") return "模块关联面板";
  if (source === "company-workbench") return "公司工作台";
  if (source === "meeting-workbench") return "会议工作台";
  if (source === "portfolio-workbench") return "组合工作台";
  if (source === "projects-module") return "投研项目模块";
  return "本地模块";
}

function isProjectModuleHandoff(source: string) {
  return source === "projects-module";
}

function isProjectPageRelationFieldName(fieldName: string) {
  const normalizedName = normalizeRelationFieldName(fieldName);
  return ["Project page", "项目页", "项目页面", "投研项目页"].some((alias) => {
    const normalizedAlias = normalizeRelationFieldName(alias);
    return (
      normalizedName === normalizedAlias || normalizedName.includes(normalizedAlias)
    );
  });
}

function normalizeRelationFieldName(value: string) {
  return value.toLowerCase().replace(/[-_\s]+/g, " ").trim();
}

function getVisibleRows({
  rows,
  fields,
  relationPages,
  search,
  filterFieldId,
  filterValue,
  sortKey,
  sortDirection,
}: {
  rows: RowWithPage[];
  fields: DatabaseField[];
  relationPages: Page[];
  search: string;
  filterFieldId: string;
  filterValue: string;
  sortKey: string;
  sortDirection: SortDirection;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const normalizedFilter = filterValue.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const rowText = getRowSearchText(row, fields, relationPages).toLowerCase();
    if (normalizedSearch && !rowText.includes(normalizedSearch)) return false;
    if (!normalizedFilter) return true;

    if (filterFieldId === "all") {
      return rowText.includes(normalizedFilter);
    }

    const field = fields.find((item) => item.id === filterFieldId);
    if (!field) return true;

    return getRowFieldText(row, field, relationPages)
      .toLowerCase()
      .includes(normalizedFilter);
  });

  const sorted = [...filtered].sort((left, right) => {
    const comparison = compareRows(left, right, fields, relationPages, sortKey);
    return sortDirection === "asc" ? comparison : -comparison;
  });

  return sorted;
}

function compareRows(
  left: RowWithPage,
  right: RowWithPage,
  fields: DatabaseField[],
  relationPages: Page[],
  sortKey: string
) {
  if (sortKey === "position") return left.position - right.position;
  if (sortKey === "name") return compareValues(left.page?.title, right.page?.title);
  if (sortKey === "created") return compareValues(left.created_at, right.created_at);
  if (sortKey === "updated") return compareValues(left.updated_at, right.updated_at);

  if (sortKey.startsWith("field:")) {
    const fieldId = sortKey.slice("field:".length);
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return 0;
    if (field.field_type === "relation") {
      return compareValues(
        getRowFieldText(left, field, relationPages),
        getRowFieldText(right, field, relationPages)
      );
    }
    return compareValues(getRowFieldValue(left, field), getRowFieldValue(right, field));
  }

  return 0;
}

function compareValues(left: unknown, right: unknown) {
  const leftText = stringifyValue(left);
  const rightText = stringifyValue(right);
  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);

  if (leftText && rightText && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return leftText.localeCompare(rightText, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getRowSearchText(
  row: RowWithPage,
  fields: DatabaseField[],
  relationPages: Page[]
) {
  return [
    row.page?.title ?? "",
    row.created_at,
    row.updated_at,
    ...fields.map((field) => getRowFieldText(row, field, relationPages)),
  ].join(" ");
}

function getRowFieldText(
  row: RowWithPage,
  field: DatabaseField,
  relationPages: Page[]
) {
  if (field.position === 0 || field.name === "Name") {
    return row.page?.title ?? "";
  }
  const value = getRowFieldValue(row, field);
  if (field.field_type === "relation") {
    return stringifyRelationValue(value, relationPages);
  }
  return stringifyValue(value);
}

function getRowFieldValue(row: RowWithPage, field: DatabaseField) {
  const values = parseFieldValues(row.field_values);
  return values[field.id];
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function parseDatabaseViewConfig(config: string): DatabaseViewConfig {
  const fallback: DatabaseViewConfig = {
    rowSearch: "",
    filterFieldId: "all",
    filterValue: "",
    sortKey: "position",
    sortDirection: "asc",
    hiddenFieldIds: [],
    chartGroupFieldId: "",
  };

  try {
    const parsed = JSON.parse(config || "{}") as Partial<DatabaseViewConfig>;
    return {
      rowSearch: typeof parsed.rowSearch === "string" ? parsed.rowSearch : "",
      filterFieldId:
        typeof parsed.filterFieldId === "string" ? parsed.filterFieldId : "all",
      filterValue: typeof parsed.filterValue === "string" ? parsed.filterValue : "",
      sortKey: typeof parsed.sortKey === "string" ? parsed.sortKey : "position",
      sortDirection: parsed.sortDirection === "desc" ? "desc" : "asc",
      hiddenFieldIds: parseStringArray(parsed.hiddenFieldIds),
      chartGroupFieldId:
        typeof parsed.chartGroupFieldId === "string" ? parsed.chartGroupFieldId : "",
    };
  } catch {
    return fallback;
  }
}

function getVisibleFields(fields: DatabaseField[], hiddenFieldIds: string[]) {
  const hiddenFieldSet = new Set(hiddenFieldIds);
  return fields.filter(
    (field) => field.position === 0 || !hiddenFieldSet.has(field.id)
  );
}

function isChartableField(field: DatabaseField) {
  return [
    "status",
    "select",
    "relation",
    "date",
    "checkbox",
    "number",
  ].includes(field.field_type);
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
