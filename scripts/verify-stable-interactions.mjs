#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  webBetaFullVerifier: "scripts/verify-web-beta-full.mjs",
  dailyShell: "src/components/modules/DailyNotesShell.tsx",
  meetingShell: "src/components/modules/MeetingScheduleShell.tsx",
  pageShell: "src/components/providers/PageShell.tsx",
  lazyPagePeekModal: "src/components/page/LazyPagePeekModal.tsx",
  localFirstPageNavigation: "src/lib/pages/localFirstPageNavigation.ts",
  localFirstPageNavigationHook: "src/hooks/useLocalFirstPageNavigation.ts",
  pageRouteHandoff: "src/lib/pages/pageRouteHandoff.ts",
  pendingPageDrafts: "src/lib/pages/pendingPageDrafts.ts",
  dailyLoadingRoute: "src/app/(workspace)/daily/loading.tsx",
  scheduleLoadingRoute: "src/app/(workspace)/schedule/loading.tsx",
};

const failures = [];

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function assertIncludes(sourceLabel, source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(`${sourceLabel} missing ${snippet}: ${message}`);
  }
}

function assertExcludes(sourceLabel, source, snippet, message) {
  if (source.includes(snippet)) {
    failures.push(`${sourceLabel} must not include ${snippet}: ${message}`);
  }
}

function assertOrdered(sourceLabel, source, snippets, message) {
  let offset = 0;
  for (const snippet of snippets) {
    const foundAt = source.indexOf(snippet, offset);
    if (foundAt === -1) {
      failures.push(
        `${sourceLabel} missing ordered snippet ${snippet}: ${message}`
      );
      return;
    }
    offset = foundAt + snippet.length;
  }
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const webBetaFullVerifier = readProjectFile(files.webBetaFullVerifier);
  const dailyShell = readProjectFile(files.dailyShell);
  const meetingShell = readProjectFile(files.meetingShell);
  const pageShell = readProjectFile(files.pageShell);
  const lazyPagePeekModal = readProjectFile(files.lazyPagePeekModal);
  const localFirstPageNavigation = readProjectFile(
    files.localFirstPageNavigation
  );
  const localFirstPageNavigationHook = readProjectFile(
    files.localFirstPageNavigationHook
  );
  const pageRouteHandoff = readProjectFile(files.pageRouteHandoff);
  const pendingPageDrafts = readProjectFile(files.pendingPageDrafts);
  const dailyLoadingRoute = readProjectFile(files.dailyLoadingRoute);
  const scheduleLoadingRoute = readProjectFile(files.scheduleLoadingRoute);

  assertIncludes(
    packageJson,
    packageJson,
    '"verify:stable-interactions"',
    "package.json must expose the P0 stable-interaction gate."
  );
  assertIncludes(
    webBetaFullVerifier,
    webBetaFullVerifier,
    "npm run verify:stable-interactions",
    "Full Web Beta gate must include the P0 stable-interaction gate."
  );

  for (const [sourceLabel, source] of [
    [files.dailyLoadingRoute, dailyLoadingRoute],
    [files.scheduleLoadingRoute, scheduleLoadingRoute],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "ModuleRouteSkeleton",
      "Stable Daily and ZhiHui routes must show an immediate shell before client hydration."
    );
  }

  for (const [snippet, message] of [
    [
      "const openPage = useLocalFirstPageNavigation();",
      "Daily must keep the local-first page opener ready before create/open actions.",
    ],
    [
      "const creatingDateKeyRef = useRef<string | null>(null)",
      "Daily + must use a synchronous duplicate guard so pointer/mouse/click paths cannot race.",
    ],
    [
      "const addNoteOnPointerDown = useCallback",
      "Daily + must start creation on pointer-down.",
    ],
    [
      "const addNoteOnMouseDown = useCallback",
      "Daily + must start creation on mouse-down for browsers that delay click.",
    ],
    [
      "data-create-state={createButtonState}",
      "Daily calendar cells must expose visible create/open state.",
    ],
    [
      "data-local-draft-created=",
      "Daily + must expose when a local draft exists before cloud sync finishes.",
    ],
    [
      "data-testid={`daily-opening-note-${key}`}",
      "Daily calendar must show an immediate opening chip after + is clicked.",
    ],
    [
      "const activateDailyCreate = useCallback",
      "Daily + must use one activation path so pointer, mouse, and click paths cannot compete under load.",
    ],
    [
      "scheduleDailyForegroundAwareIdleTask",
      "Daily background cloud/index work must wait for foreground create/open activity to quiet down.",
    ],
    [
      'data-create-activation="single-entry"',
      "Daily + controls must mark that create activation is consolidated into one guarded entry path.",
    ],
    [
      "scheduleDailyCreateOpenWarmupAfterFeedback",
      "Daily + must defer create-open warmup until after visible local feedback is scheduled.",
    ],
    [
      "const setOpeningDraftAndRef = useCallback",
      "Daily create/open fallback must keep the visible draft state and synchronous retry ref aligned.",
    ],
    [
      "openingDraftRef.current = resolved;",
      "Daily create/open fallback must update the retry ref in the same step as the visible opening state.",
    ],
    [
      "status: \"daily-create-local-shell-requested\"",
      "Daily create must record local-shell latency instead of only cloud latency.",
    ],
    [
      "scheduleDailyCreateFullPageNavigationRetry",
      "Daily full-page mode must retry navigation if the visible route transition stalls.",
    ],
    [
      "scheduleDailyCreatePeekReadyFallback",
      "Daily peek mode must open the full page automatically if the create modal stalls.",
    ],
    [
      "isPagePeekCreateShellStillPreparing(note.id)",
      "Daily peek fallback must still trigger if the local shell clears opening state before the editor is ready.",
    ],
    [
      "DAILY_PEEK_CREATE_READY_RETRY_MS = 450",
      "Daily peek-mode create fallback must be bounded so + never looks like a dead click.",
    ],
    [
      "DAILY_FULL_PAGE_CREATE_NAVIGATION_RETRY_MS = 650",
      "Daily full-page create navigation retry must stay fast enough that + never looks stuck.",
    ],
    [
      "每日纪要弹窗准备较慢，已自动打开完整页面。",
      "Daily peek-mode create fallback must explain why the full page opened.",
    ],
  ]) {
    assertIncludes(files.dailyShell, dailyShell, snippet, message);
  }

  assertOrdered(
    files.dailyShell,
    dailyShell,
    [
      "setOpeningDraftAndRef({ pageId: optimisticNote.id, dateKey });",
      "rememberPendingPageDraft(optimisticNote);",
      "rememberPageRouteHandoff(optimisticNote, \"daily-create\");",
      "setNotes((current) => [",
      "upsertPages([optimisticNote]);",
      "void seedDailyNoteForImmediateOpen(optimisticNote);",
      "scheduleDailyCreateOpenWarmupAfterFeedback();",
      "scheduleDailyCreatePeekReadyFallback(optimisticNote, dateKey);",
    ],
    "Daily + must publish local feedback and route handoff before warming or doing background work."
  );
  assertOrdered(
    files.dailyShell,
    dailyShell,
    [
      "if (!mountedRef.current) {\n            releaseCreatingDate();\n            return;\n          }",
      "openPage(optimisticNote, { source: \"daily-create\" });",
    ],
    "Daily full-page create must route immediately after local draft handoff while still guarding unmount."
  );
  assertOrdered(
    files.dailyShell,
    dailyShell,
    [
      "recordLocalPerformanceSnapshot({",
      "revealDailyNoteOnCalendar(optimisticNote);",
      "scheduleOptimisticDailyHotCacheWrite(optimisticNote",
      "scheduleDailyIdleTask(() => {\n        if (!mountedRef.current) return;\n        void (async () => {",
    ],
    "Daily create must defer hot-cache, root resolution, and sync queue persistence behind visible local feedback while local cache persistence starts non-blocking."
  );

  for (const [snippet, message] of [
    [
      "const openPage = useLocalFirstPageNavigation();",
      "ZhiHui must keep the local-first page opener ready before create/open actions.",
    ],
    [
      "const creatingMeetingDateKeyRef = useRef<string | null>(null)",
      "ZhiHui + must use a synchronous duplicate guard.",
    ],
    [
      "const addMeetingOnPointerDown = useCallback",
      "ZhiHui calendar + must start creation on pointer-down.",
    ],
    [
      "const addMeetingOnMouseDown = useCallback",
      "ZhiHui calendar + must start creation on mouse-down.",
    ],
    [
      "data-create-state={createButtonState}",
      "ZhiHui calendar cells must expose visible create/open state.",
    ],
	    [
	      "data-testid={`meeting-opening-page-${key}`}",
	      "ZhiHui calendar must show an immediate opening chip after + is clicked.",
	    ],
	    [
	      "const setOpeningDraftAndRef = useCallback",
	      "ZhiHui opening draft feedback must keep React state and the retry ref aligned.",
	    ],
	    [
	      "openingDraftRef.current = resolved;",
	      "ZhiHui opening draft ref must update synchronously with visible state.",
	    ],
	    [
	      "status: \"meeting-create-local-shell-requested\"",
	      "ZhiHui create must record local-shell latency instead of only cloud latency.",
    ],
    [
      "scheduleMeetingCreatePeekReadyFallback",
      "ZhiHui create must fall back to a full page if the peek shell stalls.",
    ],
    [
      "scheduleMeetingForegroundAwareIdleTask",
      "ZhiHui background cloud/index work must wait for foreground create/open activity to quiet down.",
    ],
    [
      "scheduleMeetingFirstPaintFallbackRecheck",
      "ZhiHui old-import fallback must re-check whether first paint is already visible before doing heavier metadata work.",
    ],
    [
      "isPagePeekCreateShellStillPreparing(page.id)",
      "ZhiHui create fallback must still trigger if the local shell clears opening state before the editor is ready.",
    ],
    [
      "MEETING_PEEK_CREATE_READY_RETRY_MS = 450",
      "ZhiHui peek-mode create fallback must be bounded so + never looks like a dead click.",
    ],
    [
      "openCreatedMeetingPage(result.page)",
      "ZhiHui imports must open the optimistic meeting page immediately after local create.",
    ],
  ]) {
    assertIncludes(files.meetingShell, meetingShell, snippet, message);
  }

  assertOrdered(
    files.meetingShell,
    meetingShell,
	    [
	      "upsertMeetingInView(optimisticPage);",
	      "setOpeningDraftAndRef({",
	      "setOpeningMeetingId(optimisticPage.id);",
      "rememberPendingPageDraft(optimisticPage);",
      "rememberPageRouteHandoff(optimisticPage, \"meeting-create\");",
      "upsertPages([optimisticPage]);",
      "void seedMeetingPageForImmediateOpen(optimisticPage);",
      "setPeekInitialPage(optimisticPage);",
      "setPeekPageId(optimisticPage.id);",
    ],
    "ZhiHui create must publish local feedback, route handoff, and start non-blocking local persistence before background work."
  );
  assertOrdered(
    files.meetingShell,
    meetingShell,
    [
      "recordLocalPerformanceSnapshot({",
      "revealMeetingOnCalendar(optimisticPage);",
      "scheduleOptimisticMeetingHotCacheWrite(",
      "scheduleMeetingIdleTask(() => {\n        void (async () => {",
    ],
    "ZhiHui create must defer hot-cache, root resolution, sync queue persistence, and runner enqueue behind visible local feedback."
  );

  for (const [sourceLabel, source, snippet, message] of [
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "prepareLocalFirstPageNavigation(page, options.source ?? \"page-open\")",
      "Shared page navigation must seed local state before route push/assign.",
    ],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "rememberPendingPageDraft(page)",
      "Shared page navigation must preserve create drafts for immediate reload recovery.",
    ],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "rememberPageRouteHandoff(page, source)",
      "Shared page navigation must provide metadata handoff for route first paint.",
    ],
    [
      files.localFirstPageNavigationHook,
      localFirstPageNavigationHook,
      "scheduleLocalFirstRouteFallback(href, Boolean(options.replace));",
      "Shared page navigation must schedule a hard browser fallback before client route push/replace can stall.",
    ],
    [
      files.localFirstPageNavigationHook,
      localFirstPageNavigationHook,
      "if (window.location.pathname !== startedPath) return;",
      "Shared page navigation hard fallback must not override a different user navigation.",
    ],
    [
      files.localFirstPageNavigationHook,
      localFirstPageNavigationHook,
      "window.location.assign(href)",
      "Shared page navigation must have a full-page fallback when client routing never starts.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      "stores_page_body_text: false",
      "Route handoff must remain metadata-only.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "rememberPendingPageDraft",
      "Pending drafts must remain available for local-first page opens.",
    ],
  ]) {
    assertIncludes(sourceLabel, source, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "readPageShellEditableHeaderSeed(pageId)",
      "PageShell must seed the header from local draft/route handoff before body hydration.",
    ],
    [
      "readPageRouteHandoff",
      "PageShell must read route handoff metadata for fast first paint.",
    ],
    [
      "readPendingPageDraft",
      "PageShell must read pending drafts for newly-created pages.",
    ],
    [
      "PAGE_METADATA_ONLY_EDITOR_DELAY_MS",
      "PageShell must delay the editor on metadata-only pages.",
    ],
    [
      "PAGE_LARGE_BODY_EDITOR_DELAY_MS",
      "PageShell must delay heavy editor hydration on large imported pages.",
    ],
    [
      "PAGE_LARGE_BODY_PREVIEW_HTML_CHARS",
      "PageShell must use a bounded body preview for large imported pages.",
    ],
    [
      "PageRouteSkeleton",
      "PageShell must render a route skeleton while local metadata is resolving.",
    ],
  ]) {
    assertIncludes(files.pageShell, pageShell, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "LocalFirstPeekLoadingShell",
      "Lazy page peek must render a local-first loading shell while the editor bundle loads.",
    ],
    [
      "data-testid=\"page-peek-loading-shell\"",
      "Lazy page peek loading shell must expose a stable diagnostic hook.",
    ],
    [
      "data-page-id={pageId}",
      "Lazy page peek loading shell must expose the page id so create fallbacks can detect stalled opens.",
    ],
    [
      "isPagePeekCreateShellStillPreparing",
      "Lazy page peek must expose a metadata-only create fallback readiness probe.",
    ],
    [
      "data-local-seed-state={localSeedState}",
      "Lazy page peek shell must expose whether metadata is already visible.",
    ],
    [
      "handleQuickDraftChange",
      "Lazy page peek shell must allow typing into a local draft before the full editor bundle is ready.",
    ],
    [
      "rememberPendingPageDraft(nextPage)",
      "Quick draft edits in the loading shell must be preserved locally.",
    ],
  ]) {
    assertIncludes(files.lazyPagePeekModal, lazyPagePeekModal, snippet, message);
  }

  for (const [sourceLabel, source] of [
    [files.dailyShell, dailyShell],
    [files.meetingShell, meetingShell],
  ]) {
    assertExcludes(
      sourceLabel,
      source,
      "from \"@/components/editor/Editor\"",
      "Stable calendar surfaces must not put the editor bundle in first paint."
    );
    assertExcludes(
      sourceLabel,
      source,
      "onMouseEnter={() => warmDailyNoteContent",
      "Stable calendar hover must not preload body content."
    );
  }

  if (failures.length > 0) {
    console.error("Stable interaction verification failed");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Stable interaction verification passed");
  console.log(
    JSON.stringify(
      {
        format: "zhinote-stable-interactions-verification-receipt",
        format_version: 1,
        receipt_status: "passed",
        protected_surfaces: [
          "/daily",
          "/schedule",
          "/page/[pageId]",
          "page-peek",
        ],
        p0_guards: {
          route_shell_before_hydration: true,
          create_on_pointer_or_mouse_down: true,
          local_draft_visible_before_cloud: true,
          foreground_background_work_deferred: true,
          local_first_page_handoff: true,
          page_body_hydration_deferred: true,
          large_body_preview_bounded: true,
          sync_or_runner_work_deferred: true,
        },
        privacy_boundary:
          "Static source verification only. It does not read browser storage, page bodies, database rows, file names, file bytes, cookies, credentials, cloud data, or local user content.",
      },
      null,
      2
    )
  );
}

run();
