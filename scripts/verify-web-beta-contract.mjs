#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  envExample: ".env.example",
  webAlphaReceiptVerifier: "scripts/verify-web-alpha-handoff-receipt.mjs",
  apiStubs: "src/lib/sync/webBetaApiStubs.ts",
  contract: "src/lib/sync/webBetaContract.ts",
  deploymentTarget: "src/lib/sync/webBetaDeploymentTarget.ts",
  webAlphaHandoffBundle: "src/lib/sync/webAlphaHandoffBundle.ts",
  webAlphaLaunchDecisionReceipt:
    "src/lib/sync/webAlphaLaunchDecisionReceipt.ts",
  webBetaOwnerReviewPacket: "src/lib/sync/webBetaOwnerReviewPacket.ts",
  syncManualReviewPacket: "src/lib/sync/syncManualReviewPacket.ts",
  syncHandoffReadinessReceipt:
    "src/lib/sync/syncHandoffReadinessReceipt.ts",
  privateFileStoragePolicy: "src/lib/sync/privateFileStoragePolicy.ts",
  filePresignApiStub: "src/lib/sync/filePresignApiStub.ts",
  filePresignRoute: "src/app/api/files/presign/route.ts",
  hotDataPlan: "src/lib/sync/webBetaHotDataPlan.ts",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  smokeTestVerifier: "scripts/verify-web-beta-smoke-tests.mjs",
  routeSmokeVerifier: "scripts/verify-route-smoke.mjs",
  replayHarnessVerifier: "scripts/verify-replay-harness-safety.mjs",
  environmentPreflight: "src/lib/sync/webBetaEnvironmentPreflight.ts",
  launchChecklist: "src/lib/sync/webBetaLaunchChecklist.ts",
  routePreflight: "src/lib/sync/webBetaRoutePreflight.ts",
  conflictResolution: "src/lib/sync/syncConflictResolution.ts",
  remoteBaselineRequest: "src/lib/sync/remoteBaselineRequest.ts",
  remoteBaselineStaging: "src/lib/sync/remoteBaselineStaging.ts",
  remoteBaselineStageSchema: "src/lib/sync/remoteBaselineStageSchema.ts",
  remoteBaselineStageReplay: "src/lib/sync/remoteBaselineStageReplay.ts",
  remoteBaselineReplayFixture: "src/lib/sync/remoteBaselineReplayFixture.ts",
  remoteBaselineReplayHarness: "src/lib/sync/remoteBaselineReplayHarness.ts",
  remoteBaselineReplayRunner: "src/lib/sync/remoteBaselineReplayRunner.ts",
  restoreRollbackPlan: "src/lib/sync/restoreRollbackPlan.ts",
  restoreWritebackContract: "src/lib/sync/restoreWritebackContract.ts",
  restorePreviewApiStub: "src/lib/sync/restorePreviewApiStub.ts",
  restorePreviewRoute: "src/app/api/backup/restore-preview/route.ts",
  restoreApplyApiStub: "src/lib/sync/restoreApplyApiStub.ts",
  restoreApplyRoute: "src/app/api/backup/restore-apply/route.ts",
  syncPushApiStub: "src/lib/sync/syncPushApiStub.ts",
  syncPushRoute: "src/app/api/sync/push/route.ts",
  syncPullApiStub: "src/lib/sync/syncPullApiStub.ts",
  syncPullRoute: "src/app/api/sync/pull/route.ts",
  commentVersionReplayApiStub:
    "src/lib/sync/commentVersionReplayApiStub.ts",
  commentVersionReplayRoute:
    "src/app/api/sync/comment-version-replay/route.ts",
  cloudManifestCompareApiStub: "src/lib/sync/cloudManifestCompareApiStub.ts",
  cloudManifestCompareRoute: "src/app/api/cloud/manifest/compare/route.ts",
  cloudMigrationApplyApiStub: "src/lib/sync/cloudMigrationApplyApiStub.ts",
  cloudMigrationApplyRoute: "src/app/api/cloud/migrations/apply/route.ts",
  syncOptInGate: "src/lib/sync/syncOptInGate.ts",
  workspaceIdentity: "src/lib/sync/workspaceIdentity.ts",
  accountSessionBoundary: "src/lib/security/accountSessionBoundary.ts",
  auditEventEnvelope: "src/lib/security/auditEventEnvelope.ts",
  auditEventsApiStub: "src/lib/security/auditEventsApiStub.ts",
  auditEventsRoute: "src/app/api/audit/events/route.ts",
  permissionCheckEnvelope: "src/lib/security/permissionCheckEnvelope.ts",
  permissionCheckApiStub: "src/lib/security/permissionCheckApiStub.ts",
  permissionCheckRequestValidator:
    "src/lib/security/permissionCheckRequestValidator.ts",
  permissionServerTestMatrix: "src/lib/security/permissionServerTestMatrix.ts",
  permissionServerReadiness: "src/lib/security/permissionServerReadiness.ts",
  permissionCheckRoute: "src/app/api/permissions/check/route.ts",
  typedConfirmation: "src/lib/security/typedConfirmation.ts",
  highRiskActionRegistry: "src/lib/security/highRiskActionRegistry.ts",
  webBetaReadiness: "src/lib/sync/webBetaReadiness.ts",
  webBetaStageGate: "src/lib/sync/webBetaStageGate.ts",
  webBetaNextActions: "src/lib/sync/webBetaNextActions.ts",
  webLaunchWorkbench: "src/lib/sync/webLaunchWorkbench.ts",
  webBetaAutonomyQueue: "src/lib/sync/webBetaAutonomyQueue.ts",
  cloudMasterReconcile: "src/lib/sync/cloudMasterReconcile.ts",
  cloudNativeFluidityReport: "src/lib/sync/cloudNativeFluidityReport.ts",
  commentVersionCloudReplayContract:
    "src/lib/sync/commentVersionCloudReplayContract.ts",
  commentVersionReplayReceipt:
    "src/lib/sync/commentVersionReplayReceipt.ts",
  commentVersionReplayAckGate:
    "src/lib/sync/commentVersionReplayAckGate.ts",
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
  accountCloudSyncGate: "src/lib/account/accountCloudSyncGate.ts",
  accountClientSession: "src/lib/account/clientSession.ts",
  accountPageSync: "src/lib/pages/accountPageSync.ts",
  pageBodyHydrationStatus: "src/lib/pages/pageBodyHydrationStatus.ts",
  pageRouteHandoff: "src/lib/pages/pageRouteHandoff.ts",
  pendingPageDrafts: "src/lib/pages/pendingPageDrafts.ts",
  pageUpdateBus: "src/lib/pages/pageUpdateBus.ts",
  scopedPageMetadata: "src/lib/pages/scopedPageMetadata.ts",
  pageCloudSync: "src/hooks/usePageCloudSync.ts",
  databaseCloudSync: "src/hooks/useDatabaseCloudSync.ts",
  localFirstPageNavigation: "src/hooks/useLocalFirstPageNavigation.ts",
  localFirstPageNavigationUtil: "src/lib/pages/localFirstPageNavigation.ts",
  accountDatabaseSync: "src/lib/database/accountDatabaseSync.ts",
  usePage: "src/hooks/usePage.ts",
  usePages: "src/hooks/usePages.ts",
  workspaceStore: "src/stores/workspaceStore.ts",
  pagePeekModal: "src/components/page/PagePeekModal.tsx",
  lazyPagePeekModal: "src/components/page/LazyPagePeekModal.tsx",
  pageContextMenu: "src/components/page/PageContextMenu.tsx",
  lazyPageContextMenu: "src/components/page/LazyPageContextMenu.tsx",
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
  databaseShell: "src/components/database/DatabaseShell.tsx",
  databaseTableView: "src/components/database/views/TableView.tsx",
  databaseListView: "src/components/database/views/ListView.tsx",
  databaseKanbanView: "src/components/database/views/KanbanView.tsx",
  databaseCalendarView: "src/components/database/views/CalendarView.tsx",
  databaseGalleryView: "src/components/database/views/GalleryView.tsx",
  databaseTimelineView: "src/components/database/views/TimelineView.tsx",
  databaseChartView: "src/components/database/views/ChartView.tsx",
  databaseFeedView: "src/components/database/views/FeedView.tsx",
  databaseRouteSkeleton: "src/components/database/DatabaseRouteSkeleton.tsx",
  inlineDatabaseNode: "src/components/editor/extensions/InlineDatabaseNode.tsx",
  filePreviewNode: "src/components/editor/extensions/FilePreviewNode.tsx",
  breadcrumbBlockNode:
    "src/components/editor/extensions/BreadcrumbBlockNode.tsx",
  compareShell: "src/components/comparison/CompareShell.tsx",
  pageProperties: "src/components/page/PageProperties.tsx",
  pageShell: "src/components/providers/PageShell.tsx",
  localPerformance: "src/lib/performance/localPerformance.ts",
  blockComments: "src/components/shared/BlockComments.tsx",
  commentSidePanel: "src/components/shared/CommentSidePanel.tsx",
  blockCommentEvents: "src/components/shared/blockCommentEvents.ts",
  breadcrumb: "src/components/shared/Breadcrumb.tsx",
  backlinks: "src/components/shared/Backlinks.tsx",
  childPageTree: "src/components/page/ChildPageTree.tsx",
  sidebar: "src/components/sidebar/Sidebar.tsx",
  pageTree: "src/components/sidebar/PageTree.tsx",
  favoritePages: "src/components/sidebar/FavoritePages.tsx",
  trashPages: "src/components/sidebar/TrashPages.tsx",
  subPageTree: "src/components/shared/SubPageTree.tsx",
  lazyQuickSearch: "src/components/sidebar/LazyQuickSearch.tsx",
  quickSearch: "src/components/sidebar/QuickSearch.tsx",
  wikiSuggestion: "src/components/editor/extensions/WikiLinkSuggestion.ts",
  syncShell: "src/components/modules/SyncShell.tsx",
  dailyNotesShell: "src/components/modules/DailyNotesShell.tsx",
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
  databaseDetailRoute: "src/app/(workspace)/database/[databaseId]/page.tsx",
  databaseDetailRouteLoading:
    "src/app/(workspace)/database/[databaseId]/loading.tsx",
  dailyRoute: "src/app/(workspace)/daily/page.tsx",
  dailyRouteLoading: "src/app/(workspace)/daily/loading.tsx",
  pageDetailRoute: "src/app/(workspace)/page/[pageId]/page.tsx",
  pageDetailRouteLoading: "src/app/(workspace)/page/[pageId]/loading.tsx",
  scheduleRoute: "src/app/(workspace)/schedule/page.tsx",
  scheduleRouteLoading: "src/app/(workspace)/schedule/loading.tsx",
  apiGuardPanel: "src/components/modules/sync/ApiGuardPanel.tsx",
  migration: "supabase/migrations/0001_zhinotes_cloud_foundation.sql",
};

const failures = [];
const warnings = [];
const contractTablePhysicalTables = {
  comments: ["page_comments", "block_comments"],
};

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function unique(values) {
  return [...new Set(values)];
}

function extractQuotedValues(source, propertyName) {
  const pattern = new RegExp(`${propertyName}:\\s*"([^"]+)"`, "g");
  return unique([...source.matchAll(pattern)].map((match) => match[1]));
}

function extractEnvExampleKeys(source) {
  return unique(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0]?.trim())
      .filter(Boolean)
  );
}

function extractApiStubs(source) {
  const entries = [];
  const entryPattern = /\{\s*id:\s*"([^"]+)"[\s\S]*?method:\s*"([^"]+)"[\s\S]*?path:\s*"([^"]+)"/g;
  let match;

  while ((match = entryPattern.exec(source))) {
    entries.push({
      id: match[1],
      method: match[2],
      path: match[3],
    });
  }

  return entries;
}

function extractRouteCalls(source) {
  const routePattern =
    /route\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
  return [...source.matchAll(routePattern)].map((match) => ({
    method: match[1],
    route: match[2],
    surface: match[3],
    status: match[4],
  }));
}

function normalizeRoutePath(routePath) {
  return routePath.split("?")[0].replace(/:([A-Za-z0-9_]+)/g, "[$1]");
}

function routeFileForApiPath(apiPath) {
  return path.join("src/app", normalizeRoutePath(apiPath), "route.ts");
}

function routeFileForPagePath(pagePath) {
  if (pagePath === "/") return "src/app/page.tsx";
  return path.join("src/app/(workspace)", pagePath, "page.tsx");
}

function assertRouteExport(routeFile, method, routeLabel) {
  const source = readProjectFile(routeFile);
  if (!source) return;
  if (!new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(source)) {
    fail(`${routeLabel} is missing export async function ${method} in ${routeFile}`);
  }
}

function assertRouteGuard(routeFile, expectedSnippet, routeLabel) {
  const source = readProjectFile(routeFile);
  if (!source) return;
  if (!source.includes(expectedSnippet)) {
    fail(`${routeLabel} is missing guard/snippet ${expectedSnippet} in ${routeFile}`);
  }
}

function assertSourceIncludes(sourceLabel, source, expectedSnippet, message) {
  if (!source.includes(expectedSnippet)) {
    fail(`${sourceLabel} missing ${expectedSnippet}: ${message}`);
  }
}

function assertSourceExcludes(sourceLabel, source, forbiddenSnippet, message) {
  if (source.includes(forbiddenSnippet)) {
    fail(`${sourceLabel} must not include ${forbiddenSnippet}: ${message}`);
  }
}

function assertAllPresent(label, expected, actual, formatMissing) {
  const actualSet = new Set(actual);
  for (const item of expected) {
    if (!actualSet.has(item)) {
      fail(`${label} missing ${formatMissing ? formatMissing(item) : item}`);
    }
  }
}

function assertNoLegacySingularEnv(source, sourceLabel) {
  const legacyMatches = source.match(/\bZHINOTE_[A-Z0-9_]+\b/g) ?? [];
  for (const key of unique(legacyMatches)) {
    fail(`${sourceLabel} still references legacy singular env key ${key}`);
  }
}

function assertMigrationTables(expectedTables, migrationSql) {
  const normalizedSql = migrationSql.toLowerCase();
  for (const tableName of expectedTables) {
    const physicalTables = contractTablePhysicalTables[tableName] ?? [tableName];
    for (const physicalTable of physicalTables) {
      const statement = `create table if not exists public.${physicalTable.toLowerCase()}`;
      if (!normalizedSql.includes(statement)) {
        fail(`Migration missing ${statement}`);
      }
    }
  }
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const envExample = readProjectFile(files.envExample);
  const webAlphaReceiptVerifier = readProjectFile(files.webAlphaReceiptVerifier);
  const apiStubs = readProjectFile(files.apiStubs);
  const contract = readProjectFile(files.contract);
  const deploymentTarget = readProjectFile(files.deploymentTarget);
  const webAlphaHandoffBundle = readProjectFile(files.webAlphaHandoffBundle);
  const webAlphaLaunchDecisionReceipt = readProjectFile(
    files.webAlphaLaunchDecisionReceipt
  );
  const webBetaOwnerReviewPacket = readProjectFile(
    files.webBetaOwnerReviewPacket
  );
  const syncManualReviewPacket = readProjectFile(files.syncManualReviewPacket);
  const syncHandoffReadinessReceipt = readProjectFile(
    files.syncHandoffReadinessReceipt
  );
  const privateFileStoragePolicy = readProjectFile(files.privateFileStoragePolicy);
  const filePresignApiStub = readProjectFile(files.filePresignApiStub);
  const filePresignRoute = readProjectFile(files.filePresignRoute);
  const hotDataPlan = readProjectFile(files.hotDataPlan);
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const smokeTestVerifier = readProjectFile(files.smokeTestVerifier);
  const routeSmokeVerifier = readProjectFile(files.routeSmokeVerifier);
  const replayHarnessVerifier = readProjectFile(files.replayHarnessVerifier);
  const environmentPreflight = readProjectFile(files.environmentPreflight);
  const launchChecklist = readProjectFile(files.launchChecklist);
  const routePreflight = readProjectFile(files.routePreflight);
  const conflictResolution = readProjectFile(files.conflictResolution);
  const remoteBaselineRequest = readProjectFile(files.remoteBaselineRequest);
  const remoteBaselineStaging = readProjectFile(files.remoteBaselineStaging);
  const remoteBaselineStageSchema = readProjectFile(
    files.remoteBaselineStageSchema
  );
  const remoteBaselineStageReplay = readProjectFile(
    files.remoteBaselineStageReplay
  );
  const remoteBaselineReplayFixture = readProjectFile(
    files.remoteBaselineReplayFixture
  );
  const remoteBaselineReplayHarness = readProjectFile(
    files.remoteBaselineReplayHarness
  );
  const remoteBaselineReplayRunner = readProjectFile(
    files.remoteBaselineReplayRunner
  );
  const restoreRollbackPlan = readProjectFile(files.restoreRollbackPlan);
  const restoreWritebackContract = readProjectFile(
    files.restoreWritebackContract
  );
  const restorePreviewApiStub = readProjectFile(files.restorePreviewApiStub);
  const restorePreviewRoute = readProjectFile(files.restorePreviewRoute);
  const restoreApplyApiStub = readProjectFile(files.restoreApplyApiStub);
  const restoreApplyRoute = readProjectFile(files.restoreApplyRoute);
  const syncPushApiStub = readProjectFile(files.syncPushApiStub);
  const syncPushRoute = readProjectFile(files.syncPushRoute);
  const syncPullApiStub = readProjectFile(files.syncPullApiStub);
  const syncPullRoute = readProjectFile(files.syncPullRoute);
  const commentVersionReplayApiStub = readProjectFile(
    files.commentVersionReplayApiStub
  );
  const commentVersionReplayRoute = readProjectFile(
    files.commentVersionReplayRoute
  );
  const cloudManifestCompareApiStub = readProjectFile(
    files.cloudManifestCompareApiStub
  );
  const cloudManifestCompareRoute = readProjectFile(
    files.cloudManifestCompareRoute
  );
  const cloudMigrationApplyApiStub = readProjectFile(
    files.cloudMigrationApplyApiStub
  );
  const cloudMigrationApplyRoute = readProjectFile(
    files.cloudMigrationApplyRoute
  );
  const syncOptInGate = readProjectFile(files.syncOptInGate);
  const workspaceIdentity = readProjectFile(files.workspaceIdentity);
  const accountSessionBoundary = readProjectFile(files.accountSessionBoundary);
  const auditEventEnvelope = readProjectFile(files.auditEventEnvelope);
  const auditEventsApiStub = readProjectFile(files.auditEventsApiStub);
  const auditEventsRoute = readProjectFile(files.auditEventsRoute);
  const permissionCheckEnvelope = readProjectFile(files.permissionCheckEnvelope);
  const permissionCheckApiStub = readProjectFile(files.permissionCheckApiStub);
  const permissionCheckRequestValidator = readProjectFile(
    files.permissionCheckRequestValidator
  );
  const permissionServerTestMatrix = readProjectFile(
    files.permissionServerTestMatrix
  );
  const permissionServerReadiness = readProjectFile(
    files.permissionServerReadiness
  );
  const permissionCheckRoute = readProjectFile(files.permissionCheckRoute);
  const typedConfirmation = readProjectFile(files.typedConfirmation);
  const highRiskActionRegistry = readProjectFile(files.highRiskActionRegistry);
  const webBetaReadiness = readProjectFile(files.webBetaReadiness);
  const webBetaStageGate = readProjectFile(files.webBetaStageGate);
  const webBetaNextActions = readProjectFile(files.webBetaNextActions);
  const webLaunchWorkbench = readProjectFile(files.webLaunchWorkbench);
  const webBetaAutonomyQueue = readProjectFile(files.webBetaAutonomyQueue);
  const cloudMasterReconcile = readProjectFile(files.cloudMasterReconcile);
  const cloudNativeFluidityReport = readProjectFile(
    files.cloudNativeFluidityReport
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
  const accountCloudSyncGate = readProjectFile(files.accountCloudSyncGate);
  const accountClientSession = readProjectFile(files.accountClientSession);
  const accountPageSync = readProjectFile(files.accountPageSync);
  const pageBodyHydrationStatus = readProjectFile(
    files.pageBodyHydrationStatus
  );
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
  const accountDatabaseSync = readProjectFile(files.accountDatabaseSync);
  const usePage = readProjectFile(files.usePage);
  const usePages = readProjectFile(files.usePages);
  const workspaceStore = readProjectFile(files.workspaceStore);
  const pagePeekModal = readProjectFile(files.pagePeekModal);
  const lazyPagePeekModal = readProjectFile(files.lazyPagePeekModal);
  const pageContextMenu = readProjectFile(files.pageContextMenu);
  const lazyPageContextMenu = readProjectFile(files.lazyPageContextMenu);
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
  const databaseShell = readProjectFile(files.databaseShell);
  const databaseTableView = readProjectFile(files.databaseTableView);
  const databaseListView = readProjectFile(files.databaseListView);
  const databaseKanbanView = readProjectFile(files.databaseKanbanView);
  const databaseCalendarView = readProjectFile(files.databaseCalendarView);
  const databaseGalleryView = readProjectFile(files.databaseGalleryView);
  const databaseTimelineView = readProjectFile(files.databaseTimelineView);
  const databaseChartView = readProjectFile(files.databaseChartView);
  const databaseFeedView = readProjectFile(files.databaseFeedView);
  const databaseRouteSkeleton = readProjectFile(files.databaseRouteSkeleton);
  const inlineDatabaseNode = readProjectFile(files.inlineDatabaseNode);
  const filePreviewNode = readProjectFile(files.filePreviewNode);
  const breadcrumbBlockNode = readProjectFile(files.breadcrumbBlockNode);
  const compareShell = readProjectFile(files.compareShell);
  const pageProperties = readProjectFile(files.pageProperties);
  const pageShell = readProjectFile(files.pageShell);
  const localPerformance = readProjectFile(files.localPerformance);
  const blockComments = readProjectFile(files.blockComments);
  const commentSidePanel = readProjectFile(files.commentSidePanel);
  const blockCommentEvents = readProjectFile(files.blockCommentEvents);
  const breadcrumb = readProjectFile(files.breadcrumb);
  const backlinks = readProjectFile(files.backlinks);
  const childPageTree = readProjectFile(files.childPageTree);
  const sidebar = readProjectFile(files.sidebar);
  const pageTree = readProjectFile(files.pageTree);
  const favoritePages = readProjectFile(files.favoritePages);
  const trashPages = readProjectFile(files.trashPages);
  const subPageTree = readProjectFile(files.subPageTree);
  const lazyQuickSearch = readProjectFile(files.lazyQuickSearch);
  const quickSearch = readProjectFile(files.quickSearch);
  const wikiSuggestion = readProjectFile(files.wikiSuggestion);
  const syncShell = readProjectFile(files.syncShell);
  const dailyNotesShell = readProjectFile(files.dailyNotesShell);
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
  const apiGuardPanel = readProjectFile(files.apiGuardPanel);
  const migration = readProjectFile(files.migration);

  const requiredEnvKeys = extractQuotedValues(environmentPreflight, "key");
  const envExampleKeys = extractEnvExampleKeys(envExample);
  assertAllPresent(".env.example", requiredEnvKeys, envExampleKeys);

  for (const [label, source] of [
    [files.packageJson, packageJson],
    [files.envExample, envExample],
    [files.apiStubs, apiStubs],
    [files.contract, contract],
    [files.deploymentTarget, deploymentTarget],
    [files.smokeTestPlan, smokeTestPlan],
    [files.smokeTestVerifier, smokeTestVerifier],
    [files.webAlphaLaunchDecisionReceipt, webAlphaLaunchDecisionReceipt],
    [files.webBetaOwnerReviewPacket, webBetaOwnerReviewPacket],
    [files.syncManualReviewPacket, syncManualReviewPacket],
    [files.syncHandoffReadinessReceipt, syncHandoffReadinessReceipt],
    [files.replayHarnessVerifier, replayHarnessVerifier],
    [files.environmentPreflight, environmentPreflight],
    [files.launchChecklist, launchChecklist],
    [files.routePreflight, routePreflight],
    [files.conflictResolution, conflictResolution],
    [files.remoteBaselineRequest, remoteBaselineRequest],
    [files.remoteBaselineStaging, remoteBaselineStaging],
    [files.remoteBaselineStageSchema, remoteBaselineStageSchema],
    [files.remoteBaselineStageReplay, remoteBaselineStageReplay],
    [files.remoteBaselineReplayFixture, remoteBaselineReplayFixture],
    [files.remoteBaselineReplayHarness, remoteBaselineReplayHarness],
    [files.remoteBaselineReplayRunner, remoteBaselineReplayRunner],
    [files.syncOptInGate, syncOptInGate],
    [files.restorePreviewApiStub, restorePreviewApiStub],
    [files.restorePreviewRoute, restorePreviewRoute],
    [files.restoreApplyApiStub, restoreApplyApiStub],
    [files.restoreApplyRoute, restoreApplyRoute],
    [files.syncPushApiStub, syncPushApiStub],
    [files.syncPushRoute, syncPushRoute],
    [files.syncPullApiStub, syncPullApiStub],
    [files.syncPullRoute, syncPullRoute],
    [files.commentVersionReplayApiStub, commentVersionReplayApiStub],
    [files.commentVersionReplayRoute, commentVersionReplayRoute],
    [files.cloudManifestCompareApiStub, cloudManifestCompareApiStub],
    [files.cloudManifestCompareRoute, cloudManifestCompareRoute],
    [files.cloudMigrationApplyApiStub, cloudMigrationApplyApiStub],
    [files.cloudMigrationApplyRoute, cloudMigrationApplyRoute],
    [files.workspaceIdentity, workspaceIdentity],
    [files.accountSessionBoundary, accountSessionBoundary],
    [files.auditEventEnvelope, auditEventEnvelope],
    [files.auditEventsApiStub, auditEventsApiStub],
    [files.permissionCheckEnvelope, permissionCheckEnvelope],
    [files.permissionCheckApiStub, permissionCheckApiStub],
    [files.permissionCheckRequestValidator, permissionCheckRequestValidator],
    [files.permissionServerTestMatrix, permissionServerTestMatrix],
    [files.permissionServerReadiness, permissionServerReadiness],
    [files.permissionCheckRoute, permissionCheckRoute],
    [files.typedConfirmation, typedConfirmation],
    [files.highRiskActionRegistry, highRiskActionRegistry],
    [files.webBetaReadiness, webBetaReadiness],
    [files.webBetaStageGate, webBetaStageGate],
    [files.webBetaNextActions, webBetaNextActions],
    [files.webLaunchWorkbench, webLaunchWorkbench],
    [files.webBetaAutonomyQueue, webBetaAutonomyQueue],
    [files.cloudMasterReconcile, cloudMasterReconcile],
    [
      files.commentVersionCloudReplayContract,
      commentVersionCloudReplayContract,
    ],
    [files.commentVersionReplayReceipt, commentVersionReplayReceipt],
    [files.commentVersionReplayAckGate, commentVersionReplayAckGate],
    [files.localMetadataManifest, localMetadataManifest],
    [files.coreManifestCompareReceipt, coreManifestCompareReceipt],
    [files.cacheRebuildPreflightReceipt, cacheRebuildPreflightReceipt],
    [files.hotCachePolicyPlan, hotCachePolicyPlan],
    [files.hotCacheWarmupReceipt, hotCacheWarmupReceipt],
    [files.hotCacheSelectionSettings, hotCacheSelectionSettings],
    [files.hotCacheSettingsCloud, hotCacheSettingsCloud],
    [files.pageFavoritesWorkspaceSettings, pageFavoritesWorkspaceSettings],
    [
      files.pageViewPreferencesWorkspaceSettings,
      pageViewPreferencesWorkspaceSettings,
    ],
    [files.quickSearchWorkspaceSettings, quickSearchWorkspaceSettings],
    [
      files.calendarViewStateWorkspaceSettings,
      calendarViewStateWorkspaceSettings,
    ],
    [
      files.meetingReviewStateWorkspaceSettings,
      meetingReviewStateWorkspaceSettings,
    ],
    [
      files.meetingDeletionTombstonesWorkspaceSettings,
      meetingDeletionTombstonesWorkspaceSettings,
    ],
    [files.workspaceSettingsPendingSync, workspaceSettingsPendingSync],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
    ],
    [files.workspaceSettingsRoute, workspaceSettingsRoute],
    [files.localSchema, localSchema],
    [files.usePageFavorites, usePageFavorites],
    [files.usePageViewPreferences, usePageViewPreferences],
    [files.useCalendarViewMonthPreference, useCalendarViewMonthPreference],
    [files.useMeetingReviewStatePreference, useMeetingReviewStatePreference],
    [
      files.useMeetingDeletionTombstonesPreference,
      useMeetingDeletionTombstonesPreference,
    ],
    [files.localQueries, localQueries],
    [files.databaseRouteSkeleton, databaseRouteSkeleton],
    [files.childPageTree, childPageTree],
    [files.localFirstPageNavigation, localFirstPageNavigation],
    [files.localFirstPageNavigationUtil, localFirstPageNavigationUtil],
    [files.pageTree, pageTree],
    [files.favoritePages, favoritePages],
    [files.trashPages, trashPages],
    [files.subPageTree, subPageTree],
    [files.quickSearch, quickSearch],
    [files.syncShell, syncShell],
    [files.moduleRouteSkeleton, moduleRouteSkeleton],
    [files.pageRouteSkeleton, pageRouteSkeleton],
    [files.databaseDetailRoute, databaseDetailRoute],
    [files.databaseDetailRouteLoading, databaseDetailRouteLoading],
    [files.dailyRoute, dailyRoute],
    [files.dailyRouteLoading, dailyRouteLoading],
    [files.pageDetailRoute, pageDetailRoute],
    [files.pageDetailRouteLoading, pageDetailRouteLoading],
    [files.scheduleRoute, scheduleRoute],
    [files.scheduleRouteLoading, scheduleRouteLoading],
    [files.apiGuardPanel, apiGuardPanel],
  ]) {
    assertNoLegacySingularEnv(source, label);
  }

  for (const [sourceLabel, source] of [
    [files.dailyRoute, dailyRoute],
    [files.dailyRouteLoading, dailyRouteLoading],
    [files.scheduleRoute, scheduleRoute],
    [files.scheduleRouteLoading, scheduleRouteLoading],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "ModuleRouteSkeleton",
      "Daily notes and meeting calendar routes must keep an immediate shell while route segments or client chunks load."
    );
  }
  for (const [sourceLabel, source] of [
    [files.pageDetailRoute, pageDetailRoute],
    [files.pageDetailRouteLoading, pageDetailRouteLoading],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "PageRouteSkeleton",
      "Page detail routes must keep an immediate shell while route segments or client chunks load."
    );
  }
  for (const [snippet, message] of [
    [
      "readPageRouteHandoff",
      "The page detail route dynamic fallback must read local route handoff metadata before the full page shell hydrates.",
    ],
    [
      "readPendingPageDraft",
      "The page detail route dynamic fallback must reuse optimistic drafts before the full page shell hydrates.",
    ],
    [
      "useWorkspaceStore.getState().getPageById",
      "The page detail route dynamic fallback must reuse already-visible workspace metadata before the full page shell hydrates.",
    ],
    [
      "readLocalFirstPageRouteSeed",
      "The page detail route dynamic fallback must use a single local-first seed order for drafts, handoff, and workspace metadata.",
    ],
    [
      "PageRouteLoadingSkeleton",
      "The page detail route must keep a dedicated loading component that can show local-first page metadata.",
    ],
    [
      "previewPage.title",
      "The page detail route loading shell must pass the handed-off page title into the skeleton.",
    ],
    [
      "previewPage.icon",
      "The page detail route loading shell must pass the handed-off page icon into the skeleton.",
    ],
    [
      "previewPage.properties",
      "The page detail route loading shell must pass handed-off page properties into the skeleton.",
    ],
  ]) {
    assertSourceIncludes(files.pageDetailRoute, pageDetailRoute, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "routePreviewPage",
      "The full page shell loading fallback must keep local metadata visible after the client shell starts.",
    ],
    [
      "readPageShellRoutePreviewSeed(pageId)",
      "The full page shell loading fallback must reuse a local-first route preview seed.",
    ],
    [
      "preview={",
      "The full page shell loading fallback must pass local metadata into PageRouteSkeleton.",
    ],
    [
      "properties: routePreviewPage.properties",
      "The full page shell loading fallback must pass local properties into PageRouteSkeleton.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  assertSourceExcludes(
    files.pageShell,
    pageShell,
    "dangerouslySetInnerHTML",
    "Page shell large-body preview must not render raw page HTML directly."
  );
  for (const [snippet, message] of [
    [
      "useLayoutEffect,",
      "PageShell editable header sync must run before browser paint so local-first titles do not flash blank.",
    ],
    [
      "readPageShellEditableHeaderSeed(pageId).title",
      "PageShell title state must initialize from local-first route metadata.",
    ],
    [
      "readPageShellEditableHeaderSeed(pageId).properties",
      "PageShell properties state must initialize from local-first route metadata.",
    ],
    [
      "const editableHeaderPage = page ?? readPageShellRoutePreviewSeed(pageId);",
      "PageShell must reuse the route preview seed when synchronizing editable title/properties.",
    ],
    [
      "setTitle(editableHeaderPage.title);",
      "PageShell must synchronize the editable title from the first available page snapshot before paint.",
    ],
    [
      "setProperties(parsePageProperties(editableHeaderPage.properties));",
      "PageShell must synchronize editable properties from the first available page snapshot before paint.",
    ],
    [
      "function readPageShellEditableHeaderSeed",
      "PageShell editable title/properties initialization must share the local-first seed order.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "properties?: string | null;",
      "Page route skeleton preview props must accept metadata-only page properties.",
    ],
    [
      'data-testid="page-route-preview-properties"',
      "Page route skeleton must render known local properties during chunk loading.",
    ],
    [
      "getPreviewProperties(preview?.properties)",
      "Page route skeleton must derive property previews from the local metadata payload.",
    ],
    [
      "PAGE_ROUTE_PREVIEW_PROPERTY_LIMIT = 2",
      "Page route skeleton property preview must stay bounded for fast first paint.",
    ],
    [
      "function parsePreviewProperties",
      "Page route skeleton must parse metadata-only page properties locally.",
    ],
    [
      "PAGE_ROUTE_PREVIEW_PROPERTY_ICONS",
      "Page route skeleton must keep lightweight local property icons without loading the property editor helpers.",
    ],
  ]) {
    assertSourceIncludes(files.pageRouteSkeleton, pageRouteSkeleton, snippet, message);
  }
  assertSourceExcludes(
    files.pageRouteSkeleton,
    pageRouteSkeleton,
    'from "@/lib/pages/pageProperties"',
    "Page route skeleton property preview must stay lightweight and avoid importing the full page property editor helpers."
  );
  for (const [sourceLabel, source] of [
    [files.databaseDetailRoute, databaseDetailRoute],
    [files.databaseDetailRouteLoading, databaseDetailRouteLoading],
    [files.databaseShell, databaseShell],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "DatabaseRouteSkeleton",
      "Database detail routes must keep an immediate shell while route segments, client chunks, or local records hydrate."
    );
  }
  for (const [snippet, message] of [
    [
      "先显示本地热缓存",
      "The workspace route skeleton must communicate local hot-cache-first rendering.",
    ],
    [
      "后台刷新云端索引",
      "The workspace route skeleton must communicate background cloud index hydration.",
    ],
    [
      "grid-cols-7",
      "The workspace route skeleton must resemble the calendar grid before heavy modules hydrate.",
    ],
  ]) {
    assertSourceIncludes(files.moduleRouteSkeleton, moduleRouteSkeleton, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "本地缓存会先加载",
      "The page route skeleton must communicate local-cache-first rendering.",
    ],
    [
      "云端同步在后台继续",
      "The page route skeleton must communicate background cloud sync.",
    ],
    [
      "aria-live",
      "The page route skeleton must announce loading progress accessibly.",
    ],
    [
      "preview?:",
      "The page route skeleton must accept metadata-only route handoff previews.",
    ],
    [
      'data-testid="page-route-preview-title"',
      "The page route skeleton must render the handed-off title while the full page shell loads.",
    ],
    [
      "已接收页面，正在加载编辑器",
      "The page route skeleton must tell the owner that the target page has already been received locally.",
    ],
  ]) {
    assertSourceIncludes(files.pageRouteSkeleton, pageRouteSkeleton, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "本地热缓存会先加载",
      "The database route skeleton must communicate local hot-cache-first rendering.",
    ],
    [
      "云端索引在后台继续",
      "The database route skeleton must communicate background cloud index hydration.",
    ],
    [
      "aria-live",
      "The database route skeleton must announce loading progress accessibly.",
    ],
    [
      "grid-cols-[1.4fr_1fr_1fr_1fr]",
      "The database route skeleton must resemble a database table before rows hydrate.",
    ],
  ]) {
    assertSourceIncludes(files.databaseRouteSkeleton, databaseRouteSkeleton, snippet, message);
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-local-metadata-manifest"',
      "Local metadata manifest must expose a stable export format.",
    ],
    [
      'manifest_status: "local-metadata-only"',
      "Local metadata manifest must remain metadata-only.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Local metadata manifest must align to cloud master plus local hot cache.",
    ],
    [
      "reads_page_body_text: false",
      "Local metadata manifest must not read page body text.",
    ],
    [
      "reads_page_yjs: false",
      "Local metadata manifest must not read Yjs payloads.",
    ],
    [
      "reads_database_row_values: false",
      "Local metadata manifest must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Local metadata manifest must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Local metadata manifest must not read file bytes.",
    ],
    [
      "reads_file_text: false",
      "Local metadata manifest must not read file text.",
    ],
    [
      "includes_raw_ids_in_export: false",
      "Local metadata manifest must not export raw ids.",
    ],
    [
      "local_workspace_hash",
      "Local metadata manifest must hash the local workspace id.",
    ],
    [
      "cloud_workspace_hash",
      "Local metadata manifest must hash the cloud workspace id.",
    ],
    [
      'id: "pages"',
      "Local metadata manifest must cover pages.",
    ],
    [
      'id: "databases"',
      "Local metadata manifest must cover databases.",
    ],
    [
      'id: "files"',
      "Local metadata manifest must cover files.",
    ],
    [
      'id: "comments"',
      "Local metadata manifest must cover comments.",
    ],
    [
      'id: "versions"',
      "Local metadata manifest must cover versions.",
    ],
    [
      'id: "wiki-links"',
      "Local metadata manifest must cover wiki links.",
    ],
    [
      'id: "sync-log"',
      "Local metadata manifest must cover pending queue metadata.",
    ],
    [
      "hash_algorithm: \"fnv1a-stable-json-v1\"",
      "Local metadata manifest must expose the hash algorithm.",
    ],
  ]) {
    assertSourceIncludes(
      files.localMetadataManifest,
      localMetadataManifest,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Local metadata manifest must not access page content text.",
    ],
    [
      "page.content_yjs",
      "Local metadata manifest must not access page Yjs content.",
    ],
    [
      "page.title",
      "Local metadata manifest must not access page titles.",
    ],
    [
      "database.description",
      "Local metadata manifest must not access database descriptions.",
    ],
    [
      "file.dataUrl",
      "Local metadata manifest must not access stored file bytes.",
    ],
    [
      "file.textContent",
      "Local metadata manifest must not access extracted file text.",
    ],
    [
      "comment.body",
      "Local metadata manifest must not access comment bodies.",
    ],
    [
      "field_values",
      "Local metadata manifest must not access database row values.",
    ],
    [
      "fetch(",
      "Local metadata manifest must not call network APIs.",
    ],
    [
      "localStorage.setItem",
      "Local metadata manifest must not write browser storage.",
    ],
    [
      "db.run",
      "Local metadata manifest must not mutate the local database.",
    ],
    [
      "local_workspace_id:",
      "Local metadata manifest must not export raw local workspace ids.",
    ],
    [
      "cloud_workspace_id:",
      "Local metadata manifest must not export raw cloud workspace ids.",
    ],
  ]) {
    assertSourceExcludes(
      files.localMetadataManifest,
      localMetadataManifest,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildLocalMetadataManifest",
      "Sync UI must build the local metadata manifest.",
    ],
    [
      "LocalMetadataManifestPanel",
      "Sync UI must render the local metadata manifest panel.",
    ],
    [
      "本地 metadata manifest",
      "Sync UI must expose the local metadata manifest section.",
    ],
    [
      "handleExportLocalMetadataManifest",
      "Sync UI must export the local metadata manifest.",
    ],
    [
      "导出本地 manifest",
      "Sync UI must render the local manifest export button.",
    ],
    [
      "CoreManifestComparePanel",
      "Sync UI must render the core cloud manifest compare panel.",
    ],
    [
      "核心域云端 manifest 对账",
      "Sync UI must expose core-domain cloud manifest comparison.",
    ],
    [
      "只读检查核心域",
      "Sync UI must expose a read-only core-domain manifest check action.",
    ],
    [
      "handleRunCoreManifestCompare",
      "Sync UI must wire the core-domain manifest comparison action.",
    ],
    [
      "buildCoreManifestDomainCompare",
      "Sync UI must build per-domain manifest comparison rows.",
    ],
    [
      "getCoreManifestOverallStatus",
      "Sync UI must compute an overall core manifest comparison status.",
    ],
    [
      "buildCoreManifestCompareSummary",
      "Sync UI must expose structured core manifest comparison summary counts.",
    ],
    [
      "buildCoreManifestCompareReceipt",
      "Sync UI must build a metadata-only receipt for the core manifest comparison.",
    ],
    [
      "withCoreManifestCompareReceipt",
      "Sync UI must attach a receipt to both successful and failed core manifest comparison reports.",
    ],
    [
      "导出对账收据",
      "Sync UI must expose the core manifest compare receipt export.",
    ],
    [
      "zhinote-core-manifest-compare-receipt",
      "Sync UI must export core manifest compare receipts with a stable receipt filename.",
    ],
    [
      "收据 ID",
      "Sync UI must show the core manifest compare receipt id for audit traceability.",
    ],
    [
      "countDelta",
      "Core manifest comparison must expose count deltas for mismatch triage.",
    ],
    [
      "deletedDelta",
      "Core manifest comparison must expose deleted-count deltas for mismatch triage.",
    ],
    [
      "watermarkMatches",
      "Core manifest comparison must expose watermark equality for mismatch triage.",
    ],
    [
      "diffReasons",
      "Core manifest comparison must explain why each domain is blocked or mismatched.",
    ],
    [
      "reviewChecklist",
      "Core manifest comparison must expose an owner review checklist per domain.",
    ],
    [
      "absoluteCountDelta",
      "Core manifest comparison summary must aggregate absolute count deltas.",
    ],
    [
      "domainsWithWatermarkMismatch",
      "Core manifest comparison summary must count watermark mismatches.",
    ],
    [
      "buildCoreDateManifestDiffReport",
      "Core manifest comparison must build date-level metadata diff evidence.",
    ],
    [
      "dateBucketsCompared",
      "Core manifest comparison summary must count compared date buckets.",
    ],
    [
      "dateBucketsWithDiff",
      "Core manifest comparison summary must count date buckets with diffs.",
    ],
    [
      "日期级 metadata 差异",
      "Sync UI must render date-level metadata diffs for daily notes and meetings.",
    ],
    [
      "不展示标题、正文、会议链接、会议号、密码、评论或文件字节",
      "Date-level manifest diff must preserve sensitive content boundaries.",
    ],
    [
      "CORE_MANIFEST_DATE_DIFF_ROW_LIMIT",
      "Date-level manifest diff must cap visible rows for large imports.",
    ],
    [
      "rebuildGate",
      "Core manifest comparison must expose per-domain rebuild gates.",
    ],
    [
      "canRebuildFromCloudManifest",
      "Core manifest comparison must declare whether a domain can rebuild from the cloud manifest.",
    ],
    [
      "ownerReviewRequired",
      "Core manifest comparison must declare whether owner review is required before rebuild.",
    ],
    [
      "云端 manifest 是重建来源；本地缓存只是复印件，不能反向覆盖云端。",
      "Core manifest comparison must keep the cloud manifest as the cache rebuild source of truth.",
    ],
    [
      "未上传编辑必须保留，不能被云端旧值覆盖",
      "Core manifest comparison must preserve unuploaded local edits before rebuild.",
    ],
    [
      "人工确认后再从云端重建本地缓存",
      "Core manifest comparison must require owner review before mismatch rebuild.",
    ],
    [
      "getLocalPageSyncSummary",
      "Core manifest comparison must read local page metadata summary.",
    ],
    [
      "getLocalDailySyncSummary",
      "Core manifest comparison must read local daily note date-index metadata summary.",
    ],
    [
      "getLocalMeetingSyncSummary",
      "Core manifest comparison must read local meeting calendar metadata summary.",
    ],
    [
      "getLocalDatabaseSyncSummary",
      "Core manifest comparison must read local database metadata summary.",
    ],
    [
      "getCloudPageManifestSummary",
      "Core manifest comparison must read cloud page manifest summary.",
    ],
    [
      "getCloudDailyManifestSummary",
      "Core manifest comparison must read cloud daily note metadata summary.",
    ],
    [
      "getCloudMeetingManifestSummary",
      "Core manifest comparison must read cloud meeting calendar metadata summary.",
    ],
    [
      "getCloudDatabaseManifestSummary",
      "Core manifest comparison must read cloud database manifest summary.",
    ],
    [
      "页面、每日纪要、会议和数据库这四个",
      "Core manifest comparison must cover all first-phase core domains.",
    ],
    [
      "count、deleted、watermark",
      "Core manifest comparison must stay summary-level and metadata-only.",
    ],
    [
      "不读取页面正文、数据库值、评论正文或文件字节",
      "Core manifest comparison must preserve sensitive content boundaries.",
    ],
    [
      "不会上传或清理本机缓存",
      "Core manifest comparison must be read-only and avoid cache mutation.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-core-manifest-compare-receipt"',
      "Core manifest compare receipt must declare a stable receipt format.",
    ],
    [
      'receipt_status: "metadata-only-local-receipt"',
      "Core manifest compare receipt must stay local and metadata-only.",
    ],
    [
      "includes_only_counts_watermarks_and_gates: true",
      "Core manifest compare receipt must explicitly limit itself to counts, watermarks, and gates.",
    ],
    [
      "reads_page_body_text: false",
      "Core manifest compare receipt must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Core manifest compare receipt must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Core manifest compare receipt must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Core manifest compare receipt must not read file bytes.",
    ],
    [
      "uploads_workspace_data: false",
      "Core manifest compare receipt must not upload workspace data.",
    ],
    [
      "overwrites_local_cache: false",
      "Core manifest compare receipt must not overwrite local cache.",
    ],
    [
      "receipt_hash",
      "Core manifest compare receipt must include a stable hash for audit traceability.",
    ],
    [
      "owner_review",
      "Core manifest compare receipt must preserve owner review requirements.",
    ],
    [
      "stableStringify",
      "Core manifest compare receipt must use stable hashing input ordering.",
    ],
  ]) {
    assertSourceIncludes(
      files.coreManifestCompareReceipt,
      coreManifestCompareReceipt,
      snippet,
      message
    );
  }

  for (const [snippet, message] of [
    [
      "export async function getLocalDailySyncSummary",
      "Local queries must expose daily note metadata summary for core-domain compare.",
    ],
    [
      "export async function getLocalMeetingSyncSummary",
      "Local queries must expose meeting calendar metadata summary for core-domain compare.",
    ],
    [
      "LOCAL_SYNC_SUMMARY_START_DATE",
      "Local daily/meeting summaries must use a bounded date-index window.",
    ],
    [
      "MEETING_METADATA_PROPERTY_NAMES",
      "Local meeting summary must rely on meeting metadata properties.",
    ],
    [
      "NULL AS content_yjs, NULL AS content_text",
      "Local daily/meeting summary must preserve page metadata-only reads.",
    ],
  ]) {
    assertSourceIncludes(files.localQueries, localQueries, snippet, message);
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-hot-cache-policy-plan"',
      "Hot cache policy plan must expose a stable export format.",
    ],
    [
      'plan_status: "local-policy-only"',
      "Hot cache policy plan must remain local-policy-only.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Hot cache policy plan must align to cloud master plus local hot cache.",
    ],
    [
      "reads_page_body_text: false",
      "Hot cache policy plan must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Hot cache policy plan must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Hot cache policy plan must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Hot cache policy plan must not read file bytes.",
    ],
    [
      "writes_server_data: false",
      "Hot cache policy plan must not write server data.",
    ],
    [
      "uploads_workspace_data: false",
      "Hot cache policy plan must not upload workspace data.",
    ],
    [
      "mutates_local_cache: false",
      "Hot cache policy plan must not mutate local cache.",
    ],
    [
      'id: "pending-sync-never-evict"',
      "Hot cache policy plan must protect pending edits from eviction.",
    ],
    [
      'id: "recent-30-days"',
      "Hot cache policy plan must cover recent default cache.",
    ],
    [
      'id: "current-month-daily-notes"',
      "Hot cache policy plan must cover daily note cache selection.",
    ],
    [
      'id: "active-databases"',
      "Hot cache policy plan must cover database cache selection.",
    ],
    [
      'id: "favorite-pages"',
      "Hot cache policy plan must reserve user-selected pinned cache.",
    ],
    [
      'id: "current-projects"',
      "Hot cache policy plan must cover current project cache selection.",
    ],
    [
      'id: "current-month-meetings"',
      "Hot cache policy plan must cover current-month meeting cache selection.",
    ],
  ]) {
    assertSourceIncludes(
      files.hotCachePolicyPlan,
      hotCachePolicyPlan,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Hot cache policy plan must not access page content text.",
    ],
    [
      "page.content_yjs",
      "Hot cache policy plan must not access page Yjs content.",
    ],
    [
      "database.description",
      "Hot cache policy plan must not access database descriptions.",
    ],
    [
      "file.dataUrl",
      "Hot cache policy plan must not access file bytes.",
    ],
    [
      "file.textContent",
      "Hot cache policy plan must not access extracted file text.",
    ],
    [
      "comment.body",
      "Hot cache policy plan must not access comment bodies.",
    ],
    [
      "field_values",
      "Hot cache policy plan must not access database row values.",
    ],
    [
      "fetch(",
      "Hot cache policy plan must not call network APIs.",
    ],
    [
      "localStorage.setItem",
      "Hot cache policy plan must not write browser storage.",
    ],
    [
      "db.run",
      "Hot cache policy plan must not mutate the local database.",
    ],
  ]) {
    assertSourceExcludes(
      files.hotCachePolicyPlan,
      hotCachePolicyPlan,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildHotCachePolicyPlan",
      "Sync UI must build the hot cache policy plan.",
    ],
    [
      "HotCachePolicyPlanPanel",
      "Sync UI must render the hot cache policy panel.",
    ],
    [
      "本地热缓存策略",
      "Sync UI must expose the hot cache policy section.",
    ],
    [
      "handleExportHotCachePolicyPlan",
      "Sync UI must export the hot cache policy plan.",
    ],
    [
      "导出热缓存策略",
      "Sync UI must render the hot cache policy export button.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-hot-cache-warmup-plan"',
      "Hot cache warmup plan must expose a stable export format.",
    ],
    [
      "prefetches_routes_only: true",
      "Hot cache warmup plan must remain route-prefetch only.",
    ],
    [
      "mutates_local_cache_records: false",
      "Hot cache warmup plan must not mutate local cache records.",
    ],
    [
      "ACTIVE_DATABASE_ROUTE_TARGET_LIMIT = 12",
      "Hot cache warmup plan must keep active database route prefetch bounded.",
    ],
    [
      "CURRENT_MONTH_DAILY_ROUTE_TARGET_LIMIT = 31",
      "Hot cache warmup plan must keep current-month daily route prefetch bounded.",
    ],
    [
      "CURRENT_MONTH_MEETING_ROUTE_TARGET_LIMIT = 60",
      "Hot cache warmup plan must keep current-month meeting route prefetch bounded.",
    ],
    [
      'preference_key: "keepCurrentMonthMeetings"',
      "Hot cache warmup plan must let users disable current-month meeting route prefetch.",
    ],
    [
      "FAVORITE_PAGE_ROUTE_TARGET_LIMIT = 12",
      "Hot cache warmup plan must keep favorite page route prefetch bounded.",
    ],
    [
      "CURRENT_PROJECT_ROUTE_TARGET_LIMIT = 12",
      "Hot cache warmup plan must keep current project route prefetch bounded.",
    ],
    [
      "PINNED_DATABASE_ROUTE_TARGET_LIMIT = 24",
      "Hot cache warmup plan must keep pinned database route prefetch bounded.",
    ],
    [
      'preference_key: "pinnedDatabaseIds"',
      "Hot cache warmup plan must use the explicit pinned database preference.",
    ],
    [
      "`/database/${encodeURIComponent(database.id)}`",
      "Hot cache warmup plan must prefetch active database detail routes when selected.",
    ],
    [
      "`/page/${encodeURIComponent(page.id)}`",
      "Hot cache warmup plan must prefetch favorite page detail routes when selected.",
    ],
    [
      "行值继续按需加载",
      "Hot cache warmup plan must keep database row values out of route prefetch.",
    ],
    [
      "用户未选择指定数据库常驻本地。",
      "Hot cache warmup plan must explain when pinned database cache is preference-off.",
    ],
    [
      "纪要详情路由",
      "Hot cache warmup plan must prefetch current-month daily note detail routes.",
    ],
    [
      "会议详情路由",
      "Hot cache warmup plan must prefetch current-month meeting detail routes.",
    ],
    [
      "正文按打开时补齐",
      "Hot cache warmup plan must keep page bodies out of route prefetch.",
    ],
    [
      "入会凭证按打开时补齐",
      "Hot cache warmup plan must keep meeting credentials out of route prefetch.",
    ],
    [
      "用户未选择当前月份会议日历常驻本地。",
      "Hot cache warmup plan must explain when current-month meeting cache is preference-off.",
    ],
    [
      "项目正文按打开时补齐",
      "Hot cache warmup plan must keep project page bodies out of route prefetch.",
    ],
  ]) {
    assertSourceIncludes(
      files.hotCacheWarmupPlan,
      hotCacheWarmupPlan,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Hot cache warmup plan must not access page content text.",
    ],
    [
      "page.content_yjs",
      "Hot cache warmup plan must not access page Yjs content.",
    ],
    [
      "database.description",
      "Hot cache warmup plan must not access database descriptions.",
    ],
    [
      "file.dataUrl",
      "Hot cache warmup plan must not access file bytes.",
    ],
    [
      "file.textContent",
      "Hot cache warmup plan must not access file text.",
    ],
    [
      "comment.body",
      "Hot cache warmup plan must not access comment bodies.",
    ],
    [
      "field_values",
      "Hot cache warmup plan must not access database row values.",
    ],
    [
      "\"入会链接\"",
      "Hot cache warmup plan must not access meeting join URL properties.",
    ],
    [
      "\"会议号\"",
      "Hot cache warmup plan must not access meeting id properties.",
    ],
    [
      "\"会议密码\"",
      "Hot cache warmup plan must not access meeting passcode properties.",
    ],
    [
      "joinUrl:",
      "Hot cache warmup plan must not serialize meeting join URLs.",
    ],
    [
      "meetingId:",
      "Hot cache warmup plan must not serialize meeting ids.",
    ],
    [
      "passcode:",
      "Hot cache warmup plan must not serialize meeting passcodes.",
    ],
    [
      "fetch(",
      "Hot cache warmup plan must not call network APIs.",
    ],
    [
      "localStorage.setItem",
      "Hot cache warmup plan must not write browser storage.",
    ],
    [
      "db.run",
      "Hot cache warmup plan must not mutate the local database.",
    ],
  ]) {
    assertSourceExcludes(
      files.hotCacheWarmupPlan,
      hotCacheWarmupPlan,
      snippet,
      message
    );
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-hot-cache-warmup-receipt"',
      "Hot cache warmup receipt must expose a stable export format.",
    ],
    [
      'receipt_status: "route-prefetch-receipt"',
      "Hot cache warmup receipt must stay route-prefetch scoped.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Hot cache warmup receipt must align to cloud master plus local hot cache.",
    ],
    [
      "records_metadata_only: true",
      "Hot cache warmup receipt must only record metadata.",
    ],
    [
      "stores_receipt_as_source_of_truth: false",
      "Hot cache warmup receipt must not become the source of truth.",
    ],
    [
      "prefetches_routes_only: true",
      "Hot cache warmup receipt must only record route prefetches.",
    ],
    [
      "mutates_local_cache_records: false",
      "Hot cache warmup receipt must not mutate local cache records.",
    ],
    [
      "uploads_workspace_data: false",
      "Hot cache warmup receipt must not upload workspace data.",
    ],
  ]) {
    assertSourceIncludes(
      files.hotCacheWarmupReceipt,
      hotCacheWarmupReceipt,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Hot cache warmup receipt must not access page content text.",
    ],
    [
      "page.content_yjs",
      "Hot cache warmup receipt must not access page Yjs content.",
    ],
    [
      "database.description",
      "Hot cache warmup receipt must not access database descriptions.",
    ],
    [
      "file.dataUrl",
      "Hot cache warmup receipt must not access file bytes.",
    ],
    [
      "file.textContent",
      "Hot cache warmup receipt must not access file text.",
    ],
    [
      "comment.body",
      "Hot cache warmup receipt must not access comment bodies.",
    ],
    [
      "field_values",
      "Hot cache warmup receipt must not access database row values.",
    ],
    [
      "fetch(",
      "Hot cache warmup receipt must not call network APIs.",
    ],
    [
      "localStorage.setItem",
      "Hot cache warmup receipt must not write browser storage.",
    ],
    [
      "db.run",
      "Hot cache warmup receipt must not mutate the local database.",
    ],
  ]) {
    assertSourceExcludes(
      files.hotCacheWarmupReceipt,
      hotCacheWarmupReceipt,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-hot-cache-local-index-write-receipt"',
      "Local hot cache index must expose a stable write receipt.",
    ],
    [
      'format: "zhinote-hot-cache-local-index-summary"',
      "Local hot cache index must expose a stable summary format.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Local hot cache index must align to cloud master plus local hot cache.",
    ],
    [
      "INSERT INTO hot_cache_entries",
      "Local hot cache index must write the dedicated rebuildable table.",
    ],
    [
      "ON CONFLICT(id) DO UPDATE",
      "Local hot cache index writes must be idempotent.",
    ],
    [
      "enters_sync_log: false",
      "Local hot cache index writes must not enter the upload queue.",
    ],
    [
      "mutates_local_hot_cache_index: true",
      "Local hot cache index write receipt must disclose the local-only mutation.",
    ],
    [
      "stores_source_of_truth: false",
      "Local hot cache index must not become the source of truth.",
    ],
    [
      "records_metadata_only: true",
      "Local hot cache index must remain metadata-only.",
    ],
  ]) {
    assertSourceIncludes(files.hotCacheLocalIndex, hotCacheLocalIndex, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Local hot cache index must not access page content text.",
    ],
    [
      "page.content_yjs",
      "Local hot cache index must not access page Yjs content.",
    ],
    [
      "database.description",
      "Local hot cache index must not access database descriptions.",
    ],
    [
      "file.dataUrl",
      "Local hot cache index must not access file bytes.",
    ],
    [
      "file.textContent",
      "Local hot cache index must not access file text.",
    ],
    [
      "comment.body",
      "Local hot cache index must not access comment bodies.",
    ],
    [
      "field_values",
      "Local hot cache index must not access database row values.",
    ],
    [
      "fetch(",
      "Local hot cache index must not call network APIs.",
    ],
    [
      "localStorage.setItem",
      "Local hot cache index must not write browser storage directly.",
    ],
    [
      "recordSyncChange",
      "Local hot cache index must not call the pending upload logger.",
    ],
    [
      "INSERT INTO sync_log",
      "Local hot cache index must not write pending upload rows.",
    ],
  ]) {
    assertSourceExcludes(files.hotCacheLocalIndex, hotCacheLocalIndex, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-daily-hot-cache-snapshot"',
      "Daily hot cache snapshot must expose a stable local snapshot format.",
    ],
    [
      'route_target: "/daily"',
      "Daily hot cache snapshot must stay scoped to the daily route.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Daily hot cache snapshot must align to cloud master plus local hot cache.",
    ],
    [
      "window.localStorage.setItem",
      "Daily hot cache snapshot must be a local browser cache.",
    ],
    [
      "enters_sync_log: false",
      "Daily hot cache snapshot must not enter the upload queue.",
    ],
    [
      "stores_source_of_truth: false",
      "Daily hot cache snapshot must not become the source of truth.",
    ],
    [
      "records_metadata_only: true",
      "Daily hot cache snapshot must remain metadata-only.",
    ],
    [
      'format: "zhinote-daily-hot-cache-snapshot-index"',
      "Daily hot cache must keep a metadata-only index for overlapping range lookups.",
    ],
    [
      "DAILY_HOT_CACHE_INDEX_KEY",
      "Daily hot cache overlap reads must use a dedicated local index key.",
    ],
    [
      "scans_local_storage_keys: false",
      "Daily hot cache index must prove it avoids broad localStorage scans.",
    ],
    [
      "readDailyHotCacheSnapshotIndex(storage)",
      "Daily hot cache overlap reads must consult the metadata index before opening snapshots.",
    ],
    [
      "writeDailyHotCacheSnapshotIndex(window.localStorage, snapshot, key)",
      "Daily hot cache writes must refresh the metadata index.",
    ],
    [
      "isDailyHotCacheSnapshotPageInRange(page, input.startDate, input.endDate)",
      "Daily hot cache snapshot writes must keep only the requested calendar range.",
    ],
    [
      "isDailyHotCacheInputPagePossiblyInRange(",
      "Daily hot cache snapshot writes must skip out-of-range dailyDateKey inputs before parsing properties.",
    ],
    [
      "range_pages: snapshotPages.length",
      "Daily hot cache snapshot summaries must prove all stored pages are in range.",
    ],
  ]) {
    assertSourceIncludes(
      files.dailyHotCacheSnapshot,
      dailyHotCacheSnapshot,
      snippet,
      message
    );
  }
  assertSourceExcludes(
    files.dailyHotCacheSnapshot,
    dailyHotCacheSnapshot,
    "storage.key(",
    "Daily hot cache overlap reads must use the local snapshot index instead of scanning every localStorage key."
  );
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Daily hot cache snapshot must not read page content text.",
    ],
    [
      "page.content_yjs",
      "Daily hot cache snapshot must not read page Yjs content.",
    ],
    [
      "comment.body",
      "Daily hot cache snapshot must not access comment bodies.",
    ],
    [
      "field_values",
      "Daily hot cache snapshot must not access database row values.",
    ],
    [
      "fetch(",
      "Daily hot cache snapshot must not call network APIs.",
    ],
    [
      "recordSyncChange",
      "Daily hot cache snapshot must not call the pending upload logger.",
    ],
    [
      "INSERT INTO sync_log",
      "Daily hot cache snapshot must not write pending upload rows.",
    ],
  ]) {
    assertSourceExcludes(
      files.dailyHotCacheSnapshot,
      dailyHotCacheSnapshot,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "readDailyHotCacheSnapshot",
      "Daily notes must read the local hot cache snapshot before slower cache/cloud checks.",
    ],
    [
      "hotCacheBootstrapKeyRef",
      "Daily notes must bootstrap the visible month from browser hot cache before IndexedDB readiness.",
    ],
    [
      "正在启动本地数据库和云端校正",
      "Daily notes must tell the user that browser hot cache painted before local database/cloud correction.",
    ],
    [
      "cachedHotSnapshot,\n        startDate,\n        endDate",
      "Daily notes must filter even exact hot-cache snapshots to the visible calendar range.",
    ],
    [
      "writeDailyHotCacheSnapshot",
      "Daily notes must refresh the local hot cache snapshot after metadata loads.",
    ],
    [
      "DAILY_CLOUD_CACHE_FRESH_MS = 24 * 60 * 60 * 1000",
      "Daily notes must define a fresh cloud-metadata cache window for immediate directory first paint.",
    ],
    [
      "DAILY_CLOUD_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000",
      "Daily notes must keep a bounded stale cloud-metadata cache fallback for large workspaces.",
    ],
    [
      "type CachedDailyCloudMetadataResult",
      "Daily notes must type cached cloud metadata separately so stale entries are explicit.",
    ],
    [
      "stale: cacheAgeMs > DAILY_CLOUD_CACHE_FRESH_MS",
      "Daily notes must mark old cloud directory cache as stale instead of treating it as fresh.",
    ],
    [
      "较早缓存的云端每日纪要目录",
      "Daily notes must visibly label stale cloud directory cache while background refresh continues.",
    ],
    [
      "cached_cloud_stale",
      "Daily calendar performance snapshots must record when first paint used stale cloud metadata.",
    ],
    [
      "if (!cachedCloud.stale)",
      "Daily notes must not persist stale cloud directory cache back into the local database.",
    ],
    [
      "HOT_CACHE_PREFERENCES_SETTING_KEY",
      "Daily notes must read the user hot-cache preference setting.",
    ],
    [
      "HOT_CACHE_PREFERENCES_CHANGED_EVENT",
      "Daily notes must react when hot-cache preferences change locally.",
    ],
    [
      "HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY",
      "Daily notes must react to hot-cache preference changes from other tabs.",
    ],
    [
      "metadataRecentLimitForHotCachePreferences",
      "Daily notes must translate hot-cache preference into a bounded recent metadata window.",
    ],
    [
      "recentLimit: recentMetadataLimit",
      "Daily notes must use preference-aware recent metadata limits instead of a fixed window.",
    ],
    [
      "let cloudMetadataPromise: Promise<DailyCloudMetadataResult> | null = null;",
      "Daily notes must keep cloud metadata fetch lazy so local metadata can paint first.",
    ],
    [
      "const startDailyCloudMetadataFetch = () => {",
      "Daily notes must start cloud metadata fetch only after local-first metadata work begins.",
    ],
    [
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")',
      "Daily notes cloud metadata and upload queue helpers must lazy-load after local/hot-cache first paint.",
    ],
    [
      ".then(({ fetchDailyCloudMetadata }) =>",
      "Daily notes cloud metadata fetch must go through the lazy account-sync module.",
    ],
    [
      ".then(({ queueCloudPagePush }) =>",
      "Daily notes cloud queueing must go through the lazy account-sync module.",
    ],
    [
      "const cloudMetadata = startDailyCloudMetadataFetch()",
      "Daily notes must start cloud metadata fetch from the background cloud section, not before first paint.",
    ],
    [
      "writeOptimisticDailyHotCache",
      "Daily + creation must update the local hot cache before background persistence.",
    ],
    [
      "scheduleDailyIdleTask(() => {\n        writeOptimisticDailyHotCache({",
      "Daily + creation must defer hot-cache writes so the click can paint the new page immediately.",
    ],
    [
      "currentNotes: collectVisibleDailyNotesForHotCache(notesByDate)",
      "Daily + creation must not pass the full imported note set into optimistic hot-cache writes.",
    ],
    [
      "source: \"optimistic-local\"",
      "Daily hot cache must record optimistic local creates before cloud upload.",
    ],
    [
      "已先显示本机热缓存",
      "Daily notes must surface the local hot cache first-paint path.",
    ],
  ]) {
    assertSourceIncludes(files.dailyNotesShell, dailyNotesShell, snippet, message);
  }
  assertSourceExcludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "import {\n  fetchDailyCloudMetadata",
    "Daily notes must not static-import runtime account sync helpers during first paint."
  );
  if (
    !(
      dailyNotesShell.indexOf("const bootstrapKey = `${startDate}:${endDate}`") >=
        0 &&
      dailyNotesShell.indexOf("const bootstrapKey = `${startDate}:${endDate}`") <
        dailyNotesShell.indexOf("if (!dbReady) return;")
    )
  ) {
    fail(
      "Daily notes must read browser hot cache before the first dbReady-gated effect."
    );
  }
  for (const [snippet, message] of [
    [
      "buildDailyRangeSearchTokens",
      "Daily local metadata query must recover visible-month imported notes before broad background backfill finishes.",
    ],
    [
      "inferDailyDateKeyInRange",
      "Daily local metadata query must infer no-year imported titles inside the visible calendar range.",
    ],
    [
      "resolveMonthDayInRange",
      "Daily local metadata query must resolve month/day titles against the current visible range.",
    ],
    [
      "ENGLISH_MONTH_INDEX",
      "Daily local metadata query must recover English month titles from Notion imports.",
    ],
    [
      "DAILY_RANGE_SEARCH_TOKEN_LIMIT",
      "Daily targeted fallback search tokens must stay bounded for SQLite parameter safety.",
    ],
    [
      "tokens.add(`${currentMonth}月${currentDay}`)",
      "Daily targeted fallback must include Chinese no-year day tokens.",
    ],
    [
      "tokens.add(`${longMonthTitle} ${currentDay}`)",
      "Daily targeted fallback must include English no-year day tokens.",
    ],
    [
      "targetedFallbackRows",
      "Daily local metadata query must use a bounded visible-month fallback for missing date-index rows.",
    ],
    [
      "dateParentIdsForChildren",
      "Daily local metadata query must include bounded child metadata for date parent pages.",
    ],
    [
      "includeUnindexedFallback?: boolean",
      "Daily local metadata query must expose a switch so first paint can skip expensive unindexed import fallback.",
    ],
    [
      "if (includeUnindexedFallback)",
      "Daily unindexed import fallback must be explicitly gated away from first-paint queries.",
    ],
    [
      "DAILY_CALENDAR_TARGETED_FALLBACK_LIMIT",
      "Daily visible-month fallback must stay bounded.",
    ],
    [
      "DAILY_CALENDAR_CHILD_FALLBACK_LIMIT",
      "Daily date-parent child fallback must stay bounded.",
    ],
  ]) {
    assertSourceIncludes(files.localQueries, localQueries, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-meeting-hot-cache-snapshot"',
      "Meeting hot cache snapshot must have a stable format marker.",
    ],
    [
      'route_target: "/schedule"',
      "Meeting hot cache snapshot must stay scoped to the schedule route.",
    ],
    [
      "window.localStorage.setItem",
      "Meeting hot cache snapshot must stay in local browser cache.",
    ],
    [
      "enters_sync_log: false",
      "Meeting hot cache snapshot must not enter the upload queue.",
    ],
    [
      "stores_source_of_truth: false",
      "Meeting hot cache snapshot must not become the source of truth.",
    ],
    [
      "records_metadata_only: true",
      "Meeting hot cache snapshot must remain metadata-only.",
    ],
    [
      "stores_join_url: false",
      "Meeting hot cache snapshot must never store join URLs.",
    ],
    [
      "stores_meeting_id: false",
      "Meeting hot cache snapshot must never store meeting ids.",
    ],
    [
      "stores_passcode: false",
      "Meeting hot cache snapshot must never store passcodes.",
    ],
  ]) {
    assertSourceIncludes(
      files.meetingHotCacheSnapshot,
      meetingHotCacheSnapshot,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Meeting hot cache snapshot must not read page content text.",
    ],
    [
      "page.content_yjs",
      "Meeting hot cache snapshot must not read page Yjs content.",
    ],
    [
      "comment.body",
      "Meeting hot cache snapshot must not access comment bodies.",
    ],
    [
      "field_values",
      "Meeting hot cache snapshot must not access database row values.",
    ],
    [
      "fetch(",
      "Meeting hot cache snapshot must not call network APIs.",
    ],
    [
      "recordSyncChange",
      "Meeting hot cache snapshot must not call the pending upload logger.",
    ],
    [
      "INSERT INTO sync_log",
      "Meeting hot cache snapshot must not write pending upload rows.",
    ],
    [
      "\"入会链接\"",
      "Meeting hot cache snapshot must not persist join-link properties.",
    ],
    [
      "\"会议号\"",
      "Meeting hot cache snapshot must not persist meeting-id properties.",
    ],
    [
      "\"会议密码\"",
      "Meeting hot cache snapshot must not persist passcode properties.",
    ],
    [
      "joinUrl:",
      "Meeting hot cache snapshot must not persist parsed join URLs.",
    ],
    [
      "meetingId:",
      "Meeting hot cache snapshot must not persist parsed meeting ids.",
    ],
  ]) {
    assertSourceExcludes(
      files.meetingHotCacheSnapshot,
      meetingHotCacheSnapshot,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "readMeetingHotCacheSnapshot",
      "Meeting schedule must read the local hot cache snapshot before slower cache/cloud checks.",
    ],
    [
      "hotCacheBootstrapKeyRef",
      "Meeting schedule must bootstrap the visible month from browser hot cache before IndexedDB readiness.",
    ],
    [
      "meetingHotCacheSnapshotPageToPage",
      "Meeting schedule must convert the local hot cache snapshot back into metadata-only pages.",
    ],
    [
      "writeMeetingHotCacheSnapshot",
      "Meeting schedule must refresh the local hot cache snapshot after metadata loads.",
    ],
    [
      "HOT_CACHE_PREFERENCES_SETTING_KEY",
      "Meeting schedule must read the user hot-cache preference setting.",
    ],
    [
      "HOT_CACHE_PREFERENCES_CHANGED_EVENT",
      "Meeting schedule must react when hot-cache preferences change locally.",
    ],
    [
      "HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY",
      "Meeting schedule must react to hot-cache preference changes from other tabs.",
    ],
    [
      "metadataRecentLimitForHotCachePreferences",
      "Meeting schedule must translate hot-cache preference into a bounded recent metadata window.",
    ],
    [
      "recentLimit: recentMetadataLimit",
      "Meeting schedule must use preference-aware recent metadata limits instead of a fixed window.",
    ],
    [
      "writeOptimisticMeetingHotCache",
      "Meeting schedule must update the hot cache as soon as a local meeting draft is created.",
    ],
    [
      "MEETING_CALENDAR_RENDER_DAY_LIMIT",
      "Meeting calendar must cap per-day rendered entries so high-volume imports do not block the UI.",
    ],
    [
      "MEETING_CALENDAR_HYDRATION_BATCH",
      "Meeting calendar must hydrate date cells in idle batches instead of rendering every meeting chip at first paint.",
    ],
    [
      "hydratedMeetingDateKeys",
      "Meeting calendar must track which date cells are hydrated for chip rendering.",
    ],
    [
      "buildInitialMeetingCalendarHydrationKeys",
      "Meeting calendar must choose a small initial visible date window before idle hydration.",
    ],
    [
      "const [meetingCountByDate, setMeetingCountByDate]",
      "Meeting calendar must keep total counts separately from the rendered entry list.",
    ],
    [
      "function selectMeetingPagesForCalendarRender(",
      "Meeting calendar must route merged metadata through a render selection step before publishing.",
    ],
    [
      "setMeetingCountByDate(selection.countsByDate)",
      "Meeting calendar must publish true per-day counts alongside the capped render list.",
    ],
    [
      "dayTotalCount > MEETING_CALENDAR_VISIBLE_LIMIT",
      "Meeting calendar expansion controls must use true per-day totals, not only the capped render list.",
    ],
    [
      "已显示 ${visibleMeetings.length}/${dayTotalCount} 场",
      "Meeting calendar must tell the user when a high-volume day has reached the render cap.",
    ],
    [
      "场会议，点开查看",
      "Meeting calendar must show count-only placeholders before a deferred date cell is hydrated.",
    ],
    [
      "isMeetingDateHydrated && visibleMeetings.map",
      "Meeting calendar must render meeting chips only for hydrated date cells.",
    ],
    [
      "cancelScheduledBatch = scheduleMeetingIdleTask(",
      "Meeting calendar idle hydration must use the shared idle scheduler instead of fixed synchronous rendering.",
    ],
    [
      "MEETING_VISIBLE_CONTENT_WARMUP_LIMIT",
      "Meeting calendar must cap local content warmup to a small visible subset.",
    ],
    [
      "MEETING_VISIBLE_CONTENT_WARMUP_BATCH",
      "Meeting calendar content warmup must run in small idle batches.",
    ],
    [
      "collectVisibleMeetingContentWarmupCandidates",
      "Meeting calendar must collect content warmup candidates from visible date cells, not the whole import corpus.",
    ],
    [
      "warmMeetingPageContent(page)",
      "Meeting calendar must prewarm visible meeting page bodies before a direct click when local cache is available.",
    ],
    [
      "为保持日历流畅",
      "Meeting calendar must explain why additional high-volume entries are not rendered inline.",
    ],
    [
      "source: \"optimistic-local\"",
      "Meeting schedule hot cache must record optimistic local creates before background persistence.",
    ],
    [
      "getModuleRootId(\"meeting-schedule\")",
      "Meeting schedule must resolve the real module root in the background instead of blocking first paint.",
    ],
  ]) {
    assertSourceIncludes(
      files.meetingScheduleShell,
      meetingScheduleShell,
      snippet,
      message
    );
  }
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
    fail(
      "Meeting schedule must read browser hot cache before the first dbReady-gated effect."
    );
  }
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "会议模块还在加载，请等页面完成加载后再导入。",
    "Meeting creation must not fail just because the module root has not loaded yet."
  );
  for (const [snippet, message] of [
    [
      'format: "zhinote-page-route-handoff"',
      "Page route handoff must expose a stable local handoff format.",
    ],
    [
      'route_target: "/page/[pageId]"',
      "Page route handoff must stay scoped to page opening.",
    ],
    [
      'architecture_target: "cloud-master-local-route-handoff"',
      "Page route handoff must align to cloud master plus local-first page opening.",
    ],
    [
      "window.sessionStorage.setItem",
      "Page route handoff must be a short-lived browser session cache.",
    ],
    [
      "stores_page_body_text: false",
      "Page route handoff must not store page body text.",
    ],
    [
      "stores_page_yjs: false",
      "Page route handoff must not store Yjs editor state.",
    ],
    [
      "enters_sync_log: false",
      "Page route handoff must not enter the upload queue.",
    ],
    [
      "stores_source_of_truth: false",
      "Page route handoff must not become the source of truth.",
    ],
    [
      "records_metadata_only: true",
      "Page route handoff must stay metadata-only.",
    ],
  ]) {
    assertSourceIncludes(files.pageRouteHandoff, pageRouteHandoff, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "fetch(",
      "Page route handoff must not call network APIs.",
    ],
    [
      "recordSyncChange",
      "Page route handoff must not call the pending upload logger.",
    ],
    [
      "INSERT INTO sync_log",
      "Page route handoff must not write pending upload rows.",
    ],
    [
      "queueCloudPagePush",
      "Page route handoff must not queue cloud pushes.",
    ],
    [
      "pushCloudPages",
      "Page route handoff must not upload cloud pages.",
    ],
  ]) {
    assertSourceExcludes(files.pageRouteHandoff, pageRouteHandoff, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "window.localStorage",
      "Pending page drafts must not persist page body recovery data across browser sessions.",
    ],
    [
      "recordSyncChange",
      "Pending page drafts must not create upload log rows.",
    ],
    [
      "INSERT INTO sync_log",
      "Pending page drafts must not write pending upload rows.",
    ],
    [
      "queueCloudPagePush",
      "Pending page drafts must not enqueue cloud uploads.",
    ],
    [
      "pushCloudPages",
      "Pending page drafts must not call cloud push.",
    ],
  ]) {
    assertSourceExcludes(files.pendingPageDrafts, pendingPageDrafts, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "publishPageBodyHydrationStatus",
      "usePage must publish local-only body hydration progress for metadata-first opens.",
    ],
    [
      'phase: "local-body-requested"',
      "usePage must expose when it is checking local cache for the page body.",
    ],
    [
      'phase: "cloud-body-requested"',
      "usePage must expose when it is checking cloud body hydration in the background.",
    ],
    [
      '"cloud-body-ready"',
      "usePage must expose when cloud body hydration has completed.",
    ],
    [
      "readPageRouteHandoff",
      "usePage must read a route handoff before slower local DB or cloud checks.",
    ],
    [
      "readPageRouteHandoff(pageId) ??\n    readPendingPageDraft(pageId)",
      "usePage must prefer metadata-only route handoff over heavier pending body drafts for first paint.",
    ],
    [
      "readLocalFirstPageSeed",
      "usePage must read local-first route seeds before waiting on IndexedDB readiness.",
    ],
    [
      "const [initialLocalFirstPageSeed] = useState<Page | null>(() => {",
      "usePage must read the initial local-first seed once and reuse it for first render state.",
    ],
    [
      "const [page, setPage] = useState<Page | null>(() => {",
      "usePage must seed the page state before the first client render when route metadata exists.",
    ],
    [
      "const [loading, setLoading] = useState(() => {",
      "usePage must seed the loading state before the first client render when route metadata exists.",
    ],
    [
      "const visiblePageRef = useRef<Page | null>(initialLocalFirstPageSeed)",
      "usePage must keep the already-visible page snapshot available for the next load pass.",
    ],
    [
      "visiblePageRef.current?.id === pageId",
      "usePage must reuse the visible page snapshot before rereading session storage or IndexedDB.",
    ],
    [
      "const loadRequestRef = useRef(0);",
      "usePage must track the latest load request so stale page hydration cannot overwrite the current route.",
    ],
    [
      "const requestId = ++loadRequestRef.current;",
      "usePage must give each load attempt a monotonic request id.",
    ],
    [
      "if (!isCurrentLoad()) return;",
      "usePage must ignore stale async local or cloud hydration results.",
    ],
    [
      "loadRequestRef.current += 1;",
      "usePage must invalidate queued or in-flight loads when the route changes.",
    ],
    [
      "if (!dbReady)",
      "usePage must keep local-first route seeds visible while IndexedDB is still starting.",
    ],
    [
      "setLoadingForCurrentLoad(!localPage)",
      "usePage must avoid showing not-found when a local-first route seed exists before IndexedDB readiness.",
    ],
    [
      "getPageMetadata(pageId)",
      "usePage must read local page metadata before requesting the full page body.",
    ],
    [
      "schedulePageLocalBodyHydration",
      "usePage must defer local full-body reads until after metadata first paint.",
    ],
    [
      "refreshPageBodyFromLocalCache",
      "usePage must hydrate the full local page body through a separate background path.",
    ],
    [
      "PAGE_LOCAL_BODY_HYDRATION_IDLE_MS",
      "usePage must keep the local body hydration idle timeout explicit and bounded.",
    ],
    [
      "clearPageRouteHandoff",
      "usePage must clear route handoffs after durable local or cloud hydration.",
    ],
    [
      "schedulePageCloudHydration(\n        pageId,\n        () =>",
      "usePage must defer cloud body hydration until after a local page has painted through a latest-page reader.",
    ],
    [
      "const latestLocalPage = getLocalPage();",
      "usePage cloud hydration must compare against the latest visible local page instead of the stale opening snapshot.",
    ],
    [
      "applyCloudPageLookup(cloud, latestLocalPage, setPage, upsertPages)",
      "usePage cloud hydration must pass the latest local page into cloud conflict comparison.",
    ],
    [
      "requestIdleCallback(run",
      "usePage must schedule cloud body hydration during browser idle time.",
    ],
    [
      "PAGE_CLOUD_HYDRATION_IDLE_MS",
      "usePage must keep the cloud hydration idle timeout explicit and bounded.",
    ],
  ]) {
    assertSourceIncludes(files.usePage, usePage, snippet, message);
  }
  assertSourceExcludes(
    files.usePage,
    usePage,
    "setLoading(localPage.content_text == null)",
    "usePage must treat metadata/handoff as first-paint ready while the full page body hydrates in the background."
  );
  assertSourceExcludes(
    files.usePage,
    usePage,
    "cloudPagePromise",
    "usePage must not start a cloud body lookup before IndexedDB has had a chance to provide the local page."
  );
  for (const [snippet, message] of [
    [
      'PAGE_BODY_HYDRATION_STATUS_EVENT =\n  "zhinote:page-body-hydration-status"',
      "Page body hydration status must use a stable browser-local event name.",
    ],
    [
      "local_browser_memory_only: true",
      "Page body hydration status must be memory-only and not persisted.",
    ],
    [
      "stores_page_body_text: false",
      "Page body hydration status must not store page bodies.",
    ],
    [
      "uploads_workspace_data: false",
      "Page body hydration status must not upload workspace data.",
    ],
    [
      "export function subscribePageBodyHydrationStatus",
      "Page body hydration status must expose a read-only page-scoped subscription.",
    ],
    [
      "export function describePageBodyHydrationStatus",
      "Page body hydration status must expose shared Chinese labels for page surfaces.",
    ],
  ]) {
    assertSourceIncludes(
      files.pageBodyHydrationStatus,
      pageBodyHydrationStatus,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "const loadEditorModule = () => import(\"@/components/editor/Editor\")",
    "Page shell must keep the editor behind a dynamic import instead of blocking title/properties first paint."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "const loadPageMutationModule = () =>\n  import(\"@/lib/pages/cloudPageMutations\")",
    "Page shell must keep page mutation code behind a dynamic import instead of blocking route first paint."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "await loadPageMutationModule()",
    "Page shell must load page mutation code only after create/move/duplicate intent."
  );
  assertSourceExcludes(
    files.pageShell,
    pageShell,
    'from "@/lib/pages/cloudPageMutations"',
    "Page shell page mutation code must stay out of the full-page first paint bundle."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "return scheduleEditorMount(() => {\n      void loadEditorModule();\n      setEditorMounted(true);",
    "Page shell must defer warming the editor module until after page metadata is visible."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "PAGE_EDITOR_IDLE_TIMEOUT_MS = 120",
    "Page shell editor warmup must use a bounded short idle timeout so it does not compete with route first paint."
  );
  for (const [snippet, message] of [
    [
      "PAGE_SYNC_STATUS_FIRST_REFRESH_DELAY_MS = 900",
      "Page shell must keep the first sync-status refresh out of the immediate page-open critical path.",
    ],
    [
      "PAGE_SYNC_STATUS_FIRST_REFRESH_IDLE_TIMEOUT_MS = 2500",
      "Page shell deferred sync-status refresh must have a bounded idle fallback.",
    ],
    [
      "setPageSyncStatus(EMPTY_PAGE_SYNC_STATUS);\n    setCurrentPagePendingSync(false);",
      "Page shell must clear stale sync badges immediately when switching pages.",
    ],
    [
      "if (!hasPage) return;",
      "Page shell must avoid loading account sync status while the route is still showing the local-first skeleton.",
    ],
    [
      "schedulePageSyncStatusInitialRefresh(handleStatusRefresh)",
      "Page shell must defer the initial account sync status module load until after page metadata can paint.",
    ],
    [
      "cancelInitialRefresh();\n      cancelInitialRefresh = () => undefined;",
      "Page shell must cancel the deferred first sync-status refresh once a live status event refreshes it.",
    ],
    [
      "function schedulePageSyncStatusInitialRefresh",
      "Page shell must centralize deferred sync-status scheduling so quick page switches can cancel it.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
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
      "PAGE_LARGE_BODY_HTML_CHARS = 180 * 1024",
      "Page shell must define an explicit large-body threshold before deferring expensive editor parsing.",
    ],
    [
      "PAGE_LARGE_BODY_EDITOR_DELAY_MS = 260",
      "Page shell must briefly delay editor mounting for large imported notes so metadata first paint stays responsive.",
    ],
    [
      "PAGE_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS = 1600",
      "Page shell large-body editor fallback must stay bounded so long pages still become editable.",
    ],
    [
      "PAGE_LARGE_BODY_PREVIEW_HTML_CHARS = 120 * 1024",
      "Page shell must cap the HTML scanned for large-body previews.",
    ],
    [
      "PAGE_LARGE_BODY_PREVIEW_TEXT_CHARS = 6000",
      "Page shell must cap the text shown in large-body previews.",
    ],
    [
      "PAGE_LARGE_BODY_EDITOR_WARMUP_DELAY_MS = 900",
      "Page shell must warm the large-body editor chunk without mounting it immediately.",
    ],
    [
      "const hasContentForEditor = page?.content_text != null",
      "Page shell must distinguish metadata-only route handoff records from content-ready pages.",
    ],
    [
      'const isOptimisticPageDraft = page?.content_text === "";',
      "Page shell must distinguish a new empty local draft from a metadata-only handoff.",
    ],
    [
      "const hasLargeBodyForEditor = isLargePageBodyForEditor(page?.content_text)",
      "Page shell must distinguish ordinary pages from large HTML bodies before mounting the editor.",
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
      "if (hasLargeBodyForEditor && !largeBodyEditorRequested)",
      "Page shell must keep large page bodies in preview mode until the user requests the full editor.",
    ],
    [
      "setLargeBodyEditorRequested(true)",
      "Page shell must let users explicitly request the full editor for a long page body.",
    ],
    [
      'data-testid="large-page-body-preview"',
      "Page shell must expose a stable large-body preview surface.",
    ],
    [
      "buildLargePageBodyPreview",
      "Page shell must build a lightweight text preview for large page bodies.",
    ],
    [
      "script, style, iframe, object, embed, svg, canvas",
      "Large page previews must remove active or heavyweight embed nodes before extracting text.",
    ],
    [
      "完整编辑器会在你需要编辑或查看复杂块时再加载",
      "Large page preview copy must explain that the full editor loads on demand.",
    ],
    [
      "if (isOptimisticPageDraft) {",
      "Page shell must mount the editor immediately for a newly-created empty draft instead of waiting for body hydration.",
    ],
    [
      '"local-draft-ready"',
      "Page shell performance snapshots must identify when a newly-created local draft is ready.",
    ],
    [
      "hasLargeBodyForEditor\n        ? PAGE_LARGE_BODY_EDITOR_DELAY_MS",
      "Page shell must also delay heavy editor mounting for large imported page bodies.",
    ],
    [
      "hasLargeBodyForEditor\n        ? PAGE_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS",
      "Page shell must use a longer bounded idle fallback for large imported page bodies.",
    ],
    [
      "delay,\n      timeout,",
      "Page shell must pass computed delay and timeout into the editor mount scheduler.",
    ],
    [
      "largeBody={hasLargeBodyForEditor}",
      "Page shell loading skeleton must identify long body editor preparation separately from metadata-only hydration.",
    ],
    [
      "optimisticDraft={isOptimisticPageDraft}",
      "Page shell body skeleton must show a local-draft state while the editor chunk is loading.",
    ],
    [
      "新页面已在本机创建，标题和属性可以先确认，编辑器正在准备",
      "Page shell local-draft skeleton must tell the user the page exists locally before the editor finishes loading.",
    ],
    [
      "正文较长（约 ${formatApproxBodySize(contentLength)}）",
      "Page shell long-body skeleton must explain that metadata is already visible while the editor is prepared.",
    ],
    [
      "isLargePageBodyForEditor(content",
      "Page shell must keep long-body detection centralized.",
    ],
    [
      "getPageOpenPerformanceStatus(",
      "Page shell must centralize page-open performance status classification.",
    ],
    [
      "标题和属性已先显示，正在从本地缓存补齐正文和编辑器",
      "Page shell metadata-only skeleton must explain that the title/properties are already visible while body hydration continues.",
    ],
    [
      'data-testid="page-body-hydration-status"',
      "Page shell must render a stable body hydration feedback label for metadata-first opens.",
    ],
    [
      "subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus)",
      "Page shell must subscribe to page-scoped body hydration status without polling all pages.",
    ],
    [
      "describePageBodyHydrationStatus(bodyHydrationStatus)",
      "Page shell must use the shared status labels instead of duplicating hydration wording.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "readPageRouteHandoffSource(pageId)",
      "Page shell must classify page-open performance from route handoff metadata before it is cleared.",
    ],
    [
      'kind === "database-row-open" ? "数据库行打开" : "页面打开"',
      "Page shell must label database row page opens separately from ordinary page opens.",
    ],
    [
      'performanceKind === "database-row-open" ? 1 : 0',
      "Database row page-open performance snapshots must stay metadata-only and avoid row values.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  assertSourceIncludes(
    files.localPerformance,
    localPerformance,
    '"database-row-open"',
    "Local performance snapshots must accept database row page-open timing records."
  );
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
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  assertSourceExcludes(
    files.pageShell,
    pageShell,
    "pagePeripheralsMounted",
    "Page shell must not use one shared peripheral flag that mounts comments, child tree, and backlinks together."
  );
  for (const [snippet, message] of [
    [
      "dynamic<IconPickerProps>(",
      "Page shell must lazy-load the icon picker so the full page title can paint before the icon catalog loads.",
    ],
    [
      '() => import("@/components/shared/IconPicker")',
      "Page shell icon picker must live in its own async chunk.",
    ],
    [
      "PageIconPickerSkeleton",
      "Page shell must keep a stable lightweight icon placeholder while the picker chunk loads.",
    ],
    [
      "dynamic<PagePropertiesProps>(",
      "Page shell must lazy-load the property editor so metadata can paint before heavier controls load.",
    ],
    [
      '() => import("@/components/page/PageProperties")',
      "Page shell property editor must live in its own async chunk.",
    ],
    [
      "PagePropertiesSkeleton",
      "Page shell must keep a stable properties placeholder while the property editor chunk loads.",
    ],
    [
      "dynamic<PageActionsMenuProps>(",
      "Page shell must lazy-load page actions so export/history menus do not block page opening.",
    ],
    [
      '() => import("@/components/page/PageActionsMenu")',
      "Page shell actions menu must live in its own async chunk.",
    ],
    [
      "PageActionsMenuSkeleton",
      "Page shell must keep a stable actions placeholder while the actions chunk loads.",
    ],
    [
      "dynamic<BlockCommentsProps>(",
      "Page shell must lazy-load block comments instead of including comment UI in the first page bundle.",
    ],
    [
      '() => import("@/components/shared/BlockComments")',
      "Page shell block comments must live in their own async chunk.",
    ],
    [
      "@/components/shared/blockCommentEvents",
      "Page shell must import comment event names from a lightweight constants module.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'import IconPicker from "@/components/shared/IconPicker"',
      "Page shell must not directly import the full icon picker into the first page bundle.",
    ],
    [
      'import PageProperties from "@/components/page/PageProperties"',
      "Page shell must not directly import the full property editor into the first page bundle.",
    ],
    [
      'import PageActionsMenu from "@/components/page/PageActionsMenu"',
      "Page shell must not directly import the full actions menu into the first page bundle.",
    ],
    [
      'import BlockComments from "@/components/shared/BlockComments"',
      "Page shell must not directly import the block comments UI into the first page bundle.",
    ],
  ]) {
    assertSourceExcludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [sourceLabel, source] of [
    [files.blockComments, blockComments],
    [files.commentSidePanel, commentSidePanel],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "@/components/shared/blockCommentEvents",
      "Comment surfaces must share lightweight event constants instead of importing the block comments component for event names."
    );
  }
  assertSourceIncludes(
    files.blockCommentEvents,
    blockCommentEvents,
    "INLINE_COMMENT_SELECTED_EVENT",
    "The lightweight comment event constants module must expose inline comment selection events."
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
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'const loadPageVersioningModule = () => import("@/lib/comparison/versioning")',
      "Page shell must lazy-load version snapshot helpers instead of shipping them in the first page bundle.",
    ],
    [
      'const loadPageExportModule = () => import("@/lib/export/pageExport")',
      "Page shell must lazy-load page export helpers until the user exports or copies formatted content.",
    ],
    [
      "const loadPageResearchStructureModule = () =>",
      "Page shell must lazy-load the research-structure analyzer until the info panel is opened.",
    ],
    [
      "const loadPageSnapshotUpdatesModule = () =>",
      "Page shell must lazy-load moved-page snapshot expansion until a move/paste action needs it.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'from "@/lib/comparison/versioning"',
      "Page shell first paint must not statically import version snapshot helpers.",
    ],
    [
      'from "@/lib/export/pageExport"',
      "Page shell first paint must not statically import page export helpers.",
    ],
    [
      'from "@/lib/pages/pageSnapshotUpdates"',
      "Page shell first paint must not statically import moved-page snapshot helpers.",
    ],
  ]) {
    assertSourceExcludes(files.pageShell, pageShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "PAGE_SYNC_STATUS_PENDING_REFRESH_MS = 5000",
      "Page shell must keep pending page-sync feedback responsive while uploads are queued.",
    ],
    [
      "PAGE_SYNC_STATUS_IDLE_REFRESH_MS = 30 * 1000",
      "Page shell must slow idle page-sync polling so background status checks do not drag page opens.",
    ],
    [
      "scheduleStatusRefresh",
      "Page shell sync status refresh must be scheduled adaptively instead of using a fixed interval.",
    ],
    [
      "document.addEventListener(\"visibilitychange\", handleVisibleRefresh)",
      "Page shell sync status must refresh when returning to a visible tab.",
    ],
  ]) {
    assertSourceIncludes(files.pageShell, pageShell, snippet, message);
  }
  assertSourceExcludes(
    files.pageShell,
    pageShell,
    "window.setInterval(refreshStatus, 5000)",
    "Page shell must not poll page sync status every five seconds while idle."
  );
  assertSourceIncludes(
    files.accountPageSync,
    accountPageSync,
    'PAGE_SYNC_STATUS_EVENT = "zhinote:pagesync-status"',
    "Page sync queue changes must emit a local status event for visible save/upload feedback."
  );
  assertSourceIncludes(
    files.accountCloudSyncGate,
    accountCloudSyncGate,
    "fetchAccountSession",
    "Account cloud sync gate must reuse the shared account session check before any page/database sync route."
  );
  assertSourceIncludes(
    files.accountCloudSyncGate,
    accountCloudSyncGate,
    "account-unconfigured",
    "Account cloud sync gate must recognize unconfigured account backends without probing every sync domain."
  );
  assertSourceIncludes(
    files.accountCloudSyncGate,
    accountCloudSyncGate,
    "reads_page_body_text: false",
    "Account cloud sync gate must not inspect page body text."
  );
  assertSourceIncludes(
    files.accountCloudSyncGate,
    accountCloudSyncGate,
    "reads_database_row_values: false",
    "Account cloud sync gate must not inspect database row values."
  );
  assertSourceIncludes(
    files.accountCloudSyncGate,
    accountCloudSyncGate,
    "uploads_workspace_data: false",
    "Account cloud sync gate must not upload workspace data."
  );
  assertSourceIncludes(
    files.accountCloudSyncGate,
    accountCloudSyncGate,
    "stores_account_email: false",
    "Account cloud sync gate must not persist account emails."
  );
  for (const [snippet, message] of [
    [
      "ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY",
      "Account session checks must persist a short unconfigured-backend cache per browser tab.",
    ],
    [
      "readStoredUnconfiguredAccountSession(now)",
      "Account session checks must consult the tab cache before retrying a disabled account backend.",
    ],
    [
      "storeUnconfiguredAccountSession(Date.now())",
      "Account session checks must remember 501 account backend responses without storing account identity.",
    ],
    [
      "clearStoredUnconfiguredAccountSession()",
      "Account session cache clearing must remove the tab-level unconfigured marker.",
    ],
    [
      "window.sessionStorage.setItem",
      "Account session unconfigured caching must stay tab-scoped instead of localStorage-persistent.",
    ],
  ]) {
    assertSourceIncludes(files.accountClientSession, accountClientSession, snippet, message);
  }
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "checkAccountCloudSyncGate",
    "Page cloud sync must pass the shared account gate before hitting pages account-sync."
  );
  assertSourceIncludes(
    files.accountPageSync,
    accountPageSync,
    "checkAccountCloudSyncGate",
    "Page account-sync client must pass the shared account gate before all direct page pulls or summaries."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "gateAccountSync",
    "Page cloud sync must centralize account gate handling for initial, foreground, and recovery syncs."
  );
  assertSourceIncludes(
    files.databaseCloudSync,
    databaseCloudSync,
    "checkAccountCloudSyncGate",
    "Database cloud sync must pass the shared account gate before hitting databases account-sync."
  );
  assertSourceIncludes(
    files.accountDatabaseSync,
    accountDatabaseSync,
    "checkAccountCloudSyncGate",
    "Database account-sync client must pass the shared account gate before direct summaries or deltas."
  );
  assertSourceIncludes(
    files.databaseCloudSync,
    databaseCloudSync,
    "gateAccountSync",
    "Database cloud sync must centralize account gate handling for initial, foreground, and recovery syncs."
  );
  assertSourceIncludes(
    files.pageUpdateBus,
    pageUpdateBus,
    'PAGE_LOCAL_UPDATE_EVENT = "zhinote:pages-local-updated"',
    "Page update bus must emit a same-tab event so local edits can trigger background quick sync."
  );
  assertSourceIncludes(
    files.pageUpdateBus,
    pageUpdateBus,
    "new CustomEvent<PageUpdateMessage>(PAGE_LOCAL_UPDATE_EVENT",
    "Page update bus same-tab event must carry the lightweight page update message."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "EDIT_DEBOUNCE_MS = 4 * 1000",
    "Page cloud sync must debounce local edit-triggered quick syncs."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "PENDING_STATUS_SYNC_DELAY_MS",
    "Page cloud sync must define a short pending-status quick sync delay."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "schedulePendingStatusSync",
    "Page pending queue status events must trigger quick sync without waiting for the normal poll."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "detail.pending + detail.queued",
    "Page pending status quick sync must include durable and in-memory page queues."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "PAGE_PENDING_STORAGE_KEYS",
    "Page cloud sync must restrict cross-tab quick syncs to page pending storage keys."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    'PAGE_PENDING_STORAGE_KEYS.has(event.key ?? "")',
    "Page cross-tab pending storage changes must trigger quick sync without waiting for the normal poll."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "void runSync({ quick: true, forceLease: true });",
    "Page foreground and online sync must let the visible tab take over the cloud sync lease."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    'window.addEventListener("online", handleForeground)',
    "Page cloud sync must retry immediately when the network comes back online."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    'document.addEventListener("visibilitychange", handleVisible)',
    "Page cloud sync must retry immediately when a tab becomes visible."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "window.addEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate)",
    "Page cloud sync must listen for same-tab local page updates."
  );
  assertSourceIncludes(
    files.pageCloudSync,
    pageCloudSync,
    "window.removeEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate)",
    "Page cloud sync must clean up the same-tab local page update listener."
  );
  assertSourceIncludes(
    files.usePage,
    usePage,
    'emitPageSnapshotsUpdated("cloud-push", [optimistic])',
    "Page edits must broadcast lightweight metadata immediately after local optimistic updates."
  );
  assertSourceIncludes(
    files.usePage,
    usePage,
    "subscribePagesUpdated",
    "Page detail hook must listen for cross-tab page update broadcasts."
  );
  assertSourceIncludes(
    files.usePage,
    usePage,
    "applyCrossTabPageMetadata",
    "Page detail hook must apply cross-tab page metadata immediately."
  );
  assertSourceIncludes(
    files.usePage,
    usePage,
    "content_text: current?.content_text ?? null",
    "Cross-tab page metadata must preserve current page body instead of broadcasting body text."
  );
  assertSourceIncludes(
    files.usePage,
    usePage,
    "fallbackReloadTimer = window.setTimeout",
    "Page detail hook must retry local hot-cache reload after cross-tab updates."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "subscribePagesUpdated((message) => {",
    "Daily calendar must listen for cross-tab page update broadcasts instead of waiting for a broad reload."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "isDailyCalendarPageUpdate(payload, dailyRootId, knownDailyIds)",
    "Daily calendar cross-tab refresh must filter updates to the daily workspace root or already visible daily notes."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "applyDailyPageUpdatePayloads(",
    "Daily calendar must apply lightweight page metadata before its local hot-cache retry completes."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "content_text: existing?.content_text ?? null",
    "Daily calendar cross-tab metadata must preserve any existing page body in memory."
  );
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "subscribePagesUpdated((message) => {",
    "Meeting calendar must listen for cross-tab page update broadcasts instead of waiting for a broad reload."
  );
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "isMeetingCalendarPageUpdate(payload, meetingRootId, knownMeetingIds)",
    "Meeting calendar cross-tab refresh must filter updates to the ZhiHui workspace root or already visible meetings."
  );
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "applyMeetingPageUpdatePayloads(",
    "Meeting calendar must apply lightweight page metadata before its local hot-cache retry completes."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "getPendingCloudPageSyncStatus",
    "Page shell must read the local page sync queue status without triggering upload."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")',
    "Page shell must load page-sync status helpers after the first page shell paint."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "EMPTY_PAGE_SYNC_STATUS",
    "Page shell must render a lightweight local-saved sync badge before the sync helper chunk loads."
  );
  assertSourceExcludes(
    files.pageShell,
    pageShell,
    "import {\n  getPendingCloudPageSyncStatus",
    "Page shell must not pull the full account page sync module into the initial page route chunk."
  );
  assertSourceIncludes(
    files.accountPageSync,
    accountPageSync,
    "export function isCloudPagePendingSync",
    "Page sync client must expose a read-only current-page pending check without reading page bodies."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "isCloudPagePendingSync(pageId)",
    "Page shell sync badge must distinguish the currently open page from unrelated pending uploads."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    "当前页待云同步",
    "Page shell sync badge must tell the owner when the current page is waiting for cloud upload."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    'data-testid="page-sync-status-badge"',
    "Page shell must render a stable sync status badge for local saved / pending cloud state."
  );
  assertSourceIncludes(
    files.pageShell,
    pageShell,
    'router.push("/modules/sync")',
    "Page sync status badge must open the Sync module where pending queues can be reviewed and retried."
  );
  assertSourceIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "upsertPages([metadata])",
    "Peek modal must promote metadata into memory so editor loading can proceed before cloud body hydration."
  );
  assertSourceIncludes(
    files.pagePeekModal,
    pagePeekModal,
    "queueCloudPagePush(pageToRemoteRecord(page))",
    "Peek modal fallback saves must use the pending cloud upload queue instead of blocking on direct push."
  );
  assertSourceExcludes(
    files.pagePeekModal,
    pagePeekModal,
    "await pushCloudPages",
    "Peek modal fallback saves must not block editing on a direct cloud push."
  );
  assertSourceIncludes(
    files.pageContextMenu,
    pageContextMenu,
    "usePages({ autoLoad: false })",
    "Page context menu must keep move/copy/delete operations local and avoid full page-list loading."
  );
  assertSourceIncludes(
    files.lazyPageContextMenu,
    lazyPageContextMenu,
    "dynamic<PageContextMenuProps>(loadPageContextMenu",
    "Page context menu must be lazy-loaded so right-click actions do not slow common first paint."
  );
  for (const [sourceLabel, source] of [
    [files.pageTree, pageTree],
    [files.dailyNotesShell, dailyNotesShell],
    [files.meetingScheduleShell, meetingScheduleShell],
    [files.knowledgeBaseShell, knowledgeBaseShell],
    [files.industryChainShell, industryChainShell],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "@/components/page/LazyPageContextMenu",
      "Sidebar and research calendar/workspace shells must lazy-load the page context menu."
    );
    assertSourceExcludes(
      sourceLabel,
      source,
      "@/components/page/PageContextMenu",
      "Sidebar and research calendar/workspace shells must not direct-import the heavy page context menu."
    );
  }
  for (const [snippet, message] of [
    [
      "@/components/page/LazyPagePeekModal",
      "Daily calendar must lazy-load the peek modal so the first paint does not include the page editor shell.",
    ],
    [
      "const warmDailyPeekOpen = useCallback",
      "Daily calendar must split route-shell warmup from lazy peek-modal warmup.",
    ],
    [
      "warmDailyPeekOpen();",
      "Daily calendar must warm the lazy peek modal only on page-open intent.",
    ],
    [
      "rememberPageRouteHandoff(optimisticNote, \"daily-create\")",
      "Daily + creation must hand off the optimistic page before peek or full-page opening.",
    ],
    [
      "rememberPageRouteHandoff(note, source)",
      "Daily note opening must hand off metadata before opening a page.",
    ],
    [
      'primeDailyNoteOpen(note, "daily-open");',
      "Daily existing-note opens must prime route handoff before showing the peek shell.",
    ],
    [
      'onFocus={() => primeDailyNoteOpen(note, "daily-open")}',
      "Daily existing-note focus must prime the local-first page shell before opening.",
    ],
    [
      "useLocalFirstPageNavigation",
      "Daily full-page openings must use the shared local-first page navigation path.",
    ],
    [
      "setPeekInitialPage(optimisticNote);",
      "Daily + creation must seed the optimistic page into the peek modal before background persistence.",
    ],
    [
      "setPeekPageId(optimisticNote.id);",
      "Daily + creation must open the same-page peek editor immediately after local seeding.",
    ],
    [
      "scheduleDailyIdleTask(() => {\n        void seedDailyNoteForImmediateOpen(optimisticNote);",
      "Daily + creation must defer local cache persistence until after the page is already opening.",
    ],
    [
      "scheduleDailyIdleTask(() => {\n        writeOptimisticDailyHotCache({",
      "Daily + creation must defer hot-cache writes behind the immediate peek open path.",
    ],
    [
      "scheduleDailyIdleTask(() => {\n        void (async () => {",
      "Daily + creation must defer root resolution and cloud queue persistence behind the immediate navigation path.",
    ],
    [
      "每日纪要已弹出",
      "Daily + creation must tell the user that the new page popped open and will sync in the background.",
    ],
    [
      "openPage(note, { source })",
      "Daily full-page note opens must route through local-first navigation.",
    ],
    [
      'openPage(pageId, { source: "daily-open" })',
      "Daily fallback page-id opens must still use local-first navigation when a metadata seed is available.",
    ],
    [
      "const calendarIndexes = useMemo(",
      "Daily calendar must build all first-paint note indexes in one memoized pass for large imported workspaces.",
    ],
    [
      "buildDailyCalendarIndexes(notes, calendarDateKeys)",
      "Daily calendar must share one visible-month index builder instead of repeating full-list passes.",
    ],
    [
      "function buildDailyCalendarIndexes(",
      "Daily calendar single-pass index helper must stay explicit and reviewable.",
    ],
    [
      "const notesById = calendarIndexes.notesById",
      "Daily calendar must reuse the single-pass id index for note opening and dragging.",
    ],
    [
      "const calendarDateKeys = useMemo",
      "Daily calendar grouping must be scoped to the visible month grid.",
    ],
    [
      "if (!calendarDateKeys.has(dateKey)) continue;",
      "Daily calendar must avoid grouping recent notes outside the visible grid during first paint.",
    ],
    [
      "const deferredRecentNotes = useDeferredValue(calendarIndexes.recentNotes)",
      "Daily recent-note list must defer bounded recent candidates behind the calendar.",
    ],
    [
      "startTransition(() => {\n        if (loadRequestRef.current !== requestId) return;\n        setNotes(renderableNotes);",
      "Daily calendar bulk metadata publishes must stay low-priority and render-bounded so clicks and typing remain responsive.",
    ],
    [
      "notesRenderFingerprintRef",
      "Daily calendar must remember the last rendered metadata subset to avoid duplicate hot-cache/local/cloud repaints.",
    ],
    [
      "dailyNotesRenderFingerprint(renderableNotes)",
      "Daily calendar publishes must fingerprint the bounded rendered subset before calling setNotes.",
    ],
    [
      "notesRenderFingerprintRef.current === nextFingerprint",
      "Daily calendar must skip identical rendered note lists during staged local/cloud hydration.",
    ],
    [
      "const inCalendarNote = notesById.get(pageId)",
      "Daily note full-page opening must use the visible-month note id index before checking the global workspace.",
    ],
    [
      "rememberPendingPageDraft(note)",
      "Daily note opening must keep an in-memory draft for immediate full-page first paint.",
    ],
    [
      "openDailyNoteFullPageById",
      "Daily note context menu and peek modal must use the local-first full-page opening path.",
    ],
    [
      "data-testid={`daily-add-note-${key}`}",
      "Daily calendar + buttons must expose stable test targets.",
    ],
    [
      "DAILY_RECENT_VISIBLE_LIMIT",
      "Daily recent-note list must keep a small visible cap for large imported workspaces.",
    ],
    [
      "deferredRecentNotes.slice(0, DAILY_RECENT_VISIBLE_LIMIT)",
      "Daily recent-note list must render from bounded top-note candidates instead of full-list sorting.",
    ],
    [
      "function selectDailyNotesForCalendarRender(",
      "Daily calendar render state must keep current-grid notes plus bounded recent notes instead of every imported record.",
    ],
    [
      "DAILY_CALENDAR_RENDER_DAY_LIMIT",
      "Daily calendar render state must cap each visible day before publishing React state.",
    ],
    [
      "cancelScheduledBatch = scheduleDailyIdleTask(",
      "Daily calendar automatic date hydration must run through idle scheduling instead of fixed timer pressure.",
    ],
    [
      "DAILY_VISIBLE_CONTENT_WARMUP_LIMIT",
      "Daily calendar must cap local content warmup to a small visible subset.",
    ],
    [
      "DAILY_VISIBLE_CONTENT_WARMUP_BATCH",
      "Daily calendar content warmup must run in small idle batches.",
    ],
    [
      "collectVisibleDailyContentWarmupCandidates",
      "Daily calendar must collect content warmup candidates from visible date cells, not the whole import corpus.",
    ],
    [
      "warmDailyNoteContent(note)",
      "Daily calendar must prewarm visible note bodies before a direct click when local cache is available.",
    ],
    [
      "const [dailyNoteCountByDate, setDailyNoteCountByDate]",
      "Daily calendar must keep date-level totals separately from the capped render list.",
    ],
    [
      "setDailyNoteCountByDate(selection.countsByDate)",
      "Daily calendar publishes must update date totals with each staged metadata result.",
    ],
    [
      "dailyNoteCountsFingerprint(selection.countsByDate)",
      "Daily calendar fingerprints must include date totals so count-only updates repaint correctly.",
    ],
    [
      "const dayTotalCount =",
      "Daily calendar cells must render hidden counts from date totals, not only loaded chips.",
    ],
    [
      "const isRenderCapped =",
      "Daily calendar cells must detect when a high-volume day hit the render cap.",
    ],
    [
      "DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT",
      "Daily high-volume day expansion must cap user-triggered date-level metadata backfills.",
    ],
    [
      "const [loadingMoreDateKey, setLoadingMoreDateKey]",
      "Daily high-volume day expansion must expose loading feedback for date-level metadata backfills.",
    ],
    [
      "const loadMoreNotesForDate = useCallback",
      "Daily high-volume day expansion must load extra metadata by date instead of sending users to search.",
    ],
    [
      "const targetRangeLimit = Math.min",
      "Daily date-level backfills must compute a bounded incremental metadata target.",
    ],
    [
      "currentLoadedCount + DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT",
      "Daily date-level backfills must advance in bounded batches rather than loading everything.",
    ],
    [
      "rangeLimit: targetRangeLimit",
      "Daily date-level backfills must pass the bounded metadata target to the local query.",
    ],
    [
      "点击补齐",
      "Daily high-volume day expansion must make the capped-day backfill action visible.",
    ],
    [
      "正在补齐…",
      "Daily high-volume day expansion must show progress while metadata is being backfilled.",
    ],
    [
      "为保持日历流畅",
      "Daily calendar must explain capped high-volume day rendering to the user.",
    ],
    [
      "includeUnindexedFallback: false",
      "Daily first-paint local metadata query must skip expensive unindexed Notion-import fallback.",
    ],
    [
      "includeUnindexedFallback: true",
      "Daily background refresh must still recover unindexed Notion-import metadata.",
    ],
    [
      'source: "local-fallback-metadata"',
      "Daily background fallback metadata must refresh the hot cache after first paint.",
    ],
    [
      "function addRecentDailyNoteCandidate(",
      "Daily recent-note bounded candidate helper must stay explicit and reviewable.",
    ],
    [
      "const [openingNoteId, setOpeningNoteId]",
      "Daily existing-note opens must track an immediate opening state for click feedback.",
    ],
    [
      "setOpeningNoteId(note.id);",
      "Daily existing-note opens must mark the clicked note before deferred warmup work runs.",
    ],
    [
      "openingNoteId === note.id",
      "Daily note chips must render an immediate opening affordance while the peek modal loads.",
    ],
    [
      "正在打开纪要…",
      "Daily note chips must show a local opening label during peek modal load.",
    ],
    [
      "const handlePeekReady = useCallback",
      "Daily existing-note opening state must clear from the peek modal ready signal.",
    ],
    [
      "onReady={handlePeekReady}",
      "Daily page peek must wire its ready signal back to the opening-state UI.",
    ],
    [
      "queueCloudPagePush(record)",
      "Daily + creation must enqueue account-cloud upload instead of waiting on direct push.",
    ],
  ]) {
    assertSourceIncludes(files.dailyNotesShell, dailyNotesShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "onReady?: (pageId: string) => void",
      "PagePeekModal must expose a ready callback for local-first parent shells.",
    ],
    [
      "readyNotifiedPageIdRef",
      "PagePeekModal must de-duplicate ready notifications per page.",
    ],
    [
      "onReady?.(pageId)",
      "PagePeekModal must notify when the local page shell is ready.",
    ],
    [
      '"local-draft-ready"',
      "PagePeekModal metrics must distinguish local empty drafts from metadata-only pages.",
    ],
    [
      "const initialPeekPage = getInitialPeekPage(pageId, initialPage)",
      "PagePeekModal must seed title and properties from initial metadata before first paint.",
    ],
    [
      "readPendingPageDraft(pageId) ??",
      "PagePeekModal must reuse same-tab pending page drafts before waiting on IndexedDB metadata.",
    ],
    [
      "readPageRouteHandoff(pageId) ??",
      "PagePeekModal must reuse local-first route handoff metadata before waiting on IndexedDB metadata.",
    ],
    [
      "useState(() => initialPeekPage?.title ?? \"\")",
      "PagePeekModal title must not render blank when initial metadata is available.",
    ],
    [
      "applyPeekMetadataSnapshot",
      "PagePeekModal must keep fallback metadata, title, and properties in sync.",
    ],
    [
      "PEEK_METADATA_ONLY_CONTENT_DELAY_MS = 260",
      "PagePeekModal must briefly defer metadata-only body loading so the peek title/properties can paint first.",
    ],
    [
      "PEEK_METADATA_ONLY_CONTENT_IDLE_TIMEOUT_MS = 700",
      "PagePeekModal metadata-only body loading must stay bounded so content still arrives quickly.",
    ],
    [
      "PEEK_LARGE_BODY_HTML_CHARS = 180 * 1024",
      "PagePeekModal must define an explicit large-body threshold before deferring expensive editor parsing.",
    ],
    [
      "PEEK_LARGE_BODY_EDITOR_DELAY_MS = 260",
      "PagePeekModal must briefly delay editor mounting for large imported notes so title/properties paint first.",
    ],
    [
      "PEEK_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS = 1600",
      "PagePeekModal large-body editor fallback must stay bounded so long previews still become editable.",
    ],
    [
      "const isMetadataOnlyPeek =",
      "PagePeekModal must explicitly distinguish metadata-only previews from optimistic empty drafts.",
    ],
    [
      "const hasLargeBodyForPeek = isLargePeekBodyForEditor(",
      "PagePeekModal must distinguish ordinary previews from large HTML bodies before mounting the editor.",
    ],
    [
      "schedulePeekContentLoad(() => {\n        setEditorLoadRequested(true);\n      }, isMetadataOnlyPeek)",
      "PagePeekModal must use the metadata-only delay only when the preview has no body yet.",
    ],
    [
      "schedulePeekEditorMount(() => {\n        setMountedEditorPageId(pageId);\n      }, hasLargeBodyForPeek)",
      "PagePeekModal must defer editor mounting for large imported page bodies.",
    ],
    [
      "标题和属性已先显示，正在从本地缓存补齐正文",
      "PagePeekModal must communicate that metadata is already visible while body hydration continues.",
    ],
    [
      "标题和属性已先显示，正在排队补齐正文和编辑器",
      "PagePeekModal skeleton must keep a clear metadata-first loading state before editor hydration.",
    ],
    [
      "弹窗已先显示标题和属性，编辑器正在空闲时段准备",
      "PagePeekModal skeleton must explain long body editor preparation without blocking the visible shell.",
    ],
    [
      "large_body_editor_deferred",
      "PagePeekModal performance snapshots must mark long-body deferred editor opens.",
    ],
    [
      "isLargePeekBodyForEditor(content",
      "PagePeekModal must keep long-body detection centralized.",
    ],
    [
      'surface: "peek"',
      "PagePeekModal must tag its body hydration status as a peek surface.",
    ],
    [
      "subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus)",
      "PagePeekModal must subscribe to page-scoped body hydration status for shared feedback.",
    ],
    [
      "bodyHydrationLabel ??",
      "PagePeekModal must prefer shared body hydration labels when available.",
    ],
    [
      "dynamic<IconPickerProps>(",
      "PagePeekModal must lazy-load the icon picker so the peek shell can paint before the icon catalog loads.",
    ],
    [
      '() => import("@/components/shared/IconPicker")',
      "PagePeekModal icon picker must live in its own async chunk.",
    ],
    [
      "dynamic<PagePropertiesProps>(",
      "PagePeekModal must lazy-load the property editor so page metadata can paint before heavier controls load.",
    ],
    [
      '() => import("@/components/page/PageProperties")',
      "PagePeekModal property editor must live in its own async chunk.",
    ],
    [
      "PeekIconPickerSkeleton",
      "PagePeekModal must keep a stable lightweight icon placeholder while the picker chunk loads.",
    ],
    [
      "PeekPropertiesSkeleton",
      "PagePeekModal must keep a stable lightweight properties placeholder while the editor chunk loads.",
    ],
    [
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")',
      "PagePeekModal must load account-cloud queue helpers only when fallback persistence needs them.",
    ],
    [
      "void pushPeekCloudPage(nextPage).catch(() => undefined)",
      "PagePeekModal fallback cloud queueing must remain fire-and-forget so editing never waits on sync code.",
    ],
    [
      "{childPagesEnabled ? (",
      "PagePeekModal must mount child-page lookup only after the peek editor has already opened.",
    ],
  ]) {
    assertSourceIncludes(files.pagePeekModal, pagePeekModal, snippet, message);
  }
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "setPeekPageId(optimisticNote.id);",
    "Daily + creation must open the same-page peek editor immediately after optimistic local seeding."
  );
  assertSourceExcludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'openPage(optimisticNote, { source: "daily-create" })',
    "Daily + creation must not route to the full page before the peek editor appears."
  );
  assertSourceExcludes(
    files.dailyNotesShell,
    dailyNotesShell,
    'import("@/components/editor/Editor")',
    "Daily calendar must not preload the heavy editor bundle during first-paint metadata loading."
  );
  assertSourceIncludes(
    files.lazyPagePeekModal,
    lazyPagePeekModal,
    "function warmPagePeekEditor()",
    "Lazy peek warmup must prefetch the editor chunk before a + click opens a draft."
  );
  assertSourceIncludes(
    files.lazyPagePeekModal,
    lazyPagePeekModal,
    'import("@/components/editor/Editor")',
    "Lazy peek warmup must keep editor preloading inside the lazy wrapper, not the calendar shell."
  );
  assertSourceIncludes(
    files.lazyPagePeekModal,
    lazyPagePeekModal,
    "warmPagePeekEditor();",
    "warmPagePeekModal must also warm the editor chunk for immediate draft editing."
  );
  for (const [snippet, message] of [
    [
      "LocalFirstPeekLoadingShell",
      "Lazy peek modal fallback must render a local-first shell while the editor modal chunk loads.",
    ],
    [
      "readLocalFirstLoadingSeed",
      "Lazy peek modal fallback must seed itself from local page metadata before waiting on the full modal.",
    ],
    [
      "readPendingPageDraft(pageId)",
      "Lazy peek modal fallback must reuse optimistic drafts during cold chunk loads.",
    ],
    [
      "readPageRouteHandoff(pageId)",
      "Lazy peek modal fallback must reuse route handoff metadata during cold chunk loads.",
    ],
    [
      "已先显示本地页面信息",
      "Lazy peek modal fallback must visibly confirm local metadata is already shown.",
    ],
    [
      "onReady?.(pageId)",
      "Lazy peek modal fallback must clear parent opening state as soon as the local shell is visible.",
    ],
    [
      'status: seed ? "local-shell-ready" : "local-shell-loading"',
      "Lazy peek modal fallback must record local-shell readiness for fluency diagnosis.",
    ],
    [
      "新纪要已在本机创建，完整编辑器正在载入。",
      "Lazy peek modal fallback must reassure users that a new daily draft exists locally while the editor loads.",
    ],
    [
      "打开完整页面继续编辑 ↗",
      "Lazy peek modal fallback must provide a clear full-page escape hatch for slow editor chunk loads.",
    ],
  ]) {
    assertSourceIncludes(
      files.lazyPagePeekModal,
      lazyPagePeekModal,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "pageShellWarmupRef",
    "Daily calendar must warm the full-page shell once without repeatedly importing it."
  );
  assertSourceExcludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const warmPageRoute = useCallback(() => {\n    warmPagePeekModal();",
    "Daily calendar idle route warmup must not download the lazy peek modal chunk."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onPointerEnter={warmDailyPeekOpen}",
    "Daily calendar + controls must warm the lazy peek modal on pointer intent before opening."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const creatingDateKeyRef = useRef<string | null>(null)",
    "Daily + creation must use a synchronous ref lock for duplicate mouse-down/click paths."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const addNoteOnMouseDown = useCallback",
    "Daily + creation must begin on mouse-down for immediate visible feedback."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onMouseDown={(event) => addNoteOnMouseDown(event, todayKey)}",
    "The today + control must start draft creation on mouse-down."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onMouseDown={(event) => addNoteOnMouseDown(event, key)}",
    "Each calendar-cell + control must start draft creation on mouse-down."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onFocus={warmDailyPeekOpen}",
    "Daily calendar + controls must warm the lazy peek modal on keyboard focus before opening."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "const warmDailyNoteContent = useCallback",
    "Daily existing-note intent must warm local body content without cloud reads."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "onMouseEnter={() => warmDailyNoteContent(note)}",
    "Daily existing-note hover must warm local body content before the peek modal asks for it."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "setPeekInitialPage(toDailyNoteSeed(seededNote, note));",
    "Daily existing-note opens must seed the peek modal before showing it."
  );
  assertSourceIncludes(
    files.dailyNotesShell,
    dailyNotesShell,
    "data-testid={`daily-opening-note-${key}`}",
    "Daily calendar must show an immediate opening chip after + is clicked."
  );
  for (const [snippet, message] of [
    [
      "quickCreateMeetingForDate",
      "Meeting calendar + buttons must create and open a meeting page directly.",
    ],
    [
      "openCreatedMeetingPage",
      "Meeting manual create and invite import must share the same same-page peek opening path.",
    ],
    [
      "prepareMeetingPageOpen",
      "Meeting page opens must share a pre-navigation local cache handoff.",
    ],
    [
      "useLocalFirstPageNavigation",
      "Meeting full-page openings must use the shared local-first page navigation path.",
    ],
    [
      "setPeekInitialPage(page)",
      "Meeting creation must seed the optimistic page into the same-page peek modal.",
    ],
    [
      "setPeekPageId(page.id)",
      "Meeting creation must open the same-page peek editor after handing off the optimistic page.",
    ],
    [
      "<PagePeekModal",
      "Meeting schedule must render a same-page peek editor for newly created meetings.",
    ],
    [
      "initialPage={peekInitialPage}",
      "Meeting schedule must pass the optimistic page into the peek editor for immediate first paint.",
    ],
    [
      "openPage(page, { source })",
      "Meeting full-page note opens must route through local-first navigation.",
    ],
    [
      "prepareMeetingPageOpen(page, source)",
      "Existing meeting page opens must prepare the local draft before navigation.",
    ],
    [
      'prepareMeetingPageOpen(page, "meeting-create")',
      "Newly created meeting page opens must prepare the local draft before navigation.",
    ],
    [
      "const seededPage = getMeetingPageOpenSeed(page)",
      "Meeting full-page opens must prefer the fullest local seed before navigation.",
    ],
    [
      "rememberPendingPageDraft(seededPage)",
      "Meeting full-page opens must keep the best local draft for immediate first paint.",
    ],
    [
      "rememberPageRouteHandoff(seededPage, source)",
      "Meeting full-page opens must hand off the best local seed before slower local DB or cloud checks.",
    ],
    [
      "const warmMeetingPageContent = useCallback",
      "Meeting full-page opens must support local body warmup without cloud reads.",
    ],
    [
      "onMouseEnter={() => warmMeetingPageContent(entry.page)}",
      "Meeting hover intent must warm local body content before full-page opening.",
    ],
    [
      "const openMeetingDetail = useCallback",
      "Meeting detail opens must reuse the local body warmup path.",
    ],
    [
      'openMeetingFullPage(entry.page, "meeting-open")',
      "Meeting note list clicks must use local-first navigation instead of a legacy Link-only handoff.",
    ],
    [
      'openPage(pageId, { source: "meeting-open" })',
      "Meeting fallback page-id opens must still use local-first navigation when a metadata seed is available.",
    ],
    [
      "const entriesById = useMemo(() =>",
      "Meeting calendar must build a lightweight visible-month meeting id index for large imported workspaces.",
    ],
    [
      "entriesById.get(pageId)?.page",
      "Meeting full-page opening must use the visible-month meeting id index before checking the global workspace.",
    ],
    [
      "MEETING_UPCOMING_VISIBLE_LIMIT",
      "Meeting schedule must keep a visible cap for the upcoming-meeting list.",
    ],
    [
      "MEETING_NOTES_VISIBLE_LIMIT",
      "Meeting schedule must keep a visible cap for the completed meeting notes list.",
    ],
    [
      "return getUpcomingMeetingEntries(",
      "Meeting upcoming list must use bounded top-N selection instead of full-list sorting.",
    ],
    [
      "function getUpcomingMeetingEntries(",
      "Meeting upcoming bounded selection helper must stay explicit and reviewable.",
    ],
    [
      "getRecentCompletedMeetingEntries(",
      "Meeting notes list must use bounded top-N selection instead of full-list sorting.",
    ],
    [
      "function getRecentCompletedMeetingEntries(",
      "Meeting notes bounded selection helper must stay explicit and reviewable.",
    ],
    [
      "pageShellWarmupRef",
      "Meeting schedule must warm the full-page shell once instead of loading it only after a meeting opens.",
    ],
    [
      "warmMeetingPageRoute",
      "Meeting schedule must expose a reusable page-route warmup path for create, import, and open actions.",
    ],
    [
      'import("@/components/providers/PageShell")',
      "Meeting schedule must preload the page shell without importing the heavy editor bundle during first paint.",
    ],
    [
      "onPointerEnter={warmMeetingPeekOpen}",
      "Meeting schedule controls must warm the page shell and peek editor on pointer intent before navigation.",
    ],
    [
      "onPointerDown={warmMeetingPeekOpen}",
      "Meeting schedule creation/import controls must warm the page shell and peek editor even on fast clicks.",
    ],
    [
      "onFocus={warmMeetingPeekOpen}",
      "Meeting schedule controls must warm the page shell and peek editor for keyboard users before navigation.",
    ],
    [
      "const primeMeetingEntryPage = useCallback",
      "Meeting schedule must reuse a single meeting-entry open warmup helper.",
    ],
    [
      "primeMeetingEntryPage(entry.page)",
      "Meeting entry buttons must prime the selected page body and peek editor before opening details.",
    ],
    [
      "onPrimeOpen={() => primeMeetingEntryPage(selectedMeeting.page)}",
      "Meeting detail window must prime the selected page before opening the full page.",
    ],
    [
      "openCreatedMeetingPage(result.page)",
      "Meeting invite imports must pop the newly created page immediately after the optimistic local create.",
    ],
    [
      "): CreateMeetingResult =>",
      "Meeting creation must return the optimistic page synchronously so navigation is not blocked by background persistence.",
    ],
    [
      "const result = createMeetingPage(form",
      "Manual meeting creation must open from a synchronous optimistic result.",
    ],
    [
      "const result = createMeetingPage(draft",
      "Invite import must open from a synchronous optimistic result after parsing completes.",
    ],
    [
      "会议页面已弹出；",
      "Meeting invite import success must tell the owner that the created page has popped open.",
    ],
    [
      "rememberPageRouteHandoff(optimisticPage, \"meeting-create\")",
      "Meeting creation must hand off the optimistic page before full navigation.",
    ],
    [
      "rememberPendingPageDraft(optimisticPage)",
      "Meeting creation must keep an in-memory draft for immediate page opening.",
    ],
    [
      "scheduleMeetingIdleTask(() => {\n        void seedMeetingPageForImmediateOpen(optimisticPage);",
      "Meeting creation must defer local cache persistence until after the page is already opening.",
    ],
    [
      "scheduleMeetingIdleTask(() => {\n        void (async () => {",
      "Meeting creation must defer root resolution, cloud queue persistence, and recording enqueue behind the immediate navigation path.",
    ],
    [
      "persistOptimisticMeetingPage",
      "Meeting creation must persist the optimistic page through local cache and cloud push.",
    ],
    [
      "return queueMeetingCloudRecords(records)",
      "Meeting creation must enqueue both the module root and meeting page through the shared cloud upload queue.",
    ],
    [
      "function queueMeetingCloudRecords",
      "Meeting creation must keep a dedicated queue helper for root + meeting page records.",
    ],
    [
      "queueCloudPagePush(record)",
      "Meeting creation must use the pending queue instead of waiting on a direct cloud push.",
    ],
    [
      "data-testid={`meeting-add-${key}`}",
      "Meeting calendar + buttons must expose stable test targets.",
    ],
    [
      "disabled={intakeLoading || !intakeText.trim()}",
      "Meeting import button must be available as soon as text is present; root id resolution happens in the create path.",
    ],
    [
      "revealMeetingOnCalendar(optimisticPage)",
      "Meeting import/create must reveal the optimistic meeting in the calendar immediately.",
    ],
    [
      "pendingCalendarFocusDateKeyRef",
      "Meeting import/create must keep a pending focus target until the date cell is mounted.",
    ],
    [
      "requestAnimationFrame",
      "Meeting calendar reveal must scroll after the rendered cell is ready instead of racing a fixed timeout.",
    ],
    [
      "MEETING_CALENDAR_REVEAL_BUFFER",
      "Meeting calendar must expand a crowded date enough to show a newly imported meeting.",
    ],
  ]) {
    assertSourceIncludes(
      files.meetingScheduleShell,
      meetingScheduleShell,
      snippet,
      message
    );
  }
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    'openPage(page, { source: "meeting-create" })',
    "Meeting creation must not route directly to the full page before the same-page peek editor appears."
  );
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "const result = await pushCloudPages(records)",
    "Meeting creation persistence must not wait on a direct pushCloudPages call."
  );
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "primeMeetingPageOpen",
    "Meeting schedule must not keep the old meeting page prime helper after moving note links to local-first navigation."
  );
  for (const [snippet, message] of [
    [
      "buildHotCacheWarmupReceipt",
      "Sync UI must build a hot cache warmup receipt.",
    ],
    [
      "HotCacheWarmupReceiptPanel",
      "Sync UI must render the hot cache warmup receipt panel.",
    ],
    [
      "最近一次预热收据",
      "Sync UI must expose the latest hot cache warmup receipt.",
    ],
    [
      "handleExportHotCacheWarmupReceipt",
      "Sync UI must export the hot cache warmup receipt.",
    ],
    [
      "导出预热收据",
      "Sync UI must render the hot cache warmup receipt export button.",
    ],
    [
      "writeHotCacheWarmupReceiptToLocalIndex",
      "Sync UI must persist warmup receipts to the local metadata index.",
    ],
    [
      "getHotCacheLocalIndexSummary",
      "Sync UI must read the local hot cache index summary.",
    ],
    [
      "本地热缓存索引",
      "Sync UI must render the local hot cache index summary panel.",
    ],
    [
      "不进 sync_log",
      "Sync UI must tell the user that this index stays out of sync_log.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-comment-version-cloud-replay-contract"',
      "Comment/version replay contract must expose a stable format.",
    ],
    [
      'contract_status: "owner-gated-content-sync-contract"',
      "Comment/version replay contract must remain owner gated.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Comment/version replay must only consider ordinary pending sync rows.",
    ],
    [
      "sync_log_contains_row_ids_only: true",
      "Comment/version replay contract must keep sync_log previews row-id-only.",
    ],
    [
      "content_payload_loaded_only_after_owner_confirmation: true",
      "Comment/version content payloads must only load after owner confirmation.",
    ],
    [
      "metadata_reports_must_exclude_content: true",
      "Comment/version metadata reports must exclude content values.",
    ],
    [
      "reads_comment_bodies: false",
      "Comment/version replay contract must not read comment bodies.",
    ],
    [
      "reads_version_snapshots: false",
      "Comment/version replay contract must not read version snapshots.",
    ],
    [
      "reads_page_body_text: false",
      "Comment/version replay contract must not read page body text.",
    ],
    [
      "cloud.comments",
      "Comment replay must target the future cloud.comments table.",
    ],
    [
      "cloud.page_versions",
      "Version replay must target the future cloud.page_versions table.",
    ],
    [
      "page_versions now uses deleted_at as a soft tombstone",
      "Version replay must rely on the page_versions deleted_at tombstone.",
    ],
  ]) {
    assertSourceIncludes(
      files.commentVersionCloudReplayContract,
      commentVersionCloudReplayContract,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "uploads_workspace_data: true",
      "Comment/version replay contract must not upload workspace data directly.",
    ],
    [
      "reads_comment_bodies: true",
      "Comment/version replay contract must not read comment bodies.",
    ],
    [
      "reads_version_snapshots: true",
      "Comment/version replay contract must not read version snapshots.",
    ],
  ]) {
    assertSourceExcludes(
      files.commentVersionCloudReplayContract,
      commentVersionCloudReplayContract,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildCommentVersionCloudReplayContract",
      "Sync UI must build the comment/version cloud replay contract.",
    ],
    [
      "commentVersionCloudReplayContract",
      "Sync UI must memoize the comment/version cloud replay contract.",
    ],
    [
      "评论 / 版本上云回放合同",
      "Sync UI must expose the comment/version cloud replay panel.",
    ],
    [
      "owner-gated content sync",
      "Sync UI must show the owner-gated content-sync boundary.",
    ],
    [
      "pending-only",
      "Sync UI must show that ordinary sync stays pending-only.",
    ],
    [
      "不读取评论正文、版本快照或页面正文",
      "Sync UI must show the no-content-read boundary.",
    ],
    [
      "page_versions deleted_at tombstone",
      "Sync UI must show the page_versions deleted_at tombstone.",
    ],
    [
      "cloud.comments",
      "Sync UI must show the future comments cloud target.",
    ],
    [
      "cloud.page_versions",
      "Sync UI must show the future page_versions cloud target.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "disabled={intakeLoading || !rootId || !intakeText.trim()}",
    "Meeting import button must not wait for the module root id before accepting pasted invite text."
  );
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    'rootId ? "导入" : "加载中..."',
    "Meeting import button must not show loading only because the module root id has not hydrated yet."
  );
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.localSchema,
      localSchema,
      "CREATE TABLE IF NOT EXISTS page_versions",
      "Local schema must define page_versions.",
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
      '"page_versions",',
      "Version tombstone changes must target page_versions in sync_log.",
    ],
    [
      files.localQueries,
      localQueries,
      '["deleted_at"],',
      "Version tombstone changes must queue the deleted_at field.",
    ],
    [
      files.localQueries,
      localQueries,
      "FROM page_versions WHERE page_id = ? AND deleted_at IS NULL",
      "Version reads must ignore soft-deleted records.",
    ],
  ]) {
    assertSourceIncludes(sourceLabel, source, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-comment-version-replay-receipt-draft"',
      "Comment/version replay receipt draft must expose a stable format.",
    ],
    [
      '"blocked-until-cloud-manifest-counts"',
      "Comment/version replay receipt must keep ack blocked until cloud counts exist.",
    ],
    [
      '"no-local-pending"',
      "Comment/version replay receipt must distinguish empty local pending state.",
    ],
    [
      "local_draft_only: true",
      "Comment/version replay receipt must remain local draft only.",
    ],
    [
      "reads_comment_bodies: false",
      "Comment/version replay receipt must not read comment bodies.",
    ],
    [
      "reads_version_snapshots: false",
      "Comment/version replay receipt must not read version snapshots.",
    ],
    [
      "reads_page_body_text: false",
      "Comment/version replay receipt must not read page body text.",
    ],
    [
      "reads_cloud_manifest: false",
      "Comment/version replay receipt must not read cloud manifests locally.",
    ],
    [
      "uploads_workspace_data: false",
      "Comment/version replay receipt must not upload workspace data.",
    ],
    [
      "mutates_local_sync_log: false",
      "Comment/version replay receipt must not mutate local sync_log.",
    ],
    [
      "can_acknowledge_without_cloud_counts: false",
      "Comment/version replay receipt must not allow ack without cloud counts.",
    ],
    [
      "can_mark_local_rows_synced: false",
      "Comment/version replay receipt must not mark local rows synced.",
    ],
    [
      "cloud_manifest_count: null",
      "Comment/version replay receipt must keep cloud count empty until a real cloud manifest exists.",
    ],
    [
      "cloud_manifest_watermark: null",
      "Comment/version replay receipt must keep cloud watermark empty until a real cloud manifest exists.",
    ],
    [
      "can_acknowledge_rows: false",
      "Comment/version replay receipt must block per-surface acknowledgement.",
    ],
    [
      'schema_status: "planned-count-and-ack-receipt-only"',
      "Comment/version replay receipt must keep response schema count-only.",
    ],
    [
      "cloud.comments manifest count",
      "Comment/version replay receipt must require cloud.comments count evidence.",
    ],
    [
      "cloud.page_versions manifest count",
      "Comment/version replay receipt must require cloud.page_versions count evidence.",
    ],
    [
      "local_rows_remain_pending: true",
      "Comment/version replay receipt must keep local rows pending.",
    ],
    [
      "can_acknowledge_any_rows_now: false",
      "Comment/version replay receipt must block all acknowledgement today.",
    ],
  ]) {
    assertSourceIncludes(
      files.commentVersionReplayReceipt,
      commentVersionReplayReceipt,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-comment-version-replay-ack-gate"',
      "Comment/version replay ack gate must expose a stable format.",
    ],
    [
      '"blocked-until-durable-remote-receipt"',
      "Comment/version replay ack gate must block until a durable remote receipt exists.",
    ],
    [
      "local_gate_only: true",
      "Comment/version replay ack gate must remain local gate only.",
    ],
    [
      "reads_comment_bodies: false",
      "Comment/version replay ack gate must not read comment bodies.",
    ],
    [
      "reads_version_snapshots: false",
      "Comment/version replay ack gate must not read version snapshots.",
    ],
    [
      "reads_page_body_text: false",
      "Comment/version replay ack gate must not read page text.",
    ],
    [
      "reads_sync_log_payloads: false",
      "Comment/version replay ack gate must not read sync_log payloads.",
    ],
    [
      "reads_cloud_manifest: false",
      "Comment/version replay ack gate must not read cloud manifests.",
    ],
    [
      "connects_cloud_services: false",
      "Comment/version replay ack gate must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Comment/version replay ack gate must not upload workspace data.",
    ],
    [
      "mutates_local_sync_log: false",
      "Comment/version replay ack gate must not mutate sync_log.",
    ],
    [
      "can_mark_local_rows_synced_now: false",
      "Comment/version replay ack gate must not allow marking rows synced.",
    ],
    [
      "can_update_sync_log_now: false",
      "Comment/version replay ack gate must block sync_log updates.",
    ],
    [
      'allowed_update_scope: "none"',
      "Comment/version replay ack gate must forbid update scope while blocked.",
    ],
    [
      "durable replay receipt id from /api/sync/comment-version-replay",
      "Comment/version replay ack gate must require a durable server receipt.",
    ],
    [
      "cloud.comments manifest count equals accepted comment rows",
      "Comment/version replay ack gate must require comment manifest counts.",
    ],
    [
      "cloud.page_versions manifest count equals accepted version rows",
      "Comment/version replay ack gate must require version manifest counts.",
    ],
    [
      "idempotency proof that retry attempts did not duplicate rows",
      "Comment/version replay ack gate must require idempotency proof.",
    ],
    [
      "clear pending rows after a disabled API response",
      "Comment/version replay ack gate must forbid clearing pending rows after disabled responses.",
    ],
  ]) {
    assertSourceIncludes(
      files.commentVersionReplayAckGate,
      commentVersionReplayAckGate,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildCommentVersionReplayReceiptDraft",
      "Sync UI must build the comment/version replay receipt draft.",
    ],
    [
      "commentVersionReplayReceiptDraft",
      "Sync UI must memoize the comment/version replay receipt draft.",
    ],
    [
      "handleExportCommentVersionReplayReceipt",
      "Sync UI must export the comment/version replay receipt draft.",
    ],
    [
      "评论 / 版本回放 manifest count 与 ack 收据草案",
      "Sync UI must render the manifest count and ack receipt panel.",
    ],
    [
      "导出回放收据草案",
      "Sync UI must expose the replay receipt draft export button.",
    ],
    [
      "cloud_manifest_count: null",
      "Sync UI must show missing cloud manifest counts.",
    ],
    [
      "不能 acknowledge rows",
      "Sync UI must explain ack is blocked.",
    ],
    [
      "不能标记 synced",
      "Sync UI must explain local rows cannot be marked synced.",
    ],
    [
      "buildCommentVersionReplayAckGate",
      "Sync UI must build the comment/version replay ack gate.",
    ],
    [
      "commentVersionReplayAckGate",
      "Sync UI must memoize the comment/version replay ack gate.",
    ],
    [
      "ack gate closed：缺少 durable remote receipt",
      "Sync UI must render the replay ack gate status.",
    ],
    [
      "missing remote evidence",
      "Sync UI must render missing remote evidence.",
    ],
    [
      "不能把任何本地 pending sync_log 行改成 synced",
      "Sync UI must explain the ack gate blocks local sync_log updates.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "CREATE TABLE IF NOT EXISTS hot_cache_entries",
      "Local schema must include a rebuildable local hot cache metadata index table.",
    ],
    [
      "idx_hot_cache_entries_route",
      "Local schema must index route targets for local hot cache lookup.",
    ],
    [
      "CREATE TABLE IF NOT EXISTS workspace_settings",
      "Local schema must include a rebuildable settings cache table.",
    ],
    [
      "value_json",
      "Local workspace settings must store JSON preference payloads.",
    ],
    [
      "idx_workspace_settings_updated",
      "Local workspace settings must have an updated_at index.",
    ],
  ]) {
    assertSourceIncludes(files.localSchema, localSchema, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "WorkspaceSettingRecord",
      "Local queries must expose workspace setting records.",
    ],
    [
      "getWorkspaceSetting",
      "Local queries must read one workspace setting.",
    ],
    [
      "upsertWorkspaceSetting",
      "Local queries must save one workspace setting.",
    ],
    [
      '"workspace_settings"',
      "Workspace setting changes must target the workspace_settings table.",
    ],
    [
      "recordSyncChange(",
      "Workspace setting saves must enter sync_log.",
    ],
    [
      '["value_json", "source", "updated_at"]',
      "Workspace setting updates must queue only setting metadata columns.",
    ],
    [
      "markWorkspaceSettingSyncLogEntriesSynced",
      "Workspace settings must support local pending acknowledgement after cloud receipt.",
    ],
    [
      "getPendingWorkspaceSettingSyncLogEntries",
      "Workspace settings must expose all pending rows before cloud-to-local rebuilds.",
    ],
    [
      "applyRemoteWorkspaceSettings",
      "Workspace settings must support rebuilding local cache rows from cloud metadata.",
    ],
    [
      "Cannot restore cloud workspace settings while local workspace setting changes are still pending.",
      "Workspace settings cloud restore must refuse to overwrite unsynced local settings.",
    ],
    [
      "WHERE table_name = 'workspace_settings'",
      "Workspace settings acknowledgement must stay scoped to workspace_settings rows.",
    ],
  ]) {
    assertSourceIncludes(files.localQueries, localQueries, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "SIDEBAR_PRIMARY_ORDER_SETTING_KEY",
      "Sidebar primary order must use a stable workspace setting key.",
    ],
    [
      "SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY",
      "Sidebar primary customizations must use a stable workspace setting key.",
    ],
    [
      "getWorkspaceSetting(SIDEBAR_PRIMARY_ORDER_SETTING_KEY)",
      "Sidebar must hydrate primary order from workspace_settings.",
    ],
    [
      "getWorkspaceSetting(SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY)",
      "Sidebar must hydrate primary customizations from workspace_settings.",
    ],
    [
      "upsertWorkspaceSetting(",
      "Sidebar preference saves must enter workspace_settings and sync_log.",
    ],
    [
      "workspaces.settings.sidebar_primary_order",
      "Sidebar primary order must target cloud workspace settings.",
    ],
    [
      "workspaces.settings.sidebar_primary_customization",
      "Sidebar primary customizations must target cloud workspace settings.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Sidebar preferences must stay pending-only instead of uploading local cache.",
    ],
    [
      "localStorage is only a fast boot cache and migration source",
      "Sidebar localStorage usage must remain a cache/migration path, not the source of truth.",
    ],
  ]) {
    assertSourceIncludes(files.sidebar, sidebar, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-sidebar-settings-cloud-receipt"',
      "Sidebar settings cloud receipt must have a stable format.",
    ],
    [
      "workspaces.settings.sidebar_primary_order",
      "Sidebar primary order must target cloud workspace settings.",
    ],
    [
      "workspaces.settings.sidebar_primary_customization",
      "Sidebar primary customizations must target cloud workspace settings.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Sidebar settings cloud receipt must preserve pending-only sync.",
    ],
    [
      "uploads_workspace_content: false",
      "Sidebar settings cloud receipt must not upload workspace content.",
    ],
  ]) {
    assertSourceIncludes(
      files.sidebarWorkspaceSettings,
      sidebarWorkspaceSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "validateSidebarWorkspaceSettingsCloudPayload",
      "Workspace settings API must accept sidebar setting payloads.",
    ],
    [
      "buildSidebarWorkspaceSettingsCloudValue",
      "Workspace settings API must write sidebar setting cloud values.",
    ],
    [
      "sidebar_settings",
      "Workspace settings API reads must return sidebar settings metadata.",
    ],
    [
      "supported_setting_keys",
      "Workspace settings API reads must disclose supported setting keys.",
    ],
  ]) {
    assertSourceIncludes(
      files.workspaceSettingsRoute,
      workspaceSettingsRoute,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-hot-cache-selection-contract"',
      "Hot cache selection contract must expose a stable export format.",
    ],
    [
      'contract_status: "local-settings-pending-contract"',
      "Hot cache selection must be a local settings pending contract.",
    ],
    [
      "HOT_CACHE_PREFERENCES_SETTING_KEY",
      "Hot cache selection must use a stable setting key.",
    ],
    [
      "workspaces.settings.hot_cache_preferences",
      "Hot cache selection must target cloud workspace settings.",
    ],
    [
      "workspace_settings.value_json",
      "Hot cache selection must target local workspace settings.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Hot cache selection must use pending-only sync.",
    ],
    [
      "saves_user_setting_locally: true",
      "Hot cache selection must save preferences locally first.",
    ],
    [
      "queues_pending_setting_change: true",
      "Hot cache selection must queue settings for upload.",
    ],
    [
      "mutates_cache_records: false",
      "Hot cache selection contract must not evict cache records.",
    ],
    [
      "uploads_workspace_data: false",
      "Hot cache selection contract must not upload workspace data.",
    ],
    [
      "keepCurrentMonthDailyNotes",
      "Hot cache selection must include daily note preference.",
    ],
    [
      "keepCurrentMonthMeetings",
      "Hot cache selection must include current-month meeting preference.",
    ],
    [
      "keepActiveDatabases",
      "Hot cache selection must include database preference.",
    ],
    [
      "pinnedDatabaseIds",
      "Hot cache selection must include pinned database preference.",
    ],
    [
      "keepFavoritePages",
      "Hot cache selection must include favorite pages preference.",
    ],
    [
      "metadataRecentLimitForHotCachePreferences",
      "Hot cache selection must expose a bounded recent metadata limit helper.",
    ],
    [
      "notifyHotCachePreferencesChanged",
      "Hot cache selection must expose a local preference change notifier.",
    ],
    [
      "preferences.recentDays === 90 ? 72 : 24",
      "Hot cache preference helper must keep recent metadata windows bounded.",
    ],
  ]) {
    assertSourceIncludes(
      files.hotCacheSelectionSettings,
      hotCacheSelectionSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Hot cache selection contract must not access page content text.",
    ],
    [
      "page.content_yjs",
      "Hot cache selection contract must not access page Yjs content.",
    ],
    [
      "database.description",
      "Hot cache selection contract must not access database descriptions.",
    ],
    [
      "file.dataUrl",
      "Hot cache selection contract must not access file bytes.",
    ],
    [
      "file.textContent",
      "Hot cache selection contract must not access extracted file text.",
    ],
    [
      "comment.body",
      "Hot cache selection contract must not access comment bodies.",
    ],
    [
      "field_values",
      "Hot cache selection contract must not access database row values.",
    ],
    [
      "fetch(",
      "Hot cache selection contract must not call network APIs.",
    ],
  ]) {
    assertSourceExcludes(
      files.hotCacheSelectionSettings,
      hotCacheSelectionSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-hot-cache-settings-cloud-receipt"',
      "Hot cache cloud settings must expose a stable receipt format.",
    ],
    [
      'format: "zhinote-hot-cache-settings-cloud-read-receipt"',
      "Hot cache cloud settings must expose a stable read receipt format.",
    ],
    [
      "HOT_CACHE_SETTINGS_FORBIDDEN_FIELDS",
      "Hot cache cloud settings must keep a forbidden payload field list.",
    ],
    [
      "validateHotCacheSettingsCloudPayload",
      "Hot cache cloud settings must validate request payloads.",
    ],
    [
      "buildHotCacheSettingsCloudReceipt",
      "Hot cache cloud settings must build a metadata-only receipt.",
    ],
    [
      "parseHotCacheSettingsCloudValue",
      "Hot cache cloud settings must parse cloud settings for cache rebuild.",
    ],
    [
      "buildHotCacheSettingsCloudReadReceipt",
      "Hot cache cloud settings must build a metadata-only read receipt.",
    ],
    [
      "workspaces.settings.hot_cache_preferences",
      "Hot cache cloud settings must write only the workspace settings target.",
    ],
    [
      "uploads_workspace_content: false",
      "Hot cache cloud settings receipt must state workspace content is not uploaded.",
    ],
    [
      "content_text",
      "Hot cache cloud settings validator must reject page text fields.",
    ],
    [
      "file_bytes",
      "Hot cache cloud settings validator must reject file byte fields.",
    ],
    [
      "local_unsynced_setting_must_block_pull: true",
      "Hot cache cloud settings read receipt must protect local unsynced settings.",
    ],
  ]) {
    assertSourceIncludes(
      files.hotCacheSettingsCloud,
      hotCacheSettingsCloud,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-workspace-settings-pending-sync-plan"',
      "Workspace settings pending sync must expose a stable plan format.",
    ],
    [
      'format: "zhinote-workspace-settings-cloud-restore-plan"',
      "Workspace settings cloud restore must expose a stable restore plan.",
    ],
    [
      'architecture_target: "cloud-master-local-cache-rebuild"',
      "Workspace settings cloud restore must rebuild local cache from the cloud master.",
    ],
    [
      "local_pending_must_be_empty: true",
      "Workspace settings cloud restore must require local pending rows to be empty.",
    ],
    [
      "writes_sync_log: false",
      "Workspace settings cloud restore must not create echo-loop sync_log rows.",
    ],
    [
      "SUPPORTED_WORKSPACE_SETTING_SYNC_KEYS",
      "Workspace settings pending sync must use an explicit upload allowlist.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Workspace settings pending sync must only upload pending changes.",
    ],
    [
      'pending_queue_table: "sync_log"',
      "Workspace settings pending sync must be driven by sync_log.",
    ],
    [
      'local_table: "workspace_settings"',
      "Workspace settings pending sync must read workspace_settings as local metadata.",
    ],
    [
      "buildWorkspaceSettingCloudPayload",
      "Workspace settings pending sync must build explicit cloud payloads.",
    ],
    [
      "SIDEBAR_PRIMARY_ORDER_SETTING_KEY",
      "Workspace settings pending sync must include sidebar order settings.",
    ],
    [
      "SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY",
      "Workspace settings pending sync must include sidebar customization settings.",
    ],
    [
      "HOT_CACHE_PREFERENCES_SETTING_KEY",
      "Workspace settings pending sync must include hot cache preferences.",
    ],
    [
      "PAGE_FAVORITES_SETTING_KEY",
      "Workspace settings pending sync must include page favorite settings.",
    ],
    [
      "favorite_page_ids",
      "Workspace settings pending sync must upload only favorite page ids for page favorites.",
    ],
    [
      "PAGE_VIEW_PREFERENCES_SETTING_KEY",
      "Workspace settings pending sync must include page view preferences.",
    ],
    [
      "locked_page_ids",
      "Workspace settings pending sync must upload only locked page ids for page view preferences.",
    ],
    [
      "child_tree_view_modes",
      "Workspace settings pending sync must upload only child-tree view mode metadata for page view preferences.",
    ],
    [
      "QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY",
      "Workspace settings pending sync must include quick search saved-search settings.",
    ],
    [
      "saved_searches",
      "Workspace settings pending sync must upload only saved-search metadata for quick search.",
    ],
    [
      "CALENDAR_VIEW_STATE_SETTING_KEY",
      "Workspace settings pending sync must include calendar view state settings.",
    ],
    [
      "daily_view_month",
      "Workspace settings pending sync must upload only daily view month metadata for calendar view state.",
    ],
    [
      "meeting_view_month",
      "Workspace settings pending sync must upload only meeting view month metadata for calendar view state.",
    ],
    [
      "MEETING_REVIEW_STATE_SETTING_KEY",
      "Workspace settings pending sync must include meeting review state settings.",
    ],
    [
      "seen_meeting_page_ids",
      "Workspace settings pending sync must upload only seen meeting page ids for meeting review state.",
    ],
    [
      "dismissed_trace_page_ids",
      "Workspace settings pending sync must upload only dismissed trace page ids for meeting review state.",
    ],
    [
      "MEETING_DELETION_TOMBSTONES_SETTING_KEY",
      "Workspace settings pending sync must include meeting deletion tombstone settings.",
    ],
    [
      "deleted_meeting_page_ids",
      "Workspace settings pending sync must upload only deleted meeting page ids for meeting deletion tombstones.",
    ],
    [
      "Page bodies, database row values, comments, files, tokens, and raw local cache dumps are never included",
      "Workspace settings pending sync must state the privacy boundary.",
    ],
  ]) {
    assertSourceIncludes(
      files.workspaceSettingsPendingSync,
      workspaceSettingsPendingSync,
      snippet,
      message
    );
  }
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.localSchema,
      localSchema,
      "CREATE TABLE IF NOT EXISTS account_settings",
      "Local schema must include account_settings for account-level cloud-master preferences.",
    ],
    [
      files.localSchema,
      localSchema,
      "CREATE TABLE IF NOT EXISTS module_settings",
      "Local schema must include module_settings for module-level cloud-master config.",
    ],
    [
      files.localQueries,
      localQueries,
      "buildModuleSettingSyncRowId",
      "Local queries must define stable module setting sync row ids.",
    ],
    [
      files.localQueries,
      localQueries,
      "upsertAccountSetting",
      "Local queries must write account settings through sync_log.",
    ],
    [
      files.localQueries,
      localQueries,
      "upsertModuleSetting",
      "Local queries must write module settings through sync_log.",
    ],
    [
      files.localQueries,
      localQueries,
      "applyRemoteAccountModuleSettings",
      "Local queries must support rebuilding account/module settings from cloud metadata.",
    ],
    [
      files.localQueries,
      localQueries,
      "Cannot restore cloud account/module settings while local account/module setting changes are still pending.",
      "Local account/module restore must refuse to overwrite unsynced local setting edits.",
    ],
    [
      files.localQueries,
      localQueries,
      "getPendingAccountModuleSettingSyncLogEntries",
      "Local queries must expose account/module pending rows before cloud restore.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'format: "zhinote-account-module-settings-pending-sync-plan"',
      "Account/module settings pending sync must expose a stable plan format.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "SUPPORTED_ACCOUNT_SETTING_SYNC_KEYS",
      "Account settings pending sync must use an explicit upload allowlist.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "SUPPORTED_MODULE_SETTING_SYNC_KEYS",
      "Module settings pending sync must use an explicit upload allowlist.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "ordinary_sync_pending_only: true",
      "Account/module settings pending sync must only upload pending changes.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "uploads_workspace_cache_dump: false",
      "Account/module settings pending sync must forbid local cache dump uploads.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "ACCOUNT_MODULE_SETTINGS_FORBIDDEN_FIELDS",
      "Account/module settings cloud payloads must reject forbidden private fields.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'format: "zhinote-account-module-settings-cloud-receipt"',
      "Account/module settings cloud writes must produce a stable receipt.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'format: "zhinote-account-module-settings-cloud-read-summary"',
      "Account/module settings cloud reads must expose a stable metadata summary.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'format: "zhinote-account-module-settings-cloud-restore-plan"',
      "Account/module settings cloud restore must expose a stable restore plan.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      'architecture_target: "cloud-master-local-cache-rebuild"',
      "Account/module settings cloud restore must rebuild local cache from the cloud master.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "local_pending_must_be_empty: true",
      "Account/module settings cloud restore must require local pending rows to be empty.",
    ],
    [
      files.accountModuleSettingsPendingSync,
      accountModuleSettingsPendingSync,
      "writes_sync_log: false",
      "Account/module settings cloud restore must not create echo-loop sync_log rows.",
    ],
    [
      files.syncShell,
      syncShell,
      "AccountModuleSettingsPendingPanel",
      "Sync UI must render the account/module settings pending plan panel.",
    ],
    [
      files.syncShell,
      syncShell,
      "账号和模块设置云主库边界",
      "Sync UI must name the account/module settings cloud-master boundary.",
    ],
  ]) {
    assertSourceIncludes(sourceLabel, source, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-page-favorites-settings-cloud-receipt"',
      "Page favorites settings must expose a stable cloud receipt.",
    ],
    [
      "PAGE_FAVORITES_SETTING_KEY",
      "Page favorites settings must use a stable workspace setting key.",
    ],
    [
      "workspaces.settings.page_favorites",
      "Page favorites settings must target workspace cloud settings.",
    ],
    [
      "validatePageFavoritesWorkspaceSettingsCloudPayload",
      "Page favorites settings must validate cloud payloads.",
    ],
    [
      "favorite_page_ids",
      "Page favorites settings must persist only page ids.",
    ],
    [
      "reads_page_body_text: false",
      "Page favorites receipt must state it does not read page bodies.",
    ],
    [
      "reads_page_titles: false",
      "Page favorites receipt must state it does not read page titles.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Page favorites settings must use pending-only ordinary sync.",
    ],
    [
      "content_text",
      "Page favorites validator must reject page body fields.",
    ],
    [
      "page_title",
      "Page favorites validator must reject page title fields.",
    ],
  ]) {
    assertSourceIncludes(
      files.pageFavoritesWorkspaceSettings,
      pageFavoritesWorkspaceSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "PAGE_FAVORITES_SETTING_KEY",
      "Page favorites hook must use the cloud-ready workspace setting key.",
    ],
    [
      "getWorkspaceSetting(PAGE_FAVORITES_SETTING_KEY)",
      "Page favorites hook must hydrate from workspace_settings.",
    ],
    [
      "upsertWorkspaceSetting(",
      "Page favorites hook must persist changes through workspace_settings and sync_log.",
    ],
    [
      "localStorage is a fast cache only",
      "Page favorites hook must keep localStorage as a fast cache only.",
    ],
    [
      "legacy-page-favorites-localStorage",
      "Page favorites hook must migrate legacy localStorage values into workspace_settings.",
    ],
  ]) {
    assertSourceIncludes(files.usePageFavorites, usePageFavorites, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-page-view-preferences-settings-cloud-receipt"',
      "Page view preferences must expose a stable cloud receipt.",
    ],
    [
      "PAGE_VIEW_PREFERENCES_SETTING_KEY",
      "Page view preferences must use a stable workspace setting key.",
    ],
    [
      "workspaces.settings.page_view_preferences",
      "Page view preferences must target workspace cloud settings.",
    ],
    [
      "validatePageViewPreferencesWorkspaceSettingsCloudPayload",
      "Page view preferences must validate cloud payloads.",
    ],
    [
      "locked_page_ids",
      "Page view preferences must persist only locked page ids.",
    ],
    [
      "child_tree_view_modes",
      "Page view preferences must persist only child-tree view mode metadata.",
    ],
    [
      "child_tree_view_mode_count",
      "Page view preferences receipt must summarize child-tree view modes without page content.",
    ],
    [
      "reads_page_body_text: false",
      "Page view preferences receipt must state it does not read page bodies.",
    ],
    [
      "reads_page_titles: false",
      "Page view preferences receipt must state it does not read page titles.",
    ],
    [
      "reads_comment_bodies: false",
      "Page view preferences receipt must state it does not read comment bodies.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Page view preferences must use pending-only ordinary sync.",
    ],
    [
      "content_text",
      "Page view preferences validator must reject page body fields.",
    ],
    [
      "comment_body",
      "Page view preferences validator must reject comment body fields.",
    ],
  ]) {
    assertSourceIncludes(
      files.pageViewPreferencesWorkspaceSettings,
      pageViewPreferencesWorkspaceSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "PAGE_VIEW_PREFERENCES_SETTING_KEY",
      "Page view preferences hook must use the cloud-ready workspace setting key.",
    ],
    [
      "getWorkspaceSetting(PAGE_VIEW_PREFERENCES_SETTING_KEY)",
      "Page view preferences hook must hydrate from workspace_settings.",
    ],
    [
      "upsertWorkspaceSetting(",
      "Page view preferences hook must persist changes through workspace_settings and sync_log.",
    ],
    [
      "localStorage is only a fast boot cache and migration source",
      "Page view preferences hook must keep localStorage as cache/migration only.",
    ],
    [
      "legacy-page-view-localStorage",
      "Page view preferences hook must migrate legacy localStorage values into workspace_settings.",
    ],
    [
      "childTreeViewModeLocalStorageKey",
      "Page view preferences hook must migrate legacy child-tree localStorage modes.",
    ],
    [
      "setChildTreeViewMode",
      "Page view preferences hook must expose child-tree view mode persistence.",
    ],
  ]) {
    assertSourceIncludes(
      files.usePageViewPreferences,
      usePageViewPreferences,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "usePageViewPreferences(pageId)",
      "Child page tree must read view mode from page view preferences.",
    ],
    [
      "setChildTreeViewMode(pageId, mode)",
      "Child page tree must save view mode through workspace_settings-backed preferences.",
    ],
  ]) {
    assertSourceIncludes(files.childPageTree, childPageTree, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "const workspacePages = useWorkspaceStore((s) => s.pages)",
      "Child page tree must seed from already-loaded workspace pages without auto-loading the global page list.",
    ],
    [
      "listPageMetadata(pageId)",
      "Child page tree must load children through parent-scoped metadata queries.",
    ],
    [
      "collectDescendantsFromMemory(pageId, workspacePages)",
      "Child page tree must reuse loaded descendants from memory for fast first paint.",
    ],
  ]) {
    assertSourceIncludes(files.childPageTree, childPageTree, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'from "@/hooks/usePages"',
      "Child page tree must not import usePages because it auto-loads the global metadata snapshot by default.",
    ],
    [
      "usePages()",
      "Child page tree must not call usePages because page open should not trigger a global metadata scan.",
    ],
    [
      "usePages({",
      "Child page tree must not call usePages because page open should not trigger a global metadata scan.",
    ],
  ]) {
    assertSourceExcludes(files.childPageTree, childPageTree, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "listScopedPageMetadata",
      "Knowledge and industry modules must share a root-scoped page metadata helper.",
    ],
    [
      "listPageMetadata(rootId)",
      "Scoped page metadata must start from a specific module root instead of all pages.",
    ],
    [
      "listPageMetadata(current.id)",
      "Scoped page metadata must walk descendants from already-scoped children.",
    ],
    [
      "mergePageMetadata",
      "Scoped page metadata must support optimistic local merges after mutations.",
    ],
  ]) {
    assertSourceIncludes(files.scopedPageMetadata, scopedPageMetadata, snippet, message);
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
        "CompanyChainCoveragePanel",
        "unlinkedCompanyCandidates",
        "linkedCompanyCount",
        "buildIndustryParentOptions",
        "IndustryParentPickerDialog",
        "createCompanyLinkUnderParent",
        "知识库公司页 → 产业链层级",
        "这里只创建引用节点，不复制公司页正文",
        "onChanged={() => void loadScopedPages()}",
      ],
    ],
  ]) {
    for (const snippet of expectedSnippets) {
      assertSourceIncludes(
        sourceLabel,
        source,
        snippet,
        "Knowledge base and industry chain modules must use scoped metadata reads and optimistic local page merges."
      );
    }
    for (const forbiddenSnippet of [
      'from "@/hooks/usePages"',
      "usePages(",
      "await refresh()",
    ]) {
      assertSourceExcludes(
        sourceLabel,
        source,
        forbiddenSnippet,
        "Knowledge base and industry chain modules must not trigger global page refreshes on first paint or local mutations."
      );
    }
  }
  assertSourceExcludes(
    files.childPageTree,
    childPageTree,
    "zhinote.childtree.view",
    "Child page tree must not own a localStorage-only child tree view preference."
  );
  for (const [snippet, message] of [
    [
      'format: "zhinote-quick-search-saved-searches-settings-cloud-receipt"',
      "Quick search saved searches must expose a stable cloud receipt.",
    ],
    [
      "QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY",
      "Quick search saved searches must use a stable workspace setting key.",
    ],
    [
      "workspaces.settings.quick_search_saved_searches",
      "Quick search saved searches must target workspace cloud settings.",
    ],
    [
      "validateQuickSearchSavedSearchesWorkspaceSettingsCloudPayload",
      "Quick search saved searches must validate cloud payloads.",
    ],
    [
      "saved_searches",
      "Quick search saved searches must persist only saved-search metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Quick search saved searches receipt must state it does not read page bodies.",
    ],
    [
      "reads_page_titles: false",
      "Quick search saved searches receipt must state it does not read page titles.",
    ],
    [
      "reads_database_row_values: false",
      "Quick search saved searches receipt must state it does not read database row values.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Quick search saved searches must use pending-only ordinary sync.",
    ],
    [
      "content_text",
      "Quick search saved searches validator must reject page body fields.",
    ],
    [
      "database_title",
      "Quick search saved searches validator must reject database title fields.",
    ],
  ]) {
    assertSourceIncludes(
      files.quickSearchWorkspaceSettings,
      quickSearchWorkspaceSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY",
      "Quick search UI must use the cloud-ready saved searches setting key.",
    ],
    [
      "getWorkspaceSetting(QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY)",
      "Quick search UI must hydrate saved searches from workspace_settings.",
    ],
    [
      "upsertWorkspaceSetting(",
      "Quick search UI must persist saved searches through workspace_settings and sync_log.",
    ],
    [
      "localStorage is a fast boot cache and legacy migration source only",
      "Quick search UI must keep localStorage as cache/migration only.",
    ],
    [
      "legacy-quick-search-saved-searches-localStorage",
      "Quick search UI must migrate legacy saved searches into workspace_settings.",
    ],
    [
      "searchPageMetadata(pages, trimmedValue)",
      "Quick search UI must return metadata matches before scanning page body text.",
    ],
    [
      "QUICK_SEARCH_FULL_TEXT_DELAY_MS",
      "Quick search UI must defer full-text body scans behind a short timer.",
    ],
    [
      "deferredFullTextSearchTimerRef",
      "Quick search UI must cancel stale deferred full-text searches.",
    ],
    [
      "mergeSearchResults(currentResults, fullTextResults)",
      "Quick search UI must merge deferred body matches into metadata-first results.",
    ],
    [
      "searchPages(trimmedValue, QUICK_SEARCH_RESULT_LIMIT)",
      "Quick search deferred full-text search must keep a bounded result limit.",
    ],
    [
      "QUICK_SEARCH_ACTIVITY_LIMIT",
      "Quick search default activity pages must stay capped for large imported workspaces.",
    ],
    [
      "const suggestedPages = useMemo(() => {",
      "Quick search must memoize default activity pages instead of recalculating them on every render.",
    ],
    [
      "if (!open || hasQuery) return [];",
      "Quick search must skip default activity page calculation while closed or while showing query results.",
    ],
    [
      "getTopPagesByTimestamp(",
      "Quick search default activity pages must use bounded top-page selection instead of full-list sorting.",
    ],
    [
      "const primeQuickSearchPageOpen = useCallback",
      "Quick search page results must expose a reusable local-first prewarm helper.",
    ],
    [
      "prepareLocalFirstPageNavigation(page, \"quick-search-open\")",
      "Quick search page result prewarm must seed local-first route handoff before click navigation.",
    ],
    [
      "router.prefetch(`/page/${page.id}`)",
      "Quick search page result prewarm must prefetch the target page route.",
    ],
    [
      "primeQuickSearchPageOpen(entry.page)",
      "Quick search page results must warm page opens from the shared entry prewarm path.",
    ],
    [
      "lastPrewarmedEntryRef",
      "Quick search keyboard selection prewarm must dedupe repeated selected-entry warms.",
    ],
    [
      "handleEntryPrewarm(selectedEntry)",
      "Quick search keyboard navigation must prewarm the selected result before Enter.",
    ],
    [
      "onPointerDown={onPrewarm}",
      "Quick search result fast-clicks must prewarm before selection.",
    ],
  ]) {
    assertSourceIncludes(files.quickSearch, quickSearch, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "export async function searchPages(query: string, limit = 20)",
      "Local full-text page search must expose a bounded result limit.",
    ],
    [
      "content_text LIKE ?",
      "Local full-text page search must filter candidate rows in SQLite instead of materializing every page body first.",
    ],
    [
      "const candidateLimit = Math.max(limit * 8, limit)",
      "Local full-text page search must cap candidate rows before JS scoring.",
    ],
  ]) {
    assertSourceIncludes(files.localQueries, localQueries, snippet, message);
  }
  assertSourceIncludes(
    files.wikiSuggestion,
    wikiSuggestion,
    "searchPageMetadata(query, 8)",
    "Wiki link suggestions must use bounded metadata search while editing."
  );
  assertSourceExcludes(
    files.wikiSuggestion,
    wikiSuggestion,
    "searchPages(",
    "Wiki link suggestions must not run full-text page body scans while editing."
  );
  for (const [snippet, message] of [
    [
      'format: "zhinote-calendar-view-state-settings-cloud-receipt"',
      "Calendar view state settings must expose a stable cloud receipt.",
    ],
    [
      "CALENDAR_VIEW_STATE_SETTING_KEY",
      "Calendar view state settings must use a stable workspace setting key.",
    ],
    [
      "workspaces.settings.calendar_view_state",
      "Calendar view state settings must target workspace cloud settings.",
    ],
    [
      "validateCalendarViewStateWorkspaceSettingsCloudPayload",
      "Calendar view state settings must validate cloud payloads.",
    ],
    [
      "daily_view_month",
      "Calendar view state must persist daily calendar month metadata.",
    ],
    [
      "meeting_view_month",
      "Calendar view state must persist meeting calendar month metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Calendar view state receipt must state it does not read page bodies.",
    ],
    [
      "reads_page_titles: false",
      "Calendar view state receipt must state it does not read page titles.",
    ],
    [
      "reads_meeting_titles: false",
      "Calendar view state receipt must state it does not read meeting titles.",
    ],
    [
      "reads_database_row_values: false",
      "Calendar view state receipt must state it does not read database row values.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Calendar view state must use pending-only ordinary sync.",
    ],
    [
      "content_text",
      "Calendar view state validator must reject page body fields.",
    ],
    [
      "meeting_title",
      "Calendar view state validator must reject meeting title fields.",
    ],
  ]) {
    assertSourceIncludes(
      files.calendarViewStateWorkspaceSettings,
      calendarViewStateWorkspaceSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "CALENDAR_VIEW_STATE_SETTING_KEY",
      "Calendar view hook must use the cloud-ready workspace setting key.",
    ],
    [
      "getWorkspaceSetting(CALENDAR_VIEW_STATE_SETTING_KEY)",
      "Calendar view hook must hydrate months from workspace_settings.",
    ],
    [
      "upsertWorkspaceSetting(",
      "Calendar view hook must persist months through workspace_settings and sync_log.",
    ],
    [
      "localStorage is a fast boot cache and legacy migration source only",
      "Calendar view hook must keep localStorage as cache/migration only.",
    ],
    [
      "legacy-calendar-view-month-localStorage",
      "Calendar view hook must migrate legacy localStorage months into workspace_settings.",
    ],
  ]) {
    assertSourceIncludes(
      files.useCalendarViewMonthPreference,
      useCalendarViewMonthPreference,
      snippet,
      message
    );
  }
  for (const [file, source, snippet, message] of [
    [
      files.dailyNotesShell,
      dailyNotesShell,
      'useCalendarViewMonthPreference("daily")',
      "Daily notes calendar must use the workspace-settings backed view month.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      'useCalendarViewMonthPreference("meeting")',
      "Meeting calendar must use the workspace-settings backed view month.",
    ],
  ]) {
    assertSourceIncludes(file, source, snippet, message);
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-meeting-review-state-settings-cloud-receipt"',
      "Meeting review state settings must expose a stable cloud receipt.",
    ],
    [
      "MEETING_REVIEW_STATE_SETTING_KEY",
      "Meeting review state settings must use a stable workspace setting key.",
    ],
    [
      "workspaces.settings.meeting_review_state",
      "Meeting review state settings must target workspace cloud settings.",
    ],
    [
      "validateMeetingReviewStateWorkspaceSettingsCloudPayload",
      "Meeting review state settings must validate cloud payloads.",
    ],
    [
      "seen_meeting_page_ids",
      "Meeting review state must persist seen meeting page id metadata.",
    ],
    [
      "dismissed_trace_page_ids",
      "Meeting review state must persist dismissed trace page id metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Meeting review state receipt must state it does not read page bodies.",
    ],
    [
      "reads_page_titles: false",
      "Meeting review state receipt must state it does not read page titles.",
    ],
    [
      "reads_meeting_titles: false",
      "Meeting review state receipt must state it does not read meeting titles.",
    ],
    [
      "reads_meeting_urls: false",
      "Meeting review state receipt must state it does not read meeting URLs.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Meeting review state must use pending-only ordinary sync.",
    ],
    [
      "meeting_title",
      "Meeting review state validator must reject meeting title fields.",
    ],
    [
      "join_url",
      "Meeting review state validator must reject meeting URL fields.",
    ],
  ]) {
    assertSourceIncludes(
      files.meetingReviewStateWorkspaceSettings,
      meetingReviewStateWorkspaceSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "MEETING_REVIEW_STATE_SETTING_KEY",
      "Meeting review hook must use the cloud-ready workspace setting key.",
    ],
    [
      "getWorkspaceSetting(MEETING_REVIEW_STATE_SETTING_KEY)",
      "Meeting review hook must hydrate state from workspace_settings.",
    ],
    [
      "upsertWorkspaceSetting(",
      "Meeting review hook must persist state through workspace_settings and sync_log.",
    ],
    [
      "localStorage is a fast boot cache and legacy migration source only",
      "Meeting review hook must keep localStorage as cache/migration only.",
    ],
    [
      "legacy-meeting-review-state-localStorage",
      "Meeting review hook must migrate legacy localStorage state into workspace_settings.",
    ],
  ]) {
    assertSourceIncludes(
      files.useMeetingReviewStatePreference,
      useMeetingReviewStatePreference,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "useMeetingReviewStatePreference()",
    "Meeting schedule must use the workspace-settings backed review state."
  );
  for (const [snippet, message] of [
    [
      'format: "zhinote-meeting-deletion-tombstones-settings-cloud-receipt"',
      "Meeting deletion tombstone settings must expose a stable cloud receipt.",
    ],
    [
      "MEETING_DELETION_TOMBSTONES_SETTING_KEY",
      "Meeting deletion tombstone settings must use a stable workspace setting key.",
    ],
    [
      "workspaces.settings.meeting_deletion_tombstones",
      "Meeting deletion tombstones must target workspace cloud settings.",
    ],
    [
      "validateMeetingDeletionTombstonesWorkspaceSettingsCloudPayload",
      "Meeting deletion tombstones must validate cloud payloads.",
    ],
    [
      "deleted_meeting_page_ids",
      "Meeting deletion tombstones must persist only deleted meeting page id metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Meeting deletion tombstone receipt must state it does not read page bodies.",
    ],
    [
      "reads_page_titles: false",
      "Meeting deletion tombstone receipt must state it does not read page titles.",
    ],
    [
      "reads_meeting_titles: false",
      "Meeting deletion tombstone receipt must state it does not read meeting titles.",
    ],
    [
      "reads_meeting_urls: false",
      "Meeting deletion tombstone receipt must state it does not read meeting URLs.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Meeting deletion tombstones must use pending-only ordinary sync.",
    ],
    [
      "meeting_title",
      "Meeting deletion tombstone validator must reject meeting title fields.",
    ],
    [
      "join_url",
      "Meeting deletion tombstone validator must reject meeting URL fields.",
    ],
  ]) {
    assertSourceIncludes(
      files.meetingDeletionTombstonesWorkspaceSettings,
      meetingDeletionTombstonesWorkspaceSettings,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "MEETING_DELETION_TOMBSTONES_SETTING_KEY",
      "Meeting deletion tombstone hook must use the cloud-ready workspace setting key.",
    ],
    [
      "getWorkspaceSetting(MEETING_DELETION_TOMBSTONES_SETTING_KEY)",
      "Meeting deletion tombstone hook must hydrate state from workspace_settings.",
    ],
    [
      "upsertWorkspaceSetting(",
      "Meeting deletion tombstone hook must persist state through workspace_settings and sync_log.",
    ],
    [
      "localStorage is a fast boot cache and legacy migration source only",
      "Meeting deletion tombstone hook must keep localStorage as cache/migration only.",
    ],
    [
      "legacy-meeting-deletion-tombstones-localStorage",
      "Meeting deletion tombstone hook must migrate legacy localStorage state into workspace_settings.",
    ],
  ]) {
    assertSourceIncludes(
      files.useMeetingDeletionTombstonesPreference,
      useMeetingDeletionTombstonesPreference,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "useMeetingDeletionTombstonesPreference()",
    "Meeting schedule must use the workspace-settings backed deletion tombstones."
  );
  for (const [snippet, message] of [
    [
      'cloudNotConfiguredResponse("workspace-settings-update")',
      "Workspace settings route must stay behind the cloud configured gate.",
    ],
    [
      'cloudNotConfiguredResponse("workspace-settings-read")',
      "Workspace settings read route must stay behind the cloud configured gate.",
    ],
    [
      'requireCloudWritesResponse("workspace-settings-update")',
      "Workspace settings route must stay behind the cloud writes gate.",
    ],
    [
      "buildHotCacheSettingsCloudReadReceipt",
      "Workspace settings route must return a hot-cache settings read receipt.",
    ],
    [
      "parseHotCacheSettingsCloudValue",
      "Workspace settings route must parse stored cloud preferences before returning them.",
    ],
    [
      "validateHotCacheSettingsCloudPayload",
      "Workspace settings route must validate hot-cache payloads before writing.",
    ],
    [
      "validatePageFavoritesWorkspaceSettingsCloudPayload",
      "Workspace settings route must validate page favorite payloads before writing.",
    ],
    [
      "buildPageFavoritesWorkspaceSettingsCloudValue",
      "Workspace settings route must write page favorite metadata to cloud settings.",
    ],
    [
      "page_favorites",
      "Workspace settings route must return page favorite metadata on reads.",
    ],
    [
      "PAGE_FAVORITES_SETTING_KEY",
      "Workspace settings route must advertise page favorites as a supported setting.",
    ],
    [
      "validatePageViewPreferencesWorkspaceSettingsCloudPayload",
      "Workspace settings route must validate page view preference payloads before writing.",
    ],
    [
      "buildPageViewPreferencesWorkspaceSettingsCloudValue",
      "Workspace settings route must write page view preference metadata to cloud settings.",
    ],
    [
      "page_view_preferences",
      "Workspace settings route must return page view preference metadata on reads.",
    ],
    [
      "PAGE_VIEW_PREFERENCES_SETTING_KEY",
      "Workspace settings route must advertise page view preferences as a supported setting.",
    ],
    [
      "validateQuickSearchSavedSearchesWorkspaceSettingsCloudPayload",
      "Workspace settings route must validate quick search saved-search payloads before writing.",
    ],
    [
      "buildQuickSearchSavedSearchesWorkspaceSettingsCloudValue",
      "Workspace settings route must write quick search saved-search metadata to cloud settings.",
    ],
    [
      "quick_search_saved_searches",
      "Workspace settings route must return quick search saved-search metadata on reads.",
    ],
    [
      "QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY",
      "Workspace settings route must advertise quick search saved searches as a supported setting.",
    ],
    [
      "validateCalendarViewStateWorkspaceSettingsCloudPayload",
      "Workspace settings route must validate calendar view state payloads before writing.",
    ],
    [
      "buildCalendarViewStateWorkspaceSettingsCloudValue",
      "Workspace settings route must write calendar view state metadata to cloud settings.",
    ],
    [
      "calendar_view_state",
      "Workspace settings route must return calendar view state metadata on reads.",
    ],
    [
      "CALENDAR_VIEW_STATE_SETTING_KEY",
      "Workspace settings route must advertise calendar view state as a supported setting.",
    ],
    [
      "validateMeetingReviewStateWorkspaceSettingsCloudPayload",
      "Workspace settings route must validate meeting review state payloads before writing.",
    ],
    [
      "buildMeetingReviewStateWorkspaceSettingsCloudValue",
      "Workspace settings route must write meeting review state metadata to cloud settings.",
    ],
    [
      "meeting_review_state",
      "Workspace settings route must return meeting review state metadata on reads.",
    ],
    [
      "MEETING_REVIEW_STATE_SETTING_KEY",
      "Workspace settings route must advertise meeting review state as a supported setting.",
    ],
    [
      "validateMeetingDeletionTombstonesWorkspaceSettingsCloudPayload",
      "Workspace settings route must validate meeting deletion tombstone payloads before writing.",
    ],
    [
      "buildMeetingDeletionTombstonesWorkspaceSettingsCloudValue",
      "Workspace settings route must write meeting deletion tombstone metadata to cloud settings.",
    ],
    [
      "meeting_deletion_tombstones",
      "Workspace settings route must return meeting deletion tombstone metadata on reads.",
    ],
    [
      "MEETING_DELETION_TOMBSTONES_SETTING_KEY",
      "Workspace settings route must advertise meeting deletion tombstones as a supported setting.",
    ],
    [
      "validateAccountModuleSettingCloudPayload",
      "Workspace settings route must validate account/module settings payloads before writing.",
    ],
    [
      "buildAccountModuleSettingCloudValue",
      "Workspace settings route must write account/module settings metadata to cloud settings.",
    ],
    [
      "parseAccountModuleSettingsCloudValues",
      "Workspace settings route must parse account/module settings cloud values on reads.",
    ],
    [
      "account_module_settings",
      "Workspace settings route must return account/module settings metadata on reads.",
    ],
    [
      "ACCOUNT_DISPLAY_NAME_SETTING_KEY",
      "Workspace settings route must advertise account display names as a supported setting.",
    ],
    [
      "MODULE_PINNED_ITEMS_SETTING_KEY",
      "Workspace settings route must advertise module pinned items as a supported setting.",
    ],
    [
      "workspace-settings-readonly-role",
      "Workspace settings route must reject viewer writes.",
    ],
    [
      "HOT_CACHE_SETTINGS_CLOUD_PAYLOAD_MAX_BYTES",
      "Workspace settings route must bound request body size.",
    ],
  ]) {
    assertSourceIncludes(
      files.workspaceSettingsRoute,
      workspaceSettingsRoute,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildHotCacheSelectionContract",
      "Sync UI must build the hot cache selection contract.",
    ],
    [
      "HotCacheSelectionPanel",
      "Sync UI must render the hot cache selection panel.",
    ],
    [
      "常驻本地缓存选择",
      "Sync UI must expose hot cache selection controls.",
    ],
    [
      "当前月份会议日历",
      "Sync UI must expose current-month meeting hot cache selection.",
    ],
    [
      "指定数据库",
      "Sync UI must expose pinned database hot cache selection.",
    ],
    [
      "只保存数据库 ID 清单",
      "Sync UI must explain pinned databases store setting metadata only.",
    ],
    [
      "handleHotCachePreferencesChange",
      "Sync UI must save hot cache preferences.",
    ],
    [
      "upsertWorkspaceSetting",
      "Sync UI must save preferences through workspace settings.",
    ],
    [
      "notifyHotCachePreferencesChanged",
      "Sync UI must notify other local surfaces after hot-cache preferences change.",
    ],
    [
      "导出选择合同",
      "Sync UI must export the hot cache selection contract.",
    ],
    [
      "handleHotCachePreferencesCloudSync",
      "Sync UI must expose an explicit hot-cache preferences cloud sync action.",
    ],
    [
      "markWorkspaceSettingSyncLogEntriesSynced",
      "Sync UI must acknowledge local pending settings after cloud success.",
    ],
    [
      "getPendingWorkspaceSettingSyncLogEntries",
      "Sync UI must block workspace settings cloud restore when local pending rows exist.",
    ],
    [
      "applyRemoteWorkspaceSettings",
      "Sync UI must rebuild workspace setting local cache from validated cloud metadata.",
    ],
    [
      "handleHotCachePreferencesCloudPull",
      "Sync UI must expose an explicit workspace settings cloud pull action.",
    ],
    [
      "同步待上传设置",
      "Sync UI must render the workspace settings pending sync button.",
    ],
    [
      "buildWorkspaceSettingsPendingSyncPlan",
      "Sync UI must use the pending-only workspace settings sync plan.",
    ],
    [
      "listWorkspaceSettings()",
      "Sync UI must read local workspace settings before pending-only upload.",
    ],
    [
      "markWorkspaceSettingSyncLogEntriesSynced(uploadedKeys)",
      "Sync UI must acknowledge only successfully uploaded workspace settings.",
    ],
    [
      'setBusyCloudAction("workspace-settings")',
      "Sync UI must expose workspace settings upload as its own busy state.",
    ],
    [
      "handleAccountModuleSettingsCloudSync",
      "Sync UI must expose an explicit account/module settings cloud sync action.",
    ],
    [
      'setBusyCloudAction("account-module-settings")',
      "Sync UI must expose account/module settings upload as its own busy state.",
    ],
    [
      "handleAccountModuleSettingsCloudPull",
      "Sync UI must expose an explicit account/module settings cloud restore action.",
    ],
    [
      'setBusyCloudAction("account-module-settings-pull")',
      "Sync UI must expose account/module settings restore as its own busy state.",
    ],
    [
      "getPendingAccountModuleSettingSyncLogEntries",
      "Sync UI must block account/module settings restore when local pending rows exist.",
    ],
    [
      "applyRemoteAccountModuleSettings",
      "Sync UI must rebuild account/module local cache from validated cloud metadata.",
    ],
    [
      "markAccountSettingSyncLogEntriesSynced",
      "Sync UI must acknowledge only successfully uploaded account settings.",
    ],
    [
      "markModuleSettingSyncLogEntriesSynced",
      "Sync UI must acknowledge only successfully uploaded module settings.",
    ],
    [
      "同步账号/模块设置",
      "Sync UI must render the account/module settings cloud sync button.",
    ],
    [
      "从云端恢复设置",
      "Sync UI must render the account/module settings cloud restore button.",
    ],
    [
      "从云端恢复工作区设置",
      "Sync UI must render the workspace settings cloud restore button.",
    ],
    [
      'data-testid="sync-upload-safety-panel"',
      "Sync UI must expose a stable upload safety overview test hook.",
    ],
    [
      "上传安全总览",
      "Sync UI must render a plain-language upload safety overview.",
    ],
    [
      "pageStatus.pending + pageStatus.queued",
      "Upload safety overview must include page durable and in-memory queues.",
    ],
    [
      "databaseStatus.syncLogPending",
      "Upload safety overview must include database sync_log pending rows.",
    ],
    [
      "totalSyncPending",
      "Upload safety overview must include full-domain sync_log pending rows.",
    ],
    [
      "需处理失败",
      "Upload safety overview must surface failed page or database uploads.",
    ],
    [
      "需人工处理",
      "Upload safety overview must escalate repeated failures into an owner action state.",
    ],
    [
      "manualReviewCount",
      "Upload safety overview must use repeated failure counts from pending queue metadata.",
    ],
    [
      'data-testid="sync-upload-manual-review-warning"',
      "Upload safety overview must expose a stable repeated-failure warning hook.",
    ],
    [
      "队列清空",
      "Upload safety overview must tell the owner when queues are empty.",
    ],
    [
      "不读取页面正文",
      "Upload safety overview must preserve the page privacy boundary.",
    ],
    [
      "SYNC_QUEUE_STALE_PENDING_MS",
      "Upload safety overview must define a stale pending queue threshold.",
    ],
    [
      "SYNC_QUEUE_CRITICAL_PENDING_MS",
      "Upload safety overview must define a critical long-pending queue threshold.",
    ],
    [
      "滞留风险",
      "Upload safety overview must surface stale queue risk before cloud rollout.",
    ],
    [
      "长时间未上传",
      "Upload safety overview must identify queues that have been stuck for too long.",
    ],
    [
      "oldestPendingQueuedAt、lastFailureAt 和 counts",
      "Upload safety overview must classify queue health from metadata only.",
    ],
    [
      'data-testid="sync-upload-stale-queue-warning"',
      "Upload safety overview must expose a stable stale queue warning hook.",
    ],
    [
      "数据库行值、评论正文、文件字节或密钥",
      "Upload safety overview must preserve database, comment, file, and secret boundaries.",
    ],
    [
      'data-testid="sync-upload-safety-fact"',
      "Upload safety overview must expose stable metadata-only fact cards.",
    ],
    [
      "补传页面",
      "Upload safety overview must expose the manual page retry action.",
    ],
    [
      "补传数据库",
      "Upload safety overview must expose the manual database retry action.",
    ],
    [
      "页面 pending 上传队列",
      "Sync UI must render page pending upload queue status.",
    ],
    [
      "补传页面队列",
      "Sync UI must expose a manual page pending retry action.",
    ],
    [
      "reconcilePageSync({ quick: true })",
      "Sync UI manual page retry must use quick incremental reconcile.",
    ],
    [
      "只保存 page id 和排队时间，不保存页面正文",
      "Sync UI must document that page pending upload status contains metadata only.",
    ],
    [
      "反复失败",
      "Sync UI must show repeated pending upload failures as a separate fact.",
    ],
    [
      "人工处理样本",
      "Sync UI must show manual review samples without reading private content.",
    ],
    [
      'data-testid="page-pending-manual-review-sample-id"',
      "Sync UI must expose stable metadata-only page id hooks for manual review.",
    ],
    [
      'data-testid="database-pending-manual-review-sample-key"',
      "Sync UI must expose stable metadata-only database key hooks for manual review.",
    ],
    [
      "最早排队",
      "Sync UI must render the oldest page pending queued timestamp.",
    ],
    [
      "认证退避",
      "Sync UI must render auth retry backoff status.",
    ],
    [
      "下次自动重试",
      "Sync UI must render the auth retry-at time.",
    ],
    [
      "样本 page id",
      "Sync UI must render metadata-only page pending sample ids.",
    ],
    [
      'data-testid="page-pending-queue-details"',
      "Sync UI must expose a stable page pending queue details test hook.",
    ],
    [
      'data-testid="page-pending-sample-id"',
      "Sync UI must expose stable metadata-only page id sample test hooks.",
    ],
    [
      "补传按钮才会尝试上传 pending",
      "Sync UI must clarify that reading queue details does not trigger upload.",
    ],
    [
      "PAGE_SYNC_STATUS_EVENT",
      "Sync UI must subscribe to page pending queue status events.",
    ],
    [
      "refreshPagePendingStatus",
      "Sync UI must refresh page pending queue details while the sync center stays open.",
    ],
    [
      "数据库 pending 上传队列",
      "Sync UI must render database pending upload queue status.",
    ],
    [
      "补传数据库队列",
      "Sync UI must expose a manual database pending retry action.",
    ],
    [
      'data-testid="database-pending-queue-details"',
      "Sync UI must expose a stable database pending queue details test hook.",
    ],
    [
      'data-testid="database-pending-queue-fact"',
      "Sync UI must expose stable database pending queue fact test hooks.",
    ],
    [
      "数据库待上传样本",
      "Sync UI must render database pending sample keys in reader-facing language.",
    ],
    [
      "这里只显示数据库队列数量",
      "Database pending details must clarify the panel is metadata-only.",
    ],
    [
      'data-testid="database-pending-sample-key"',
      "Sync UI must expose stable metadata-only database key sample test hooks.",
    ],
    [
      "database/field/row/view key",
      "Database pending details must show key-only samples instead of row values.",
    ],
    [
      "不读取 row",
      "Database pending details must avoid database row value reads.",
    ],
    [
      "reconcileDatabaseSync({ quick: true })",
      "Sync UI manual database retry must use quick incremental reconcile.",
    ],
    [
      "DATABASE_SYNC_STATUS_EVENT",
      "Sync UI must subscribe to database pending queue status events.",
    ],
    [
      "refreshDatabasePendingStatus",
      "Sync UI must refresh database pending queue details while the sync center stays open.",
    ],
    [
      "不展示或导出数据库行值",
      "Sync UI must preserve the privacy boundary for the database pending queue.",
    ],
    [
      "不会把本地数据库缓存全量上传",
      "Sync UI must explain database ordinary sync is pending-only.",
    ],
    [
      "buildPendingDomainRows",
      "Sync UI must aggregate pending sync rows by full cloud-master data domain.",
    ],
    [
      "全域 pending 变更分布",
      "Sync UI must render a full-domain pending distribution panel.",
    ],
    [
      "只读取 sync_log 的表名、计数和时间戳",
      "Full-domain pending distribution must stay metadata-only.",
    ],
    [
      "不读取页面正文、评论正文、数据库值、文件",
      "Full-domain pending distribution must preserve sensitive content boundaries.",
    ],
    [
      "普通同步仍只上传这些 pending 行指向的明确变更",
      "Full-domain pending distribution must preserve pending-only ordinary sync.",
    ],
    [
      "本机缓存重建入口",
      "Sync UI must expose the local cache rebuild safety entrypoint.",
    ],
    [
      "云端 manifest 是重建来源",
      "Cache rebuild entrypoint must explain the cloud manifest source of truth.",
    ],
    [
      "不会把本地缓存全量上传",
      "Cache rebuild entrypoint must preserve the no-full-cache-upload boundary.",
    ],
    [
      "本地 pending 变更未清空前不建议重建",
      "Cache rebuild entrypoint must warn before rebuilding with local pending edits.",
    ],
    [
      "buildCacheRebuildPreflightReceipt",
      "Cache rebuild entrypoint must generate a metadata-only dry-run preflight receipt.",
    ],
    [
      "导出重建预检收据",
      "Cache rebuild entrypoint must expose dry-run preflight receipt export.",
    ],
    [
      "重建 dry-run 预检",
      "Cache rebuild entrypoint must render dry-run preflight gates.",
    ],
    [
      "zhinote-cache-rebuild-preflight-receipt",
      "Cache rebuild preflight export must use a stable receipt filename.",
    ],
    [
      "收据 ID",
      "Cache rebuild preflight panel must show a receipt id for traceability.",
    ],
    [
      "前往账号页重建缓存",
      "Cache rebuild entrypoint must hand off to the confirmed account-page rebuild action.",
    ],
    [
      "router.push(\"/account\")",
      "Cache rebuild entrypoint must navigate to the account page instead of directly clearing cache.",
    ],
    [
      "handleExportSyncManualReviewPacket",
      "Sync UI must expose a local manual review packet export handler.",
    ],
    [
      "buildSyncManualReviewPacket",
      "Sync UI must build manual review packets from queue metadata.",
    ],
    [
      "manual-review-packet",
      "Sync UI must track manual review packet export as its own busy state.",
    ],
    [
      "zhinote-sync-manual-review-packet",
      "Sync UI must download the manual review packet under a stable filename.",
    ],
    [
      "导出处理包",
      "Sync UI must render the manual review packet export action.",
    ],
    [
      "handleExportSyncHandoffReadinessReceipt",
      "Sync UI must expose a local cross-device handoff readiness export handler.",
    ],
    [
      "buildSyncHandoffReadinessReceipt",
      "Sync UI must build handoff readiness receipts from queue metadata.",
    ],
    [
      "handoff-readiness",
      "Sync UI must track handoff readiness export as its own busy state.",
    ],
    [
      "zhinote-sync-handoff-readiness",
      "Sync UI must download handoff readiness under a stable filename.",
    ],
    [
      "导出接力收据",
      "Sync UI must render the cross-device handoff readiness export action.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-sync-handoff-readiness-receipt"',
      "Handoff readiness receipt must declare a stable export format.",
    ],
    [
      'receipt_status: "metadata-only-local-check"',
      "Handoff readiness receipt must stay local and metadata-only.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Handoff readiness receipt must target cloud master plus local hot cache.",
    ],
    [
      "buildSyncHandoffReadinessReceipt",
      "Handoff readiness receipt must have a single builder entrypoint.",
    ],
    [
      "ready_for_cross_device_handoff",
      "Handoff readiness receipt must explicitly mark cross-device handoff readiness.",
    ],
    [
      "safe_to_open_other_device",
      "Handoff readiness receipt must tell whether another device can safely open the workspace.",
    ],
    [
      "ready_for_cloud_cache_read",
      "Handoff readiness receipt must tell whether cloud cache reads are safe.",
    ],
    [
      "cloud_workspace_linked",
      "Handoff readiness receipt must block local-only workspaces.",
    ],
    [
      "local_receipt_only: true",
      "Handoff readiness receipt must declare it is local only.",
    ],
    [
      "reads_queue_counts: true",
      "Handoff readiness receipt may read queue counts.",
    ],
    [
      "reads_sync_enabled_flags: true",
      "Handoff readiness receipt may read sync enabled flags.",
    ],
    [
      "reads_workspace_link_metadata: true",
      "Handoff readiness receipt may read workspace link metadata.",
    ],
    [
      "reads_failure_counts: true",
      "Handoff readiness receipt may read failure counts.",
    ],
    [
      "reads_queue_timestamps: true",
      "Handoff readiness receipt may read queue timestamps.",
    ],
    [
      "reads_page_ids: false",
      "Handoff readiness receipt must not export page ids.",
    ],
    [
      "reads_database_keys: false",
      "Handoff readiness receipt must not export database keys.",
    ],
    [
      "reads_failure_messages: false",
      "Handoff readiness receipt must not export failure messages.",
    ],
    [
      "reads_page_body_text: false",
      "Handoff readiness receipt must not read page body text.",
    ],
    [
      "reads_page_yjs: false",
      "Handoff readiness receipt must not read page Yjs payloads.",
    ],
    [
      "reads_database_row_values: false",
      "Handoff readiness receipt must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Handoff readiness receipt must not read comment bodies.",
    ],
    [
      "reads_file_names: false",
      "Handoff readiness receipt must not read file names.",
    ],
    [
      "reads_file_bytes: false",
      "Handoff readiness receipt must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Handoff readiness receipt must not read secret values.",
    ],
    [
      "sends_network_requests: false",
      "Handoff readiness receipt must not send network requests.",
    ],
    [
      "writes_server_data: false",
      "Handoff readiness receipt must not write server data.",
    ],
    [
      "uploads_workspace_data: false",
      "Handoff readiness receipt must not upload workspace data.",
    ],
    [
      "clears_local_cache: false",
      "Handoff readiness receipt must not clear local cache.",
    ],
    [
      "mutates_local_cache_records: false",
      "Handoff readiness receipt must not mutate local cache records.",
    ],
    [
      "enables_sync: false",
      "Handoff readiness receipt must not enable sync.",
    ],
    [
      "enables_ai: false",
      "Handoff readiness receipt must not enable AI.",
    ],
    [
      "exports_raw_workspace_ids: false",
      "Handoff readiness receipt must not export raw workspace ids.",
    ],
    [
      "includes_raw_workspace_content: false",
      "Handoff readiness receipt must not include raw workspace content.",
    ],
    [
      "includes_only_counts_booleans_hashes_timestamps_and_gates: true",
      "Handoff readiness receipt must only include counts, booleans, hashes, timestamps, and gates.",
    ],
    [
      "blocked-local-only",
      "Handoff readiness receipt must block local-only workspaces.",
    ],
    [
      "blocked-sync-disabled",
      "Handoff readiness receipt must block disabled sync domains.",
    ],
    [
      "blocked-pending",
      "Handoff readiness receipt must block while pending queues exist.",
    ],
    [
      "blocked-stale-pending",
      "Handoff readiness receipt must block stale pending queues.",
    ],
    [
      "blocked-failed",
      "Handoff readiness receipt must block failed uploads.",
    ],
    [
      "blocked-manual-review",
      "Handoff readiness receipt must block repeated failures that need owner review.",
    ],
    [
      "owner_actions",
      "Handoff readiness receipt must include owner-facing next actions.",
    ],
  ]) {
    assertSourceIncludes(
      files.syncHandoffReadinessReceipt,
      syncHandoffReadinessReceipt,
      snippet,
      message
    );
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-sync-manual-review-packet"',
      "Manual review packet must declare a stable export format.",
    ],
    [
      'packet_status: "metadata-only-local-review"',
      "Manual review packet must stay local and metadata-only.",
    ],
    [
      "buildSyncManualReviewPacket",
      "Manual review packet must have a single builder entrypoint.",
    ],
    [
      "local_packet_only: true",
      "Manual review packet must declare it is local only.",
    ],
    [
      "reads_queue_counts: true",
      "Manual review packet may read queue counts.",
    ],
    [
      "reads_page_ids: true",
      "Manual review packet may read page ids for diagnosis.",
    ],
    [
      "reads_database_keys: true",
      "Manual review packet may read database keys for diagnosis.",
    ],
    [
      "reads_failure_counts: true",
      "Manual review packet may read failure counts.",
    ],
    [
      "reads_failure_messages: true",
      "Manual review packet may read failure messages.",
    ],
    [
      "reads_page_body_text: false",
      "Manual review packet must not read page body text.",
    ],
    [
      "reads_page_yjs: false",
      "Manual review packet must not read page Yjs payloads.",
    ],
    [
      "reads_database_row_values: false",
      "Manual review packet must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Manual review packet must not read comment bodies.",
    ],
    [
      "reads_file_names: false",
      "Manual review packet must not read file names.",
    ],
    [
      "reads_file_bytes: false",
      "Manual review packet must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Manual review packet must not read secret values.",
    ],
    [
      "sends_network_requests: false",
      "Manual review packet must not send network requests.",
    ],
    [
      "writes_server_data: false",
      "Manual review packet must not write server data.",
    ],
    [
      "uploads_workspace_data: false",
      "Manual review packet must not upload workspace data.",
    ],
    [
      "clears_local_cache: false",
      "Manual review packet must not clear local cache.",
    ],
    [
      "mutates_local_cache_records: false",
      "Manual review packet must not mutate local cache records.",
    ],
    [
      "enables_sync: false",
      "Manual review packet must not enable sync.",
    ],
    [
      "enables_ai: false",
      "Manual review packet must not enable AI.",
    ],
    [
      "includes_only_counts_ids_keys_timestamps_and_error_messages: true",
      "Manual review packet must only include counts, ids, keys, timestamps, and failure messages.",
    ],
    [
      "manual_review_sample_ids_or_keys",
      "Manual review packet must surface metadata-only repeated failure samples.",
    ],
    [
      "can_retry_before_owner_review",
      "Manual review packet must tell whether retry is safe before owner review.",
    ],
    [
      "cache_rebuild_should_wait",
      "Manual review packet must warn when cache rebuild should wait.",
    ],
    [
      "owner_actions",
      "Manual review packet must include owner-facing next actions.",
    ],
    [
      "excluded_payload_classes",
      "Manual review packet must document payload classes it excludes.",
    ],
  ]) {
    assertSourceIncludes(
      files.syncManualReviewPacket,
      syncManualReviewPacket,
      snippet,
      message
    );
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-cache-rebuild-preflight-receipt"',
      "Cache rebuild preflight receipt must declare a stable export format.",
    ],
    [
      'receipt_status: "metadata-only-dry-run"',
      "Cache rebuild preflight receipt must stay a metadata-only dry run.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Cache rebuild preflight receipt must target cloud master plus local hot cache.",
    ],
    [
      "reads_page_body_text: false",
      "Cache rebuild preflight receipt must not read page body text.",
    ],
    [
      "reads_page_yjs: false",
      "Cache rebuild preflight receipt must not read page Yjs payloads.",
    ],
    [
      "reads_database_row_values: false",
      "Cache rebuild preflight receipt must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Cache rebuild preflight receipt must not read comments.",
    ],
    [
      "reads_file_bytes: false",
      "Cache rebuild preflight receipt must not read file bytes.",
    ],
    [
      "writes_server_data: false",
      "Cache rebuild preflight receipt must not write server data.",
    ],
    [
      "uploads_workspace_data: false",
      "Cache rebuild preflight receipt must not upload workspace data.",
    ],
    [
      "clears_local_cache: false",
      "Cache rebuild preflight receipt must not clear local cache.",
    ],
    [
      "mutates_local_cache_records: false",
      "Cache rebuild preflight receipt must not mutate local cache records.",
    ],
    [
      "exports_raw_workspace_ids: false",
      "Cache rebuild preflight receipt must not export raw workspace ids.",
    ],
    [
      "includes_only_counts_watermarks_hashes_and_gates: true",
      "Cache rebuild preflight receipt must only include counts, watermarks, hashes, and gates.",
    ],
    [
      "requires_account_page_confirmation: true",
      "Cache rebuild preflight receipt must require account-page confirmation.",
    ],
    [
      "sync_page_must_not_directly_rebuild_cache: true",
      "Cache rebuild preflight receipt must keep Sync page from directly rebuilding cache.",
    ],
    [
      "ready_preflight_required_before_rebuild: true",
      "Cache rebuild preflight receipt must require ready preflight before rebuild.",
    ],
    [
      "cloud_manifest_is_source_of_truth: true",
      "Cache rebuild preflight receipt must preserve cloud manifest source-of-truth policy.",
    ],
    [
      "local_pending_edits_block_rebuild: true",
      "Cache rebuild preflight receipt must block rebuild while local pending edits exist.",
    ],
    [
      "blocked-pending",
      "Cache rebuild preflight receipt must expose a blocked-pending status.",
    ],
    [
      "blocked-manifest-mismatch",
      "Cache rebuild preflight receipt must expose a blocked-manifest-mismatch status.",
    ],
    [
      "needs-manifest-check",
      "Cache rebuild preflight receipt must expose a needs-manifest-check status.",
    ],
    [
      "stableStringify",
      "Cache rebuild preflight receipt must use stable hash input ordering.",
    ],
  ]) {
    assertSourceIncludes(
      files.cacheRebuildPreflightReceipt,
      cacheRebuildPreflightReceipt,
      snippet,
      message
    );
  }

  for (const [snippet, message] of [
    [
      "export async function getCloudPageManifestSummary",
      "Page sync client must expose cloud page manifest summary for core-domain compare.",
    ],
    [
      "export async function getCloudDailyManifestSummary",
      "Page sync client must expose cloud daily manifest summary for core-domain compare.",
    ],
    [
      "export async function getCloudMeetingManifestSummary",
      "Page sync client must expose cloud meeting manifest summary for core-domain compare.",
    ],
    [
      "summarizeRemotePageMetadataRecords",
      "Page sync client must summarize daily and meeting metadata without page body reads.",
    ],
    [
      'call({ action: "summary" })',
      "Page sync client manifest summary must use the existing summary action.",
    ],
  ]) {
    assertSourceIncludes(files.accountPageSync, accountPageSync, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "export async function getPendingCloudDatabaseSyncStatus",
      "Database sync client must expose pending queue status for the sync dashboard.",
    ],
    [
      'DATABASE_SYNC_STATUS_EVENT = "zhinote:databasesync-status"',
      "Database sync client must expose a pending queue status event.",
    ],
    [
      "emitDatabaseSyncStatusChanged",
      "Database sync client must emit queue status updates for open dashboards.",
    ],
    [
      "const pending = await getPendingDatabaseSyncRecords(1000)",
      "Database pending status must read the local sync_log pending queue.",
    ],
    [
      "pending: pendingKeys.length",
      "Database pending status must expose the cloud key retry queue.",
    ],
    [
      "queued: queuedCloudDatabasePush.size",
      "Database pending status must expose the in-memory debounce queue.",
    ],
    [
      "PENDING_PUSH_META_KEY",
      "Database pending status must store metadata separately from database row values.",
    ],
    [
      "oldestPendingQueuedAt",
      "Database pending status must expose the oldest pending queued timestamp.",
    ],
    [
      "pendingSampleKeys: pendingKeys.slice(0, 5)",
      "Database pending status must expose metadata-only sample keys.",
    ],
    [
      "markPendingCloudDatabasePushAttemptRecords",
      "Database pending queue must record upload attempts for ACK visibility.",
    ],
    [
      "markPendingCloudDatabasePushFailedRecords",
      "Database pending queue must preserve failed upload receipts for retry visibility.",
    ],
    [
      "failedSampleKeys",
      "Database pending status must expose metadata-only failed sample keys.",
    ],
    [
      "PENDING_CLOUD_DATABASE_MANUAL_REVIEW_FAILURE_COUNT",
      "Database pending status must define the repeated-failure threshold for owner review.",
    ],
    [
      "failureCountTotal",
      "Database pending status must expose aggregate failure counts without reading row values.",
    ],
    [
      "manualReviewSampleKeys",
      "Database pending status must expose metadata-only database keys for owner review.",
    ],
    [
      "lastFailureMessage",
      "Database pending status must expose the latest failure reason without reading row values.",
    ],
    [
      "authRetryStatus: authRetry.status",
      "Database pending status must expose auth retry status metadata.",
    ],
    [
      "authRetryUntil: authRetry.until",
      "Database pending status must expose auth retry retry-at metadata.",
    ],
    [
      "getAuthRetrySnapshot",
      "Database pending status must read auth retry backoff without reading row values.",
    ],
    [
      "lastSyncAt: getLastDatabaseSyncAt()",
      "Database pending status must expose the last sync timestamp.",
    ],
    [
      "export async function getCloudDatabaseManifestSummary",
      "Database sync client must expose cloud database manifest summary for core-domain compare.",
    ],
    [
      'call({ action: "summary" })',
      "Database sync client manifest summary must use the existing summary action.",
    ],
  ]) {
    assertSourceIncludes(
      files.accountDatabaseSync,
      accountDatabaseSync,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "PENDING_STATUS_SYNC_DELAY_MS",
      "Database cloud sync hook must define a short pending-status quick sync delay.",
    ],
    [
      "scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS)",
      "Database pending queue status events must trigger quick sync without waiting for the normal poll.",
    ],
    [
      "detail.pending + detail.queued + detail.syncLogPending",
      "Database pending status quick sync must include cloud key, memory, and sync_log queues.",
    ],
    [
      "DATABASE_PENDING_STORAGE_KEYS",
      "Database cloud sync must restrict cross-tab quick syncs to database pending storage keys.",
    ],
    [
      'DATABASE_PENDING_STORAGE_KEYS.has(event.key ?? "")',
      "Database cross-tab pending storage changes must trigger quick sync without waiting for the normal poll.",
    ],
    [
      "void runSync({ forceLease: true, quick: true });",
      "Database foreground and online sync must let the visible tab take over the cloud sync lease.",
    ],
    [
      'window.addEventListener("online", handleForeground)',
      "Database cloud sync must retry immediately when the network comes back online.",
    ],
    [
      'document.addEventListener("visibilitychange", handleVisible)',
      "Database cloud sync must retry immediately when a tab becomes visible.",
    ],
    [
      "window.clearTimeout(quickSyncTimer)",
      "Database pending-status quick sync timers must be cleaned up on unmount.",
    ],
  ]) {
    assertSourceIncludes(
      files.databaseCloudSync,
      databaseCloudSync,
      snippet,
      message
    );
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-cloud-master-reconcile-report"',
      "Cloud master reconcile report must expose a stable local export format.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Cloud master reconcile must lock the target architecture to cloud master plus local hot cache.",
    ],
    [
      'report_status: "local-audit-only"',
      "Cloud master reconcile must remain a local audit report, not a migration writer.",
    ],
    [
      "This report reads local metadata counts and sync state only.",
      "Cloud master reconcile must document the metadata-only privacy boundary.",
    ],
    [
      "It does not read page body text, comment bodies, file bytes, token values, or upload data.",
      "Cloud master reconcile must explicitly forbid sensitive content reads and uploads.",
    ],
    [
      "ordinary_sync_pending_only: true",
      "Cloud master reconcile must preserve pending-only ordinary sync.",
    ],
    [
      "local_writes_first_hit_cache_then_pending_queue: true",
      "Cloud master reconcile must preserve local-speed writes through cache and pending queue.",
    ],
    [
      "cloud_wins_by_default_except_unuploaded_pending_edits: true",
      "Cloud master reconcile must preserve the cloud-wins conflict rule with local pending exceptions.",
    ],
    [
      'id: "pages"',
      "Cloud master reconcile must cover pages.",
    ],
    [
      'id: "daily-notes"',
      "Cloud master reconcile must cover daily notes.",
    ],
    [
      'id: "meetings"',
      "Cloud master reconcile must cover meetings.",
    ],
    [
      'id: "databases"',
      "Cloud master reconcile must cover databases.",
    ],
    [
      'id: "files"',
      "Cloud master reconcile must cover files.",
    ],
    [
      'id: "comments"',
      "Cloud master reconcile must cover comments.",
    ],
    [
      'id: "versions"',
      "Cloud master reconcile must cover versions.",
    ],
    [
      'id: "wiki-links"',
      "Cloud master reconcile must cover knowledge links.",
    ],
    [
      'id: "module-config"',
      "Cloud master reconcile must cover module and sidebar settings.",
    ],
    [
      "workspace_settings、account_settings、module_settings",
      "Cloud master reconcile must reflect the workspace/account/module settings boundary.",
    ],
    [
      "账号级偏好和模块运行态逐项接入云端 settings API",
      "Cloud master reconcile must keep the next account/module settings cloud API action explicit.",
    ],
    [
      'id: "permissions"',
      "Cloud master reconcile must cover permissions.",
    ],
    [
      'id: "recent-hot-cache"',
      "Cloud master reconcile must cover recent-content hot cache policy.",
    ],
    [
      'id: "user-selected-cache"',
      "Cloud master reconcile must cover user-selected local cache policy.",
    ],
    [
      'id: "pending-queue"',
      "Cloud master reconcile must cover the pending upload queue.",
    ],
    [
      'id: "rebuildable-cache"',
      "Cloud master reconcile must cover rebuildable cache policy.",
    ],
    [
      "页面、数据库、hot_cache_preferences 和常用 workspace_settings 已有重建入口",
      "Cloud master reconcile must treat workspace_settings as part of the rebuildable cloud-master cache path.",
    ],
    [
      "指定数据库常驻本地",
      "Cloud master reconcile must reflect pinned database hot cache selection.",
    ],
    [
      "只上传 setting metadata，不上传本地缓存",
      "Cloud master reconcile must keep user-selected hot cache settings pending-only.",
    ],
    [
      'id: "cloud-manifest-compare"',
      "Cloud master reconcile must require cloud manifest comparison before migration.",
    ],
    [
      'id: "dry-run-migration"',
      "Cloud master reconcile must require dry-run migration before real migration.",
    ],
    [
      'id: "post-migration-cache-rebuild"',
      "Cloud master reconcile must require local cache rebuild after migration.",
    ],
    [
      "migration_checks",
      "Cloud master reconcile must expose per-domain migration dry-run checks.",
    ],
    [
      "cloud_evidence_required",
      "Cloud master reconcile must list cloud-side evidence required for each dry-run check.",
    ],
    [
      "local_evidence_required",
      "Cloud master reconcile must list local-side evidence required for each dry-run check.",
    ],
    [
      "pending_queue_rule",
      "Cloud master reconcile must preserve pending-only rules in each dry-run check.",
    ],
    [
      "rebuild_proof_required",
      "Cloud master reconcile must require local cache rebuild proof by domain.",
    ],
    [
      "重复风险",
      "Cloud master reconcile must account for duplicate risk by domain.",
    ],
    [
      "遗漏风险",
      "Cloud master reconcile must account for missing-data risk by domain.",
    ],
    [
      "旧缓存覆盖风险",
      "Cloud master reconcile must account for stale-cache overwrite risk by domain.",
    ],
    [
      'id: "check-daily-notes"',
      "Cloud master reconcile must include a daily-note date-index dry-run check.",
    ],
    [
      'id: "check-files"',
      "Cloud master reconcile must include a metadata-only file dry-run check.",
    ],
  ]) {
    assertSourceIncludes(
      files.cloudMasterReconcile,
      cloudMasterReconcile,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "fetch(",
      "Cloud master reconcile must not call network APIs.",
    ],
    [
      "localStorage.setItem",
      "Cloud master reconcile must not write browser storage.",
    ],
    [
      "db.run",
      "Cloud master reconcile must not mutate the local database.",
    ],
    [
      "INSERT INTO",
      "Cloud master reconcile must not insert rows.",
    ],
    [
      "UPDATE ",
      "Cloud master reconcile must not update rows.",
    ],
    [
      "DELETE FROM",
      "Cloud master reconcile must not delete rows.",
    ],
  ]) {
    assertSourceExcludes(
      files.cloudMasterReconcile,
      cloudMasterReconcile,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'format: "zhinote-cloud-native-fluidity-report"',
      "Cloud-native fluidity report must expose a stable export format.",
    ],
    [
      'report_status: "metadata-only-local-health-check"',
      "Cloud-native fluidity report must stay metadata-only.",
    ],
    [
      'architecture_target: "cloud-master-local-hot-cache"',
      "Cloud-native fluidity report must align to cloud master plus local hot cache.",
    ],
    [
      "local_health_check_only: true",
      "Cloud-native fluidity report must be a local health check only.",
    ],
    [
      "sends_network_requests: false",
      "Cloud-native fluidity report must not send network requests.",
    ],
    [
      "writes_server_data: false",
      "Cloud-native fluidity report must not write server data.",
    ],
    [
      "uploads_workspace_data: false",
      "Cloud-native fluidity report must not upload workspace data.",
    ],
    [
      "mutates_local_cache_records: false",
      "Cloud-native fluidity report must not mutate local cache records.",
    ],
    [
      "clears_local_cache: false",
      "Cloud-native fluidity report must not clear local cache.",
    ],
    [
      "includes_raw_workspace_content: false",
      "Cloud-native fluidity report must not include raw workspace content.",
    ],
    [
      "LOCAL_FIRST_TARGET_MS",
      "Cloud-native fluidity report must define a local-first timing target.",
    ],
    [
      "PAGE_OPEN_TARGET_MS",
      "Cloud-native fluidity report must define a page-open timing target.",
    ],
    [
      "DATABASE_ROW_OPEN_TARGET_MS",
      "Cloud-native fluidity report must define a database row page-open timing target.",
    ],
    [
      "database-row-open-target",
      "Cloud-native fluidity report must include a database row page-open gate.",
    ],
    [
      "average_database_row_open_ms",
      "Cloud-native fluidity report must summarize database row page-open timing separately.",
    ],
    [
      'metric("database-row-open"',
      "Cloud-native fluidity report must expose database row page-open timing as a metric.",
    ],
    [
      "hot_cache_index_rows",
      "Cloud-native fluidity report must include hot cache index evidence.",
    ],
    [
      "performance_samples",
      "Cloud-native fluidity report must include local performance sample evidence.",
    ],
    [
      "pending-queue-visible",
      "Cloud-native fluidity report must check pending queue visibility.",
    ],
    [
      "web_beta_sync_gate",
      "Cloud-native fluidity report must expose a Web Beta sync gate.",
    ],
    [
      "can_request_owner_review_now",
      "Cloud-native fluidity report must say whether sync can enter owner review.",
    ],
    [
      "can_enable_cloud_source_of_truth_now: false",
      "Cloud-native fluidity report must keep real cloud source-of-truth enablement disabled.",
    ],
    [
      "blocking_reasons",
      "Cloud-native fluidity report must explain Web Beta sync blockers.",
    ],
    [
      "required_before_owner_review",
      "Cloud-native fluidity report must list owner-review prerequisites.",
    ],
    [
      "本地只是热缓存",
      "Cloud-native fluidity report must state that local data is a hot cache.",
    ],
  ]) {
    assertSourceIncludes(
      files.cloudNativeFluidityReport,
      cloudNativeFluidityReport,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "local-performance-diagnosis",
      "Sync UI must render a stable local fluency diagnosis panel.",
    ],
    [
      "LOCAL_PERFORMANCE_DIAGNOSIS_TARGETS",
      "Sync UI must keep explicit local fluency targets beside the panel.",
    ],
    [
      'kind: "daily-calendar"',
      "Sync local fluency diagnosis must cover the daily notes calendar.",
    ],
    [
      'kind: "meeting-calendar"',
      "Sync local fluency diagnosis must cover the ZhiHui meeting calendar.",
    ],
    [
      'kind: "page-open"',
      "Sync local fluency diagnosis must cover page opening.",
    ],
    [
      'kind: "database-row-open"',
      "Sync local fluency diagnosis must cover database row page opening.",
    ],
    [
      "数据库行平均",
      "Sync UI must show database row page-open performance averages.",
    ],
    [
      'kind: "page-peek"',
      "Sync local fluency diagnosis must cover page peek previews.",
    ],
    [
      "buildLocalPerformanceDiagnosis",
      "Sync UI must turn local performance snapshots into a diagnosis.",
    ],
    [
      "LocalPerformanceDiagnosisPill",
      "Sync UI must expose clear pass/warn/needs-data status labels.",
    ],
    [
      "样本不足",
      "Sync UI must treat insufficient samples as unknown, not as success.",
    ],
    [
      "需优化",
      "Sync UI must surface slow local-first paths as follow-up work.",
    ],
    [
      "下一步：{diagnosis.nextAction}",
      "Sync UI must give the owner the next optimization target.",
    ],
    [
      "不读取页面正文、数据库值、评论正文或文件字节",
      "Sync UI must explain the privacy boundary for local fluency snapshots.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "page.content_text",
      "Cloud-native fluidity report must not access page content text.",
    ],
    [
      "page.content_yjs",
      "Cloud-native fluidity report must not access page Yjs content.",
    ],
    [
      "database.description",
      "Cloud-native fluidity report must not access database descriptions.",
    ],
    [
      "field_values",
      "Cloud-native fluidity report must not access database row values.",
    ],
    [
      "comment.body",
      "Cloud-native fluidity report must not access comment bodies.",
    ],
    [
      "file.dataUrl",
      "Cloud-native fluidity report must not access file bytes.",
    ],
    [
      "file.textContent",
      "Cloud-native fluidity report must not access file text.",
    ],
    [
      "fetch(",
      "Cloud-native fluidity report must not call network APIs.",
    ],
    [
      "localStorage.setItem",
      "Cloud-native fluidity report must not write browser storage.",
    ],
    [
      "db.run",
      "Cloud-native fluidity report must not mutate the local database.",
    ],
    [
      "INSERT INTO",
      "Cloud-native fluidity report must not insert rows.",
    ],
    [
      "UPDATE ",
      "Cloud-native fluidity report must not update rows.",
    ],
    [
      "DELETE FROM",
      "Cloud-native fluidity report must not delete rows.",
    ],
  ]) {
    assertSourceExcludes(
      files.cloudNativeFluidityReport,
      cloudNativeFluidityReport,
      snippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      "buildCloudMasterReconcileReport",
      "Sync UI must build the cloud master reconcile report.",
    ],
    [
      "CloudMasterReconcilePanel",
      "Sync UI must render the cloud master reconcile panel.",
    ],
    [
      "全域上云对账",
      "Sync UI must expose the cloud migration reconcile section.",
    ],
    [
      "handleExportCloudMasterReconcile",
      "Sync UI must export the local reconcile report.",
    ],
    [
      "迁移 dry-run 明细",
      "Sync UI must render per-domain migration dry-run checks.",
    ],
    [
      "CloudMasterMigrationCheckRow",
      "Sync UI must render migration dry-run check rows.",
    ],
    [
      "getPageModuleCounts",
      "Sync UI must include comments, versions, and link metadata counts.",
    ],
    [
      "isPageSyncEnabled()",
      "Sync UI must report page cloud-primary status.",
    ],
    [
      "isDatabaseSyncEnabled()",
      "Sync UI must report database cloud-primary status.",
    ],
    [
      "buildCloudNativeFluidityReport",
      "Sync UI must build the cloud-native fluidity health report.",
    ],
    [
      "CloudNativeFluidityPanel",
      "Sync UI must render the cloud-native fluidity panel.",
    ],
    [
      "云原生流畅度健康检查",
      "Sync UI must expose the cloud-native fluidity health section.",
    ],
    [
      "handleExportCloudNativeFluidityReport",
      "Sync UI must export the cloud-native fluidity report.",
    ],
    [
      "预热本机入口",
      "Sync UI must let the user run metadata-only route warmup from the fluidity panel.",
    ],
    [
      "Web Beta 同步门禁",
      "Sync UI must render the Web Beta sync fluidity gate.",
    ],
    [
      "真实云端主库启用：仍关闭",
      "Sync UI must keep real cloud source-of-truth enablement visibly disabled.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "export function ApiGuardPanel",
      "Shared API guard panel must be exported for sync UI reuse.",
    ],
    [
      "function ApiGuardSummaryCard",
      "Shared API guard panel must render summary cards.",
    ],
    [
      "function ApiGuardFieldRow",
      "Shared API guard panel must render allowed and forbidden fields.",
    ],
    [
      "function ApiGuardFixtureRow",
      "Shared API guard panel must render local validator fixtures.",
    ],
    [
      "function ApiGuardGateRow",
      "Shared API guard panel must render enablement gates.",
    ],
    [
      "function ApiGuardValidationPill",
      "Shared API guard panel must render validation status badges.",
    ],
  ]) {
    assertSourceIncludes(files.apiGuardPanel, apiGuardPanel, snippet, message);
  }

  for (const [file, source, snippet, message] of [
    [
      files.packageJson,
      packageJson,
      '"verify:replay-harness": "node scripts/verify-replay-harness-safety.mjs"',
      "Package scripts must expose replay harness safety verification.",
    ],
    [
      files.smokeTestPlan,
      smokeTestPlan,
      "npm run verify:replay-harness",
      "Smoke test plan must require replay harness safety verification.",
    ],
    [
      files.smokeTestVerifier,
      smokeTestVerifier,
      '"verify:replay-harness"',
      "Smoke verifier must check replay harness safety script presence.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Replay harness safety verification passed",
      "Replay harness verifier must expose a clear pass signal.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Local harness and fixture must not start network calls.",
      "Replay harness verifier must block network execution in harness and fixture.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Local harness and fixture must not read secrets or env values.",
      "Replay harness verifier must block env/secret reads in harness and fixture.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Replay route must remain a disabled Web Beta stub.",
      "Replay harness verifier must keep replay route disabled.",
    ],
  ]) {
    assertSourceIncludes(file, source, snippet, message);
  }

  const apiStubRows = extractApiStubs(apiStubs);
  const routeCalls = extractRouteCalls(launchChecklist);
  if (!launchChecklist.includes("WEB_BETA_API_STUBS.map")) {
    fail("Launch checklist must derive Web Beta API route checks from WEB_BETA_API_STUBS.map");
  }
  if (!routePreflight.includes("WEB_BETA_API_STUBS.map")) {
    fail("Route preflight must derive Web Beta API route checks from WEB_BETA_API_STUBS.map");
  }

  for (const stub of apiStubRows) {
    const routeFile = routeFileForApiPath(stub.path);
    const routeLabel = `${stub.method} ${stub.path}`;
    assertRouteExport(routeFile, stub.method, routeLabel);

    if (isCloudAlphaStub(stub.id)) {
      assertRouteGuard(routeFile, `cloudNotConfiguredResponse("${stub.id}")`, routeLabel);
    } else if (stub.id === "sync-push") {
      assertRouteGuard(
        routeFile,
        "buildSyncPushApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "sync-pull") {
      assertRouteGuard(
        routeFile,
        "buildSyncPullApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "comment-version-replay") {
      assertRouteGuard(
        routeFile,
        "buildCommentVersionReplayApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "cloud-manifest-compare") {
      assertRouteGuard(
        routeFile,
        "buildCloudManifestCompareApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "cloud-migration-apply") {
      assertRouteGuard(
        routeFile,
        "buildCloudMigrationApplyApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "file-presign") {
      assertRouteGuard(
        routeFile,
        "buildFilePresignApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "audit-events") {
      assertRouteGuard(
        routeFile,
        "buildAuditEventsApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "permission-check") {
      assertRouteGuard(
        routeFile,
        "buildPermissionCheckApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "restore-preview") {
      assertRouteGuard(
        routeFile,
        "buildRestorePreviewApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "restore-apply") {
      assertRouteGuard(
        routeFile,
        "buildRestoreApplyApiDisabledResponse",
        routeLabel
      );
    } else {
      assertRouteGuard(
        routeFile,
        `buildWebBetaApiStubResponse("${stub.id}")`,
        routeLabel
      );
    }
  }

  assertRouteExport("src/app/api/ai/run/route.ts", "POST", "POST /api/ai/run");
  assertRouteGuard(
    "src/app/api/ai/run/route.ts",
    "buildAiRunDisabledResponse",
    "POST /api/ai/run"
  );
  assertRouteExport(
    "src/app/api/web-beta/environment-preflight/route.ts",
    "GET",
    "GET /api/web-beta/environment-preflight"
  );
  assertRouteGuard(
    "src/app/api/web-beta/environment-preflight/route.ts",
    "buildWebBetaEnvironmentPreflight",
    "GET /api/web-beta/environment-preflight"
  );
  assertSourceIncludes(
    files.auditEventEnvelope,
    auditEventEnvelope,
    'format: "zhinote-audit-event-envelope-contract"',
    "Audit event envelope must expose a stable export format."
  );
  assertSourceIncludes(
    files.auditEventEnvelope,
    auditEventEnvelope,
    "buildAuditEventEnvelopeContract",
    "Audit event envelope must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'contract_status: "local-redaction-envelope-only"',
      "Audit event envelope must remain local redaction-only.",
    ],
    [
      "can_export_envelope_now: true",
      "Audit event envelope may only be exported locally.",
    ],
    [
      "can_record_server_audit_event_now: false",
      "Audit event envelope must not record server audit events.",
    ],
    [
      "can_read_request_body_now: false",
      "Audit event envelope must not read request bodies.",
    ],
    [
      "can_write_audit_events_table_now: false",
      "Audit event envelope must not write audit_events.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Audit event envelope must not upload workspace data.",
    ],
    [
      'disabled_endpoint: "/api/audit/events"',
      "Audit event envelope must keep audit endpoint disabled.",
    ],
    [
      "metadata_only_envelope: true",
      "Audit event envelope must stay metadata-only.",
    ],
    [
      "endpoint_disabled: true",
      "Audit event envelope must preserve disabled endpoint boundary.",
    ],
    [
      "reads_request_body: false",
      "Audit event envelope must not read request bodies.",
    ],
    [
      "reads_page_body_text: false",
      "Audit event envelope must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Audit event envelope must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Audit event envelope must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Audit event envelope must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Audit event envelope must not read prompt text.",
    ],
    [
      "reads_model_raw_output: false",
      "Audit event envelope must not read raw AI output.",
    ],
    [
      "reads_secret_values: false",
      "Audit event envelope must not read secrets.",
    ],
    [
      "exposes_secret_values: false",
      "Audit event envelope must not expose secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Audit event envelope must not write server audit logs.",
    ],
    [
      "writes_workspace_data: false",
      "Audit event envelope must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Audit event envelope must not upload workspace data.",
    ],
    [
      "requires_authenticated_actor: true",
      "Audit event envelope must require authenticated actor.",
    ],
    [
      "requires_workspace_membership: true",
      "Audit event envelope must require workspace membership.",
    ],
    [
      "requires_permission_decision: true",
      "Audit event envelope must require permission decision.",
    ],
    [
      "requires_redaction_before_write: true",
      "Audit event envelope must require redaction before writes.",
    ],
    [
      "requires_retention_policy: true",
      "Audit event envelope must require retention policy.",
    ],
    [
      "event_id",
      "Audit event envelope must include allowed event id.",
    ],
    [
      "metadata_counts",
      "Audit event envelope must include count-only metadata.",
    ],
    [
      "metadata_hashes",
      "Audit event envelope must include hash-only metadata.",
    ],
    [
      "permission_decision_id",
      "Audit event envelope must link permission decisions.",
    ],
    [
      "confirmation_receipt_id",
      "Audit event envelope must link confirmations.",
    ],
    [
      "retention_class",
      "Audit event envelope must include retention class.",
    ],
    [
      "page_body_text",
      "Audit event envelope must forbid page body text.",
    ],
    [
      "database_cell_values",
      "Audit event envelope must forbid database values.",
    ],
    [
      "comment_body",
      "Audit event envelope must forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Audit event envelope must forbid file bytes.",
    ],
    [
      "backup_payload",
      "Audit event envelope must forbid backup payloads.",
    ],
    [
      "prompt_text",
      "Audit event envelope must forbid prompt text.",
    ],
    [
      "model_raw_output",
      "Audit event envelope must forbid raw AI output.",
    ],
    ["token", "Audit event envelope must forbid tokens."],
    ["cookie", "Audit event envelope must forbid cookies."],
    [
      "signed_download_url",
      "Audit event envelope must forbid signed URLs.",
    ],
    [
      "raw_request_body",
      "Audit event envelope must forbid raw request bodies.",
    ],
    [
      "environment_value",
      "Audit event envelope must forbid environment values.",
    ],
    [
      "endpoint-disabled",
      "Audit event envelope must include endpoint disabled redaction check.",
    ],
    [
      "allowed-field-envelope",
      "Audit event envelope must include allowed-field check.",
    ],
    [
      "permission-decision-link",
      "Audit event envelope must include permission decision check.",
    ],
    [
      "content-field-denylist",
      "Audit event envelope must include content denylist check.",
    ],
  ]) {
    assertSourceIncludes(
      files.auditEventEnvelope,
      auditEventEnvelope,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.auditEventsApiStub,
    auditEventsApiStub,
    'format: "zhinote-audit-events-api-disabled"',
    "Audit events API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.auditEventsApiStub,
    auditEventsApiStub,
    "buildAuditEventsApiDisabledResponse",
    "Audit events API guard must expose a reusable disabled response builder."
  );
  for (const [snippet, message] of [
    ['api_id: "audit-events"', "Audit events API guard must identify the audit-events route."],
    ['path: "/api/audit/events"', "Audit events API guard must bind to /api/audit/events."],
    ['method: "POST"', "Audit events API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "Audit events API guard must stay disabled."],
    ["can_record_server_audit_events_now: false", "Audit events API guard must not record server audit events."],
    ["can_read_request_body_now: false", "Audit events API guard must not read request bodies."],
    ["can_read_event_payload_now: false", "Audit events API guard must not read event payloads."],
    ["can_write_audit_events_table_now: false", "Audit events API guard must not write audit_events."],
    ["can_write_server_audit_log_now: false", "Audit events API guard must not write server audit logs."],
    ["can_read_page_body_text_now: false", "Audit events API guard must not read page text."],
    ["can_read_database_values_now: false", "Audit events API guard must not read database values."],
    ["can_read_file_bytes_now: false", "Audit events API guard must not read file bytes."],
    ["can_read_prompt_text_now: false", "Audit events API guard must not read prompts."],
    ["can_upload_workspace_data_now: false", "Audit events API guard must not upload workspace data."],
    ["can_expose_secret_values_now: false", "Audit events API guard must not expose secrets."],
    ["no_request_argument: true", "Audit events API guard must not accept a request argument."],
    ["reads_request_body: false", "Audit events API guard must keep body reads disabled."],
    ["metadata_only_request: true", "Audit events API guard must keep the future request metadata-only."],
    ["accepts_event_payload: false", "Audit events API guard must not accept event payloads now."],
    ["executes_actions: false", "Audit events API guard must not execute actions."],
    ["writes_audit_events_table: false", "Audit events API guard must not write audit_events table."],
    ["writes_server_audit_log: false", "Audit events API guard must not write server logs."],
    ["writes_workspace_data: false", "Audit events API guard must not write workspace data."],
    ["uploads_workspace_data: false", "Audit events API guard must not upload workspace data."],
    ["reads_block_text: false", "Audit events API guard must not read block text."],
    ["reads_database_row_values: false", "Audit events API guard must not read database row values."],
    ["reads_comment_bodies: false", "Audit events API guard must not read comment bodies."],
    ["reads_backup_payload: false", "Audit events API guard must not read backups."],
    ["reads_model_raw_output: false", "Audit events API guard must not read raw AI output."],
    ["reads_secret_values: false", "Audit events API guard must not read secrets."],
    ["records_signed_urls: false", "Audit events API guard must not record signed URLs."],
    ["requires_authenticated_actor_before_enablement: true", "Audit events API guard must require authenticated actors."],
    ["requires_workspace_membership_before_enablement: true", "Audit events API guard must require workspace membership."],
    ["requires_permission_decision_before_enablement: true", "Audit events API guard must require permission decision linkage."],
    ["requires_redaction_before_enablement: true", "Audit events API guard must require redaction."],
    ["requires_retention_policy_before_enablement: true", "Audit events API guard must require retention policy."],
    ["requires_tamper_resistant_storage_before_enablement: true", "Audit events API guard must require tamper-resistant storage."],
    ["requires_owner_audit_export_before_enablement: true", "Audit events API guard must require owner audit export."],
    ['schema_status: "planned-metadata-only"', "Audit events API guard must expose metadata-only request schema."],
    ['schema_status: "planned-receipt-only"', "Audit events API guard must expose receipt-only response schema."],
    ["http_status: 501", "Audit events API guard must keep the disabled HTTP status explicit."],
    ["returns_recorded_event_id: false", "Audit events API guard must not return a recorded event id now."],
    ["returns_audit_payload: false", "Audit events API guard must not return audit payloads."],
    ["returns_sensitive_payload: false", "Audit events API guard must not return sensitive payloads."],
    ["writes_audit_event: false", "Audit events API guard must not write events."],
  ]) {
    assertSourceIncludes(files.auditEventsApiStub, auditEventsApiStub, snippet, message);
  }
  for (const snippet of [
    "buildWebBetaApiStubResponse(\"audit-events\")",
    "workspace_id",
    "actor_user_id",
    "device_id",
    "event_type",
    "resource_type",
    "resource_id",
    "operation_status",
    "metadata_counts",
    "metadata_hashes",
    "changed_field_names",
    "permission_decision_id",
    "confirmation_receipt_id",
    "redaction_profile",
    "retention_class",
    "client_event_id",
    "occurred_at",
    "page_body_text",
    "block_text",
    "database_cell_values",
    "comment_body",
    "file_bytes",
    "backup_payload",
    "prompt_text",
    "model_raw_output",
    "token",
    "cookie",
    "password",
    "secret_values",
    "signed_upload_url",
    "signed_download_url",
    "public_url",
    "raw_request_body",
    "environment_value",
    "local_file_path",
    "sql_text",
    'format: "zhinote-audit-events-api-validator-fixtures"',
    'validator_status: "not-executing-route"',
    "forbidden_field_names",
    "forbidden_fields_covered",
    '"metadata-sync-event"',
    '"high-risk-confirmation-event"',
    '"content-fields-blocked"',
    '"file-backup-bytes-blocked"',
    '"ai-payload-blocked"',
    '"credential-fields-blocked"',
    '"url-path-fields-blocked"',
    '"sql-raw-body-blocked"',
    '"authenticated-actor"',
    '"workspace-membership"',
    '"metadata-only-schema-validation"',
    '"permission-decision-link"',
    '"retention-policy"',
    '"tamper-resistant-storage"',
    '"owner-audit-export"',
  ]) {
    assertSourceIncludes(
      files.auditEventsApiStub,
      auditEventsApiStub,
      snippet,
      "Audit events API guard must preserve metadata schema, fixtures, and enablement gates."
    );
  }
  assertSourceIncludes(
    files.auditEventsRoute,
    auditEventsRoute,
    "buildAuditEventsApiDisabledResponse",
    "Audit events route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.auditEventsRoute,
    auditEventsRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Audit events route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildAuditEventsApiDisabledResponse",
    "Sync UI must build the audit events API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportAuditEventsApiGuard",
    "Sync UI must export the audit events API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "审计事件 API 防护",
    "Sync UI must render the audit events API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出审计 API 防护",
    "Sync UI must render the audit events API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Fixture 字段",
    "Sync UI must summarize audit events fixture field coverage."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "auditEventsApiGuard.disabled_response_contract.http_status",
    "Sync UI must render the audit events disabled HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "allowedFields={auditEventsApiGuard.request_schema.allowed_fields}",
    "Sync UI must render audit events allowed fields."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "forbiddenFields={auditEventsApiGuard.request_schema.forbidden_fields}",
    "Sync UI must render audit events forbidden fields."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={auditEventsApiGuard.local_validator_report.fixtures}",
    "Sync UI must render audit events validator fixtures."
  );
  assertSourceIncludes(
    files.apiGuardPanel,
    apiGuardPanel,
    "forbidden_field_names",
    "Sync UI must render forbidden audit fixture field names."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    'format: "zhinote-permission-check-envelope-contract"',
    "Permission check envelope must expose a stable export format."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckEnvelopeContract",
    "Permission check envelope must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'contract_status: "local-permission-envelope-only"',
      "Permission check envelope must remain local-only.",
    ],
    [
      "can_export_permission_envelope_now: true",
      "Permission check envelope may only be exported locally.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission check envelope must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission check envelope must not read request bodies.",
    ],
    [
      "can_create_users_now: false",
      "Permission check envelope must not create users.",
    ],
    [
      "can_grant_access_now: false",
      "Permission check envelope must not grant access.",
    ],
    [
      "can_revoke_access_now: false",
      "Permission check envelope must not revoke access.",
    ],
    [
      "can_write_server_audit_log_now: false",
      "Permission check envelope must not write audit logs.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Permission check envelope must not upload workspace data.",
    ],
    [
      'disabled_endpoint: "/api/permissions/check"',
      "Permission check envelope must keep permission endpoint disabled.",
    ],
    [
      "metadata_only_request: true",
      "Permission check envelope must stay metadata-only.",
    ],
    [
      "reads_request_body: false",
      "Permission check envelope must not read request bodies.",
    ],
    [
      "creates_users: false",
      "Permission check envelope must not create users.",
    ],
    [
      "grants_access: false",
      "Permission check envelope must not grant access.",
    ],
    [
      "revokes_access: false",
      "Permission check envelope must not revoke access.",
    ],
    [
      "reads_page_body_text: false",
      "Permission check envelope must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Permission check envelope must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission check envelope must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Permission check envelope must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission check envelope must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission check envelope must not read secrets.",
    ],
    [
      "exposes_secret_values: false",
      "Permission check envelope must not expose secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Permission check envelope must not write audit logs.",
    ],
    [
      "writes_workspace_data: false",
      "Permission check envelope must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission check envelope must not upload workspace data.",
    ],
    [
      "requires_authenticated_actor: true",
      "Permission check envelope must require authenticated actor.",
    ],
    [
      "requires_workspace_membership: true",
      "Permission check envelope must require workspace membership.",
    ],
    [
      "requires_role_membership_lookup: true",
      "Permission check envelope must require role lookup.",
    ],
    [
      "requires_high_risk_confirmation: true",
      "Permission check envelope must require high-risk confirmation.",
    ],
    [
      "requires_audit_event_envelope: true",
      "Permission check envelope must require audit envelope.",
    ],
    ["request_id", "Permission check envelope must include request id."],
    ["actor_user_id", "Permission check envelope must include actor id."],
    ["actor_role_id", "Permission check envelope must include actor role."],
    ["resource_type", "Permission check envelope must include resource type."],
    ["action_id", "Permission check envelope must include action id."],
    [
      "confirmation_receipt_id",
      "Permission check envelope must include confirmation receipt id.",
    ],
    [
      "audit_event_envelope_id",
      "Permission check envelope must link audit envelope.",
    ],
    ["decision_id", "Permission check envelope must include decision id."],
    ["allowed", "Permission check envelope must include allow result."],
    [
      "decision_status",
      "Permission check envelope must include decision status.",
    ],
    [
      "page_body_text",
      "Permission check envelope must forbid page body text.",
    ],
    [
      "database_cell_values",
      "Permission check envelope must forbid database values.",
    ],
    [
      "comment_body",
      "Permission check envelope must forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Permission check envelope must forbid file bytes.",
    ],
    [
      "backup_payload",
      "Permission check envelope must forbid backup payload.",
    ],
    [
      "prompt_text",
      "Permission check envelope must forbid prompt text.",
    ],
    [
      "model_raw_output",
      "Permission check envelope must forbid raw AI output.",
    ],
    ["token", "Permission check envelope must forbid tokens."],
    ["cookie", "Permission check envelope must forbid cookies."],
    [
      "signed_download_url",
      "Permission check envelope must forbid signed URLs.",
    ],
    [
      "raw_request_body",
      "Permission check envelope must forbid raw request bodies.",
    ],
    [
      "environment_value",
      "Permission check envelope must forbid environment values.",
    ],
    [
      "owner-cloud-sync-check",
      "Permission check envelope must include owner cloud sync scenario.",
    ],
    [
      "researcher-cloud-sync-deny",
      "Permission check envelope must include researcher denial scenario.",
    ],
    [
      "viewer-ai-run-deny",
      "Permission check envelope must include viewer AI denial scenario.",
    ],
    [
      "endpoint-disabled",
      "Permission check envelope must include endpoint disabled gate.",
    ],
    [
      "role-membership-lookup",
      "Permission check envelope must include role membership gate.",
    ],
    [
      "audit-envelope-before-result",
      "Permission check envelope must include audit envelope gate.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionCheckEnvelope,
      permissionCheckEnvelope,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckRequestFields",
    "Permission check envelope must export reusable request fields for the route stub."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckResponseFields",
    "Permission check envelope must export reusable response fields for the route stub."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckForbiddenFields",
    "Permission check envelope must export reusable forbidden fields for the route stub."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    'format: "zhinote-permission-check-api-disabled"',
    "Permission check API stub must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionCheckApiDisabledResponse",
    "Permission check API stub must expose a reusable disabled response builder."
  );
  for (const [snippet, message] of [
    [
      'api_id: "permission-check"',
      "Permission check API stub must identify the permission-check route.",
    ],
    [
      'path: "/api/permissions/check"',
      "Permission check API stub must bind to /api/permissions/check.",
    ],
    [
      'method: "POST"',
      "Permission check API stub must document the POST method.",
    ],
    [
      'stub_status: "disabled-local-stub"',
      "Permission check API stub must stay disabled by default.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission check API stub must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission check API stub must not read request bodies.",
    ],
    [
      "can_create_users_now: false",
      "Permission check API stub must not create users.",
    ],
    [
      "can_grant_access_now: false",
      "Permission check API stub must not grant access.",
    ],
    [
      "can_revoke_access_now: false",
      "Permission check API stub must not revoke access.",
    ],
    [
      "can_write_server_audit_log_now: false",
      "Permission check API stub must not write audit logs.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Permission check API stub must not upload workspace data.",
    ],
    [
      'base_stub: buildWebBetaApiStubResponse("permission-check")',
      "Permission check API stub must remain tied to the global disabled API stub registry.",
    ],
    [
      "no_request_argument: true",
      "Permission check API stub must document that the route does not accept a request object.",
    ],
    [
      "reads_request_body: false",
      "Permission check API stub must keep body reads disabled.",
    ],
    [
      "metadata_only_request: true",
      "Permission check API stub must keep the planned request metadata-only.",
    ],
    [
      "executes_actions: false",
      "Permission check API stub must not execute protected actions.",
    ],
    [
      "reads_page_body_text: false",
      "Permission check API stub must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission check API stub must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission check API stub must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Permission check API stub must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission check API stub must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission check API stub must not read secrets.",
    ],
    [
      "schema_status: \"planned-metadata-only\"",
      "Permission check API stub must expose planned metadata-only request schema status.",
    ],
    [
      "allowed_fields: buildPermissionCheckRequestFields()",
      "Permission check API stub must reuse permission envelope request fields.",
    ],
    [
      "forbidden_fields: buildPermissionCheckForbiddenFields()",
      "Permission check API stub must reuse permission envelope forbidden fields.",
    ],
    [
      "schema_status: \"planned-decision-only\"",
      "Permission check API stub must expose planned decision-only response schema status.",
    ],
    [
      "allowed_fields: buildPermissionCheckResponseFields()",
      "Permission check API stub must reuse permission envelope response fields.",
    ],
    [
      "http_status: 501",
      "Permission check API stub must keep the disabled HTTP status explicit.",
    ],
    [
      "returns_permission_result: false",
      "Permission check API stub must not return executable permission results.",
    ],
    [
      "returns_allow_decision: false",
      "Permission check API stub must not return allow decisions.",
    ],
    [
      "returns_deny_decision: false",
      "Permission check API stub must not return deny decisions.",
    ],
    [
      "authenticated-actor",
      "Permission check API stub must include authenticated actor gate.",
    ],
    [
      "workspace-membership",
      "Permission check API stub must include workspace membership gate.",
    ],
    [
      "metadata-only-schema-validation",
      "Permission check API stub must include metadata-only schema validation gate.",
    ],
    [
      "high-risk-confirmation",
      "Permission check API stub must include high-risk confirmation gate.",
    ],
    [
      "audit-event-envelope",
      "Permission check API stub must include audit event gate.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionCheckApiStub,
      permissionCheckApiStub,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    'format: "zhinote-permission-check-request-validation"',
    "Permission check request validator must expose a stable validation format."
  );
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    "validatePermissionCheckMetadataRequest",
    "Permission check request validator must expose a reusable metadata-only validator."
  );
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    "buildPermissionCheckValidatorReport",
    "Permission check request validator must expose a local fixture report."
  );
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    "PERMISSION_CHECK_REQUEST_VALIDATOR_FIXTURES",
    "Permission check request validator must keep fixed local fixtures."
  );
  for (const [snippet, message] of [
    [
      "metadata-only-accepted",
      "Permission check request validator must accept metadata-only fixture shape.",
    ],
    [
      "rejected-forbidden-payload",
      "Permission check request validator must reject private payload fields.",
    ],
    [
      "rejected-unknown-field",
      "Permission check request validator must reject unknown top-level fields.",
    ],
    [
      "rejected-invalid-shape",
      "Permission check request validator must reject missing or invalid metadata.",
    ],
    [
      "can_execute_permission_now: false",
      "Permission check request validator must not execute permissions.",
    ],
    [
      "echoes_values: false",
      "Permission check request validator must not echo request values.",
    ],
    [
      "stores_raw_request: false",
      "Permission check request validator must not store raw requests.",
    ],
    [
      "reads_page_body_text: false",
      "Permission check request validator must not read page text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission check request validator must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission check request validator must not read comments.",
    ],
    [
      "reads_file_bytes: false",
      "Permission check request validator must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission check request validator must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission check request validator must not read secrets.",
    ],
    [
      "exposes_secret_values: false",
      "Permission check request validator must not expose secrets.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission check request validator must not upload workspace data.",
    ],
    [
      "returns_raw_values: false",
      "Permission check request validator must not return raw values.",
    ],
    [
      "page-body-text-blocked",
      "Permission check request validator must include page text rejection fixture.",
    ],
    [
      "nested-prompt-text-blocked",
      "Permission check request validator must include nested prompt rejection fixture.",
    ],
    [
      "token-blocked",
      "Permission check request validator must include token rejection fixture.",
    ],
    [
      "database-cell-values-blocked",
      "Permission check request validator must include database value rejection fixture.",
    ],
    [
      "comment-body-blocked",
      "Permission check request validator must include comment body rejection fixture.",
    ],
    [
      "file-bytes-blocked",
      "Permission check request validator must include file bytes rejection fixture.",
    ],
    [
      "cookie-blocked",
      "Permission check request validator must include cookie rejection fixture.",
    ],
    [
      "signed-url-blocked",
      "Permission check request validator must include signed URL rejection fixture.",
    ],
    [
      "unknown-payload-field-blocked",
      "Permission check request validator must include unknown payload rejection fixture.",
    ],
    [
      "missing-actor-blocked",
      "Permission check request validator must include missing actor rejection fixture.",
    ],
    [
      "collectForbiddenFieldPaths",
      "Permission check request validator must inspect nested field names.",
    ],
    [
      "buildPermissionCheckRequestFields",
      "Permission check request validator must reuse the envelope request field list.",
    ],
    [
      "buildPermissionCheckForbiddenFields",
      "Permission check request validator must reuse the envelope forbidden field list.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionCheckRequestValidator,
      permissionCheckRequestValidator,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionCheckValidatorReport",
    "Permission check API stub must include the local validator report."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "local_validator_report",
    "Permission check API stub must expose local validator fixture results."
  );
  assertSourceIncludes(
    files.permissionServerTestMatrix,
    permissionServerTestMatrix,
    'format: "zhinote-server-permission-enforcement-test-matrix"',
    "Permission server test matrix must expose a stable matrix format."
  );
  assertSourceIncludes(
    files.permissionServerTestMatrix,
    permissionServerTestMatrix,
    "buildPermissionServerTestMatrix",
    "Permission server test matrix must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'matrix_status: "local-server-test-contract-only"',
      "Permission server test matrix must remain local-only.",
    ],
    [
      "can_run_server_permission_tests_now: false",
      "Permission server test matrix must not run server tests yet.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission server test matrix must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission server test matrix must not read request bodies.",
    ],
    [
      "no_server_execution: true",
      "Permission server test matrix must not execute server behavior.",
    ],
    [
      "metadata_only_request: true",
      "Permission server test matrix must use metadata-only request fixtures.",
    ],
    [
      "stores_raw_request: false",
      "Permission server test matrix must not store raw request values.",
    ],
    [
      "returns_raw_values: false",
      "Permission server test matrix must not return raw values.",
    ],
    [
      "reads_page_body_text: false",
      "Permission server test matrix must not read page text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission server test matrix must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission server test matrix must not read comments.",
    ],
    [
      "reads_file_bytes: false",
      "Permission server test matrix must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission server test matrix must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission server test matrix must not read secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Permission server test matrix must not write audit logs.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission server test matrix must not upload workspace data.",
    ],
    [
      "owner-cloud-sync-confirmed",
      "Permission server test matrix must include owner cloud sync confirmation case.",
    ],
    [
      "researcher-cloud-sync-denied",
      "Permission server test matrix must include researcher cloud sync denial case.",
    ],
    [
      "viewer-export-page-read-only",
      "Permission server test matrix must include viewer read-only export case.",
    ],
    [
      "viewer-edit-portfolio-denied",
      "Permission server test matrix must include viewer portfolio denial case.",
    ],
    [
      "viewer-ai-run-denied",
      "Permission server test matrix must include viewer AI denial case.",
    ],
    [
      "researcher-ai-run-confirmed",
      "Permission server test matrix must include researcher AI confirmation case.",
    ],
    [
      "owner-admin-confirmed",
      "Permission server test matrix must include owner admin confirmation case.",
    ],
    [
      "page-body-payload-rejected",
      "Permission server test matrix must include page body payload rejection case.",
    ],
    [
      "prompt-payload-rejected",
      "Permission server test matrix must include prompt payload rejection case.",
    ],
    [
      "database-values-payload-rejected",
      "Permission server test matrix must include database value payload rejection case.",
    ],
    [
      "file-bytes-payload-rejected",
      "Permission server test matrix must include file bytes payload rejection case.",
    ],
    [
      "signed-url-payload-rejected",
      "Permission server test matrix must include signed URL payload rejection case.",
    ],
    [
      "validatePermissionCheckMetadataRequest",
      "Permission server test matrix must reuse metadata-only request validation.",
    ],
    [
      "evaluatePermissionDecision",
      "Permission server test matrix must reuse local permission decisions.",
    ],
    [
      "expected_http_status_after_enablement",
      "Permission server test matrix must define future HTTP expectations.",
    ],
    [
      "allow-after-confirmation",
      "Permission server test matrix must cover confirmation-based allows.",
    ],
    [
      "reject-request",
      "Permission server test matrix must cover request rejection.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionServerTestMatrix,
      permissionServerTestMatrix,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionServerTestMatrix",
    "Permission check API stub must include the local server test matrix."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "local_server_test_matrix",
    "Permission check API stub must expose the local server test matrix."
  );
  assertSourceIncludes(
    files.permissionServerReadiness,
    permissionServerReadiness,
    'format: "zhinote-server-permission-readiness-report"',
    "Permission server readiness report must expose a stable format."
  );
  assertSourceIncludes(
    files.permissionServerReadiness,
    permissionServerReadiness,
    "buildPermissionServerReadinessReport",
    "Permission server readiness report must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'report_status: "local-readiness-report-only"',
      "Permission server readiness report must remain local-only.",
    ],
    [
      'readiness_verdict: "not-ready"',
      "Permission server readiness report must not claim readiness.",
    ],
    [
      "can_enable_permission_endpoint_now: false",
      "Permission server readiness report must not enable the permission endpoint.",
    ],
    [
      "can_run_server_permission_tests_now: false",
      "Permission server readiness report must not run server permission tests.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission server readiness report must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission server readiness report must not read request bodies.",
    ],
    [
      "no_server_execution: true",
      "Permission server readiness report must not execute server behavior.",
    ],
    [
      "reads_request_body: false",
      "Permission server readiness report must not read request bodies.",
    ],
    [
      "stores_raw_request: false",
      "Permission server readiness report must not store raw requests.",
    ],
    [
      "returns_raw_values: false",
      "Permission server readiness report must not return raw values.",
    ],
    [
      "reads_page_body_text: false",
      "Permission server readiness report must not read page text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission server readiness report must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission server readiness report must not read comments.",
    ],
    [
      "reads_file_bytes: false",
      "Permission server readiness report must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission server readiness report must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission server readiness report must not read secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Permission server readiness report must not write audit logs.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission server readiness report must not upload workspace data.",
    ],
    [
      "metadata-validator",
      "Permission server readiness report must include metadata validator gate.",
    ],
    [
      "server-matrix-coverage",
      "Permission server readiness report must include server matrix gate.",
    ],
    [
      "authenticated-actor",
      "Permission server readiness report must include authenticated actor gate.",
    ],
    [
      "workspace-membership",
      "Permission server readiness report must include workspace membership gate.",
    ],
    [
      "audit-envelope-linkage",
      "Permission server readiness report must include audit envelope linkage gate.",
    ],
    [
      "high-risk-confirmation",
      "Permission server readiness report must include high-risk confirmation gate.",
    ],
    [
      "input.validatorReport.summary.failed === 0",
      "Permission server readiness report must require validator fixtures to pass.",
    ],
    [
      "input.serverTestMatrix.summary.cases >= 12",
      "Permission server readiness report must require server matrix coverage.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionServerReadiness,
      permissionServerReadiness,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionServerReadinessReport",
    "Permission check API stub must include the local server readiness report."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "local_server_readiness_report",
    "Permission check API stub must expose the local server readiness report."
  );
  assertSourceIncludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "buildPermissionCheckApiDisabledResponse",
    "Permission check route must use the dedicated disabled permission response."
  );
  assertSourceIncludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Permission check route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "export async function POST()",
    "Permission check route must not accept a Request argument while disabled."
  );
  assertSourceExcludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    ".json()",
    "Permission check route must not parse request bodies while disabled."
  );
  assertSourceExcludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "NextRequest",
    "Permission check route must not accept NextRequest while disabled."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "buildPermissionCheckApiDisabledResponse",
    "Smoke tests must require the dedicated permission check disabled response."
  );
  assertSourceIncludes(
    files.workspaceIdentity,
    workspaceIdentity,
    "validateBootstrapProof(input)",
    "Local cloud workspace linking must validate bootstrap proof."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "!bootstrapProofMatchesSelection",
    "Sync UI must disable local cloud linking without a matching bootstrap proof."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildLocalWorkspaceCloudLinkReceipt",
    "Sync UI must export metadata-only cloud link receipts."
  );
  assertSourceIncludes(
    files.syncOptInGate,
    syncOptInGate,
    'id: "bootstrap-proof"',
    "Sync opt-in gate must include bootstrap membership proof."
  );
  assertSourceIncludes(
    files.syncOptInGate,
    syncOptInGate,
    "cloud_bootstrap_checked_at",
    "Sync opt-in gate must expose bootstrap proof metadata."
  );
  assertSourceIncludes(
    files.syncPushApiStub,
    syncPushApiStub,
    'format: "zhinote-sync-push-api-disabled"',
    "Sync push API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.syncPushApiStub,
    syncPushApiStub,
    "buildSyncPushApiDisabledResponse",
    "Sync push API guard must expose a reusable disabled response builder."
  );
  for (const item of [
    ['api_id: "sync-push"', "Sync push API guard must identify the sync-push route."],
    ['path: "/api/sync/push"', "Sync push API guard must bind to /api/sync/push."],
    ['method: "POST"', "Sync push API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "Sync push API guard must stay disabled."],
    ["can_push_now: false", "Sync push API guard must not push now."],
    ["can_read_request_body_now: false", "Sync push API guard must not read request bodies."],
    ["can_accept_sync_batch_now: false", "Sync push API guard must not accept batches."],
    ["can_upload_workspace_data_now: false", "Sync push API guard must not upload data."],
    ["can_write_server_data_now: false", "Sync push API guard must not write server data."],
    ["can_acknowledge_rows_now: false", "Sync push API guard must not acknowledge rows."],
    ["can_mark_local_rows_synced_now: false", "Sync push API guard must not mutate local sync state."],
    ["no_request_argument: true", "Sync push API guard must not accept a request argument."],
    ["endpoint_disabled: true", "Sync push API guard must preserve disabled endpoint boundary."],
    ["reads_request_body: false", "Sync push API guard must keep body reads disabled."],
    ["accepts_sync_batch: false", "Sync push API guard must not accept sync batches."],
    ["accepts_workspace_payload: false", "Sync push API guard must not accept workspace payloads."],
    ["writes_server_data: false", "Sync push API guard must not write server data."],
    ["uploads_workspace_data: false", "Sync push API guard must not upload workspace data."],
    ["acknowledges_sync_rows: false", "Sync push API guard must not acknowledge sync rows."],
    ["mutates_local_sync_status: false", "Sync push API guard must not mutate local sync status."],
    ["returns_remote_rows: false", "Sync push API guard must not return remote rows."],
    ["connects_cloud_services: false", "Sync push API guard must not connect cloud services."],
    ["reads_page_body_text: false", "Sync push API guard must not read page text."],
    ["reads_database_row_values: false", "Sync push API guard must not read database values."],
    ["reads_comment_bodies: false", "Sync push API guard must not read comments."],
    ["reads_file_bytes: false", "Sync push API guard must not read files."],
    ["reads_backup_payload: false", "Sync push API guard must not read backups."],
    ["reads_secret_values: false", "Sync push API guard must not read secrets."],
    ["requires_payload_preview_before_enablement: true", "Sync push API guard must require payload preview."],
    ["requires_permission_check_before_enablement: true", "Sync push API guard must require permission checks."],
    ["requires_audit_event_before_enablement: true", "Sync push API guard must require audit events."],
    ["requires_idempotency_before_enablement: true", "Sync push API guard must require idempotency."],
    ["requires_durable_remote_ack_before_enablement: true", "Sync push API guard must require durable ack."],
    ["requires_retry_dead_letter_before_enablement: true", "Sync push API guard must require retry/dead-letter."],
    ["requires_rollback_proof_before_enablement: true", "Sync push API guard must require rollback proof."],
    ["requires_conflict_baseline_before_enablement: true", "Sync push API guard must require conflict baseline."],
    ["requires_first_push_confirmation_before_enablement: true", "Sync push API guard must require first push confirmation."],
    ['schema_status: "planned-metadata-only"', "Sync push API guard must expose metadata-only request schema."],
    ['schema_status: "planned-ack-receipt-only"', "Sync push API guard must expose ack receipt response schema."],
    ['format: "zhinote-sync-push-api-validator-fixtures"', "Sync push API guard must include local validator fixtures."],
    ['validator_status: "not-executing-route"', "Sync push validator must not execute the route."],
    "forbidden_field_names",
    "forbidden_fields_covered",
    '"metadata-sync-push-request"',
    '"sync-payload-blocked"',
    '"workspace-content-blocked"',
    '"file-backup-blocked"',
    '"credential-fields-blocked"',
    '"ack-mutation-blocked"',
    "local_batch_id",
    "sync_log_row_ids",
    "changed_field_names",
    "payload_preview_id",
    "sync_log_payload",
    "page_snapshot_json",
    "database_cell_values",
    "backup_payload",
    "enable_sync_push",
    "force_acknowledge",
    "mark_synced",
    "overwrite_remote",
    "delete_remote",
    '"payload-preview"',
    '"permission-check"',
    '"audit-event"',
    '"idempotency"',
    '"durable-remote-ack"',
    '"retry-dead-letter"',
    '"rollback-proof"',
    '"conflict-baseline"',
    '"first-push-confirmation"',
  ]) {
    const expected = Array.isArray(item) ? item[0] : item;
    const message = Array.isArray(item)
      ? item[1]
      : "Sync push API guard must preserve schema, fixtures, and enablement gates.";
    assertSourceIncludes(files.syncPushApiStub, syncPushApiStub, expected, message);
  }
  assertSourceIncludes(
    files.syncPushRoute,
    syncPushRoute,
    "buildSyncPushApiDisabledResponse",
    "Sync push route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.syncPushRoute,
    syncPushRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Sync push route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildSyncPushApiDisabledResponse",
    "Sync UI must build the sync push API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportSyncPushApiGuard",
    "Sync UI must export the sync push API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "同步推送 API 防护",
    "Sync UI must render the sync push API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出同步推送防护",
    "Sync UI must render the sync push API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "value: syncPushApiGuard.format",
    "Sync UI must render the sync push disabled response format."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={syncPushApiGuard.local_validator_report.fixtures}",
    "Sync UI must render sync push validator fixtures."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "buildSyncPushApiDisabledResponse",
    "Smoke tests must require the dedicated sync push disabled response."
  );
  assertSourceIncludes(
    files.syncPullApiStub,
    syncPullApiStub,
    'format: "zhinote-sync-pull-api-disabled"',
    "Sync pull API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.syncPullApiStub,
    syncPullApiStub,
    "buildSyncPullApiDisabledResponse",
    "Sync pull API guard must expose a reusable disabled response builder."
  );
  for (const item of [
    ['api_id: "sync-pull"', "Sync pull API guard must identify the sync-pull route."],
    ['path: "/api/sync/pull?cursor=:cursor"', "Sync pull API guard must bind to /api/sync/pull."],
    ['method: "GET"', "Sync pull API guard must document GET."],
    ['stub_status: "disabled-local-stub"', "Sync pull API guard must stay disabled."],
    ["can_pull_now: false", "Sync pull API guard must not pull now."],
    ["can_read_cursor_query_now: false", "Sync pull API guard must not read cursor queries."],
    ["can_connect_cloud_now: false", "Sync pull API guard must not connect cloud."],
    ["can_read_remote_data_now: false", "Sync pull API guard must not read remote data."],
    ["can_fetch_remote_baseline_now: false", "Sync pull API guard must not fetch baseline."],
    ["can_stage_remote_rows_now: false", "Sync pull API guard must not stage rows."],
    ["can_apply_remote_rows_now: false", "Sync pull API guard must not apply remote rows."],
    ["can_acknowledge_remote_rows_now: false", "Sync pull API guard must not acknowledge rows."],
    ["can_write_workspace_data_now: false", "Sync pull API guard must not write workspace data."],
    ["no_request_argument: true", "Sync pull API guard must not accept a request argument."],
    ["endpoint_disabled: true", "Sync pull API guard must preserve disabled endpoint boundary."],
    ["reads_cursor_query: false", "Sync pull API guard must not read cursor queries."],
    ["connects_cloud_services: false", "Sync pull API guard must not connect cloud services."],
    ["reads_remote_data: false", "Sync pull API guard must not read remote data."],
    ["fetches_remote_rows: false", "Sync pull API guard must not fetch remote rows."],
    ["fetches_remote_baseline: false", "Sync pull API guard must not fetch remote baseline."],
    ["stages_remote_rows: false", "Sync pull API guard must not stage remote rows."],
    ["applies_remote_changes: false", "Sync pull API guard must not apply remote changes."],
    ["acknowledges_remote_rows: false", "Sync pull API guard must not acknowledge remote rows."],
    ["writes_workspace_data: false", "Sync pull API guard must not write workspace data."],
    ["overwrites_local_data: false", "Sync pull API guard must not overwrite local data."],
    ["deletes_local_rows: false", "Sync pull API guard must not delete local rows."],
    ["uploads_workspace_data: false", "Sync pull API guard must not upload workspace data."],
    ["returns_remote_rows: false", "Sync pull API guard must not return remote rows."],
    ["returns_page_body_text: false", "Sync pull API guard must not return page text."],
    ["returns_database_row_values: false", "Sync pull API guard must not return database values."],
    ["returns_comment_bodies: false", "Sync pull API guard must not return comments."],
    ["returns_file_bytes: false", "Sync pull API guard must not return file bytes."],
    ["reads_secret_values: false", "Sync pull API guard must not read secrets."],
    ["requires_authenticated_session_before_enablement: true", "Sync pull API guard must require auth."],
    ["requires_workspace_membership_before_enablement: true", "Sync pull API guard must require membership."],
    ["requires_cursor_contract_before_enablement: true", "Sync pull API guard must require cursor contract."],
    ["requires_remote_baseline_staging_before_enablement: true", "Sync pull API guard must require staging."],
    ["requires_side_by_side_review_before_enablement: true", "Sync pull API guard must require side-by-side review."],
    ["requires_permission_check_before_enablement: true", "Sync pull API guard must require permission checks."],
    ["requires_audit_event_before_enablement: true", "Sync pull API guard must require audit events."],
    ["requires_rollback_snapshot_before_apply: true", "Sync pull API guard must require rollback before apply."],
    ["requires_owner_confirmation_before_apply: true", "Sync pull API guard must require owner confirmation."],
    ['schema_status: "planned-query-metadata-only"', "Sync pull API guard must expose query metadata request schema."],
    ['schema_status: "planned-stage-receipt-only"', "Sync pull API guard must expose stage receipt response schema."],
    ['format: "zhinote-sync-pull-api-validator-fixtures"', "Sync pull API guard must include local validator fixtures."],
    ['validator_status: "not-executing-route"', "Sync pull validator must not execute the route."],
    "forbidden_field_names",
    "forbidden_fields_covered",
    '"metadata-sync-pull-request"',
    '"remote-payload-blocked"',
    '"workspace-content-blocked"',
    '"file-url-blocked"',
    '"credential-fields-blocked"',
    '"apply-ack-blocked"',
    "remote_baseline_request_id",
    "conflict_surface_ids",
    "remote_rows_payload",
    "raw_response_body",
    "signed_download_url",
    "apply_now",
    "accept_remote",
    "overwrite_local",
    "mark_acknowledged",
    "delete_local",
    "cursor_override",
    '"authenticated-session"',
    '"workspace-membership"',
    '"cursor-contract"',
    '"remote-baseline-staging"',
    '"side-by-side-review"',
    '"permission-check"',
    '"audit-event"',
    '"rollback-snapshot"',
    '"owner-confirmation"',
  ]) {
    const expected = Array.isArray(item) ? item[0] : item;
    const message = Array.isArray(item)
      ? item[1]
      : "Sync pull API guard must preserve schema, fixtures, and enablement gates.";
    assertSourceIncludes(files.syncPullApiStub, syncPullApiStub, expected, message);
  }
  assertSourceIncludes(
    files.syncPullRoute,
    syncPullRoute,
    "buildSyncPullApiDisabledResponse",
    "Sync pull route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.syncPullRoute,
    syncPullRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Sync pull route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildSyncPullApiDisabledResponse",
    "Sync UI must build the sync pull API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportSyncPullApiGuard",
    "Sync UI must export the sync pull API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "同步拉取 API 防护",
    "Sync UI must render the sync pull API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出同步拉取防护",
    "Sync UI must render the sync pull API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "value: syncPullApiGuard.format",
    "Sync UI must render the sync pull disabled response format."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={syncPullApiGuard.local_validator_report.fixtures}",
    "Sync UI must render sync pull validator fixtures."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "buildSyncPullApiDisabledResponse",
    "Smoke tests must require the dedicated sync pull disabled response."
  );
  assertSourceIncludes(
    files.apiStubs,
    apiStubs,
    'id: "comment-version-replay"',
    "Web Beta API stubs must register the comment/version replay route."
  );
  assertSourceIncludes(
    files.commentVersionReplayApiStub,
    commentVersionReplayApiStub,
    'format: "zhinote-comment-version-replay-api-disabled"',
    "Comment/version replay API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.commentVersionReplayApiStub,
    commentVersionReplayApiStub,
    "buildCommentVersionReplayApiDisabledResponse",
    "Comment/version replay API guard must expose a reusable disabled response builder."
  );
  for (const item of [
    ['api_id: "comment-version-replay"', "Comment/version replay API guard must identify the replay route."],
    ['path: "/api/sync/comment-version-replay"', "Comment/version replay API guard must bind to /api/sync/comment-version-replay."],
    ['method: "POST"', "Comment/version replay API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "Comment/version replay API guard must stay disabled."],
    ["can_replay_now: false", "Comment/version replay API guard must not replay now."],
    ["can_read_request_body_now: false", "Comment/version replay API guard must not read request bodies."],
    ["can_read_comment_bodies_now: false", "Comment/version replay API guard must not read comment bodies."],
    ["can_read_version_snapshots_now: false", "Comment/version replay API guard must not read version snapshots."],
    ["can_upload_workspace_data_now: false", "Comment/version replay API guard must not upload workspace data."],
    ["can_write_server_data_now: false", "Comment/version replay API guard must not write server data."],
    ["can_acknowledge_rows_now: false", "Comment/version replay API guard must not acknowledge rows."],
    ["can_mark_local_rows_synced_now: false", "Comment/version replay API guard must not mutate local sync state."],
    ["no_request_argument: true", "Comment/version replay route must not accept request arguments while disabled."],
    ["endpoint_disabled: true", "Comment/version replay endpoint must remain disabled."],
    ["reads_request_body: false", "Comment/version replay guard must not read request body."],
    ["accepts_comment_body_payload: false", "Comment/version replay guard must reject comment body payloads."],
    ["accepts_version_snapshot_payload: false", "Comment/version replay guard must reject version snapshots."],
    ["accepts_page_body_payload: false", "Comment/version replay guard must reject page body payloads."],
    ["reads_comment_bodies: false", "Comment/version replay guard must not read comment bodies."],
    ["reads_version_snapshots: false", "Comment/version replay guard must not read version snapshots."],
    ["reads_page_body_text: false", "Comment/version replay guard must not read page body text."],
    ["writes_server_data: false", "Comment/version replay guard must not write server data."],
    ["uploads_workspace_data: false", "Comment/version replay guard must not upload workspace data."],
    ["acknowledges_sync_rows: false", "Comment/version replay guard must not acknowledge sync rows."],
    ["mutates_local_sync_status: false", "Comment/version replay guard must not mutate local sync status."],
    ["connects_cloud_services: false", "Comment/version replay guard must not connect cloud services."],
    ["returns_comment_bodies: false", "Comment/version replay guard must not return comment bodies."],
    ["returns_version_snapshots: false", "Comment/version replay guard must not return version snapshots."],
    ["returns_page_body_text: false", "Comment/version replay guard must not return page text."],
    ["returns_remote_rows: false", "Comment/version replay guard must not return remote rows."],
    ["requires_owner_confirmation_before_replay: true", "Comment/version replay guard must require owner confirmation."],
    ["requires_manifest_counts_before_ack: true", "Comment/version replay guard must require manifest counts before ack."],
    ["requires_comment_manifest_count_before_ack: true", "Comment/version replay guard must require cloud.comments manifest counts."],
    ["requires_page_versions_manifest_count_before_ack: true", "Comment/version replay guard must require cloud.page_versions manifest counts."],
    ["requires_idempotency_before_enablement: true", "Comment/version replay guard must require idempotency."],
    ["requires_retry_dead_letter_before_enablement: true", "Comment/version replay guard must require retry/dead-letter."],
    ["requires_permission_check_before_enablement: true", "Comment/version replay guard must require permission checks."],
    ["requires_audit_event_before_enablement: true", "Comment/version replay guard must require audit events."],
    ["requires_rollback_proof_before_enablement: true", "Comment/version replay guard must require rollback proof."],
    ['schema_status: "planned-owner-gated-row-id-only"', "Comment/version replay guard must expose owner-gated row-id-only request schema."],
    ['schema_status: "planned-count-and-ack-receipt-only"', "Comment/version replay guard must expose count/ack response schema."],
    ['format: "zhinote-comment-version-replay-api-validator-fixtures"', "Comment/version replay guard must include validator fixtures."],
    ['validator_status: "not-executing-route"', "Comment/version replay validator must not execute the route."],
    "forbidden_field_names",
    "forbidden_fields_covered",
    '"metadata-owner-gated-replay-request"',
    '"comment-content-blocked"',
    '"version-snapshot-blocked"',
    '"ack-mutation-blocked"',
    '"credential-fields-blocked"',
    "owner_confirmation_receipt_id",
    "comment_version_contract_id",
    "sync_log_row_ids",
    "cloud.comments",
    "cloud.page_versions",
    "comment_body",
    "anchor_text",
    "version_snapshot",
    "content_text",
    "content_yjs",
    "page_body_text",
    "raw_sync_log_payload",
    "force_acknowledge",
    "mark_synced",
    "overwrite_cloud",
    "delete_remote",
    "token",
    "cookie",
    "secret_values",
    '"owner-confirmation"',
    '"workspace-membership"',
    '"manifest-counts"',
    '"idempotency"',
    '"retry-dead-letter"',
    '"permission-check"',
    '"audit-event"',
    '"rollback-proof"',
  ]) {
    const expected = Array.isArray(item) ? item[0] : item;
    const message = Array.isArray(item)
      ? item[1]
      : "Comment/version replay API guard must preserve schema, fixtures, and enablement gates.";
    assertSourceIncludes(
      files.commentVersionReplayApiStub,
      commentVersionReplayApiStub,
      expected,
      message
    );
  }
  assertSourceIncludes(
    files.commentVersionReplayRoute,
    commentVersionReplayRoute,
    "buildCommentVersionReplayApiDisabledResponse",
    "Comment/version replay route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.commentVersionReplayRoute,
    commentVersionReplayRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Comment/version replay route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildCommentVersionReplayApiDisabledResponse",
    "Sync UI must build the comment/version replay API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportCommentVersionReplayApiGuard",
    "Sync UI must export the comment/version replay API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "评论 / 版本回放 API 防护",
    "Sync UI must render the comment/version replay API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出评论/版本回放防护",
    "Sync UI must render the comment/version replay API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "commentVersionReplayApiGuard.can_read_comment_bodies_now",
    "Sync UI must render the disabled comment body read state."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "commentVersionReplayApiGuard.boundary\n                  .requires_manifest_counts_before_ack",
    "Sync UI must render the manifest count gate."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={\n              commentVersionReplayApiGuard.local_validator_report.fixtures",
    "Sync UI must render comment/version replay validator fixtures."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "buildCommentVersionReplayApiDisabledResponse",
    "Smoke tests must require the dedicated comment/version replay disabled response."
  );
  assertSourceIncludes(
    files.accountSessionBoundary,
    accountSessionBoundary,
    "bootstrap_checked_at",
    "Account/session boundary must include bootstrap proof evidence."
  );
  assertSourceIncludes(
    files.webBetaReadiness,
    webBetaReadiness,
    'id: "cloud-link-proof"',
    "Web Beta readiness must include cloud link proof gate."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'first_web_alpha: "vercel-nextjs"',
    "Deployment target must keep the current Next.js app host decision explicit."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'cloud_backend: "supabase-cloud"',
    "Deployment target must identify Supabase as the first cloud backend."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'edge_layer: "cloudflare-dns-cdn-waf"',
    "Deployment target must preserve Cloudflare as the planned edge layer."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'id: "cloudflare-pages"',
    "Deployment target must track Cloudflare Pages as a future/runtime compatibility option."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'id: "cloudflare-workers"',
    "Deployment target must track Cloudflare Workers as a future/runtime compatibility option."
  );
  for (const [snippet, message] of [
    ["deploys_app: false", "Deployment target must not deploy the app."],
    [
      "creates_cloud_resources: false",
      "Deployment target must not create cloud resources.",
    ],
    [
      "connects_cloud_services: false",
      "Deployment target must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Deployment target must not upload workspace data.",
    ],
    [
      "requires_owner_confirmation_before_deploy: true",
      "Deployment target must require owner confirmation before deploy.",
    ],
  ]) {
    assertSourceIncludes(files.deploymentTarget, deploymentTarget, snippet, message);
  }
  assertSourceIncludes(
    files.cloudManifestCompareApiStub,
    cloudManifestCompareApiStub,
    'format: "zhinote-cloud-manifest-compare-api-disabled"',
    "Cloud manifest compare API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.cloudManifestCompareApiStub,
    cloudManifestCompareApiStub,
    "buildCloudManifestCompareApiDisabledResponse",
    "Cloud manifest compare API guard must expose a reusable disabled response builder."
  );
  for (const item of [
    ['api_id: "cloud-manifest-compare"', "Cloud manifest compare API guard must identify the compare route."],
    ['path: "/api/cloud/manifest/compare?workspaceId=:workspaceId"', "Cloud manifest compare API guard must bind to manifest compare path."],
    ['method: "GET"', "Cloud manifest compare API guard must document GET."],
    ['stub_status: "disabled-local-stub"', "Cloud manifest compare API guard must stay disabled."],
    ["can_compare_manifest_now: false", "Cloud manifest compare API guard must not compare now."],
    ["can_read_query_now: false", "Cloud manifest compare API guard must not read query values now."],
    ["can_connect_cloud_now: false", "Cloud manifest compare API guard must not connect cloud services."],
    ["can_read_remote_manifest_now: false", "Cloud manifest compare API guard must not read remote manifests now."],
    ["can_read_workspace_content_now: false", "Cloud manifest compare API guard must not read workspace content."],
    ["can_write_server_data_now: false", "Cloud manifest compare API guard must not write server data."],
    ["can_upload_workspace_data_now: false", "Cloud manifest compare API guard must not upload workspace data."],
    ["no_request_argument: true", "Cloud manifest compare API guard must not accept a request argument."],
    ["endpoint_disabled: true", "Cloud manifest compare API guard must preserve disabled endpoint boundary."],
    ["reads_query: false", "Cloud manifest compare API guard must not read query values."],
    ["connects_cloud_services: false", "Cloud manifest compare API guard must not connect cloud services."],
    ["reads_remote_manifest: false", "Cloud manifest compare API guard must not read remote manifests."],
    ["reads_workspace_content: false", "Cloud manifest compare API guard must not read workspace content."],
    ["reads_page_body_text: false", "Cloud manifest compare API guard must not read page text."],
    ["reads_database_row_values: false", "Cloud manifest compare API guard must not read database values."],
    ["reads_comment_bodies: false", "Cloud manifest compare API guard must not read comments."],
    ["reads_file_bytes: false", "Cloud manifest compare API guard must not read file bytes."],
    ["writes_server_data: false", "Cloud manifest compare API guard must not write server data."],
    ["writes_workspace_data: false", "Cloud manifest compare API guard must not write workspace data."],
    ["uploads_workspace_data: false", "Cloud manifest compare API guard must not upload workspace data."],
    ["deletes_local_rows: false", "Cloud manifest compare API guard must not delete local rows."],
    ["overwrites_local_cache: false", "Cloud manifest compare API guard must not overwrite local cache."],
    ["returns_manifest_counts: false", "Cloud manifest compare API guard must not return counts while disabled."],
    ["returns_missing_ids: false", "Cloud manifest compare API guard must not return missing ids while disabled."],
    ["returns_workspace_content: false", "Cloud manifest compare API guard must not return content."],
    ["requires_metadata_only_manifest_before_enablement: true", "Cloud manifest compare API guard must require metadata-only manifest before enablement."],
    ["requires_owner_review_before_migration: true", "Cloud manifest compare API guard must require owner review before migration."],
    ['schema_status: "planned-query-metadata-only"', "Cloud manifest compare API guard must expose metadata-only query schema."],
    ['schema_status: "planned-manifest-summary-only"', "Cloud manifest compare API guard must expose manifest summary response schema."],
    ['format: "zhinote-cloud-manifest-compare-api-validator-fixtures"', "Cloud manifest compare API guard must include validator fixtures."],
    ['validator_status: "not-executing-route"', "Cloud manifest compare validator must not execute the route."],
    '"metadata-manifest-compare-request"',
    '"workspace-content-blocked"',
    '"file-and-backup-payload-blocked"',
    '"credential-fields-blocked"',
    '"write-and-delete-actions-blocked"',
    "page_body_text",
    "database_cell_values",
    "comment_body",
    "version_snapshot",
    "file_bytes",
    "backup_payload",
    "raw_local_manifest",
    "raw_remote_manifest",
    "signed_download_url",
    "local_file_path",
    "token",
    "cookie",
    "secret_values",
    "apply_migration",
    "overwrite_cloud",
    "overwrite_local",
    "delete_remote",
    "delete_local",
  ]) {
    const expected = Array.isArray(item) ? item[0] : item;
    const message = Array.isArray(item)
      ? item[1]
      : "Cloud manifest compare API guard must preserve schema, fixtures, and enablement gates.";
    assertSourceIncludes(
      files.cloudManifestCompareApiStub,
      cloudManifestCompareApiStub,
      expected,
      message
    );
  }
  assertSourceIncludes(
    files.cloudManifestCompareRoute,
    cloudManifestCompareRoute,
    "buildCloudManifestCompareApiDisabledResponse",
    "Cloud manifest compare route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.cloudManifestCompareRoute,
    cloudManifestCompareRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Cloud manifest compare route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildCloudManifestCompareApiDisabledResponse",
    "Sync UI must build the cloud manifest compare API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportCloudManifestCompareApiGuard",
    "Sync UI must export the cloud manifest compare API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "云端 manifest 对账 API 防护",
    "Sync UI must render the cloud manifest compare API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出 manifest 防护",
    "Sync UI must render the cloud manifest compare API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "cloudManifestCompareApiGuard.can_read_remote_manifest_now",
    "Sync UI must render the disabled remote manifest read state."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={\n              cloudManifestCompareApiGuard.local_validator_report.fixtures",
    "Sync UI must render cloud manifest compare validator fixtures."
  );
  assertSourceIncludes(
    files.cloudMigrationApplyApiStub,
    cloudMigrationApplyApiStub,
    'format: "zhinote-cloud-migration-apply-api-disabled"',
    "Cloud migration apply API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.cloudMigrationApplyApiStub,
    cloudMigrationApplyApiStub,
    "buildCloudMigrationApplyApiDisabledResponse",
    "Cloud migration apply API guard must expose a reusable disabled response builder."
  );
  for (const item of [
    ['api_id: "cloud-migration-apply"', "Cloud migration apply API guard must identify the migration route."],
    ['path: "/api/cloud/migrations/apply"', "Cloud migration apply API guard must bind to migration apply path."],
    ['method: "POST"', "Cloud migration apply API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "Cloud migration apply API guard must stay disabled."],
    ["can_apply_migration_now: false", "Cloud migration apply API guard must not apply migrations."],
    ["can_read_request_body_now: false", "Cloud migration apply API guard must not read request bodies."],
    ["can_read_sql_payload_now: false", "Cloud migration apply API guard must not read SQL."],
    ["can_connect_database_now: false", "Cloud migration apply API guard must not connect databases."],
    ["can_write_server_data_now: false", "Cloud migration apply API guard must not write server data."],
    ["can_create_cloud_resources_now: false", "Cloud migration apply API guard must not create cloud resources."],
    ["can_read_secret_values_now: false", "Cloud migration apply API guard must not read secrets."],
    ["no_request_argument: true", "Cloud migration apply API guard must not accept a request argument."],
    ["endpoint_disabled: true", "Cloud migration apply API guard must preserve disabled endpoint boundary."],
    ["reads_request_body: false", "Cloud migration apply API guard must keep body reads disabled."],
    ["reads_sql_payload: false", "Cloud migration apply API guard must not read SQL payloads."],
    ["accepts_migration_sql: false", "Cloud migration apply API guard must not accept SQL."],
    ["applies_migration: false", "Cloud migration apply API guard must not apply SQL."],
    ["connects_database: false", "Cloud migration apply API guard must not connect databases."],
    ["creates_cloud_resources: false", "Cloud migration apply API guard must not create resources."],
    ["writes_server_data: false", "Cloud migration apply API guard must not write server data."],
    ["uploads_workspace_data: false", "Cloud migration apply API guard must not upload workspace data."],
    ["returns_database_url: false", "Cloud migration apply API guard must not return DB URLs."],
    ["returns_service_role_key: false", "Cloud migration apply API guard must not return service keys."],
    ["requires_owner_approval_before_enablement: true", "Cloud migration apply API guard must require owner approval."],
    ["requires_disposable_replay_before_enablement: true", "Cloud migration apply API guard must require disposable replay."],
    ["requires_down_migration_before_enablement: true", "Cloud migration apply API guard must require down migration."],
    ["requires_rls_proof_before_enablement: true", "Cloud migration apply API guard must require RLS proof."],
    ["requires_backup_snapshot_before_enablement: true", "Cloud migration apply API guard must require backup snapshot."],
    ["requires_migration_lock_before_enablement: true", "Cloud migration apply API guard must require migration lock."],
    ["requires_audit_event_before_enablement: true", "Cloud migration apply API guard must require audit events."],
    ["requires_deployment_gate_before_enablement: true", "Cloud migration apply API guard must require deployment gate."],
    ['schema_status: "planned-metadata-only"', "Cloud migration apply API guard must expose metadata-only request schema."],
    ['schema_status: "planned-migration-receipt-only"', "Cloud migration apply API guard must expose migration receipt response schema."],
    ['format: "zhinote-cloud-migration-apply-api-validator-fixtures"', "Cloud migration apply API guard must include validator fixtures."],
    ['validator_status: "not-executing-route"', "Cloud migration apply validator must not execute the route."],
    '"metadata-cloud-migration-apply-request"',
    '"sql-payload-blocked"',
    '"credential-fields-blocked"',
    '"workspace-content-blocked"',
    '"destructive-flags-blocked"',
    "forbidden_field_names",
    "forbidden_fields_covered",
    "migration_sql",
    "down_migration_sql",
    "sql_payload",
    "database_url",
    "service_role_key",
    "secret_values",
    "drop_tables",
    "disable_rls",
    "create_cloud_project",
    '"owner-approval"',
    '"disposable-replay"',
    '"down-migration"',
    '"rls-proof"',
    '"backup-snapshot"',
    '"migration-lock"',
    '"audit-event"',
    '"deployment-gate"',
  ]) {
    const expected = Array.isArray(item) ? item[0] : item;
    const message = Array.isArray(item)
      ? item[1]
      : "Cloud migration apply API guard must preserve schema, fixtures, and enablement gates.";
    assertSourceIncludes(
      files.cloudMigrationApplyApiStub,
      cloudMigrationApplyApiStub,
      expected,
      message
    );
  }
  assertSourceIncludes(
    files.cloudMigrationApplyRoute,
    cloudMigrationApplyRoute,
    "buildCloudMigrationApplyApiDisabledResponse",
    "Cloud migration apply route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.cloudMigrationApplyRoute,
    cloudMigrationApplyRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Cloud migration apply route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildCloudMigrationApplyApiDisabledResponse",
    "Sync UI must build the cloud migration apply API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportCloudMigrationApplyApiGuard",
    "Sync UI must export the cloud migration apply API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "云迁移应用 API 防护",
    "Sync UI must render the cloud migration apply API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出迁移防护",
    "Sync UI must render the cloud migration apply API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "value: cloudMigrationApplyApiGuard.format",
    "Sync UI must render the cloud migration apply disabled response format."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={cloudMigrationApplyApiGuard.local_validator_report.fixtures}",
    "Sync UI must render cloud migration apply validator fixtures."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "buildCloudMigrationApplyApiDisabledResponse",
    "Smoke tests must require the dedicated cloud migration apply disabled response."
  );
  assertSourceIncludes(
    files.contract,
    contract,
    "web_beta_deployment_target",
    "Web Beta contract export must include the deployment target."
  );
  assertSourceIncludes(
    files.webBetaReadiness,
    webBetaReadiness,
    'id: "deployment-target-contract"',
    "Web Beta readiness must include deployment target readiness."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaDeploymentTarget",
    "Sync UI must build the deployment target contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebBetaDeploymentTarget",
    "Sync UI must export the deployment target contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "部署目标",
    "Sync UI must render the deployment target panel."
  );
  assertSourceIncludes(
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    'format: "zhinote-private-file-storage-policy"',
    "Private file storage policy must expose a stable export format."
  );
  assertSourceIncludes(
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    "buildPrivateFileStoragePolicyReport",
    "Private file storage policy must expose a reusable builder."
  );
  assertSourceIncludes(
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    'policy_status: "local-policy-only"',
    "Private file storage policy must remain local-only."
  );
  assertSourceIncludes(
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    "file_sync_can_start_now: false",
    "Private file storage policy must not enable file sync."
  );
  for (const [snippet, message] of [
    [
      "reads_file_metadata_counts: true",
      "Private file storage policy may read local file counts.",
    ],
    [
      "reads_file_kind_summary: true",
      "Private file storage policy may read local file kind summaries.",
    ],
    [
      "reads_environment_presence: true",
      "Private file storage policy may read environment presence metadata.",
    ],
    [
      "reads_file_names: false",
      "Private file storage policy must not read file names.",
    ],
    [
      "reads_file_bytes: false",
      "Private file storage policy must not read file bytes.",
    ],
    [
      "reads_page_body_text: false",
      "Private file storage policy must not read page text.",
    ],
    [
      "creates_storage_buckets: false",
      "Private file storage policy must not create buckets.",
    ],
    [
      "creates_signed_urls: false",
      "Private file storage policy must not create signed URLs.",
    ],
    [
      "connects_cloud_services: false",
      "Private file storage policy must not connect cloud services.",
    ],
    [
      "writes_server_data: false",
      "Private file storage policy must not write server data.",
    ],
    [
      "uploads_files: false",
      "Private file storage policy must not upload files.",
    ],
    [
      "exposes_secret_values: false",
      "Private file storage policy must not expose secrets.",
    ],
    [
      "requires_owner_confirmation_before_file_sync: true",
      "Private file storage policy must require owner confirmation before file sync.",
    ],
  ]) {
    assertSourceIncludes(files.privateFileStoragePolicy, privateFileStoragePolicy, snippet, message);
  }
  for (const snippet of [
    "SUPABASE_STORAGE_BUCKET",
    "/api/files/presign",
    "private-source-files",
    "private-preview-artifacts",
    "signed_url_ttl_minutes",
    "public_access_forbidden: true",
    "file_bytes",
    "signed_download_url",
    "signed_upload_url",
    "public_url",
    '"private-bucket-policy"',
    '"signed-url-expiry"',
    '"checksum-and-size"',
    '"permission-and-audit"',
    '"owner-file-sync-confirmation"',
  ]) {
    assertSourceIncludes(
      files.privateFileStoragePolicy,
      privateFileStoragePolicy,
      snippet,
      "Private file storage policy must preserve storage gates and forbidden payload fields."
    );
  }
  assertSourceIncludes(
    files.launchChecklist,
    launchChecklist,
    "privateFileStoragePolicy",
    "Launch checklist must consume the private file storage policy."
  );
  assertSourceIncludes(
    files.launchChecklist,
    launchChecklist,
    "file sync cannot start",
    "Launch checklist must keep file sync disabled after policy drafting."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildPrivateFileStoragePolicyReport",
    "Sync UI must build the private file storage policy."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportPrivateFileStoragePolicy",
    "Sync UI must export the private file storage policy."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "私有文件存储政策",
    "Sync UI must render the private file storage policy panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出存储政策",
    "Sync UI must render the private file storage policy export button."
  );
  assertSourceIncludes(
    files.filePresignApiStub,
    filePresignApiStub,
    'format: "zhinote-file-presign-api-disabled"',
    "File presign API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.filePresignApiStub,
    filePresignApiStub,
    "buildFilePresignApiDisabledResponse",
    "File presign API guard must expose a reusable disabled response builder."
  );
  for (const [snippet, message] of [
    ['api_id: "file-presign"', "File presign API guard must identify the file-presign route."],
    ['path: "/api/files/presign"', "File presign API guard must bind to /api/files/presign."],
    ['method: "POST"', "File presign API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "File presign API guard must stay disabled."],
    ["can_create_signed_urls_now: false", "File presign API guard must not create signed URLs."],
    ["can_create_signed_upload_url_now: false", "File presign API guard must not create upload URLs."],
    ["can_create_signed_download_url_now: false", "File presign API guard must not create download URLs."],
    ["can_read_request_body_now: false", "File presign API guard must not read request bodies."],
    ["can_read_file_metadata_now: false", "File presign API guard must not read file metadata yet."],
    ["can_read_file_bytes_now: false", "File presign API guard must not read file bytes."],
    ["can_upload_files_now: false", "File presign API guard must not upload files."],
    ["can_expose_public_urls_now: false", "File presign API guard must not expose public URLs."],
    ["can_connect_storage_now: false", "File presign API guard must not connect storage."],
    ["can_write_audit_events_now: false", "File presign API guard must not write audit events."],
    ["no_request_argument: true", "File presign API guard must not accept a request argument."],
    ["reads_request_body: false", "File presign API guard must keep body reads disabled."],
    ["metadata_only_request: true", "File presign API guard must keep the future request metadata-only."],
    ["executes_actions: false", "File presign API guard must not execute actions."],
    ["reads_file_metadata: false", "File presign API guard must not read metadata in the disabled route."],
    ["reads_file_names: false", "File presign API guard must not read file names."],
    ["reads_file_bytes: false", "File presign API guard must not read file bytes."],
    ["reads_page_body_text: false", "File presign API guard must not read page text."],
    ["reads_database_row_values: false", "File presign API guard must not read database values."],
    ["reads_prompt_text: false", "File presign API guard must not read prompt text."],
    ["reads_secret_values: false", "File presign API guard must not read secrets."],
    ["creates_signed_urls: false", "File presign API guard must not create signed URLs."],
    ["creates_public_urls: false", "File presign API guard must not create public URLs."],
    ["connects_storage_service: false", "File presign API guard must not connect storage service."],
    ["uploads_files: false", "File presign API guard must not upload files."],
    ["writes_server_audit_log: false", "File presign API guard must not write audit logs."],
    ["uploads_workspace_data: false", "File presign API guard must not upload workspace data."],
    ["requires_private_bucket_before_enablement: true", "File presign API guard must require private bucket policy."],
    ["requires_authenticated_actor_before_enablement: true", "File presign API guard must require authenticated actors."],
    ["requires_workspace_membership_before_enablement: true", "File presign API guard must require workspace membership."],
    ["requires_permission_check_before_enablement: true", "File presign API guard must require permission checks."],
    ["requires_checksum_before_enablement: true", "File presign API guard must require checksums."],
    ["requires_owner_confirmation_before_enablement: true", "File presign API guard must require owner confirmation."],
    ["requires_audit_event_envelope_before_enablement: true", "File presign API guard must require audit envelopes."],
    ['schema_status: "planned-metadata-only"', "File presign API guard must expose metadata-only request schema."],
    ['schema_status: "planned-no-url-body"', "File presign API guard must expose a no-URL response schema."],
    ["http_status: 501", "File presign API guard must keep the disabled HTTP status explicit."],
    ["returns_signed_upload_url: false", "File presign API guard must not return signed upload URLs."],
    ["returns_signed_download_url: false", "File presign API guard must not return signed download URLs."],
    ["returns_public_url: false", "File presign API guard must not return public URLs."],
    ["returns_storage_credentials: false", "File presign API guard must not return storage credentials."],
    ["returns_file_bytes: false", "File presign API guard must not return file bytes."],
  ]) {
    assertSourceIncludes(files.filePresignApiStub, filePresignApiStub, snippet, message);
  }
  for (const snippet of [
    "buildWebBetaApiStubResponse(\"file-presign\")",
    "workspace_id",
    "file_id",
    "storage_key",
    "operation",
    "file_kind",
    "mime_type",
    "size_bytes",
    "sha256",
    "requested_ttl_seconds",
    "confirmation_receipt_id",
    "permission_decision_id",
    "audit_envelope_id",
    "file_bytes",
    "data_url",
    "base64",
    "signed_upload_url",
    "signed_download_url",
    "public_url",
    "file_text",
    "page_body_text",
    "database_cell_values",
    "prompt_text",
    "token",
    "cookie",
    "secret",
    "request_body_raw",
    'format: "zhinote-file-presign-validator-fixtures"',
    'validator_status: "not-executing-route"',
    '"metadata-upload-request"',
    '"file-bytes-blocked"',
    '"signed-url-blocked"',
    '"authenticated-workspace-membership"',
    '"private-bucket-policy"',
    '"checksum-and-size-validation"',
    '"server-permission-check"',
    '"metadata-only-audit-envelope"',
    '"owner-file-sync-confirmation"',
  ]) {
    assertSourceIncludes(
      files.filePresignApiStub,
      filePresignApiStub,
      snippet,
      "File presign API guard must preserve metadata schema, fixtures, and enablement gates."
    );
  }
  assertSourceIncludes(
    files.filePresignRoute,
    filePresignRoute,
    "buildFilePresignApiDisabledResponse",
    "File presign route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.filePresignRoute,
    filePresignRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "File presign route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildFilePresignApiDisabledResponse",
    "Sync UI must build the file presign API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportFilePresignApiGuard",
    "Sync UI must export the file presign API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "文件签名 API 防护",
    "Sync UI must render the file presign API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出文件签名防护",
    "Sync UI must render the file presign guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "filePresignApiGuard.disabled_response_contract.http_status",
    "Sync UI must render the file presign disabled HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "allowedFields={filePresignApiGuard.request_schema.allowed_fields}",
    "Sync UI must render file presign allowed fields."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "forbiddenFields={filePresignApiGuard.request_schema.forbidden_fields}",
    "Sync UI must render file presign forbidden fields."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={filePresignApiGuard.local_validator_report.fixtures}",
    "Sync UI must render file presign validator fixtures."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    'format: "zhinote-web-beta-stage-gate"',
    "Web Beta stage gate must expose a stable export format."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    "buildWebBetaStageGateReport",
    "Web Beta stage gate must expose a reusable builder."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    'gate_status: "local-stage-gate-only"',
    "Web Beta stage gate must remain a local-only report."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    'launch_verdict: "not-ready"',
    "Web Beta stage gate must not claim launch readiness."
  );
  for (const [snippet, message] of [
    [
      "local_app_can_continue_now: true",
      "Stage gate must preserve local app continuity.",
    ],
    [
      "web_beta_can_launch_now: false",
      "Stage gate must not allow Web Beta launch.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Stage gate must not allow cloud sync.",
    ],
    [
      "reads_page_body_text: false",
      "Stage gate must not read page body text.",
    ],
    ["reads_file_bytes: false", "Stage gate must not read file bytes."],
    [
      "reads_secret_values: false",
      "Stage gate must not read secret values.",
    ],
    [
      "connects_cloud_services: false",
      "Stage gate must not connect cloud services.",
    ],
    ["deploys_app: false", "Stage gate must not deploy the app."],
    ["creates_accounts: false", "Stage gate must not create accounts."],
    [
      "writes_workspace_data: false",
      "Stage gate must not write workspace data.",
    ],
    ["writes_server_data: false", "Stage gate must not write server data."],
    [
      "uploads_workspace_data: false",
      "Stage gate must not upload workspace data.",
    ],
    ["enables_sync: false", "Stage gate must not enable sync."],
    ["enables_ai: false", "Stage gate must not enable AI execution."],
    [
      "requires_owner_confirmation_before_cloud: true",
      "Stage gate must require owner confirmation before cloud work.",
    ],
  ]) {
    assertSourceIncludes(files.webBetaStageGate, webBetaStageGate, snippet, message);
  }
  for (const gateId of [
    "local-workbench",
    "auth-session",
    "cloud-database",
    "private-file-storage",
    "sync-push-pull",
    "backup-restore",
    "permissions-audit",
    "deployment-release",
    "owner-beta-decision",
  ]) {
    assertSourceIncludes(
      files.webBetaStageGate,
      webBetaStageGate,
      `"${gateId}"`,
      `Stage gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaStageGateReport",
    "Sync UI must build the Web Beta stage gate report."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebBetaStageGate",
    "Sync UI must export the Web Beta stage gate report."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Web Beta 阶段门禁",
    "Sync UI must render the Web Beta stage gate panel."
  );
  for (const [snippet, message] of [
    [
      'format: "zhinote-web-beta-next-action-plan"',
      "Next action plan must expose a stable export format.",
    ],
    [
      "WebBetaNextActionOwner",
      "Next action plan must assign action ownership.",
    ],
    [
      "WebBetaNextActionExecutionPath",
      "Next action plan must classify local-first, cloud-required, and owner-decision paths.",
    ],
    [
      "WebBetaNextActionCloudDependency",
      "Next action plan must classify cloud dependencies.",
    ],
    [
      "can_start_locally",
      "Next action plan must say whether work can start locally.",
    ],
    [
      "verification_commands",
      "Next action plan must attach local verification commands.",
    ],
    [
      "completion_evidence",
      "Next action plan must list completion evidence.",
    ],
    [
      "forbidden_until_confirmed",
      "Next action plan must list forbidden actions before confirmation.",
    ],
    [
      "DEFAULT_FORBIDDEN_ACTIONS",
      "Next action plan must preserve default no-cloud/no-upload constraints.",
    ],
  ]) {
    assertSourceIncludes(files.webBetaNextActions, webBetaNextActions, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "NextActionOwnerPill",
      "Sync UI must render owner labels for next actions.",
    ],
    [
      "NextActionExecutionPathPill",
      "Sync UI must render execution path labels for next actions.",
    ],
    [
      "NextActionCloudDependencyPill",
      "Sync UI must render cloud dependency labels for next actions.",
    ],
    [
      "验证",
      "Sync UI must render verification commands for next actions.",
    ],
    [
      "完成证据",
      "Sync UI must render completion evidence for next actions.",
    ],
    [
      "确认前禁止",
      "Sync UI must render forbidden-before-confirmation boundaries.",
    ],
    [
      "summary.local_first",
      "Sync UI must summarize local-first next actions.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  assertSourceIncludes(
    files.webLaunchWorkbench,
    webLaunchWorkbench,
    'format: "zhinote-web-launch-workbench-packet"',
    "Web launch workbench must expose a stable export format."
  );
  assertSourceIncludes(
    files.webLaunchWorkbench,
    webLaunchWorkbench,
    "buildWebLaunchWorkbenchPacket",
    "Web launch workbench must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'packet_status: "local-web-launch-workbench-only"',
      "Web launch workbench must remain local-only.",
    ],
    [
      'launch_verdict: "not-ready"',
      "Web launch workbench must not claim launch readiness.",
    ],
    [
      "local_app_can_continue_now: true",
      "Web launch workbench must preserve local app continuity.",
    ],
    [
      "web_beta_can_launch_now: false",
      "Web launch workbench must not allow Web Beta launch.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Web launch workbench must not allow cloud sync.",
    ],
    [
      "reads_stage_gate_metadata: true",
      "Web launch workbench must read stage-gate metadata.",
    ],
    [
      "reads_next_action_plan: true",
      "Web launch workbench must read next-action metadata.",
    ],
    [
      "reads_owner_review_packet: true",
      "Web launch workbench must read owner-review metadata.",
    ],
    [
      "reads_route_preflight_summary: true",
      "Web launch workbench must read route preflight summary.",
    ],
    [
      "target_section_id",
      "Web launch workbench launch sequence must carry target section ids.",
    ],
    [
      "web-beta-stage-gate",
      "Web launch workbench must route P0 blockers to the stage gate section.",
    ],
    [
      "web-beta-deployment-target",
      "Web launch workbench must route deployment steps to the deployment target section.",
    ],
    [
      "web-beta-owner-review",
      "Web launch workbench must route owner approval to the owner review section.",
    ],
    [
      "reads_page_body_text: false",
      "Web launch workbench must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Web launch workbench must not read database row values.",
    ],
    [
      "reads_file_names: false",
      "Web launch workbench must not read file names.",
    ],
    [
      "reads_file_bytes: false",
      "Web launch workbench must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Web launch workbench must not read secret values.",
    ],
    [
      "reads_tokens_or_cookies: false",
      "Web launch workbench must not read tokens or cookies.",
    ],
    [
      "reads_holdings_or_trading_plans: false",
      "Web launch workbench must not read holdings or trading plans.",
    ],
    [
      "connects_cloud_services: false",
      "Web launch workbench must not connect cloud services.",
    ],
    [
      "creates_accounts: false",
      "Web launch workbench must not create accounts.",
    ],
    [
      "deploys_app: false",
      "Web launch workbench must not deploy the app.",
    ],
    [
      "writes_workspace_data: false",
      "Web launch workbench must not write workspace data.",
    ],
    [
      "writes_server_data: false",
      "Web launch workbench must not write server data.",
    ],
    [
      "uploads_workspace_data: false",
      "Web launch workbench must not upload workspace data.",
    ],
    [
      "enables_sync: false",
      "Web launch workbench must not enable sync.",
    ],
    [
      "enables_ai: false",
      "Web launch workbench must not enable AI.",
    ],
    [
      "local-continuity",
      "Web launch workbench must include the local continuity lane.",
    ],
    [
      "account-cloud",
      "Web launch workbench must include account/cloud lane.",
    ],
    [
      "schema-storage",
      "Web launch workbench must include schema/storage lane.",
    ],
    [
      "sync-conflict",
      "Web launch workbench must include sync/conflict lane.",
    ],
    [
      "backup-recovery",
      "Web launch workbench must include backup/recovery lane.",
    ],
    [
      "security-permission",
      "Web launch workbench must include security/permission lane.",
    ],
    [
      "deployment-release",
      "Web launch workbench must include deployment/release lane.",
    ],
    [
      "owner-decision",
      "Web launch workbench must include owner decision lane.",
    ],
    [
      "deploy_to_public_or_private_web_beta",
      "Web launch workbench must list forbidden launch actions.",
    ],
    [
      "upload_workspace_data",
      "Web launch workbench must forbid uploads before approval.",
    ],
    [
      "read_or_export_secret_values",
      "Web launch workbench must forbid secret-value export.",
    ],
  ]) {
    assertSourceIncludes(files.webLaunchWorkbench, webLaunchWorkbench, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildWebLaunchWorkbenchPacket",
      "Sync UI must build the Web launch workbench packet.",
    ],
    [
      "handleExportWebLaunchWorkbench",
      "Sync UI must export the Web launch workbench packet.",
    ],
    [
      "Web 上线工作台总控",
      "Sync UI must render the Web launch workbench panel.",
    ],
    [
      "导出 Web 上线工作台",
      "Sync UI must render the Web launch workbench export button.",
    ],
    [
      "上线分组",
      "Sync UI must render Web launch workbench lanes.",
    ],
    [
      "P0 / 优先动作",
      "Sync UI must render Web launch priority actions.",
    ],
    [
      "上线顺序",
      "Sync UI must render Web launch sequence.",
    ],
    [
      "WebLaunchLaneCard",
      "Sync UI must include a lane component for the Web launch workbench.",
    ],
    [
      "WebLaunchActionCard",
      "Sync UI must include an action component for the Web launch workbench.",
    ],
    [
      "WebLaunchSequenceCard",
      "Sync UI must include a launch sequence component.",
    ],
    [
      "handleWebLaunchStepOpen",
      "Sync UI must open Web launch sequence steps.",
    ],
    [
      "handleWebLaunchSectionOpen",
      "Sync UI must scroll top-level launch decision actions to target sections.",
    ],
    [
      "scrollIntoView",
      "Sync UI must scroll same-page Web launch steps to their target sections.",
    ],
    [
      "Web 上线决策摘要",
      "Sync UI must render the owner-facing Web launch decision summary.",
    ],
    [
      "WebLaunchDecisionSummaryPanel",
      "Sync UI must include a launch decision summary component.",
    ],
    [
      "LaunchDecisionMetric",
      "Sync UI must summarize launch go/no-go metrics.",
    ],
    [
      "LaunchDecisionFact",
      "Sync UI must render launch decision facts.",
    ],
    [
      "LaunchDecisionWorkItem",
      "Sync UI must render blockers and local-first work in the decision summary.",
    ],
    [
      'id="web-launch-decision-summary"',
      "Sync UI must expose a stable Web launch decision summary section id.",
    ],
    [
      "导出 Alpha 决策",
      "Sync UI must expose Alpha decision export from the summary.",
    ],
    [
      "导出 Beta 用户复核",
      "Sync UI must expose Beta owner review export from the summary.",
    ],
    [
      "打开步骤",
      "Sync UI must expose Web launch step open buttons.",
    ],
    [
      'id="web-launch-workbench"',
      "Sync UI must expose a stable Web launch workbench section id.",
    ],
    [
      'id="web-beta-stage-gate"',
      "Sync UI must expose a stable stage gate section id.",
    ],
    [
      "web-beta-deployment-target",
      "Sync UI must expose a stable deployment target section id.",
    ],
    [
      "web-beta-owner-review",
      "Sync UI must expose a stable owner review section id.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  assertSourceIncludes(
    files.webBetaAutonomyQueue,
    webBetaAutonomyQueue,
    'format: "zhinote-web-beta-autonomy-queue"',
    "Autonomy queue must expose a stable export format."
  );
  assertSourceIncludes(
    files.webBetaAutonomyQueue,
    webBetaAutonomyQueue,
    "buildWebBetaAutonomyQueue",
    "Autonomy queue must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'queue_status: "local-autonomy-queue-only"',
      "Autonomy queue must remain local-only.",
    ],
    [
      "can_continue_local_code_work: true",
      "Autonomy queue must allow local code work to continue.",
    ],
    [
      "web_beta_can_launch_now: false",
      "Autonomy queue must not allow Web Beta launch.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Autonomy queue must not allow cloud sync.",
    ],
    [
      "reads_next_action_metadata: true",
      "Autonomy queue must only use next-action metadata.",
    ],
    [
      "reads_owner_review_metadata: true",
      "Autonomy queue must use owner-review metadata.",
    ],
    [
      "reads_workbench_metadata: true",
      "Autonomy queue must use workbench metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Autonomy queue must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Autonomy queue must not read database rows.",
    ],
    [
      "reads_file_names: false",
      "Autonomy queue must not read file names.",
    ],
    [
      "reads_file_bytes: false",
      "Autonomy queue must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Autonomy queue must not read secret values.",
    ],
    [
      "reads_tokens_or_cookies: false",
      "Autonomy queue must not read tokens or cookies.",
    ],
    [
      "reads_holdings_or_trading_plans: false",
      "Autonomy queue must not read holdings or trading plans.",
    ],
    [
      "deploys_app: false",
      "Autonomy queue must not deploy.",
    ],
    [
      "creates_accounts: false",
      "Autonomy queue must not create accounts.",
    ],
    [
      "connects_cloud_services: false",
      "Autonomy queue must not connect cloud services.",
    ],
    [
      "writes_workspace_data: false",
      "Autonomy queue must not write workspace data.",
    ],
    [
      "writes_server_data: false",
      "Autonomy queue must not write server data.",
    ],
    [
      "uploads_workspace_data: false",
      "Autonomy queue must not upload workspace data.",
    ],
    [
      "enables_sync: false",
      "Autonomy queue must not enable sync.",
    ],
    [
      "enables_ai: false",
      "Autonomy queue must not enable AI.",
    ],
    [
      '"continue-locally"',
      "Autonomy queue must classify local work.",
    ],
    [
      '"hold-for-owner"',
      "Autonomy queue must classify owner-held work.",
    ],
    [
      '"hold-for-cloud"',
      "Autonomy queue must classify cloud-held work.",
    ],
    [
      '"forbidden"',
      "Autonomy queue must classify forbidden work.",
    ],
    [
      "recommended_local_batch",
      "Autonomy queue must expose a recommended local batch.",
    ],
    [
      "required_verification_commands",
      "Autonomy queue must expose verification commands for local work.",
    ],
  ]) {
    assertSourceIncludes(files.webBetaAutonomyQueue, webBetaAutonomyQueue, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildWebBetaAutonomyQueue",
      "Sync UI must build the autonomy queue.",
    ],
    [
      "handleExportAutonomyQueue",
      "Sync UI must export the autonomy queue.",
    ],
    [
      "本地自主队列",
      "Sync UI must render the autonomy queue panel.",
    ],
    [
      "导出本地自主队列",
      "Sync UI must render the autonomy queue export button.",
    ],
    [
      "睡眠期间可继续的工作",
      "Sync UI must describe overnight local work.",
    ],
    [
      "AutonomyQueueItemCard",
      "Sync UI must include an autonomy queue item component.",
    ],
    [
      "AutonomyQueueStatusPill",
      "Sync UI must include autonomy queue status labels.",
    ],
    [
      'id="web-beta-autonomy-queue"',
      "Sync UI must expose a stable autonomy queue section id.",
    ],
    [
      '"autonomy-queue"',
      "Sync UI must include autonomy queue export busy state.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  assertSourceIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    'format: "zhinote-web-beta-smoke-test-plan"',
    "Smoke test plan must expose a stable export format."
  );
  for (const [snippet, message] of [
    ["runs_tests: false", "Smoke test plan must not run tests."],
    [
      "sends_network_requests: false",
      "Smoke test plan must not send network requests.",
    ],
    ["deploys_app: false", "Smoke test plan must not deploy the app."],
    [
      "creates_accounts: false",
      "Smoke test plan must not create accounts.",
    ],
    [
      "connects_cloud_services: false",
      "Smoke test plan must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Smoke test plan must not upload workspace data.",
    ],
    [
      "exposes_secret_values: false",
      "Smoke test plan must not expose secret values.",
    ],
    [
      "requires_owner_confirmation_before_preview: true",
      "Smoke test plan must require owner confirmation before preview.",
    ],
    [
      'id: "cloud-alpha-disabled-defaults"',
      "Smoke test plan must check disabled cloud defaults.",
    ],
    [
      'id: "private-file-storage-remains-disabled"',
      "Smoke test plan must keep private file storage disabled until proven.",
    ],
    [
      'id: "cloudflare-edge-staging"',
      "Smoke test plan must include Cloudflare edge staging review.",
    ],
  ]) {
    assertSourceIncludes(files.smokeTestPlan, smokeTestPlan, snippet, message);
  }
  assertSourceIncludes(
    files.contract,
    contract,
    "web_beta_smoke_test_plan",
    "Web Beta contract export must include the smoke test plan."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaSmokeTestPlan",
    "Sync UI must build the smoke test plan."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebBetaSmokeTestPlan",
    "Sync UI must export the smoke test plan."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "冒烟测试计划",
    "Sync UI must render the smoke test plan panel."
  );
  assertSourceIncludes(
    files.webAlphaHandoffBundle,
    webAlphaHandoffBundle,
    'format: "zhinote-web-alpha-handoff-bundle"',
    "Web Alpha handoff bundle must expose a stable export format."
  );
  assertSourceIncludes(
    files.webAlphaHandoffBundle,
    webAlphaHandoffBundle,
    "buildWebAlphaHandoffBundle",
    "Web Alpha handoff bundle must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'bundle_status: "local-handoff-bundle-only"',
      "Handoff bundle must remain local-only.",
    ],
    [
      'release_verdict: "not-ready"',
      "Handoff bundle must not mark Web Alpha ready.",
    ],
    [
      "web_alpha_can_be_shared_now: false",
      "Handoff bundle must not approve sharing a preview.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Handoff bundle must not start cloud sync.",
    ],
    ["local_bundle_only: true", "Handoff bundle must stay local-only."],
    [
      "reads_launch_contracts: true",
      "Handoff bundle must read launch contract metadata.",
    ],
    [
      "reads_route_contracts: true",
      "Handoff bundle must read route contract metadata.",
    ],
    [
      "reads_smoke_test_plan: true",
      "Handoff bundle must read smoke plan metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Handoff bundle must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Handoff bundle must not read database row values.",
    ],
    [
      "reads_file_bytes: false",
      "Handoff bundle must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Handoff bundle must not read secret values.",
    ],
    [
      "sends_network_requests: false",
      "Handoff bundle must not send network requests.",
    ],
    ["deploys_app: false", "Handoff bundle must not deploy the app."],
    [
      "connects_cloud_services: false",
      "Handoff bundle must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Handoff bundle must not upload workspace data.",
    ],
    ["enables_sync: false", "Handoff bundle must not enable sync."],
    ["enables_ai: false", "Handoff bundle must not enable AI."],
    [
      "requires_owner_confirmation_before_preview: true",
      "Handoff bundle must require owner confirmation before preview.",
    ],
    [
      "requires_owner_confirmation_before_cloud: true",
      "Handoff bundle must require owner confirmation before cloud actions.",
    ],
    [
      "command_bundle",
      "Handoff bundle must include required local verification commands.",
    ],
    [
      "owner_decisions",
      "Handoff bundle must include owner decision gates.",
    ],
    [
      "excluded_payload_classes",
      "Handoff bundle must list private payload classes excluded from export.",
    ],
    [
      "npm run verify:web-beta:smoke",
      "Handoff bundle must include the Web Beta smoke verifier command.",
    ],
    [
      "verification_receipt_runner",
      "Handoff bundle must expose the one-command verification receipt runner.",
    ],
    [
      "npm run verify:web-alpha",
      "Handoff bundle must cite the Web Alpha verification receipt command.",
    ],
    [
      "holdings",
      "Handoff bundle must exclude holdings from handoff payloads.",
    ],
    [
      "trading_plans",
      "Handoff bundle must exclude trading plans from handoff payloads.",
    ],
  ]) {
    assertSourceIncludes(
      files.webAlphaHandoffBundle,
      webAlphaHandoffBundle,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.packageJson,
    packageJson,
    '"verify:web-alpha"',
    "package.json must expose the Web Alpha verification receipt command."
  );
  assertSourceIncludes(
    files.packageJson,
    packageJson,
    '"verify:route-smoke": "node scripts/verify-route-smoke.mjs"',
    "package.json must expose the no-browser local route smoke command."
  );
  for (const [snippet, message] of [
    [
      "nextBin",
      "Route smoke verifier must start Next.js directly without browser automation dependencies.",
    ],
    [
      'path: "/daily"',
      "Route smoke verifier must cover the daily calendar route.",
    ],
    [
      'path: "/page/zhinote-route-prefetch"',
      "Route smoke verifier must cover the page shell warmup route.",
    ],
    [
      "privacyBoundary",
      "Route smoke verifier must document its private-data boundary.",
    ],
  ]) {
    assertSourceIncludes(
      files.routeSmokeVerifier,
      routeSmokeVerifier,
      snippet,
      message
    );
  }
  assertSourceExcludes(
    files.routeSmokeVerifier,
    routeSmokeVerifier,
    "playwright",
    "Route smoke verifier must not depend on Playwright because the repo does not install it."
  );
  assertSourceIncludes(
    files.webAlphaReceiptVerifier,
    webAlphaReceiptVerifier,
    'format: "zhinote-web-alpha-verification-receipt"',
    "Web Alpha receipt verifier must expose a stable receipt format."
  );
  assertSourceIncludes(
    files.webAlphaReceiptVerifier,
    webAlphaReceiptVerifier,
    "Web Alpha verification receipt passed",
    "Web Alpha receipt verifier must print a clear pass result."
  );
  for (const [snippet, message] of [
    [
      'release_verdict: status === "passed" ? "locally-verified-not-launched" : "failed"',
      "Receipt must distinguish local verification from launch approval.",
    ],
    [
      "web_alpha_can_be_shared_now: false",
      "Receipt must not approve preview sharing.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Receipt must not approve cloud sync.",
    ],
    [
      "local_receipt_only: true",
      "Receipt must remain local-only.",
    ],
    [
      "runs_local_commands: true",
      "Receipt verifier must identify that it runs local commands.",
    ],
    [
      "sends_network_requests: false",
      "Receipt verifier must not send network requests.",
    ],
    [
      "deploys_app: false",
      "Receipt verifier must not deploy the app.",
    ],
    [
      "connects_cloud_services: false",
      "Receipt verifier must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Receipt verifier must not upload workspace data.",
    ],
    [
      "reads_page_body_text: false",
      "Receipt verifier must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Receipt verifier must not read database row values.",
    ],
    [
      "reads_file_bytes: false",
      "Receipt verifier must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Receipt verifier must not read secrets.",
    ],
    [
      "enables_sync: false",
      "Receipt verifier must not enable sync.",
    ],
    [
      "enables_ai: false",
      "Receipt verifier must not enable AI.",
    ],
    [
      "shell: false",
      "Receipt verifier must run commands without shell interpolation.",
    ],
    [
      "npm run lint",
      "Receipt verifier must run lint.",
    ],
    [
      "npm run verify:web-beta",
      "Receipt verifier must run Web Beta contract verification.",
    ],
    [
      "npm run verify:web-beta:smoke",
      "Receipt verifier must run Web Beta smoke verification.",
    ],
    [
      "npm run verify:replay-harness",
      "Receipt verifier must run replay harness safety verification.",
    ],
    [
      "npm run build",
      "Receipt verifier must run production build.",
    ],
  ]) {
    assertSourceIncludes(
      files.webAlphaReceiptVerifier,
      webAlphaReceiptVerifier,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebAlphaHandoffBundle",
    "Sync UI must build the Web Alpha handoff bundle."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebAlphaHandoffBundle",
    "Sync UI must export the Web Alpha handoff bundle."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Web Alpha 交接包",
    "Sync UI must render the Web Alpha handoff bundle panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出交接包",
    "Sync UI must expose the handoff bundle export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "verification_receipt_runner",
    "Sync UI must render the Web Alpha verification receipt runner."
  );
  assertSourceIncludes(
    files.webAlphaLaunchDecisionReceipt,
    webAlphaLaunchDecisionReceipt,
    'format: "zhinote-web-alpha-launch-decision-receipt"',
    "Web Alpha launch decision receipt must expose a stable export format."
  );
  assertSourceIncludes(
    files.webAlphaLaunchDecisionReceipt,
    webAlphaLaunchDecisionReceipt,
    "buildWebAlphaLaunchDecisionReceipt",
    "Web Alpha launch decision receipt must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'receipt_status: "local-launch-decision-only"',
      "Launch decision receipt must stay local-only.",
    ],
    [
      'release_verdict: "no-go"',
      "Launch decision receipt must not approve preview launch.",
    ],
    [
      'decision: "continue-local-build-no-preview"',
      "Launch decision receipt must distinguish local progress from preview approval.",
    ],
    [
      "web_alpha_preview_can_be_shared_now: false",
      "Launch decision receipt must not approve preview sharing.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Launch decision receipt must not approve cloud sync.",
    ],
    [
      "local_receipt_only: true",
      "Launch decision receipt must be local-only.",
    ],
    [
      "reads_handoff_bundle: true",
      "Launch decision receipt must read handoff metadata.",
    ],
    [
      "reads_stage_gate_metadata: true",
      "Launch decision receipt must read stage gate metadata.",
    ],
    [
      "reads_next_action_plan: true",
      "Launch decision receipt must read next-action metadata.",
    ],
    [
      "reads_environment_metadata: true",
      "Launch decision receipt must read environment metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Launch decision receipt must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Launch decision receipt must not read database row values.",
    ],
    [
      "reads_file_bytes: false",
      "Launch decision receipt must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Launch decision receipt must not read secrets.",
    ],
    [
      "reads_holding_details: false",
      "Launch decision receipt must not read holding details.",
    ],
    [
      "reads_trading_plans: false",
      "Launch decision receipt must not read trading plans.",
    ],
    [
      "sends_network_requests: false",
      "Launch decision receipt must not send network requests.",
    ],
    ["deploys_app: false", "Launch decision receipt must not deploy the app."],
    [
      "connects_cloud_services: false",
      "Launch decision receipt must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Launch decision receipt must not upload workspace data.",
    ],
    ["enables_sync: false", "Launch decision receipt must not enable sync."],
    ["enables_ai: false", "Launch decision receipt must not enable AI."],
    [
      "forbidden_actions_before_owner_approval",
      "Launch decision receipt must list forbidden actions before owner approval.",
    ],
    [
      "share_web_alpha_preview",
      "Launch decision receipt must forbid preview sharing before owner approval.",
    ],
    [
      "enable_sync_push",
      "Launch decision receipt must forbid sync push before owner approval.",
    ],
    [
      "enable_ai_execution",
      "Launch decision receipt must forbid AI execution before owner approval.",
    ],
    [
      "excluded_payload_classes",
      "Launch decision receipt must carry excluded private payload classes.",
    ],
  ]) {
    assertSourceIncludes(
      files.webAlphaLaunchDecisionReceipt,
      webAlphaLaunchDecisionReceipt,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebAlphaLaunchDecisionReceipt",
    "Sync UI must build the Web Alpha launch decision receipt."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebAlphaLaunchDecisionReceipt",
    "Sync UI must export the Web Alpha launch decision receipt."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Web Alpha 上线决策收据",
    "Sync UI must render the Web Alpha launch decision panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出上线决策",
    "Sync UI must expose the launch decision export button."
  );
  assertSourceIncludes(
    files.webBetaOwnerReviewPacket,
    webBetaOwnerReviewPacket,
    'format: "zhinote-web-beta-owner-review-packet"',
    "Web Beta owner review packet must expose a stable export format."
  );
  assertSourceIncludes(
    files.webBetaOwnerReviewPacket,
    webBetaOwnerReviewPacket,
    "buildWebBetaOwnerReviewPacket",
    "Web Beta owner review packet must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'packet_status: "local-owner-review-only"',
      "Owner review packet must stay local-only.",
    ],
    [
      'launch_verdict: "not-ready"',
      "Owner review packet must not approve Web Beta launch.",
    ],
    [
      'owner_review_status: "rehearsal-only"',
      "Owner review packet must remain a rehearsal-only review artifact.",
    ],
    [
      'decision: "continue-local-build-no-beta"',
      "Owner review packet must distinguish local progress from beta approval.",
    ],
    [
      "web_beta_can_launch_now: false",
      "Owner review packet must not approve Web Beta launch.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Owner review packet must not approve cloud sync.",
    ],
    [
      "local_packet_only: true",
      "Owner review packet must be local-only.",
    ],
    [
      "reads_stage_gate_metadata: true",
      "Owner review packet must read stage gate metadata.",
    ],
    [
      "reads_next_action_plan: true",
      "Owner review packet must read next-action metadata.",
    ],
    [
      "reads_smoke_test_plan: true",
      "Owner review packet must read smoke test metadata.",
    ],
    [
      "reads_environment_metadata: true",
      "Owner review packet must read environment metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Owner review packet must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Owner review packet must not read database row values.",
    ],
    [
      "reads_file_names: false",
      "Owner review packet must not read file names.",
    ],
    [
      "reads_file_bytes: false",
      "Owner review packet must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Owner review packet must not read secrets.",
    ],
    [
      "reads_holding_details: false",
      "Owner review packet must not read holding details.",
    ],
    [
      "reads_trading_plans: false",
      "Owner review packet must not read trading plans.",
    ],
    [
      "sends_network_requests: false",
      "Owner review packet must not send network requests.",
    ],
    ["deploys_app: false", "Owner review packet must not deploy the app."],
    [
      "connects_cloud_services: false",
      "Owner review packet must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Owner review packet must not upload workspace data.",
    ],
    ["enables_sync: false", "Owner review packet must not enable sync."],
    ["enables_ai: false", "Owner review packet must not enable AI."],
    [
      "review_questions",
      "Owner review packet must list owner review questions.",
    ],
    ["p0_blockers", "Owner review packet must list P0 blockers."],
    [
      "local_first_work",
      "Owner review packet must list local-first work that can continue.",
    ],
    [
      "required_verification_commands",
      "Owner review packet must list required verification commands.",
    ],
    [
      "completion_evidence_required",
      "Owner review packet must list completion evidence requirements.",
    ],
    [
      "forbidden_actions_before_owner_approval",
      "Owner review packet must list forbidden actions before owner approval.",
    ],
    [
      "share_web_beta_preview",
      "Owner review packet must forbid beta preview sharing before owner approval.",
    ],
    [
      "enable_sync_push",
      "Owner review packet must forbid sync push before owner approval.",
    ],
    [
      "enable_ai_execution",
      "Owner review packet must forbid AI execution before owner approval.",
    ],
    [
      "excluded_payload_classes",
      "Owner review packet must carry excluded private payload classes.",
    ],
  ]) {
    assertSourceIncludes(
      files.webBetaOwnerReviewPacket,
      webBetaOwnerReviewPacket,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaOwnerReviewPacket",
    "Sync UI must build the Web Beta owner review packet."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebBetaOwnerReviewPacket",
    "Sync UI must export the Web Beta owner review packet."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Web Beta 用户复核包",
    "Sync UI must render the Web Beta owner review panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出用户复核",
    "Sync UI must expose the owner review export button."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "Web Beta smoke test verification passed",
    "Smoke test verifier must expose a pass/fail CLI result."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "gatedOrDisabledApiRoutes",
    "Smoke test verifier must check high-risk API route guards."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "requiredBoundarySnippets",
    "Smoke test verifier must check local-only privacy boundaries."
  );
  assertSourceIncludes(
    files.conflictResolution,
    conflictResolution,
    'format: "zhinote-sync-conflict-resolution-contract"',
    "Sync conflict resolution must expose a stable export format."
  );
  assertSourceIncludes(
    files.conflictResolution,
    conflictResolution,
    "buildSyncConflictResolutionContract",
    "Sync conflict resolution must expose a reusable builder."
  );
  assertSourceIncludes(
    files.conflictResolution,
    conflictResolution,
    "can_apply_resolution_now: false",
    "Sync conflict resolution must not allow applying resolutions."
  );
  for (const [snippet, message] of [
    ["local_contract_only: true", "Conflict resolution must be local-only."],
    ["reads_remote_data: false", "Conflict resolution must not read remote data."],
    ["reads_page_body_text: false", "Conflict resolution must not read page bodies."],
    [
      "reads_database_row_values: false",
      "Conflict resolution must not read database row values.",
    ],
    ["reads_comment_bodies: false", "Conflict resolution must not read comment bodies."],
    ["reads_file_bytes: false", "Conflict resolution must not read file bytes."],
    ["merges_changes: false", "Conflict resolution must not merge changes."],
    [
      "applies_remote_changes: false",
      "Conflict resolution must not apply remote changes.",
    ],
    [
      "writes_workspace_data: false",
      "Conflict resolution must not write workspace data.",
    ],
    ["updates_permissions: false", "Conflict resolution must not update permissions."],
    ["runs_restore: false", "Conflict resolution must not run restore."],
    [
      "uploads_workspace_data: false",
      "Conflict resolution must not upload workspace data.",
    ],
    [
      "connects_cloud_services: false",
      "Conflict resolution must not connect cloud services.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Conflict resolution must not acknowledge remote rows.",
    ],
    [
      "requires_side_by_side_review: true",
      "Conflict resolution must require side-by-side review.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Conflict resolution must require owner confirmation before apply.",
    ],
    [
      "requires_audit_event_before_apply: true",
      "Conflict resolution must require audit before apply.",
    ],
    [
      "requires_rollback_snapshot_before_apply: true",
      "Conflict resolution must require rollback snapshot before apply.",
    ],
  ]) {
    assertSourceIncludes(files.conflictResolution, conflictResolution, snippet, message);
  }
  for (const actionId of [
    "keep-local",
    "accept-remote",
    "manual-merge",
    "append-only",
    "keep-both",
    "skip-and-flag",
  ]) {
    assertSourceIncludes(
      files.conflictResolution,
      conflictResolution,
      `"${actionId}"`,
      `Conflict resolution action ${actionId} must remain available.`
    );
  }
  for (const gateId of [
    "remote-baseline-loaded",
    "side-by-side-review-ui",
    "permission-check-before-apply",
    "rollback-snapshot-before-apply",
    "audit-event-before-apply",
    "disabled-apply-path",
  ]) {
    assertSourceIncludes(
      files.conflictResolution,
      conflictResolution,
      `id: "${gateId}"`,
      `Conflict resolution gate ${gateId} must remain available.`
    );
  }
  for (const [snippet, message] of [
    [
      'status: "local-side-by-side-preview-only"',
      "Conflict review UI must expose a local side-by-side preview status.",
    ],
    ['route: "/modules/sync"', "Conflict review UI must live in the sync module."],
    [
      "can_select_actions_now: false",
      "Conflict review UI must not allow action selection yet.",
    ],
    [
      "can_apply_actions_now: false",
      "Conflict review UI must not allow apply yet.",
    ],
    [
      "uses_placeholder_evidence: true",
      "Conflict review UI must use placeholder evidence only.",
    ],
    [
      "action_buttons_disabled: true",
      "Conflict review UI action buttons must remain disabled.",
    ],
    ['lane_order: ["base", "local", "remote"]', "Conflict review UI must keep base/local/remote lane order."],
    [
      "buildSideBySideReviewUi",
      "Conflict resolution builder must include side-by-side review UI planning.",
    ],
    [
      "buildSurfaceReviewUi",
      "Conflict resolution builder must create review surfaces.",
    ],
    [
      "buildReviewActionButton",
      "Conflict resolution builder must create disabled review action buttons.",
    ],
  ]) {
    assertSourceIncludes(files.conflictResolution, conflictResolution, snippet, message);
  }
  assertSourceIncludes(
    files.remoteBaselineRequest,
    remoteBaselineRequest,
    'format: "zhinote-remote-baseline-request-contract"',
    "Remote baseline request must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineRequest,
    remoteBaselineRequest,
    "buildRemoteBaselineRequestContract",
    "Remote baseline request must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      "can_request_remote_baseline_now: false",
      "Remote baseline request must not be enabled yet.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline request must not stage remote rows yet.",
    ],
    [
      "can_apply_remote_rows_now: false",
      "Remote baseline request must not apply remote rows.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline request must not start network requests.",
    ],
    [
      "connects_cloud_services: false",
      "Remote baseline request must not connect cloud services.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline request must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline request must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline request must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline request must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline request must not read file bytes.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline request must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline request must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline request must not apply remote changes.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline request must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline request must not upload workspace data.",
    ],
    [
      "requires_authenticated_session: true",
      "Remote baseline request must require authenticated session before enablement.",
    ],
    [
      "requires_workspace_membership: true",
      "Remote baseline request must require workspace membership.",
    ],
    [
      "requires_side_by_side_review_staging: true",
      "Remote baseline request must require side-by-side staging.",
    ],
    [
      "requires_permission_check_before_fetch: true",
      "Remote baseline request must require permission check.",
    ],
    [
      "requires_audit_event_before_fetch: true",
      "Remote baseline request must require audit event.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Remote baseline request must require owner confirmation before apply.",
    ],
    [
      'endpoint: "/api/sync/pull"',
      "Remote baseline request must target the disabled sync pull endpoint.",
    ],
    [
      'query_mode: "baseline"',
      "Remote baseline request must use baseline query mode.",
    ],
    [
      'response_handling: "stage-for-review-only"',
      "Remote baseline response must be staged for review only.",
    ],
    [
      "page_body_text",
      "Remote baseline request must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline request must explicitly forbid database cell values.",
    ],
    [
      "comment_body",
      "Remote baseline request must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline request must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline request must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(files.remoteBaselineRequest, remoteBaselineRequest, snippet, message);
  }
  for (const gateId of [
    "cloud-workspace-link",
    "auth-session-boundary",
    "sync-pull-endpoint-disabled",
    "remote-cursor-contract",
    "side-by-side-staging-target",
    "permission-check-before-fetch",
    "audit-event-before-fetch",
    "owner-confirmation-before-apply",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineRequest,
      remoteBaselineRequest,
      `id: "${gateId}"`,
      `Remote baseline gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.remoteBaselineStaging,
    remoteBaselineStaging,
    'format: "zhinote-remote-baseline-staging-contract"',
    "Remote baseline staging must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineStaging,
    remoteBaselineStaging,
    "buildRemoteBaselineStagingContract",
    "Remote baseline staging must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      "can_stage_remote_metadata_now: false",
      "Remote baseline staging must not stage metadata yet.",
    ],
    [
      "can_persist_stage_store_now: false",
      "Remote baseline staging must not persist a stage store.",
    ],
    [
      "can_apply_staged_rows_now: false",
      "Remote baseline staging must not apply staged rows.",
    ],
    [
      'disabled_source_endpoint: "/api/sync/pull"',
      "Remote baseline staging must use the disabled sync pull endpoint.",
    ],
    [
      'disabled_stage_table: "remote_baseline_stage"',
      "Remote baseline staging must name the disabled stage table.",
    ],
    [
      "uses_placeholder_metadata: true",
      "Remote baseline staging must use placeholder metadata only.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline staging must not start network requests.",
    ],
    [
      "connects_cloud_services: false",
      "Remote baseline staging must not connect cloud services.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline staging must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline staging must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline staging must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline staging must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline staging must not read file bytes.",
    ],
    [
      "persists_stage_store: false",
      "Remote baseline staging must not persist stage data.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline staging must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline staging must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline staging must not apply remote changes.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline staging must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline staging must not upload workspace data.",
    ],
    [
      "requires_remote_baseline_request_contract: true",
      "Remote baseline staging must require the request contract.",
    ],
    [
      "requires_cursor_proof: true",
      "Remote baseline staging must require cursor proof.",
    ],
    [
      "requires_side_by_side_review_surface: true",
      "Remote baseline staging must require side-by-side review surface.",
    ],
    [
      "requires_permission_check_before_stage: true",
      "Remote baseline staging must require permission check.",
    ],
    [
      "requires_audit_event_before_stage: true",
      "Remote baseline staging must require audit event.",
    ],
    [
      "requires_rollback_snapshot_before_apply: true",
      "Remote baseline staging must require rollback before apply.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Remote baseline staging must require owner confirmation before apply.",
    ],
    [
      'staging_table: "remote_baseline_stage"',
      "Remote baseline staging must route to the planned stage table.",
    ],
    [
      'target_review_lane: "remote"',
      "Remote baseline staging must target the Remote review lane.",
    ],
    [
      "page_body_text",
      "Remote baseline staging must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline staging must explicitly forbid database values.",
    ],
    [
      "comment_body",
      "Remote baseline staging must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline staging must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline staging must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(files.remoteBaselineStaging, remoteBaselineStaging, snippet, message);
  }
  for (const gateId of [
    "baseline-request-contract",
    "stage-store-schema",
    "cursor-proof-before-stage",
    "permission-check-before-stage",
    "audit-event-before-stage",
    "side-by-side-remote-lane",
    "rollback-before-apply",
    "owner-confirmation-before-apply",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStaging,
      remoteBaselineStaging,
      `id: "${gateId}"`,
      `Remote baseline staging gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.remoteBaselineStageSchema,
    remoteBaselineStageSchema,
    'format: "zhinote-remote-baseline-stage-schema-contract"',
    "Remote baseline stage schema must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineStageSchema,
    remoteBaselineStageSchema,
    "buildRemoteBaselineStageSchemaContract",
    "Remote baseline stage schema must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      "can_create_stage_schema_now: false",
      "Remote baseline stage schema must not create schema yet.",
    ],
    [
      "can_persist_cursor_proof_now: false",
      "Remote baseline stage schema must not persist cursor proof.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline stage schema must not apply SQL.",
    ],
    [
      "can_stage_remote_metadata_now: false",
      "Remote baseline stage schema must not stage remote metadata.",
    ],
    [
      "can_apply_staged_rows_now: false",
      "Remote baseline stage schema must not apply staged rows.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline stage schema must keep migration apply disabled.",
    ],
    [
      "creates_database_migration: false",
      "Remote baseline stage schema must not create migrations.",
    ],
    ["applies_sql: false", "Remote baseline stage schema must not apply SQL."],
    [
      "connects_cloud_database: false",
      "Remote baseline stage schema must not connect cloud database.",
    ],
    [
      "writes_server_data: false",
      "Remote baseline stage schema must not write server data.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline stage schema must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline stage schema must not upload workspace data.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline stage schema must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline stage schema must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline stage schema must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline stage schema must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline stage schema must not read file bytes.",
    ],
    [
      "permits_payload_columns: false",
      "Remote baseline stage schema must not permit payload columns.",
    ],
    [
      "persists_cursor_proof: false",
      "Remote baseline stage schema must not persist cursor proof.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline stage schema must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline stage schema must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline stage schema must not apply remote changes.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Remote baseline stage schema must require owner confirmation.",
    ],
    [
      "requires_disposable_database_replay: true",
      "Remote baseline stage schema must require disposable database replay.",
    ],
    [
      "requires_rls_workspace_scope: true",
      "Remote baseline stage schema must require RLS workspace scope.",
    ],
    [
      "requires_payload_column_denylist: true",
      "Remote baseline stage schema must require payload denylist.",
    ],
    [
      "requires_cursor_monotonicity_proof: true",
      "Remote baseline stage schema must require cursor monotonicity proof.",
    ],
    [
      "requires_idempotency_proof: true",
      "Remote baseline stage schema must require idempotency proof.",
    ],
    [
      "requires_audit_event_before_stage: true",
      "Remote baseline stage schema must require audit event.",
    ],
    [
      "requires_permission_check_before_stage: true",
      "Remote baseline stage schema must require permission check.",
    ],
    [
      'table_name: "remote_baseline_stage"',
      "Remote baseline stage schema must define the stage table.",
    ],
    [
      'table_name: "remote_baseline_cursor_proof"',
      "Remote baseline stage schema must define cursor proof table.",
    ],
    [
      "remote_baseline_stage_status_check",
      "Remote baseline stage schema must define stage status check.",
    ],
    [
      "remote_baseline_stage_no_payload_columns",
      "Remote baseline stage schema must define payload column denylist.",
    ],
    [
      "remote_baseline_cursor_batch_unique",
      "Remote baseline stage schema must define cursor idempotency uniqueness.",
    ],
    [
      "idx_remote_baseline_stage_workspace_cursor",
      "Remote baseline stage schema must define workspace cursor index.",
    ],
    [
      "page_body_text",
      "Remote baseline stage schema must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline stage schema must explicitly forbid database values.",
    ],
    [
      "comment_body",
      "Remote baseline stage schema must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline stage schema must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline stage schema must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageSchema,
      remoteBaselineStageSchema,
      snippet,
      message
    );
  }
  for (const gateId of [
    "stage-schema-draft",
    "cursor-proof-draft",
    "payload-column-denylist",
    "rls-workspace-scope",
    "permission-check-before-stage",
    "audit-event-before-stage",
    "migration-apply-disabled",
    "rollback-before-apply",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageSchema,
      remoteBaselineStageSchema,
      `"${gateId}"`,
      `Remote baseline stage schema gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.remoteBaselineStageReplay,
    remoteBaselineStageReplay,
    'format: "zhinote-remote-baseline-stage-replay-contract"',
    "Remote baseline stage replay must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineStageReplay,
    remoteBaselineStageReplay,
    "buildRemoteBaselineStageReplayContract",
    "Remote baseline stage replay must expose a reusable builder."
  );
  for (const [snippet, message] of [
    ["can_run_replay_now: false", "Remote baseline stage replay must not run replay."],
    [
      "can_connect_disposable_database_now: false",
      "Remote baseline stage replay must not connect disposable database.",
    ],
    ["can_apply_sql_now: false", "Remote baseline stage replay must not apply SQL."],
    [
      "can_write_server_data_now: false",
      "Remote baseline stage replay must not write server data.",
    ],
    [
      "can_stage_remote_metadata_now: false",
      "Remote baseline stage replay must not stage remote metadata.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline stage replay must keep migration apply disabled.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline stage replay must keep replay endpoint disabled.",
    ],
    [
      "uses_disposable_data_only: true",
      "Remote baseline stage replay must use disposable data only.",
    ],
    [
      "creates_disposable_database: false",
      "Remote baseline stage replay must not create disposable database.",
    ],
    [
      "connects_cloud_database: false",
      "Remote baseline stage replay must not connect cloud database.",
    ],
    ["applies_sql: false", "Remote baseline stage replay must not apply SQL."],
    [
      "writes_server_data: false",
      "Remote baseline stage replay must not write server data.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline stage replay must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline stage replay must not upload workspace data.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline stage replay must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline stage replay must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline stage replay must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline stage replay must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline stage replay must not read file bytes.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline stage replay must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline stage replay must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline stage replay must not apply remote changes.",
    ],
    [
      "requires_owner_confirmation_before_replay: true",
      "Remote baseline stage replay must require owner confirmation.",
    ],
    [
      "requires_empty_workspace_fixture: true",
      "Remote baseline stage replay must require empty workspace fixture.",
    ],
    [
      "requires_payload_denylist_assertion: true",
      "Remote baseline stage replay must require payload denylist assertion.",
    ],
    [
      "requires_rls_workspace_isolation_proof: true",
      "Remote baseline stage replay must require RLS proof.",
    ],
    [
      "requires_cursor_monotonicity_proof: true",
      "Remote baseline stage replay must require cursor monotonicity proof.",
    ],
    [
      "requires_idempotency_replay_proof: true",
      "Remote baseline stage replay must require idempotency proof.",
    ],
    [
      "requires_down_migration_rollback_proof: true",
      "Remote baseline stage replay must require rollback proof.",
    ],
    [
      "requires_audit_event_before_replay: true",
      "Remote baseline stage replay must require audit event.",
    ],
    [
      "requires_permission_check_before_replay: true",
      "Remote baseline stage replay must require permission check.",
    ],
    [
      "workspace-read-isolation",
      "Remote baseline stage replay must include workspace read isolation proof.",
    ],
    [
      "workspace-write-isolation",
      "Remote baseline stage replay must include workspace write isolation proof.",
    ],
    [
      "cursor-proof-isolation",
      "Remote baseline stage replay must include cursor proof isolation proof.",
    ],
    [
      "payload-denylist-schema-check",
      "Remote baseline stage replay must include payload denylist scenario.",
    ],
    [
      "cursor-monotonicity",
      "Remote baseline stage replay must include cursor monotonicity scenario.",
    ],
    [
      "idempotent-batch-replay",
      "Remote baseline stage replay must include idempotency scenario.",
    ],
    [
      "down-migration-rollback",
      "Remote baseline stage replay must include down migration rollback scenario.",
    ],
    [
      "page_body_text",
      "Remote baseline stage replay must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline stage replay must explicitly forbid database values.",
    ],
    [
      "comment_body",
      "Remote baseline stage replay must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline stage replay must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline stage replay must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageReplay,
      remoteBaselineStageReplay,
      snippet,
      message
    );
  }
  for (const gateId of [
    "owner-confirmation-before-replay",
    "disposable-database-available",
    "schema-sql-reviewed",
    "payload-denylist-proof",
    "rls-policy-proof",
    "cursor-proof-replay",
    "permission-check-before-replay",
    "audit-event-before-replay",
    "rollback-proof",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageReplay,
      remoteBaselineStageReplay,
      `"${gateId}"`,
      `Remote baseline stage replay gate ${gateId} must remain available.`
    );
  }
  for (const [file, source, snippet, message] of [
    [
      files.typedConfirmation,
      typedConfirmation,
      '| "remote-baseline-stage-replay"',
      "Typed confirmation must reserve remote baseline stage replay as a high-risk action.",
    ],
    [
      files.highRiskActionRegistry,
      highRiskActionRegistry,
      '"remote-baseline-stage-replay": "ENABLE DISPOSABLE REPLAY"',
      "High-risk registry must require a typed phrase before disposable replay.",
    ],
    [
      files.highRiskActionRegistry,
      highRiskActionRegistry,
      'disabled_endpoint: "/api/sync/replay-test"',
      "High-risk registry must keep disposable replay endpoint disabled.",
    ],
    [
      files.highRiskActionRegistry,
      highRiskActionRegistry,
      "zhinote-remote-baseline-replay-confirmation",
      "High-risk registry must expose a local replay confirmation receipt prefix.",
    ],
  ]) {
    assertSourceIncludes(file, source, snippet, message);
  }
  assertSourceIncludes(
    files.remoteBaselineReplayFixture,
    remoteBaselineReplayFixture,
    'format: "zhinote-remote-baseline-replay-fixture-package"',
    "Remote baseline replay fixture must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineReplayFixture,
    remoteBaselineReplayFixture,
    "buildRemoteBaselineReplayFixturePackage",
    "Remote baseline replay fixture must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'package_status: "local-empty-fixture-package-only"',
      "Remote baseline replay fixture must stay local-only.",
    ],
    [
      "can_export_fixture_now: true",
      "Remote baseline replay fixture must allow local export.",
    ],
    [
      "can_run_replay_now: false",
      "Remote baseline replay fixture must not run replay.",
    ],
    [
      "can_connect_database_now: false",
      "Remote baseline replay fixture must not connect databases.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline replay fixture must not apply SQL.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline replay fixture must not stage remote rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Remote baseline replay fixture must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline replay fixture must keep replay endpoint disabled.",
    ],
    [
      "empty_workspace_fixture: true",
      "Remote baseline replay fixture must use empty workspace fixtures.",
    ],
    [
      "metadata_only_fixture: true",
      "Remote baseline replay fixture must remain metadata-only.",
    ],
    [
      "creates_database: false",
      "Remote baseline replay fixture must not create databases.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline replay fixture must not start network requests.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline replay fixture must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline replay fixture must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline replay fixture must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline replay fixture must not read file bytes.",
    ],
    [
      "includes_page_body_text: false",
      "Remote baseline replay fixture must not include page body text.",
    ],
    [
      "includes_database_row_values: false",
      "Remote baseline replay fixture must not include database values.",
    ],
    [
      "includes_comment_bodies: false",
      "Remote baseline replay fixture must not include comment bodies.",
    ],
    [
      "includes_file_bytes: false",
      "Remote baseline replay fixture must not include file bytes.",
    ],
    [
      "includes_tokens: false",
      "Remote baseline replay fixture must not include tokens.",
    ],
    [
      "includes_cookies: false",
      "Remote baseline replay fixture must not include cookies.",
    ],
    [
      "stage_seed_rows: 0",
      "Remote baseline replay fixture must export zero stage seed rows.",
    ],
    [
      "cursor_proof_seed_rows: 0",
      "Remote baseline replay fixture must export zero cursor proof seed rows.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Remote baseline replay fixture must require owner confirmation receipt.",
    ],
    [
      "requires_phrase_match_before_real_replay: true",
      "Remote baseline replay fixture must require phrase match before real replay.",
    ],
    [
      "fixture-workspace-a-empty",
      "Remote baseline replay fixture must include workspace A empty fixture.",
    ],
    [
      "fixture-workspace-b-empty",
      "Remote baseline replay fixture must include workspace B empty fixture.",
    ],
    [
      "payload_column_denylist",
      "Remote baseline replay fixture must export payload denylist.",
    ],
    [
      "owner-confirmation-receipt",
      "Remote baseline replay fixture must validate owner confirmation receipt.",
    ],
    [
      "empty-workspace-fixtures",
      "Remote baseline replay fixture must validate empty workspace fixtures.",
    ],
    [
      "empty-fixture-users",
      "Remote baseline replay fixture must validate anonymous fixture users.",
    ],
    [
      "zero-stage-seed-rows",
      "Remote baseline replay fixture must validate zero stage rows.",
    ],
    [
      "zero-cursor-proof-seed-rows",
      "Remote baseline replay fixture must validate zero cursor rows.",
    ],
    [
      "payload-column-denylist",
      "Remote baseline replay fixture must validate payload denylist.",
    ],
    [
      "replay-endpoint-disabled",
      "Remote baseline replay fixture must validate disabled replay endpoint.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineReplayFixture,
      remoteBaselineReplayFixture,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.remoteBaselineReplayHarness,
    remoteBaselineReplayHarness,
    'format: "zhinote-remote-baseline-replay-harness-preflight"',
    "Remote baseline replay harness must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineReplayHarness,
    remoteBaselineReplayHarness,
    "buildRemoteBaselineReplayHarnessPreflight",
    "Remote baseline replay harness must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'preflight_status: "local-harness-preflight-only"',
      "Remote baseline replay harness must stay local-only.",
    ],
    [
      "can_run_harness_now: false",
      "Remote baseline replay harness must not run harness.",
    ],
    [
      "can_connect_database_now: false",
      "Remote baseline replay harness must not connect databases.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline replay harness must not apply SQL.",
    ],
    [
      "can_write_server_data_now: false",
      "Remote baseline replay harness must not write server data.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline replay harness must not stage remote rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Remote baseline replay harness must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline replay harness must keep replay endpoint disabled.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline replay harness must keep migration apply disabled.",
    ],
    [
      "local_preflight_only: true",
      "Remote baseline replay harness must remain local preflight only.",
    ],
    [
      "dry_run_only: true",
      "Remote baseline replay harness must remain dry-run only.",
    ],
    [
      "uses_empty_fixture_package: true",
      "Remote baseline replay harness must depend on empty fixture package.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline replay harness must not start network requests.",
    ],
    [
      "creates_disposable_database: false",
      "Remote baseline replay harness must not create disposable database.",
    ],
    [
      "connects_cloud_database: false",
      "Remote baseline replay harness must not connect cloud database.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline replay harness must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline replay harness must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline replay harness must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline replay harness must not read file bytes.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline replay harness must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline replay harness must not acknowledge remote rows.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Remote baseline replay harness must require owner confirmation receipt.",
    ],
    [
      "requires_empty_fixture_package: true",
      "Remote baseline replay harness must require empty fixture package.",
    ],
    [
      "requires_payload_denylist: true",
      "Remote baseline replay harness must require payload denylist.",
    ],
    [
      "requires_permission_check_stub: true",
      "Remote baseline replay harness must require permission check stub.",
    ],
    [
      "requires_redacted_audit_event: true",
      "Remote baseline replay harness must require redacted audit event.",
    ],
    [
      "requires_rls_assertion_plan: true",
      "Remote baseline replay harness must require RLS assertion plan.",
    ],
    [
      "requires_rollback_assertion_plan: true",
      "Remote baseline replay harness must require rollback assertion plan.",
    ],
    [
      "load-empty-fixture-package",
      "Remote baseline replay harness must include fixture loading step.",
    ],
    [
      "verify-owner-receipt",
      "Remote baseline replay harness must include owner receipt verification step.",
    ],
    [
      "review-stage-schema-sql",
      "Remote baseline replay harness must include schema SQL review step.",
    ],
    [
      "plan-up-down-replay",
      "Remote baseline replay harness must include up/down replay plan.",
    ],
    [
      "plan-rls-isolation",
      "Remote baseline replay harness must include RLS isolation plan.",
    ],
    [
      "plan-cursor-idempotency",
      "Remote baseline replay harness must include cursor idempotency plan.",
    ],
    [
      "plan-rollback-proof",
      "Remote baseline replay harness must include rollback proof plan.",
    ],
    [
      "fixture-has-zero-payload",
      "Remote baseline replay harness must assert zero fixture payload.",
    ],
    [
      "denylist-covers-private-content",
      "Remote baseline replay harness must assert denylist coverage.",
    ],
    [
      "permission-check-not-live",
      "Remote baseline replay harness must keep permission checks non-live.",
    ],
    [
      "audit-event-not-live",
      "Remote baseline replay harness must keep audit events non-live.",
    ],
    [
      "disposable-database-gate",
      "Remote baseline replay harness must keep disposable database gate.",
    ],
    [
      "network-disabled-gate",
      "Remote baseline replay harness must keep network disabled gate.",
    ],
    [
      "rollback-before-apply-gate",
      "Remote baseline replay harness must keep rollback before apply gate.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineReplayHarness,
      remoteBaselineReplayHarness,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.remoteBaselineReplayRunner,
    remoteBaselineReplayRunner,
    'format: "zhinote-remote-baseline-replay-runner-skeleton"',
    "Remote baseline replay runner must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineReplayRunner,
    remoteBaselineReplayRunner,
    "buildRemoteBaselineReplayRunnerSkeleton",
    "Remote baseline replay runner must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'runner_status: "disabled-runner-skeleton-only"',
      "Remote baseline replay runner must stay disabled.",
    ],
    [
      "can_export_runner_skeleton_now: true",
      "Remote baseline replay runner may only be exported locally.",
    ],
    [
      "can_run_runner_now: false",
      "Remote baseline replay runner must not run.",
    ],
    [
      "can_connect_database_now: false",
      "Remote baseline replay runner must not connect databases.",
    ],
    [
      "can_create_disposable_database_now: false",
      "Remote baseline replay runner must not create disposable databases.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline replay runner must not apply SQL.",
    ],
    [
      "can_start_network_request_now: false",
      "Remote baseline replay runner must not start network requests.",
    ],
    [
      "can_write_server_data_now: false",
      "Remote baseline replay runner must not write server data.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline replay runner must not stage remote rows.",
    ],
    [
      "can_acknowledge_remote_rows_now: false",
      "Remote baseline replay runner must not acknowledge rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Remote baseline replay runner must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline replay runner must keep replay endpoint disabled.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline replay runner must keep migration apply disabled.",
    ],
    [
      "local_skeleton_only: true",
      "Remote baseline replay runner must remain a local skeleton.",
    ],
    [
      "runner_disabled_by_default: true",
      "Remote baseline replay runner must stay disabled by default.",
    ],
    [
      "export_only: true",
      "Remote baseline replay runner must stay export-only.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline replay runner must not start network requests.",
    ],
    [
      "creates_disposable_database: false",
      "Remote baseline replay runner must not create disposable databases.",
    ],
    [
      "connects_cloud_database: false",
      "Remote baseline replay runner must not connect cloud database.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline replay runner must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline replay runner must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline replay runner must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline replay runner must not read file bytes.",
    ],
    [
      "includes_tokens: false",
      "Remote baseline replay runner must not include tokens.",
    ],
    [
      "includes_cookies: false",
      "Remote baseline replay runner must not include cookies.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline replay runner must not stage rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline replay runner must not acknowledge rows.",
    ],
    [
      "uses_production_workspace: false",
      "Remote baseline replay runner must not use production workspace data.",
    ],
    [
      "reads_environment_values: false",
      "Remote baseline replay runner must not read environment values.",
    ],
    [
      "uses_runtime_secrets: false",
      "Remote baseline replay runner must not use runtime secrets.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Remote baseline replay runner must require owner confirmation.",
    ],
    [
      "requires_empty_fixture_package: true",
      "Remote baseline replay runner must require empty fixture package.",
    ],
    [
      "requires_payload_denylist: true",
      "Remote baseline replay runner must require payload denylist.",
    ],
    [
      "requires_permission_check_stub: true",
      "Remote baseline replay runner must require permission check stub.",
    ],
    [
      "requires_redacted_audit_event: true",
      "Remote baseline replay runner must require redacted audit event.",
    ],
    [
      "requires_rls_assertion_plan: true",
      "Remote baseline replay runner must require RLS proof plan.",
    ],
    [
      "requires_rollback_assertion_plan: true",
      "Remote baseline replay runner must require rollback proof plan.",
    ],
    [
      "requires_owner_approval_to_enable: true",
      "Remote baseline replay runner must require owner approval before enablement.",
    ],
    [
      "export-runner-skeleton",
      "Remote baseline replay runner must keep local export entrypoint.",
    ],
    [
      "verify-replay-harness",
      "Remote baseline replay runner must keep safety verifier entrypoint.",
    ],
    [
      "open-disposable-database-connection",
      "Remote baseline replay runner must keep database connection blocked.",
    ],
    [
      "apply-up-sql",
      "Remote baseline replay runner must keep SQL apply blocked.",
    ],
    [
      "run-rls-isolation",
      "Remote baseline replay runner must keep RLS proof blocked.",
    ],
    [
      "run-cursor-idempotency",
      "Remote baseline replay runner must keep cursor proof blocked.",
    ],
    [
      "run-down-migration-rollback",
      "Remote baseline replay runner must keep rollback blocked.",
    ],
    [
      "private-payload-denylist",
      "Remote baseline replay runner must keep payload denylist refusal.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineReplayRunner,
      remoteBaselineReplayRunner,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildSyncConflictResolutionContract",
    "Sync UI must build the conflict resolution contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportSyncConflictResolution",
    "Sync UI must export the conflict resolution contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "冲突解决合同",
    "Sync UI must render the conflict resolution panel."
  );
  for (const [snippet, message] of [
    [
      "handleExportSyncConflictReviewUi",
      "Sync UI must export the side-by-side conflict review UI contract.",
    ],
    [
      "并排冲突复核",
      "Sync UI must render the side-by-side conflict review preview.",
    ],
    [
      "导出复核界面",
      "Sync UI must expose the review UI export action.",
    ],
    [
      "ResolutionReviewSurfaceRow",
      "Sync UI must render per-surface conflict review rows.",
    ],
    [
      "ResolutionReviewLaneCard",
      "Sync UI must render base/local/remote lane cards.",
    ],
    [
      "应用已禁用",
      "Sync UI must keep conflict apply disabled in the preview.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineRequestContract",
      "Sync UI must build the remote baseline request contract.",
    ],
    [
      "handleExportRemoteBaselineRequest",
      "Sync UI must export the remote baseline request contract.",
    ],
    [
      "远端基线请求合同",
      "Sync UI must render the remote baseline request panel.",
    ],
    [
      "导出基线请求",
      "Sync UI must expose the remote baseline export action.",
    ],
    [
      "RemoteBaselineSurfaceRow",
      "Sync UI must render remote baseline surface rows.",
    ],
    [
      "RemoteBaselineGateRow",
      "Sync UI must render remote baseline gates.",
    ],
    [
      "RemoteBaselineFieldRow",
      "Sync UI must render remote baseline field boundaries.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineStagingContract",
      "Sync UI must build the remote baseline staging contract.",
    ],
    [
      "handleExportRemoteBaselineStaging",
      "Sync UI must export the remote baseline staging contract.",
    ],
    [
      "远端基线暂存合同",
      "Sync UI must render the remote baseline staging panel.",
    ],
    [
      "导出基线暂存",
      "Sync UI must expose the remote baseline staging export action.",
    ],
    [
      "RemoteBaselineStageStoreCard",
      "Sync UI must render the remote baseline stage store boundary.",
    ],
    [
      "RemoteBaselineStageSurfaceRow",
      "Sync UI must render remote-lane surface staging rows.",
    ],
    [
      "RemoteBaselineStageGateRow",
      "Sync UI must render remote baseline staging gates.",
    ],
    [
      "RemoteBaselineStageFieldRow",
      "Sync UI must render remote baseline staging field boundaries.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineStageSchemaContract",
      "Sync UI must build the remote baseline stage schema contract.",
    ],
    [
      "handleExportRemoteBaselineStageSchema",
      "Sync UI must export the remote baseline stage schema contract.",
    ],
    [
      "远端基线暂存结构和游标证明",
      "Sync UI must render the remote baseline stage schema panel.",
    ],
    [
      "导出阶段结构",
      "Sync UI must expose the remote baseline stage schema export action.",
    ],
    [
      "RemoteBaselineStageSchemaTableCard",
      "Sync UI must render stage schema table draft.",
    ],
    [
      "RemoteBaselineCursorProofCard",
      "Sync UI must render cursor proof draft.",
    ],
    [
      "RemoteBaselineStageSchemaGateRow",
      "Sync UI must render schema proof gates.",
    ],
    [
      "RemoteBaselineStageSchemaSqlRow",
      "Sync UI must render schema SQL draft rows.",
    ],
    [
      "最终结构启用条件",
      "Sync UI must render final schema enablement conditions.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineStageReplayContract",
      "Sync UI must build the remote baseline stage replay contract.",
    ],
    [
      "handleExportRemoteBaselineStageReplay",
      "Sync UI must export the remote baseline stage replay contract.",
    ],
    [
      "远端基线一次性回放和 RLS 证明",
      "Sync UI must render the remote baseline stage replay panel.",
    ],
    [
      "导出阶段回放",
      "Sync UI must expose the remote baseline stage replay export action.",
    ],
    [
      "RemoteBaselineStageReplayScenarioRow",
      "Sync UI must render replay scenarios.",
    ],
    [
      "RemoteBaselineStageReplayGateRow",
      "Sync UI must render replay gates.",
    ],
    [
      "RemoteBaselineRlsProofRow",
      "Sync UI must render RLS proof rows.",
    ],
    [
      "RemoteBaselineRollbackProofRow",
      "Sync UI must render rollback proof rows.",
    ],
    [
      "最终回放启用条件",
      "Sync UI must render final replay enablement conditions.",
    ],
    [
      "remoteBaselineReplayConfirmationReceipt",
      "Sync UI must build a disposable replay confirmation receipt.",
    ],
    [
      "handleExportRemoteBaselineReplayConfirmationReceipt",
      "Sync UI must export the disposable replay confirmation receipt.",
    ],
    [
      "一次性回放用户确认收据",
      "Sync UI must render the disposable replay confirmation panel.",
    ],
    [
      "导出回放收据",
      "Sync UI must expose the disposable replay receipt export action.",
    ],
    [
      "remote-baseline-replay-confirmation",
      "Sync UI must track disposable replay receipt export state separately.",
    ],
    [
      'getHighRiskRequiredPhrase(\n          "remote-baseline-stage-replay"',
      "Sync UI must read the disposable replay confirmation phrase from the registry.",
    ],
    [
      "buildRemoteBaselineReplayFixturePackage",
      "Sync UI must build the disposable replay empty-fixture package.",
    ],
    [
      "handleExportRemoteBaselineReplayFixturePackage",
      "Sync UI must export the disposable replay empty-fixture package.",
    ],
    [
      "空 fixture 回放包",
      "Sync UI must render the disposable replay empty-fixture panel.",
    ],
    [
      "导出空 fixture",
      "Sync UI must expose the disposable replay empty-fixture export action.",
    ],
    [
      "RemoteBaselineReplayFixtureValidationRow",
      "Sync UI must render empty-fixture validation rows.",
    ],
    [
      "remote-baseline-replay-fixture",
      "Sync UI must track empty-fixture export state separately.",
    ],
    [
      "payload_column_denylist",
      "Sync UI must render payload denylist from the empty-fixture package.",
    ],
    [
      "buildRemoteBaselineReplayHarnessPreflight",
      "Sync UI must build the disposable replay harness preflight.",
    ],
    [
      "handleExportRemoteBaselineReplayHarnessPreflight",
      "Sync UI must export the disposable replay harness preflight.",
    ],
    [
      "一次性回放脚手架预检",
      "Sync UI must render the disposable replay harness preflight panel.",
    ],
    [
      "导出脚手架预检",
      "Sync UI must expose the disposable replay harness export action.",
    ],
    [
      "RemoteBaselineReplayHarnessStepRow",
      "Sync UI must render harness step rows.",
    ],
    [
      "RemoteBaselineReplayHarnessAssertionRow",
      "Sync UI must render harness assertion rows.",
    ],
    [
      "RemoteBaselineReplayHarnessGateRow",
      "Sync UI must render harness gate rows.",
    ],
    [
      "remote-baseline-replay-harness",
      "Sync UI must track harness export state separately.",
    ],
    [
      "buildRemoteBaselineReplayRunnerSkeleton",
      "Sync UI must build the disabled replay runner skeleton.",
    ],
    [
      "handleExportRemoteBaselineReplayRunnerSkeleton",
      "Sync UI must export the disabled replay runner skeleton.",
    ],
    [
      "已关闭的回放 runner 骨架",
      "Sync UI must render the disabled replay runner panel.",
    ],
    [
      "导出 runner 骨架",
      "Sync UI must expose the disabled replay runner export action.",
    ],
    [
      "RemoteBaselineReplayRunnerEntryPointRow",
      "Sync UI must render replay runner entrypoint rows.",
    ],
    [
      "RemoteBaselineReplayRunnerPhaseRow",
      "Sync UI must render replay runner phase rows.",
    ],
    [
      "RemoteBaselineReplayRunnerRefusalRow",
      "Sync UI must render replay runner refusal rows.",
    ],
    [
      "remote-baseline-replay-runner",
      "Sync UI must track runner skeleton export state separately.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildAuditEventEnvelopeContract",
      "Sync UI must build the audit event envelope contract.",
    ],
    [
      "handleExportAuditEventEnvelope",
      "Sync UI must export the audit event envelope contract.",
    ],
    [
      "审计事件信封",
      "Sync UI must render the audit event envelope panel.",
    ],
    [
      "导出审计信封",
      "Sync UI must expose the audit envelope export action.",
    ],
    [
      "AuditEnvelopeTemplateRow",
      "Sync UI must render audit envelope template rows.",
    ],
    [
      "AuditEnvelopeRedactionCheckRow",
      "Sync UI must render audit envelope redaction rows.",
    ],
    [
      "AuditEnvelopeGateRow",
      "Sync UI must render audit envelope gates.",
    ],
    [
      "audit-envelope",
      "Sync UI must track audit envelope export state separately.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildPermissionCheckEnvelopeContract",
      "Sync UI must build the permission check envelope contract.",
    ],
    [
      "buildPermissionCheckValidatorReport",
      "Sync UI must build the permission check validator report.",
    ],
    [
      "buildPermissionServerTestMatrix",
      "Sync UI must build the permission server test matrix.",
    ],
    [
      "handleExportPermissionCheckEnvelope",
      "Sync UI must export the permission check envelope contract.",
    ],
    [
      "权限检查信封",
      "Sync UI must render the permission check envelope panel.",
    ],
    [
      "导出权限信封",
      "Sync UI must expose the permission envelope export action.",
    ],
    [
      "PermissionCheckScenarioRow",
      "Sync UI must render permission check scenario rows.",
    ],
    [
      "PermissionCheckGateRow",
      "Sync UI must render permission check gates.",
    ],
    [
      "PermissionCheckFieldRow",
      "Sync UI must render permission check fields.",
    ],
    [
      "权限请求校验器",
      "Sync UI must render the permission check request validator panel.",
    ],
    [
      "PermissionCheckValidatorFixtureRow",
      "Sync UI must render permission check validator fixture rows.",
    ],
    [
      "校验案例",
      "Sync UI must render permission validator coverage metric.",
    ],
    [
      "服务端权限测试矩阵",
      "Sync UI must render the server permission test matrix panel.",
    ],
    [
      "PermissionServerMatrixCaseRow",
      "Sync UI must render server permission matrix case rows.",
    ],
    [
      "服务端案例",
      "Sync UI must render server permission matrix coverage metric.",
    ],
    [
      "buildPermissionServerReadinessReport",
      "Sync UI must build the server permission readiness report.",
    ],
    [
      "服务端权限准备度",
      "Sync UI must render the server permission readiness panel.",
    ],
    [
      "PermissionServerReadinessGateRow",
      "Sync UI must render server permission readiness gates.",
    ],
    [
      "就绪门槛",
      "Sync UI must render server permission readiness metrics.",
    ],
    [
      "permission-check-envelope",
      "Sync UI must track permission envelope export state separately.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "恢复干跑预览",
      "Sync UI must keep the restore dry-run preview localized.",
    ],
    [
      "选择备份 JSON",
      "Sync UI must keep the restore backup picker localized.",
    ],
    [
      "恢复回滚计划",
      "Sync UI must keep the restore rollback panel localized.",
    ],
    [
      "导出回滚计划",
      "Sync UI must keep the rollback plan export action localized.",
    ],
    [
      "恢复写入合同",
      "Sync UI must keep the restore write-back panel localized.",
    ],
    [
      "导出写入合同",
      "Sync UI must keep the write-back contract export action localized.",
    ],
    [
      "导出恢复收据",
      "Sync UI must keep the restore receipt export action localized.",
    ],
    [
      "恢复已禁用",
      "Sync UI must keep the disabled restore state localized.",
    ],
    [
      "查询模式",
      "Sync UI must keep the remote baseline query label localized.",
    ],
    [
      "不会发起网络请求",
      "Sync UI must keep the remote baseline network boundary localized.",
    ],
    [
      "RestorePreviewPanel",
      "Sync UI must render the restore preview panel.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.restoreRollbackPlan,
      restoreRollbackPlan,
      "选择本地备份",
      "Restore rollback plan must keep the local backup step localized.",
    ],
    [
      files.restoreRollbackPlan,
      restoreRollbackPlan,
      "锁定页面",
      "Restore rollback plan must keep restore scope labels localized.",
    ],
    [
      files.restoreWritebackContract,
      restoreWritebackContract,
      "本地生成。这个恢复写入合同不会恢复、覆盖、删除、上传、同步",
      "Restore write-back contract must keep the local privacy boundary localized.",
    ],
    [
      files.restoreWritebackContract,
      restoreWritebackContract,
      "恢复应用 API 保持禁用",
      "Restore write-back contract must keep the disabled API gate localized.",
    ],
    [
      files.webBetaReadiness,
      webBetaReadiness,
      "恢复写入合同",
      "Web Beta readiness must keep restore write-back readiness localized.",
    ],
    [
      files.launchChecklist,
      launchChecklist,
      "备份恢复与回滚",
      "Web Beta checklist must keep restore and rollback item localized.",
    ],
  ]) {
    assertSourceIncludes(sourceLabel, source, snippet, message);
  }
  assertSourceIncludes(
    files.restorePreviewApiStub,
    restorePreviewApiStub,
    'format: "zhinote-restore-preview-api-disabled"',
    "Restore preview API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.restorePreviewApiStub,
    restorePreviewApiStub,
    "buildRestorePreviewApiDisabledResponse",
    "Restore preview API guard must expose a reusable disabled response builder."
  );
  for (const item of [
    ['api_id: "restore-preview"', "Restore preview API guard must identify the restore-preview route."],
    ['path: "/api/backup/restore-preview"', "Restore preview API guard must bind to /api/backup/restore-preview."],
    ['method: "POST"', "Restore preview API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "Restore preview API guard must stay disabled."],
    ["can_preview_restore_now: false", "Restore preview API guard must not preview restore now."],
    ["can_read_request_body_now: false", "Restore preview API guard must not read request bodies."],
    ["can_read_backup_payload_now: false", "Restore preview API guard must not read backups."],
    ["can_validate_backup_package_now: false", "Restore preview API guard must not validate packages."],
    ["can_return_restore_scope_now: false", "Restore preview API guard must not return scope."],
    ["can_write_workspace_data_now: false", "Restore preview API guard must not write workspace data."],
    ["can_upload_workspace_data_now: false", "Restore preview API guard must not upload workspace data."],
    ["no_request_argument: true", "Restore preview API guard must not accept a request argument."],
    ["endpoint_disabled: true", "Restore preview API guard must preserve disabled endpoint boundary."],
    ["reads_request_body: false", "Restore preview API guard must keep body reads disabled."],
    ["accepts_backup_payload: false", "Restore preview API guard must not accept backup payloads."],
    ["validates_backup_package: false", "Restore preview API guard must not validate packages."],
    ["returns_restore_scope: false", "Restore preview API guard must not return scope."],
    ["returns_page_body_text: false", "Restore preview API guard must not return page text."],
    ["returns_database_row_values: false", "Restore preview API guard must not return database values."],
    ["returns_comment_bodies: false", "Restore preview API guard must not return comments."],
    ["returns_file_bytes: false", "Restore preview API guard must not return file bytes."],
    ["writes_workspace_data: false", "Restore preview API guard must not write workspace data."],
    ["overwrites_pages: false", "Restore preview API guard must not overwrite pages."],
    ["deletes_rows: false", "Restore preview API guard must not delete rows."],
    ["uploads_workspace_data: false", "Restore preview API guard must not upload workspace data."],
    ["syncs_preview_data: false", "Restore preview API guard must not sync preview data."],
    ["reads_page_body_text: false", "Restore preview API guard must not read page text."],
    ["reads_database_row_values: false", "Restore preview API guard must not read database values."],
    ["reads_comment_bodies: false", "Restore preview API guard must not read comments."],
    ["reads_file_bytes: false", "Restore preview API guard must not read files."],
    ["reads_backup_payload: false", "Restore preview API guard must not read backup payloads."],
    ["reads_secret_values: false", "Restore preview API guard must not read secrets."],
    ["requires_local_file_selection_before_enablement: true", "Restore preview API guard must require local file selection."],
    ["requires_checksum_validation_before_enablement: true", "Restore preview API guard must require checksum validation."],
    ["requires_size_limit_before_enablement: true", "Restore preview API guard must require size limits."],
    ["requires_schema_parser_before_enablement: true", "Restore preview API guard must require schema parser."],
    ["requires_permission_check_before_enablement: true", "Restore preview API guard must require permission checks."],
    ["requires_audit_event_before_enablement: true", "Restore preview API guard must require audit events."],
    ["requires_no_content_echo_before_enablement: true", "Restore preview API guard must forbid content echo."],
    ['schema_status: "planned-metadata-only"', "Restore preview API guard must expose metadata-only request schema."],
    ['schema_status: "planned-scope-receipt-only"', "Restore preview API guard must expose scope receipt response schema."],
    ['format: "zhinote-restore-preview-api-validator-fixtures"', "Restore preview API guard must include local validator fixtures."],
    ['validator_status: "not-executing-route"', "Restore preview validator must not execute the route."],
    "forbidden_field_names",
    "forbidden_fields_covered",
    '"metadata-restore-preview-request"',
    '"backup-payload-blocked"',
    '"workspace-content-blocked"',
    '"file-bytes-blocked"',
    '"scope-forgery-blocked"',
    '"credential-fields-blocked"',
    "backup_manifest_id",
    "backup_file_name_hash",
    "backup_checksum",
    "preview_scope_request",
    "backup_payload",
    "full_backup_json",
    "database_cell_values",
    "uploaded_file_bytes",
    "scope_counts",
    "apply_now",
    "delete_all",
    "overwrite_all",
    "secret_values",
    '"local-file-selection"',
    '"checksum-validation"',
    '"size-limit"',
    '"schema-parser"',
    '"permission-check"',
    '"audit-event"',
    '"no-content-echo"',
  ]) {
    const expected = Array.isArray(item) ? item[0] : item;
    const message = Array.isArray(item)
      ? item[1]
      : "Restore preview API guard must preserve schema, fixtures, and enablement gates.";
    assertSourceIncludes(
      files.restorePreviewApiStub,
      restorePreviewApiStub,
      expected,
      message
    );
  }
  assertSourceIncludes(
    files.restorePreviewRoute,
    restorePreviewRoute,
    "buildRestorePreviewApiDisabledResponse",
    "Restore preview route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.restorePreviewRoute,
    restorePreviewRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Restore preview route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildRestorePreviewApiDisabledResponse",
    "Sync UI must build the restore preview API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportRestorePreviewApiGuard",
    "Sync UI must export the restore preview API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "恢复预览 API 防护",
    "Sync UI must render the restore preview API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出恢复预览防护",
    "Sync UI must render the restore preview API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "value: restorePreviewApiGuard.format",
    "Sync UI must render the restore preview disabled response format."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={restorePreviewApiGuard.local_validator_report.fixtures}",
    "Sync UI must render restore preview validator fixtures."
  );
  assertSourceIncludes(
    files.restoreApplyApiStub,
    restoreApplyApiStub,
    'format: "zhinote-restore-apply-api-disabled"',
    "Restore apply API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.restoreApplyApiStub,
    restoreApplyApiStub,
    "buildRestoreApplyApiDisabledResponse",
    "Restore apply API guard must expose a reusable disabled response builder."
  );
  for (const item of [
    ['api_id: "restore-apply"', "Restore apply API guard must identify the restore-apply route."],
    ['path: "/api/backup/restore-apply"', "Restore apply API guard must bind to /api/backup/restore-apply."],
    ['method: "POST"', "Restore apply API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "Restore apply API guard must stay disabled."],
    ["can_apply_restore_now: false", "Restore apply API guard must not apply restore."],
    ["can_read_request_body_now: false", "Restore apply API guard must not read request bodies."],
    ["can_read_backup_payload_now: false", "Restore apply API guard must not read backups."],
    ["can_write_workspace_data_now: false", "Restore apply API guard must not write workspace data."],
    ["can_overwrite_pages_now: false", "Restore apply API guard must not overwrite pages."],
    ["can_delete_rows_now: false", "Restore apply API guard must not delete rows."],
    ["can_upload_workspace_data_now: false", "Restore apply API guard must not upload workspace data."],
    ["can_sync_restored_data_now: false", "Restore apply API guard must not sync restored data."],
    ["no_request_argument: true", "Restore apply API guard must not accept a request argument."],
    ["endpoint_disabled: true", "Restore apply API guard must preserve disabled endpoint boundary."],
    ["reads_request_body: false", "Restore apply API guard must keep body reads disabled."],
    ["accepts_restore_payload: false", "Restore apply API guard must not accept restore payloads."],
    ["metadata_only_request: true", "Restore apply API guard must keep future request metadata-only."],
    ["applies_restore: false", "Restore apply API guard must not apply restore."],
    ["writes_workspace_data: false", "Restore apply API guard must not write workspace data."],
    ["overwrites_pages: false", "Restore apply API guard must not overwrite pages."],
    ["deletes_rows: false", "Restore apply API guard must not delete rows."],
    ["uploads_workspace_data: false", "Restore apply API guard must not upload workspace data."],
    ["syncs_restored_data: false", "Restore apply API guard must not sync restored data."],
    ["reads_page_body_text: false", "Restore apply API guard must not read page text."],
    ["reads_database_row_values: false", "Restore apply API guard must not read database values."],
    ["reads_comment_bodies: false", "Restore apply API guard must not read comments."],
    ["reads_file_bytes: false", "Restore apply API guard must not read files."],
    ["reads_backup_payload: false", "Restore apply API guard must not read backup payloads."],
    ["reads_secret_values: false", "Restore apply API guard must not read secrets."],
    ["requires_rollback_snapshot_before_enablement: true", "Restore apply API guard must require rollback snapshot."],
    ["requires_scope_review_before_enablement: true", "Restore apply API guard must require scope review."],
    ["requires_permission_check_before_enablement: true", "Restore apply API guard must require permission checks."],
    ["requires_audit_event_before_enablement: true", "Restore apply API guard must require audit events."],
    ["requires_sync_replay_safety_before_enablement: true", "Restore apply API guard must require sync replay safety."],
    ["requires_second_confirmation_before_enablement: true", "Restore apply API guard must require second confirmation."],
    ["requires_failure_recovery_before_enablement: true", "Restore apply API guard must require failure recovery."],
    ['schema_status: "planned-metadata-only"', "Restore apply API guard must expose metadata-only request schema."],
    ['schema_status: "planned-receipt-only"', "Restore apply API guard must expose receipt-only response schema."],
    ['format: "zhinote-restore-apply-api-validator-fixtures"', "Restore apply API guard must include local validator fixtures."],
    ['validator_status: "not-executing-route"', "Restore apply validator must not execute the route."],
    "forbidden_field_names",
    "forbidden_fields_covered",
    '"metadata-restore-apply-request"',
    '"backup-payload-blocked"',
    '"workspace-content-blocked"',
    '"file-bytes-blocked"',
    '"destructive-flags-blocked"',
    '"credential-fields-blocked"',
    "backup_manifest_id",
    "rollback_snapshot_id",
    "restore_scope_ids",
    "permission_decision_id",
    "audit_event_envelope_id",
    "sync_replay_proof_id",
    "second_confirmation_receipt_id",
    "failure_recovery_plan_id",
    "backup_payload",
    "database_cell_values",
    "file_bytes",
    "delete_all",
    "overwrite_all",
    "secret_values",
    '"rollback-snapshot"',
    '"scope-review"',
    '"permission-check"',
    '"audit-event"',
    '"sync-replay-safety"',
    '"second-confirmation"',
    '"failure-recovery"',
  ]) {
    const expected = Array.isArray(item) ? item[0] : item;
    const message = Array.isArray(item)
      ? item[1]
      : "Restore apply API guard must preserve schema, fixtures, and enablement gates.";
    assertSourceIncludes(files.restoreApplyApiStub, restoreApplyApiStub, expected, message);
  }
  assertSourceIncludes(
    files.restoreApplyRoute,
    restoreApplyRoute,
    "buildRestoreApplyApiDisabledResponse",
    "Restore apply route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.restoreApplyRoute,
    restoreApplyRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Restore apply route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildRestoreApplyApiDisabledResponse",
    "Sync UI must build the restore apply API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportRestoreApplyApiGuard",
    "Sync UI must export the restore apply API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "恢复应用 API 防护",
    "Sync UI must render the restore apply API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出恢复应用防护",
    "Sync UI must render the restore apply API guard export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "value: restoreApplyApiGuard.format",
    "Sync UI must render the restore apply disabled response format."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "fixtures={restoreApplyApiGuard.local_validator_report.fixtures}",
    "Sync UI must render restore apply validator fixtures."
  );

  for (const [snippet, message] of [
    [
      'format: "zhinote-web-beta-hot-data-plan"',
      "Hot data plan must export a stable format.",
    ],
    [
      'plan_status: "local-cache-plan-only"',
      "Hot data plan must remain a local cache plan.",
    ],
    [
      "CURRENT_MONTH_DAILY_ROUTE_TARGET_LIMIT = 45",
      "Hot data plan must cap current-month daily route targets.",
    ],
    [
      "CURRENT_MONTH_MEETING_ROUTE_TARGET_LIMIT = 60",
      "Hot data plan must cap current-month meeting route targets.",
    ],
    [
      'id: "current-month-daily"',
      "Hot data plan must prioritize current-month daily notes.",
    ],
    [
      'id: "current-month-meetings"',
      "Hot data plan must prioritize current-month meeting calendar metadata.",
    ],
    [
      'id: "favorite-pages"',
      "Hot data plan must prioritize favorites.",
    ],
    [
      'id: "recent-pages"',
      "Hot data plan must prioritize recently updated pages.",
    ],
    [
      "reads_page_body_text: false",
      "Hot data plan must not read page body text.",
    ],
    [
      "reads_page_content_yjs: false",
      "Hot data plan must not read collaborative page bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Hot data plan must not read file bytes.",
    ],
    [
      "stores_meeting_credentials: false",
      "Hot data plan must not store meeting credentials.",
    ],
    [
      '"meeting.join_url"',
      "Hot data plan must explicitly exclude meeting join URLs.",
    ],
    [
      '"meeting.passcode"',
      "Hot data plan must explicitly exclude meeting passcodes.",
    ],
    [
      '"meeting.transcript"',
      "Hot data plan must explicitly exclude meeting transcripts.",
    ],
  ]) {
    assertSourceIncludes(files.hotDataPlan, hotDataPlan, snippet, message);
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaHotDataPlan",
    "Sync UI must build the Web Beta hot data plan."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "HotDataPlanPanel",
    "Sync UI must render the hot data plan panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "热数据与流畅度",
    "Sync UI must name the hot data plan panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "导出热数据计划",
    "Sync UI must expose the hot data plan export."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "usePageFavorites",
    "Sync UI must include local favorites in the hot data plan."
  );

  const expectedPageRoutes = routeCalls.filter(
    (route) => route.surface === "workspace" || route.surface === "module"
  );
  for (const route of expectedPageRoutes) {
    const pageFile = routeFileForPagePath(route.route);
    if (!existsSync(path.join(root, pageFile))) {
      fail(`${route.method} ${route.route} is missing page file ${pageFile}`);
    }
  }

  const contractTables = extractQuotedValues(contract, "tableName");
  assertMigrationTables(contractTables, migration);

  const migrationTables = unique(
    [...migration.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map(
      (match) => match[1]
    )
  );
  const missingFromContract = migrationTables.filter(
    (tableName) =>
      !contractTables.includes(tableName) &&
      !["database_fields", "database_rows", "database_views", "wiki_links", "page_comments", "block_comments"].includes(
        tableName
      )
  );
  if (missingFromContract.length > 0) {
    warn(
      `Migration has tables not named in CLOUD_SCHEMA_TABLES: ${missingFromContract.join(
        ", "
      )}`
    );
  }

  for (const [sourceLabel, source, snippet, message] of [
    [
      files.accountPageSync,
      accountPageSync,
      "export function getPendingCloudPageSyncStatus",
      "Account page sync must expose page pending upload status for the sync dashboard.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "pending: pendingIds.length",
      "Account page sync pending status must count id-only pending pushes.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "PENDING_PUSH_META_KEY",
      "Account page sync pending status must store queue metadata separately from page bodies.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "if (pendingChanged || !wasQueued) emitPageSyncStatusChanged();",
      "Account page sync must avoid rewriting pending metadata and rebroadcasting status on every keystroke for an already queued page.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "if (wasPending && meta[id]) return false;",
      "Account page sync must no-op repeated pending marks when the same page id is already safely queued.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "oldestPendingQueuedAt",
      "Account page sync pending status must expose the oldest pending queued timestamp.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "pendingSampleIds",
      "Account page sync pending status must expose a small metadata-only page id sample.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "markPendingCloudPushAttemptRecords",
      "Account page sync pending queue must record upload attempts for ACK visibility.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "markPendingCloudPushFailedRecords",
      "Account page sync pending queue must preserve failed upload receipts for retry visibility.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "failedSampleIds",
      "Account page sync pending status must expose metadata-only failed sample ids.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "PENDING_CLOUD_PAGE_MANUAL_REVIEW_FAILURE_COUNT",
      "Account page sync pending status must define the repeated-failure threshold for owner review.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "failureCountTotal",
      "Account page sync pending status must expose aggregate failure counts without reading page bodies.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "manualReviewSampleIds",
      "Account page sync pending status must expose metadata-only page ids for owner review.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "lastFailureMessage",
      "Account page sync pending status must expose the latest failure reason without reading page bodies.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "if (acknowledgedIds.length > 0) setLastPageSyncAtNow();",
      "Account page sync push ACKs must refresh the last cloud sync timestamp immediately.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "authRetryStatus: authRetry.status",
      "Account page sync pending status must expose auth retry status metadata.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "authRetryUntil: authRetry.until",
      "Account page sync pending status must expose auth retry retry-at metadata.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "getAuthRetrySnapshot",
      "Account page sync pending status must read auth retry backoff without reading page bodies.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      "export async function fetchMeetingCloudMetadata",
      "Account page sync must expose a shared meeting metadata helper.",
    ],
    [
      files.accountPageSync,
      accountPageSync,
      'action: "meeting-calendar-metadata"',
      "Account page sync must call the meeting calendar metadata server action.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "fetchMeetingCloudMetadata",
      "Meeting calendar must pull cloud metadata through the shared helper.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "getModuleRootIdSync",
      "Meeting calendar must reuse the cached module root id for local-first rendering.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "const cloudPromise = includeCloud",
      "Meeting calendar must gate cloud hydration so local-only refreshes do not block the hot-cache render.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "void load({ includeCloud: false })",
      "Meeting calendar page-revision refresh must avoid repeating cloud hydration.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "publishMeetings(localPagesForMerge, cloud.pages)",
      "Meeting calendar cloud hydration must merge with local hot-cache pages instead of replacing them.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "const mergedMeetings = mergeMeetingPages(",
      "Meeting calendar must prepare merged metadata before selecting a bounded render list.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "const nextMeetings = selection.pages",
      "Meeting calendar must publish only the capped render selection.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "startTransition(() => {\n        if (loadRequestRef.current !== requestId) return;\n        setMeetings(nextMeetings);",
      "Meeting calendar bulk metadata publishes must stay low-priority and render-bounded so create/import clicks remain responsive.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "scheduleMeetingIdleTask",
      "Meeting calendar maintenance work must run after the first local render.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "persistMeetingCloudMetadata",
      "Meeting calendar must persist cloud metadata into the local hot cache.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "applyRemotePageMetadata",
      "Meeting calendar must use metadata-only local cache writes for cloud pulls.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "pushCloudPages",
      "Meeting calendar cloud-only fallback must push through the shared helper.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      "pageToRemoteRecord",
      "Meeting calendar cloud pushes must use the shared remote record converter.",
    ],
  ]) {
    assertSourceIncludes(sourceLabel, source, snippet, message);
  }
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    'fetch("/api/pages/account-sync"',
    "Meeting calendar must not bypass the shared account page sync helper."
  );
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "localPagesForMerge = await listMeetingPageMetadataForCalendar({",
    "Meeting calendar local hot-cache render must use bounded date-range metadata reads."
  );
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "recentLimit: recentMetadataLimit",
    "Meeting calendar local hot-cache render must keep a preference-aware bounded recent window without full-root scans."
  );
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "localPagesForMerge = await listPages(id)",
    "Meeting calendar local hot-cache render must not read full page bodies."
  );
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "localPagesForMerge = await listPageMetadata(id)",
    "Meeting calendar local hot-cache render must not read the entire meeting root on first paint."
  );
  assertSourceIncludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "listDailyPageMetadataForCalendar({",
    "Meeting calendar must link completed meetings to daily notes through bounded daily metadata reads."
  );
  for (const snippet of [
    "completedMeetingDailyLinkKeyRef",
    "scheduleMeetingIdleTask(() =>",
    "linkCompletedMeetingsToDaily(notesToLink)",
  ]) {
    assertSourceIncludes(
      files.meetingScheduleShell,
      meetingScheduleShell,
      snippet,
      "Meeting calendar must defer completed-meeting daily-note autolinking and skip duplicate batches so first paint stays responsive."
    );
  }
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    'from "@/hooks/usePages"',
    "Meeting calendar must not import usePages because meeting create/import paths should not trigger global page refreshes."
  );
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "await refresh()",
    "Meeting calendar must not await global page refresh after create/import/status updates."
  );
  assertSourceExcludes(
    files.meetingScheduleShell,
    meetingScheduleShell,
    "void refresh()",
    "Meeting calendar background persistence must not trigger global page refreshes."
  );
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.databaseShell,
      databaseShell,
      "renderedLocalSnapshot",
      "Database detail pages must render the local hot cache before waiting for cloud hydration.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "applyDatabaseSnapshot(localSnapshot)",
      "Database detail pages must show rebuildable local cache immediately when available.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "syncCloudDatabaseById(databaseId, { maxBatches: 1 })",
      "Database detail pages must hydrate the first cloud database batch without waiting for the full database.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "云端数据库暂时不可用，当前显示本机缓存。",
      "Database detail pages must preserve local cache fallback messaging.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "useLocalFirstPageNavigation",
      "Database row full-page opens must use the shared local-first page navigation path.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const warmDatabaseRowPageContent = useCallback",
      "Database row full-page opens must warm missing page content in the background.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const prepareDatabaseRowPageOpen = useCallback",
      "Database row full-page opens must prepare a local-first page seed before navigation.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "rememberPendingPageDraft(seededPage)",
      "Database row full-page opens must seed pending page drafts for instant editor mount.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "rememberPageRouteHandoff(seededPage, source)",
      "Database row full-page opens must hand page metadata through the route handoff cache.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const page = prepareDatabaseRowPageOpen(row.page, source)",
      "Database row full-page opens must hand a prepared page to local-first navigation.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "openPage(page, { source })",
      "Database row full-page opens must navigate with the prepared local-first page seed.",
    ],
    [
      files.databaseShell,
      databaseShell,
      'const seededPage = prepareDatabaseRowPageOpen(page, "database-row-open")',
      "Database row page-id fallback must prepare cached page metadata when available.",
    ],
    [
      files.databaseShell,
      databaseShell,
      'openPage(seededPage, { source: "database-row-open" })',
      "Database row page-id fallback must navigate with the prepared page metadata when available.",
    ],
    [
      files.databaseShell,
      databaseShell,
      'openPage(pageId, { source: "database-row-open" })',
      "Database row page-id fallback must still use local-first navigation without a metadata seed.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const primeDatabaseRowPageOpen = useCallback",
      "Database row full-page opens must expose an early page-open prewarm hook.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const primeDatabaseRowPageOpenById = useCallback",
      "Database row full-page opens must prewarm row pages from view-level page ids.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "onPrimeRow: primeDatabaseRowPageOpenById",
      "Database row views must receive the shared page-open prewarm hook.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "onPrimeOpen={() => primeDatabaseRowPageOpenById(sidePeekRow.page_id)}",
      "Database side peek full-page opens must prewarm the target page before navigation.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"database-row-open"',
      "Page route handoff must allow database row page opens as a local-first source.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"database-row-create"',
      "Page route handoff must allow database row creation opens as a local-first source.",
    ],
  ]) {
    assertSourceIncludes(sourceLabel, source, snippet, message);
  }
  for (const [sourceLabel, source] of [
    [files.databaseListView, databaseListView],
    [files.databaseKanbanView, databaseKanbanView],
    [files.databaseCalendarView, databaseCalendarView],
    [files.databaseGalleryView, databaseGalleryView],
    [files.databaseTimelineView, databaseTimelineView],
    [files.databaseChartView, databaseChartView],
    [files.databaseFeedView, databaseFeedView],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "onPrimeRow?: (pageId: string) => void;",
      "Database row views must accept a non-blocking page-open prewarm callback."
    );
    assertSourceIncludes(
      sourceLabel,
      source,
      "onPointerEnter={() => onPrimeRow?.(row.page_id)}",
      "Database row views must prewarm page opens on hover."
    );
    assertSourceIncludes(
      sourceLabel,
      source,
      "onPointerDown={() => onPrimeRow?.(row.page_id)}",
      "Database row views must prewarm page opens before click navigation."
    );
    assertSourceIncludes(
      sourceLabel,
      source,
      "onFocus={() => onPrimeRow?.(row.page_id)}",
      "Database row views must prewarm page opens for keyboard users."
    );
  }
  for (const [snippet, message] of [
    [
      "DATABASE_KANBAN_RENDER_COLUMN_LIMIT",
      "Database kanban view must cap per-column rendered cards for large imports.",
    ],
    [
      "interface KanbanColumnGroup",
      "Database kanban view must use lightweight column groups instead of full row arrays.",
    ],
    [
      "count: number;",
      "Database kanban column groups must retain true counts without storing every row.",
    ],
    [
      "previewRows: (DatabaseRow & { page: Page })[];",
      "Database kanban column groups must keep only bounded preview rows.",
    ],
    [
      "columnGroup.previewRows.map",
      "Database kanban view must render preview rows, not every row in a column.",
    ],
    [
      "foldedCardCount",
      "Database kanban view must compute hidden cards from true counts.",
    ],
    [
      "为保持看板流畅",
      "Database kanban view must explain capped high-volume rendering to the user.",
    ],
  ]) {
    assertSourceIncludes(files.databaseKanbanView, databaseKanbanView, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "CHART_BUCKET_PREVIEW_ROW_LIMIT",
      "Database chart view must keep bucket preview rows bounded for large imports.",
    ],
    [
      "count: number;",
      "Database chart buckets must store counts instead of full row arrays.",
    ],
    [
      "previewRows: (DatabaseRow & { page: Page })[];",
      "Database chart buckets must keep only a small row preview list.",
    ],
    [
      "bucket.previewRows.map",
      "Database chart view must render preview rows, not every row in a bucket.",
    ],
    [
      "bucket.count > bucket.previewRows.length",
      "Database chart view must disclose hidden bucket rows from counts.",
    ],
  ]) {
    assertSourceIncludes(files.databaseChartView, databaseChartView, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "DATABASE_CALENDAR_RENDER_DAY_LIMIT",
      "Database calendar view must cap per-day rendered rows for large imports.",
    ],
    [
      "DATABASE_CALENDAR_UNDATED_RENDER_LIMIT",
      "Database calendar view must cap undated rows instead of rendering every undated record.",
    ],
    [
      "buildDatabaseCalendarIndexes(rows, dateField, calendarDateKeys)",
      "Database calendar view must build one bounded visible-month index.",
    ],
    [
      "if (!calendarDateKeys.has(dateVal)) continue;",
      "Database calendar view must skip rows outside the visible month before grouping.",
    ],
    [
      "为保持日历流畅",
      "Database calendar view must explain capped high-volume rendering to the user.",
    ],
  ]) {
    assertSourceIncludes(files.databaseCalendarView, databaseCalendarView, snippet, message);
  }
  assertSourceIncludes(
    files.databaseTableView,
    databaseTableView,
    "onPrimeOpen={() => onPrimeRow?.(row.page_id)}",
    "Database table rows must pass the row page prewarm callback into the title cell."
  );
  assertSourceIncludes(
    files.databaseTableView,
    databaseTableView,
    "onPointerEnter={onPrimeOpen}",
    "Database table title cells must prewarm page opens on hover."
  );
  assertSourceIncludes(
    files.databaseTableView,
    databaseTableView,
    "onPointerDown={onPrimeOpen}",
    "Database table title cells must prewarm page opens before click navigation."
  );
  assertSourceIncludes(
    files.databaseTableView,
    databaseTableView,
    "onFocus={onPrimeOpen}",
    "Database table title cells must prewarm page opens for keyboard users."
  );
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.databaseShell,
      databaseShell,
      "startOffset: cloud.nextOffset",
      "Database detail pages must continue cloud database hydration from the next page offset.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "collectRecords: false",
      "Database detail background cloud hydration must avoid retaining the full database record set in memory.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "readLocalDatabaseSafe().then(applyDatabaseSnapshot)",
      "Database detail pages must refresh from local cache after background cloud hydration completes.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "optimisticDatabaseMutationBlockUntilRef",
      "Database row edits must suppress self-triggered reloads while optimistic local state is active.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "updateLocalRowFieldValues(current, rowId, fieldValues)",
      "Database cell edits must update visible rows before background persistence.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "persistDatabaseRowInBackground(\n        loadDatabaseMutationModule().then(({ updateRow }) =>",
      "Database cell edits must lazy-load and persist through the pending-aware database mutation helper in the background.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "upsertLocalRows(current, [rowWithPage])",
      "Database row creation must append the local row to the current view without a full reload.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "updateLocalRowPositions(current, {",
      "Database row moves must update local row order before background persistence.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "DATABASE_VIEW_INITIAL_RENDER_LIMIT",
      "Database views must keep an explicit first-render row cap for large imports.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "DATABASE_VIEW_RENDER_BATCH",
      "Database views must load additional rows in bounded batches.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "DATABASE_VIEW_RENDER_CAPPED_TYPES",
      "Database views must declare which row-heavy views are render capped.",
    ],
    [
      files.databaseShell,
      databaseShell,
      '"timeline"',
      "Database timeline view must be included in the render-capped heavy view set.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "visibleRows.slice(0, databaseViewRowRenderLimit)",
      "Database row-heavy views must render a capped subset instead of every visible row.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "<TimelineView {...renderCappedAllFieldViewProps} />",
      "Database timeline view must receive capped rows before it parses and sorts entries.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "renderedRowGroups",
      "Grouped database views must apply the render cap before mounting grouped rows.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "totalCount: number;",
      "Grouped database views must preserve true group counts separately from rendered row samples.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "renderLimit:",
      "Grouped database views must pass the render cap into group construction instead of slicing after full grouping.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "renderedRowCount < renderLimit",
      "Grouped database views must stop retaining grouped row samples once the render cap is reached.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "group.totalCount",
      "Grouped database view headers must show true group totals even when rows are render capped.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "DatabaseViewShowMoreRows",
      "Database views must expose a load-more control when rows are withheld from the first paint.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "再显示 {nextBatchCount} 行",
      "Database load-more control must disclose the next bounded row batch.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "exportDatabaseAsXlsx(database, fields, visibleRows, workspacePages)",
      "Database Excel export must still use the full visible row set, not the render-capped subset.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "exportDatabaseAsCsv(database, fields, visibleRows, workspacePages)",
      "Database CSV export must still use the full visible row set, not the render-capped subset.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "getRows(databaseId, { includePageContent: false })",
      "Database detail first paint must read row page metadata without page bodies.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const { page: hydratedPage, loading: pagePreviewLoading } = usePage(",
      "Database row side peek must hydrate the single page body only after the row is opened.",
    ],
    [
      files.localQueries,
      localQueries,
      "includePageContent?: boolean",
      "Local database row queries must expose a page-body opt-out for metadata-only views.",
    ],
    [
      files.localQueries,
      localQueries,
      "NULL as page_content_text",
      "Local database row metadata reads must omit page bodies when includePageContent is false.",
    ],
  ]) {
    assertSourceIncludes(sourceLabel, source, snippet, message);
  }
  assertSourceExcludes(
    files.databaseShell,
    databaseShell,
    "await updateRow(rowId, { fieldValues });",
    "Database cell edits must not await local write and reload the whole database."
  );
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.usePages,
      usePages,
      "renderLocalPagesSnapshot",
      "Page and sidebar lists must render the rebuildable local hot cache before cloud metadata.",
    ],
    [
      files.usePages,
      usePages,
      "metadataFirstContent ? false : includeContent",
      "Page and sidebar lists must load local IndexedDB snapshots first, with content-heavy modules starting metadata-only.",
    ],
    [
      files.usePages,
      usePages,
      "deferContent?: boolean",
      "Content-heavy modules must be able to defer page body hydration until after metadata first paint.",
    ],
    [
      files.usePages,
      usePages,
      "autoHydrateContent?: boolean",
      "Content-heavy modules must be able to opt out of automatic full-body hydration after large imports.",
    ],
    [
      files.usePages,
      usePages,
      "metadataFirstContent && autoHydrateContent",
      "Deferred body hydration must be explicit for large-workspace dashboards.",
    ],
    [
      files.usePages,
      usePages,
      "scheduleDeferredContentHydration",
      "Content-heavy modules must hydrate full page bodies in a background idle task.",
    ],
    [
      files.usePages,
      usePages,
      "hydrateDeferredPageContentBatches",
      "Deferred page body hydration must run in batches so large imports do not monopolize the main thread.",
    ],
    [
      files.usePages,
      usePages,
      "DEFERRED_CONTENT_HYDRATION_BATCH_SIZE",
      "Deferred page body hydration must keep an explicit bounded batch size.",
    ],
    [
      files.usePages,
      usePages,
      "await waitForIdle(1400)",
      "Deferred page body hydration must yield between batches.",
    ],
    [
      files.localQueries,
      localQueries,
      "export async function listPagesForContentHydration",
      "Local page content hydration must expose a bounded batch query instead of requiring getAllPages for deferred background scans.",
    ],
    [
      files.localQueries,
      localQueries,
      "LIMIT ? OFFSET ?",
      "Local page content hydration batches must be limit/offset bounded.",
    ],
    [
      files.usePages,
      usePages,
      "useWorkspaceStore.getState().upsertPages(contentPages)",
      "Deferred page body hydration must merge content into the existing metadata store.",
    ],
    [
      files.workspaceStore,
      workspaceStore,
      "canPatchPagesWithoutResort",
      "Workspace page upserts must preserve order without full sorting for content-only hydration.",
    ],
    [
      files.workspaceStore,
      workspaceStore,
      "patchPagesWithoutResort",
      "Workspace page upserts must have an explicit no-resort patch path for large imported libraries.",
    ],
    [
      files.workspaceStore,
      workspaceStore,
      "hasWorkspaceOrderChange",
      "Workspace page upserts must fall back to the sorted path when ordering-sensitive fields change.",
    ],
    [
      files.workspaceStore,
      workspaceStore,
      "if (pages.length === 0) return {};",
      "Workspace page upserts must ignore empty batches without cloning the full page list.",
    ],
    [
      files.workspaceStore,
      workspaceStore,
      "pagesById: Map<string, Page>;",
      "Workspace page store must expose a reusable page id index for local-first opens.",
    ],
    [
      files.workspaceStore,
      workspaceStore,
      "pagesById: indexPagesById(nextPages)",
      "Workspace page store must keep the page id index in sync with sorted page snapshots.",
    ],
    [
      files.workspaceStore,
      workspaceStore,
      "getPageById: (id) => get().pagesById.get(id)",
      "Workspace page store must expose O(1) page lookup for hot UI paths.",
    ],
    [
      files.usePage,
      usePage,
      "useWorkspaceStore.getState().getPageById(pageId)",
      "Page route first paint must use the workspace id index before slower local/cloud reads.",
    ],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "useWorkspaceStore.getState().getPageById(target)",
      "Local-first page navigation must avoid scanning all pages when opening by id.",
    ],
    [
      files.pageTree,
      pageTree,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Sidebar page tree must reuse the workspace page id index instead of rebuilding it.",
    ],
    [
      files.favoritePages,
      favoritePages,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Favorite pages must reuse the workspace page id index for large libraries.",
    ],
    [
      files.quickSearch,
      quickSearch,
      "getPageById(pageId)",
      "Quick search page opens must use the workspace page id index as the global fallback.",
    ],
    [
      files.sidebar,
      sidebar,
      'import LazyQuickSearch from "./LazyQuickSearch"',
      "Sidebar must keep the large search palette behind a lightweight lazy wrapper.",
    ],
    [
      files.sidebar,
      sidebar,
      "<LazyQuickSearch />",
      "Sidebar must render the lightweight quick-search trigger on first paint.",
    ],
    [
      files.lazyQuickSearch,
      lazyQuickSearch,
      "dynamic<QuickSearchProps>",
      "Lazy quick search must split the large command palette into its own async chunk.",
    ],
    [
      files.lazyQuickSearch,
      lazyQuickSearch,
      '() => import("./QuickSearch")',
      "Lazy quick search must import the heavy search palette only after intent.",
    ],
    [
      files.lazyQuickSearch,
      lazyQuickSearch,
      "preloadQuickSearch",
      "Lazy quick search should warm the chunk on hover/focus without mounting it.",
    ],
    [
      files.lazyQuickSearch,
      lazyQuickSearch,
      "loadQuickSearch(true)",
      "Lazy quick search must open immediately after click or Cmd+K loads the chunk.",
    ],
    [
      files.lazyQuickSearch,
      lazyQuickSearch,
      'event.key.toLowerCase() !== "k"',
      "Lazy quick search must preserve the Cmd+K shortcut before the heavy palette is mounted.",
    ],
    [
      files.lazyQuickSearch,
      lazyQuickSearch,
      "isEditorTarget(event.target)",
      "Lazy quick search must not steal Cmd+K from the editor.",
    ],
    [
      files.quickSearch,
      quickSearch,
      "export interface QuickSearchProps",
      "Quick search must accept lazy-wrapper props without forcing the sidebar to import its runtime.",
    ],
    [
      files.quickSearch,
      quickSearch,
      "initialOpen = false",
      "Quick search must support opening immediately when loaded through Cmd+K or the trigger.",
    ],
    [
      files.sidebar,
      sidebar,
      'await import(\n        "@/lib/export/workspaceBackup"',
      "Sidebar export buttons must lazy-load workspace export code only after export intent.",
    ],
    [
      files.quickSearch,
      quickSearch,
      'await import(\n        "@/lib/export/workspaceBackup"',
      "Quick search export commands must lazy-load workspace export code only after command intent.",
    ],
    [
      files.syncShell,
      syncShell,
      'const loadWorkspaceBackupModule = () => import("@/lib/export/workspaceBackup")',
      "Sync shell export actions must lazy-load workspace backup code only after export intent.",
    ],
    [
      files.sidebar,
      sidebar,
      'await import("@/lib/pages/cloudPageMutations")',
      "Sidebar page creation must lazy-load page mutation code only after create intent.",
    ],
    [
      files.sidebar,
      sidebar,
      'await import("@/lib/database/cloudDatabaseMutations")',
      "Sidebar database creation must lazy-load database mutation code only after create intent.",
    ],
    [
      files.quickSearch,
      quickSearch,
      'await import("@/lib/pages/cloudPageMutations")',
      "Quick search page creation must lazy-load page mutation code only after command intent.",
    ],
    [
      files.quickSearch,
      quickSearch,
      'await import("@/lib/database/cloudDatabaseMutations")',
      "Quick search database creation must lazy-load database mutation code only after command intent.",
    ],
    [
      files.pageTree,
      pageTree,
      'await import("@/lib/pages/cloudPageMutations")',
      "Sidebar page tree create/move actions must lazy-load page mutation code only after tree intent.",
    ],
    [
      files.dailyNotesShell,
      dailyNotesShell,
      'await import(\n        "@/lib/pages/cloudPageMutations"',
      "Daily drag-to-reschedule mutations must lazy-load page mutation code only after drag/drop intent.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const loadDatabaseMutationModule = () =>",
      "Database detail page writes must lazy-load database mutation code only after edit intent.",
    ],
    [
      files.databaseShell,
      databaseShell,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Database detail page writes must keep database mutation code out of first paint.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const loadAccountDatabaseSyncModule = () =>",
      "Database detail page cloud hydrate must lazy-load account database sync after local first paint.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "const loadDatabaseImportModule = () =>",
      "Database detail page spreadsheet import must lazy-load the import engine after file intent.",
    ],
    [
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      "const loadDatabaseMutationModule = () =>",
      "Inline database blocks must lazy-load database mutation code only after inline edit intent.",
    ],
    [
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Inline database blocks must keep database mutation code out of editor first paint.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'const loadSpreadsheetModule = () => import("@/lib/files/spreadsheet")',
      "File previews must lazy-load spreadsheet parsing and database import after file intent.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'const loadWordModule = () => import("@/lib/files/word")',
      "File previews must lazy-load Word conversion after file intent.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'const loadPresentationModule = () =>\n  import("@/lib/files/presentationImport")',
      "File previews must lazy-load presentation conversion after file intent.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'const loadCodeHighlightModule = () => import("@/lib/codeHighlight")',
      "Text file code highlighting must stay out of the editor first paint bundle.",
    ],
    [
      files.pageImportPlanPanel,
      pageImportPlanPanel,
      "const loadPageImportExecutorModule = () =>",
      "Batch page imports must lazy-load the heavy execution engine only after import intent.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Meeting schedule write mutations must lazy-load page mutation code only after create/update intent.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")',
      "Meeting schedule cloud sync helpers must lazy-load after local/hot-cache first paint.",
    ],
    [
      files.filesShell,
      filesShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Files module page creation must lazy-load page mutations only after file-page creation intent.",
    ],
    [
      files.knowledgeBaseShell,
      knowledgeBaseShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Knowledge base page mutations must lazy-load after board create/move/import intent.",
    ],
    [
      files.industryChainShell,
      industryChainShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Industry chain page mutations must lazy-load after tree create/link intent.",
    ],
    [
      files.reportsShell,
      reportsShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Reports module page mutations must lazy-load after file/template creation intent.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "const loadDatabaseMutationModule = () =>",
      "Reports module tracker writes must lazy-load database mutations after tracker-intake intent.",
    ],
    [
      files.reportsShell,
      reportsShell,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Reports module tracker writes must keep database mutation code out of first paint.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Meetings module page mutations must lazy-load after transcript/template creation intent.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "const loadDatabaseMutationModule = () =>",
      "Meetings module tracker writes must lazy-load database mutations after tracker-intake intent.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Meetings module tracker writes must keep database mutation code out of first paint.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "const loadDatabaseMutationModule = () =>",
      "Company research tracker writes must lazy-load database mutations after tracker-intake intent.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Company research tracker writes must keep database mutation code out of first paint.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "const loadDatabaseMutationModule = () =>",
      "Portfolio tracker writes must lazy-load database mutations after tracker-intake intent.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Portfolio tracker writes must keep database mutation code out of first paint.",
    ],
    [
      files.projectsShell,
      projectsShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Projects module page mutations must lazy-load after project-page creation intent.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "const loadDatabaseMutationModule = () =>",
      "Projects module tracker writes must lazy-load database mutations after tracker-intake intent.",
    ],
    [
      files.projectsShell,
      projectsShell,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Projects module tracker writes must keep database mutation code out of first paint.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      "Research graph page mutations must lazy-load after research-project creation intent.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      "const loadDatabaseMutationModule = () =>",
      "Research graph schema writes must lazy-load database mutations after schema-field intent.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      'import("@/lib/database/cloudDatabaseMutations")',
      "Research graph schema writes must keep database mutation code out of first paint.",
    ],
    [
      files.knowledgeBaseShell,
      knowledgeBaseShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Knowledge base page opens must reuse the workspace page id index for large libraries.",
    ],
    [
      files.industryChainShell,
      industryChainShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Industry chain page opens must reuse the workspace page id index for large libraries.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Research graph page opens must reuse the workspace page id index for large libraries.",
    ],
    [
      files.researchConnectionsPanel,
      researchConnectionsPanel,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Research connection page opens must reuse the workspace page id index for large libraries.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Reports workbench page opens must reuse the workspace page id index for large libraries.",
    ],
    [
      files.reportsShell,
      reportsShell,
      'openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })',
      "Reports workbench page-id cards must pass a local page object when available.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Company research page opens must reuse the workspace page id index for large libraries.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      'openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })',
      "Company research page-id cards must pass a local page object when available.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "const pagesById = useWorkspaceStore((s) => s.pagesById)",
      "Portfolio page opens must reuse the workspace page id index for large libraries.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      'openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })',
      "Portfolio page-id cards must pass a local page object when available.",
    ],
    [
      files.usePages,
      usePages,
      "syncCloudPageMetadataDelta",
      "Page and sidebar lists must still hydrate from the account cloud ledger.",
    ],
    [
      files.usePages,
      usePages,
      "mergeMetadataForCount",
      "Cloud metadata hydration must preserve local page body content.",
    ],
    [
      files.notesShell,
      notesShell,
      "deferContent: true",
      "Notes module must render page metadata before deferred body hydration.",
    ],
    [
      files.notesShell,
      notesShell,
      "const [contentScanEnabled, setContentScanEnabled] = useState(false)",
      "Notes module dashboard must default content scanning off after large imports.",
    ],
    [
      files.notesShell,
      notesShell,
      "includeContent: contentScanEnabled",
      "Notes module dashboard must keep page loading metadata-only until an explicit content scan.",
    ],
    [
      files.notesShell,
      notesShell,
      "setContentScanEnabled(true)",
      "Notes module must expose an explicit local content scan action instead of scanning page bodies on first paint.",
    ],
    [
      files.notesShell,
      notesShell,
      "hydrateContentInBackground();",
      "Notes module content scans must hydrate bodies in background batches instead of refreshing the full page list.",
    ],
    [
      files.notesShell,
      notesShell,
      "{ bodyScanEnabled: contentScanEnabled }",
      "Notes workbench must report whether it is allowed to inspect local page HTML bodies.",
    ],
    [
      files.notesShell,
      notesShell,
      "scanEnabled: contentScanEnabled",
      "Synced block registry must stay disabled until the explicit local content scan is enabled.",
    ],
    [
      files.notesShell,
      notesShell,
      "upsertPages([page])",
      "Notes module must optimistically add newly created blank notes instead of refreshing the full page list.",
    ],
    [
      files.notesShell,
      notesShell,
      "upsertPages([result.page])",
      "Notes module must optimistically add newly created template notes instead of refreshing the full page list.",
    ],
    [
      files.notesShell,
      notesShell,
      "@/components/page/LazyPagePeekModal",
      "Notes module must lazy-load the page peek editor instead of adding it to first paint.",
    ],
    [
      files.notesShell,
      notesShell,
      "warmPagePeekModal();",
      "Notes module create actions must warm the peek editor while creating local note pages.",
    ],
    [
      files.notesShell,
      notesShell,
      "const [peekPageId, setPeekPageId] = useState<string | null>(null);",
      "Notes module must hold a page peek target for same-view editing.",
    ],
    [
      files.notesShell,
      notesShell,
      "const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);",
      "Notes module must seed newly created note pages into the peek before slower hydration.",
    ],
    [
      files.notesShell,
      notesShell,
      "rememberPendingPageDraft(page);",
      "Notes created pages must keep a short-lived local draft before opening.",
    ],
    [
      files.notesShell,
      notesShell,
      'rememberPageRouteHandoff(page, "module-create");',
      "Notes created pages must hand off local-first metadata with a module-create source.",
    ],
    [
      files.notesShell,
      notesShell,
      "openCreatedNotePage(page);",
      "Blank notes must open in peek immediately.",
    ],
    [
      files.notesShell,
      notesShell,
      "openCreatedNotePage(result.page);",
      "Template notes must open in peek immediately.",
    ],
    [
      files.notesShell,
      notesShell,
      "<PagePeekModal",
      "Notes module must render the page peek modal for created note pages.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "deferContent: true",
      "Company research module must render page metadata before deferred body hydration.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "autoHydrateContent: false",
      "Company research module must not auto-hydrate every imported note body on first paint.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "@/components/page/LazyPagePeekModal",
      "Company research module must lazy-load the page peek editor instead of adding it to first paint.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "warmPagePeekModal();",
      "Company research starter actions must warm the peek editor while creating local research assets.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "const [peekPageId, setPeekPageId] = useState<string | null>(null);",
      "Company research module must hold a page peek target for same-view editing.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);",
      "Company research module must seed newly created pages into the peek before slower hydration.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "rememberPendingPageDraft(page);",
      "Company research created pages must keep a short-lived local draft before opening.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      'rememberPageRouteHandoff(page, "module-create");',
      "Company research created pages must hand off local-first metadata with a module-create source.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "setPeekInitialPage(page);",
      "Company research created pages must seed peek metadata before first paint.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "setPeekPageId(page.id);",
      "Company research created pages must open in the current-view peek instead of forcing a full route.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      "<PagePeekModal",
      "Company research module must render the page peek modal for created research pages.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "deferContent: true",
      "Meetings module must render page metadata before deferred body hydration.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "autoHydrateContent: false",
      "Meetings module must not auto-hydrate every imported note body on first paint.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "@/components/page/LazyPagePeekModal",
      "Meetings module must lazy-load the page peek editor instead of adding it to first paint.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "warmPagePeekModal();",
      "Meetings module create actions must warm the peek editor while creating local meeting pages.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "const [peekPageId, setPeekPageId] = useState<string | null>(null);",
      "Meetings module must hold a page peek target for same-view editing.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);",
      "Meetings module must seed newly created meeting pages into the peek before slower hydration.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "rememberPendingPageDraft(page);",
      "Meetings created pages must keep a short-lived local draft before opening.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      'rememberPageRouteHandoff(page, "module-create");',
      "Meetings created pages must hand off local-first metadata with a module-create source.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "openCreatedMeetingModulePage(result.page);",
      "Meeting template pages must open in peek immediately.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "openCreatedMeetingModulePage(createdPages[0]);",
      "Single imported meeting transcript pages must open in peek immediately.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      "<PagePeekModal",
      "Meetings module must render the page peek modal for created meeting pages.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "deferContent: true",
      "Reports module must render page metadata before deferred body hydration.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "autoHydrateContent: false",
      "Reports module must not auto-hydrate every imported note body on first paint.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "@/components/page/LazyPagePeekModal",
      "Reports module must lazy-load the page peek editor instead of adding it to first paint.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "warmPagePeekModal();",
      "Reports starter and import actions must warm the peek editor while creating local report pages.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "const [peekPageId, setPeekPageId] = useState<string | null>(null);",
      "Reports module must hold a page peek target for same-view editing.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);",
      "Reports module must seed newly created report pages into the peek before slower hydration.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "rememberPendingPageDraft(page);",
      "Reports created pages must keep a short-lived local draft before opening.",
    ],
    [
      files.reportsShell,
      reportsShell,
      'rememberPageRouteHandoff(page, "module-create");',
      "Reports created pages must hand off local-first metadata with a module-create source.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "setPeekInitialPage(page);",
      "Reports created pages must seed peek metadata before first paint.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "setPeekPageId(page.id);",
      "Reports created pages must open in the current-view peek instead of forcing a full route.",
    ],
    [
      files.reportsShell,
      reportsShell,
      "<PagePeekModal",
      "Reports module must render the page peek modal for created report pages.",
    ],
    [
      files.filesShell,
      filesShell,
      "@/components/page/LazyPagePeekModal",
      "Files module must lazy-load the page peek editor instead of adding it to first paint.",
    ],
    [
      files.filesShell,
      filesShell,
      "warmPagePeekModal();",
      "Files module must warm the peek editor while creating local file pages.",
    ],
    [
      files.filesShell,
      filesShell,
      "const [peekPageId, setPeekPageId] = useState<string | null>(null);",
      "Files module must hold a page peek target for same-view editing.",
    ],
    [
      files.filesShell,
      filesShell,
      "const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);",
      "Files module must seed newly created file pages into the peek before slower hydration.",
    ],
    [
      files.filesShell,
      filesShell,
      "rememberPendingPageDraft(page);",
      "Files created pages must keep a short-lived local draft before opening.",
    ],
    [
      files.filesShell,
      filesShell,
      'rememberPageRouteHandoff(page, "module-create");',
      "Files created pages must hand off local-first metadata with a module-create source.",
    ],
    [
      files.filesShell,
      filesShell,
      "setPeekInitialPage(page);",
      "Files created pages must seed peek metadata before first paint.",
    ],
    [
      files.filesShell,
      filesShell,
      "setPeekPageId(page.id);",
      "Files created pages must open in the current-view peek instead of forcing a full route.",
    ],
    [
      files.filesShell,
      filesShell,
      "openCreatedFilePage(createdPages[0]);",
      "Single imported file pages must open in peek immediately.",
    ],
    [
      files.filesShell,
      filesShell,
      "openCreatedFilePage(page);",
      "Existing local files converted to pages must open in peek immediately.",
    ],
    [
      files.filesShell,
      filesShell,
      "<PagePeekModal",
      "Files module must render the page peek modal for created file pages.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "@/components/page/LazyPagePeekModal",
      "Projects module must lazy-load the page peek editor instead of adding it to first paint.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "warmPagePeekModal();",
      "Projects module create actions must warm the peek editor while creating local project pages.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "const [peekPageId, setPeekPageId] = useState<string | null>(null);",
      "Projects module must hold a page peek target for same-view editing.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);",
      "Projects module must seed newly created project pages into the peek before slower hydration.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "rememberPendingPageDraft(page);",
      "Projects created pages must keep a short-lived local draft before opening.",
    ],
    [
      files.projectsShell,
      projectsShell,
      'rememberPageRouteHandoff(page, "module-create");',
      "Projects created pages must hand off local-first metadata with a module-create source.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "openCreatedProjectPage(createdPage);",
      "Project brief pages must open in peek immediately.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "openCreatedProjectPage(result.page);",
      "Project starter pages must open in peek immediately.",
    ],
    [
      files.projectsShell,
      projectsShell,
      "<PagePeekModal",
      "Projects module must render the page peek modal for created project pages.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "@/components/page/LazyPagePeekModal",
      "Portfolio module must lazy-load the page peek editor instead of adding it to first paint.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "warmPagePeekModal();",
      "Portfolio module create actions must warm the peek editor while creating local portfolio pages.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "const [peekPageId, setPeekPageId] = useState<string | null>(null);",
      "Portfolio module must hold a page peek target for same-view editing.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);",
      "Portfolio module must seed newly created portfolio pages into the peek before slower hydration.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "rememberPendingPageDraft(page);",
      "Portfolio created pages must keep a short-lived local draft before opening.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      'rememberPageRouteHandoff(page, "module-create");',
      "Portfolio created pages must hand off local-first metadata with a module-create source.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "openCreatedPortfolioPage(result.page);",
      "Portfolio starter pages must open in peek immediately.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "<PagePeekModal",
      "Portfolio module must render the page peek modal for created portfolio pages.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "deferContent: true",
      "Portfolio module must render page metadata before deferred body hydration.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      "autoHydrateContent: false",
      "Portfolio module must not auto-hydrate every imported note body on first paint.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      "deferContent: true",
      "Research graph module must render page metadata before deferred body hydration.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      "autoHydrateContent: false",
      "Research graph module must not auto-hydrate every imported note body on first paint.",
    ],
    [
      files.usePage,
      usePage,
      "void queueCloudPagePushWithAccountSync(record)",
      "Page edits must enqueue account-cloud upload through the pending queue.",
    ],
    [
      files.usePage,
      usePage,
      "MAX_REMOTE_COVER_CHARS = 300 * 1024",
      "Page edits must keep the cloud queue cover-size guard when using the lightweight local record converter.",
    ],
    [
      files.usePage,
      usePage,
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")',
      "Page edits must load cloud queue helpers only after the page shell has opened.",
    ],
    [
      files.usePage,
      usePage,
      "queueOptimisticPageLocalCachePersist(record, upsertPages)",
      "Page edits must persist the rebuildable local cache in the background.",
    ],
    [
      files.usePage,
      usePage,
      "optimisticPageLocalCachePersistQueue",
      "Page edits must collapse overlapping local cache writes by page.",
    ],
    [
      files.usePage,
      usePage,
      "drainOptimisticPageLocalCachePersistQueue",
      "Page edits must drain local cache writes from a latest-only queue.",
    ],
    [
      files.usePage,
      usePage,
      "if (queued.latest !== record) continue;",
      "Page edits must skip stale local cache write completions when newer content exists.",
    ],
    [
      files.usePage,
      usePage,
      "rememberPendingPageDraft(optimistic)",
      "Page edits must keep an immediate in-memory draft while the rebuildable local cache is being written.",
    ],
    [
      files.usePage,
      usePage,
      "clearPendingPageDraft(record.id)",
      "Page edit drafts must clear after the local cache write catches up.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "window.sessionStorage.setItem",
      "Pending page drafts must survive same-tab refresh without waiting for local cache writes.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "window.sessionStorage.removeItem",
      "Pending page drafts must clear from same-tab recovery storage after local cache catches up.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "session_storage_only: true",
      "Pending page drafts must declare that recovery storage is session-only.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "stores_page_body_html: true",
      "Pending page drafts may store page body HTML only for short-lived refresh recovery.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "stores_page_yjs: false",
      "Pending page drafts must not store Yjs editor state.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "uploads_workspace_data: false",
      "Pending page drafts must not upload workspace data.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "enters_sync_log: false",
      "Pending page drafts must stay out of the sync log.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "PENDING_PAGE_DRAFT_MAX_CHARS",
      "Pending page drafts must stay bounded so large imported notes do not bloat session storage.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "PENDING_PAGE_DRAFT_DEBOUNCE_CHARS",
      "Pending page drafts must debounce sessionStorage writes for large page bodies.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "PENDING_PAGE_DRAFT_STORAGE_WRITE_DELAY_MS",
      "Pending page draft sessionStorage writes must be short-delay buffered instead of per-keystroke for large bodies.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "pendingPageDraftSessionWrites",
      "Pending page drafts must coalesce large body recovery writes by page id.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "rememberPendingPageDraftInSessionStorageSoon",
      "Pending page drafts must route session recovery writes through the debounced writer.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      "flushPendingPageDraftSessionStorageWrites",
      "Pending page drafts must flush buffered recovery writes before the tab is hidden or closed.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      'window.addEventListener("pagehide"',
      "Pending page drafts must flush buffered recovery writes on pagehide.",
    ],
    [
      files.pendingPageDrafts,
      pendingPageDrafts,
      'document.addEventListener("visibilitychange"',
      "Pending page drafts must flush buffered recovery writes when the document becomes hidden.",
    ],
    [
      files.localFirstPageNavigationUtil,
      localFirstPageNavigationUtil,
      "rememberPendingPageDraft(page)",
      "Shared page navigation must keep an in-memory draft before opening the page route.",
    ],
    [
      files.localFirstPageNavigationUtil,
      localFirstPageNavigationUtil,
      "rememberPageRouteHandoff(page, source)",
      "Shared page navigation must hand off metadata before slower local DB or cloud checks.",
    ],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "router.prefetch(`/page/${page.id}`)",
      "Shared page navigation must prefetch the page route as a non-authoritative speed hint.",
    ],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "warmPageShellModule();",
      "Shared page navigation must warm the page shell once for module, sidebar, and search opens.",
    ],
    [
      files.localFirstPageNavigationUtil,
      localFirstPageNavigationUtil,
      "pageShellWarmupPromise",
      "Shared page navigation must start page shell warmup before route navigation.",
    ],
    [
      files.localFirstPageNavigationUtil,
      localFirstPageNavigationUtil,
      'import("@/components/providers/PageShell")',
      "Shared page navigation must preload the page shell without reading page bodies.",
    ],
    [
      files.sidebar,
      sidebar,
      'openPage(page, { source: "sidebar-create" })',
      "Sidebar page creation must open through the local-first page navigation helper.",
    ],
    [
      files.pageTree,
      pageTree,
      'source: "sidebar-open"',
      "Sidebar page tree opens must use local-first route handoff metadata.",
    ],
    [
      files.pageTree,
      pageTree,
      "SIDEBAR_PAGE_TREE_CHILD_LIMIT",
      "Sidebar page tree must cap rendered child pages per expanded parent.",
    ],
    [
      files.pageTree,
      pageTree,
      "visibleChildren.map((child)",
      "Sidebar page tree must render the capped child subset instead of every child page.",
    ],
    [
      files.pageTree,
      pageTree,
      "getCurrentPagePathIds",
      "Sidebar page tree must keep the current page path visible even when siblings are capped.",
    ],
    [
      files.pageTree,
      pageTree,
      "currentPathIds.has(page.id)",
      "Sidebar page tree must auto-expand the current page ancestry without rendering every child page.",
    ],
    [
      files.pageTree,
      pageTree,
      "page.id === currentPageId",
      "Sidebar page tree must avoid expanding the current page itself just to reveal descendants.",
    ],
    [
      files.pageTree,
      pageTree,
      "已折叠 {hiddenChildCount} 个子页面",
      "Sidebar page tree must tell the owner when child pages are folded for performance.",
    ],
    [
      files.pageTree,
      pageTree,
      "collectHiddenModuleSubtreeIds",
      "Sidebar page tree must skip hidden module subtrees before grouping and sorting pages.",
    ],
    [
      files.pageTree,
      pageTree,
      "hiddenModuleSubtreeIds.has(page.id)",
      "Sidebar page tree must exclude hidden module descendants from the parent index.",
    ],
    [
      files.pageTree,
      pageTree,
      "visiting.has(page.id)",
      "Sidebar hidden module subtree detection must guard against cyclic parent chains.",
    ],
    [
      files.pageTree,
      pageTree,
      "useDeferredValue(pages)",
      "Sidebar page tree must defer large imported page-list rendering so route navigation remains responsive.",
    ],
    [
      files.pageTree,
      pageTree,
      "childVisibleLimit",
      "Sidebar page tree must let owners reveal folded child pages on demand without rendering every child upfront.",
    ],
    [
      files.pageTree,
      pageTree,
      "setRootVisibleLimit",
      "Sidebar page tree must let owners reveal folded root pages on demand without rendering every root upfront.",
    ],
    [
      files.pageTree,
      pageTree,
      "显示更多",
      "Sidebar page tree must expose an on-demand reveal control for folded page groups.",
    ],
    [
      files.pageTree,
      pageTree,
      "isDescendant(page.id, draggedId, pagesById)",
      "Sidebar page tree drag hover must reuse the workspace page index instead of rebuilding a full-page map.",
    ],
    [
      files.favoritePages,
      favoritePages,
      'source: "favorite-open"',
      "Favorite page opens must use local-first route handoff metadata.",
    ],
    [
      files.favoritePages,
      favoritePages,
      "SIDEBAR_FAVORITE_VISIBLE_LIMIT",
      "Sidebar favorite pages must cap rendered rows for large imported workspaces.",
    ],
    [
      files.favoritePages,
      favoritePages,
      "visibleFavoritePages.map((page)",
      "Sidebar favorite pages must render the capped favorite subset.",
    ],
    [
      files.favoritePages,
      favoritePages,
      "已折叠 {hiddenFavoriteCount} 个收藏页面",
      "Sidebar favorite pages must tell the owner when favorites are folded for performance.",
    ],
    [
      files.trashPages,
      trashPages,
      'source: "trash-restore-open"',
      "Restored pages must open through local-first route handoff metadata.",
    ],
    [
      files.trashPages,
      trashPages,
      "SIDEBAR_TRASH_VISIBLE_LIMIT",
      "Sidebar trash pages must cap rendered rows for large deleted-page sets.",
    ],
    [
      files.trashPages,
      trashPages,
      "visibleTrashPages.map((page)",
      "Sidebar trash pages must render the capped trash subset.",
    ],
    [
      files.trashPages,
      trashPages,
      "已折叠 {hiddenTrashCount} 个回收站页面",
      "Sidebar trash pages must tell the owner when trash rows are folded for performance.",
    ],
    [
      files.quickSearch,
      quickSearch,
      'source: "quick-search-open"',
      "Quick search page opens must use local-first route handoff metadata.",
    ],
    [
      files.quickSearch,
      quickSearch,
      'source: "quick-search-create"',
      "Quick search page creation must use local-first route handoff metadata.",
    ],
    [
      files.childPageTree,
      childPageTree,
      'source: "child-page-open"',
      "Child page tree opens must use local-first route handoff metadata.",
    ],
    [
      files.childPageTree,
      childPageTree,
      'source: "child-page-create"',
      "Child page creation must use local-first route handoff metadata.",
    ],
    [
      files.subPageTree,
      subPageTree,
      'source: "child-page-open"',
      "Page position tree opens must use local-first route handoff metadata.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"module-create"',
      "Module-created pages must have an explicit local-first route handoff source.",
    ],
    [
      files.pageRouteHandoff,
      pageRouteHandoff,
      '"module-open"',
      "Module-opened pages must have an explicit local-first route handoff source.",
    ],
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
    assertSourceIncludes(sourceLabel, source, snippet, message);
  }
  assertSourceExcludes(
    files.sidebar,
    sidebar,
    'import QuickSearch from "./QuickSearch"',
    "Sidebar must not direct-import the heavy quick search bundle during first paint."
  );
  for (const [sourceLabel, source] of [
    [files.sidebar, sidebar],
    [files.quickSearch, quickSearch],
    [files.syncShell, syncShell],
  ]) {
    assertSourceExcludes(
      sourceLabel,
      source,
      'from "@/lib/export/workspaceBackup"',
      "Workspace export/backup code must not be part of sidebar/search first paint bundles."
    );
  }
  for (const [sourceLabel, source, forbiddenSnippet, message] of [
    [
      files.sidebar,
      sidebar,
      'from "@/lib/pages/cloudPageMutations"',
      "Sidebar page creation code must stay out of the first paint bundle.",
    ],
    [
      files.sidebar,
      sidebar,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Sidebar database creation code must stay out of the first paint bundle.",
    ],
    [
      files.quickSearch,
      quickSearch,
      'from "@/lib/pages/cloudPageMutations"',
      "Quick search page mutation code must load only after the palette is active and a command runs.",
    ],
    [
      files.quickSearch,
      quickSearch,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Quick search database mutation code must load only after the palette is active and a command runs.",
    ],
    [
      files.pageTree,
      pageTree,
      'from "@/lib/pages/cloudPageMutations"',
      "Sidebar page tree mutation code must load only after add-child or drag/drop intent.",
    ],
    [
      files.dailyNotesShell,
      dailyNotesShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Daily note reschedule mutation code must stay out of the calendar first paint bundle.",
    ],
    [
      files.databaseShell,
      databaseShell,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Database detail mutation code must stay out of the database first paint bundle.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "import {\n  syncCloudDatabaseById",
      "Database detail account sync runtime code must stay out of the database first paint bundle.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "applyDatabaseImportPreview,\n  buildDatabaseImportPreview",
      "Database detail import engine must stay out of the database first paint bundle.",
    ],
    [
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Inline database mutation code must stay out of the editor first paint bundle.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'import { highlightCodeToHtml } from "@/lib/codeHighlight"',
      "File preview code highlighting must stay out of the editor first paint bundle.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'import { convertZipToHtml } from "@/lib/files/archive"',
      "File preview ZIP conversion must stay out of the editor first paint bundle.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'import { convertEpubToHtml } from "@/lib/files/epub"',
      "File preview EPUB conversion must stay out of the editor first paint bundle.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      "convertSpreadsheetToHtml,\n  importSpreadsheetAsDatabase",
      "File preview spreadsheet parsing/import runtime must stay out of the editor first paint bundle.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'import { convertPresentationToHtml } from "@/lib/files/presentationImport"',
      "File preview presentation conversion runtime must stay out of the editor first paint bundle.",
    ],
    [
      files.filePreviewNode,
      filePreviewNode,
      'import { convertWordToHtml } from "@/lib/files/word"',
      "File preview Word conversion runtime must stay out of the editor first paint bundle.",
    ],
    [
      files.pageImportPlanPanel,
      pageImportPlanPanel,
      "executePageImportPlan,\n  countExecutableItems",
      "Page import execution runtime must stay out of the page import panel first paint bundle.",
    ],
    [
      files.pageImportPlanPanel,
      pageImportPlanPanel,
      'import {\n  executePageImportPlan',
      "Page import panel must lazy-load the import executor instead of statically importing it.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Meeting schedule page mutation code must stay out of the calendar first paint bundle.",
    ],
    [
      files.meetingScheduleShell,
      meetingScheduleShell,
      'from "@/lib/pages/accountPageSync"',
      "Meeting schedule account sync code must stay out of the calendar first paint bundle.",
    ],
    [
      files.filesShell,
      filesShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Files module page mutation code must stay out of the file workbench first paint bundle.",
    ],
    [
      files.knowledgeBaseShell,
      knowledgeBaseShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Knowledge base page mutation code must stay out of the board first paint bundle.",
    ],
    [
      files.industryChainShell,
      industryChainShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Industry chain page mutation code must stay out of the tree first paint bundle.",
    ],
    [
      files.reportsShell,
      reportsShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Reports page mutation code must stay out of the reports workbench first paint bundle.",
    ],
    [
      files.reportsShell,
      reportsShell,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Reports database mutation code must stay out of the reports workbench first paint bundle.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Meetings page mutation code must stay out of the meetings workbench first paint bundle.",
    ],
    [
      files.meetingsShell,
      meetingsShell,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Meetings database mutation code must stay out of the meetings workbench first paint bundle.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Company research page mutation code must stay out of the company workbench first paint bundle.",
    ],
    [
      files.companyResearchShell,
      companyResearchShell,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Company research database mutation code must stay out of the company workbench first paint bundle.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Portfolio page mutation code must stay out of the portfolio workbench first paint bundle.",
    ],
    [
      files.portfolioShell,
      portfolioShell,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Portfolio database mutation code must stay out of the portfolio workbench first paint bundle.",
    ],
    [
      files.projectsShell,
      projectsShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Projects page mutation code must stay out of the projects workbench first paint bundle.",
    ],
    [
      files.projectsShell,
      projectsShell,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Projects database mutation code must stay out of the projects workbench first paint bundle.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      'from "@/lib/pages/cloudPageMutations"',
      "Research graph page mutation code must stay out of the graph workbench first paint bundle.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      'from "@/lib/database/cloudDatabaseMutations"',
      "Research graph database mutation code must stay out of the graph workbench first paint bundle.",
    ],
  ]) {
    assertSourceExcludes(sourceLabel, source, forbiddenSnippet, message);
  }
  assertSourceExcludes(
    files.pageTree,
    pageTree,
    "{children.map((child)",
    "Sidebar page tree must not render every child page in a large expanded parent."
  );
  for (const forbiddenPageTreeSnippet of [
    "new Map(allPages.map",
    "allPages={pages}",
    "function getSiblings",
  ]) {
    assertSourceExcludes(
      files.pageTree,
      pageTree,
      forbiddenPageTreeSnippet,
      "Sidebar page tree drag/drop must reuse existing page indexes instead of rebuilding full-page scans."
    );
  }
  for (const [sourceLabel, source] of [
    [files.companyResearchShell, companyResearchShell],
    [files.meetingsShell, meetingsShell],
    [files.reportsShell, reportsShell],
    [files.portfolioShell, portfolioShell],
    [files.researchGraphShell, researchGraphShell],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "upsertPages",
      "Content-heavy research modules must optimistically merge newly created pages instead of waiting on global page refresh."
    );
    assertSourceExcludes(
      sourceLabel,
      source,
      "await refresh()",
      "Content-heavy research module create/import flows must not wait for a full page-list refresh."
    );
  }
  assertSourceIncludes(
    files.projectsShell,
    projectsShell,
    "upsertPages([createdPage])",
    "Projects module must optimistically merge newly created project pages instead of waiting on global page refresh."
  );
  assertSourceIncludes(
    files.projectsShell,
    projectsShell,
    "upsertPages([result.page])",
    "Projects module starter page creates must optimistically merge the page before opening it."
  );
  assertSourceExcludes(
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
    assertSourceIncludes(
      files.projectsShell,
      projectsShell,
      snippet,
      "Projects module must keep database status scans and tracker rendering bounded for large workspaces."
    );
  }
  assertSourceExcludes(
    files.projectsShell,
    projectsShell,
    "databases.map(async (database)",
    "Projects module must not scan every database when loading project graph snapshots."
  );
  assertSourceExcludes(
    files.notesShell,
    notesShell,
    "includeContent: true",
    "Notes module must not default to full body hydration after large imports."
  );
  assertSourceExcludes(
    files.notesShell,
    notesShell,
    "await refresh()",
    "Notes module create/open flow must not wait for a full page-list refresh."
  );
	  assertSourceExcludes(
	    files.notesShell,
	    notesShell,
	    "void refresh()",
	    "Notes module repeated content scans must not fire a global page refresh after large imports."
	  );
	  for (const [snippet, message] of [
	    [
	      'import("@/lib/pages/cloudPageMutations")',
	      "Notes module must lazy-load page creation mutations after create-note intent.",
	    ],
	    [
	      'import("@/lib/modules/actions")',
	      "Notes module must lazy-load template starter actions after template intent.",
	    ],
	  ]) {
	    assertSourceIncludes(files.notesShell, notesShell, snippet, message);
	  }
	  for (const [snippet, message] of [
	    [
	      'from "@/lib/pages/cloudPageMutations"',
	      "Notes module page creation code must stay out of the notes first paint bundle.",
	    ],
	    [
	      'from "@/lib/modules/actions"',
	      "Notes module starter actions must stay out of the notes first paint bundle.",
	    ],
	  ]) {
	    assertSourceExcludes(files.notesShell, notesShell, snippet, message);
	  }
	  for (const [sourceLabel, source, moduleLabel] of [
	    [files.quickSearch, quickSearch, "Quick search"],
	    [files.companyResearchShell, companyResearchShell, "Company research"],
	    [files.meetingsShell, meetingsShell, "Meetings"],
	    [files.reportsShell, reportsShell, "Reports"],
	    [files.portfolioShell, portfolioShell, "Portfolio"],
	    [files.projectsShell, projectsShell, "Projects"],
	    [files.notesShell, notesShell, "Notes"],
	    [files.moduleDashboard, moduleDashboard, "Module center"],
	  ]) {
	    assertSourceIncludes(
	      sourceLabel,
	      source,
	      'import("@/lib/modules/actions")',
	      `${moduleLabel} starter actions must lazy-load only after starter intent.`
	    );
	    assertSourceExcludes(
	      sourceLabel,
	      source,
	      'from "@/lib/modules/actions"',
	      `${moduleLabel} starter actions must stay out of the first paint bundle.`
	    );
	  }
	  assertSourceIncludes(
	    files.breadcrumbBlockNode,
    breadcrumbBlockNode,
    "getPageMetadata(cursor)",
    "Breadcrumb editor blocks must resolve page paths through bounded metadata reads."
  );
  assertSourceIncludes(
    files.breadcrumbBlockNode,
    breadcrumbBlockNode,
    "BREADCRUMB_PARENT_LOOKUP_GUARD",
    "Breadcrumb editor blocks must guard parent traversal depth."
  );
  assertSourceExcludes(
    files.breadcrumbBlockNode,
    breadcrumbBlockNode,
    'from "@/hooks/usePages"',
    "Breadcrumb editor blocks must not import usePages because page open should not trigger global metadata scans."
  );
  for (const snippet of [
    "collectInlineRelationPageIds",
    "loadInlineRelationPages",
    "getPageMetadata(pageId)",
    "getRows(databaseId, { includePageContent: false })",
  ]) {
    assertSourceIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database blocks must resolve only referenced relation pages through bounded metadata reads."
    );
  }
  assertSourceExcludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    'from "@/hooks/usePages"',
    "Inline database blocks must not import usePages because page open should not trigger global metadata scans."
  );
  assertSourceIncludes(
    files.localQueries,
    localQueries,
    "export async function searchPageMetadata",
    "Relation field search must have a bounded metadata query for local-first UX."
  );
  for (const snippet of [
    "usePages({ autoLoad: false })",
    "upsertPages([restoredPage])",
    "openPage(restoredPage ?? page ?? pageId",
  ]) {
    assertSourceIncludes(
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
    assertSourceIncludes(
      sourceLabel,
      source,
      "useLocalFirstPageNavigation",
      "Common page opens must use the shared local-first page navigation helper."
    );
    for (const sourceSnippet of requiredSources) {
      assertSourceIncludes(
        sourceLabel,
        source,
        sourceSnippet,
        "Common page opens must tag route handoff with a specific source."
      );
    }
  }
  for (const [sourceLabel, source, requiredSources] of [
    [files.notesShell, notesShell, ['"module-create"', 'source: "module-open"']],
    [files.filesShell, filesShell, ['"module-create"', 'source: "module-open"']],
    [files.meetingsShell, meetingsShell, ['"module-create"', 'source: "module-open"']],
    [files.reportsShell, reportsShell, ['"module-create"', 'source: "module-open"']],
    [files.projectsShell, projectsShell, ['"module-create"', 'source: "module-open"']],
    [files.moduleDashboard, moduleDashboard, ['"module-create"', 'source: "module-open"']],
    [files.companyResearchShell, companyResearchShell, ['"module-create"', 'source: "module-open"']],
    [files.portfolioShell, portfolioShell, ['"module-create"', 'source: "module-open"']],
    [files.researchConnectionsPanel, researchConnectionsPanel, ['source: "module-open"']],
    [files.researchGraphShell, researchGraphShell, ['"module-create"', 'source: "module-open"']],
    [files.industryChainShell, industryChainShell, ['"module-create"', 'source: "module-open"']],
    [files.knowledgeBaseShell, knowledgeBaseShell, ['source: "module-open"']],
    [files.aiWorkbenchShell, aiWorkbenchShell, ['source: "module-open"']],
    [files.pageImportPlanPanel, pageImportPlanPanel, ['"module-create"', 'source: "module-open"']],
  ]) {
    assertSourceIncludes(
      sourceLabel,
      source,
      "useLocalFirstPageNavigation",
      "Module page opens must use the shared local-first page navigation helper."
    );
    for (const sourceSnippet of requiredSources) {
      assertSourceIncludes(
        sourceLabel,
        source,
        sourceSnippet,
        "Module page opens must tag route handoff with module-create or module-open."
      );
    }
  }
  for (const forbiddenLocalFirstNavigationSnippet of [
    "queueCloudPagePush",
    "pushCloudPages",
    "sync_log",
    "content_text",
    "content_yjs",
    'import("@/components/editor/Editor")',
  ]) {
    for (const [sourceLabel, source] of [
      [files.localFirstPageNavigation, localFirstPageNavigation],
      [files.localFirstPageNavigationUtil, localFirstPageNavigationUtil],
    ]) {
      assertSourceExcludes(
        sourceLabel,
        source,
        forbiddenLocalFirstNavigationSnippet,
        "Shared page navigation must stay a metadata-only route hint, not a cloud sync or content cache."
      );
    }
  }
  assertSourceExcludes(
    files.companyResearchShell,
    companyResearchShell,
    'openPage(result.page, { source: "module-create" })',
    "Company research starter-created pages must open in peek immediately, not force a full page route."
  );
  for (const snippet of [
    'openPage(result.page, { source: "module-create" })',
    'openPage(createdPages[0], { source: "module-create" })',
    'openPage(createdPage, { source: "module-create" })',
  ]) {
    assertSourceExcludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports-created pages must open in peek immediately, not force a full page route."
    );
  }
  for (const snippet of [
    'openPage(createdPages[0], { source: "module-create" })',
    'openPage(page, { source: "module-create" })',
  ]) {
    assertSourceExcludes(
      files.filesShell,
      filesShell,
      snippet,
      "Files-created pages must open in peek immediately, not force a full page route."
    );
  }
  for (const snippet of [
    'openPage(page, { source: "module-create" })',
    'openPage(result.page, { source: "module-create" })',
  ]) {
    assertSourceExcludes(
      files.notesShell,
      notesShell,
      snippet,
      "Notes-created pages must open in peek immediately, not force a full page route."
    );
  }
  for (const snippet of [
    'openPage(result.page, { source: "module-create" })',
    'openPage(createdPages[0], { source: "module-create" })',
  ]) {
    assertSourceExcludes(
      files.meetingsShell,
      meetingsShell,
      snippet,
      "Meetings-created pages must open in peek immediately, not force a full page route."
    );
  }
  for (const snippet of [
    'openPage(createdPage, { source: "module-create" })',
    'openPage(result.page, { source: "module-create" })',
  ]) {
    assertSourceExcludes(
      files.projectsShell,
      projectsShell,
      snippet,
      "Projects-created pages must open in peek immediately, not force a full page route."
    );
  }
  assertSourceExcludes(
    files.portfolioShell,
    portfolioShell,
    'openPage(result.page, { source: "module-create" })',
    "Portfolio-created pages must open in peek immediately, not force a full page route."
  );
  for (const [sourceLabel, source, blockedSnippet, message] of [
    [
      files.moduleDashboard,
      moduleDashboard,
      'openPage(page, { source: "module-create" })',
      "Module dashboard new notes must open in peek immediately, not force a full page route.",
    ],
    [
      files.moduleDashboard,
      moduleDashboard,
      'openPage(result.page, { source: "module-create" })',
      "Module dashboard starter-created pages must open in peek immediately, not force a full page route.",
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      'openPage(createdPage, { source: "module-create" })',
      "Research graph-created pages must open in peek immediately, not force a full page route.",
    ],
    [
      files.industryChainShell,
      industryChainShell,
      'openPage(child, { source: "module-create" })',
      "Industry chain-created pages must open in peek immediately, not force a full page route.",
    ],
    [
      files.pageImportPlanPanel,
      pageImportPlanPanel,
      'openPage(firstPage, { source: "module-create" })',
      "Page import first pages must open in peek immediately, not force a full page route.",
    ],
    [
      files.pageImportPlanPanel,
      pageImportPlanPanel,
      'openPage(res.first_page_id, { source: "module-create" })',
      "Page import first page ids must open in peek immediately, not force a full page route.",
    ],
  ]) {
    assertSourceExcludes(sourceLabel, source, blockedSnippet, message);
    assertSourceIncludes(
      sourceLabel,
      source,
      "@/components/page/LazyPagePeekModal",
      "Module-created pages must lazy-load the peek editor for same-view opening."
    );
    assertSourceIncludes(
      sourceLabel,
      source,
      "<PagePeekModal",
      "Module-created pages must render the page peek modal for same-view opening."
    );
  }
  for (const [blockedSnippet, message] of [
    [
      'from "@/lib/pages/cloudPageMutations"',
      "Module dashboard page creation code must stay out of the module center first paint bundle.",
    ],
    [
      'from "@/lib/database/cloudDatabaseMutations"',
      "Module dashboard database creation code must stay out of the module center first paint bundle.",
    ],
    [
      'from "@/lib/modules/actions"',
      "Module dashboard starter actions must load only after a starter is clicked.",
    ],
  ]) {
    assertSourceExcludes(
      files.moduleDashboard,
      moduleDashboard,
      blockedSnippet,
      message
    );
  }
  for (const [snippet, message] of [
    [
      'import("@/lib/pages/cloudPageMutations")',
      "Module dashboard must lazy-load page mutations after create-page intent.",
    ],
    [
      'import("@/lib/database/cloudDatabaseMutations")',
      "Module dashboard must lazy-load database mutations after create-database intent.",
    ],
    [
      'import("@/lib/modules/actions")',
      "Module dashboard must lazy-load module starter actions after starter intent.",
    ],
  ]) {
    assertSourceIncludes(files.moduleDashboard, moduleDashboard, snippet, message);
  }
  assertSourceExcludes(
    files.usePage,
    usePage,
    "await pushCloudPages([record])",
    "Page edits must not block input on direct cloud push."
  );

  const summary = {
    env_requirements: requiredEnvKeys.length,
    api_stubs: apiStubRows.length,
    page_routes: expectedPageRoutes.length,
    migration_contract_tables: contractTables.length,
    migration_tables: migrationTables.length,
    link_proof_contract_checks: 7,
    deployment_target_checks: 16,
    private_file_storage_policy_checks: 45,
    hot_data_plan_checks: 20,
    file_presign_api_guard_checks: 86,
    audit_events_api_guard_checks: 89,
    smoke_test_plan_checks: 16,
    smoke_test_verifier_checks: 5,
    replay_harness_safety_script_checks: 7,
    conflict_resolution_checks: 50,
    remote_baseline_checks: 43,
    remote_baseline_staging_checks: 49,
    remote_baseline_stage_schema_checks: 55,
    remote_baseline_stage_replay_checks: 67,
    remote_baseline_replay_fixture_checks: 48,
    remote_baseline_replay_harness_checks: 54,
    remote_baseline_replay_runner_checks: 52,
    audit_event_envelope_checks: 52,
    permission_check_envelope_checks: 68,
    permission_check_api_stub_checks: 46,
    permission_check_request_validator_checks: 33,
    permission_server_test_matrix_checks: 35,
    permission_server_readiness_checks: 29,
    web_beta_stage_gate_checks: 35,
    web_launch_workbench_checks: 73,
    web_beta_autonomy_queue_checks: 37,
    web_alpha_launch_decision_checks: 39,
    web_beta_owner_review_packet_checks: 40,
    meeting_cloud_metadata_hot_cache_checks: 8,
    database_local_first_cloud_hydration_checks: 4,
    metadata_first_quick_search_checks: 4,
    daily_lazy_peek_modal_checks: 5,
    warnings: warnings.length,
  };

  if (failures.length > 0) {
    console.error("Web Beta contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    if (warnings.length > 0) {
      console.error("Warnings:");
      for (const warning of warnings) {
        console.error(`- ${warning}`);
      }
    }
    process.exit(1);
  }

  console.log("Web Beta contract verification passed");
  console.log(JSON.stringify(summary, null, 2));
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

function isCloudAlphaStub(id) {
  return (
    id === "auth-session" ||
    id === "auth-login-start" ||
    id === "auth-logout" ||
    id === "workspace-list" ||
    id === "workspace-create" ||
    id === "workspace-bootstrap" ||
    id === "workspace-settings-read" ||
    id === "workspace-settings-update"
  );
}

run();
