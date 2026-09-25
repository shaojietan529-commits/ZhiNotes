# Stage 1: concurrent page/database edits

## Scope

Continue repairing the existing account sync. No replacement sync engine,
database migration, new provider, auth change, cache reset or user-data repair.
All behavioral fixtures use synthetic content and in-memory storage/network.

## Changes

- Capture upload records and their matching durable log IDs before the request.
  A late ACK cannot consume subsequent edits, even with identical timestamps.
- Recheck the current row and the debounced queue before removing its pending
  pointer. Failed local verification leaves the pointer retryable.
- Reject ACK identifiers outside the request and duplicate/overlapping IDs.
  Partial ACKs retire only the explicitly confirmed revisions.
- Remove the batch-level ID-based cleanup that bypassed revision checks.
- Limit snapshot reads to requested page IDs/database keys. Explicit upload
  snapshots include matching retry-backoff entries; background retry selection
  retains its original backoff behavior.
- Reuse the existing knowledge-sync pending guard at page, page-metadata and
  database write boundaries. A remote pull cannot replace unsent local edits,
  including deletes, failed uploads and in-flight changes.
- Return applied records from those queries and broadcast only that subset.
  Rejected remote metadata must not briefly overwrite titles in another tab.

## Verification

`npm run test:sync`: 49 passing behavior tests across the real client modules,
settings route/drain and SQLite queries. Coverage includes:

- Same-timestamp rename, body changes and delete during an upload.
- Old queued snapshots, reversed ACK order across two simulated clients, edits
  during local ACK persistence, and local read failures after cloud success.
- Missing/duplicate/foreign/partial ACKs and offline edit retry after reconnect.
- Pending page metadata/body and all four database record types surviving pulls.
- Successful application to clean rows, convergence after ACK, scoped reads,
  and cross-tab notifications containing only applied records.

The previous source fails the concurrent-edit regressions. These tests do not
use production accounts or establish physical two-device acceptance.

## Remaining Gate

- Verify release status and a read-only authenticated browser check after push.
- Run real same-account A/B creation, edit, rename, delete, offline/reconnect,
  reload and account-isolation acceptance. No second physical-device result is
  claimed here.
- Portfolio same-record concurrency and server conflict resolution need their
  own review. This patch does not implement automatic merging of conflicting
  text or claim the broader all-domain cloud migration is complete.
