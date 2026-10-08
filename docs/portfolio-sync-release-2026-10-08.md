# Portfolio label sync release checkpoint: 2026-10-08

## Scope

- Baseline: production `99651a1086b2d3d72fe70bd6a2212b1d94a0e961`, deployment
  `dpl_BJNK2gatYZ6K7ULpdBvA6vkYUcHz`.
- Isolated branch: `codex/portfolio-tag-sync-release-20261008`.
- Includes the 15 portfolio-related commits through `6803d239`, followed by
  cherry-picks of `a7e335be`, `e6039169`, and `77a333b1`.
- Excludes 32 unrelated accumulated commits on the shared development branch.
- Fixes startup tag loss, late acknowledgements, concurrent writes, account
  isolation, interrupted saves, and explicit conflict/recovery review.
- Local portfolio content, pending changes and recovery copies now commit in
  one native IndexedDB transaction. Original caches are retained, not deleted.
- Cloud writes compare revisions atomically. Exact retries after a lost reply
  are acknowledged without overwriting a newer revision.

## Local verification on this release branch

- `npm run test:sync`: 124/124 passed.
- Native Redis/actual SDK and Lua: 11/11 test entries passed.
- Chrome: 14/14 browser tests passed, zero page errors in the tag handoff test.
- Edge: 14/14 browser tests passed, zero page errors in the tag handoff test.
- `npm run lint`, `npm run build`, `npm run verify:account`,
  `npm run verify:sync-pending-domains`, and `git diff --check` passed.
- Mobile conflict dialog and desktop portfolio screenshots inspected. These
  are viewport checks, not physical mobile-device acceptance.

All test accounts and content are synthetic. All application API requests in
the browser tests are intercepted, including email and AI. Local Redis uses a
private temporary Unix socket. No production portfolio data was read or written.

The tag handoff test can inspect the exact preview client using
`PORTFOLIO_PREVIEW_ASSETS=1` and a `PORTFOLIO_TEST_URL` under the project's
deployment hostname. A temporary Vercel share link, if needed, must not be logged
or committed. This is client verification with a simulated cloud, not proof of
managed-cloud persistence or two real devices.

## Release gates

- Vercel connection works again; the historical authentication block is cleared.
- Production has no `ZHINOTES_PORTFOLIO_EMAIL_OWNER_EMAIL` setting. Confirm the
  owner's ZhiNote login email before setting it; never guess from an allowlist.
  Without it, email auto-import is safely disabled; manual import is unaffected.
- Preview build, preview handoff check, production release, and physical-device
  acceptance are still pending at this checkpoint.
- Production must use production environment settings, not blindly promote a
  preview that was built with preview configuration.
- Close or reload old tabs during rollout. Do not clear browser storage.
- After new-store writes, do not roll back to a localStorage-only client. Retain
  the new reader and fix forward or use read-only recovery.
- Completion requires: same account on two real devices; tag a newly added
  stock on A; B receives it; B refreshes and retains it. The owner performs these
  production data operations. Isolated browser contexts do not satisfy this gate.

This checkpoint supersedes earlier deployment/authentication status in
`portfolio-sync-2026-09-25.md`; it does not claim the task is complete.
