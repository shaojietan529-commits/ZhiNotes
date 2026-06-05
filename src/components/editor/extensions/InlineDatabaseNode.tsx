"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  updateDatabase,
} from "@/lib/db/local/queries";
import type {
  Database,
  DatabaseField,
  DatabaseRow,
  DatabaseView,
  Page,
} from "@/lib/utils/types";
import { NOTE_TEMPLATES, type NoteTemplate } from "@/lib/templates/noteTemplates";
import TableView from "@/components/database/views/TableView";
import ListView from "@/components/database/views/ListView";
import KanbanView from "@/components/database/views/KanbanView";
import CalendarView from "@/components/database/views/CalendarView";
import GalleryView from "@/components/database/views/GalleryView";
import TimelineView from "@/components/database/views/TimelineView";
import ChartView from "@/components/database/views/ChartView";
import FormView from "@/components/database/views/FormView";
import FeedView from "@/components/database/views/FeedView";
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
  getDatabaseButtonConfig,
  getDatabaseFieldDescription,
  isSelectLikeFieldType,
} from "@/lib/database/fields";
import { stringifyRelationValue } from "@/lib/database/relationValues";
import { formatDatabaseNumberValue } from "@/lib/database/numberValues";
import { evaluateDatabaseFormula } from "@/lib/database/formula";
import { evaluateDatabaseRollup } from "@/lib/database/rollup";
import {
  getDatabaseSystemFieldValue,
  isDatabaseSystemField,
} from "@/lib/database/systemFields";
import {
  appendDatabaseTemplateRowReceipt,
  buildDatabaseTemplateRowDraft,
  buildDatabaseTemplateRowReceipt,
} from "@/lib/database/databaseTemplateRows";

// ─── React Component rendered inside the editor ─────────────

type RowWithPage = DatabaseRow & { page: Page };
type SortDirection = "asc" | "desc";
type InlineDatabaseFilterMatchMode = "all" | "any";
type InlineDatabaseFilterOperator =
  | "contains"
  | "does_not_contain"
  | "equals"
  | "does_not_equal"
  | "greater_than"
  | "less_than"
  | "before"
  | "after"
  | "is_empty"
  | "is_not_empty";

interface InlineDatabaseFilterRule {
  id: string;
  fieldId: string;
  operator: InlineDatabaseFilterOperator;
  value: string;
}

interface InlineDatabaseSortRule {
  id: string;
  key: string;
  direction: SortDirection;
}

interface InlineDatabaseRowGroup {
  id: string;
  label: string;
  rows: RowWithPage[];
}

interface InlineDatabaseViewConfig {
  rowSearch: string;
  filterFieldId: string;
  filterValue: string;
  filterRules: InlineDatabaseFilterRule[];
  filterMatchMode: InlineDatabaseFilterMatchMode;
  sortKey: string;
  sortDirection: SortDirection;
  sortRules: InlineDatabaseSortRule[];
  groupFieldId: string;
  hiddenFieldIds: string[];
  chartGroupFieldId: string;
  dateFieldId: string;
}

function InlineDatabaseComponent({ node }: { node: ProseMirrorNode }) {
  const router = useRouter();
  const { pages: workspacePages } = usePages();
  const databaseId: string = node.attrs.databaseId;

  const [database, setDatabase] = useState<Database | null>(null);
  const [fields, setFields] = useState<DatabaseField[]>([]);
  const [rows, setRows] = useState<RowWithPage[]>([]);
  const [views, setViews] = useState<DatabaseView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

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
    if (v.length > 0 && !activeViewId) setActiveViewId(v[0].id);
    setLoading(false);
  }, [databaseId, activeViewId]);

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
      const field = fields.find((item) => item.id === fieldId);
      const fieldName = field ? getDatabaseFieldDisplayName(field) : "这个字段";
      const ok = window.confirm(
        `要删除字段「${fieldName}」吗？这会从当前数据库视图中移除字段配置，但不会删除页面正文、文件、云端数据或 AI 内容。`
      );
      if (!ok) return;
      await deleteField(fieldId);
      reload();
    },
    [fields, reload]
  );

  const handleDuplicateField = useCallback(
    async (field: DatabaseField) => {
      await addField(databaseId, {
        name: `${getDatabaseFieldDisplayName(field)} 副本`,
        fieldType: field.field_type,
        config: field.config ?? undefined,
      });
      reload();
    },
    [databaseId, reload]
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

  const handleMoveField = useCallback(
    async (fieldId: string, direction: "up" | "down") => {
      const orderedFields = [...fields].sort(
        (left, right) => left.position - right.position
      );
      const currentIndex = orderedFields.findIndex(
        (field) => field.id === fieldId
      );
      if (currentIndex <= 0) return;
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const currentField = orderedFields[currentIndex];
      const targetField = orderedFields[targetIndex];
      if (!currentField || !targetField || targetField.position === 0) return;

      await Promise.all([
        updateField(currentField.id, { position: targetField.position }),
        updateField(targetField.id, { position: currentField.position }),
      ]);
      reload();
    },
    [fields, reload]
  );

  const handleAddRow = useCallback(async () => {
    await addRow(databaseId);
    reload();
  }, [databaseId, reload]);

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
      appendDatabaseTemplateRowReceipt(
        buildDatabaseTemplateRowReceipt({
          template,
          draft,
          row,
          source_surface: "inline-database",
        })
      );
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
      const row = rows.find((item) => item.id === rowId);
      const rowTitle = row?.page?.title || "未命名页面";
      const ok = window.confirm(
        `要删除记录「${rowTitle}」吗？这会把当前数据库行和它的本地页面一起软删除，不会上传或外发任何内容。`
      );
      if (!ok) return;
      await deleteRow(rowId);
      reload();
    },
    [reload, rows]
  );

  const handleMoveRow = useCallback(
    async (rowId: string, direction: "up" | "down") => {
      const orderedRows = [...rows].sort(
        (left, right) => left.position - right.position
      );
      const currentIndex = orderedRows.findIndex((row) => row.id === rowId);
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const currentRow = orderedRows[currentIndex];
      const targetRow = orderedRows[targetIndex];
      if (!currentRow || !targetRow) return;

      await Promise.all([
        updateRow(currentRow.id, { position: targetRow.position }),
        updateRow(targetRow.id, { position: currentRow.position }),
      ]);
      reload();
    },
    [reload, rows]
  );

  const handleDuplicateRow = useCallback(
    async (rowId: string) => {
      const sourceRow = rows.find((row) => row.id === rowId);
      if (!sourceRow) return;
      const fieldValues = parseFieldValues(sourceRow.field_values);
      await addRow(databaseId, {
        title: `${sourceRow.page?.title || "未命名页面"} 副本`,
        fieldValues,
      });
      reload();
    },
    [databaseId, reload, rows]
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

  const activeView = views.find((v) => v.id === activeViewId) || views[0];
  const activeViewConfig = useMemo(
    () => parseInlineDatabaseViewConfig(activeView?.config ?? "{}"),
    [activeView?.config]
  );
  const visibleFields = useMemo(
    () => getInlineVisibleFields(fields, activeViewConfig.hiddenFieldIds),
    [fields, activeViewConfig.hiddenFieldIds]
  );
  const visibleRows = useMemo(
    () =>
      getInlineVisibleRows({
        rows,
        fields,
        relationPages: workspacePages,
        search: activeViewConfig.rowSearch,
        filterRules: activeViewConfig.filterRules,
        filterMatchMode: activeViewConfig.filterMatchMode,
        sortRules: activeViewConfig.sortRules,
      }),
    [
      rows,
      fields,
      workspacePages,
      activeViewConfig.rowSearch,
      activeViewConfig.filterRules,
      activeViewConfig.filterMatchMode,
      activeViewConfig.sortRules,
    ]
  );
  const groupField = useMemo(
    () => fields.find((field) => field.id === activeViewConfig.groupFieldId) ?? null,
    [fields, activeViewConfig.groupFieldId]
  );
  const rowGroups = useMemo(
    () =>
      groupField && isInlineGroupableField(groupField)
        ? buildInlineDatabaseRowGroups({
            rows: visibleRows,
            fields,
            field: groupField,
            relationPages: workspacePages,
          })
        : [],
    [fields, groupField, visibleRows, workspacePages]
  );
  const usesGroupedRows =
    groupField !== null &&
    Boolean(activeView) &&
    isInlineGroupableField(groupField) &&
    isInlineGroupedViewType(activeView?.view_type);

  if (loading) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
        </div>
      </NodeViewWrapper>
    );
  }

  if (!database) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 text-sm text-zinc-400">
          数据库不存在
        </div>
      </NodeViewWrapper>
    );
  }

  const viewProps = {
    fields,
    rows: visibleRows,
    onAddRow: handleAddRow,
    onUpdateRow: handleUpdateRow,
    onDeleteRow: handleDeleteRow,
    onDuplicateRow: handleDuplicateRow,
    onMoveRow: handleMoveRow,
    canMoveRows: isDefaultInlineSortRules(activeViewConfig.sortRules),
    onOpenRow: handleOpenRow,
    onOpenPage: handleOpenPage,
    relationPages: workspacePages,
    groupFieldId: activeViewConfig.groupFieldId,
    dateFieldId: activeViewConfig.dateFieldId,
  };
  const visibleFieldViewProps = {
    ...viewProps,
    fields: visibleFields,
  };

  return (
    <NodeViewWrapper className="my-4" data-type="inline-database">
      <div
        className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900"
        contentEditable={false}
      >
        {/* Database header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <span className="text-lg">{database.icon || "🗄️"}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="数据库标题"
            className="text-base font-semibold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 flex-1"
          />
          <button
            onClick={() => router.push(`/database/${databaseId}`)}
            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 transition-colors"
            title="作为完整页面打开"
          >
            打开 ↗
          </button>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 px-4 border-b border-zinc-200 dark:border-zinc-700">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveViewId(view.id)}
              className={`px-2 py-1 text-xs rounded-t transition-colors ${
                activeView?.id === view.id
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium border border-b-0 border-zinc-200 dark:border-zinc-700 -mb-px"
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
          <InlineAddViewButton onAdd={handleAddView} />
        </div>

        {/* Field bar */}
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400">字段：</span>
          {fields.map((field) => {
            const fieldDescription = getDatabaseFieldDescription(field);
            return (
              <span
                key={field.id}
                title={fieldDescription || undefined}
                className="inline-flex items-center gap-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded px-1.5 py-0.5"
              >
                {getDatabaseFieldDisplayName(field)}
                <span className="text-zinc-400">
                  ({getDatabaseFieldTypeLabel(field.field_type)})
                </span>
                {fieldDescription && (
                  <span className="rounded bg-white px-1 text-[9px] text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                    说明
                  </span>
                )}
                <InlineFieldSettingsButton
                  field={field}
                  fields={fields}
                  onUpdate={handleUpdateField}
                  onDuplicate={handleDuplicateField}
                  onMove={handleMoveField}
              />
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
            );
          })}
          <InlineAddFieldButton onAdd={handleAddField} />
          <InlineTemplateRowButton
            fields={fields}
            onSelect={handleAddTemplateRow}
          />
        </div>

        {/* View content */}
        <div className="px-4 py-3">
          {usesGroupedRows ? (
            <div className="space-y-3">
              {rowGroups.length === 0 ? (
                <p className="rounded-md border border-dashed border-zinc-200 px-3 py-5 text-center text-xs text-zinc-400 dark:border-zinc-700">
                  当前分组没有可显示的行。
                </p>
              ) : (
                rowGroups.map((group) => (
                  <section
                    key={group.id}
                    className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="min-w-0 truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                        {group.label}
                      </h4>
                      <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                        {group.rows.length} 行
                      </span>
                    </div>
                    {activeView?.view_type === "table" && (
                      <TableView
                        {...visibleFieldViewProps}
                        rows={group.rows}
                        showAddRow={false}
                      />
                    )}
                    {activeView?.view_type === "list" && (
                      <ListView
                        {...visibleFieldViewProps}
                        rows={group.rows}
                        showAddRow={false}
                      />
                    )}
                    {activeView?.view_type === "gallery" && (
                      <GalleryView
                        {...visibleFieldViewProps}
                        rows={group.rows}
                        showAddRow={false}
                      />
                    )}
                    {activeView?.view_type === "feed" && (
                      <FeedView
                        {...viewProps}
                        rows={group.rows}
                        showAddRow={false}
                      />
                    )}
                  </section>
                ))
              )}
              <button
                type="button"
                onClick={handleAddRow}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                + 新建行
              </button>
            </div>
          ) : (
            <>
              {activeView?.view_type === "table" && (
                <TableView {...visibleFieldViewProps} />
              )}
              {activeView?.view_type === "list" && (
                <ListView {...visibleFieldViewProps} />
              )}
              {activeView?.view_type === "kanban" && <KanbanView {...viewProps} />}
              {activeView?.view_type === "calendar" && (
                <CalendarView {...viewProps} />
              )}
              {activeView?.view_type === "gallery" && (
                <GalleryView {...visibleFieldViewProps} />
              )}
              {activeView?.view_type === "timeline" && (
                <TimelineView {...viewProps} />
              )}
              {activeView?.view_type === "chart" && (
                <ChartView
                  fields={fields}
                  rows={visibleRows}
                  chartGroupFieldId={activeViewConfig.chartGroupFieldId}
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
              {activeView?.view_type === "feed" && <FeedView {...viewProps} />}
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseInlineDatabaseViewConfig(config: string): InlineDatabaseViewConfig {
  const fallback: InlineDatabaseViewConfig = {
    rowSearch: "",
    filterFieldId: "all",
    filterValue: "",
    filterRules: [],
    filterMatchMode: "all",
    sortKey: "position",
    sortDirection: "asc",
    sortRules: [createInlineDatabaseSortRule("position", "asc")],
    groupFieldId: "",
    hiddenFieldIds: [],
    chartGroupFieldId: "",
    dateFieldId: "",
  };

  try {
    const parsed = JSON.parse(config || "{}") as Partial<InlineDatabaseViewConfig>;
    const filterFieldId =
      typeof parsed.filterFieldId === "string" ? parsed.filterFieldId : "all";
    const filterValue =
      typeof parsed.filterValue === "string" ? parsed.filterValue : "";
    const sortKey =
      typeof parsed.sortKey === "string" ? parsed.sortKey : "position";
    const sortDirection = parsed.sortDirection === "desc" ? "desc" : "asc";

    return {
      rowSearch: typeof parsed.rowSearch === "string" ? parsed.rowSearch : "",
      filterFieldId,
      filterValue,
      filterRules: parseInlineDatabaseFilterRules(
        parsed.filterRules,
        filterFieldId,
        filterValue
      ),
      filterMatchMode: parseInlineDatabaseFilterMatchMode(
        parsed.filterMatchMode
      ),
      sortKey,
      sortDirection,
      sortRules: parseInlineDatabaseSortRules(
        parsed.sortRules,
        sortKey,
        sortDirection
      ),
      groupFieldId:
        typeof parsed.groupFieldId === "string" ? parsed.groupFieldId : "",
      hiddenFieldIds: parseInlineStringArray(parsed.hiddenFieldIds),
      chartGroupFieldId:
        typeof parsed.chartGroupFieldId === "string"
          ? parsed.chartGroupFieldId
          : "",
      dateFieldId:
        typeof parsed.dateFieldId === "string" ? parsed.dateFieldId : "",
    };
  } catch {
    return fallback;
  }
}

function getInlineVisibleFields(
  fields: DatabaseField[],
  hiddenFieldIds: string[]
) {
  const hiddenFieldSet = new Set(hiddenFieldIds);
  return fields.filter(
    (field) => field.position === 0 || !hiddenFieldSet.has(field.id)
  );
}

function getInlineVisibleRows({
  rows,
  fields,
  relationPages,
  search,
  filterRules,
  filterMatchMode,
  sortRules,
}: {
  rows: RowWithPage[];
  fields: DatabaseField[];
  relationPages: Page[];
  search: string;
  filterRules: InlineDatabaseFilterRule[];
  filterMatchMode: InlineDatabaseFilterMatchMode;
  sortRules: InlineDatabaseSortRule[];
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const activeFilterRules = filterRules
    .filter(isActiveInlineDatabaseFilterRule)
    .map((rule) => ({
      ...rule,
      normalizedValue: rule.value.trim().toLowerCase(),
    }));
  const activeSortRules = sortRules.length
    ? sortRules
    : [createInlineDatabaseSortRule("position", "asc")];

  const filtered = rows.filter((row) => {
    const rowText = getInlineRowSearchText(row, fields, relationPages).toLowerCase();
    if (normalizedSearch && !rowText.includes(normalizedSearch)) return false;

    const matchesRule = (
      rule: InlineDatabaseFilterRule & { normalizedValue: string }
    ) => {
      if (rule.fieldId === "all") {
        return matchesInlineDatabaseFilterText(rowText, rule);
      }

      const field = fields.find((item) => item.id === rule.fieldId);
      if (!field) return true;

      return matchesInlineDatabaseFilterText(
        getInlineRowFieldText(row, field, fields, relationPages).toLowerCase(),
        rule
      );
    };

    if (activeFilterRules.length === 0) return true;
    return filterMatchMode === "any"
      ? activeFilterRules.some(matchesRule)
      : activeFilterRules.every(matchesRule);
  });

  return [...filtered].sort((left, right) => {
    for (const rule of activeSortRules) {
      const comparison = compareInlineRows(
        left,
        right,
        fields,
        relationPages,
        rule.key
      );
      if (comparison !== 0) {
        return rule.direction === "asc" ? comparison : -comparison;
      }
    }
    return left.position - right.position;
  });
}

function isInlineGroupableField(field: DatabaseField) {
  return !["url", "email", "phone"].includes(field.field_type);
}

function isInlineGroupedViewType(
  viewType: DatabaseView["view_type"] | undefined
) {
  return ["table", "list", "gallery", "feed"].includes(viewType ?? "");
}

function buildInlineDatabaseRowGroups({
  rows,
  fields,
  field,
  relationPages,
}: {
  rows: RowWithPage[];
  fields: DatabaseField[];
  field: DatabaseField;
  relationPages: Page[];
}): InlineDatabaseRowGroup[] {
  const groups = new Map<string, InlineDatabaseRowGroup>();

  for (const row of rows) {
    const labels = getInlineDatabaseRowGroupLabels(
      row,
      field,
      fields,
      relationPages
    );
    for (const label of labels) {
      const groupId = `${field.id}:${label}`;
      const group: InlineDatabaseRowGroup =
        groups.get(groupId) ?? { id: groupId, label, rows: [] };
      group.rows.push(row);
      groups.set(groupId, group);
    }
  }

  return Array.from(groups.values());
}

function getInlineDatabaseRowGroupLabels(
  row: RowWithPage,
  field: DatabaseField,
  fields: DatabaseField[],
  relationPages: Page[]
) {
  if (field.position === 0 || field.name === "Name") {
    return [row.page?.title || "无值"];
  }

  if (field.field_type === "checkbox") {
    return [
      getInlineRowFieldValue(row, field, fields, relationPages) ? "是" : "否",
    ];
  }

  if (
    field.field_type === "date" ||
    field.field_type === "created_time" ||
    field.field_type === "last_edited_time"
  ) {
    const value = String(
      getInlineRowFieldValue(row, field, fields, relationPages) ?? ""
    );
    return [value ? value.slice(0, 7) : "无日期"];
  }

  const text = getInlineRowFieldText(row, field, fields, relationPages).trim();
  const labels = text
    .split(",")
    .map((item: string) => item.trim())
    .filter(Boolean);
  return labels.length > 0 ? labels : ["无值"];
}

function compareInlineRows(
  left: RowWithPage,
  right: RowWithPage,
  fields: DatabaseField[],
  relationPages: Page[],
  sortKey: string
) {
  if (sortKey === "position") return left.position - right.position;
  if (sortKey === "name") return compareInlineValues(left.page?.title, right.page?.title);
  if (sortKey === "created") return compareInlineValues(left.created_at, right.created_at);
  if (sortKey === "updated") return compareInlineValues(left.updated_at, right.updated_at);

  if (sortKey.startsWith("field:")) {
    const fieldId = sortKey.slice("field:".length);
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return 0;
    if (field.field_type === "relation") {
      return compareInlineValues(
        getInlineRowFieldText(left, field, fields, relationPages),
        getInlineRowFieldText(right, field, fields, relationPages)
      );
    }
    return compareInlineValues(
      getInlineRowFieldValue(left, field, fields, relationPages),
      getInlineRowFieldValue(right, field, fields, relationPages)
    );
  }

  return 0;
}

function getInlineRowSearchText(
  row: RowWithPage,
  fields: DatabaseField[],
  relationPages: Page[]
) {
  return [
    row.page?.title ?? "",
    row.created_at,
    row.updated_at,
    ...fields.map((field) =>
      getInlineRowFieldText(row, field, fields, relationPages)
    ),
  ].join(" ");
}

function getInlineRowFieldText(
  row: RowWithPage,
  field: DatabaseField,
  fields: DatabaseField[],
  relationPages: Page[]
) {
  if (field.position === 0 || field.name === "Name") {
    return row.page?.title ?? "";
  }
  const value = getInlineRowFieldValue(row, field, fields, relationPages);
  if (field.field_type === "relation") {
    return stringifyRelationValue(value, relationPages);
  }
  if (field.field_type === "number") {
    return formatDatabaseNumberValue(value, field);
  }
  if (field.field_type === "formula") {
    const values = parseFieldValues(row.field_values);
    return evaluateDatabaseFormula(field, fields, row, values).label;
  }
  if (field.field_type === "rollup") {
    const values = parseFieldValues(row.field_values);
    return evaluateDatabaseRollup(field, fields, values, relationPages).label;
  }
  if (field.field_type === "button") {
    return getDatabaseButtonConfig(field).label;
  }
  return stringifyInlineValue(value);
}

function getInlineRowFieldValue(
  row: RowWithPage,
  field: DatabaseField,
  fields: DatabaseField[],
  relationPages: Page[]
) {
  if (isDatabaseSystemField(field)) {
    return getDatabaseSystemFieldValue(row, field);
  }
  const values = parseFieldValues(row.field_values);
  if (field.field_type === "formula") {
    return evaluateDatabaseFormula(field, fields, row, values).value;
  }
  if (field.field_type === "rollup") {
    return evaluateDatabaseRollup(field, fields, values, relationPages).value;
  }
  return values[field.id];
}

function parseInlineDatabaseFilterRules(
  value: unknown,
  legacyFieldId: string,
  legacyValue: string
): InlineDatabaseFilterRule[] {
  const rules = Array.isArray(value)
    ? value
        .map((item, index) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as Partial<InlineDatabaseFilterRule>;
          if (
            typeof candidate.fieldId !== "string"
          ) {
            return null;
          }
          return {
            id:
              typeof candidate.id === "string"
                ? candidate.id
                : `inline-filter-${index + 1}`,
            fieldId: candidate.fieldId,
            operator: parseInlineDatabaseFilterOperator(candidate.operator),
            value: typeof candidate.value === "string" ? candidate.value : "",
          };
        })
        .filter((item): item is InlineDatabaseFilterRule => Boolean(item))
    : [];

  if (rules.length > 0) return rules;
  if (!legacyValue.trim()) return [];
  return [createInlineDatabaseFilterRule(legacyFieldId || "all", legacyValue)];
}

function parseInlineDatabaseFilterOperator(
  value: unknown
): InlineDatabaseFilterOperator {
  return value === "does_not_contain" ||
    value === "equals" ||
    value === "does_not_equal" ||
    value === "greater_than" ||
    value === "less_than" ||
    value === "before" ||
    value === "after" ||
    value === "is_empty" ||
    value === "is_not_empty"
    ? value
    : "contains";
}

function parseInlineDatabaseFilterMatchMode(
  value: unknown
): InlineDatabaseFilterMatchMode {
  return value === "any" ? "any" : "all";
}

function isValueBasedInlineDatabaseFilterOperator(
  operator: InlineDatabaseFilterOperator
) {
  return operator !== "is_empty" && operator !== "is_not_empty";
}

function isActiveInlineDatabaseFilterRule(rule: InlineDatabaseFilterRule) {
  return isValueBasedInlineDatabaseFilterOperator(rule.operator)
    ? rule.value.trim().length > 0
    : true;
}

function matchesInlineDatabaseFilterText(
  text: string,
  rule: InlineDatabaseFilterRule & { normalizedValue: string }
) {
  const normalizedText = text.trim().toLowerCase();
  if (rule.operator === "does_not_contain") {
    return !normalizedText.includes(rule.normalizedValue);
  }
  if (rule.operator === "equals") {
    return normalizedText === rule.normalizedValue;
  }
  if (rule.operator === "does_not_equal") {
    return normalizedText !== rule.normalizedValue;
  }
  if (rule.operator === "greater_than") {
    return compareInlineDatabaseFilterComparable(
      normalizedText,
      rule.normalizedValue
    ) > 0;
  }
  if (rule.operator === "less_than") {
    return compareInlineDatabaseFilterComparable(
      normalizedText,
      rule.normalizedValue
    ) < 0;
  }
  if (rule.operator === "before") {
    return (
      compareInlineDatabaseFilterDates(normalizedText, rule.normalizedValue) < 0
    );
  }
  if (rule.operator === "after") {
    return (
      compareInlineDatabaseFilterDates(normalizedText, rule.normalizedValue) > 0
    );
  }
  if (rule.operator === "is_empty") {
    return normalizedText.length === 0;
  }
  if (rule.operator === "is_not_empty") {
    return normalizedText.length > 0;
  }
  return normalizedText.includes(rule.normalizedValue);
}

function compareInlineDatabaseFilterComparable(left: string, right: string) {
  const leftNumber = parseInlineDatabaseFilterNumber(left);
  const rightNumber = parseInlineDatabaseFilterNumber(right);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }
  return compareInlineDatabaseFilterDates(left, right);
}

function compareInlineDatabaseFilterDates(left: string, right: string) {
  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
    return leftDate - rightDate;
  }
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function parseInlineDatabaseFilterNumber(value: string) {
  const cleaned = value.replace(/[$¥,%x\s]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function parseInlineDatabaseSortRules(
  value: unknown,
  legacyKey: string,
  legacyDirection: SortDirection
): InlineDatabaseSortRule[] {
  const rules = Array.isArray(value)
    ? value
        .map((item, index) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as Partial<InlineDatabaseSortRule>;
          if (typeof candidate.key !== "string") return null;
          return {
            id:
              typeof candidate.id === "string"
                ? candidate.id
                : `inline-sort-${index + 1}`,
            key: candidate.key,
            direction: candidate.direction === "desc" ? "desc" : "asc",
          };
        })
        .filter((item): item is InlineDatabaseSortRule => Boolean(item))
    : [];

  if (rules.length > 0) return rules;
  return [createInlineDatabaseSortRule(legacyKey || "position", legacyDirection)];
}

function createInlineDatabaseFilterRule(
  fieldId = "all",
  value = "",
  operator: InlineDatabaseFilterOperator = "contains"
): InlineDatabaseFilterRule {
  return {
    id: `inline-filter-${fieldId}`,
    fieldId,
    operator,
    value,
  };
}

function createInlineDatabaseSortRule(
  key = "position",
  direction: SortDirection = "asc"
): InlineDatabaseSortRule {
  return {
    id: `inline-sort-${key}`,
    key,
    direction,
  };
}

function isDefaultInlineSortRules(sortRules: InlineDatabaseSortRule[]) {
  return (
    sortRules.length === 0 ||
    (sortRules.length === 1 &&
      sortRules[0].key === "position" &&
      sortRules[0].direction === "asc")
  );
}

function parseInlineStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function compareInlineValues(left: unknown, right: unknown) {
  const leftText = stringifyInlineValue(left);
  const rightText = stringifyInlineValue(right);
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

function stringifyInlineValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

// ─── Small helper components ────────────────────────────────

function InlineFieldSettingsButton({
  field,
  fields,
  onUpdate,
  onDuplicate,
  onMove,
}: {
  field: DatabaseField;
  fields: DatabaseField[];
  onUpdate: (
    fieldId: string,
    updates: Partial<Pick<DatabaseField, "name" | "field_type" | "config">>
  ) => void;
  onDuplicate: (field: DatabaseField) => void;
  onMove: (fieldId: string, direction: "up" | "down") => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(getDatabaseFieldDisplayName(field));
  const [type, setType] = useState(field.field_type);
  const [options, setOptions] = useState(formatFieldOptions(field));
  const [fieldDescription, setFieldDescription] = useState(
    getDatabaseFieldDescription(field)
  );
  const isTitleField = field.position === 0;
  const orderedFields = [...fields].sort(
    (left, right) => left.position - right.position
  );
  const fieldIndex = orderedFields.findIndex((item) => item.id === field.id);
  const canMoveUp = fieldIndex > 1;
  const canMoveDown = fieldIndex >= 1 && fieldIndex < orderedFields.length - 1;

  useEffect(() => {
    setName(getDatabaseFieldDisplayName(field));
    setType(field.field_type);
    setOptions(formatFieldOptions(field));
    setFieldDescription(getDatabaseFieldDescription(field));
  }, [field]);

  const handleSave = () => {
    const nextType = isTitleField ? field.field_type : type;
    onUpdate(field.id, {
      name: name.trim() || getDatabaseFieldDisplayName(field),
      field_type: nextType,
      config: buildFieldConfig(
        nextType,
        options,
        undefined,
        undefined,
        undefined,
        undefined,
        fieldDescription
      ),
    });
    setOpen(false);
  };

  const handleDuplicate = () => {
    onDuplicate(field);
    setOpen(false);
  };

  const handleMove = (direction: "up" | "down") => {
    onMove(field.id, direction);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded px-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        title="编辑字段属性"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-zinc-500">
              字段名
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="mt-2 block">
            <span className="mb-1 block text-[10px] font-medium text-zinc-500">
              类型
            </span>
            <select
              value={type}
              disabled={isTitleField}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-400 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {DATABASE_FIELD_TYPES.map((fieldType) => (
                <option key={fieldType.value} value={fieldType.value}>
                  {fieldType.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block">
            <span className="mb-1 block text-[10px] font-medium text-zinc-500">
              字段说明
            </span>
            <textarea
              value={fieldDescription}
              onChange={(event) => setFieldDescription(event.target.value)}
              rows={3}
              placeholder="写字段口径说明"
              className="w-full resize-none rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] leading-5 text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <span className="mt-1 block text-[10px] text-zinc-400">
              只保存字段说明，不读取或改写行值。
            </span>
          </label>
          {isSelectLikeFieldType(type) && (
            <label className="mt-2 block">
              <span className="mb-1 block text-[10px] font-medium text-zinc-500">
                选项
              </span>
              <input
                type="text"
                value={options}
                onChange={(event) => setOptions(event.target.value)}
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          )}
          <div className="mt-2 rounded-md border border-zinc-100 p-2 dark:border-zinc-700">
            <p className="text-[10px] font-medium text-zinc-500">
              字段顺序
            </p>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => handleMove("up")}
                disabled={!canMoveUp}
                className="rounded border border-zinc-200 px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:cursor-default disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                title="只调整字段位置，不改行值"
              >
                前移
              </button>
              <button
                type="button"
                onClick={() => handleMove("down")}
                disabled={!canMoveDown}
                className="rounded border border-zinc-200 px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:cursor-default disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                title="只调整字段位置，不改行值"
              >
                后移
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={handleDuplicate}
              className="mr-auto rounded border border-zinc-200 px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              title="复制字段配置，不复制已有行值"
            >
              复制字段
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineAddFieldButton({
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
        className="text-[10px] text-zinc-400 hover:text-zinc-600 px-1.5 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-600"
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
        className="text-[10px] px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-20 outline-none"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="text-[10px] px-1 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
      >
        {DATABASE_FIELD_TYPES.map((fieldType) => (
          <option key={fieldType.value} value={fieldType.value}>
            {fieldType.label}
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
          className="text-[10px] px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-40 outline-none"
        />
      )}
      <button onClick={handleSubmit} className="text-[10px] text-blue-500">
        添加
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] text-zinc-400"
      >
        取消
      </button>
    </div>
  );
}

function InlineTemplateRowButton({
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
        className="text-[10px] text-zinc-400 hover:text-zinc-600 px-1.5 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-600"
      >
        + 模板行
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
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
                className="w-full px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <span className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                  {template.title}
                </span>
                <span className="block truncate text-[10px] text-zinc-400">
                  {template.description}
                </span>
                <span className="mt-1 flex flex-wrap gap-1 text-[10px] text-zinc-400">
                  <span className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    预填 {draft.applied_fields.length}
                  </span>
                  <span className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    手动 {draft.skipped_fields.length}
                  </span>
                </span>
              </button>
            );
          })}
          <div className="border-t border-zinc-100 px-2 py-1.5 text-[10px] leading-4 text-zinc-400 dark:border-zinc-700">
            只看模板 metadata 和字段 schema。
          </div>
        </div>
      )}
    </div>
  );
}

function InlineAddViewButton({
  onAdd,
}: {
  onAdd: (name: string, viewType: DatabaseView["view_type"]) => void;
}) {
  const [open, setOpen] = useState(false);

  const viewTypes: {
    type: DatabaseView["view_type"];
    label: string;
    icon: string;
  }[] = [
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
        className="text-[10px] text-zinc-400 hover:text-zinc-600 px-1 py-0.5"
      >
        + 视图
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1 w-28">
          {viewTypes.map((vt) => (
            <button
              key={vt.type}
              onClick={() => {
                onAdd(vt.label, vt.type);
                setOpen(false);
              }}
              className="w-full px-2 py-1 text-[11px] text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
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

// ─── Tiptap Node Extension ──────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineDatabase: {
      insertInlineDatabase: (databaseId: string) => ReturnType;
    };
  }
}

export const InlineDatabaseNode = Node.create({
  name: "inlineDatabase",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-database-id"),
        renderHTML: (attributes) => ({
          "data-database-id": attributes.databaseId,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="inline-database"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "inline-database" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineDatabaseComponent);
  },

  addCommands() {
    return {
      insertInlineDatabase:
        (databaseId: string) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { databaseId },
            })
            .run();
        },
    };
  },
});
