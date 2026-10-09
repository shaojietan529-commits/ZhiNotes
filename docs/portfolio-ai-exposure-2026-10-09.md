# Portfolio AI Exposure

## Scope and Calculation

- Manual per-stock coefficient after Tag, accepting finite numbers in [-1, 1].
- A blank coefficient is unset, contributes zero, and is excluded from the filled count. Explicit zero is a filled value.
- Total percentage = sum(signed NMV / GMV Allocation * coefficient) * 100. Shorts have negative weights. The total itself is not constrained to [-100%, 100%].
- Example: a 10% long at 0.8 contributes +8%; a 5% short at 0.8 contributes -4%; combined contribution is +4%.
- Tag and Country analysis show the same contribution after Gross, in both allocation percentage and dollars, including expanded stocks and total rows. Groups are not re-normalized to their own gross.
- Coefficients are keyed by the report's normalized stock key, independent of daily snapshots and automatic tag suggestions. New reports do not delete coefficients for exited stocks.

## Persistence and Compatibility

- Reuses existing account/passcode portfolio sync and native IndexedDB transactions. No extra service, timer, credentials or infrastructure.
- Local save and pending upload remain atomic. The existing version guard, exact ACK and per-field conflict review cover the new map.
- Shared portfolios show coefficients read-only. Account switching does not share local values.
- The optional new storage key is compatible with existing IndexedDB and legacy scoped records. Absent coefficients are not treated as an explicit clear.
- An old client's missing-field upload receives 428 when cloud coefficients exist. Upgrading pending old-client input initializes only the previously unknown AI field from the cloud, keeping the original version guard for other edits.
- An upgraded synced client sends an explicit map; clearing a coefficient removes that key. Concurrent stale writes still require conflict review.
- Before first cloud initialization, editing an unknown AI field is blocked rather than risking an overwrite of unseen values. Existing local values remain editable offline.

## Verification

Verified locally on the isolated feature branch based on production commit `4ec78944d1657d6cb5b4f03cd3749fb84b73a2f3`:

- `npm run lint`: passed.
- `npm run build -- --webpack`: passed (webpack used with the shared local dependency installation).
- `npm run test:sync`: 132 passed, including math, range checks, old-client rejection, clearing, ACK races, account isolation and conflict choices.
- `npm run verify:account` and `npm run verify:modules`: passed.
- Browser suite: 16 passed across `portfolio-ai-exposure.browser.test.mjs`, `portfolio-browser.test.mjs`, `portfolio-local-storage.browser.test.mjs` and `portfolio-tag-handoff.browser.test.mjs`.
- Separate native storage feasibility test: passed.
- Browser checks cover desktop/mobile entry, totals, grouping, daily report import, independent-context handoff, refresh retention, sharing and pending old-client upgrade.

Run the browser suite against a local build with `PORTFOLIO_TEST_URL` and `PLAYWRIGHT_MODULE` pointing to the local server and installed Playwright package. `PLAYWRIGHT_CHANNEL=chrome` uses a fresh headless Chrome context, not a user's profile.

All business APIs were intercepted with synthetic data. No real account, holdings or credentials were read or modified. This is not production or physical-device acceptance. Production publication requires separate confirmation.
