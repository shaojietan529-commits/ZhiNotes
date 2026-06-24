"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePageRevision } from "@/hooks/usePageRevision";
import {
  getPage,
  listPageMetadata,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import {
  createPageWithCloud,
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import { getModuleRootId, toDateKey } from "@/lib/pages/moduleWorkspaces";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
} from "@/lib/pages/pageProperties";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  fetchDailyCloudMetadata,
  type DailyCloudMetadataResult,
} from "@/lib/pages/accountPageSync";
import { DEFAULT_OWNER_ID, generateId } from "@/lib/utils/id";
import PagePeekModal from "@/components/page/PagePeekModal";
import PageContextMenu from "@/components/page/PageContextMenu";
import type { Page } from "@/lib/utils/types";


const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DailyNote = Page & { dailyDateKey?: string; cloudOnly?: boolean };

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];
const DAILY_CALENDAR_VISIBLE_LIMIT = 8;
const DAILY_CLOUD_CACHE_PREFIX = "zhinote.daily.cloudMetadata.";

export default function DailyNotesShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const pageRevision = usePageRevision();
  const [rootId, setRootId] = useState<string | null>(null);
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [creatingDateKey, setCreatingDateKey] = useState<string | null>(null);
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekInitialPage, setPeekInitialPage] = useState<DailyNote | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const load = useCallback(async (opts?: { includeCloud?: boolean }) => {
    const includeCloud = opts?.includeCloud !== false;
    if (includeCloud) {
      setCloudLoading(true);
      setCloudNotice("正在从云端加载每日纪要…");
    }
    const id = await getModuleRootId("daily");
    setRootId(id);
    const dailyNotes = collectDailyNotes(await listPageMetadata(id), id);
    const byId = new Map(dailyNotes.map((note) => [note.id, note]));
    setNotes(Array.from(byId.values()));
    if (!includeCloud) return;

    const visibleRange = buildMonthGrid(viewMonth);
    const startDate = toDateKey(visibleRange[0].date);
    const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);
    const cachedCloud = readCachedDailyCloudMetadata(startDate, endDate);
    if (cachedCloud?.status === "ok" && cachedCloud.rootId) {
      const merged = mergeCloudDailyNotes(byId, cachedCloud);
      if (merged > 0) {
        setNotes(Array.from(byId.values()));
        setCloudNotice(
          `已先显示本机缓存的云端每日纪要 ${cachedCloud.pages.length} 条，正在后台更新…`
        );
      }
    }

    try {
      const cloud = await fetchDailyCloudMetadata({
        startDate,
        endDate,
        recentLimit: 12,
      });
      if (cloud.status === "ok" && cloud.rootId) {
        setRootId(cloud.rootId);
        mergeCloudDailyNotes(byId, cloud);
        writeCachedDailyCloudMetadata(startDate, endDate, cloud);
        setCloudNotice(
          cloud.pages.length > 0
            ? `云端每日纪要已加载 ${cloud.pages.length} 条，其中当前日历范围 ${cloud.rangeCount ?? 0} 条。`
            : `云端每日纪要索引已连接，但当前月份没有返回纪要。云端匹配 ${cloud.matched ?? 0} 条。`
        );
      } else if (cloud.status === "disabled") {
        setCloudNotice("页面同步已关闭，只显示本机每日纪要。");
      } else if (cloud.status === "unauthenticated") {
        setCloudNotice("当前浏览器未登录账号，只显示本机每日纪要。");
      } else if (cloud.status === "unconfigured") {
        setCloudNotice("云端账号系统未配置，只显示本机每日纪要。");
      } else {
        setCloudNotice(cloud.message ?? "云端每日纪要索引读取失败。");
      }
    } catch {
      setCloudNotice("云端每日纪要索引读取失败。");
    } finally {
      setCloudLoading(false);
    }

    setNotes(Array.from(byId.values()));
  }, [viewMonth]);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void load({ includeCloud: true });
    });
  }, [dbReady, load]);

  useEffect(() => {
    if (!dbReady) return;
    const timer = window.setTimeout(() => {
      void load({ includeCloud: false });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [dbReady, pageRevision, load]);

  // Each day can hold multiple note pages (Notion-style), grouped by 日期.
  const notesByDate = useMemo(() => {
    const map = new Map<string, DailyNote[]>();
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
      if (creatingDateKey) return;
      setCreatingDateKey(dateKey);
      setCloudNotice(`正在创建 ${dateKey} 的每日纪要…`);
      const props = [
        { ...createPageProperty("date", "日期"), value: dateKey },
        createPageProperty("text", "要点"),
        createPageProperty("text", "Summary"),
        createPageProperty("tags", "相关公司"),
        createPageProperty("tags", "相关行业"),
      ];
      try {
        const dailyRootId = rootId ?? (await getModuleRootId("daily"));
        if (!rootId) setRootId(dailyRootId);
        // Untitled by default (Notion-style) — the peek modal shows a 新页面
        // placeholder; calendar chips fall back to the 📝 glyph for display.
        let page: Page;
        try {
          page = await createPageWithCloud({ parentId: dailyRootId });
        } catch (error) {
          if (!isLocalDbWriteError(error)) throw error;
          const cloudNote = await createCloudOnlyDailyNote({
            rootId: dailyRootId,
            dateKey,
            properties: stringifyPageProperties(props),
          });
          setNotes((current) => [
            cloudNote,
            ...current.filter((item) => item.id !== cloudNote.id),
          ]);
          setPeekInitialPage(cloudNote);
          setPeekPageId(cloudNote.id);
          setCloudNotice(
            `${dateKey} 的每日纪要已存到账号云端；Edge 本地数据库写入失败，正在用云端草稿打开。`
          );
          return;
        }
        const updated =
          (await updatePageWithCloud(page.id, {
            properties: stringifyPageProperties(props),
          }).catch(async (error) => {
            if (!isLocalDbWriteError(error)) throw error;
            const cloudNote = await createCloudOnlyDailyNote({
              rootId: dailyRootId,
              pageId: page.id,
              dateKey,
              properties: stringifyPageProperties(props),
            });
            setNotes((current) => [
              cloudNote,
              ...current.filter((item) => item.id !== cloudNote.id),
            ]);
            setPeekInitialPage(cloudNote);
            setPeekPageId(cloudNote.id);
            setCloudNotice(
              `${dateKey} 的每日纪要已存到账号云端；Edge 本地数据库属性写入失败。`
            );
            return cloudNote;
          })) ?? page;
        const nextNote: DailyNote = {
          ...updated,
          dailyDateKey: dateKey,
          cloudOnly: Boolean((updated as DailyNote).cloudOnly),
        };
        setNotes((current) => [
          nextNote,
          ...current.filter((item) => item.id !== nextNote.id),
        ]);
        upsertPages([nextNote]);
        void pushDailyNoteCloudSnapshot(dailyRootId, nextNote);
        // Open immediately; do not wait for the cloud calendar index refresh.
        setPeekInitialPage(nextNote);
        setPeekPageId(nextNote.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "未知本机写入错误";
        setCloudNotice(`创建每日纪要失败：${message}`);
      } finally {
        setCreatingDateKey(null);
      }
    },
    [creatingDateKey, rootId, upsertPages]
  );

  const openNotePeek = useCallback((note: DailyNote) => {
    setPeekInitialPage(note);
    setPeekPageId(note.id);
  }, []);

  // Drag a note chip onto another day: rewrite its 日期 property (and the
  // title too when the note is still date-titled) so it moves on the calendar.
  const moveNoteToDate = useCallback(
    async (noteId: string, dateKey: string) => {
      const note = notes.find((item) => item.id === noteId);
      if (!note || dailyNoteDateKey(note) === dateKey) return;
      const props = parsePageProperties(note.properties);
      const dateProp = props.find((property) => property.name === "日期");
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
      const updated = await updatePageWithCloud(noteId, updates);
      if (updated) {
        const nextNote: DailyNote = {
          ...updated,
          dailyDateKey: dateKey,
          cloudOnly: Boolean((updated as DailyNote).cloudOnly),
        };
        upsertPages([nextNote]);
        setNotes((current) =>
          current.map((item) => (item.id === noteId ? nextNote : item))
        );
      }
    },
    [notes, upsertPages]
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
        <div className="mx-auto max-w-6xl px-8 py-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span>📅</span> 每日纪要
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                按日历浏览每天的纪要。鼠标悬停某一天，点 + 即可新增一篇纪要。
              </p>
              {cloudNotice && (
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {cloudNotice}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={creatingDateKey !== null}
              onClick={() => void addNote(todayKey)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {creatingDateKey === todayKey ? "创建中…" : "+ 今天新增"}
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
                className="px-2 py-2 text-center text-sm font-medium text-zinc-400"
              >
                周{day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="relative grid grid-cols-7 items-stretch">
            {notes.length === 0 && cloudNotice && (
              <div className="absolute inset-x-0 top-16 z-10 flex justify-center px-4">
                <div className="rounded-md border border-zinc-200 bg-white/95 px-3 py-2 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-400">
                  {cloudLoading ? "正在从云端加载每日纪要…" : cloudNotice}
                </div>
              </div>
            )}
            {grid.map((cell) => {
              const key = toDateKey(cell.date);
              const dayNotes = notesByDate.get(key) ?? [];
              const visibleNotes = dayNotes.slice(0, DAILY_CALENDAR_VISIBLE_LIMIT);
              const hiddenNotes = dayNotes.slice(DAILY_CALENDAR_VISIBLE_LIMIT);
              const isToday = key === todayKey;
              const isDropTarget = draggedNoteId !== null && dragOverDateKey === key;
              return (
                <div
                  key={key}
                  className={`group relative z-0 flex min-h-40 flex-col border-b border-r border-zinc-100 p-1.5 hover:z-20 dark:border-zinc-800/70 ${
                    cell.inMonth ? "" : "bg-zinc-50/50 dark:bg-zinc-900/40"
                  } ${
                    isDropTarget
                      ? "rounded-md ring-2 ring-inset ring-blue-400 bg-blue-50/60 dark:bg-blue-950/30"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    if (!draggedNoteId) return;
                    e.preventDefault();
                    setDragOverDateKey(key);
                  }}
                  onDragLeave={(e) => {
                    if (
                      e.currentTarget.contains(e.relatedTarget as Node)
                    ) {
                      return;
                    }
                    setDragOverDateKey((current) =>
                      current === key ? null : current
                    );
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedNoteId) {
                      void moveNoteToDate(draggedNoteId, key);
                    }
                    setDraggedNoteId(null);
                    setDragOverDateKey(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={creatingDateKey !== null}
                      onClick={() => void addNote(key)}
                      className="flex h-6 w-6 items-center justify-center rounded text-base text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                      title="在这天新增纪要"
                    >
                      {creatingDateKey === key ? "…" : "+"}
                    </button>
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm ${
                        isToday
                          ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : cell.inMonth
                            ? "font-medium text-zinc-600 dark:text-zinc-300"
                            : "text-zinc-300 dark:text-zinc-600"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col gap-1 overflow-visible">
                    {visibleNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", note.id);
                          setDraggedNoteId(note.id);
                        }}
                        onDragEnd={() => {
                          setDraggedNoteId(null);
                          setDragOverDateKey(null);
                        }}
                        onClick={() => openNotePeek(note)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            pageId: note.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className={`flex cursor-grab items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-left text-xs leading-4 text-zinc-700 transition-colors hover:bg-zinc-200 active:cursor-grabbing dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 ${
                          draggedNoteId === note.id ? "opacity-40" : ""
                        }`}
                        title={displayPageTitle(note.title)}
                      >
                        {note.icon && (
                          <span className="shrink-0 leading-4">{note.icon}</span>
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {displayPageTitle(note.title)}
                        </span>
                      </button>
                    ))}
                    {hiddenNotes.length > 0 && (
                      <>
                        <div className="rounded-md px-2 py-1 text-xs leading-4 text-zinc-400 transition-colors group-hover:hidden dark:text-zinc-500">
                          +{hiddenNotes.length} 条，悬停查看
                        </div>
                        <div className="hidden flex-col gap-1 group-hover:flex">
                          {hiddenNotes.map((note) => (
                            <button
                              key={note.id}
                              type="button"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", note.id);
                                setDraggedNoteId(note.id);
                              }}
                              onDragEnd={() => {
                                setDraggedNoteId(null);
                                setDragOverDateKey(null);
                              }}
                              onClick={() => openNotePeek(note)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                  pageId: note.id,
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }}
                              className={`flex cursor-grab items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-left text-xs leading-4 text-zinc-700 shadow-sm transition-colors hover:bg-zinc-200 active:cursor-grabbing dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 ${
                                draggedNoteId === note.id ? "opacity-40" : ""
                              }`}
                              title={displayPageTitle(note.title)}
                            >
                              {note.icon && (
                                <span className="shrink-0 leading-4">{note.icon}</span>
                              )}
                              <span className="min-w-0 flex-1 truncate">
                                {displayPageTitle(note.title)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
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
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", note.id);
                        setDraggedNoteId(note.id);
                      }}
                      onDragEnd={() => {
                        setDraggedNoteId(null);
                        setDragOverDateKey(null);
                      }}
                      onClick={() => openNotePeek(note)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          pageId: note.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      className="flex w-full cursor-grab items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 active:cursor-grabbing dark:hover:bg-zinc-800/50"
                    >
                      <span className="w-24 shrink-0 text-xs text-zinc-400">
                        {dailyNoteDateKey(note)}
                      </span>
                      <span className="flex items-center gap-1.5 truncate text-zinc-700 dark:text-zinc-200">
                        {note.icon && <span>{note.icon}</span>}
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
          initialPage={peekInitialPage?.id === peekPageId ? peekInitialPage : null}
          onClose={() => {
            setPeekPageId(null);
            setPeekInitialPage(null);
          }}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void load({ includeCloud: false })}
        />
      )}

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => {
            setPeekInitialPage(notes.find((note) => note.id === id) ?? null);
            setPeekPageId(id);
          }}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void load({ includeCloud: false })}
        />
      )}
    </div>
  );
}

function collectDailyNotes(
  pages: Page[],
  dailyRootId: string,
  cloudOnly = false
): DailyNote[] {
  const childrenByParent = new Map<string, Page[]>();
  for (const page of pages) {
    if (!page.parent_id) continue;
    const children = childrenByParent.get(page.parent_id) ?? [];
    children.push(page);
    childrenByParent.set(page.parent_id, children);
  }

  const dailyNotes: DailyNote[] = [];
  const seenIds = new Set<string>();
  const visit = (parentId: string, inheritedDateKey = "") => {
    const children = [...(childrenByParent.get(parentId) ?? [])].sort(
      (a, b) =>
        (a.position || 0) - (b.position || 0) ||
        (b.updated_at || "").localeCompare(a.updated_at || "")
    );
    for (const child of children) {
      const ownDateKey = readDailyNoteDateKey(child);
      const dateKey = ownDateKey || inheritedDateKey;
      if (dateKey) {
        dailyNotes.push({ ...child, dailyDateKey: dateKey, cloudOnly });
        seenIds.add(child.id);
      }
      visit(child.id, dateKey);
    }
  };
  visit(dailyRootId);

  for (const page of pages) {
    if (seenIds.has(page.id) || page.id === dailyRootId) continue;
    const dateKey = readDailyNoteDateKey(page);
    if (dateKey) {
      dailyNotes.push({ ...page, dailyDateKey: dateKey, cloudOnly });
    }
  }

  return dailyNotes;
}

function mergeCloudDailyNotes(
  byId: Map<string, DailyNote>,
  cloud: DailyCloudMetadataResult
): number {
  if (cloud.status !== "ok" || !cloud.rootId) return 0;
  let merged = 0;
  for (const note of collectDailyNotes(
    cloud.pages.map(remoteRecordToPage),
    cloud.rootId,
    true
  )) {
    if (!byId.has(note.id)) {
      byId.set(note.id, note);
      merged += 1;
    }
  }
  return merged;
}

function dailyCloudCacheKey(startDate: string, endDate: string): string {
  return `${DAILY_CLOUD_CACHE_PREFIX}${startDate}:${endDate}:v1`;
}

function readCachedDailyCloudMetadata(
  startDate: string,
  endDate: string
): DailyCloudMetadataResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      dailyCloudCacheKey(startDate, endDate)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyCloudMetadataResult> & {
      cachedAt?: string;
    };
    const cachedAt = parsed.cachedAt ? Date.parse(parsed.cachedAt) : 0;
    if (!cachedAt || Date.now() - cachedAt > 24 * 60 * 60 * 1000) return null;
    if (
      parsed.status !== "ok" ||
      !Array.isArray(parsed.pages) ||
      typeof parsed.total !== "number"
    ) {
      return null;
    }
    return {
      status: "ok",
      pages: parsed.pages,
      total: parsed.total,
      rootId: typeof parsed.rootId === "string" ? parsed.rootId : null,
      matched: typeof parsed.matched === "number" ? parsed.matched : undefined,
      rangeCount:
        typeof parsed.rangeCount === "number" ? parsed.rangeCount : undefined,
      recentCount:
        typeof parsed.recentCount === "number" ? parsed.recentCount : undefined,
      scanned: typeof parsed.scanned === "number" ? parsed.scanned : undefined,
    };
  } catch {
    return null;
  }
}

function writeCachedDailyCloudMetadata(
  startDate: string,
  endDate: string,
  cloud: DailyCloudMetadataResult
): void {
  if (typeof window === "undefined" || cloud.status !== "ok") return;
  try {
    window.localStorage.setItem(
      dailyCloudCacheKey(startDate, endDate),
      JSON.stringify({ ...cloud, cachedAt: new Date().toISOString() })
    );
  } catch {
    // Local cache is best-effort; the cloud result is still displayed.
  }
}

async function pushDailyNoteCloudSnapshot(rootId: string, note: Page) {
  try {
    const rootPage = await getPage(rootId);
    if (!rootPage) return;
    await pushDailyCloudRecords([pageToRemoteRecord(rootPage), pageToRemoteRecord(note)]);
  } catch {
    // Local creation already succeeded; account sync can retry later.
  }
}

async function createCloudOnlyDailyNote({
  rootId,
  pageId,
  dateKey,
  properties,
}: {
  rootId: string;
  pageId?: string;
  dateKey: string;
  properties: string;
}): Promise<DailyNote> {
  const now = new Date().toISOString();
  const rootPage =
    (await getPage(rootId).catch(() => null)) ??
    makeRemoteBackedPage({
      id: rootId,
      parentId: null,
      title: "每日纪要",
      icon: "📅",
      properties: null,
      contentText: "",
      position: 0,
      depth: 0,
      createdAt: "1970-01-01T00:00:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  const note = makeRemoteBackedPage({
    id: pageId ?? generateId(),
    parentId: rootId,
    title: "",
    icon: null,
    properties,
    contentText: "",
    position: Date.now(),
    depth: (rootPage.depth ?? 0) + 1,
    createdAt: now,
    updatedAt: now,
  });

  await pushDailyCloudRecords([
    pageToRemoteRecord(rootPage),
    pageToRemoteRecord(note),
  ]);

  return {
    ...note,
    dailyDateKey: dateKey,
    cloudOnly: true,
  };
}

function makeRemoteBackedPage({
  id,
  parentId,
  title,
  icon,
  properties,
  contentText,
  position,
  depth,
  createdAt,
  updatedAt,
}: {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  properties: string | null;
  contentText: string | null;
  position: number;
  depth: number;
  createdAt: string;
  updatedAt: string;
}): Page {
  return {
    id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: parentId,
    database_id: null,
    title,
    icon,
    cover_url: null,
    content_yjs: null,
    content_text: contentText,
    properties,
    position,
    depth,
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: null,
    sync_version: 1,
  };
}

async function pushDailyCloudRecords(records: RemotePageRecord[]) {
  const res = await fetch("/api/pages/account-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "push", pages: records }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `云端保存失败：${res.status}`);
  }
}

function pageToRemoteRecord(page: Page): RemotePageRecord {
  return {
    id: page.id,
    parent_id: page.parent_id ?? null,
    title: page.title ?? "",
    icon: page.icon ?? null,
    cover_url: page.cover_url ?? null,
    content_text: page.content_text ?? null,
    properties: page.properties ?? null,
    position: page.position ?? 0,
    depth: page.depth ?? 0,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at ?? null,
  };
}

function isLocalDbWriteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_IOERR|disk I\/O error|quota|localStorage/i.test(message);
}

// Resolve the day a note belongs to: prefer the 日期 property, fall back to a
// date-formatted title (older daily pages were titled with the date directly).
function dailyNoteDateKey(page: DailyNote): string {
  return readDailyNoteDateKey(page) || page.dailyDateKey || "";
}

function readDailyNoteDateKey(page: Page): string {
  const dateProp = parsePageProperties(page.properties).find(
    (property) => property.name === "日期" && property.value
  );
  if (dateProp?.value) return dateProp.value.trim();
  const title = (page.title || "").trim();
  return inferDateFromTitle(title) ?? "";
}

function inferDateFromTitle(title: string): string | null {
  if (DATE_KEY_PATTERN.test(title)) return title;
  const compact = title.match(
    /(?:^|[^0-9])([0-9]{2})([01][0-9])([0-3][0-9])(?:[^0-9]|$)/
  );
  if (compact) return formatInferredDate(compact[1], compact[2], compact[3]);

  const shortSeparated = title.match(
    /(?:^|[^0-9])([0-9]{2})[-/.年]([0-9]{1,2})[-/.月]([0-9]{1,2})(?:日)?(?:[^0-9]|$)/
  );
  if (shortSeparated) {
    return formatInferredDate(
      shortSeparated[1],
      shortSeparated[2],
      shortSeparated[3]
    );
  }

  const separated = title.match(
    /(?:^|[^0-9])([0-9]{4})[-/.年]([0-9]{1,2})[-/.月]([0-9]{1,2})(?:日)?(?:[^0-9]|$)/
  );
  if (separated) {
    return formatInferredDate(separated[1], separated[2], separated[3]);
  }
  return null;
}

function formatInferredDate(
  yearText: string,
  monthText: string,
  dayText: string
): string | null {
  let year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (yearText.length === 2) year += year >= 70 ? 1900 : 2000;
  if (
    year < 2000 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function remoteRecordToPage(record: RemotePageRecord): Page {
  return {
    id: record.id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: record.parent_id,
    database_id: null,
    title: record.title,
    icon: record.icon,
    cover_url: record.cover_url,
    content_yjs: null,
    content_text: record.content_text,
    properties: record.properties,
    position: record.position,
    depth: record.depth,
    created_at: record.created_at,
    updated_at: record.updated_at,
    deleted_at: record.deleted_at,
    sync_version: 0,
  };
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
