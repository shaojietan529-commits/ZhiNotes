#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  packageJson: "package.json",
  databaseShell: "src/components/database/DatabaseShell.tsx",
  databaseRouteSkeleton: "src/components/database/DatabaseRouteSkeleton.tsx",
  databaseDetailRoute: "src/app/(workspace)/database/[databaseId]/page.tsx",
  databaseDetailRouteLoading:
    "src/app/(workspace)/database/[databaseId]/loading.tsx",
  databaseModuleShell: "src/components/modules/DatabasesShell.tsx",
  databaseModuleRoute: "src/app/(workspace)/modules/databases/page.tsx",
  databaseModuleDashboard: "src/lib/database/databaseModuleDashboard.ts",
  databaseTemplateCatalog: "src/lib/database/databaseTemplateCatalog.ts",
  databaseTemplateRows: "src/lib/database/databaseTemplateRows.ts",
  databaseTemplateRowReadiness:
    "src/lib/database/databaseTemplateRowReadiness.ts",
  databaseViewReadiness: "src/lib/database/databaseViewReadiness.ts",
  databaseImportExportReadiness:
    "src/lib/database/databaseImportExportReadiness.ts",
  databaseWorkbench: "src/lib/database/databaseWorkbench.ts",
  databaseAccountSyncRoute: "src/app/api/databases/account-sync/route.ts",
  databaseAccountSyncClient: "src/lib/database/accountDatabaseSync.ts",
  databaseCloudMutations: "src/lib/database/cloudDatabaseMutations.ts",
  useDatabases: "src/hooks/useDatabases.ts",
  databaseCloudSyncHook: "src/hooks/useDatabaseCloudSync.ts",
  localFirstDatabaseNavigation:
    "src/hooks/useLocalFirstDatabaseNavigation.ts",
  localFirstDatabaseNavigationUtil:
    "src/lib/database/localFirstDatabaseNavigation.ts",
  accountCloudSyncGate: "src/lib/account/accountCloudSyncGate.ts",
  databaseUpdateBus: "src/lib/database/databaseUpdateBus.ts",
  accountShell: "src/components/modules/AccountShell.tsx",
  sidebar: "src/components/sidebar/Sidebar.tsx",
  quickSearch: "src/components/sidebar/QuickSearch.tsx",
  queries: "src/lib/db/local/queries.ts",
  databaseExport: "src/lib/export/databaseExport.ts",
  databaseImport: "src/lib/database/databaseImport.ts",
  databaseImportLimits: "src/lib/database/databaseImportLimits.ts",
  databaseFields: "src/lib/database/fields.ts",
  databaseFormula: "src/lib/database/formula.ts",
  databaseRollup: "src/lib/database/rollup.ts",
  databaseMultiSelect: "src/lib/database/multiSelectValues.ts",
  databaseNumberValues: "src/lib/database/numberValues.ts",
  databaseSystemFields: "src/lib/database/systemFields.ts",
  inlineDatabaseNode: "src/components/editor/extensions/InlineDatabaseNode.tsx",
  slashCommandSuggestion:
    "src/components/editor/extensions/SlashCommandSuggestion.ts",
  tableView: "src/components/database/views/TableView.tsx",
  listView: "src/components/database/views/ListView.tsx",
  kanbanView: "src/components/database/views/KanbanView.tsx",
  calendarView: "src/components/database/views/CalendarView.tsx",
  galleryView: "src/components/database/views/GalleryView.tsx",
  formView: "src/components/database/views/FormView.tsx",
  chartView: "src/components/database/views/ChartView.tsx",
  timelineView: "src/components/database/views/TimelineView.tsx",
  feedView: "src/components/database/views/FeedView.tsx",
  moduleActions: "src/lib/modules/actions.ts",
  registry: "src/lib/modules/registry.ts",
  filePreviewNode: "src/components/editor/extensions/FilePreviewNode.tsx",
  spreadsheet: "src/lib/files/spreadsheet.ts",
  companyResearchShell: "src/components/modules/CompanyResearchShell.tsx",
  meetingsShell: "src/components/modules/MeetingsShell.tsx",
  portfolioShell: "src/components/modules/PortfolioShell.tsx",
  projectsShell: "src/components/modules/ProjectsShell.tsx",
  reportsShell: "src/components/modules/ReportsShell.tsx",
  researchConnectionsPanel:
    "src/components/modules/ResearchConnectionsPanel.tsx",
  researchGraphShell: "src/components/modules/ResearchGraphShell.tsx",
  moduleDashboard: "src/components/modules/ModuleDashboard.tsx",
  relationEditor: "src/components/database/RelationFieldEditor.tsx",
  display: "src/lib/database/display.ts",
  types: "src/lib/utils/types.ts",
};

const requiredViews = [
  "table",
  "list",
  "kanban",
  "calendar",
  "gallery",
  "timeline",
  "chart",
  "form",
  "feed",
];

const requiredWorkspacePresets = [
  "company-research",
  "meeting-tracker",
  "report-library",
  "portfolio-tracker",
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

function assertNotIncludes(sourceLabel, source, snippet, message) {
  if (source.includes(snippet)) {
    failures.push(`${sourceLabel} must not include ${snippet}: ${message}`);
  }
}

function assertNoLocalDatabaseMutationImport(sourceLabel, source) {
  const mutationNames = [
    "addField",
    "addRow",
    "addView",
    "createDatabase",
    "deleteDatabase",
    "deleteField",
    "deleteRow",
    "deleteView",
    "updateDatabase",
    "updateField",
    "updateRow",
    "updateView",
  ];
  const localQueryImports = source.matchAll(
    /import\s*{([^}]*)}\s*from\s*"@\/lib\/db\/local\/queries";/g
  );
  for (const match of localQueryImports) {
    const importedNames = match[1]
      .split(",")
      .map((name) => name.trim().split(/\s+as\s+/)[0]?.trim())
      .filter(Boolean);
    const localMutations = importedNames.filter((name) =>
      mutationNames.includes(name)
    );
    if (localMutations.length > 0) {
      failures.push(
        `${sourceLabel} imports database mutations from local queries: ${localMutations.join(", ")}`
      );
    }
  }
}

function assertViewFile(viewType) {
  const fileName = `${viewType[0].toUpperCase()}${viewType.slice(1)}View.tsx`;
  const relativePath = `src/components/database/views/${fileName}`;
  if (!existsSync(path.join(root, relativePath))) {
    failures.push(`Missing view component for ${viewType}: ${relativePath}`);
  }
}

function run() {
  const packageJson = readProjectFile(files.packageJson);
  const databaseShell = readProjectFile(files.databaseShell);
  const databaseRouteSkeleton = readProjectFile(files.databaseRouteSkeleton);
  const databaseDetailRoute = readProjectFile(files.databaseDetailRoute);
  const databaseDetailRouteLoading = readProjectFile(
    files.databaseDetailRouteLoading
  );
  const databaseModuleShell = readProjectFile(files.databaseModuleShell);
  const databaseModuleRoute = readProjectFile(files.databaseModuleRoute);
  const databaseModuleDashboard = readProjectFile(files.databaseModuleDashboard);
  const databaseTemplateCatalog = readProjectFile(files.databaseTemplateCatalog);
  const databaseTemplateRows = readProjectFile(files.databaseTemplateRows);
  const databaseTemplateRowReadiness = readProjectFile(
    files.databaseTemplateRowReadiness
  );
  const databaseViewReadiness = readProjectFile(files.databaseViewReadiness);
  const databaseImportExportReadiness = readProjectFile(
    files.databaseImportExportReadiness
  );
  const databaseWorkbench = readProjectFile(files.databaseWorkbench);
  const databaseAccountSyncRoute = readProjectFile(
    files.databaseAccountSyncRoute
  );
  const databaseAccountSyncClient = readProjectFile(
    files.databaseAccountSyncClient
  );
  const databaseCloudMutations = readProjectFile(files.databaseCloudMutations);
  const useDatabases = readProjectFile(files.useDatabases);
  const databaseCloudSyncHook = readProjectFile(files.databaseCloudSyncHook);
  const localFirstDatabaseNavigation = readProjectFile(
    files.localFirstDatabaseNavigation
  );
  const localFirstDatabaseNavigationUtil = readProjectFile(
    files.localFirstDatabaseNavigationUtil
  );
  const accountCloudSyncGate = readProjectFile(files.accountCloudSyncGate);
  const databaseUpdateBus = readProjectFile(files.databaseUpdateBus);
  const accountShell = readProjectFile(files.accountShell);
  const sidebar = readProjectFile(files.sidebar);
  const quickSearch = readProjectFile(files.quickSearch);
  const queries = readProjectFile(files.queries);
  const databaseExport = readProjectFile(files.databaseExport);
  const databaseImport = readProjectFile(files.databaseImport);
  const databaseImportLimits = readProjectFile(files.databaseImportLimits);
  const databaseFields = readProjectFile(files.databaseFields);
  const databaseFormula = readProjectFile(files.databaseFormula);
  const databaseRollup = readProjectFile(files.databaseRollup);
  const databaseMultiSelect = readProjectFile(files.databaseMultiSelect);
  const databaseNumberValues = readProjectFile(files.databaseNumberValues);
  const databaseSystemFields = readProjectFile(files.databaseSystemFields);
  const inlineDatabaseNode = readProjectFile(files.inlineDatabaseNode);
  const slashCommandSuggestion = readProjectFile(files.slashCommandSuggestion);
  const tableView = readProjectFile(files.tableView);
  const listView = readProjectFile(files.listView);
  const kanbanView = readProjectFile(files.kanbanView);
  const calendarView = readProjectFile(files.calendarView);
  const galleryView = readProjectFile(files.galleryView);
  const formView = readProjectFile(files.formView);
  const chartView = readProjectFile(files.chartView);
  const timelineView = readProjectFile(files.timelineView);
  const feedView = readProjectFile(files.feedView);
  const moduleActions = readProjectFile(files.moduleActions);
  const registry = readProjectFile(files.registry);
  const filePreviewNode = readProjectFile(files.filePreviewNode);
  const spreadsheet = readProjectFile(files.spreadsheet);
  const companyResearchShell = readProjectFile(files.companyResearchShell);
  const meetingsShell = readProjectFile(files.meetingsShell);
  const portfolioShell = readProjectFile(files.portfolioShell);
  const projectsShell = readProjectFile(files.projectsShell);
  const reportsShell = readProjectFile(files.reportsShell);
  const researchConnectionsPanel = readProjectFile(
    files.researchConnectionsPanel
  );
  const researchGraphShell = readProjectFile(files.researchGraphShell);
  const moduleDashboard = readProjectFile(files.moduleDashboard);
  const relationEditor = readProjectFile(files.relationEditor);
  const display = readProjectFile(files.display);
  const types = readProjectFile(files.types);

  assertIncludes(
    files.packageJson,
    packageJson,
    '"xlsx"',
    "Excel import/export requires the xlsx dependency."
  );
  for (const snippet of [
    "getAccountConfig()",
    "readSessionToken(request)",
    "getSessionAccount(config, token)",
    'body.action === "changes-since"',
    'body.action === "database-metadata"',
    'body.action === "database-records"',
    'body.action === "push"',
    'body.action === "pull"',
    "databaseId",
    "nextOffset",
    "hasMore",
    "CHANGE_LOG_LIMIT",
    "MAX_PAYLOAD_BYTES",
    "MAX_PUSH_RECORDS",
    "MAX_RECORD_BYTES",
    "existing && existing.u >= record.updated_at",
    "zhinotes:dbsync:index:",
    "zhinotes:dbsync:record:",
    "zhinotes:dbsync:changes:",
    "field_values",
  ]) {
    assertIncludes(
      files.databaseAccountSyncRoute,
      databaseAccountSyncRoute,
      snippet,
      "Database cloud sync must be session-gated, incremental, bounded, and stale-write safe."
    );
  }
  if (databaseAccountSyncRoute.includes("console.")) {
    failures.push("database account-sync route must not write logs");
  }
  if (
    databaseAccountSyncRoute.includes("content_text") ||
    databaseAccountSyncRoute.includes("content_yjs") ||
    databaseAccountSyncRoute.includes("file_bytes")
  ) {
    failures.push(
      "database account-sync route must not sync page bodies or file bytes"
    );
  }
  for (const snippet of [
    'const ENABLED_KEY = "zhinote.databasesync.enabled"',
    'readSyncStorage(ENABLED_KEY) !== "false"',
    "checkAccountCloudSyncGate",
    'accountGate.status === "unconfigured"',
    'accountGate.status === "signed-out"',
    "setDatabaseSyncEnabled",
    "DATABASE_SYNC_CONFIG_EVENT",
    'fetch("/api/databases/account-sync"',
    "fetchCloudDatabaseChangesSince",
    "fetchCloudDatabaseMetadata",
    "fetchCloudDatabaseRecordsByDatabaseId",
    "syncCloudDatabaseMetadata",
    "syncCloudDatabaseMetadataDelta",
    "CloudDatabaseMetadataDeltaResult",
    "QUICK_INCREMENTAL_BATCH_LIMIT",
    "METADATA_DELTA_THROTTLE_MS",
    "databaseMetadataDeltaInFlight",
    "lastDatabaseMetadataDeltaResult",
    "runCloudDatabaseMetadataDelta",
    "maxBatches?: number",
    "batches < maxBatches",
    "maxBatches: QUICK_INCREMENTAL_BATCH_LIMIT",
    "fullRefresh: false",
    "fullRefresh: true",
    "cloudDatabaseMetadataToDatabases",
    "syncCloudDatabaseById",
    "SyncCloudDatabaseByIdOptions",
    "startOffset?: number",
    "collectRecords?: boolean",
    "options.collectRecords !== false",
    "options.startOffset ?? 0",
    "cacheWriteFailed?: boolean",
    "nextOffset: number | null",
    "hasMore: boolean",
    "pushCloudDatabaseRecords",
    "fetchCloudDatabaseRecordsByKeys",
    "rebuildDatabaseCacheFromCloud",
    "reconcileDatabaseSync",
    "DatabaseReconcileOptions",
    "let cursor = getRemoteCursor()",
    "if (!cursor)",
    "cursor = getRemoteCursor()",
    "getLocalDatabaseSyncSummary",
    "restoreCursorFromLocalDatabaseMetadata",
    "fastForwardDatabaseMetadataDeltaFromLocalCursor",
    "compareDatabaseChangeCursorStrings",
    "parseDatabaseChangeCursorString",
    "fetchCloudDatabaseChangesSince(nextCursor)",
    "localSummary.watermark !== remoteSummary.watermark",
    "localSummary.cursor !== remoteSummary.cursor",
    "const metadata = await syncCloudDatabaseMetadata()",
    "applyRemoteDatabaseRecords",
    'emitDatabasesUpdated("cloud-pull", pulled || prune.cleared)',
    "clearLocalDatabaseCacheExceptKeys",
    "clearAllPendingCloudDatabasePushesForCacheRebuild",
    "clearDatabaseSyncRuntimeCachesForCacheRebuild",
    "queuedCloudDatabasePush = new Map()",
    "setPendingCloudDatabasePushKeys([])",
    "databaseMetadataDeltaGeneration += 1",
    "lastDatabaseMetadataDeltaResult = null",
    "generation === databaseMetadataDeltaGeneration",
    "getDatabaseRecordsForSyncByKeys",
    "getPendingDatabaseSyncRecords",
    "getRemoteDatabaseRecordKey",
    "markDatabaseSyncLogEntriesSynced",
    "PENDING_PUSH_KEYS_KEY",
    "memoryDatabaseRemoteCursor",
    "memoryLastDatabaseSyncAt",
    "force?: boolean",
    "fullRefresh?: boolean",
    "requireLocalCacheCoverage?: boolean",
    "options.requireLocalCacheCoverage",
    ": getRemoteCursor()",
    "AUTH_RETRY_BACKOFF_MS",
    'AUTH_RETRY_KEY = "zhinote.databasesync.authRetry.v1"',
    "shouldBackOffAuthRetry",
    "rememberAuthRetryStatus",
    "readStoredAuthRetryStatus",
    "getAuthRetrySnapshot",
    "authRetryStatus: authRetry.status",
    "authRetryUntil: authRetry.until",
    "JSON.stringify({ status, until: authRetryAfter })",
    "removeSyncStorage(AUTH_RETRY_KEY)",
    "readSyncStorage",
    "writeSyncStorage",
    "readSyncStorage(REMOTE_CURSOR_KEY) ?? memoryDatabaseRemoteCursor",
	    "clearPendingCloudDatabasePushKeys",
	    "queueCloudDatabaseRecords",
	    "queueCloudDatabaseRecordsForKeys",
	    "flushPendingCloudDatabasePushes",
	    "FlushPendingCloudDatabasePushOptions",
	    "const retryableKeys = options.includeManualReview",
	    "PENDING_CLOUD_DATABASE_MANUAL_REVIEW_FAILURE_COUNT",
	    "pushPendingLocalDatabaseChangesToCloud",
    "safeNextOffset <= offset",
    "changes.cursor === cursor",
    "cacheWriteFailed",
    "records?: CloudDatabaseRecord[]",
    "toDatabaseUpdatePayloads",
    "pulledDatabaseRecords",
  ]) {
    assertIncludes(
      files.databaseAccountSyncClient,
      databaseAccountSyncClient,
      snippet,
      "Database cloud sync client must stay default-on, incremental, and support both full paged drains and bounded first-batch detail hydration."
    );
  }
  assertNotIncludes(
    files.databaseAccountSyncClient,
    databaseAccountSyncClient,
    "pushLocalDatabasesToCloud",
    "Database sync must treat cloud as source of truth; ordinary account sync can only upload explicit pending local changes."
  );
  assertNotIncludes(
    files.databaseAccountSyncClient,
    databaseAccountSyncClient,
    "getAllDatabaseRecordsForSync",
    "Database sync client must not scan and upload the full local cache."
  );
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
  for (const snippet of [
    "DatabaseBodySkeleton",
    "本地热缓存会先加载",
    "云端索引在后台继续",
    "aria-live",
    "grid-cols-[1.4fr_1fr_1fr_1fr]",
  ]) {
    assertIncludes(
      files.databaseRouteSkeleton,
      databaseRouteSkeleton,
      snippet,
      "Database loading shell must communicate hot-cache-first hydration and resemble a database table."
    );
  }
  if (
    databaseAccountSyncClient.indexOf(
      "clearAllPendingCloudDatabasePushesForCacheRebuild()"
    ) >
    databaseAccountSyncClient.indexOf(
      "const prune = await clearLocalDatabaseCacheExceptKeys(keys)"
    )
  ) {
    failures.push(
      "Database cache rebuild must cancel local pending upload queues before pruning local cache."
    );
  }
  if (
    databaseAccountSyncClient.indexOf(
      "clearDatabaseSyncRuntimeCachesForCacheRebuild()"
    ) >
    databaseAccountSyncClient.indexOf(
      "const prune = await clearLocalDatabaseCacheExceptKeys(keys)"
    )
  ) {
    failures.push(
      "Database cache rebuild must clear short-lived metadata snapshots before pruning local cache."
    );
  }
  const reconcileDatabaseBody = databaseAccountSyncClient.slice(
    databaseAccountSyncClient.indexOf(
      "export async function reconcileDatabaseSync"
    ),
    databaseAccountSyncClient.indexOf(
      "export async function rebuildDatabaseCacheFromCloud"
    )
  );
  if (
    !reconcileDatabaseBody.includes("let cursor = getRemoteCursor()") ||
    !reconcileDatabaseBody.includes("if (!cursor)") ||
    !reconcileDatabaseBody.includes('call({ action: "summary" })') ||
    !reconcileDatabaseBody.includes(
      "restoreCursorFromLocalDatabaseMetadata(summary)"
    ) ||
    !reconcileDatabaseBody.includes(
      "fastForwardDatabaseMetadataDeltaFromLocalCursor(summary)"
    ) ||
    !reconcileDatabaseBody.includes("cursor = getRemoteCursor()") ||
    !reconcileDatabaseBody.includes(
      "const metadata = await syncCloudDatabaseMetadata()"
    ) ||
    reconcileDatabaseBody.indexOf(
      "restoreCursorFromLocalDatabaseMetadata(summary)"
    ) > reconcileDatabaseBody.indexOf(
      "const metadata = await syncCloudDatabaseMetadata()"
    ) ||
    reconcileDatabaseBody.indexOf(
      "fastForwardDatabaseMetadataDeltaFromLocalCursor(summary)"
    ) > reconcileDatabaseBody.indexOf(
      "const metadata = await syncCloudDatabaseMetadata()"
    ) ||
    reconcileDatabaseBody.indexOf("if (!cursor)") >
      reconcileDatabaseBody.indexOf("const pull = await syncCloudDatabaseDelta")
  ) {
    failures.push(
      "Database reconcile must restore or fast-forward a missing cursor from local metadata before falling back to metadata pull or incremental delta."
    );
  }
  const syncDatabaseMetadataBody = databaseAccountSyncClient.slice(
    databaseAccountSyncClient.indexOf(
      "export async function syncCloudDatabaseMetadata"
    ),
    databaseAccountSyncClient.indexOf(
      "export function cloudDatabaseMetadataToDatabases"
    )
  );
  if (
    !syncDatabaseMetadataBody.includes("SyncCloudDatabaseMetadataOptions") ||
    !syncDatabaseMetadataBody.includes("options.restoreLocalCursor") ||
    !syncDatabaseMetadataBody.includes('call({ action: "summary" })') ||
    !syncDatabaseMetadataBody.includes(
      "restoreCursorFromLocalDatabaseMetadata(summary)"
    ) ||
    !syncDatabaseMetadataBody.includes(
      "fastForwardDatabaseMetadataDeltaFromLocalCursor(summary)"
    ) ||
    syncDatabaseMetadataBody.indexOf(
      "restoreCursorFromLocalDatabaseMetadata(summary)"
    ) > syncDatabaseMetadataBody.indexOf("fetchCloudDatabaseMetadata()")
  ) {
    failures.push(
      "Database metadata prewarm should restore or fast-forward a missing localStorage cursor from local metadata before falling back to full cloud metadata."
    );
  }
  for (const snippet of [
    "syncCloudDatabaseById",
    "syncCloudDatabaseById(databaseId, { maxBatches: 1 })",
    "startOffset: cloud.nextOffset",
    "collectRecords: false",
    "initialCloudHydrateRef",
    "cloudFallbackSnapshotRef",
    "ReloadDatabaseOptions",
    "readLocalDatabaseSafe",
    "DATABASE_FIRST_PAINT_ROW_LIMIT",
    "DATABASE_BACKGROUND_ROW_HYDRATION_BATCH",
    "limit: readOptions.rowLimit",
    "offset: readOptions.rowOffset",
    "localSnapshotNeedsFullHydration",
    "hydrateLocalRowsInBatches",
    "refreshLocalPreviewAfterBackground",
    "setRows((current) => upsertLocalRows(current, batchRows))",
    "reloadRequestRef",
    "DATABASE_RELATION_METADATA_FIRST_PAINT_LIMIT",
    "collectDatabaseRelationPageIds",
    "loadDatabaseRelationPages",
    "listPageMetadataByIds",
    "loadExportRelationPages",
    "cloud.status === \"ok\" && cloud.records.length > 0",
    "cloud.cacheWriteFailed",
    "applyDatabaseSnapshot(cloudSnapshot)",
    "readLocalDatabaseSafe({\n          rowLimit: DATABASE_FIRST_PAINT_ROW_LIMIT,",
    "buildDatabaseSnapshotFromCloudRecords(",
    "reload({ preferLocalCache: true })",
    "setCacheNotice",
    "useLocalFirstDatabaseNavigation",
    "const openDatabase = useLocalFirstDatabaseNavigation();",
    "openDatabase(databaseId);",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "DatabaseShell must open databases from the cloud record set first, keep local SQLite as an editable/cache fallback, and avoid reapplying stale cloud snapshots after local edits."
    );
  }
  const collectDatabaseRelationPageIdsBody = databaseShell.slice(
    databaseShell.indexOf("function collectDatabaseRelationPageIds"),
    databaseShell.indexOf("async function loadDatabaseRelationPages")
  );
  for (const snippet of ["row.page_id", "row.page?.id"]) {
    assertNotIncludes(
      "collectDatabaseRelationPageIds",
      collectDatabaseRelationPageIdsBody,
      snippet,
      "Database relation metadata hydration must collect only true relation targets; row pages are already included in the row snapshot."
    );
  }
  for (const snippet of [
    "limit?: number;",
    "offset?: number;",
    "normalizeDatabaseRowQueryLimit",
    "ORDER BY dr.position ASC${limitClause}",
    "export async function listPageMetadataByIds",
  ]) {
    assertIncludes(
      files.queries,
      queries,
      snippet,
      "Local database row reads must support bounded first-paint queries before full background hydration."
    );
  }
  assertNotIncludes(
    files.databaseShell,
    databaseShell,
    'from "@/hooks/usePages"',
    "DatabaseShell must not import usePages because database routes should load relation metadata by referenced page id instead of triggering a global page scan."
  );
  assertNotIncludes(
    files.databaseShell,
    databaseShell,
    "usePages()",
    "DatabaseShell must not call usePages because database routes should load relation metadata by referenced page id instead of triggering a global page scan."
  );
  assertNotIncludes(
    files.databaseShell,
    databaseShell,
    "router.push(`/database/${databaseId}`)",
    "DatabaseShell must not hard-navigate database routes because that bypasses shared local-first database warming and prefetch."
  );
  assertNotIncludes(
    files.databaseShell,
    databaseShell,
    "usePages({",
    "DatabaseShell must not call usePages because database routes should load relation metadata by referenced page id instead of triggering a global page scan."
  );
  for (const snippet of [
    "createDatabaseWithCloud",
    "updateDatabaseWithCloud",
    "deleteDatabaseWithCloud",
    "addFieldWithCloud",
    "updateFieldWithCloud",
    "deleteFieldWithCloud",
    "addRowWithCloud",
    "updateRowWithCloud",
    "deleteRowWithCloud",
    "addViewWithCloud",
    "updateViewWithCloud",
    "deleteViewWithCloud",
    "queueCloudDatabaseRecords",
    "queueCloudDatabaseRecordsForKeys",
    "queueCloudPagePush",
    "queueDatabasePageCloudPush",
    'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")',
    "emitDatabasesUpdated",
  ]) {
    assertIncludes(
      files.databaseCloudMutations,
      databaseCloudMutations,
      snippet,
      "Database local mutations must immediately queue cloud writes and notify active UI."
    );
  }
  assertNotIncludes(
    files.databaseCloudMutations,
    databaseCloudMutations,
    'from "@/lib/pages/accountPageSync"',
    "Database local mutations must lazy-load page account sync helpers so database entry points stay lightweight."
  );
  for (const snippet of [
    "getAllDatabases",
    "syncCloudDatabaseMetadataDelta",
    "loadDatabaseSnapshot",
    "databaseSnapshotInFlight",
    "setDatabases(all)",
    "Treat local SQLite as a cache",
    "Cloud metadata refresh is best effort",
    "mergeDatabaseMetadata(all, cloudRecords)",
    "mergeDatabaseMetadata(current, message.records ?? [])",
    "message.records?.length",
    "subscribeDatabasesUpdated",
    "emitDatabasesUpdated",
    "restoreLocalCursor: true",
    "force: true",
    "const needsCloudCoverageRecovery =",
    "requireLocalCacheCoverage: false",
    "requireLocalCacheCoverage: true",
  ]) {
    assertIncludes(
      files.useDatabases,
      useDatabases,
      snippet,
      "Database list UI must use cloud metadata delta first, then treat local SQLite as a rebuildable cache fallback."
    );
  }
  if (
    useDatabases.includes(
      "fullRefresh: all.length === 0 || !localSnapshotLoaded"
    )
  ) {
    failures.push(
      "Database list UI must not force full cloud metadata merely because the rebuildable local cache is empty or temporarily unavailable."
    );
  }
  const primaryDatabaseListSurfaces = [
    [files.sidebar, sidebar],
    [files.quickSearch, quickSearch],
    [files.companyResearchShell, companyResearchShell],
    [files.meetingsShell, meetingsShell],
    [files.portfolioShell, portfolioShell],
    [files.projectsShell, projectsShell],
    [files.reportsShell, reportsShell],
    [files.researchGraphShell, researchGraphShell],
  ];

  for (const [sourceLabel, source] of primaryDatabaseListSurfaces) {
    assertIncludes(
      sourceLabel,
      source,
      "useDatabases",
      "Primary database list surfaces must use cloud metadata prewarm instead of only local reads."
    );
  }
  for (const [sourceLabel, source] of primaryDatabaseListSurfaces.filter(
    ([sourceLabel]) => ![files.sidebar, files.quickSearch].includes(sourceLabel)
  )) {
    if (source.includes("getAllDatabases")) {
      failures.push(
        `${sourceLabel} should use useDatabases instead of direct getAllDatabases local-only reads.`
      );
    }
  }
  for (const snippet of [
    "countActiveDatabases",
    "refreshWorkspaceCounts",
    "subscribeDatabasesUpdated",
    "scheduleCountRefresh",
    "setDatabaseCount((count) => count + 1)",
  ]) {
    assertIncludes(
      files.moduleDashboard,
      moduleDashboard,
      snippet,
      "Module center should keep first paint lightweight with database counts instead of loading database lists."
    );
  }
  assertNotIncludes(
    files.moduleDashboard,
    moduleDashboard,
    'from "@/hooks/useDatabases"',
    "Module center must not auto-load database lists just to render counts or create starters."
  );
  assertIncludes(
    files.moduleDashboard,
    moduleDashboard,
    'import("@/lib/database/cloudDatabaseMutations")',
    "Module center must lazy-load database creation code only after create-database intent."
  );
  assertNotIncludes(
    files.moduleDashboard,
    moduleDashboard,
    'from "@/lib/database/cloudDatabaseMutations"',
    "Module center must keep database creation code out of the first paint bundle."
  );
  assertNotIncludes(
    files.moduleDashboard,
    moduleDashboard,
    'from "@/lib/modules/actions"',
    "Module center must keep starter database mutation actions out of the first paint bundle."
  );
  assertNotIncludes(
    files.moduleDashboard,
    moduleDashboard,
    "await refreshDatabases()",
    "Module center must not block starter flows on full database list refreshes."
  );
	  for (const snippet of [
	    "syncCloudDatabaseMetadataDelta",
	    "cloudDatabaseMetadataToDatabases",
	    "subscribeDatabasesUpdated",
	    "const localSnapshots = await loadDatabaseListSnapshots()",
	    "hydrateDatabaseModuleSnapshotDetails",
	    "DATABASE_MODULE_DETAIL_BATCH_SIZE",
	    "DATABASE_MODULE_DETAIL_IDLE_TIMEOUT",
	    "scheduleDatabaseModuleIdleTask",
	    "dashboardLoadRequestRef",
	    "mergeDatabaseModuleSnapshots",
	    "cloud.records.length",
	    "!cloud.cacheWriteFailed",
	    "本机缓存暂时不可写",
	    "restoreLocalCursor: localSnapshots.length > 0",
	    'import("@/lib/database/cloudDatabaseMutations")',
	    'import("@/lib/modules/actions")',
	  ]) {
	    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
	      "Database module dashboard must prewarm cloud database metadata and reload on database update broadcasts."
	    );
	  }
	  assertNotIncludes(
	    files.databaseModuleShell,
	    databaseModuleShell,
	    "const localSnapshots = await loadSnapshots()",
	    "Database module dashboard must first paint from the database list and hydrate fields, views, and row counts in idle batches."
	  );
	  for (const snippet of [
	    'from "@/lib/database/cloudDatabaseMutations"',
	    'from "@/lib/modules/actions"',
	  ]) {
	    assertNotIncludes(
	      files.databaseModuleShell,
	      databaseModuleShell,
	      snippet,
	      "Database module creation and starter code must stay out of first paint and load only after user intent."
	    );
	  }
	  for (const [sourceLabel, source] of [
    [files.databaseShell, databaseShell],
    [files.inlineDatabaseNode, inlineDatabaseNode],
    [files.spreadsheet, spreadsheet],
    [files.databaseImport, databaseImport],
    [files.moduleActions, moduleActions],
    [files.sidebar, sidebar],
    [files.quickSearch, quickSearch],
    [files.slashCommandSuggestion, slashCommandSuggestion],
    [files.databaseModuleShell, databaseModuleShell],
    [files.moduleDashboard, moduleDashboard],
    [files.companyResearchShell, companyResearchShell],
    [files.meetingsShell, meetingsShell],
    [files.portfolioShell, portfolioShell],
    [files.projectsShell, projectsShell],
    [files.reportsShell, reportsShell],
    [files.researchGraphShell, researchGraphShell],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "@/lib/database/cloudDatabaseMutations",
      "Database writes must go through cloud-aware mutation wrappers."
    );
    assertNoLocalDatabaseMutationImport(sourceLabel, source);
  }
  for (const snippet of [
    'const loadDatabaseMutationModule = () =>',
    'import("@/lib/database/cloudDatabaseMutations")',
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database blocks must lazy-load database mutation code only after inline edit intent."
    );
  }
  assertNotIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    'from "@/lib/database/cloudDatabaseMutations"',
    "Inline database blocks must keep database mutation code out of the editor first paint bundle."
  );
  for (const snippet of [
    "useLocalFirstDatabaseNavigation",
    "const openDatabase = useLocalFirstDatabaseNavigation();",
    "openDatabase(databaseId)",
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database full-page opens must use shared local-first database navigation."
    );
  }
  assertNotIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "router.push(`/database",
    "Inline database full-page opens must not direct hard route to database pages."
  );
  for (const snippet of [
    "useLocalFirstDatabaseNavigation",
    "const openDatabase = useLocalFirstDatabaseNavigation();",
    "openDatabase(importResult.database_id)",
  ]) {
    assertIncludes(
      files.filePreviewNode,
      filePreviewNode,
      snippet,
      "Spreadsheet-to-database imports must open the new database through shared local-first navigation."
    );
  }
  assertNotIncludes(
    files.filePreviewNode,
    filePreviewNode,
    "router.push(`/database",
    "Spreadsheet-to-database imports must not direct hard route to database pages."
  );
  for (const snippet of [
    "buildLocalFirstDatabaseHref",
    "parseLocalFirstDatabaseRoute",
    "normalizeSearch",
    "normalizeHash",
  ]) {
    assertIncludes(
      files.localFirstDatabaseNavigationUtil,
      localFirstDatabaseNavigationUtil,
      snippet,
      "Shared database navigation must preserve query/hash context for local-first database route opens."
    );
  }
  assertIncludes(
    files.localFirstDatabaseNavigation,
    localFirstDatabaseNavigation,
    "buildLocalFirstDatabaseHref(databaseId, options)",
    "Database navigation hook must prefetch and navigate the full local-first database href, including query context."
  );
  for (const [sourceLabel, source, snippets] of [
    [
      files.companyResearchShell,
      companyResearchShell,
      [
        "useLocalFirstDatabaseNavigation",
        "const openDatabase = useLocalFirstDatabaseNavigation();",
        "openDatabase(tracker.id,",
        "openDatabase(database.id)",
      ],
    ],
    [
      files.meetingsShell,
      meetingsShell,
      [
        "useLocalFirstDatabaseNavigation",
        "const openDatabase = useLocalFirstDatabaseNavigation();",
        "openDatabase(tracker.id,",
        "openDatabase(database.id)",
      ],
    ],
    [
      files.reportsShell,
      reportsShell,
      [
        "useLocalFirstDatabaseNavigation",
        "const openDatabase = useLocalFirstDatabaseNavigation();",
        "openDatabase(tracker.id,",
        "openDatabase(database.id)",
      ],
    ],
    [
      files.portfolioShell,
      portfolioShell,
      [
        "useLocalFirstDatabaseNavigation",
        "const openDatabase = useLocalFirstDatabaseNavigation();",
        "openDatabase(tracker.id,",
        "openDatabase(database.id)",
      ],
    ],
    [
      files.projectsShell,
      projectsShell,
      [
        "useLocalFirstDatabaseNavigation",
        "const openDatabase = useLocalFirstDatabaseNavigation();",
        "openDatabase(tracker.id,",
        "openDatabase(databaseId)",
      ],
    ],
    [
      files.researchConnectionsPanel,
      researchConnectionsPanel,
      [
        "useLocalFirstDatabaseNavigation",
        "parseLocalFirstDatabaseRoute",
        "openRoute(buildDatabaseRoute(target.databaseId, asset))",
      ],
    ],
    [
      files.researchGraphShell,
      researchGraphShell,
      [
        "useLocalFirstDatabaseNavigation",
        "parseLocalFirstDatabaseRoute",
        "onOpenDatabaseRoute={openRoute}",
        "openDatabase(databaseId)",
      ],
    ],
  ]) {
    for (const snippet of snippets) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Investment research database opens must use shared local-first database navigation and keep handoff query context."
      );
    }
  }
  for (const [sourceLabel, source] of [
    [files.companyResearchShell, companyResearchShell],
    [files.meetingsShell, meetingsShell],
    [files.reportsShell, reportsShell],
    [files.portfolioShell, portfolioShell],
    [files.projectsShell, projectsShell],
    [files.researchConnectionsPanel, researchConnectionsPanel],
    [files.researchGraphShell, researchGraphShell],
  ]) {
    assertNotIncludes(
      sourceLabel,
      source,
      "router.push(`/database",
      "Investment research database opens must not direct hard route to database pages."
    );
    assertNotIncludes(
      sourceLabel,
      source,
      "router.push(buildDatabaseRoute",
      "Investment research graph handoffs must route through local-first database navigation."
    );
  }
  assertIncludes(
    files.slashCommandSuggestion,
    slashCommandSuggestion,
    "openLocalFirstDatabaseRoute(db.id)",
    "Slash-created full-page databases must route through shared local-first database navigation."
  );
  assertNotIncludes(
    files.slashCommandSuggestion,
    slashCommandSuggestion,
    "window.location.href = `/database",
    "Slash-created full-page databases must not direct hard reload the browser."
  );
  for (const snippet of [
    'const loadDatabaseMutationModule = () =>',
    'import("@/lib/database/cloudDatabaseMutations")',
    'const loadAccountDatabaseSyncModule = () =>',
    'import("@/lib/database/accountDatabaseSync")',
    'const loadDatabaseImportModule = () =>',
    'import("@/lib/database/databaseImport")',
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database detail page must lazy-load cloud/database import runtime code after local first paint."
    );
  }
  for (const snippet of [
    'from "@/lib/database/cloudDatabaseMutations"',
    "import {\n  syncCloudDatabaseById",
    "applyDatabaseImportPreview,\n  buildDatabaseImportPreview",
  ]) {
    assertNotIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database detail page must keep runtime mutation, sync, and import engines out of the first paint bundle."
    );
  }
  for (const snippet of [
    'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
    'const loadDatabaseMutationModule = () =>',
    'import("@/lib/database/cloudDatabaseMutations")',
  ]) {
    assertIncludes(
      files.slashCommandSuggestion,
      slashCommandSuggestion,
      snippet,
      "Editor slash commands must lazy-load page/database mutation code only after command intent."
    );
  }
  for (const snippet of [
    'from "@/lib/pages/cloudPageMutations"',
    'from "@/lib/database/cloudDatabaseMutations"',
  ]) {
    assertNotIncludes(
      files.slashCommandSuggestion,
      slashCommandSuggestion,
      snippet,
      "Editor slash commands must not put page/database mutation code in the editor first paint bundle."
    );
  }
  for (const snippet of [
    "getAllDatabaseRecordsForSync",
    "applyRemoteDatabaseRecords",
    "clearLocalDatabaseCacheExceptKeys",
    "sync_version = -1",
    "sync_version = 1",
    "database_rows",
    "database_fields",
    "database_views",
    "ensureDatabaseRowPage",
    "parseRemoteDatabaseRecordKey",
    "queryDatabaseRowsByIds",
    "WHERE id IN",
    "getPendingDatabaseSyncRecords",
    "getLocalDatabaseSyncSummary",
    "markDatabaseSyncLogEntriesSynced",
    "table_name IN ('databases', 'database_fields', 'database_rows', 'database_views')",
  ]) {
    assertIncludes(
      files.queries,
      queries,
      snippet,
      "Local database cache must be exportable, rebuildable from cloud records, and safe for row page placeholders."
    );
  }
  const localDatabaseSyncSummaryBody = queries.slice(
    queries.indexOf("export async function getLocalDatabaseSyncSummary"),
    queries.indexOf("function isRemoteDatabaseRecordType")
  );
  for (const snippet of [
    "UNION ALL",
    "WHERE sync_version != -1",
    "JSON.stringify({ updatedAt: maxUpdatedAt, key: maxUpdatedKey })",
  ]) {
    assertIncludes(
      files.queries,
      localDatabaseSyncSummaryBody,
      snippet,
      "Local database sync summary must be metadata-only and cursor-compatible."
    );
  }
  for (const forbiddenPayload of ["field_values", "config", "description"]) {
    if (localDatabaseSyncSummaryBody.includes(forbiddenPayload)) {
      failures.push(
        "Local database sync summary must not read payload fields such as field_values/config/description."
      );
    }
  }
  const getDatabaseRecordsForSyncByKeysBody = queries.slice(
    queries.indexOf("export async function getDatabaseRecordsForSyncByKeys"),
    queries.indexOf("export async function getPendingDatabaseSyncRecords")
  );
  if (
    getDatabaseRecordsForSyncByKeysBody.includes(
      "getAllDatabaseRecordsForSync()"
    )
  ) {
    failures.push(
      "Pending database upload must fetch queued records by key instead of scanning the full local cache."
    );
  }
  for (const snippet of [
    "数据库云同步",
    "默认开启",
    "handleDatabaseSyncToggle",
    "setDatabaseSyncEnabled",
    "window.confirm",
    "上传待同步变更",
    "重建本机数据库缓存",
    "数据库会按账号云端主库同步",
  ]) {
    assertIncludes(
      files.accountShell,
      accountShell,
      snippet,
      "Account settings must expose database sync as default-on with a visible owner opt-out."
    );
  }
  for (const snippet of [
    "useDatabaseCloudSync",
    "checkAccountCloudSyncGate",
    "gateAccountSync",
    "const accountReady = await gateAccountSync(Boolean(options.forceLease))",
    "SYNC_INTERVAL_MS",
    "INITIAL_SYNC_DELAY_MS",
    "EDIT_DEBOUNCE_MS",
    "PENDING_STATUS_SYNC_DELAY_MS",
    "DATABASE_PENDING_STORAGE_KEYS",
    "initialSyncTimer",
    "quickSyncTimer",
    "scheduleQuickSync",
    "window.clearTimeout(initialSyncTimer)",
    "window.clearTimeout(quickSyncTimer)",
    "LEASE_KEY",
    "claimSyncLease",
    "reconcileDatabaseSync",
    "quick?: boolean",
    "includeManualReview: options.includeManualReview",
    "runSync({ quick: true })",
    "rerunAfterCurrentSyncRef",
    "if (runningRef.current)",
    "rerunAfterCurrentSyncRef.current = {",
    "window.setTimeout(() => {\n            void runSync({",
    "DATABASE_SYNC_CONFIG_EVENT",
    "DATABASE_SYNC_STATUS_EVENT",
    "scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS)",
    "detail.pending + detail.queued + detail.syncLogPending",
    'DATABASE_PENDING_STORAGE_KEYS.has(event.key ?? "")',
    "AUTH_RETRY_BACKOFF_MS",
    "authRetryAfterRef",
    "emitDatabasesUpdated",
    "result.records",
    "LOCAL_CACHE_RECOVERY_EVENT",
    "LOCAL_CACHE_RECOVERY_SIGNAL_KEY",
    "getLocalCacheRecoverySignal",
    "recoverLocalCacheFromCloud",
    "seenLocalCacheRecoverySignalRef",
    "syncCloudDatabaseMetadataDelta({",
    "fullRefresh: true",
    "window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT",
    "handleLocalCacheRecoveryStorage",
    "event.key === LOCAL_CACHE_RECOVERY_SIGNAL_KEY",
    'window.addEventListener("storage", handleLocalCacheRecoveryStorage)',
    'window.removeEventListener("storage", handleLocalCacheRecoveryStorage)',
    "void recoverLocalCacheFromCloud()",
    "DATABASE_LOCAL_UPDATE_EVENT",
    "window.addEventListener(\n      DATABASE_LOCAL_UPDATE_EVENT",
    'message?.reason !== "local-refresh"',
    'document.visibilityState === "visible"',
    "Lease storage is only a cost-control optimization",
  ]) {
    assertIncludes(
      files.databaseCloudSyncHook,
      databaseCloudSyncHook,
      snippet,
      "Database cloud sync hook must poll cheaply, avoid duplicate tab leaders, and broadcast cloud pulls."
    );
  }
  for (const snippet of [
    "fetchAccountSession",
    "account-unconfigured",
    "reads_database_row_values: false",
    "uploads_workspace_data: false",
    "mutates_workspace_data: false",
  ]) {
    assertIncludes(
      files.accountCloudSyncGate,
      accountCloudSyncGate,
      snippet,
      "Account cloud sync gate must avoid domain sync route probes and never inspect database row values."
    );
  }
  for (const snippet of [
    "BroadcastChannel",
    "DATABASE_LOCAL_UPDATE_EVENT",
    "window.dispatchEvent",
    "new CustomEvent<DatabaseUpdateMessage>(DATABASE_LOCAL_UPDATE_EVENT",
    "emitDatabasesUpdated",
    "subscribeDatabasesUpdated",
    "DatabaseUpdatePayload",
    "records?: DatabaseUpdatePayload[]",
    "zhinote.databases.updated.broadcast.v1",
  ]) {
    assertIncludes(
      files.databaseUpdateBus,
      databaseUpdateBus,
      snippet,
      "Database update bus must notify active UI after cloud pulls."
    );
  }
  for (const snippet of [
    "useAccountCloudSyncCoordinator",
    "useDatabases",
    "databaseSync.state",
    "数据库已同步",
  ]) {
    assertIncludes(
      files.sidebar,
      sidebar,
      snippet,
      "Sidebar must mount database background sync and refresh local database lists after cloud pulls."
    );
  }
  for (const snippet of [
    "subscribeDatabasesUpdated",
    "scheduleDatabaseForegroundAwareRefresh",
    "window.setTimeout(runWhenQuiet, foregroundDelay)",
    "cancelReload = scheduleDatabaseForegroundAwareRefresh(() => {",
    "void reload({ preferLocalCache: true })",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Open database pages must reload cloud database changes without interrupting foreground row edits."
    );
  }
  for (const snippet of [
    '{ value: "email", label: "邮箱" }',
    '{ value: "phone", label: "电话" }',
    '{ value: "formula", label: "公式" }',
    '{ value: "rollup", label: "汇总" }',
    '{ value: "button", label: "按钮草案" }',
    '{ value: "multi_select", label: "多选" }',
    "DATABASE_CREATED_TIME_FIELD",
    "DATABASE_LAST_EDITED_TIME_FIELD",
    "DATABASE_UNIQUE_ID_FIELD",
    "DATABASE_NUMBER_FORMATS",
    "DATABASE_ROLLUP_AGGREGATIONS",
    "getDatabaseNumberFormat",
    "getDatabaseFormulaExpression",
    "getDatabaseRollupConfig",
    "getDatabaseButtonConfig",
    "getDatabaseFieldDescription",
    'fieldType === "multi_select"',
    'fieldType === "number"',
    'fieldType === "formula"',
    'fieldType === "rollup"',
    'fieldType === "button"',
  ]) {
    assertIncludes(
      files.databaseFields,
      databaseFields,
      snippet,
      "Database field picker must expose common Notion-like email, phone, and multi-select fields."
    );
  }
  for (const snippet of [
    'email: "邮箱"',
    'phone: "电话"',
    'formula: "公式"',
    'rollup: "汇总"',
    'button: "按钮草案"',
    'multi_select: "多选"',
    'created_time: "创建时间"',
    'last_edited_time: "最后编辑时间"',
    'unique_id: "唯一 ID"',
  ]) {
    assertIncludes(
      files.display,
      display,
      snippet,
      "Database field display labels must include email, phone, multi-select, and system time fields."
    );
  }
  for (const snippet of [
    "DATABASE_CREATED_TIME_FIELD",
    "DATABASE_LAST_EDITED_TIME_FIELD",
    "DATABASE_UNIQUE_ID_FIELD",
    "isDatabaseSystemFieldType",
    "isDatabaseSystemTimeFieldType",
    "isDatabaseSystemTimeField",
    "getDatabaseSystemFieldValue",
    "getDatabaseSystemFieldDateKey",
  ]) {
    assertIncludes(
      files.databaseSystemFields,
      databaseSystemFields,
      snippet,
      "System time fields must share one read-only row/page timestamp helper."
    );
  }
  for (const snippet of [
    "normalizeMultiSelectValue",
    "toggleMultiSelectValue",
    "stringifyMultiSelectValue",
  ]) {
    assertIncludes(
      files.databaseMultiSelect,
      databaseMultiSelect,
      snippet,
      "Multi-select values must share one parser/stringifier across database views."
    );
  }
  for (const snippet of [
    "formatDatabaseNumberValue",
    "getDatabaseNumberFormat",
    '"percent"',
    '"currency_usd"',
    '"currency_cny"',
    '"multiple"',
    "formatCompactNumber(number)}%",
  ]) {
    assertIncludes(
      files.databaseNumberValues,
      databaseNumberValues,
      snippet,
      "Number fields must share one display formatter for percentages, currencies, and multiples."
    );
  }
  for (const snippet of [
    "evaluateDatabaseFormula",
    "getDatabaseFormulaExpression",
    "evaluateArithmeticExpression",
    "tokenizeArithmeticExpression",
    "evaluateReversePolish",
    "仅支持数字、括号和 + - * / 基础四则运算。",
    "用 {字段名} 引用同一行数字字段。",
    "formatDatabaseNumberValue(value, field)",
  ]) {
    assertIncludes(
      files.databaseFormula,
      databaseFormula,
      snippet,
      "Formula fields must use a local safe arithmetic evaluator and shared number formatting."
    );
  }
  for (const snippet of [
    "evaluateDatabaseRollup",
    "getDatabaseRollupConfig",
    "normalizeRelationValue",
    "stringifyRelationValue",
    "未配置汇总",
    "关联字段不存在",
    "只读取本地页面标题，不读取页面正文。",
    "只读取本地 relation id。",
  ]) {
    assertIncludes(
      files.databaseRollup,
      databaseRollup,
      snippet,
      "Rollup fields must use local relation ids and page titles without reading page bodies."
    );
  }
  for (const snippet of [
    'field.field_type === "email"',
    'field.field_type === "phone"',
    'field.field_type === "multi_select"',
    'field.field_type === "number"',
    'field.field_type === "formula"',
    'field.field_type === "rollup"',
    'field.field_type === "button"',
    "getDatabaseButtonConfig(field)",
    "当前按钮字段只显示动作预览",
    "evaluateDatabaseFormula(field, fields, row, fieldValues)",
    "evaluateDatabaseRollup(",
    'type={inputType}',
    'mailto:${linkValue}',
    'tel:${linkValue}',
    "toggleMultiSelectValue",
    "formatDatabaseNumberValue",
    "isDatabaseSystemField",
    "isDatabaseSystemTimeField",
    "getDatabaseSystemFieldValue",
  ]) {
    assertIncludes(
      files.tableView,
      tableView,
      snippet,
      "Table view must edit and display email/phone/multi-select fields."
    );
  }
  for (const snippet of [
    "buildTableColumnSummary",
    "<tfoot>",
    "Σ ${formatTableSummaryNumber(sum, field)}",
    "平均 ${formatTableSummaryNumber(average, field)}",
    "个唯一",
    "列摘要只基于当前视图可见行本地计算",
  ]) {
    assertIncludes(
      files.tableView,
      tableView,
      snippet,
      "Table view must expose local-only Notion-like column summaries."
    );
  }
  for (const snippet of [
    "sticky left-0",
    "buildFrozenColumnLayouts",
    "getFrozenColumnStyle",
    "TITLE_COLUMN_WIDTH",
    "FROZEN_FIELD_WIDTH",
    "frozenCellBackground",
    "shadow-[1px_0_0_rgb(228,228,231)]",
  ]) {
    assertIncludes(
      files.tableView,
      tableView,
      snippet,
      "Table view must freeze the row number and title columns for wide databases."
    );
  }
  for (const snippet of [
    "frozenFieldIds",
    "DatabaseFrozenColumnsButton",
    "DATABASE_TABLE_FROZEN_FIELD_LIMIT",
    "当前 Table 额外冻结列",
    "清除冻结",
    "useDismissFloatingMenu(open, setOpen, menuRef)",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database table views must support configurable local frozen columns."
    );
  }
  for (const snippet of [
    'field.field_type === "email"',
    'field.field_type === "phone"',
    'field.field_type === "multi_select"',
    'field.field_type === "formula"',
    'field.field_type === "rollup"',
    '? "email"',
    '? "tel"',
    "toggleMultiSelectValue",
    "isDatabaseSystemField",
    "创建行后自动生成",
    "创建行后按公式自动计算",
    "创建行后按关联字段自动汇总",
  ]) {
    assertIncludes(
      files.formView,
      formView,
      snippet,
      "Form view must use native email/phone inputs and multi-select chips."
    );
  }
  for (const [sourceLabel, source] of [
    [files.listView, listView],
    [files.galleryView, galleryView],
    [files.timelineView, timelineView],
    [files.calendarView, calendarView],
    [files.feedView, feedView],
  ]) {
    for (const snippet of ["isDatabaseSystemField", "getDatabaseSystemField"]) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Database views must read created/edited system fields from row/page metadata."
      );
    }
  }
  for (const [sourceLabel, source] of [
    [files.databaseShell, databaseShell],
    [files.listView, listView],
    [files.galleryView, galleryView],
    [files.timelineView, timelineView],
    [files.feedView, feedView],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "formatDatabaseNumberValue",
      "Formatted number fields must display consistently across database search and summary views."
    );
  }
  for (const [sourceLabel, source] of [
    [files.databaseShell, databaseShell],
    [files.tableView, tableView],
    [files.listView, listView],
    [files.galleryView, galleryView],
    [files.timelineView, timelineView],
    [files.feedView, feedView],
    [files.chartView, chartView],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "evaluateDatabaseFormula",
      "Database views and search helpers must display local formula results."
    );
  }
  for (const [sourceLabel, source] of [
    [files.databaseShell, databaseShell],
    [files.tableView, tableView],
    [files.listView, listView],
    [files.galleryView, galleryView],
    [files.timelineView, timelineView],
    [files.feedView, feedView],
    [files.chartView, chartView],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "evaluateDatabaseRollup",
      "Database views and search helpers must display local rollup results."
    );
  }
  for (const snippet of [
    'field.field_type === "formula"',
    'field.field_type === "rollup"',
    '"formula"',
    '"rollup"',
    "evaluateDatabaseFormula(field, fields, row, values).value",
    "evaluateDatabaseRollup(field, fields, values, relationPages).value",
  ]) {
    assertIncludes(
      files.chartView,
      chartView,
      snippet,
      "Chart view must treat formula fields as chartable computed numbers."
    );
  }
  for (const snippet of [
    "DATABASE_NUMBER_FORMATS",
    "数字格式",
    "只改变显示方式，原始值仍按数字保存。",
    "公式表达式",
    "汇总来源",
    "汇总方式",
    "只改变公式结果显示方式，不写入行值。",
    "不会读取关联页面正文",
    '"{字段名}"',
    "buildFieldConfig(",
    "formulaExpression",
    "rollupRelationFieldId",
    "rollupAggregation",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Field settings and add-field UI must expose number display formats without changing stored values."
    );
  }
  for (const snippet of [
    "interface DatabaseFilterRule",
    "interface DatabaseSortRule",
    "DatabaseFilterMatchMode",
    "DatabaseFilterOperator",
    "filterRules",
    "filterMatchMode",
    "sortRules",
    "groupFieldId",
    "dateFieldId",
    "onDateFieldChange",
    'aria-label="日期字段"',
    "日期：{getDatabaseFieldDisplayName(field)}",
    "parseDatabaseFilterRules",
    "parseDatabaseFilterOperator",
    "parseDatabaseFilterMatchMode",
    "matchesDatabaseFilterText",
    "isActiveDatabaseFilterRule",
    "does_not_contain",
    "equals",
    "does_not_equal",
    "greater_than",
    "less_than",
    "before",
    "after",
    "is_empty",
    "is_not_empty",
    "compareDatabaseFilterComparable",
    "parseDatabaseFilterNumber",
    "activeFilterRules.some(matchesRule)",
    "activeFilterRules.every(matchesRule)",
    "parseDatabaseSortRules",
    "多个筛选可按全部或任一匹配处理",
    "多个排序按从左到右处理",
    "filterFieldId: filterRules[0]?.fieldId",
    "sortKey: sortRules[0]?.key",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database views must support saved multi-filter and multi-sort rules while preserving legacy config keys."
    );
  }
  for (const snippet of [
    "normalizedQuery",
    "filteredFields",
    'placeholder="搜索属性"',
    "没有匹配的属性",
    "getDatabaseFieldDescription(field)",
    "只显示名称",
    "field.position !== 0",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database property visibility menu must support local property search."
    );
  }
  for (const snippet of [
    "buildDatabaseRowGroups",
    "getDatabaseRowGroupLabels",
    "isGroupedViewType",
    "isGroupableField",
    "分组只影响当前视图展示",
    "当前分组没有可显示的行",
    "groupFieldId",
    "showAddRow={false}",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database views must support saved local grouping rules for table, list, gallery, and feed views."
    );
  }
  for (const snippet of [
    "groupFieldId",
    "savedGroupField",
    "isKanbanGroupField",
    "getKanbanGroupValue",
    "getKanbanColumnLabel",
    "已勾选",
    "未勾选",
    "getKanbanCardFields",
    "formatKanbanFieldValue",
    "stringifyRelationValue",
    "evaluateDatabaseFormula",
    "evaluateDatabaseRollup",
    "relationPages",
  ]) {
    assertIncludes(
      files.kanbanView,
      kanbanView,
      snippet,
      "Kanban views must use saved local grouping fields when they are board-friendly."
    );
  }
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "groupFieldId,",
    "Full database view props must pass the saved grouping field to Kanban views."
  );
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "groupFieldId: activeViewConfig.groupFieldId",
    "Inline database view props must pass the saved grouping field to Kanban views."
  );
  for (const snippet of [
    "DatabaseViewActionsButton",
    "initialViewId",
    'searchParams.get("view")',
    "handleRenameView",
    "handleUpdateViewDescription",
    "handleDuplicateView",
    "handleCopyViewLink",
    "buildDatabaseViewLink",
    "encodeURIComponent(viewId)",
    "description: string",
    "视图说明",
    "保存说明",
    "handleDeleteView",
    "deleteView",
    "复制视图",
    "复制视图链接",
    "删除视图",
    "至少保留一个视图",
    "不会删除任何行或页面",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database view tabs must expose local rename, description, duplicate, copy-link, and protected delete actions."
    );
  }
  for (const snippet of [
    "handleMoveView",
    "canMoveLeft",
    "canMoveRight",
    "左移",
    "右移",
    "只调整视图 tab 顺序",
    "view metadata",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database view tabs must support local metadata-only ordering."
    );
  }
  for (const snippet of [
    "useDismissFloatingMenu",
    'document.addEventListener("pointerdown"',
    'document.addEventListener("keydown"',
    'event.key === "Escape"',
    "containerRef.current?.contains(target)",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database floating menus must close on outside pointer input and Escape."
    );
  }
  for (const snippet of [
    "sidePeekPageId",
    "DatabaseRowSidePeekPanel",
    "DatabaseRowOpenMode",
    "handleUpdateViewOpenMode",
    "parseDatabaseRowOpenMode",
    "保存打开方式",
    "本地 side peek",
    "center-peek",
    "本地 center peek",
    "居中预览",
    "打开完整页面",
    "getPageTextPreview",
    "只按需读取当前行页面和字段",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database rows must support a local side peek before opening the full page."
    );
  }
  for (const snippet of [
    'Pick<DatabaseView, "name" | "config" | "position">',
    'changedCols.push("position")',
  ]) {
    assertIncludes(
      files.queries,
      queries,
      snippet,
      "Local database view updates must support position metadata changes."
    );
  }
  for (const snippet of [
    "handleDuplicateRow",
    "sourceRow.page?.title",
    "fieldValues",
    "onDuplicateRow: handleDuplicateRow",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Full database pages must duplicate rows locally from existing row field values."
    );
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline databases must share local row duplicate behavior."
    );
  }
  for (const [sourceLabel, source] of [
    [files.tableView, tableView],
    [files.listView, listView],
    [files.kanbanView, kanbanView],
    [files.calendarView, calendarView],
    [files.galleryView, galleryView],
    [files.timelineView, timelineView],
    [files.feedView, feedView],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "onDuplicateRow",
      "Database row/card views must expose local duplicate row actions."
    );
    assertIncludes(
      sourceLabel,
      source,
      "复制行：只复制本地字段值，不复制页面正文",
      "Database duplicate row actions must clearly state the privacy boundary."
    );
  }
  for (const snippet of [
    "handleMoveRow",
    "updateRow(currentRow.id, { position: targetRow.position })",
    "canMoveRows",
    "isDefaultSortRules(sortRules)",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Full database pages must support metadata-only manual row ordering."
    );
  }
  for (const snippet of [
    "handleMoveRow",
    "updateRow(currentRow.id, { position: targetRow.position })",
    "canMoveRows: isDefaultInlineSortRules(activeViewConfig.sortRules)",
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline databases must support metadata-only manual row ordering."
    );
  }
  for (const [sourceLabel, source] of [
    [files.tableView, tableView],
    [files.listView, listView],
    [files.galleryView, galleryView],
  ]) {
    for (const snippet of [
      "onMoveRow",
      "上移行：只调整本地手动排序，不改字段值",
      "下移行：只调整本地手动排序，不改字段值",
    ]) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Manual row order controls must expose local-only row movement in sortable database views."
      );
    }
  }
  for (const snippet of [
    "handleDuplicateField",
    "onDuplicate={handleDuplicateField}",
    "复制字段配置，不复制已有行值",
    "复制字段",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Full database field settings must support local field config duplication without copying row values."
    );
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database field settings must support local field config duplication without copying row values."
    );
  }
  for (const snippet of [
    "getDatabaseFieldDescription",
    "description",
  ]) {
    assertIncludes(
      files.databaseFields,
      databaseFields,
      snippet,
      "Database field config helpers must preserve optional field descriptions."
    );
  }
  for (const snippet of [
    "getDatabaseFieldDescription",
    "fieldDescription",
    "字段说明",
    "只保存字段",
    "description",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Full database field settings must support local field descriptions."
    );
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database field settings must support local field descriptions."
    );
  }
  for (const snippet of [
    "getDatabaseFieldDescription",
    "fieldDescription",
    'aria-label="字段说明"',
  ]) {
    assertIncludes(
      files.tableView,
      tableView,
      snippet,
      "Table headers must surface local field descriptions without reading row values."
    );
  }
  for (const snippet of [
    "handleMoveField",
    "字段顺序",
    "前移",
    "后移",
    "只调整字段位置，不改行值",
    "targetField.position === 0",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Full database field settings must support local field ordering without moving the title field."
    );
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database field settings must support local field ordering without moving the title field."
    );
  }
  for (const snippet of [
    "要删除字段",
    "不会删除页面正文、文件、云端数据或 AI 内容",
    "要删除记录",
    "本地页面一起软删除",
    "不会上传或外发任何内容",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Full database destructive row/field actions must require local confirmation."
    );
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline database destructive row/field actions must require local confirmation."
    );
  }
  for (const snippet of [
    '| "email"',
    '| "phone"',
    '| "multi_select"',
    '| "formula"',
    '| "rollup"',
    '| "created_time"',
    '| "last_edited_time"',
    '| "unique_id"',
    "isEmailValue",
    "isPhoneValue",
    "parseMultiSelectValue",
    'fieldType === "email"',
    'fieldType === "phone"',
    'fieldType === "multi_select"',
    'fieldType === "formula"',
    'fieldType === "rollup"',
    "isDatabaseImportReadOnlyFieldType",
    "isDatabaseSystemFieldType",
  ]) {
    assertIncludes(
      files.databaseImport,
      databaseImport,
      snippet,
      "Spreadsheet import should infer/preserve email, phone, and multi-select field types locally."
    );
  }
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "stringifyMultiSelectValue",
    "CSV/XLSX export must render multi-select arrays as readable text."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "evaluateDatabaseFormula",
    "CSV/XLSX export must include local formula results."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "evaluateDatabaseRollup",
    "CSV/XLSX export must include local rollup results."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "getDatabaseSystemFieldValue",
    "CSV/XLSX export must include read-only database system timestamps."
  );
  for (const snippet of ["normalizeMultiSelectValue", '"multi_select"']) {
    assertIncludes(
      files.chartView,
      chartView,
      snippet,
      "Chart view must group multi-select fields by selected option."
    );
  }
  for (const snippet of [
    "getDatabaseSystemFieldValue",
    '"created_time"',
    '"last_edited_time"',
    "isDatabaseSystemTimeField",
  ]) {
    assertIncludes(
      files.chartView,
      chartView,
      snippet,
      "Chart view must group read-only system time fields by month."
    );
  }
  for (const [sourceLabel, source] of [
    [files.timelineView, timelineView],
    [files.calendarView, calendarView],
  ]) {
    for (const snippet of [
      "dateFieldId",
      "selectedDateField",
      "fields.find(isDatabaseSystemTimeField)",
      "日期字段：",
    ]) {
      assertIncludes(
        sourceLabel,
        source,
        snippet,
        "Timeline and calendar views must use saved date fields and fall back to system time fields."
      );
    }
  }
  for (const snippet of [
    "rowsWithoutDate",
    "getCalendarRowDateValue",
    "无日期",
    "onDeleteRow(row.id)",
  ]) {
    assertIncludes(
      files.calendarView,
      calendarView,
      snippet,
      "Calendar views must keep rows without the selected date field visible locally."
    );
  }
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "exportDatabaseAsCsv",
    "Database must retain local CSV export."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "exportDatabaseAsXlsx",
    "Database must support local Excel export."
  );
  assertIncludes(
    files.databaseExport,
    databaseExport,
    "aoa_to_sheet",
    "Excel export must write visible database rows to a worksheet."
  );
  assertIncludes(
    files.databaseImport,
    databaseImport,
    'format: "zhinote-database-direct-import-preview"',
    "Database direct import must define a local preview format."
  );
  assertIncludes(
    files.databaseImport,
    databaseImport,
    'format: "zhinote-database-direct-import-receipt"',
    "Database direct import must define a metadata-only receipt format."
  );
  for (const snippet of [
    "DATABASE_DIRECT_IMPORT_ROW_LIMIT = 500",
    "DATABASE_DIRECT_IMPORT_COLUMN_LIMIT = 50",
  ]) {
    assertIncludes(
      files.databaseImportLimits,
      databaseImportLimits,
      snippet,
      "Database direct import limits must live in a lightweight module so the page can display limits without loading the import engine."
    );
  }
  for (const snippet of [
    "buildDatabaseImportPreview",
    "applyDatabaseImportPreview",
    "local_preview_only: true",
    "reads_selected_file_values: true",
    "requires_typed_confirmation_before_write: true",
    "uploads_data: false",
    "calls_external_service: false",
    "enables_ai: false",
    "receipt_status: \"local-database-import-metadata-only\"",
    "file_name_included: false",
    "includes_file_name: false",
    "includes_file_bytes: false",
    "includes_file_text: false",
    "includes_spreadsheet_cell_values: false",
    "writes_workspace_data: true",
    "addField(databaseId",
    "addRow(databaseId",
  ]) {
    assertIncludes(
      files.databaseImport,
      databaseImport,
      snippet,
      "Database direct import must preserve local confirmation and metadata boundaries."
    );
  }
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "exportDatabaseAsCsv",
    "Database UI must expose CSV export."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "exportDatabaseAsXlsx",
    "Database UI must expose XLSX export."
  );
  for (const snippet of [
    "DATABASE_IMPORT_ACCEPT",
    "DATABASE_IMPORT_CONFIRMATION_PHRASE",
    "handleDatabaseImportFileSelected",
    "handleApplyDatabaseImport",
    "DatabaseImportPreviewPanel",
    "DatabaseImportReceiptPanel",
    "追加导入当前数据库",
    "导出导入 receipt",
    "不保存文件名、文件 bytes、表格单元格或页面正文",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database UI must expose direct spreadsheet import into the current database."
    );
  }
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "DatabaseTemplateButton",
    "Database UI must retain template-row entry points."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "buildDatabaseTemplateRowDraft",
    "Database UI must create template rows with local structural field drafts."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "buildDatabaseTemplateRowReceipt",
    "Database UI must create local template-row write receipts."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "appendDatabaseTemplateRowReceipt",
    "Database UI must append local template-row write receipts."
  );
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "fieldValues: draft.field_values",
    "Database template rows must write safe structural field defaults."
  );
  for (const snippet of [
    "fields={fields}",
    "预填 {draft.applied_fields.length}",
    "手动 {draft.skipped_fields.length}",
    "不含敏感投资字段",
    "摘要只看模板 metadata 和字段 schema",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database template row menu must preview safe field draft coverage before writing."
    );
  }
  for (const snippet of [
    "DatabaseTemplateRowReceiptPanel",
    "templateRowReceipt",
    "handleExportTemplateRowReceipt",
    "导出模板行 receipt",
    "不包含数据库标题、row values、field names、页面正文",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database page must expose the latest local template-row receipt."
    );
  }
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "buildDatabaseTemplateRowDraft",
    "Inline database UI must share template-row field draft logic."
  );
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "buildDatabaseTemplateRowReceipt",
    "Inline database UI must create local template-row write receipts."
  );
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "appendDatabaseTemplateRowReceipt",
    "Inline database UI must append local template-row write receipts."
  );
  for (const snippet of [
    "collectInlineRelationPageIds",
    "loadInlineRelationPages",
    "getPageMetadata(pageId)",
    "normalizeRelationValue(values[fieldId])",
    "getRows(databaseId, { includePageContent: false })",
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline databases must resolve relation pages through targeted metadata reads instead of a global page load."
    );
  }
  assertNotIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    'from "@/hooks/usePages"',
    "Inline databases must not import usePages because page editors should not trigger a global page metadata scan."
  );
  assertIncludes(
    files.queries,
    queries,
    "export async function searchPageMetadata",
    "Relation editors must have a bounded metadata search path that does not hydrate full page bodies."
  );
  assertIncludes(
    files.relationEditor,
    relationEditor,
    "searchPageMetadata(searchQuery, 8)",
    "Relation editors must search page metadata lazily instead of relying on a global page list."
  );
  for (const snippet of [
    "parseInlineDatabaseViewConfig",
    "getInlineVisibleRows",
    "getInlineVisibleFields",
    "activeViewConfig.rowSearch",
    "activeViewConfig.filterRules",
    "activeViewConfig.filterMatchMode",
    "InlineDatabaseFilterMatchMode",
    "InlineDatabaseFilterOperator",
    "parseInlineDatabaseFilterOperator",
    "parseInlineDatabaseFilterMatchMode",
    "matchesInlineDatabaseFilterText",
    "compareInlineDatabaseFilterComparable",
    "parseInlineDatabaseFilterNumber",
    "activeViewConfig.sortRules",
    "activeViewConfig.groupFieldId",
    "activeViewConfig.dateFieldId",
    "activeViewConfig.hiddenFieldIds",
    "buildInlineDatabaseRowGroups",
    "isInlineGroupedViewType",
    "chartGroupFieldId={activeViewConfig.chartGroupFieldId}",
    "isDefaultInlineSortRules(activeViewConfig.sortRules)",
    "showAddRow={false}",
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline databases must apply saved database view config for display without writing row values."
    );
  }
  assertIncludes(
    files.inlineDatabaseNode,
    inlineDatabaseNode,
    "fieldValues: draft.field_values",
    "Inline database template rows must write safe structural field defaults."
  );
  for (const snippet of [
    "fields={fields}",
    "预填 {draft.applied_fields.length}",
    "手动 {draft.skipped_fields.length}",
    "只看模板 metadata 和字段 schema",
  ]) {
    assertIncludes(
      files.inlineDatabaseNode,
      inlineDatabaseNode,
      snippet,
      "Inline template row menu must preview safe field draft coverage before writing."
    );
  }
  assertIncludes(
    files.databaseShell,
    databaseShell,
    "RelationCompletionAssistant",
    "Research database relation completion must remain available."
  );
  for (const snippet of [
    "RelationHandoffContextPanel",
    "Relation handoff",
    "getRelationHandoffSourceLabel",
    "handoff",
    "候选行",
    "可写入字段",
    "清除 handoff",
    "不读页面正文",
    "不包含持仓或交易计划",
  ]) {
    assertIncludes(
      files.databaseShell,
      databaseShell,
      snippet,
      "Database page must show focused relation handoff context before manual relation writes."
    );
  }
  assertIncludes(
    files.registry,
    registry,
    'route: "/modules/databases"',
    "Database module must expose a first-class module route."
  );
  assertIncludes(
    files.databaseModuleRoute,
    databaseModuleRoute,
    "@/components/modules/DatabasesShell",
    "Database module route must load the DatabasesShell."
  );
  assertIncludes(
    files.queries,
    queries,
    "getDatabaseRowCount",
    "Database module dashboard must be able to count rows without reading values."
  );
  assertIncludes(
    files.queries,
    queries,
    "SELECT COUNT(*) as count FROM database_rows",
    "Database row count query must use COUNT rather than getRows."
  );
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    'format: "zhinote-database-module-dashboard"',
    "Database module dashboard must define a stable local export format."
  );
  for (const snippet of [
    "local_dashboard_only: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseModuleDashboard,
      databaseModuleDashboard,
      snippet,
      "Database module dashboard must preserve local-only metadata boundaries."
    );
  }
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    "DATABASE_MODULE_VIEW_TYPES",
    "Database module dashboard must track view coverage."
  );
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    "buildDatabaseModuleDashboardReport",
    "Database module dashboard must expose a reusable report builder."
  );
  assertIncludes(
    files.databaseTemplateCatalog,
    databaseTemplateCatalog,
    'format: "zhinote-database-template-catalog"',
    "Database template catalog must define a stable local export format."
  );
  assertIncludes(
    files.databaseTemplateCatalog,
    databaseTemplateCatalog,
    "buildDatabaseTemplateCatalogReport",
    "Database template catalog must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    'format: "zhinote-database-template-row-draft"',
    "Database template row drafts must define a stable local format."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "buildDatabaseTemplateRowDraft",
    "Database template row drafts must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    'format: "zhinote-database-template-row-receipt"',
    "Database template row receipts must define a stable local format."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "buildDatabaseTemplateRowReceipt",
    "Database template row receipts must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "appendDatabaseTemplateRowReceipt",
    "Database template row receipts must expose a local append helper."
  );
  assertIncludes(
    files.databaseTemplateRows,
    databaseTemplateRows,
    "listDatabaseTemplateRowReceipts",
    "Database template row receipts must expose local receipt history."
  );
  for (const snippet of [
    'draft_status: "local-template-row-structure-only"',
    'receipt_status: "local-template-row-metadata-only"',
    "DATABASE_TEMPLATE_ROW_RECEIPT_EVENT",
    "inferTemplateRowGroupId",
    "getStatusCandidates",
    "getSelectCandidates",
    'templateTitle === "报告摄取清单"',
    'templateTitle === "专家电话纪要"',
    'templateTitle === "管理层会议纪要"',
    '"HTML"',
    '"Excel"',
    '"Word"',
    '"Expert call"',
    '"NDR"',
    "isSensitiveInvestmentField",
    "reads_template_metadata: true",
    "reads_database_schema: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "includes_private_investment_details: false",
    "includes_holdings: false",
    "includes_tickers: false",
    "includes_position_sizes: false",
    "includes_prices: false",
    "includes_trading_plan: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "stored_in_browser_local_storage: true",
    "includes_database_title: false",
    "includes_row_title: false",
    "includes_page_title: false",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_body_text: false",
    "includes_tokens_or_credentials: false",
    "receipt_writes_workspace_data: false",
    "action_writes_local_workspace_data: true",
    '"敏感或方向性投资字段必须由用户手动填写。"',
  ]) {
    assertIncludes(
      files.databaseTemplateRows,
      databaseTemplateRows,
      snippet,
      "Database template row drafts must preserve safe local-only structural defaults."
    );
  }
  assertIncludes(
    files.databaseViewReadiness,
    databaseViewReadiness,
    'format: "zhinote-database-view-readiness"',
    "Database view readiness must define a stable local export format."
  );
  assertIncludes(
    files.databaseViewReadiness,
    databaseViewReadiness,
    "buildDatabaseViewReadinessReport",
    "Database view readiness must expose a reusable builder."
  );
  assertIncludes(
    files.databaseTemplateRowReadiness,
    databaseTemplateRowReadiness,
    'format: "zhinote-database-template-row-readiness"',
    "Database template row readiness must define a stable local export format."
  );
  assertIncludes(
    files.databaseTemplateRowReadiness,
    databaseTemplateRowReadiness,
    "buildDatabaseTemplateRowReadinessReport",
    "Database template row readiness must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-template-row-schema-only"',
    "TEMPLATE_ROW_REQUIREMENTS",
    "reads_template_metadata: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    '"ready"',
    '"partial"',
    '"needs-schema"',
    '"template-row-schema-map"',
    '"template-row-ready-groups"',
    '"relation-backed-templates"',
    '"recommended-database-fit"',
    '"local-row-write-boundary"',
    "报告摄取清单",
    "行业对比",
    "投研决策日志",
    "专家电话纪要",
    "管理层会议纪要",
    "Format: HTML / Markdown / PDF / Excel / Word",
    "Type: Management call or Expert call",
  ]) {
    assertIncludes(
      files.databaseTemplateRowReadiness,
      databaseTemplateRowReadiness,
      snippet,
      "Database template row readiness must preserve schema-only boundaries and gates."
    );
  }
  for (const groupId of ["company", "report", "meeting", "portfolio"]) {
    assertIncludes(
      files.databaseTemplateRowReadiness,
      databaseTemplateRowReadiness,
      `group_id: "${groupId}"`,
      `Database template row readiness must include ${groupId}.`
    );
  }
  for (const snippet of [
    'report_status: "local-view-readiness-only"',
    "DATABASE_VIEW_READINESS_REQUIREMENTS",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    '"configured"',
    '"configured-limited"',
    '"ready-to-add"',
    '"needs-schema"',
    '"date-driven-views"',
    '"status-workflow-views"',
    '"chartable-fields"',
    '"schema-gaps"',
  ]) {
    assertIncludes(
      files.databaseViewReadiness,
      databaseViewReadiness,
      snippet,
      "Database view readiness must preserve schema-only boundaries and view gates."
    );
  }
  assertIncludes(
    files.databaseImportExportReadiness,
    databaseImportExportReadiness,
    'format: "zhinote-database-import-export-readiness"',
    "Database import/export readiness must define a stable local export format."
  );
  assertIncludes(
    files.databaseImportExportReadiness,
    databaseImportExportReadiness,
    "buildDatabaseImportExportReadinessReport",
    "Database import/export readiness must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-import-export-readiness-only"',
    'readiness_verdict: "ready-with-manual-value-gates"',
    "local_report_only: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "writes_workspace_data: false",
    "exports_row_values: false",
    "imports_file_values: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseImportExportReadiness,
      databaseImportExportReadiness,
      snippet,
      "Database import/export readiness must preserve metadata-only boundaries."
    );
  }
  for (const snippet of [
    '"module-metadata-only"',
    '"value-export-confirmation"',
    '"spreadsheet-import-confirmation"',
    '"empty-database-bootstrap"',
    '"schema-matching"',
    '"cloud-ai-boundary"',
    "typed_confirmation_required_for_import: true",
    "values_included_on_export",
    "csv_export_route",
    "xlsx_export_route",
	    "append_import_route",
	    "创建首批行",
	    "还没有行",
	  ]) {
    assertIncludes(
      files.databaseImportExportReadiness,
      databaseImportExportReadiness,
      snippet,
      "Database import/export readiness must expose value gates and routes."
    );
  }
  assertIncludes(
    files.databaseWorkbench,
    databaseWorkbench,
    'format: "zhinote-database-workbench-packet"',
    "Database workbench must define a stable local export format."
  );
  assertIncludes(
    files.databaseWorkbench,
    databaseWorkbench,
    "buildDatabaseWorkbenchPacket",
    "Database workbench must expose a reusable packet builder."
  );
  for (const snippet of [
    'packet_status: "local-database-workbench-only"',
    'workbench_verdict: "ready-for-local-research-database-review"',
    "reads_database_dashboard: true",
    "reads_view_readiness: true",
    "reads_template_row_readiness: true",
    "reads_import_export_readiness: true",
    "reads_database_schema: true",
    "reads_database_views: true",
    "reads_database_row_count: true",
    "reads_database_rows: false",
    "reads_database_row_values: false",
    "reads_page_text: false",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_text: false",
    "writes_workspace_data: false",
    "creates_database_rows: false",
    "creates_schema_fields: false",
    "exports_row_values: false",
    "imports_file_values: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseWorkbench,
      databaseWorkbench,
      snippet,
      "Database workbench must preserve metadata-only local boundaries."
    );
  }
  for (const snippet of [
    '"tracker-fit"',
    '"relation-setup"',
    '"template-intake"',
    '"view-design"',
    '"import-export"',
    '"manual-review"',
    "DatabaseWorkbenchDecisionSummary",
    "decision_summary: buildDecisionSummary",
    'current_state: "local-database-owner-review"',
    "can_review_schema_now: true",
    "can_review_views_now: true",
    "can_create_template_rows_without_manual_click_now: false",
    "can_bulk_import_spreadsheet_now: true",
    "can_export_row_values_from_module_now: false",
    "can_send_database_values_to_ai_now: false",
    "can_sync_database_values_now: false",
    '"schema-view-review"',
    '"relation-schema-review"',
    '"template-row-intake"',
    '"spreadsheet-import-export"',
    '"cloud-ai-sync-boundary"',
    "target_section_id",
    "databases-create-workspace",
    "databases-template-readiness",
    "databases-view-readiness",
    "databases-import-export-readiness",
    "databases-workbench-databases",
    "auto_create_database_rows_from_packet",
    "auto_create_schema_fields_from_packet",
    "bulk_import_spreadsheet_without_typed_confirmation",
    "read_database_row_values_from_module_center",
	    "send_database_values_to_ai",
	    "required_verification_commands",
	    "创建本地行",
	    "本地模板行",
	    "视图覆盖只使用元数据计数",
	    "创建行或字段",
	  ]) {
    assertIncludes(
      files.databaseWorkbench,
      databaseWorkbench,
      snippet,
      "Database workbench must expose research database lanes and forbidden actions."
    );
  }
  for (const viewType of requiredViews) {
    assertIncludes(
      files.databaseViewReadiness,
      databaseViewReadiness,
      `"${viewType}"`,
      `Database view readiness must include ${viewType}.`
    );
  }
  for (const snippet of [
    "NOTE_TEMPLATES",
    "local_catalog_only: true",
    "reads_template_metadata: true",
    "template_rows_read_workspace_data: false",
    "reads_database_rows: false",
    "includes_database_row_values: false",
    "includes_page_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "公司研究跟踪表",
    "报告库跟踪表",
    "会议跟踪表",
    "组合跟踪表",
    "报告摄取清单",
    "行业对比",
    "投研决策日志",
    "专家电话纪要",
    "管理层会议纪要",
    "持仓名、ticker、权重、交易计划",
  ]) {
    assertIncludes(
      files.databaseTemplateCatalog,
      databaseTemplateCatalog,
      snippet,
      "Database template catalog must preserve template groups and privacy boundaries."
    );
  }
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseModuleDashboardReport",
    "Databases module UI must build the dashboard report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseTemplateCatalogReport",
    "Databases module UI must build the template row catalog."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseViewReadinessReport",
    "Databases module UI must build the view readiness report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseTemplateRowReadinessReport",
    "Databases module UI must build the template row readiness report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseImportExportReadinessReport",
    "Databases module UI must build the import/export readiness report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "buildDatabaseWorkbenchPacket",
    "Databases module UI must build the database workbench packet."
  );
  for (const snippet of [
    "数据库决策摘要",
    "DatabaseDecisionSummaryPanel",
    "DatabaseDecisionCard",
    "DatabaseDecisionStatusPill",
    "handleDecisionOpen",
    "onOpenDecision",
    "database-decision-summary",
    "当前可做",
    "保持关闭",
    "待你确认",
    "数据库决策摘要只读取本地摘要元数据",
    "数据库工作台",
    "导出工作台包",
    "DatabaseWorkbenchPanel",
    "DatabaseWorkbenchLaneCard",
    "DatabaseWorkbenchActionCard",
    "DatabaseWorkbenchDatabaseCard",
    "DatabaseWorkbenchStepRow",
    "handleWorkbenchStepNavigate",
    "onReviewStepOpen",
    "scrollIntoView",
	    "打开步骤",
	    "分数",
	    "个字段",
	    "个视图",
	    "databases-workbench",
    "databases-workbench-routes",
    "databases-priority-actions",
    "databases-workbench-databases",
    "databases-review-sequence",
    "不读取行值、页面正文或表格单元格",
    "不从模块页读取行值",
    "不批量导入",
    "不自动建",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export the local database workbench."
    );
  }
  for (const snippet of [
	    "模板行就绪",
	    "导出模板行就绪",
	    "TemplateRowReadinessPanel",
	    "TemplateRowDatabaseCard",
	    "模板行闸门",
	    "已就绪",
	    "部分就绪",
	    "不包含字段名、行值或页面正文",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export template row readiness."
    );
  }
  for (const snippet of [
    "DATABASE_TEMPLATE_ROW_RECEIPT_EVENT",
    "listDatabaseTemplateRowReceipts",
    "templateRowReceipts",
    "handleExportTemplateRowReceipts",
    "模板行记录",
    "导出记录",
    'format: "zhinote-database-template-row-receipt-history"',
    'history_status: "local-metadata-only"',
    "TemplateRowReceiptHistoryPanel",
    "TemplateRowReceiptCard",
    "summarizeTemplateRowReceipts",
    "不含字段名",
    "页面正文或敏感投资字段",
    "includes_database_field_names: false",
    "includes_database_row_values: false",
    "includes_page_body_text: false",
    "includes_tokens_or_credentials: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export local template-row receipt history."
    );
  }
  for (const snippet of [
    "导入/导出就绪",
    "导出导入/导出就绪",
    "DatabaseImportExportReadinessPanel",
    "DatabaseImportExportGateRow",
    "DatabaseImportExportCard",
    "DatabaseImportExportStatusPill",
	    "DatabaseImportExportRiskPill",
	    "handleExportImportExportReadiness",
	    "导入/导出闸门",
	    "label=\"导入\"",
	    "不读取行值",
    "真实导入/导出仍在具体数据库页手动触发",
    "导出含行值",
    "导入需确认短语",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export import/export readiness."
    );
  }
  for (const snippet of [
    "视图适配就绪",
    "导出视图就绪",
    "ViewReadinessGateRow",
    "ViewReadinessDatabaseCard",
    "ViewReadinessStatusPill",
    "不读取行值或页面正文",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render and export view readiness."
    );
  }
  for (const snippet of [
    "投研模板行目录",
    "TemplateCatalogPanel",
    "CatalogMetric",
    "具体数据库页的「+ 模板行」菜单",
    "不读取行值",
    "隐私边界",
  ]) {
    assertIncludes(
      files.databaseModuleShell,
      databaseModuleShell,
      snippet,
      "Databases module UI must render the template row catalog."
    );
  }
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "投研数据库中心",
    "Databases module UI must render the Chinese module title."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "导出数据库总览",
    "Databases module UI must export the dashboard report."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "不读取行值",
    "Databases module UI must make the row-value privacy boundary visible."
  );
  assertIncludes(
    files.databaseModuleShell,
    databaseModuleShell,
    "追加导入当前数据库",
    "Databases module UI must document direct database import."
  );
  assertIncludes(
    files.databaseModuleDashboard,
    databaseModuleDashboard,
    "数据库页面追加导入当前数据库",
    "Database module dashboard must document direct spreadsheet import."
  );
  assertIncludes(
    files.filePreviewNode,
    filePreviewNode,
    "handleImportSpreadsheetDatabase",
    "Spreadsheet files must remain importable into local databases."
  );
  assertIncludes(
    files.filePreviewNode,
    filePreviewNode,
    "BULK_IMPORT_CONFIRMATION_PHRASE",
    "Spreadsheet database import must keep typed confirmation."
  );
  assertIncludes(
    files.relationEditor,
    relationEditor,
    "RelationFieldEditor",
    "Relation fields must keep a dedicated editor."
  );
  for (const snippet of [
    "relationPages",
    "getTimelineDisplayFields",
    "formatTimelineFieldValue",
    "stringifyRelationValue",
    "getDatabaseFieldDisplayName",
    "新建行",
  ]) {
    assertIncludes(
      files.timelineView,
      timelineView,
      snippet,
      "Timeline view must support investment tracker context fields and row creation."
    );
  }
  for (const snippet of [
    "FeedCard",
    "FeedFieldChip",
    "getFeedFields",
    "compareFeedFields",
    "getRelationPages",
    "getDatabaseFieldDisplayName",
    "getFieldOptions",
    "onUpdateRow",
    "onOpenPage",
    "relationPages",
    "formatUrlLabel",
    'field.field_type === "email"',
    'field.field_type === "phone"',
    'field.field_type === "multi_select"',
    "stringifyMultiSelectValue",
    "mailto:${String(value)}",
    "tel:${String(value)}",
    "更新于",
    "删除",
  ]) {
    assertIncludes(
      files.feedView,
      feedView,
      snippet,
      "Feed view must show investment tracker field context, relation chips, and quick follow-up toggles."
    );
  }

  for (const viewType of requiredViews) {
    assertViewFile(viewType);
    assertIncludes(
      files.types,
      types,
      `"${viewType}"`,
      `DatabaseView type must include ${viewType}.`
    );
    assertIncludes(
      files.display,
      display,
      `${viewType}:`,
      `Display labels must include ${viewType}.`
    );
    assertIncludes(
      files.databaseShell,
      databaseShell,
      `view_type === "${viewType}"`,
      `DatabaseShell must render ${viewType} views.`
    );
  }

  for (const preset of requiredWorkspacePresets) {
    assertIncludes(
      files.moduleActions,
      moduleActions,
      `"${preset}"`,
      `Workspace starter preset ${preset} must exist.`
    );
    assertIncludes(
      files.registry,
      registry,
      `preset: "${preset}"`,
      `Module registry must expose ${preset} starter.`
    );
  }

  if (failures.length > 0) {
    console.error("Database contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Database contract verification passed");
  console.log(
    JSON.stringify(
      {
        view_types: requiredViews.length,
        workspace_presets: requiredWorkspacePresets.length,
        csv_export: true,
        xlsx_export: true,
        direct_spreadsheet_import: true,
        spreadsheet_import_requires_confirmation: true,
        view_readiness_gates: 6,
        template_row_readiness: true,
        template_row_field_drafts: true,
        template_row_receipts: true,
        template_row_receipt_history: true,
        inline_view_config: true,
        inline_grouped_views: true,
        table_column_summaries: true,
        table_frozen_title_column: true,
        table_configurable_frozen_columns: true,
        button_draft_fields: true,
        import_export_readiness: true,
        feed_field_context: true,
        view_rule_controls: true,
        view_filter_operators: true,
        view_comparison_filters: true,
        view_filter_match_modes: true,
        property_visibility_search: true,
        view_grouping: true,
        kanban_saved_grouping: true,
        date_view_field_selection: true,
        calendar_no_date_rows: true,
        kanban_card_properties: true,
        view_management: true,
        view_reordering: true,
        row_reordering: true,
        row_duplicate_actions: true,
        field_duplicate_actions: true,
        field_descriptions: true,
        field_description_headers: true,
        field_reordering: true,
        delete_confirmations: true,
        local_rollup_fields: true,
        database_workbench: true,
      },
      null,
      2
    )
  );
}

run();
