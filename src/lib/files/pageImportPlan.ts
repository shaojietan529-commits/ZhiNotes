// Batch "files -> ZhiNotes pages" import planner.
//
// This module builds a metadata-only import plan from a set of user-selected
// files. It NEVER reads file bytes or file contents. It decides, per file,
// whether the file should become a local page, a database import candidate,
// be retained as a local file, or be blocked for owner review. It also builds
// a rollback plan so a confirmed batch import can be undone if any step fails.
//
// Safety boundaries (mirrors zipImportPreflight.ts):
// - Reads only file metadata passed in by the caller (name, extension, size).
// - Does not read file bytes, does not parse contents, does not create pages,
//   does not create databases, does not upload, does not call AI.
// - The exportable manifest redacts file names and only keeps extension +
//   lane aggregates, consistent with the ZIP preview privacy rule.

export type PageImportLaneId =
  | "page-import"
  | "database-import"
  | "local-retain"
  | "blocked-review";

export type PageImportTargetKind =
  | "page"
  | "database-row"
  | "retained-file"
  | "none";

export type PageImportDestinationModule =
  | "notes"
  | "reports"
  | "databases"
  | "files";

export interface PageImportSourceFile {
  /** Display name of the user-selected file (used for in-app review only). */
  name: string;
  /** Size in bytes, if known. Used only for aggregate previews. */
  size_bytes?: number;
}

export interface PageImportFormatRoute {
  id: string;
  label: string;
  extensions: string[];
  lane: PageImportLaneId;
  destination_module: PageImportDestinationModule;
  target_kind: PageImportTargetKind;
  needs_conversion: boolean;
  privacy_boundary: string;
}

export interface PageImportPlanItem {
  /** 1-based position in the selected batch. */
  index: number;
  /** File name kept for in-app review; excluded from exportable manifest. */
  source_name: string;
  extension: string;
  size_bytes: number;
  lane: PageImportLaneId;
  destination_module: PageImportDestinationModule;
  target_kind: PageImportTargetKind;
  needs_conversion: boolean;
  confirmation_required: boolean;
  reason: string;
}

export interface PageImportRollbackStep {
  /** Reverse execution order; highest order is undone first. */
  order: number;
  item_index: number;
  action: "soft-delete-page" | "soft-delete-database-row" | "discard-local-file" | "none";
  target_kind: PageImportTargetKind;
  note: string;
}

export interface PageImportLaneSummary {
  lane: PageImportLaneId;
  label: string;
  item_count: number;
  confirmation_required: boolean;
}

export interface PageImportGate {
  id: string;
  label: string;
  required_before: string;
  reason: string;
}

export interface PageImportPlan {
  format: "zhinote-page-import-plan";
  format_version: 1;
  plan_status: "metadata-only";
  boundaries: {
    reads_file_metadata_now: true;
    reads_file_bytes_now: false;
    parses_file_contents_now: false;
    creates_pages_now: false;
    creates_databases_now: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    selected_files: number;
    page_import_candidates: number;
    database_import_candidates: number;
    local_retain_files: number;
    blocked_for_review: number;
    total_size_bytes: number;
  };
  items: PageImportPlanItem[];
  lanes: PageImportLaneSummary[];
  rollback_plan: PageImportRollbackStep[];
  required_gates: PageImportGate[];
  privacy_note: string;
  next_steps: string[];
}

export interface ExportablePageImportManifest {
  format: "zhinote-page-import-manifest";
  format_version: 1;
  manifest_status: "metadata-only";
  boundaries: PageImportPlan["boundaries"] & {
    returns_file_names: false;
    returns_file_contents: false;
  };
  summary: PageImportPlan["summary"];
  extension_groups: {
    extension: string;
    lane: PageImportLaneId;
    destination_module: PageImportDestinationModule;
    item_count: number;
    total_size_bytes: number;
    confirmation_required: boolean;
  }[];
  lanes: PageImportLaneSummary[];
  rollback_step_count: number;
  required_gates: PageImportGate[];
  privacy_note: string;
}

const FORMAT_ROUTES: PageImportFormatRoute[] = [
  {
    id: "markdown-pages",
    label: "Markdown 笔记",
    extensions: [
      ".md",
      ".markdown",
      ".mdx",
      ".mdown",
      ".mkd",
      ".mkdn",
      ".rmd",
      ".qmd",
    ],
    lane: "page-import",
    destination_module: "notes",
    target_kind: "page",
    needs_conversion: true,
    privacy_boundary:
      "Markdown 会本地转换为页面；创建前展示文件名和目标页面数量。",
  },
  {
    id: "html-pages",
    label: "HTML 报告",
    extensions: [".html", ".htm", ".xhtml"],
    lane: "page-import",
    destination_module: "reports",
    target_kind: "page",
    needs_conversion: true,
    privacy_boundary:
      "HTML 的外部资源和脚本必须先经过本地安全复核再创建页面。",
  },
  {
    id: "plain-text-pages",
    label: "纯文本",
    extensions: [".txt", ".text", ".log"],
    lane: "page-import",
    destination_module: "notes",
    target_kind: "page",
    needs_conversion: false,
    privacy_boundary: "纯文本按段落本地转换为页面；不读取内容用于其它用途。",
  },
  {
    id: "spreadsheet-database",
    label: "表格 / CSV",
    extensions: [".csv", ".tsv", ".xlsx", ".xls", ".ods"],
    lane: "database-import",
    destination_module: "databases",
    target_kind: "database-row",
    needs_conversion: true,
    privacy_boundary:
      "表格走确认后的数据库导入；先展示列映射和行数再写入。",
  },
  {
    id: "office-retain",
    label: "Word / PPT / PDF",
    extensions: [".pdf", ".docx", ".doc", ".odt", ".pptx", ".ppt", ".odp"],
    lane: "local-retain",
    destination_module: "files",
    target_kind: "retained-file",
    needs_conversion: false,
    privacy_boundary:
      "Office/PDF 先本地留存并生成文件页面，不在批量导入里解析正文。",
  },
  {
    id: "media-retain",
    label: "音视频 / 图片",
    extensions: [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".svg",
      ".mp3",
      ".wav",
      ".m4a",
      ".mp4",
      ".mov",
      ".webm",
    ],
    lane: "local-retain",
    destination_module: "files",
    target_kind: "retained-file",
    needs_conversion: false,
    privacy_boundary: "媒体文件本地留存，不转写、不上传、不调用 AI。",
  },
];

const LANE_LABELS: Record<PageImportLaneId, string> = {
  "page-import": "导入为页面",
  "database-import": "数据库导入候选",
  "local-retain": "本地留存",
  "blocked-review": "阻塞复核",
};

const BLOCKED_ROUTE: Omit<PageImportFormatRoute, "extensions"> = {
  id: "blocked-unknown",
  label: "未知 / 需复核格式",
  lane: "blocked-review",
  destination_module: "files",
  target_kind: "none",
  needs_conversion: false,
  privacy_boundary:
    "无法识别或高风险格式默认阻塞，必须由用户单独确认后再处理。",
};

const REQUIRED_GATES: PageImportGate[] = [
  {
    id: "batch-page-confirmation",
    label: "批量创建页面确认",
    required_before: "create-pages",
    reason: "批量创建页面属于高风险动作，执行前必须展示清单并获得确认。",
  },
  {
    id: "html-external-resource-review",
    label: "HTML 外部资源复核",
    required_before: "create-html-pages",
    reason: "HTML 可能加载外部脚本或资源，导入前必须本地安全复核。",
  },
  {
    id: "database-column-mapping",
    label: "数据库列映射确认",
    required_before: "create-database-rows",
    reason: "表格写入数据库前必须确认列映射和行数。",
  },
  {
    id: "rollback-ready",
    label: "回退计划就绪",
    required_before: "create-pages",
    reason: "批量导入必须先准备好失败回退步骤，保证可撤销。",
  },
];

export function getFileExtension(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return "";
  return trimmed.slice(dot);
}

function findRoute(extension: string): PageImportFormatRoute | null {
  if (!extension) return null;
  return (
    FORMAT_ROUTES.find((route) => route.extensions.includes(extension)) ?? null
  );
}

export function classifyImportFile(
  file: PageImportSourceFile,
  index: number
): PageImportPlanItem {
  const extension = getFileExtension(file.name);
  const route = findRoute(extension);
  const size = Math.max(0, Math.round(file.size_bytes ?? 0));

  if (!route) {
    return {
      index,
      source_name: file.name,
      extension: extension || "(无扩展名)",
      size_bytes: size,
      lane: BLOCKED_ROUTE.lane,
      destination_module: BLOCKED_ROUTE.destination_module,
      target_kind: BLOCKED_ROUTE.target_kind,
      needs_conversion: BLOCKED_ROUTE.needs_conversion,
      confirmation_required: true,
      reason: BLOCKED_ROUTE.privacy_boundary,
    };
  }

  const confirmationRequired =
    route.lane === "page-import" ||
    route.lane === "database-import" ||
    route.lane === "blocked-review";

  return {
    index,
    source_name: file.name,
    extension,
    size_bytes: size,
    lane: route.lane,
    destination_module: route.destination_module,
    target_kind: route.target_kind,
    needs_conversion: route.needs_conversion,
    confirmation_required: confirmationRequired,
    reason: route.privacy_boundary,
  };
}

function buildRollbackPlan(
  items: PageImportPlanItem[]
): PageImportRollbackStep[] {
  // Only items that would create something need rollback. Steps are ordered so
  // the last-created item is undone first (reverse order).
  const creating = items.filter(
    (item) =>
      item.target_kind === "page" ||
      item.target_kind === "database-row" ||
      item.target_kind === "retained-file"
  );

  return creating
    .map((item, position) => {
      const action: PageImportRollbackStep["action"] =
        item.target_kind === "page"
          ? "soft-delete-page"
          : item.target_kind === "database-row"
          ? "soft-delete-database-row"
          : item.target_kind === "retained-file"
          ? "discard-local-file"
          : "none";
      return {
        order: creating.length - position,
        item_index: item.index,
        action,
        target_kind: item.target_kind,
        note:
          action === "soft-delete-page"
            ? "导入失败时软删除已创建的页面（可在回收逻辑中恢复）。"
            : action === "soft-delete-database-row"
            ? "导入失败时软删除已创建的数据库行及其页面。"
            : "导入失败时丢弃本地留存文件记录。",
      };
    })
    .sort((a, b) => b.order - a.order);
}

function buildLaneSummaries(
  items: PageImportPlanItem[]
): PageImportLaneSummary[] {
  const laneIds: PageImportLaneId[] = [
    "page-import",
    "database-import",
    "local-retain",
    "blocked-review",
  ];
  return laneIds.map((lane) => {
    const laneItems = items.filter((item) => item.lane === lane);
    return {
      lane,
      label: LANE_LABELS[lane],
      item_count: laneItems.length,
      confirmation_required: laneItems.some(
        (item) => item.confirmation_required
      ),
    };
  });
}

export function buildPageImportPlan(
  files: PageImportSourceFile[]
): PageImportPlan {
  const items = files.map((file, i) => classifyImportFile(file, i + 1));
  const rollbackPlan = buildRollbackPlan(items);
  const lanes = buildLaneSummaries(items);

  const summary = {
    selected_files: items.length,
    page_import_candidates: items.filter((i) => i.lane === "page-import").length,
    database_import_candidates: items.filter(
      (i) => i.lane === "database-import"
    ).length,
    local_retain_files: items.filter((i) => i.lane === "local-retain").length,
    blocked_for_review: items.filter((i) => i.lane === "blocked-review").length,
    total_size_bytes: items.reduce((sum, i) => sum + i.size_bytes, 0),
  };

  return {
    format: "zhinote-page-import-plan",
    format_version: 1,
    plan_status: "metadata-only",
    boundaries: {
      reads_file_metadata_now: true,
      reads_file_bytes_now: false,
      parses_file_contents_now: false,
      creates_pages_now: false,
      creates_databases_now: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary,
    items,
    lanes,
    rollback_plan: rollbackPlan,
    required_gates: REQUIRED_GATES,
    privacy_note:
      "导入计划只读取文件名、扩展名和大小用于本地复核；不读取文件内容字节，不创建页面，不上传，不调用 AI。",
    next_steps: [
      "在 UI 中展示每个文件的目标模块、目标类型和是否需要转换。",
      "用户确认后再执行批量创建，并在每一步后记录可回退句柄。",
      "任意一步失败时按 rollback_plan 逆序撤销已创建内容。",
    ],
  };
}

export function buildExportablePageImportManifest(
  plan: PageImportPlan
): ExportablePageImportManifest {
  // Aggregate by extension + lane so the exported manifest carries no file names.
  const groupKey = (item: PageImportPlanItem) => `${item.extension}__${item.lane}`;
  const groups = new Map<
    string,
    ExportablePageImportManifest["extension_groups"][number]
  >();

  for (const item of plan.items) {
    const key = groupKey(item);
    const existing = groups.get(key);
    if (existing) {
      existing.item_count += 1;
      existing.total_size_bytes += item.size_bytes;
      existing.confirmation_required =
        existing.confirmation_required || item.confirmation_required;
    } else {
      groups.set(key, {
        extension: item.extension,
        lane: item.lane,
        destination_module: item.destination_module,
        item_count: 1,
        total_size_bytes: item.size_bytes,
        confirmation_required: item.confirmation_required,
      });
    }
  }

  return {
    format: "zhinote-page-import-manifest",
    format_version: 1,
    manifest_status: "metadata-only",
    boundaries: {
      ...plan.boundaries,
      returns_file_names: false,
      returns_file_contents: false,
    },
    summary: plan.summary,
    extension_groups: Array.from(groups.values()).sort(
      (a, b) => b.item_count - a.item_count
    ),
    lanes: plan.lanes,
    rollback_step_count: plan.rollback_plan.length,
    required_gates: plan.required_gates,
    privacy_note:
      "导出清单不包含文件名或文件内容，只保留扩展名分组、数量、大小、车道和回退步骤数。",
  };
}
