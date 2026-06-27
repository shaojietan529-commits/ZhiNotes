"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePageRevision } from "@/hooks/usePageRevision";
import {
  applyRemotePages,
  applyRemotePageMetadata,
  getWorkspaceSetting,
  getPage,
  listDailyPageMetadataForCalendar,
  rebuildPageDateKeyIndex,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import {
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import {
  findLocalModuleRootId,
  getModuleRootId,
  getModuleRootIdSync,
  rememberModuleRootId,
  toDateKey,
} from "@/lib/pages/moduleWorkspaces";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
} from "@/lib/pages/pageProperties";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  fetchDailyCloudMetadata,
  queueCloudPagePush,
  type DailyCloudMetadataResult,
} from "@/lib/pages/accountPageSync";
import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import { rememberPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import {
  getLocalPerformanceNow,
  recordLocalPerformanceSnapshot,
} from "@/lib/performance/localPerformance";
import {
  dailyHotCacheSnapshotPageToPage,
  readDailyHotCacheSnapshot,
  readDailyHotCacheSnapshotsForRange,
  writeDailyHotCacheSnapshot,
  type DailyHotCacheSnapshot,
} from "@/lib/sync/dailyHotCacheSnapshot";
import {
  DEFAULT_HOT_CACHE_PREFERENCES,
  HOT_CACHE_PREFERENCES_CHANGED_EVENT,
  HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY,
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  metadataRecentLimitForHotCachePreferences,
  normalizeHotCachePreferences,
  parseHotCachePreferences,
  type HotCachePreferences,
} from "@/lib/sync/hotCacheSelectionSettings";
import { useCalendarViewMonthPreference } from "@/hooks/useCalendarViewMonthPreference";
import { DEFAULT_OWNER_ID, generateId } from "@/lib/utils/id";
import PageContextMenu from "@/components/page/PageContextMenu";
import PagePeekModal, {
  warmPagePeekModal,
} from "@/components/page/LazyPagePeekModal";
import type { Page } from "@/lib/utils/types";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DailyNote = Page & {
  dailyDateKey?: string;
  cloudOnly?: boolean;
  hotCacheOnly?: boolean;
};

type IndexedDailyNote = {
  note: DailyNote;
  dateKey: string;
};

type DailyCalendarIndexes = {
  indexedNotes: IndexedDailyNote[];
  notesByDate: Map<string, DailyNote[]>;
  notesById: Map<string, DailyNote>;
};

type OpeningDailyDraft = {
  pageId: string;
  dateKey: string;
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];
const DAILY_CALENDAR_VISIBLE_LIMIT = 8;
const DAILY_RECENT_VISIBLE_LIMIT = 8;
const DAILY_CALENDAR_EXPAND_BATCH = 24;
const DAILY_DATE_INDEX_BACKFILL_BATCH = 240;
const DAILY_DATE_INDEX_BACKFILL_MAX_PASSES = 4;
const DAILY_CLOUD_CACHE_PREFIX = "zhinote.daily.cloudMetadata.";
const DAILY_DATE_INDEX_BACKFILL_KEY = "zhinote.daily.dateIndex.backfilled.v2";
let dailyDateIndexBackfillRunning = false;
let dailyDateIndexBackfillDoneInMemory = false;

export default function DailyNotesShell() {
  const router = useRouter();
  const openPage = useLocalFirstPageNavigation();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const pageRevision = usePageRevision();
  const [rootId, setRootId] = useState<string | null>(null);
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [creatingDateKey, setCreatingDateKey] = useState<string | null>(null);
  const [openingDraft, setOpeningDraft] = useState<OpeningDailyDraft | null>(
    null
  );
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekInitialPage, setPeekInitialPage] = useState<DailyNote | null>(null);
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [expandedDateKeys, setExpandedDateKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [visibleNoteLimitByDate, setVisibleNoteLimitByDate] = useState<
    Map<string, number>
  >(() => new Map());
  const loadRequestRef = useRef(0);
  const observedPageRevisionRef = useRef<string | null>(null);
  const pageShellWarmupRef = useRef<Promise<unknown> | null>(null);
  const { viewMonth, setViewMonth } =
    useCalendarViewMonthPreference("daily");
  const [hotCachePreferences, setHotCachePreferences] = useState(
    DEFAULT_HOT_CACHE_PREFERENCES
  );
  const recentMetadataLimit = useMemo(
    () => metadataRecentLimitForHotCachePreferences(hotCachePreferences),
    [hotCachePreferences]
  );

  const warmPageRoute = useCallback(() => {
    try {
      router.prefetch("/page/zhinote-route-prefetch");
    } catch {
      // Prefetch only improves perceived speed; it should never block the page.
    }
    warmPagePeekModal();
    if (!pageShellWarmupRef.current) {
      pageShellWarmupRef.current = import("@/components/providers/PageShell").catch(
        () => {
          pageShellWarmupRef.current = null;
        }
      );
    }
  }, [router]);

  useEffect(() => {
    const cancelPageShellPreload = scheduleDailyIdleTask(() => {
      warmPageRoute();
    }, 500);
    return () => {
      cancelPageShellPreload();
    };
  }, [warmPageRoute]);

  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;

    const reloadHotCachePreferences = () => {
      void getWorkspaceSetting(HOT_CACHE_PREFERENCES_SETTING_KEY)
        .then((setting) => {
          if (cancelled) return;
          setHotCachePreferences(parseHotCachePreferences(setting));
        })
        .catch(() => undefined);
    };

    const handleHotCachePreferencesChanged = (event: Event) => {
      const preferencesFromEvent = (
        event as CustomEvent<{ preferences?: Partial<HotCachePreferences> }>
      ).detail?.preferences;
      if (preferencesFromEvent) {
        if (cancelled) return;
        setHotCachePreferences(normalizeHotCachePreferences(preferencesFromEvent));
        return;
      }
      reloadHotCachePreferences();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY) {
        reloadHotCachePreferences();
      }
    };

    reloadHotCachePreferences();
    window.addEventListener(
      HOT_CACHE_PREFERENCES_CHANGED_EVENT,
      handleHotCachePreferencesChanged
    );
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(
        HOT_CACHE_PREFERENCES_CHANGED_EVENT,
        handleHotCachePreferencesChanged
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [dbReady]);

  const load = useCallback(async (opts?: { includeCloud?: boolean }) => {
    const includeCloud = opts?.includeCloud !== false;
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const performanceStartedAt = new Date().toISOString();
    const performanceStart = getLocalPerformanceNow();
    let firstVisibleMs: number | null = null;
    let firstVisibleCount = 0;
    let localNoteCount = 0;
    if (!includeCloud) setCloudLoading(false);
    const visibleRange = buildMonthGrid(viewMonth);
    const startDate = toDateKey(visibleRange[0].date);
    const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);
    const byId = new Map<string, DailyNote>();
    const cachedHotSnapshot = readDailyHotCacheSnapshot(startDate, endDate);
    const overlappingHotSnapshots = readDailyHotCacheSnapshotsForRange(
      startDate,
      endDate
    );
    const cachedCloud = includeCloud
      ? readCachedDailyCloudMetadata(startDate, endDate)
      : null;
    let cloudMetadataPromise: Promise<DailyCloudMetadataResult> | null = null;
    const startDailyCloudMetadataFetch = () => {
      if (!includeCloud) return null;
      if (!cloudMetadataPromise) {
        cloudMetadataPromise = fetchDailyCloudMetadata({
          startDate,
          endDate,
          recentLimit: recentMetadataLimit,
        }).catch((error): DailyCloudMetadataResult => {
          const message =
            error instanceof Error ? error.message : "云端每日纪要索引读取失败。";
          return {
            status: "error",
            pages: [],
            total: 0,
            message,
          };
        });
      }
      return cloudMetadataPromise;
    };

    const publishNotes = (nextNotes: DailyNote[]) => {
      if (loadRequestRef.current !== requestId) return;
      if (firstVisibleMs === null && nextNotes.length > 0) {
        firstVisibleMs = getLocalPerformanceNow() - performanceStart;
        firstVisibleCount = nextNotes.length;
      }
      setNotes(nextNotes);
    };

    const recordDailyPerformance = (
      status: string,
      counts?: Record<string, number | null | undefined>
    ) => {
      if (loadRequestRef.current !== requestId) return;
      const durationMs = getLocalPerformanceNow() - performanceStart;
      recordLocalPerformanceSnapshot({
        kind: "daily-calendar",
        label: "每日纪要日历加载",
        route: "/daily",
        status,
        startedAt: performanceStartedAt,
        durationMs,
        localFirstMs: firstVisibleMs,
        backgroundMs:
          firstVisibleMs === null ? null : durationMs - firstVisibleMs,
        counts: {
          month_cells: visibleRange.length,
          visible_notes: byId.size,
          local_notes: localNoteCount,
          first_visible_notes: firstVisibleCount,
          cloud_enabled: includeCloud ? 1 : 0,
          ...counts,
        },
      });
    };

    const publishNotice = (message: string | null) => {
      if (loadRequestRef.current !== requestId) return;
      setCloudNotice(message);
    };

    const publishRootId = (id: string | null) => {
      if (loadRequestRef.current !== requestId) return;
      setRootId(id);
    };

    if (cachedHotSnapshot) {
      const merged = mergeDailyHotCacheSnapshot(
        byId,
        cachedHotSnapshot,
        startDate,
        endDate
      );
      if (merged > 0) {
        publishNotes(Array.from(byId.values()));
        publishNotice(
          `已先显示本机热缓存 ${merged} 条每日纪要 metadata，正在后台校正本地和云端主库…`
        );
      }
    }

    let overlappingHotMerged = 0;
    for (const snapshot of overlappingHotSnapshots) {
      overlappingHotMerged += mergeDailyHotCacheSnapshot(
        byId,
        snapshot,
        startDate,
        endDate
      );
    }
    if (overlappingHotMerged > 0) {
      publishNotes(Array.from(byId.values()));
      publishNotice(
        `已先显示本机重叠热缓存 ${overlappingHotMerged} 条每日纪要 metadata，后台继续校正本地和云端主库…`
      );
    }

    if (cachedCloud?.status === "ok" && cachedCloud.rootId) {
      rememberModuleRootId("daily", cachedCloud.rootId);
      publishRootId(cachedCloud.rootId);
      const merged = mergeCloudDailyNotes(byId, cachedCloud);
      if (merged > 0) {
        publishNotes(Array.from(byId.values()));
      }
      publishNotice(
        `已先显示缓存的云端每日纪要 ${cachedCloud.pages.length} 条，正在后台更新…`
      );
    }

    const storedDailyRootId = getModuleRootIdSync("daily");
    const cachedDailyRootId =
      cachedCloud?.status === "ok" && cachedCloud.rootId
        ? cachedCloud.rootId
        : null;
    const localDailyRootId =
      storedDailyRootId ??
      cachedDailyRootId ??
      (await findLocalModuleRootId("daily"));
    const dailyRootId = localDailyRootId ?? (await getModuleRootId("daily"));
    publishRootId(dailyRootId);
    if (localDailyRootId) {
      void getModuleRootId("daily")
        .then(async (confirmedRootId) => {
          if (
            loadRequestRef.current !== requestId ||
            confirmedRootId === dailyRootId
          ) {
            return;
          }
          publishRootId(confirmedRootId);
          const confirmedMetadata = await listDailyPageMetadataForCalendar({
            rootId: confirmedRootId,
            startDate,
            endDate,
            recentLimit: recentMetadataLimit,
          });
          const nextById = new Map(byId);
          for (const note of collectDailyNotes(confirmedMetadata, confirmedRootId)) {
            nextById.set(note.id, note);
          }
          publishNotes(Array.from(nextById.values()));
        })
        .catch(() => undefined);
    }
    const localMetadata = await listDailyPageMetadataForCalendar({
      rootId: dailyRootId,
      startDate,
      endDate,
      recentLimit: recentMetadataLimit,
      includeUnindexedFallback: false,
    });
    const dailyNotes = collectDailyNotes(localMetadata, dailyRootId);
    localNoteCount = dailyNotes.length;
    for (const note of dailyNotes) byId.set(note.id, note);
    publishNotes(Array.from(byId.values()));
    writeDailyHotCacheSnapshot({
      startDate,
      endDate,
      rootId: dailyRootId,
      pages: Array.from(byId.values()),
      source: "local-metadata",
    });
    if (!includeCloud) {
      recordDailyPerformance("local-refresh", {
        local_pages: localMetadata.length,
      });
    }
    scheduleDailyIdleTask(() => {
      void (async () => {
        const fallbackMetadata = await listDailyPageMetadataForCalendar({
          rootId: dailyRootId,
          startDate,
          endDate,
          recentLimit: recentMetadataLimit,
          includeUnindexedFallback: true,
        });
        if (loadRequestRef.current !== requestId) return;
        const fallbackById = new Map(byId);
        for (const note of collectDailyNotes(fallbackMetadata, dailyRootId)) {
          fallbackById.set(note.id, note);
          byId.set(note.id, note);
        }
        publishNotes(Array.from(fallbackById.values()));
        writeDailyHotCacheSnapshot({
          startDate,
          endDate,
          rootId: dailyRootId,
          pages: Array.from(fallbackById.values()),
          source: "local-fallback-metadata",
        });

        await ensureDailyDateIndexBackfilled();
        if (loadRequestRef.current !== requestId) return;
        const refreshed = await listDailyPageMetadataForCalendar({
          rootId: dailyRootId,
          startDate,
          endDate,
          recentLimit: recentMetadataLimit,
          includeUnindexedFallback: false,
        });
        if (loadRequestRef.current !== requestId) return;
        const nextById = new Map(byId);
        for (const note of collectDailyNotes(refreshed, dailyRootId)) {
          nextById.set(note.id, note);
        }
        publishNotes(Array.from(nextById.values()));
      })()
        .catch(() => undefined);
    }, 450);

    if (includeCloud) {
      setCloudLoading(true);
      if (cachedCloud?.status === "ok" && cachedCloud.rootId) {
        void persistDailyCloudMetadata(cachedCloud, upsertPages);
      } else {
        publishNotice("本地每日纪要已显示，正在后台检查云端更新…");
      }

      try {
        const cloudMetadata = startDailyCloudMetadataFetch();
        if (!cloudMetadata) return;
        const cloud = await cloudMetadata;
        if (cloud.status === "ok" && cloud.rootId) {
          rememberModuleRootId("daily", cloud.rootId);
          publishRootId(cloud.rootId);
          const merged = mergeCloudDailyNotes(byId, cloud);
          publishNotes(Array.from(byId.values()));
          writeCachedDailyCloudMetadata(startDate, endDate, cloud);
          writeDailyHotCacheSnapshot({
            startDate,
            endDate,
            rootId: cloud.rootId,
            pages: Array.from(byId.values()),
            source: "cloud-metadata",
          });
          void persistDailyCloudMetadata(cloud, upsertPages);
          recordDailyPerformance("cloud-ok", {
            cloud_pages: cloud.pages.length,
            cloud_range: cloud.rangeCount ?? 0,
            cloud_total: cloud.total,
            cloud_merged: merged,
          });
          publishNotice(
            cloud.pages.length > 0
              ? `云端每日纪要已补齐 ${cloud.pages.length} 条，其中当前日历范围 ${cloud.rangeCount ?? 0} 条。`
              : merged > 0
                ? "云端每日纪要已补齐。"
              : `云端每日纪要索引已连接，但当前月份没有返回纪要。云端匹配 ${cloud.matched ?? 0} 条。`
          );
          return;
        }
        if (cloud.status === "disabled") {
          publishNotice("页面同步已关闭，只显示本机每日纪要。");
          recordDailyPerformance("cloud-disabled");
        } else if (cloud.status === "unauthenticated") {
          publishNotice("当前浏览器未登录账号，只显示本机每日纪要。");
          recordDailyPerformance("cloud-unauthenticated");
        } else if (cloud.status === "unconfigured") {
          publishNotice("云端账号系统未配置，只显示本机每日纪要。");
          recordDailyPerformance("cloud-unconfigured");
        } else {
          publishNotice(cloud.message ?? "云端每日纪要索引读取失败。");
          recordDailyPerformance("cloud-error");
        }
      } catch {
        publishNotice("云端每日纪要索引读取失败。");
        recordDailyPerformance("cloud-error");
      } finally {
        if (loadRequestRef.current === requestId) setCloudLoading(false);
      }
    }
  }, [recentMetadataLimit, upsertPages, viewMonth]);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void load({ includeCloud: true });
    });
  }, [dbReady, load]);

  useEffect(() => {
    if (!dbReady) return;
    if (observedPageRevisionRef.current === null) {
      observedPageRevisionRef.current = pageRevision;
      return;
    }
    if (observedPageRevisionRef.current === pageRevision) return;
    observedPageRevisionRef.current = pageRevision;
    const timer = window.setTimeout(() => {
      void load({ includeCloud: false });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [dbReady, pageRevision, load]);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const calendarDateKeys = useMemo(
    () => new Set(grid.map((cell) => toDateKey(cell.date))),
    [grid]
  );

  const calendarIndexes = useMemo(
    () => buildDailyCalendarIndexes(notes, calendarDateKeys),
    [calendarDateKeys, notes]
  );
  const indexedNotes = calendarIndexes.indexedNotes;
  const deferredIndexedNotes = useDeferredValue(indexedNotes);
  const notesById = calendarIndexes.notesById;
  // Each day can hold multiple note pages (Notion-style), grouped by 日期.
  const notesByDate = calendarIndexes.notesByDate;

  // Add a new note page on the given day, then open it for editing.
  const addNote = useCallback(
    async (dateKey: string) => {
      if (creatingDateKey) return;
      loadRequestRef.current += 1;
      setCreatingDateKey(dateKey);
      const props = [
        { ...createPageProperty("date", "日期"), value: dateKey },
        createPageProperty("text", "要点"),
        createPageProperty("text", "Summary"),
        createPageProperty("tags", "相关公司"),
        createPageProperty("tags", "相关行业"),
      ];
      const properties = stringifyPageProperties(props);
      const initialRootId = rootId ?? getModuleRootIdSync("daily");
      const now = new Date().toISOString();
      const optimisticNote: DailyNote = {
        ...makeRemoteBackedPage({
          id: generateId(),
          parentId: initialRootId,
          title: dateKey,
          icon: null,
          properties,
          contentText: "",
          position: Date.now(),
          depth: initialRootId ? 1 : 0,
          createdAt: now,
          updatedAt: now,
        }),
        properties,
        dailyDateKey: dateKey,
        cloudOnly: true,
      };
      setOpeningDraft({ pageId: optimisticNote.id, dateKey });
      rememberPendingPageDraft(optimisticNote);
      rememberPageRouteHandoff(optimisticNote, "daily-create");
      setNotes((current) => [
        optimisticNote,
        ...current.filter((item) => item.id !== optimisticNote.id),
      ]);
      upsertPages([optimisticNote]);
      writeOptimisticDailyHotCache({
        note: optimisticNote,
        currentNotes: collectVisibleDailyNotesForHotCache(notesByDate),
        viewMonth,
        rootId: initialRootId,
      });
      void seedDailyNoteForImmediateOpen(optimisticNote);
      window.setTimeout(() => {
        setCreatingDateKey((current) => (current === dateKey ? null : current));
      }, 250);

      const pageRoute = `/page/${optimisticNote.id}`;
      warmPageRoute();
      try {
        router.prefetch(pageRoute);
      } catch {
        // Route prefetch is best-effort. The local draft and route handoff
        // already give the full page enough metadata for immediate first paint.
      }
      setCloudNotice(`${dateKey} 的每日纪要已打开，后台会加入账号云端上传队列…`);
      openPage(optimisticNote, { source: "daily-create" });
      void (async () => {
        try {
          const dailyRootId = initialRootId ?? (await getModuleRootId("daily"));
          if (!rootId) setRootId(dailyRootId);
          const latestNote = await getLatestOpenedDailyNote(optimisticNote);
          const noteForSave: DailyNote = {
            ...latestNote,
            parent_id: dailyRootId,
            depth: 1,
            dailyDateKey: dateKey,
            updated_at:
              latestNote.parent_id === dailyRootId
                ? latestNote.updated_at
                : new Date().toISOString(),
          };
          setNotes((current) =>
            current.map((item) =>
              item.id === noteForSave.id ? noteForSave : item
            )
          );
          upsertPages([noteForSave]);
          rememberPageRouteHandoff(noteForSave, "daily-create");
          const persistStatus = await persistOptimisticDailyNote(
            dailyRootId,
            noteForSave,
            upsertPages
          );
          setCloudNotice(
            persistStatus === "queued"
              ? `${dateKey} 的每日纪要已在本机保存，并加入云端后台上传队列。`
              : `${dateKey} 的每日纪要已在本机保存；登录或配置账号云端后会自动同步。`
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "账号云端保存失败";
          setCloudNotice(`每日纪要已在当前页面打开，但后台保存失败：${message}`);
        } finally {
          setOpeningDraft((current) =>
            current?.pageId === optimisticNote.id ? null : current
          );
          setCreatingDateKey((current) => (current === dateKey ? null : current));
        }
      })();
    },
    [
      creatingDateKey,
      notesByDate,
      rootId,
      openPage,
      router,
      upsertPages,
      viewMonth,
      warmPageRoute,
    ]
  );

  const primeDailyNoteOpen = useCallback(
    (note: DailyNote, source: "daily-create" | "daily-open" = "daily-open") => {
      warmPageRoute();
      warmPagePeekModal();
      upsertPages([note]);
      rememberPendingPageDraft(note);
      rememberPageRouteHandoff(note, source);
      try {
        router.prefetch(`/page/${note.id}`);
      } catch {
        // Route prefetch is best-effort. The pending draft and handoff carry
        // the metadata needed for immediate first paint.
      }
    },
    [router, upsertPages, warmPageRoute]
  );

  const openDailyNoteFullPage = useCallback(
    (note: DailyNote, source: "daily-create" | "daily-open" = "daily-open") => {
      openPage(note, { source });
    },
    [openPage]
  );

  const openDailyNoteFullPageById = useCallback(
    (pageId: string) => {
      const inCalendarNote = notesById.get(pageId);
      const note =
        inCalendarNote ??
        (peekInitialPage?.id === pageId ? peekInitialPage : null);
      if (note) {
        openDailyNoteFullPage(note, "daily-open");
        return;
      }
      const storePage = useWorkspaceStore.getState().getPageById(pageId) ?? null;
      if (storePage) {
        openDailyNoteFullPage(
          {
            ...storePage,
            dailyDateKey: readDailyNoteDateKey(storePage),
          },
          "daily-open"
        );
        return;
      }
      openPage(pageId, { source: "daily-open" });
    },
    [notesById, openDailyNoteFullPage, openPage, peekInitialPage]
  );

  const openNotePage = useCallback((note: DailyNote) => {
    primeDailyNoteOpen(note, "daily-open");
    setOpeningNoteId(note.id);
    setPeekPageId(note.id);
    setPeekInitialPage(note);
  }, [primeDailyNoteOpen]);

  const handlePeekReady = useCallback((pageId: string) => {
    setOpeningNoteId((current) => (current === pageId ? null : current));
  }, []);

  useEffect(() => {
    if (peekPageId) return;
    if (!openingNoteId) return;
    queueMicrotask(() => {
      setOpeningNoteId((current) =>
        current === openingNoteId ? null : current
      );
    });
  }, [openingNoteId, peekPageId]);

  const toggleDateExpansion = useCallback((dateKey: string) => {
    setExpandedDateKeys((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) {
        next.delete(dateKey);
        setVisibleNoteLimitByDate((limits) => {
          if (!limits.has(dateKey)) return limits;
          const nextLimits = new Map(limits);
          nextLimits.delete(dateKey);
          return nextLimits;
        });
      } else {
        next.add(dateKey);
        setVisibleNoteLimitByDate((limits) => {
          const nextLimits = new Map(limits);
          nextLimits.set(
            dateKey,
            DAILY_CALENDAR_VISIBLE_LIMIT + DAILY_CALENDAR_EXPAND_BATCH
          );
          return nextLimits;
        });
      }
      return next;
    });
  }, []);

  const showMoreNotesForDate = useCallback(
    (dateKey: string, totalCount: number) => {
      setExpandedDateKeys((current) => {
        if (current.has(dateKey)) return current;
        const next = new Set(current);
        next.add(dateKey);
        return next;
      });
      setVisibleNoteLimitByDate((limits) => {
        const currentLimit =
          limits.get(dateKey) ??
          DAILY_CALENDAR_VISIBLE_LIMIT + DAILY_CALENDAR_EXPAND_BATCH;
        const nextLimits = new Map(limits);
        nextLimits.set(
          dateKey,
          Math.min(totalCount, currentLimit + DAILY_CALENDAR_EXPAND_BATCH)
        );
        return nextLimits;
      });
    },
    []
  );

  // Drag a note chip onto another day: rewrite its 日期 property (and the
  // title too when the note is still date-titled) so it moves on the calendar.
  const moveNoteToDate = useCallback(
    async (noteId: string, dateKey: string) => {
      const note = notesById.get(noteId);
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
    [notesById, upsertPages]
  );

  const todayKey = toDateKey(new Date());

  const recent = useMemo(
    () =>
      getRecentIndexedDailyNotes(
        deferredIndexedNotes,
        DAILY_RECENT_VISIBLE_LIMIT
      ),
    [deferredIndexedNotes]
  );

  const goPrev = () =>
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
    );
  const goNext = () =>
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
    );
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
              onPointerEnter={warmPageRoute}
              onPointerDown={warmPageRoute}
              onFocus={warmPageRoute}
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
              const isExpanded = expandedDateKeys.has(key);
              const visibleLimit = isExpanded
                ? (visibleNoteLimitByDate.get(key) ??
                  DAILY_CALENDAR_VISIBLE_LIMIT + DAILY_CALENDAR_EXPAND_BATCH)
                : DAILY_CALENDAR_VISIBLE_LIMIT;
              const visibleNotes = dayNotes.slice(0, visibleLimit);
              const hiddenCount = Math.max(
                0,
                dayNotes.length - visibleNotes.length
              );
              const nextBatchCount = Math.min(
                DAILY_CALENDAR_EXPAND_BATCH,
                hiddenCount
              );
              const isToday = key === todayKey;
              const isDropTarget = draggedNoteId !== null && dragOverDateKey === key;
              const isOpeningDraft = openingDraft?.dateKey === key;
              return (
                <div
                  key={key}
                  data-testid={`daily-calendar-day-${key}`}
                  className={`group relative z-0 flex min-h-40 flex-col border-b border-r border-zinc-100 p-1.5 hover:z-20 dark:border-zinc-800/70 ${
                    cell.inMonth ? "" : "bg-zinc-50/50 dark:bg-zinc-900/40"
                  } ${
                    isDropTarget
                      ? "rounded-md ring-2 ring-inset ring-blue-400 bg-blue-50/60 dark:bg-blue-950/30"
                      : ""
                  }`}
                  onPointerEnter={warmPageRoute}
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
                      aria-label={`在 ${key} 新增每日纪要`}
                      data-testid={`daily-add-note-${key}`}
                      disabled={creatingDateKey !== null}
                      onPointerEnter={warmPageRoute}
                      onPointerDown={warmPageRoute}
                      onFocus={warmPageRoute}
                      onClick={() => void addNote(key)}
                      className="flex h-6 w-6 items-center justify-center rounded text-base text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                      title="在这天新增纪要"
                    >
                      {creatingDateKey === key || isOpeningDraft ? "…" : "+"}
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
                    {isOpeningDraft && (
                      <button
                        type="button"
                        data-testid={`daily-opening-note-${key}`}
                        onClick={() => {
                          if (openingDraft) {
                            openDailyNoteFullPageById(openingDraft.pageId);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-left text-xs leading-4 text-amber-700 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                        title={`${key} 的新纪要正在打开`}
                      >
                        <span className="shrink-0">↗</span>
                        <span className="min-w-0 flex-1 truncate">
                          正在打开新纪要…
                        </span>
                      </button>
                    )}
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
                        onPointerEnter={warmPageRoute}
                        onPointerDown={() =>
                          primeDailyNoteOpen(note, "daily-open")
                        }
                        onFocus={() => primeDailyNoteOpen(note, "daily-open")}
                        onClick={() => openNotePage(note)}
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
                        } ${
                          openingNoteId === note.id
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60"
                            : ""
                        }`}
                        title={displayPageTitle(note.title)}
                      >
                        {openingNoteId === note.id ? (
                          <span className="shrink-0 leading-4">↗</span>
                        ) : note.icon ? (
                          <span className="shrink-0 leading-4">{note.icon}</span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">
                          {openingNoteId === note.id
                            ? "正在打开纪要…"
                            : displayPageTitle(note.title)}
                        </span>
                      </button>
                    ))}
                    {dayNotes.length > DAILY_CALENDAR_VISIBLE_LIMIT && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isExpanded && hiddenCount === 0) {
                            toggleDateExpansion(key);
                            return;
                          }
                          if (isExpanded) {
                            showMoreNotesForDate(key, dayNotes.length);
                            return;
                          }
                          toggleDateExpansion(key);
                        }}
                        aria-expanded={isExpanded}
                        className="rounded-md px-2 py-1 text-left text-xs leading-4 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {isExpanded
                          ? hiddenCount > 0
                            ? `再显示 ${nextBatchCount} 条（剩余 ${hiddenCount}）`
                            : `收起到 ${DAILY_CALENDAR_VISIBLE_LIMIT} 条`
                          : `+${hiddenCount} 条，点击展开`}
                      </button>
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
                {recent.map(({ note, dateKey }) => (
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
                      onPointerEnter={warmPageRoute}
                      onPointerDown={() =>
                        primeDailyNoteOpen(note, "daily-open")
                      }
                      onFocus={() => primeDailyNoteOpen(note, "daily-open")}
                      onClick={() => openNotePage(note)}
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
                        {dateKey}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 truncate ${
                          openingNoteId === note.id
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {openingNoteId === note.id ? (
                          <span>↗</span>
                        ) : (
                          note.icon && <span>{note.icon}</span>
                        )}
                        <span className="truncate">
                          {openingNoteId === note.id
                            ? "正在打开纪要…"
                            : displayPageTitle(note.title)}
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

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => {
            setContextMenu(null);
            openDailyNoteFullPageById(id);
          }}
          onOpenFull={openDailyNoteFullPageById}
          onChanged={() => void load({ includeCloud: false })}
        />
      )}
      {peekPageId && (
        <PagePeekModal
          pageId={peekPageId}
          initialPage={peekInitialPage}
          onClose={() => {
            setOpeningNoteId(null);
            setPeekPageId(null);
            setPeekInitialPage(null);
          }}
          onOpenFull={(id) => {
            setOpeningNoteId(null);
            setPeekPageId(null);
            setPeekInitialPage(null);
            openDailyNoteFullPageById(id);
          }}
          onReady={handlePeekReady}
          onChanged={() => void load({ includeCloud: false })}
        />
      )}
    </div>
  );
}

async function ensureDailyDateIndexBackfilled(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isDailyDateIndexBackfillDone()) return;
  if (dailyDateIndexBackfillRunning) return;
  dailyDateIndexBackfillRunning = true;
  try {
    for (let pass = 0; pass < DAILY_DATE_INDEX_BACKFILL_MAX_PASSES; pass += 1) {
      const result = await rebuildPageDateKeyIndex({
        limit: DAILY_DATE_INDEX_BACKFILL_BATCH,
        includeRemaining: false,
      });
      if (
        result.remaining === 0 ||
        result.scanned < DAILY_DATE_INDEX_BACKFILL_BATCH
      ) {
        markDailyDateIndexBackfillDone();
        return;
      }
      await waitForDailyBackfillIdle();
    }
    window.setTimeout(() => {
      void ensureDailyDateIndexBackfilled();
    }, 1500);
  } catch {
    // Keep the calendar usable from cloud metadata even if this browser cache
    // cannot rebuild its optional date index yet.
  } finally {
    dailyDateIndexBackfillRunning = false;
  }
}

function isDailyDateIndexBackfillDone(): boolean {
  if (dailyDateIndexBackfillDoneInMemory) return true;
  try {
    return window.localStorage.getItem(DAILY_DATE_INDEX_BACKFILL_KEY) === "done";
  } catch {
    return false;
  }
}

function markDailyDateIndexBackfillDone(): void {
  dailyDateIndexBackfillDoneInMemory = true;
  try {
    window.localStorage.setItem(DAILY_DATE_INDEX_BACKFILL_KEY, "done");
  } catch {
    // Memory flag is enough for this tab; the cloud account remains the source
    // of truth and the browser cache can be rebuilt later.
  }
}

function waitForDailyBackfillIdle(): Promise<void> {
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
  };
  return new Promise((resolve) => {
    if (maybeWindow.requestIdleCallback) {
      maybeWindow.requestIdleCallback(resolve, { timeout: 500 });
      return;
    }
    window.setTimeout(resolve, 80);
  });
}

function scheduleDailyIdleTask(callback: () => void, timeout = 500): () => void {
  if (typeof window === "undefined") return () => undefined;
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (maybeWindow.requestIdleCallback && maybeWindow.cancelIdleCallback) {
    const idleId = maybeWindow.requestIdleCallback(callback, { timeout });
    return () => maybeWindow.cancelIdleCallback?.(idleId);
  }
  const timer = window.setTimeout(callback, Math.min(timeout, 160));
  return () => window.clearTimeout(timer);
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

function buildDailyCalendarIndexes(
  notes: DailyNote[],
  calendarDateKeys: Set<string>
): DailyCalendarIndexes {
  const indexedNotes: IndexedDailyNote[] = [];
  const notesByDate = new Map<string, DailyNote[]>();
  const notesById = new Map<string, DailyNote>();

  for (const note of notes) {
    notesById.set(note.id, note);
    const dateKey = dailyNoteDateKey(note);
    if (!dateKey) continue;
    indexedNotes.push({ note, dateKey });
    if (!calendarDateKeys.has(dateKey)) continue;
    const list = notesByDate.get(dateKey) ?? [];
    list.push(note);
    notesByDate.set(dateKey, list);
  }

  return { indexedNotes, notesByDate, notesById };
}

function getRecentIndexedDailyNotes(
  notes: IndexedDailyNote[],
  limit: number
): IndexedDailyNote[] {
  if (limit <= 0) return [];
  const recent: IndexedDailyNote[] = [];

  for (const note of notes) {
    let insertAt = recent.length;
    while (insertAt > 0 && note.dateKey > recent[insertAt - 1].dateKey) {
      insertAt -= 1;
    }

    if (insertAt >= limit) continue;
    recent.splice(insertAt, 0, note);
    if (recent.length > limit) {
      recent.pop();
    }
  }

  return recent;
}

function collectVisibleDailyNotesForHotCache(
  notesByDate: Map<string, DailyNote[]>
): DailyNote[] {
  const visibleNotes: DailyNote[] = [];
  for (const dayNotes of notesByDate.values()) {
    visibleNotes.push(...dayNotes);
  }
  return visibleNotes;
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

function mergeDailyHotCacheSnapshot(
  byId: Map<string, DailyNote>,
  snapshot: DailyHotCacheSnapshot,
  startDate?: string,
  endDate?: string
): number {
  let merged = 0;
  for (const page of snapshot.pages) {
    if (
      startDate &&
      endDate &&
      (page.daily_date_key < startDate || page.daily_date_key > endDate)
    ) {
      continue;
    }
    if (byId.has(page.id)) continue;
    byId.set(page.id, {
      ...dailyHotCacheSnapshotPageToPage(page),
      dailyDateKey: page.daily_date_key,
      hotCacheOnly: true,
    });
    merged += 1;
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

async function persistDailyCloudMetadata(
  cloud: DailyCloudMetadataResult,
  upsertPages: (pages: Page[]) => void
): Promise<void> {
  if (cloud.status !== "ok" || !cloud.rootId) return;
  const rootRecord = makeDailyRootMetadataRecord(
    cloud.rootId,
    cloud.watermark ?? new Date().toISOString()
  );
  const records = [rootRecord, ...cloud.pages];
  try {
    await applyRemotePageMetadata(records);
    upsertPages(records.map(remoteRecordToPage));
  } catch {
    // Directory cache writes are best-effort; the in-memory calendar still uses
    // the cloud response so the user is not blocked by a local cache problem.
  }
}

function makeDailyRootMetadataRecord(
  rootId: string,
  updatedAt: string
): RemotePageRecord {
  return {
    id: rootId,
    parent_id: null,
    title: "每日纪要",
    icon: "📅",
    cover_url: null,
    content_text: null,
    properties: null,
    position: 0,
    depth: 0,
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: null,
  };
}

async function getLatestOpenedDailyNote(note: DailyNote): Promise<DailyNote> {
  const memoryPage = useWorkspaceStore.getState().getPageById(note.id);
  if (memoryPage) {
    return {
      ...note,
      ...memoryPage,
      dailyDateKey: note.dailyDateKey || readDailyNoteDateKey(memoryPage),
      cloudOnly: true,
    };
  }
  const localPage = await getPage(note.id).catch(() => null);
  if (localPage) {
    return {
      ...note,
      ...localPage,
      dailyDateKey: note.dailyDateKey || readDailyNoteDateKey(localPage),
      cloudOnly: true,
    };
  }
  return note;
}

async function persistOptimisticDailyNote(
  rootId: string,
  note: DailyNote,
  upsertPages: (pages: Page[]) => void
): Promise<"queued" | "local-only"> {
  const rootRecord = makeDailyRootMetadataRecord(rootId, note.updated_at);
  const records = [rootRecord, pageToRemoteRecord(note)];
  const localPages = records.map(remoteRecordToPage);
  try {
    await applyRemotePages(records);
  } catch {
    // The page is already open from memory. Cache persistence can be retried
    // later from the pending upload queue.
  } finally {
    upsertPages(localPages);
  }
  return queueDailyCloudRecords(records);
}

async function seedDailyNoteForImmediateOpen(note: DailyNote): Promise<void> {
  try {
    await applyRemotePages([pageToRemoteRecord(note)]);
  } catch {
    // The in-memory store already has this page. If the rebuildable browser
    // cache is temporarily busy, page opening should still proceed.
  }
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

function queueDailyCloudRecords(
  records: RemotePageRecord[]
): "queued" | "local-only" {
  if (typeof window === "undefined") return "local-only";
  for (const record of records) {
    queueCloudPagePush(record);
  }
  return "queued";
}

function writeOptimisticDailyHotCache({
  note,
  currentNotes,
  viewMonth,
  rootId,
}: {
  note: DailyNote;
  currentNotes: DailyNote[];
  viewMonth: Date;
  rootId: string | null;
}) {
  const visibleRange = buildMonthGrid(viewMonth);
  const startDate = toDateKey(visibleRange[0].date);
  const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);
  writeDailyHotCacheSnapshot({
    startDate,
    endDate,
    rootId,
    pages: [
      note,
      ...currentNotes.filter((currentNote) => currentNote.id !== note.id),
    ],
    source: "optimistic-local",
  });
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
