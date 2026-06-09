"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import { createPage, listPages, updatePage } from "@/lib/db/local/queries";
import { getModuleRootId, toDateKey } from "@/lib/pages/moduleWorkspaces";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
} from "@/lib/pages/pageProperties";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import PagePeekModal from "@/components/page/PagePeekModal";
import PageContextMenu from "@/components/page/PageContextMenu";
import type { Page } from "@/lib/utils/types";


const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];

export default function DailyNotesShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { refresh } = usePages();
  const [rootId, setRootId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Page[]>([]);
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const load = useCallback(async () => {
    const id = await getModuleRootId("daily");
    setRootId(id);
    setNotes(await listPages(id));
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void load();
    });
  }, [dbReady, load]);

  // Each day can hold multiple note pages (Notion-style), grouped by 日期.
  const notesByDate = useMemo(() => {
    const map = new Map<string, Page[]>();
    for (const note of notes) {
      const key = dailyNoteDateKey(note);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(note);
      map.set(key, list);
    }
    return map;
  }, [notes]);

  // Add a new note page on the given day, then open it for editing.
  const addNote = useCallback(
    async (dateKey: string) => {
      if (!rootId) return;
      const page = await createPage({
        title: "未命名纪要",
        parentId: rootId,
        icon: "📝",
      });
      const props = [
        { ...createPageProperty("date", "日期"), value: dateKey },
        createPageProperty("text", "要点"),
        createPageProperty("text", "Summary"),
      ];
      await updatePage(page.id, {
        properties: stringifyPageProperties(props),
      });
      await refresh();
      await load();
      // Pop the freshly created note in a modal instead of leaving the calendar.
      setPeekPageId(page.id);
    },
    [rootId, refresh, load]
  );

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const todayKey = toDateKey(new Date());

  const recent = useMemo(
    () =>
      [...notes]
        .sort((a, b) => dailyNoteDateKey(b).localeCompare(dailyNoteDateKey(a)))
        .slice(0, 8),
    [notes]
  );

  const goPrev = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNext = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span>📅</span> 每日纪要
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                按日历浏览每天的纪要。鼠标悬停某一天，点 + 即可新增一篇纪要。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void addNote(todayKey)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              + 今天新增
            </button>
          </div>

          {/* Calendar controls */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              {viewMonth.getFullYear()} 年 {MONTH_LABELS[viewMonth.getMonth()]}
            </h2>
            <div className="flex items-center gap-1">
              <CalNavButton label="‹" onClick={goPrev} title="上个月" />
              <button
                type="button"
                onClick={goToday}
                className="rounded-md px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                回到今天
              </button>
              <CalNavButton label="›" onClick={goNext} title="下个月" />
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-1.5 text-center text-xs font-medium text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {grid.map((cell) => {
              const key = toDateKey(cell.date);
              const dayNotes = notesByDate.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`group flex h-28 flex-col border-b border-r border-zinc-100 p-1 dark:border-zinc-800/70 ${
                    cell.inMonth ? "" : "bg-zinc-50/50 dark:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => void addNote(key)}
                      className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                      title="在这天新增纪要"
                    >
                      +
                    </button>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        isToday
                          ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : cell.inMonth
                            ? "text-zinc-600 dark:text-zinc-300"
                            : "text-zinc-300 dark:text-zinc-600"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-col gap-0.5 overflow-y-auto">
                    {dayNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => setPeekPageId(note.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            pageId: note.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className="flex items-center gap-1 truncate rounded bg-zinc-100 px-1 py-0.5 text-left text-[10px] text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        title={displayPageTitle(note.title)}
                      >
                        <span className="shrink-0">{note.icon || "📝"}</span>
                        <span className="truncate">
                          {displayPageTitle(note.title)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent daily notes */}
          {recent.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                最近的纪要
              </h3>
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {recent.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => setPeekPageId(note.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          pageId: note.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <span className="w-24 shrink-0 text-xs text-zinc-400">
                        {dailyNoteDateKey(note)}
                      </span>
                      <span className="flex items-center gap-1.5 truncate text-zinc-700 dark:text-zinc-200">
                        <span>{note.icon || "📝"}</span>
                        <span className="truncate">
                          {displayPageTitle(note.title)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      {peekPageId && (
        <PagePeekModal
          pageId={peekPageId}
          onClose={() => setPeekPageId(null)}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void load()}
        />
      )}

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => setPeekPageId(id)}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

// Resolve the day a note belongs to: prefer the 日期 property, fall back to a
// date-formatted title (older daily pages were titled with the date directly).
function dailyNoteDateKey(page: Page): string {
  const dateProp = parsePageProperties(page.properties).find(
    (property) => property.name === "日期" && property.value
  );
  if (dateProp?.value) return dateProp.value.trim();
  const title = (page.title || "").trim();
  return DATE_KEY_PATTERN.test(title) ? title : "";
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
      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {label}
    </button>
  );
}

interface MonthCell {
  date: Date;
  inMonth: boolean;
}

// Build a 6-week grid (Monday-first) covering the given month.
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
