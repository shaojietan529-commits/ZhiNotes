"use client";

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
import type { Database, DatabaseField, DatabaseRow, DatabaseView } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import TableView from "./views/TableView";
import ListView from "./views/ListView";
import KanbanView from "./views/KanbanView";
import CalendarView from "./views/CalendarView";

interface DatabaseShellProps {
  databaseId: string;
}

type RowWithPage = DatabaseRow & { page: Page };

export default function DatabaseShell({ databaseId }: DatabaseShellProps) {
  const router = useRouter();
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
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!database) {
    return <p className="text-zinc-400 text-sm">Database not found.</p>;
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
    <div>
      {/* Database header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{database.icon || "🗄️"}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Database title"
          className="text-2xl font-bold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 flex-1"
        />
      </div>

      {/* View tabs + add view */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 mb-4">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveViewId(view.id)}
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
            {view.name}
          </button>
        ))}
        {/* Add view dropdown */}
        <AddViewButton onAdd={handleAddView} />
      </div>

      {/* Field management bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-zinc-400">Fields:</span>
        {fields.map((field) => (
          <span
            key={field.id}
            className="inline-flex items-center gap-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded px-2 py-0.5"
          >
            {field.name}
            <span className="text-zinc-400 dark:text-zinc-500">
              ({field.field_type})
            </span>
            {field.name !== "Name" && (
              <button
                onClick={() => handleDeleteField(field.id)}
                className="text-zinc-400 hover:text-red-500 ml-0.5"
                title="Delete field"
              >
                x
              </button>
            )}
          </span>
        ))}
        <AddFieldButton onAdd={handleAddField} />
      </div>

      {/* Active view */}
      {activeView?.view_type === "table" && <TableView {...viewProps} />}
      {activeView?.view_type === "list" && <ListView {...viewProps} />}
      {activeView?.view_type === "kanban" && <KanbanView {...viewProps} fields={fields} rows={rows} onUpdateRow={handleUpdateRow} onAddRow={handleAddRow} onDeleteRow={handleDeleteRow} onOpenRow={handleOpenRow} />}
      {activeView?.view_type === "calendar" && <CalendarView {...viewProps} />}
    </div>
  );
}

function AddFieldButton({ onAdd }: { onAdd: (name: string, type: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("text");

  const fieldTypes = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "select", label: "Select" },
    { value: "date", label: "Date" },
    { value: "checkbox", label: "Checkbox" },
    { value: "url", label: "URL" },
  ];

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
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
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
        className="text-xs px-2 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-24 outline-none"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="text-xs px-1 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
      >
        {fieldTypes.map((ft) => (
          <option key={ft.value} value={ft.value}>
            {ft.label}
          </option>
        ))}
      </select>
      <button onClick={handleSubmit} className="text-xs text-blue-500 hover:text-blue-600">
        Add
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600">
        Cancel
      </button>
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
    { type: "table", label: "Table", icon: "⊞" },
    { type: "list", label: "List", icon: "☰" },
    { type: "kanban", label: "Kanban", icon: "▥" },
    { type: "calendar", label: "Calendar", icon: "📅" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-1.5"
      >
        + View
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
