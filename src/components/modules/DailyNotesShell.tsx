"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
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
import type { DailyCloudMetadataResult } from "@/lib/pages/accountPageSync";
import {
  readPendingPageDraft,
  rememberPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import {
  readPageRouteHandoff,
  rememberPageRouteHandoff,
} from "@/lib/pages/pageRouteHandoff";
import {
  subscribePagesUpdated,
  type PageUpdatePayload,
} from "@/lib/pages/pageUpdateBus";
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
  buildCalendarFirstPaintRange,
  buildCalendarMonthGrid as buildMonthGrid,
  type CalendarMonthCell as MonthCell,
} from "@/lib/sync/calendarFirstPaintRange";
import {
  buildDailyCalendarLoadStatusView,
  createDailyCalendarLoadStatus,
  type DailyCalendarLoadPhase,
  type DailyCalendarLoadStatusState,
  type DailyCalendarLoadStatusView,
  type DailyCalendarLoadTone,
} from "@/lib/sync/dailyCalendarLoadStatus";
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
import PageContextMenu from "@/components/page/LazyPageContextMenu";
import PagePeekModal, {
  warmPagePeekModal,
} from "@/components/page/LazyPagePeekModal";
import type { Page } from "@/lib/utils/types";

const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");

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
  recentNotes: IndexedDailyNote[];
  notesByDate: Map<string, DailyNote[]>;
  notesById: Map<string, DailyNote>;
};

type DailyCalendarRenderSelection = {
  notes: DailyNote[];
  countsByDate: Map<string, number>;
};

type OpeningDailyDraft = {
  pageId: string;
  dateKey: string;
};

type DailyCalendarLoadOptions = {
  includeCloud?: boolean;
  interruptCloud?: boolean;
  preserveVisibleNotes?: boolean;
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];
const DAILY_CALENDAR_VISIBLE_LIMIT = 8;
const DAILY_RECENT_VISIBLE_LIMIT = 8;
const DAILY_RECENT_INDEX_CANDIDATE_LIMIT = 80;
const DAILY_RENDER_RECENT_BUFFER_LIMIT = 80;
const DAILY_CALENDAR_EXPAND_BATCH = 24;
const DAILY_CALENDAR_REVEAL_BUFFER = 2;
const DAILY_CALENDAR_RENDER_DAY_LIMIT =
  DAILY_CALENDAR_VISIBLE_LIMIT + DAILY_CALENDAR_EXPAND_BATCH;
const DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT = 160;
const DAILY_CALENDAR_INITIAL_HYDRATED_DAY_LIMIT = 14;
const DAILY_CALENDAR_HYDRATION_BATCH = 7;
const DAILY_CALENDAR_HYDRATION_FRAME_DELAY_MS = 24;
const DAILY_CALENDAR_OCCUPIED_HYDRATION_BATCH = 10;
const DAILY_CALENDAR_OCCUPIED_HYDRATION_FRAME_DELAY_MS = 32;
const DAILY_PEEK_EDITOR_WARMUP_DELAY_MS = 1400;
const DAILY_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS = 1800;
const DAILY_LOCAL_METADATA_REFRESH_DELAY_MS = 120;
const DAILY_LOCAL_METADATA_FALLBACK_DELAY_MS = 900;
const DAILY_CLOUD_METADATA_RECHECK_DELAY_MS = 900;
const DAILY_INITIAL_CLOUD_RECHECK_DELAY_MS = 450;
const DAILY_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS = 1400;
const DAILY_DATE_INDEX_BACKFILL_BATCH = 240;
const DAILY_DATE_INDEX_BACKFILL_MAX_PASSES = 4;
const DAILY_CLOUD_CACHE_PREFIX = "zhinote.daily.cloudMetadata.";
const DAILY_CLOUD_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
const DAILY_CLOUD_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_DATE_INDEX_BACKFILL_KEY = "zhinote.daily.dateIndex.backfilled.v2";
let dailyDateIndexBackfillRunning = false;
let dailyDateIndexBackfillDoneInMemory = false;

type CachedDailyCloudMetadataResult = DailyCloudMetadataResult & {
  cachedAt: string;
  stale: boolean;
};

type DailyCloudMetadataCacheEntry = DailyCloudMetadataResult & {
  cachedAt?: string;
  stale?: boolean;
};

type DailyCloudMetadataCacheSignature = {
  signature: string;
  cachedAt: number;
};

export default function DailyNotesShell() {
  const router = useRouter();
  const openPage = useLocalFirstPageNavigation();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const pageRevision = usePageRevision();
  const [rootId, setRootId] = useState<string | null>(null);
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [dailyNoteCountByDate, setDailyNoteCountByDate] = useState<
    Map<string, number>
  >(() => new Map());
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const cloudLoadingRef = useRef(false);
  const [calendarLoadStatus, setCalendarLoadStatus] =
    useState<DailyCalendarLoadStatusState>(() =>
      createDailyCalendarLoadStatus({
        phase: "booting",
        backgroundActive: true,
        message: "正在启动每日纪要日历，先准备本地壳和热缓存。",
      })
    );
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
  const [loadingMoreDateKey, setLoadingMoreDateKey] = useState<string | null>(
    null
  );
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [highlightedDailyDateKey, setHighlightedDailyDateKey] = useState("");
  const [expandedDateKeys, setExpandedDateKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [visibleNoteLimitByDate, setVisibleNoteLimitByDate] = useState<
    Map<string, number>
  >(() => new Map());
  const [hydratedDateKeys, setHydratedDateKeys] = useState<Set<string>>(
    () => new Set()
  );
  const loadRequestRef = useRef(0);
  const hotCacheBootstrapKeyRef = useRef("");
  const notesRenderFingerprintRef = useRef("");
  const notesRef = useRef<DailyNote[]>([]);
  const dailyCalendarCellRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingDailyCalendarFocusDateKeyRef = useRef<string | null>(null);
  const dailyHighlightTimerRef = useRef<number | null>(null);
  const observedPageRevisionRef = useRef<string | null>(null);
  const creatingDateKeyRef = useRef<string | null>(null);
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

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    cloudLoadingRef.current = cloudLoading;
  }, [cloudLoading]);

  useEffect(() => {
    const {
      startDate,
      endDate,
      cacheKey: bootstrapKey,
    } = buildCalendarFirstPaintRange(viewMonth, toDateKey);
    if (hotCacheBootstrapKeyRef.current === bootstrapKey) return;
    hotCacheBootstrapKeyRef.current = bootstrapKey;

    const byId = new Map<string, DailyNote>();
    const cachedHotSnapshot = readDailyHotCacheSnapshot(startDate, endDate);
    const overlappingHotSnapshots = readDailyHotCacheSnapshotsForRange(
      startDate,
      endDate
    );
    const cachedCloud = readCachedDailyCloudMetadata(startDate, endDate);
    let merged = 0;
    let rootHint: string | null = cachedHotSnapshot?.root_id ?? null;
    let cachedCloudMerged = 0;

    if (cachedHotSnapshot) {
      merged += mergeDailyHotCacheSnapshot(
        byId,
        cachedHotSnapshot,
        startDate,
        endDate
      );
    }
    for (const snapshot of overlappingHotSnapshots) {
      if (!rootHint) rootHint = snapshot.root_id;
      merged += mergeDailyHotCacheSnapshot(byId, snapshot, startDate, endDate);
    }
    if (cachedCloud?.status === "ok" && cachedCloud.rootId) {
      rootHint = rootHint ?? cachedCloud.rootId;
      cachedCloudMerged = mergeCloudDailyNotes(byId, cachedCloud);
      merged += cachedCloudMerged;
    }
    if (merged === 0) return;

    if (rootHint) {
      rememberModuleRootId("daily", rootHint);
      setRootId(rootHint);
    }
    const selection = selectDailyNotesForCalendarRender(
      Array.from(byId.values()),
      startDate,
      endDate,
      Math.max(DAILY_RECENT_VISIBLE_LIMIT, DAILY_RENDER_RECENT_BUFFER_LIMIT)
    );
    const renderableNotes = selection.notes;
    publishDailyCalendarRenderSelection(
      renderableNotes,
      selection.countsByDate,
      notesRenderFingerprintRef,
      setNotes,
      setDailyNoteCountByDate
    );
    if (cachedCloudMerged > 0) {
      writeDailyHotCacheSnapshot({
        startDate,
        endDate,
        rootId: cachedCloud?.rootId ?? rootHint,
        pages: renderableNotes,
        source: "cloud-metadata",
      });
    }
    setCloudNotice(
      cachedCloudMerged > 0
        ? `已先显示浏览器缓存的云端每日纪要目录 ${renderableNotes.length} 条，正在启动本地数据库和云端校正…`
        : `已先显示本机热缓存 ${renderableNotes.length} 条每日纪要 metadata，正在启动本地数据库和云端校正…`
    );
    setCalendarLoadStatus(
      createDailyCalendarLoadStatus({
        phase: cachedCloudMerged > 0 ? "cached-cloud" : "hot-cache",
        visibleNotes: renderableNotes.length,
        visibleDays: selection.countsByDate.size,
        backgroundActive: true,
        staleCloud: Boolean(cachedCloud?.stale),
        message:
          cachedCloudMerged > 0
            ? "已先显示浏览器缓存的云端目录，正在启动本地数据库和云端校正。"
            : "已先显示本机热缓存，正在启动本地数据库和云端校正。",
      })
    );
  }, [viewMonth]);

  const warmPageRoute = useCallback(() => {
    try {
      router.prefetch("/page/zhinote-route-prefetch");
    } catch {
      // Prefetch only improves perceived speed; it should never block the page.
    }
    if (!pageShellWarmupRef.current) {
      pageShellWarmupRef.current = import("@/components/providers/PageShell").catch(
        () => {
          pageShellWarmupRef.current = null;
        }
      );
    }
  }, [router]);

  const warmDailyPeekOpen = useCallback(() => {
    warmPagePeekModal();
    warmPageRoute();
  }, [warmPageRoute]);

  useEffect(() => {
    const cancelPageShellPreload = scheduleDailyIdleTask(() => {
      warmPageRoute();
    }, 500);
    let cancelPeekEditorWarmup: (() => void) | null = null;
    const peekEditorWarmupTimer = window.setTimeout(() => {
      cancelPeekEditorWarmup = scheduleDailyIdleTask(() => {
        warmPagePeekModal();
      }, DAILY_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS);
    }, DAILY_PEEK_EDITOR_WARMUP_DELAY_MS);
    return () => {
      cancelPageShellPreload();
      window.clearTimeout(peekEditorWarmupTimer);
      cancelPeekEditorWarmup?.();
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

  const load = useCallback(async (opts?: DailyCalendarLoadOptions) => {
    const includeCloud = opts?.includeCloud !== false;
    const interruptCloud = opts?.interruptCloud ?? includeCloud;
    const preserveVisibleNotes =
      opts?.preserveVisibleNotes ?? (!includeCloud && !interruptCloud);
    const requestId =
      !interruptCloud && loadRequestRef.current > 0
        ? loadRequestRef.current
        : loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const performanceStartedAt = new Date().toISOString();
    const performanceStart = getLocalPerformanceNow();
    let firstVisibleMs: number | null = null;
    let firstVisibleCount = 0;
    let localNoteCount = 0;
    if (!includeCloud && interruptCloud) setCloudLoading(false);
    const visibleRange = buildMonthGrid(viewMonth);
    const startDate = toDateKey(visibleRange[0].date);
    const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);
    setCalendarLoadStatus(
      createDailyCalendarLoadStatus({
        phase: "booting",
        visibleNotes: notesRef.current.length,
        visibleDays: countDailyVisibleDays(notesRef.current, startDate, endDate),
        cloudLoading: includeCloud || (!interruptCloud && cloudLoadingRef.current),
        backgroundActive: true,
        message: preserveVisibleNotes
          ? "正在后台刷新本地每日纪要索引，已显示的日历条目会先保留。"
          : includeCloud
            ? "正在读取热缓存、本地索引，并准备云端 metadata 校正。"
            : "正在刷新本地每日纪要索引。",
      })
    );
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
        cloudMetadataPromise = loadPageAccountSyncModule()
          .then(({ fetchDailyCloudMetadata }) =>
            fetchDailyCloudMetadata({
              startDate,
              endDate,
              recentLimit: recentMetadataLimit,
            })
          )
          .catch((error): DailyCloudMetadataResult => {
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

    const selectRenderableNotes = (nextNotes: DailyNote[]) =>
      selectDailyNotesForCalendarRender(
        nextNotes,
        startDate,
        endDate,
        Math.max(DAILY_RECENT_VISIBLE_LIMIT, DAILY_RENDER_RECENT_BUFFER_LIMIT)
      );

    const publishNotes = (
      nextNotes: DailyNote[],
      status?: {
        phase: DailyCalendarLoadPhase;
        backgroundActive?: boolean;
        cloudLoading?: boolean;
        staleCloud?: boolean;
        message?: string | null;
      }
    ) => {
      if (loadRequestRef.current !== requestId) return;
      const selection = selectRenderableNotes(nextNotes);
      const renderableNotes = selection.notes;
      const didPublish = publishDailyCalendarRenderSelection(
        renderableNotes,
        selection.countsByDate,
        notesRenderFingerprintRef,
        setNotes,
        setDailyNoteCountByDate,
        () => loadRequestRef.current === requestId
      );
      if (!didPublish) return;
      if (firstVisibleMs === null && renderableNotes.length > 0) {
        firstVisibleMs = getLocalPerformanceNow() - performanceStart;
        firstVisibleCount = renderableNotes.length;
      }
      if (status) {
        setCalendarLoadStatus(
          createDailyCalendarLoadStatus({
            phase: status.phase,
            visibleNotes: renderableNotes.length,
            visibleDays: selection.countsByDate.size,
            cloudLoading: Boolean(status.cloudLoading),
            backgroundActive: Boolean(status.backgroundActive),
            staleCloud: Boolean(status.staleCloud),
            message: status.message ?? null,
          })
        );
      }
    };

    const publishCalendarStatus = (
      phase: DailyCalendarLoadPhase,
      nextNotes: DailyNote[] = Array.from(byId.values()),
      status?: {
        backgroundActive?: boolean;
        cloudLoading?: boolean;
        staleCloud?: boolean;
        message?: string | null;
      }
    ) => {
      if (loadRequestRef.current !== requestId) return;
      const selection = selectRenderableNotes(nextNotes);
      setCalendarLoadStatus(
        createDailyCalendarLoadStatus({
          phase,
          visibleNotes: selection.notes.length,
          visibleDays: selection.countsByDate.size,
          cloudLoading: Boolean(status?.cloudLoading),
          backgroundActive: Boolean(status?.backgroundActive),
          staleCloud: Boolean(status?.staleCloud),
          message: status?.message ?? null,
        })
      );
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
          cached_cloud_stale: cachedCloud?.stale ? 1 : 0,
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

    const earlyCloudMetadata = includeCloud
      ? startDailyCloudMetadataFetch()
      : null;
    if (earlyCloudMetadata) {
      void earlyCloudMetadata.then((cloud) => {
        if (loadRequestRef.current !== requestId || firstVisibleMs !== null) {
          return;
        }
        if (cloud.status !== "ok" || !cloud.rootId || cloud.pages.length === 0) {
          return;
        }
        rememberModuleRootId("daily", cloud.rootId);
        publishRootId(cloud.rootId);
        const merged = mergeCloudDailyNotes(byId, cloud);
        if (merged <= 0) return;
        publishNotes(Array.from(byId.values()), {
          phase: "cloud-checking",
          backgroundActive: true,
          cloudLoading: true,
          message:
            "云端每日纪要目录先返回，已先显示 metadata；本地索引和正文继续后台补齐。",
        });
        publishNotice(
          `云端每日纪要目录先返回 ${cloud.pages.length} 条，已先显示日历 metadata；本地索引继续后台校正…`
        );
      });
    }

    if (cachedHotSnapshot) {
      const merged = mergeDailyHotCacheSnapshot(
        byId,
        cachedHotSnapshot,
        startDate,
        endDate
      );
      if (merged > 0) {
        publishNotes(Array.from(byId.values()), {
          phase: "hot-cache",
          backgroundActive: true,
          cloudLoading: includeCloud,
          message: `已先显示本机热缓存 ${merged} 条，后台继续校正本地和云端主库。`,
        });
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
      publishNotes(Array.from(byId.values()), {
        phase: "hot-cache",
        backgroundActive: true,
        cloudLoading: includeCloud,
        message: `已先显示本机重叠热缓存 ${overlappingHotMerged} 条，后台继续校正。`,
      });
      publishNotice(
        `已先显示本机重叠热缓存 ${overlappingHotMerged} 条每日纪要 metadata，后台继续校正本地和云端主库…`
      );
    }

    if (cachedCloud?.status === "ok" && cachedCloud.rootId) {
      rememberModuleRootId("daily", cachedCloud.rootId);
      publishRootId(cachedCloud.rootId);
      const merged = mergeCloudDailyNotes(byId, cachedCloud);
      if (merged > 0) {
        publishNotes(Array.from(byId.values()), {
          phase: "cached-cloud",
          backgroundActive: true,
          cloudLoading: includeCloud,
          staleCloud: cachedCloud.stale,
          message: cachedCloud.stale
            ? "已先显示较早缓存的云端目录，后台刷新到最新。"
            : "已先显示浏览器缓存的云端目录，后台继续校正。",
        });
      }
      publishNotice(
        cachedCloud.stale
          ? `已先显示较早缓存的云端每日纪要目录 ${cachedCloud.pages.length} 条，正在后台更新到最新…`
          : `已先显示缓存的云端每日纪要 ${cachedCloud.pages.length} 条，正在后台更新…`
      );
    }

    if (preserveVisibleNotes) {
      const retained = seedVisibleDailyNotesForBackgroundRefresh(
        byId,
        notesRef.current
      );
      if (retained > 0) {
        publishNotes(Array.from(byId.values()), {
          phase: "hot-cache",
          backgroundActive: true,
          cloudLoading: !interruptCloud && cloudLoadingRef.current,
          staleCloud: Boolean(cachedCloud?.stale),
          message: `后台刷新会先保留当前已显示的 ${retained} 条纪要，避免本地索引短暂缺失时日历闪空。`,
        });
      }
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
          publishNotes(Array.from(nextById.values()), {
            phase: "local-index",
            backgroundActive: includeCloud,
            cloudLoading: includeCloud,
            message: "已切换到确认后的每日纪要根目录，本地索引已刷新。",
          });
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
    publishNotes(Array.from(byId.values()), {
      phase: "local-index",
      backgroundActive: includeCloud,
      cloudLoading: includeCloud,
      message: includeCloud
        ? "本地日期索引已显示，正在后台校正云端 metadata。"
        : "本地日期索引已刷新。",
    });
    writeDailyHotCacheSnapshot({
      startDate,
      endDate,
      rootId: dailyRootId,
      pages: selectRenderableNotes(Array.from(byId.values())).notes,
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
        publishNotes(Array.from(fallbackById.values()), {
          phase: "local-fallback",
          backgroundActive: true,
          cloudLoading: includeCloud,
          message: "后台已补齐旧导入/未索引 metadata，正在分批校正日期索引。",
        });
        writeDailyHotCacheSnapshot({
          startDate,
          endDate,
          rootId: dailyRootId,
          pages: selectRenderableNotes(Array.from(fallbackById.values())).notes,
          source: "local-fallback-metadata",
        });

        await ensureDailyDateIndexBackfilled();
        if (loadRequestRef.current !== requestId) return;
        publishCalendarStatus("index-backfill", Array.from(byId.values()), {
          backgroundActive: true,
          cloudLoading: includeCloud,
          message: "日期索引已完成一轮分批校正，正在复查当前月目录。",
        });
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
        publishNotes(Array.from(nextById.values()), {
          phase: includeCloud ? "cloud-checking" : "local-index",
          backgroundActive: includeCloud,
          cloudLoading: includeCloud,
          message: includeCloud
            ? "本地补齐完成，正在等待云端 metadata 校正。"
            : "本地补齐完成，当前月目录已稳定。",
        });
      })()
        .catch(() => undefined);
    }, 450);

    if (includeCloud) {
      setCloudLoading(true);
      publishCalendarStatus("cloud-checking", Array.from(byId.values()), {
        backgroundActive: true,
        cloudLoading: true,
        staleCloud: Boolean(cachedCloud?.stale),
        message: "本地目录已可用，正在读取云端 metadata 校正。",
      });
      if (cachedCloud?.status === "ok" && cachedCloud.rootId) {
        if (!cachedCloud.stale) {
          void persistDailyCloudMetadata(cachedCloud, upsertPages);
        }
      } else {
        publishNotice("本地每日纪要已显示，正在后台检查云端更新…");
      }

      try {
        const cloudMetadata =
          earlyCloudMetadata ?? startDailyCloudMetadataFetch();
        if (!cloudMetadata) return;
        const cloud = await cloudMetadata;
        if (cloud.status === "ok" && cloud.rootId) {
          rememberModuleRootId("daily", cloud.rootId);
          publishRootId(cloud.rootId);
          const merged = mergeCloudDailyNotes(byId, cloud);
          publishNotes(Array.from(byId.values()), {
            phase: "cloud-ready",
            backgroundActive: false,
            cloudLoading: false,
            message:
              cloud.pages.length > 0
                ? `云端 metadata 已校正，当前范围 ${cloud.rangeCount ?? 0} 条。`
                : "云端 metadata 已校正，当前月份没有返回更多纪要。",
          });
          writeCachedDailyCloudMetadata(startDate, endDate, cloud);
          writeDailyHotCacheSnapshot({
            startDate,
            endDate,
            rootId: cloud.rootId,
            pages: selectRenderableNotes(Array.from(byId.values())).notes,
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
          publishCalendarStatus("local-only", Array.from(byId.values()), {
            backgroundActive: false,
            cloudLoading: false,
            message: "页面同步已关闭，只显示本机每日纪要。",
          });
          publishNotice("页面同步已关闭，只显示本机每日纪要。");
          recordDailyPerformance("cloud-disabled");
        } else if (cloud.status === "unauthenticated") {
          publishCalendarStatus("local-only", Array.from(byId.values()), {
            backgroundActive: false,
            cloudLoading: false,
            message: "当前浏览器未登录账号，只显示本机每日纪要。",
          });
          publishNotice("当前浏览器未登录账号，只显示本机每日纪要。");
          recordDailyPerformance("cloud-unauthenticated");
        } else if (cloud.status === "unconfigured") {
          publishCalendarStatus("local-only", Array.from(byId.values()), {
            backgroundActive: false,
            cloudLoading: false,
            message: "云端账号系统未配置，只显示本机每日纪要。",
          });
          publishNotice("云端账号系统未配置，只显示本机每日纪要。");
          recordDailyPerformance("cloud-unconfigured");
        } else {
          publishCalendarStatus("cloud-error", Array.from(byId.values()), {
            backgroundActive: false,
            cloudLoading: false,
            message: cloud.message ?? "云端每日纪要索引读取失败。",
          });
          publishNotice(cloud.message ?? "云端每日纪要索引读取失败。");
          recordDailyPerformance("cloud-error");
        }
      } catch {
        publishCalendarStatus("cloud-error", Array.from(byId.values()), {
          backgroundActive: false,
          cloudLoading: false,
          message: "云端每日纪要索引读取失败。",
        });
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
      void load({
        includeCloud: false,
        interruptCloud: false,
        preserveVisibleNotes: true,
      });
    });

    let cancelCloudRecheck: (() => void) | null = null;
    const cloudRecheckTimer = window.setTimeout(() => {
      cancelCloudRecheck = scheduleDailyIdleTask(() => {
        void load({
          includeCloud: true,
          preserveVisibleNotes: true,
        });
      }, DAILY_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS);
    }, DAILY_INITIAL_CLOUD_RECHECK_DELAY_MS);

    return () => {
      window.clearTimeout(cloudRecheckTimer);
      cancelCloudRecheck?.();
    };
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
      void load({
        includeCloud: false,
        interruptCloud: false,
        preserveVisibleNotes: true,
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [dbReady, pageRevision, load]);

  useEffect(() => {
    if (!dbReady) return;
    let localReloadTimer: number | null = null;
    let fallbackReloadTimer: number | null = null;
    let cloudRecheckTimer: number | null = null;

    const scheduleLocalMetadataRefresh = () => {
      if (localReloadTimer !== null) window.clearTimeout(localReloadTimer);
      if (fallbackReloadTimer !== null) window.clearTimeout(fallbackReloadTimer);
      if (cloudRecheckTimer !== null) window.clearTimeout(cloudRecheckTimer);
      localReloadTimer = window.setTimeout(() => {
        void load({
          includeCloud: false,
          interruptCloud: false,
          preserveVisibleNotes: true,
        });
      }, DAILY_LOCAL_METADATA_REFRESH_DELAY_MS);
      fallbackReloadTimer = window.setTimeout(() => {
        void load({
          includeCloud: false,
          interruptCloud: false,
          preserveVisibleNotes: true,
        });
      }, DAILY_LOCAL_METADATA_FALLBACK_DELAY_MS);
      cloudRecheckTimer = window.setTimeout(() => {
        void load({ includeCloud: true });
      }, DAILY_CLOUD_METADATA_RECHECK_DELAY_MS);
    };

    const unsubscribe = subscribePagesUpdated((message) => {
      const pages = message.pages;
      if (!pages || pages.length === 0) {
        scheduleLocalMetadataRefresh();
        return;
      }

      const dailyRootId = rootId ?? getModuleRootIdSync("daily");
      const knownDailyIds = new Set(notesRef.current.map((note) => note.id));
      const dailyPayloads = pages.filter((payload) =>
        isDailyCalendarPageUpdate(payload, dailyRootId, knownDailyIds)
      );
      if (dailyPayloads.length === 0) return;

      applyDailyPageUpdatePayloads(
        dailyPayloads,
        setNotes,
        notesRef,
        viewMonth
      );
      scheduleLocalMetadataRefresh();
    });

    return () => {
      if (localReloadTimer !== null) window.clearTimeout(localReloadTimer);
      if (fallbackReloadTimer !== null) window.clearTimeout(fallbackReloadTimer);
      if (cloudRecheckTimer !== null) window.clearTimeout(cloudRecheckTimer);
      unsubscribe();
    };
  }, [dbReady, load, rootId, viewMonth]);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const todayKey = toDateKey(new Date());
  const calendarDateKeys = useMemo(
    () => new Set(grid.map((cell) => toDateKey(cell.date))),
    [grid]
  );
  useEffect(() => {
    setExpandedDateKeys((current) =>
      pruneDailyCalendarDateKeySet(current, calendarDateKeys)
    );
    setVisibleNoteLimitByDate((current) =>
      pruneDailyCalendarDateLimitMap(current, calendarDateKeys)
    );
  }, [calendarDateKeys]);
  const hydrateDailyDateKey = useCallback((dateKey: string) => {
    setHydratedDateKeys((current) => {
      if (current.has(dateKey)) return current;
      const next = new Set(current);
      next.add(dateKey);
      return next;
    });
  }, []);

  const focusDailyCalendarDate = useCallback(
    (dateKey: string) => {
      const date = parseDateKeyToLocalDate(dateKey);
      if (!date) return;

      pendingDailyCalendarFocusDateKeyRef.current = dateKey;
      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setHighlightedDailyDateKey(dateKey);
      hydrateDailyDateKey(dateKey);

      if (dailyHighlightTimerRef.current) {
        window.clearTimeout(dailyHighlightTimerRef.current);
      }
      dailyHighlightTimerRef.current = window.setTimeout(() => {
        setHighlightedDailyDateKey((current) =>
          current === dateKey ? "" : current
        );
        dailyHighlightTimerRef.current = null;
      }, 7000);
    },
    [hydrateDailyDateKey, setViewMonth]
  );

  useEffect(() => {
    const dateKey = pendingDailyCalendarFocusDateKeyRef.current;
    if (!dateKey) return;

    const node = dailyCalendarCellRefs.current.get(dateKey);
    if (!node) return;

    const frame = window.requestAnimationFrame(() => {
      if (pendingDailyCalendarFocusDateKeyRef.current !== dateKey) return;
      dailyCalendarCellRefs.current.get(dateKey)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      pendingDailyCalendarFocusDateKeyRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    expandedDateKeys,
    highlightedDailyDateKey,
    notes,
    visibleNoteLimitByDate,
    viewMonth,
  ]);

  const revealDailyNoteOnCalendar = useCallback(
    (note: DailyNote) => {
      const dateKey = dailyNoteDateKey(note);
      if (!dateKey) return;

      const currentDayNotes = [
        note,
        ...notesRef.current.filter((item) => item.id !== note.id),
      ].filter((item) => dailyNoteDateKey(item) === dateKey);
      const nextIndex = currentDayNotes.findIndex(
        (item) => item.id === note.id
      );
      const requiredLimit =
        nextIndex >= 0 ? nextIndex + 1 : DAILY_CALENDAR_VISIBLE_LIMIT;

      if (requiredLimit > DAILY_CALENDAR_VISIBLE_LIMIT) {
        setExpandedDateKeys((current) => {
          if (current.has(dateKey)) return current;
          const next = new Set(current);
          next.add(dateKey);
          return next;
        });
        setVisibleNoteLimitByDate((limits) => {
          const currentLimit =
            limits.get(dateKey) ?? DAILY_CALENDAR_VISIBLE_LIMIT;
          if (currentLimit >= requiredLimit) return limits;
          const next = new Map(limits);
          next.set(
            dateKey,
            Math.min(
              currentDayNotes.length,
              requiredLimit + DAILY_CALENDAR_REVEAL_BUFFER
            )
          );
          return next;
        });
      }

      focusDailyCalendarDate(dateKey);
    },
    [focusDailyCalendarDate]
  );

  useEffect(() => {
    let cancelled = false;
    let cancelScheduledBatch: (() => void) | null = null;
    const allDateKeys = grid.map((cell) => toDateKey(cell.date));
    const initialDateKeys = buildInitialDailyCalendarHydrationKeys(
      grid,
      todayKey
    );
    const remainingDateKeys = allDateKeys.filter(
      (dateKey) => !initialDateKeys.has(dateKey)
    );
    setHydratedDateKeys(initialDateKeys);

    const revealNextBatch = () => {
      cancelScheduledBatch = null;
      if (cancelled || remainingDateKeys.length === 0) return;
      const nextBatch = remainingDateKeys.splice(
        0,
        DAILY_CALENDAR_HYDRATION_BATCH
      );
      setHydratedDateKeys((current) => {
        const next = new Set(current);
        for (const dateKey of nextBatch) next.add(dateKey);
        return next;
      });
      cancelScheduledBatch = scheduleDailyIdleTask(
        revealNextBatch,
        DAILY_CALENDAR_HYDRATION_FRAME_DELAY_MS
      );
    };

    cancelScheduledBatch = scheduleDailyIdleTask(
      revealNextBatch,
      DAILY_CALENDAR_HYDRATION_FRAME_DELAY_MS
    );
    return () => {
      cancelled = true;
      cancelScheduledBatch?.();
    };
  }, [grid, todayKey]);

  useEffect(
    () => () => {
      if (dailyHighlightTimerRef.current) {
        window.clearTimeout(dailyHighlightTimerRef.current);
      }
    },
    []
  );

  const calendarIndexes = useMemo(
    () => buildDailyCalendarIndexes(notes, calendarDateKeys),
    [calendarDateKeys, notes]
  );
  const deferredRecentNotes = useDeferredValue(calendarIndexes.recentNotes);
  const notesById = calendarIndexes.notesById;
  // Each day can hold multiple note pages (Notion-style), grouped by 日期.
  const notesByDate = calendarIndexes.notesByDate;
  const calendarLoadStatusView = useMemo(
    () => buildDailyCalendarLoadStatusView(calendarLoadStatus),
    [calendarLoadStatus]
  );

  useEffect(() => {
    const occupiedDateKeys = buildOccupiedDailyCalendarHydrationKeys(
      grid,
      notesByDate,
      dailyNoteCountByDate
    );
    if (occupiedDateKeys.length === 0) return;

    let cancelled = false;
    let cancelScheduledBatch: (() => void) | null = null;
    const queue = [...occupiedDateKeys];

    const revealNextOccupiedBatch = () => {
      cancelScheduledBatch = null;
      if (cancelled || queue.length === 0) return;
      const nextBatch = queue.splice(
        0,
        DAILY_CALENDAR_OCCUPIED_HYDRATION_BATCH
      );
      setHydratedDateKeys((current) => {
        let changed = false;
        const next = new Set(current);
        for (const dateKey of nextBatch) {
          if (next.has(dateKey)) continue;
          next.add(dateKey);
          changed = true;
        }
        return changed ? next : current;
      });
      if (queue.length > 0) {
        cancelScheduledBatch = scheduleDailyIdleTask(
          revealNextOccupiedBatch,
          DAILY_CALENDAR_OCCUPIED_HYDRATION_FRAME_DELAY_MS
        );
      }
    };

    revealNextOccupiedBatch();

    return () => {
      cancelled = true;
      cancelScheduledBatch?.();
    };
  }, [dailyNoteCountByDate, grid, notesByDate]);

  // Add a new note page on the given day, then open it for editing.
  const addNote = useCallback(
    async (dateKey: string) => {
      if (creatingDateKeyRef.current) return;
      const createStartedAt = getLocalPerformanceNow();
      const createStartedAtIso = new Date().toISOString();
      loadRequestRef.current += 1;
      creatingDateKeyRef.current = dateKey;
      setCreatingDateKey(dateKey);
      const releaseCreatingDate = () => {
        if (creatingDateKeyRef.current === dateKey) {
          creatingDateKeyRef.current = null;
        }
        setCreatingDateKey((current) =>
          current === dateKey ? null : current
        );
      };
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
      warmDailyPeekOpen();
      setOpeningDraft({ pageId: optimisticNote.id, dateKey });
      rememberPendingPageDraft(optimisticNote);
      rememberPageRouteHandoff(optimisticNote, "daily-create");
      setNotes((current) => [
        optimisticNote,
        ...current.filter((item) => item.id !== optimisticNote.id),
      ]);
      upsertPages([optimisticNote]);
      setPeekInitialPage(optimisticNote);
      setOpeningNoteId(optimisticNote.id);
      setPeekPageId(optimisticNote.id);
      const localShellRequestedMs =
        getLocalPerformanceNow() - createStartedAt;
      recordLocalPerformanceSnapshot({
        kind: "page-peek",
        label: "每日纪要新建本地草稿",
        route: "/page/[pageId]#peek",
        status: "daily-create-local-shell-requested",
        startedAt: createStartedAtIso,
        durationMs: localShellRequestedMs,
        localFirstMs: localShellRequestedMs,
        backgroundMs: 0,
        counts: {
          optimistic_draft: 1,
          property_count: props.length,
          local_handoff_seeded: 1,
        },
      });
      revealDailyNoteOnCalendar(optimisticNote);
      scheduleDailyIdleTask(() => {
        writeOptimisticDailyHotCache({
          note: optimisticNote,
          currentNotes: collectVisibleDailyNotesForHotCache(notesByDate),
          viewMonth,
          rootId: initialRootId,
        });
      }, 220);
      scheduleDailyIdleTask(() => {
        void seedDailyNoteForImmediateOpen(optimisticNote);
      }, 320);
      window.setTimeout(() => {
        releaseCreatingDate();
      }, 250);

      const pageRoute = `/page/${optimisticNote.id}`;
      try {
        router.prefetch(pageRoute);
      } catch {
        // Route prefetch is best-effort. The local draft and route handoff
        // already give the full page enough metadata for immediate first paint.
      }
      setCloudNotice(`${dateKey} 的每日纪要已弹出，后台会加入账号云端上传队列…`);
      const optimisticRange = buildMonthGrid(viewMonth);
      setCalendarLoadStatus(
        createDailyCalendarLoadStatus({
          phase: "optimistic-draft",
          visibleNotes: notesRef.current.length + 1,
          visibleDays: Math.max(
            1,
            countDailyVisibleDays(
              [optimisticNote, ...notesRef.current],
              toDateKey(optimisticRange[0].date),
              toDateKey(optimisticRange[optimisticRange.length - 1].date)
            )
          ),
          backgroundActive: true,
          cloudLoading: false,
          message: `${dateKey} 的每日纪要已在本机创建，后台继续保存并排队同步。`,
        })
      );
      scheduleDailyIdleTask(() => {
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
            revealDailyNoteOnCalendar(noteForSave);
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
            releaseCreatingDate();
          }
        })();
      }, 420);
    },
    [
      notesByDate,
      rootId,
      router,
      upsertPages,
      revealDailyNoteOnCalendar,
      viewMonth,
      warmDailyPeekOpen,
    ]
  );

  const addNoteOnMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>, dateKey: string) => {
      if (event.button !== 0) return;
      if (creatingDateKeyRef.current) return;
      event.preventDefault();
      warmDailyPeekOpen();
      hydrateDailyDateKey(dateKey);
      void addNote(dateKey);
    },
    [addNote, hydrateDailyDateKey, warmDailyPeekOpen]
  );

  const addNoteOnPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, dateKey: string) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (creatingDateKeyRef.current) return;
      event.preventDefault();
      warmDailyPeekOpen();
      hydrateDailyDateKey(dateKey);
      void addNote(dateKey);
    },
    [addNote, hydrateDailyDateKey, warmDailyPeekOpen]
  );

  const primeDailyNoteOpen = useCallback(
    (note: DailyNote, source: "daily-create" | "daily-open" = "daily-open") => {
      const initialSeed =
        source === "daily-create" && note.content_text === ""
          ? toDailyNoteSeed(note, note)
          : toDailyNoteMetadataSeed(note, note);
      warmDailyPeekOpen();
      upsertPages([initialSeed]);
      rememberPendingPageDraft(initialSeed);
      rememberPageRouteHandoff(initialSeed, source);
      try {
        router.prefetch(`/page/${note.id}`);
      } catch {
        // Route prefetch is best-effort. The pending draft and handoff carry
        // the metadata needed for immediate first paint.
      }
    },
    [router, upsertPages, warmDailyPeekOpen]
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
      const storePage =
        readPendingPageDraft(pageId) ??
        useWorkspaceStore.getState().getPageById(pageId) ??
        readPageRouteHandoff(pageId) ??
        null;
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
    const seededNote =
      useWorkspaceStore.getState().getPageById(note.id) ?? note;
    if (seededNote.content_text === "") {
      setPeekInitialPage(toDailyNoteSeed(seededNote, note));
    } else {
      setPeekInitialPage(toDailyNoteMetadataSeed(seededNote, note));
    }
    setOpeningNoteId(note.id);
    setPeekPageId(note.id);
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

  const loadMoreNotesForDate = useCallback(
    async (dateKey: string, totalCount: number) => {
      if (!dbReady) {
        showMoreNotesForDate(dateKey, totalCount);
        return;
      }
      if (loadingMoreDateKey) return;
      hydrateDailyDateKey(dateKey);
      showMoreNotesForDate(dateKey, totalCount);
      setLoadingMoreDateKey(dateKey);

      try {
        const dailyRootId =
          rootId ??
          getModuleRootIdSync("daily") ??
          (await getModuleRootId("daily"));
        if (!rootId) setRootId(dailyRootId);
        const currentLoadedCount = notesRef.current.filter(
          (note) => dailyNoteDateKey(note) === dateKey
        ).length;
        const targetRangeLimit = Math.min(
          Math.max(totalCount, DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT),
          currentLoadedCount + DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT
        );
        const metadata = await listDailyPageMetadataForCalendar({
          rootId: dailyRootId,
          startDate: dateKey,
          endDate: dateKey,
          recentLimit: 0,
          includeUnindexedFallback: true,
          rangeLimit: targetRangeLimit,
        });
        const loadedDayNotes = collectDailyNotes(metadata, dailyRootId)
          .filter((note) => dailyNoteDateKey(note) === dateKey)
          .slice(0, targetRangeLimit);

        if (loadedDayNotes.length === 0) {
          setCloudNotice(
            `${dateKey} 这一天暂时只能看到已加载的 ${Math.min(
              totalCount,
              DAILY_CALENDAR_RENDER_DAY_LIMIT
            )}/${totalCount} 条纪要；后台索引完成后会继续出现。`
          );
          return;
        }

        startTransition(() => {
          setNotes((current) => {
            const byId = new Map(current.map((note) => [note.id, note]));
            for (const note of loadedDayNotes) byId.set(note.id, note);
            return Array.from(byId.values());
          });
          setDailyNoteCountByDate((current) => {
            const next = new Map(current);
            next.set(
              dateKey,
              Math.max(
                current.get(dateKey) ?? 0,
                totalCount,
                loadedDayNotes.length
              )
            );
            return next;
          });
        });
        setVisibleNoteLimitByDate((limits) => {
          const currentLimit =
            limits.get(dateKey) ??
            DAILY_CALENDAR_VISIBLE_LIMIT + DAILY_CALENDAR_EXPAND_BATCH;
          const nextLimits = new Map(limits);
          nextLimits.set(
            dateKey,
            Math.min(
              Math.max(totalCount, loadedDayNotes.length),
              currentLimit + DAILY_CALENDAR_EXPAND_BATCH
            )
          );
          return nextLimits;
        });
        setCloudNotice(
          `已按 ${dateKey} 补齐本机每日纪要目录 ${loadedDayNotes.length}/${Math.max(
            totalCount,
            loadedDayNotes.length
          )} 条；为保持日历流畅，日历仍会分批显示，避免卡顿。`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "本机每日纪要目录读取失败";
        setCloudNotice(`${dateKey} 的每日纪要补齐失败：${message}`);
      } finally {
        setLoadingMoreDateKey((current) =>
          current === dateKey ? null : current
        );
      }
    },
    [
      dbReady,
      hydrateDailyDateKey,
      loadingMoreDateKey,
      rootId,
      showMoreNotesForDate,
    ]
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
      const { updatePageWithCloud } = await import(
        "@/lib/pages/cloudPageMutations"
      );
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
        revealDailyNoteOnCalendar(nextNote);
      }
    },
    [notesById, revealDailyNoteOnCalendar, upsertPages]
  );

  const recent = useMemo(
    () => deferredRecentNotes.slice(0, DAILY_RECENT_VISIBLE_LIMIT),
    [deferredRecentNotes]
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
              <DailyCalendarLoadStatusStrip view={calendarLoadStatusView} />
            </div>
            <button
              type="button"
              disabled={creatingDateKey !== null}
              onPointerEnter={warmDailyPeekOpen}
              onPointerDown={(event) => addNoteOnPointerDown(event, todayKey)}
              onMouseDown={(event) => addNoteOnMouseDown(event, todayKey)}
              onFocus={warmDailyPeekOpen}
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
              const dayTotalCount =
                dailyNoteCountByDate.get(key) ?? dayNotes.length;
              const isExpanded = expandedDateKeys.has(key);
              const visibleLimit = isExpanded
                ? (visibleNoteLimitByDate.get(key) ??
                  DAILY_CALENDAR_VISIBLE_LIMIT + DAILY_CALENDAR_EXPAND_BATCH)
                : DAILY_CALENDAR_VISIBLE_LIMIT;
              const visibleNotes = dayNotes.slice(0, visibleLimit);
              const loadedHiddenCount = Math.max(
                0,
                dayNotes.length - visibleNotes.length
              );
              const hiddenCount = Math.max(
                0,
                dayTotalCount - visibleNotes.length
              );
              const nextBatchCount = Math.min(
                DAILY_CALENDAR_EXPAND_BATCH,
                loadedHiddenCount
              );
              const isRenderCapped =
                dayTotalCount > dayNotes.length && loadedHiddenCount === 0;
              const isToday = key === todayKey;
              const isDropTarget = draggedNoteId !== null && dragOverDateKey === key;
              const isHighlighted = highlightedDailyDateKey === key;
              const isOpeningDraft = openingDraft?.dateKey === key;
              const isLoadingMore = loadingMoreDateKey === key;
              const isDateHydrated =
                hydratedDateKeys.has(key) ||
                isExpanded ||
                isDropTarget ||
                isOpeningDraft;
              return (
                <div
                  key={key}
                  ref={(node) => {
                    if (node) {
                      dailyCalendarCellRefs.current.set(key, node);
                    } else {
                      dailyCalendarCellRefs.current.delete(key);
                    }
                  }}
                  data-testid={`daily-calendar-day-${key}`}
                  className={`group relative z-0 flex min-h-40 scroll-mt-24 flex-col border-b border-r border-zinc-100 p-1.5 transition-colors hover:z-20 dark:border-zinc-800/70 ${
                    isHighlighted
                      ? "rounded-md bg-amber-50/80 ring-2 ring-inset ring-amber-300 dark:bg-amber-950/20 dark:ring-amber-500"
                      : cell.inMonth
                        ? ""
                        : "bg-zinc-50/50 dark:bg-zinc-900/40"
                  } ${
                    isDropTarget
                      ? "rounded-md ring-2 ring-inset ring-blue-400 bg-blue-50/60 dark:bg-blue-950/30"
                      : ""
                  }`}
                  onPointerEnter={() => {
                    hydrateDailyDateKey(key);
                    warmPageRoute();
                  }}
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
                      onPointerEnter={warmDailyPeekOpen}
                      onPointerDown={(event) => addNoteOnPointerDown(event, key)}
                      onMouseDown={(event) => addNoteOnMouseDown(event, key)}
                      onFocus={warmDailyPeekOpen}
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
                    {!isDateHydrated && dayTotalCount > 0 && (
                      <button
                        type="button"
                        onClick={() => hydrateDailyDateKey(key)}
                        onPointerEnter={() => hydrateDailyDateKey(key)}
                        className="rounded-md bg-zinc-100/70 px-2 py-1 text-left text-xs leading-4 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        title={`${key} 有 ${dayTotalCount} 条纪要`}
                      >
                        {dayTotalCount} 条纪要，点开查看
                      </button>
                    )}
                    {isDateHydrated && visibleNotes.map((note) => (
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
                        onPointerEnter={warmDailyPeekOpen}
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
                    {isDateHydrated && dayTotalCount > DAILY_CALENDAR_VISIBLE_LIMIT && (
                      <button
                        type="button"
                        disabled={isLoadingMore}
                        onClick={() => {
                          if (isRenderCapped) {
                            void loadMoreNotesForDate(key, dayTotalCount);
                            return;
                          }
                          if (isExpanded && loadedHiddenCount === 0) {
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
                        className="rounded-md px-2 py-1 text-left text-xs leading-4 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-progress disabled:opacity-70 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {isLoadingMore
                          ? "正在补齐…"
                          : isExpanded
                          ? loadedHiddenCount > 0
                            ? `再显示 ${nextBatchCount} 条（剩余 ${hiddenCount}）`
                            : isRenderCapped
                              ? `已显示 ${visibleNotes.length}/${dayTotalCount} 条，点击补齐`
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
                      onPointerEnter={warmDailyPeekOpen}
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
          onChanged={() =>
            void load({
              includeCloud: false,
              interruptCloud: false,
              preserveVisibleNotes: true,
            })
          }
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
          onChanged={() =>
            void load({
              includeCloud: false,
              interruptCloud: false,
              preserveVisibleNotes: true,
            })
          }
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

function isDailyCalendarPageUpdate(
  payload: PageUpdatePayload,
  dailyRootId: string | null,
  knownDailyIds: Set<string>
): boolean {
  if (knownDailyIds.has(payload.id)) return true;
  if (!dailyRootId) return false;
  return payload.id === dailyRootId || payload.parent_id === dailyRootId;
}

function applyDailyPageUpdatePayloads(
  payloads: PageUpdatePayload[],
  setNotes: (updater: (current: DailyNote[]) => DailyNote[]) => void,
  notesRef: { current: DailyNote[] },
  viewMonth: Date
): void {
  const visibleRange = buildMonthGrid(viewMonth);
  const startDate = toDateKey(visibleRange[0].date);
  const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);

  startTransition(() => {
    setNotes((current) => {
      const byId = new Map(current.map((note) => [note.id, note]));
      let changed = false;

      for (const payload of payloads) {
        const existing = byId.get(payload.id);
        if (payload.deleted_at) {
          if (byId.delete(payload.id)) changed = true;
          continue;
        }

        const metadataPage = pageUpdatePayloadToPage(payload);
        const dateKey =
          readDailyNoteDateKey(metadataPage) || existing?.dailyDateKey || "";
        if (!dateKey && !existing) continue;

        const nextNote: DailyNote = {
          ...(existing ?? metadataPage),
          ...metadataPage,
          content_text: existing?.content_text ?? null,
          content_yjs: existing?.content_yjs ?? null,
          dailyDateKey: dateKey,
          cloudOnly: existing?.cloudOnly,
          hotCacheOnly: existing?.hotCacheOnly,
        };

        if (
          existing &&
          dailyNotesRenderFingerprint([existing]) ===
            dailyNotesRenderFingerprint([nextNote])
        ) {
          continue;
        }
        byId.set(payload.id, nextNote);
        changed = true;
      }

      if (!changed) return current;
      const selection = selectDailyNotesForCalendarRender(
        Array.from(byId.values()),
        startDate,
        endDate,
        Math.max(DAILY_RECENT_VISIBLE_LIMIT, DAILY_RENDER_RECENT_BUFFER_LIMIT)
      );
      notesRef.current = selection.notes;
      return selection.notes;
    });
  });
}

function pageUpdatePayloadToPage(payload: PageUpdatePayload): Page {
  return {
    id: payload.id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: payload.parent_id,
    database_id: null,
    title: payload.title,
    icon: payload.icon,
    cover_url: payload.cover_url,
    content_yjs: null,
    content_text: null,
    properties: payload.properties,
    position: payload.position,
    depth: payload.depth,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    deleted_at: payload.deleted_at,
    sync_version: 1,
  };
}

function buildDailyCalendarIndexes(
  notes: DailyNote[],
  calendarDateKeys: Set<string>
): DailyCalendarIndexes {
  const recentNotes: IndexedDailyNote[] = [];
  const notesByDate = new Map<string, DailyNote[]>();
  const notesById = new Map<string, DailyNote>();

  for (const note of notes) {
    notesById.set(note.id, note);
    const dateKey = dailyNoteDateKey(note);
    if (!dateKey) continue;
    addRecentDailyNoteCandidate(
      recentNotes,
      { note, dateKey },
      DAILY_RECENT_INDEX_CANDIDATE_LIMIT
    );
    if (!calendarDateKeys.has(dateKey)) continue;
    const list = notesByDate.get(dateKey) ?? [];
    list.push(note);
    notesByDate.set(dateKey, list);
  }

  return { recentNotes, notesByDate, notesById };
}

function selectDailyNotesForCalendarRender(
  notes: DailyNote[],
  startDate: string,
  endDate: string,
  limit: number
): DailyCalendarRenderSelection {
  const visibleNotes: DailyNote[] = [];
  const recent: IndexedDailyNote[] = [];
  const visibleIds = new Set<string>();
  const countsByDate = new Map<string, number>();
  const renderedByDate = new Map<string, number>();

  for (const note of notes) {
    const dateKey = dailyNoteDateKey(note);
    if (!dateKey) continue;
    if (dateKey >= startDate && dateKey <= endDate) {
      countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
      const renderedForDate = renderedByDate.get(dateKey) ?? 0;
      if (renderedForDate < DAILY_CALENDAR_RENDER_DAY_LIMIT) {
        visibleNotes.push(note);
        visibleIds.add(note.id);
        renderedByDate.set(dateKey, renderedForDate + 1);
      }
      continue;
    }
    addRecentDailyNoteCandidate(recent, { note, dateKey }, limit);
  }

  for (const { note } of recent) {
    if (!visibleIds.has(note.id)) {
      visibleNotes.push(note);
    }
  }

  return { notes: visibleNotes, countsByDate };
}

function dailyNotesRenderFingerprint(notes: DailyNote[]): string {
  return notes
    .map((note) =>
      [
        note.id,
        note.updated_at,
        note.title,
        dailyNoteDateKey(note),
        note.content_text == null ? "metadata" : "body",
        note.cloudOnly ? "cloud" : "",
        note.hotCacheOnly ? "hot" : "",
      ].join(":")
    )
    .join("|");
}

function publishDailyCalendarRenderSelection(
  notes: DailyNote[],
  countsByDate: Map<string, number>,
  fingerprintRef: { current: string },
  setNotes: (notes: DailyNote[]) => void,
  setDailyNoteCountByDate: (counts: Map<string, number>) => void,
  shouldPublish: () => boolean = () => true
): boolean {
  if (!shouldPublish()) return false;
  const nextFingerprint = [
    dailyNotesRenderFingerprint(notes),
    dailyNoteCountsFingerprint(countsByDate),
  ].join("#");
  if (fingerprintRef.current === nextFingerprint) return false;

  startTransition(() => {
    if (!shouldPublish()) return;
    if (fingerprintRef.current === nextFingerprint) return;
    fingerprintRef.current = nextFingerprint;
    setNotes(notes);
    setDailyNoteCountByDate(countsByDate);
  });
  return true;
}

function dailyNoteCountsFingerprint(countsByDate: Map<string, number>): string {
  return Array.from(countsByDate.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([dateKey, count]) => `${dateKey}:${count}`)
    .join("|");
}

function countDailyVisibleDays(
  notes: DailyNote[],
  startDate: string,
  endDate: string
): number {
  const dateKeys = new Set<string>();
  for (const note of notes) {
    const dateKey = dailyNoteDateKey(note);
    if (!dateKey || dateKey < startDate || dateKey > endDate) continue;
    dateKeys.add(dateKey);
  }
  return dateKeys.size;
}

function addRecentDailyNoteCandidate(
  recent: IndexedDailyNote[],
  candidate: IndexedDailyNote,
  limit: number
): void {
  if (limit <= 0) return;

  let insertAt = recent.length;
  while (insertAt > 0 && candidate.dateKey > recent[insertAt - 1].dateKey) {
    insertAt -= 1;
  }

  if (insertAt >= limit) return;
  recent.splice(insertAt, 0, candidate);
  if (recent.length > limit) {
    recent.pop();
  }
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

function buildInitialDailyCalendarHydrationKeys(
  grid: MonthCell[],
  todayKey: string
): Set<string> {
  const initialKeys = new Set<string>();
  const todayIndex = grid.findIndex((cell) => toDateKey(cell.date) === todayKey);
  const firstInMonthIndex = grid.findIndex((cell) => cell.inMonth);
  const anchorIndex =
    todayIndex >= 0 ? todayIndex : Math.max(0, firstInMonthIndex);
  const rowStart = Math.max(0, Math.floor(anchorIndex / 7) * 7);
  const rowEnd = Math.min(
    grid.length,
    rowStart + DAILY_CALENDAR_INITIAL_HYDRATED_DAY_LIMIT
  );

  for (let index = rowStart; index < rowEnd; index += 1) {
    initialKeys.add(toDateKey(grid[index].date));
  }

  if (todayIndex >= 0) {
    initialKeys.add(toDateKey(grid[todayIndex].date));
  }

  return initialKeys;
}

function buildOccupiedDailyCalendarHydrationKeys(
  grid: MonthCell[],
  notesByDate: Map<string, DailyNote[]>,
  countsByDate: Map<string, number>
): string[] {
  const inMonth: string[] = [];
  const adjacentMonth: string[] = [];
  for (const cell of grid) {
    const dateKey = toDateKey(cell.date);
    const count =
      countsByDate.get(dateKey) ?? notesByDate.get(dateKey)?.length ?? 0;
    if (count <= 0) continue;
    if (cell.inMonth) {
      inMonth.push(dateKey);
    } else {
      adjacentMonth.push(dateKey);
    }
  }
  return [...inMonth, ...adjacentMonth];
}

function pruneDailyCalendarDateKeySet(
  current: Set<string>,
  visibleDateKeys: Set<string>
): Set<string> {
  let changed = false;
  const next = new Set<string>();
  for (const dateKey of current) {
    if (!visibleDateKeys.has(dateKey)) {
      changed = true;
      continue;
    }
    next.add(dateKey);
  }
  return changed ? next : current;
}

function pruneDailyCalendarDateLimitMap(
  current: Map<string, number>,
  visibleDateKeys: Set<string>
): Map<string, number> {
  let changed = false;
  const next = new Map<string, number>();
  for (const [dateKey, limit] of current.entries()) {
    if (!visibleDateKeys.has(dateKey)) {
      changed = true;
      continue;
    }
    next.set(dateKey, limit);
  }
  return changed ? next : current;
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

function seedVisibleDailyNotesForBackgroundRefresh(
  byId: Map<string, DailyNote>,
  visibleNotes: DailyNote[]
): number {
  let retained = 0;
  for (const note of visibleNotes) {
    if (byId.has(note.id)) continue;
    byId.set(note.id, note);
    retained += 1;
  }
  return retained;
}

function dailyCloudCacheKey(startDate: string, endDate: string): string {
  return `${DAILY_CLOUD_CACHE_PREFIX}${startDate}:${endDate}:v1`;
}

function readCachedDailyCloudMetadata(
  startDate: string,
  endDate: string
): CachedDailyCloudMetadataResult | null {
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
    const cacheAgeMs = cachedAt
      ? Date.now() - cachedAt
      : Number.POSITIVE_INFINITY;
    if (!cachedAt || cacheAgeMs > DAILY_CLOUD_CACHE_STALE_MS) return null;
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
      cachedAt: new Date(cachedAt).toISOString(),
      cached: true,
      stale: cacheAgeMs > DAILY_CLOUD_CACHE_FRESH_MS,
      matched: typeof parsed.matched === "number" ? parsed.matched : undefined,
      rangeCount:
        typeof parsed.rangeCount === "number" ? parsed.rangeCount : undefined,
      recentCount:
        typeof parsed.recentCount === "number" ? parsed.recentCount : undefined,
      scanned: typeof parsed.scanned === "number" ? parsed.scanned : undefined,
      watermark:
        typeof parsed.watermark === "string" ? parsed.watermark : undefined,
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
    const key = dailyCloudCacheKey(startDate, endDate);
    if (!shouldWriteCachedDailyCloudMetadata(key, cloud)) return;
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...cloud, cachedAt: new Date().toISOString() })
    );
  } catch {
    // Local cache is best-effort; the cloud result is still displayed.
  }
}

function shouldWriteCachedDailyCloudMetadata(
  key: string,
  cloud: DailyCloudMetadataResult
): boolean {
  const cached = readCachedDailyCloudMetadataSignature(key);
  if (!cached) return true;
  if (cached.signature !== buildDailyCloudMetadataCacheSignature(cloud)) {
    return true;
  }
  return Date.now() - cached.cachedAt > DAILY_CLOUD_CACHE_FRESH_MS;
}

function readCachedDailyCloudMetadataSignature(
  key: string
): DailyCloudMetadataCacheSignature | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyCloudMetadataCacheEntry>;
    const cachedAt = parsed.cachedAt ? Date.parse(parsed.cachedAt) : 0;
    if (
      !cachedAt ||
      parsed.status !== "ok" ||
      !Array.isArray(parsed.pages) ||
      typeof parsed.total !== "number"
    ) {
      return null;
    }
    return {
      signature: buildDailyCloudMetadataCacheSignature(
        parsed as DailyCloudMetadataCacheEntry
      ),
      cachedAt,
    };
  } catch {
    return null;
  }
}

function buildDailyCloudMetadataCacheSignature(
  cloud: DailyCloudMetadataCacheEntry
): string {
  return JSON.stringify(stableDailyCloudMetadataCacheValue(cloud));
}

function stableDailyCloudMetadataCacheValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableDailyCloudMetadataCacheValue(item));
  }
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (
      key === "cachedAt" ||
      key === "cached" ||
      key === "stale" ||
      key === "message"
    ) {
      continue;
    }
    const nextValue = (value as Record<string, unknown>)[key];
    if (typeof nextValue !== "undefined") {
      result[key] = stableDailyCloudMetadataCacheValue(nextValue);
    }
  }
  return result;
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
  void loadPageAccountSyncModule()
    .then(({ queueCloudPagePush }) => {
      for (const record of records) {
        queueCloudPagePush(record);
      }
    })
    .catch(() => undefined);
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

function toDailyNoteSeed(page: Page, fallback: DailyNote): DailyNote {
  const dateKey = fallback.dailyDateKey || readDailyNoteDateKey(page);
  return {
    ...page,
    dailyDateKey: dateKey,
    cloudOnly: fallback.cloudOnly,
    hotCacheOnly: fallback.hotCacheOnly,
  };
}

function toDailyNoteMetadataSeed(page: Page, fallback: DailyNote): DailyNote {
  return {
    ...toDailyNoteSeed(page, fallback),
    content_text: null,
    content_yjs: null,
  };
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

function parseDateKeyToLocalDate(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
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

function DailyCalendarLoadStatusStrip({
  view,
}: {
  view: DailyCalendarLoadStatusView;
}) {
  return (
    <div
      data-testid="daily-calendar-load-status"
      data-load-phase={view.phase}
      aria-label={view.ariaLabel}
      title={view.privacyBoundary}
      className={`mt-3 border-y px-0 py-2 text-xs ${dailyCalendarLoadToneClass(
        view.tone
      )}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {view.label}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          </div>
          <p className="mt-1 truncate text-zinc-500 dark:text-zinc-400">
            {view.detail}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {view.chips.map((chip) => (
            <span
              key={`${chip.label}:${chip.value}`}
              className="rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
            >
              {chip.label} {chip.value}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {view.steps.map((step) => (
          <span
            key={step.id}
            data-load-step={step.id}
            data-load-step-state={step.state}
            className={`inline-flex items-center gap-1 ${dailyCalendarLoadStepClass(
              step.state
            )}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function dailyCalendarLoadToneClass(tone: DailyCalendarLoadTone): string {
  if (tone === "success") {
    return "border-emerald-200 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-300";
  }
  if (tone === "warning") {
    return "border-amber-200 text-amber-700 dark:border-amber-900/70 dark:text-amber-300";
  }
  if (tone === "working") {
    return "border-blue-200 text-blue-700 dark:border-blue-900/70 dark:text-blue-300";
  }
  return "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400";
}

function dailyCalendarLoadStepClass(
  state: DailyCalendarLoadStatusView["steps"][number]["state"]
): string {
  if (state === "done") return "text-emerald-600 dark:text-emerald-300";
  if (state === "active") return "text-blue-600 dark:text-blue-300";
  if (state === "warning") return "text-amber-600 dark:text-amber-300";
  return "text-zinc-400 dark:text-zinc-600";
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
