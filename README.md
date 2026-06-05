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

- Notes and Pages: active module at `/modules/notes` for the page workbench,
  block editor, page tree, backlinks, comments, version history, and local page
  research structure review.
- Research Databases: active module at `/modules/databases` for table, list,
  kanban, calendar, gallery, timeline, chart, form, feed, local page relation
  fields, template rows, CSV export, XLSX export, confirmed
  spreadsheet-to-database import, and a schema/view/row-count dashboard.
- Report Library: beta module at `/modules/reports` for local HTML reports,
  Markdown notes, PDFs, Office files, notebooks, archives, takeaways, local
  tracker-row intake, report connection planning, linked companies, linked
  meetings, a local report tracker database, conversion review, format
  coverage, preview readiness, upload preflight, routing packets, review
  queues, and metadata-only file action receipts.
- File Library: beta module at `/modules/files` for local file metadata
  workbench routing across HTML, Markdown, PDF, Excel, Word, PowerPoint,
  notebooks, archives, media, editable import, database import, local retain,
  and cloud/AI confirmation boundaries.
- Company Research: beta module at `/modules/company-research` for company
  profiles, investment memos, earnings reviews, valuation assumptions, linked
  reports, linked meetings, company dossier planning, local tracker-row intake,
  and a local tracker database.
- Portfolio and Watchlist: beta module at `/modules/portfolio` for local
  position memos, watchlists, sizing discipline, catalyst review, risk notes,
  linked company pages, linked reports, linked meetings, local tracker-row
  intake, and a local portfolio tracker database.
- Meetings and Calls: beta module at `/modules/meetings` for meeting notes,
  transcripts, action items, follow-ups, linked company pages, linked reports,
  local tracker-row intake, and a local meeting tracker database.
- Research Projects: beta module at `/modules/projects` for turning a research
  question into a local project page, project checklist, module readiness view,
  project tracker schema, and research graph handoff.
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

- Project Tracker: project-page relation, status, project mode, priority,
  horizon, next review, research question, owner confirmation, related-company
  relations, related-report relations, related-meeting relations,
  related-portfolio relations, decision memo relation, and next action, plus
  project table, status board, review calendar, priority feed, and project
  status chart views.
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

The module center can export a local module starter pack. The starter pack turns
future module creation into a reusable contract: required file templates,
registry fields, route and shell expectations, starter wiring, extension slot
decisions, data surface boundaries, high-risk gates, and verification commands.
It is a local planning artifact only; exporting it does not create files, create
modules, write workspace data, read page text, read database rows, read file
bytes, connect cloud services, upload data, enable AI, or enable external
assets.

The module center can export a local module health report. The report maps the
product goal areas to registry-backed modules: module platform, notes,
databases, files/reports, company research, meetings, portfolio, research graph,
AI, and Web Beta. It shows which areas are ready, partial, or blocked without
reading page text, database rows, file bytes, prompts, credentials, or cloud
data.

The module center can export a local module roadmap report. The roadmap turns
registry, manifest, onboarding, starter pack, and health metadata into four
queues: active local modules, beta hardening, planned contracts, and Web launch
blockers. It does not create modules, change routes, write workspace data, read
page text, read database rows, read file bytes, connect cloud services, upload
data, or enable AI.

The module center now shows a local project progress snapshot at the top of
`/modules`. The snapshot turns module health, roadmap metadata, page count, and
database count into an owner-facing progress view: current stage, completed
foundation, beta-hardening work, owner-gated work, trial routes, launch
blockers, and verification commands. It can be exported as JSON for review, but
it only reads module metadata and counts; it does not read page text, database
row values, file bytes, secrets, cloud data, prompts, or credentials.

The module center now shows a new-module decision summary before the detailed
contracts. It makes the owner decision explicit: local module design, registry
contracts, local routes, shells, and safe local starters can continue; high-risk
actions, cloud services, AI, external assets, bulk/destructive operations, and
Web launch remain blocked until owner gates, payload preview, permission checks,
audit events, and rollback/scope review are explicit.

Run `npm run verify:modules` before treating a new module as part of the
platform. The verifier checks registry fields, unique module ids, route files,
extension slots, starter presets, local-only onboarding boundaries, sidebar
navigation, command palette wiring, module starter pack files/checklists/risk
gates, module health coverage, module roadmap lanes, and the module center
export surfaces.

## Notes and Pages

Open the notes module at:

```txt
http://localhost:3000/modules/notes
```

Open any local page at:

```txt
http://localhost:3000/page/<page-id>
```

Current local actions:

- Review and export the local 笔记工作台. The workbench summarizes active pages,
  root/child organization, favorite and locked pages, page structure status,
  file blocks, inline database blocks, wiki-link counts, backlinks, version
  counts, comment counts, unresolved comment counts, and suggested next actions.
- Review the Notes decision summary before drilling into the workbench. The
  summary separates the page knowledge-base foundation, research structure,
  research links and review trail, format/export boundary, and blocked
  AI/cloud-sync boundary.
- Use the notes workbench lanes for 笔记入口, 投研结构, 研究关联, 复盘痕迹,
  知识库组织, and 导出安全.
- Use the notes workbench review sequence to jump through the note workflow:
  create a first note, review structure gaps, connect research context, and
  handle review trail issues.
- Create blank research notes or template-backed local pages for investment
  memos, company research, meeting notes, and research reports from the notes
  module.
- Write and edit Notion-like page content with headings, lists, tasks, toggles,
  callouts, tables, formulas, synced blocks, embeds, wiki links, file previews,
  inline databases, comments, backlinks, and version history. The block insert
  menu supports Heading 1, Heading 2, and Heading 3 so mouse-driven block
  editing matches the heading shortcut set.
- Use `/page` from the slash menu or `新建子页面` from Cmd/Ctrl+K to create a
  child page, seed it with its parent-page link and a starting paragraph, insert
  the page link, and automatically enter the new page. Heading 3 supports
  Cmd/Ctrl+Shift+3 when the browser receives it, plus Cmd/Ctrl+Alt+3 as the
  browser-safe fallback because macOS can reserve Cmd+Shift+3 for screenshots.
- Add page icons, covers, sub-pages, local page links, duplicate pages, lock
  editing, switch page width, save named versions, and export HTML, Markdown, or
  browser PDF.
- Review the Info panel for page metadata, local word/block counts, file/table
  counts, and the new 投研结构 summary.
- Use the 投研结构 panel as a local checklist for outline coverage, investment
  conclusions, thesis markers, sources, action items, research relations, file
  blocks, inline databases, and review trail.
- Review the 下一步队列 inside the 投研结构 panel. The queue converts missing
  structure gates into suggested-only actions such as adding H2/H3 sections,
  writing an investment decision, adding evidence, linking relations, or saving
  a review trail. It does not edit the page automatically.
- Use 插入结构块 on a suggested action to append a blank local structure block to
  the current page. This writes only the selected scaffold into the current
  local page; it does not generate research content, call AI, sync, or upload.
- Export a local 导出结构报告 JSON from the Info panel. The export preserves
  the structure summary, gates, signals, and suggested actions for later review.

The local notes module and page research structure panel run in the browser. The
notes workbench reads active page metadata, local page HTML structure, version
counts, comment counts, wiki-link counts, favorite state, and lock state. It
does not read linked page bodies, database row values, uploaded file bytes, AI
prompts, tokens, credentials, cloud data, or private research content. It does
not upload data, connect cloud services, call AI, or write workspace data.
The local page research structure panel remains the per-page drill-down for
current-page outline, gates, signals, and suggested-only scaffold insertion.
It does not read linked page bodies, database row values, uploaded file bytes, AI prompts, tokens, credentials, cloud data, or private research content.
The notes workbench export excludes page body text, comment body text, linked
page bodies, database row values, file bytes, tokens, credentials, cloud data,
and AI output.
The Notes decision summary follows the same local metadata-only boundary: it can
route the owner to page creation, structure review, research linking, review
trail cleanup, file/export routes, and sync/AI gates, but it does not include
page body text, comment body text, linked page bodies, database row values, file
bytes, prompts, tokens, credentials, cloud data, or AI output.
The structure report export excludes page titles, page body text, linked page bodies, database row values, file bytes, tokens, credentials, cloud data, and AI output.

Run `npm run verify:page-structure` before treating the Notes and Pages
research-structure panel as part of the local product contract.

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
- Review and export a local database workbench packet. The workbench combines
  the dashboard, view readiness, template-row readiness, and import/export
  readiness into tracker-fit, relation setup, template intake, view design,
  import/export, and manual-review lanes.
- Review a database decision summary before drilling into the workbench. The
  summary separates safe local schema/view review, relation schema review,
  manual template-row intake, spreadsheet import/export gates, and the blocked
  cloud/AI/sync boundary.
- Use the database workbench to see which tracker needs relation fields, first
  template rows, next views, or import/export confirmation before editing the
  underlying database.
- Use the database workbench review sequence to jump through tracker setup:
  create the first tracker, review relation schema, template-row readiness,
  view readiness, and import/export boundaries.
- Review coverage for table, list, kanban, calendar, gallery, timeline, chart,
  form, and feed views.
- Use local database fields for text, number, relation, select, multi-select,
  status, date, checkbox, URL, email, phone, created time, and last edited time
  values. Table and form views use native email/phone inputs, multi-select
  chips, and read-only system time properties; feed chips make them actionable,
  charts can group multi-select options or system time months, and CSV/XLSX
  append import can infer email/phone columns, preserve matched multi-select
  fields locally, or skip writes to read-only system fields.
- Review and export local template-row readiness. The report checks whether
  each database has the recommended field groups for company, report, meeting,
  and portfolio template rows before the user creates rows in a database page.
- Create template rows from the `+ 模板行` menu in full database pages or inline
  databases. Template rows now prefill safe structural fields such as Status,
  Format/Type, Date, Follow-up, Source, and placeholder research text when the
  current database schema supports them.
- The template-row menu previews how many schema fields will be prefilled and
  how many remain manual before the user creates the row.
- Creating a template row also writes a local metadata-only template-row receipt
  that can be exported from the database page. The receipt records template
  type, local row/page ids, and prefilled/manual field counts only.
- Review and export local template-row receipt history from the database module.
  The history combines full database page and inline database template-row
  receipts without field names, row values, page body text, tokens, credentials,
  cloud data, or sensitive investment fields.
- Review and export local database import/export readiness. The module center
  shows which databases are ready for CSV/XLSX value export, which can receive
  Excel/CSV/ODS append imports, which need schema work first, and which actions
  require typed confirmation. This report reads schema, views, and row counts
  only; it does not read row values, spreadsheet values, page text, upload,
  sync, or call AI.
- Open any local database from the module list.

The database module dashboard and readiness reports read schema, view metadata,
template metadata, and row counts only. They do not read database row values,
page bodies, file bytes, prompts, tokens, cloud data, or private research
content; template-row readiness also does not export database field names.
The database workbench follows the same boundary: it does not read row values,
page text, spreadsheet cell values, or file bytes, and it does not create rows,
create fields, import values, export values, connect cloud services, upload
data, or enable AI.
The database decision summary follows the same metadata-only contract: it can
route the owner to schema/view review, relation review, template-row readiness,
and import/export gates, but it does not include field names, row values,
spreadsheet values, page text, prompts, tokens, credentials, cloud data, or AI
output.
Template-row field drafts also avoid sensitive investment fields such as ticker,
holdings, position size, weights, prices, rating, direction, broker/account, and
trading plan fields; those remain manual. Template-row receipts exclude database
titles, field names, row values, page body text, tokens, credentials, and cloud
data.
CSV/XLSX exports remain inside the individual database page because those
exports intentionally include current visible row values.

## Database Relations

Databases support a local `relation` field type. A relation field stores page
ids locally, displays them as clickable page chips in table/form workflows, and
exports them to CSV/XLSX as page titles.

Current relation scope:

- Relation targets are local pages.
- Table and form views support editing relations.
- List and gallery views display relation titles.
- Timeline views display key tracker context fields, including relation titles,
  and keep the same inline row creation workflow as list/gallery views.
- Feed views display key tracker fields, relation page chips, dates, statuses,
  links, and checkbox follow-up toggles for investment-research scanning.
- CSV and XLSX export write related page titles, not internal ids.
- Database pages accept focused relation handoff routes with `q`, `focus`, and
  `handoff` parameters. The page shows the source module, focused asset, target
  tracker, candidate rows, usable relation fields, and a local privacy boundary
  before any manual relation write.
- Company, report, meeting, and portfolio modules share a local research graph
  panel. It can export a graph report with asset titles, module coverage,
  relation fields, links, completion suggestions, and relation schema gaps,
  without including page bodies, database row values, uploaded file bytes,
  prompts, tokens, or cloud data.

## Research Projects Module

Open the research projects module at:

```txt
http://localhost:3000/modules/projects
```

Current local actions:

- Turn one research question into a local project brief with first-coverage,
  earnings-review, variant-view, meeting-follow-up, or portfolio-review mode.
- Create a local project page from the brief. The page opens immediately after
  creation and contains project settings, graph metrics, module readiness, a
  task checklist, review order, owner-confirmation items, and privacy
  boundaries.
- Create a local project tracker database preset. The preset creates schema and
  views only: Project page, Status, Project mode, Priority, Horizon, Next
  review, Research question, Owner confirmation, related-company/report/meeting
  /portfolio relations, Decision memo, and Next action.
- Create a local project page and one project tracker row after an explicit
  user click. The intake maps Project page / 项目页, Status, Project mode,
  Priority, Horizon, Research question, Owner confirmation, and Next action
  from the project brief into the tracker row.
- When the project module opens the tracker database with `handoff=projects-module`,
  the database relation assistant prioritizes Project page / 项目页 relation
  fields so the project page is not accidentally added to company, report,
  meeting, or portfolio relation fields. Candidate rows also prioritize rows
  already linked to the current project page.
- The `/modules` project progress snapshot recommends this projects workflow as
  an owner trial route so the current stage overview matches the implemented
  project page, tracker row, and handoff loop.
- Review module readiness for company, report, meeting, and portfolio context
  from the shared research graph summary.
- Export the current project brief as local JSON.

The Projects module does not silently auto-write tracker rows, cross-module
relation values, AI payloads, cloud sync data, holdings, trading plans, file
bytes, or page bodies. It is a local project capture layer that turns a research
topic into a page, optional tracker schema, and an explicitly requested tracker
row before any deeper automation is considered.

## Research Graph Module

Open the research graph module at:

```txt
http://localhost:3000/modules/research-graph
```

Current local actions:

- Review the research graph decision summary at the top of the module. It
  separates graph coverage review, manual relation handoffs, schema-field setup,
  cross-module follow-up, and the blocked AI/cloud/bulk-write boundary before
  any relation value or schema change is attempted.
- View company, report, meeting, and portfolio asset coverage in one place.
- Review recent relation links across local research trackers.
- Identify local assets that still need structured relation fields.
- Review a prioritized breakage queue for unlinked company, report, meeting,
  and portfolio assets. The queue ranks company/report gaps first, separates
  actionable relation-value work from missing tracker targets, and only opens
  local pages or databases; it does not auto-write relation values.
- Review relation handoff packets for actionable assets. Each packet turns one
  unlinked asset into a local four-step checklist: confirm the source page, open
  the target tracker, check the relation field, and manually add one relation
  value. The packet is metadata-only and does not read page bodies, export row
  values, include holdings/trading plans, auto-write relation values, or upload
  data.
- Review and export a local research workbench action packet. The packet turns
  graph health, priority breaks, schema gaps, and missing trackers into company,
  report, meeting, portfolio, and relation-setup work lanes. It only opens local
  module/page/database routes and does not auto-write relation values, create
  schema fields, read page bodies, read database row values, read file names,
  read file bytes, upload data, connect cloud services, or enable AI.
- Start a local research project brief from the graph page. The project brief
  supports first coverage, earnings review, variant-view, meeting follow-up, and
  portfolio-review modes, then turns the current graph/workbench summary into a
  module readiness view, recommended route order, and checklist across company,
  report, meeting, portfolio, relation repair, schema/tracker setup, and the
  externalization boundary.
- Create a local research project page from the brief after a manual click. The
  page is created inside the browser-local workspace, then ZhiNotes immediately
  opens the new page so the workflow matches Notion-style project capture. The
  generated page contains project settings, a module readiness table, a task
  checklist, recommended review order, owner-confirmation items, and privacy
  boundaries.
- Export the research project brief as local JSON. The export can include the
  owner-entered project topic and horizon, but it does not include page bodies,
  database row values, file names, file bytes, holdings, trading plans, prompts,
  credentials, cloud data, or AI output.
- Review suggested completion targets for unlinked assets and jump into the
  right local database with `q`, `focus`, and `handoff` parameters prefilled.
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
The research graph decision summary follows the same metadata-only boundary: it
reads only aggregate graph/workbench summaries and does not include page bodies,
database row values, file names, file bytes, holdings, trading plans, prompts,
tokens, credentials, cloud data, or AI output. It is a local routing layer for
what can be reviewed now, what requires owner confirmation, and what remains
blocked.
The research project brief follows the same boundary: it reads the local graph
report and workbench packet only, adds owner-entered project fields, and remains
a planning/export layer. Its only write path is the explicit `创建项目页`
button, which creates one local page from the current brief and opens that page.
It does not create database rows, write relation values, upload data, connect
cloud services, or enable AI.

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
- Review and export a local company research Dossier plan. The Dossier plan
  turns coverage gaps into per-company research dossiers for company home,
  investment memo, earnings review, valuation assumptions, key metrics, related
  reports, related meetings, and tracker setup. It does not read or export page
  text, database row values, file bytes, holdings, trading plans, cloud data, AI
  prompts, tokens, or credentials, and it does not write workspace data.
- Review and export a local company research workbench packet. The packet
  combines coverage, playbook, dossier, and tracker-intake metadata into one
  action queue for company foundation, thesis workflow, earnings/valuation,
  research links, tracker intake, review cadence, and privacy boundary review.
  It exports aggregated routing only, not company names, page titles, page text,
  row values, file names, file bytes, holdings, trading plans, cloud data, AI
  prompts, tokens, or credentials.
- Review the company research decision summary before drilling into the
  workbench. The summary separates company foundation, thesis/Dossier,
  earnings/valuation/metrics, report-meeting links and tracker intake, and the
  blocked AI/cloud-sync/sensitive-investment boundary.
- Use the company workbench review sequence to jump through the company
  research workflow: create research assets, review coverage gaps, process the
  playbook, link reports/meetings, intake a tracker row, and review sync/AI
  privacy boundaries.
- Use the company intake desk to create one local company tracker row from a
  company research page. The intake action maps Company page relation, Status,
  Thesis, identifiable Ticker, valuation assumptions, and key metrics, checks
  for an existing tracker row first, and then opens the tracker for manual
  report/meeting relation cleanup. It is a local single write and does not read
  page text, database row values, file bytes, holdings, trading plans, sync,
  upload, or call AI.
- Open company research from the sidebar Platform section or Cmd/Ctrl+K.

The company research playbook, workbench packet, and company intake desk are
local-only. They read coverage structure and tracker field schema, but they do
not read or export page text, database row values, file bytes, holdings, trading
plans, cloud data, AI prompts, tokens, or credentials.
The company research decision summary follows the same metadata-only boundary:
it can route the owner to company asset creation, coverage review, Dossier
review, report/meeting relation review, tracker intake, and sync/AI gates, but
it does not include company names, page titles, page text, database row values,
file names, file bytes, holdings, trading plans, prompts, tokens, credentials,
cloud data, or AI output.

## Report Library Module

Open the report library module at:

```txt
http://localhost:3000/modules/reports
```

Current local actions:

- Review the report decision summary at the top of the module. It separates
  HTML page-native preview, Markdown editable import, PDF/Office conversion
  review, tracker relation intake, and the blocked AI/cloud-sync/external
  resource boundary before the owner touches deeper queues.
- Create a report note from the Research Report template.
- Upload one or more local report files in a single selection. Each file creates
  a local report page with a file preview block and a local metadata-only action
  receipt; files are not uploaded, synced, sent to AI, or loaded through
  external resources.
- Create a report tracker database with local relation fields and views.
- Track report pages, local file preview pages, HTML reports, companies, meetings, and memos.
- Review and export a local report intake queue. The queue is built from
  page-level file preview block attributes and shows file kind, priority,
  workflow stage, relation gaps, and next action without reading file bytes,
  calling AI, connecting cloud services, or uploading data.
- Review and export a local next-step review queue. The queue turns intake
  files into operational research workstreams such as first-pass reading,
  conversion review, spreadsheet/database review, source triage, relation
  linking, and local retain. It uses local metadata only and does not read file
  text or bytes, sync, upload, load external resources, or call AI.
- Review and export a local report connection plan. The plan turns intake
  metadata and local database metadata into report-to-company,
  report-to-meeting, report-to-memo, and portfolio relation suggestions. It
  does not read report text, file text, file bytes, database rows, row values,
  prompts, cloud data, or credentials, and it does not write relation values.
- Review and export a local report format playbook. The playbook groups intake
  items by format and recommends whether each kind should stay as native
  preview, become editable page content, enter a database import path, remain
  metadata-only, or be retained for download. It uses intake metadata only and
  does not read file bytes, converted file text, page body text, call AI, connect
  cloud services, load external resources, or upload data.
- Review and export a local conversion quality review. The review separates
  native display from local conversion, flags PPT/Word/Excel layout and fidelity
  risk, tracks legacy `.doc/.ppt` blockers, and uses only file kind, extension,
  count, and capability metadata. It does not export file names, read file
  bytes, converted file text, page body text, call AI, sync, or upload data.
- Use the report intake desk to create one local report tracker row from an
  intake file. The intake action maps Report page relation, Format, Status,
  Source, and Key takeaways, checks for an existing tracker row first, and then
  opens the tracker for manual company/meeting/memo relation cleanup. It is a
  local single write and does not read report text, file text, file bytes, sync,
  upload, or call AI.
- Open reports from the sidebar Platform section or Cmd/Ctrl+K.

The current Report Library module is local-only. It does not upload reports,
call AI, sync files, or load external resources by itself.
The report decision summary follows the same metadata-only boundary: it reads
only aggregate local workflow summaries and does not include report titles, file
names, page text, file bytes, extracted text, database row values, prompts,
tokens, credentials, cloud data, or AI output. Its purpose is to make clear what
is currently safe to do locally, what must stay closed, and what requires owner
confirmation.

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

The generic file preview entrypoints now allow any local file to be selected.
Known formats render through their local preview routes; unknown formats still
enter the page as local attachments with metadata/download retention instead of
being blocked at the picker.

Inside the editor slash menu, `/html` now opens the HTML report path directly
and inserts a sandboxed native preview block. `/markdown preview` inserts a
local Markdown/MDX file preview block and keeps the original file attached.
`/markdown import` imports a Markdown file into the current page as editable
blocks. This separates the two common workflows: AI-generated HTML reports stay
as native previews, while personal Markdown notes can either stay attached or be
converted into editable page content.

The Reports module also renders a local upload preflight before file selection.
It shows how each supported format will be routed inside a page: native preview,
local conversion, editable import, database candidate, metadata review, or
download retention. This preflight reads only capability metadata; it does not
read file names, file bytes, file text, page body text, spreadsheet values,
tokens, credentials, cloud data, or AI output.

The Reports module also renders and exports a local file preview routing packet.
It combines preview readiness, live format coverage, and the review queue into
one route map for native preview, editable import, spreadsheet database import,
metadata review, local retain, and gap review. The packet does not include file
names, file bytes, file text, page body text, database row values, cloud data,
or AI output, and it does not write workspace data or load external resources.
Use the routing packet review sequence to jump through the report/file workflow:
review native previews, inspect converted formats, confirm spreadsheet import
boundaries, and resolve legacy or unknown format gaps.

Uploading a report file into the Reports module now creates a metadata-only
local file action receipt for the native page preview path, or for download
retention when the file can only be kept locally. The receipt does not include
the file name, file bytes, extracted text, page body text, spreadsheet values,
tokens, or credentials.

Each file preview block also shows the active local route for that format:
native preview, local conversion, metadata preview, or download-only retention,
plus the matching edit/import route and privacy boundary. Legacy `.doc` and
`.ppt` files are labeled as download-only until converted to `.docx` or `.pptx`.
Download-only or metadata fallback blocks, including legacy Office files,
unknown files, and ZIP archives, can record a local retention receipt from the
page preview block. The receipt confirms the file stayed local and does not
include file names, file bytes, extracted text, page body text, spreadsheet
values, tokens, credentials, cloud data, or AI output.

Each file preview block also renders a local document structure strip. For
HTML, Markdown, text, notebook, Word, PPT, Excel, EPUB, RTF, OPML, and ZIP
preview paths, the strip summarizes headings, tables, links, media, code,
estimated sheets, estimated slides, and outline chips from already-loaded local
preview text or converted preview HTML. It does not read file bytes, include
file names, upload data, connect cloud services, call AI, or write workspace
data.

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

## File Library Module

Open the file library module at:

```txt
http://localhost:3000/modules/files
```

Current local actions:

- Review the file format decision summary at the top of the module. It makes
  the page-native preview, editable import review, spreadsheet database import,
  legacy/unknown retention, and Cloud/AI/Sync boundaries explicit before any
  file leaves local preview.
- Review the native format strategy. ZhiNotes page is the canonical container;
  HTML is the preferred native format for AI-generated visual reports, Markdown
  is the preferred editable format for written notes, spreadsheets become local
  database candidates, and Office/PDF/Notebook/archive formats stay behind local
  preview, conversion review, metadata retain, or owner-gated import paths.
- Review a local file workbench generated from IndexedDB file metadata and the
  file preview capability matrix.
- Review the file library format route matrix directly in `/modules/files`,
  including supported extensions, local file counts, confirmation needs, and
  privacy boundaries for each format family.
- Route HTML reports, Markdown notes, PDFs, Office files, notebooks, archives,
  spreadsheets, media, and unknown files into native preview, editable import,
  database import, metadata review, local retain, or cloud/AI boundary lanes.
- Open each file workbench lane directly from its card. Local lanes scroll to
  the matching file-library section; cross-module lanes open Reports,
  Databases, or Sync with a section anchor such as `#reports-preview-routing`,
  `#databases-import-export-readiness`, or `#web-beta-owner-review`, without
  reading file bytes or writing workspace data.
- Use the file review sequence to jump to the matching local module or section
  for native preview, conversion review, database import, and sync/AI boundary.
- Open the Reports module for real local file upload, the Notes module for
  editable writing, and the Databases module for confirmed spreadsheet import.
- Export a metadata-only file workbench. The export excludes file names, file
  bytes, file text, page body text, spreadsheet values, cloud data, AI prompts,
  tokens, and credentials.

The File Library module is a local routing desk, not a bulk importer. It does
not delete files, upload files, sync files, call AI, load HTML external
resources, execute notebooks, unzip archives into the workspace, or create
database rows. Those higher-risk actions must stay behind the existing Reports,
Databases, Sync, and AI confirmation gates.

## Portfolio and Watchlist Module

Open the portfolio module at:

```txt
http://localhost:3000/modules/portfolio
```

Current local actions:

- Review the portfolio decision summary at the top of the module. It separates
  local portfolio asset intake, position discipline/thesis/risk review,
  catalyst and research-link cleanup, tracker row intake, and the blocked
  brokerage/price/AI/cloud boundary before any sensitive portfolio data leaves
  local review.
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
- Review and export a local portfolio workbench packet. The packet combines the
  portfolio review radar and tracker-intake metadata into one redacted action
  queue for idea intake, position discipline, thesis/risk, catalyst review,
  research links, tracker intake, and privacy boundary review. It exports
  aggregated routing only, not page titles, position names, tickers, weights,
  holdings, trading plans, transactions, brokerage data, prices, cloud data, AI
  prompts, tokens, or credentials.
- Use the portfolio workbench review sequence to jump through the portfolio
  workflow: create portfolio assets, review sizing/thesis/risk/catalyst gaps,
  link company/report/meeting research, process tracker intake, and review
  sync/AI/brokerage privacy boundaries.
- Use the portfolio intake desk to create one local portfolio tracker row from
  a position memo or watchlist page. The intake action maps Related memo
  relation, Status, Conviction, Thesis, and Risk notes, checks for an existing
  tracker row first, and then opens the tracker for manual company/report/meeting
  relation cleanup. It uses redacted labels and does not read page text, page
  titles, database row values, position names, tickers, weights, holdings,
  trading plans, transactions, sync, upload, brokerage accounts, prices, or AI.
- Open Portfolio from the sidebar Platform section or Cmd/Ctrl+K.

The current Portfolio module and portfolio workbench are local-only. They do
not fetch prices, connect brokerage accounts, sync holdings, import
transactions, or send position data externally. Tracker intake uses redacted
local structure until the user manually fills sensitive portfolio details inside
the tracker.
The portfolio decision summary follows the same metadata-only boundary: it reads
only aggregate review and tracker-intake summaries and does not include page
titles, page text, position names, tickers, weights, holdings, trading plans,
transactions, brokerage data, prices, prompts, tokens, credentials, cloud data,
or AI output. It is a local routing layer for what is safe now, what stays
closed, and what requires owner confirmation.

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
- Review and export a local meeting decision ledger. The ledger checks whether
  meetings have been converted into decision summaries, thesis impact, model
  impact, risk watch items, catalyst follow-ups, and open questions without
  exporting meeting text, transcript text, recording bytes, participant
  details, meeting passcodes, holdings, trading plans, or database row values.
- Review and export a local meeting research task queue. The queue merges the
  meeting follow-up queue and meeting decision ledger into next research tasks
  for Transcript review, decision capture, model updates, risk/catalyst review,
  open questions, relation linking, and tracker intake without exporting page
  text, meeting text, transcript text, recording bytes, participant details,
  meeting passcodes, database row values, holdings, trading plans, sync, upload,
  or AI.
- Review and export a local meeting research playbook. The playbook converts
  follow-up gaps into an action queue for meeting context, Transcript pages,
  action items, company/report relations, meeting tracker setup, and follow-up
  cadence without exporting page text, transcript text, recording bytes,
  participant details, meeting passcodes, or database row values.
- Review and export a local meeting workbench packet. The packet combines
  follow-up, decision ledger, research queue, playbook, and tracker-intake
  metadata into one action queue for meeting capture, transcript review,
  decision ledger, research tasks, tracker intake, relation linking, and privacy
  boundary review. It exports aggregated routing only, not meeting titles, page
  text, transcript text, recording bytes, participant details, meeting passcodes,
  database row values, holdings, trading plans, cloud data, AI prompts, tokens,
  or credentials.
- Review the meeting decision summary before drilling into the workbench. The
  summary separates meeting asset capture, transcript review, decision ledger,
  relation/tracker intake, and the blocked automation/cloud/AI/publishing
  boundary.
- Use the meeting workbench review sequence to jump through the post-meeting
  workflow: create meeting assets, review transcript gaps, capture investment
  conclusions, process the research queue, link companies/reports, intake a
  tracker row, and review sync/AI/privacy boundaries.
- Use the meeting intake desk to create one local meeting tracker row from a
  meeting note. The intake action maps Meeting note relation, Status,
  Follow-up needed, and Action items, checks for an existing tracker row first,
  and then opens the tracker for manual relation cleanup. It is a local single
  write and does not sync, upload, publish notes, join calls, record audio, or
  call AI.
- Open meetings from the sidebar Platform section or Cmd/Ctrl+K.

The current Meetings module and meeting workbench are local research workspaces.
They do not join calls, record audio, publish notes, sync data, upload data, or
call external services.
The meeting decision summary follows the same metadata-only boundary: it can
route the owner to meeting asset creation, transcript structure review,
decision-ledger cleanup, research queue processing, relation review, tracker
intake, and sync/AI/publishing gates, but it does not include meeting titles,
page text, transcript text, recording bytes, participant details, meeting
passcodes, database row values, holdings, trading plans, prompts, tokens,
credentials, cloud data, or AI output.

## AI Workbench Module

Open the AI workbench module at:

```txt
http://localhost:3000/modules/ai
```

Current local actions:

- Review the AI decision summary at the top of the module. It gives a one-page
  owner decision view: local owner review can continue, final payload review
  requires explicit confirmation, and model execution, provider/cloud access,
  output write-back, and AI sync remain blocked.
- Select an AI workflow such as summary, Q&A, report draft, comparison, or
  research framework.
- Select local page context explicitly.
- Review and export a local AI workbench packet. The packet combines workflow
  readiness, payload preview, execution policy, prompt blueprint, context packet,
  research runbook, and output review summaries into lanes, priority actions,
  and an enablement sequence. It excludes selected page titles, page body text,
  prompt text, file bytes, AI output text, holdings, trading plans, client
  information, tokens, and secrets.
- Use the AI workbench enablement sequence to jump through local AI gates:
  confirm task scope and sensitive boundaries, review context and outbound
  payload, check provider/permission requirements, and review output-save gates.
- Review and export a local AI payload preview. The preview summarizes selected
  pages, available file kinds, prompt length, and required approvals, but
  excludes page body text, file bytes, prompt text, model calls, and external
  uploads.
- Review and export a local AI execution policy. The policy lists provider,
  final payload, page context, file content, retention, permission, and audit
  gates; `/api/ai/run` is a disabled local stub and does not read request bodies,
  call model providers, upload workspace data, or store AI output.
- Review and export a local AI prompt blueprint. The blueprint defines reusable
  prompt sections, output schemas, citation rules, validation checks, and
  blockers for summary, Q&A, report draft, comparison, and research framework
  workflows. It uses workflow and payload metadata only and does not read prompt
  text, page body text, file bytes, holdings, trading plans, client information,
  tokens, or secrets.
- Review and export a local AI context packet. The packet combines workflow
  metadata, prompt blueprint metadata, selected page titles, available file
  kinds, sensitive exclusions, source rules, and a final outbound checklist. It
  is metadata-only and does not read prompt text, page body text, file bytes,
  holdings, trading plans, client information, tokens, or secrets.
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

### AI Workbench Packet

The local AI workbench packet contract lives in:

```txt
src/lib/ai/aiWorkbench.ts
```

It is the AI module control layer. It turns workflow readiness, payload preview,
execution policy, prompt blueprint, context packet, research runbook, and output
review summaries into local lanes, priority actions, and an enablement sequence.
The packet is local-only and does not include selected page titles, page body
text, prompt text, file bytes, AI output text, holdings, trading plans, client
information, tokens, secrets, cloud data, or credentials. It does not call model
providers, upload data, write workspace data, save AI output, create pages,
update databases, connect cloud services, or enable `/api/ai/run`.

### AI Context Packet

The local AI context packet contract lives in:

```txt
src/lib/ai/aiContextPacket.ts
```

It prepares a metadata-only review packet for future AI runs. The packet lists
the selected workflow, prompt blueprint metadata, selected page titles,
available file kinds, source rules, sensitive exclusions, and final outbound
checklist items. It does not read prompt text, page body text, file bytes,
holdings, trading plans, client information, tokens, or secrets, and it does
not call model providers or enable `/api/ai/run`.

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
- Review the owner-facing Web launch decision summary. It combines the Web
  launch workbench, Web Alpha launch decision receipt, and Web Beta owner
  review into a top-level go/no-go view: local build can continue, but preview
  sharing, Web Beta launch, cloud sync, deployment, and AI remain disabled.
- Review and export a local Web launch workbench packet. The packet combines
  Web Beta stage gates, next actions, owner review, launch checklist, route
  preflight, environment presence, deployment target, and sync opt-in metadata
  into launch lanes, P0 actions, and an enablement sequence. It keeps the
  verdict at local app can continue, Web Beta cannot launch, and cloud sync
  cannot start.
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
- Review and export a local private file storage policy. The policy maps future
  private Supabase Storage buckets, `/api/files/presign` metadata requests,
  signed URL TTL, checksums, file size limits, file-class strategies,
  permission gates, audit gates, and forbidden payload fields. It does not
  create buckets, generate signed URLs, connect cloud services, read file names,
  read file bytes, upload files, or enable file sync.
- Review and export a local file presign API guard. `/api/files/presign` now
  returns a dedicated disabled schema response with planned metadata-only
  request fields, forbidden payload fields, no-URL response fields, fixture
  checks, and enablement gates. It still does not read request bodies, inspect
  file metadata, generate signed URLs, expose public links, upload files, write
  audit logs, or return storage credentials.
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
- Review and export a local Web Alpha handoff bundle. The bundle summarizes
  launch contracts, stage gates, route preflight, smoke tests, next actions,
  owner decisions, command checks, and excluded private payload classes into
  one review packet. It does not deploy, connect cloud services, create
  accounts, write server data, upload workspace data, enable sync, enable AI,
  read page bodies, read database row values, read file bytes, or expose secret
  values.
- Review and export a local Web Alpha launch decision receipt. The receipt
  answers whether local work can continue, whether a preview can be shared, and
  whether cloud sync can start. It currently records a no-go preview/cloud
  verdict, lists P0 blockers and owner decisions, and does not deploy, connect
  cloud services, upload workspace data, enable sync, enable AI, read page
  bodies, read database row values, read file bytes, or expose secrets.
- Review and export a local Web Beta owner review packet. The packet rehearses
  the owner go/no-go review with questions, P0 blockers, local-first work,
  required verification commands, completion evidence, and forbidden actions
  before approval. It does not launch Web Beta, deploy, connect cloud services,
  upload workspace data, enable sync, enable AI, read page bodies, read database
  row values, read file names, read file bytes, or expose secrets.
- Review and export a local Web launch workbench packet. The packet is the
  Sync/Web Beta control layer: it merges stage gates, next actions, owner review,
  launch checklist, route preflight, environment presence, deployment target,
  and sync opt-in into lanes, P0 actions, and launch sequence steps. It keeps
  the verdict at local app can continue, Web Beta cannot launch, and cloud sync
  cannot start; it does not deploy, connect cloud services, create accounts,
  upload workspace data, enable sync, enable AI, read page bodies, read database
  row values, read file names, read file bytes, expose secrets, or export
  holdings/trading plans.
  Its launch sequence cards can also jump to the matching review sections:
  stage gate, deployment target, and owner review.
- Run `npm run verify:web-alpha` to execute the local Web Alpha verification
  command bundle and print a receipt. The receipt runs lint, Web Beta contract
  verification, smoke verification, replay harness safety verification, and a
  production build, but still does not deploy, connect cloud services, upload
  workspace data, enable sync, or approve preview sharing.
- Review and export a local Web Beta next-action plan. The plan turns readiness
  and launch blockers into ordered P0/P1/P2 build work, but does not deploy the
  app, create accounts, connect cloud services, upload workspace data, read page
  bodies, or read file bytes.
  Each action now includes owner, local-first/cloud-required path, cloud
  dependency, verification commands, completion evidence, and forbidden actions
  before owner confirmation.
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
- Review and export a local audit events API guard. `/api/audit/events` now
  returns a dedicated disabled schema response with planned metadata-only
  request fields, receipt-only response fields, forbidden payload classes,
  fixture checks, and enablement gates. It still does not read request bodies,
  accept event payloads, write `audit_events`, write server logs, upload
  workspace data, or expose sensitive payloads.
- Inspect disabled local Web Beta API stubs for auth session, login start,
  logout, workspace list, workspace create, workspace bootstrap, sync push, sync
  pull, sync replay test, restore preview, restore apply, file presign,
  permission check, audit events, and cloud migration apply. These routes return
  disabled responses unless explicitly enabled; the file presign route uses a
  dedicated metadata-only no-URL schema guard, the audit events route uses a
  dedicated metadata-only receipt guard, and the permission check route uses a
  dedicated metadata-only schema guard, local validator fixture report, server
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
- The private file storage policy is now drafted locally, but file sync remains
  disabled until private buckets, signed URL expiry, checksums, size limits,
  permission checks, audit events, and owner confirmation are implemented.
- The cloud sync confirmation phrase can produce a local receipt, but the
  receipt is audit evidence only and does not turn on cloud push.
- `npm run verify:web-beta` checks the local Web Beta contract before launch:
  environment keys, guarded API route files, local module routes, the deployment
  target contract, audit event envelope, audit events API disabled schema,
  permission check envelope, permission check API disabled schema, permission
  request validator fixtures, server permission test matrix, server permission
  readiness report, smoke test plan, and Supabase migration tables.
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
npm run verify:page-structure
npm run verify:research-workflow
npm run verify:replay-harness
npm run verify:web-beta
npm run verify:web-beta:smoke
npm run verify:web-alpha
npm run build
```

## Privacy Boundary

The current app is local-first:

- Uploaded files are stored in local browser storage.
- Report uploads create local metadata-only native-preview or download-retain
  receipts without file names, file bytes, extracted text, page body text, or
  spreadsheet values.
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
