-- ZhiNotes cloud foundation schema for Supabase Postgres.
-- This migration is safe to review locally. It does not migrate browser-local data.

create extension if not exists pgcrypto;

do $$
begin
  create type public.zhinote_workspace_role as enum ('owner', 'researcher', 'viewer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'ZhiNotes Workspace',
  beta_status text not null default 'private-alpha',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.zhinote_workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.pages (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  parent_id text,
  database_id text,
  title text not null default '',
  icon text,
  cover_url text,
  content_yjs bytea,
  content_text text,
  position double precision not null default 0,
  depth integer not null default 0,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.page_versions (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id text not null references public.pages(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  version_num integer not null,
  title text not null,
  content_yjs bytea,
  content_text text,
  summary text,
  created_at timestamptz not null default now(),
  sync_version bigint not null default 0
);

create table if not exists public.databases (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  parent_page_id text references public.pages(id),
  title text not null default '',
  icon text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.database_fields (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  database_id text not null references public.databases(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  name text not null,
  field_type text not null,
  config jsonb,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.database_rows (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  database_id text not null references public.databases(id) on delete cascade,
  page_id text not null references public.pages(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  field_values jsonb not null default '{}',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.database_views (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  database_id text not null references public.databases(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  name text not null,
  view_type text not null,
  config jsonb not null default '{}',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.wiki_links (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_page_id text not null references public.pages(id) on delete cascade,
  target_page_id text not null references public.pages(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.page_comments (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id text not null references public.pages(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.block_comments (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id text not null references public.pages(id) on delete cascade,
  block_ref text not null,
  anchor_text text not null,
  owner_id uuid not null references public.users(id),
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.files (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  page_id text references public.pages(id) on delete set null,
  file_name text not null,
  mime_type text,
  byte_size bigint not null default 0,
  kind text not null default 'unknown',
  storage_bucket text not null default 'workspace-files',
  storage_path text not null,
  checksum_sha256 text,
  render_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.sync_log (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  device_id text,
  table_name text not null,
  row_id text not null,
  operation text not null,
  changed_cols text[] not null default '{}',
  local_timestamp timestamptz not null,
  server_received_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  sync_version bigint not null default 0
);

create table if not exists public.sync_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references public.users(id),
  device_id text not null,
  local_batch_id text not null,
  idempotency_key text not null,
  payload_preview_id text,
  operation_counts jsonb not null default '{}'::jsonb,
  table_names text[] not null default '{}',
  payload_hash text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, device_id, local_batch_id),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.sync_row_acks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  batch_id uuid not null references public.sync_batches(id) on delete cascade,
  local_sync_log_row_id bigint references public.sync_log(id) on delete set null,
  table_name text not null,
  row_id text not null,
  operation text not null,
  ack_status text not null default 'accepted',
  remote_commit_id text not null,
  acked_at timestamptz not null default now(),
  checksum text,
  unique (workspace_id, batch_id, local_sync_log_row_id)
);

create table if not exists public.sync_retry_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  batch_id uuid not null references public.sync_batches(id) on delete cascade,
  local_sync_log_row_id bigint references public.sync_log(id) on delete set null,
  attempt integer not null,
  retry_after timestamptz,
  reason_code text not null,
  last_error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_dead_letters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  batch_id uuid references public.sync_batches(id) on delete set null,
  local_sync_log_row_id bigint references public.sync_log(id) on delete set null,
  table_name text not null,
  row_id text not null,
  reason_code text not null,
  final_error_code text,
  manual_review_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_ack_cursors (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  device_id text not null,
  last_ack_cursor text not null,
  last_remote_commit_id text,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, device_id)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_id uuid references public.users(id),
  event_type text not null,
  resource_type text,
  resource_id text,
  risk_level text not null default 'normal',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_workspaces_owner on public.workspaces(owner_id);
create index if not exists idx_workspace_members_user on public.workspace_members(user_id, workspace_id);
create index if not exists idx_pages_workspace_updated on public.pages(workspace_id, updated_at desc);
create index if not exists idx_pages_parent on public.pages(workspace_id, parent_id);
create index if not exists idx_page_versions_page on public.page_versions(page_id, version_num desc);
create index if not exists idx_databases_workspace on public.databases(workspace_id, updated_at desc);
create index if not exists idx_database_fields_database on public.database_fields(database_id, position);
create index if not exists idx_database_rows_database on public.database_rows(database_id, position);
create index if not exists idx_database_views_database on public.database_views(database_id, position);
create index if not exists idx_wiki_links_source on public.wiki_links(source_page_id);
create index if not exists idx_wiki_links_target on public.wiki_links(target_page_id);
create index if not exists idx_page_comments_page on public.page_comments(page_id, resolved, created_at);
create index if not exists idx_block_comments_page on public.block_comments(page_id, resolved, created_at);
create index if not exists idx_files_workspace on public.files(workspace_id, created_at desc);
create index if not exists idx_sync_log_workspace on public.sync_log(workspace_id, server_received_at desc);
create index if not exists idx_sync_batches_workspace on public.sync_batches(workspace_id, created_at desc);
create index if not exists idx_sync_batches_idempotency on public.sync_batches(workspace_id, idempotency_key);
create index if not exists idx_sync_row_acks_batch on public.sync_row_acks(batch_id, acked_at desc);
create index if not exists idx_sync_row_acks_workspace on public.sync_row_acks(workspace_id, acked_at desc);
create index if not exists idx_sync_retry_events_batch on public.sync_retry_events(batch_id, created_at desc);
create index if not exists idx_sync_retry_events_workspace on public.sync_retry_events(workspace_id, created_at desc);
create index if not exists idx_sync_dead_letters_workspace on public.sync_dead_letters(workspace_id, created_at desc);
create index if not exists idx_sync_ack_cursors_workspace on public.sync_ack_cursors(workspace_id, updated_at desc);
create index if not exists idx_audit_events_workspace on public.audit_events(workspace_id, created_at desc);

create or replace function public.zhinote_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.zhinote_workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role::text
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = auth.uid()
  limit 1;
$$;

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.pages enable row level security;
alter table public.page_versions enable row level security;
alter table public.databases enable row level security;
alter table public.database_fields enable row level security;
alter table public.database_rows enable row level security;
alter table public.database_views enable row level security;
alter table public.wiki_links enable row level security;
alter table public.page_comments enable row level security;
alter table public.block_comments enable row level security;
alter table public.files enable row level security;
alter table public.sync_log enable row level security;
alter table public.sync_batches enable row level security;
alter table public.sync_row_acks enable row level security;
alter table public.sync_retry_events enable row level security;
alter table public.sync_dead_letters enable row level security;
alter table public.sync_ack_cursors enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
  on public.users for select
  using (id = auth.uid());

drop policy if exists "Users can upsert own profile" on public.users;
create policy "Users can upsert own profile"
  on public.users for insert
  with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Workspace members can read workspaces" on public.workspaces;
create policy "Workspace members can read workspaces"
  on public.workspaces for select
  using (public.zhinote_is_workspace_member(id));

drop policy if exists "Users can create owned workspaces" on public.workspaces;
create policy "Users can create owned workspaces"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

drop policy if exists "Owners can update workspaces" on public.workspaces;
create policy "Owners can update workspaces"
  on public.workspaces for update
  using (public.zhinote_workspace_role(id) = 'owner')
  with check (public.zhinote_workspace_role(id) = 'owner');

drop policy if exists "Workspace members can read memberships" on public.workspace_members;
create policy "Workspace members can read memberships"
  on public.workspace_members for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Users can create own initial membership" on public.workspace_members;
create policy "Users can create own initial membership"
  on public.workspace_members for insert
  with check (user_id = auth.uid());

drop policy if exists "Owners can update memberships" on public.workspace_members;
create policy "Owners can update memberships"
  on public.workspace_members for update
  using (public.zhinote_workspace_role(workspace_id) = 'owner')
  with check (public.zhinote_workspace_role(workspace_id) = 'owner');

drop policy if exists "Members can read pages" on public.pages;
create policy "Members can read pages"
  on public.pages for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write pages" on public.pages;
create policy "Researchers can write pages"
  on public.pages for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read page versions" on public.page_versions;
create policy "Members can read page versions"
  on public.page_versions for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write page versions" on public.page_versions;
create policy "Researchers can write page versions"
  on public.page_versions for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read databases" on public.databases;
create policy "Members can read databases"
  on public.databases for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write databases" on public.databases;
create policy "Researchers can write databases"
  on public.databases for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read database fields" on public.database_fields;
create policy "Members can read database fields"
  on public.database_fields for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write database fields" on public.database_fields;
create policy "Researchers can write database fields"
  on public.database_fields for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read database rows" on public.database_rows;
create policy "Members can read database rows"
  on public.database_rows for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write database rows" on public.database_rows;
create policy "Researchers can write database rows"
  on public.database_rows for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read database views" on public.database_views;
create policy "Members can read database views"
  on public.database_views for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write database views" on public.database_views;
create policy "Researchers can write database views"
  on public.database_views for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read wiki links" on public.wiki_links;
create policy "Members can read wiki links"
  on public.wiki_links for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write wiki links" on public.wiki_links;
create policy "Researchers can write wiki links"
  on public.wiki_links for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read page comments" on public.page_comments;
create policy "Members can read page comments"
  on public.page_comments for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write page comments" on public.page_comments;
create policy "Researchers can write page comments"
  on public.page_comments for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read block comments" on public.block_comments;
create policy "Members can read block comments"
  on public.block_comments for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write block comments" on public.block_comments;
create policy "Researchers can write block comments"
  on public.block_comments for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read files" on public.files;
create policy "Members can read files"
  on public.files for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write file metadata" on public.files;
create policy "Researchers can write file metadata"
  on public.files for all
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read sync log" on public.sync_log;
create policy "Members can read sync log"
  on public.sync_log for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write sync log" on public.sync_log;
create policy "Researchers can write sync log"
  on public.sync_log for insert
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read sync batches" on public.sync_batches;
create policy "Members can read sync batches"
  on public.sync_batches for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write sync batches" on public.sync_batches;
create policy "Researchers can write sync batches"
  on public.sync_batches for insert
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read sync row acks" on public.sync_row_acks;
create policy "Members can read sync row acks"
  on public.sync_row_acks for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write sync row acks" on public.sync_row_acks;
create policy "Researchers can write sync row acks"
  on public.sync_row_acks for insert
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read sync retry events" on public.sync_retry_events;
create policy "Members can read sync retry events"
  on public.sync_retry_events for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write sync retry events" on public.sync_retry_events;
create policy "Researchers can write sync retry events"
  on public.sync_retry_events for insert
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read sync dead letters" on public.sync_dead_letters;
create policy "Members can read sync dead letters"
  on public.sync_dead_letters for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can write sync dead letters" on public.sync_dead_letters;
create policy "Researchers can write sync dead letters"
  on public.sync_dead_letters for insert
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Members can read sync ack cursors" on public.sync_ack_cursors;
create policy "Members can read sync ack cursors"
  on public.sync_ack_cursors for select
  using (public.zhinote_is_workspace_member(workspace_id));

drop policy if exists "Researchers can insert sync ack cursors" on public.sync_ack_cursors;
create policy "Researchers can insert sync ack cursors"
  on public.sync_ack_cursors for insert
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Researchers can update sync ack cursors" on public.sync_ack_cursors;
create policy "Researchers can update sync ack cursors"
  on public.sync_ack_cursors for update
  using (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'))
  with check (public.zhinote_workspace_role(workspace_id) in ('owner', 'researcher'));

drop policy if exists "Owners can read audit events" on public.audit_events;
create policy "Owners can read audit events"
  on public.audit_events for select
  using (public.zhinote_workspace_role(workspace_id) = 'owner');

drop policy if exists "Members can write audit events" on public.audit_events;
create policy "Members can write audit events"
  on public.audit_events for insert
  with check (public.zhinote_is_workspace_member(workspace_id));
