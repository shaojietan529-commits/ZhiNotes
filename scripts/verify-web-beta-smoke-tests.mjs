#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  routeSmokeVerifier: "scripts/verify-route-smoke.mjs",
  hotDataPlan: "src/lib/sync/webBetaHotDataPlan.ts",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  cloudMasterReconcile: "src/lib/sync/cloudMasterReconcile.ts",
  localMetadataManifest: "src/lib/sync/localMetadataManifest.ts",
  coreManifestCompareReceipt: "src/lib/sync/coreManifestCompareReceipt.ts",
  cacheRebuildPreflightReceipt:
    "src/lib/sync/cacheRebuildPreflightReceipt.ts",
  hotCachePolicyPlan: "src/lib/sync/hotCachePolicyPlan.ts",
  hotCacheWarmupPlan: "src/lib/sync/hotCacheWarmupPlan.ts",
  hotCacheWarmupReceipt: "src/lib/sync/hotCacheWarmupReceipt.ts",
  hotCacheLocalIndex: "src/lib/sync/hotCacheLocalIndex.ts",
  dailyHotCacheSnapshot: "src/lib/sync/dailyHotCacheSnapshot.ts",
  meetingHotCacheSnapshot: "src/lib/sync/meetingHotCacheSnapshot.ts",
  hotCacheSelectionSettings: "src/lib/sync/hotCacheSelectionSettings.ts",
  hotCacheSettingsCloud: "src/lib/sync/hotCacheSettingsCloud.ts",
  sidebarWorkspaceSettings: "src/lib/sync/sidebarWorkspaceSettings.ts",
  pageFavoritesWorkspaceSettings:
    "src/lib/sync/pageFavoritesWorkspaceSettings.ts",
  pageViewPreferencesWorkspaceSettings:
    "src/lib/sync/pageViewPreferencesWorkspaceSettings.ts",
  quickSearchWorkspaceSettings:
    "src/lib/sync/quickSearchWorkspaceSettings.ts",
  calendarViewStateWorkspaceSettings:
    "src/lib/sync/calendarViewStateWorkspaceSettings.ts",
  meetingReviewStateWorkspaceSettings:
    "src/lib/sync/meetingReviewStateWorkspaceSettings.ts",
  meetingDeletionTombstonesWorkspaceSettings:
    "src/lib/sync/meetingDeletionTombstonesWorkspaceSettings.ts",
  workspaceSettingsPendingSync: "src/lib/sync/workspaceSettingsPendingSync.ts",
  accountModuleSettingsPendingSync:
    "src/lib/sync/accountModuleSettingsPendingSync.ts",
  workspaceSettingsRoute: "src/app/api/workspaces/[workspaceId]/settings/route.ts",
  accountPageSync: "src/lib/pages/accountPageSync.ts",
  pageRouteHandoff: "src/lib/pages/pageRouteHandoff.ts",
  pendingPageDrafts: "src/lib/pages/pendingPageDrafts.ts",
  pageUpdateBus: "src/lib/pages/pageUpdateBus.ts",
  scopedPageMetadata: "src/lib/pages/scopedPageMetadata.ts",
  pageCloudSync: "src/hooks/usePageCloudSync.ts",
  databaseCloudSync: "src/hooks/useDatabaseCloudSync.ts",
  localFirstPageNavigation: "src/hooks/useLocalFirstPageNavigation.ts",
  localFirstPageNavigationUtil: "src/lib/pages/localFirstPageNavigation.ts",
  localFirstDatabaseNavigation:
    "src/hooks/useLocalFirstDatabaseNavigation.ts",
  localFirstDatabaseNavigationUtil:
    "src/lib/database/localFirstDatabaseNavigation.ts",
  localFirstModuleNavigation: "src/hooks/useLocalFirstModuleNavigation.ts",
  localFirstModuleNavigationUtil:
    "src/lib/modules/localFirstModuleNavigation.ts",
  accountDatabaseSync: "src/lib/database/accountDatabaseSync.ts",
  usePage: "src/hooks/usePage.ts",
  usePages: "src/hooks/usePages.ts",
  workspaceStore: "src/stores/workspaceStore.ts",
  pagePeekModal: "src/components/page/PagePeekModal.tsx",
  usePageFavorites: "src/hooks/usePageFavorites.ts",
  usePageViewPreferences: "src/hooks/usePageViewPreferences.ts",
  useCalendarViewMonthPreference:
    "src/hooks/useCalendarViewMonthPreference.ts",
  useMeetingReviewStatePreference:
    "src/hooks/useMeetingReviewStatePreference.ts",
  useMeetingDeletionTombstonesPreference:
    "src/hooks/useMeetingDeletionTombstonesPreference.ts",
  localSchema: "src/lib/db/local/schema.ts",
  localQueries: "src/lib/db/local/queries.ts",
  fileLocalStore: "src/lib/files/localStore.ts",
  databaseShell: "src/components/database/DatabaseShell.tsx",
  databaseRouteSkeleton: "src/components/database/DatabaseRouteSkeleton.tsx",
  inlineDatabaseNode: "src/components/editor/extensions/InlineDatabaseNode.tsx",
  breadcrumbBlockNode:
    "src/components/editor/extensions/BreadcrumbBlockNode.tsx",
  compareShell: "src/components/comparison/CompareShell.tsx",
  pageProperties: "src/components/page/PageProperties.tsx",
  breadcrumb: "src/components/shared/Breadcrumb.tsx",
  backlinks: "src/components/shared/Backlinks.tsx",
  childPageTree: "src/components/page/ChildPageTree.tsx",
  sidebar: "src/components/sidebar/Sidebar.tsx",
  pageTree: "src/components/sidebar/PageTree.tsx",
  favoritePages: "src/components/sidebar/FavoritePages.tsx",
  trashPages: "src/components/sidebar/TrashPages.tsx",
  subPageTree: "src/components/shared/SubPageTree.tsx",
  quickSearch: "src/components/sidebar/QuickSearch.tsx",
  wikiSuggestion: "src/components/editor/extensions/WikiLinkSuggestion.ts",
  syncShell: "src/components/modules/SyncShell.tsx",
  dailyNotesShell: "src/components/modules/DailyNotesShell.tsx",
  pageShell: "src/components/providers/PageShell.tsx",
  meetingScheduleShell: "src/components/modules/MeetingScheduleShell.tsx",
  notesShell: "src/components/modules/NotesShell.tsx",
  databasesShell: "src/components/modules/DatabasesShell.tsx",
  filesShell: "src/components/modules/FilesShell.tsx",
  meetingsShell: "src/components/modules/MeetingsShell.tsx",
  reportsShell: "src/components/modules/ReportsShell.tsx",
  projectsShell: "src/components/modules/ProjectsShell.tsx",
  moduleDashboard: "src/components/modules/ModuleDashboard.tsx",
  companyResearchShell: "src/components/modules/CompanyResearchShell.tsx",
  portfolioShell: "src/components/modules/PortfolioShell.tsx",
  researchConnectionsPanel:
    "src/components/modules/ResearchConnectionsPanel.tsx",
  researchGraphShell: "src/components/modules/ResearchGraphShell.tsx",
  industryChainShell: "src/components/modules/IndustryChainShell.tsx",
  knowledgeBaseShell: "src/components/modules/KnowledgeBaseShell.tsx",
  aiWorkbenchShell: "src/components/modules/AiWorkbenchShell.tsx",
  pageImportPlanPanel: "src/components/modules/PageImportPlanPanel.tsx",
  moduleRouteSkeleton: "src/components/modules/ModuleRouteSkeleton.tsx",
  pageRouteSkeleton: "src/components/page/PageRouteSkeleton.tsx",
  localPerformance: "src/lib/performance/localPerformance.ts",
  databaseDetailRoute: "src/app/(workspace)/database/[databaseId]/page.tsx",
  databaseDetailRouteLoading:
    "src/app/(workspace)/database/[databaseId]/loading.tsx",
  dailyRoute: "src/app/(workspace)/daily/page.tsx",
  dailyRouteLoading: "src/app/(workspace)/daily/loading.tsx",
  pageDetailRoute: "src/app/(workspace)/page/[pageId]/page.tsx",
  pageDetailRouteLoading: "src/app/(workspace)/page/[pageId]/loading.tsx",
  scheduleRoute: "src/app/(workspace)/schedule/page.tsx",
  scheduleRouteLoading: "src/app/(workspace)/schedule/loading.tsx",
  environmentPreflightRoute:
    "src/app/api/web-beta/environment-preflight/route.ts",
  commentVersionCloudReplayContract:
    "src/lib/sync/commentVersionCloudReplayContract.ts",
  commentVersionReplayReceipt:
    "src/lib/sync/commentVersionReplayReceipt.ts",
  commentVersionReplayAckGate:
    "src/lib/sync/commentVersionReplayAckGate.ts",
  commentVersionReplayApiStub:
    "src/lib/sync/commentVersionReplayApiStub.ts",
  commentVersionReplayRoute:
    "src/app/api/sync/comment-version-replay/route.ts",
};

const requiredPageRoutes = [
  "src/app/page.tsx",
  "src/app/(workspace)/modules/page.tsx",
  "src/app/(workspace)/modules/sync/page.tsx",
  "src/app/(workspace)/modules/reports/page.tsx",
  "src/app/(workspace)/modules/company-research/page.tsx",
  "src/app/(workspace)/modules/projects/page.tsx",
  "src/app/(workspace)/modules/ai/page.tsx",
  "src/app/(workspace)/modules/portfolio/page.tsx",
  "src/app/(workspace)/modules/meetings/page.tsx",
  "src/app/(workspace)/daily/page.tsx",
  "src/app/(workspace)/schedule/page.tsx",
  "src/app/auth/callback/page.tsx",
];

const requiredLoadingRoutes = [
  "src/app/(workspace)/daily/loading.tsx",
  "src/app/(workspace)/schedule/loading.tsx",
  "src/app/(workspace)/page/[pageId]/loading.tsx",
  "src/app/(workspace)/database/[databaseId]/loading.tsx",
];

const gatedOrDisabledApiRoutes = [
  {
    path: "src/app/api/auth/login/start/route.ts",
    guard: 'cloudNotConfiguredResponse("auth-login-start")',
  },
  {
    path: "src/app/api/auth/logout/route.ts",
    guard: 'cloudNotConfiguredResponse("auth-logout")',
  },
  {
    path: "src/app/api/auth/session/route.ts",
    guard: 'cloudNotConfiguredResponse("auth-session")',
  },
  {
    path: "src/app/api/workspaces/route.ts",
    guard: 'cloudNotConfiguredResponse("workspace-list")',
  },
  {
    path: "src/app/api/workspaces/[workspaceId]/bootstrap/route.ts",
    guard: 'cloudNotConfiguredResponse("workspace-bootstrap")',
  },
  {
    path: "src/app/api/workspaces/[workspaceId]/settings/route.ts",
    guard: 'cloudNotConfiguredResponse("workspace-settings-update")',
  },
  {
    path: "src/app/api/workspaces/[workspaceId]/settings/route.ts",
    guard: 'cloudNotConfiguredResponse("workspace-settings-read")',
  },
  {
    path: "src/app/api/sync/push/route.ts",
    guard: "buildSyncPushApiDisabledResponse",
  },
  {
    path: "src/app/api/sync/pull/route.ts",
    guard: "buildSyncPullApiDisabledResponse",
  },
  {
    path: "src/app/api/sync/comment-version-replay/route.ts",
    guard: "buildCommentVersionReplayApiDisabledResponse",
  },
  {
    path: "src/app/api/files/presign/route.ts",
    guard: "buildFilePresignApiDisabledResponse",
  },
  {
    path: "src/app/api/permissions/check/route.ts",
    guard: "buildPermissionCheckApiDisabledResponse",
  },
  {
    path: "src/app/api/audit/events/route.ts",
    guard: "buildAuditEventsApiDisabledResponse",
  },
  {
    path: "src/app/api/cloud/manifest/compare/route.ts",
    guard: "buildCloudManifestCompareApiDisabledResponse",
  },
  {
    path: "src/app/api/cloud/migrations/apply/route.ts",
    guard: "buildCloudMigrationApplyApiDisabledResponse",
  },
  {
    path: "src/app/api/backup/restore-preview/route.ts",
    guard: "buildRestorePreviewApiDisabledResponse",
  },
  {
    path: "src/app/api/backup/restore-apply/route.ts",
    guard: "buildRestoreApplyApiDisabledResponse",
  },
  {
    path: "src/app/api/ai/run/route.ts",
    guard: "buildAiRunDisabledResponse",
  },
];

const smokeCaseIds = [
  "local-verification-bundle",
  "route-contract-coverage",
  "sync-dashboard-preview",
  "auth-callback-empty-state",
  "cloud-alpha-disabled-defaults",
  "environment-preflight-secret-boundary",
  "supabase-disposable-project",
  "private-file-storage-remains-disabled",
  "cloudflare-edge-staging",
  "rollback-and-incident-path",
  "observability-privacy-check",
  "mobile-and-narrow-layout",
];

const requiredBoundarySnippets = [
  "local_plan_only: true",
  "runs_tests: false",
  "sends_network_requests: false",
  "deploys_app: false",
  "creates_accounts: false",
  "connects_cloud_services: false",
  "writes_server_data: false",
  "uploads_workspace_data: false",
  "reads_page_body_text: false",
  "reads_file_bytes: false",
  "exposes_secret_values: false",
  "requires_owner_confirmation_before_preview: true",
];

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

function assertFileExists(relativePath, message) {
  if (!existsSync(path.join(root, relativePath))) {
    failures.push(`${message}: ${relativePath}`);
  }
}

function run() {
  const packageJson = JSON.parse(readProjectFile(files.packageJson));
  const routeSmokeVerifier = readProjectFile(files.routeSmokeVerifier);
  const hotDataPlan = readProjectFile(files.hotDataPlan);
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const cloudMasterReconcile = readProjectFile(files.cloudMasterReconcile);
  const localMetadataManifest = readProjectFile(files.localMetadataManifest);
  const coreManifestCompareReceipt = readProjectFile(
    files.coreManifestCompareReceipt
  );
  const cacheRebuildPreflightReceipt = readProjectFile(
    files.cacheRebuildPreflightReceipt
  );
  const hotCachePolicyPlan = readProjectFile(files.hotCachePolicyPlan);
  const hotCacheWarmupPlan = readProjectFile(files.hotCacheWarmupPlan);
  const hotCacheWarmupReceipt = readProjectFile(files.hotCacheWarmupReceipt);
  const hotCacheLocalIndex = readProjectFile(files.hotCacheLocalIndex);
  const dailyHotCacheSnapshot = readProjectFile(files.dailyHotCacheSnapshot);
  const meetingHotCacheSnapshot = readProjectFile(
    files.meetingHotCacheSnapshot
  );
  const hotCacheSelectionSettings = readProjectFile(
    files.hotCacheSelectionSettings
  );
  const hotCacheSettingsCloud = readProjectFile(files.hotCacheSettingsCloud);
  const sidebarWorkspaceSettings = readProjectFile(
    files.sidebarWorkspaceSettings
  );
  const pageFavoritesWorkspaceSettings = readProjectFile(
    files.pageFavoritesWorkspaceSettings
  );
  const pageViewPreferencesWorkspaceSettings = readProjectFile(
    files.pageViewPreferencesWorkspaceSettings
  );
  const quickSearchWorkspaceSettings = readProjectFile(
    files.quickSearchWorkspaceSettings
  );
  const calendarViewStateWorkspaceSettings = readProjectFile(
    files.calendarViewStateWorkspaceSettings
  );
  const meetingReviewStateWorkspaceSettings = readProjectFile(
    files.meetingReviewStateWorkspaceSettings
  );
  const meetingDeletionTombstonesWorkspaceSettings = readProjectFile(
    files.meetingDeletionTombstonesWorkspaceSettings
  );
  const workspaceSettingsPendingSync = readProjectFile(
    files.workspaceSettingsPendingSync
  );
  const accountModuleSettingsPendingSync = readProjectFile(
    files.accountModuleSettingsPendingSync
  );
  const workspaceSettingsRoute = readProjectFile(files.workspaceSettingsRoute);
  const accountPageSync = readProjectFile(files.accountPageSync);
  const pageRouteHandoff = readProjectFile(files.pageRouteHandoff);
  const pendingPageDrafts = readProjectFile(files.pendingPageDrafts);
  const pageUpdateBus = readProjectFile(files.pageUpdateBus);
  const scopedPageMetadata = readProjectFile(files.scopedPageMetadata);
  const pageCloudSync = readProjectFile(files.pageCloudSync);
  const databaseCloudSync = readProjectFile(files.databaseCloudSync);
  const localFirstPageNavigation = readProjectFile(
    files.localFirstPageNavigation
  );
  const localFirstPageNavigationUtil = readProjectFile(
    files.localFirstPageNavigationUtil
  );
  const localFirstDatabaseNavigation = readProjectFile(
    files.localFirstDatabaseNavigation
  );
  const localFirstDatabaseNavigationUtil = readProjectFile(
    files.localFirstDatabaseNavigationUtil
  );
  const localFirstModuleNavigation = readProjectFile(
    files.localFirstModuleNavigation
  );
  const localFirstModuleNavigationUtil = readProjectFile(
    files.localFirstModuleNavigationUtil
  );
  const accountDatabaseSync = readProjectFile(files.accountDatabaseSync);
  const usePage = readProjectFile(files.usePage);
  const usePages = readProjectFile(files.usePages);
  const workspaceStore = readProjectFile(files.workspaceStore);
  const pagePeekModal = readProjectFile(files.pagePeekModal);
  const usePageFavorites = readProjectFile(files.usePageFavorites);
  const usePageViewPreferences = readProjectFile(files.usePageViewPreferences);
  const useCalendarViewMonthPreference = readProjectFile(
    files.useCalendarViewMonthPreference
  );
  const useMeetingReviewStatePreference = readProjectFile(
    files.useMeetingReviewStatePreference
  );
  const useMeetingDeletionTombstonesPreference = readProjectFile(
    files.useMeetingDeletionTombstonesPreference
  );
  const localSchema = readProjectFile(files.localSchema);
  const localQueries = readProjectFile(files.localQueries);
  const fileLocalStore = readProjectFile(files.fileLocalStore);
  const databaseShell = readProjectFile(files.databaseShell);
  const databaseRouteSkeleton = readProjectFile(files.databaseRouteSkeleton);
  const inlineDatabaseNode = readProjectFile(files.inlineDatabaseNode);
  const breadcrumbBlockNode = readProjectFile(files.breadcrumbBlockNode);
  const compareShell = readProjectFile(files.compareShell);
  const pageProperties = readProjectFile(files.pageProperties);
  const breadcrumb = readProjectFile(files.breadcrumb);
  const backlinks = readProjectFile(files.backlinks);
  const childPageTree = readProjectFile(files.childPageTree);
  const sidebar = readProjectFile(files.sidebar);
  const pageTree = readProjectFile(files.pageTree);
  const favoritePages = readProjectFile(files.favoritePages);
  const trashPages = readProjectFile(files.trashPages);
  const subPageTree = readProjectFile(files.subPageTree);
  const quickSearch = readProjectFile(files.quickSearch);
  const wikiSuggestion = readProjectFile(files.wikiSuggestion);
  const syncShell = readProjectFile(files.syncShell);
  const dailyNotesShell = readProjectFile(files.dailyNotesShell);
  const pageShell = readProjectFile(files.pageShell);
  const meetingScheduleShell = readProjectFile(files.meetingScheduleShell);
  const notesShell = readProjectFile(files.notesShell);
  const databasesShell = readProjectFile(files.databasesShell);
  const filesShell = readProjectFile(files.filesShell);
  const meetingsShell = readProjectFile(files.meetingsShell);
  const reportsShell = readProjectFile(files.reportsShell);
  const projectsShell = readProjectFile(files.projectsShell);
  const moduleDashboard = readProjectFile(files.moduleDashboard);
  const companyResearchShell = readProjectFile(files.companyResearchShell);
  const portfolioShell = readProjectFile(files.portfolioShell);
  const researchConnectionsPanel = readProjectFile(
    files.researchConnectionsPanel
  );
  const researchGraphShell = readProjectFile(files.researchGraphShell);
  const industryChainShell = readProjectFile(files.industryChainShell);
  const knowledgeBaseShell = readProjectFile(files.knowledgeBaseShell);
  const aiWorkbenchShell = readProjectFile(files.aiWorkbenchShell);
  const pageImportPlanPanel = readProjectFile(files.pageImportPlanPanel);
  const moduleRouteSkeleton = readProjectFile(files.moduleRouteSkeleton);
  const pageRouteSkeleton = readProjectFile(files.pageRouteSkeleton);
  const localPerformance = readProjectFile(files.localPerformance);
  const databaseDetailRoute = readProjectFile(files.databaseDetailRoute);
  const databaseDetailRouteLoading = readProjectFile(
    files.databaseDetailRouteLoading
  );
  const dailyRoute = readProjectFile(files.dailyRoute);
  const dailyRouteLoading = readProjectFile(files.dailyRouteLoading);
  const pageDetailRoute = readProjectFile(files.pageDetailRoute);
  const pageDetailRouteLoading = readProjectFile(files.pageDetailRouteLoading);
  const scheduleRoute = readProjectFile(files.scheduleRoute);
  const scheduleRouteLoading = readProjectFile(files.scheduleRouteLoading);
  const environmentPreflightRoute = readProjectFile(
    files.environmentPreflightRoute
  );
  const commentVersionCloudReplayContract = readProjectFile(
    files.commentVersionCloudReplayContract
  );
  const commentVersionReplayReceipt = readProjectFile(
    files.commentVersionReplayReceipt
  );
  const commentVersionReplayAckGate = readProjectFile(
    files.commentVersionReplayAckGate
  );
  const commentVersionReplayApiStub = readProjectFile(
    files.commentVersionReplayApiStub
  );
  const commentVersionReplayRoute = readProjectFile(
    files.commentVersionReplayRoute
  );

  const scripts = packageJson.scripts ?? {};
  for (const scriptName of [
    "lint",
    "build",
    "verify:web-beta",
    "verify:replay-harness",
    "verify:route-smoke",
  ]) {
    if (typeof scripts[scriptName] !== "string") {
      failures.push(`package.json missing script ${scriptName}`);
    }
  }

  assertIncludes(
    files.routeSmokeVerifier,
    routeSmokeVerifier,
    "nextBin",
    "Route smoke verifier must start the local Next.js server directly without browser automation dependencies."
  );
  assertIncludes(
    files.routeSmokeVerifier,
    routeSmokeVerifier,
    'path: "/daily"',
    "Route smoke verifier must cover the daily calendar route."
  );
  assertIncludes(
    files.routeSmokeVerifier,
    routeSmokeVerifier,
    'path: "/page/zhinote-route-prefetch"',
    "Route smoke verifier must cover the page shell route used for warm navigation."
  );
  assertIncludes(
    files.routeSmokeVerifier,
    routeSmokeVerifier,
    "privacyBoundary",
    "Route smoke verifier must document that it does not read private workspace data."
  );
  assertExcludes(
    files.routeSmokeVerifier,
    routeSmokeVerifier,
    "playwright",
    "Route smoke verifier must avoid Playwright because it is not installed in the repo."
  );

  for (const routeFile of requiredPageRoutes) {
    assertFileExists(routeFile, "Smoke route check missing page route");
  }

  for (const loadingRouteFile of requiredLoadingRoutes) {
    assertFileExists(
      loadingRouteFile,
      "Smoke route check missing workspace loading route"
    );
  }

  for (const [sourceLabel, source] of [
    [files.dailyRoute, dailyRoute],
    [files.dailyRouteLoading, dailyRouteLoading],
    [files.scheduleRoute, scheduleRoute],
    [files.scheduleRouteLoading, scheduleRouteLoading],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "ModuleRouteSkeleton",
      "Daily and meeting calendar routes must show an immediate loading shell before client hydration completes."
    );
  }

  for (const [snippet, message] of [
    [
      "useLocalFirstPageNavigation",
      "Daily notes must use the shared local-first page navigation hook.",
    ],
    [
      "const openPage = useLocalFirstPageNavigation();",
      "Daily notes must keep a local-first opener ready before create/open actions.",
    ],
    [
      'openPage(optimisticNote, { source: "daily-create" });',
      "Daily note creation must open the optimistic page immediately, before cloud persistence finishes.",
    ],
    [
      "openPage(note, { source });",
      "Existing daily notes must open through local-first route handoff.",
    ],
    [
      'openPage(pageId, { source: "daily-open" });',
      "Daily note fallback opens must still use the local-first route handoff.",
    ],
  ]) {
    assertIncludes(files.dailyNotesShell, dailyNotesShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "router.push(pageRoute);",
      "Daily note creation must not wait on a page route push path after optimistic create.",
    ],
    [
      "router.push(`/page/${note.id}`);",
      "Daily note full-page opens must not bypass the local-first route handoff.",
    ],
    [
      "router.push(`/page/${pageId}`);",
      "Daily note fallback opens must not bypass the local-first route handoff.",
    ],
  ]) {
    assertExcludes(files.dailyNotesShell, dailyNotesShell, snippet, message);
  }

  for (const [sourceLabel, source] of [
    [files.pageDetailRoute, pageDetailRoute],
    [files.pageDetailRouteLoading, pageDetailRouteLoading],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "PageRouteSkeleton",
      "Page detail route must show an immediate loading shell before client hydration completes."
    );
  }
  for (const snippet of [
    "readPageRouteHandoff",
    "PageRouteLoadingSkeleton",
    "previewPage.title",
    "previewPage.icon",
  ]) {
    assertIncludes(
      files.pageDetailRoute,
      pageDetailRoute,
      snippet,
      "Page route dynamic fallback must show handed-off metadata before the full page shell hydrates."
    );
  }
  for (const snippet of [
    "preview?:",
    'data-testid="page-route-preview-title"',
    "已接收页面，正在加载编辑器",
  ]) {
    assertIncludes(
      files.pageRouteSkeleton,
      pageRouteSkeleton,
      snippet,
      "Page route skeleton must render local-first handoff metadata during chunk loading."
    );
  }
  for (const [sourceLabel, source] of [
    [files.databaseDetailRoute, databaseDetailRoute],
    [files.databaseDetailRouteLoading, databaseDetailRouteLoading],
    [files.databaseShell, databaseShell],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "DatabaseRouteSkeleton",
      "Database detail routes must show an immediate loading shell before database records hydrate."
    );
  }

  assertIncludes(
    files.moduleRouteSkeleton,
    moduleRouteSkeleton,
    "先显示本地热缓存",
    "Workspace module loading shell must explain that local hot cache renders first."
  );
  assertIncludes(
    files.moduleRouteSkeleton,
    moduleRouteSkeleton,
    "后台刷新云端索引",
    "Workspace module loading shell must explain cloud index hydration happens in the background."
  );
  assertIncludes(
    files.pageRouteSkeleton,
    pageRouteSkeleton,
    "本地缓存会先加载",
    "Page loading shell must explain local cache renders first."
  );
  assertIncludes(
    files.pageRouteSkeleton,
    pageRouteSkeleton,
    "云端同步在后台继续",
    "Page loading shell must explain cloud sync continues in the background."
  );
  assertIncludes(
    files.localPerformance,
    localPerformance,
    'format: "zhinote-local-performance-snapshot"',
    "Local performance snapshots must use an explicit privacy-auditable format."
  );
  for (const boundarySnippet of [
    "reads_page_body_text: false",
    "reads_database_row_values: false",
    "reads_comment_bodies: false",
    "reads_file_bytes: false",
    "uploads_workspace_data: false",
    "mutates_workspace_data: false",
    "includes_raw_page_id: false",
    "includes_page_title: false",
  ]) {
    assertIncludes(
      files.localPerformance,
      localPerformance,
      boundarySnippet,
      "Local performance snapshots must remain metadata-only and local-only."
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-comment-version-cloud-replay-contract"',
      "Comment/version replay smoke coverage must include the stable contract format.",
    ],
    [
      'contract_status: "owner-gated-content-sync-contract"',
      "Comment/version replay smoke coverage must keep content sync owner gated.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Comment/version replay smoke coverage must keep ordinary sync pending-only.",
    ],
    [
      "sync_log_contains_row_ids_only: true",
      "Comment/version replay smoke coverage must keep sync_log previews row-id-only.",
    ],
    [
      "content_payload_loaded_only_after_owner_confirmation: true",
      "Comment/version replay smoke coverage must gate content loading.",
    ],
    [
      "metadata_reports_must_exclude_content: true",
      "Comment/version replay smoke coverage must keep metadata reports content-free.",
    ],
    [
      "reads_comment_bodies: false",
      "Comment/version replay smoke coverage must not read comment bodies.",
    ],
    [
      "reads_version_snapshots: false",
      "Comment/version replay smoke coverage must not read version snapshots.",
    ],
    [
      "cloud.comments",
      "Comment/version replay smoke coverage must include the comments cloud target.",
    ],
    [
      "cloud.page_versions",
      "Comment/version replay smoke coverage must include the page_versions cloud target.",
    ],
    [
      "page_versions now uses deleted_at as a soft tombstone",
      "Comment/version replay smoke coverage must include the page_versions tombstone rule.",
    ],
  ]) {
    assertIncludes(
      files.commentVersionCloudReplayContract,
      commentVersionCloudReplayContract,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "uploads_workspace_data: true",
      "Comment/version replay must not upload workspace data directly.",
    ],
    [
      "reads_comment_bodies: true",
      "Comment/version replay must not read comment bodies.",
    ],
    [
      "reads_version_snapshots: true",
      "Comment/version replay must not read version snapshots.",
    ],
  ]) {
    assertExcludes(
      files.commentVersionCloudReplayContract,
      commentVersionCloudReplayContract,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildCommentVersionCloudReplayContract",
      "Sync smoke coverage must build the comment/version replay contract.",
    ],
    [
      "评论 / 版本上云回放合同",
      "Sync smoke coverage must expose the comment/version replay panel.",
    ],
    [
      "owner-gated content sync",
      "Sync smoke coverage must expose the owner-gated content-sync boundary.",
    ],
    [
      "pending-only",
      "Sync smoke coverage must expose the pending-only boundary.",
    ],
    [
      "不读取评论正文、版本快照或页面正文",
      "Sync smoke coverage must expose the no-content-read boundary.",
    ],
    [
      "page_versions deleted_at tombstone",
      "Sync smoke coverage must expose the page_versions tombstone.",
    ],
    [
      "cloud.comments",
      "Sync smoke coverage must expose the comments cloud target.",
    ],
    [
      "cloud.page_versions",
      "Sync smoke coverage must expose the page_versions cloud target.",
    ],
  ]) {
    assertIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.localSchema,
      localSchema,
      "CREATE TABLE IF NOT EXISTS page_versions",
      "Local schema must define page_versions for replay smoke coverage.",
    ],
    [
      files.localSchema,
      localSchema,
      "deleted_at    TEXT",
      "Local page_versions schema must include deleted_at.",
    ],
    [
      files.localQueries,
      localQueries,
      "UPDATE page_versions SET deleted_at = ?",
      "Version deletion must be a soft tombstone update.",
    ],
    [
      files.localQueries,
      localQueries,
      "FROM page_versions WHERE page_id = ? AND deleted_at IS NULL",
      "Version reads must ignore soft-deleted records.",
    ],
  ]) {
    assertIncludes(sourceLabel, source, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-comment-version-replay-receipt-draft"',
      "Comment/version replay receipt smoke coverage must include the stable receipt format.",
    ],
    [
      '"blocked-until-cloud-manifest-counts"',
      "Comment/version replay receipt smoke coverage must block ack until cloud counts exist.",
    ],
    [
      "local_draft_only: true",
      "Comment/version replay receipt smoke coverage must stay local draft only.",
    ],
    [
      "reads_comment_bodies: false",
      "Comment/version replay receipt smoke coverage must not read comment bodies.",
    ],
    [
      "reads_version_snapshots: false",
      "Comment/version replay receipt smoke coverage must not read version snapshots.",
    ],
    [
      "reads_cloud_manifest: false",
      "Comment/version replay receipt smoke coverage must not read cloud manifests.",
    ],
    [
      "can_acknowledge_without_cloud_counts: false",
      "Comment/version replay receipt smoke coverage must block ack without counts.",
    ],
    [
      "can_mark_local_rows_synced: false",
      "Comment/version replay receipt smoke coverage must block marking local rows synced.",
    ],
    [
      "cloud_manifest_count: null",
      "Comment/version replay receipt smoke coverage must keep cloud counts empty.",
    ],
    [
      "can_acknowledge_rows: false",
      "Comment/version replay receipt smoke coverage must block surface ack.",
    ],
    [
      "cloud.comments manifest count",
      "Comment/version replay receipt smoke coverage must require comments count evidence.",
    ],
    [
      "cloud.page_versions manifest count",
      "Comment/version replay receipt smoke coverage must require versions count evidence.",
    ],
    [
      "local_rows_remain_pending: true",
      "Comment/version replay receipt smoke coverage must keep local rows pending.",
    ],
  ]) {
    assertIncludes(
      files.commentVersionReplayReceipt,
      commentVersionReplayReceipt,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-comment-version-replay-ack-gate"',
      "Comment/version replay ack gate smoke coverage must include the stable format.",
    ],
    [
      '"blocked-until-durable-remote-receipt"',
      "Comment/version replay ack gate smoke coverage must block until remote receipt exists.",
    ],
    [
      "local_gate_only: true",
      "Comment/version replay ack gate smoke coverage must stay local only.",
    ],
    [
      "reads_comment_bodies: false",
      "Comment/version replay ack gate smoke coverage must not read comment bodies.",
    ],
    [
      "reads_sync_log_payloads: false",
      "Comment/version replay ack gate smoke coverage must not read sync_log payloads.",
    ],
    [
      "reads_cloud_manifest: false",
      "Comment/version replay ack gate smoke coverage must not read cloud manifests.",
    ],
    [
      "connects_cloud_services: false",
      "Comment/version replay ack gate smoke coverage must not connect cloud services.",
    ],
    [
      "can_mark_local_rows_synced_now: false",
      "Comment/version replay ack gate smoke coverage must block marking rows synced.",
    ],
    [
      "can_update_sync_log_now: false",
      "Comment/version replay ack gate smoke coverage must block sync_log updates.",
    ],
    [
      'allowed_update_scope: "none"',
      "Comment/version replay ack gate smoke coverage must forbid local update scope.",
    ],
    [
      "cloud.comments manifest count equals accepted comment rows",
      "Comment/version replay ack gate smoke coverage must require comment count evidence.",
    ],
    [
      "cloud.page_versions manifest count equals accepted version rows",
      "Comment/version replay ack gate smoke coverage must require version count evidence.",
    ],
  ]) {
    assertIncludes(
      files.commentVersionReplayAckGate,
      commentVersionReplayAckGate,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildCommentVersionReplayReceiptDraft",
      "Sync smoke coverage must build the comment/version replay receipt draft.",
    ],
    [
      "评论 / 版本回放 manifest count 与 ack 收据草案",
      "Sync smoke coverage must render the replay receipt panel.",
    ],
    [
      "导出回放收据草案",
      "Sync smoke coverage must expose replay receipt export.",
    ],
    [
      "cloud_manifest_count: null",
      "Sync smoke coverage must show missing cloud counts.",
    ],
    [
      "不能 acknowledge rows",
      "Sync smoke coverage must explain ack is blocked.",
    ],
    [
      "不能标记 synced",
      "Sync smoke coverage must explain local rows remain pending.",
    ],
    [
      "buildCommentVersionReplayAckGate",
      "Sync smoke coverage must build the comment/version replay ack gate.",
    ],
    [
      "ack gate closed：缺少 durable remote receipt",
      "Sync smoke coverage must render the ack gate status.",
    ],
    [
      "missing remote evidence",
      "Sync smoke coverage must render missing remote evidence.",
    ],
    [
      "不能把任何本地 pending sync_log 行改成 synced",
      "Sync smoke coverage must explain the ack gate blocks sync_log updates.",
    ],
  ]) {
    assertIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-comment-version-replay-api-disabled"',
      "Comment/version replay API smoke coverage must include the stable disabled format.",
    ],
    [
      "buildCommentVersionReplayApiDisabledResponse",
      "Comment/version replay API smoke coverage must expose a disabled response builder.",
    ],
    [
      'api_id: "comment-version-replay"',
      "Comment/version replay API smoke coverage must identify the route.",
    ],
    [
      'path: "/api/sync/comment-version-replay"',
      "Comment/version replay API smoke coverage must bind to the route path.",
    ],
    [
      "can_replay_now: false",
      "Comment/version replay API smoke coverage must keep replay disabled.",
    ],
    [
      "can_read_request_body_now: false",
      "Comment/version replay API smoke coverage must not read request bodies.",
    ],
    [
      "can_read_comment_bodies_now: false",
      "Comment/version replay API smoke coverage must not read comment bodies.",
    ],
    [
      "can_read_version_snapshots_now: false",
      "Comment/version replay API smoke coverage must not read version snapshots.",
    ],
    [
      "requires_owner_confirmation_before_replay: true",
      "Comment/version replay API smoke coverage must require owner confirmation.",
    ],
    [
      "requires_manifest_counts_before_ack: true",
      "Comment/version replay API smoke coverage must require manifest counts before ack.",
    ],
    [
      "requires_comment_manifest_count_before_ack: true",
      "Comment/version replay API smoke coverage must require cloud.comments count acknowledgement.",
    ],
    [
      "requires_page_versions_manifest_count_before_ack: true",
      "Comment/version replay API smoke coverage must require cloud.page_versions count acknowledgement.",
    ],
    [
      'schema_status: "planned-owner-gated-row-id-only"',
      "Comment/version replay API smoke coverage must keep request schema row-id-only.",
    ],
    [
      'schema_status: "planned-count-and-ack-receipt-only"',
      "Comment/version replay API smoke coverage must keep response schema count-only.",
    ],
    [
      '"comment-content-blocked"',
      "Comment/version replay API smoke coverage must include comment content fixture rejection.",
    ],
    [
      '"version-snapshot-blocked"',
      "Comment/version replay API smoke coverage must include version snapshot fixture rejection.",
    ],
    [
      "comment_body",
      "Comment/version replay API smoke coverage must forbid comment bodies.",
    ],
    [
      "version_snapshot",
      "Comment/version replay API smoke coverage must forbid version snapshots.",
    ],
  ]) {
    assertIncludes(
      files.commentVersionReplayApiStub,
      commentVersionReplayApiStub,
      snippet,
      message
    );
  }
  assertIncludes(
    files.commentVersionReplayRoute,
    commentVersionReplayRoute,
    "buildCommentVersionReplayApiDisabledResponse",
    "Comment/version replay route must return its dedicated disabled response."
  );
  for (const [snippet, message] of [
    [
      "buildCommentVersionReplayApiDisabledResponse",
      "Sync smoke coverage must build the comment/version replay API guard.",
    ],
    [
      "handleExportCommentVersionReplayApiGuard",
      "Sync smoke coverage must expose comment/version replay guard export.",
    ],
    [
      "评论 / 版本回放 API 防护",
      "Sync smoke coverage must render the comment/version replay API guard.",
    ],
    [
      "导出评论/版本回放防护",
      "Sync smoke coverage must expose the comment/version replay export button.",
    ],
    [
      "commentVersionReplayApiGuard.can_read_comment_bodies_now",
      "Sync smoke coverage must show that comment body reads are disabled.",
    ],
    [
      ".requires_manifest_counts_before_ack",
      "Sync smoke coverage must show the manifest count acknowledgement gate.",
    ],
  ]) {
    assertIncludes(files.syncShell, syncShell, snippet, message);
  }
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'kind: "daily-calendar"',
    "Daily calendar loads must record metadata-only local performance snapshots."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'route: "/daily"',
    "Daily performance snapshots must not include a raw page id."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    'kind: "page-open"',
    "Page opens must record metadata-only local performance snapshots."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    'route: "/page/[pageId]"',
    "Page performance snapshots must not include the raw page id."
  );
  assertIncludes(
    files.localPerformance,
    localPerformance,
    '"page-peek"',
    "Local performance snapshots must accept page peek timing records."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    'kind: "page-peek"',
    "Page peek modal must record metadata-only local performance snapshots."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    'route: "/page/[pageId]#peek"',
    "Page peek performance snapshots must not include the raw page id."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "本地流畅度快照",
    "Sync UI must show local performance snapshots for fluency debugging."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "页面预览平均",
    "Sync UI must show page peek performance averages."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "local-performance-snapshots",
    "Sync UI must provide a stable local performance panel anchor."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "readLocalPerformanceSnapshots",
    "Sync UI must read local-only performance snapshots without cloud upload."
  );
  assertIncludes(
    files.databaseRouteSkeleton,
    databaseRouteSkeleton,
    "本地热缓存会先加载",
    "Database loading shell must explain local hot cache renders first."
  );
  assertIncludes(
    files.databaseRouteSkeleton,
    databaseRouteSkeleton,
    "云端索引在后台继续",
    "Database loading shell must explain cloud index hydration continues in the background."
  );
  assertIncludes(
    files.databaseRouteSkeleton,
    databaseRouteSkeleton,
    "aria-live",
    "Database loading shell must announce loading progress accessibly."
  );
  assertIncludes(
    files.fileLocalStore,
    fileLocalStore,
    'METADATA_STORE_NAME = "file_metadata"',
    "File library first paint must have a metadata-only IndexedDB index."
  );
  assertIncludes(
    files.fileLocalStore,
    fileLocalStore,
    "listStoredPageFileMetadata",
    "File library must be able to list local file metadata without loading every file payload."
  );
  assertIncludes(
    files.filesShell,
    filesShell,
    "listStoredPageFileMetadata",
    "Files module must render its workbench from file metadata first."
  );
  assertIncludes(
    files.filesShell,
    filesShell,
    "getStoredPageFile(fileId)",
    "Files module must defer full file payload reads until a single-file action."
  );

  for (const { path: routeFile, guard } of gatedOrDisabledApiRoutes) {
    const source = readProjectFile(routeFile);
    assertIncludes(
      routeFile,
      source,
      guard,
      "Smoke test requires high-risk API routes to stay disabled or cloud-gated by default."
    );
  }

  for (const smokeCaseId of smokeCaseIds) {
    assertIncludes(
      files.smokeTestPlan,
      smokeTestPlan,
      `id: "${smokeCaseId}"`,
      "Smoke test plan must keep every preview review case."
    );
  }

  for (const snippet of requiredBoundarySnippets) {
    assertIncludes(
      files.smokeTestPlan,
      smokeTestPlan,
      snippet,
      "Smoke test plan must preserve local-only privacy boundaries."
    );
  }

  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "npm run lint, npm run verify:web-beta, npm run verify:replay-harness, and npm run build all pass",
    "Smoke test plan must require the local verification bundle."
  );
  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "With cloud flags false",
    "Smoke test plan must explicitly verify disabled cloud defaults."
  );
  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "Do not upload HTML reports, PDFs, Excel, Word, PPT, notebooks, archives, or file bytes",
    "Smoke test plan must protect private file uploads."
  );
  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "Cloudflare cache bypass, auth callback redirects, TLS, WAF, rate limits, and rollback",
    "Smoke test plan must cover Cloudflare staging behavior."
  );
  for (const [snippet, message] of [
    [
      'format: "zhinote-web-beta-hot-data-plan"',
      "Hot data plan must keep a stable export format.",
    ],
    [
      'id: "current-month-daily"',
      "Hot data plan must cover current-month daily notes.",
    ],
    [
      'id: "current-month-meetings"',
      "Hot data plan must cover current-month meetings.",
    ],
    [
      'id: "favorite-pages"',
      "Hot data plan must cover favorite pages.",
    ],
    [
      'id: "recent-pages"',
      "Hot data plan must cover recent pages.",
    ],
    [
      "reads_page_body_text: false",
      "Hot data plan must not read page body text.",
    ],
    [
      "stores_meeting_credentials: false",
      "Hot data plan must not store meeting credentials.",
    ],
    [
      '"meeting.join_url"',
      "Hot data plan must exclude meeting join URLs.",
    ],
  ]) {
    assertIncludes(files.hotDataPlan, hotDataPlan, snippet, message);
  }
  assertIncludes(
    files.syncShell,
    syncShell,
    "冒烟测试计划",
    "Sync UI must render the smoke test plan panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出冒烟测试计划",
    "Sync UI must expose smoke test plan export."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    'architecture_target: "cloud-master-local-hot-cache"',
    "Smoke verifier must keep the cloud-master local-cache target report wired."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    'report_status: "local-audit-only"',
    "Smoke verifier must keep the reconcile report local-audit-only."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "ordinary_sync_pending_only: true",
    "Smoke verifier must preserve pending-only sync for cloud-master migration."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "workspace_settings、account_settings、module_settings",
    "Smoke verifier must show workspace/account/module settings share the cloud-master settings boundary."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "页面、数据库、hot_cache_preferences 和常用 workspace_settings 已有重建入口",
    "Smoke verifier must include workspace_settings in the rebuildable local-cache path."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "指定数据库常驻本地",
    "Smoke verifier must keep pinned databases reflected in user-selected hot cache reconciliation."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "只上传 setting metadata，不上传本地缓存",
    "Smoke verifier must keep user-selected hot cache settings pending-only."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "migration_checks",
    "Smoke verifier must keep per-domain migration dry-run checks in the reconcile report."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "cloud_evidence_required",
    "Smoke verifier must keep cloud evidence requirements for migration dry-run."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "local_evidence_required",
    "Smoke verifier must keep local evidence requirements for migration dry-run."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "pending_queue_rule",
    "Smoke verifier must keep pending queue rules for migration dry-run."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "rebuild_proof_required",
    "Smoke verifier must keep cache rebuild proof requirements for migration dry-run."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "重复风险",
    "Smoke verifier must keep duplicate-risk accounting for migration dry-run."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "遗漏风险",
    "Smoke verifier must keep missing-risk accounting for migration dry-run."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "旧缓存覆盖风险",
    "Smoke verifier must keep stale-cache overwrite risk accounting for migration dry-run."
  );
  assertIncludes(
    files.cloudMasterReconcile,
    cloudMasterReconcile,
    "It does not read page body text, comment bodies, file bytes, token values, or upload data.",
    "Smoke verifier must preserve the sensitive-content privacy boundary."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "热数据与流畅度",
    "Sync UI must render the hot data plan panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "全域上云对账",
    "Sync UI must render the cloud master reconcile panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出对账报告",
    "Sync UI must expose the cloud master reconcile export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "迁移 dry-run 明细",
    "Sync UI must render per-domain migration dry-run checks."
  );
  assertIncludes(
    files.localMetadataManifest,
    localMetadataManifest,
    'manifest_status: "local-metadata-only"',
    "Smoke verifier must keep the local metadata manifest metadata-only."
  );
  assertIncludes(
    files.localMetadataManifest,
    localMetadataManifest,
    "reads_page_body_text: false",
    "Smoke verifier must keep page body reads disabled in the local metadata manifest."
  );
  assertIncludes(
    files.localMetadataManifest,
    localMetadataManifest,
    "reads_file_bytes: false",
    "Smoke verifier must keep file byte reads disabled in the local metadata manifest."
  );
  assertIncludes(
    files.localMetadataManifest,
    localMetadataManifest,
    "local_workspace_hash",
    "Smoke verifier must ensure local workspace ids are hashed in the manifest."
  );
  assertIncludes(
    files.localMetadataManifest,
    localMetadataManifest,
    "cloud_workspace_hash",
    "Smoke verifier must ensure cloud workspace ids are hashed in the manifest."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "本地 metadata manifest",
    "Sync UI must render the local metadata manifest panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出本地 manifest",
    "Sync UI must expose the local metadata manifest export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "核心域云端 manifest 对账",
    "Sync UI must show the core cloud manifest compare panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "只读检查核心域",
    "Sync UI must expose the read-only core manifest check action."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "页面、每日纪要、会议和数据库这四个",
    "Sync UI core manifest compare must cover daily notes and meetings."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "不会上传或清理本机缓存",
    "Core manifest compare must stay read-only."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "不读取页面正文、数据库值、评论正文或文件字节",
    "Core manifest compare must preserve sensitive content boundaries."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "buildCoreManifestCompareSummary",
    "Core manifest compare must expose a structured summary for rebuild readiness."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "buildCoreManifestCompareReceipt",
    "Core manifest compare must build a metadata-only local receipt."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出对账收据",
    "Core manifest compare must expose receipt export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "zhinote-core-manifest-compare-receipt",
    "Core manifest compare receipt export must use the receipt format in its filename."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "收据 ID",
    "Core manifest compare must show the receipt id."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    'format: "zhinote-core-manifest-compare-receipt"',
    "Core manifest compare receipt must declare its stable format."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    'receipt_status: "metadata-only-local-receipt"',
    "Core manifest compare receipt must remain a local metadata-only receipt."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    "includes_only_counts_watermarks_and_gates: true",
    "Core manifest compare receipt must only include counts, watermarks, and gates."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    "reads_page_body_text: false",
    "Core manifest compare receipt must not read page body text."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    "reads_database_row_values: false",
    "Core manifest compare receipt must not read database row values."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    "uploads_workspace_data: false",
    "Core manifest compare receipt must not upload workspace data."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    "overwrites_local_cache: false",
    "Core manifest compare receipt must not overwrite local cache."
  );
  assertIncludes(
    files.coreManifestCompareReceipt,
    coreManifestCompareReceipt,
    "buildCoreManifestCompareReceipt",
    "Core manifest compare receipt builder must be exported for Sync UI."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "countDelta",
    "Core manifest compare must expose count deltas for mismatch triage."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "deletedDelta",
    "Core manifest compare must expose deleted-count deltas for mismatch triage."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "watermarkMatches",
    "Core manifest compare must expose watermark equality for mismatch triage."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "diffReasons",
    "Core manifest compare must explain why each domain is blocked or mismatched."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "reviewChecklist",
    "Core manifest compare must expose an owner review checklist per domain."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "云端 manifest 是重建来源；本地缓存只是复印件，不能反向覆盖云端。",
    "Core manifest compare must keep the cloud manifest as the cache rebuild source of truth."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "未上传编辑必须保留，不能被云端旧值覆盖",
    "Core manifest compare must preserve unuploaded local edits before rebuild."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "先导出",
    "Core manifest compare must require manifest diff export before manual rebuild review."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "buildCoreDateManifestDiffReport",
    "Core manifest compare must build date-level metadata diff evidence."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "日期级 metadata 差异",
    "Sync UI must render date-level metadata diffs for daily notes and meetings."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "不展示标题、正文、会议链接、会议号、密码、评论或文件字节",
    "Date-level manifest diff must preserve sensitive content boundaries."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "CORE_MANIFEST_DATE_DIFF_ROW_LIMIT",
    "Date-level manifest diff must cap visible rows to keep large imports responsive."
  );
  assertIncludes(
    files.hotCachePolicyPlan,
    hotCachePolicyPlan,
    'plan_status: "local-policy-only"',
    "Smoke verifier must keep the hot cache plan local-policy-only."
  );
  assertIncludes(
    files.hotCachePolicyPlan,
    hotCachePolicyPlan,
    "mutates_local_cache: false",
    "Smoke verifier must keep hot cache planning read-only."
  );
  assertIncludes(
    files.hotCachePolicyPlan,
    hotCachePolicyPlan,
    'id: "pending-sync-never-evict"',
    "Smoke verifier must ensure pending edits are never evicted."
  );
  assertIncludes(
    files.hotCachePolicyPlan,
    hotCachePolicyPlan,
    'id: "recent-30-days"',
    "Smoke verifier must keep the recent-content hot cache policy."
  );
  assertIncludes(
    files.hotCachePolicyPlan,
    hotCachePolicyPlan,
    'id: "current-projects"',
    "Smoke verifier must keep current project hot cache selection covered."
  );
  assertIncludes(
    files.hotCachePolicyPlan,
    hotCachePolicyPlan,
    'id: "pinned-databases"',
    "Smoke verifier must keep pinned database hot cache selection covered."
  );
  assertIncludes(
    files.hotCachePolicyPlan,
    hotCachePolicyPlan,
    'id: "current-month-meetings"',
    "Smoke verifier must keep current-month meeting hot cache selection covered."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    'format: "zhinote-hot-cache-warmup-plan"',
    "Smoke verifier must keep the hot cache warmup plan."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "prefetches_routes_only: true",
    "Hot cache warmup must remain route-prefetch only."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "mutates_local_cache_records: false",
    "Hot cache warmup must not mutate local cache records."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "ACTIVE_DATABASE_ROUTE_TARGET_LIMIT = 12",
    "Hot cache warmup must keep active database route prefetch bounded."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "CURRENT_MONTH_DAILY_ROUTE_TARGET_LIMIT = 31",
    "Hot cache warmup must keep current-month daily route prefetch bounded."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "CURRENT_MONTH_MEETING_ROUTE_TARGET_LIMIT = 60",
    "Hot cache warmup must keep current-month meeting route prefetch bounded."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    'preference_key: "keepCurrentMonthMeetings"',
    "Hot cache warmup must let users disable current-month meeting route prefetch."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "FAVORITE_PAGE_ROUTE_TARGET_LIMIT = 12",
    "Hot cache warmup must keep favorite page route prefetch bounded."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "CURRENT_PROJECT_ROUTE_TARGET_LIMIT = 12",
    "Hot cache warmup must keep current project route prefetch bounded."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "PINNED_DATABASE_ROUTE_TARGET_LIMIT = 24",
    "Hot cache warmup must keep pinned database route prefetch bounded."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    'preference_key: "pinnedDatabaseIds"',
    "Hot cache warmup must use the explicit pinned database preference."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "`/database/${encodeURIComponent(database.id)}`",
    "Hot cache warmup must prefetch active database detail routes when selected."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "`/page/${encodeURIComponent(page.id)}`",
    "Hot cache warmup must prefetch favorite page detail routes when selected."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "行值继续按需加载",
    "Hot cache warmup must keep database row values out of route prefetch."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "用户未选择指定数据库常驻本地。",
    "Hot cache warmup must explain when pinned database cache is preference-off."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "纪要详情路由",
    "Hot cache warmup must prefetch current-month daily note detail routes."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "会议详情路由",
    "Hot cache warmup must prefetch current-month meeting detail routes."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "正文按打开时补齐",
    "Hot cache warmup must keep page bodies out of route prefetch."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "入会凭证按打开时补齐",
    "Hot cache warmup must keep meeting credentials out of route prefetch."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "用户未选择当前月份会议日历常驻本地。",
    "Hot cache warmup must explain when current-month meeting cache is preference-off."
  );
  assertIncludes(
    files.hotCacheWarmupPlan,
    hotCacheWarmupPlan,
    "项目正文按打开时补齐",
    "Hot cache warmup must keep project page bodies out of route prefetch."
  );
  for (const forbiddenWarmupSnippet of [
    "page.content_text",
    "page.content_yjs",
    "database.description",
    "file.dataUrl",
    "file.textContent",
    "comment.body",
    "field_values",
    "fetch(",
    "\"入会链接\"",
    "\"会议号\"",
    "\"会议密码\"",
    "joinUrl:",
    "meetingId:",
    "passcode:",
    "localStorage.setItem",
    "db.run",
  ]) {
    if (hotCacheWarmupPlan.includes(forbiddenWarmupSnippet)) {
      failures.push(
        `${files.hotCacheWarmupPlan} must not include ${forbiddenWarmupSnippet}: hot cache warmup must stay metadata-only.`
      );
    }
  }
  assertIncludes(
    files.hotCacheWarmupReceipt,
    hotCacheWarmupReceipt,
    'format: "zhinote-hot-cache-warmup-receipt"',
    "Smoke verifier must keep the hot cache warmup receipt."
  );
  assertIncludes(
    files.hotCacheWarmupReceipt,
    hotCacheWarmupReceipt,
    "records_metadata_only: true",
    "Hot cache warmup receipt must stay metadata-only."
  );
  assertIncludes(
    files.hotCacheWarmupReceipt,
    hotCacheWarmupReceipt,
    "stores_receipt_as_source_of_truth: false",
    "Hot cache warmup receipt must not become the source of truth."
  );
  assertIncludes(
    files.hotCacheWarmupReceipt,
    hotCacheWarmupReceipt,
    "prefetches_routes_only: true",
    "Hot cache warmup receipt must only record route prefetch."
  );
  for (const forbiddenReceiptSnippet of [
    "page.content_text",
    "page.content_yjs",
    "database.description",
    "file.dataUrl",
    "file.textContent",
    "comment.body",
    "field_values",
    "fetch(",
    "localStorage.setItem",
    "db.run",
  ]) {
    if (hotCacheWarmupReceipt.includes(forbiddenReceiptSnippet)) {
      failures.push(
        `${files.hotCacheWarmupReceipt} must not include ${forbiddenReceiptSnippet}: hot cache warmup receipt must stay metadata-only.`
      );
    }
  }
  assertIncludes(
    files.localSchema,
    localSchema,
    "CREATE TABLE IF NOT EXISTS hot_cache_entries",
    "Smoke verifier must keep the rebuildable local hot cache metadata index table."
  );
  assertIncludes(
    files.localSchema,
    localSchema,
    "idx_hot_cache_entries_route",
    "Smoke verifier must keep a route index for local hot cache lookup."
  );
  assertIncludes(
    files.hotCacheLocalIndex,
    hotCacheLocalIndex,
    'format: "zhinote-hot-cache-local-index-write-receipt"',
    "Smoke verifier must keep the local hot cache index write receipt."
  );
  assertIncludes(
    files.hotCacheLocalIndex,
    hotCacheLocalIndex,
    "INSERT INTO hot_cache_entries",
    "Local hot cache index must write only the dedicated rebuildable index table."
  );
  assertIncludes(
    files.hotCacheLocalIndex,
    hotCacheLocalIndex,
    "enters_sync_log: false",
    "Local hot cache index writes must stay out of the upload queue."
  );
  assertIncludes(
    files.hotCacheLocalIndex,
    hotCacheLocalIndex,
    "mutates_local_hot_cache_index: true",
    "Local hot cache index write receipt must disclose the local-only mutation."
  );
  assertIncludes(
    files.hotCacheLocalIndex,
    hotCacheLocalIndex,
    "stores_source_of_truth: false",
    "Local hot cache index must not become the source of truth."
  );
  assertIncludes(
    files.hotCacheLocalIndex,
    hotCacheLocalIndex,
    "records_metadata_only: true",
    "Local hot cache index must stay metadata-only."
  );
  for (const forbiddenIndexSnippet of [
    "page.content_text",
    "page.content_yjs",
    "database.description",
    "file.dataUrl",
    "file.textContent",
    "comment.body",
    "field_values",
    "fetch(",
    "localStorage.setItem",
    "recordSyncChange",
    "INSERT INTO sync_log",
  ]) {
    if (hotCacheLocalIndex.includes(forbiddenIndexSnippet)) {
      failures.push(
        `${files.hotCacheLocalIndex} must not include ${forbiddenIndexSnippet}: local hot cache index must stay metadata-only and out of sync_log.`
      );
    }
  }
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    'format: "zhinote-daily-hot-cache-snapshot"',
    "Smoke verifier must keep the daily hot cache snapshot format."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    'route_target: "/daily"',
    "Daily hot cache snapshot must stay scoped to the daily route."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "records_metadata_only: true",
    "Daily hot cache snapshot must stay metadata-only."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "enters_sync_log: false",
    "Daily hot cache snapshot must not enter the upload queue."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "window.localStorage.setItem",
    "Daily hot cache snapshot must stay a local browser cache."
  );
  for (const forbiddenDailySnapshotSnippet of [
    "page.content_text",
    "page.content_yjs",
    "comment.body",
    "field_values",
    "fetch(",
    "recordSyncChange",
    "INSERT INTO sync_log",
  ]) {
    if (dailyHotCacheSnapshot.includes(forbiddenDailySnapshotSnippet)) {
      failures.push(
        `${files.dailyHotCacheSnapshot} must not include ${forbiddenDailySnapshotSnippet}: daily hot cache snapshot must stay metadata-only and local-only.`
      );
    }
  }
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    'format: "zhinote-meeting-hot-cache-snapshot"',
    "Smoke verifier must keep the meeting hot cache snapshot format."
  );
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    'route_target: "/schedule"',
    "Meeting hot cache snapshot must stay scoped to the schedule route."
  );
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    "records_metadata_only: true",
    "Meeting hot cache snapshot must stay metadata-only."
  );
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    "stores_join_url: false",
    "Meeting hot cache snapshot must never store join URLs."
  );
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    "stores_meeting_id: false",
    "Meeting hot cache snapshot must never store meeting ids."
  );
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    "stores_passcode: false",
    "Meeting hot cache snapshot must never store meeting passcodes."
  );
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    "enters_sync_log: false",
    "Meeting hot cache snapshot must not enter the upload queue."
  );
  assertIncludes(
    files.meetingHotCacheSnapshot,
    meetingHotCacheSnapshot,
    "window.localStorage.setItem",
    "Meeting hot cache snapshot must stay a local browser cache."
  );
  for (const forbiddenMeetingSnapshotSnippet of [
    "page.content_text",
    "page.content_yjs",
    "comment.body",
    "field_values",
    "fetch(",
    "recordSyncChange",
    "INSERT INTO sync_log",
    "\"入会链接\"",
    "\"会议号\"",
    "\"会议密码\"",
    "joinUrl:",
    "meetingId:",
  ]) {
    if (meetingHotCacheSnapshot.includes(forbiddenMeetingSnapshotSnippet)) {
      failures.push(
        `${files.meetingHotCacheSnapshot} must not include ${forbiddenMeetingSnapshotSnippet}: meeting hot cache snapshot must stay metadata-only, local-only, and free of meeting credentials.`
      );
    }
  }
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "readDailyHotCacheSnapshot",
    "Daily notes must read a local hot cache snapshot before slower cache/cloud checks."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "hotCacheBootstrapKeyRef",
    "Daily notes must bootstrap visible-month hot cache before IndexedDB readiness."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "正在启动本地数据库和云端校正",
    "Daily notes must label browser-hot-cache first paint while database/cloud correction continues."
  );
  if (
    !(
      dailyNotesShell.indexOf("const bootstrapKey = `${startDate}:${endDate}`") >=
        0 &&
      dailyNotesShell.indexOf("const bootstrapKey = `${startDate}:${endDate}`") <
        dailyNotesShell.indexOf("if (!dbReady) return;")
    )
  ) {
    failures.push(
      "Daily notes must read browser hot cache before the first dbReady-gated effect."
    );
  }
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "readDailyHotCacheSnapshotsForRange",
    "Daily hot cache must expose an overlapping-range reader for faster refresh first paint."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "rangesOverlap",
    "Daily hot cache overlap reads must stay bounded to intersecting date ranges."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "isDailyHotCacheSnapshotPageInRange(page, input.startDate, input.endDate)",
    "Daily hot cache snapshot writes must keep only the requested calendar range."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "isDailyHotCacheInputPagePossiblyInRange(",
    "Daily hot cache snapshot writes must skip out-of-range dailyDateKey inputs before parsing properties."
  );
  assertIncludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "range_pages: snapshotPages.length",
    "Daily hot cache snapshot summaries must prove all stored pages are in range."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "readDailyHotCacheSnapshotsForRange",
    "Daily notes must read overlapping local hot cache snapshots before slower local/cloud checks."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "cachedHotSnapshot,\n        startDate,\n        endDate",
    "Daily notes must filter even exact hot-cache snapshots to the visible calendar range."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "已先显示本机重叠热缓存",
    "Daily notes must surface when overlapping local hot cache metadata supplied first paint."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "writeDailyHotCacheSnapshot",
    "Daily notes must refresh the local hot cache snapshot after metadata loads."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "HOT_CACHE_PREFERENCES_SETTING_KEY",
    "Daily notes must read the user hot-cache preference setting."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "HOT_CACHE_PREFERENCES_CHANGED_EVENT",
    "Daily notes must react when hot-cache preferences change locally."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY",
    "Daily notes must react to hot-cache preference changes from other tabs."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "metadataRecentLimitForHotCachePreferences",
    "Daily notes must translate hot-cache preference into a bounded recent metadata window."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "recentLimit: recentMetadataLimit",
    "Daily notes must use preference-aware recent metadata limits instead of a fixed window."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "let cloudMetadataPromise: Promise<DailyCloudMetadataResult> | null = null;",
    "Daily notes must keep cloud metadata fetch lazy so local metadata can paint first."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const startDailyCloudMetadataFetch = () => {",
    "Daily notes must start cloud metadata fetch only after local-first metadata work begins."
  );
  if (
    dailyNotesShell.indexOf(
      "const localMetadata = await listDailyPageMetadataForCalendar"
    ) >=
    dailyNotesShell.indexOf("const cloudMetadata = startDailyCloudMetadataFetch()")
  ) {
    failures.push(
      `${files.dailyNotesShell} must query local metadata before starting the cloud metadata request.`
    );
  }
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "includeUnindexedFallback: false",
    "Daily first-paint local metadata query must skip expensive unindexed Notion-import fallback."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "includeUnindexedFallback: true",
    "Daily background refresh must still recover unindexed Notion-import metadata."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'source: "local-fallback-metadata"',
    "Daily background fallback metadata must refresh the hot cache after first paint."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const calendarIndexes = useMemo(",
    "Daily notes must build calendar indexes in one memoized pass to keep large imports responsive."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "buildDailyCalendarIndexes(notes, calendarDateKeys)",
    "Daily notes must share one visible-month index builder instead of repeating full-list passes."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "function buildDailyCalendarIndexes(",
    "Daily calendar single-pass index helper must stay explicit and reviewable."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const calendarDateKeys = useMemo",
    "Daily calendar grouping must be scoped to the visible month grid."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "if (!calendarDateKeys.has(dateKey)) continue;",
    "Daily calendar must avoid grouping recent notes outside the visible grid during first paint."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const deferredRecentNotes = useDeferredValue(calendarIndexes.recentNotes)",
    "Daily recent-note list must defer bounded recent candidates behind the calendar."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "startTransition(() => {\n        if (loadRequestRef.current !== requestId) return;\n        setNotes(renderableNotes);",
    "Daily calendar bulk metadata publishes must stay low-priority and render-bounded so clicks and typing remain responsive."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "DAILY_RECENT_VISIBLE_LIMIT",
    "Daily recent-note list must keep a small visible cap for large imported workspaces."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "deferredRecentNotes.slice(0, DAILY_RECENT_VISIBLE_LIMIT)",
    "Daily recent-note list must render from bounded top-note candidates instead of full-list sorting."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "function addRecentDailyNoteCandidate(",
    "Daily recent-note bounded candidate helper must stay explicit and reviewable."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "function selectDailyNotesForCalendarRender(",
    "Daily calendar render state must keep current-grid notes plus bounded recent notes instead of every imported record."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const [openingNoteId, setOpeningNoteId]",
    "Daily existing-note opens must track an immediate opening state for click feedback."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "setOpeningNoteId(note.id);",
    "Daily existing-note opens must mark the clicked note before deferred warmup work runs."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "openingNoteId === note.id",
    "Daily note chips must render an immediate opening affordance while the peek modal loads."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "正在打开纪要…",
    "Daily note chips must show a local opening label during peek modal load."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const handlePeekReady = useCallback",
    "Daily existing-note opening state must clear from the peek modal ready signal."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onReady={handlePeekReady}",
    "Daily page peek must wire its ready signal back to the opening-state UI."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "onReady?: (pageId: string) => void",
    "PagePeekModal must expose a ready callback for local-first parent shells."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "readyNotifiedPageIdRef",
    "PagePeekModal must de-duplicate ready notifications per page."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "onReady?.(pageId)",
    "PagePeekModal must notify when the local page shell is ready."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "const initialPeekPage = getInitialPeekPage(pageId, initialPage)",
    "PagePeekModal must seed title and properties from initial metadata before first paint."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "useState(() => initialPeekPage?.title ?? \"\")",
    "PagePeekModal title must not render blank when initial metadata is available."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "applyPeekMetadataSnapshot",
    "PagePeekModal must keep fallback metadata, title, and properties in sync."
  );
  for (const [snippet, message] of [
    [
      "PEEK_METADATA_ONLY_CONTENT_DELAY_MS = 260",
      "PagePeekModal must briefly defer metadata-only body loading so the peek title/properties can paint first.",
    ],
    [
      "PEEK_METADATA_ONLY_CONTENT_IDLE_TIMEOUT_MS = 700",
      "PagePeekModal metadata-only body loading must stay bounded so content still arrives quickly.",
    ],
    [
      "const isMetadataOnlyPeek =",
      "PagePeekModal must explicitly distinguish metadata-only previews from optimistic empty drafts.",
    ],
    [
      "schedulePeekContentLoad(() => {\n        setEditorLoadRequested(true);\n      }, isMetadataOnlyPeek)",
      "PagePeekModal must use the metadata-only delay only when the preview has no body yet.",
    ],
    [
      "标题和属性已先显示，正在从本地缓存补齐正文",
      "PagePeekModal must communicate that metadata is already visible while body hydration continues.",
    ],
    [
      "标题和属性已先显示，正在排队补齐正文和编辑器",
      "PagePeekModal skeleton must keep a clear metadata-first loading state before editor hydration.",
    ],
  ]) {
    assertIncludes(files.pagePeekModal, pagePeekModal, snippet, message);
  }
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "writeOptimisticDailyHotCache",
    "Daily + creation must update the local hot cache before background persistence."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "currentNotes: collectVisibleDailyNotesForHotCache(notesByDate)",
    "Daily + creation must not pass the full imported note set into optimistic hot-cache writes."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "source: \"optimistic-local\"",
    "Daily hot cache must record optimistic local creates before cloud upload."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "queueCloudPagePush(record)",
    "Daily + creation must enqueue account-cloud upload instead of waiting on direct push."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "已先显示本机热缓存",
    "Daily notes must surface the local hot cache first-paint path."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "buildDailyRangeSearchTokens",
    "Daily local metadata query must recover visible-month imported notes before broad background backfill finishes."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "inferDailyDateKeyInRange",
    "Daily local metadata query must infer no-year imported titles inside the visible calendar range."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "resolveMonthDayInRange",
    "Daily local metadata query must resolve month/day titles against the current visible range."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "ENGLISH_MONTH_INDEX",
    "Daily local metadata query must recover English month titles from Notion imports."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "DAILY_RANGE_SEARCH_TOKEN_LIMIT",
    "Daily targeted fallback search tokens must stay bounded for SQLite parameter safety."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "tokens.add(`${currentMonth}月${currentDay}`)",
    "Daily targeted fallback must include Chinese no-year day tokens."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "tokens.add(`${longMonthTitle} ${currentDay}`)",
    "Daily targeted fallback must include English no-year day tokens."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "includeUnindexedFallback?: boolean",
    "Daily local metadata query must expose a switch so first paint can skip expensive unindexed import fallback."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "if (includeUnindexedFallback)",
    "Daily unindexed import fallback must be explicitly gated away from first-paint queries."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "targetedFallbackRows",
    "Daily local metadata query must use a bounded visible-month fallback for missing date-index rows."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "dateParentIdsForChildren",
    "Daily local metadata query must include bounded child metadata for date parent pages."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "readMeetingHotCacheSnapshot",
    "Meeting schedule must read a local hot cache snapshot before slower cache/cloud checks."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "hotCacheBootstrapKeyRef",
    "Meeting schedule must bootstrap visible-month hot cache before IndexedDB readiness."
  );
  if (
    !(
      meetingScheduleShell.indexOf(
        "const bootstrapKey = `${startDate}:${endDate}`"
      ) >= 0 &&
      meetingScheduleShell.indexOf(
        "const bootstrapKey = `${startDate}:${endDate}`"
      ) < meetingScheduleShell.indexOf("if (!dbReady) return;")
    )
  ) {
    failures.push(
      "Meeting schedule must read browser hot cache before the first dbReady-gated effect."
    );
  }
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "meetingHotCacheSnapshotPageToPage",
    "Meeting schedule must convert the local hot cache snapshot back into metadata-only pages."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "writeMeetingHotCacheSnapshot",
    "Meeting schedule must refresh the local hot cache snapshot after metadata loads."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "HOT_CACHE_PREFERENCES_SETTING_KEY",
    "Meeting schedule must read the user hot-cache preference setting."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "HOT_CACHE_PREFERENCES_CHANGED_EVENT",
    "Meeting schedule must react when hot-cache preferences change locally."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY",
    "Meeting schedule must react to hot-cache preference changes from other tabs."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "metadataRecentLimitForHotCachePreferences",
    "Meeting schedule must translate hot-cache preference into a bounded recent metadata window."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "recentLimit: recentMetadataLimit",
    "Meeting schedule must use preference-aware recent metadata limits instead of a fixed window."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "writeOptimisticMeetingHotCache",
    "Meeting schedule must update the hot cache as soon as a local meeting draft is created."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "const nextMeetings = mergeMeetingPages(",
    "Meeting schedule must prepare merged metadata before the low-priority render publish."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "startTransition(() => {\n        if (loadRequestRef.current !== requestId) return;\n        setMeetings(nextMeetings);",
    "Meeting calendar bulk metadata publishes must stay low-priority so create/import clicks remain responsive."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "listMeetingPageMetadataForCalendar({",
    "Meeting schedule must load first-paint local metadata through a bounded date-range query."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "localPagesForMerge = await listPageMetadata(id)",
    "Meeting schedule must not scan the entire meeting root for first-paint calendar metadata."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "listDailyPageMetadataForCalendar({",
    "Meeting schedule must link completed meetings to daily notes with bounded daily metadata reads."
  );
  for (const snippet of [
    "completedMeetingDailyLinkKeyRef",
    "scheduleMeetingIdleTask(() =>",
    "linkCompletedMeetingsToDaily(notesToLink)",
  ]) {
    assertIncludes(
      files.meetingScheduleShell,
      meetingScheduleShell,
      snippet,
      "Meeting schedule must defer completed-meeting daily-note autolinking and skip duplicate batches."
    );
  }
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    'from "@/hooks/usePages"',
    "Meeting schedule must not import usePages for create/import/status update paths."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "await refresh()",
    "Meeting schedule must not await global page refresh after local-first updates."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "void refresh()",
    "Meeting schedule must not fire global page refresh after background persistence."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "source: \"optimistic-local\"",
    "Meeting schedule hot cache must record optimistic local creates before background persistence."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "getModuleRootId(\"meeting-schedule\")",
    "Meeting schedule must resolve the real module root in the background instead of blocking first paint."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "会议模块还在加载，请等页面完成加载后再导入。",
    "Meeting creation must not fail just because the module root has not loaded yet."
  );
  assertIncludes(
    files.pageRouteHandoff,
    pageRouteHandoff,
    'format: "zhinote-page-route-handoff"',
    "Page route handoff must expose a stable local handoff format."
  );
  assertIncludes(
    files.pageRouteHandoff,
    pageRouteHandoff,
    'route_target: "/page/[pageId]"',
    "Page route handoff must stay scoped to page opening."
  );
  assertIncludes(
    files.pageRouteHandoff,
    pageRouteHandoff,
    "window.sessionStorage.setItem",
    "Page route handoff must stay a short-lived browser session cache."
  );
  assertIncludes(
    files.pageRouteHandoff,
    pageRouteHandoff,
    "stores_source_of_truth: false",
    "Page route handoff must not become the source of truth."
  );
  assertIncludes(
    files.pageRouteHandoff,
    pageRouteHandoff,
    "enters_sync_log: false",
    "Page route handoff must not enter the upload queue."
  );
  for (const forbiddenPageRouteHandoffSnippet of [
    "fetch(",
    "recordSyncChange",
    "INSERT INTO sync_log",
    "queueCloudPagePush",
    "pushCloudPages",
  ]) {
    if (pageRouteHandoff.includes(forbiddenPageRouteHandoffSnippet)) {
      failures.push(
        `${files.pageRouteHandoff} must not include ${forbiddenPageRouteHandoffSnippet}: route handoff must stay local-only and out of sync.`
      );
    }
  }
  for (const forbiddenPendingDraftSnippet of [
    "window.localStorage",
    "recordSyncChange",
    "INSERT INTO sync_log",
    "queueCloudPagePush",
    "pushCloudPages",
  ]) {
    if (pendingPageDrafts.includes(forbiddenPendingDraftSnippet)) {
      failures.push(
        `${files.pendingPageDrafts} must not include ${forbiddenPendingDraftSnippet}: pending drafts must stay session-only and out of sync.`
      );
    }
  }
  assertIncludes(
    files.usePage,
    usePage,
    "readPageRouteHandoff",
    "Page opening must read route handoff before slower local DB or cloud checks."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "readLocalFirstPageSeed",
    "Page opening must read local-first route seeds before waiting on IndexedDB readiness."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "const [initialLocalFirstPageSeed] = useState<Page | null>(() => {",
    "Page opening must read the initial local-first seed once and reuse it for first render state."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "const [page, setPage] = useState<Page | null>(() => {",
    "Page opening must seed the page state before the first client render when route metadata exists."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "const [loading, setLoading] = useState(() => {",
    "Page opening must seed the loading state before the first client render when route metadata exists."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "const visiblePageRef = useRef<Page | null>(initialLocalFirstPageSeed)",
    "Page opening must keep the already-visible page snapshot available for the next load pass."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "visiblePageRef.current?.id === pageId",
    "Page opening must reuse the visible page snapshot before rereading session storage or IndexedDB."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "const loadRequestRef = useRef(0);",
    "Page opening must track the latest load request so stale page hydration cannot overwrite the current route."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "const requestId = ++loadRequestRef.current;",
    "Page opening must give each load attempt a monotonic request id."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "if (!isCurrentLoad()) return;",
    "Page opening must ignore stale async local or cloud hydration results."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "loadRequestRef.current += 1;",
    "Page opening must invalidate queued or in-flight loads when the route changes."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "if (!dbReady)",
    "Page opening must keep local-first route seeds visible while IndexedDB is still starting."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "setLoadingForCurrentLoad(!localPage)",
    "Page opening must avoid showing not-found when a local-first route seed exists before IndexedDB readiness."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "schedulePageCloudHydration(\n        pageId,\n        () =>",
    "Page opening must defer cloud body hydration until after a local page has painted through a latest-page reader."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "const latestLocalPage = getLocalPage();",
    "Page cloud hydration must compare against the latest visible local page instead of the stale opening snapshot."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "applyCloudPageLookup(cloud, latestLocalPage, setPage, upsertPages)",
    "Page cloud hydration must pass the latest local page into cloud conflict comparison."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "requestIdleCallback(run",
    "Page opening must schedule cloud body hydration during browser idle time."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "PAGE_CLOUD_HYDRATION_IDLE_MS",
    "Page opening must keep the cloud hydration idle timeout explicit and bounded."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "upsertPages([metadata])",
    "Peek modal must promote metadata into memory so editor loading can proceed before cloud body hydration."
  );
  assertIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "queueCloudPagePush(pageToRemoteRecord(page))",
    "Peek modal fallback saves must use the pending cloud upload queue instead of blocking on direct push."
  );
  assertExcludes(
    files.usePage,
    usePage,
    "setLoading(localPage.content_text == null)",
    "Page opening must treat metadata/handoff as first-paint ready while the full body hydrates in the background."
  );
  assertExcludes(
    files.usePage,
    usePage,
    "cloudPagePromise",
    "Page opening must not start a cloud body lookup before IndexedDB has had a chance to provide the local page."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    "const loadEditorModule = () => import(\"@/components/editor/Editor\")",
    "Page shell must keep the editor behind a dynamic import instead of blocking title/properties first paint."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    "return scheduleEditorMount(() => {\n      void loadEditorModule();\n      setEditorMounted(true);",
    "Page shell must defer warming the editor module until after page metadata is visible."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    "PAGE_EDITOR_IDLE_TIMEOUT_MS = 120",
    "Page shell editor warmup must use a bounded short idle timeout so it does not compete with route first paint."
  );
  for (const [snippet, message] of [
    [
      "PAGE_METADATA_ONLY_EDITOR_DELAY_MS = 420",
      "Page shell must briefly hold editor mounting for metadata-only page opens so local body hydration can win first.",
    ],
    [
      "PAGE_METADATA_ONLY_EDITOR_IDLE_TIMEOUT_MS = 900",
      "Page shell metadata-only editor fallback must stay bounded so an empty page still becomes editable.",
    ],
    [
      "const hasContentForEditor = page?.content_text != null",
      "Page shell must distinguish metadata-only route handoff records from content-ready pages.",
    ],
    [
      "mountedEditorPageIdRef.current = pageId",
      "Page shell must remember which page already owns the mounted editor.",
    ],
    [
      "if (editorMounted && mountedEditorPageIdRef.current === pageId) return",
      "Page shell must not remount the editor when late body hydration reaches an already mounted page.",
    ],
    [
      "delay: metadataOnly ? PAGE_METADATA_ONLY_EDITOR_DELAY_MS : 0",
      "Page shell must delay heavy editor mounting only for metadata-only opens.",
    ],
    [
      "metadataOnly\n        ? PAGE_METADATA_ONLY_EDITOR_IDLE_TIMEOUT_MS\n        : PAGE_EDITOR_IDLE_TIMEOUT_MS",
      "Page shell must use a longer bounded idle fallback only for metadata-only opens.",
    ],
    [
      "标题和属性已先显示，正在从本地缓存补齐正文和编辑器",
      "Page shell metadata-only skeleton must explain that the title/properties are already visible while body hydration continues.",
    ],
  ]) {
    assertIncludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "PAGE_COMMENTS_IDLE_TIMEOUT_MS = 700",
      "Page shell comments must mount after the editor instead of competing with first paint.",
    ],
    [
      "PAGE_CHILD_TREE_IDLE_TIMEOUT_MS = 1200",
      "Page shell child tree must mount in a later idle stage after editing is available.",
    ],
    [
      "PAGE_REFERENCES_IDLE_TIMEOUT_MS = 1800",
      "Page shell backlinks must mount last so relationship queries do not slow page opening.",
    ],
    [
      "pageCommentsMounted",
      "Page shell must track comment surfaces separately from slower relationship panels.",
    ],
    [
      "childTreeMounted",
      "Page shell must track child tree mounting separately from comments and backlinks.",
    ],
    [
      "pageReferencesMounted",
      "Page shell must track backlinks mounting separately from comments and child pages.",
    ],
  ]) {
    assertIncludes(files.pageShell, pageShell, snippet, message);
  }
  assertExcludes(
    files.pageShell,
    pageShell,
    "pagePeripheralsMounted",
    "Page shell must not use one shared peripheral flag that mounts comments, child tree, and backlinks together."
  );
  for (const [snippet, message] of [
    [
      "PAGE_EDITOR_SIDE_EFFECT_DEBOUNCE_MS = 1500",
      "Page shell must debounce editor side effects separately from content persistence.",
    ],
    [
      "pendingEditorSideEffectsRef",
      "Page shell must keep only the latest pending editor side effect payload.",
    ],
    [
      "scheduleEditorSideEffects();",
      "Page shell must schedule wiki link and version work after the editor settles.",
    ],
    [
      "await updateWikiLinks(pageId, pending.linkedPageIds)",
      "Page shell must rebuild wiki links from the debounced pending payload.",
    ],
    [
      "cancelEditorSideEffects();",
      "Page shell must cancel stale pending editor side effects before explicit structural inserts.",
    ],
  ]) {
    assertIncludes(files.pageShell, pageShell, snippet, message);
  }
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    'PAGE_SYNC_STATUS_EVENT = "zhinote:pagesync-status"',
    "Page sync queue changes must emit a local status event for visible save/upload feedback."
  );
  assertIncludes(
    files.pageUpdateBus,
    pageUpdateBus,
    'PAGE_LOCAL_UPDATE_EVENT = "zhinote:pages-local-updated"',
    "Page update bus must emit a same-tab event so local edits can trigger background quick sync."
  );
  assertIncludes(
    files.pageUpdateBus,
    pageUpdateBus,
    "new CustomEvent<PageUpdateMessage>(PAGE_LOCAL_UPDATE_EVENT",
    "Page update bus same-tab event must carry the lightweight page update message."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "EDIT_DEBOUNCE_MS = 4 * 1000",
    "Page cloud sync must debounce local edit-triggered quick syncs."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "PENDING_STATUS_SYNC_DELAY_MS",
    "Page cloud sync must schedule low-latency quick syncs from pending status events."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "schedulePendingStatusSync",
    "Page pending queue status must trigger quick sync without waiting for the normal poll."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "detail.pending + detail.queued",
    "Page pending status quick sync must include both durable and in-memory page queues."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "PAGE_PENDING_STORAGE_KEYS",
    "Page cloud sync must restrict cross-tab quick syncs to page pending storage keys."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    'PAGE_PENDING_STORAGE_KEYS.has(event.key ?? "")',
    "Page cross-tab pending storage changes must trigger low-latency quick sync."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "window.addEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate)",
    "Page cloud sync must listen for same-tab local page updates."
  );
  assertIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "window.removeEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate)",
    "Page cloud sync must clean up the same-tab local page update listener."
  );
  assertIncludes(
    files.usePage,
    usePage,
    'emitPageSnapshotsUpdated("cloud-push", [optimistic])',
    "Page edits must broadcast lightweight metadata immediately after local optimistic updates."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    "getPendingCloudPageSyncStatus",
    "Page shell must read the local page sync queue status without triggering upload."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "export function isCloudPagePendingSync",
    "Page sync client must expose a read-only current-page pending check."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    "isCloudPagePendingSync(pageId)",
    "Page shell sync badge must distinguish the currently open page from unrelated pending uploads."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    "当前页待云同步",
    "Page shell sync badge must tell the owner when the current page is waiting for cloud upload."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    'data-testid="page-sync-status-badge"',
    "Page shell must render a stable sync status badge for local saved / pending cloud state."
  );
  assertIncludes(
    files.pageShell,
    pageShell,
    'router.push("/modules/sync")',
    "Page sync status badge must open the Sync module where pending queues can be reviewed and retried."
  );
  assertExcludes(
    files.pagePeekModal,
    pagePeekModal,
    "await pushCloudPages",
    "Peek modal fallback saves must not block editing on a direct cloud push."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "@/components/page/LazyPagePeekModal",
    "Daily calendar must lazy-load the heavy page peek modal instead of bundling it into first paint."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "warmPagePeekModal();",
    "Daily calendar must prewarm the lazy peek modal on pointer/open intent."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'primeDailyNoteOpen(note, "daily-open");',
    "Daily existing-note opens must prime route handoff before showing the peek shell."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'primeDailyNoteOpen(note, "daily-open")',
    "Daily existing-note hover, pointer, and focus intents must reuse the same local-first priming path."
  );
  assertExcludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'import("@/components/editor/Editor")',
    "Daily calendar must not preload the heavy editor bundle during first-paint metadata loading."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "pageShellWarmupRef",
    "Daily calendar must warm the full-page shell once without repeatedly importing it."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onPointerEnter={warmPageRoute}",
    "Daily calendar + controls must warm the page shell on pointer intent before navigation."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onPointerDown={warmPageRoute}",
    "Daily calendar + creation controls must warm the page shell even on fast clicks."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onFocus={warmPageRoute}",
    "Daily calendar + controls must warm the page shell on keyboard focus before navigation."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'onFocus={() => primeDailyNoteOpen(note, "daily-open")}',
    "Daily existing-note focus must prime the local-first page shell before opening."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const warmDailyNoteContent = useCallback",
    "Daily existing-note intent must be able to warm local body content without cloud reads."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onMouseEnter={() => warmDailyNoteContent(note)}",
    "Daily existing-note hover must warm local body content before the peek modal asks for it."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "setPeekInitialPage(toDailyNoteSeed(seededNote, note));",
    "Daily existing-note opens must seed the peek modal before showing it."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "data-testid={`daily-calendar-day-${key}`}",
    "Daily calendar day cells must expose stable targets for hover-to-create checks."
  );
  for (const snippet of [
    "useLocalFirstPageNavigation",
    "openPage(note, { source })",
    'openPage(pageId, { source: "daily-open" })',
  ]) {
    assertIncludes(
      files.dailyNotesShell,
      dailyNotesShell,
      snippet,
      "Daily full-page openings must use the shared local-first page navigation path."
    );
  }
  for (const snippet of [
    'openPage(optimisticNote, { source: "daily-create" })',
    "每日纪要已打开",
  ]) {
    assertIncludes(
      files.dailyNotesShell,
      dailyNotesShell,
      snippet,
      "Daily + creation must enter the full page immediately after optimistic local seeding."
    );
  }
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'openPage(optimisticNote, { source: "daily-create" })',
    "Daily + creation must route directly into the new page."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "rememberPageRouteHandoff(optimisticNote, \"daily-create\")",
    "Daily + creation must hand off the optimistic page before peek or full-page opening."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "rememberPendingPageDraft(note)",
    "Daily note full-page opening must keep an in-memory draft for immediate first paint."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "openDailyNoteFullPageById",
    "Daily note context menu and peek modal must use the local-first full-page opening path."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const notesById = calendarIndexes.notesById",
    "Daily calendar must reuse the single-pass note id index."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const inCalendarNote = notesById.get(pageId)",
    "Daily note full-page opening must use the visible-month note id index before scanning the whole workspace."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "data-testid={`daily-add-note-${key}`}",
    "Daily calendar + button must expose a stable test target."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "data-testid={`daily-opening-note-${key}`}",
    "Daily calendar must show an immediate opening chip after + is clicked."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "quickCreateMeetingForDate",
    "Meeting calendar + button must create and open a meeting page directly."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "openCreatedMeetingPage",
    "Meeting manual create and invite import must share the same local-first page opening path."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "prepareMeetingPageOpen",
    "Meeting page opens must share a pre-navigation local cache handoff."
  );
  for (const snippet of [
    "useLocalFirstPageNavigation",
    'openPage(page, { source: "meeting-create" })',
    "openPage(page, { source })",
    "prepareMeetingPageOpen(page, source)",
    'prepareMeetingPageOpen(page, "meeting-create")',
    "const seededPage = getMeetingPageOpenSeed(page)",
    "rememberPendingPageDraft(seededPage)",
    "rememberPageRouteHandoff(seededPage, source)",
    "const warmMeetingPageContent = useCallback",
    "onMouseEnter={() => warmMeetingPageContent(entry.page)}",
    "const openMeetingDetail = useCallback",
    'openMeetingFullPage(entry.page, "meeting-open")',
    'openPage(pageId, { source: "meeting-open" })',
    "const entriesById = useMemo(() =>",
    "entriesById.get(pageId)?.page",
    "MEETING_UPCOMING_VISIBLE_LIMIT",
    "MEETING_NOTES_VISIBLE_LIMIT",
    "return getUpcomingMeetingEntries(",
    "function getUpcomingMeetingEntries(",
    "getRecentCompletedMeetingEntries(",
    "function getRecentCompletedMeetingEntries(",
  ]) {
    assertIncludes(
      files.meetingScheduleShell,
      meetingScheduleShell,
      snippet,
      "Meeting full-page openings must use the shared local-first page navigation path."
    );
  }
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "primeMeetingPageOpen",
    "Meeting schedule must not keep the old meeting page prime helper after moving note links to local-first navigation."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "pageShellWarmupRef",
    "Meeting schedule must warm the full-page shell once before meeting page navigation."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "warmMeetingPageRoute",
    "Meeting schedule must reuse a page-route warmup path for create, import, and open actions."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "onPointerDown={warmMeetingPageRoute}",
    "Meeting create/import controls must warm the page shell even on fast clicks."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "openCreatedMeetingPage(result.page)",
    "Meeting invite imports must open the newly created page immediately after optimistic local create."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "): CreateMeetingResult =>",
    "Meeting creation must return the optimistic page synchronously so navigation is not blocked by background persistence."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "const result = createMeetingPage(form",
    "Manual meeting creation must open from a synchronous optimistic result."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "const result = createMeetingPage(draft",
    "Invite import must open from a synchronous optimistic result after parsing completes."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "): Promise<CreateMeetingResult> =>",
    "Meeting creation must not wrap the optimistic result in a Promise before opening the page."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "rememberPageRouteHandoff(optimisticPage, \"meeting-create\")",
    "Meeting creation must hand off the optimistic page before page navigation."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "rememberPendingPageDraft(optimisticPage)",
    "Meeting creation must keep an in-memory draft for immediate page opening."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "return queueMeetingCloudRecords(records)",
    "Meeting creation must enqueue both the module root and meeting page through the shared cloud upload queue."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "function queueMeetingCloudRecords",
    "Meeting creation must keep a dedicated queue helper for root + meeting page records."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "queueCloudPagePush(record)",
    "Meeting creation must use the pending queue instead of waiting on a direct cloud push."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "const result = await pushCloudPages(records)",
    "Meeting creation persistence must not wait on a direct pushCloudPages call."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "data-testid={`meeting-add-${key}`}",
    "Meeting calendar + button must expose a stable test target."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "disabled={intakeLoading || !intakeText.trim()}",
    "Meeting import button must be available as soon as text is present; root id resolution happens in the create path."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "disabled={intakeLoading || !rootId || !intakeText.trim()}",
    "Meeting import button must not wait for the module root id before accepting pasted invite text."
  );
  assertExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    'rootId ? "导入" : "加载中..."',
    "Meeting import button must not show loading only because the module root id has not hydrated yet."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "revealMeetingOnCalendar(optimisticPage)",
    "Meeting import/create must reveal the optimistic meeting in the calendar immediately."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "pendingCalendarFocusDateKeyRef",
    "Meeting import/create must keep a pending focus target until the date cell is mounted."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "requestAnimationFrame",
    "Meeting calendar reveal must scroll after the rendered cell is ready instead of racing a fixed timeout."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "MEETING_CALENDAR_REVEAL_BUFFER",
    "Meeting calendar must expand a crowded date enough to show a newly imported meeting."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "本地热缓存策略",
    "Sync UI must render the hot cache policy panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出热缓存策略",
    "Sync UI must expose the hot cache policy export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "buildHotCacheWarmupPlan",
    "Sync UI must build the hot cache warmup plan."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "本机预热计划",
    "Sync UI must render the hot cache warmup plan panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "预热本机入口",
    "Sync UI must expose route prefetch for hot cache warmup."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出预热计划",
    "Sync UI must expose the hot cache warmup export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "buildHotCacheWarmupReceipt",
    "Sync UI must build a hot cache warmup receipt."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "最近一次预热收据",
    "Sync UI must render the latest hot cache warmup receipt."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出预热收据",
    "Sync UI must expose the hot cache warmup receipt export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "writeHotCacheWarmupReceiptToLocalIndex",
    "Sync UI must persist warmup receipts to the local metadata index."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "本地热缓存索引",
    "Sync UI must render the local hot cache index summary."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "不进 sync_log",
    "Sync UI must explain that the local hot cache index does not enter the upload queue."
  );
  assertIncludes(
    files.localSchema,
    localSchema,
    "CREATE TABLE IF NOT EXISTS workspace_settings",
    "Smoke verifier must keep the local workspace settings table."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "upsertWorkspaceSetting",
    "Smoke verifier must keep workspace setting saves available."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    '"workspace_settings"',
    "Smoke verifier must keep workspace setting changes in sync_log scope."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "markWorkspaceSettingSyncLogEntriesSynced",
    "Smoke verifier must keep workspace setting acknowledgement available."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "applyRemoteWorkspaceSettings",
    "Smoke verifier must keep workspace setting cloud restore writing local cache rows."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "Cannot restore cloud workspace settings while local workspace setting changes are still pending.",
    "Smoke verifier must keep workspace setting cloud restore blocked by local pending rows."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "getPendingWorkspaceSettingSyncLogEntries",
    "Smoke verifier must keep workspace setting pending rows readable before cloud restore."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    'format: "zhinote-hot-cache-selection-contract"',
    "Smoke verifier must keep the hot cache selection contract."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    "workspaces.settings.hot_cache_preferences",
    "Smoke verifier must keep cloud workspace settings as the target."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    "ordinary_sync_pending_only: true",
    "Smoke verifier must keep hot cache selection pending-only."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    "keepCurrentMonthMeetings",
    "Smoke verifier must keep current-month meeting hot cache user preference."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    "pinnedDatabaseIds",
    "Smoke verifier must keep pinned database hot cache user preference."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    "metadataRecentLimitForHotCachePreferences",
    "Smoke verifier must keep the bounded recent metadata limit helper."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    "notifyHotCachePreferencesChanged",
    "Smoke verifier must keep the hot-cache preference change notifier."
  );
  assertIncludes(
    files.hotCacheSelectionSettings,
    hotCacheSelectionSettings,
    "preferences.recentDays === 90 ? 72 : 24",
    "Smoke verifier must keep recent metadata windows bounded."
  );
  assertIncludes(
    files.hotCacheSettingsCloud,
    hotCacheSettingsCloud,
    'format: "zhinote-hot-cache-settings-cloud-receipt"',
    "Smoke verifier must keep the hot cache settings cloud receipt."
  );
  assertIncludes(
    files.hotCacheSettingsCloud,
    hotCacheSettingsCloud,
    'format: "zhinote-hot-cache-settings-cloud-read-receipt"',
    "Smoke verifier must keep the hot cache settings cloud read receipt."
  );
  assertIncludes(
    files.hotCacheSettingsCloud,
    hotCacheSettingsCloud,
    "local_unsynced_setting_must_block_pull: true",
    "Smoke verifier must keep cloud-to-local settings pulls conflict-aware."
  );
  assertIncludes(
    files.hotCacheSettingsCloud,
    hotCacheSettingsCloud,
    "HOT_CACHE_SETTINGS_FORBIDDEN_FIELDS",
    "Smoke verifier must keep forbidden-field validation for cloud settings."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    'format: "zhinote-workspace-settings-pending-sync-plan"',
    "Smoke verifier must keep workspace settings pending sync plan format."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    'format: "zhinote-workspace-settings-cloud-restore-plan"',
    "Smoke verifier must keep workspace settings cloud restore plan format."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    'architecture_target: "cloud-master-local-cache-rebuild"',
    "Smoke verifier must keep workspace settings restore aligned to local cache rebuild."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "local_pending_must_be_empty: true",
    "Smoke verifier must keep workspace settings restore blocked unless local pending is empty."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "writes_sync_log: false",
    "Smoke verifier must keep workspace settings cloud restore out of sync_log."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "SUPPORTED_WORKSPACE_SETTING_SYNC_KEYS",
    "Smoke verifier must keep workspace settings upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "ordinary_sync_pending_only: true",
    "Smoke verifier must keep workspace settings uploads pending-only."
  );
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.localSchema,
      localSchema,
      "CREATE TABLE IF NOT EXISTS account_settings",
      "Smoke verifier must keep account settings in the rebuildable local settings ledger.",
    ],
    [
      files.localSchema,
      localSchema,
      "CREATE TABLE IF NOT EXISTS module_settings",
      "Smoke verifier must keep module settings in the rebuildable local settings ledger.",
    ],
    [
      files.localQueries,
      localQueries,
      "upsertAccountSetting",
      "Smoke verifier must keep account setting writes queued through sync_log.",
    ],
    [
      files.localQueries,
      localQueries,
      "upsertModuleSetting",
      "Smoke verifier must keep module setting writes queued through sync_log.",
    ],
    [
      files.localQueries,
      localQueries,
      "applyRemoteAccountModuleSettings",
      "Smoke verifier must keep account/module settings cloud restore writing local cache rows.",
    ],
    [
      files.localQueries,
      localQueries,
      "Cannot restore cloud account/module settings while local account/module setting changes are still pending.",
      "Smoke verifier must keep account/module settings cloud restore blocked by local pending rows.",
    ],
    [
      files.localQueries,
      localQueries,
      "getPendingAccountModuleSettingSyncLogEntries",
      "Smoke verifier must keep account/module settings pending rows readable before cloud restore.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'format: "zhinote-account-module-settings-pending-sync-plan"',
      "Smoke verifier must keep account/module settings pending sync plan format.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "SUPPORTED_ACCOUNT_SETTING_SYNC_KEYS",
      "Smoke verifier must keep account settings upload allowlist.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "SUPPORTED_MODULE_SETTING_SYNC_KEYS",
      "Smoke verifier must keep module settings upload allowlist.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "ordinary_sync_pending_only: true",
      "Smoke verifier must keep account/module settings uploads pending-only.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "ACCOUNT_MODULE_SETTINGS_FORBIDDEN_FIELDS",
      "Smoke verifier must keep forbidden-field validation for account/module settings.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'format: "zhinote-account-module-settings-cloud-receipt"',
      "Smoke verifier must keep account/module settings cloud write receipts.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "parseAccountModuleSettingsCloudValues",
      "Smoke verifier must keep account/module settings cloud read summaries.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'format: "zhinote-account-module-settings-cloud-restore-plan"',
      "Smoke verifier must keep account/module settings cloud restore plan format.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'architecture_target: "cloud-master-local-cache-rebuild"',
      "Smoke verifier must keep account/module settings restore aligned to local cache rebuild.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "local_pending_must_be_empty: true",
      "Smoke verifier must keep account/module settings restore blocked unless local pending is empty.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "writes_sync_log: false",
      "Smoke verifier must keep account/module settings cloud restore out of sync_log.",
    ],
    [
      files.syncShell,
      syncShell,
      "AccountModuleSettingsPendingPanel",
      "Sync UI must render the account/module settings cloud boundary panel.",
    ],
    [
      files.syncShell,
      syncShell,
      "账号和模块设置云主库边界",
      "Sync UI must explain the account/module settings cloud boundary.",
    ],
  ]) {
    assertIncludes(sourceLabel, source, snippet, message);
  }
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "buildWorkspaceSettingCloudPayload",
    "Smoke verifier must keep explicit workspace settings cloud payloads."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY",
    "Smoke verifier must keep sidebar settings in the pending-only upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "PAGE_FAVORITES_SETTING_KEY",
    "Smoke verifier must keep page favorites in the pending-only upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "PAGE_VIEW_PREFERENCES_SETTING_KEY",
    "Smoke verifier must keep page view preferences in the pending-only upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY",
    "Smoke verifier must keep quick search saved searches in the pending-only upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "saved_searches",
    "Smoke verifier must keep quick search uploads limited to saved-search metadata."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "CALENDAR_VIEW_STATE_SETTING_KEY",
    "Smoke verifier must keep calendar view state in the pending-only upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "daily_view_month",
    "Smoke verifier must keep daily calendar view uploads limited to month metadata."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "meeting_view_month",
    "Smoke verifier must keep meeting calendar view uploads limited to month metadata."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "MEETING_REVIEW_STATE_SETTING_KEY",
    "Smoke verifier must keep meeting review state in the pending-only upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "seen_meeting_page_ids",
    "Smoke verifier must keep meeting seen-state uploads limited to page ids."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "dismissed_trace_page_ids",
    "Smoke verifier must keep dismissed trace uploads limited to page ids."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "MEETING_DELETION_TOMBSTONES_SETTING_KEY",
    "Smoke verifier must keep meeting deletion tombstones in the pending-only upload allowlist."
  );
  assertIncludes(
    files.workspaceSettingsPendingSync,
    workspaceSettingsPendingSync,
    "deleted_meeting_page_ids",
    "Smoke verifier must keep meeting deletion tombstone uploads limited to page ids."
  );
  assertIncludes(
    files.pageFavoritesWorkspaceSettings,
    pageFavoritesWorkspaceSettings,
    'format: "zhinote-page-favorites-settings-cloud-receipt"',
    "Smoke verifier must keep page favorites settings cloud receipts."
  );
  assertIncludes(
    files.pageFavoritesWorkspaceSettings,
    pageFavoritesWorkspaceSettings,
    "workspaces.settings.page_favorites",
    "Smoke verifier must keep page favorites targeting cloud workspace settings."
  );
  assertIncludes(
    files.pageFavoritesWorkspaceSettings,
    pageFavoritesWorkspaceSettings,
    "reads_page_titles: false",
    "Smoke verifier must keep page favorite settings title-free."
  );
  assertIncludes(
    files.usePageFavorites,
    usePageFavorites,
    "getWorkspaceSetting(PAGE_FAVORITES_SETTING_KEY)",
    "Smoke verifier must keep page favorites hydrating from workspace_settings."
  );
  assertIncludes(
    files.usePageFavorites,
    usePageFavorites,
    "legacy-page-favorites-localStorage",
    "Smoke verifier must keep legacy page favorite migration."
  );
  assertIncludes(
    files.pageViewPreferencesWorkspaceSettings,
    pageViewPreferencesWorkspaceSettings,
    'format: "zhinote-page-view-preferences-settings-cloud-receipt"',
    "Smoke verifier must keep page view preferences cloud receipts."
  );
  assertIncludes(
    files.pageViewPreferencesWorkspaceSettings,
    pageViewPreferencesWorkspaceSettings,
    "workspaces.settings.page_view_preferences",
    "Smoke verifier must keep page view preferences targeting cloud workspace settings."
  );
  assertIncludes(
    files.pageViewPreferencesWorkspaceSettings,
    pageViewPreferencesWorkspaceSettings,
    "reads_comment_bodies: false",
    "Smoke verifier must keep page view preferences comment-body-free."
  );
  assertIncludes(
    files.pageViewPreferencesWorkspaceSettings,
    pageViewPreferencesWorkspaceSettings,
    "child_tree_view_modes",
    "Smoke verifier must keep child tree view modes in page view preference metadata."
  );
  assertIncludes(
    files.usePageViewPreferences,
    usePageViewPreferences,
    "getWorkspaceSetting(PAGE_VIEW_PREFERENCES_SETTING_KEY)",
    "Smoke verifier must keep page view preferences hydrating from workspace_settings."
  );
  assertIncludes(
    files.usePageViewPreferences,
    usePageViewPreferences,
    "legacy-page-view-localStorage",
    "Smoke verifier must keep legacy page view preference migration."
  );
  assertIncludes(
    files.usePageViewPreferences,
    usePageViewPreferences,
    "setChildTreeViewMode",
    "Smoke verifier must keep child tree view mode persistence in page view preferences."
  );
  assertIncludes(
    files.childPageTree,
    childPageTree,
    "usePageViewPreferences(pageId)",
    "Smoke verifier must keep child page tree reading view mode from page view preferences."
  );
  assertIncludes(
    files.childPageTree,
    childPageTree,
    "setChildTreeViewMode(pageId, mode)",
    "Smoke verifier must keep child page tree saving view mode through page view preferences."
  );
  for (const [snippet, message] of [
    [
      "const workspacePages = useWorkspaceStore((s) => s.pages)",
      "Smoke verifier must keep child page tree seeded from already-loaded workspace pages.",
    ],
    [
      "listPageMetadata(pageId)",
      "Smoke verifier must keep child page tree using parent-scoped metadata reads.",
    ],
    [
      "collectDescendantsFromMemory(pageId, workspacePages)",
      "Smoke verifier must keep child page tree reusing in-memory descendants.",
    ],
  ]) {
    assertIncludes(files.childPageTree, childPageTree, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'from "@/hooks/usePages"',
      "Smoke verifier must keep child page tree from importing usePages for global auto-loads.",
    ],
    [
      "usePages()",
      "Smoke verifier must keep child page tree from calling usePages for global auto-loads.",
    ],
    [
      "usePages({",
      "Smoke verifier must keep child page tree from calling usePages for global auto-loads.",
    ],
  ]) {
    assertExcludes(files.childPageTree, childPageTree, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "listScopedPageMetadata",
      "Smoke verifier must keep knowledge and industry modules using a shared scoped metadata helper.",
    ],
    [
      "listPageMetadata(rootId)",
      "Smoke verifier must keep scoped page metadata rooted at one module root.",
    ],
    [
      "listPageMetadata(current.id)",
      "Smoke verifier must keep scoped page metadata walking scoped descendants.",
    ],
    [
      "mergePageMetadata",
      "Smoke verifier must keep optimistic local merges for scoped module pages.",
    ],
  ]) {
    assertIncludes(files.scopedPageMetadata, scopedPageMetadata, snippet, message);
  }
  for (const [sourceLabel, source, expectedSnippets] of [
    [
      files.knowledgeBaseShell,
      knowledgeBaseShell,
      [
        "listScopedPageMetadata",
        "mergeScopedPages",
        "upsertWorkspacePages(incoming)",
        "mergeScopedPages([page])",
        "mergeScopedPages([updatedLinkPage ?? linkPage])",
        "onChanged={() => void loadScopedPages()}",
      ],
    ],
    [
      files.industryChainShell,
      industryChainShell,
      [
        "listScopedPageMetadata",
        "mergeScopedPages",
        "upsertWorkspacePages(incoming)",
        "includeDescendants: false",
        "mergeScopedPages([child])",
        "mergeScopedPages([updatedLinkPage ?? linkPage])",
        "onChanged={() => void loadScopedPages()}",
      ],
    ],
  ]) {
    for (const snippet of expectedSnippets) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Smoke verifier must keep knowledge base and industry chain on scoped metadata and optimistic local page merges."
      );
    }
    for (const forbiddenSnippet of [
      'from "@/hooks/usePages"',
      "usePages(",
      "await refresh()",
    ]) {
      assertExcludes(
        sourceLabel,
        source,
        forbiddenSnippet,
        "Smoke verifier must keep knowledge base and industry chain from triggering global page refreshes."
      );
    }
  }
  assertIncludes(
    files.quickSearchWorkspaceSettings,
    quickSearchWorkspaceSettings,
    'format: "zhinote-quick-search-saved-searches-settings-cloud-receipt"',
    "Smoke verifier must keep quick search saved searches cloud receipts."
  );
  assertIncludes(
    files.quickSearchWorkspaceSettings,
    quickSearchWorkspaceSettings,
    "workspaces.settings.quick_search_saved_searches",
    "Smoke verifier must keep quick search saved searches targeting cloud workspace settings."
  );
  assertIncludes(
    files.quickSearchWorkspaceSettings,
    quickSearchWorkspaceSettings,
    "reads_page_titles: false",
    "Smoke verifier must keep saved searches title-free."
  );
  assertIncludes(
    files.quickSearchWorkspaceSettings,
    quickSearchWorkspaceSettings,
    "reads_database_row_values: false",
    "Smoke verifier must keep saved searches database-row-free."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "getWorkspaceSetting(QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY)",
    "Smoke verifier must keep quick search hydrating saved searches from workspace_settings."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "upsertWorkspaceSetting(",
    "Smoke verifier must keep quick search saved searches writing workspace_settings and sync_log."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "legacy-quick-search-saved-searches-localStorage",
    "Smoke verifier must keep legacy saved search migration."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "searchPageMetadata(pages, trimmedValue)",
    "Smoke verifier must keep quick search returning page metadata matches before full-text scans."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "QUICK_SEARCH_FULL_TEXT_DELAY_MS",
    "Smoke verifier must keep quick search full-text scans deferred behind a short delay."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "deferredFullTextSearchTimerRef",
    "Smoke verifier must keep stale quick search full-text timers cancellable."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "mergeSearchResults(currentResults, fullTextResults)",
    "Smoke verifier must keep deferred full-text results merging into metadata-first results."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    "searchPages(trimmedValue, QUICK_SEARCH_RESULT_LIMIT)",
    "Smoke verifier must keep quick search deferred full-text results bounded."
  );
  for (const snippet of [
    "QUICK_SEARCH_ACTIVITY_LIMIT",
    "const suggestedPages = useMemo(() => {",
    "if (!open || hasQuery) return [];",
    "getTopPagesByTimestamp(",
  ]) {
    assertIncludes(
      files.quickSearch,
      quickSearch,
      snippet,
      "Quick search default activity pages must stay bounded and memoized for large imported workspaces."
    );
  }
  for (const snippet of [
    "route?: string;",
    "const handleEntryPrewarm = (entry: SearchEntry)",
    "warmModuleRoute(entry.command.route)",
    "onPrewarm={() => handleEntryPrewarm(entry)}",
    "onPointerEnter={onPrewarm}",
    "onFocus={onPrewarm}",
    'route: "/modules/reports"',
    'route: "/modules/databases"',
    'route: "/modules/sync"',
  ]) {
    assertIncludes(
      files.quickSearch,
      quickSearch,
      snippet,
      "Quick search module command results must warm their route on hover/focus before navigation."
    );
  }
  for (const snippet of [
    "QUICK_SEARCH_DATABASE_REFRESH_TTL_MS",
    "databaseRefreshInFlightRef",
    "lastDatabaseRefreshAtRef",
    "const refreshDatabasesForPalette = useCallback",
    "if (databaseRefreshInFlightRef.current) return;",
    "lastDatabaseRefreshAtRef.current = now;",
    "refreshDatabasesForPalette();",
  ]) {
    assertIncludes(
      files.quickSearch,
      quickSearch,
      snippet,
      "Quick search must throttle database refreshes on open so Cmd+K stays metadata-first and responsive."
    );
  }
  assertExcludes(
    files.quickSearch,
    quickSearch,
    "void refreshDatabases({ broadcast: false });",
    "Quick search must not refresh databases unconditionally every time the palette opens."
  );
  for (const snippet of [
    "export async function searchPages(query: string, limit = 20)",
    "content_text LIKE ?",
    "const candidateLimit = Math.max(limit * 8, limit)",
  ]) {
    assertIncludes(
      files.localQueries,
      localQueries,
      snippet,
      "Smoke verifier must keep local full-text page search candidate-bounded."
    );
  }
  assertIncludes(
    files.wikiSuggestion,
    wikiSuggestion,
    "searchPageMetadata(query, 8)",
    "Smoke verifier must keep wiki link typed suggestions metadata-only and bounded."
  );
  assertExcludes(
    files.wikiSuggestion,
    wikiSuggestion,
    "searchPages(",
    "Smoke verifier must keep wiki link suggestions from scanning page bodies while editing."
  );
  assertIncludes(
    files.calendarViewStateWorkspaceSettings,
    calendarViewStateWorkspaceSettings,
    'format: "zhinote-calendar-view-state-settings-cloud-receipt"',
    "Smoke verifier must keep calendar view state cloud receipts."
  );
  assertIncludes(
    files.calendarViewStateWorkspaceSettings,
    calendarViewStateWorkspaceSettings,
    "workspaces.settings.calendar_view_state",
    "Smoke verifier must keep calendar view state targeting cloud workspace settings."
  );
  assertIncludes(
    files.calendarViewStateWorkspaceSettings,
    calendarViewStateWorkspaceSettings,
    "reads_page_titles: false",
    "Smoke verifier must keep calendar view state page-title-free."
  );
  assertIncludes(
    files.calendarViewStateWorkspaceSettings,
    calendarViewStateWorkspaceSettings,
    "reads_meeting_titles: false",
    "Smoke verifier must keep calendar view state meeting-title-free."
  );
  assertIncludes(
    files.calendarViewStateWorkspaceSettings,
    calendarViewStateWorkspaceSettings,
    "reads_database_row_values: false",
    "Smoke verifier must keep calendar view state database-row-free."
  );
  assertIncludes(
    files.useCalendarViewMonthPreference,
    useCalendarViewMonthPreference,
    "getWorkspaceSetting(CALENDAR_VIEW_STATE_SETTING_KEY)",
    "Smoke verifier must keep calendar view months hydrating from workspace_settings."
  );
  assertIncludes(
    files.useCalendarViewMonthPreference,
    useCalendarViewMonthPreference,
    "upsertWorkspaceSetting(",
    "Smoke verifier must keep calendar view months writing workspace_settings and sync_log."
  );
  assertIncludes(
    files.useCalendarViewMonthPreference,
    useCalendarViewMonthPreference,
    "legacy-calendar-view-month-localStorage",
    "Smoke verifier must keep legacy calendar view month migration."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'useCalendarViewMonthPreference("daily")',
    "Smoke verifier must keep daily notes calendar view month on workspace settings."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    'useCalendarViewMonthPreference("meeting")',
    "Smoke verifier must keep meeting calendar view month on workspace settings."
  );
  assertIncludes(
    files.meetingReviewStateWorkspaceSettings,
    meetingReviewStateWorkspaceSettings,
    'format: "zhinote-meeting-review-state-settings-cloud-receipt"',
    "Smoke verifier must keep meeting review state cloud receipts."
  );
  assertIncludes(
    files.meetingReviewStateWorkspaceSettings,
    meetingReviewStateWorkspaceSettings,
    "workspaces.settings.meeting_review_state",
    "Smoke verifier must keep meeting review state targeting cloud workspace settings."
  );
  assertIncludes(
    files.meetingReviewStateWorkspaceSettings,
    meetingReviewStateWorkspaceSettings,
    "reads_meeting_titles: false",
    "Smoke verifier must keep meeting review state meeting-title-free."
  );
  assertIncludes(
    files.meetingReviewStateWorkspaceSettings,
    meetingReviewStateWorkspaceSettings,
    "reads_meeting_urls: false",
    "Smoke verifier must keep meeting review state meeting-url-free."
  );
  assertIncludes(
    files.useMeetingReviewStatePreference,
    useMeetingReviewStatePreference,
    "getWorkspaceSetting(MEETING_REVIEW_STATE_SETTING_KEY)",
    "Smoke verifier must keep meeting review state hydrating from workspace_settings."
  );
  assertIncludes(
    files.useMeetingReviewStatePreference,
    useMeetingReviewStatePreference,
    "upsertWorkspaceSetting(",
    "Smoke verifier must keep meeting review state writing workspace_settings and sync_log."
  );
  assertIncludes(
    files.useMeetingReviewStatePreference,
    useMeetingReviewStatePreference,
    "legacy-meeting-review-state-localStorage",
    "Smoke verifier must keep legacy meeting review state migration."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "useMeetingReviewStatePreference()",
    "Smoke verifier must keep ZhiHui review chips on workspace settings."
  );
  assertIncludes(
    files.meetingDeletionTombstonesWorkspaceSettings,
    meetingDeletionTombstonesWorkspaceSettings,
    'format: "zhinote-meeting-deletion-tombstones-settings-cloud-receipt"',
    "Smoke verifier must keep meeting deletion tombstone cloud receipts."
  );
  assertIncludes(
    files.meetingDeletionTombstonesWorkspaceSettings,
    meetingDeletionTombstonesWorkspaceSettings,
    "workspaces.settings.meeting_deletion_tombstones",
    "Smoke verifier must keep meeting deletion tombstones targeting cloud workspace settings."
  );
  assertIncludes(
    files.meetingDeletionTombstonesWorkspaceSettings,
    meetingDeletionTombstonesWorkspaceSettings,
    "reads_meeting_titles: false",
    "Smoke verifier must keep meeting deletion tombstones meeting-title-free."
  );
  assertIncludes(
    files.meetingDeletionTombstonesWorkspaceSettings,
    meetingDeletionTombstonesWorkspaceSettings,
    "reads_meeting_urls: false",
    "Smoke verifier must keep meeting deletion tombstones meeting-url-free."
  );
  assertIncludes(
    files.useMeetingDeletionTombstonesPreference,
    useMeetingDeletionTombstonesPreference,
    "getWorkspaceSetting(MEETING_DELETION_TOMBSTONES_SETTING_KEY)",
    "Smoke verifier must keep meeting deletion tombstones hydrating from workspace_settings."
  );
  assertIncludes(
    files.useMeetingDeletionTombstonesPreference,
    useMeetingDeletionTombstonesPreference,
    "upsertWorkspaceSetting(",
    "Smoke verifier must keep meeting deletion tombstones writing workspace_settings and sync_log."
  );
  assertIncludes(
    files.useMeetingDeletionTombstonesPreference,
    useMeetingDeletionTombstonesPreference,
    "legacy-meeting-deletion-tombstones-localStorage",
    "Smoke verifier must keep legacy meeting deletion tombstone migration."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "useMeetingDeletionTombstonesPreference()",
    "Smoke verifier must keep ZhiHui deletion tombstones on workspace settings."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    'requireCloudWritesResponse("workspace-settings-update")',
    "Smoke verifier must keep workspace settings writes behind the cloud write gate."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    'cloudNotConfiguredResponse("workspace-settings-read")',
    "Smoke verifier must keep workspace settings reads behind the cloud configured gate."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "buildHotCacheSettingsCloudReadReceipt",
    "Smoke verifier must keep workspace settings read receipts."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validatePageFavoritesWorkspaceSettingsCloudPayload",
    "Smoke verifier must keep workspace settings API accepting page favorites."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "page_favorites",
    "Smoke verifier must keep workspace settings API returning page favorites metadata."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validatePageViewPreferencesWorkspaceSettingsCloudPayload",
    "Smoke verifier must keep workspace settings API accepting page view preferences."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "page_view_preferences",
    "Smoke verifier must keep workspace settings API returning page view preferences metadata."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validateQuickSearchSavedSearchesWorkspaceSettingsCloudPayload",
    "Smoke verifier must keep workspace settings API accepting quick search saved searches."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "quick_search_saved_searches",
    "Smoke verifier must keep workspace settings API returning quick search saved-search metadata."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validateCalendarViewStateWorkspaceSettingsCloudPayload",
    "Smoke verifier must keep workspace settings API accepting calendar view state."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "calendar_view_state",
    "Smoke verifier must keep workspace settings API returning calendar view metadata."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validateMeetingReviewStateWorkspaceSettingsCloudPayload",
    "Smoke verifier must keep workspace settings API accepting meeting review state."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "meeting_review_state",
    "Smoke verifier must keep workspace settings API returning meeting review metadata."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validateMeetingDeletionTombstonesWorkspaceSettingsCloudPayload",
    "Smoke verifier must keep workspace settings API accepting meeting deletion tombstones."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "meeting_deletion_tombstones",
    "Smoke verifier must keep workspace settings API returning meeting deletion tombstone metadata."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validateAccountModuleSettingCloudPayload",
    "Smoke verifier must keep workspace settings API accepting account/module settings."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "account_module_settings",
    "Smoke verifier must keep workspace settings API returning account/module settings metadata."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "handleAccountModuleSettingsCloudSync",
    "Smoke verifier must keep account/module settings cloud sync action."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "handleAccountModuleSettingsCloudPull",
    "Smoke verifier must keep account/module settings cloud restore action."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "getPendingAccountModuleSettingSyncLogEntries",
    "Smoke verifier must keep account/module settings cloud restore checking local pending rows."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "applyRemoteAccountModuleSettings",
    "Smoke verifier must keep account/module settings cloud restore applying local cache rows."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "markAccountSettingSyncLogEntriesSynced",
    "Smoke verifier must acknowledge account setting pending rows after cloud success."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "markModuleSettingSyncLogEntriesSynced",
    "Smoke verifier must acknowledge module setting pending rows after cloud success."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "同步账号/模块设置",
    "Smoke verifier must render the account/module settings cloud sync button."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "从云端恢复设置",
    "Smoke verifier must render the account/module settings cloud restore button."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "workspace-settings-readonly-role",
    "Smoke verifier must keep viewer writes blocked."
  );
  assertIncludes(
    files.sidebar,
    sidebar,
    "SIDEBAR_PRIMARY_ORDER_SETTING_KEY",
    "Smoke verifier must keep sidebar primary order on a stable workspace setting key."
  );
  assertIncludes(
    files.sidebar,
    sidebar,
    "SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY",
    "Smoke verifier must keep sidebar primary customizations on a stable workspace setting key."
  );
  assertIncludes(
    files.sidebar,
    sidebar,
    "getWorkspaceSetting(SIDEBAR_PRIMARY_ORDER_SETTING_KEY)",
    "Smoke verifier must keep sidebar order hydration on workspace_settings."
  );
  assertIncludes(
    files.sidebar,
    sidebar,
    "upsertWorkspaceSetting(",
    "Smoke verifier must keep sidebar preference saves in workspace_settings and sync_log."
  );
  assertIncludes(
    files.sidebar,
    sidebar,
    "localStorage is only a fast boot cache and migration source",
    "Smoke verifier must keep localStorage as sidebar cache/migration only."
  );
  assertIncludes(
    files.sidebarWorkspaceSettings,
    sidebarWorkspaceSettings,
    'format: "zhinote-sidebar-settings-cloud-receipt"',
    "Smoke verifier must keep sidebar settings cloud receipts."
  );
  assertIncludes(
    files.sidebarWorkspaceSettings,
    sidebarWorkspaceSettings,
    "workspaces.settings.sidebar_primary_order",
    "Smoke verifier must keep sidebar primary order targeting cloud settings."
  );
  assertIncludes(
    files.sidebarWorkspaceSettings,
    sidebarWorkspaceSettings,
    "workspaces.settings.sidebar_primary_customization",
    "Smoke verifier must keep sidebar primary customization targeting cloud settings."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "validateSidebarWorkspaceSettingsCloudPayload",
    "Smoke verifier must keep workspace settings API accepting sidebar settings."
  );
  assertIncludes(
    files.workspaceSettingsRoute,
    workspaceSettingsRoute,
    "sidebar_settings",
    "Smoke verifier must keep workspace settings API returning sidebar settings metadata."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "常驻本地缓存选择",
    "Sync UI must render the hot cache selection panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "当前月份会议日历",
    "Sync UI must expose current-month meeting hot cache selection."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "指定数据库",
    "Sync UI must expose pinned database hot cache selection."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "只保存数据库 ID 清单",
    "Sync UI must explain pinned databases store setting metadata only."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出选择合同",
    "Sync UI must expose the hot cache selection export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "notifyHotCachePreferencesChanged",
    "Sync UI must notify other local surfaces after hot-cache preferences change."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "同步待上传设置",
    "Sync UI must expose the workspace settings pending sync button."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "从云端恢复工作区设置",
    "Sync UI must expose the workspace settings cloud restore button."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "getPendingWorkspaceSettingSyncLogEntries",
    "Sync UI must protect local pending workspace settings before restore."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "applyRemoteWorkspaceSettings",
    "Sync UI must apply workspace settings cloud restore without creating sync_log rows."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "本机缓存重建入口",
    "Sync UI must render the cache rebuild safety entrypoint."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "本地 pending 变更未清空前不建议重建",
    "Sync UI must warn before rebuilding cache with local pending edits."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "buildCacheRebuildPreflightReceipt",
    "Sync UI must build cache rebuild preflight receipts."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出重建预检收据",
    "Sync UI must expose cache rebuild preflight receipt export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "重建 dry-run 预检",
    "Sync UI must render cache rebuild dry-run preflight gates."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "zhinote-cache-rebuild-preflight-receipt",
    "Sync UI must export cache rebuild preflight receipts with a stable filename."
  );
  assertIncludes(
    files.cacheRebuildPreflightReceipt,
    cacheRebuildPreflightReceipt,
    'format: "zhinote-cache-rebuild-preflight-receipt"',
    "Cache rebuild preflight receipt must declare its export format."
  );
  assertIncludes(
    files.cacheRebuildPreflightReceipt,
    cacheRebuildPreflightReceipt,
    'receipt_status: "metadata-only-dry-run"',
    "Cache rebuild preflight receipt must remain a metadata-only dry run."
  );
  assertIncludes(
    files.cacheRebuildPreflightReceipt,
    cacheRebuildPreflightReceipt,
    "clears_local_cache: false",
    "Cache rebuild preflight receipt must not clear local cache."
  );
  assertIncludes(
    files.cacheRebuildPreflightReceipt,
    cacheRebuildPreflightReceipt,
    "uploads_workspace_data: false",
    "Cache rebuild preflight receipt must not upload workspace data."
  );
  assertIncludes(
    files.cacheRebuildPreflightReceipt,
    cacheRebuildPreflightReceipt,
    "includes_only_counts_watermarks_hashes_and_gates: true",
    "Cache rebuild preflight receipt must stay counts/hash/gates only."
  );
  assertIncludes(
    files.cacheRebuildPreflightReceipt,
    cacheRebuildPreflightReceipt,
    "local_pending_edits_block_rebuild: true",
    "Cache rebuild preflight receipt must block rebuild while local pending edits exist."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "前往账号页重建缓存",
    "Sync UI must hand cache rebuilds off to the account page confirmation flow."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "export function getPendingCloudPageSyncStatus",
    "Smoke verifier must keep page pending upload status visible to the sync dashboard."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "PENDING_PUSH_META_KEY",
    "Smoke verifier must keep metadata-only page pending queue timestamps available."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "oldestPendingQueuedAt",
    "Smoke verifier must keep the oldest page pending timestamp visible."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "pendingSampleIds",
    "Smoke verifier must keep page pending sample ids visible."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "authRetryStatus: authRetry.status",
    "Smoke verifier must keep page auth retry status visible in pending metadata."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "authRetryUntil: authRetry.until",
    "Smoke verifier must keep page auth retry retry-at metadata visible."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "getAuthRetrySnapshot",
    "Smoke verifier must keep page auth retry backoff readable without uploading content."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "认证退避",
    "Sync UI must show auth retry backoff state instead of looking idle."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "下次自动重试",
    "Sync UI must show when auth retry backoff will retry."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "export async function getCloudPageManifestSummary",
    "Smoke verifier must keep cloud page manifest summary available to the sync dashboard."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "export async function getCloudDailyManifestSummary",
    "Smoke verifier must keep cloud daily manifest summary available to the sync dashboard."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "export async function getCloudMeetingManifestSummary",
    "Smoke verifier must keep cloud meeting manifest summary available to the sync dashboard."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "export async function getLocalDailySyncSummary",
    "Smoke verifier must keep local daily manifest summary available to the sync dashboard."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "export async function getLocalMeetingSyncSummary",
    "Smoke verifier must keep local meeting manifest summary available to the sync dashboard."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "页面 pending 上传队列",
    "Sync UI must show page pending upload queue status."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "补传页面队列",
    "Sync UI must expose a manual page pending retry action."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "只保存 page id 和排队时间，不保存页面正文",
    "Sync UI must preserve the privacy boundary for the page pending queue."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "最早排队",
    "Sync UI must show the oldest page pending queue timestamp."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "样本 page id",
    "Sync UI must expose metadata-only page pending sample ids."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    'data-testid="page-pending-queue-details"',
    "Sync UI must expose a stable test hook for the page pending queue details panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    'data-testid="page-pending-sample-id"',
    "Sync UI must expose stable test hooks for metadata-only page id samples."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "补传按钮才会尝试上传 pending",
    "Sync UI must clarify that reading queue details does not trigger upload."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "PAGE_SYNC_STATUS_EVENT",
    "Sync UI must listen to page pending queue status changes while open."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "refreshPagePendingStatus",
    "Sync UI must refresh page pending queue details without requiring navigation."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "export async function getPendingCloudDatabaseSyncStatus",
    "Smoke verifier must keep database pending upload status visible to the sync dashboard."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    'DATABASE_SYNC_STATUS_EVENT = "zhinote:databasesync-status"',
    "Smoke verifier must keep database pending queue status events available."
  );
  assertIncludes(
    files.databaseCloudSync,
    databaseCloudSync,
    "PENDING_STATUS_SYNC_DELAY_MS",
    "Database cloud sync hook must schedule low-latency quick syncs from pending status events."
  );
  assertIncludes(
    files.databaseCloudSync,
    databaseCloudSync,
    "scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS)",
    "Database pending queue status must trigger quick sync without waiting for the normal poll."
  );
  assertIncludes(
    files.databaseCloudSync,
    databaseCloudSync,
    "detail.pending + detail.queued + detail.syncLogPending",
    "Database pending status quick sync must include all local pending queue sources."
  );
  assertIncludes(
    files.databaseCloudSync,
    databaseCloudSync,
    "DATABASE_PENDING_STORAGE_KEYS",
    "Database cloud sync must restrict cross-tab quick syncs to database pending storage keys."
  );
  assertIncludes(
    files.databaseCloudSync,
    databaseCloudSync,
    'DATABASE_PENDING_STORAGE_KEYS.has(event.key ?? "")',
    "Database cross-tab pending storage changes must trigger low-latency quick sync."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "PENDING_PUSH_META_KEY",
    "Database pending queue must store metadata separately from database row values."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "oldestPendingQueuedAt",
    "Database pending status must expose the oldest queued timestamp."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "pendingSampleKeys",
    "Database pending status must expose metadata-only sample keys."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "authRetryStatus: authRetry.status",
    "Database pending status must expose auth retry status metadata."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "authRetryUntil: authRetry.until",
    "Database pending status must expose auth retry retry-at metadata."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "getAuthRetrySnapshot",
    "Database pending status must read auth retry backoff without reading row values."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "emitDatabaseSyncStatusChanged",
    "Database sync client must emit status changes when queue metadata changes."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "export async function getCloudDatabaseManifestSummary",
    "Smoke verifier must keep cloud database manifest summary available to the sync dashboard."
  );
  assertIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "const pending = await getPendingDatabaseSyncRecords(1000)",
    "Database pending status must read local sync_log metadata."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "数据库 pending 上传队列",
    "Sync UI must show database pending upload queue status."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "补传数据库队列",
    "Sync UI must expose a manual database pending retry action."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    'data-testid="database-pending-queue-details"',
    "Sync UI must expose a stable test hook for the database pending queue details panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    'data-testid="database-pending-queue-fact"',
    "Sync UI must expose stable test hooks for database pending queue facts."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "数据库待上传样本",
    "Sync UI must render database pending sample keys in reader-facing language."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "这里只显示数据库队列数量",
    "Sync UI database pending details must clarify the panel is metadata-only."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    'data-testid="database-pending-sample-key"',
    "Sync UI must expose stable test hooks for metadata-only database key samples."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "database/field/row/view key",
    "Sync UI database pending details must show key-only samples instead of row values."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "不读取 row",
    "Sync UI database pending details must avoid reading database row values."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "DATABASE_SYNC_STATUS_EVENT",
    "Sync UI must listen to database pending queue status changes while open."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "refreshDatabasePendingStatus",
    "Sync UI must refresh database pending queue details without requiring navigation."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "不展示或导出数据库行值",
    "Sync UI must preserve the privacy boundary for the database pending queue."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "全域 pending 变更分布",
    "Sync UI must show a full-domain pending distribution panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "只读取 sync_log 的表名、计数和时间戳",
    "Sync UI full-domain pending distribution must stay metadata-only."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "普通同步仍只上传这些 pending 行指向的明确变更",
    "Sync UI full-domain pending distribution must preserve pending-only sync."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    "fetchMeetingCloudMetadata",
    "Smoke verifier must keep meeting calendar cloud metadata behind the shared page sync helper."
  );
  assertIncludes(
    files.accountPageSync,
    accountPageSync,
    'action: "meeting-calendar-metadata"',
    "Smoke verifier must keep the meeting calendar metadata server action wired."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "fetchMeetingCloudMetadata",
    "Meeting calendar must load cloud metadata through the shared helper."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "getModuleRootIdSync",
    "Meeting calendar must reuse the cached root id so local cache can render first."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "const cloudPromise = includeCloud",
    "Meeting calendar must gate cloud hydration so local-only refreshes do not block the local render."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "void load({ includeCloud: false })",
    "Meeting calendar page-revision refresh must avoid repeating cloud hydration."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "publishMeetings(localPagesForMerge, cloud.pages)",
    "Meeting calendar must merge cloud metadata with local hot-cache meetings."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "persistMeetingCloudMetadata",
    "Meeting calendar must persist cloud metadata into the local hot cache."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "applyRemotePageMetadata",
    "Meeting calendar must use metadata-only local cache writes."
  );
  assertIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "pushCloudPages",
    "Meeting calendar cloud-only fallback must push through the shared pending-aware helper."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "renderedLocalSnapshot",
    "Database detail page must render local hot cache before waiting for cloud hydration."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "applyDatabaseSnapshot(localSnapshot)",
    "Database detail page must display the rebuildable local cache immediately when available."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "syncCloudDatabaseById(databaseId, { maxBatches: 1 })",
    "Database detail page must hydrate the first cloud database batch without waiting for the full database."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "optimisticDatabaseMutationBlockUntilRef",
    "Database row edits must suppress self-triggered reloads while optimistic local state is active."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "updateLocalRowFieldValues(current, rowId, fieldValues)",
    "Database cell edits must update visible rows before background persistence."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "persistDatabaseRowInBackground(updateRow(rowId, { fieldValues }))",
    "Database cell edits must persist through the pending-aware database mutation helper in the background."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "upsertLocalRows(current, [rowWithPage])",
    "Database row creation must append the local row to the current view without a full reload."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "useLocalFirstPageNavigation",
    "Database row full-page opens must use the shared local-first page navigation path."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "const prepareDatabaseRowPageOpen = useCallback",
    "Database row full-page opens must prepare a local-first page seed before navigation."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "rememberPendingPageDraft(seededPage)",
    "Database row full-page opens must seed pending page drafts for instant editor mount."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "rememberPageRouteHandoff(seededPage, source)",
    "Database row full-page opens must hand page metadata through the route handoff cache."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "const page = prepareDatabaseRowPageOpen(row.page, source)",
    "Database row full-page opens must hand a prepared page to local-first navigation."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "openPage(page, { source })",
    "Database row full-page opens must navigate with the prepared local-first page seed."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    'openPage(pageId, { source: "database-row-open" })',
    "Database row page-id fallback must still use local-first navigation without a metadata seed."
  );
  assertIncludes(
    files.localFirstDatabaseNavigation,
    localFirstDatabaseNavigation,
    "warmDatabaseShellModule();",
    "Shared database navigation must warm the database shell before route navigation."
  );
  assertIncludes(
    files.localFirstDatabaseNavigation,
    localFirstDatabaseNavigation,
    "router.prefetch(href)",
    "Shared database navigation must prefetch database detail routes as a speed hint."
  );
  assertIncludes(
    files.localFirstDatabaseNavigationUtil,
    localFirstDatabaseNavigationUtil,
    "@/components/providers/DatabasePageShell",
    "Shared database navigation must preload the database page shell without reading database rows."
  );
  for (const [sourceLabel, source, snippets] of [
    [
      files.sidebar,
      sidebar,
      ["useLocalFirstDatabaseNavigation", "openDatabase(db.id)"],
    ],
    [
      files.quickSearch,
      quickSearch,
      [
        "useLocalFirstDatabaseNavigation",
        "openDatabase(database.id)",
        "openDatabase(entry.database.id)",
      ],
    ],
    [
      files.databasesShell,
      databasesShell,
      [
        "useLocalFirstDatabaseNavigation",
        "openDatabase(database.id)",
        "openDatabase(databaseId)",
        "openDatabase(item.database_id)",
      ],
    ],
    [
      files.moduleDashboard,
      moduleDashboard,
      ["useLocalFirstDatabaseNavigation", "openDatabase(database.id)"],
    ],
    [
      files.pageImportPlanPanel,
      pageImportPlanPanel,
      [
        "useLocalFirstDatabaseNavigation",
        "openDatabase(res.first_database_id)",
      ],
    ],
  ]) {
    for (const snippet of snippets) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Common database opens must warm and prefetch the database route through the shared local-first database navigation helper."
      );
    }
  }
  assertIncludes(
    files.localFirstModuleNavigation,
    localFirstModuleNavigation,
    "warmModuleRoute(route);",
    "Shared module navigation must warm the module shell before route navigation."
  );
  assertIncludes(
    files.localFirstModuleNavigation,
    localFirstModuleNavigation,
    "router.prefetch(route);",
    "Shared module navigation must prefetch module routes as a speed hint."
  );
  for (const snippet of [
    "@/components/modules/DailyNotesShell",
    "@/components/modules/MeetingScheduleShell",
    "@/components/modules/DatabasesShell",
    "@/components/modules/ReportsShell",
    "@/components/modules/SyncShell",
  ]) {
    assertIncludes(
      files.localFirstModuleNavigationUtil,
      localFirstModuleNavigationUtil,
      snippet,
      "Module route warmup must preload high-frequency module shells without reading content rows."
    );
  }
  for (const [sourceLabel, source, snippets] of [
    [
      files.sidebar,
      sidebar,
      [
        "useLocalFirstModuleNavigation",
        'warmModuleRoute(item.href)',
        'warmModuleRoute(module.route || "/modules")',
        'openModuleRoute("/modules")',
      ],
    ],
    [
      files.quickSearch,
      quickSearch,
      [
        "useLocalFirstModuleNavigation",
        "const handleOpenModuleRoute = (route: string)",
        "warmModuleRoute(entry.command.route)",
        "openModuleRoute(route)",
        'openPage(result.page, { source: "quick-search-create" })',
        "openDatabase(result.database.id)",
      ],
    ],
  ]) {
    for (const snippet of snippets) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Common module opens must warm and prefetch module shells through the shared local-first module navigation helper."
      );
    }
  }
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "updateLocalRowPositions(current, {",
    "Database row moves must update local row order before background persistence."
  );
  for (const [snippet, message] of [
    [
      "startOffset: cloud.nextOffset",
      "Database detail page must continue cloud database hydration from the next page offset.",
    ],
    [
      "collectRecords: false",
      "Database detail background cloud hydration must avoid retaining the full database record set in memory.",
    ],
    [
      "readLocalDatabaseSafe().then(applyDatabaseSnapshot)",
      "Database detail page must refresh from local cache after background cloud hydration completes.",
    ],
    [
      "DATABASE_VIEW_INITIAL_RENDER_LIMIT",
      "Database views must keep an explicit first-render row cap for large imports.",
    ],
    [
      "DATABASE_VIEW_RENDER_BATCH",
      "Database views must load additional rows in bounded batches.",
    ],
    [
      "DATABASE_VIEW_RENDER_CAPPED_TYPES",
      "Database views must declare which row-heavy views are render capped.",
    ],
    [
      "visibleRows.slice(0, databaseViewRowRenderLimit)",
      "Database row-heavy views must render a capped subset instead of every visible row.",
    ],
    [
      "renderedRowGroups",
      "Grouped database views must apply the render cap before mounting grouped rows.",
    ],
    [
      "DatabaseViewShowMoreRows",
      "Database views must expose a load-more control when rows are withheld from the first paint.",
    ],
    [
      "再显示 {nextBatchCount} 行",
      "Database load-more control must disclose the next bounded row batch.",
    ],
    [
      "exportDatabaseAsXlsx(database, fields, visibleRows, workspacePages)",
      "Database Excel export must still use the full visible row set, not the render-capped subset.",
    ],
    [
      "exportDatabaseAsCsv(database, fields, visibleRows, workspacePages)",
      "Database CSV export must still use the full visible row set, not the render-capped subset.",
    ],
    [
      "getRows(databaseId, { includePageContent: false })",
      "Database detail first paint must read row page metadata without page bodies.",
    ],
    [
      "const { page: hydratedPage, loading: pagePreviewLoading } = usePage(",
      "Database row side peek must hydrate the single page body only after the row is opened.",
    ],
  ]) {
    assertIncludes(files.databaseShell, databaseShell, snippet, message);
  }
  assertIncludes(
    files.localQueries,
    localQueries,
    "includePageContent?: boolean",
    "Local database row queries must expose a page-body opt-out for metadata-only views."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "NULL as page_content_text",
    "Local database row metadata reads must omit page bodies when includePageContent is false."
  );
  if (databaseShell.includes("await updateRow(rowId, { fieldValues });")) {
    failures.push(
      `${files.databaseShell} must not await database cell updates before refreshing the whole database.`
    );
  }
  assertIncludes(
    files.usePages,
    usePages,
    "renderLocalPagesSnapshot",
    "Page and sidebar lists must render local hot cache before waiting for cloud metadata."
  );
  assertIncludes(
    files.usePages,
    usePages,
    "metadataFirstContent ? false : includeContent",
    "Page and sidebar lists must read the rebuildable local snapshot first, with content callers allowed to start metadata-only."
  );
  assertIncludes(
    files.usePages,
    usePages,
    "deferContent?: boolean",
    "Content-heavy modules must be able to defer page body hydration until after metadata first paint."
  );
  assertIncludes(
    files.usePages,
    usePages,
    "scheduleDeferredContentHydration",
    "Content-heavy modules must hydrate full page bodies in a background idle task."
  );
  for (const snippet of [
    "hydrateDeferredPageContentBatches",
    "DEFERRED_CONTENT_HYDRATION_BATCH_SIZE",
    "await waitForIdle(1400)",
  ]) {
    assertIncludes(
      files.usePages,
      usePages,
      snippet,
      "Deferred page body hydration must run in bounded idle batches."
    );
  }
  for (const snippet of [
    "export async function listPagesForContentHydration",
    "LIMIT ? OFFSET ?",
  ]) {
    assertIncludes(
      files.localQueries,
      localQueries,
      snippet,
      "Local page content hydration must expose a bounded batch query."
    );
  }
  assertIncludes(
    files.usePages,
    usePages,
    "useWorkspaceStore.getState().upsertPages(contentPages)",
    "Deferred page body hydration must merge content into the existing metadata store instead of replacing cloud metadata."
  );
  for (const snippet of [
    "canPatchPagesWithoutResort",
    "patchPagesWithoutResort",
    "hasWorkspaceOrderChange",
    "if (pages.length === 0) return {};",
    "pagesById: Map<string, Page>;",
    "pagesById: indexPagesById(nextPages)",
    "getPageById: (id) => get().pagesById.get(id)",
  ]) {
    assertIncludes(
      files.workspaceStore,
      workspaceStore,
      snippet,
      "Workspace page store must avoid full-list resorting for order-neutral upserts."
    );
  }
  for (const [file, source, snippet] of [
    [files.usePage, usePage, "useWorkspaceStore.getState().getPageById(pageId)"],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "useWorkspaceStore.getState().getPageById(target)",
    ],
    [
      files.pageTree,
      pageTree,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.favoritePages,
      favoritePages,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [files.quickSearch, quickSearch, "getPageById(pageId)"],
    [
      files.knowledgeBaseShell,
      knowledgeBaseShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.industryChainShell,
      industryChainShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.researchConnectionsPanel,
      researchConnectionsPanel,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.reportsShell,
      reportsShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.reportsShell,
      reportsShell,
      'openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })',
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      'openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })',
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      'openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })',
    ],
  ]) {
    assertIncludes(
      file,
      source,
      snippet,
      "Hot page-opening paths must reuse the workspace page id index."
    );
  }
  assertIncludes(
    files.usePages,
    usePages,
    "syncCloudPageMetadataDelta",
    "Page and sidebar lists must still hydrate from cloud metadata in the background."
  );
  assertIncludes(
    files.usePages,
    usePages,
    "mergeMetadataForCount",
    "Page list cloud hydration must preserve local page body content."
  );
  for (const [sourceLabel, source] of [
    [files.notesShell, notesShell],
    [files.companyResearchShell, companyResearchShell],
    [files.meetingsShell, meetingsShell],
    [files.reportsShell, reportsShell],
    [files.portfolioShell, portfolioShell],
    [files.researchGraphShell, researchGraphShell],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "deferContent: true",
      "Content-heavy research modules must render page metadata before deferred body hydration."
    );
  }
  for (const [sourceLabel, source] of [
    [files.companyResearchShell, companyResearchShell],
    [files.meetingsShell, meetingsShell],
    [files.reportsShell, reportsShell],
    [files.portfolioShell, portfolioShell],
    [files.researchGraphShell, researchGraphShell],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "upsertPages",
      "Content-heavy research modules must optimistically merge newly created pages instead of waiting on global page refresh."
    );
    assertExcludes(
      sourceLabel,
      source,
      "await refresh()",
      "Content-heavy research module create/import flows must not wait for a full page-list refresh."
    );
  }
  assertIncludes(
    files.projectsShell,
    projectsShell,
    "upsertPages([createdPage])",
    "Projects module must optimistically merge newly created project pages instead of waiting on global page refresh."
  );
  assertIncludes(
    files.projectsShell,
    projectsShell,
    "upsertPages([result.page])",
    "Projects module starter page creates must optimistically merge the page before opening it."
  );
  assertExcludes(
    files.projectsShell,
    projectsShell,
    "await refreshPages()",
    "Projects module create/intake flows must not wait for a full page-list refresh."
  );
  for (const snippet of [
    "PROJECT_DATABASE_STATUS_LIMIT = 12",
    "databases.slice(0, PROJECT_DATABASE_STATUS_LIMIT)",
    "visibleDatabases.map(async (database)",
    "visibleDatabases.map((database)",
    "hiddenDatabaseCount",
  ]) {
    assertIncludes(
      files.projectsShell,
      projectsShell,
      snippet,
      "Projects module must keep database status scans and tracker rendering bounded for large workspaces."
    );
  }
  assertExcludes(
    files.projectsShell,
    projectsShell,
    "databases.map(async (database)",
    "Projects module must not scan every database when loading project graph snapshots."
  );
  for (const snippet of [
    "const [contentScanEnabled, setContentScanEnabled] = useState(false)",
    "includeContent: contentScanEnabled",
    "setContentScanEnabled(true)",
    "hydrateContentInBackground();",
    "{ bodyScanEnabled: contentScanEnabled }",
    "scanEnabled: contentScanEnabled",
    "upsertPages([page])",
    "upsertPages([result.page])",
  ]) {
    assertIncludes(
      files.notesShell,
      notesShell,
      snippet,
      "Notes module must keep first paint metadata-only, make body scans explicit, and update newly created pages optimistically."
    );
  }
  assertExcludes(
    files.notesShell,
    notesShell,
    "includeContent: true",
    "Notes module must not default to full body hydration after large imports."
  );
  assertExcludes(
    files.notesShell,
    notesShell,
    "await refresh()",
    "Notes module create/open flow must not wait for a full page-list refresh."
  );
  assertExcludes(
    files.notesShell,
    notesShell,
    "void refresh()",
    "Notes module repeated content scans must not fire a global page refresh after large imports."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "queueCloudPagePush(record)",
    "Page editing must enqueue cloud upload instead of blocking on the cloud."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "queueOptimisticPageLocalCachePersist(record, upsertPages)",
    "Page editing must persist the local hot cache in the background."
  );
  for (const [snippet, message] of [
    [
      "optimisticPageLocalCachePersistQueue",
      "Page editing must collapse overlapping local cache writes by page.",
    ],
    [
      "drainOptimisticPageLocalCachePersistQueue",
      "Page editing must drain local cache writes from a latest-only queue.",
    ],
    [
      "if (queued.latest !== record) continue;",
      "Page editing must skip stale local cache write completions when newer content exists.",
    ],
  ]) {
    assertIncludes(files.usePage, usePage, snippet, message);
  }
  assertIncludes(
    files.usePage,
    usePage,
    "rememberPendingPageDraft(optimistic)",
    "Page editing must keep an immediate draft while local cache persistence catches up."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "clearPendingPageDraft(record.id)",
    "Page editing must clear the immediate draft after local cache persistence catches up."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "window.sessionStorage.setItem",
    "Pending page drafts must survive same-tab refresh while local cache persistence catches up."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "window.sessionStorage.removeItem",
    "Pending page drafts must clear same-tab recovery storage after local cache persistence catches up."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "session_storage_only: true",
    "Pending page drafts must declare session-only recovery storage."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "stores_page_body_html: true",
    "Pending page drafts may store page body HTML only for short-lived refresh recovery."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "stores_page_yjs: false",
    "Pending page drafts must not store Yjs editor state."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "uploads_workspace_data: false",
    "Pending page drafts must not upload workspace data."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "enters_sync_log: false",
    "Pending page drafts must stay out of the sync log."
  );
  assertIncludes(
    files.pendingPageDrafts,
    pendingPageDrafts,
    "PENDING_PAGE_DRAFT_MAX_CHARS",
    "Pending page drafts must stay bounded for large imported notes."
  );
  assertIncludes(
    files.localFirstPageNavigationUtil,
    localFirstPageNavigationUtil,
    "rememberPendingPageDraft(page)",
    "Shared page navigation must keep an immediate draft before opening page routes."
  );
  assertIncludes(
    files.localFirstPageNavigationUtil,
    localFirstPageNavigationUtil,
    "rememberPageRouteHandoff(page, source)",
    "Shared page navigation must hand off page metadata before slower local or cloud checks."
  );
  assertIncludes(
    files.localFirstPageNavigation,
    localFirstPageNavigation,
    "router.prefetch(`/page/${page.id}`)",
    "Shared page navigation must prefetch page routes as a speed hint."
  );
  assertIncludes(
    files.localFirstPageNavigation,
    localFirstPageNavigation,
    "warmPageShellModule();",
    "Shared page navigation must warm the page shell once for module, sidebar, and search opens."
  );
  assertIncludes(
    files.localFirstPageNavigationUtil,
    localFirstPageNavigationUtil,
    "pageShellWarmupPromise",
    "Shared page navigation must start page shell warmup before route navigation."
  );
  assertIncludes(
    files.localFirstPageNavigationUtil,
    localFirstPageNavigationUtil,
    'import("@/components/providers/PageShell")',
    "Shared page navigation must preload the page shell without reading page bodies."
  );
  for (const [sourceLabel, source] of [
    [files.localFirstPageNavigation, localFirstPageNavigation],
    [files.localFirstPageNavigationUtil, localFirstPageNavigationUtil],
  ]) {
    assertExcludes(
      sourceLabel,
      source,
      'import("@/components/editor/Editor")',
      "Shared page navigation must not preload the heavy editor bundle before metadata first paint."
    );
  }
  for (const forbiddenLocalFirstNavigationSnippet of [
    "queueCloudPagePush",
    "pushCloudPages",
    "sync_log",
    "content_text",
    "content_yjs",
  ]) {
    for (const [sourceLabel, source] of [
      [files.localFirstPageNavigation, localFirstPageNavigation],
      [files.localFirstPageNavigationUtil, localFirstPageNavigationUtil],
    ]) {
      if (source.includes(forbiddenLocalFirstNavigationSnippet)) {
        failures.push(
          `${sourceLabel} must not include ${forbiddenLocalFirstNavigationSnippet}: shared page navigation must stay metadata-only.`
        );
      }
    }
  }
  assertIncludes(
    files.sidebar,
    sidebar,
    'openPage(page, { source: "sidebar-create" })',
    "Sidebar page creation must use local-first page navigation."
  );
  assertIncludes(
    files.pageTree,
    pageTree,
    'source: "sidebar-open"',
    "Sidebar page tree opens must use local-first page navigation."
  );
  for (const snippet of [
    "SIDEBAR_PAGE_TREE_CHILD_LIMIT",
    "visibleChildren.map((child)",
    "getCurrentPagePathIds",
    "currentPathIds.has(page.id)",
    "page.id === currentPageId",
    "已折叠 {hiddenChildCount} 个子页面",
    "collectHiddenModuleSubtreeIds",
    "hiddenModuleSubtreeIds.has(page.id)",
    "visiting.has(page.id)",
  ]) {
    assertIncludes(
      files.pageTree,
      pageTree,
      snippet,
      "Sidebar page tree must cap child rendering while keeping the current path visible."
    );
  }
  if (pageTree.includes("{children.map((child)")) {
    failures.push(
      `${files.pageTree} must not render every child page in a large expanded parent.`
    );
  }
  assertIncludes(
    files.favoritePages,
    favoritePages,
    'source: "favorite-open"',
    "Favorite page opens must use local-first page navigation."
  );
  for (const snippet of [
    "SIDEBAR_FAVORITE_VISIBLE_LIMIT",
    "visibleFavoritePages.map((page)",
    "已折叠 {hiddenFavoriteCount} 个收藏页面",
  ]) {
    assertIncludes(
      files.favoritePages,
      favoritePages,
      snippet,
      "Sidebar favorite pages must cap rendered rows while preserving local-first opens."
    );
  }
  assertIncludes(
    files.trashPages,
    trashPages,
    'source: "trash-restore-open"',
    "Restored pages must use local-first page navigation."
  );
  for (const snippet of [
    "SIDEBAR_TRASH_VISIBLE_LIMIT",
    "visibleTrashPages.map((page)",
    "已折叠 {hiddenTrashCount} 个回收站页面",
  ]) {
    assertIncludes(
      files.trashPages,
      trashPages,
      snippet,
      "Sidebar trash pages must cap rendered rows while preserving restore opens."
    );
  }
  assertIncludes(
    files.quickSearch,
    quickSearch,
    'source: "quick-search-open"',
    "Quick search page opens must use local-first page navigation."
  );
  assertIncludes(
    files.quickSearch,
    quickSearch,
    'source: "quick-search-create"',
    "Quick search page creation must use local-first page navigation."
  );
  assertIncludes(
    files.childPageTree,
    childPageTree,
    'source: "child-page-open"',
    "Child page tree opens must use local-first page navigation."
  );
  assertIncludes(
    files.childPageTree,
    childPageTree,
    'source: "child-page-create"',
    "Child page creation must use local-first page navigation."
  );
  assertIncludes(
    files.subPageTree,
    subPageTree,
    'source: "child-page-open"',
    "Page position tree opens must use local-first page navigation."
  );
  assertIncludes(
    files.pageRouteHandoff,
    pageRouteHandoff,
    '"module-create"',
    "Module-created pages must have an explicit local-first route handoff source."
  );
  assertIncludes(
    files.pageRouteHandoff,
    pageRouteHandoff,
    '"module-open"',
    "Module-opened pages must have an explicit local-first route handoff source."
  );
  for (const [sourceLabel, source, sourceName, message] of [
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"inline-database-open"',
      "Inline database page opens must have an explicit local-first route handoff source.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"compare-return"',
      "Version compare return paths must have an explicit local-first route handoff source.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"page-property-open"',
      "Page property links must have an explicit local-first route handoff source.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"breadcrumb-open"',
      "Breadcrumb opens must have an explicit local-first route handoff source.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"backlink-open"',
      "Backlink opens must have an explicit local-first route handoff source.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"duplicate-page-create"',
      "Duplicated pages must have an explicit local-first route handoff source.",
    ],
  ]) {
    assertIncludes(sourceLabel, source, sourceName, message);
  }
  assertIncludes(
    files.breadcrumbBlockNode,
    breadcrumbBlockNode,
    "getPageMetadata(cursor)",
    "Breadcrumb editor block must resolve page paths through bounded metadata reads."
  );
  assertIncludes(
    files.breadcrumbBlockNode,
    breadcrumbBlockNode,
    "BREADCRUMB_PARENT_LOOKUP_GUARD",
    "Breadcrumb editor block must guard parent traversal depth."
  );
  assertExcludes(
    files.breadcrumbBlockNode,
    breadcrumbBlockNode,
    'from "@/hooks/usePages"',
    "Breadcrumb editor block must not import usePages for global metadata scans."
  );
  for (const snippet of [
    "collectInlineRelationPageIds",
    "loadInlineRelationPages",
    "getPageMetadata(pageId)",
    "getRows(databaseId, { includePageContent: false })",
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database block must resolve only referenced relation pages through bounded metadata reads."
    );
  }
  assertExcludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    'from "@/hooks/usePages"',
    "Inline database block must not import usePages for global metadata scans."
  );
  assertIncludes(
    files.localQueries,
    localQueries,
    "export async function searchPageMetadata",
    "Relation field search must use a bounded metadata query for local-first UX."
  );
  for (const snippet of [
    "usePages({ autoLoad: false })",
    "upsertPages([restoredPage])",
    "openPage(restoredPage ?? page ?? pageId",
  ]) {
    assertIncludes(
      files.compareShell,
      compareShell,
      snippet,
      "Version restore must upsert the restored page before local-first navigation so the page does not flash stale content."
    );
  }
  for (const [sourceLabel, source, requiredSources] of [
    [files.inlineDatabaseNode, inlineDatabaseNode, ['source: "inline-database-open"']],
    [files.compareShell, compareShell, ['source: "compare-return"']],
    [files.pageProperties, pageProperties, ['source: "page-property-open"']],
    [files.breadcrumb, breadcrumb, ['source: "breadcrumb-open"']],
    [files.backlinks, backlinks, ['source: "backlink-open"']],
    [files.pageShell, pageShell, ['source: "child-page-create"', 'source: "duplicate-page-create"']],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "useLocalFirstPageNavigation",
      "Common page opens must use the shared local-first page navigation helper."
    );
    for (const sourceSnippet of requiredSources) {
      assertIncludes(
        sourceLabel,
        source,
        sourceSnippet,
        "Common page opens must tag route handoff with a specific source."
      );
    }
  }
  for (const [sourceLabel, source, requiredSources] of [
    [files.notesShell, notesShell, ['source: "module-create"', 'source: "module-open"']],
    [files.filesShell, filesShell, ['source: "module-create"']],
    [files.meetingsShell, meetingsShell, ['source: "module-create"', 'source: "module-open"']],
    [files.reportsShell, reportsShell, ['source: "module-create"', 'source: "module-open"']],
    [files.projectsShell, projectsShell, ['source: "module-create"']],
    [files.moduleDashboard, moduleDashboard, ['source: "module-create"']],
    [files.companyResearchShell, companyResearchShell, ['source: "module-create"', 'source: "module-open"']],
    [files.portfolioShell, portfolioShell, ['source: "module-create"', 'source: "module-open"']],
    [files.researchConnectionsPanel, researchConnectionsPanel, ['source: "module-open"']],
    [files.researchGraphShell, researchGraphShell, ['source: "module-create"', 'source: "module-open"']],
    [files.industryChainShell, industryChainShell, ['source: "module-create"', 'source: "module-open"']],
    [files.knowledgeBaseShell, knowledgeBaseShell, ['source: "module-open"']],
    [files.aiWorkbenchShell, aiWorkbenchShell, ['source: "module-open"']],
    [files.pageImportPlanPanel, pageImportPlanPanel, ['source: "module-create"']],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "useLocalFirstPageNavigation",
      "Module page opens must use the shared local-first page navigation helper."
    );
    for (const sourceSnippet of requiredSources) {
      assertIncludes(
        sourceLabel,
        source,
        sourceSnippet,
        "Module page opens must tag route handoff with module-create or module-open."
      );
    }
  }
  if (usePage.includes("await pushCloudPages([record])")) {
    failures.push(
      "usePage should not await pushCloudPages during editor updates; edits must be local-first and pending-queue backed."
    );
  }
  assertIncludes(
    files.syncShell,
    syncShell,
    "云端 manifest 对账 API 防护",
    "Sync UI must render the cloud manifest compare API guard."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出 manifest 防护",
    "Sync UI must expose the cloud manifest compare export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "getPageModuleCounts",
    "Sync UI must include metadata counts for comments, versions, and links."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "导出热数据计划",
    "Sync UI must expose hot data plan export."
  );
  assertIncludes(
    files.environmentPreflightRoute,
    environmentPreflightRoute,
    "buildWebBetaEnvironmentPreflight",
    "Environment preflight route must keep presence-only checks wired."
  );

  const summary = {
    smoke_cases: smokeCaseIds.length,
    page_routes_checked: requiredPageRoutes.length,
    gated_or_disabled_api_routes_checked: gatedOrDisabledApiRoutes.length,
    boundary_checks: requiredBoundarySnippets.length,
    cloud_master_reconcile_checks: 7,
    local_metadata_manifest_checks: 7,
    hot_cache_policy_checks: 6,
    hot_cache_selection_checks: 14,
    hot_data_plan_checks: 10,
    file_metadata_first_paint_checks: 4,
    deferred_page_content_checks: 9,
    metadata_first_quick_search_checks: 4,
    daily_lazy_peek_modal_checks: 5,
  };

  if (failures.length > 0) {
    console.error("Web Beta smoke test verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Web Beta smoke test verification passed");
  console.log(JSON.stringify(summary, null, 2));
}

run();
