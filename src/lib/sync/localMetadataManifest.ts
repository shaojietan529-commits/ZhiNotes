import type {
  PageModuleCounts,
  SyncLogSummary,
} from "@/lib/db/local/queries";
import type { StoredPageFile } from "@/lib/files/localStore";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";
import type { Database, Page } from "@/lib/utils/types";

export type LocalMetadataManifestDomainStatus =
  | "ready"
  | "partial"
  | "planned";

export interface LocalMetadataManifestInput {
  pages: Page[];
  deletedPages: Page[];
  databases: Database[];
  files: StoredPageFile[];
  pageModuleCounts: Record<string, PageModuleCounts>;
  syncSummary: SyncLogSummary | null;
  workspaceIdentity: LocalWorkspaceIdentity | null;
}

export interface LocalMetadataManifestDomain {
  id: string;
  title: string;
  status: LocalMetadataManifestDomainStatus;
  count: number;
  secondary_count: number;
  latest_watermark: string | null;
  metadata_hash: string;
  hash_input_fields: string[];
  excluded_private_fields: string[];
  note: string;
}

export interface LocalMetadataManifestReport {
  format: "zhinote-local-metadata-manifest";
  format_version: 1;
  manifest_status: "local-metadata-only";
  architecture_target: "cloud-master-local-hot-cache";
  generated_scope: "browser-local-cache";
  privacy_boundary: string;
  hash_algorithm: "fnv1a-stable-json-v1";
  workspace: {
    local_workspace_hash: string | null;
    cloud_workspace_hash: string | null;
    cloud_role: string | null;
  };
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_secret_values: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_cache: false;
    includes_raw_ids_in_export: false;
  };
  summary: {
    domains: number;
    ready_domains: number;
    partial_domains: number;
    planned_domains: number;
    local_records: number;
    latest_watermark: string | null;
    local_pending_sync_rows: number;
    manifest_hash: string;
  };
  domains: LocalMetadataManifestDomain[];
}

interface MetadataRecord {
  id: string;
  updatedAt: string | null;
  syncVersion?: number;
  deleted?: boolean;
  parentId?: string | null;
  type?: string | null;
  count?: number;
  secondaryCount?: number;
}

export function buildLocalMetadataManifest(
  input: LocalMetadataManifestInput
): LocalMetadataManifestReport {
  const activePages = input.pages.filter((page) => !page.deleted_at);
  const allPages = [...activePages, ...input.deletedPages];
  const pageModuleRows = Object.values(input.pageModuleCounts);
  const commentCount = pageModuleRows.reduce(
    (total, counts) => total + counts.pageComments + counts.blockComments,
    0
  );
  const unresolvedCommentCount = pageModuleRows.reduce(
    (total, counts) =>
      total + counts.unresolvedPageComments + counts.unresolvedBlockComments,
    0
  );
  const versionCount = pageModuleRows.reduce(
    (total, counts) => total + counts.versions,
    0
  );
  const wikiLinkCount = pageModuleRows.reduce(
    (total, counts) => total + counts.outgoingLinks + counts.backlinks,
    0
  );

  const domains: LocalMetadataManifestDomain[] = [
    buildDomain({
      id: "pages",
      title: "页面和笔记 metadata",
      status: "ready",
      records: allPages.map((page) => ({
        id: page.id,
        parentId: page.parent_id,
        type: page.database_id ? "database-page" : "page",
        updatedAt: page.updated_at,
        syncVersion: page.sync_version,
        deleted: Boolean(page.deleted_at),
      })),
      secondaryCount: input.deletedPages.length,
      hashInputFields: [
        "id",
        "parent_id",
        "database_id presence",
        "updated_at",
        "deleted_at presence",
        "sync_version",
      ],
      excludedPrivateFields: [
        "page body",
        "collaboration yjs payload",
        "page title",
        "page properties",
        "cover url",
      ],
      note:
        "Counts active and deleted page cache records without reading body, title, or properties.",
    }),
    buildDomain({
      id: "databases",
      title: "数据库 metadata",
      status: "ready",
      records: input.databases.map((database) => ({
        id: database.id,
        parentId: database.parent_page_id,
        type: database.deleted_at ? "deleted-database" : "database",
        updatedAt: database.updated_at,
        syncVersion: database.sync_version,
        deleted: Boolean(database.deleted_at),
      })),
      secondaryCount: input.databases.filter((database) => database.deleted_at)
        .length,
      hashInputFields: [
        "id",
        "parent_page_id",
        "updated_at",
        "deleted_at presence",
        "sync_version",
      ],
      excludedPrivateFields: [
        "database title",
        "database description",
        "row cell values",
        "field config",
        "view config",
      ],
      note:
        "Counts database definitions only; row values and view configs remain outside this manifest.",
    }),
    buildDomain({
      id: "files",
      title: "文件 metadata",
      status: input.files.length > 0 ? "partial" : "planned",
      records: input.files.map((file) => ({
        id: file.id,
        type: `${file.kind}:${file.mimeType}`,
        updatedAt: file.createdAt,
        count: file.size,
      })),
      secondaryCount: input.files.reduce((total, file) => total + file.size, 0),
      hashInputFields: ["id", "kind", "mimeType", "size", "createdAt"],
      excludedPrivateFields: [
        "file name",
        "file bytes",
        "file data url",
        "file extracted text",
      ],
      note:
        "Counts local file index metadata and total bytes without reading file payloads.",
    }),
    buildDomain({
      id: "comments",
      title: "评论 metadata",
      status: commentCount > 0 ? "partial" : "planned",
      records: pageModuleRows.map((counts) => ({
        id: counts.pageId,
        updatedAt: null,
        count: counts.pageComments + counts.blockComments,
        secondaryCount:
          counts.unresolvedPageComments + counts.unresolvedBlockComments,
      })),
      recordCount: commentCount,
      secondaryCount: unresolvedCommentCount,
      hashInputFields: [
        "pageId",
        "page comment count",
        "block comment count",
        "unresolved counts",
      ],
      excludedPrivateFields: [
        "comment body",
        "block anchor text",
        "comment author display name",
      ],
      note:
        "Counts comments per page from local metadata counts without reading comment bodies.",
    }),
    buildDomain({
      id: "versions",
      title: "版本历史 metadata",
      status: versionCount > 0 ? "partial" : "planned",
      records: pageModuleRows.map((counts) => ({
        id: counts.pageId,
        updatedAt: null,
        count: counts.versions,
      })),
      recordCount: versionCount,
      secondaryCount: 0,
      hashInputFields: ["pageId", "version count"],
      excludedPrivateFields: [
        "version body",
        "version yjs payload",
        "version title",
        "version summary",
      ],
      note:
        "Counts version rows per page; version snapshots are not read or exported.",
    }),
    buildDomain({
      id: "wiki-links",
      title: "知识链接 metadata",
      status: wikiLinkCount > 0 ? "partial" : "planned",
      records: pageModuleRows.map((counts) => ({
        id: counts.pageId,
        updatedAt: null,
        count: counts.outgoingLinks,
        secondaryCount: counts.backlinks,
      })),
      recordCount: wikiLinkCount,
      secondaryCount: pageModuleRows.reduce(
        (total, counts) => total + counts.backlinks,
        0
      ),
      hashInputFields: ["pageId", "outgoing link count", "backlink count"],
      excludedPrivateFields: ["source page title", "target page title"],
      note:
        "Counts local link relationships and backlinks without page text or titles.",
    }),
    buildDomain({
      id: "sync-log",
      title: "Pending queue metadata",
      status: "ready",
      records:
        input.syncSummary?.tables.map((table) => ({
          id: table.tableName,
          updatedAt: table.lastChangeAt,
          count: table.total,
          secondaryCount: table.pending,
        })) ?? [],
      recordCount: input.syncSummary?.total ?? 0,
      secondaryCount: input.syncSummary?.pending ?? 0,
      hashInputFields: ["tableName", "total", "pending", "lastChangeAt"],
      excludedPrivateFields: [
        "changed row payload",
        "page body",
        "database values",
        "file bytes",
      ],
      note:
        "Summarizes sync queue rows by table so pending-only upload can be audited.",
    }),
    buildDomain({
      id: "module-config",
      title: "模块和用户偏好 metadata",
      status: "planned",
      records: [],
      secondaryCount: 0,
      hashInputFields: ["future module setting keys", "future cache policy ids"],
      excludedPrivateFields: ["free-form setting values", "private module notes"],
      note:
        "Module order, sidebar layout, and hot-cache choices still need a cloud-master settings table.",
    }),
    buildDomain({
      id: "permissions",
      title: "权限和审计 metadata",
      status: "planned",
      records: [],
      secondaryCount: 0,
      hashInputFields: ["future role ids", "future permission decision ids"],
      excludedPrivateFields: ["token", "cookie", "secret", "raw audit payload"],
      note:
        "Server-side permissions and audit receipts are contracted but not yet backed by live cloud tables.",
    }),
  ];

  const latestWatermark = maxDate(
    domains.map((domain) => domain.latest_watermark)
  );
  const localRecords = domains.reduce((total, domain) => total + domain.count, 0);
  const manifestHash = stableHash(
    domains.map((domain) => ({
      id: domain.id,
      count: domain.count,
      secondary_count: domain.secondary_count,
      latest_watermark: domain.latest_watermark,
      metadata_hash: domain.metadata_hash,
      status: domain.status,
    }))
  );

  return {
    format: "zhinote-local-metadata-manifest",
    format_version: 1,
    manifest_status: "local-metadata-only",
    architecture_target: "cloud-master-local-hot-cache",
    generated_scope: "browser-local-cache",
    privacy_boundary:
      "This manifest is generated from local metadata only. It counts records, watermarks, and stable hashes; it does not include raw ids, page body text, database values, comment bodies, file bytes, file text, tokens, cookies, or secret values.",
    hash_algorithm: "fnv1a-stable-json-v1",
    workspace: {
      local_workspace_hash: input.workspaceIdentity?.workspace_id
        ? stableHash(input.workspaceIdentity.workspace_id)
        : null,
      cloud_workspace_hash: input.workspaceIdentity?.cloud_workspace_id
        ? stableHash(input.workspaceIdentity.cloud_workspace_id)
        : null,
      cloud_role: input.workspaceIdentity?.cloud_role ?? null,
    },
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_secret_values: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache: false,
      includes_raw_ids_in_export: false,
    },
    summary: {
      domains: domains.length,
      ready_domains: domains.filter((domain) => domain.status === "ready")
        .length,
      partial_domains: domains.filter((domain) => domain.status === "partial")
        .length,
      planned_domains: domains.filter((domain) => domain.status === "planned")
        .length,
      local_records: localRecords,
      latest_watermark: latestWatermark,
      local_pending_sync_rows: input.syncSummary?.pending ?? 0,
      manifest_hash: manifestHash,
    },
    domains,
  };
}

function buildDomain(input: {
  id: string;
  title: string;
  status: LocalMetadataManifestDomainStatus;
  records: MetadataRecord[];
  recordCount?: number;
  secondaryCount: number;
  hashInputFields: string[];
  excludedPrivateFields: string[];
  note: string;
}): LocalMetadataManifestDomain {
  const latestWatermark = maxDate(input.records.map((record) => record.updatedAt));
  const hashRecords = input.records
    .map((record) => ({
      id_hash: stableHash(record.id),
      updatedAt: record.updatedAt,
      syncVersion: record.syncVersion ?? null,
      deleted: record.deleted ?? null,
      parent_hash: record.parentId ? stableHash(record.parentId) : null,
      type: record.type ?? null,
      count: record.count ?? null,
      secondaryCount: record.secondaryCount ?? null,
    }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));

  return {
    id: input.id,
    title: input.title,
    status: input.status,
    count: input.recordCount ?? input.records.length,
    secondary_count: input.secondaryCount,
    latest_watermark: latestWatermark,
    metadata_hash: stableHash({
      id: input.id,
      latestWatermark,
      secondaryCount: input.secondaryCount,
      records: hashRecords,
    }),
    hash_input_fields: input.hashInputFields,
    excluded_private_fields: input.excludedPrivateFields,
    note: input.note,
  };
}

function maxDate(values: Array<string | null>): string | null {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps)).toISOString();
}

function stableHash(value: unknown): string {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
