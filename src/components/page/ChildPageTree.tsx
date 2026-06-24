"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePages } from "@/hooks/usePages";
import {
  createPageWithCloud,
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import { getModuleRootId, toDateKey } from "@/lib/pages/moduleWorkspaces";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
} from "@/lib/pages/pageProperties";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

const LEVEL_DOTS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
] as const;

const LEVEL_HOVERS = [
  "hover:text-blue-600 dark:hover:text-blue-400",
  "hover:text-emerald-600 dark:hover:text-emerald-400",
  "hover:text-purple-600 dark:hover:text-purple-400",
  "hover:text-amber-600 dark:hover:text-amber-400",
  "hover:text-rose-600 dark:hover:text-rose-400",
  "hover:text-cyan-600 dark:hover:text-cyan-400",
] as const;

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ViewMode = "list" | "calendar";

export default function ChildPageTree({ pageId }: { pageId: string }) {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const { pages } = usePages();
  const [chainRootId, setChainRootId] = useState<string | null>(null);
  const [dailyRootId, setDailyRootId] = useState<string | null>(null);
  const [meetingRootId, setMeetingRootId] = useState<string | null>(null);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void getModuleRootId("industry-chain").then(setChainRootId);
      void getModuleRootId("daily").then(setDailyRootId);
      void getModuleRootId("meeting-schedule").then(setMeetingRootId);
    });
  }, [dbReady]);

  const isDaily = pageId === dailyRootId;
  const isMeeting = pageId === meetingRootId;
  const hasCalendar = isDaily || isMeeting;

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem(
      `zhinote.childtree.view.${pageId}`
    );
    if (stored === "list") return "list";
    return "calendar";
  });

  const effectiveView = hasCalendar ? viewMode : "list";

  const switchView = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      localStorage.setItem(`zhinote.childtree.view.${pageId}`, mode);
    },
    [pageId]
  );

  const inChain = useMemo(() => {
    if (!chainRootId) return false;
    const byId = new Map(pages.map((p) => [p.id, p]));
    let cursor: string | null = pageId;
    while (cursor) {
      if (cursor === chainRootId) return true;
      cursor = byId.get(cursor)?.parent_id ?? null;
    }
    return false;
  }, [pages, pageId, chainRootId]);

  const children = useMemo(
    () => pages.filter((p) => p.parent_id === pageId),
    [pages, pageId]
  );

  const addChild = useCallback(
    async (parentId: string) => {
      const child = await createPageWithCloud({ parentId });
      upsertPages([child]);
      router.push(`/page/${child.id}`);
    },
    [router, upsertPages]
  );

  const addNoteOnDate = useCallback(
    async (dateKey: string) => {
      const child = await createPageWithCloud({ parentId: pageId });
      const props = [
        { ...createPageProperty("date", "日期"), value: dateKey },
        createPageProperty("text", "要点"),
        createPageProperty("text", "Summary"),
        createPageProperty("tags", "相关公司"),
        createPageProperty("tags", "相关行业"),
      ];
      const updatedChild = await updatePageWithCloud(child.id, {
        properties: stringifyPageProperties(props),
      });
      upsertPages([updatedChild ?? child]);
      router.push(`/page/${child.id}`);
    },
    [pageId, router, upsertPages]
  );

  const moveNoteToDate = useCallback(
    async (noteId: string, dateKey: string) => {
      const note = children.find((p) => p.id === noteId);
      if (!note) return;
      const currentKey = childDateKey(note);
      if (currentKey === dateKey) return;
      const props = parsePageProperties(note.properties);
      const dateProp = props.find((p) => p.name === "日期");
      if (dateProp) {
        dateProp.value = dateKey;
      } else {
        props.unshift({
          ...createPageProperty("date", "日期"),
          value: dateKey,
        });
      }
      const updates: { properties: string; title?: string } = {
        properties: stringifyPageProperties(props),
      };
      if (DATE_KEY_PATTERN.test((note.title || "").trim())) {
        updates.title = dateKey;
      }
      const updatedNote = await updatePageWithCloud(noteId, updates);
      if (updatedNote) upsertPages([updatedNote]);
    },
    [children, upsertPages]
  );

  if (children.length === 0) return null;

  const sectionLabel = inChain
    ? "产业链层级"
    : hasCalendar
      ? "子页面"
      : "子页面";
  const sectionIcon = inChain ? "🧭" : "📑";

  return (
    <section className="my-6 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-sm">{sectionIcon}</span>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {sectionLabel}
          </h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {countDescendants(pages, pageId)} 项
          </span>
          {hasCalendar && (
            <div className="ml-2 flex rounded-md border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => switchView("list")}
                className={`rounded-l-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                列表
              </button>
              <button
                type="button"
                onClick={() => switchView("calendar")}
                className={`rounded-r-md border-l border-zinc-200 px-2.5 py-1 text-[11px] font-medium transition-colors dark:border-zinc-700 ${
                  viewMode === "calendar"
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                📅 日历
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void addChild(pageId)}
          className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="添加子页面"
        >
          + 子页面
        </button>
      </div>

      {effectiveView === "calendar" ? (
        <CalendarView
          childPages={children}
          onOpen={(id) => router.push(`/page/${id}`)}
          onAddOnDate={addNoteOnDate}
          onMoveToDate={moveNoteToDate}
        />
      ) : (
        <ul className="space-y-0.5 px-3 py-2">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              allPages={pages}
              level={0}
              onOpen={(id) => router.push(`/page/${id}`)}
              onAddChild={(id) => void addChild(id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CalendarView({
  childPages,
  onOpen,
  onAddOnDate,
  onMoveToDate,
}: {
  childPages: Page[];
  onOpen: (id: string) => void;
  onAddOnDate: (dateKey: string) => Promise<void>;
  onMoveToDate: (noteId: string, dateKey: string) => Promise<void>;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());

  const notesByDate = useMemo(() => {
    const map = new Map<string, Page[]>();
    for (const note of childPages) {
      const key = childDateKey(note);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(note);
      map.set(key, list);
    }
    return map;
  }, [childPages]);

  const noDateCount = useMemo(
    () => childPages.filter((n) => !childDateKey(n)).length,
    [childPages]
  );

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const goPrev = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNext = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="bg-white dark:bg-zinc-900">
      {/* Calendar controls */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {viewMonth.getFullYear()} 年 {MONTH_LABELS[viewMonth.getMonth()]}
        </h3>
        <div className="flex items-center gap-1">
          {noDateCount > 0 && (
            <span className="mr-2 text-[11px] text-zinc-400">
              无日期 ({noDateCount})
            </span>
          )}
          <CalNavButton label="‹" onClick={goPrev} title="上个月" />
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-0.5 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            今天
          </button>
          <CalNavButton label="›" onClick={goNext} title="下个月" />
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-y border-zinc-100 dark:border-zinc-800">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-1 py-1.5 text-center text-[11px] font-medium text-zinc-400"
          >
            周{day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {grid.map((cell) => {
          const key = toDateKey(cell.date);
          const dayNotes = notesByDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isDragOver = draggedId !== null && dragOverKey === key;
          return (
            <div
              key={key}
              className={`group flex min-h-[100px] flex-col border-b border-r border-zinc-100 p-1 dark:border-zinc-800/60 ${
                cell.inMonth
                  ? ""
                  : "bg-zinc-50/50 dark:bg-zinc-900/40"
              } ${
                isDragOver
                  ? "bg-blue-50/80 ring-2 ring-inset ring-blue-300 dark:bg-blue-950/30 dark:ring-blue-700"
                  : ""
              }`}
              onDragOver={(e) => {
                if (!draggedId) return;
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOverKey((c) => (c === key ? null : c));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId) void onMoveToDate(draggedId, key);
                setDraggedId(null);
                setDragOverKey(null);
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] ${
                    isToday
                      ? "bg-blue-600 font-bold text-white dark:bg-blue-500"
                      : cell.inMonth
                        ? "font-medium text-zinc-600 dark:text-zinc-400"
                        : "text-zinc-300 dark:text-zinc-600"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => void onAddOnDate(key)}
                  className="flex h-4 w-4 items-center justify-center rounded text-[11px] text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  title="在这天新增"
                >
                  +
                </button>
              </div>
              <div className="mt-0.5 flex flex-col gap-[2px] overflow-y-auto">
                {dayNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", note.id);
                      setDraggedId(note.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverKey(null);
                    }}
                    onClick={() => onOpen(note.id)}
                    className={`w-full cursor-grab truncate rounded px-1.5 py-[3px] text-left text-[11px] leading-4 transition-colors active:cursor-grabbing ${
                      draggedId === note.id
                        ? "opacity-30"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50"
                    }`}
                    title={displayPageTitle(note.title)}
                  >
                    {note.icon ? `${note.icon} ` : ""}
                    {displayPageTitle(note.title)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function childDateKey(page: Page): string {
  const dateProp = parsePageProperties(page.properties).find(
    (p) => p.name === "日期" && p.value
  );
  if (dateProp?.value) return dateProp.value.trim();
  const title = (page.title || "").trim();
  return DATE_KEY_PATTERN.test(title) ? title : "";
}

function countDescendants(pages: Page[], id: string): number {
  const kids = pages.filter((p) => p.parent_id === id);
  return kids.reduce(
    (sum, kid) => sum + 1 + countDescendants(pages, kid.id),
    0
  );
}

function TreeNode({
  node,
  allPages,
  level,
  onOpen,
  onAddChild,
}: {
  node: Page;
  allPages: Page[];
  level: number;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const children = allPages.filter((p) => p.parent_id === node.id);
  const hasChildren = children.length > 0;
  const dot = LEVEL_DOTS[level % LEVEL_DOTS.length];
  const hover = LEVEL_HOVERS[level % LEVEL_HOVERS.length];

  return (
    <li>
      <div className="group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white dark:hover:bg-zinc-800/60">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 ${
            hasChildren ? "visible" : "invisible"
          }`}
          title={expanded ? "折叠" : "展开"}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        {node.icon && <span className="shrink-0 text-sm">{node.icon}</span>}

        <button
          type="button"
          onClick={() => onOpen(node.id)}
          className={`min-w-0 flex-1 truncate text-left text-sm text-zinc-700 transition-colors dark:text-zinc-200 ${
            level === 0 ? "font-medium" : ""
          } ${hover}`}
          title={displayPageTitle(node.title)}
        >
          {displayPageTitle(node.title)}
        </button>

        {hasChildren && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
            {children.length}
          </span>
        )}

        <button
          type="button"
          onClick={() => onAddChild(node.id)}
          className="shrink-0 rounded px-1.5 text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200"
          title="添加下级分类"
        >
          + 下级
        </button>
      </div>

      {expanded && hasChildren && (
        <ul className="ml-[10px] space-y-0.5 border-l border-zinc-200 pl-2.5 dark:border-zinc-700/70">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              allPages={allPages}
              level={level + 1}
              onOpen={onOpen}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CalNavButton({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {label}
    </button>
  );
}

interface MonthCell {
  date: Date;
  inMonth: boolean;
}

function buildMonthGrid(monthStart: Date): MonthCell[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );
    cells.push({ date, inMonth: date.getMonth() === month });
  }
  return cells;
}
