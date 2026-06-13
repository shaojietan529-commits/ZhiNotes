<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from older model training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code that depends on Next.js internals, routing, build behavior, or config. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ZhiNotes Agent Handoff

## Communication

- The user has a finance background and no coding knowledge.
- Explain coding-related topics in simple, plain language.
- Use analogies when helpful.
- Before changing files, briefly explain what will change.
- After changes, summarize the result in non-technical terms.

## Claude Code Compatibility

- `CLAUDE.md` intentionally imports this file with `@AGENTS.md`; keep both files in the repository root.
- Start Claude Code from the repository root:
  `cd /path/to/ZhiNotes && claude`
- Prefer `rg` for search, inspect existing patterns before editing, and keep changes scoped.
- Do not read, upload, or summarize private user data outside project files unless the user explicitly asks for that specific data.
- Do not enable cloud writes, AI sending, file upload, destructive recovery, database migrations, or external sync without an explicit owner gate.

## Multi-Agent Ownership (Claude Code ⇄ Codex)

Prefer separate worktrees and agent branches when practical. The current shared
branch is `claude/plan-knowledge-management-app-OSoEs`; when both agents are on
this branch, strict file ownership applies.
The user should not need to remember which agent owns each area. Every agent
must read this section, inspect the requested change, and keep itself inside the
correct lane. To avoid git conflicts, edits are divided by file; coordinate
before touching a shared contract.

Before work:

- Read `AGENTS.md` and `CLAUDE.md` from the repository root.
- Run `git status` before editing.
- If the worktree is clean, run `git pull --rebase` before editing.
- If the worktree is dirty, do not pull blindly; first identify whether the
  changes are yours, the user's, or another agent's.

**Codex owns (meeting capture + parsing + local meeting agent):**
- `chrome-extension/**` (popup, content scripts, capture logic, handshake test)
- `src/lib/meetings/**` (e.g. `meetingInviteIntake.ts` — recognition rules)
- `src/app/api/meetings/**` (intake route, server-side link fetch)
- the local meeting Agent (auto record/transcribe/publish), wherever it lives

**Claude Code owns (the Next.js app):**
- `src/components/**` (all shells incl. `MeetingScheduleShell.tsx`, editor, sidebar, page)
- `src/lib/pages/**`, `src/lib/db/**`, `src/stores/**`, `src/hooks/**`
- page cloud sync (`accountPageSync.ts`, `usePageCloudSync.ts`), account, portfolio,
  daily, industry-chain, knowledge-base modules

**Frozen contracts — change BOTH sides together in one coordinated commit:**
- Extension ⇄ app: DOM events `zhihui:intake` / `zhihui:ready` / `zhihui:hello`
  and storage key `zhihui_pending_intake`.
- Parser ⇄ app: the `/api/meetings/intake` response `meeting` object shape
  (topic, organizer, platform, date, time, endTime, durationMinutes, hasJoinUrl,
  joinUrl, joinUrlHost, meetingId, passcode, source, confidence, warnings).
  Codex may improve extracted *values*; do not rename/remove fields without
  updating `MeetingScheduleShell.tsx` (Claude Code's file).
- Meeting job schema/API payloads between ZhiNote and the ZhiHui runner require
  an explicit handoff before either agent changes them.

**Shared files — edit alone in a dedicated commit (keeps rebases trivial):**
- `AGENTS.md`, `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`,
  `scripts/verify-*.mjs`.

During work:

- Edit only files in the owned area for the current task.
- Do not touch secrets, `.env` files, API keys, meeting passwords, iCloud runtime queues, recording files, or private user data unless explicitly instructed.
- If a needed change crosses ownership lanes, stop and leave a handoff note instead of guessing.

Before push:

- Run focused verification for the changed area.
- Run `git diff` and `git status`.
- Run `git pull --rebase` again before pushing.
- If rebase conflicts touch another agent's files, stop and ask instead of resolving silently.
- Push only after summarizing changed files, commands run, and remaining risks.
- Never push directly to `main`, `master`, `production`, or `prod`; push a feature branch such as `codex/...` or `claude/...` and merge intentionally.
- Never force-push the shared branch; keep `npm run build` green and run the
  relevant `npm run verify:*`.

## Project Context

- Project name: ZhiNotes.
- Current goal: web-based modular investment research platform.
- Product direction: local-first, Notion-like knowledge base optimized for investment research, with modules that can be added over time.
- Notes/pages are the foundation; databases, reports, files, company research, meetings, portfolio, projects, research graph, AI, and sync are modular surfaces.
- Current GitHub branch: `claude/plan-knowledge-management-app-OSoEs`.
- Current verified handoff commit: `ad7c406 feat: workspace polish — daily/meeting templates, chain inline rename, verifier`.

## Current Verified State

- Core shell: Next.js 16 app with local browser storage and module navigation.
- Primary workspaces (sidebar top-level): 每日纪要 (`/daily`, month calendar over date-titled child pages with a Notion-style Date/要点/Summary template; note chips drag between days to rewrite the 日期 property), 产业链研究 (`/industry-chain`, hierarchical page-tree board where every node is a real page, with inline double-click rename), ZhiHui (`/schedule`, month calendar over meeting pages carrying date/time/platform/organizer properties; manual add only — auto record/transcribe/publish is a gated placeholder for the Codex meeting agent), 知识库 (`/knowledge-base`, free-layout card grid where each card is a real page — intended one card per company accumulating research; cards drag to reorder via fractional positions, drop on a card center to nest as sub-page, per-card/board 导入文件 imports HTML/PDF/Excel/Word/PPT etc. via the existing `savePageFile` IndexedDB store + `buildFileLibraryPageContent` file pages — local-only, no upload/AI). Each is backed by a singleton local root page via `src/lib/pages/moduleWorkspaces.ts` (`getModuleRootId` dedupes concurrent lookups and adopts the smallest-id title match, so strict-mode double effects cannot create duplicate roots); all other modules live in a collapsible "备选模块" section. Verifier: `npm run verify:module-workspaces`.
- Page layout: Notion-style clean surface — cover → breadcrumb + favorite star + ••• actions menu → icon/title → properties → page comments → body → backlinks. All page-level actions live in `PageActionsMenu`. Editable page properties (`pages.properties` column, additive migration via `ensureColumn`) support text/number/date/select/checkbox/url.
- Notes/pages: page tree (hides the three workspace roots), breadcrumbs, icons, backlinks, comments, version history, diff route, Tiptap editor, slash commands, keyboard shortcuts, toggle, callout, table of contents, cover, and child-page creation workflow.
- Page hierarchy UI: the old large in-page "页面结构" block was replaced by a compact Notion-style breadcrumb. Paths of 3 levels or less show fully; deeper paths show root / ... / parent / current, and the ellipsis can expand hidden middle levels.
- Notes roadmap: `/modules/notes` includes a Notion parity panel covering page hierarchy, file-to-page, database UX, synced blocks, cloud, and AI boundaries.
- Databases: table, list, kanban, calendar, gallery, timeline, chart, form, feed, formulas, rollups, button drafts, view rules, grouping, row/page peek, field descriptions, duplication, ordering, summaries, freeze columns, and delete confirmations.
- Files/reports: local metadata routing for HTML, Markdown, PDF, Excel, Word, PowerPoint, notebooks, archives, media, transcripts, SEC/XBRL-style research text, and local file pages.
- ZIP preview: metadata-only central directory preview is implemented in the Files module. It shows counts, extension groups, compressed size, destination routing, exportable JSON, and a confirmation queue. It does not extract files, read entry bytes, create pages/databases, upload, or call AI.
- Web beta: auth, workspace, sync, file presign, audit, permissions, restore, and migration routes exist as gated contracts; production cloud behavior remains owner-gated.
- Multi-account login: email-code auth (`/account` page, `/api/account/*`, `src/lib/account/server.ts`) backed by the existing KV store + Resend; inactive (501) until `RESEND_API_KEY` and `ZHINOTES_ACCOUNT_ALLOWED_EMAILS` are set. Codes are hashed/single-use/rate-limited; sessions are revocable httpOnly cookies (90d sliding). Owner setup + China-access (Cloudflare) plan: `docs/multi-account-china-access.md`. Verifier: `npm run verify:account`. Production: deployed on Vercel behind Cloudflare-proxied `zhi-note.com` (owner-configured); China reachable.
- Account-scoped portfolio sync + sharing: `/api/portfolio/account-sync` (session-gated) stores one cloud copy per account email and supports read-only sharing to allowlisted emails (`share-add/remove/shares` actions, reverse index, server-side tag union). Signed-in browsers auto-use account sync in PortfolioBoardShell (passcode mode `/api/portfolio/sync` remains the fallback); a header selector switches to a friend's shared portfolio in a strictly read-only view (no localStorage writes, no pushes, mutating actions guarded by `viewingOwnerRef`). Share management UI lives on `/account`.
- Account-scoped page cloud sync: `/api/pages/account-sync` (session-gated) stores one cloud copy of the page tree per account email (per-page KV records + manifest index, last-write-wins by `updated_at`, server rejects stale overwrites, tombstones propagate deletes). Client engine `src/lib/pages/accountPageSync.ts` is on by default (opt-out): `isPageSyncEnabled()` returns true unless localStorage holds `"false"`, and it still does nothing unless the browser is signed in (501/401 → idle). The `/account` toggle (confirm dialog) can disable it. `usePageCloudSync` (mounted in Sidebar, ☁️ chip on the 账号 row) reconciles near-real-time: on load, every 12s while visible, on tab focus/visibility/online, and ~4s after local edits settle (debounced; idempotent reconcile prevents loops). This keeps both domains (zhi-note.com / zhi-notes.vercel.app) and all page-backed surfaces — including ZhiHui meetings (each a page with date/time/platform/organizer properties) — in step. Module workspace roots merge by title (smallest id wins) so two domains converge without duplicate 每日纪要/产业链研究/ZhiHui roots. Synced fields: title/body HTML/hierarchy/position/icon/properties/cover (covers >300KB skipped); NOT synced: databases, files, comments, versions, content_yjs. Verifier: `npm run verify:account`.

## Privacy And Safety Boundaries

- Local-first means user-selected files may be stored in browser local storage/IndexedDB only after an explicit user action.
- File receipts and previews must stay metadata-only unless the user explicitly asks to import or display file contents.
- Do not put file bytes, page bodies, database row values, prompts, tokens, credentials, meeting passwords, or private source text into exported manifests, receipts, logs, or docs.
- High-risk actions require an explicit confirmation UI or owner gate: cloud upload/sync, AI calls, batch page/database creation, restore apply, destructive delete, schema migration, external asset loading, and ZIP extraction.

## Install And Run

- The repository has `pnpm-lock.yaml`; for a fresh clone, prefer:
  `corepack enable`
  `pnpm install`
- Existing scripts are package-manager neutral. Common commands:
  `pnpm dev`
  `pnpm build`
  `pnpm lint`
- If using npm in an already-installed local workspace, the equivalent commands are:
  `npm run dev`
  `npm run build`
  `npm run lint`

## Verification Commands

Run focused verifiers after related changes:

- Editor/page commands: `npm run verify:editor`
- Page research structure and breadcrumb safety: `npm run verify:page-structure`
- File preview/privacy contract: `npm run verify:file-preview`
- Module registry/contracts: `npm run verify:modules`
- Database contract: `npm run verify:database`
- Research workflow contract: `npm run verify:research-workflow`
- Web beta contract: `npm run verify:web-beta`
- Web beta smoke checks: `npm run verify:web-beta:smoke`
- Always run `npm run lint` and `npm run build` before treating a stage as complete.

## Current Best Next Steps

- If continuing the current notes/files phase: implement owner-confirmed Markdown/HTML page import from local previews, with a manifest and rollback plan before writing pages.
- If aligning closer to Notion databases: continue nested filter groups, relation/rollup UX, templates, and database button execution previews while keeping execution disabled.
- If preparing web launch: keep local-first behavior intact, then add production deployment, Postgres/cloud sync, auth, audit, backup/restore, and permission gates as separate owner-confirmed stages.
- Do not jump directly to cloud sync, AI execution, or bulk import without showing the user the data boundary and confirmation workflow first.

## Imported Claude Cowork project instructions

你作为  claude code 的辅助来同步完善一些功能
