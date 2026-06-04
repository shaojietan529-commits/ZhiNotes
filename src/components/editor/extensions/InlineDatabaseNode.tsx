"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useEffect, useCallback } from "react";
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
  isSelectLikeFieldType,
} from "@/lib/database/fields";
import {
  appendDatabaseTemplateRowReceipt,
  buildDatabaseTemplateRowDraft,
  buildDatabaseTemplateRowReceipt,
} from "@/lib/database/databaseTemplateRows";

// ─── React Component rendered inside the editor ─────────────

type RowWithPage = DatabaseRow & { page: Page };

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

  const activeView = views.find((v) => v.id === activeViewId) || views[0];

  const viewProps = {
    fields,
    rows,
    onAddRow: handleAddRow,
    onUpdateRow: handleUpdateRow,
    onDeleteRow: handleDeleteRow,
    onOpenRow: handleOpenRow,
    onOpenPage: handleOpenPage,
    relationPages: workspacePages,
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
          {fields.map((field) => (
            <span
              key={field.id}
              className="inline-flex items-center gap-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded px-1.5 py-0.5"
            >
              {getDatabaseFieldDisplayName(field)}
              <span className="text-zinc-400">
                ({getDatabaseFieldTypeLabel(field.field_type)})
              </span>
              <InlineFieldSettingsButton
                field={field}
                onUpdate={handleUpdateField}
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
          ))}
          <InlineAddFieldButton onAdd={handleAddField} />
          <InlineTemplateRowButton
            fields={fields}
            onSelect={handleAddTemplateRow}
          />
        </div>

        {/* View content */}
        <div className="px-4 py-3">
          {activeView?.view_type === "table" && <TableView {...viewProps} />}
          {activeView?.view_type === "list" && <ListView {...viewProps} />}
          {activeView?.view_type === "kanban" && <KanbanView {...viewProps} />}
          {activeView?.view_type === "calendar" && <CalendarView {...viewProps} />}
          {activeView?.view_type === "gallery" && <GalleryView {...viewProps} />}
          {activeView?.view_type === "timeline" && <TimelineView {...viewProps} />}
          {activeView?.view_type === "chart" && (
            <ChartView
              fields={fields}
              rows={rows}
              relationPages={workspacePages}
              onOpenRow={handleOpenRow}
            />
          )}
          {activeView?.view_type === "form" && (
            <FormView
              fields={fields}
              relationPages={workspacePages}
              onOpenPage={handleOpenPage}
              onCreateRow={handleCreateRow}
            />
          )}
          {activeView?.view_type === "feed" && <FeedView {...viewProps} />}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ─── Small helper components ────────────────────────────────

function InlineFieldSettingsButton({
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
    const nextType = isTitleField ? field.field_type : type;
    onUpdate(field.id, {
      name: name.trim() || getDatabaseFieldDisplayName(field),
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
          <div className="mt-2 flex justify-end gap-1">
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
