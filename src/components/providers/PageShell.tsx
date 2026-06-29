"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/sidebar/Sidebar";
import type { EditorRef } from "@/components/editor/Editor";
import Breadcrumb from "@/components/shared/Breadcrumb";
import type { IconPickerProps } from "@/components/shared/IconPicker";
import type { BlockCommentsProps } from "@/components/shared/BlockComments";
import {
  BLOCK_COMMENTS_CHANGED_EVENT,
  INLINE_COMMENT_SELECTED_EVENT,
} from "@/components/shared/blockCommentEvents";
import type { PagePropertiesProps } from "@/components/page/PageProperties";
import type { PageActionsMenuProps } from "@/components/page/PageActionsMenu";
import PageRouteSkeleton from "@/components/page/PageRouteSkeleton";
import {
  getPagePropertyTypeIcon,
  parsePageProperties,
  parseTagsValue,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import {
  readPageRouteHandoff,
  readPageRouteHandoffSource,
  type PageRouteHandoffSource,
} from "@/lib/pages/pageRouteHandoff";
import { readPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import {
  buildPageCloudSaveStatus,
  type PageCloudSaveStatusView,
  type PageCloudSaveStatusTone,
} from "@/lib/pages/pageCloudSaveStatus";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { usePage } from "@/hooks/usePage";
import { useVersions } from "@/hooks/useVersions";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRouter } from "next/navigation";
import {
  updateWikiLinks,
  getNextPosition,
  getBlockCommentCount,
  getPageVersionCount,
} from "@/lib/db/local/queries";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type { Page, PageVersion } from "@/lib/utils/types";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import { usePageViewPreferences } from "@/hooks/usePageViewPreferences";
import {
  PAGE_LOCAL_COMMAND_EVENT,
  type PageLocalCommand,
} from "@/lib/pageLocalCommands";
import {
  type PageResearchStructureAction,
  type PageResearchStructureGate,
  type PageResearchStructureReport,
  type PageResearchStructureSignal,
  type PageResearchStructureStatus,
} from "@/lib/pages/pageResearchStructure";
import {
  describePageBodyHydrationStatus,
  getPageBodyHydrationStatus,
  subscribePageBodyHydrationStatus,
  type PageBodyHydrationPhase,
} from "@/lib/pages/pageBodyHydrationStatus";
import {
  getLocalPerformanceNow,
  recordLocalPerformanceSnapshot,
  type LocalPerformanceKind,
} from "@/lib/performance/localPerformance";

const loadEditorModule = () => import("@/components/editor/Editor");
const loadPageMutationModule = () =>
  import("@/lib/pages/cloudPageMutations");
const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");
const loadPageVersioningModule = () => import("@/lib/comparison/versioning");
const loadPageExportModule = () => import("@/lib/export/pageExport");
const loadPageResearchStructureModule = () =>
  import("@/lib/pages/pageResearchStructure");
const loadPageSnapshotUpdatesModule = () =>
  import("@/lib/pages/pageSnapshotUpdates");
const PAGE_SYNC_CONFIG_EVENT = "zhinote:pagesync-config";
const PAGE_SYNC_STATUS_EVENT = "zhinote:pagesync-status";
const PAGE_EDITOR_IDLE_TIMEOUT_MS = 120;
const PAGE_METADATA_ONLY_EDITOR_DELAY_MS = 420;
const PAGE_METADATA_ONLY_EDITOR_IDLE_TIMEOUT_MS = 900;
const PAGE_LARGE_BODY_HTML_CHARS = 180 * 1024;
const PAGE_LARGE_BODY_EDITOR_DELAY_MS = 260;
const PAGE_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS = 1600;
const PAGE_LARGE_BODY_PREVIEW_HTML_CHARS = 120 * 1024;
const PAGE_LARGE_BODY_PREVIEW_TEXT_CHARS = 6000;
const PAGE_LARGE_BODY_PREVIEW_BLOCKS = 18;
const PAGE_LARGE_BODY_PREVIEW_HEADINGS = 8;
const PAGE_LARGE_BODY_PREVIEW_IDLE_TIMEOUT_MS = 1200;
const PAGE_LARGE_BODY_EDITOR_WARMUP_DELAY_MS = 4800;
const PAGE_LARGE_BODY_EDITOR_WARMUP_IDLE_TIMEOUT_MS = 2600;
const PAGE_COMMENTS_IDLE_TIMEOUT_MS = 700;
const PAGE_CHILD_TREE_IDLE_TIMEOUT_MS = 1200;
const PAGE_REFERENCES_IDLE_TIMEOUT_MS = 1800;
const PAGE_VERSION_COUNT_IDLE_TIMEOUT_MS = 1100;
const PAGE_LARGE_BODY_COMMENTS_IDLE_TIMEOUT_MS = 2200;
const PAGE_LARGE_BODY_CHILD_TREE_IDLE_TIMEOUT_MS = 3000;
const PAGE_LARGE_BODY_REFERENCES_IDLE_TIMEOUT_MS = 3800;
const PAGE_COVER_IMAGE_IDLE_TIMEOUT_MS = 580;
const PAGE_PROPERTIES_EDITOR_IDLE_TIMEOUT_MS = 520;
const PAGE_HEADER_ICON_PICKER_IDLE_TIMEOUT_MS = 650;
const PAGE_ACTIONS_MENU_IDLE_TIMEOUT_MS = 900;
const PAGE_EDITOR_SIDE_EFFECT_DEBOUNCE_MS = 1500;
const PAGE_TITLE_SAVE_DEBOUNCE_MS = 420;
const PAGE_SYNC_STATUS_PENDING_REFRESH_MS = 5000;
const PAGE_SYNC_STATUS_IDLE_REFRESH_MS = 30 * 1000;
const PAGE_SYNC_STATUS_FIRST_REFRESH_DELAY_MS = 900;
const PAGE_SYNC_STATUS_FIRST_REFRESH_IDLE_TIMEOUT_MS = 2500;
const PAGE_BODY_HYDRATION_PERFORMANCE_THRESHOLD_MS = 500;
const EMPTY_PAGE_SYNC_STATUS: PendingCloudPageSyncStatus = {
  enabled: true,
  pending: 0,
  queued: 0,
  failed: 0,
  failureCountTotal: 0,
  maxFailureCount: 0,
  manualReviewCount: 0,
  manualReviewFailureThreshold: 3,
  manualReviewSampleIds: [],
  oldestPendingQueuedAt: null,
  lastAttemptAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
  pendingSampleIds: [],
  failedSampleIds: [],
  authRetryStatus: null,
  authRetryUntil: null,
  lastSyncAt: null,
};

const Editor = dynamic(loadEditorModule, {
  ssr: false,
  loading: () => <PageBodySkeleton />,
});
const IconPicker = dynamic<IconPickerProps>(
  () => import("@/components/shared/IconPicker"),
  {
    ssr: false,
    loading: () => <PageIconPickerSkeleton />,
  }
);
const PageProperties = dynamic<PagePropertiesProps>(
  () => import("@/components/page/PageProperties"),
  {
    ssr: false,
    loading: () => <PagePropertiesSkeleton />,
  }
);
const PageActionsMenu = dynamic<PageActionsMenuProps>(
  () => import("@/components/page/PageActionsMenu"),
  {
    ssr: false,
    loading: () => <PageActionsMenuSkeleton />,
  }
);
const BlockComments = dynamic<BlockCommentsProps>(
  () => import("@/components/shared/BlockComments"),
  {
    ssr: false,
    loading: () => null,
  }
);
const Backlinks = dynamic(() => import("@/components/shared/Backlinks"), {
  ssr: false,
});
const PageComments = dynamic(
  () => import("@/components/shared/PageComments"),
  { ssr: false }
);
const CommentSidePanel = dynamic(
  () => import("@/components/shared/CommentSidePanel"),
  { ssr: false }
);
const ChildPageTree = dynamic(() => import("@/components/page/ChildPageTree"), {
  ssr: false,
});
const MoveToDialog = dynamic(() => import("@/components/page/MoveToDialog"), {
  ssr: false,
});
const VersionHistoryPanel = dynamic(
  () => import("@/components/comparison/VersionHistoryPanel"),
  { ssr: false }
);

export default function PageShell({ pageId }: { pageId: string }) {
  return <PageContent pageId={pageId} />;
}

function PageContent({ pageId }: { pageId: string }) {
  const router = useRouter();
  const openPage = useLocalFirstPageNavigation();
  const editorRef = useRef<EditorRef>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const copyNoticeTimeoutRef = useRef<number | null>(null);
  const titleSaveTimerRef = useRef<number | null>(null);
  const pendingTitleRef = useRef<string | null>(null);
  const { page, loading, update, remove } = usePage(pageId);
  const pageUpdateRef = useRef(update);
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const setCurrentPageId = useWorkspaceStore((s) => s.setCurrentPageId);
  const [title, setTitle] = useState(
    () => readPageShellEditableHeaderSeed(pageId).title
  );
  const [properties, setProperties] = useState<PageProperty[]>(
    () => readPageShellEditableHeaderSeed(pageId).properties
  );
  const [showHistory, setShowHistory] = useState(false);
  const { isFavorite, toggleFavorite } = usePageFavorites();
  const {
    locked,
    widePage,
    commentsPanelOpen: showComments,
    setCommentsPanelOpen,
    toggleLock,
    toggleWidePage,
    toggleCommentsPanelOpen,
  } = usePageViewPreferences(pageId);
  const favorite = isFavorite(pageId);
  const [showInfo, setShowInfo] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [pageStructure, setPageStructure] =
    useState<PageResearchStructureReport | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const pageClipboard = useWorkspaceStore((s) => s.pageClipboard);
  const setPageClipboard = useWorkspaceStore((s) => s.setPageClipboard);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [exportingPageStructure, setExportingPageStructure] = useState(false);
  const [applyingResearchActionId, setApplyingResearchActionId] =
    useState<string | null>(null);
  const [pageSyncStatus, setPageSyncStatus] =
    useState<PendingCloudPageSyncStatus>(EMPTY_PAGE_SYNC_STATUS);
  const [currentPagePendingSync, setCurrentPagePendingSync] = useState(false);
  const [bodyHydrationStatus, setBodyHydrationStatus] = useState(() =>
    getPageBodyHydrationStatus(pageId)
  );
  const [versionCount, setVersionCount] = useState(0);
  const shouldLoadVersions = showHistory;
  const {
    versions,
    loading: versionsLoading,
    refresh: refreshVersions,
  } = useVersions(pageId, {
    enabled: shouldLoadVersions,
  });
  const versionCountForDisplay = Math.max(versionCount, versions.length);
  const [editorMounted, setEditorMounted] = useState(false);
  const [largeBodyEditorRequested, setLargeBodyEditorRequested] =
    useState(false);
  const [coverImageMountedPageId, setCoverImageMountedPageId] = useState<
    string | null
  >(null);
  const [pagePropertiesMounted, setPagePropertiesMounted] = useState(false);
  const [iconPickerMounted, setIconPickerMounted] = useState(false);
  const [iconPickerInitialOpen, setIconPickerInitialOpen] = useState(false);
  const [actionsMenuMounted, setActionsMenuMounted] = useState(false);
  const [actionsMenuInitialOpen, setActionsMenuInitialOpen] = useState(false);
  const [pageCommentsMounted, setPageCommentsMounted] = useState(false);
  const [childTreeMounted, setChildTreeMounted] = useState(false);
  const [pageReferencesMounted, setPageReferencesMounted] = useState(false);
  const hasPage = Boolean(page);
  const hasContentForEditor = page?.content_text != null;
  const isOptimisticPageDraft = page?.content_text === "";
  const pageBodyHtmlLength = page?.content_text?.length ?? 0;
  const hasLargeBodyForEditor = isLargePageBodyForEditor(page?.content_text);
  const pageRelationshipSurfacesReady =
    editorMounted || (hasContentForEditor && hasLargeBodyForEditor);
  const coverImageMounted = coverImageMountedPageId === pageId;
  const largeBodyPreviewMode =
    hasLargeBodyForEditor && !editorMounted && !largeBodyEditorRequested;
  const pageCommentsMountTimeout = showComments
    ? PAGE_EDITOR_IDLE_TIMEOUT_MS
    : largeBodyPreviewMode
      ? PAGE_LARGE_BODY_COMMENTS_IDLE_TIMEOUT_MS
      : PAGE_COMMENTS_IDLE_TIMEOUT_MS;
  const childTreeMountTimeout = largeBodyPreviewMode
    ? PAGE_LARGE_BODY_CHILD_TREE_IDLE_TIMEOUT_MS
    : PAGE_CHILD_TREE_IDLE_TIMEOUT_MS;
  const pageReferencesMountTimeout = largeBodyPreviewMode
    ? PAGE_LARGE_BODY_REFERENCES_IDLE_TIMEOUT_MS
    : PAGE_REFERENCES_IDLE_TIMEOUT_MS;
  const mountedEditorPageIdRef = useRef<string | null>(null);
  const pageOpenStartedAtRef = useRef(getLocalPerformanceNow());
  const pageOpenStartedAtIsoRef = useRef(new Date().toISOString());
  const reportedPageOpenRef = useRef<string | null>(null);
  const bodyHydrationPerformanceRef = useRef<{
    pageId: string;
    startedAt: number;
    startedAtIso: string;
    sawMetadataReady: boolean;
    sawLocalRequest: boolean;
    sawCloudRequest: boolean;
    reportedKeys: Set<string>;
  } | null>(null);
  const pageOpenSourcePageIdRef = useRef<string | null>(null);
  const pageOpenSourceRef = useRef<PageRouteHandoffSource | null>(null);
  if (pageOpenSourcePageIdRef.current !== pageId) {
    pageOpenSourcePageIdRef.current = pageId;
    pageOpenSourceRef.current = readPageRouteHandoffSource(pageId);
  }
  const editorSideEffectTimerRef = useRef<number | null>(null);
  const editorSideEffectRunningRef = useRef(false);
  const pendingEditorSideEffectsRef = useRef<{
    html: string;
    linkedPageIds: string[];
    title: string;
  } | null>(null);
  const editorContentPersistRunningRef = useRef(false);
  const pendingEditorContentPersistRef = useRef<{
    html: string;
    linkedPageIds: string[];
    title: string;
  } | null>(null);

  useEffect(() => {
    pageUpdateRef.current = update;
  }, [update]);

  useEffect(() => {
    setCurrentPageId(pageId);
    return () => setCurrentPageId(null);
  }, [pageId, setCurrentPageId]);

  useEffect(() => {
    pageOpenStartedAtRef.current = getLocalPerformanceNow();
    pageOpenStartedAtIsoRef.current = new Date().toISOString();
    reportedPageOpenRef.current = null;
    bodyHydrationPerformanceRef.current = null;
    setLargeBodyEditorRequested(false);
    setCoverImageMountedPageId(null);
    setPagePropertiesMounted(false);
    setIconPickerMounted(false);
    setIconPickerInitialOpen(false);
    setActionsMenuMounted(false);
    setActionsMenuInitialOpen(false);
  }, [pageId]);

  useEffect(() => {
    setPageSyncStatus(EMPTY_PAGE_SYNC_STATUS);
    setCurrentPagePendingSync(false);
  }, [pageId]);

  useEffect(() => {
    if (!hasPage) return;
    let timer: number | null = null;
    let cancelled = false;
    let cancelInitialRefresh: () => void = () => undefined;
    const refreshStatus = async (event?: Event) => {
      const next = (event as CustomEvent<PendingCloudPageSyncStatus> | undefined)
        ?.detail;
      const { getPendingCloudPageSyncStatus, isCloudPagePendingSync } =
        await loadPageAccountSyncModule();
      if (cancelled) return null;
      const status = next ?? getPendingCloudPageSyncStatus();
      setPageSyncStatus(status);
      const pagePending = isCloudPagePendingSync(pageId);
      setCurrentPagePendingSync(pagePending);
      return { status, pagePending };
    };
    const scheduleStatusRefresh = (snapshot: {
      status: PendingCloudPageSyncStatus;
      pagePending: boolean;
    }) => {
      if (timer !== null) window.clearTimeout(timer);
      const totalPending = snapshot.status.pending + snapshot.status.queued;
      const delay =
        snapshot.pagePending || totalPending > 0
          ? PAGE_SYNC_STATUS_PENDING_REFRESH_MS
          : PAGE_SYNC_STATUS_IDLE_REFRESH_MS;
      timer = window.setTimeout(() => {
        timer = null;
        if (document.visibilityState !== "visible") {
          scheduleStatusRefresh(snapshot);
          return;
        }
        handleStatusRefresh();
      }, delay);
    };
    const handleStatusRefresh = (event?: Event) => {
      cancelInitialRefresh();
      cancelInitialRefresh = () => undefined;
      void refreshStatus(event)
        .then((snapshot) => {
          if (snapshot && !cancelled) scheduleStatusRefresh(snapshot);
        })
        .catch(() => {
          if (!cancelled) {
            scheduleStatusRefresh({
              status: EMPTY_PAGE_SYNC_STATUS,
              pagePending: false,
            });
          }
        });
    };
    const handleVisibleRefresh = () => {
      if (document.visibilityState === "visible") {
        handleStatusRefresh();
      }
    };
    cancelInitialRefresh =
      schedulePageSyncStatusInitialRefresh(handleStatusRefresh);
    window.addEventListener(PAGE_SYNC_STATUS_EVENT, handleStatusRefresh);
    window.addEventListener(PAGE_SYNC_CONFIG_EVENT, handleStatusRefresh);
    window.addEventListener("storage", handleStatusRefresh);
    document.addEventListener("visibilitychange", handleVisibleRefresh);
    return () => {
      window.removeEventListener(PAGE_SYNC_STATUS_EVENT, handleStatusRefresh);
      window.removeEventListener(PAGE_SYNC_CONFIG_EVENT, handleStatusRefresh);
      window.removeEventListener("storage", handleStatusRefresh);
      document.removeEventListener("visibilitychange", handleVisibleRefresh);
      cancelled = true;
      cancelInitialRefresh();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [hasPage, pageId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setBodyHydrationStatus(getPageBodyHydrationStatus(pageId));
      }
    });
    const unsubscribe = subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pageId]);

  useEffect(() => {
    if (!page || !bodyHydrationStatus?.phase) return;
    let tracker = bodyHydrationPerformanceRef.current;
    if (!tracker || tracker.pageId !== pageId) {
      tracker = {
        pageId,
        startedAt: pageOpenStartedAtRef.current,
        startedAtIso: pageOpenStartedAtIsoRef.current,
        sawMetadataReady: false,
        sawLocalRequest: false,
        sawCloudRequest: false,
        reportedKeys: new Set<string>(),
      };
      bodyHydrationPerformanceRef.current = tracker;
    }

    if (bodyHydrationStatus.phase === "metadata-ready") {
      tracker.sawMetadataReady = true;
    }
    if (bodyHydrationStatus.phase === "local-body-requested") {
      tracker.sawLocalRequest = true;
    }
    if (
      bodyHydrationStatus.phase === "cloud-body-requested" ||
      bodyHydrationStatus.phase === "cloud-body-ready"
    ) {
      tracker.sawCloudRequest = true;
    }
    if (!isTerminalPageBodyHydrationPhase(bodyHydrationStatus.phase)) return;

    const reportKey = `${bodyHydrationStatus.phase}:${bodyHydrationStatus.updated_at}`;
    if (tracker.reportedKeys.has(reportKey)) return;
    tracker.reportedKeys.add(reportKey);

    const durationMs = getLocalPerformanceNow() - tracker.startedAt;
    const shouldRecord =
      bodyHydrationStatus.phase === "unavailable" ||
      tracker.sawCloudRequest ||
      durationMs >= PAGE_BODY_HYDRATION_PERFORMANCE_THRESHOLD_MS;
    if (!shouldRecord) return;

    recordLocalPerformanceSnapshot({
      kind: "page-body-hydration",
      label: "页面正文补齐",
      route: "/page/[pageId]",
      status: bodyHydrationStatus.phase,
      startedAt: tracker.startedAtIso,
      durationMs,
      localFirstMs:
        bodyHydrationStatus.phase === "local-body-ready" ? durationMs : null,
      backgroundMs: tracker.sawCloudRequest ? durationMs : null,
      counts: {
        metadata_ready_seen: tracker.sawMetadataReady ? 1 : 0,
        local_body_requested: tracker.sawLocalRequest ? 1 : 0,
        cloud_body_requested: tracker.sawCloudRequest ? 1 : 0,
        metadata_only: page.content_text == null ? 1 : 0,
        body_html_chars: pageBodyHtmlLength,
        large_body: hasLargeBodyForEditor ? 1 : 0,
      },
    });
  }, [
    bodyHydrationStatus,
    hasLargeBodyForEditor,
    page,
    pageBodyHtmlLength,
    pageId,
  ]);

  useEffect(() => {
    if (!page || loading || reportedPageOpenRef.current === pageId) return;
    reportedPageOpenRef.current = pageId;
    const durationMs = getLocalPerformanceNow() - pageOpenStartedAtRef.current;
    const propertyCount = parsePageProperties(page.properties).length;
    const performanceSource = pageOpenSourceRef.current;
    const performanceKind = getPageOpenPerformanceKind(performanceSource);
    recordLocalPerformanceSnapshot({
      kind: performanceKind,
      label: getPageOpenPerformanceLabel(performanceKind),
      route: "/page/[pageId]",
      status: getPageOpenPerformanceStatus(page),
      startedAt: pageOpenStartedAtIsoRef.current,
      durationMs,
      localFirstMs: durationMs,
      backgroundMs: 0,
      counts: {
        has_content_html: page.content_text ? 1 : 0,
        body_html_chars: page.content_text?.length ?? 0,
        optimistic_draft: page.content_text === "" ? 1 : 0,
        metadata_only: page.content_text == null ? 1 : 0,
        database_row_handoff:
          performanceKind === "database-row-open" ? 1 : 0,
        large_body_editor_deferred: isLargePageBodyForEditor(page.content_text)
          ? 1
          : 0,
        has_cover: page.cover_url ? 1 : 0,
        property_count: propertyCount,
        locked: locked ? 1 : 0,
        wide_page: widePage ? 1 : 0,
      },
    });
  }, [loading, locked, page, pageId, widePage]);

  useEffect(() => {
    if (!hasPage) {
      mountedEditorPageIdRef.current = null;
      setEditorMounted(false);
      return;
    }
    if (editorMounted && mountedEditorPageIdRef.current === pageId) return;
    if (mountedEditorPageIdRef.current !== pageId) setEditorMounted(false);
    if (isOptimisticPageDraft) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        void loadEditorModule();
        setEditorMounted(true);
        mountedEditorPageIdRef.current = pageId;
      });
      return () => {
        cancelled = true;
      };
    }
    if (hasLargeBodyForEditor && !largeBodyEditorRequested) {
      return scheduleEditorMount(() => {
        void loadEditorModule();
      }, {
        delay: PAGE_LARGE_BODY_EDITOR_WARMUP_DELAY_MS,
        timeout: PAGE_LARGE_BODY_EDITOR_WARMUP_IDLE_TIMEOUT_MS,
      });
    }
    const metadataOnly = !hasContentForEditor;
    const delay = metadataOnly
      ? PAGE_METADATA_ONLY_EDITOR_DELAY_MS
      : hasLargeBodyForEditor
        ? PAGE_LARGE_BODY_EDITOR_DELAY_MS
        : 0;
    const timeout = metadataOnly
      ? PAGE_METADATA_ONLY_EDITOR_IDLE_TIMEOUT_MS
      : hasLargeBodyForEditor
        ? PAGE_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS
        : PAGE_EDITOR_IDLE_TIMEOUT_MS;
    return scheduleEditorMount(() => {
      void loadEditorModule();
      setEditorMounted(true);
      mountedEditorPageIdRef.current = pageId;
    }, {
      delay,
      timeout,
    });
  }, [
    pageId,
    hasPage,
    hasContentForEditor,
    hasLargeBodyForEditor,
    largeBodyEditorRequested,
    isOptimisticPageDraft,
    editorMounted,
  ]);

  const handleOpenLargeBodyEditor = useCallback(() => {
    setLargeBodyEditorRequested(true);
    void loadEditorModule();
    setEditorMounted(true);
    mountedEditorPageIdRef.current = pageId;
  }, [pageId]);

  const handlePrimeLargeBodyEditor = useCallback(() => {
    if (!hasLargeBodyForEditor || editorMounted || largeBodyEditorRequested) {
      return;
    }
    void loadEditorModule();
  }, [editorMounted, hasLargeBodyForEditor, largeBodyEditorRequested]);

  const handleActivateCoverImage = useCallback(() => {
    setCoverImageMountedPageId(pageId);
  }, [pageId]);

  const handleActivatePageProperties = useCallback(() => {
    setPagePropertiesMounted(true);
  }, []);

  const handleActivateIconPicker = useCallback(() => {
    setIconPickerInitialOpen(true);
    setIconPickerMounted(true);
  }, []);

  const handleActivateActionsMenu = useCallback(() => {
    setActionsMenuInitialOpen(true);
    setActionsMenuMounted(true);
  }, []);

  useEffect(() => {
    if (!hasPage || iconPickerMounted) return;
    return scheduleDeferredMount(() => {
      setIconPickerMounted(true);
    }, PAGE_HEADER_ICON_PICKER_IDLE_TIMEOUT_MS);
  }, [hasPage, iconPickerMounted, pageId]);

  useEffect(() => {
    if (!page?.cover_url || coverImageMounted) return;
    return scheduleDeferredMount(() => {
      setCoverImageMountedPageId(pageId);
    }, PAGE_COVER_IMAGE_IDLE_TIMEOUT_MS);
  }, [coverImageMounted, page?.cover_url, pageId]);

  useEffect(() => {
    if (!hasPage || pagePropertiesMounted) return;
    return scheduleDeferredMount(() => {
      setPagePropertiesMounted(true);
    }, PAGE_PROPERTIES_EDITOR_IDLE_TIMEOUT_MS);
  }, [hasPage, pageId, pagePropertiesMounted]);

  useEffect(() => {
    if (!hasPage || actionsMenuMounted) return;
    return scheduleDeferredMount(() => {
      setActionsMenuMounted(true);
    }, PAGE_ACTIONS_MENU_IDLE_TIMEOUT_MS);
  }, [actionsMenuMounted, hasPage, pageId]);

  useEffect(() => {
    setPageCommentsMounted(false);
    setChildTreeMounted(false);
    setPageReferencesMounted(false);
  }, [pageId, hasPage]);

  useEffect(() => {
    if (!hasPage || !pageRelationshipSurfacesReady || pageCommentsMounted)
      return;
    return scheduleDeferredMount(() => {
      setPageCommentsMounted(true);
    }, pageCommentsMountTimeout);
  }, [
    hasPage,
    pageCommentsMounted,
    pageId,
    pageCommentsMountTimeout,
    pageRelationshipSurfacesReady,
  ]);

  useEffect(() => {
    if (!hasPage || !pageRelationshipSurfacesReady || childTreeMounted) return;
    return scheduleDeferredMount(() => {
      setChildTreeMounted(true);
    }, childTreeMountTimeout);
  }, [
    childTreeMountTimeout,
    childTreeMounted,
    hasPage,
    pageId,
    pageRelationshipSurfacesReady,
  ]);

  useEffect(() => {
    if (!hasPage || !pageRelationshipSurfacesReady || pageReferencesMounted)
      return;
    return scheduleDeferredMount(() => {
      setPageReferencesMounted(true);
    }, pageReferencesMountTimeout);
  }, [
    hasPage,
    pageId,
    pageReferencesMountTimeout,
    pageReferencesMounted,
    pageRelationshipSurfacesReady,
  ]);

  useLayoutEffect(() => {
    const editableHeaderPage = page ?? readPageShellRoutePreviewSeed(pageId);
    if (!editableHeaderPage) {
      setTitle("");
      setProperties([]);
      return;
    }
    setTitle(editableHeaderPage.title);
    setProperties(parsePageProperties(editableHeaderPage.properties));
  }, [page, pageId]);

  const handleToggleComments = useCallback(() => {
    toggleCommentsPanelOpen();
  }, [toggleCommentsPanelOpen]);

  // Keep a live count of text comments so the toolbar button can show a badge.
  useEffect(() => {
    if (!pageCommentsMounted) return;
    let cancelled = false;
    const refreshCount = async () => {
      const count = await getBlockCommentCount(pageId);
      if (!cancelled) setCommentCount(count);
    };
    queueMicrotask(() => void refreshCount());
    const handleChanged = () => void refreshCount();
    window.addEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleChanged);
    };
  }, [pageId, pageCommentsMounted]);

  const refreshVersionCount = useCallback(async () => {
    if (!pageId || !dbReady) return;
    const count = await getPageVersionCount(pageId);
    setVersionCount(count);
  }, [dbReady, pageId]);

  useEffect(() => {
    setVersionCount(0);
    if (!pageId || !dbReady) return;

    let cancelled = false;
    const cancel = scheduleDeferredMount(() => {
      void getPageVersionCount(pageId)
        .then((count) => {
          if (!cancelled) setVersionCount(count);
        })
        .catch(() => {
          if (!cancelled) setVersionCount(0);
        });
    }, PAGE_VERSION_COUNT_IDLE_TIMEOUT_MS);

    return () => {
      cancelled = true;
      cancel();
    };
  }, [dbReady, pageId]);

  useEffect(() => {
    if (!showHistory || versionsLoading) return;
    setVersionCount(versions.length);
  }, [showHistory, versions.length, versionsLoading]);

  // Clicking commented text should reveal the panel so the comment is visible.
  useEffect(() => {
    const handleSelected = () => {
      setCommentsPanelOpen(true);
    };
    window.addEventListener(INLINE_COMMENT_SELECTED_EVENT, handleSelected);
    return () =>
      window.removeEventListener(INLINE_COMMENT_SELECTED_EVENT, handleSelected);
  }, [setCommentsPanelOpen]);

  const flushEditorSideEffects = useCallback(async () => {
    if (editorSideEffectRunningRef.current) return;
    const pending = pendingEditorSideEffectsRef.current;
    if (!pending) return;

    pendingEditorSideEffectsRef.current = null;
    editorSideEffectRunningRef.current = true;
    try {
      await updateWikiLinks(pageId, pending.linkedPageIds);
      const { maybeSnapshot } = await loadPageVersioningModule();
      const created = await maybeSnapshot(
        pageId,
        pending.title || "未命名页面",
        pending.html
      );
      if (created) {
        await refreshVersionCount();
        if (shouldLoadVersions) await refreshVersions({ force: true });
      }
    } finally {
      editorSideEffectRunningRef.current = false;
      if (
        pendingEditorSideEffectsRef.current &&
        editorSideEffectTimerRef.current === null
      ) {
        editorSideEffectTimerRef.current = window.setTimeout(() => {
          editorSideEffectTimerRef.current = null;
          void flushEditorSideEffects();
        }, PAGE_EDITOR_SIDE_EFFECT_DEBOUNCE_MS);
      }
    }
  }, [pageId, refreshVersionCount, refreshVersions, shouldLoadVersions]);

  const scheduleEditorSideEffects = useCallback(() => {
    if (editorSideEffectTimerRef.current !== null) {
      window.clearTimeout(editorSideEffectTimerRef.current);
    }
    editorSideEffectTimerRef.current = window.setTimeout(() => {
      editorSideEffectTimerRef.current = null;
      void flushEditorSideEffects();
    }, PAGE_EDITOR_SIDE_EFFECT_DEBOUNCE_MS);
  }, [flushEditorSideEffects]);

  const drainEditorContentPersistQueue = useCallback(async () => {
    if (editorContentPersistRunningRef.current) return;

    editorContentPersistRunningRef.current = true;
    try {
      while (pendingEditorContentPersistRef.current) {
        const pending = pendingEditorContentPersistRef.current;
        pendingEditorContentPersistRef.current = null;
        await pageUpdateRef.current({ content_text: pending.html });
        pendingEditorSideEffectsRef.current = {
          html: pending.html,
          linkedPageIds: [...pending.linkedPageIds],
          title: pending.title,
        };
        scheduleEditorSideEffects();
      }
    } finally {
      editorContentPersistRunningRef.current = false;
    }
  }, [scheduleEditorSideEffects]);

  const cancelEditorSideEffects = useCallback(() => {
    if (editorSideEffectTimerRef.current !== null) {
      window.clearTimeout(editorSideEffectTimerRef.current);
      editorSideEffectTimerRef.current = null;
    }
    pendingEditorSideEffectsRef.current = null;
    pendingEditorContentPersistRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (editorSideEffectTimerRef.current !== null) {
        window.clearTimeout(editorSideEffectTimerRef.current);
        editorSideEffectTimerRef.current = null;
      }
      void flushEditorSideEffects();
    };
  }, [flushEditorSideEffects]);

  const persistTitleNow = useCallback(
    async (newTitle: string) => {
      await update({ title: newTitle });
    },
    [update]
  );

  const flushTitleSave = useCallback(async () => {
    if (titleSaveTimerRef.current !== null) {
      window.clearTimeout(titleSaveTimerRef.current);
      titleSaveTimerRef.current = null;
    }
    const newTitle = pendingTitleRef.current;
    pendingTitleRef.current = null;
    if (newTitle === null) return;
    await persistTitleNow(newTitle);
  }, [persistTitleNow]);

  const scheduleTitleSave = useCallback(
    (newTitle: string) => {
      pendingTitleRef.current = newTitle;
      if (titleSaveTimerRef.current !== null) {
        window.clearTimeout(titleSaveTimerRef.current);
      }
      titleSaveTimerRef.current = window.setTimeout(() => {
        titleSaveTimerRef.current = null;
        void flushTitleSave();
      }, PAGE_TITLE_SAVE_DEBOUNCE_MS);
    },
    [flushTitleSave]
  );

  useEffect(() => {
    return () => {
      if (titleSaveTimerRef.current !== null) {
        window.clearTimeout(titleSaveTimerRef.current);
        titleSaveTimerRef.current = null;
      }
      const newTitle = pendingTitleRef.current;
      pendingTitleRef.current = null;
      if (newTitle !== null) void persistTitleNow(newTitle);
    };
  }, [persistTitleNow]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (locked) return;
      setTitle(newTitle);
      scheduleTitleSave(newTitle);
    },
    [locked, scheduleTitleSave]
  );

  const handlePropertiesChange = useCallback(
    async (next: PageProperty[]) => {
      if (locked) return;
      setProperties(next);
      await update({ properties: stringifyPageProperties(next) });
    },
    [locked, update]
  );

  const handleContentUpdate = useCallback(
    (html: string, _text: string, linkedPageIds: string[]) => {
      pendingEditorContentPersistRef.current = {
        html,
        linkedPageIds: [...linkedPageIds],
        title: title || "未命名页面",
      };
      void drainEditorContentPersistQueue();
    },
    [drainEditorContentPersistQueue, title]
  );

  const handleSaveVersion = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const label = window.prompt(
      "给这个版本命名（可选，例如：Q3 业绩更新）："
    );
    // A null return means the user cancelled the prompt
    if (label === null) return;
    const { manualSnapshot } = await loadPageVersioningModule();
    await manualSnapshot(pageId, title || "未命名页面", html, label);
    await refreshVersionCount();
    await refreshVersions({ force: true });
    setShowHistory(true);
  }, [pageId, title, page, refreshVersionCount, refreshVersions]);

  const handleExportHtml = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const { exportPageAsHtml } = await loadPageExportModule();
    exportPageAsHtml(title || "未命名页面", html);
  }, [page, title]);

  const handleExportMarkdown = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const { exportPageAsMarkdown } = await loadPageExportModule();
    exportPageAsMarkdown(title || "未命名页面", html);
  }, [page, title]);

  const showCopyNotice = useCallback((message: string) => {
    setCopyNotice(message);
    if (copyNoticeTimeoutRef.current !== null) {
      window.clearTimeout(copyNoticeTimeoutRef.current);
    }
    copyNoticeTimeoutRef.current = window.setTimeout(() => {
      setCopyNotice(null);
      copyNoticeTimeoutRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current !== null) {
        window.clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyPageMarkdown = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const { buildPageMarkdownDocument } = await loadPageExportModule();
    const markdown = buildPageMarkdownDocument(title || "未命名页面", html);
    const copied = await copyTextToClipboard(markdown, "复制页面 Markdown：");
    showCopyNotice(copied ? "已复制 Markdown" : "请在弹窗中手动复制 Markdown");
  }, [page, showCopyNotice, title]);

  const handleCopyPageHtml = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const { buildPageHtmlDocument } = await loadPageExportModule();
    const exportedHtml = buildPageHtmlDocument(title || "未命名页面", html);
    const copied = await copyTextToClipboard(exportedHtml, "复制页面 HTML：");
    showCopyNotice(copied ? "已复制 HTML" : "请在弹窗中手动复制 HTML");
  }, [page, showCopyNotice, title]);

  const handleCopyPageLink = useCallback(async () => {
    const url = `${window.location.origin}/page/${pageId}`;
    try {
      await window.navigator.clipboard.writeText(url);
      showCopyNotice("已复制页面链接");
    } catch {
      window.prompt("复制页面链接：", url);
    }
  }, [pageId, showCopyNotice]);

  const handlePrintPdf = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    const handlePageLocalCommand = (event: Event) => {
      const command = (event as CustomEvent<{ command?: PageLocalCommand }>).detail
        ?.command;
      if (!command) return;

      if (command === "info") {
        setShowInfo(true);
        return;
      }
      if (command === "history") {
        setShowHistory(true);
        return;
      }
      if (command === "export-html") {
        void handleExportHtml();
        return;
      }
      if (command === "export-markdown") {
        void handleExportMarkdown();
        return;
      }
      if (command === "copy-link") {
        void handleCopyPageLink();
        return;
      }
      if (command === "copy-markdown") {
        void handleCopyPageMarkdown();
        return;
      }
      if (command === "copy-html") {
        void handleCopyPageHtml();
        return;
      }
      if (command === "print-pdf") {
        handlePrintPdf();
      }
    };

    window.addEventListener(PAGE_LOCAL_COMMAND_EVENT, handlePageLocalCommand);
    return () =>
      window.removeEventListener(PAGE_LOCAL_COMMAND_EVENT, handlePageLocalCommand);
  }, [
    handleCopyPageHtml,
    handleCopyPageLink,
    handleCopyPageMarkdown,
    handleExportHtml,
    handleExportMarkdown,
    handlePrintPdf,
  ]);

  const handleCompareVersion = useCallback(
    (version: PageVersion) => {
      router.push(`/page/${pageId}/compare?from=${version.id}`);
    },
    [router, pageId]
  );

  const handleRestoreVersion = useCallback(
    async (version: PageVersion) => {
      const ok = window.confirm(
        `是否将页面恢复到 v${version.version_num}？当前内容会先保存为一个版本。`
      );
      if (!ok) return;
      const currentHtml = editorRef.current?.getHTML() ?? page?.content_text ?? "";
      const { manualSnapshot } = await loadPageVersioningModule();
      await manualSnapshot(pageId, title || "未命名页面", currentHtml, "恢复前");
      const restored = version.content_text || "";
      await update({ content_text: restored });
      editorRef.current?.setContent(restored);
      await manualSnapshot(
        pageId,
        title || "未命名页面",
        restored,
        `从 v${version.version_num} 恢复`
      );
      await refreshVersionCount();
      await refreshVersions({ force: true });
    },
    [pageId, title, page, update, refreshVersionCount, refreshVersions]
  );

  const handleIconChange = useCallback(
    async (icon: string) => {
      if (locked) return;
      await update({ icon });
    },
    [locked, update]
  );

  const handleIconRemove = useCallback(async () => {
    if (locked) return;
    await update({ icon: null });
  }, [locked, update]);

  const handleCoverUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (locked) return;
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        window.alert("请选择图片文件作为页面封面。");
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      await update({ cover_url: dataUrl });
    },
    [locked, update]
  );

  const handleCoverUrl = useCallback(async () => {
    if (locked) return;
    const url = window.prompt("封面图片 URL：", page?.cover_url ?? "");
    if (url === null) return;
    await update({ cover_url: url.trim() });
  }, [locked, page, update]);

  const handleRemoveCover = useCallback(async () => {
    if (locked) return;
    await update({ cover_url: "" });
  }, [locked, update]);

  const handleToggleLock = useCallback(() => {
    toggleLock();
  }, [toggleLock]);

  const handleToggleWidth = useCallback(() => {
    toggleWidePage();
  }, [toggleWidePage]);

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite(pageId);
  }, [pageId, toggleFavorite]);

  const handleCutPage = useCallback(() => {
    setPageClipboard({ pageId, mode: "cut" });
  }, [pageId, setPageClipboard]);

  const handleCopyPage = useCallback(() => {
    setPageClipboard({ pageId, mode: "copy" });
  }, [pageId, setPageClipboard]);

  const handlePastePage = useCallback(async () => {
    if (!pageClipboard) return;
    if (pageClipboard.mode === "cut") {
      const pos = await getNextPosition(pageId);
      const { movePageWithCloud } = await loadPageMutationModule();
      const moved = await movePageWithCloud(pageClipboard.pageId, pageId, pos);
      if (moved) {
        const { collectMovedPageSnapshots } =
          await loadPageSnapshotUpdatesModule();
        upsertPages(
          collectMovedPageSnapshots(useWorkspaceStore.getState().pages, moved)
        );
      }
      setPageClipboard(null);
    } else {
      const { duplicatePageDeepWithCloud } = await loadPageMutationModule();
      const duplicate = await duplicatePageDeepWithCloud(
        pageClipboard.pageId,
        pageId
      );
      if (duplicate) upsertPages([duplicate]);
    }
  }, [pageClipboard, pageId, setPageClipboard, upsertPages]);

  const handleMoveTo = useCallback(
    async (targetId: string | null) => {
      const pos = await getNextPosition(targetId);
      const { movePageWithCloud } = await loadPageMutationModule();
      const moved = await movePageWithCloud(pageId, targetId, pos);
      if (moved) {
        const { collectMovedPageSnapshots } =
          await loadPageSnapshotUpdatesModule();
        upsertPages(
          collectMovedPageSnapshots(useWorkspaceStore.getState().pages, moved)
        );
      }
      setShowMoveDialog(false);
    },
    [pageId, upsertPages]
  );

  const handleDelete = useCallback(async () => {
    if (locked) return;
    const ok = window.confirm(
      `要把“${title || page?.title || "未命名页面"}”移到回收站吗？之后可以从侧边栏回收站恢复。`
    );
    if (!ok) return;
    await remove();
    router.push("/");
  }, [locked, page, remove, router, title]);

  const handleAddSubPage = useCallback(async () => {
    if (locked) return;
    try {
      const { createPageWithCloud } = await loadPageMutationModule();
      const child = await createPageWithCloud({ parentId: pageId });
      upsertPages([child]);
      // Insert a link to the sub-page in the parent editor
      const html = editorRef.current?.insertSubPageLink(child.id, child.title);
      // Save immediately before navigating away (don't wait for debounce)
      if (html) {
        await update({ content_text: html });
      }
      openPage(child, { source: "child-page-create" });
    } catch (err) {
      console.error("[Zhinote] Failed to create sub-page:", err);
    }
  }, [locked, openPage, pageId, update, upsertPages]);

  const handleDuplicatePage = useCallback(async () => {
    if (!page) return;
    const html = editorRef.current?.getHTML() ?? page.content_text ?? "";
    const { createPageWithCloud, updatePageWithCloud } =
      await loadPageMutationModule();
    const duplicate = await createPageWithCloud({
      title: `${title || page.title || "未命名页面"} 副本`,
      parentId: page.parent_id,
      icon: page.icon ?? undefined,
    });
    const optimisticDuplicate = {
      ...duplicate,
      cover_url: page.cover_url,
      content_text: html,
      updated_at: new Date().toISOString(),
    };
    upsertPages([optimisticDuplicate]);
    openPage(optimisticDuplicate, { source: "duplicate-page-create" });
    void (async () => {
      try {
        const updatedDuplicate = await updatePageWithCloud(duplicate.id, {
          cover_url: page.cover_url ?? "",
          content_text: html,
        });
        await updateWikiLinks(duplicate.id, extractLinkedPageIdsFromHtml(html));
        if (updatedDuplicate) upsertPages([updatedDuplicate]);
      } catch (err) {
        console.error("[Zhinote] Failed to finalize duplicated page:", err);
      }
    })();
  }, [openPage, page, title, upsertPages]);

  useEffect(() => {
    if (!showInfo || !page) {
      setPageStructure(null);
      return;
    }
    let cancelled = false;
    void loadPageResearchStructureModule()
      .then(({ buildPageResearchStructureReport }) => {
        if (cancelled) return;
        setPageStructure(
          buildPageResearchStructureReport({
            html: page.content_text ?? "",
            title: title || page.title || "未命名页面",
            metadata: {
              favorite,
              hasCover: Boolean(page.cover_url),
              locked,
              versionsCount: versionCountForDisplay,
              widePage,
            },
          })
        );
      })
      .catch(() => {
        if (!cancelled) setPageStructure(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    favorite,
    locked,
    page,
    showInfo,
    title,
    versionCountForDisplay,
    widePage,
  ]);
  const pageInfo = useMemo(
    () => (pageStructure ? getPageInfoStats(pageStructure) : null),
    [pageStructure]
  );
  const bodyHydrationLabel =
    describePageBodyHydrationStatus(bodyHydrationStatus);
  const pageCloudSaveStatus = useMemo(
    () =>
      buildPageCloudSaveStatus({
        currentPagePending: currentPagePendingSync,
        pageId,
        status: pageSyncStatus,
      }),
    [currentPagePendingSync, pageId, pageSyncStatus]
  );
  const showBodyHydrationHint = Boolean(
    page &&
      page.content_text == null &&
      bodyHydrationLabel &&
      bodyHydrationStatus?.phase !== "empty-ready"
  );
  const routePreviewPage = useMemo(
    () => page ?? readPageShellRoutePreviewSeed(pageId),
    [page, pageId]
  );

  if (loading && !page) {
    return (
      <PageRouteSkeleton
        message="正在从本地缓存打开页面，云端回填会在后台继续。"
        preview={
          routePreviewPage
            ? {
                title: routePreviewPage.title,
                icon: routePreviewPage.icon,
                properties: routePreviewPage.properties,
              }
            : undefined
        }
      />
    );
  }

  if (!page) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-zinc-500 mb-4">页面未找到</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-blue-500 hover:underline"
            >
              返回首页
            </button>
          </div>
        </main>
      </div>
    );
  }

  const handleExportPageStructure = () => {
    if (!pageStructure) return;
    setExportingPageStructure(true);
    try {
      downloadJsonFile(
        `zhinote-page-research-structure-${fileSafeTimestamp()}.json`,
        {
          format: "zhinote-page-research-structure-export",
          format_version: 1,
          export_status: "local-page-structure-export-only",
          exported_at: new Date().toISOString(),
          page: {
            local_page_id: pageId,
            page_title_included: false,
            page_body_included: false,
          },
          boundary: {
            local_export_only: true,
            includes_page_title: false,
            includes_page_body_text: false,
            includes_linked_page_bodies: false,
            includes_database_row_values: false,
            includes_file_bytes: false,
            includes_tokens_or_credentials: false,
            uploads_data: false,
            connects_cloud_services: false,
            enables_ai: false,
            writes_workspace_data: false,
          },
          report: pageStructure,
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export page research structure:", err);
      window.alert("页面投研结构报告导出失败，请查看控制台。");
    } finally {
      setExportingPageStructure(false);
    }
  };
  const handleApplyResearchAction = async (
    action: PageResearchStructureAction
  ) => {
    if (locked || !action.insert_html.trim()) return;
    setApplyingResearchActionId(action.id);
    try {
      const html = editorRef.current?.appendHtml(action.insert_html);
      if (!html) return;
      cancelEditorSideEffects();
      await update({ content_text: html });
      await updateWikiLinks(pageId, extractLinkedPageIdsFromHtml(html));
      const { maybeSnapshot } = await loadPageVersioningModule();
      const created = await maybeSnapshot(
        pageId,
        title || page.title || "未命名页面",
        html
      );
      if (created) await refreshVersions();
    } catch (err) {
      console.error("[Zhinote] Failed to insert research action block:", err);
      window.alert("插入建议结构块失败，请查看控制台。");
    } finally {
      setApplyingResearchActionId(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className={`${widePage ? "max-w-6xl" : "max-w-3xl"} mx-auto px-8 py-10`}>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />

          {/* Page cover */}
          {page.cover_url ? (
            <div className="-mx-2 mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
              <div
                className="group relative h-44"
                onPointerEnter={handleActivateCoverImage}
                onFocus={handleActivateCoverImage}
              >
                {coverImageMounted ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={page.cover_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PageCoverDeferredPlaceholder
                    onActivate={handleActivateCoverImage}
                  />
                )}
                <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {!locked && (
                    <>
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="rounded bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-white hover:text-zinc-900 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                      >
                        上传
                      </button>
                      <button
                        type="button"
                        onClick={handleCoverUrl}
                        className="rounded bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-white hover:text-zinc-900 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                      >
                        URL
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        className="rounded bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-white hover:text-red-500 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        移除
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Top bar: nav + breadcrumb on the left, favorite + actions on the right */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                title="后退"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => router.forward()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                title="前进"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <Breadcrumb pageId={pageId} />
            </div>
            <div className="flex items-center gap-1">
              <PageSyncStatusBadge
                status={pageCloudSaveStatus}
                onOpenSync={() => router.push("/modules/sync")}
              />
              <button
                onClick={handleToggleFavorite}
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  favorite
                    ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                }`}
                title={favorite ? "取消收藏" : "添加到收藏"}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill={favorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m12 2 3.1 6.4 7 .9-5.1 4.9 1.3 6.9L12 17.8 5.7 21.1l1.3-6.9L1.9 9.3l7-.9L12 2Z" />
                </svg>
              </button>
              <button
                onClick={handleToggleComments}
                className={`relative flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  showComments
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                }`}
                title={showComments ? "隐藏评论区" : "显示评论区"}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {commentCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-medium text-white">
                    {commentCount}
                  </span>
                )}
              </button>
              {actionsMenuMounted ? (
                <PageActionsMenu
                  locked={locked}
                  widePage={widePage}
                  versionsCount={versionCountForDisplay}
                  initialOpen={actionsMenuInitialOpen}
                  onAddSubPage={handleAddSubPage}
                  onAddCover={() => coverInputRef.current?.click()}
                  onToggleLock={handleToggleLock}
                  onToggleWidth={handleToggleWidth}
                  onSaveVersion={handleSaveVersion}
                  onToggleHistory={() => setShowHistory((s) => !s)}
                  onToggleInfo={() => setShowInfo((current) => !current)}
                  onDuplicate={handleDuplicatePage}
                  onCopyLink={() => void handleCopyPageLink()}
                  onMoveTo={() => setShowMoveDialog(true)}
                  onCut={handleCutPage}
                  onCopy={handleCopyPage}
                  onPaste={pageClipboard ? () => void handlePastePage() : undefined}
                  onExportHtml={handleExportHtml}
                  onExportMarkdown={handleExportMarkdown}
                  onCopyMarkdown={() => void handleCopyPageMarkdown()}
                  onCopyHtml={() => void handleCopyPageHtml()}
                  onPrintPdf={handlePrintPdf}
                  onDelete={handleDelete}
                />
              ) : (
                <PageActionsMenuDeferredTrigger
                  onActivate={handleActivateActionsMenu}
                />
              )}
            </div>
          </div>

          {/* Page header: icon + title */}
          <div className="mb-3">
            <div className="flex items-start gap-2">
              {iconPickerMounted ? (
                <IconPicker
                  currentIcon={page.icon}
                  onSelect={handleIconChange}
                  onRemove={handleIconRemove}
                  disabled={locked}
                  initialOpen={iconPickerInitialOpen}
                />
              ) : (
                <PageIconPickerDeferredTrigger
                  currentIcon={page.icon}
                  disabled={locked}
                  onActivate={handleActivateIconPicker}
                />
              )}
              <h1 className="zhinote-print-title">
                {title || page.title || "未命名页面"}
              </h1>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => void flushTitleSave()}
                disabled={locked}
                placeholder="新页面"
                className="zhinote-title-input w-full text-3xl font-bold bg-transparent border-none outline-none text-zinc-900 disabled:cursor-default dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 mt-1"
              />
            </div>
            {copyNotice && (
              <span className="mt-1 inline-block text-xs text-emerald-600 dark:text-emerald-400">
                {copyNotice}
              </span>
            )}
          </div>

          {/* Properties (Notion-style, directly under the title) */}
          {pagePropertiesMounted ? (
            <PageProperties
              properties={properties}
              disabled={locked}
              pageId={pageId}
              onChange={handlePropertiesChange}
            />
          ) : (
            <PagePropertiesDeferredPreview
              properties={properties}
              disabled={locked}
              onActivate={handleActivatePageProperties}
            />
          )}

          {showInfo && pageStructure && pageInfo && (
            <PageInfoPanel
              createdAt={page.created_at}
              favorite={favorite}
              hasCover={Boolean(page.cover_url)}
              icon={page.icon}
              locked={locked}
              pageId={pageId}
              researchStructure={pageStructure}
              applyingResearchActionId={applyingResearchActionId}
              exportingResearchStructure={exportingPageStructure}
              onApplyResearchAction={handleApplyResearchAction}
              onExportResearchStructure={handleExportPageStructure}
              stats={pageInfo}
              title={title || page.title || "未命名页面"}
              updatedAt={page.updated_at}
              versionsCount={versionCountForDisplay}
              widePage={widePage}
            />
          )}

          {/* Version history panel (toggled) */}
          {showHistory && (
            <VersionHistoryPanel
              versions={versions}
              onCompare={handleCompareVersion}
              onRestore={handleRestoreVersion}
              onClose={() => setShowHistory(false)}
            />
          )}

          {/* Page-level comments sit between properties and the body */}
          {pageCommentsMounted && (
            <PageComments pageId={pageId} disabled={locked} />
          )}

          {/* Industry-chain pages show their sub-page hierarchy up front */}
          {childTreeMounted && <ChildPageTree pageId={pageId} />}

          <div className="my-4 border-t border-zinc-100 dark:border-zinc-800" />

          {showBodyHydrationHint && (
            <p
              data-testid="page-body-hydration-status"
              aria-live="polite"
              className="mb-3 text-xs text-zinc-400"
            >
              {bodyHydrationLabel}
            </p>
          )}

          {/* Editor - now loads/saves HTML */}
          {editorMounted ? (
            <Editor
              ref={editorRef}
              pageId={pageId}
              initialContent={page.content_text}
              editable={!locked}
              onUpdate={handleContentUpdate}
            />
          ) : hasLargeBodyForEditor && page.content_text != null ? (
            <LargePageBodyPreview
              contentLength={pageBodyHtmlLength}
              html={page.content_text}
              locked={locked}
              onOpenEditor={handleOpenLargeBodyEditor}
              onPrimeEditor={handlePrimeLargeBodyEditor}
            />
          ) : (
            <PageBodySkeleton
              metadataOnly={page.content_text == null}
              optimisticDraft={isOptimisticPageDraft}
              largeBody={hasLargeBodyForEditor}
              contentLength={pageBodyHtmlLength}
              statusLabel={bodyHydrationLabel}
            />
          )}

          {/* When the comment panel is open, text comments live there instead
              of stacking at the bottom — avoids showing them twice. */}
          {!showComments && pageCommentsMounted && (
            <BlockComments pageId={pageId} disabled={locked} />
          )}

          {/* Backlinks - pages that link to this page */}
          {pageReferencesMounted && <Backlinks pageId={pageId} />}
        </div>

        {showMoveDialog && (
          <MoveToDialog
            pageId={pageId}
            onMove={handleMoveTo}
            onClose={() => setShowMoveDialog(false)}
          />
        )}
      </main>

      {showComments && pageCommentsMounted && (
        <CommentSidePanel
          pageId={pageId}
          disabled={locked}
          onClose={handleToggleComments}
        />
      )}
    </div>
  );
}

function PageSyncStatusBadge({
  onOpenSync,
  status,
}: {
  onOpenSync: () => void;
  status: PageCloudSaveStatusView;
}) {
  return (
    <button
      type="button"
      data-testid="page-sync-status-badge"
      aria-label={status.aria_label}
      onClick={onOpenSync}
      title={status.title}
      data-sync-status={status.id}
      data-blocks-cache-rebuild={String(status.blocks_cache_rebuild)}
      className={`hidden h-7 items-center rounded border px-2 text-[11px] font-medium transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 md:inline-flex ${pageCloudSaveStatusToneClass(
        status.tone
      )}`}
    >
      {status.label}
    </button>
  );
}

function pageCloudSaveStatusToneClass(tone: PageCloudSaveStatusTone) {
  const classes: Record<PageCloudSaveStatusTone, string> = {
    neutral:
      "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
    danger:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  return classes[tone];
}

function schedulePageSyncStatusInitialRefresh(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  let timer: number | null = null;
  let idleId: number | null = null;
  let fallbackTimer: number | null = null;
  timer = window.setTimeout(() => {
    timer = null;
    if (typeof maybeWindow.requestIdleCallback === "function") {
      idleId = maybeWindow.requestIdleCallback(callback, {
        timeout: PAGE_SYNC_STATUS_FIRST_REFRESH_IDLE_TIMEOUT_MS,
      });
      return;
    }
    fallbackTimer = window.setTimeout(callback, 80);
  }, PAGE_SYNC_STATUS_FIRST_REFRESH_DELAY_MS);
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    if (idleId !== null) maybeWindow.cancelIdleCallback?.(idleId);
    if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
  };
}

function scheduleEditorMount(
  callback: () => void,
  options: { delay?: number; timeout?: number } = {}
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  const delay = Math.max(0, options.delay ?? 0);
  const timeout = Math.max(1, options.timeout ?? PAGE_EDITOR_IDLE_TIMEOUT_MS);
  let timer: number | null = null;
  let idleId: number | null = null;
  let frame: number | null = null;
  const requestMount = () => {
    if (maybeWindow.requestIdleCallback) {
      idleId = maybeWindow.requestIdleCallback(callback, {
        timeout,
      });
      return;
    }
    timer = window.setTimeout(callback, Math.min(timeout, 160));
  };
  const start = () => {
    frame = window.requestAnimationFrame(requestMount);
  };
  if (delay > 0) {
    timer = window.setTimeout(() => {
      timer = null;
      start();
    }, delay);
  } else {
    start();
  }
  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    if (idleId !== null) maybeWindow.cancelIdleCallback?.(idleId);
    if (timer !== null) window.clearTimeout(timer);
  };
}

function scheduleDeferredMount(callback: () => void, timeout = 450): () => void {
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
  const timer = window.setTimeout(callback, 80);
  return () => window.clearTimeout(timer);
}

type LargePageBodyPreviewModel = {
  blocks: string[];
  headings: Array<{ level: number; text: string }>;
  truncated: boolean;
};

type LargePageBodyPreviewState = {
  html: string;
  model: LargePageBodyPreviewModel;
} | null;

function scheduleLargePagePreviewBuild(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (maybeWindow.requestIdleCallback && maybeWindow.cancelIdleCallback) {
    const idleId = maybeWindow.requestIdleCallback(callback, {
      timeout: PAGE_LARGE_BODY_PREVIEW_IDLE_TIMEOUT_MS,
    });
    return () => maybeWindow.cancelIdleCallback?.(idleId);
  }
  const timer = window.setTimeout(callback, 80);
  return () => window.clearTimeout(timer);
}

function LargePageBodyPreview({
  contentLength,
  html,
  locked,
  onOpenEditor,
  onPrimeEditor,
}: {
  contentLength: number;
  html: string;
  locked: boolean;
  onOpenEditor: () => void;
  onPrimeEditor: () => void;
}) {
  const [preview, setPreview] = useState<LargePageBodyPreviewState>(null);
  const activePreview = preview?.html === html ? preview.model : null;
  const buttonLabel = locked ? "打开完整正文" : "打开完整编辑器";

  useEffect(() => {
    let cancelled = false;
    const cancel = scheduleLargePagePreviewBuild(() => {
      if (cancelled) return;
      setPreview(null);
      const nextPreview = buildLargePageBodyPreview(html);
      if (!cancelled) setPreview({ html, model: nextPreview });
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [html]);

  return (
    <div
      data-testid="large-page-body-preview"
      className="rounded-md border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            正文较长，已先显示轻量预览
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            约 {formatApproxBodySize(contentLength)}。完整编辑器会在你需要编辑或查看复杂块时再加载。
          </p>
        </div>
        <button
          type="button"
          onFocus={onPrimeEditor}
          onClick={onOpenEditor}
          onPointerEnter={onPrimeEditor}
          className="h-8 shrink-0 rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {buttonLabel}
        </button>
      </div>
      {activePreview === null ? (
        <div
          data-testid="large-page-body-preview-pending"
          className="rounded border border-zinc-100 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div className="mb-3 h-3 w-32 rounded bg-zinc-200/80 dark:bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-3 w-full max-w-xl rounded bg-zinc-200/70 dark:bg-zinc-800/80" />
            <div className="h-3 w-10/12 max-w-xl rounded bg-zinc-200/60 dark:bg-zinc-800/70" />
            <div className="h-3 w-7/12 max-w-xl rounded bg-zinc-200/50 dark:bg-zinc-800/60" />
          </div>
          <p className="mt-3 text-xs text-zinc-400">正在生成轻量预览…</p>
        </div>
      ) : activePreview.blocks.length > 0 ||
        activePreview.headings.length > 0 ? (
        <div className="space-y-5">
          {activePreview.headings.length > 0 && (
            <div
              data-testid="large-page-body-preview-outline"
              className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                页面结构
              </p>
              <div className="space-y-1">
                {activePreview.headings.map((heading, index) => (
                  <p
                    key={`${index}-${heading.text.slice(0, 16)}`}
                    className="truncate text-xs text-zinc-600 dark:text-zinc-300"
                    style={{
                      paddingLeft: `${Math.max(0, heading.level - 1) * 10}px`,
                    }}
                    title={heading.text}
                  >
                    {heading.text}
                  </p>
                ))}
              </div>
            </div>
          )}
          {activePreview.blocks.length > 0 && (
            <div className="space-y-3 text-sm leading-7 text-zinc-700 dark:text-zinc-200">
              {activePreview.blocks.map((block, index) => (
                <p key={`${index}-${block.slice(0, 16)}`}>{block}</p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          预览暂时没有可显示的纯文本内容，请打开完整编辑器查看页面。
        </p>
      )}
      {activePreview?.truncated && (
        <p className="mt-4 text-xs text-zinc-400">
          这里只显示前 {formatApproxBodySize(PAGE_LARGE_BODY_PREVIEW_HTML_CHARS)} 的安全文本预览。
        </p>
      )}
    </div>
  );
}

function PageBodySkeleton({
  metadataOnly = false,
  optimisticDraft = false,
  largeBody = false,
  contentLength = 0,
  statusLabel,
}: {
  metadataOnly?: boolean;
  optimisticDraft?: boolean;
  largeBody?: boolean;
  contentLength?: number;
  statusLabel?: string | null;
}) {
  const loadingMessage = optimisticDraft
    ? "新页面已在本机创建，标题和属性可以先确认，编辑器正在准备…"
    : largeBody
    ? `正文较长（约 ${formatApproxBodySize(contentLength)}），标题和属性已先显示，编辑器正在空闲时段准备…`
    : metadataOnly
      ? statusLabel ?? "标题和属性已先显示，正在从本地缓存补齐正文和编辑器…"
      : "正在准备编辑器…";

  return (
    <div className="min-h-[220px] rounded-md border border-zinc-100 bg-zinc-50/60 px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="mb-4 h-3 w-40 rounded bg-zinc-200/80 dark:bg-zinc-800" />
      <div className="space-y-3">
        <div className="h-3 w-full max-w-2xl rounded bg-zinc-200/70 dark:bg-zinc-800/80" />
        <div className="h-3 w-11/12 max-w-2xl rounded bg-zinc-200/60 dark:bg-zinc-800/70" />
        <div className="h-3 w-4/5 max-w-2xl rounded bg-zinc-200/50 dark:bg-zinc-800/60" />
      </div>
      <p className="mt-5 text-xs text-zinc-400">
        {loadingMessage}
      </p>
    </div>
  );
}

function buildLargePageBodyPreview(html: string): LargePageBodyPreviewModel {
  const slicedHtml = html.slice(0, PAGE_LARGE_BODY_PREVIEW_HTML_CHARS);
  if (typeof DOMParser === "undefined") {
    const text = normalizePreviewText(slicedHtml.replace(/<[^>]*>/g, " "));
    return {
      blocks: splitPreviewText(text),
      headings: [],
      truncated:
        html.length > slicedHtml.length ||
        text.length > PAGE_LARGE_BODY_PREVIEW_TEXT_CHARS,
    };
  }

  const doc = new DOMParser().parseFromString(slicedHtml, "text/html");
  doc
    .querySelectorAll("script, style, iframe, object, embed, svg, canvas")
    .forEach((element) => element.remove());
  const headings = extractLargePagePreviewHeadings(doc);
  const blockElements = Array.from(
    doc.body.querySelectorAll(
      "h1,h2,h3,h4,p,li,blockquote,pre,td,th,figcaption"
    )
  );
  const rawBlocks =
    blockElements.length > 0
      ? blockElements.map((element) =>
          normalizePreviewText(element.textContent ?? "")
        )
      : splitPreviewText(normalizePreviewText(doc.body.textContent ?? ""));

  const blocks: string[] = [];
  let usedChars = 0;
  for (const block of rawBlocks) {
    if (!block || blocks.includes(block)) continue;
    const remaining = PAGE_LARGE_BODY_PREVIEW_TEXT_CHARS - usedChars;
    if (remaining <= 0 || blocks.length >= PAGE_LARGE_BODY_PREVIEW_BLOCKS) {
      break;
    }
    const clipped =
      block.length > remaining
        ? `${block.slice(0, remaining).trim()}...`
        : block;
    blocks.push(clipped);
    usedChars += clipped.length;
  }

  return {
    blocks,
    headings,
    truncated:
      html.length > slicedHtml.length ||
      rawBlocks.length > blocks.length ||
      usedChars >= PAGE_LARGE_BODY_PREVIEW_TEXT_CHARS,
  };
}

function extractLargePagePreviewHeadings(doc: Document): Array<{
  level: number;
  text: string;
}> {
  const headings: Array<{ level: number; text: string }> = [];
  const seen = new Set<string>();
  for (const element of Array.from(doc.body.querySelectorAll("h1,h2,h3,h4"))) {
    const text = normalizePreviewText(element.textContent ?? "");
    if (!text || seen.has(text)) continue;
    const level = Number(element.tagName.replace(/^H/i, "")) || 1;
    headings.push({ level: Math.min(Math.max(level, 1), 4), text });
    seen.add(text);
    if (headings.length >= PAGE_LARGE_BODY_PREVIEW_HEADINGS) break;
  }
  return headings;
}

function splitPreviewText(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/([。！？])\s+/g, "$1\n")
    .split(/\n{2,}/)
    .map(normalizePreviewText)
    .filter(Boolean)
    .slice(0, PAGE_LARGE_BODY_PREVIEW_BLOCKS);
}

function normalizePreviewText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isLargePageBodyForEditor(content: string | null | undefined): boolean {
  return (content?.length ?? 0) > PAGE_LARGE_BODY_HTML_CHARS;
}

function getPageOpenPerformanceStatus(
  page: Page
): "local-draft-ready" | "metadata-ready" | "content-ready" {
  if (page.content_text === "") return "local-draft-ready";
  if (page.content_text == null) return "metadata-ready";
  return "content-ready";
}

function isTerminalPageBodyHydrationPhase(
  phase: PageBodyHydrationPhase
): boolean {
  return (
    phase === "local-body-ready" ||
    phase === "cloud-body-ready" ||
    phase === "empty-ready" ||
    phase === "unavailable"
  );
}

function getPageOpenPerformanceKind(
  source: PageRouteHandoffSource | null
): LocalPerformanceKind {
  return source === "database-row-open" ||
    source === "database-row-create" ||
    source === "inline-database-open"
    ? "database-row-open"
    : "page-open";
}

function getPageOpenPerformanceLabel(kind: LocalPerformanceKind): string {
  return kind === "database-row-open" ? "数据库行打开" : "页面打开";
}

function formatApproxBodySize(length: number): string {
  if (length <= 0) return "0 KB";
  const kilobytes = Math.max(1, Math.round(length / 1024));
  if (kilobytes < 1024) return `${kilobytes} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function PageIconPickerSkeleton() {
  return (
    <div
      className="mt-1 h-8 w-20 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800"
      aria-hidden="true"
    />
  );
}

function PageIconPickerDeferredTrigger({
  currentIcon,
  disabled,
  onActivate,
}: {
  currentIcon: string | null;
  disabled: boolean;
  onActivate: () => void;
}) {
  if (currentIcon) {
    return (
      <button
        type="button"
        onClick={onActivate}
        disabled={disabled}
        className="rounded-md p-1 text-3xl transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent"
        title={disabled ? undefined : "更换图标"}
      >
        {currentIcon}
      </button>
    );
  }
  if (disabled) return <div className="h-8 w-0 shrink-0" aria-hidden="true" />;
  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-300 transition-all hover:bg-zinc-100 hover:text-zinc-500 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      title="添加图标"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9 10h.01M15 10h.01M9 15c.8.7 1.9 1 3 1s2.2-.3 3-1" />
      </svg>
      添加图标
    </button>
  );
}

function PageCoverDeferredPlaceholder({
  onActivate,
}: {
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-500 dark:bg-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-800"
      title="加载封面"
      aria-label="加载封面"
    >
      封面准备中
    </button>
  );
}

function PagePropertiesDeferredPreview({
  properties,
  disabled,
  onActivate,
}: {
  properties: PageProperty[];
  disabled: boolean;
  onActivate: () => void;
}) {
  if (properties.length === 0 && disabled) return null;
  return (
    <div className="mb-6">
      <div className="flex flex-col">
        {properties.map((property) => (
          <button
            key={property.id}
            type="button"
            onClick={onActivate}
            className="group flex items-start gap-2 rounded py-1 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
            title="点击编辑属性"
          >
            <div className="flex w-40 shrink-0 items-center gap-1.5 pt-1.5 text-sm text-zinc-400">
              <span className="w-4 shrink-0 text-center text-xs">
                {getPagePropertyTypeIcon(property.type)}
              </span>
              <span className="min-w-0 flex-1 truncate px-1 py-0.5">
                {property.name}
              </span>
            </div>
            <PagePropertyPreviewValue property={property} />
          </button>
        ))}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={onActivate}
          className="mt-1 flex items-center gap-1.5 rounded px-1.5 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <span className="text-base leading-none">+</span> 添加属性
        </button>
      )}
    </div>
  );
}

function PagePropertyPreviewValue({ property }: { property: PageProperty }) {
  const empty = !property.value;
  if (property.type === "checkbox") {
    return (
      <div className="min-w-0 flex-1 pt-1.5 text-sm text-zinc-400">
        {property.value === "true" ? "已选中" : "未选"}
      </div>
    );
  }
  if (property.type === "tags") {
    const tags = parseTagsValue(property.value);
    if (tags.length === 0) return <EmptyPagePropertyPreviewValue />;
    return (
      <div className="min-w-0 flex-1 py-1">
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {tag}
            </span>
          ))}
          {tags.length > 8 && (
            <span className="text-xs text-zinc-400">+{tags.length - 8}</span>
          )}
        </div>
      </div>
    );
  }
  if (property.type === "select" && property.value) {
    return (
      <div className="min-w-0 flex-1 py-1">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {property.value}
        </span>
      </div>
    );
  }
  return (
    <div
      className={`min-w-0 flex-1 truncate px-1.5 py-1 text-sm ${
        empty
          ? "text-zinc-300 dark:text-zinc-600"
          : "text-zinc-700 dark:text-zinc-200"
      }`}
    >
      {empty ? "空" : property.value}
    </div>
  );
}

function EmptyPagePropertyPreviewValue() {
  return (
    <div className="min-w-0 flex-1 px-1.5 py-1 text-sm text-zinc-300 dark:text-zinc-600">
      空
    </div>
  );
}

function PagePropertiesSkeleton() {
  return (
    <div
      className="mb-6 space-y-2"
      aria-label="页面属性加载中"
      role="status"
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-36 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

function PageActionsMenuSkeleton() {
  return (
    <div
      className="h-7 w-7 rounded-md bg-zinc-100 dark:bg-zinc-800"
      aria-hidden="true"
    />
  );
}

function PageActionsMenuDeferredTrigger({
  onActivate,
}: {
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      title="更多操作"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
  );
}

async function copyTextToClipboard(value: string, promptLabel: string) {
  try {
    if (!window.navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await window.navigator.clipboard.writeText(value);
    return true;
  } catch {
    window.prompt(promptLabel, value);
    return false;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extractLinkedPageIdsFromHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("[data-type='mention'][data-id]"))
    .map((element) => element.getAttribute("data-id"))
    .filter((id): id is string => Boolean(id));
}

interface PageInfoStats {
  blockCount: number;
  characterCount: number;
  codeBlockCount: number;
  fileBlockCount: number;
  linkCount: number;
  tableCount: number;
  wordCount: number;
}

function PageInfoPanel({
  applyingResearchActionId,
  createdAt,
  exportingResearchStructure,
  favorite,
  hasCover,
  icon,
  locked,
  onApplyResearchAction,
  onExportResearchStructure,
  pageId,
  researchStructure,
  stats,
  title,
  updatedAt,
  versionsCount,
  widePage,
}: {
  applyingResearchActionId: string | null;
  createdAt: string;
  exportingResearchStructure: boolean;
  favorite: boolean;
  hasCover: boolean;
  icon: string | null;
  locked: boolean;
  onApplyResearchAction: (action: PageResearchStructureAction) => void;
  onExportResearchStructure: () => void;
  pageId: string;
  researchStructure: PageResearchStructureReport;
  stats: PageInfoStats;
  title: string;
  updatedAt: string;
  versionsCount: number;
  widePage: boolean;
}) {
  return (
    <section className="mb-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          页面信息
        </h2>
        <span className="truncate text-xs text-zinc-400">{pageId}</span>
      </div>
      <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        <PageInfoItem label="标题" value={title} />
        <PageInfoItem label="图标" value={icon || "无"} />
        <PageInfoItem label="创建时间" value={formatInfoDate(createdAt)} />
        <PageInfoItem label="更新时间" value={formatInfoDate(updatedAt)} />
        <PageInfoItem label="词数" value={String(stats.wordCount)} />
        <PageInfoItem label="字符数" value={String(stats.characterCount)} />
        <PageInfoItem label="块数量" value={String(stats.blockCount)} />
        <PageInfoItem label="链接" value={String(stats.linkCount)} />
        <PageInfoItem label="表格" value={String(stats.tableCount)} />
        <PageInfoItem label="代码块" value={String(stats.codeBlockCount)} />
        <PageInfoItem label="文件" value={String(stats.fileBlockCount)} />
        <PageInfoItem label="版本" value={String(versionsCount)} />
        <PageInfoItem label="收藏" value={favorite ? "是" : "否"} />
        <PageInfoItem label="锁定" value={locked ? "是" : "否"} />
        <PageInfoItem label="宽页面" value={widePage ? "是" : "否"} />
        <PageInfoItem label="封面" value={hasCover ? "是" : "否"} />
      </dl>
      <PageResearchStructurePanel
        applyingActionId={applyingResearchActionId}
        exporting={exportingResearchStructure}
        locked={locked}
        onApplyAction={onApplyResearchAction}
        onExport={onExportResearchStructure}
        report={researchStructure}
      />
    </section>
  );
}

function PageInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-3">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="min-w-0 truncate text-xs text-zinc-700 dark:text-zinc-200">
        {value}
      </dd>
    </div>
  );
}

function PageResearchStructurePanel({
  applyingActionId,
  exporting,
  locked,
  onApplyAction,
  onExport,
  report,
}: {
  applyingActionId: string | null;
  exporting: boolean;
  locked: boolean;
  onApplyAction: (action: PageResearchStructureAction) => void;
  onExport: () => void;
  report: PageResearchStructureReport;
}) {
  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            投研结构
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            本地页面结构体检，不读取关联页面或数据库行值。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
            title="导出本地页面结构报告，不包含页面正文"
          >
            {exporting ? "导出中" : "导出结构报告"}
          </button>
          <PageResearchStructureStatusPill status={report.structure_status} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {report.signals.map((signal) => (
          <PageResearchStructureSignalPill key={signal.id} signal={signal} />
        ))}
      </div>

      <div className="mt-3 divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {report.gates.map((gate) => (
          <PageResearchStructureGateRow key={gate.id} gate={gate} />
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">下一步队列</div>
          <div className="text-[11px] text-zinc-400">
            {report.next_actions.length} suggested
          </div>
        </div>
        <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {report.next_actions.slice(0, 5).map((action) => (
            <PageResearchStructureActionRow
              key={action.id}
              action={action}
              applying={applyingActionId === action.id}
              disabled={locked}
              onApply={onApplyAction}
            />
          ))}
        </div>
      </div>

      {report.outline.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-zinc-400">页面目录</div>
          <div className="flex flex-wrap gap-1.5">
            {report.outline.map((item) => (
              <span
                key={item.id}
                className="max-w-full truncate rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                title={item.title}
              >
                H{item.level} {item.title}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
        {report.privacy_note}
      </p>
    </div>
  );
}

function PageResearchStructureActionRow({
  action,
  applying,
  disabled,
  onApply,
}: {
  action: PageResearchStructureAction;
  applying: boolean;
  disabled: boolean;
  onApply: (action: PageResearchStructureAction) => void;
}) {
  const priorityClass =
    action.priority === "high"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
      : action.priority === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <div className="px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {action.label}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            {action.detail}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${priorityClass}`}
        >
          {action.priority}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] text-zinc-400">
          建议块：{action.suggested_block}
        </div>
        <button
          type="button"
          onClick={() => onApply(action)}
          disabled={disabled || applying}
          className="shrink-0 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
          title={
            disabled
              ? "页面锁定时不能插入结构块"
              : "在当前页面底部插入本地结构块"
          }
        >
          {applying ? "插入中" : "插入结构块"}
        </button>
      </div>
    </div>
  );
}

function PageResearchStructureStatusPill({
  status,
}: {
  status: PageResearchStructureStatus;
}) {
  const labels: Record<PageResearchStructureStatus, string> = {
    ready: "结构完整",
    "needs-structure": "待补结构",
    thin: "内容偏薄",
    empty: "空页面",
  };
  const className =
    status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "needs-structure"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PageResearchStructureSignalPill({
  signal,
}: {
  signal: PageResearchStructureSignal;
}) {
  const className =
    signal.status === "ready"
      ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-900/70 dark:bg-zinc-950 dark:text-emerald-300"
      : signal.status === "review"
        ? "border-amber-200 bg-white text-amber-700 dark:border-amber-900/70 dark:bg-zinc-950 dark:text-amber-300"
        : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] ${className}`}
      title={signal.detail}
    >
      {signal.label}: {signal.value}
    </span>
  );
}

function PageResearchStructureGateRow({
  gate,
}: {
  gate: PageResearchStructureGate;
}) {
  const dotClass =
    gate.status === "ready"
      ? "bg-emerald-500"
      : gate.status === "review"
        ? "bg-amber-500"
        : "bg-zinc-300 dark:bg-zinc-700";

  return (
    <div className="flex gap-3 px-3 py-2">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {gate.label}
          </div>
          <div className="shrink-0 text-[11px] text-zinc-400">{gate.evidence}</div>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
          {gate.detail}
        </p>
      </div>
    </div>
  );
}

function readPageShellRoutePreviewSeed(pageId: string): Page | null {
  return (
    readPageRouteHandoff(pageId) ??
    readPendingPageDraft(pageId) ??
    useWorkspaceStore.getState().getPageById(pageId) ??
    null
  );
}

function readPageShellEditableHeaderSeed(pageId: string): {
  title: string;
  properties: PageProperty[];
} {
  const page = readPageShellRoutePreviewSeed(pageId);
  return {
    title: page?.title ?? "",
    properties: page ? parsePageProperties(page.properties) : [],
  };
}

function getPageInfoStats(
  report: PageResearchStructureReport
): PageInfoStats {
  const { summary } = report;
  return {
    blockCount: summary.blocks,
    characterCount: summary.characters,
    codeBlockCount: summary.code_blocks,
    fileBlockCount: summary.file_blocks,
    linkCount: summary.links,
    tableCount: summary.tables,
    wordCount: summary.words,
  };
}

function formatInfoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function downloadJsonFile(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
