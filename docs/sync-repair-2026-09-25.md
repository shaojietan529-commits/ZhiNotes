# Stage 1 sync repair, 2026-09-25

## Scope

Repair existing account sync; do not replace the editor, database or sync engine.
No user content, account identifiers, credentials or raw browser dumps are included
in this report or the synthetic fixtures.

## Fixed

- Page/database pending IDs whose local records are missing remain retryable and
  visible, instead of silently being removed. Cache eviction markers never become
  cloud deletions. Healthy rows and download recovery can still proceed.
- Upload ACKs no longer advance the page download cursor or watermark. Receiving
  confirmation of an upload is not evidence of downloading another device's edits.
- Settings can use the existing email account session and existing Upstash Redis
  instance. The original Supabase workspace path remains supported. The official
  Redis SDK writes separate hash fields for separate settings, so concurrent
  changes to different preferences do not replace the whole settings object.
- Settings ACKs clear only sync-log entries included in the request snapshot;
  newer local edits remain pending. Cloud restoration refuses to replace pending
  local input. Unconfirmed sessions preserve login and local input.
- Visible clients check settings every 30 seconds with the existing tab lease and
  in-flight deduplication. Unchanged settings do not reapply. Sidebar, favorites,
  page view, calendar month and meeting preference hooks reload applied settings.

## Evidence

- `npm run test:sync`: 19 behavioral tests. The page/database tests execute the
  real modules with synthetic storage/network. The settings tests execute the
  real route, validators, drain and SQLite acknowledgement queries. Fake Redis
  and synthetic accounts isolate tests from production.
- Pre-fix page/database code: 6 of the 10 new tests failed. After repair: 10 pass.
- `npm run verify:account`, `verify:local-use-readiness`,
  `verify:sync-pending-domains`, `verify:two-device-sync`, `verify:meeting-import`:
  passed. These source/synthetic checks do not establish physical-device sync.
- TypeScript, lint and production build passed. Local browser check: daily and
  meeting routes render; navigation works; no console errors observed.
- Before release, read-only production observation found nine settings pending
  and no bound Supabase workspace, despite a valid email account. Page and
  database pending counts were zero. An existing portfolio retry recovered when
  its module opened; no manual overwrite or cache clearing was used.

## Still required before Stage 1 acceptance

- Confirm the deployed commit and the existing settings queue draining with ACKs.
- Same-account physical A/B checks for new/edit/rename/delete, offline edits,
  reconnect, reload, and sign-in on each required domain. A synthetic A/B test is
  not a substitute for this evidence.
- Review simultaneous same-record edits and late ACKs in page/database/portfolio
  paths separately; the snapshot cutoff in this change applies to settings.
- Attachments, broad all-domain cloud migration, and automatic conflict merging
  are not claimed complete by this patch. Do not clear caches until pending work
  is accounted for. Do not mark the overall Stage 1 goal complete yet.
