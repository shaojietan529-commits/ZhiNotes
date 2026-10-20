# Account Realtime Sync

Status: local validation completed; production rollout authorized on 2026-10-20.
Deployment status and exact version are recorded separately in the release proof.
Neither authorization nor local validation constitutes production acceptance.
Base: `d8e0537d955cf11d57b43f0161b00f2ff93f5f14`.

## Behavior

1. Edits still save locally first. Offline and unacknowledged writes remain queued.
2. Successful account-sync writes for pages, databases, and portfolio publish a
   small account-scoped notification through the existing Redis service.
3. Visible, online clients listen through an authenticated streaming route and
   read the changed domain through its existing authenticated sync API.
4. Every confirmed connection triggers catch-up. Existing polling remains the
   fallback for a missed notification or an unavailable streaming service.
5. Sidebar page/database pending totals count distinct entities across the
   durable log and queues. This does not remove, acknowledge, or repair pending
   writes. The user's actual "50 pending" records were not inspected or cleared.

Notification payloads contain only an account ID and a domain name. They never
contain page bodies, titles, portfolio data, or credentials. Redis credentials
stay on the server. The endpoint rejects a different account ID and cross-site
requests, reauthenticates on reconnect, and stops upstream work on cancellation.

The editor waits 500 ms after the last edit before its existing local-save
callback. Page/database cloud batching waits 400 ms; portfolio batching waits
500 ms. These are debounce settings, not end-to-end latency guarantees.
Clean open editors accept remote content without generating another edit.
Unflushed or divergent editor drafts are not replaced by a remote refresh.
Page lookup caches are invalidated when a page notification arrives.
Existing reconciliation can still resend an unchanged snapshot; this work does
not claim zero duplicate requests or reduced cloud usage.

## Boundaries

- Portfolio retains its existing version check and conflict flow. A stale
  portfolio write must not silently overwrite the cloud version.
- Pages/databases retain their existing timestamp-based conflict behavior.
  This is NOT simultaneous rich-text editing, CRDT merging, or a guarantee
  against every concurrent page/database overwrite.
- Only the three account-sync write routes publish notifications. Meeting
  imports, ingest, settings, file writes, and other routes retain their existing
  refresh mechanisms. Do not claim all application data is now realtime.
- Hidden tabs, sleeping devices, offline clients, or expired sessions cannot
  receive immediate updates. Foreground/reconnect recovery still applies.
- Notification delivery is best effort. A publish failure never rolls back or
  changes the receipt of a successful durable save.

## Activation and Cost

The server flag `ZHINOTES_REALTIME_SYNC_ENABLED=true` enables both publication
and subscription. It is OFF by default. With the flag off, the new endpoint
returns 204 and clients back off for five minutes; existing sync remains active.
Shorter save delays, count fixes, and editor fixes are independent of this flag.

Local implementation did not create a paid service or change production
configuration, credentials, or real data. The authorized production rollout
enables the flag using the existing service. Reusing that service does
not mean free operation: publication, subscription, catch-up reads, and streaming
function usage can increase the existing bill. A foreground connection lasts at
most about 55 seconds and normally reconnects after 1-1.5 seconds, roughly 64
connections/hour per visible tab. Existing polling has not been reduced.
Actual billing, production proxy buffering, real provider behavior, and broad
latency percentiles have not been measured.

An owner-approved rollout must record the flag state and distinguish verified
provider/streaming behavior from synthetic tests. Turning the flag
off stops new subscriptions/publications; existing streams end within their
bounded lifetime. Do not run a production acceptance write without authorization.

Protocol references:
- [Upstash REST Pub/Sub](https://upstash.com/docs/redis/features/restapi)
- [Vercel streaming functions](https://vercel.com/docs/functions/streaming-functions)

## Validation

Run from this checkout:

```sh
npm run lint
npm run build
npm run test:sync
node --test scripts/account-realtime.test.mjs
npm run verify:sync-pending-domains
npm run verify:editor
node --test scripts/account-realtime.browser.test.mjs
```

The existing AI Exposure browser regression can also target the official site:

```sh
PORTFOLIO_TEST_PRODUCTION_ALLOWED=true PORTFOLIO_TEST_URL=https://www.zhi-note.com \
  node --test scripts/portfolio-ai-exposure.browser.test.mjs
```

Only the two official HTTPS origins are accepted in that mode. All business APIs
remain intercepted with synthetic responses; no real account cookies or data are
used. Results belong to `.local/realtime-production-verification/ai-exposure/`.
This verifies the deployed UI, not production cloud persistence or notification
transport.

The browser test needs Playwright (or `PLAYWRIGHT_MODULE` pointing to an existing
installation) and normal installed Chrome. It uses a new headless browser with
two isolated contexts, synthetic accounts/data, actual Next routes, and an
in-memory Redis REST/PubSub simulator. External requests are blocked. The
portfolio simulator implements the CAS contract; it is not the real Lua engine
or an actual Upstash instance.

Browser artifacts are written to `.local/realtime-verification/`: desktop/mobile
screenshots and `result.json`. They exercise save, notification, second-context
read, refresh, missed-event reconnect, account isolation, portfolio conflict
retention, and open-editor refresh. Normal periodic polling is disabled during
that test to distinguish notification delivery from polling.

These results are synthetic integration evidence only. Production release,
same-account physical two-device stock-tag creation/read/refresh acceptance,
and real-account cloud persistence remain separate gates. Do not mark the
existing portfolio completion reminder done based on these tests.

Local run on 2026-10-20: lint, optimized build, sync regression tests, realtime
unit tests, pending-domain/editor checks, and the two-context browser scenario
passed. The final browser run recorded three portfolio handoffs at 596, 539,
and 585 ms. These are three local samples, not a production latency percentile.
The browser run also checked that receiving a note did not create a new editor
revision. See the generated report for the exact test boundary.
