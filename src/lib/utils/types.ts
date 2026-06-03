export interface Page {
  id: string;
  owner_id: string;
  parent_id: string | null;
  database_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content_yjs: Uint8Array | null;
  content_text: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface PageVersion {
  id: string;
  page_id: string;
  owner_id: string;
  version_num: number;
  title: string;
  content_yjs: Uint8Array | null;
  content_text: string | null;
  summary: string | null;
  created_at: string;
  sync_version: number;
}

export interface Database {
  id: string;
  owner_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface DatabaseField {
  id: string;
  database_id: string;
  owner_id: string;
  name: string;
  field_type: string;
  config: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface DatabaseRow {
  id: string;
  database_id: string;
  page_id: string;
  owner_id: string;
  field_values: string;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface DatabaseView {
  id: string;
  database_id: string;
  owner_id: string;
  name: string;
  view_type:
    | "table"
    | "list"
    | "kanban"
    | "calendar"
    | "gallery"
    | "timeline"
    | "chart"
    | "form"
    | "feed";
  config: string;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface WikiLink {
  id: string;
  source_page_id: string;
  target_page_id: string;
  owner_id: string;
  created_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface PageComment {
  id: string;
  page_id: string;
  owner_id: string;
  body: string;
  resolved: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

export interface BlockComment {
  id: string;
  page_id: string;
  block_ref: string;
  anchor_text: string;
  owner_id: string;
  body: string;
  resolved: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}
