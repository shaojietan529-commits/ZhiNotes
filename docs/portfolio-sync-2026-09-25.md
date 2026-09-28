# Stage 1: portfolio acknowledgements and concurrent writes

## Published New-Position Tag Failure (2026-09-28)

The current public `/portfolio` HTML identifies deployment
`dpl_BJNK2gatYZ6K7ULpdBvA6vkYUcHz`. Its public client bundles still use the v1
portfolio receipt and unscoped localStorage keys, not the version-bound local
implementation below. Deployment metadata through the Vercel connector requires
reauthentication; no deployed Git SHA was confirmed.

`scripts/portfolio-tag-handoff.browser.test.mjs` reproduces a specific user-facing
failure with the published UI: while the initial upload reply is delayed, enter
a label for a new position. Device A displays that label and "synced", but the
simulated server still has no label and a fresh, independent device B displays
"unclassified". The startup sync-ready gate skips queueing the intervening edit;
the earlier upload completion does not schedule it. This is a reproduced client
failure, not a claim to have inspected the owner's actual server holdings.

The same check against the current local production build passes: one upload,
the expected label on both clients, and the label retained after device B reloads.
Both runs have zero page errors. Each device is a separate fresh Chrome context;
every API is intercepted, email/AI APIs are refused, and only public UI assets can
leave the browser. No production session, holdings or cloud writes are used.

Run with `PLAYWRIGHT_MODULE=/path/to/playwright node --test
scripts/portfolio-tag-handoff.browser.test.mjs` against loopback port 3007.
Optional `PORTFOLIO_TEST_URL=https://zhi-note.com PORTFOLIO_PUBLIC_ASSETS=1`
reads the published UI with the same synthetic API boundary. Failure there is an
intentional regression signal until the client is fixed and released.

This check does not close the native-storage concurrency gate below, authorize a
cache migration, or constitute a production/physical-two-device acceptance.
Only this regression and evidence were added on September 28; no app fix was
deployed in this diagnostic pass.

## Native Redis Write Verification (2026-09-26)

An independent server fix now handles replay of the *same EVAL request* after
its response is lost. The installed Upstash SDK can retry the command with its
original comparison value even though Redis already committed the first call.
Both routes previously returned 409 in that case. The production Lua now
accepts either the expected original value or the exact requested new value;
any other intervening value still returns a conflict without writing.

- `scripts/portfolio-native-redis.test.mjs` runs the actual account/passcode
  routes, installed Upstash SDK and production Lua against a fresh local
  Redis 7.2.12 process. Only authentication is synthetic. A loopback HTTP adapter
  forwards SDK requests to the real Redis CLI over a private Unix socket.
- Ten scenarios (eleven Node test entries including the parent) pass: racing
  writes, SDK-level lost-response replay, total response loss and explicit
  retry, a third write between initial commit and replay, and OOM refusal,
  separately for account and passcode modes. Metadata must agree with the
  winning content; missing replies and rejected writes do not produce ACKs.
- The two SDK replay scenarios failed with 409 before the Lua change and pass
  with 200 plus the matching receipt after it. No unconditional overwrite or
  timestamp-based ordering was introduced.
- No production URL, session, mailbox, holdings or credentials are used. Redis
  opens no TCP port, uses no persistence, and is stopped after the test. Its
  own temporary directory is removed. The loopback adapter also closes.
- Redis source was downloaded from the official release archive into ignored
  `.local/redis-native/`, verified against the official SHA-256 and compiled
  there. Nothing was installed globally or added to application dependencies.
  SHA-256: `97c60478a7c777ac914ca9d87a7e88ba265926456107e758c62d8f971d0196bc`.
  Reference: <https://github.com/redis/redis-hashes>.
- Current checks: 124 existing sync behavior tests, 11 native Redis test entries,
  lint, production build (including TypeScript) and `verify:account` pass.
  Browser concurrency still fails as recorded below; no deployment is claimed.

Run with `PORTFOLIO_NATIVE_REDIS_BIN=/absolute/path/to/redis/src node --test
scripts/portfolio-native-redis.test.mjs`. The directory must contain both
`redis-server` and `redis-cli`; this test never attaches to an existing server.
This closes the local native-Lua execution gap, not managed Upstash deployment
verification, disk-failure durability, old-client rollout or real-device
acceptance. The browser-local concurrency gate below is still unresolved.

## Current Working Tree: Native Storage Gate (2026-09-26)

The local concurrency changes are **not release-ready**. The earlier completed
checks below describe the preceding checkpoint, not proof that simultaneous
writers are safe now. Do not push/deploy these working-tree changes as a fix.

- A real three-tab Edge test queues independent label/allocation edits behind
  the same native Web Lock. The second writer can read the pre-edit native
  localStorage value at lock grant and overwrite the first writer's field.
  This remains a failing acceptance test in `portfolio-browser.test.mjs`.
  Lock ownership and a synchronous callback do not establish storage freshness.
- Removed the app entirely to isolate the cause. In one 100-round native
  read/increment/write experiment, 74 rounds read a stale value. A second,
  committed-field experiment retained only 134/200 localStorage updates, versus
  200/200 using native IndexedDB read/write transactions. Counts vary with
  scheduling; they are observations, not a predicted production failure rate.
- `scripts/portfolio-storage-primitives.test.mjs` reproduces that comparison in
  fresh tabs, with synthetic content and every navigation intercepted. It also
  checks transaction abort preservation and continuing after another tab closes.
  The IndexedDB assertion is a feasibility test, **not an app migration, cloud
  integration test or physical-device acceptance**. No dependency was added.
- The browser storage standard explicitly does not specify cross-agent-cluster
  locking for localStorage: <https://html.spec.whatwg.org/multipage/webstorage.html>.
  Native transaction semantics: <https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction>.
- The async local-write callers, account-at-grant guards and failure UI are
  still uncommitted work. Reuse the useful parts, but do not keep adding locks,
  sleeps or a bespoke localStorage coordination protocol to chase this race.
- Independently fixed disabling passcode sync: retain content, pending revision,
  failure/review metadata and backups; invalidate the old in-flight attempt.
  A late ACK cannot clear it, and enabling sync resumes through the existing
  ACK-gated drain. A new behavior test covers this sequence.
- Local-save completion and durable queue notifications now update the sync
  button immediately; it must not retain the previous "synced" label while
  the new edit is waiting to upload. Failed enabling of passcode sync is caught
  and shown instead of producing an unhandled rejection.
- Current checks: 60 portfolio client/queue behavior tests and all five existing
  isolated app UI regressions pass. TypeScript, lint, production build,
  `verify:account` and `verify:sync-pending-domains` pass. The new simultaneous
  writer app test still fails; these green checks do not supersede it.

### Owner Decision Requested

An asynchronous question asks permission to move **only the portfolio local
cache** to native IndexedDB transactions, retaining old data and leaving the
cloud provider and account system unchanged. No answer has been received yet;
no application IndexedDB migration has been implemented or activated.

Proposed boundaries if approved:

1. Read, merge and commit content/pending/baseline/recovery state in one native
   transaction. Publish saved UI and notifications only after transaction
   completion, never merely after the first successful write request.
2. Treat the old cache as a preserved import/recovery source, not a second
   concurrently writable authority. Never infer legacy ownership from login.
3. Validate per-account import before activation. Retain malformed sources and
   unconfirmed changes for explicit recovery; no delete/reset or empty fallback.
4. Keep network work outside local transactions and reuse the existing cloud
   protocol/drain. Reuse identifiers-only cross-tab notifications for refresh.
5. Validate quota/abort/reload, late ACK, independent and competing edits,
   account switching and old-client coexistence in the actual app. A rollback
   must keep reading the new store or enter read-only recovery; reverting to
   old localStorage-only code could hide newer unuploaded data.
6. Local/preview first; production rollout remains separately gated. Keep the
   real physical same-account A/B acceptance requirement unchanged.

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
- Ordinary uploads, initial reconciliation and clean pulls now use one strict
  local content snapshot. Invalid JSON, malformed labels/numbers/timestamps or
  unreadable storage cannot become empty/default values that authorize upload
  or cloud replacement. Only genuinely absent fields receive defaults.
- Unreadable queue metadata blocks automatic upload and clean pulls, retaining
  its exact raw value. An explicit review keeps that value in its immutable
  recovery record before rebuilding pending state; cancellation changes neither
  the raw queue nor the live portfolio. Legacy manual-review state still exposes
  the recovery entry even if its count was absent.
- An unfinished conflict-resolution apply now exposes the existing review
  dialog after reload. It compares the saved-before, current-local and fresh
  cloud versions, including label deletion. Per-field recovery uses the same
  ACK-gated queue; newer input remains protected, and older recovery copies are
  retained, including interrupted journals from older releases.
- Ordinary edits now commit their full content, timestamp and pending marker
  with one native localStorage write under the existing account namespace.
  File/mail imports and manual/Book/AI labels use this same path. The report and
  mail import marker are one unit; manual imports preserve the last processed
  mail marker to avoid duplicate auto-import. No provider/dependency was added.
- A clean pull commits content plus cloud baseline together. Applying a
  resolution ACK commits content, queue clearance and retry-pointer retirement
  together, so failed storage writes no longer need a multi-step rollback.
  Status/conflict notifications are emitted only after the native commit.
- The additive state record preserves the earlier individual keys unchanged.
  Once present it is authoritative; unreadable state never falls back to stale
  keys. Decoded state is cached by its exact raw value, not by a stale timestamp.
  Status-only record changes do not trigger cross-tab content refresh/upload.
- Failed manual saves keep the tag/allocation/limit input open and show an
  explicit unsaved warning instead of displaying the draft as persisted.
- Own-portfolio pulls now capture a private memory-only checkpoint of content,
  queue, baseline and recovery state before awaiting the network. They recheck
  it before applying and within the local batch. A local edit, another tab's
  commit or an ACK invalidates the old response even after pending is clear.
  Only the latest-started own pull may apply; late errors cannot regress newer
  confirmed status or clear a replaced passcode. An invalidated startup read
  retries once immediately, then uses the existing polling/retry cycle.

No new provider, dependency, automatic data reassignment, private-data export or production data
repair is included. Status/base fields contain identifiers, not holdings.
Request/attempt fingerprints stay in memory; conflict review journals contain
private originals and a local comparison fingerprint, only in browser storage.
The account-local legacy-review marker also retains the reviewed source
fingerprint; it is private data and must not enter diagnostic exports.
Neither form is included in metadata exports or logs.

## Evidence

- Existing 49 page/database/settings behavior tests pass.
- 73 portfolio/mailbox behavior tests pass against the actual client modules, queue,
  both routes and shared versioned store. Redis atomicity is simulated in memory;
  this is not a test against a running Redis server. Total behavior tests: 122.
  Account tests cover switched cookies on every action, missing intent, missing
  response identity, late ACK/conflict/failure, same-tab and cross-tab switches,
  explicit logout, profile refresh and the final queue apply boundary.
  Atomic-save tests cover a single native commit, quota failure before/after
  additive adoption, retained old keys, deferred notifications, reload/retry,
  newer edits surviving old ACKs, cloud baseline/content consistency, damaged
  state fail-closed behavior and distinguishing data from status-only events.
- Five isolated Edge/Playwright tests pass against the local app. The first covers two successive
  edits while an ACK is held, a remote pull during pending work, exact eventual
  upload, no status-ping write loop, clean reload, remote label deletion with
  an older timestamp, and reload after a third edit that conflicts with another
  device. The conflict preserves both versions; the test opens the review on
  desktop and 390px mobile, cancels without writing, retries a decision made
  stale by a new cloud edit, then verifies local input stays intact before ACK
  and confirms convergence and a quiet reload. It also rejects a manual save
  with synthetic full storage, keeps the unsaved input open and retries it.
  A failed atomic resolution commit after ACK retains the complete old data
  and queued decision. A separately seeded legacy interrupted journal then
  exercises three-version recovery on desktop/390px mobile and restores the
  saved-before version only after ACK. A damaged queue is retained through
  cancellation, then explicitly repaired with its raw value archived. No page
  errors or React cross-component render/update warnings were observed.
- The second browser test covers A-to-B-to-A with A's ACK held in flight, B's
  separate edit, A retry, explicit legacy ownership confirmation/cancellation,
  no local replacement before ACK, retained originals and clean reload with
  a stale per-tab account cache. The ownership dialog fits the 390px viewport.
  The third covers the actual email setup UI: same-account storage refresh
  continues polling; a switched-account late token is not displayed or stored.
- The two new account/passcode browser cases first reproduced an older pull
  replacing a newer cloud label on the unpatched app. They now cover reordered
  clean pulls, edits acknowledged before an old read/error returns, an actual
  second tab saving while the first tab's pull is held, startup edits, and quiet
  confirmed reloads. All API data remains synthetic. Checkpoint behavior tests
  also cover legacy adoption, queue/base/conflict-only changes, aborted batches,
  unreadable state and account isolation. This is not simultaneous-writer or
  physical two-device acceptance.
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
  pending; capacity management and near-limit input latency remain rollout
  work. Failed atomic commits retain the queued decision for retry; legacy
  partially applied journals remain blocked until explicit recovery.
- One native write prevents partial records, but is not a cross-tab
  read/modify/write lock. The optimistic snapshot check does not close the
  race between checking and committing in separate browser processes. Add
  serialization using a native browser primitive before enabling this format
  in production, and test simultaneous edits. Delayed clean pulls are now
  guarded and tested, but the final native write still needs that same lock.
  Old clients/rollback builds must not silently keep writing stale individual
  keys after the new format is present; rollout/rollback remains gated.
- Corrupt content is now blocked from synchronization, but its repair UI and
  recovery into an empty cloud account remain open. Current queue recovery
  requires valid local content and a readable nonempty cloud version.
- Before enabling the fixed mailbox integration, set server-only
  `ZHINOTES_PORTFOLIO_EMAIL_OWNER_EMAIL` to the owner's allowed ZhiNotes login
  email. Do not infer it from the Graph sender or the first allowlisted account.
  Missing ownership configuration disables mail import/setup, not manual
  file imports or account sync. No production configuration was inspected or
  changed in this batch; confirm ownership before release.
- Actual Lua execution against isolated Redis is now covered above. Verify
  the managed-provider deployment and protocol upgrade/rollback before rollout.
  Existing clients will need refresh; reverting
  to the old unguarded server would reintroduce the overwrite hazard.
- Full Stage 1 domain coverage and real same-account physical A/B acceptance
  remain open. Simulated clients and this isolated browser are not that result.
- This batch is local only; no deployment or production-device result claimed.
