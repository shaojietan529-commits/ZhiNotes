export interface ZipImportPreflightContract {
  format: "zhinote-zip-import-preflight-contract";
  format_version: 1;
  report_status: "metadata-contract-only";
  summary: {
    planned_page_formats: number;
    planned_database_formats: number;
    planned_local_retain_formats: number;
    blocked_until_owner_review: number;
  };
  boundaries: {
    reads_zip_file_now: false;
    reads_entry_file_names_now: false;
    reads_entry_bytes_now: false;
    extracts_files_now: false;
    creates_pages_now: false;
    creates_databases_now: false;
    uploads_data: false;
    enables_ai: false;
  };
  format_routes: ZipImportFormatRoute[];
  required_gates: ZipImportGate[];
  next_steps: string[];
}

export interface ZipImportFormatRoute {
  id: string;
  label: string;
  extensions: string[];
  planned_route:
    | "page-import"
    | "database-import"
    | "local-retain"
    | "blocked-review";
  destination_module: "notes" | "reports" | "databases" | "files";
  privacy_boundary: string;
}

export interface ZipImportGate {
  id: string;
  label: string;
  required_before: string;
  reason: string;
}

const FORMAT_ROUTES: ZipImportFormatRoute[] = [
  {
    id: "markdown-text-pages",
    label: "Markdown / Text",
    extensions: [".md", ".markdown", ".mdx", ".txt"],
    planned_route: "page-import",
    destination_module: "reports",
    privacy_boundary:
      "未来预检只统计条目和扩展名；创建页面前必须展示文件名和数量。",
  },
  {
    id: "html-pages",
    label: "HTML / HTM",
    extensions: [".html", ".htm", ".xhtml"],
    planned_route: "page-import",
    destination_module: "reports",
    privacy_boundary:
      "外部资源、脚本和同目录 assets 必须先进入本地安全复核。",
  },
  {
    id: "word-pages",
    label: "Word / ODT",
    extensions: [".docx", ".doc", ".odt"],
    planned_route: "page-import",
    destination_module: "files",
    privacy_boundary:
      "可编辑导入需要本地转换确认；预检阶段不抽取正文。",
  },
  {
    id: "epub-opml-pages",
    label: "EPUB / OPML",
    extensions: [".epub", ".opml"],
    planned_route: "page-import",
    destination_module: "files",
    privacy_boundary:
      "先进入本地转换复核；不自动写入页面正文。",
  },
  {
    id: "spreadsheet-databases",
    label: "CSV / Excel / ODS",
    extensions: [".csv", ".tsv", ".dsv", ".xlsx", ".xls", ".ods"],
    planned_route: "database-import",
    destination_module: "databases",
    privacy_boundary:
      "导入数据库前必须预览列名、行数和目标字段；不自动写 row values。",
  },
  {
    id: "pdf-local-retain",
    label: "PDF",
    extensions: [".pdf"],
    planned_route: "local-retain",
    destination_module: "files",
    privacy_boundary:
      "先保留为本地文件页面；文本抽取需要单独确认。",
  },
  {
    id: "presentation-local-retain",
    label: "PowerPoint / ODP",
    extensions: [".pptx", ".ppt", ".odp"],
    planned_route: "local-retain",
    destination_module: "files",
    privacy_boundary:
      "先保留为本地文件页面；转换预览失败时仍可下载留存。",
  },
  {
    id: "unknown-blocked",
    label: "Unknown / executable-like",
    extensions: ["unknown"],
    planned_route: "blocked-review",
    destination_module: "files",
    privacy_boundary:
      "未知扩展名必须停在复核队列；不解压写入、不执行、不上传。",
  },
];

const REQUIRED_GATES: ZipImportGate[] = [
  {
    id: "entry-manifest-preview",
    label: "条目清单预览",
    required_before: "读取 ZIP central directory 后继续",
    reason: "ZIP 内部文件名可能包含私人项目、公司或会议信息。",
  },
  {
    id: "batch-create-confirmation",
    label: "批量创建确认",
    required_before: "创建 pages 或 databases 前",
    reason: "批量导入会写入工作区，必须先展示数量、目标模块和失败恢复策略。",
  },
  {
    id: "asset-safety-review",
    label: "HTML assets 安全复核",
    required_before: "保留或渲染 HTML assets 前",
    reason: "HTML 可能引用脚本、iframe、外部样式或网络资源。",
  },
  {
    id: "rollback-receipt",
    label: "回滚收据",
    required_before: "批量导入完成后",
    reason: "需要记录本地创建的页面、数据库和文件条目，便于人工清理或撤销。",
  },
];

export function buildZipImportPreflightContract(): ZipImportPreflightContract {
  return {
    format: "zhinote-zip-import-preflight-contract",
    format_version: 1,
    report_status: "metadata-contract-only",
    summary: {
      planned_page_formats: FORMAT_ROUTES.filter(
        (route) => route.planned_route === "page-import"
      ).length,
      planned_database_formats: FORMAT_ROUTES.filter(
        (route) => route.planned_route === "database-import"
      ).length,
      planned_local_retain_formats: FORMAT_ROUTES.filter(
        (route) => route.planned_route === "local-retain"
      ).length,
      blocked_until_owner_review: FORMAT_ROUTES.filter(
        (route) => route.planned_route === "blocked-review"
      ).length,
    },
    boundaries: {
      reads_zip_file_now: false,
      reads_entry_file_names_now: false,
      reads_entry_bytes_now: false,
      extracts_files_now: false,
      creates_pages_now: false,
      creates_databases_now: false,
      uploads_data: false,
      enables_ai: false,
    },
    format_routes: FORMAT_ROUTES,
    required_gates: REQUIRED_GATES,
    next_steps: [
      "先实现只读 ZIP central directory 预览，只显示条目数量、扩展名分布和总大小。",
      "再实现用户确认后的 Markdown/HTML/Text 批量 page 创建。",
      "表格文件进入数据库导入预览；PDF/Office/unknown 先进入本地留存或转换复核。",
      "任何批量创建都必须生成本地 rollback receipt。",
    ],
  };
}
