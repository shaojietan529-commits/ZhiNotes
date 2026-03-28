# PLAN.md — ZhiNotes Implementation Plan

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack Details](#3-tech-stack-details)
4. [File and Folder Structure](#4-file-and-folder-structure)
5. [Database Schema Design](#5-database-schema-design)
6. [Sync Strategy](#6-sync-strategy)
7. [Key Technical Decisions and Rationale](#7-key-technical-decisions-and-rationale)
8. [Phase-by-Phase Implementation Roadmap](#8-phase-by-phase-implementation-roadmap)
9. [Deployment Strategy](#9-deployment-strategy)
10. [Glossary](#10-glossary)

---

## 1. Project Overview

ZhiNotes is a Notion-like knowledge management application optimized for investment research. It is offline-first, meaning the app works without an internet connection and syncs data to the cloud when connectivity is available. The app is built for a single user today but architected to support multiple users in the future.

**Core capabilities:**

- Block-based rich text editor (paragraphs, headings, lists, code, embeds, etc.)
- Nested databases with custom fields and multiple views (table, list, kanban, calendar)
- Wiki-style linking between any pages regardless of hierarchy
- Auto-dating with newest-first display
- Hover-for-summary and side-by-side diff comparison of page versions
- Infinite nesting depth (practical limit ~5 levels)
- Offline-first with background cloud sync

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Client                  │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Next.js  │  │  Tiptap 3.0  │  │  SQLite WASM  │  │
│  │ App      │──│  Block Editor │  │  (via OPFS)   │  │
│  │ Router   │  │  + Yjs CRDT  │  │               │  │
│  └──────────┘  └──────────────┘  └───────┬───────┘  │
│                                          │           │
│                              ┌───────────┴────────┐  │
│                              │   Sync Engine      │  │
│                              │   (Custom + Yjs)   │  │
│                              └───────────┬────────┘  │
└──────────────────────────────────────────┼──────────┘
                                           │ HTTPS / WebSocket
┌──────────────────────────────────────────┼──────────┐
│                   Server (Railway/Fly.io)│           │
│                                          ▼           │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Next.js  │  │  Sync API    │  │  PostgreSQL   │  │
│  │ API      │──│  (REST +     │──│  (Neon or     │  │
│  │ Routes   │  │   WebSocket) │  │   Supabase)   │  │
│  └──────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Data flow:**

1. All reads and writes happen against local SQLite (via WASM + OPFS persistence).
2. The sync engine detects local changes and pushes them to the server.
3. The server applies changes to PostgreSQL and broadcasts updates back.
4. Rich text document state uses Yjs CRDTs for conflict-free merging.
5. Structured data (database rows, fields, views) uses timestamp-based last-writer-wins (LWW) with per-column granularity.

---

## 3. Tech Stack Details

### Frontend

| Library | Version | Purpose |
|---|---|---|
| Next.js | 15.x | React framework, App Router, SSR/SSG, API routes |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety across the entire codebase |
| Tailwind CSS | 4.x | Utility-first styling |
| Tiptap | 2.x | Headless block-based rich text editor (ProseMirror-based) |
| Yjs | 13.x | CRDT for conflict-free document merging |
| @sqlite.org/sqlite-wasm | 3.x | Official SQLite WASM build with OPFS persistence |
| Drizzle ORM | 0.x | Type-safe SQL for both SQLite and PostgreSQL schemas |
| Zustand | 5.x | Lightweight client state management |
| date-fns | 4.x | Date formatting and manipulation |
| diff | 7.x | Computing text diffs for the comparison feature |
| nanoid | 5.x | Generating compact, URL-safe unique IDs |
| Zod | 3.x | Runtime validation of data at sync boundaries |

### Backend / Server

| Library | Version | Purpose |
|---|---|---|
| Next.js API Routes | 15.x | REST API endpoints (same Next.js deployment) |
| Drizzle ORM | 0.x | PostgreSQL query builder, migrations, type-safe SQL |
| PostgreSQL | 16.x | Server-side authoritative database |
| Zod | 3.x | Validate incoming sync payloads |

### Tooling

| Tool | Purpose |
|---|---|
| pnpm | Package manager (fast, disk-efficient) |
| ESLint + Prettier | Code quality and formatting |
| Vitest | Unit and integration testing |
| Playwright | End-to-end testing |
| Drizzle Kit | Database migrations for PostgreSQL |

---

## 4. File and Folder Structure

```
zhinotes/
├── PLAN.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── drizzle.config.ts
├── .env.local
├── .env.example
├── .gitignore
│
├── public/
│   └── favicon.ico
│
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root layout (providers, sidebar)
│   │   ├── page.tsx                 # Home / dashboard (recent pages)
│   │   ├── (workspace)/
│   │   │   ├── page/
│   │   │   │   └── [pageId]/
│   │   │   │       ├── page.tsx     # Page editor view
│   │   │   │       └── compare/
│   │   │   │           └── page.tsx # Side-by-side diff view
│   │   │   ├── database/
│   │   │   │   └── [databaseId]/
│   │   │   │       └── page.tsx     # Database view
│   │   │   └── layout.tsx           # Workspace layout (sidebar + content)
│   │   └── api/
│   │       ├── sync/
│   │       │   ├── push/route.ts    # Client pushes changes to server
│   │       │   └── pull/route.ts    # Client pulls changes from server
│   │       └── health/route.ts
│   │
│   ├── components/
│   │   ├── editor/
│   │   │   ├── Editor.tsx           # Main Tiptap editor wrapper
│   │   │   ├── blocks/              # Custom block node views
│   │   │   ├── extensions/          # Custom Tiptap extensions
│   │   │   └── menus/               # Slash menu, bubble menu, etc.
│   │   ├── database/
│   │   │   ├── DatabaseShell.tsx    # Container that switches between views
│   │   │   ├── views/              # Table, List, Kanban, Calendar
│   │   │   ├── fields/             # Field type renderers and editors
│   │   │   └── ViewSwitcher.tsx
│   │   ├── comparison/
│   │   │   ├── HoverSummary.tsx     # Hover popover showing recent changes
│   │   │   ├── SideBySideDiff.tsx   # Full side-by-side diff view
│   │   │   └── DiffHighlight.tsx
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PageTree.tsx         # Nested page/database tree
│   │   │   └── QuickSearch.tsx      # Cmd+K search
│   │   ├── shared/
│   │   │   ├── Breadcrumb.tsx
│   │   │   ├── SyncStatusBadge.tsx
│   │   │   └── DateDisplay.tsx
│   │   └── providers/
│   │       ├── DatabaseProvider.tsx  # SQLite WASM initialization
│   │       └── SyncProvider.tsx
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── local/
│   │   │   │   ├── client.ts        # SQLite WASM initialization
│   │   │   │   ├── schema.ts        # Drizzle schema for local SQLite
│   │   │   │   ├── migrations.ts    # Local schema migrations
│   │   │   │   └── queries.ts       # Local DB query functions
│   │   │   └── server/
│   │   │       ├── client.ts        # PostgreSQL connection
│   │   │       ├── schema.ts        # Drizzle schema for PostgreSQL
│   │   │       └── migrations/      # Drizzle Kit migration files
│   │   ├── sync/
│   │   │   ├── engine.ts            # Core sync logic
│   │   │   ├── changelog.ts         # Change tracking
│   │   │   ├── conflict.ts          # Conflict resolution
│   │   │   ├── queue.ts             # Offline mutation queue
│   │   │   └── transport.ts         # HTTP + WebSocket transport
│   │   ├── comparison/
│   │   │   ├── differ.ts            # Compute diffs between page versions
│   │   │   ├── summarizer.ts        # Generate change summaries
│   │   │   └── versioning.ts        # Version snapshot management
│   │   ├── wiki/
│   │   │   ├── linker.ts            # Resolve [[wiki links]] to page IDs
│   │   │   └── backlinks.ts         # Compute and cache backlinks
│   │   └── utils/
│   │       ├── id.ts                # ID generation (nanoid)
│   │       ├── dates.ts             # Date formatting helpers
│   │       └── types.ts             # Shared TypeScript types
│   │
│   ├── hooks/
│   │   ├── useLocalDb.ts
│   │   ├── useSync.ts
│   │   ├── usePage.ts
│   │   ├── useDatabase.ts
│   │   ├── useBacklinks.ts
│   │   └── useComparison.ts
│   │
│   └── stores/
│       ├── workspaceStore.ts
│       ├── sidebarStore.ts
│       └── syncStore.ts
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 5. Database Schema Design

### 5.1 Design Principles

- **UUIDs everywhere.** Every row uses a client-generated UUID (nanoid, 21 characters). This avoids ID collisions between local and server databases.
- **`owner_id` on every table.** Even though there is one user now, every record carries an `owner_id` so multi-user support requires zero schema changes.
- **`created_at` and `updated_at` on every table.** Both are ISO 8601 UTC strings in SQLite and `timestamptz` in PostgreSQL.
- **`deleted_at` soft deletes.** Nothing is hard-deleted. A non-null `deleted_at` means the row is logically deleted.
- **`sync_version` counter.** A monotonically increasing integer on every row, used by the sync engine to detect changes.

### 5.2 Core Tables

#### `users`

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  sync_version  INTEGER NOT NULL DEFAULT 0
);
```

#### `pages`

```sql
CREATE TABLE pages (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  parent_id     TEXT REFERENCES pages(id),
  database_id   TEXT REFERENCES databases(id),
  title         TEXT NOT NULL DEFAULT '',
  icon          TEXT,
  cover_url     TEXT,
  content_yjs   BLOB,
  content_text  TEXT,
  position      REAL NOT NULL DEFAULT 0,
  depth         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  sync_version  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_pages_parent ON pages(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pages_database ON pages(database_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pages_updated ON pages(updated_at DESC);
```

#### `page_versions`

```sql
CREATE TABLE page_versions (
  id            TEXT PRIMARY KEY,
  page_id       TEXT NOT NULL REFERENCES pages(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),
  version_num   INTEGER NOT NULL,
  title         TEXT NOT NULL,
  content_yjs   BLOB,
  content_text  TEXT,
  summary       TEXT,
  created_at    TEXT NOT NULL,
  sync_version  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_versions_page ON page_versions(page_id, version_num DESC);
```

#### `databases`

```sql
CREATE TABLE databases (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  parent_page_id TEXT REFERENCES pages(id),
  title         TEXT NOT NULL DEFAULT '',
  icon          TEXT,
  description   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  sync_version  INTEGER NOT NULL DEFAULT 0
);
```

#### `database_fields`

```sql
CREATE TABLE database_fields (
  id            TEXT PRIMARY KEY,
  database_id   TEXT NOT NULL REFERENCES databases(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  field_type    TEXT NOT NULL,
  config        TEXT,
  position      REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  sync_version  INTEGER NOT NULL DEFAULT 0
);
```

#### `database_rows`

```sql
CREATE TABLE database_rows (
  id            TEXT PRIMARY KEY,
  database_id   TEXT NOT NULL REFERENCES databases(id),
  page_id       TEXT NOT NULL REFERENCES pages(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),
  field_values  TEXT NOT NULL DEFAULT '{}',
  position      REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  sync_version  INTEGER NOT NULL DEFAULT 0
);
```

#### `database_views`

```sql
CREATE TABLE database_views (
  id            TEXT PRIMARY KEY,
  database_id   TEXT NOT NULL REFERENCES databases(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  view_type     TEXT NOT NULL,
  config        TEXT NOT NULL DEFAULT '{}',
  position      REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  sync_version  INTEGER NOT NULL DEFAULT 0
);
```

#### `wiki_links`

```sql
CREATE TABLE wiki_links (
  id            TEXT PRIMARY KEY,
  source_page_id TEXT NOT NULL REFERENCES pages(id),
  target_page_id TEXT NOT NULL REFERENCES pages(id),
  owner_id      TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL,
  deleted_at    TEXT,
  sync_version  INTEGER NOT NULL DEFAULT 0
);
```

#### `sync_log` (local only)

```sql
CREATE TABLE sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name    TEXT NOT NULL,
  row_id        TEXT NOT NULL,
  operation     TEXT NOT NULL,
  changed_cols  TEXT,
  timestamp     TEXT NOT NULL,
  synced        INTEGER NOT NULL DEFAULT 0
);
```

---

## 6. Sync Strategy

### 6.1 Two Layers of Sync

**Layer 1: Structured Data (LWW per column)**

For metadata tables (pages, databases, fields, rows, views, links):

1. Each mutation locally increments `sync_version` and writes to `sync_log`.
2. On push, the client sends pending `sync_log` entries with full row data.
3. The server compares `updated_at` timestamps per column — most recent write wins.
4. On pull, the server returns rows with `updated_at > client_last_pulled_at`.

**Layer 2: Document Content (Yjs CRDT)**

For rich text content (`content_yjs`):

1. Tiptap edits produce Yjs update deltas.
2. Deltas are persisted to `pages.content_yjs` as the full Yjs state.
3. On sync, Yjs update deltas are exchanged — merges are conflict-free by design.

### 6.2 Conflict Resolution

| Data Type | Strategy |
|---|---|
| Page metadata | LWW per field |
| Page content (rich text) | Yjs CRDT merge (conflict-free) |
| Database field values | LWW per field |
| Database schema | LWW per row |
| Wiki links | LWW per row |
| Deletions | Soft delete wins if newer |

### 6.3 Version Snapshots

- Every page save (debounced to 30s of active editing) compares plain text to last snapshot.
- If diff exceeds threshold (>50 chars or >5 lines changed), a new `page_versions` row is created.
- Hover summary diffs latest version against previous using `diff` library.
- Side-by-side view highlights insertions (green) and deletions (red).

---

## 7. Key Technical Decisions and Rationale

| Decision | Rationale |
|---|---|
| **SQLite WASM + OPFS** | True file-system persistence, faster than IndexedDB for SQL queries, official SQLite build |
| **Tiptap for editor** | Headless, mature extension ecosystem, native Yjs integration, React support |
| **Yjs for CRDTs** | Fastest CRDT implementation, first-class Tiptap bindings, industry standard |
| **Custom sync engine** | Simpler and cheaper than PowerSync/ElectricSQL for a solo-user app |
| **Drizzle ORM** | Supports both SQLite and PostgreSQL from single schema, lightweight, type-safe |
| **Fractional indexing** | Reorder items without updating siblings — critical for offline-first |
| **Soft deletes** | Simplifies sync, enables undo/restore, prevents sync conflicts |

---

## 8. Phase-by-Phase Implementation Roadmap

### Phase 1: Foundation
- Project setup (Next.js, TypeScript, Tailwind, dependencies)
- SQLite WASM initialization with OPFS persistence
- Basic page CRUD (create, read, update, soft-delete)
- Tiptap block editor with core extensions
- Sidebar with page list sorted newest-first

### Phase 2: Nesting and Hierarchy
- Parent-child page relationships
- Collapsible page tree in sidebar
- Drag-and-drop reordering
- Breadcrumbs, page icons, search (Cmd+K)

### Phase 3: Wiki Linking
- `[[Page Title]]` syntax with autocomplete
- WikiLink Tiptap extension
- Backlinks panel on each page

### Phase 4: Databases and Views
- Database CRUD with custom fields
- Table, List, Kanban, and Calendar views
- View switcher and per-view configuration
- Inline database embedding in pages

### Phase 5: Comparison and Diffing
- Version snapshots on significant changes
- Hover summary popover
- Full side-by-side diff view with highlights

### Phase 6: Cloud Sync
- PostgreSQL setup (Neon or Supabase)
- Push/pull sync API endpoints
- Client sync engine with offline queue
- Yjs document sync

### Phase 7: Polish and Deploy
- Deploy to Railway or Fly.io
- Performance optimization
- Keyboard shortcuts, dark mode
- Testing (unit, integration, e2e)

### Phase 8: Future Enhancements (Post-MVP)
- Multi-user collaboration
- Import from Notion/Obsidian
- Templates for investment research
- AI features (summarization, auto-tagging)
- Mobile app

---

## 9. Deployment Strategy

| Component | Service | Cost |
|---|---|---|
| Next.js app | Railway or Fly.io | ~$5/mo |
| PostgreSQL | Neon or Supabase | Free tier |
| Domain + SSL | Cloudflare | Free |

**Estimated monthly cost:** $5-10 for a solo user.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Block** | A single content unit in the editor (paragraph, heading, list, etc.) |
| **CRDT** | Conflict-free Replicated Data Type — can be edited on multiple devices and merged without conflicts |
| **Database** | A structured collection of rows with custom fields (like a spreadsheet) |
| **Field** | A column in a database (e.g., "Status", "Due Date") |
| **Fractional indexing** | Using decimal numbers for ordering so items can be reordered without updating siblings |
| **LWW** | Last Writer Wins — most recent edit takes precedence |
| **OPFS** | Origin Private File System — browser API for fast file storage |
| **Soft delete** | Marking a row as deleted without removing it from the database |
| **Sync version** | Counter on each row that increments on every mutation |
| **View** | A visual presentation of a database (table, list, kanban, calendar) |
| **Wiki link** | A `[[Page Title]]` link connecting any two pages |
| **Yjs** | JavaScript CRDT library for conflict-free rich text merging |
