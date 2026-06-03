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
- Research Databases: active module at `/modules/databases` for table, list,
  kanban, calendar, gallery, timeline, chart, form, feed, local page relation
  fields, template rows, CSV export, XLSX export, confirmed
  spreadsheet-to-database import, and a schema/view/row-count dashboard.
- Report Library: beta module at `/modules/reports` for local HTML reports,
  Markdown notes, PDFs, Office files, notebooks, archives, takeaways, local
  tracker-row intake, linked companies, linked meetings, and a local report
  tracker database.
- Company Research: beta module at `/modules/company-research` for company
  profiles, investment memos, earnings reviews, valuation assumptions, linked
  reports, linked meetings, local tracker-row intake, and a local tracker
  database.
- Portfolio and Watchlist: beta module at `/modules/portfolio` for local
  position memos, watchlists, sizing discipline, catalyst review, risk notes,
  linked company pages, linked reports, linked meetings, local tracker-row
  intake, and a local portfolio tracker database.
- Meetings and Calls: beta module at `/modules/meetings` for meeting notes,
  transcripts, action items, follow-ups, linked company pages, linked reports,
  local tracker-row intake, and a local meeting tracker database.
- Research Graph: beta module at `/modules/research-graph` for a local map of
  company, report, meeting, and portfolio relation coverage, with manually
  confirmed local schema helpers.
- AI Workbench: beta local staging module at `/modules/ai` for summaries, Q&A,
  comparison, report generation, research frameworks, explicit context
  selection, request drafts, payload previews, execution policy, research
  runbooks, and privacy gates.
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

The module center can also export a local module onboarding contract. The
contract defines the checklist for adding future modules: stable registry entry,
routable page, starter safety, extension slot selection, data surface boundary,
high-risk action gates, documentation, and verification. It does not create
modules, write workspace data, read private content, connect cloud services,
upload data, or enable AI.

The module center can export a local module health report. The report maps the
product goal areas to registry-backed modules: module platform, notes,
databases, files/reports, company research, meetings, portfolio, research graph,
AI, and Web Beta. It shows which areas are ready, partial, or blocked without
reading page text, database rows, file bytes, prompts, credentials, or cloud
data.

Run `npm run verify:modules` before treating a new module as part of the
platform. The verifier checks registry fields, unique module ids, route files,
extension slots, starter presets, local-only onboarding boundaries, sidebar
navigation, command palette wiring, module health coverage, and the module
center export surfaces.

## Research Workflow Schema

The shared research workflow schema lives in:

```txt
src/lib/modules/researchWorkflow.ts
```

It defines the core investable asset kinds used across modules:

- Company: company home, investment memo, earnings review, valuation
  assumptions, related reports, and related meetings.
- Report: local report page, file preview, review status, key takeaways,
  company relation, meeting relation, and memo relation.
- Meeting: meeting note, transcript page, action items, company relation, and
  report relation.
- Portfolio: watchlist or position tracker, sizing fields, conviction, thesis,
  risk notes, and relations back to company, report, and meeting assets.

The research graph, company module, report module, meetings module, and
portfolio module now read this shared schema for module routes, expected
relation kinds, key tracker fields, workflow stages, and local privacy
boundaries. This keeps new investment research modules from inventing
incompatible relationship models.

## Research Databases Module

Open the database module at:

```txt
http://localhost:3000/modules/databases
```

Current local actions:

- Create a blank local research database.
- Create company, report, meeting, or portfolio tracker databases from module
  presets.
- Review and export a local database module dashboard. The dashboard summarizes
  database titles, descriptions, field counts, view coverage, relation fields,
  template-row readiness, export readiness, and row counts.
- Review coverage for table, list, kanban, calendar, gallery, timeline, chart,
  form, and feed views.
- Open any local database from the module list.

The database module dashboard reads schema, view metadata, and row counts only.
It does not read database row values, page bodies, file bytes, prompts, tokens,
cloud data, or private research content. CSV/XLSX exports remain inside the
individual database page because those exports intentionally include current
visible row values.

## Database Relations

Databases support a local `relation` field type. A relation field stores page
ids locally, displays them as clickable page chips in table/form workflows, and
exports them to CSV/XLSX as page titles.

Current relation scope:

- Relation targets are local pages.
- Table and form views support editing relations.
- List and gallery views display relation titles.
- CSV and XLSX export write related page titles, not internal ids.
- Company, report, meeting, and portfolio modules share a local research graph
  panel. It can export a graph report with asset titles, module coverage,
  relation fields, links, completion suggestions, and relation schema gaps,
  without including page bodies, database row values, uploaded file bytes,
  prompts, tokens, or cloud data.

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
- Review relation schema gaps, such as a company tracker missing related-report
  or related-meeting relation fields.
- Create one missing local relation field from a schema gap after a manual
  browser confirmation.
- Show the latest local schema-field creation result and include that action
  receipt in the exported graph report without row values or page bodies.
- Use the database relation completion assistant after that jump to manually
  add the focused asset to one local relation field at a time.
- Open source pages, target pages, source modules, and tracker databases.
- Export a local graph report without page bodies, database row values, file
  bytes, prompts, tokens, or cloud data.

The current Research Graph module does not edit pages, create database rows,
call AI, sync data, or upload workspace content. Its only write path is a
manually confirmed local relation-field creation from a schema gap. Relation
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
- Review and export a local company coverage radar. The coverage report checks
  company home pages, investment memos, earnings reviews, valuation assumptions,
  key metrics, related reports, related meetings, and tracker database coverage
  without exporting page text, database row values, file bytes, holdings, or
  investment plans.
- Review and export a local company research playbook. The playbook converts
  coverage gaps into an action queue for company home, investment memo, earnings
  review, valuation assumptions, key metrics, related reports, related meetings,
  tracker database setup, and review cadence.
- Use the company intake desk to create one local company tracker row from a
  company research page. The intake action maps Company page relation, Status,
  Thesis, identifiable Ticker, valuation assumptions, and key metrics, checks
  for an existing tracker row first, and then opens the tracker for manual
  report/meeting relation cleanup. It is a local single write and does not read
  page text, database row values, file bytes, holdings, trading plans, sync,
  upload, or call AI.
- Open company research from the sidebar Platform section or Cmd/Ctrl+K.

The company research playbook and company intake desk are local-only. They read
coverage structure and tracker field schema, but they do not read or export page
text, database row values, file bytes, holdings, trading plans, cloud data, AI
prompts, tokens, or credentials.

## Report Library Module

Open the report library module at:

```txt
http://localhost:3000/modules/reports
```

Current local actions:

- Create a report note from the Research Report template.
- Create a report tracker database with local relation fields and views.
- Track report pages, local file preview pages, HTML reports, companies, meetings, and memos.
- Review and export a local report intake queue. The queue is built from
  page-level file preview block attributes and shows file kind, priority,
  workflow stage, relation gaps, and next action without reading file bytes,
  calling AI, connecting cloud services, or uploading data.
- Review and export a local report format playbook. The playbook groups intake
  items by format and recommends whether each kind should stay as native
  preview, become editable page content, enter a database import path, remain
  metadata-only, or be retained for download. It uses intake metadata only and
  does not read file bytes, converted file text, page body text, call AI, connect
  cloud services, load external resources, or upload data.
- Use the report intake desk to create one local report tracker row from an
  intake file. The intake action maps Report page relation, Format, Status,
  Source, and Key takeaways, checks for an existing tracker row first, and then
  opens the tracker for manual company/meeting/memo relation cleanup. It is a
  local single write and does not read report text, file text, file bytes, sync,
  upload, or call AI.
- Open reports from the sidebar Platform section or Cmd/Ctrl+K.

The current Report Library module is local-only. It does not upload reports,
call AI, sync files, or load external resources by itself.

The report module includes a local format support matrix for HTML reports,
Markdown/MDX, PDF, Excel/CSV/ODS, Word/ODT, PowerPoint/ODP, RTF, EPUB, ZIP,
Jupyter notebooks, media, text, code, and OPML. Legacy `.doc` and `.ppt` files
are saved locally and downloadable, but conversion requires `.docx` or `.pptx`.

The native format strategy is now explicit: a ZhiNotes page is the canonical
research container; HTML is the preferred native preview format for
AI-generated visual reports; Markdown is the preferred editable source format
for written notes; spreadsheets become local database candidates only after
typed confirmation; original files remain attached in local browser storage for
auditability.

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
- Review and export a local portfolio review radar. The review report checks
  position memo, watchlist, sizing discipline, conviction, catalyst, risk notes,
  thesis, research links, and tracker coverage without exporting page text,
  page titles, position names, tickers, weights, holdings, trading plans,
  transactions, or database row values.
- Use the portfolio intake desk to create one local portfolio tracker row from
  a position memo or watchlist page. The intake action maps Related memo
  relation, Status, Conviction, Thesis, and Risk notes, checks for an existing
  tracker row first, and then opens the tracker for manual company/report/meeting
  relation cleanup. It uses redacted labels and does not read page text, page
  titles, database row values, position names, tickers, weights, holdings,
  trading plans, transactions, sync, upload, brokerage accounts, prices, or AI.
- Open Portfolio from the sidebar Platform section or Cmd/Ctrl+K.

The current Portfolio module is local-only. It does not fetch prices, connect
brokerage accounts, sync holdings, import transactions, or send position data
externally. Tracker intake uses redacted local structure until the user manually
fills sensitive portfolio details inside the tracker.

## Meetings Module

Open the meetings module at:

```txt
http://localhost:3000/modules/meetings
```

Current local actions:

- Create a meeting note from the Meeting Notes template.
- Create a meeting tracker database with local relation fields and views.
- Track meeting notes, transcript pages, action items, company links, and report links.
- Review and export a local meeting follow-up queue. The follow-up report checks
  meeting notes, transcript structure, action items, company links, report
  links, and tracker database coverage without exporting meeting text,
  transcript text, recording bytes, participant details, meeting passcodes, or
  database row values.
- Review and export a local meeting research playbook. The playbook converts
  follow-up gaps into an action queue for meeting context, Transcript pages,
  action items, company/report relations, meeting tracker setup, and follow-up
  cadence without exporting page text, transcript text, recording bytes,
  participant details, meeting passcodes, or database row values.
- Use the meeting intake desk to create one local meeting tracker row from a
  meeting note. The intake action maps Meeting note relation, Status,
  Follow-up needed, and Action items, checks for an existing tracker row first,
  and then opens the tracker for manual relation cleanup. It is a local single
  write and does not sync, upload, publish notes, join calls, record audio, or
  call AI.
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
- Review and export a local AI research runbook. The runbook turns the selected
  workflow into an approval queue covering task scope, page context, file
  context, final payload preview, sensitive finance exclusions, provider/model
  policy, owner confirmation, permission audit events, and output retention. It
  excludes page body text, prompt text, file bytes, holdings, trading plans,
  client information, tokens, and secrets.
- Review and export a local AI output review contract. The contract defines how
  future AI output may enter ZhiNotes as a new page draft, append-only page
  update, database row draft, report page draft, or download-only result, but
  all write paths remain disabled. It does not read AI output text, create
  pages, overwrite pages, update databases, upload output, sync output, or
  include page body text, prompt text, file bytes, holdings, trading plans,
  client information, tokens, or secrets.
- Draft an AI request locally with selected page titles and privacy gates.
- Type the local AI outbound confirmation phrase and export a high-risk
  confirmation receipt. The receipt does not include page body text, prompt
  text, file bytes, tokens, or secrets, and it does not enable `/api/ai/run`.
- Inspect local file readiness by stored file type.

The current AI Workbench module does not call AI, upload selected pages, send
files, load external providers, save generated output, or write AI output back
into pages/databases. AI execution and AI output write-back should be enabled
only after provider, context, payload preview, source attribution, retention,
permission, audit, and deletion rules are explicit.

### AI Workflow Contract

The local AI workflow contract lives in:

```txt
src/lib/ai/aiWorkflowContract.ts
```

It defines five staged workflows: research summary, research Q&A, report draft,
document comparison, and research framework generation. The AI Workbench reads
this contract to build local request drafts, but `/api/ai/run` remains a
disabled stub. Payload previews, execution policies, and high-risk confirmation
receipts exclude page body text, prompt text, file bytes, tokens, and secrets
until the user explicitly confirms the final outbound boundary.

### AI Research Runbook

The local AI research runbook contract lives in:

```txt
src/lib/ai/aiResearchRunbook.ts
```

It defines the pre-execution approval queue for future AI research runs. The
current runbook is local-only, keeps `/api/ai/run` disabled, and does not include
page body text, prompt text, file bytes, holdings, trading plans, client
information, tokens, or secrets. AI execution should stay blocked until provider,
final payload, sensitive finance scope, permission audit, retention, and output
save/delete policies are explicit.

### AI Output Review Contract

The local AI output review contract lives in:

```txt
src/lib/ai/aiOutputReview.ts
```

It defines the post-generation gates before any future AI output can be saved
into ZhiNotes. The current contract is local-only, does not read AI output text,
does not create pages, does not overwrite pages, does not update databases, and
does not sync or upload output. New page drafts, append-only page updates,
database row drafts, report page drafts, and download-only results all require
manual preview, source attribution, sensitive-content review, retention policy,
permission checks, and audit events before write-back can be enabled.

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
  workspace link, bootstrap membership proof, payload preview, high-risk table
  scope, conflict baseline, disabled push API, and required owner confirmation
  phrase before any future upload flow can exist.
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
- Review and export a local conflict resolution contract for future sync apply.
  The contract maps keep-local, accept-remote, manual-merge, append-only,
  keep-both, and skip-and-flag actions to page, database, file, comment,
  permission, and restore conflict surfaces. All apply paths remain disabled; it
  does not read remote data, page bodies, row values, comment bodies, or file
  bytes, and it does not merge, write, update permissions, run restore, upload,
  connect cloud services, or acknowledge remote rows.
- Review and export a local side-by-side conflict review UI contract. The sync
  module now renders Base, Local, and Remote preview lanes for each conflict
  surface, but every action remains disabled. The preview uses placeholder
  evidence only and does not contact cloud services, read page bodies, row
  values, comment bodies, file bytes, write workspace data, or upload anything.
- Review and export a local remote baseline request contract. The contract
  defines the future `/api/sync/pull` baseline fetch as metadata-only and keeps
  it disabled: no network request, no cloud connection, no remote row staging,
  no acknowledgement, no apply, no workspace write, and no upload. Page bodies,
  database values, comment bodies, file bytes, and signed download URLs remain
  forbidden until explicit review gates are implemented.
- Review and export a local remote baseline staging contract. The contract
  defines a future `remote_baseline_stage` metadata store and maps staged
  metadata only to the Remote lane of the side-by-side review UI. Persistence,
  staging, acknowledgement, apply, workspace writes, and uploads remain
  disabled; payload fields such as page body text, database values, comment
  bodies, file bytes, and signed download URLs remain forbidden.
- Review and export a local remote baseline stage schema and cursor proof
  contract. The contract drafts `remote_baseline_stage` and
  `remote_baseline_cursor_proof` SQL, indexes, constraints, payload-column
  denylist, cursor monotonicity rules, and idempotency rules. It does not create
  migrations, apply SQL, connect a cloud database, persist cursor proof, stage
  rows, acknowledge rows, write workspace data, or upload anything.
- Review and export a local remote baseline disposable replay and RLS proof
  contract. The contract defines empty-workspace replay scenarios, payload
  denylist checks, workspace read/write isolation, cursor proof isolation,
  idempotency replay, and rollback proof. Replay, database connection, SQL
  apply, server writes, metadata staging, acknowledgements, and remote applies
  remain disabled.
- Type the local disposable replay confirmation phrase and export a high-risk
  confirmation receipt. The receipt records only local confirmation metadata for
  future empty-workspace replay and still does not connect a database, apply
  SQL, stage remote rows, write server data, read private workspace content,
  upload anything, or enable `/api/sync/replay-test`.
- Review and export a local empty-fixture replay package. The package contains
  only empty disposable workspace metadata, anonymous fixture users, zero stage
  rows, zero cursor rows, and a payload-column denylist. It does not include
  page text, database row values, comment bodies, file bytes, tokens, cookies,
  real remote rows, or signed URLs, and it still does not run replay or enable
  `/api/sync/replay-test`.
- Review and export a local disposable replay harness preflight. The preflight
  connects the replay confirmation receipt, empty-fixture package, stage schema,
  and replay/RLS proof contract into a dry-run checklist. It does not create or
  connect a database, apply SQL, start network requests, write server data,
  stage remote rows, acknowledge cursors, upload workspace data, or enable
  `/api/sync/replay-test`.
- Review and export a local disabled replay runner skeleton. The skeleton maps
  future runner entrypoints, phases, and refusal reasons, but all execution
  paths remain blocked: no database creation or connection, no network request,
  no SQL apply, no server write, no remote row staging, no acknowledgement, no
  private payload read, and no workspace upload.
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
- Review and export a local permission check envelope contract. The contract
  defines the future metadata-only request and response shape for
  `/api/permissions/check`: actor, role, resource, action, risk class,
  confirmation receipt, audit envelope, idempotency, decision status, and reason
  codes are allowed; page text, database values, comments, files, prompts, raw
  AI output, backup payloads, request bodies, signed URLs, tokens, cookies, and
  environment values stay forbidden. The endpoint remains disabled and returns a
  dedicated 501 permission-check schema guard instead of executable allow/deny
  decisions.
- Review local permission request validator fixtures. The validator accepts a
  metadata-only request and rejects fixed samples containing page text, nested
  prompt text, tokens, unknown payload fields, or missing actor metadata. It
  reports only field names and rejection paths, not raw request values.
- Review the local server permission test matrix. The matrix defines future
  server-side allow, deny, confirmation, and payload-rejection cases for Owner,
  Researcher, and Viewer before `/api/permissions/check` can enforce anything.
  It does not run server tests or enable permissions.
- Review the local server permission readiness report. The report combines the
  validator fixtures and server test matrix into blocked/ready gates for auth,
  workspace membership, audit linkage, high-risk confirmations, and route-level
  integration tests. The verdict remains not ready.
- Review and export a local high-risk action registry. The registry centralizes
  typed confirmation phrases and coverage for cloud sync, disposable replay,
  restore write-back, AI execution, HTML external resources, spreadsheet bulk
  import, future bulk delete, and future sharing. Exporting it does not enable
  any action or include workspace content.
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
  environment variables from `.env.example` are present, but never exposes
  secret values, connects cloud services, creates accounts, writes server data,
  or uploads workspace data.
- Review and export a local Web Beta launch checklist. The checklist connects
  product readiness, auth, cloud schema, file storage, sync replay, conflict
  review, restore rollback, restore write-back, payload confirmation,
  deployment gates, and observability into one preflight view; it does not
  deploy the app, create accounts, connect cloud services, write server data,
  or upload workspace data.
- Review and export a local Web Beta deployment target. The target keeps Vercel
  as the first Next.js Web Alpha host, Supabase as the cloud data plane, and
  Cloudflare as the DNS/CDN/WAF layer before any future Pages or Workers runtime
  review; it does not deploy the app, create cloud resources, connect services,
  read secrets, write server data, or upload workspace data.
- Review and export a local route/API preflight report. The report checks
  workspace routes, module routes, disabled API stubs, Cloud Alpha metadata
  routes, and the environment preflight endpoint against the launch checklist,
  but it does not send network requests, connect cloud services, upload data,
  read page bodies, or read file bytes.
- Review and export a local Web Beta smoke test plan. The plan defines
  pre-deploy checks, preview route checks, auth callback checks, disabled cloud
  defaults, private storage boundaries, Cloudflare edge staging, rollback,
  observability, and narrow-layout review; it does not run tests, send network
  requests, deploy the app, create accounts, connect services, read secrets,
  write server data, or upload workspace data.
- Review and export a local Web Beta next-action plan. The plan turns readiness
  and launch blockers into ordered P0/P1/P2 build work, but does not deploy the
  app, create accounts, connect cloud services, upload workspace data, read page
  bodies, or read file bytes.
- Review and export a local audit trail policy for future Web Beta event
  logging. The policy covers auth, export, restore, sync, sharing, permission,
  file, AI, and admin actions, but keeps page text, prompt text, file bytes,
  signed URLs, tokens, and secret values out of audit rows.
- Review and export a local audit event envelope contract. The contract defines
  the future metadata-only shape for `/api/audit/events`: ids, counts, hashes,
  statuses, permission decisions, confirmation receipts, and retention class are
  allowed; page text, database values, comments, files, prompts, raw AI output,
  backup payloads, request bodies, signed URLs, tokens, cookies, and environment
  values stay forbidden. The endpoint remains disabled.
- Inspect disabled local Web Beta API stubs for auth session, login start,
  logout, workspace list, workspace create, workspace bootstrap, sync push, sync
  pull, sync replay test, restore preview, restore apply, file presign,
  permission check, audit events, and cloud migration apply. These routes return
  disabled responses unless explicitly enabled; the permission check route uses
  a dedicated metadata-only schema guard, local validator fixture report, server
  permission test matrix, and server permission readiness report. They do not
  upload local notes, files, databases, backups, or sync queue rows.
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
explicitly enabled. A local workspace link now requires a successful bootstrap
membership proof for the selected cloud workspace and can export a local link
receipt. It does not upload local notes, files, databases, backups, run full
cloud sync, write restored data back into the workspace, share pages, or call AI.

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
- Local workspace linking requires a current bootstrap proof for the selected
  cloud workspace and can export a metadata-only local link receipt.
- The cloud sync opt-in gate treats a cloud workspace id alone as insufficient;
  it also requires recorded bootstrap proof with push/pull still disabled.
- Cloud routes stay disabled unless `ZHINOTES_CLOUD_ENABLED=true`.
- Auth routes that create or mutate sessions also require
  `ZHINOTES_ALLOW_CLOUD_WRITES=true`.
- Sync, file presign, permissions, audit, and restore write-back remain disabled
  until payload preview, permission checks, conflict handling, and rollback proof
  are implemented.
- The cloud sync confirmation phrase can produce a local receipt, but the
  receipt is audit evidence only and does not turn on cloud push.
- `npm run verify:web-beta` checks the local Web Beta contract before launch:
  environment keys, guarded API route files, local module routes, the deployment
  target contract, audit event envelope, permission check envelope, permission
  check API disabled schema, permission request validator fixtures, server
  permission test matrix, server permission readiness report, smoke test plan,
  and Supabase migration tables.
- `npm run verify:web-beta:smoke` checks the preview smoke-test checklist before
  launch: expected pages, disabled/gated high-risk API routes, local-only
  privacy boundaries, Cloud Alpha disabled defaults, private file storage
  disabled state, Cloudflare staging review, and Sync UI export wiring.
- `npm run verify:replay-harness` checks the disposable replay harness safety
  boundary: replay and apply endpoints stay disabled, fixture payload stays
  empty, no network/database/file-write execution appears in the harness or
  disabled runner skeleton, and the Sync UI keeps both exports visible.

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
npm run verify:ai
npm run verify:database
npm run verify:file-preview
npm run verify:modules
npm run verify:research-workflow
npm run verify:replay-harness
npm run verify:web-beta
npm run verify:web-beta:smoke
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
