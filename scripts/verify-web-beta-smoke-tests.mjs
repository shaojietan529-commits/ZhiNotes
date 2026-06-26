#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  hotDataPlan: "src/lib/sync/webBetaHotDataPlan.ts",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  cloudMasterReconcile: "src/lib/sync/cloudMasterReconcile.ts",
  localMetadataManifest: "src/lib/sync/localMetadataManifest.ts",
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
  localFirstPageNavigation: "src/hooks/useLocalFirstPageNavigation.ts",
  accountDatabaseSync: "src/lib/database/accountDatabaseSync.ts",
  usePage: "src/hooks/usePage.ts",
  usePages: "src/hooks/usePages.ts",
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
  syncShell: "src/components/modules/SyncShell.tsx",
  dailyNotesShell: "src/components/modules/DailyNotesShell.tsx",
  pageShell: "src/components/providers/PageShell.tsx",
  meetingScheduleShell: "src/components/modules/MeetingScheduleShell.tsx",
  notesShell: "src/components/modules/NotesShell.tsx",
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
  const hotDataPlan = readProjectFile(files.hotDataPlan);
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const cloudMasterReconcile = readProjectFile(files.cloudMasterReconcile);
  const localMetadataManifest = readProjectFile(files.localMetadataManifest);
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
  const localFirstPageNavigation = readProjectFile(
    files.localFirstPageNavigation
  );
  const accountDatabaseSync = readProjectFile(files.accountDatabaseSync);
  const usePage = readProjectFile(files.usePage);
  const usePages = readProjectFile(files.usePages);
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
  const syncShell = readProjectFile(files.syncShell);
  const dailyNotesShell = readProjectFile(files.dailyNotesShell);
  const pageShell = readProjectFile(files.pageShell);
  const meetingScheduleShell = readProjectFile(files.meetingScheduleShell);
  const notesShell = readProjectFile(files.notesShell);
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
  ]) {
    if (typeof scripts[scriptName] !== "string") {
      failures.push(`package.json missing script ${scriptName}`);
    }
  }

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
    files.syncShell,
    syncShell,
    "本地流畅度快照",
    "Sync UI must show local performance snapshots for fluency debugging."
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
    "writeOptimisticDailyHotCache",
    "Daily + creation must update the local hot cache before background persistence."
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
  assertIncludes(
    files.usePage,
    usePage,
    "readPageRouteHandoff",
    "Page opening must read route handoff before slower local DB or cloud checks."
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
    "onFocus={warmPageRoute}",
    "Daily calendar + controls must warm the page shell on keyboard focus before navigation."
  );
  assertIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "rememberPageRouteHandoff(optimisticNote, \"daily-create\")",
    "Daily + creation must hand off the optimistic page before full page navigation."
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
    "data-testid={`daily-add-note-${key}`}",
    "Daily calendar + button must expose a stable test target."
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
    "data-testid={`meeting-add-${key}`}",
    "Meeting calendar + button must expose a stable test target."
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
    files.accountDatabaseSync,
    accountDatabaseSync,
    "export async function getPendingCloudDatabaseSyncStatus",
    "Smoke verifier must keep database pending upload status visible to the sync dashboard."
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
    "primeDatabaseRowPageOpen",
    "Database row full-page opens must prime the page route with local metadata before navigation."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "rememberPendingPageDraft(page)",
    "Database row full-page opens must keep an in-memory page draft for immediate first paint."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "rememberPageRouteHandoff(page, source)",
    "Database row full-page opens must hand off metadata before slower local DB or cloud checks."
  );
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
  assertIncludes(
    files.usePages,
    usePages,
    "useWorkspaceStore.getState().upsertPages(contentPages)",
    "Deferred page body hydration must merge content into the existing metadata store instead of replacing cloud metadata."
  );
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
  assertIncludes(
    files.usePage,
    usePage,
    "queueCloudPagePush(record)",
    "Page editing must enqueue cloud upload instead of blocking on the cloud."
  );
  assertIncludes(
    files.usePage,
    usePage,
    "void persistOptimisticPageToLocalCache(record, upsertPages)",
    "Page editing must persist the local hot cache in the background."
  );
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
    files.localFirstPageNavigation,
    localFirstPageNavigation,
    "rememberPendingPageDraft(page)",
    "Shared page navigation must keep an immediate draft before opening page routes."
  );
  assertIncludes(
    files.localFirstPageNavigation,
    localFirstPageNavigation,
    'rememberPageRouteHandoff(page, options.source ?? "page-open")',
    "Shared page navigation must hand off page metadata before slower local or cloud checks."
  );
  assertIncludes(
    files.localFirstPageNavigation,
    localFirstPageNavigation,
    "router.prefetch(`/page/${page.id}`)",
    "Shared page navigation must prefetch page routes as a speed hint."
  );
  for (const forbiddenLocalFirstNavigationSnippet of [
    "queueCloudPagePush",
    "pushCloudPages",
    "sync_log",
    "content_text",
    "content_yjs",
  ]) {
    if (localFirstPageNavigation.includes(forbiddenLocalFirstNavigationSnippet)) {
      failures.push(
        `${files.localFirstPageNavigation} must not include ${forbiddenLocalFirstNavigationSnippet}: shared page navigation must stay metadata-only.`
      );
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
  assertIncludes(
    files.favoritePages,
    favoritePages,
    'source: "favorite-open"',
    "Favorite page opens must use local-first page navigation."
  );
  assertIncludes(
    files.trashPages,
    trashPages,
    'source: "trash-restore-open"',
    "Restored pages must use local-first page navigation."
  );
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
