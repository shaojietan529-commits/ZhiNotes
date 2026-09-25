# Stage 1: portfolio acknowledgements and concurrent writes

## Completed Locally

- Reuse the existing portfolio drain for initial sync, debounced edits and
  manual retries. Overlapping drains in one tab share a request.
- Capture a unique pending revision, request identity and memory-only local
  state fingerprint. An older ACK or failure cannot clear/regress a newer
  revision or overwrite labels edited while an upload was in flight.
- Queue local edits immediately after local persistence, before React effects
  or the upload debounce. Pending edits survive reload and remote pulls.
- Apply cloud-confirmed labels only with a matching local revision. Unreadable
  local storage leaves the work retryable rather than declaring success.
- Preserve the edit timestamp on retries. Already-converged initial pulls do
  not generate another upload. Status-only storage pings do not trigger writes.
- Reuse one explicit ACK validator for both account and legacy passcode sync.
  The passcode route now returns an ACK only after its storage write succeeds.
- Guard async sync UI callbacks while viewing a friend's read-only portfolio.
- Persist and notify tag edits outside React state updater functions. A
  delayed Book/AI result reads the latest local labels, preserving manual edits
  made while the request was running.
- Both account and passcode writes use the installed Upstash SDK and one
  Redis EVAL comparison/write, including account metadata. A changed cloud
  version returns 409 instead of overwriting it. Exact replays after lost
  receipts are safe; client timestamps never decide the winner.
- ACK v2 binds the request ID, cloud scope and revision. A late receipt cannot
  regress another tab's recorded cloud baseline. Pulls advance that baseline
  only after their content is applied, never while local work is pending.
- No tag union: a clean device applies the complete confirmed cloud tag map,
  including deletions, even if the originating device's clock is behind.
- Conflicts preserve local pending and the cloud version; a private recovery
  pair is retained in browser storage, separately from metadata/status exports.
  Failed recovery persistence cannot clear pending or acknowledge the upload.
- Legacy clients without version preconditions receive 428 (refresh required).
  No silent fallback to unconditional writes is allowed during rollout.
- Conflict review is now available from the portfolio sync button. It fetches a
  fresh cloud version and lets the user select local/cloud values separately
  for the report, allocation, net exposure limit and each stock label, including
  label removal. The report/import marker stay together as one unit.
- Decisions use the existing upload drain, not a second transport. A durable
  retry journal and immutable recovery copy preserve the decision across lost
  responses/reload; the live local portfolio is not replaced until a matching
  cloud ACK. Stale local input requires a new review, and renewed cloud
  conflicts go back through the server's version guard.
- A status persistence failure now throws instead of emitting a false synced
  state. Account/passcode v2 ACKs apply only the submitted labels, never an
  unsolicited response tag map.
- Account requests now carry the intended account ID. The server rejects a
  missing identity (428) or a cookie for a different account (409) before
  reading/writing portfolio or sharing data, including first writes with no
  prior cloud version. Successful/data-bearing replies echo the confirmed ID.
- Client requests and queue attempts capture the existing local/session login
  identity and recheck it after asynchronous boundaries. A switch in this or
  another tab, logout, or disagreement between the two identity caches prevents
  applying an old receipt, cloud data, conflict backup or failure status. Same
  account profile refreshes do not invalidate uploads. No auth reset is added.
- Portfolio content, pending/ACK state, cloud baselines, recovery records and
  passcodes now use explicit local/account namespaces. A mounted board binds
  its reads/writes to one namespace; switching accounts remounts its UI.
  Inactive queues are retained and resume when the original account returns.
- Legacy global content is not automatically assigned to whoever signs in.
  The owner confirms the destination account, then uses the existing per-field
  review and ACK-gated drain. The unowned source remains untouched. Ownership
  confirmation tracks the reviewed source version, so later old-tab changes
  require another review instead of being silently uploaded or hidden.
- Shared session probes now return one guarded result to every caller. A
  delayed probe cannot revive a logged-out account or replace a newer login.
  Cross-tab identity disagreement triggers confirmation, with focus/reconnect
  and manual retry; temporary errors do not delete identity or portfolio data.
- The fixed Graph mailbox relay and setup endpoints now require the explicitly
  configured mailbox owner, an authenticated session and matching intended
  account ID before contacting Microsoft. Sensitive responses are no-store.
  The import checks the response account; the setup wizard drops stale replies
  and displayed credentials after an account switch. Same-account identity
  refreshes do not interrupt the setup flow.

No new provider, dependency, automatic data reassignment, private-data export or production data
repair is included. Status/base fields contain identifiers, not holdings.
Request/attempt fingerprints stay in memory; conflict review journals contain
private originals and a local comparison fingerprint, only in browser storage.
The account-local legacy-review marker also retains the reviewed source
fingerprint; it is private data and must not enter diagnostic exports.
Neither form is included in metadata exports or logs.

## Evidence

- Existing 49 page/database/settings behavior tests pass.
- 61 portfolio/mailbox behavior tests pass against the actual client modules, queue,
  both routes and shared versioned store. Redis atomicity is simulated in memory;
  this is not a test against a running Redis server. Total behavior tests: 110.
  Account tests cover switched cookies on every action, missing intent, missing
  response identity, late ACK/conflict/failure, same-tab and cross-tab switches,
  explicit logout, profile refresh and the final queue apply boundary.
- Three isolated Edge/Playwright tests pass against the local app. The first covers two successive
  edits while an ACK is held, a remote pull during pending work, exact eventual
  upload, no status-ping write loop, clean reload, remote label deletion with
  an older timestamp, and reload after a third edit that conflicts with another
  device. The conflict preserves both versions; the test opens the review on
  desktop and 390px mobile, cancels without writing, retries a decision made
  stale by a new cloud edit, then verifies local input stays intact before ACK
  and confirms convergence and a quiet reload. Five requests include the two
  conflicts; no page errors or
  React cross-component render/update warnings.
- The second browser test covers A-to-B-to-A with A's ACK held in flight, B's
  separate edit, A retry, explicit legacy ownership confirmation/cancellation,
  no local replacement before ACK, retained originals and clean reload with
  a stale per-tab account cache. The ownership dialog fits the 390px viewport.
  The third covers the actual email setup UI: same-account storage refresh
  continues polling; a switched-account late token is not displayed or stored.
- Mailbox route tests use synthetic identity and Graph responses only. They
  reject missing owner configuration, non-owner accounts, stale account intent,
  signed-out and temporarily unconfirmed sessions before any Graph access.
- TypeScript, lint, production build, `verify:account`, and
  `verify:sync-pending-domains` pass. Source checks are not device acceptance.

Run behavior tests with `npm run test:sync`. To reproduce the browser test,
start a local server on port 3007, then run
`node --test scripts/portfolio-browser.test.mjs` with Playwright available.
Optional environment variables: `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHANNEL`,
`PORTFOLIO_TEST_URL` (localhost only), and `PORTFOLIO_TEST_SCREENSHOT`.
The browser uses a fresh profile and intercepts all APIs; it does not read or
write any production account. Synthetic screenshot stays under `.local/`.

## Not Yet Complete

- Do not deploy this checkpoint until the remaining gates below are resolved.
  Manual per-field review handles conflicts; automatic three-way merging is
  not required for this stage's non-overwrite guarantee.
- Recovery records currently use localStorage and retain private originals.
  Large/repeated conflicts may reach its quota. These failures must retain
  pending; capacity management and an explicit recovery path for an interrupted
  local apply remain rollout work. A failed apply is journaled and blocked from
  further automatic uploads; it must not be declared converged.
- Audit unreadable/corrupt ordinary content and queue state, not only conflict
  journals: display-loader empty/default fallbacks must never authorize a
  destructive clean pull or upload. Ordinary multi-key local writes also need
  interruption/recovery coverage before rollout.
- Before enabling the fixed mailbox integration, set server-only
  `ZHINOTES_PORTFOLIO_EMAIL_OWNER_EMAIL` to the owner's allowed ZhiNotes login
  email. Do not infer it from the Graph sender or the first allowlisted account.
  Missing ownership configuration disables mail import/setup, not manual
  file imports or account sync. No production configuration was inspected or
  changed in this batch; confirm ownership before release.
- Exercise the actual Lua script against isolated Redis before rollout, and
  test protocol upgrade/rollback. Existing clients will need refresh; reverting
  to the old unguarded server would reintroduce the overwrite hazard.
- Full Stage 1 domain coverage and real same-account physical A/B acceptance
  remain open. Simulated clients and this isolated browser are not that result.
- This batch is local only; no deployment or production-device result claimed.
