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
  privateFileStoragePolicy: "src/lib/sync/privateFileStoragePolicy.ts",
  filePresignApiStub: "src/lib/sync/filePresignApiStub.ts",
  filePresignRoute: "src/app/api/files/presign/route.ts",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  smokeTestVerifier: "scripts/verify-web-beta-smoke-tests.mjs",
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
  commentVersionCloudReplayContract:
    "src/lib/sync/commentVersionCloudReplayContract.ts",
  commentVersionReplayReceipt:
    "src/lib/sync/commentVersionReplayReceipt.ts",
  commentVersionReplayAckGate:
    "src/lib/sync/commentVersionReplayAckGate.ts",
  localMetadataManifest: "src/lib/sync/localMetadataManifest.ts",
  hotCachePolicyPlan: "src/lib/sync/hotCachePolicyPlan.ts",
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
  databaseShell: "src/components/database/DatabaseShell.tsx",
  databaseRouteSkeleton: "src/components/database/DatabaseRouteSkeleton.tsx",
  inlineDatabaseNode: "src/components/editor/extensions/InlineDatabaseNode.tsx",
  compareShell: "src/components/comparison/CompareShell.tsx",
  pageProperties: "src/components/page/PageProperties.tsx",
  pageShell: "src/components/providers/PageShell.tsx",
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
  const privateFileStoragePolicy = readProjectFile(files.privateFileStoragePolicy);
  const filePresignApiStub = readProjectFile(files.filePresignApiStub);
  const filePresignRoute = readProjectFile(files.filePresignRoute);
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const smokeTestVerifier = readProjectFile(files.smokeTestVerifier);
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
  const hotCachePolicyPlan = readProjectFile(files.hotCachePolicyPlan);
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
  const databaseShell = readProjectFile(files.databaseShell);
  const databaseRouteSkeleton = readProjectFile(files.databaseRouteSkeleton);
  const inlineDatabaseNode = readProjectFile(files.inlineDatabaseNode);
  const compareShell = readProjectFile(files.compareShell);
  const pageProperties = readProjectFile(files.pageProperties);
  const pageShell = readProjectFile(files.pageShell);
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
  ]) {
    assertSourceIncludes(
      files.dailyHotCacheSnapshot,
      dailyHotCacheSnapshot,
      snippet,
      message
    );
  }
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
      "writeDailyHotCacheSnapshot",
      "Daily notes must refresh the local hot cache snapshot after metadata loads.",
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
      "writeOptimisticDailyHotCache",
      "Daily + creation must update the local hot cache before background persistence.",
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
  for (const [snippet, message] of [
    [
      "buildDailyRangeSearchTokens",
      "Daily local metadata query must recover visible-month imported notes before broad background backfill finishes.",
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
      "readPageRouteHandoff",
      "usePage must read a route handoff before slower local DB or cloud checks.",
    ],
    [
      "clearPageRouteHandoff",
      "usePage must clear route handoffs after durable local or cloud hydration.",
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
  for (const [snippet, message] of [
    [
      "rememberPageRouteHandoff(optimisticNote, \"daily-create\")",
      "Daily + creation must hand off the optimistic page before full navigation.",
    ],
    [
      "rememberPageRouteHandoff(note, source)",
      "Daily note opening must hand off metadata before opening a page.",
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
      "queueCloudPagePush(record)",
      "Daily + creation must enqueue account-cloud upload instead of waiting on direct push.",
    ],
  ]) {
    assertSourceIncludes(files.dailyNotesShell, dailyNotesShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "quickCreateMeetingForDate",
      "Meeting calendar + buttons must create and open a meeting page directly.",
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
      "persistOptimisticMeetingPage",
      "Meeting creation must persist the optimistic page through local cache and cloud push.",
    ],
    [
      "data-testid={`meeting-add-${key}`}",
      "Meeting calendar + buttons must expose stable test targets.",
    ],
  ]) {
    assertSourceIncludes(
      files.meetingScheduleShell,
      meetingScheduleShell,
      snippet,
      message
    );
  }
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
      "keepActiveDatabases",
      "Hot cache selection must include database preference.",
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
  ]) {
    assertSourceIncludes(files.quickSearch, quickSearch, snippet, message);
  }
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
      "最早排队",
      "Sync UI must render the oldest page pending queued timestamp.",
    ],
    [
      "样本 page id",
      "Sync UI must render metadata-only page pending sample ids.",
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
      "reconcileDatabaseSync({ quick: true })",
      "Sync UI manual database retry must use quick incremental reconcile.",
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
      "前往账号页重建缓存",
      "Cache rebuild entrypoint must hand off to the confirmed account-page rebuild action.",
    ],
    [
      "router.push(\"/account\")",
      "Cache rebuild entrypoint must navigate to the account page instead of directly clearing cache.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
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
      "const pending = await getPendingDatabaseSyncRecords(1000)",
      "Database pending status must read the local sync_log pending queue.",
    ],
    [
      "pending: getPendingCloudDatabasePushKeys().length",
      "Database pending status must expose the cloud key retry queue.",
    ],
    [
      "queued: queuedCloudDatabasePush.size",
      "Database pending status must expose the in-memory debounce queue.",
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
      "页面、数据库和常用 workspace_settings 已有重建入口",
      "Cloud master reconcile must treat workspace_settings as part of the rebuildable cloud-master cache path.",
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
      "primeDatabaseRowPageOpen",
      "Database row full-page opens must prime the page route with local metadata before navigation.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "rememberPendingPageDraft(page)",
      "Database row full-page opens must keep an in-memory page draft for immediate first paint.",
    ],
    [
      files.databaseShell,
      databaseShell,
      "rememberPageRouteHandoff(page, source)",
      "Database row full-page opens must hand off metadata before slower local DB or cloud checks.",
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
      "persistDatabaseRowInBackground(updateRow(rowId, { fieldValues }))",
      "Database cell edits must persist through the pending-aware database mutation helper in the background.",
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
      "visibleRows.slice(0, databaseViewRowRenderLimit)",
      "Database row-heavy views must render a capped subset instead of every visible row.",
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
      "loadPagesSnapshot(includeContent)",
      "Page and sidebar lists must load local IndexedDB snapshots first.",
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
      files.usePage,
      usePage,
      "queueCloudPagePush(record)",
      "Page edits must enqueue account-cloud upload through the pending queue.",
    ],
    [
      files.usePage,
      usePage,
      "void persistOptimisticPageToLocalCache(record, upsertPages)",
      "Page edits must persist the rebuildable local cache in the background.",
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
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "rememberPendingPageDraft(page)",
      "Shared page navigation must keep an in-memory draft before opening the page route.",
    ],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      'rememberPageRouteHandoff(page, options.source ?? "page-open")',
      "Shared page navigation must hand off metadata before slower local DB or cloud checks.",
    ],
    [
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      "router.prefetch(`/page/${page.id}`)",
      "Shared page navigation must prefetch the page route as a non-authoritative speed hint.",
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
      files.favoritePages,
      favoritePages,
      'source: "favorite-open"',
      "Favorite page opens must use local-first route handoff metadata.",
    ],
    [
      files.trashPages,
      trashPages,
      'source: "trash-restore-open"',
      "Restored pages must open through local-first route handoff metadata.",
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
  ]) {
    assertSourceExcludes(
      files.localFirstPageNavigation,
      localFirstPageNavigation,
      forbiddenLocalFirstNavigationSnippet,
      "Shared page navigation must stay a metadata-only route hint, not a cloud sync or content cache."
    );
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
