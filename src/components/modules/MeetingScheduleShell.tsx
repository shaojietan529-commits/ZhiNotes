"use client";

import {
  startTransition,
  useCallback,
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
  deletePage,
  getDeletedPages,
  getPage,
  getWorkspaceSetting,
  listDailyPageMetadataForCalendar,
  listMeetingPageMetadataForCalendar,
  restorePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
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
import { useCalendarViewMonthPreference } from "@/hooks/useCalendarViewMonthPreference";
import { useMeetingDeletionTombstonesPreference } from "@/hooks/useMeetingDeletionTombstonesPreference";
import { useMeetingReviewStatePreference } from "@/hooks/useMeetingReviewStatePreference";
import {
  getModuleRootId,
  getModuleRootIdSync,
  toDateKey,
} from "@/lib/pages/moduleWorkspaces";
import {
  meetingHotCacheSnapshotPageToPage,
  readMeetingHotCacheSnapshot,
  readMeetingHotCacheSnapshotsForRange,
  writeMeetingHotCacheSnapshot,
} from "@/lib/sync/meetingHotCacheSnapshot";
import {
  buildMeetingCalendarLoadStatusView,
  createMeetingCalendarLoadStatus,
  type MeetingCalendarLoadPhase,
  type MeetingCalendarLoadStatusState,
  type MeetingCalendarLoadStatusView,
  type MeetingCalendarLoadTone,
} from "@/lib/sync/meetingCalendarLoadStatus";
import {
  buildCalendarFirstPaintRange,
  buildCalendarMonthGrid as buildMonthGrid,
  type CalendarMonthCell as MonthCell,
} from "@/lib/sync/calendarFirstPaintRange";
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
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import PageContextMenu from "@/components/page/LazyPageContextMenu";
import PagePeekModal, {
  warmPagePeekModal,
} from "@/components/page/LazyPagePeekModal";
import { DEFAULT_OWNER_ID, generateId } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
];

const PLATFORMS = [
  "腾讯会议",
  "Zoom",
  "Webex",
  "进门财经",
  "久谦论坛",
  "Teams",
  "Google Meet",
  "其他",
];

const RECORDING_DEVICES = ["MacBook Pro", "Mac Mini"];
const DEFAULT_RECORDING_DEVICE = "MacBook Pro";
const TRANSCRIPTION_MODEL_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "qwen", label: "Qwen" },
  { value: "gpt", label: "GPT" },
];
const DEFAULT_TRANSCRIPTION_MODEL = "auto";
const MEETING_PRIORITY_OPTIONS = [
  { value: "default", label: "默认" },
  { value: "high", label: "优先" },
];
const DEFAULT_MEETING_PRIORITY = "default";
const MEETING_CALENDAR_VISIBLE_LIMIT = 6;
const MEETING_UPCOMING_VISIBLE_LIMIT = 8;
const MEETING_NOTES_VISIBLE_LIMIT = 20;
const MEETING_RENDER_UPCOMING_BUFFER_LIMIT = 24;
const MEETING_RENDER_COMPLETED_BUFFER_LIMIT = 32;
const MEETING_RENDER_UNDATED_REVIEW_LIMIT = 16;
const MEETING_CALENDAR_EXPAND_BATCH = 24;
const MEETING_CALENDAR_REVEAL_BUFFER = 2;
const MEETING_CALENDAR_RENDER_DAY_LIMIT =
  MEETING_CALENDAR_VISIBLE_LIMIT + MEETING_CALENDAR_EXPAND_BATCH;
const MEETING_CALENDAR_MANUAL_DAY_LOAD_LIMIT = 160;
const MEETING_CALENDAR_INITIAL_HYDRATED_DAY_LIMIT = 14;
const MEETING_CALENDAR_HYDRATION_BATCH = 7;
const MEETING_CALENDAR_HYDRATION_FRAME_DELAY_MS = 32;
const MEETING_CALENDAR_OCCUPIED_HYDRATION_BATCH = 10;
const MEETING_CALENDAR_OCCUPIED_HYDRATION_FRAME_DELAY_MS = 32;
const MEETING_PEEK_EDITOR_WARMUP_DELAY_MS = 1600;
const MEETING_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS = 2000;
const MEETING_LOCAL_METADATA_REFRESH_DELAY_MS = 120;
const MEETING_LOCAL_METADATA_FALLBACK_DELAY_MS = 900;
const MEETING_CLOUD_METADATA_RECHECK_DELAY_MS = 1800;
const MEETING_INITIAL_CLOUD_RECHECK_DELAY_MS = 2000;
const MEETING_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS = 3400;
const MEETING_CLOUD_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations");
const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");

interface MeetingEntry {
  page: Page;
  topic: string;
  organizer: string;
  platform: string;
  time: string;
  dateKey: string;
  joinUrl: string;
  joinUrlHost: string;
  meetingId: string;
  passcode: string;
  importSource: string;
  confidence: string;
  recordingDevice: string;
  fallbackDevice: string;
  transcriptionModel: string;
  meetingPriority: string;
  queueStatus: string;
  queueJobId: string;
  queueError: string;
  traceStatus: string;
  timeStatus: string;
  recordingStatus: string;
  recordingGateStatus: string;
  importedAt: string;
  traceNote: string;
}

interface MeetingFormState {
  topic: string;
  organizer: string;
  date: string;
  time: string;
  platform: string;
}

interface IntakeMeeting {
  topic: string;
  organizer: string;
  platform: string;
  date: string;
  time: string;
  endTime: string;
  durationMinutes: number | null;
  hasJoinUrl: boolean;
  joinUrl: string;
  joinUrlHost: string;
  meetingId: string;
  passcode: string;
  source: "pasted_text" | "linked_page" | "mixed";
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

interface IntakeResponse {
  meeting?: IntakeMeeting;
  fetched?: boolean;
  error?: string;
}

interface CreateMeetingOptions {
  importSource?: string;
  hasJoinUrl?: boolean;
  joinUrlHost?: string;
  joinUrl?: string;
  meetingId?: string;
  passcode?: string;
  timeLabel?: string;
  confidence?: IntakeMeeting["confidence"];
  recordingDevice?: string;
  fallbackDevice?: string;
  transcriptionModel?: string;
  meetingPriority?: string;
  enqueueRecording?: boolean;
  traceStatus?: string;
  timeStatus?: string;
  recordingStatus?: string;
  recordingGateStatus?: string;
  importedAt?: string;
  traceNote?: string;
  warnings?: string[];
}

type MeetingCalendarLoadOptions = {
  includeCloud?: boolean;
  interruptCloud?: boolean;
  preserveVisibleMeetings?: boolean;
};

interface QueueResult {
  ok: boolean;
  status: "queued" | "skipped" | "failed" | "pending";
  message: string;
  jobId?: string;
}

interface CreateMeetingResult {
  page: Page;
  queueResult?: QueueResult;
  cloudOnly?: boolean;
}

interface MeetingCloudMetadataSnapshot {
  ok: boolean;
  status?: string;
  rootId: string | null;
  pages: Page[];
  count?: number;
  matched?: number;
  rangeCount?: number;
  recentCount?: number;
  scanned?: number;
  cached?: boolean;
  watermark?: string;
}

type MeetingCloudMetadataCacheEntry = MeetingCloudMetadataSnapshot & {
  cachedAt?: string;
};

type MeetingCloudMetadataCacheSignature = {
  signature: string;
  cachedAt: number;
};

interface MeetingCloudMetadataOptions {
  startDate?: string;
  endDate?: string;
  recentLimit?: number;
}

interface MeetingCalendarRenderSelection {
  pages: Page[];
  countsByDate: Map<string, number>;
}

type OpeningMeetingDraft = {
  pageId: string;
  dateKey: string;
};

const MEETING_CLOUD_CACHE_PREFIX = "zhinote.zhihui.cloudMetadata.";

export default function MeetingScheduleShell() {
  const router = useRouter();
  const openPage = useLocalFirstPageNavigation();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const pageRevision = usePageRevision();
  const [rootId, setRootId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Page[]>([]);
  const [meetingCountByDate, setMeetingCountByDate] = useState<
    Map<string, number>
  >(() => new Map());
  const [calendarLoadStatus, setCalendarLoadStatus] =
    useState<MeetingCalendarLoadStatusState>(() =>
      createMeetingCalendarLoadStatus({
        phase: "booting",
        cloudLoading: true,
        backgroundActive: true,
        message: "正在启动 ZhiHui 日历，先准备热缓存、本地索引和云端目录。",
      })
    );
  const [creatingMeetingDateKey, setCreatingMeetingDateKey] = useState<
    string | null
  >(null);
  const [openingDraft, setOpeningDraft] =
    useState<OpeningMeetingDraft | null>(null);
  const { viewMonth, setViewMonth } =
    useCalendarViewMonthPreference("meeting");
  const {
    dismissedTraces,
    seenIds,
    dismissTrace,
    markMeetingSeen,
  } = useMeetingReviewStatePreference();
  const {
    tombstonesRef: deletedTombstoneRef,
    tombstonesLoaded: deletionTombstonesLoaded,
    addMeetingDeletionTombstone,
  } = useMeetingDeletionTombstonesPreference();
  const [highlightedDateKey, setHighlightedDateKey] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(toDateKey(new Date())));
  const [intakeText, setIntakeText] = useState("");
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeMessage, setIntakeMessage] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [intakePreview, setIntakePreview] = useState<IntakeMeeting | null>(null);
  const [intakeRecordingDevice, setIntakeRecordingDevice] = useState(
    DEFAULT_RECORDING_DEVICE
  );
  const [intakeTranscriptionModel, setIntakeTranscriptionModel] = useState(
    DEFAULT_TRANSCRIPTION_MODEL
  );
  const [intakePriority, setIntakePriority] = useState(DEFAULT_MEETING_PRIORITY);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingEntry | null>(
    null
  );
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);
  const [openingMeetingId, setOpeningMeetingId] = useState<string | null>(null);
  const [runNowMessage, setRunNowMessage] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [expandedMeetingDateKeys, setExpandedMeetingDateKeys] = useState<
    Set<string>
  >(() => new Set());
  const [visibleMeetingLimitByDate, setVisibleMeetingLimitByDate] = useState<
    Map<string, number>
  >(() => new Map());
  const [loadingMoreMeetingDateKey, setLoadingMoreMeetingDateKey] = useState<
    string | null
  >(null);
  const [hydratedMeetingDateKeys, setHydratedMeetingDateKeys] = useState<
    Set<string>
  >(() => new Set());
  const initialCloudPullAttemptedRef = useRef(false);
  const calendarCellRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingCalendarFocusDateKeyRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const metadataWarmupScheduledRef = useRef(false);
  const loadRequestRef = useRef(0);
  const meetingsRef = useRef<Page[]>([]);
  const hotCacheBootstrapKeyRef = useRef("");
  const meetingCalendarRenderFingerprintRef = useRef("");
  const observedPageRevisionRef = useRef<string | null>(null);
  const pageShellWarmupRef = useRef<Promise<unknown> | null>(null);
  const completedMeetingDailyLinkKeyRef = useRef("");
  const [hotCachePreferences, setHotCachePreferences] = useState(
    DEFAULT_HOT_CACHE_PREFERENCES
  );
  const recentMetadataLimit = useMemo(
    () => metadataRecentLimitForHotCachePreferences(hotCachePreferences),
    [hotCachePreferences]
  );

  useEffect(() => {
    meetingsRef.current = meetings;
  }, [meetings]);

  const publishCalendarStatus = useCallback(
    (
      phase: MeetingCalendarLoadPhase,
      input: Partial<Omit<MeetingCalendarLoadStatusState, "phase">> = {}
    ) => {
      setCalendarLoadStatus(
        createMeetingCalendarLoadStatus({
          phase,
          visibleMeetings: input.visibleMeetings ?? meetingsRef.current.length,
          visibleDays:
            input.visibleDays ?? countMeetingDates(meetingsRef.current),
          cloudLoading: input.cloudLoading ?? false,
          backgroundActive: input.backgroundActive ?? false,
          staleCloud: input.staleCloud ?? false,
          message: input.message,
          updatedAt: input.updatedAt,
        })
      );
    },
    []
  );

  useEffect(() => {
    const {
      startDate,
      endDate,
      cacheKey: bootstrapKey,
    } = buildCalendarFirstPaintRange(viewMonth, toDateKey);
    if (hotCacheBootstrapKeyRef.current === bootstrapKey) return;
    hotCacheBootstrapKeyRef.current = bootstrapKey;

    const cachedHotSnapshot = readMeetingHotCacheSnapshot(startDate, endDate);
    const overlappingHotSnapshots = readMeetingHotCacheSnapshotsForRange(
      startDate,
      endDate
    );
    const cachedCloud = readCachedMeetingCloudMetadata(startDate, endDate);
    if (
      !cachedHotSnapshot &&
      overlappingHotSnapshots.length === 0 &&
      !cachedCloud?.ok
    ) {
      return;
    }
    const cachedHotPages = [
      ...(cachedHotSnapshot?.pages.map(meetingHotCacheSnapshotPageToPage) ?? []),
      ...overlappingHotSnapshots.flatMap((snapshot) =>
        snapshot.pages.map(meetingHotCacheSnapshotPageToPage)
      ),
    ];
    const cachedCloudPages = cachedCloud?.ok ? cachedCloud.pages : [];
    const mergedMeetings = mergeMeetingPages(
      cachedHotPages,
      cachedCloudPages,
      deletedTombstoneRef.current
    );
    if (mergedMeetings.length === 0) return;
    const selection = selectMeetingPagesForCalendarRender(
      mergedMeetings,
      startDate,
      endDate
    );
    const nextMeetings = selection.pages;
    const rootHint =
      cachedHotSnapshot?.root_id ??
      overlappingHotSnapshots.find((snapshot) => snapshot.root_id)?.root_id ??
      cachedCloud?.rootId ??
      null;

    if (rootHint) {
      setRootId(rootHint);
    }
    publishMeetingCalendarRenderSelection(
      nextMeetings,
      selection.countsByDate,
      meetingCalendarRenderFingerprintRef,
      setMeetings,
      setMeetingCountByDate
    );
    publishCalendarStatus(cachedCloudPages.length > 0 ? "cached-cloud" : "hot-cache", {
      visibleMeetings: nextMeetings.length,
      visibleDays: countMeetingDateCounts(selection.countsByDate),
      cloudLoading: true,
      backgroundActive: true,
      staleCloud: false,
      message:
        cachedCloudPages.length > 0
          ? "浏览器缓存的云端会议目录已先显示，本地索引和云端刷新继续后台补齐。"
          : "浏览器热缓存已先显示，本地索引和云端目录继续后台校正。",
    });
    if (cachedCloudPages.length > 0) {
      writeMeetingHotCacheSnapshot({
        startDate,
        endDate,
        rootId: rootHint,
        pages: nextMeetings,
        source: "cloud-metadata",
      });
    }
  }, [deletedTombstoneRef, publishCalendarStatus, viewMonth]);

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

  const warmMeetingPageRoute = useCallback(() => {
    try {
      router.prefetch("/page/zhinote-route-prefetch");
    } catch {
      // Best-effort route warmup; meeting creation still works without it.
    }
    if (!pageShellWarmupRef.current) {
      pageShellWarmupRef.current = import("@/components/providers/PageShell").catch(
        () => {
          pageShellWarmupRef.current = null;
        }
      );
    }
  }, [router]);

  const warmMeetingPeekOpen = useCallback(() => {
    warmPagePeekModal();
    warmMeetingPageRoute();
  }, [warmMeetingPageRoute]);

  useEffect(() => {
    const cancelPageShellPreload = scheduleMeetingIdleTask(() => {
      warmMeetingPageRoute();
    }, 700);
    let cancelPeekEditorWarmup: (() => void) | null = null;
    const peekEditorWarmupTimer = window.setTimeout(() => {
      cancelPeekEditorWarmup = scheduleMeetingIdleTask(() => {
        warmPagePeekModal();
      }, MEETING_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS);
    }, MEETING_PEEK_EDITOR_WARMUP_DELAY_MS);
    return () => {
      cancelPageShellPreload();
      window.clearTimeout(peekEditorWarmupTimer);
      cancelPeekEditorWarmup?.();
    };
  }, [warmMeetingPageRoute]);

  const scheduleMetadataCacheWarmup = useCallback(() => {
    if (metadataWarmupScheduledRef.current) return;
    metadataWarmupScheduledRef.current = true;
    const run = () => {
      void loadPageAccountSyncModule()
        .then(({ syncCloudPageMetadataDelta }) =>
          syncCloudPageMetadataDelta()
        )
        .catch(() => undefined);
    };
    const maybeWindow = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        options?: { timeout?: number }
      ) => number;
    };
    if (maybeWindow.requestIdleCallback) {
      maybeWindow.requestIdleCallback(run, { timeout: 3000 });
      return;
    }
    window.setTimeout(run, 1500);
  }, []);

  const hydrateMeetingDateKey = useCallback((dateKey: string) => {
    setHydratedMeetingDateKeys((current) => {
      if (current.has(dateKey)) return current;
      const next = new Set(current);
      next.add(dateKey);
      return next;
    });
  }, []);

  const upsertMeetingInView = useCallback((page: Page) => {
    setMeetings((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === page.id);
      if (existingIndex === -1) return [...prev, page];
      const next = [...prev];
      next[existingIndex] = page;
      return next;
    });
  }, []);

  const focusCalendarDate = useCallback(
    (dateKey: string) => {
      const date = parseDateKeyToLocalDate(dateKey);
      if (!date) return;

      pendingCalendarFocusDateKeyRef.current = dateKey;
      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setHighlightedDateKey(dateKey);
      hydrateMeetingDateKey(dateKey);

      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedDateKey((current) =>
          current === dateKey ? "" : current
        );
        highlightTimerRef.current = null;
      }, 7000);
    },
    [hydrateMeetingDateKey, setViewMonth]
  );

  useEffect(() => {
    const dateKey = pendingCalendarFocusDateKeyRef.current;
    if (!dateKey) return;

    const node = calendarCellRefs.current.get(dateKey);
    if (!node) return;

    const frame = window.requestAnimationFrame(() => {
      if (pendingCalendarFocusDateKeyRef.current !== dateKey) return;
      calendarCellRefs.current.get(dateKey)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      pendingCalendarFocusDateKeyRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    highlightedDateKey,
    meetings,
    expandedMeetingDateKeys,
    visibleMeetingLimitByDate,
    viewMonth,
  ]);

  const revealMeetingOnCalendar = useCallback(
    (page: Page) => {
      const entry = toMeetingEntry(page);
      if (!entry.dateKey) return;

      const currentDayEntries = [
        ...meetingsRef.current.filter((item) => item.id !== page.id),
        page,
      ]
        .map(toMeetingEntry)
        .filter((item) => item.dateKey === entry.dateKey);
      const nextIndex = currentDayEntries.findIndex(
        (item) => item.page.id === page.id
      );
      const requiredLimit =
        nextIndex >= 0 ? nextIndex + 1 : MEETING_CALENDAR_VISIBLE_LIMIT;

      if (requiredLimit > MEETING_CALENDAR_VISIBLE_LIMIT) {
        setExpandedMeetingDateKeys((current) => {
          if (current.has(entry.dateKey)) return current;
          const next = new Set(current);
          next.add(entry.dateKey);
          return next;
        });
        setVisibleMeetingLimitByDate((limits) => {
          const currentLimit =
            limits.get(entry.dateKey) ?? MEETING_CALENDAR_VISIBLE_LIMIT;
          if (currentLimit >= requiredLimit) return limits;
          const next = new Map(limits);
          next.set(
            entry.dateKey,
            Math.min(
              currentDayEntries.length,
              requiredLimit + MEETING_CALENDAR_REVEAL_BUFFER
            )
          );
          return next;
        });
      }

      focusCalendarDate(entry.dateKey);
    },
    [focusCalendarDate]
  );

  useEffect(
    () => () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    },
    []
  );

  const addTombstone = useCallback((pageId: string) => {
    addMeetingDeletionTombstone(pageId);
  }, [addMeetingDeletionTombstone]);

  const handleDismissTrace = useCallback((pageId: string) => {
    dismissTrace(pageId);
  }, [dismissTrace]);

  const load = useCallback(async (opts?: MeetingCalendarLoadOptions) => {
    const includeCloud = opts?.includeCloud !== false;
    const interruptCloud = opts?.interruptCloud ?? includeCloud;
    const preserveVisibleMeetings =
      opts?.preserveVisibleMeetings ?? (!includeCloud && !interruptCloud);
    const requestId =
      !interruptCloud && loadRequestRef.current > 0
        ? loadRequestRef.current
        : loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const performanceStartedAt = new Date().toISOString();
    const performanceStart = getLocalPerformanceNow();
    let firstVisibleMs: number | null = null;
    let firstVisibleCount = 0;
    let renderedMeetingCount = 0;
    let totalMeetingCount = 0;
    let localMeetingCount = 0;
    const visibleRange = buildMonthGrid(viewMonth);
    const startDate = toDateKey(visibleRange[0].date);
    const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);
    let localPagesForMerge: Page[] = [];
    const cachedHotSnapshot = readMeetingHotCacheSnapshot(startDate, endDate);
    const overlappingHotSnapshots = readMeetingHotCacheSnapshotsForRange(
      startDate,
      endDate
    );
    const cachedHotPages = [
      ...(cachedHotSnapshot?.pages.map(meetingHotCacheSnapshotPageToPage) ?? []),
      ...overlappingHotSnapshots.flatMap((snapshot) =>
        snapshot.pages.map(meetingHotCacheSnapshotPageToPage)
      ),
    ];
    const cachedHotRootId =
      cachedHotSnapshot?.root_id ??
      overlappingHotSnapshots.find((snapshot) => snapshot.root_id)?.root_id ??
      null;
    const cachedHotCount = cachedHotPages.length;

    const publishRootId = (nextRootId: string | null) => {
      if (loadRequestRef.current !== requestId) return;
      setRootId(nextRootId);
    };

    publishCalendarStatus("booting", {
      visibleMeetings: meetingsRef.current.length,
      visibleDays: countMeetingDates(meetingsRef.current),
      cloudLoading: includeCloud,
      backgroundActive: true,
      message: "正在读取当前月份会议目录，优先显示热缓存和本地索引。",
    });

    const publishMeetings = (
      localPages: Page[],
      cloudPages: Page[] = []
    ): MeetingCalendarRenderSelection | null => {
      if (loadRequestRef.current !== requestId) return null;
      const localPageIds = new Set(localPages.map((page) => page.id));
      const shouldRetainVisibleMeetings =
        preserveVisibleMeetings || !includeCloud;
      const retainedVisiblePages = shouldRetainVisibleMeetings
        ? retainVisibleMeetingPagesForBackgroundRefresh(
            meetingsRef.current,
            localPageIds,
            deletedTombstoneRef.current
          )
        : [];
      const mergedMeetings = mergeMeetingPages(
        localPages,
        [...retainedVisiblePages, ...cloudPages],
        deletedTombstoneRef.current
      );
      const selection = selectMeetingPagesForCalendarRender(
        mergedMeetings,
        startDate,
        endDate
      );
      const nextMeetings = selection.pages;
      renderedMeetingCount = selection.pages.length;
      totalMeetingCount = sumMeetingDateCounts(selection.countsByDate);
      if (firstVisibleMs === null && selection.pages.length > 0) {
        firstVisibleMs = getLocalPerformanceNow() - performanceStart;
        firstVisibleCount = selection.pages.length;
      }
      publishMeetingCalendarRenderSelection(
        nextMeetings,
        selection.countsByDate,
        meetingCalendarRenderFingerprintRef,
        setMeetings,
        setMeetingCountByDate,
        () => loadRequestRef.current === requestId
      );
      return selection;
    };

    const publishLoadStatus = (
      phase: MeetingCalendarLoadPhase,
      selection: MeetingCalendarRenderSelection | null,
      input: Partial<Omit<MeetingCalendarLoadStatusState, "phase">> = {}
    ) => {
      if (!selection || loadRequestRef.current !== requestId) return;
      publishCalendarStatus(phase, {
        visibleMeetings: selection.pages.length,
        visibleDays: countMeetingDateCounts(selection.countsByDate),
        ...input,
      });
    };

    const recordMeetingPerformance = (
      status: string,
      counts?: Record<string, number | null | undefined>
    ) => {
      if (loadRequestRef.current !== requestId) return;
      const durationMs = getLocalPerformanceNow() - performanceStart;
      recordLocalPerformanceSnapshot({
        kind: "meeting-calendar",
        label: "ZhiHui 会议日历加载",
        route: "/schedule",
        status,
        startedAt: performanceStartedAt,
        durationMs,
        localFirstMs: firstVisibleMs,
        backgroundMs:
          firstVisibleMs === null ? null : durationMs - firstVisibleMs,
        counts: {
          month_cells: visibleRange.length,
          rendered_meetings: renderedMeetingCount,
          range_meetings: totalMeetingCount,
          local_meetings: localMeetingCount,
          first_visible_meetings: firstVisibleCount,
          hot_cache_pages: cachedHotCount,
          cloud_enabled: includeCloud ? 1 : 0,
          ...counts,
        },
      });
    };

    if (cachedHotPages.length > 0) {
      publishRootId(cachedHotRootId);
      publishLoadStatus("hot-cache", publishMeetings([], cachedHotPages), {
        cloudLoading: includeCloud,
        backgroundActive: true,
        message:
          "浏览器热缓存已先显示，后台继续读取本地索引和云端会议目录。",
      });
    }

    if (includeCloud && !initialCloudPullAttemptedRef.current) {
      initialCloudPullAttemptedRef.current = true;
      scheduleMetadataCacheWarmup();
    }

    const cachedCloud = includeCloud
      ? readCachedMeetingCloudMetadata(startDate, endDate)
      : null;
    if (cachedCloud?.ok && cachedCloud.rootId) {
      publishRootId(cachedCloud.rootId);
      publishLoadStatus("cached-cloud", publishMeetings([], cachedCloud.pages), {
        cloudLoading: includeCloud,
        backgroundActive: true,
        staleCloud: false,
        message:
          "浏览器缓存的云端会议目录已先显示，本地索引和云端刷新继续后台补齐。",
      });
      void persistMeetingCloudMetadata(cachedCloud, upsertPages);
    }

    const cloudPromise = includeCloud
      ? loadMeetingCloudMetadata({
          startDate,
          endDate,
          recentLimit: recentMetadataLimit,
        }).catch(() => emptyMeetingCloudMetadata(false))
      : null;

    let id: string | null = null;
    let localLoadFailed = false;
    try {
      id =
        getModuleRootIdSync("meeting-schedule") ??
        (cachedCloud?.ok ? cachedCloud.rootId : null) ??
        (await getModuleRootId("meeting-schedule"));
      publishRootId(id);
      localPagesForMerge = await listMeetingPageMetadataForCalendar({
        rootId: id,
        startDate,
        endDate,
        recentLimit: recentMetadataLimit,
      });
      localMeetingCount = localPagesForMerge.length;
      publishLoadStatus(
        "local-index",
        publishMeetings(
          localPagesForMerge,
          cachedCloud?.ok ? cachedCloud.pages : []
        ),
        {
          cloudLoading: includeCloud,
          backgroundActive: Boolean(cloudPromise),
          message:
            "本地会议日期索引已显示，云端 metadata 会在后台继续校正。",
        }
      );
      writeMeetingHotCacheSnapshot({
        startDate,
        endDate,
        rootId: id,
        pages: selectMeetingPagesForCalendarRender(
          mergeMeetingPages(
            localPagesForMerge,
            cachedCloud?.ok ? cachedCloud.pages : [],
            deletedTombstoneRef.current
          ),
          startDate,
          endDate
        ).pages,
        source: "local-metadata",
      });
      if (deletionTombstonesLoaded) {
        scheduleMeetingIdleTask(() => {
          void restoreDeletedMeetingPages(id!, deletedTombstoneRef.current).catch(
            () => undefined
          );
        }, 1600);
      }
    } catch (error) {
      localLoadFailed = true;
      console.warn("Meeting schedule local cache load failed", error);
    }

    const nextRootId = id ?? (localLoadFailed ? generateId() : null);
    if (nextRootId) publishRootId(nextRootId);

    if (!cloudPromise) {
      publishCalendarStatus("local-only", {
        visibleMeetings: meetingsRef.current.length,
        visibleDays: countMeetingDates(meetingsRef.current),
        cloudLoading: false,
        backgroundActive: false,
        message: localLoadFailed
          ? "本地会议目录本轮刷新失败，保留当前可见会议。"
          : "当前是本地刷新，未触发云端会议目录校正。",
      });
      recordMeetingPerformance(
        localLoadFailed ? "local-refresh-error" : "local-refresh",
        {
          local_pages: localPagesForMerge.length,
        }
      );
      return;
    }
    publishCalendarStatus("cloud-checking", {
      visibleMeetings: meetingsRef.current.length,
      visibleDays: countMeetingDates(meetingsRef.current),
      cloudLoading: true,
      backgroundActive: true,
      message: "本地会议目录已可用，正在读取云端 metadata 做校正。",
    });
    const cloud = await cloudPromise;
    if (cloud.ok && cloud.rootId) {
      publishRootId(cloud.rootId);
      publishLoadStatus("cloud-ready", publishMeetings(localPagesForMerge, cloud.pages), {
        cloudLoading: false,
        backgroundActive: false,
        message: "会议日历已和云端 metadata 对齐，详情正文仍按打开时加载。",
      });
      writeCachedMeetingCloudMetadata(startDate, endDate, cloud);
      writeMeetingHotCacheSnapshot({
        startDate,
        endDate,
        rootId: cloud.rootId,
        pages: selectMeetingPagesForCalendarRender(
          mergeMeetingPages(
            localPagesForMerge,
            cloud.pages,
            deletedTombstoneRef.current
          ),
          startDate,
          endDate
        ).pages,
        source: "cloud-metadata",
      });
      void persistMeetingCloudMetadata(cloud, upsertPages);
      recordMeetingPerformance("cloud-ok", {
        cloud_pages: cloud.pages.length,
        cloud_range: cloud.rangeCount ?? 0,
        cloud_total: cloud.count ?? 0,
      });
      return;
    }
    const cloudUnavailableLocally =
      cloud.status === "disabled" ||
      cloud.status === "unauthenticated" ||
      cloud.status === "unconfigured";
    publishCalendarStatus(
      cloudUnavailableLocally ? "local-only" : "cloud-error",
      {
        visibleMeetings: meetingsRef.current.length,
        visibleDays: countMeetingDates(meetingsRef.current),
        cloudLoading: false,
        backgroundActive: false,
        message: cloudUnavailableLocally
          ? "云端会议目录暂未启用或未登录，本地会议日历继续可用。"
          : "云端会议目录本轮校正失败，本地会议日历继续可用。",
      }
    );
    recordMeetingPerformance(
      cloud.status ? `cloud-${cloud.status}` : "cloud-unavailable",
      {
        cloud_pages: cloud.pages.length,
        cloud_total: cloud.count ?? 0,
      }
    );

  }, [
    deletionTombstonesLoaded,
    deletedTombstoneRef,
    publishCalendarStatus,
    scheduleMetadataCacheWarmup,
    recentMetadataLimit,
    upsertPages,
    viewMonth,
  ]);

  const handleDeleteMeeting = useCallback(
    async (pageId: string) => {
      addTombstone(pageId);
      await deletePage(pageId);
      setMeetings((prev) => prev.filter((page) => page.id !== pageId));
      setSelectedMeeting((current) =>
        current?.page.id === pageId ? null : current
      );
      // Propagate the deletion (deleted_at tombstone) to the cloud copy so it
      // does not get pulled back in on the next reconcile.
      if (rootId) {
        const deleted = (await getDeletedPages()).find((p) => p.id === pageId);
        if (deleted) {
          await pushMeetingPageCloudSnapshot(rootId, deleted);
        }
      }
    },
    [addTombstone, rootId]
  );

  // The shared page context menu deletes via "移到回收站". When that happens we
  // record the id in our tombstone so the audit auto-restore leaves it deleted.
  const handleContextMenuChanged = useCallback(
    async (pageId: string) => {
      const deleted = await getDeletedPages();
      if (deleted.some((p) => p.id === pageId)) {
        addTombstone(pageId);
      }
      await load({
        includeCloud: false,
        interruptCloud: false,
        preserveVisibleMeetings: true,
      });
    },
    [addTombstone, load]
  );

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void load({
        includeCloud: false,
        interruptCloud: false,
        preserveVisibleMeetings: true,
      });
    });

    let cancelCloudRecheck: (() => void) | null = null;
    const cloudRecheckTimer = window.setTimeout(() => {
      cancelCloudRecheck = scheduleMeetingIdleTask(() => {
        void load({
          includeCloud: true,
          preserveVisibleMeetings: true,
        });
      }, MEETING_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS);
    }, MEETING_INITIAL_CLOUD_RECHECK_DELAY_MS);

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
        preserveVisibleMeetings: true,
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
          preserveVisibleMeetings: true,
        });
      }, MEETING_LOCAL_METADATA_REFRESH_DELAY_MS);
      fallbackReloadTimer = window.setTimeout(() => {
        void load({
          includeCloud: false,
          interruptCloud: false,
          preserveVisibleMeetings: true,
        });
      }, MEETING_LOCAL_METADATA_FALLBACK_DELAY_MS);
      cloudRecheckTimer = window.setTimeout(() => {
        void load({ includeCloud: true });
      }, MEETING_CLOUD_METADATA_RECHECK_DELAY_MS);
    };

    const unsubscribe = subscribePagesUpdated((message) => {
      const pages = message.pages;
      if (!pages || pages.length === 0) {
        scheduleLocalMetadataRefresh();
        return;
      }

      const meetingRootId = rootId ?? getModuleRootIdSync("meeting-schedule");
      const knownMeetingIds = new Set(
        meetingsRef.current.map((meeting) => meeting.id)
      );
      const meetingPayloads = pages.filter((payload) =>
        isMeetingCalendarPageUpdate(payload, meetingRootId, knownMeetingIds)
      );
      if (meetingPayloads.length === 0) return;

      applyMeetingPageUpdatePayloads(
        meetingPayloads,
        setMeetings,
        meetingsRef,
        viewMonth,
        deletedTombstoneRef.current
      );
      scheduleLocalMetadataRefresh();
    });

    return () => {
      if (localReloadTimer !== null) window.clearTimeout(localReloadTimer);
      if (fallbackReloadTimer !== null) window.clearTimeout(fallbackReloadTimer);
      if (cloudRecheckTimer !== null) window.clearTimeout(cloudRecheckTimer);
      unsubscribe();
    };
  }, [dbReady, deletedTombstoneRef, load, rootId, viewMonth]);

  // Receive meeting text captured by the ZhiNote Chrome extension. The
  // extension's content script grabs the text on a logged-in meeting page
  // (bypassing the server's no-login wall) and hands it over via a DOM event.
  // We just pre-fill the 会议信息输入 box; the owner still reviews and clicks
  // 导入, so the existing parser and confirmation stay in charge.
  useEffect(() => {
    const handleIntake = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text;
      if (typeof text !== "string" || !text.trim()) return;
      setIntakeText(text.slice(0, 20000));
      setIntakeError("");
      setIntakeMessage("已从 Chrome 插件接收会议信息，请核对后点击导入。");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const announceReady = () =>
      window.dispatchEvent(new CustomEvent("zhihui:ready"));
    window.addEventListener("zhihui:intake", handleIntake);
    window.addEventListener("zhihui:hello", announceReady);
    // Tell any already-loaded extension content script we are ready now.
    announceReady();
    return () => {
      window.removeEventListener("zhihui:intake", handleIntake);
      window.removeEventListener("zhihui:hello", announceReady);
    };
  }, []);

  const entries = useMemo<MeetingEntry[]>(
    () => meetings.map(toMeetingEntry),
    [meetings]
  );
  const calendarLoadStatusView = useMemo(
    () => buildMeetingCalendarLoadStatusView(calendarLoadStatus),
    [calendarLoadStatus]
  );

  const entriesById = useMemo(() => {
    const map = new Map<string, MeetingEntry>();
    for (const entry of entries) map.set(entry.page.id, entry);
    return map;
  }, [entries]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MeetingEntry[]>();
    for (const entry of entries) {
      if (!entry.dateKey) continue;
      const list = map.get(entry.dateKey) ?? [];
      list.push(entry);
      map.set(entry.dateKey, list);
    }
    return map;
  }, [entries]);

  const todayMeetings = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return entries
      .filter((entry) => entry.dateKey === todayKey)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [entries]);

  const upcoming = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return getUpcomingMeetingEntries(
      entries,
      todayKey,
      MEETING_UPCOMING_VISIBLE_LIMIT
    );
  }, [entries]);

  const markSeen = useCallback((id: string) => {
    markMeetingSeen(id);
  }, [markMeetingSeen]);

  const writeOptimisticMeetingHotCache = useCallback(
    (page: Page, rootHint: string | null) => {
      const visibleRange = buildMonthGrid(viewMonth);
      const startDate = toDateKey(visibleRange[0].date);
      const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);
      const pages = mergeMeetingPages(
        [page],
        meetingsRef.current,
        deletedTombstoneRef.current
      ).filter((item) => {
        const dateKey = toMeetingEntry(item).dateKey;
        return dateKey >= startDate && dateKey <= endDate;
      });

      writeMeetingHotCacheSnapshot({
        startDate,
        endDate,
        rootId: rootHint,
        pages: selectMeetingPagesForCalendarRender(pages, startDate, endDate)
          .pages,
        source: "optimistic-local",
      });
    },
    [deletedTombstoneRef, viewMonth]
  );

  // 会议纪要 only lists meetings that are actually done: the recording
  // succeeded or the meeting is marked 已完成 (which is when the note/纪要 has
  // been produced). Pending/upcoming meetings stay out of this list — they
  // live on the calendar and in 今日会议 until they finish.
  const meetingNotes = useMemo(
    () =>
      getRecentCompletedMeetingEntries(entries, MEETING_NOTES_VISIBLE_LIMIT),
    [entries]
  );

  // Auto-link completed meeting notes into the corresponding 每日纪要 page.
  useEffect(() => {
    if (!meetingNotes.length) return;
    const linkKey = meetingNotes
      .map(
        (entry) =>
          `${entry.page.id}:${entry.page.updated_at}:${entry.dateKey}:${entry.recordingStatus}:${entry.traceStatus}`
      )
      .sort()
      .join("|");
    if (completedMeetingDailyLinkKeyRef.current === linkKey) return;
    completedMeetingDailyLinkKeyRef.current = linkKey;
    const notesToLink = meetingNotes;
    return scheduleMeetingIdleTask(() => {
      void linkCompletedMeetingsToDaily(notesToLink).catch((error) => {
        if (completedMeetingDailyLinkKeyRef.current === linkKey) {
          completedMeetingDailyLinkKeyRef.current = "";
        }
        console.warn("Meeting daily-note autolink failed", error);
      });
    }, 1600);
  }, [meetingNotes]);

  const openForm = (dateKey: string) => {
    setForm(emptyForm(dateKey));
    setFormOpen(true);
  };

  const toggleMeetingDateExpansion = useCallback((dateKey: string) => {
    setExpandedMeetingDateKeys((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) {
        next.delete(dateKey);
        setVisibleMeetingLimitByDate((limits) => {
          if (!limits.has(dateKey)) return limits;
          const nextLimits = new Map(limits);
          nextLimits.delete(dateKey);
          return nextLimits;
        });
      } else {
        next.add(dateKey);
        setVisibleMeetingLimitByDate((limits) => {
          const nextLimits = new Map(limits);
          nextLimits.set(
            dateKey,
            MEETING_CALENDAR_VISIBLE_LIMIT + MEETING_CALENDAR_EXPAND_BATCH
          );
          return nextLimits;
        });
      }
      return next;
    });
  }, []);

  const showMoreMeetingsForDate = useCallback(
    (dateKey: string, totalCount: number) => {
      setExpandedMeetingDateKeys((current) => {
        if (current.has(dateKey)) return current;
        const next = new Set(current);
        next.add(dateKey);
        return next;
      });
      setVisibleMeetingLimitByDate((limits) => {
        const currentLimit =
          limits.get(dateKey) ??
          MEETING_CALENDAR_VISIBLE_LIMIT + MEETING_CALENDAR_EXPAND_BATCH;
        const nextLimits = new Map(limits);
        nextLimits.set(
          dateKey,
          Math.min(totalCount, currentLimit + MEETING_CALENDAR_EXPAND_BATCH)
        );
        return nextLimits;
      });
    },
    []
  );

  const loadMoreMeetingsForDate = useCallback(
    async (dateKey: string, totalCount: number) => {
      if (!dbReady) {
        showMoreMeetingsForDate(dateKey, totalCount);
        return;
      }
      if (loadingMoreMeetingDateKey) return;
      hydrateMeetingDateKey(dateKey);
      showMoreMeetingsForDate(dateKey, totalCount);
      setLoadingMoreMeetingDateKey(dateKey);

      try {
        const meetingRootId =
          rootId ??
          getModuleRootIdSync("meeting-schedule") ??
          (await getModuleRootId("meeting-schedule"));
        if (!rootId) setRootId(meetingRootId);
        const currentLoadedCount = meetingsRef.current
          .map(toMeetingEntry)
          .filter((entry) => entry.dateKey === dateKey).length;
        const targetRangeLimit = Math.min(
          Math.max(totalCount, MEETING_CALENDAR_MANUAL_DAY_LOAD_LIMIT),
          currentLoadedCount + MEETING_CALENDAR_MANUAL_DAY_LOAD_LIMIT
        );
        const metadata = await listMeetingPageMetadataForCalendar({
          rootId: meetingRootId,
          startDate: dateKey,
          endDate: dateKey,
          recentLimit: 0,
          rangeLimit: targetRangeLimit,
        });
        const loadedDayMeetings = metadata
          .filter((page) => toMeetingEntry(page).dateKey === dateKey)
          .slice(0, targetRangeLimit);

        if (loadedDayMeetings.length === 0) {
          setIntakeMessage(
            `${dateKey} 这一天暂时只能看到已加载的 ${Math.min(
              totalCount,
              MEETING_CALENDAR_RENDER_DAY_LIMIT
            )}/${totalCount} 场会议；后台索引完成后会继续出现。`
          );
          return;
        }

        startTransition(() => {
          setMeetings((current) => {
            const byId = new Map(current.map((page) => [page.id, page]));
            for (const page of loadedDayMeetings) byId.set(page.id, page);
            return Array.from(byId.values());
          });
          setMeetingCountByDate((current) => {
            const next = new Map(current);
            next.set(
              dateKey,
              Math.max(
                current.get(dateKey) ?? 0,
                totalCount,
                loadedDayMeetings.length
              )
            );
            return next;
          });
        });
        setVisibleMeetingLimitByDate((limits) => {
          const currentLimit =
            limits.get(dateKey) ??
            MEETING_CALENDAR_VISIBLE_LIMIT + MEETING_CALENDAR_EXPAND_BATCH;
          const nextLimits = new Map(limits);
          nextLimits.set(
            dateKey,
            Math.min(
              Math.max(totalCount, loadedDayMeetings.length),
              currentLimit + MEETING_CALENDAR_EXPAND_BATCH
            )
          );
          return nextLimits;
        });
        setIntakeMessage(
          `已按 ${dateKey} 补齐本机会议目录 ${loadedDayMeetings.length}/${Math.max(
            totalCount,
            loadedDayMeetings.length
          )} 场；为保持日历流畅，日历仍会分批显示，避免卡顿。`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "本机会议目录读取失败";
        setIntakeMessage(`${dateKey} 的会议补齐失败：${message}`);
      } finally {
        setLoadingMoreMeetingDateKey((current) =>
          current === dateKey ? null : current
        );
      }
    },
    [
      dbReady,
      hydrateMeetingDateKey,
      loadingMoreMeetingDateKey,
      rootId,
      showMoreMeetingsForDate,
    ]
  );

  const createMeetingPage = useCallback(
    (
      draft: MeetingFormState,
      options: CreateMeetingOptions = {}
    ): CreateMeetingResult => {
      const optimisticRootId = rootId ?? getModuleRootIdSync("meeting-schedule");
      const topic = draft.topic.trim() || "未命名会议";
      const organizer = draft.organizer.trim();
      const title = [topic, organizer, draft.date].filter(Boolean).join("-");
      const timeLabel = options.timeLabel ?? draft.time.trim();
      const importedAt = options.importedAt ?? new Date().toISOString();
      const timeStatus =
        options.timeStatus ?? (draft.date && timeLabel ? "已识别" : "待补充");
      const traceStatus =
        options.traceStatus ??
        (timeStatus === "已识别" ? "已留痕-待执行" : "已留痕-待补时间");
      const recordingStatus = options.recordingStatus ?? "待执行";
      const recordingGateStatus = options.recordingGateStatus ?? "未验证";
      const transcriptionModel =
        options.transcriptionModel ?? inferTranscriptionModel(`${topic}\n${organizer}`);
      const meetingPriority = normalizeMeetingPriorityValue(options.meetingPriority);
      const traceNote =
        options.traceNote ||
        (options.warnings?.length ? options.warnings.join("；") : "");

      const props: PageProperty[] = [
        { ...createPageProperty("date", "日期"), value: draft.date },
        { ...createPageProperty("text", "时间"), value: timeLabel },
        {
          ...createPageProperty("select", "平台"),
          value: normalizePlatform(draft.platform),
          options: PLATFORMS,
        },
        { ...createPageProperty("text", "组织者"), value: organizer },
        {
          ...createPageProperty("select", "会议痕迹"),
          value: traceStatus,
          options: ["已留痕-待执行", "已留痕-待补时间", "导入失败-已留痕", "已完成", "已取消"],
        },
        {
          ...createPageProperty("select", "时间状态"),
          value: timeStatus,
          options: ["已识别", "待补充"],
        },
        {
          ...createPageProperty("select", "录制状态"),
          value: recordingStatus,
          options: ["待执行", "录制中", "录制成功", "录制失败", "未执行"],
        },
        {
          ...createPageProperty("select", "录制链路"),
          value: recordingGateStatus,
          options: ["未验证", "验证通过", "录制链路未就绪"],
        },
        { ...createPageProperty("text", "导入时间"), value: importedAt },
        createPageProperty("tags", "相关公司"),
        createPageProperty("tags", "相关行业"),
        {
          ...createPageProperty("select", "转写模型"),
          value: transcriptionModel,
          options: ["qwen", "gpt"],
        },
        {
          ...createPageProperty("select", "会议优先级"),
          value: meetingPriority,
          options: ["默认", "优先"],
        },
        {
          ...createPageProperty("select", "录制任务"),
          value: "未入队",
          options: ["未入队", "已入队", "入队失败"],
        },
      ];

      if (options.importSource) {
        props.push({
          ...createPageProperty("select", "导入来源"),
          value: options.importSource,
          options: ["手动创建", "会议信息输入", "邮件导入"],
        });
      }
      if (typeof options.hasJoinUrl === "boolean") {
        props.push({
          ...createPageProperty("select", "入会链接状态"),
          value: options.hasJoinUrl ? "已读取" : "未提供",
          options: ["已读取", "未提供"],
        });
      }
      if (options.joinUrlHost) {
        props.push({
          ...createPageProperty("text", "链接域名"),
          value: options.joinUrlHost,
        });
      }
      if (options.joinUrl) {
        props.push({
          ...createPageProperty("url", "入会链接"),
          value: options.joinUrl,
        });
      }
      if (options.meetingId) {
        props.push({
          ...createPageProperty("text", "会议号"),
          value: options.meetingId,
        });
      }
      if (options.passcode) {
        props.push({
          ...createPageProperty("text", "会议密码"),
          value: options.passcode,
        });
      }
      if (options.recordingDevice) {
        props.push({
          ...createPageProperty("select", "录制设备"),
          value: options.recordingDevice,
          options: RECORDING_DEVICES,
        });
      }
      if (options.fallbackDevice) {
        props.push({
          ...createPageProperty("select", "默认回退设备"),
          value: options.fallbackDevice,
          options: RECORDING_DEVICES,
        });
      }
      if (options.confidence) {
        props.push({
          ...createPageProperty("select", "解析置信度"),
          value: confidenceLabel(options.confidence),
          options: ["高", "中", "低"],
        });
      }
      if (traceNote) {
        props.push({
          ...createPageProperty("text", "留痕说明"),
          value: traceNote,
        });
      }

      const contentText = buildMeetingTraceContent({
        title,
        topic,
        organizer,
        date: draft.date,
        time: timeLabel,
        platform: normalizePlatform(draft.platform),
        joinUrl: options.joinUrl ?? "",
        meetingId: options.meetingId ?? "",
        hasPasscode: Boolean(options.passcode),
        recordingDevice: options.recordingDevice ?? DEFAULT_RECORDING_DEVICE,
        fallbackDevice: options.fallbackDevice ?? DEFAULT_RECORDING_DEVICE,
        transcriptionModel,
        meetingPriority,
        queueStatus: "未入队",
        queueJobId: "",
        queueError: "",
        traceStatus,
        timeStatus,
        recordingStatus,
        recordingGateStatus,
        importedAt,
        traceNote,
      });

      const now = new Date().toISOString();
      const optimisticPage = makeCloudOnlyPage({
        id: generateId(),
        parentId: optimisticRootId,
        title,
        icon: "🗓️",
        contentText,
        properties: stringifyPageProperties(props),
        position: Date.now(),
        depth: optimisticRootId ? 1 : 0,
        now,
      });
      const queueResult: QueueResult | undefined = options.enqueueRecording
        ? {
            ok: false,
            status: "pending",
            message: "录制任务正在后台入队，结果会回写会议页面。",
          }
        : undefined;

      upsertMeetingInView(optimisticPage);
      upsertPages([optimisticPage]);
      setOpeningDraft({
        pageId: optimisticPage.id,
        dateKey: toMeetingEntry(optimisticPage).dateKey || draft.date,
      });
      setOpeningMeetingId(optimisticPage.id);
      rememberPendingPageDraft(optimisticPage);
      rememberPageRouteHandoff(optimisticPage, "meeting-create");
      writeOptimisticMeetingHotCache(optimisticPage, optimisticRootId);
      revealMeetingOnCalendar(optimisticPage);
      {
        const optimisticVisibleMeetings = mergeMeetingPages(
          [optimisticPage],
          meetingsRef.current,
          deletedTombstoneRef.current
        );
        publishCalendarStatus("optimistic-draft", {
          visibleMeetings: optimisticVisibleMeetings.length,
          visibleDays: countMeetingDates(optimisticVisibleMeetings),
          cloudLoading: false,
          backgroundActive: true,
          message: "会议页面已先加入日历，后台继续保存并排队同步。",
        });
      }
      void seedMeetingPageForImmediateOpen(optimisticPage);

      scheduleMeetingIdleTask(() => {
        void (async () => {
          let finalPage = optimisticPage;
          try {
            const resolvedRootId =
              rootId ??
              getModuleRootIdSync("meeting-schedule") ??
              (await getModuleRootId("meeting-schedule"));
            if (!rootId) setRootId(resolvedRootId);
            const latestPage = await getLatestOpenedMeetingPage(optimisticPage);
            finalPage = {
              ...latestPage,
              parent_id: resolvedRootId,
              depth: 1,
              updated_at:
                latestPage.parent_id === resolvedRootId
                  ? latestPage.updated_at
                  : new Date().toISOString(),
            };
            upsertMeetingInView(finalPage);
            upsertPages([finalPage]);
            rememberPendingPageDraft(finalPage);
            rememberPageRouteHandoff(finalPage, "meeting-create");
            writeOptimisticMeetingHotCache(finalPage, resolvedRootId);
            revealMeetingOnCalendar(finalPage);
            await persistOptimisticMeetingPage(
              resolvedRootId,
              finalPage,
              upsertPages
            );

            if (options.enqueueRecording) {
              const actualQueueResult = await enqueueMeetingRecordingRequest(
                toMeetingEntry(finalPage),
                false
              );
              const queueProps = parsePageProperties(finalPage.properties);
              upsertPageProperty(
                queueProps,
                "录制任务",
                actualQueueResult.ok ? "已入队" : "入队失败",
                {
                  type: "select",
                  options: ["未入队", "已入队", "入队失败"],
                }
              );
              upsertPageProperty(
                queueProps,
                "录制任务ID",
                actualQueueResult.jobId ?? "",
                {
                  type: "text",
                }
              );
              upsertPageProperty(
                queueProps,
                "录制任务错误",
                actualQueueResult.ok ? "" : actualQueueResult.message,
                {
                  type: "text",
                }
              );
              finalPage = {
                ...finalPage,
                properties: stringifyPageProperties(queueProps),
                updated_at: new Date().toISOString(),
              };
              upsertMeetingInView(finalPage);
              upsertPages([finalPage]);
              rememberPendingPageDraft(finalPage);
              rememberPageRouteHandoff(finalPage, "meeting-create");
              writeOptimisticMeetingHotCache(finalPage, resolvedRootId);
              revealMeetingOnCalendar(finalPage);
              await persistOptimisticMeetingPage(
                resolvedRootId,
                finalPage,
                upsertPages
              );
            }
          } catch (error) {
            console.warn("Meeting background persistence failed", error);
            const { pageToRemoteRecord, queueCloudPagePush } =
              await loadPageAccountSyncModule();
            queueCloudPagePush(pageToRemoteRecord(finalPage));
          } finally {
            setOpeningDraft((current) =>
              current?.pageId === optimisticPage.id ? null : current
            );
          }
        })();
      }, 420);

      return { page: optimisticPage, queueResult };
    },
    [
      rootId,
      upsertMeetingInView,
      upsertPages,
      deletedTombstoneRef,
      publishCalendarStatus,
      writeOptimisticMeetingHotCache,
      revealMeetingOnCalendar,
    ]
  );

  const prepareMeetingPageOpen = useCallback(
    (page: Page, source: "meeting-create" | "meeting-open" = "meeting-open") => {
      const seededPage = getMeetingPageOpenSeed(page);
      warmMeetingPeekOpen();
      upsertPages([seededPage]);
      rememberPendingPageDraft(seededPage);
      rememberPageRouteHandoff(seededPage, source);
      const pageRoute = `/page/${seededPage.id}`;
      try {
        router.prefetch(pageRoute);
      } catch {
        // The page draft handoff already carries the first paint if prefetch is unavailable.
      }
      return seededPage;
    },
    [router, upsertPages, warmMeetingPeekOpen]
  );

  const openCreatedMeetingPage = useCallback(
    (page: Page) => {
      page = prepareMeetingPageOpen(page, "meeting-create");
      setSelectedMeeting(null);
      setRunNowMessage("");
      setPeekInitialPage(page);
      setOpeningMeetingId(page.id);
      setPeekPageId(page.id);
    },
    [prepareMeetingPageOpen]
  );

  const handlePeekReady = useCallback((pageId: string) => {
    setOpeningMeetingId((current) => (current === pageId ? null : current));
  }, []);

  useEffect(() => {
    if (peekPageId) return;
    if (!openingMeetingId) return;
    queueMicrotask(() => {
      setOpeningMeetingId((current) =>
        current === openingMeetingId ? null : current
      );
    });
  }, [openingMeetingId, peekPageId]);

  const primeMeetingEntryPage = useCallback(
    (page: Page) => {
      void page;
      warmMeetingPeekOpen();
    },
    [warmMeetingPeekOpen]
  );

  const handleCreate = useCallback(() => {
    if (creatingMeetingDateKey !== null) return;
    const targetDateKey = form.date || toDateKey(new Date());
    setCreatingMeetingDateKey(targetDateKey);
    setIntakeError("");
    setIntakeMessage("正在创建会议页面，后台会继续保存到账号云端…");
    try {
      const result = createMeetingPage(form, {
        importSource: "手动创建",
      });
      setFormOpen(false);
      focusCalendarDate(targetDateKey);
      setIntakeMessage(
        `${formatImportDateMessage(targetDateKey)}会议页面已弹出，后台会继续保存到账号云端。${
          result.cloudOnly ? "本地缓存暂不可写，已先保存在账号云端。" : ""
        }`
      );
      openCreatedMeetingPage(result.page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建会议失败。";
      setIntakeError(message);
      setIntakeMessage("");
    } finally {
      setCreatingMeetingDateKey(null);
    }
  }, [
    createMeetingPage,
    creatingMeetingDateKey,
    focusCalendarDate,
    form,
    openCreatedMeetingPage,
  ]);

  const handleImportInvite = useCallback(async () => {
    const input = intakeText.trim();
    if (!input || intakeLoading) return;

    setIntakeLoading(true);
    setIntakeError("");
    setIntakeMessage("");
    setIntakePreview(null);

    try {
      const res = await fetch("/api/meetings/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = (await res.json()) as IntakeResponse;
      if (!res.ok || !data.meeting) {
        throw new Error(data.error || "读取会议信息失败。");
      }

      const meeting = data.meeting;
      setIntakePreview(meeting);
      const hasExecutableTime = Boolean(meeting.date && meeting.time);
      const draft: MeetingFormState = {
        topic: meeting.topic,
        organizer: meeting.organizer,
        date: meeting.date || form.date || toDateKey(new Date()),
        time: meeting.time,
        platform: normalizePlatform(meeting.platform),
      };
      const transcriptionModel =
        intakeTranscriptionModel === "auto"
          ? inferTranscriptionModel(input)
          : intakeTranscriptionModel;

      const result = createMeetingPage(draft, {
        importSource: "会议信息输入",
        hasJoinUrl: meeting.hasJoinUrl,
        joinUrlHost: meeting.joinUrlHost,
        joinUrl: meeting.joinUrl,
        meetingId: meeting.meetingId,
        passcode: meeting.passcode,
        recordingDevice: intakeRecordingDevice,
        fallbackDevice: DEFAULT_RECORDING_DEVICE,
        transcriptionModel,
        meetingPriority: intakePriority,
        enqueueRecording: hasExecutableTime && Boolean(meeting.joinUrl || meeting.meetingId),
        confidence: meeting.confidence,
        traceStatus: hasExecutableTime ? "已留痕-待执行" : "已留痕-待补时间",
        timeStatus: hasExecutableTime ? "已识别" : "待补充",
        recordingStatus: "待执行",
        traceNote: hasExecutableTime
          ? "会议已导入，等待自动接入与录制。"
          : "导入时没有读到明确日期和开始时间，已先保留会议痕迹；补齐时间后再执行自动接入。",
        warnings: meeting.warnings,
        timeLabel: formatMeetingTime(meeting.time, meeting.endTime),
      });
      focusCalendarDate(draft.date);
      setIntakeText("");
      setIntakeMessage(
        hasExecutableTime
          ? `${formatImportDateMessage(draft.date)}会议页面已弹出；${result?.cloudOnly ? " Edge 本地数据库写入失败，已改存到账号云端。" : ""} 入会链接、会议号和会议密码已保存到会议页面。${formatQueueResultForMessage(
              result?.queueResult
            )}`
          : "已保留会议痕迹并已弹出会议页，但还缺明确开始时间；请在页面里补齐。"
      );
      openCreatedMeetingPage(result.page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取会议信息失败。";
      const fallback = buildFallbackTraceFromInput(input, form.date || toDateKey(new Date()));
      try {
        const result = createMeetingPage(fallback.draft, {
          importSource: "会议信息输入",
          hasJoinUrl: Boolean(fallback.joinUrl),
          joinUrlHost: fallback.joinUrlHost,
          joinUrl: fallback.joinUrl,
          recordingDevice: intakeRecordingDevice,
          fallbackDevice: DEFAULT_RECORDING_DEVICE,
          transcriptionModel:
            intakeTranscriptionModel === "auto"
              ? inferTranscriptionModel(input)
              : intakeTranscriptionModel,
          meetingPriority: intakePriority,
          confidence: "low",
          traceStatus: "导入失败-已留痕",
          timeStatus: "待补充",
          recordingStatus: "未执行",
          traceNote: `解析接口失败，但已保留会议痕迹。失败原因：${message}`,
        });
        focusCalendarDate(fallback.draft.date);
        setIntakeError(`解析失败但已保留痕迹，并已弹出会议页：${message}`);
        openCreatedMeetingPage(result.page);
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : "保留会议痕迹失败。";
        setIntakeError(`导入失败：${message}；保留痕迹也失败：${fallbackMessage}`);
      }
    } finally {
      setIntakeLoading(false);
    }
  }, [
    createMeetingPage,
    focusCalendarDate,
    form.date,
    intakeLoading,
    intakePriority,
    intakeRecordingDevice,
    intakeText,
    intakeTranscriptionModel,
    openCreatedMeetingPage,
  ]);

  const todayKey = toDateKey(new Date());
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryResult, setRetryResult] = useState("");

  const handleRetryParse = useCallback(async () => {
    const pending = entries.filter(
      (e) => needsTraceReview(e) && !isExpiredMeetingTrace(e, todayKey)
    );
    if (pending.length === 0) return;
    setRetryLoading(true);
    setRetryResult("");
    let fixed = 0;
    for (const entry of pending) {
      try {
        const inputText = [
          entry.page.title,
          entry.topic,
          entry.dateKey,
          entry.time,
          entry.platform,
          entry.organizer,
        ]
          .filter(Boolean)
          .join(" ");
        const res = await fetch("/api/meetings/intake", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: inputText }),
        });
        const data = await res.json();
        const m = data?.meeting;
        if (!m) continue;
        const hasTime = Boolean(m.date && m.time);
        if (!hasTime && !m.date) continue;
        const props = parsePageProperties(entry.page.properties);
        const update = (name: string, value: string) => {
          const prop = props.find((p) => p.name === name);
          if (prop) prop.value = value;
        };
        let changed = false;
        if (m.date && m.date !== entry.dateKey) {
          update("日期", m.date);
          changed = true;
        }
        if (m.time && !entry.time) {
          update("时间", formatMeetingTime(m.time, m.endTime));
          update("时间状态", "已识别");
          update("会议痕迹", "已留痕-待执行");
          changed = true;
        }
        if (m.platform && m.platform !== "其他" && entry.platform === "其他") {
          update("平台", m.platform);
          changed = true;
        }
        if (changed) {
          const { updatePageWithCloud } = await loadPageMutationModule();
          const updatedPage = await updatePageWithCloud(entry.page.id, {
            properties: stringifyPageProperties(props),
          });
          if (rootId && updatedPage) {
            await pushMeetingPageCloudSnapshot(rootId, updatedPage);
            upsertMeetingInView(updatedPage);
            upsertPages([updatedPage]);
            writeOptimisticMeetingHotCache(updatedPage, rootId);
            revealMeetingOnCalendar(updatedPage);
          }
          fixed++;
        }
      } catch {
        // skip individual failures
      }
    }
    await load({
      includeCloud: false,
      interruptCloud: false,
      preserveVisibleMeetings: true,
    });
    setRetryLoading(false);
    setRetryResult(
      fixed > 0
        ? `已重新识别 ${fixed} 条会议`
        : "没有新的信息可以补充"
    );
  }, [
    entries,
    load,
    revealMeetingOnCalendar,
    rootId,
    todayKey,
    upsertMeetingInView,
    upsertPages,
    writeOptimisticMeetingHotCache,
  ]);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  useEffect(() => {
    let cancelled = false;
    let cancelScheduledBatch: (() => void) | null = null;
    const allDateKeys = grid.map((cell) => toDateKey(cell.date));
    const initialDateKeys = buildInitialMeetingCalendarHydrationKeys(
      grid,
      todayKey
    );
    const remainingDateKeys = allDateKeys.filter(
      (dateKey) => !initialDateKeys.has(dateKey)
    );
    setHydratedMeetingDateKeys(initialDateKeys);

    const revealNextBatch = () => {
      cancelScheduledBatch = null;
      if (cancelled || remainingDateKeys.length === 0) return;
      const nextBatch = remainingDateKeys.splice(
        0,
        MEETING_CALENDAR_HYDRATION_BATCH
      );
      setHydratedMeetingDateKeys((current) => {
        const next = new Set(current);
        for (const dateKey of nextBatch) next.add(dateKey);
        return next;
      });
      cancelScheduledBatch = scheduleMeetingIdleTask(
        revealNextBatch,
        MEETING_CALENDAR_HYDRATION_FRAME_DELAY_MS
      );
    };

    cancelScheduledBatch = scheduleMeetingIdleTask(
      revealNextBatch,
      MEETING_CALENDAR_HYDRATION_FRAME_DELAY_MS
    );
    return () => {
      cancelled = true;
      cancelScheduledBatch?.();
    };
  }, [grid, todayKey]);

  useEffect(() => {
    const occupiedDateKeys = buildOccupiedMeetingCalendarHydrationKeys(
      grid,
      entriesByDate,
      meetingCountByDate
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
        MEETING_CALENDAR_OCCUPIED_HYDRATION_BATCH
      );
      setHydratedMeetingDateKeys((current) => {
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
        cancelScheduledBatch = scheduleMeetingIdleTask(
          revealNextOccupiedBatch,
          MEETING_CALENDAR_OCCUPIED_HYDRATION_FRAME_DELAY_MS
        );
      }
    };

    revealNextOccupiedBatch();

    return () => {
      cancelled = true;
      cancelScheduledBatch?.();
    };
  }, [entriesByDate, grid, meetingCountByDate]);

  const traceReviewEntries = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            needsTraceReview(entry) &&
            !isExpiredMeetingTrace(entry, todayKey) &&
            !dismissedTraces.has(entry.page.id)
        )
        .slice(0, 12),
    [entries, todayKey, dismissedTraces]
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

  const handleStartRecordingNow = useCallback(
    async (entry: MeetingEntry) => {
      setRunNowMessage("正在把这场会议派给本地 runner...");
      const queueResult = await enqueueMeetingRecordingRequest(entry, true);
      const props = parsePageProperties(entry.page.properties);
      upsertPageProperty(props, "录制任务", queueResult.ok ? "已入队" : "入队失败", {
        type: "select",
        options: ["未入队", "已入队", "入队失败"],
      });
      upsertPageProperty(props, "录制任务ID", queueResult.jobId ?? "", {
        type: "text",
      });
      upsertPageProperty(props, "录制任务错误", queueResult.ok ? "" : queueResult.message, {
        type: "text",
      });
      const { updatePageWithCloud } = await loadPageMutationModule();
      const updatedPage = await updatePageWithCloud(entry.page.id, {
        properties: stringifyPageProperties(props),
      });
      if (rootId && updatedPage) {
        await pushMeetingPageCloudSnapshot(rootId, updatedPage);
        setSelectedMeeting(toMeetingEntry(updatedPage));
        upsertMeetingInView(updatedPage);
        upsertPages([updatedPage]);
        writeOptimisticMeetingHotCache(updatedPage, rootId);
        revealMeetingOnCalendar(updatedPage);
      }
      await load({
        includeCloud: false,
        interruptCloud: false,
        preserveVisibleMeetings: true,
      });
      setRunNowMessage(queueResult.message);
    },
    [
      load,
      revealMeetingOnCalendar,
      rootId,
      upsertMeetingInView,
      upsertPages,
      writeOptimisticMeetingHotCache,
    ]
  );

  const openMeetingFullPage = useCallback(
    (page: Page, source: "meeting-create" | "meeting-open" = "meeting-open") => {
      page = prepareMeetingPageOpen(page, source);
      openPage(page, { source });
    },
    [openPage, prepareMeetingPageOpen]
  );

  const openMeetingDetail = useCallback(
    (entry: MeetingEntry) => {
      primeMeetingEntryPage(entry.page);
      setSelectedMeeting(entry);
    },
    [primeMeetingEntryPage]
  );

  const openMeetingFullPageById = useCallback(
    (pageId: string) => {
      const page =
        entriesById.get(pageId)?.page ??
        (selectedMeeting?.page.id === pageId ? selectedMeeting.page : null) ??
        readPendingPageDraft(pageId) ??
        useWorkspaceStore.getState().getPageById(pageId) ??
        readPageRouteHandoff(pageId) ??
        null;
      if (page) {
        openMeetingFullPage(page, "meeting-open");
        return;
      }
      openPage(pageId, { source: "meeting-open" });
    },
    [entriesById, openMeetingFullPage, openPage, selectedMeeting]
  );

  const quickCreateMeetingForDate = useCallback(
    (dateKey: string) => {
      if (creatingMeetingDateKey !== null) return;
      setCreatingMeetingDateKey(dateKey);
      setIntakeError("");
      setIntakeMessage(`${dateKey} 的会议页面正在弹出，后台会继续保存到账号云端…`);
      try {
        const result = createMeetingPage(
          {
            ...emptyForm(dateKey),
            topic: "",
            organizer: "",
            time: "",
          },
          {
            importSource: "手动创建",
            traceStatus: "已留痕-待补时间",
            timeStatus: "待补充",
            recordingStatus: "未执行",
            traceNote:
              "从日历快速创建，等待补齐主题、时间、平台和入会方式。",
          }
        );
        setFormOpen(false);
        focusCalendarDate(dateKey);
        setIntakeMessage(`${dateKey} 的会议页面已先加入日历，正在弹出…`);
        openCreatedMeetingPage(result.page);
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建会议失败。";
        setIntakeError(message);
        setIntakeMessage("");
      } finally {
        window.setTimeout(() => {
          setCreatingMeetingDateKey((current) =>
            current === dateKey ? null : current
          );
        }, 250);
      }
    },
    [
      createMeetingPage,
      creatingMeetingDateKey,
      focusCalendarDate,
      openCreatedMeetingPage,
    ]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span>🗓️</span> ZhiHui
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                会议管理中心。导入会议信息，查看当天日程，日历总览。
              </p>
              <MeetingCalendarLoadStatusStrip view={calendarLoadStatusView} />
            </div>
            <button
              type="button"
              disabled={creatingMeetingDateKey !== null}
              onPointerEnter={warmMeetingPeekOpen}
              onPointerDown={warmMeetingPeekOpen}
              onFocus={warmMeetingPeekOpen}
              onClick={() => openForm(toDateKey(new Date()))}
              className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {creatingMeetingDateKey ? "创建中…" : "+ 新建会议"}
            </button>
          </div>

          {/* Top: two panels side by side — meeting input + today's meetings */}
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            {/* Left: Meeting info input */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    会议信息输入
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    粘贴会议邀请或入会链接，自动识别并加入日历。
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="meeting-intake-import-button"
                  aria-label="导入会议信息到日历"
                  onPointerEnter={warmMeetingPeekOpen}
                  onPointerDown={warmMeetingPeekOpen}
                  onFocus={warmMeetingPeekOpen}
                  onClick={() => void handleImportInvite()}
                  disabled={intakeLoading || !intakeText.trim()}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                >
                  {intakeLoading ? "读取中..." : "导入"}
                </button>
              </div>
              <textarea
                value={intakeText}
                onChange={(e) => {
                  setIntakeText(e.target.value);
                  setIntakeError("");
                  setIntakeMessage("");
                }}
                rows={3}
                placeholder="粘贴腾讯会议、Zoom、Webex 等邀请，或直接贴入会链接"
                className={`${inputClass} min-h-20 resize-y leading-6`}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="录制设备">
                  <select
                    value={intakeRecordingDevice}
                    onChange={(e) => setIntakeRecordingDevice(e.target.value)}
                    className={inputClass}
                  >
                    {RECORDING_DEVICES.map((device) => (
                      <option key={device} value={device}>
                        {device}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="转写模型">
                  <select
                    value={intakeTranscriptionModel}
                    onChange={(e) => setIntakeTranscriptionModel(e.target.value)}
                    className={inputClass}
                  >
                    {TRANSCRIPTION_MODEL_OPTIONS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="优先级">
                  <select
                    value={intakePriority}
                    onChange={(e) => setIntakePriority(e.target.value)}
                    className={inputClass}
                  >
                    {MEETING_PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                设备不可用时回退到 {DEFAULT_RECORDING_DEVICE}；自动模型会按中英文比例选择 Qwen 或 GPT。
              </p>
              {intakeMessage && (
                <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  {intakeMessage}
                </p>
              )}
              {intakeError && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {intakeError}
                </p>
              )}
              {intakePreview && (
                <div className="mt-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {intakePreview.topic}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-zinc-500 dark:text-zinc-400">
                    <span>{intakePreview.platform}</span>
                    <span>
                      {intakePreview.date && intakePreview.time
                        ? `${intakePreview.date} ${formatMeetingTime(
                            intakePreview.time,
                            intakePreview.endTime
                          )}`
                        : "时间待补充"}
                    </span>
                    {intakePreview.organizer && <span>{intakePreview.organizer}</span>}
                    <span>置信度{confidenceLabel(intakePreview.confidence)}</span>
                  </div>
                </div>
              )}
              {intakePreview?.warnings.length ? (
                <ul className="mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {intakePreview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
                安全边界：保存链接/会议号/密码，不保存原始正文；不会自动开麦克风/摄像头；入会前须通过录音证明。
              </p>
            </div>

            {/* Right: Today's meetings */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  今日会议
                </h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                  {todayMeetings.length} 场
                </span>
              </div>
              {todayMeetings.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
                  今天暂无会议
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {todayMeetings.map((entry) => (
                    <li key={entry.page.id}>
                      <button
                        type="button"
                        onClick={() => openMeetingDetail(entry)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            pageId: entry.page.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        onPointerEnter={() => primeMeetingEntryPage(entry.page)}
                        onFocus={() => primeMeetingEntryPage(entry.page)}
                      >
                        <MeetingStatusBar entry={entry} size="list" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                            {entry.topic}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                            {entry.time && <span>{entry.time}</span>}
                            {entry.platform && <span>{entry.platform}</span>}
                            {entry.organizer && <span>{entry.organizer}</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {traceReviewEntries.length > 0 && (
                <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      待补时间 / 失败留痕
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleRetryParse()}
                        disabled={retryLoading}
                        className="rounded px-1.5 py-0.5 text-[10px] text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-900/40"
                      >
                        {retryLoading ? "识别中..." : "重新识别"}
                      </button>
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                        {traceReviewEntries.length}
                      </span>
                    </div>
                  </div>
                  {retryResult && (
                    <p className="mb-2 text-[10px] text-amber-600 dark:text-amber-400">
                      {retryResult}
                    </p>
                  )}
                  <div className="space-y-1">
                    {traceReviewEntries.slice(0, 5).map((entry) => (
                      <div
                        key={entry.page.id}
                        className="flex items-center gap-1 rounded-md px-1 text-xs transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20"
                      >
                        <button
                          type="button"
                          onClick={() => openMeetingDetail(entry)}
                          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1 text-left"
                          onPointerEnter={() => primeMeetingEntryPage(entry.page)}
                          onFocus={() => primeMeetingEntryPage(entry.page)}
                        >
                          <MeetingStatusBar entry={entry} size="compact" />
                          <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                            {entry.topic}
                          </span>
                          <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">
                            {entry.traceStatus || entry.timeStatus}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissTrace(entry.page.id)}
                          className="shrink-0 rounded-full p-1 text-zinc-300 transition-colors hover:bg-amber-100 hover:text-amber-600 dark:text-zinc-600 dark:hover:bg-amber-950/40 dark:hover:text-amber-400"
                          title="忽略这条提醒（会议仍保留在日历上）"
                          aria-label="忽略这条提醒"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="m15 9-6 6" />
                            <path d="m9 9 6 6" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle: Meeting notes — only finished meetings whose note is ready */}
          {meetingNotes.length > 0 && (
            <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                会议纪要
              </h2>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {meetingNotes.map((entry) => {
                  const unseen = !seenIds.has(entry.page.id);
                  return (
                    <li key={entry.page.id}>
                      <a
                        href={`/page/${entry.page.id}`}
                        onPointerEnter={() => primeMeetingEntryPage(entry.page)}
                        onFocus={() => primeMeetingEntryPage(entry.page)}
                        onClick={(event) => {
                          markSeen(entry.page.id);
                          if (
                            event.defaultPrevented ||
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          ) {
                            return;
                          }
                          event.preventDefault();
                          openMeetingFullPage(entry.page, "meeting-open");
                        }}
                        className="flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        {unseen ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                        ) : (
                          <span className="h-2 w-2 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-100">
                          {entry.topic || "未命名会议"}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-400">
                          {entry.dateKey}
                          {entry.time ? ` ${entry.time}` : ""}
                        </span>
                        {entry.platform && (
                          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                            {entry.platform}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* New meeting form */}
          {formOpen && (
            <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="会议主题">
                  <input
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    placeholder="例如：中国巨石专家交流"
                    className={inputClass}
                  />
                </Field>
                <Field label="组织者">
                  <input
                    value={form.organizer}
                    onChange={(e) =>
                      setForm({ ...form, organizer: e.target.value })
                    }
                    placeholder="例如：XX 证券"
                    className={inputClass}
                  />
                </Field>
                <Field label="日期">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="时间">
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="平台">
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      setForm({ ...form, platform: e.target.value })
                    }
                    className={inputClass}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={creatingMeetingDateKey !== null}
                  onClick={() => setFormOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={creatingMeetingDateKey !== null}
                  onPointerEnter={warmMeetingPeekOpen}
                  onPointerDown={warmMeetingPeekOpen}
                  onFocus={warmMeetingPeekOpen}
                  onClick={() => void handleCreate()}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {creatingMeetingDateKey ? "创建中…" : "创建会议"}
                </button>
              </div>
            </div>
          )}

          {/* Bottom: Calendar */}
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

          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-1.5 text-center text-sm font-medium text-zinc-400"
              >
                周{day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((cell) => {
              const key = toDateKey(cell.date);
              const dayMeetings = entriesByDate.get(key) ?? [];
              const isExpanded = expandedMeetingDateKeys.has(key);
              const visibleLimit = isExpanded
                ? (visibleMeetingLimitByDate.get(key) ??
                  MEETING_CALENDAR_VISIBLE_LIMIT + MEETING_CALENDAR_EXPAND_BATCH)
                : MEETING_CALENDAR_VISIBLE_LIMIT;
              const visibleMeetings = dayMeetings.slice(0, visibleLimit);
              const dayTotalCount = Math.max(
                meetingCountByDate.get(key) ?? 0,
                dayMeetings.length
              );
              const loadedHiddenCount = Math.max(
                0,
                dayMeetings.length - visibleMeetings.length
              );
              const hiddenCount = Math.max(
                0,
                dayTotalCount - visibleMeetings.length
              );
              const nextBatchCount = Math.min(
                MEETING_CALENDAR_EXPAND_BATCH,
                loadedHiddenCount
              );
              const isRenderCapped =
                dayTotalCount > dayMeetings.length && loadedHiddenCount === 0;
              const isLoadingMoreMeetings = loadingMoreMeetingDateKey === key;
              const isToday = key === todayKey;
              const isHighlighted = key === highlightedDateKey;
              const isOpeningDraft = openingDraft?.dateKey === key;
              const isMeetingDateHydrated =
                hydratedMeetingDateKeys.has(key) ||
                isExpanded ||
                isHighlighted ||
                isOpeningDraft ||
                creatingMeetingDateKey === key;
              return (
                <div
                  key={key}
                  data-testid={`meeting-calendar-day-${key}`}
                  ref={(node) => {
                    if (node) {
                      calendarCellRefs.current.set(key, node);
                    } else {
                      calendarCellRefs.current.delete(key);
                    }
                  }}
                  className={`group flex min-h-28 scroll-mt-24 flex-col border-b border-r border-zinc-100 p-1.5 transition-colors dark:border-zinc-800/70 ${
                    isHighlighted
                      ? "bg-emerald-50/80 ring-2 ring-inset ring-emerald-400 dark:bg-emerald-950/20 dark:ring-emerald-500"
                      : cell.inMonth
                        ? ""
                        : "bg-zinc-50/50 dark:bg-zinc-900/40"
                  }`}
                  onPointerEnter={() => {
                    hydrateMeetingDateKey(key);
                    warmMeetingPageRoute();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full text-sm ${
                        isToday
                          ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : cell.inMonth
                            ? "text-zinc-600 dark:text-zinc-300"
                            : "text-zinc-300 dark:text-zinc-600"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    <button
                      type="button"
                      data-testid={`meeting-add-${key}`}
                      aria-label={`创建 ${key} 的会议页面`}
                      disabled={creatingMeetingDateKey !== null}
                      onPointerEnter={warmMeetingPeekOpen}
                      onPointerDown={warmMeetingPeekOpen}
                      onFocus={warmMeetingPeekOpen}
                      onClick={() => void quickCreateMeetingForDate(key)}
                      className="text-zinc-300 opacity-0 transition-opacity hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100 dark:hover:text-zinc-200"
                      title="在这天加会议"
                    >
                      {creatingMeetingDateKey === key || isOpeningDraft
                        ? "…"
                        : "+"}
                    </button>
                  </div>
                  <div className="mt-0.5 flex flex-col gap-0.5 overflow-visible">
                    {isOpeningDraft && (
                      <button
                        type="button"
                        data-testid={`meeting-opening-page-${key}`}
                        onClick={() => {
                          if (openingDraft) {
                            openMeetingFullPageById(openingDraft.pageId);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-left text-xs text-amber-700 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                        title={`${key} 的新会议正在打开`}
                      >
                        <span className="shrink-0">↗</span>
                        <span className="min-w-0 flex-1 truncate">
                          正在打开新会议…
                        </span>
                      </button>
                    )}
                    {!isMeetingDateHydrated && dayTotalCount > 0 && (
                      <button
                        type="button"
                        onClick={() => hydrateMeetingDateKey(key)}
                        onPointerEnter={() => hydrateMeetingDateKey(key)}
                        className="rounded bg-zinc-100/70 px-1.5 py-0.5 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        title={`${key} 有 ${dayTotalCount} 场会议`}
                      >
                        {dayTotalCount} 场会议，点开查看
                      </button>
                    )}
                    {isMeetingDateHydrated && visibleMeetings.map((entry) => (
                      <button
                        key={entry.page.id}
                        type="button"
                        data-testid={`meeting-calendar-entry-${entry.page.id}`}
                        onPointerEnter={() => primeMeetingEntryPage(entry.page)}
                        onFocus={() => primeMeetingEntryPage(entry.page)}
                        onClick={() => openMeetingDetail(entry)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            pageId: entry.page.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className={`group/meeting relative rounded px-1.5 py-0.5 text-left text-xs transition-colors ${
                          openingMeetingId === entry.page.id
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60"
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                        }`}
                        title={buildMeetingSummary(entry)}
                      >
                        <span className="flex min-w-0 items-center gap-1">
                          {openingMeetingId === entry.page.id ? (
                            <span className="shrink-0 leading-4">↗</span>
                          ) : (
                            <MeetingStatusBar entry={entry} size="compact" />
                          )}
                          <span className="block min-w-0 truncate">
                            {openingMeetingId === entry.page.id
                              ? "正在打开会议…"
                              : `${entry.time ? `${entry.time} ` : ""}${
                                  entry.topic
                                }`}
                          </span>
                        </span>
                        <MeetingHoverCard entry={entry} />
                      </button>
                    ))}
                    {isMeetingDateHydrated &&
                      (dayMeetings.length > MEETING_CALENDAR_VISIBLE_LIMIT ||
                      dayTotalCount > MEETING_CALENDAR_VISIBLE_LIMIT) && (
                      <button
                        type="button"
                        disabled={isLoadingMoreMeetings}
                        onClick={() => {
                          if (isLoadingMoreMeetings) return;
                          if (isRenderCapped) {
                            void loadMoreMeetingsForDate(key, dayTotalCount);
                            return;
                          }
                          if (isExpanded && hiddenCount === 0) {
                            toggleMeetingDateExpansion(key);
                            return;
                          }
                          if (isExpanded) {
                            showMoreMeetingsForDate(key, dayMeetings.length);
                            return;
                          }
                          toggleMeetingDateExpansion(key);
                        }}
                        aria-expanded={isExpanded}
                        className="rounded bg-zinc-50 px-1.5 py-0.5 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-wait disabled:opacity-70 dark:bg-zinc-900/40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {isLoadingMoreMeetings
                          ? "正在补齐…"
                          : isExpanded
                          ? isRenderCapped
                            ? `点击补齐 ${visibleMeetings.length}/${dayTotalCount} 场`
                            : hiddenCount > 0
                            ? `再显示 ${nextBatchCount} 场（剩余 ${hiddenCount}）`
                            : `收起到 ${MEETING_CALENDAR_VISIBLE_LIMIT} 场`
                          : `+${hiddenCount} 场，点击展开`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {upcoming.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                即将到来的会议
              </h3>
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {upcoming.map((entry) => (
                  <li key={entry.page.id}>
                    <button
                      type="button"
                      onPointerEnter={() => primeMeetingEntryPage(entry.page)}
                      onFocus={() => primeMeetingEntryPage(entry.page)}
                      onClick={() => openMeetingDetail(entry)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          pageId: entry.page.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      title={buildMeetingSummary(entry)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <MeetingStatusBar entry={entry} size="list" />
                      <span className="w-24 shrink-0 text-xs text-zinc-400">
                        {entry.dateKey}
                        {entry.time ? ` ${entry.time}` : ""}
                      </span>
                      <span className="truncate text-zinc-700 dark:text-zinc-200">
                        {entry.topic}
                      </span>
                      {entry.platform && (
                        <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                          {entry.platform}
                        </span>
                      )}
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
          onOpen={openMeetingFullPageById}
          onOpenFull={openMeetingFullPageById}
          onChanged={() => void handleContextMenuChanged(contextMenu.pageId)}
        />
      )}
      {selectedMeeting && (
        <MeetingDetailWindow
          entry={selectedMeeting}
          runNowMessage={runNowMessage}
          onClose={() => {
            setRunNowMessage("");
            setSelectedMeeting(null);
          }}
          onPrimeOpen={() => primeMeetingEntryPage(selectedMeeting.page)}
          onOpenFull={openMeetingFullPageById}
          onDelete={(id) => void handleDeleteMeeting(id)}
          onStartNow={handleStartRecordingNow}
        />
      )}
      {peekPageId && (
        <PagePeekModal
          pageId={peekPageId}
          initialPage={peekInitialPage}
          onClose={() => {
            setPeekPageId(null);
            setPeekInitialPage(null);
          }}
          onOpenFull={(id) => {
            setPeekPageId(null);
            setPeekInitialPage(null);
            openMeetingFullPageById(id);
          }}
          onReady={handlePeekReady}
          onChanged={() =>
            void load({
              includeCloud: false,
              interruptCloud: false,
              preserveVisibleMeetings: true,
            })
          }
        />
      )}
    </div>
  );
}

function emptyForm(dateKey: string): MeetingFormState {
  return {
    topic: "",
    organizer: "",
    date: dateKey,
    time: "",
    platform: PLATFORMS[0],
  };
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

function normalizeMeetingDateKey(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const isoLike = normalized.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (isoLike) {
    return `${isoLike[1]}-${padNumber(isoLike[2])}-${padNumber(isoLike[3])}`;
  }

  const slashLike = normalized.match(/(20\d{2})[/.](\d{1,2})[/.](\d{1,2})/);
  if (slashLike) {
    return `${slashLike[1]}-${padNumber(slashLike[2])}-${padNumber(slashLike[3])}`;
  }

  const chineseLike = normalized.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (chineseLike) {
    return `${chineseLike[1]}-${padNumber(chineseLike[2])}-${padNumber(chineseLike[3])}`;
  }

  return "";
}

function normalizeMeetingTime(value: string) {
  const match = value.match(/([01]?\d|2[0-3])[:：]([0-5]\d)(?:\s*(?:-|--|---|–|—|至|到|~|to)\s*([01]?\d|2[0-3])[:：]([0-5]\d))?/i);
  if (!match) return value;
  const start = `${padNumber(match[1])}:${match[2]}`;
  return match[3] && match[4] ? `${start}-${padNumber(match[3])}:${match[4]}` : start;
}

function padNumber(value: string) {
  return value.padStart(2, "0");
}

function formatImportDateMessage(dateKey: string) {
  if (!dateKey) return "已导入会议日历。";
  const todayKey = toDateKey(new Date());
  if (dateKey === todayKey) {
    return `已导入今天 ${dateKey} 的会议日历。`;
  }
  return `已导入 ${dateKey} 的会议日历，已自动定位到这一天；这场不是今天，所以“今日会议”不会增加。`;
}

async function restoreDeletedMeetingPages(
  rootId: string,
  tombstone: Set<string>
) {
  const deletedPages = await getDeletedPages();
  const candidates = deletedPages.filter(
    (page) =>
      page.parent_id === rootId &&
      isMeetingTracePage(page) &&
      !tombstone.has(page.id)
  );
  for (const page of candidates) {
    const restored = await restorePage(page.id);
    if (restored) {
      await pushMeetingPageCloudSnapshot(rootId, restored);
    }
  }
}

function isMeetingTracePage(page: Page) {
  const props = parsePageProperties(page.properties);
  return props.some((prop) =>
    [
      "会议痕迹",
      "时间状态",
      "录制状态",
      "录制链路",
      "入会链接",
      "会议号",
    ].includes(prop.name)
  );
}

async function pushMeetingPageCloudSnapshot(rootId: string, meetingPage: Page) {
  try {
    const rootPage = await getPage(rootId);
    if (!rootPage) return;
    const { pageToRemoteRecord, pushCloudPages } =
      await loadPageAccountSyncModule();
    await pushCloudPages([
      pageToRemoteRecord(rootPage),
      pageToRemoteRecord(meetingPage),
    ]);
  } catch {
    // The local page remains visible; account page sync can retry later.
  }
}

async function loadMeetingCloudMetadata(
  options: MeetingCloudMetadataOptions = {}
): Promise<MeetingCloudMetadataSnapshot> {
  const { fetchMeetingCloudMetadata } = await loadPageAccountSyncModule();
  const data = await fetchMeetingCloudMetadata(options);
  if (data.status !== "ok") {
    return {
      ...emptyMeetingCloudMetadata(false),
      status: data.status,
    };
  }
  return {
    ok: true,
    status: data.status,
    rootId: data.rootId ?? null,
    pages: data.pages.map(cloudRecordToPage),
    count: data.total,
    matched: data.matched,
    rangeCount: data.rangeCount,
    recentCount: data.recentCount,
    scanned: data.scanned,
    cached: data.cached,
    watermark: data.watermark,
  };
}

function emptyMeetingCloudMetadata(ok: boolean): MeetingCloudMetadataSnapshot {
  return {
    ok,
    rootId: null,
    pages: [],
  };
}

function meetingCloudCacheKey(startDate: string, endDate: string): string {
  return `${MEETING_CLOUD_CACHE_PREFIX}${startDate}:${endDate}:v1`;
}

function readCachedMeetingCloudMetadata(
  startDate: string,
  endDate: string
): MeetingCloudMetadataSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      meetingCloudCacheKey(startDate, endDate)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeetingCloudMetadataSnapshot> & {
      cachedAt?: string;
    };
    const cachedAt = parsed.cachedAt ? Date.parse(parsed.cachedAt) : 0;
    if (!cachedAt || Date.now() - cachedAt > MEETING_CLOUD_CACHE_FRESH_MS) {
      return null;
    }
    if (!parsed.ok || !Array.isArray(parsed.pages)) return null;
    return {
      ok: true,
      rootId: typeof parsed.rootId === "string" ? parsed.rootId : null,
      pages: parsed.pages,
      count: typeof parsed.count === "number" ? parsed.count : undefined,
      matched: typeof parsed.matched === "number" ? parsed.matched : undefined,
      rangeCount:
        typeof parsed.rangeCount === "number" ? parsed.rangeCount : undefined,
      recentCount:
        typeof parsed.recentCount === "number" ? parsed.recentCount : undefined,
      scanned: typeof parsed.scanned === "number" ? parsed.scanned : undefined,
      cached: typeof parsed.cached === "boolean" ? parsed.cached : undefined,
      watermark:
        typeof parsed.watermark === "string" ? parsed.watermark : undefined,
    };
  } catch {
    return null;
  }
}

function writeCachedMeetingCloudMetadata(
  startDate: string,
  endDate: string,
  cloud: MeetingCloudMetadataSnapshot
): void {
  if (typeof window === "undefined" || !cloud.ok) return;
  try {
    const key = meetingCloudCacheKey(startDate, endDate);
    if (!shouldWriteCachedMeetingCloudMetadata(key, cloud)) return;
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...cloud, cachedAt: new Date().toISOString() })
    );
  } catch {
    // Local cache is best-effort; the cloud result is already displayed.
  }
}

function shouldWriteCachedMeetingCloudMetadata(
  key: string,
  cloud: MeetingCloudMetadataSnapshot
): boolean {
  const cached = readCachedMeetingCloudMetadataSignature(key);
  if (!cached) return true;
  if (cached.signature !== buildMeetingCloudMetadataCacheSignature(cloud)) {
    return true;
  }
  return Date.now() - cached.cachedAt > MEETING_CLOUD_CACHE_FRESH_MS;
}

function readCachedMeetingCloudMetadataSignature(
  key: string
): MeetingCloudMetadataCacheSignature | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeetingCloudMetadataCacheEntry>;
    const cachedAt = parsed.cachedAt ? Date.parse(parsed.cachedAt) : 0;
    if (!cachedAt || !parsed.ok || !Array.isArray(parsed.pages)) return null;
    return {
      signature: buildMeetingCloudMetadataCacheSignature(
        parsed as MeetingCloudMetadataCacheEntry
      ),
      cachedAt,
    };
  } catch {
    return null;
  }
}

function buildMeetingCloudMetadataCacheSignature(
  cloud: MeetingCloudMetadataCacheEntry
): string {
  return JSON.stringify(stableMeetingCloudMetadataCacheValue(cloud));
}

function stableMeetingCloudMetadataCacheValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableMeetingCloudMetadataCacheValue(item));
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
      result[key] = stableMeetingCloudMetadataCacheValue(nextValue);
    }
  }
  return result;
}

async function persistMeetingCloudMetadata(
  cloud: MeetingCloudMetadataSnapshot,
  upsertPages: (pages: Page[]) => void
): Promise<void> {
  if (!cloud.ok || !cloud.rootId) return;
  const { pageToRemoteRecord } = await loadPageAccountSyncModule();
  const updatedAt = latestMeetingUpdatedAt(cloud.pages);
  const rootRecord: RemotePageRecord = {
    id: cloud.rootId,
    parent_id: null,
    title: "ZhiHui",
    icon: "🗓️",
    cover_url: null,
    content_text: null,
    properties: null,
    position: 0,
    depth: 0,
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: null,
  };
  const records = [rootRecord, ...cloud.pages.map(pageToRemoteRecord)];
  try {
    await applyRemotePageMetadata(records);
    upsertPages(records.map(cloudRecordToPage));
  } catch {
    // The visible cloud snapshot already rendered; local hot-cache persistence
    // can retry through the next calendar load or the background sync.
  }
}

function latestMeetingUpdatedAt(pages: Page[]): string {
  const latest = pages.reduce(
    (current, page) =>
      page.updated_at && page.updated_at > current ? page.updated_at : current,
    ""
  );
  return latest || new Date().toISOString();
}

function cloudRecordToPage(record: RemotePageRecord): Page {
  return {
    id: record.id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: record.parent_id,
    database_id: null,
    title: record.title ?? "",
    icon: record.icon ?? null,
    cover_url: record.cover_url ?? null,
    content_yjs: null,
    content_text: record.content_text ?? null,
    properties: record.properties ?? null,
    position: record.position ?? 0,
    depth: record.depth ?? 0,
    created_at: record.created_at,
    updated_at: record.updated_at,
    deleted_at: record.deleted_at ?? null,
    sync_version: 1,
  };
}

function isMeetingCalendarPageUpdate(
  payload: PageUpdatePayload,
  meetingRootId: string | null,
  knownMeetingIds: Set<string>
): boolean {
  if (knownMeetingIds.has(payload.id)) return true;
  if (!meetingRootId) return false;
  return payload.id === meetingRootId || payload.parent_id === meetingRootId;
}

function applyMeetingPageUpdatePayloads(
  payloads: PageUpdatePayload[],
  setMeetings: (updater: (current: Page[]) => Page[]) => void,
  meetingsRef: { current: Page[] },
  viewMonth: Date,
  tombstone: Set<string>
): void {
  const visibleRange = buildMonthGrid(viewMonth);
  const startDate = toDateKey(visibleRange[0].date);
  const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);

  startTransition(() => {
    setMeetings((current) => {
      const byId = new Map(current.map((page) => [page.id, page]));
      let changed = false;

      for (const payload of payloads) {
        const existing = byId.get(payload.id);
        if (payload.deleted_at || tombstone.has(payload.id)) {
          if (byId.delete(payload.id)) changed = true;
          continue;
        }

        const metadataPage = pageUpdatePayloadToPage(payload);
        if (!existing && !toMeetingEntry(metadataPage).dateKey) continue;

        const nextPage: Page = {
          ...(existing ?? metadataPage),
          ...metadataPage,
          content_text: existing?.content_text ?? null,
          content_yjs: existing?.content_yjs ?? null,
        };
        const previousFingerprint = existing
          ? meetingPageMetadataFingerprint(existing)
          : "";
        if (previousFingerprint === meetingPageMetadataFingerprint(nextPage)) {
          continue;
        }
        byId.set(payload.id, nextPage);
        changed = true;
      }

      if (!changed) return current;
      const selection = selectMeetingPagesForCalendarRender(
        Array.from(byId.values()),
        startDate,
        endDate
      );
      meetingsRef.current = selection.pages;
      return selection.pages;
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

function meetingPageMetadataFingerprint(page: Page): string {
  return [
    page.id,
    page.parent_id ?? "",
    page.title,
    page.icon ?? "",
    page.cover_url ?? "",
    page.properties ?? "",
    page.position,
    page.depth,
    page.updated_at,
    page.deleted_at ?? "",
  ].join(":");
}

function publishMeetingCalendarRenderSelection(
  pages: Page[],
  countsByDate: Map<string, number>,
  fingerprintRef: { current: string },
  setMeetings: (pages: Page[]) => void,
  setMeetingCountByDate: (counts: Map<string, number>) => void,
  shouldPublish: () => boolean = () => true
): boolean {
  if (!shouldPublish()) return false;
  const nextFingerprint = [
    meetingPagesRenderFingerprint(pages),
    meetingDateCountsFingerprint(countsByDate),
  ].join("#");
  if (fingerprintRef.current === nextFingerprint) return false;

  startTransition(() => {
    if (!shouldPublish()) return;
    if (fingerprintRef.current === nextFingerprint) return;
    fingerprintRef.current = nextFingerprint;
    setMeetings(pages);
    setMeetingCountByDate(countsByDate);
  });
  return true;
}

function meetingPagesRenderFingerprint(pages: Page[]): string {
  return pages.map(meetingPageMetadataFingerprint).join("|");
}

function meetingDateCountsFingerprint(
  countsByDate: Map<string, number>
): string {
  return Array.from(countsByDate.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([dateKey, count]) => `${dateKey}:${count}`)
    .join("|");
}

function mergeMeetingPages(
  localPages: Page[],
  cloudPages: Page[],
  tombstone: Set<string>
) {
  const byId = new Map<string, Page>();
  for (const page of [...localPages, ...cloudPages]) {
    if (page.deleted_at || tombstone.has(page.id)) continue;
    const existing = byId.get(page.id);
    if (!existing || page.updated_at >= existing.updated_at) {
      byId.set(page.id, page);
    }
  }
  return [...byId.values()];
}

function retainVisibleMeetingPagesForBackgroundRefresh(
  currentMeetings: Page[],
  localPageIds: Set<string>,
  tombstone: Set<string>
): Page[] {
  return currentMeetings.filter(
    (page) => !localPageIds.has(page.id) && !tombstone.has(page.id)
  );
}

function selectMeetingPagesForCalendarRender(
  pages: Page[],
  startDate: string,
  endDate: string
): MeetingCalendarRenderSelection {
  const selectedPages: Page[] = [];
  const countsByDate = new Map<string, number>();
  const renderedByDate = new Map<string, number>();
  const selectedIds = new Set<string>();
  const upcomingCandidates: MeetingEntry[] = [];
  const completedCandidates: MeetingEntry[] = [];
  const undatedReviewCandidates: MeetingEntry[] = [];
  const todayKey = toDateKey(new Date());

  const pushSelectedPage = (page: Page) => {
    if (selectedIds.has(page.id)) return;
    selectedPages.push(page);
    selectedIds.add(page.id);
  };

  for (const page of pages) {
    const entry = toMeetingEntry(page);
    const dateKey = entry.dateKey;
    if (!dateKey) {
      addRecentMeetingEntryCandidate(
        undatedReviewCandidates,
        entry,
        MEETING_RENDER_UNDATED_REVIEW_LIMIT
      );
      continue;
    }

    if (dateKey < startDate || dateKey > endDate) {
      if (dateKey >= todayKey) {
        addUpcomingMeetingEntryCandidate(
          upcomingCandidates,
          entry,
          MEETING_RENDER_UPCOMING_BUFFER_LIMIT
        );
      }
      if (isCompletedMeetingEntry(entry)) {
        addRecentMeetingEntryCandidate(
          completedCandidates,
          entry,
          MEETING_RENDER_COMPLETED_BUFFER_LIMIT
        );
      }
      continue;
    }

    countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
    const renderedCount = renderedByDate.get(dateKey) ?? 0;
    if (renderedCount >= MEETING_CALENDAR_RENDER_DAY_LIMIT) continue;

    pushSelectedPage(page);
    renderedByDate.set(dateKey, renderedCount + 1);
  }

  for (const entry of upcomingCandidates) pushSelectedPage(entry.page);
  for (const entry of completedCandidates) pushSelectedPage(entry.page);
  for (const entry of undatedReviewCandidates) pushSelectedPage(entry.page);

  return { pages: selectedPages, countsByDate };
}

function isCompletedMeetingEntry(entry: MeetingEntry): boolean {
  return (
    !entry.page.deleted_at &&
    (entry.recordingStatus === "录制成功" || entry.traceStatus === "已完成")
  );
}

function addUpcomingMeetingEntryCandidate(
  candidates: MeetingEntry[],
  entry: MeetingEntry,
  limit: number
): void {
  if (limit <= 0) return;
  let insertAt = candidates.length;
  while (
    insertAt > 0 &&
    compareUpcomingMeetingEntries(entry, candidates[insertAt - 1]) < 0
  ) {
    insertAt -= 1;
  }
  if (insertAt >= limit) return;
  candidates.splice(insertAt, 0, entry);
  if (candidates.length > limit) candidates.pop();
}

function addRecentMeetingEntryCandidate(
  candidates: MeetingEntry[],
  entry: MeetingEntry,
  limit: number
): void {
  if (limit <= 0) return;
  let insertAt = candidates.length;
  while (
    insertAt > 0 &&
    compareRecentMeetingNoteEntries(entry, candidates[insertAt - 1]) < 0
  ) {
    insertAt -= 1;
  }
  if (insertAt >= limit) return;
  candidates.splice(insertAt, 0, entry);
  if (candidates.length > limit) candidates.pop();
}

function sumMeetingDateCounts(countsByDate: Map<string, number>): number {
  let total = 0;
  for (const count of countsByDate.values()) total += count;
  return total;
}

function countMeetingDateCounts(countsByDate: Map<string, number>): number {
  let total = 0;
  for (const count of countsByDate.values()) {
    if (count > 0) total += 1;
  }
  return total;
}

function countMeetingDates(pages: Page[]): number {
  const dateKeys = new Set<string>();
  for (const page of pages) {
    const dateKey = toMeetingEntry(page).dateKey;
    if (dateKey) dateKeys.add(dateKey);
  }
  return dateKeys.size;
}

async function seedMeetingPageForImmediateOpen(page: Page): Promise<void> {
  try {
    const { pageToRemoteRecord } = await loadPageAccountSyncModule();
    await applyRemotePages([pageToRemoteRecord(page)]);
  } catch {
    // The in-memory store and pending draft already let the page open. Local
    // cache persistence can be retried by the pending upload path.
  }
}

async function getLatestOpenedMeetingPage(page: Page): Promise<Page> {
  const memoryPage = useWorkspaceStore.getState().getPageById(page.id);
  if (memoryPage) return { ...page, ...memoryPage };

  const localPage = await getPage(page.id).catch(() => null);
  if (localPage) return { ...page, ...localPage };

  return page;
}

function getMeetingPageOpenSeed(page: Page): Page {
  const memoryPage = useWorkspaceStore.getState().getPageById(page.id);
  if (!memoryPage) return page;
  if (
    memoryPage.content_text != null ||
    memoryPage.updated_at >= page.updated_at
  ) {
    return { ...page, ...memoryPage };
  }
  return page;
}

async function persistOptimisticMeetingPage(
  rootId: string,
  page: Page,
  upsertPages: (pages: Page[]) => void
): Promise<"queued" | "local-only"> {
  const { pageToRemoteRecord } = await loadPageAccountSyncModule();
  const rootRecord = await makeMeetingRootRecord(rootId, page.updated_at);
  const pageRecord = pageToRemoteRecord(page);
  const records = [rootRecord, pageRecord];
  const localPages = records.map(cloudRecordToPage);

  try {
    await applyRemotePages(records);
  } catch {
    // The current page is already visible from memory. A rebuildable cache miss
    // must not block the user's write path.
  } finally {
    upsertPages(localPages);
  }

  return queueMeetingCloudRecords(records);
}

function queueMeetingCloudRecords(
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

async function makeMeetingRootRecord(
  rootId: string,
  updatedAt: string
): Promise<RemotePageRecord> {
  const { pageToRemoteRecord } = await loadPageAccountSyncModule();
  const rootPage = await getPage(rootId).catch(() => null);
  if (rootPage) {
    return pageToRemoteRecord({
      ...rootPage,
      updated_at:
        rootPage.updated_at && rootPage.updated_at > updatedAt
          ? rootPage.updated_at
          : updatedAt,
    });
  }
  return pageToRemoteRecord(
    makeCloudOnlyPage({
      id: rootId,
      parentId: null,
      title: "ZhiHui",
      icon: "🗓️",
      contentText: "",
      properties: null,
      position: 0,
      depth: 0,
      now: updatedAt,
    })
  );
}

function makeCloudOnlyPage({
  id,
  parentId,
  title,
  icon,
  contentText,
  properties,
  position,
  depth,
  now,
}: {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  contentText: string | null;
  properties: string | null;
  position: number;
  depth: number;
  now: string;
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
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_version: 1,
  };
}

function toMeetingEntry(page: Page): MeetingEntry {
  const props = parsePageProperties(page.properties);
  const read = (name: string) =>
    props.find((p) => p.name === name)?.value ?? "";
  const rawDate = read("日期");
  const rawTime = read("时间");
  const dateKey = normalizeMeetingDateKey(
    [rawDate, rawTime, page.title, page.content_text ?? ""].join("\n")
  );
  return {
    page,
    topic: page.title || "未命名会议",
    organizer: read("组织者"),
    platform: read("平台"),
    time: normalizeMeetingTime(rawTime),
    dateKey,
    joinUrl: read("入会链接"),
    joinUrlHost: read("链接域名"),
    meetingId: read("会议号"),
    passcode: read("会议密码"),
    importSource: read("导入来源"),
    confidence: read("解析置信度"),
    recordingDevice: read("录制设备"),
    fallbackDevice: read("默认回退设备"),
    transcriptionModel: read("转写模型"),
    meetingPriority: read("会议优先级"),
    queueStatus: read("录制任务"),
    queueJobId: read("录制任务ID"),
    queueError: read("录制任务错误"),
    traceStatus: read("会议痕迹"),
    timeStatus: read("时间状态"),
    recordingStatus: read("录制状态"),
    recordingGateStatus: read("录制链路"),
    importedAt: read("导入时间"),
    traceNote: read("留痕说明"),
  };
}

function getUpcomingMeetingEntries(
  entries: MeetingEntry[],
  todayKey: string,
  limit: number
): MeetingEntry[] {
  if (limit <= 0) return [];
  const upcoming: MeetingEntry[] = [];

  for (const entry of entries) {
    if (!entry.dateKey || entry.dateKey < todayKey) continue;
    let insertAt = upcoming.length;
    while (
      insertAt > 0 &&
      compareUpcomingMeetingEntries(entry, upcoming[insertAt - 1]) < 0
    ) {
      insertAt -= 1;
    }

    if (insertAt >= limit) continue;
    upcoming.splice(insertAt, 0, entry);
    if (upcoming.length > limit) upcoming.pop();
  }

  return upcoming;
}

function compareUpcomingMeetingEntries(a: MeetingEntry, b: MeetingEntry) {
  const dateOrder = a.dateKey.localeCompare(b.dateKey);
  if (dateOrder !== 0) return dateOrder;
  const timeOrder = (a.time || "").localeCompare(b.time || "");
  if (timeOrder !== 0) return timeOrder;
  return (b.page.updated_at || "").localeCompare(a.page.updated_at || "");
}

function getRecentCompletedMeetingEntries(
  entries: MeetingEntry[],
  limit: number
): MeetingEntry[] {
  if (limit <= 0) return [];
  const recent: MeetingEntry[] = [];

  for (const entry of entries) {
    if (
      entry.page.deleted_at ||
      (entry.recordingStatus !== "录制成功" && entry.traceStatus !== "已完成")
    ) {
      continue;
    }

    let insertAt = recent.length;
    while (
      insertAt > 0 &&
      compareRecentMeetingNoteEntries(entry, recent[insertAt - 1]) < 0
    ) {
      insertAt -= 1;
    }

    if (insertAt >= limit) continue;
    recent.splice(insertAt, 0, entry);
    if (recent.length > limit) recent.pop();
  }

  return recent;
}

function compareRecentMeetingNoteEntries(a: MeetingEntry, b: MeetingEntry) {
  const updatedOrder = (b.page.updated_at || "").localeCompare(
    a.page.updated_at || ""
  );
  if (updatedOrder !== 0) return updatedOrder;
  return a.page.id.localeCompare(b.page.id);
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function normalizePlatform(platform: string) {
  return PLATFORMS.includes(platform) ? platform : "其他";
}

function formatMeetingTime(startTime: string, endTime: string) {
  if (!startTime) return "";
  return endTime ? `${startTime}-${endTime}` : startTime;
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s<>"'，。；、)）]+/i)?.[0] ?? "";
}

function safeUrlHost(value: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function buildFallbackTraceFromInput(input: string, fallbackDate: string) {
  const joinUrl = extractFirstUrl(input);
  const joinUrlHost = safeUrlHost(joinUrl);
  const firstLine =
    input
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^https?:\/\//i.test(line)) || "待补会议";

  return {
    draft: {
      topic: firstLine.slice(0, 80),
      organizer: "",
      date: fallbackDate,
      time: "",
      platform: detectPlatformFromText(`${input}\n${joinUrlHost}`),
    },
    joinUrl,
    joinUrlHost,
  };
}

function detectPlatformFromText(value: string) {
  const text = value.toLowerCase();
  if (text.includes("meeting.tencent.com") || text.includes("腾讯会议")) return "腾讯会议";
  if (text.includes("zoom.us") || /\bzoom\b/i.test(value)) return "Zoom";
  if (text.includes("webex.com") || /\bwebex\b/i.test(value)) return "Webex";
  if (text.includes("comein.cn") || text.includes("进门财经")) return "进门财经";
  if (text.includes("meritco-group.com") || text.includes("久谦")) return "久谦论坛";
  if (text.includes("teams.microsoft.com") || /\bteams\b/i.test(value)) return "Teams";
  if (text.includes("meet.google.com") || text.includes("google meet")) return "Google Meet";
  return "其他";
}

function buildMeetingTraceContent({
  title,
  topic,
  organizer,
  date,
  time,
  platform,
  joinUrl,
  meetingId,
  hasPasscode,
  recordingDevice,
  fallbackDevice,
  transcriptionModel,
  meetingPriority,
  queueStatus,
  queueJobId,
  queueError,
  traceStatus,
  timeStatus,
  recordingStatus,
  recordingGateStatus,
  importedAt,
  traceNote,
}: {
  title: string;
  topic: string;
  organizer: string;
  date: string;
  time: string;
  platform: string;
  joinUrl: string;
  meetingId: string;
  hasPasscode: boolean;
  recordingDevice: string;
  fallbackDevice: string;
  transcriptionModel: string;
  meetingPriority: string;
  queueStatus: string;
  queueJobId: string;
  queueError: string;
  traceStatus: string;
  timeStatus: string;
  recordingStatus: string;
  recordingGateStatus: string;
  importedAt: string;
  traceNote: string;
}) {
  const rows = [
    ["主题", topic],
    ["组织者", organizer || "未读取"],
    ["日期", date || "未设置"],
    ["时间", time || "待补充"],
    ["平台", platform],
    ["入会链接", joinUrl || "未提供"],
    ["会议号", meetingId || "未读取"],
    ["会议密码", hasPasscode ? "已保存" : "未读取"],
    ["录制设备", recordingDevice],
    ["默认回退设备", fallbackDevice],
    ["转写模型", displayTranscriptionModel(transcriptionModel)],
    ["会议优先级", displayMeetingPriority(meetingPriority)],
    ["录制任务", queueStatus || "未入队"],
    ["录制任务ID", queueJobId || "无"],
    ["录制任务错误", queueError || "无"],
    ["会议痕迹", traceStatus],
    ["时间状态", timeStatus],
    ["录制状态", recordingStatus],
    ["录制链路", recordingGateStatus],
    ["导入时间", importedAt],
    ["留痕说明", traceNote || "无"],
  ];

  return `<h1>${escapeHtml(title)}</h1><p>ZhiHui 已保留这条会议痕迹。无论后续录制、转写或发布是否成功，这个页面都作为审计记录保留。</p><table><tbody>${rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    )
    .join("")}</tbody></table>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function confidenceLabel(confidence: IntakeMeeting["confidence"]) {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  return "低";
}

function inferTranscriptionModel(value: string) {
  const chineseChars = value.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = value.match(/[a-zA-Z]{2,}/g)?.length ?? 0;
  return chineseChars >= latinWords * 2 ? "qwen" : "gpt";
}

function normalizeMeetingPriorityValue(value?: string) {
  if (value === "high" || value === "优先") return "优先";
  return "默认";
}

function displayMeetingPriority(value: string) {
  return value === "high" || value === "优先" ? "优先" : "默认";
}

function displayTranscriptionModel(value: string) {
  return value === "gpt" ? "GPT" : "Qwen";
}

function formatQueueResultForMessage(result?: QueueResult) {
  if (!result) return " 这条会议暂未进入录制队列。";
  if (result.status === "pending") return ` ${result.message}`;
  if (result.ok) return " 已进入本地 runner 录制队列。";
  if (result.status === "skipped") return ` ${result.message}`;
  return ` 会议已保留，但录制任务入队失败：${result.message}`;
}

function upsertPageProperty(
  props: PageProperty[],
  name: string,
  value: string,
  config: { type: PageProperty["type"]; options?: string[] }
) {
  const existing = props.find((prop) => prop.name === name);
  if (existing) {
    existing.type = config.type;
    existing.value = value;
    if (config.options) existing.options = config.options;
    return;
  }
  props.push({
    ...createPageProperty(config.type, name),
    value,
    ...(config.options ? { options: config.options } : {}),
  });
}

async function enqueueMeetingRecordingRequest(
  entry: MeetingEntry,
  runNow: boolean
): Promise<QueueResult> {
  if (!entry.dateKey || !entry.time) {
    return {
      ok: false,
      status: "skipped",
      message: "缺少会议日期或时间，暂时不能交给 runner。",
    };
  }
  if (!entry.joinUrl && !entry.meetingId) {
    return {
      ok: false,
      status: "skipped",
      message: "缺少入会链接或会议号，暂时不能交给 runner。",
    };
  }

  try {
    const response = await fetch("/api/meetings/agent/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runNow,
        meeting: {
          pageId: entry.page.id,
          title: entry.page.title,
          topic: entry.topic,
          organizer: entry.organizer,
          platform: normalizePlatform(entry.platform),
          date: entry.dateKey,
          time: entry.time,
          joinUrl: entry.joinUrl,
          meetingId: entry.meetingId,
          passcode: entry.passcode,
          recordingDevice: entry.recordingDevice || DEFAULT_RECORDING_DEVICE,
          fallbackDevice: entry.fallbackDevice || DEFAULT_RECORDING_DEVICE,
          transcriptionModel: entry.transcriptionModel || "qwen",
          meetingPriority: entry.meetingPriority || "默认",
        },
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      job_id?: string;
    };
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        message: data.error || "云端队列接口返回失败。",
      };
    }
    return {
      ok: true,
      status: "queued",
      message: runNow ? "已请求本地 runner 立即开始录制。" : "已进入本地 runner 录制队列。",
      jobId: data.job_id,
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      message: error instanceof Error ? error.message : "无法连接云端队列接口。",
    };
  }
}

function MeetingCalendarLoadStatusStrip({
  view,
}: {
  view: MeetingCalendarLoadStatusView;
}) {
  return (
    <div
      data-testid="meeting-calendar-load-status"
      data-load-phase={view.phase}
      aria-label={view.ariaLabel}
      title={view.privacyBoundary}
      className={`mt-3 max-w-3xl border-y px-0 py-2 text-xs ${meetingCalendarLoadToneClass(
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
            className={`inline-flex items-center gap-1 ${meetingCalendarLoadStepClass(
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

function meetingCalendarLoadToneClass(
  tone: MeetingCalendarLoadTone
): string {
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

function meetingCalendarLoadStepClass(
  state: MeetingCalendarLoadStatusView["steps"][number]["state"]
): string {
  if (state === "done") return "text-emerald-600 dark:text-emerald-300";
  if (state === "active") return "text-blue-600 dark:text-blue-300";
  if (state === "warning") return "text-amber-600 dark:text-amber-300";
  return "text-zinc-400 dark:text-zinc-600";
}

function MeetingStatusBar({
  entry,
  size,
}: {
  entry: MeetingEntry;
  size: "compact" | "list";
}) {
  const status = getMeetingStatusIndicator(entry);
  return (
    <span
      aria-label={status.label}
      className={`shrink-0 rounded-full ${size === "compact" ? "h-4 w-1" : "h-7 w-1.5"} ${
        status.className
      }`}
      title={status.label}
    />
  );
}

function needsTraceReview(entry: MeetingEntry) {
  return (
    !entry.dateKey ||
    !entry.time ||
    entry.timeStatus === "待补充" ||
    entry.traceStatus === "导入失败-已留痕" ||
    entry.recordingStatus === "录制失败" ||
    entry.recordingGateStatus === "录制链路未就绪"
  );
}

function isExpiredMeetingTrace(entry: MeetingEntry, todayKey: string) {
  return Boolean(entry.dateKey && entry.dateKey < todayKey);
}

function getMeetingStatusIndicator(entry: MeetingEntry) {
  if (entry.recordingStatus === "录制成功" || entry.traceStatus === "已完成") {
    return {
      label: "已完成录制",
      className: "bg-sky-500 dark:bg-sky-400",
    };
  }

  const hasAccessCredential = Boolean(entry.joinUrl || entry.meetingId);
  const missingRequiredInfo =
    !entry.dateKey ||
    !entry.time ||
    !entry.platform ||
    !hasAccessCredential ||
    entry.timeStatus === "待补充" ||
    entry.traceStatus === "导入失败-已留痕" ||
    entry.recordingStatus === "录制失败" ||
    entry.recordingGateStatus === "录制链路未就绪";

  if (missingRequiredInfo) {
    return {
      label: "信息不全或执行失败",
      className: "bg-red-500 dark:bg-red-400",
    };
  }

  return {
    label: "信息完整，待执行",
    className: "bg-emerald-500 dark:bg-emerald-400",
  };
}

function MeetingHoverCard({ entry }: { entry: MeetingEntry }) {
  return (
    <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-72 rounded-md border border-zinc-200 bg-white p-3 text-left text-xs leading-5 text-zinc-600 shadow-xl group-hover/meeting:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">
        {entry.topic}
      </span>
      <span className="mt-1 block">
        {entry.dateKey || "未设日期"} {entry.time || "未设时间"}
      </span>
      <span className="block">
        {entry.platform || "未设平台"}
        {entry.organizer ? ` · ${entry.organizer}` : ""}
      </span>
      <span className="block">
        录制设备：{entry.recordingDevice || DEFAULT_RECORDING_DEVICE}
      </span>
      <span className="block">
        录制链路：{entry.recordingGateStatus || "未验证"}
      </span>
      <span className="block">
        录制任务：{entry.queueStatus || "未入队"}
      </span>
      <span className="block">
        转写模型：{displayTranscriptionModel(entry.transcriptionModel)}
      </span>
      <span className="mt-1 block text-zinc-400">单击查看详情</span>
    </span>
  );
}

function MeetingDetailWindow({
  entry,
  runNowMessage,
  onClose,
  onPrimeOpen,
  onOpenFull,
  onDelete,
  onStartNow,
}: {
  entry: MeetingEntry;
  runNowMessage: string;
  onClose: () => void;
  onPrimeOpen: () => void;
  onOpenFull: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onStartNow: (entry: MeetingEntry) => Promise<void>;
}) {
  return (
    <aside className="fixed right-6 top-20 z-50 max-h-[calc(100vh-7rem)] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="min-w-0">
          <div className="text-xs text-zinc-400">会议详情</div>
          <h3 className="mt-1 truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {entry.topic}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="关闭会议详情"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 px-4 py-4 text-sm">
        {entry.recordingGateStatus === "录制链路未就绪" && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            录制链路未就绪：会前 5 秒 Audio Hijack proof 没有通过。本次不会静默入会，需先修复录制权限或录音输出。
          </div>
        )}
        {entry.recordingStatus !== "录制成功" &&
          entry.recordingStatus !== "录制中" &&
          entry.recordingGateStatus !== "录制链路未就绪" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              自动录制会通过本地 runner 队列执行。若这条会议显示未入队，可点击“开始录制”立即派单。
            </div>
          )}
        <DetailRow label="日期" value={entry.dateKey || "未设置"} />
        <DetailRow label="时间" value={entry.time || "未设置"} />
        <DetailRow label="平台" value={entry.platform || "未设置"} />
        <DetailRow label="组织者" value={entry.organizer || "未读取"} />
        <DetailRow
          label="转写模型"
          value={displayTranscriptionModel(entry.transcriptionModel)}
        />
        <DetailRow
          label="优先级"
          value={displayMeetingPriority(entry.meetingPriority)}
        />
        <DetailRow label="录制任务" value={entry.queueStatus || "未入队"} />
        {entry.queueError && (
          <DetailRow label="任务错误" value={entry.queueError} multiline />
        )}
        {entry.joinUrl && (
          <DetailRow label="入会链接" value={entry.joinUrl} multiline />
        )}
        {runNowMessage && (
          <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            {runNowMessage}
          </p>
        )}
        <p className="pt-1 text-xs text-zinc-400 dark:text-zinc-500">
          会议号、密码、录制状态等更多信息，点“打开完整页面”查看。
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onStartNow(entry)}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            开始录制
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `删除会议「${entry.topic}」？删除后不会再自动恢复。`
                )
              ) {
                onDelete(entry.page.id);
              }
            }}
            className="rounded-md px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            删除会议
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            关闭
          </button>
          <button
            type="button"
            onPointerEnter={onPrimeOpen}
            onPointerDown={onPrimeOpen}
            onFocus={onPrimeOpen}
            onClick={() => onOpenFull(entry.page.id)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            打开完整页面
          </button>
        </div>
      </div>
    </aside>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div
        className={`text-zinc-700 dark:text-zinc-200 ${
          multiline ? "break-all" : "truncate"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function buildMeetingSummary(entry: MeetingEntry) {
  return [
    entry.topic,
    `${entry.dateKey || "未设日期"} ${entry.time || "未设时间"}`,
    entry.platform || "未设平台",
    entry.organizer ? `组织者：${entry.organizer}` : "",
    entry.meetingId ? `会议号：${entry.meetingId}` : "",
    entry.passcode ? `密码：${entry.passcode}` : "",
    `录制设备：${entry.recordingDevice || DEFAULT_RECORDING_DEVICE}`,
    `转写模型：${displayTranscriptionModel(entry.transcriptionModel)}`,
    `优先级：${displayMeetingPriority(entry.meetingPriority)}`,
    `录制任务：${entry.queueStatus || "未入队"}`,
    entry.traceStatus ? `痕迹：${entry.traceStatus}` : "",
    entry.recordingStatus ? `录制：${entry.recordingStatus}` : "",
    `录制链路：${entry.recordingGateStatus || "未验证"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
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
      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {label}
    </button>
  );
}

function buildInitialMeetingCalendarHydrationKeys(
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
    rowStart + MEETING_CALENDAR_INITIAL_HYDRATED_DAY_LIMIT
  );

  for (let index = rowStart; index < rowEnd; index += 1) {
    initialKeys.add(toDateKey(grid[index].date));
  }

  if (todayIndex >= 0) {
    initialKeys.add(toDateKey(grid[todayIndex].date));
  }

  return initialKeys;
}

function buildOccupiedMeetingCalendarHydrationKeys(
  grid: MonthCell[],
  entriesByDate: Map<string, MeetingEntry[]>,
  countsByDate: Map<string, number>
): string[] {
  const inMonthDateKeys: string[] = [];
  const adjacentMonthDateKeys: string[] = [];

  for (const cell of grid) {
    const dateKey = toDateKey(cell.date);
    const dayCount =
      countsByDate.get(dateKey) ?? entriesByDate.get(dateKey)?.length ?? 0;
    if (dayCount <= 0) continue;
    if (cell.inMonth) {
      inMonthDateKeys.push(dateKey);
    } else {
      adjacentMonthDateKeys.push(dateKey);
    }
  }

  return [...inMonthDateKeys, ...adjacentMonthDateKeys];
}

function scheduleMeetingIdleTask(
  callback: () => void,
  timeout = 500
): () => void {
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

// ── Auto-link completed meetings into 每日纪要 ─────────────────────
// When a meeting reaches "完成" state we append a page-mention link into the
// daily note for that date so the user sees the reference on their calendar.
// Title format: "xxx纪要-组织人-日期" per owner request.

async function linkCompletedMeetingsToDaily(completed: MeetingEntry[]) {
  const dailyRootId = await getModuleRootId("daily");
  const { createPageWithCloud, updatePageWithCloud } =
    await loadPageMutationModule();
  const dateKeys = completed
    .map((entry) => entry.dateKey)
    .filter((dateKey) => DATE_KEY_PATTERN.test(dateKey))
    .sort();
  if (dateKeys.length === 0) return;
  const dailyPages = await listDailyPageMetadataForCalendar({
    rootId: dailyRootId,
    startDate: dateKeys[0],
    endDate: dateKeys[dateKeys.length - 1],
    recentLimit: 0,
  });

  // Index daily pages by date key for fast lookup.
  const dailyByDate = new Map<string, Page>();
  for (const page of dailyPages) {
    const props = parsePageProperties(page.properties);
    const dateVal = props.find((p) => p.name === "日期")?.value?.trim();
    if (dateVal) dailyByDate.set(dateVal, page);
  }

  for (const entry of completed) {
    const dateKey = entry.dateKey;
    if (!dateKey) continue;

    // Build the mention label: "主题纪要-组织者-日期"
    const topicBase = (entry.topic || "会议").replace(/纪要$/, "");
    const label = [
      `${topicBase}纪要`,
      entry.organizer || undefined,
      dateKey,
    ]
      .filter(Boolean)
      .join("-");

    let dailyPage = dailyByDate.get(dateKey);
    let currentDailyBody: string | null = null;

    // Check if this meeting is already linked in the daily page content.
    if (dailyPage) {
      const existing = await getPage(dailyPage.id);
      currentDailyBody = existing?.content_text ?? "";
      if (currentDailyBody.includes(`data-id="${entry.page.id}"`)) continue;
    }

    // Create the daily page for this date if it doesn't exist yet.
    if (!dailyPage) {
      const newPage = await createPageWithCloud({ parentId: dailyRootId });
      const props = [
        { ...createPageProperty("date", "日期"), value: dateKey },
        createPageProperty("text", "要点"),
        createPageProperty("text", "Summary"),
        createPageProperty("tags", "相关公司"),
        createPageProperty("tags", "相关行业"),
      ];
      await updatePageWithCloud(newPage.id, {
        properties: stringifyPageProperties(props),
      });
      dailyPage = { ...newPage, properties: stringifyPageProperties(props) };
      dailyByDate.set(dateKey, dailyPage);
    }

    // Append a mention node to the daily page body.
    const mentionHtml =
      `<p><a data-type="mention" data-id="${entry.page.id}" ` +
      `data-label="${escapeHtml(label)}" ` +
      `href="/page/${entry.page.id}" ` +
      `class="wiki-link inline-flex items-center gap-0.5 px-1 py-0.5 rounded ` +
      `bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-sm ` +
      `font-medium cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 ` +
      `transition-colors no-underline">📄 ${escapeHtml(label)}</a></p>`;

    const current =
      currentDailyBody ?? (await getPage(dailyPage.id))?.content_text ?? "";
    await updatePageWithCloud(dailyPage.id, {
      content_text: current + mentionHtml,
    });
  }
}
