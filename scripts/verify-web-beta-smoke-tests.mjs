#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  cloudMasterReconcile: "src/lib/sync/cloudMasterReconcile.ts",
  localMetadataManifest: "src/lib/sync/localMetadataManifest.ts",
  hotCachePolicyPlan: "src/lib/sync/hotCachePolicyPlan.ts",
  hotCacheSelectionSettings: "src/lib/sync/hotCacheSelectionSettings.ts",
  hotCacheSettingsCloud: "src/lib/sync/hotCacheSettingsCloud.ts",
  workspaceSettingsRoute: "src/app/api/workspaces/[workspaceId]/settings/route.ts",
  accountPageSync: "src/lib/pages/accountPageSync.ts",
  usePages: "src/hooks/usePages.ts",
  localSchema: "src/lib/db/local/schema.ts",
  localQueries: "src/lib/db/local/queries.ts",
  databaseShell: "src/components/database/DatabaseShell.tsx",
  syncShell: "src/components/modules/SyncShell.tsx",
  meetingScheduleShell: "src/components/modules/MeetingScheduleShell.tsx",
  environmentPreflightRoute:
    "src/app/api/web-beta/environment-preflight/route.ts",
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
  "src/app/auth/callback/page.tsx",
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

function assertFileExists(relativePath, message) {
  if (!existsSync(path.join(root, relativePath))) {
    failures.push(`${message}: ${relativePath}`);
  }
}

function run() {
  const packageJson = JSON.parse(readProjectFile(files.packageJson));
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const cloudMasterReconcile = readProjectFile(files.cloudMasterReconcile);
  const localMetadataManifest = readProjectFile(files.localMetadataManifest);
  const hotCachePolicyPlan = readProjectFile(files.hotCachePolicyPlan);
  const hotCacheSelectionSettings = readProjectFile(
    files.hotCacheSelectionSettings
  );
  const hotCacheSettingsCloud = readProjectFile(files.hotCacheSettingsCloud);
  const workspaceSettingsRoute = readProjectFile(files.workspaceSettingsRoute);
  const accountPageSync = readProjectFile(files.accountPageSync);
  const usePages = readProjectFile(files.usePages);
  const localSchema = readProjectFile(files.localSchema);
  const localQueries = readProjectFile(files.localQueries);
  const databaseShell = readProjectFile(files.databaseShell);
  const syncShell = readProjectFile(files.syncShell);
  const meetingScheduleShell = readProjectFile(files.meetingScheduleShell);
  const environmentPreflightRoute = readProjectFile(
    files.environmentPreflightRoute
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
    "It does not read page body text, comment bodies, file bytes, token values, or upload data.",
    "Smoke verifier must preserve the sensitive-content privacy boundary."
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
    "workspace-settings-readonly-role",
    "Smoke verifier must keep viewer writes blocked."
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
    "导出选择合同",
    "Sync UI must expose the hot cache selection export."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "同步偏好到云端",
    "Sync UI must expose the hot cache cloud sync button."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "从云端恢复偏好",
    "Sync UI must expose the hot cache cloud restore button."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "hasPendingWorkspaceSettingSyncLogEntry",
    "Sync UI must protect local pending hot cache settings before restore."
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
    "syncCloudDatabaseById(databaseId)",
    "Database detail page must still hydrate from the account cloud ledger in the background."
  );
  assertIncludes(
    files.usePages,
    usePages,
    "renderLocalPagesSnapshot",
    "Page and sidebar lists must render local hot cache before waiting for cloud metadata."
  );
  assertIncludes(
    files.usePages,
    usePages,
    "loadPagesSnapshot(includeContent)",
    "Page and sidebar lists must read the rebuildable local snapshot first."
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
