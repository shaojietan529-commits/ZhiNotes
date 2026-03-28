"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import TableView from "@/components/database/views/TableView";
import ListView from "@/components/database/views/ListView";
import KanbanView from "@/components/database/views/KanbanView";
import CalendarView from "@/components/database/views/CalendarView";

// ─── React Component rendered inside the editor ─────────────

type RowWithPage = DatabaseRow & { page: Page };

function InlineDatabaseComponent({ node }: { node: any }) {
  const router = useRouter();
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
    reload();
  }, [reload]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      await updateDatabase(databaseId, { title: newTitle });
    },
    [databaseId]
  );

  const handleAddField = useCallback(
    async (name: string, fieldType: string) => {
      await addField(databaseId, { name, fieldType });
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

  const handleAddRow = useCallback(async () => {
    await addRow(databaseId);
    reload();
  }, [databaseId, reload]);

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
          Database not found
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
            placeholder="Database title"
            className="text-base font-semibold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 flex-1"
          />
          <button
            onClick={() => router.push(`/database/${databaseId}`)}
            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 transition-colors"
            title="Open as full page"
          >
            Open ↗
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
              {view.name}
            </button>
          ))}
          <InlineAddViewButton onAdd={handleAddView} />
        </div>

        {/* Field bar */}
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400">Fields:</span>
          {fields.map((field) => (
            <span
              key={field.id}
              className="inline-flex items-center gap-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded px-1.5 py-0.5"
            >
              {field.name}
              <span className="text-zinc-400">({field.field_type})</span>
              {field.name !== "Name" && (
                <button
                  onClick={() => handleDeleteField(field.id)}
                  className="text-zinc-400 hover:text-red-500 ml-0.5"
                >
                  x
                </button>
              )}
            </span>
          ))}
          <InlineAddFieldButton onAdd={handleAddField} />
        </div>

        {/* View content */}
        <div className="px-4 py-3">
          {activeView?.view_type === "table" && <TableView {...viewProps} />}
          {activeView?.view_type === "list" && <ListView {...viewProps} />}
          {activeView?.view_type === "kanban" && <KanbanView {...viewProps} />}
          {activeView?.view_type === "calendar" && <CalendarView {...viewProps} />}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ─── Small helper components ────────────────────────────────

function InlineAddFieldButton({
  onAdd,
}: {
  onAdd: (name: string, type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("text");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), type);
    setName("");
    setType("text");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] text-zinc-400 hover:text-zinc-600 px-1.5 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-600"
      >
        + Field
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Field name"
        autoFocus
        className="text-[10px] px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-20 outline-none"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="text-[10px] px-1 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
      >
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="select">Select</option>
        <option value="date">Date</option>
        <option value="checkbox">Checkbox</option>
        <option value="url">URL</option>
      </select>
      <button onClick={handleSubmit} className="text-[10px] text-blue-500">
        Add
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] text-zinc-400"
      >
        Cancel
      </button>
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
    { type: "table", label: "Table", icon: "⊞" },
    { type: "list", label: "List", icon: "☰" },
    { type: "kanban", label: "Kanban", icon: "▥" },
    { type: "calendar", label: "Calendar", icon: "📅" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-zinc-400 hover:text-zinc-600 px-1 py-0.5"
      >
        + View
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
