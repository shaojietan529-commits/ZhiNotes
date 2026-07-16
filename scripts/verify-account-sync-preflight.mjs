#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

const files = {
  packageJson: "package.json",
  route: "src/app/api/account/sync-preflight/route.ts",
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
    ["console.", "Account sync preflight must not log private account or sync metadata."],
  ]) {
    assertNotIncludes(files.route, route, snippet, message);
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
