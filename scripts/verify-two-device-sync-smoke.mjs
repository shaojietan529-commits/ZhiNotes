#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  privateAlphaVerifier: "scripts/verify-private-alpha-p0.mjs",
  webBetaFullVerifier: "scripts/verify-web-beta-full.mjs",
  runbook: "src/lib/sync/twoDeviceSyncSmokeRunbook.ts",
  twoDayGate: "src/lib/sync/twoDayUsabilityGate.ts",
  syncShell: "src/components/modules/SyncShell.tsx",
};

const failures = [];

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

function assertScript(scripts, name, command) {
  if (scripts[name] !== command) {
    failures.push(
      `package.json must expose ${name} as ${JSON.stringify(command)}`
    );
  }
}

function run() {
  const packageJsonSource = readProjectFile(files.packageJson);
  const privateAlphaVerifier = readProjectFile(files.privateAlphaVerifier);
  const webBetaFullVerifier = readProjectFile(files.webBetaFullVerifier);
  const runbook = readProjectFile(files.runbook);
  const twoDayGate = readProjectFile(files.twoDayGate);
  const syncShell = readProjectFile(files.syncShell);
  const packageJson = packageJsonSource
    ? JSON.parse(packageJsonSource)
    : { scripts: {} };
  const scripts = packageJson.scripts ?? {};

  assertScript(
    scripts,
    "verify:two-device-sync",
    "node scripts/verify-two-device-sync-smoke.mjs"
  );

  for (const [snippet, message] of [
    [
      "npm run verify:two-device-sync",
      "Private Alpha P0 verifier must run the focused two-device sync smoke verifier.",
    ],
    [
      "two-device-sync",
      "Private Alpha P0 verifier must keep a distinct two-device sync command id.",
    ],
  ]) {
    assertIncludes(files.privateAlphaVerifier, privateAlphaVerifier, snippet, message);
  }

  assertIncludes(
    files.webBetaFullVerifier,
    webBetaFullVerifier,
    "npm run verify:two-device-sync",
    "Web Beta full verifier must include the focused two-device sync smoke verifier."
  );

  for (const [snippet, message] of [
    [
      'format: "zhinote-two-device-sync-smoke-runbook"',
      "Two-device runbook must expose a stable runbook format.",
    ],
    [
      'format: "zhinote-two-device-sync-smoke-owner-receipt"',
      "Two-device owner receipt must expose a stable receipt format.",
    ],
    [
      "ready_to_run_scoped_smoke_now",
      "Two-device runbook must separate the scoped 48-hour smoke from full-platform sync.",
    ],
    [
      "ready_to_run_real_smoke_now",
      "Two-device runbook must expose whether the full real smoke can run.",
    ],
    [
      "ready_to_claim_two_device_sync_passed: false",
      "Two-device runbook must never auto-claim sync passed.",
    ],
    [
      "accountSyncBridgeProbe?:",
      "Two-device runbook must accept the account bridge probe receipt as a smoke precondition.",
    ],
    [
      "account_sync_bridge_probe_ready",
      "Two-device runbook must expose account bridge probe readiness.",
    ],
    [
      "account_sync_bridge_probe_fresh",
      "Two-device runbook next action must require a fresh account bridge probe from the two-day gate.",
    ],
    [
      "isFreshAccountBridgeProbe",
      "Two-device runbook must reject expired account bridge probe receipts.",
    ],
    [
      "账号同步桥回执未过期",
      "Two-device owner receipt must require a fresh account bridge receipt.",
    ],
    [
      "can_claim_two_device_sync_passed_now: false",
      "Two-device owner receipt must never auto-claim sync passed.",
    ],
    [
      "ready_to_collect_scoped_owner_evidence",
      "Two-device owner receipt must expose scoped 48-hour evidence readiness separately from full sync evidence.",
    ],
    [
      "ready_to_collect_scoped_owner_evidence:\n      runbook.ready_to_run_scoped_smoke_now",
      "Two-device owner receipt scoped evidence readiness must come from the scoped runbook gate.",
    ],
    [
      "ready_to_collect_owner_evidence: runbook.ready_to_run_real_smoke_now",
      "Two-device owner receipt full evidence readiness must come from the full real smoke gate.",
    ],
    [
      'owner_result: "not-recorded"',
      "Two-device owner receipt must require owner-filled results.",
    ],
    [
      "scoped_core_sync_claim_blocked",
      "Two-device runbook must track scoped core claim blocking.",
    ],
    [
      "full_platform_sync_claim_blocked",
      "Two-device runbook must keep full-platform claims blocked until ready.",
    ],
    [
      "48 小时 scoped beta 可以先验收 Page、每日纪要、ZhiHui、数据库、组合管理和文件元数据",
      "Two-device runbook must state the scoped 48-hour beta scope.",
    ],
    [
      "不能声称完整全平台同步通过",
      "Two-device runbook must warn against overclaiming full-platform sync.",
    ],
    [
      "本地 sync_log rows 只在 remote ACK cursor 前进后标记 synced",
      "Two-device owner receipt must require remote ACK cursor evidence.",
    ],
    [
      "必需同步回执 pendingAfter=0",
      "Two-device owner receipt must require explicit pendingAfter=0 sync receipts.",
    ],
    [
      "A/B 双向可见证据",
      "Two-device owner receipt must require bidirectional cross-device visibility evidence.",
    ],
    [
      "A 创建/编辑后 B 可见；B 再编辑后 A 可见",
      "Two-device owner receipt must describe the bidirectional visibility workflow.",
    ],
  ]) {
    assertIncludes(files.runbook, runbook, snippet, message);
  }

  for (const stepId of [
    "same-account-session",
    "account-sync-bridge-probe",
    "sync-domain-coverage-check",
    "ack-ledger-readiness",
    "page-note-sync",
    "daily-note-sync",
    "zhihui-meeting-sync",
    "database-row-sync",
    "file-report-metadata-sync",
    "final-device-handoff",
  ]) {
    assertIncludes(
      files.runbook,
      runbook,
      stepId,
      `Two-device runbook must include the ${stepId} step`
    );
  }

  for (const [snippet, message] of [
    [
      "account_sync_bridge_probe_fresh",
      "Two-day usability gate must expose whether the account bridge probe receipt is fresh.",
    ],
    [
      "account_sync_bridge_checked_at",
      "Two-day usability gate must expose the account bridge probe check time.",
    ],
    [
      "account_sync_bridge_expires_at",
      "Two-day usability gate must expose the account bridge probe expiry time.",
    ],
    [
      "isFreshAccountBridgeProbe",
      "Two-day usability gate must reject expired account bridge receipts before allowing handoff.",
    ],
    [
      "const canSwitchDevicesNow = queueHandoffReady && accountBridgeProbeReady",
      "Two-day usability gate must include fresh account bridge readiness in device handoff readiness.",
    ],
    [
      "账号同步桥回执已过期或时间无效；不能作为换设备证据。",
      "Two-day usability gate must explain stale account bridge receipts in plain Chinese.",
    ],
  ]) {
    assertIncludes(files.twoDayGate, twoDayGate, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "input.contract.can_enable_sync_push_now",
      "ACK ledger readiness must require push enablement.",
    ],
    [
      "input.contract.can_mark_local_rows_synced_now",
      "ACK ledger readiness must require durable synced-row marking.",
    ],
    [
      "input.contract.summary.push_route_enabled",
      "ACK ledger readiness must require the push route to be enabled.",
    ],
    [
      "input.contract.summary.pull_route_enabled",
      "ACK ledger readiness must require the pull route to be enabled.",
    ],
    [
      "input.serverReadiness.can_query_server_ledger_now",
      "ACK ledger readiness must require server ledger query readiness.",
    ],
    [
      "input.serverReadiness.summary.remaining_blockers === 0",
      "ACK ledger readiness must require zero server-readiness blockers.",
    ],
  ]) {
    assertIncludes(files.runbook, runbook, snippet, message);
  }

  for (const [snippet, message] of [
    ["reads_page_body_text: false", "Runbook must not read page body text."],
    [
      "reads_database_row_values: false",
      "Runbook must not read database row values.",
    ],
    ["reads_file_names: false", "Runbook must not read file names."],
    ["reads_file_bytes: false", "Runbook must not read file bytes."],
    [
      "sends_network_requests: false",
      "Runbook verifier and receipt must not send network requests.",
    ],
    ["writes_server_data: false", "Runbook must not write server data."],
    ["uploads_workspace_data: false", "Runbook must not upload workspace data."],
    ["clears_local_cache: false", "Runbook must not clear local cache."],
    ["stores_private_content: false", "Owner receipt must not store private content."],
  ]) {
    assertIncludes(files.runbook, runbook, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "buildTwoDeviceSyncSmokeRunbook",
      "Sync UI must build the two-device smoke runbook.",
    ],
    [
      "buildTwoDeviceSyncSmokeOwnerReceipt",
      "Sync UI must build the two-device owner receipt.",
    ],
    [
      'data-testid="two-device-sync-smoke-runbook"',
      "Sync UI must expose a stable runbook test id.",
    ],
    [
      "buildTwoDeviceHandoffVerdict",
      "Sync UI must build a direct two-device handoff verdict from the runbook and owner evidence.",
    ],
    [
      'data-testid="two-device-sync-handoff-verdict"',
      "Sync UI must render a visible handoff verdict before the detailed two-device checklist.",
    ],
    [
      "data-two-device-sync-handoff-decision",
      "Sync UI handoff verdict must expose a stable machine-readable decision.",
    ],
    [
      "切设备判断",
      "Sync UI handoff verdict must explain the device handoff decision in user-facing Chinese.",
    ],
    [
      "现在可以",
      "Sync UI handoff verdict must separate safe actions from blocked actions.",
    ],
    [
      "先不要做",
      "Sync UI handoff verdict must tell the owner which actions remain blocked.",
    ],
    [
      'data-testid="two-device-sync-smoke-runbook-export"',
      "Sync UI must expose a local runbook export action.",
    ],
    [
      'data-testid="two-device-sync-smoke-readiness-actions"',
      "Sync UI must expose two-device readiness repair actions near the runbook.",
    ],
    [
      'data-testid="two-device-sync-smoke-run-bridge-probe"',
      "Sync UI must let the owner refresh the metadata-only account bridge probe from the two-device runbook.",
    ],
    [
      'data-testid="two-device-sync-smoke-warm-metadata-cache"',
      "Sync UI must let the owner warm Daily/ZhiHui metadata cache from the two-device runbook.",
    ],
    [
      "handleRunAccountBridgeProbe",
      "Two-device runbook readiness action must reuse the existing account bridge probe handler.",
    ],
    [
      "handleWarmAccountSyncMetadataCaches",
      "Two-device runbook readiness action must reuse the explicit Daily/ZhiHui metadata cache warmup handler.",
    ],
    [
      "不会把结果自动标成两端同步通过",
      "Two-device runbook readiness actions must not auto-claim two-device sync success.",
    ],
    [
      "accountSyncBridgeProbe: accountBridgeProbeReceipt",
      "Sync UI must pass the account bridge receipt into the two-device smoke runbook.",
    ],
    [
      "checked_at: accountBridgeProbeReceipt.checked_at",
      "Sync UI must pass the account bridge probe check time into handoff gates.",
    ],
    [
      "expires_at: accountBridgeProbeReceipt.expires_at",
      "Sync UI must pass the account bridge probe expiry time into handoff gates.",
    ],
    [
      "buildAccountSyncBridgeProbeReceiptFromPreflight",
      "Sync UI account bridge probe must reuse the lightweight account sync preflight receipt.",
    ],
    [
      'fetchSyncCloudApiWithTimeout("/api/account/sync-preflight")',
      "Sync UI account bridge probe must call the metadata-only account sync preflight route instead of pulling Daily/ZhiHui metadata.",
    ],
    [
      "不触发日历/会议 metadata 重扫",
      "Sync UI copy must state that the account bridge probe avoids Daily/ZhiHui metadata rescans.",
    ],
    [
      "ACCOUNT_SYNC_BRIDGE_PROBE_AUTO_DELAY_MS",
      "Sync UI must define a bounded delay before auto-running the metadata-only account bridge probe.",
    ],
    [
      "ACCOUNT_SYNC_BRIDGE_PROBE_RETRY_TTL_MS",
      "Sync UI must give partial/blocked account bridge receipts a short retry TTL instead of caching failures for the full ready window.",
    ],
    [
      "accountSyncBridgeProbeEffectiveExpiresAt",
      "Sync UI must apply the short retry TTL even to older stored partial/blocked bridge receipts that still carry a long explicit expiry.",
    ],
    [
      "Math.min(explicitExpiresAt, retryExpiresAt)",
      "Sync UI must cap non-ready bridge receipt freshness at the short retry window.",
    ],
    [
      "isFreshReadyAccountSyncBridgeProbeReceipt(accountBridgeProbeReceipt)",
      "Sync UI must skip the automatic account bridge probe only when a fresh ready receipt exists.",
    ],
    [
      "ACCOUNT_PROFILE_UPDATED_EVENT",
      "Sync UI must listen for account profile/session updates so stale blocked bridge receipts do not hide a recovered login.",
    ],
    [
      "partial/blocked 回执只保留 2 分钟",
      "Sync UI copy must explain that failed account bridge probe receipts expire quickly and can be retried.",
    ],
    [
      "accountBridgeProbeAutoRunRef",
      "Sync UI must guard the automatic account bridge probe so it runs at most once per dashboard mount.",
    ],
    [
      "isFreshReadyAccountSyncBridgeProbeReceipt(accountBridgeProbeReceipt)",
      "Sync UI must skip the automatic account bridge probe only when a fresh ready receipt already exists.",
    ],
    [
      'data-account-sync-bridge-auto-probe="missing-or-expired-receipt"',
      "Sync UI must disclose that the account bridge auto probe only runs for missing or expired receipts.",
    ],
    [
      'data-account-sync-bridge-probe-privacy="metadata-only"',
      "Sync UI must expose the account bridge probe privacy boundary as metadata-only.",
    ],
    [
      "metadata-only 预检",
      "Sync UI copy must explain that the automatic account bridge check is metadata-only.",
    ],
    [
      "data-two-device-sync-account-bridge-probe-ready",
      "Sync UI must expose account bridge readiness in the two-device smoke gate.",
    ],
    [
      "data-two-device-sync-account-bridge-expires-at",
      "Sync UI must expose account bridge receipt expiry in the two-device smoke gate.",
    ],
    [
      'data-testid="two-device-sync-smoke-owner-receipt-export"',
      "Sync UI must expose a local owner receipt export action.",
    ],
    [
      "data-two-device-sync-scoped-ready-to-run",
      "Sync UI must expose scoped two-device smoke readiness.",
    ],
    [
      "data-two-device-sync-ack-ledger-ready",
      "Sync UI must expose ACK ledger readiness.",
    ],
    [
      'data-testid="two-device-sync-smoke-ack-evidence-actions"',
      "Sync UI must expose ACK evidence actions near the two-device smoke runbook.",
    ],
    [
      'data-testid="two-device-sync-smoke-open-ack-ledger-contract"',
      "Sync UI must let the owner jump from two-device smoke to the ack/retry ledger contract.",
    ],
    [
      'data-testid="two-device-sync-smoke-open-ack-server-readiness"',
      "Sync UI must let the owner jump from two-device smoke to the ACK ledger server readiness receipt.",
    ],
    [
      'getElementById("sync-ack-retry-ledger-contract")',
      "Two-device smoke ACK action must target the existing ack/retry ledger contract section.",
    ],
    [
      'getElementById("sync-ack-ledger-server-readiness")',
      "Two-device smoke ACK action must target the existing ACK ledger server readiness section.",
    ],
    [
      "ACK 证据路径",
      "Sync UI must explain the ACK evidence path before claiming device handoff.",
    ],
    [
      "data-two-device-sync-full-platform-claim-blocked",
      "Sync UI must expose full-platform claim blocking.",
    ],
    [
      "data-two-device-sync-owner-receipt-claim-passed",
      "Sync UI must expose that owner receipt does not auto-claim pass.",
    ],
    [
      "data-two-device-sync-owner-receipt-scoped-ready",
      "Sync UI must expose scoped owner evidence readiness separately.",
    ],
    [
      "data-two-device-sync-owner-receipt-full-ready",
      "Sync UI must expose full owner evidence readiness separately.",
    ],
    [
      "TWO_DEVICE_SMOKE_OWNER_DRAFT_STORAGE_KEY",
      "Sync UI must persist a local owner draft for real two-device smoke results.",
    ],
    [
      'format: "zhinote-two-device-smoke-owner-draft"',
      "Sync UI owner draft must expose a stable metadata-only format.",
    ],
    [
      'data-testid="two-device-smoke-owner-draft"',
      "Sync UI must render the local two-device smoke owner draft.",
    ],
    [
      "data-two-device-smoke-owner-draft-status",
      "Sync UI must expose owner draft status for smoke checks.",
    ],
    [
      'data-two-device-smoke-owner-draft-storage="localStorage"',
      "Sync UI must disclose that the owner draft is browser-local.",
    ],
    [
      "data-two-device-smoke-owner-result",
      "Sync UI must expose per-step owner results.",
    ],
    [
      "TWO_DEVICE_SMOKE_SCOPED_OWNER_STEP_IDS",
      "Sync UI must define a scoped 48h owner-evidence step set.",
    ],
    [
      "scoped_evidence_ready",
      "Sync UI owner draft summary must expose whether scoped owner evidence is ready.",
    ],
    [
      "device_handoff_evidence_ready",
      "Sync UI owner draft summary must expose whether real device handoff evidence is ready.",
    ],
    [
      "TWO_DEVICE_SMOKE_DEVICE_HANDOFF_OWNER_STEP_IDS",
      "Sync UI must define the hard-gated device handoff owner-evidence step set.",
    ],
    [
      "TWO_DEVICE_SMOKE_CORE_SURFACE_OWNER_STEP_IDS",
      "Sync UI must define the core surface owner-evidence step set.",
    ],
    [
      "account_bridge_evidence_ready",
      "Sync UI owner draft summary must expose account bridge evidence readiness.",
    ],
    [
      "ack_evidence_ready",
      "Sync UI owner draft summary must expose ACK evidence readiness.",
    ],
    [
      "bidirectional_visibility_evidence_ready",
      "Sync UI owner draft summary must expose A/B bidirectional visibility readiness.",
    ],
    [
      "pending_after_zero_evidence_ready",
      "Sync UI owner draft summary must expose pendingAfter=0 evidence readiness.",
    ],
    [
      "TWO_DEVICE_SMOKE_OWNER_DRAFT_TTL_MS",
      "Sync UI owner draft evidence must have an explicit freshness TTL.",
    ],
    [
      "owner_evidence_fresh",
      "Sync UI owner draft summary must expose whether owner evidence is still fresh.",
    ],
    [
      "owner_evidence_expires_at",
      "Sync UI owner draft summary must expose when owner evidence expires.",
    ],
    [
      "data-two-device-smoke-owner-draft-fresh",
      "Sync UI must expose owner draft freshness as a stable data attribute.",
    ],
    [
      "data-two-device-smoke-owner-draft-expires-at",
      "Sync UI must expose owner draft expiry as a stable data attribute.",
    ],
    [
      'data-testid="two-device-smoke-owner-draft-freshness"',
      "Sync UI must visibly render owner draft freshness.",
    ],
    [
      "过期后不能作为换设备证据",
      "Sync UI copy must explain stale owner evidence cannot be used for device handoff.",
    ],
    [
      "证据已过期",
      "Sync UI and filled receipt must explain stale owner evidence in plain Chinese.",
    ],
    [
      "data-two-device-smoke-owner-draft-scoped-ready",
      "Sync UI must expose scoped owner evidence readiness as a stable data attribute.",
    ],
    [
      "data-two-device-smoke-owner-draft-handoff-ready",
      "Sync UI must expose device handoff owner evidence readiness as a stable data attribute.",
    ],
    [
      'data-testid="two-device-smoke-owner-handoff-evidence"',
      "Sync UI must render a visible device handoff evidence summary.",
    ],
    [
      "换设备硬门槛",
      "Sync UI must visibly distinguish device handoff evidence from general step completion.",
    ],
    [
      "A/B 双向可见",
      "Sync UI handoff summary must require bidirectional visibility evidence.",
    ],
    [
      "pendingAfter=0",
      "Sync UI handoff summary must require pendingAfter=0 evidence.",
    ],
    [
      'data-testid="two-device-smoke-owner-scoped-evidence"',
      "Sync UI must render a visible scoped owner evidence summary.",
    ],
    [
      "不等于完整平台同步通过",
      "Scoped owner evidence copy must not claim full-platform sync completion.",
    ],
    [
      "onUpdateOwnerDraftResult",
      "Sync UI must let the owner record pass/fail/blocked results.",
    ],
    [
      "不会上传，也不会让系统自动宣称两端同步通过",
      "Owner draft UI must state that draft evidence is local-only and not an auto-pass claim.",
    ],
    [
      "48h scoped 证据",
      "Sync UI must label scoped two-device evidence separately from full evidence.",
    ],
    [
      'data-testid="two-device-smoke-owner-evidence-fields"',
      "Sync UI must visibly render the owner evidence fields.",
    ],
    [
      "data-two-device-smoke-owner-evidence-count",
      "Sync UI must expose the owner evidence field count.",
    ],
    [
      "ownerReceipt.owner_evidence_fields.map",
      "Sync UI must render each owner evidence field from the receipt contract.",
    ],
    [
      'data-testid="two-device-smoke-owner-evidence-field"',
      "Sync UI must expose stable per-field evidence test ids.",
    ],
    [
      "跑真实两端 smoke 前先按这些字段准备脱敏证据",
      "Sync UI copy must explain how to prepare owner evidence before the real smoke.",
    ],
    [
      "不填正文、数据库行值、文件名、验证码、cookie 或 token",
      "Sync UI copy must preserve the privacy boundary for evidence collection.",
    ],
  ]) {
    assertIncludes(files.syncShell, syncShell, snippet, message);
  }

  if (failures.length > 0) {
    console.error("Two-device sync smoke verification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  const receipt = {
    format: "zhinote-two-device-sync-smoke-verification-receipt",
    format_version: 1,
    receipt_status: "passed",
    verified_scope:
      "source-contract-only: runbook, owner receipt, Sync UI exports, package command, and P0/full verifier wiring",
    two_device_sync_claim_passed_now: false,
    boundary: {
      local_source_check_only: true,
      reads_queue_counts: false,
      reads_sync_flags: false,
      reads_auth_retry_state: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      clears_local_cache: false,
      enables_sync: false,
      enables_ai: false,
    },
    verified_files: Object.values(files),
    next_action:
      "Use this fast verifier after account or sync changes, then run the real owner-filled two-device smoke before claiming cross-device sync passed.",
  };

  console.log("Two-device sync smoke verification passed");
  console.log(JSON.stringify(receipt, null, 2));
}

run();
