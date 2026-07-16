#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

const files = {
  packageJson: "package.json",
  route: "src/app/api/account/sync-preflight/route.ts",
  syncShell: "src/components/modules/SyncShell.tsx",
  privateAlpha: "scripts/verify-private-alpha-p0.mjs",
  webBetaFull: "scripts/verify-web-beta-full.mjs",
  accountVerifier: "scripts/verify-account-contract.mjs",
};

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function assertIncludes(relativePath, source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(`${message}: ${relativePath} missing ${JSON.stringify(snippet)}`);
  }
}

function assertNotIncludes(relativePath, source, snippet, message) {
  if (source.includes(snippet)) {
    failures.push(`${message}: ${relativePath} unexpectedly includes ${JSON.stringify(snippet)}`);
  }
}

function run() {
  const packageJsonSource = readProjectFile(files.packageJson);
  const route = readProjectFile(files.route);
  const syncShell = readProjectFile(files.syncShell);
  const privateAlpha = readProjectFile(files.privateAlpha);
  const webBetaFull = readProjectFile(files.webBetaFull);
  const accountVerifier = readProjectFile(files.accountVerifier);
  const scripts = packageJsonSource
    ? JSON.parse(packageJsonSource).scripts ?? {}
    : {};

  if (
    scripts["verify:account-sync-preflight"] !==
    "node scripts/verify-account-sync-preflight.mjs"
  ) {
    failures.push(
      "package.json must expose verify:account-sync-preflight as the focused account sync preflight verifier."
    );
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-account-sync-preflight"',
      "Account sync preflight must expose a stable receipt format.",
    ],
    [
      "PAGE_INDEX_KEY_PREFIX",
      "Account sync preflight must inspect the current page account-sync cloud index.",
    ],
    [
      "DATABASE_INDEX_KEY_PREFIX",
      "Account sync preflight must inspect the current database account-sync cloud index.",
    ],
    [
      "DAILY_CALENDAR_CACHE_KEY_PREFIX",
      "Account sync preflight must inspect Daily's metadata cache instead of treating the page index as a Daily manifest.",
    ],
    [
      "MEETING_CALENDAR_CACHE_KEY_PREFIX",
      "Account sync preflight must inspect ZhiHui's metadata cache instead of treating the page index as a meeting manifest.",
    ],
    [
      "readCalendarMetadataCacheSummary",
      "Account sync preflight must summarize calendar metadata caches without reading page bodies.",
    ],
    [
      "metadata cache 可读",
      "Account sync preflight must report readable Daily/ZhiHui metadata cache counts.",
    ],
    [
      "metadata cache 尚未生成",
      "Account sync preflight must explain when calendar metadata caches need to be generated.",
    ],
    [
      "metadata cache 落后于页面云端索引",
      "Account sync preflight must block stale calendar metadata caches instead of reporting false readiness.",
    ],
    [
      "CORE_METADATA_DOMAIN_REQUIRED_COUNT = 4",
      "Account sync preflight must treat Page, Daily, ZhiHui, and Database as the four P0 metadata domains.",
    ],
    [
      "daily-cloud-metadata",
      "Account sync preflight must expose Daily notes as a distinct core metadata domain.",
    ],
    [
      "meeting-cloud-metadata",
      "Account sync preflight must expose ZhiHui meetings as a distinct core metadata domain.",
    ],
    [
      "daily_cloud_metadata_readable",
      "Account sync preflight summary must report Daily metadata readability.",
    ],
    [
      "meeting_cloud_metadata_readable",
      "Account sync preflight summary must report ZhiHui metadata readability.",
    ],
    [
      "getAccountIdentityConfig",
      "Account sync preflight must use identity config so Resend email setup does not block existing sessions.",
    ],
    [
      "accountIdentityMissingEnv",
      "Account sync preflight must report identity config gaps without requiring the email sender.",
    ],
    [
      "getSessionAccount(config, token)",
      "Account sync preflight must verify the existing account session before reading cloud metadata.",
    ],
    [
      "accountSessionUnconfirmedPayload",
      "Account sync preflight must keep transient account failures retryable instead of signing the user out.",
    ],
    [
      "keeps_session_cookie",
      "Account sync preflight must explicitly state that session-unconfirmed keeps the cookie.",
    ],
    [
      "maskEmail(account.email)",
      "Account sync preflight must return only a masked account hint.",
    ],
    [
      "reads_cloud_kv_metadata: true",
      "Account sync preflight must disclose that it reads cloud KV metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Account sync preflight must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Account sync preflight must not read database row values.",
    ],
    [
      "uploads_workspace_data: false",
      "Account sync preflight must not upload workspace data.",
    ],
    [
      "mutates_workspace_data: false",
      "Account sync preflight must not mutate workspace data.",
    ],
    [
      "clears_local_cache: false",
      "Account sync preflight must not clear local cache.",
    ],
    [
      "enables_sync_push: false",
      "Account sync preflight must not enable unified sync push.",
    ],
    [
      "enables_sync_pull: false",
      "Account sync preflight must not enable unified sync pull.",
    ],
    [
      "云端 metadata 均可读",
      "Account sync preflight must explain readiness for the real two-device smoke.",
    ],
    [
      "页面、每日纪要、ZhiHui 和数据库云端 metadata 均可读",
      "Account sync preflight ready copy must match the four-domain two-device smoke scope.",
    ],
    [
      "本地输入继续保留并进入 pending",
      "Account sync preflight must preserve local-first behavior when a metadata domain is blocked.",
    ],
  ]) {
    assertIncludes(files.route, route, snippet, message);
  }

  for (const [snippet, message] of [
    ["content_text", "Account sync preflight must not reference page body fields."],
    ["field_values", "Account sync preflight must not reference database cell values."],
    ["kvSet(", "Account sync preflight must not directly write KV workspace data."],
    ["kvDel(", "Account sync preflight must not delete KV data."],
    ["fetch(\"/api/pages/account-sync\"", "Account sync preflight route must not call client sync routes."],
    ["fetch('/api/pages/account-sync'", "Account sync preflight route must not call client sync routes."],
    ["getAccountConfig", "Account sync preflight must not require full email-code config."],
    ["accountMissingEnv", "Account sync preflight must not report email sender gaps as sync blockers."],
    ["RESEND_API_KEY", "Account sync preflight must not depend on the Resend email sender."],
    ["console.", "Account sync preflight must not log private account or sync metadata."],
    ["const dailyReadable = pageReadable;", "Daily metadata readiness must not be a direct alias of page index readiness."],
    ["const meetingReadable = pageReadable;", "ZhiHui metadata readiness must not be a direct alias of page index readiness."],
  ]) {
    assertNotIncludes(files.route, route, snippet, message);
  }

  for (const [snippet, message] of [
    [
      '"account-sync-preflight"',
      "Sync Center must expose the account sync preflight as a queue action.",
    ],
    [
      "ACCOUNT_SYNC_PREFLIGHT_STORAGE_KEY",
      "Sync Center must persist only a local preflight UI receipt.",
    ],
    [
      'fetchSyncCloudApiWithTimeout(\n        "/api/account/sync-preflight"',
      "Sync Center must call the read-only account sync preflight route.",
    ],
    [
      "readStoredAccountSyncPreflightReceipt",
      "Sync Center must reuse local preflight receipts after refresh.",
    ],
    [
      "data-testid=\"account-sync-preflight\"",
      "Sync Center must render a stable account sync preflight panel.",
    ],
    [
      "data-testid=\"account-sync-preflight-run\"",
      "Sync Center must expose a manual account sync preflight rerun button.",
    ],
    [
      "data-account-sync-preflight-status",
      "Sync Center must expose the preflight status for smoke checks.",
    ],
    [
      "data-account-sync-preflight-daily-readable",
      "Sync Center must expose Daily metadata preflight readability for smoke checks.",
    ],
    [
      "data-account-sync-preflight-meeting-readable",
      "Sync Center must expose ZhiHui metadata preflight readability for smoke checks.",
    ],
    [
      "data-account-sync-preflight-boundary=\"metadata-only\"",
      "Sync Center must disclose that the preflight is metadata-only.",
    ],
    [
      "页面、每日纪要、ZhiHui、数据库云端链路",
      "Sync Center preflight copy must use the same four-domain scope as the two-device smoke runbook.",
    ],
    [
      "页面、每日纪要、ZhiHui 和数据库四个核心云端 metadata 域",
      "Sync Center preflight summary must explain the four core metadata domains.",
    ],
    [
      "不读正文、不上传、不清缓存",
      "Sync Center must tell the user that the preflight does not read content, upload, or clear cache.",
    ],
    [
      "临时无法确认",
      "Sync Center must distinguish transient account uncertainty from sign-out.",
    ],
    [
      "if (!didRun) accountSyncPreflightAutoRunRef.current = false;",
      "Sync Center must reset the preflight auto-run flag when a scheduled check is cancelled before it fires.",
    ],
  ]) {
    assertIncludes(files.syncShell, syncShell, snippet, message);
  }

  for (const [relativePath, source, label] of [
    [files.privateAlpha, privateAlpha, "Private Alpha verifier"],
    [files.webBetaFull, webBetaFull, "Web Beta full verifier"],
    [files.accountVerifier, accountVerifier, "Account contract verifier"],
  ]) {
    assertIncludes(
      relativePath,
      source,
      "npm run verify:account-sync-preflight",
      `${label} must include account sync preflight verification`
    );
  }

  const receipt = {
    format: "zhinote-account-sync-preflight-verification-receipt",
    generated_at: new Date().toISOString(),
    checked_files: Object.values(files),
    boundary: {
      reads_page_body_text: false,
      reads_database_row_values: false,
      uploads_workspace_data: false,
      mutates_workspace_data: false,
      clears_local_cache: false,
      enables_sync_push: false,
      enables_sync_pull: false,
      sends_network_requests: false,
    },
    status: failures.length === 0 ? "passed" : "failed",
    failures,
  };

  console.log(JSON.stringify(receipt, null, 2));
  if (failures.length > 0) process.exit(1);
}

run();
