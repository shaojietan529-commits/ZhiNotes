export type CloudManifestDomainId =
  | "pages"
  | "daily-notes"
  | "meetings"
  | "databases"
  | "files"
  | "comments"
  | "versions"
  | "settings-permissions";

export type CloudManifestFieldStatus = "required" | "optional" | "forbidden";

export interface CloudManifestFieldContract {
  field: string;
  status: CloudManifestFieldStatus;
  reason: string;
}

export interface CloudManifestDomainContract {
  id: CloudManifestDomainId;
  title: string;
  cloud_table_scope: string[];
  local_cache_scope: string;
  cloud_manifest_fields: CloudManifestFieldContract[];
  local_manifest_fields: CloudManifestFieldContract[];
  forbidden_manifest_fields: CloudManifestFieldContract[];
  diff_kinds: string[];
  pending_queue_rule: string;
  cache_rebuild_rule: string;
  owner_review_required_before: string[];
}

export interface CloudManifestDomainContractReport {
  format: "zhinote-cloud-manifest-domain-contract-report";
  format_version: 1;
  report_status: "metadata-only-local-contract";
  architecture_target: "cloud-master-local-hot-cache";
  privacy_boundary: string;
  boundary: {
    local_contract_only: true;
    reads_manifest_shape_only: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_version_snapshots: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_cache: false;
    clears_local_cache: false;
    enables_sync: false;
    enables_ai: false;
  };
  summary: {
    domains: number;
    required_fields: number;
    optional_fields: number;
    forbidden_fields: number;
    domains_requiring_owner_review: number;
    can_compare_cloud_now: false;
    can_rebuild_cache_now: false;
    can_upload_workspace_data_now: false;
  };
  contracts: CloudManifestDomainContract[];
}

const COMMON_CLOUD_FIELDS = [
  required("id", "Stable cloud row id or source key used for idempotent compare."),
  required("updated_at", "Cloud-side watermark for stale cache detection."),
  optional("deleted_at", "Tombstone metadata for soft-deleted records."),
  optional("checksum", "Metadata checksum; never raw body text or row values."),
];

const COMMON_LOCAL_FIELDS = [
  required("local_id", "Local cache id for matching against cloud metadata."),
  required("updated_at", "Local metadata watermark."),
  optional("deleted_at", "Local tombstone metadata."),
  optional("pending_state", "Whether local edits are waiting for cloud ACK."),
];

const COMMON_FORBIDDEN_FIELDS = [
  forbidden("page_body_text", "Page bodies are content, not manifest metadata."),
  forbidden("database_cell_values", "Database values must not appear in manifests."),
  forbidden("comment_body", "Comment bodies remain private content."),
  forbidden("version_snapshot", "Version snapshots require a separate owner-gated flow."),
  forbidden("file_bytes", "File bytes must use private file storage, not manifests."),
  forbidden("prompt_text", "AI prompts must not enter sync manifest checks."),
  forbidden("token", "Tokens and credentials must never be included."),
  forbidden("secret_values", "Connection strings and secrets must never be included."),
];

export function buildCloudManifestDomainContractReport(): CloudManifestDomainContractReport {
  const contracts = buildCloudManifestDomainContracts();
  const allFields = contracts.flatMap((contract) => [
    ...contract.cloud_manifest_fields,
    ...contract.local_manifest_fields,
    ...contract.forbidden_manifest_fields,
  ]);

  return {
    format: "zhinote-cloud-manifest-domain-contract-report",
    format_version: 1,
    report_status: "metadata-only-local-contract",
    architecture_target: "cloud-master-local-hot-cache",
    privacy_boundary:
      "This report defines metadata-only manifest shapes for future cloud/local compare. It does not inspect page bodies, database values, comment bodies, version snapshots, file names, file bytes, prompts, tokens, secrets, or remote data. It does not send network requests, connect cloud services, write server data, upload workspace data, mutate or clear local cache, enable sync, or enable AI.",
    boundary: {
      local_contract_only: true,
      reads_manifest_shape_only: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache: false,
      clears_local_cache: false,
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      domains: contracts.length,
      required_fields: countFields(allFields, "required"),
      optional_fields: countFields(allFields, "optional"),
      forbidden_fields: countFields(allFields, "forbidden"),
      domains_requiring_owner_review: contracts.filter(
        (contract) => contract.owner_review_required_before.length > 0
      ).length,
      can_compare_cloud_now: false,
      can_rebuild_cache_now: false,
      can_upload_workspace_data_now: false,
    },
    contracts,
  };
}

export function buildCloudManifestDomainContracts(): CloudManifestDomainContract[] {
  return [
    contract({
      id: "pages",
      title: "Pages and notes",
      cloudTableScope: ["cloud.pages", "cloud.page_properties"],
      localCacheScope:
        "Local page cache keeps titles, hierarchy, icon, cover metadata, properties, tombstones, and user-opened body hot copies.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("parent_id", "Needed to rebuild page hierarchy."),
        required("title_checksum", "Title checksum for metadata diff without exporting title text."),
        optional("body_checksum", "Body checksum proves body drift without returning body text."),
        optional("property_schema_checksum", "Property metadata checksum only."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("parent_id", "Needed to compare local hierarchy against cloud."),
        optional("body_checksum", "Computed locally without exporting body text."),
      ],
      diffKinds: [
        "count-delta",
        "tombstone-delta",
        "parent-edge-delta",
        "watermark-mismatch",
        "body-checksum-mismatch",
      ],
      pendingQueueRule:
        "Unacknowledged page edits must stay in the pending page queue and block cache rebuild.",
      cacheRebuildRule:
        "Rebuild titles, hierarchy, properties, and tombstones from cloud manifest before loading bodies on demand.",
    }),
    contract({
      id: "daily-notes",
      title: "Daily notes calendar",
      cloudTableScope: ["cloud.pages", "cloud.page_properties", "cloud.daily_index"],
      localCacheScope:
        "Current and selected months keep date bucket metadata; note bodies load only when opened.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("date_bucket", "Calendar needs a date bucket for placement."),
        required("page_id", "Daily calendar item is still a page."),
        optional("source_import_id", "Used to preserve Notion import provenance without content."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("date_bucket", "Local month view must compare against cloud date buckets."),
        optional("duplicate_count", "Multiple notes on one day must be preserved."),
      ],
      diffKinds: [
        "date-bucket-count-delta",
        "missing-date-bucket",
        "duplicate-date-bucket",
        "watermark-mismatch",
      ],
      pendingQueueRule:
        "Creating or moving a daily note writes a page pending row; date indexes cannot overwrite newer cloud metadata.",
      cacheRebuildRule:
        "Rebuild month calendars from cloud daily index, then hydrate note details on open.",
    }),
    contract({
      id: "meetings",
      title: "Meetings and ZhiHui calendar",
      cloudTableScope: ["cloud.pages", "cloud.meeting_index"],
      localCacheScope:
        "Current month meeting metadata can be hot cached; meeting links, ids, passcodes, transcripts, and bodies are excluded.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("date_bucket", "Meeting calendar placement."),
        optional("start_time", "Time-only metadata for sorting."),
        optional("platform", "Platform label without meeting credentials."),
        optional("organizer_hash", "Organizer hash, not raw private contact text."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("date_bucket", "Local date grouping for calendar compare."),
        optional("source_hash", "Idempotency for repeated meeting invite imports."),
      ],
      diffKinds: [
        "date-bucket-count-delta",
        "time-slot-delta",
        "duplicate-source-hash",
        "watermark-mismatch",
      ],
      pendingQueueRule:
        "Imported meetings first create local pages and pending rows; credentials are never included in manifest payloads.",
      cacheRebuildRule:
        "Rebuild meeting calendar metadata from cloud manifest; open details before loading page body or transcript.",
    }),
    contract({
      id: "databases",
      title: "Databases, schema, views, and rows",
      cloudTableScope: [
        "cloud.databases",
        "cloud.database_fields",
        "cloud.database_views",
        "cloud.database_rows",
      ],
      localCacheScope:
        "Schema, view config, row counts, and recently opened row metadata can be cached; row values are paged on demand.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("field_count", "Schema count for mismatch triage."),
        required("view_count", "View count for mismatch triage."),
        required("row_count", "Row count only; no row values."),
        optional("schema_checksum", "Schema metadata checksum."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("field_count", "Local schema count."),
        required("view_count", "Local view count."),
        required("row_count", "Local row count without values."),
        optional("schema_checksum", "Local schema checksum."),
      ],
      diffKinds: [
        "schema-count-delta",
        "view-count-delta",
        "row-count-delta",
        "schema-checksum-mismatch",
        "watermark-mismatch",
      ],
      pendingQueueRule:
        "Only pending database keys can be pushed; whole IndexedDB database caches cannot be promoted to cloud.",
      cacheRebuildRule:
        "Rebuild database schema and views from cloud manifest before reading row values on demand.",
    }),
    contract({
      id: "files",
      title: "Files and report attachments",
      cloudTableScope: ["cloud.file_objects", "cloud.file_page_links"],
      localCacheScope:
        "Keep user-selected local file copies and lightweight preview receipts; large files are not automatically retained.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("object_id", "Private storage object id."),
        required("page_id", "Page attachment relationship."),
        required("size_bytes", "Size metadata for cost and completeness checks."),
        required("mime_type", "Type metadata for preview routing."),
        optional("file_checksum", "Checksum, not file bytes."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("size_bytes", "Local size metadata."),
        required("mime_type", "Local MIME metadata."),
        optional("checksum_ready", "Whether a checksum can be compared."),
      ],
      diffKinds: [
        "object-count-delta",
        "attachment-link-delta",
        "size-metadata-mismatch",
        "checksum-mismatch",
      ],
      pendingQueueRule:
        "File bytes require a separate owner-confirmed private upload path and cannot enter generic sync_log.",
      cacheRebuildRule:
        "Rebuild attachment references from cloud manifest; request signed URLs only when the user opens a file.",
      ownerReviewRequiredBefore: ["private-file-upload", "signed-url-read"],
    }),
    contract({
      id: "comments",
      title: "Page and block comments",
      cloudTableScope: ["cloud.comments"],
      localCacheScope:
        "Open-page comments can be cached; list views and global manifests keep counts, anchors, and watermarks only.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("page_id", "Comment belongs to a page."),
        optional("anchor_id", "Block/comment anchor metadata."),
        optional("resolved_at", "Resolved state watermark."),
        optional("body_checksum", "Comment body checksum, not body text."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("page_id", "Local page relationship."),
        optional("anchor_count", "Anchor metadata count."),
        optional("body_checksum", "Local checksum only."),
      ],
      diffKinds: [
        "comment-count-delta",
        "anchor-count-delta",
        "resolved-state-mismatch",
        "body-checksum-mismatch",
      ],
      pendingQueueRule:
        "Comment edits need a dedicated pending queue and cannot be silently folded into page body sync.",
      cacheRebuildRule:
        "Rebuild comment indexes from cloud manifest; load comment bodies only inside an opened page.",
      ownerReviewRequiredBefore: ["comment-body-sync"],
    }),
    contract({
      id: "versions",
      title: "Page version history",
      cloudTableScope: ["cloud.page_versions"],
      localCacheScope:
        "Recent version metadata can be cached; long-form snapshots load only after page-level review.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("page_id", "Version belongs to a page."),
        required("version_number", "Append-only idempotency key."),
        optional("snapshot_checksum", "Snapshot checksum, not snapshot text."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("page_id", "Local page relationship."),
        required("version_number", "Local append-only version number."),
        optional("snapshot_checksum", "Local checksum only."),
      ],
      diffKinds: [
        "version-count-delta",
        "append-only-gap",
        "snapshot-checksum-mismatch",
        "watermark-mismatch",
      ],
      pendingQueueRule:
        "Versions are append-only and require idempotent replay; they cannot be overwritten by page sync.",
      cacheRebuildRule:
        "Rebuild version index from cloud manifest, then load snapshots by page and version on demand.",
      ownerReviewRequiredBefore: ["version-snapshot-sync"],
    }),
    contract({
      id: "settings-permissions",
      title: "Settings, permissions, and audit",
      cloudTableScope: [
        "cloud.workspace_settings",
        "cloud.account_settings",
        "cloud.module_settings",
        "cloud.permissions",
        "cloud.audit_events",
      ],
      localCacheScope:
        "UI settings can be rebuilt from cloud; permission decisions must be server-owned and audit events are metadata-only.",
      cloudFields: [
        ...COMMON_CLOUD_FIELDS,
        required("scope", "workspace/account/module/permission/audit scope."),
        required("setting_key", "Whitelisted key or permission/audit event type."),
        optional("value_checksum", "Settings value checksum, not raw cache dump."),
        optional("actor_id", "Authenticated actor id for audit metadata."),
      ],
      localFields: [
        ...COMMON_LOCAL_FIELDS,
        required("scope", "Local setting scope."),
        required("setting_key", "Whitelisted setting key."),
        optional("pending_row_id", "Pending-only queue reference."),
      ],
      diffKinds: [
        "setting-key-delta",
        "permission-role-delta",
        "audit-watermark-gap",
        "watermark-mismatch",
      ],
      pendingQueueRule:
        "Only whitelisted setting keys can use local pending sync; permissions and audit cannot be silently queued by the client.",
      cacheRebuildRule:
        "Rebuild UI settings from cloud settings; server re-checks permissions before any protected action.",
      ownerReviewRequiredBefore: ["permission-enforcement", "audit-cloud-write"],
    }),
  ];
}

function contract(input: {
  id: CloudManifestDomainId;
  title: string;
  cloudTableScope: string[];
  localCacheScope: string;
  cloudFields: CloudManifestFieldContract[];
  localFields: CloudManifestFieldContract[];
  diffKinds: string[];
  pendingQueueRule: string;
  cacheRebuildRule: string;
  ownerReviewRequiredBefore?: string[];
}): CloudManifestDomainContract {
  return {
    id: input.id,
    title: input.title,
    cloud_table_scope: input.cloudTableScope,
    local_cache_scope: input.localCacheScope,
    cloud_manifest_fields: cloneFields(input.cloudFields),
    local_manifest_fields: cloneFields(input.localFields),
    forbidden_manifest_fields: cloneFields(COMMON_FORBIDDEN_FIELDS),
    diff_kinds: [...input.diffKinds],
    pending_queue_rule: input.pendingQueueRule,
    cache_rebuild_rule: input.cacheRebuildRule,
    owner_review_required_before: [
      "cloud-manifest-compare-enable",
      "cache-rebuild-from-cloud",
      ...(input.ownerReviewRequiredBefore ?? []),
    ],
  };
}

function required(field: string, reason: string): CloudManifestFieldContract {
  return { field, status: "required", reason };
}

function optional(field: string, reason: string): CloudManifestFieldContract {
  return { field, status: "optional", reason };
}

function forbidden(field: string, reason: string): CloudManifestFieldContract {
  return { field, status: "forbidden", reason };
}

function cloneFields(
  fields: CloudManifestFieldContract[]
): CloudManifestFieldContract[] {
  return fields.map((field) => ({ ...field }));
}

function countFields(
  fields: CloudManifestFieldContract[],
  status: CloudManifestFieldStatus
): number {
  return fields.filter((field) => field.status === status).length;
}
