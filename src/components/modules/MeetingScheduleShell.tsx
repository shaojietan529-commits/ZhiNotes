"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import { usePageRevision } from "@/hooks/usePageRevision";
import {
  applyRemotePages,
  applyRemotePageMetadata,
  deletePage,
  getDeletedPages,
  getPage,
  listPageMetadata,
  restorePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import {
  createPageWithCloud,
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import {
  fetchMeetingCloudMetadata,
  pageToRemoteRecord,
  pushCloudPages,
  queueCloudPagePush,
  syncCloudPageMetadataDelta,
  type MeetingCloudMetadataResult,
} from "@/lib/pages/accountPageSync";
import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import { rememberPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
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
  writeMeetingHotCacheSnapshot,
} from "@/lib/sync/meetingHotCacheSnapshot";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import PageContextMenu from "@/components/page/PageContextMenu";
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
const MEETING_CALENDAR_EXPAND_BATCH = 24;

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
  status?: MeetingCloudMetadataResult["status"];
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

interface MeetingCloudMetadataOptions {
  startDate?: string;
  endDate?: string;
  recentLimit?: number;
}

const MEETING_CLOUD_CACHE_PREFIX = "zhinote.zhihui.cloudMetadata.";

export default function MeetingScheduleShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const { refresh } = usePages({ autoLoad: false });
  const pageRevision = usePageRevision();
  const [rootId, setRootId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Page[]>([]);
  const [creatingMeetingDateKey, setCreatingMeetingDateKey] = useState<
    string | null
  >(null);
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
  const initialCloudPullAttemptedRef = useRef(false);
  const calendarCellRefs = useRef(new Map<string, HTMLDivElement>());
  const highlightTimerRef = useRef<number | null>(null);
  const metadataWarmupScheduledRef = useRef(false);
  const loadRequestRef = useRef(0);
  const meetingsRef = useRef<Page[]>([]);
  const observedPageRevisionRef = useRef<string | null>(null);

  useEffect(() => {
    meetingsRef.current = meetings;
  }, [meetings]);

  useEffect(() => {
    try {
      router.prefetch("/page/zhinote-route-prefetch");
    } catch {
      // Best-effort route warmup; meeting creation still works without it.
    }
  }, [router]);

  const scheduleMetadataCacheWarmup = useCallback(() => {
    if (metadataWarmupScheduledRef.current) return;
    metadataWarmupScheduledRef.current = true;
    const run = () => {
      void syncCloudPageMetadataDelta().catch(() => undefined);
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

      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setHighlightedDateKey(dateKey);

      window.setTimeout(() => {
        calendarCellRefs.current.get(dateKey)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);

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
    [setViewMonth]
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

  const load = useCallback(async (opts?: { includeCloud?: boolean }) => {
    const includeCloud = opts?.includeCloud !== false;
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const visibleRange = buildMonthGrid(viewMonth);
    const startDate = toDateKey(visibleRange[0].date);
    const endDate = toDateKey(visibleRange[visibleRange.length - 1].date);
    let localPagesForMerge: Page[] = [];
    const cachedHotSnapshot = readMeetingHotCacheSnapshot(startDate, endDate);

    const publishRootId = (nextRootId: string | null) => {
      if (loadRequestRef.current !== requestId) return;
      setRootId(nextRootId);
    };

    const publishMeetings = (localPages: Page[], cloudPages: Page[] = []) => {
      if (loadRequestRef.current !== requestId) return;
      const localPageIds = new Set(localPages.map((page) => page.id));
      const retainedCloudPages = includeCloud
        ? []
        : meetingsRef.current.filter(
            (page) =>
              !localPageIds.has(page.id) &&
              !deletedTombstoneRef.current.has(page.id)
          );
      setMeetings(
        mergeMeetingPages(
          localPages,
          [...retainedCloudPages, ...cloudPages],
          deletedTombstoneRef.current
        )
      );
    };

    if (cachedHotSnapshot) {
      publishRootId(cachedHotSnapshot.root_id);
      publishMeetings(
        [],
        cachedHotSnapshot.pages.map(meetingHotCacheSnapshotPageToPage)
      );
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
      publishMeetings([], cachedCloud.pages);
      void persistMeetingCloudMetadata(cachedCloud, upsertPages);
    }

    const cloudPromise = includeCloud
      ? loadMeetingCloudMetadata({
          startDate,
          endDate,
          recentLimit: 12,
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
      localPagesForMerge = await listPageMetadata(id);
      publishMeetings(
        localPagesForMerge,
        cachedCloud?.ok ? cachedCloud.pages : []
      );
      writeMeetingHotCacheSnapshot({
        startDate,
        endDate,
        rootId: id,
        pages: mergeMeetingPages(
          localPagesForMerge,
          cachedCloud?.ok ? cachedCloud.pages : [],
          deletedTombstoneRef.current
        ),
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

    if (!cloudPromise) return;
    const cloud = await cloudPromise;
    if (cloud.ok && cloud.rootId) {
      publishRootId(cloud.rootId);
      publishMeetings(localPagesForMerge, cloud.pages);
      writeCachedMeetingCloudMetadata(startDate, endDate, cloud);
      writeMeetingHotCacheSnapshot({
        startDate,
        endDate,
        rootId: cloud.rootId,
        pages: mergeMeetingPages(
          localPagesForMerge,
          cloud.pages,
          deletedTombstoneRef.current
        ),
        source: "cloud-metadata",
      });
      void persistMeetingCloudMetadata(cloud, upsertPages);
    }

  }, [
    deletionTombstonesLoaded,
    deletedTombstoneRef,
    scheduleMetadataCacheWarmup,
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
      await load({ includeCloud: false });
    },
    [addTombstone, load]
  );

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
    return entries
      .filter((entry) => entry.dateKey && entry.dateKey >= todayKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(0, 8);
  }, [entries]);

  const markSeen = useCallback((id: string) => {
    markMeetingSeen(id);
  }, [markMeetingSeen]);

  // 会议纪要 only lists meetings that are actually done: the recording
  // succeeded or the meeting is marked 已完成 (which is when the note/纪要 has
  // been produced). Pending/upcoming meetings stay out of this list — they
  // live on the calendar and in 今日会议 until they finish.
  const meetingNotes = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            !e.page.deleted_at &&
            (e.recordingStatus === "录制成功" || e.traceStatus === "已完成")
        )
        .sort((a, b) =>
          (b.page.updated_at || "").localeCompare(a.page.updated_at || "")
        )
        .slice(0, 20),
    [entries]
  );

  // Auto-link completed meeting notes into the corresponding 每日纪要 page.
  useEffect(() => {
    if (!meetingNotes.length) return;
    void linkCompletedMeetingsToDaily(meetingNotes);
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

  const createMeetingPage = useCallback(
    async (
      draft: MeetingFormState,
      options: CreateMeetingOptions = {}
    ): Promise<CreateMeetingResult> => {
      if (!rootId) {
        throw new Error("会议模块还在加载，请等页面完成加载后再导入。");
      }
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
        parentId: rootId,
        title,
        icon: "🗓️",
        contentText,
        properties: stringifyPageProperties(props),
        position: Date.now(),
        depth: 1,
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
      rememberPendingPageDraft(optimisticPage);
      rememberPageRouteHandoff(optimisticPage, "meeting-create");
      void seedMeetingPageForImmediateOpen(optimisticPage);

      void (async () => {
        let finalPage = optimisticPage;
        try {
          const latestPage = await getLatestOpenedMeetingPage(optimisticPage);
          finalPage = {
            ...latestPage,
            parent_id: rootId,
            depth: 1,
            updated_at:
              latestPage.parent_id === rootId
                ? latestPage.updated_at
                : new Date().toISOString(),
          };
          upsertMeetingInView(finalPage);
          upsertPages([finalPage]);
          rememberPendingPageDraft(finalPage);
          rememberPageRouteHandoff(finalPage, "meeting-create");
          await persistOptimisticMeetingPage(rootId, finalPage, upsertPages);

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
            await persistOptimisticMeetingPage(rootId, finalPage, upsertPages);
          }

          await load({ includeCloud: false });
        } catch (error) {
          console.warn("Meeting background persistence failed", error);
          queueCloudPagePush(pageToRemoteRecord(finalPage));
        } finally {
          void refresh().catch(() => undefined);
        }
      })();

      return { page: optimisticPage, queueResult };
    },
    [rootId, upsertMeetingInView, upsertPages, refresh, load]
  );

  const handleCreate = useCallback(async () => {
    if (creatingMeetingDateKey !== null) return;
    const targetDateKey = form.date || toDateKey(new Date());
    setCreatingMeetingDateKey(targetDateKey);
    setIntakeError("");
    setIntakeMessage("正在创建会议页面，后台会继续保存到账号云端…");
    try {
      const result = await createMeetingPage(form, {
        importSource: "手动创建",
      });
      const pageRoute = `/page/${result.page.id}`;
      try {
        router.prefetch(pageRoute);
      } catch {
        // Navigation is still immediate enough if prefetch is unavailable.
      }
      setFormOpen(false);
      focusCalendarDate(targetDateKey);
      setIntakeMessage(
        `${formatImportDateMessage(targetDateKey)}会议页面正在打开，后台会继续保存到账号云端。${
          result.cloudOnly ? "本地缓存暂不可写，已先保存在账号云端。" : ""
        }`
      );
      router.push(pageRoute);
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
    router,
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

      const result = await createMeetingPage(draft, {
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
          ? `${formatImportDateMessage(draft.date)}${result?.cloudOnly ? " Edge 本地数据库写入失败，已改存到账号云端。" : ""} 入会链接、会议号和会议密码已保存到会议页面。${formatQueueResultForMessage(
              result?.queueResult
            )}`
          : "已保留会议痕迹，但还缺明确开始时间；请稍后打开会议页补齐。"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取会议信息失败。";
      const fallback = buildFallbackTraceFromInput(input, form.date || toDateKey(new Date()));
      try {
        await createMeetingPage(fallback.draft, {
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
        setIntakeError(`解析失败但已保留痕迹：${message}`);
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
          const updatedPage = await updatePageWithCloud(entry.page.id, {
            properties: stringifyPageProperties(props),
          });
          if (rootId && updatedPage) {
            await pushMeetingPageCloudSnapshot(rootId, updatedPage);
          }
          fixed++;
        }
      } catch {
        // skip individual failures
      }
    }
    await refresh();
    await load({ includeCloud: false });
    setRetryLoading(false);
    setRetryResult(
      fixed > 0
        ? `已重新识别 ${fixed} 条会议`
        : "没有新的信息可以补充"
    );
  }, [entries, refresh, load, rootId, todayKey]);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
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
      const updatedPage = await updatePageWithCloud(entry.page.id, {
        properties: stringifyPageProperties(props),
      });
      if (rootId && updatedPage) {
        await pushMeetingPageCloudSnapshot(rootId, updatedPage);
        setSelectedMeeting(toMeetingEntry(updatedPage));
      }
      await refresh();
      await load({ includeCloud: false });
      setRunNowMessage(queueResult.message);
    },
    [load, refresh, rootId]
  );

  const primeMeetingPageOpen = useCallback(
    (page: Page, source: "meeting-create" | "meeting-open" = "meeting-open") => {
      upsertPages([page]);
      rememberPendingPageDraft(page);
      rememberPageRouteHandoff(page, source);
      try {
        router.prefetch(`/page/${page.id}`);
      } catch {
        // Prefetch is a speed hint. The handoff and pending draft already cover
        // the first paint when the browser cache or cloud is slow.
      }
    },
    [router, upsertPages]
  );

  const openMeetingFullPage = useCallback(
    (page: Page, source: "meeting-create" | "meeting-open" = "meeting-open") => {
      primeMeetingPageOpen(page, source);
      router.push(`/page/${page.id}`);
    },
    [primeMeetingPageOpen, router]
  );

  const openMeetingFullPageById = useCallback(
    (pageId: string) => {
      const page =
        meetings.find((item) => item.id === pageId) ??
        (selectedMeeting?.page.id === pageId ? selectedMeeting.page : null) ??
        useWorkspaceStore.getState().pages.find((item) => item.id === pageId) ??
        null;
      if (page) {
        openMeetingFullPage(page, "meeting-open");
        return;
      }
      router.push(`/page/${pageId}`);
    },
    [meetings, openMeetingFullPage, router, selectedMeeting]
  );

  const quickCreateMeetingForDate = useCallback(
    async (dateKey: string) => {
      if (creatingMeetingDateKey !== null) return;
      setCreatingMeetingDateKey(dateKey);
      setIntakeError("");
      setIntakeMessage(`${dateKey} 的会议页面正在打开，后台会继续保存到账号云端…`);
      try {
        const result = await createMeetingPage(
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
        setIntakeMessage(`${dateKey} 的会议页面已先加入日历，正在打开…`);
        openMeetingFullPage(result.page, "meeting-create");
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
      openMeetingFullPage,
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
            </div>
            <button
              type="button"
              disabled={creatingMeetingDateKey !== null}
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
                  onClick={() => void handleImportInvite()}
                  disabled={intakeLoading || !rootId || !intakeText.trim()}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                >
                  {intakeLoading ? "读取中..." : rootId ? "导入" : "加载中..."}
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
                        onClick={() => setSelectedMeeting(entry)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            pageId: entry.page.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
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
                          onClick={() => setSelectedMeeting(entry)}
                          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1 text-left"
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
                      <Link
                        href={`/page/${entry.page.id}`}
                        onClick={() => {
                          markSeen(entry.page.id);
                          primeMeetingPageOpen(entry.page, "meeting-open");
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
                      </Link>
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
              const hiddenCount = Math.max(
                0,
                dayMeetings.length - visibleMeetings.length
              );
              const nextBatchCount = Math.min(
                MEETING_CALENDAR_EXPAND_BATCH,
                hiddenCount
              );
              const isToday = key === todayKey;
              const isHighlighted = key === highlightedDateKey;
              return (
                <div
                  key={key}
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
                      onClick={() => void quickCreateMeetingForDate(key)}
                      className="text-zinc-300 opacity-0 transition-opacity hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 group-hover:opacity-100 dark:hover:text-zinc-200"
                      title="在这天加会议"
                    >
                      {creatingMeetingDateKey === key ? "…" : "+"}
                    </button>
                  </div>
                  <div className="mt-0.5 flex flex-col gap-0.5 overflow-visible">
                    {visibleMeetings.map((entry) => (
                      <button
                        key={entry.page.id}
                        type="button"
                        data-testid={`meeting-calendar-entry-${entry.page.id}`}
                        onClick={() => setSelectedMeeting(entry)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            pageId: entry.page.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className="group/meeting relative rounded bg-blue-50 px-1.5 py-0.5 text-left text-xs text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                        title={buildMeetingSummary(entry)}
                      >
                        <span className="flex min-w-0 items-center gap-1">
                          <MeetingStatusBar entry={entry} size="compact" />
                          <span className="block min-w-0 truncate">
                            {entry.time ? `${entry.time} ` : ""}
                            {entry.topic}
                          </span>
                        </span>
                        <MeetingHoverCard entry={entry} />
                      </button>
                    ))}
                    {dayMeetings.length > MEETING_CALENDAR_VISIBLE_LIMIT && (
                      <button
                        type="button"
                        onClick={() => {
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
                        className="rounded bg-zinc-50 px-1.5 py-0.5 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        {isExpanded
                          ? hiddenCount > 0
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
                      onClick={() => setSelectedMeeting(entry)}
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
          onOpenFull={openMeetingFullPageById}
          onDelete={(id) => void handleDeleteMeeting(id)}
          onStartNow={handleStartRecordingNow}
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
    if (!cachedAt || Date.now() - cachedAt > 24 * 60 * 60 * 1000) return null;
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
    window.localStorage.setItem(
      meetingCloudCacheKey(startDate, endDate),
      JSON.stringify({ ...cloud, cachedAt: new Date().toISOString() })
    );
  } catch {
    // Local cache is best-effort; the cloud result is already displayed.
  }
}

async function persistMeetingCloudMetadata(
  cloud: MeetingCloudMetadataSnapshot,
  upsertPages: (pages: Page[]) => void
): Promise<void> {
  if (!cloud.ok || !cloud.rootId) return;
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

async function seedMeetingPageForImmediateOpen(page: Page): Promise<void> {
  try {
    await applyRemotePages([pageToRemoteRecord(page)]);
  } catch {
    // The in-memory store and pending draft already let the page open. Local
    // cache persistence can be retried by the pending upload path.
  }
}

async function getLatestOpenedMeetingPage(page: Page): Promise<Page> {
  const memoryPage = useWorkspaceStore
    .getState()
    .pages.find((item) => item.id === page.id);
  if (memoryPage) return { ...page, ...memoryPage };

  const localPage = await getPage(page.id).catch(() => null);
  if (localPage) return { ...page, ...localPage };

  return page;
}

async function persistOptimisticMeetingPage(
  rootId: string,
  page: Page,
  upsertPages: (pages: Page[]) => void
): Promise<"cloud" | "local-only"> {
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

  const result = await pushCloudPages(records);
  if (result.status === "ok") return "cloud";
  if (
    result.status === "disabled" ||
    result.status === "unauthenticated" ||
    result.status === "unconfigured"
  ) {
    return "local-only";
  }
  throw new Error(result.message || "云端保存失败。");
}

async function makeMeetingRootRecord(
  rootId: string,
  updatedAt: string
): Promise<RemotePageRecord> {
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
  onOpenFull,
  onDelete,
  onStartNow,
}: {
  entry: MeetingEntry;
  runNowMessage: string;
  onClose: () => void;
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
  const dailyPages = await listPageMetadata(dailyRootId);

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
