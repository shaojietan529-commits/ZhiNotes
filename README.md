# ZhiNotes

ZhiNotes is a web-based modular investment research platform.

The current product is local-first and runs in the browser. Notes, pages,
databases, file previews, exports, and backups are designed to work locally
before cloud sync is added.

## Language Contract

ZhiNotes defaults to Chinese (`zh-CN`) for the main product shell. Internal ids,
routes, storage keys, and API contracts remain stable English identifiers so
future modules can be added without breaking existing data.

## Product Direction

ZhiNotes is not only a Notion-style note app. Notes are the workspace foundation,
while research workflows can be added as modules.

Current module foundation:

- Notes and Pages: block editor, page tree, backlinks, comments, version history.
- Research Databases: table, list, kanban, calendar, gallery, timeline, form,
  feed, and local page relation fields.
- Report Library: beta module at `/modules/reports` for local HTML reports,
  Markdown notes, PDFs, Office files, notebooks, archives, takeaways, linked
  companies, linked meetings, and a local report tracker database.
- Company Research: beta module at `/modules/company-research` for company
  profiles, investment memos, earnings reviews, valuation assumptions, linked
  reports, linked meetings, and a local tracker database.
- Portfolio and Watchlist: beta module at `/modules/portfolio` for local
  position memos, watchlists, sizing discipline, catalyst review, risk notes,
  linked company pages, linked reports, linked meetings, and a local portfolio
  tracker database.
- Meetings and Calls: beta module at `/modules/meetings` for meeting notes,
  transcripts, action items, follow-ups, linked company pages, linked reports,
  and a local meeting tracker database.
- Research Graph: beta module at `/modules/research-graph` for a local,
  read-only map of company, report, meeting, and portfolio relation coverage.
- AI Workbench: planned local staging module at `/modules/ai` for summaries,
  Q&A, comparison, report generation, research frameworks, explicit context
  selection, request drafts, and privacy gates.
- Web Sync and Permissions: planned web-beta readiness module at `/modules/sync`
  for local backup exports, sync queue visibility, restore planning, permission
  checklist, and privacy boundaries.

## Module Architecture

The module registry lives in:

```txt
src/lib/modules/registry.ts
```

Each module declares:

- `id`, title, description, category, and status.
- Data surfaces it uses, such as pages, databases, files, or comments.
- Extension slots it needs, such as sidebar navigation, command palette actions,
  page blocks, database views, or file renderers.
- Optional starter actions, such as creating a research note, database,
  template-backed page, or preset local workspace tracker.

Current preset workspace starters:

- Company Research Tracker: company ticker, sector, status, rating, catalyst,
  company-page relation, thesis, valuation assumptions, key metrics,
  latest-report URL, related-report relations, and related-meeting relations,
  plus status board, catalyst timeline, valuation watchlist, and research feed
  views.
- Meeting Tracker: meeting date, company, company-page relation, meeting-note
  relation, type, platform, status, follow-up, action items, transcript-page
  relation, recording URL, and related-report relation fields, plus calendar,
  follow-up board, transcript queue, and recent-calls views.
- Report Library Tracker: report-page relation, company-page relation, format,
  status, report date, source, external source URL, key takeaways, thesis impact,
  model impact, related-meeting relations, and related-memo relations, plus
  report table, review board, format gallery, and recent-reports views.
- Portfolio Tracker: ticker, company-page relation, status, portfolio role,
  direction, conviction, target weight, current weight, entry price, target
  price, downside price, next catalyst, thesis, risk notes, related-memo
  relations, related-report relations, and related-meeting relations, plus
  portfolio table, status board, catalyst timeline, sizing watchlist, and
  position-review feed views.

This keeps new research modules from being hard-coded into one page. A future
module should first register itself, then add only the UI, commands, blocks, or
data views it needs.

The module center can export a local module manifest. The manifest checks module
ids, routes, starter coverage, data surfaces, and extension slot coverage
without reading page text, database rows, uploaded file bytes, prompts, tokens,
or cloud data.

## Database Relations

Databases support a local `relation` field type. A relation field stores page
ids locally, displays them as clickable page chips in table/form workflows, and
exports them to CSV as page titles.

Current relation scope:

- Relation targets are local pages.
- Table and form views support editing relations.
- List and gallery views display relation titles.
- CSV export writes related page titles, not internal ids.
- Company, report, meeting, and portfolio modules share a local research graph
  panel. It can export a graph report with asset titles, module coverage,
  relation fields, links, and completion suggestions, without including page
  bodies, database row values, uploaded file bytes, prompts, tokens, or cloud
  data.

## Research Graph Module

Open the research graph module at:

```txt
http://localhost:3000/modules/research-graph
```

Current local actions:

- View company, report, meeting, and portfolio asset coverage in one place.
- Review recent relation links across local research trackers.
- Identify local assets that still need structured relation fields.
- Review suggested completion targets for unlinked assets and jump into the
  right local database with `q` and `focus` parameters prefilled.
- Use the database relation completion assistant after that jump to manually
  add the focused asset to one local relation field at a time.
- Open source pages, target pages, source modules, and tracker databases.
- Export a local graph report without page bodies, database row values, file
  bytes, prompts, tokens, or cloud data.

The current Research Graph module is read-only. It does not edit pages, create
database rows, call AI, sync data, or upload workspace content. Relation
completion from a database page is a separate manual click that writes only the
selected local row and selected local relation field.

## Company Research Module

Open the company research module at:

```txt
http://localhost:3000/modules/company-research
```

Current local actions:

- Create a company profile page from the Company Research template.
- Create an investment memo from the Investment Memo template.
- Create an earnings review from the Earnings Review template.
- Create a company tracker database with local fields and views.
- Open company research from the sidebar Platform section or Cmd/Ctrl+K.

## Report Library Module

Open the report library module at:

```txt
http://localhost:3000/modules/reports
```

Current local actions:

- Create a report note from the Research Report template.
- Create a report tracker database with local relation fields and views.
- Track report pages, local file preview pages, HTML reports, companies, meetings, and memos.
- Open reports from the sidebar Platform section or Cmd/Ctrl+K.

The current Report Library module is local-only. It does not upload reports,
call AI, sync files, or load external resources by itself.

HTML report previews block external resources by default. A user must type the
local external-resource confirmation phrase before enabling remote images,
scripts, styles, frames, fonts, media, or network endpoints for a trusted HTML
file preview. The exported receipt records only local confirmation metadata and
does not include report text, URL lists, tokens, or file bytes.

Spreadsheet file previews can be imported into a new local database, but this
bulk import path now requires a typed local confirmation phrase before creating
fields or rows. The exported receipt records only local confirmation metadata,
row/column limits, and file size; it does not include spreadsheet cell values or
file bytes.

## Portfolio and Watchlist Module

Open the portfolio module at:

```txt
http://localhost:3000/modules/portfolio
```

Current local actions:

- Create a position memo from the Investment Memo template.
- Create a portfolio tracker database with local relation fields and views.
- Track position status, watchlist ideas, sizing, conviction, catalysts, thesis,
  risk notes, linked company pages, linked reports, linked meetings, and linked
  memos.
- Open Portfolio from the sidebar Platform section or Cmd/Ctrl+K.

The current Portfolio module is local-only. It does not fetch prices, connect
brokerage accounts, sync holdings, import transactions, or send position data
externally.

## Meetings Module

Open the meetings module at:

```txt
http://localhost:3000/modules/meetings
```

Current local actions:

- Create a meeting note from the Meeting Notes template.
- Create a meeting tracker database with local relation fields and views.
- Track meeting notes, transcript pages, action items, company links, and report links.
- Open meetings from the sidebar Platform section or Cmd/Ctrl+K.

The current Meetings module is a local research workspace. It does not join
calls, record audio, publish notes, sync data, or call external services.

## AI Workbench Module

Open the AI workbench module at:

```txt
http://localhost:3000/modules/ai
```

Current local actions:

- Select an AI workflow such as summary, Q&A, report draft, comparison, or
  research framework.
- Select local page context explicitly.
- Review and export a local AI payload preview. The preview summarizes selected
  pages, available file kinds, prompt length, and required approvals, but
  excludes page body text, file bytes, prompt text, model calls, and external
  uploads.
- Review and export a local AI execution policy. The policy lists provider,
  final payload, page context, file content, retention, permission, and audit
  gates; `/api/ai/run` is a disabled local stub and does not read request bodies,
  call model providers, upload workspace data, or store AI output.
- Draft an AI request locally with selected page titles and privacy gates.
- Type the local AI outbound confirmation phrase and export a high-risk
  confirmation receipt. The receipt does not include page body text, prompt
  text, file bytes, tokens, or secrets, and it does not enable `/api/ai/run`.
- Inspect local file readiness by stored file type.

The current AI Workbench module does not call AI, upload selected pages, send
files, load external providers, or save generated output. AI execution should be
enabled only after provider, context, payload preview, retention, and permission
rules are explicit.

## Web Sync and Permissions Module

Open the web-beta readiness module at:

```txt
http://localhost:3000/modules/sync
```

Current local actions:

- Use the Cloud Alpha panel to request a Supabase magic link, store a local cloud
  session after `/auth/callback`, check the current cloud session, list
  available cloud workspaces, create an empty private-alpha workspace, run a
  metadata-only workspace bootstrap check, link/unlink the local browser
  workspace to a cloud workspace id, or clear the local cloud token. These
  actions stay disabled until cloud environment variables are configured, and
  they do not upload local pages, files, databases, backups, or sync queue rows.
- Inspect local counts for active pages, trash pages, databases, uploaded files,
  and pending sync log rows.
- Track core local changes in `sync_log`, including pages, wiki links, page
  comments, block comments, databases, database fields, database rows, database
  views, and page versions.
- Review recent pending sync entries by table, row id, operation, changed fields,
  and timestamp.
- Export a local sync queue snapshot. The snapshot contains queue metadata only;
  it does not include page text or uploaded file content.
- Review and export a local sync payload preview for a future cloud push. The
  preview summarizes pending tables, operations, changed fields, risk levels,
  and privacy boundaries, but excludes page text and file bytes and does not
  upload anything.
- Review and export a local cloud sync opt-in gate. The gate checks local cloud
  workspace link, payload preview, high-risk table scope, conflict baseline,
  disabled push API, and required owner confirmation phrase before any future
  upload flow can exist.
- Type the local private-alpha sync confirmation phrase and export a high-risk
  confirmation receipt. The receipt records only local confirmation metadata
  and still does not upload, write, delete, call AI, include page text, include
  file bytes, or enable the disabled sync push API.
- Review and export a local sync replay test plan for future push/pull replay.
  The plan covers payload preview, server acknowledgement, pull cursors,
  conflict baseline review, retry/idempotency, high-risk gates, and rollback,
  but does not read remote data, upload notes, write workspace data, or
  acknowledge sync rows.
- Review and export a local conflict review scaffold for future multi-device
  sync. The scaffold maps page, database, file, comment, permission, and restore
  conflicts to review actions, but does not read remote data, merge changes,
  write workspace data, or upload anything.
- Review and export a local workspace identity with anonymous browser-local
  workspace and device ids for future sync metadata. The identity is not an
  account and does not connect cloud services or include note text/file content.
- Review and export a local account/session boundary for future Web Beta login.
  The boundary maps login start, session read, workspace bootstrap,
  logout/revoke, and local-to-cloud linking rules, but does not create accounts,
  read emails, passwords, tokens, cookies, connect auth providers, write server
  sessions, or upload workspace data.
- Download local workspace backup JSON, workspace ZIP, or all-page Markdown.
- Choose a local backup JSON for restore dry-run preview. The preview validates
  format/version and summarizes pages, trash pages, versions, comments,
  databases, rows, views, uploaded files, favorites, and locked pages.
- Review and export a local restore rollback plan. The plan requires a fresh
  rollback backup, restore scope review, pending sync review, and second
  confirmation before write-back can be added; it does not restore, overwrite,
  delete, upload, or sync workspace data.
- Review and export a local restore write-back contract. The contract maps
  restore validation, rollback snapshot, scope review, pending sync clearance,
  permission check, audit event, second confirmation, disabled apply endpoint,
  and failed-restore recovery proof; it does not restore, overwrite, delete,
  upload, sync, or write workspace data.
- Type the local restore write-back confirmation phrase and export a high-risk
  confirmation receipt. The receipt records only local confirmation metadata and
  restore scope counts; it does not restore, overwrite, delete, upload, sync, or
  enable `/api/backup/restore-apply`.
- Review a local permission policy draft for Owner, Researcher, and Viewer
  roles across pages, databases, files, reports, portfolio, AI, and sync.
- Export the local permission policy draft as JSON. The export does not create
  users, enforce access, share workspace data, or upload anything.
- Review and export a local permission decision preview. The preview evaluates
  Owner, Researcher, and Viewer role/resource/action combinations plus high-risk
  scenarios, but does not create users, grant access, revoke access, enforce
  server permissions, read page text, read file bytes, or upload workspace data.
- Review and export a local high-risk action registry. The registry centralizes
  typed confirmation phrases and coverage for cloud sync, restore write-back,
  AI execution, HTML external resources, spreadsheet bulk import, future bulk
  delete, and future sharing. Exporting it does not enable any action or include
  workspace content.
- Review and export a local Web Beta contract draft covering account login,
  cloud tables, sync APIs, conflict policies, deployment gates, and privacy
  confirmations. The export does not create accounts, connect cloud services,
  upload notes, sync files, or share workspace data.
- Review and export a local cloud schema migration plan. The plan maps
  contracted cloud tables to migration order, local evidence, sensitivity, and
  rollback requirements, but does not create migrations, connect a cloud
  database, write server data, or upload workspace data.
- Review and export a local cloud migration SQL draft. The draft generates
  Postgres DDL up/down statements for the contracted cloud schema, but does not
  connect a database, apply SQL, create real migrations, write server data, read
  page text, read file bytes, or upload workspace data.
- Review and export a local Web Beta environment preflight. The preflight checks
  whether auth, database, file storage, deployment, security, and observability
  environment variables are present, but never exposes secret values, connects
  cloud services, creates accounts, writes server data, or uploads workspace
  data.
- Review and export a local Web Beta launch checklist. The checklist connects
  product readiness, auth, cloud schema, file storage, sync replay, conflict
  review, restore rollback, restore write-back, payload confirmation,
  deployment gates, and observability into one preflight view; it does not
  deploy the app, create accounts, connect cloud services, write server data,
  or upload workspace data.
- Review and export a local audit trail policy for future Web Beta event
  logging. The policy covers auth, export, restore, sync, sharing, permission,
  file, AI, and admin actions, but keeps page text, prompt text, file bytes,
  signed URLs, tokens, and secret values out of audit rows.
- Inspect disabled local Web Beta API stubs for auth session, login start,
  logout, workspace list, workspace create, workspace bootstrap, sync push, sync
  pull, sync replay test, restore preview, restore apply, file presign,
  permission check, audit events, and cloud migration apply. These routes return
  disabled responses unless explicitly enabled and do not upload local notes,
  files, databases, backups, or sync queue rows.
- Review and export a local Web Beta readiness report that summarizes local
  evidence, manual confirmation points, and blocked launch gates. The report
  does not create accounts, connect cloud services, upload notes, sync files,
  restore backups, or share workspace data.
- Review the web-beta dependency stack: login, cloud database, sync queue,
  restore/recovery, permissions, and conflict handling.
- Review privacy boundaries before cloud sync, AI, external assets, or restore
  workflows are added.

The current Sync module is still local-first by default. Cloud Alpha can create
Supabase Auth sessions, list/create empty workspace metadata, verify bootstrap,
and store a local cloud workspace link only after environment variables are
explicitly enabled; it does not upload local notes, files, databases, backups,
run full cloud sync, write restored data back into the workspace, share pages,
or call AI.

## Cloud Deployment Direction

ZhiNotes will use Vercel for the Next.js frontend and Supabase for the first
cloud backend. Cloudflare can still be used for DNS, CDN, and WAF later.

The first cloud phase is a private alpha, not full sync:

- `.env.example` defines the required Vercel/Supabase environment variables.
- `supabase/migrations/0001_zhinotes_cloud_foundation.sql` defines the initial
  Supabase Postgres schema and RLS policies.
- `/api/auth/login/start`, `/api/auth/session`, `/api/auth/logout`,
  `GET /api/workspaces`, `POST /api/workspaces`, and
  `/api/workspaces/[workspaceId]/bootstrap` now have guarded Supabase
  implementations.
- Cloud routes stay disabled unless `ZHINOTES_CLOUD_ENABLED=true`.
- Auth routes that create or mutate sessions also require
  `ZHINOTES_ALLOW_CLOUD_WRITES=true`.
- Sync, file presign, permissions, audit, and restore write-back remain disabled
  until payload preview, permission checks, conflict handling, and rollback proof
  are implemented.
- The cloud sync confirmation phrase can produce a local receipt, but the
  receipt is audit evidence only and does not turn on cloud push.

See `docs/cloud-deployment.md` for the deployment checklist.

## Local Development

Run the app locally:

```bash
npm run dev
```

Then open:

```txt
http://localhost:3000
```

Useful checks:

```bash
npm run lint
npm run build
```

## Privacy Boundary

The current app is local-first:

- Uploaded files are stored in local browser storage.
- HTML report previews block external resources by default.
- HTML external resources require a typed local confirmation receipt before
  they can be enabled for a trusted preview.
- Spreadsheet-to-database bulk import requires a typed local confirmation
  receipt before it creates database fields or rows.
- High-risk confirmation phrases are also visible in a local registry on the
  Sync module so future modules can reuse the same policy.
- Embed blocks do not load external iframes until the user clicks to load them.
- Backup export is local-only, but the exported JSON may contain private data.

Cloud sync, AI features, and external data connectors should be added only after
the privacy and permission model is explicit.
