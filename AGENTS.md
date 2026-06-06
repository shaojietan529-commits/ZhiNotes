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

## Project Context

- Project name: ZhiNotes.
- Current goal: web-based modular investment research platform.
- Product direction: local-first, Notion-like knowledge base optimized for investment research, with modules that can be added over time.
- Notes/pages are the foundation; databases, reports, files, company research, meetings, portfolio, projects, research graph, AI, and sync are modular surfaces.
- Current GitHub branch: `claude/plan-knowledge-management-app-OSoEs`.
- Current verified handoff commit: `8d49fd7 feat: show zip preview confirmation queue`.

## Current Verified State

- Core shell: Next.js 16 app with local browser storage and module navigation.
- Notes/pages: page tree, breadcrumbs, icons, backlinks, comments, version history, diff route, Tiptap editor, slash commands, keyboard shortcuts, toggle, callout, table of contents, cover, and child-page creation workflow.
- Page hierarchy UI: the old large in-page "页面结构" block was replaced by a compact Notion-style breadcrumb. Paths of 3 levels or less show fully; deeper paths show root / ... / parent / current, and the ellipsis can expand hidden middle levels.
- Notes roadmap: `/modules/notes` includes a Notion parity panel covering page hierarchy, file-to-page, database UX, synced blocks, cloud, and AI boundaries.
- Databases: table, list, kanban, calendar, gallery, timeline, chart, form, feed, formulas, rollups, button drafts, view rules, grouping, row/page peek, field descriptions, duplication, ordering, summaries, freeze columns, and delete confirmations.
- Files/reports: local metadata routing for HTML, Markdown, PDF, Excel, Word, PowerPoint, notebooks, archives, media, transcripts, SEC/XBRL-style research text, and local file pages.
- ZIP preview: metadata-only central directory preview is implemented in the Files module. It shows counts, extension groups, compressed size, destination routing, exportable JSON, and a confirmation queue. It does not extract files, read entry bytes, create pages/databases, upload, or call AI.
- Web beta: auth, workspace, sync, file presign, audit, permissions, restore, and migration routes exist as gated contracts; production cloud behavior remains owner-gated.

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
