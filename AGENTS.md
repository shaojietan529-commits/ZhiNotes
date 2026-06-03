<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context

- Project name: ZhiNotes.
- Product direction: offline-first Notion-like knowledge management app optimized for investment research.
- Migrated from Claude Code session `session_01UEm7bP6Bekv1CjcnbrJk41`.
- Current verified repository commit before Codex cleanup: `0b3e139 feat: Phase 5 - version snapshots, hover summary, and side-by-side diff`.

## Current Verified State

- Phase 1 completed: project setup, SQLite WASM local storage, page CRUD, Tiptap editor, sidebar.
- Phase 2 completed: nested pages, page tree, breadcrumbs, page icons, Cmd+K search.
- Phase 3 completed: `//` wiki links, autocomplete, backlinks panel.
- Phase 4 completed: databases, custom fields, table/list/kanban/calendar views, inline database embedding.
- Phase 5 completed: version snapshots, hover summaries, history panel, side-by-side diff route.
- Phase 6 pending: PostgreSQL/cloud sync, push/pull API, offline queue, Yjs document sync.
- Phase 7 partial: deployment, performance, dark mode, tests.
- Phase 8 pending: collaboration, Notion import, investment research templates, AI features.

## Verification Notes

- Use the Codex runtime Node when running Next commands in this environment:
  `/Users/rogertan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`
- In this Codex/macOS environment, `next build` with default Turbopack can fail resolving `lightningcss` under pnpm's isolated dependency layout.
- Verified production build command:
  `/Users/rogertan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build --webpack`
- Verified lint command:
  `node_modules/.bin/eslint`
- Verified local dev command:
  `/Users/rogertan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --webpack -p 3000`

## Next Priorities

- First continue from Phase 5 by adding investment-framework-aware diff highlighting once the user provides the framework.
- Alternative next step: Phase 6 cloud sync for multi-device use.
- Keep explanations simple and plain; the user has a finance background and no coding knowledge.
