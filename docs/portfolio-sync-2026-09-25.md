# Stage 1: portfolio upload acknowledgements

## Completed Locally

- Reuse the existing portfolio drain for initial sync, debounced edits and
  manual retries. Overlapping drains in one tab share a request.
- Capture a unique pending revision, request identity and memory-only local
  state fingerprint. An older ACK or failure cannot clear/regress a newer
  revision or overwrite labels edited while an upload was in flight.
- Queue local edits immediately after local persistence, before React effects
  or the upload debounce. Pending edits survive reload and remote pulls.
- Apply server-merged labels only with a matching local revision. Unreadable
  local storage leaves the work retryable rather than declaring success.
- Preserve the edit timestamp on retries. Already-converged initial pulls do
  not generate another upload. Status-only storage pings do not trigger writes.
- Reuse one explicit ACK validator for both account and legacy passcode sync.
  The passcode route now returns an ACK only after its storage write succeeds.
- Guard async sync UI callbacks while viewing a friend's read-only portfolio.
- Persist and notify tag edits outside React state updater functions. A
  delayed Book/AI result reads the latest local labels, preserving manual edits
  made while the request was running.

No new provider, dependency, migration, private-data export or production data
repair is included. The new status fields contain identifiers, not holdings;
the comparison fingerprint stays in memory and is never logged or persisted.

## Evidence

- Existing 49 page/database/settings behavior tests pass.
- 18 additional portfolio behavior tests pass against the actual client
  modules, local queue and passcode route with synthetic storage/network.
- Isolated Edge/Playwright test passes against the local app: two successive
  edits while an ACK is held, a remote pull during pending work, exact eventual
  upload, no status-ping write loop, clean reload, and immediate reload after a
  third local edit. Three revisions produce three uploads; no page errors or
  React cross-component render/update warnings.
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

- Both portfolio server routes still use read/merge/write without an atomic
  version precondition. Competing devices can overwrite each other's snapshots
  or same-stock labels. The next batch must address that server boundary and
  preserve conflicting versions, not claim the client ACK fix solves it.
- Tag removal still needs a server-side deletion-aware merge strategy; the
  current tag union can resurrect a deleted label.
- Portfolio account-switch isolation, account-bound receipts and shared-tab
  race behavior require further verification.
- Full Stage 1 domain coverage and real same-account physical A/B acceptance
  remain open. Simulated clients and this isolated browser are not that result.
- This batch is local only; no deployment or production-device result claimed.
