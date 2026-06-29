import { getPageFileKind, type PageFileKind } from "@/lib/files/localStore";
import { listZipEntries, readZipEntries } from "@/lib/files/zipReader";

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

export interface ZipLocalFilePageCandidate {
  file: File;
  kind: PageFileKind;
  extension: string;
  size_bytes: number;
  source_path_included_for_local_import_only: true;
}

export interface ZipLocalFilePageImportResult {
  format: "zhinote-zip-local-file-page-import";
  format_version: 1;
  import_status: "local-file-page-candidates-ready";
  summary: {
    entries_scanned: number;
    candidates: number;
    skipped_entries: number;
    unsupported_entries: number;
    unsafe_path_entries: number;
    nested_archive_entries: number;
    total_uncompressed_bytes: number;
    entry_limit: number;
    total_uncompressed_limit_bytes: number;
  };
  boundaries: {
    reads_zip_file_now: true;
    reads_entry_file_names_now: true;
    reads_entry_bytes_now: true;
    extracts_files_now: true;
    creates_pages_now: false;
    creates_databases_now: false;
    uploads_data: false;
    enables_ai: false;
  };
  candidates: ZipLocalFilePageCandidate[];
  privacy_note: string;
}

export interface ZipCentralDirectoryPreview {
  format: "zhinote-zip-central-directory-preview";
  format_version: 1;
  preview_status: "metadata-only";
  summary: {
    entries: number;
    files: number;
    directories: number;
    total_compressed_size_bytes: number;
    extension_groups: number;
    truncated_extension_groups: number;
  };
  boundaries: {
    reads_zip_file_now: true;
    reads_entry_file_names_now: true;
    returns_entry_file_names: false;
    reads_entry_bytes_now: false;
    extracts_files_now: false;
    creates_pages_now: false;
    creates_databases_now: false;
    uploads_data: false;
    enables_ai: false;
  };
  extension_groups: ZipCentralDirectoryExtensionGroup[];
  required_gates: ZipImportGate[];
  privacy_note: string;
  next_steps: string[];
}

export interface ZipCentralDirectoryExtensionGroup {
  extension: string;
  entries: number;
  total_compressed_size_bytes: number;
  planned_route: ZipImportFormatRoute["planned_route"];
  destination_module: ZipImportFormatRoute["destination_module"];
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

const ZIP_PREVIEW_EXTENSION_GROUP_LIMIT = 12;
const ZIP_LOCAL_FILE_PAGE_IMPORT_ENTRY_LIMIT = 30;
const ZIP_LOCAL_FILE_PAGE_IMPORT_COMPRESSED_LIMIT_BYTES = 25 * 1024 * 1024;
const ZIP_LOCAL_FILE_PAGE_IMPORT_TOTAL_BYTES_LIMIT = 25 * 1024 * 1024;

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
      "受限本地导入已支持在用户输入确认短语后，把 ZIP 内的支持格式创建为本地文件页面。",
      "表格文件进入数据库导入预览；PDF/Office/unknown 先进入本地留存或转换复核。",
      "任何批量创建都必须生成本地 rollback receipt。",
    ],
  };
}

export function buildZipCentralDirectoryPreview(
  arrayBuffer: ArrayBuffer
): ZipCentralDirectoryPreview {
  const entries = listZipEntries(arrayBuffer);
  const fileEntries = entries.filter((entry) => !entry.path.endsWith("/"));
  const directoryCount = entries.length - fileEntries.length;
  const byExtension = new Map<string, ZipCentralDirectoryExtensionGroup>();

  for (const entry of fileEntries) {
    const extension = getZipEntryExtension(entry.path);
    const route = getZipRouteForExtension(extension);
    const existing = byExtension.get(extension) ?? {
      extension,
      entries: 0,
      total_compressed_size_bytes: 0,
      planned_route: route.planned_route,
      destination_module: route.destination_module,
    };
    existing.entries += 1;
    existing.total_compressed_size_bytes += entry.compressedSize;
    byExtension.set(extension, existing);
  }

  const extensionGroups = Array.from(byExtension.values()).sort(
    (a, b) =>
      b.entries - a.entries ||
      b.total_compressed_size_bytes - a.total_compressed_size_bytes ||
      a.extension.localeCompare(b.extension)
  );
  const visibleExtensionGroups = extensionGroups.slice(
    0,
    ZIP_PREVIEW_EXTENSION_GROUP_LIMIT
  );

  return {
    format: "zhinote-zip-central-directory-preview",
    format_version: 1,
    preview_status: "metadata-only",
    summary: {
      entries: entries.length,
      files: fileEntries.length,
      directories: directoryCount,
      total_compressed_size_bytes: fileEntries.reduce(
        (sum, entry) => sum + entry.compressedSize,
        0
      ),
      extension_groups: extensionGroups.length,
      truncated_extension_groups: Math.max(
        0,
        extensionGroups.length - visibleExtensionGroups.length
      ),
    },
    boundaries: {
      reads_zip_file_now: true,
      reads_entry_file_names_now: true,
      returns_entry_file_names: false,
      reads_entry_bytes_now: false,
      extracts_files_now: false,
      creates_pages_now: false,
      creates_databases_now: false,
      uploads_data: false,
      enables_ai: false,
    },
    extension_groups: visibleExtensionGroups,
    required_gates: REQUIRED_GATES,
    privacy_note:
      "这个预览只返回条目数量、扩展名分布、压缩后大小和目标模块；不会返回 ZIP 内部文件名、目录名、条目 bytes、页面正文、数据库行值、token、凭证或 AI 输出。",
    next_steps: [
      "先展示 extension_groups 和 summary，供用户确认是否继续。",
      "创建 pages/databases 前必须展示条目清单、目标模块和失败恢复策略。",
      "Markdown/HTML/Text 可进入批量 page 创建确认；表格进入数据库导入预览。",
      "PDF/Office/unknown 继续留在本地文件复核队列。",
    ],
  };
}

export async function extractZipEntriesForLocalFilePages(
  arrayBuffer: ArrayBuffer
): Promise<ZipLocalFilePageImportResult> {
  const centralDirectoryEntries = listZipEntries(arrayBuffer).filter(
    (entry) => !entry.path.endsWith("/")
  );
  const totalCompressedBytes = centralDirectoryEntries.reduce(
    (sum, entry) => sum + entry.compressedSize,
    0
  );

  if (centralDirectoryEntries.length > ZIP_LOCAL_FILE_PAGE_IMPORT_ENTRY_LIMIT) {
    throw new Error(
      `这个 ZIP 包含 ${centralDirectoryEntries.length} 个文件，超过本地批量页面导入上限 ${ZIP_LOCAL_FILE_PAGE_IMPORT_ENTRY_LIMIT} 个。请先拆分 ZIP。`
    );
  }

  if (totalCompressedBytes > ZIP_LOCAL_FILE_PAGE_IMPORT_COMPRESSED_LIMIT_BYTES) {
    throw new Error(
      "这个 ZIP 压缩后文件体积超过 25 MB。为保持页面流畅，请先拆分或只导入关键文件。"
    );
  }

  const entries = await readZipEntries(arrayBuffer);
  const candidates: ZipLocalFilePageCandidate[] = [];
  let skippedEntries = 0;
  let unsupportedEntries = 0;
  let unsafePathEntries = 0;
  let nestedArchiveEntries = 0;
  let totalUncompressedBytes = 0;

  for (const entry of entries) {
    if (entry.path.endsWith("/")) continue;

    if (isUnsafeZipEntryPath(entry.path)) {
      skippedEntries += 1;
      unsafePathEntries += 1;
      continue;
    }

    const fileName = getZipEntryFileName(entry.path);
    const extension = getZipEntryExtension(fileName);
    const mimeType = inferZipEntryMimeType(fileName);
    const kind = getPageFileKind(fileName, mimeType);

    if (kind === "unknown") {
      skippedEntries += 1;
      unsupportedEntries += 1;
      continue;
    }

    if (kind === "archive") {
      skippedEntries += 1;
      nestedArchiveEntries += 1;
      continue;
    }

    totalUncompressedBytes += entry.data.byteLength;
    if (totalUncompressedBytes > ZIP_LOCAL_FILE_PAGE_IMPORT_TOTAL_BYTES_LIMIT) {
      throw new Error(
        "这个 ZIP 解压后的支持文件超过 25 MB。为保持页面流畅，请先拆分或只导入关键文件。"
      );
    }

    candidates.push({
      file: new File([uint8ArrayToArrayBuffer(entry.data)], fileName, {
        type: mimeType,
      }),
      kind,
      extension,
      size_bytes: entry.data.byteLength,
      source_path_included_for_local_import_only: true,
    });
  }

  return {
    format: "zhinote-zip-local-file-page-import",
    format_version: 1,
    import_status: "local-file-page-candidates-ready",
    summary: {
      entries_scanned: entries.length,
      candidates: candidates.length,
      skipped_entries: skippedEntries,
      unsupported_entries: unsupportedEntries,
      unsafe_path_entries: unsafePathEntries,
      nested_archive_entries: nestedArchiveEntries,
      total_uncompressed_bytes: totalUncompressedBytes,
      entry_limit: ZIP_LOCAL_FILE_PAGE_IMPORT_ENTRY_LIMIT,
      total_uncompressed_limit_bytes: ZIP_LOCAL_FILE_PAGE_IMPORT_TOTAL_BYTES_LIMIT,
    },
    boundaries: {
      reads_zip_file_now: true,
      reads_entry_file_names_now: true,
      reads_entry_bytes_now: true,
      extracts_files_now: true,
      creates_pages_now: false,
      creates_databases_now: false,
      uploads_data: false,
      enables_ai: false,
    },
    candidates,
    privacy_note:
      "这个结果只在浏览器本地从用户主动选择的 ZIP 中生成本地文件页面候选。它会读取支持条目的 bytes 以创建本地 File 对象，但不会上传、不会调用 AI、不会创建数据库，也不会自动写入页面；页面创建必须由 UI 在确认短语通过后单独执行。",
  };
}

function getZipEntryExtension(path: string) {
  const fileName = path.split("/").filter(Boolean).at(-1) ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return "unknown";
  return fileName.slice(dotIndex).toLowerCase();
}

function getZipRouteForExtension(extension: string) {
  return (
    FORMAT_ROUTES.find((route) => route.extensions.includes(extension)) ??
    FORMAT_ROUTES.find((route) => route.id === "unknown-blocked")!
  );
}

function getZipEntryFileName(path: string) {
  return path.split("/").filter(Boolean).at(-1) || "zip-entry";
}

function isUnsafeZipEntryPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.startsWith("~")) return true;
  return normalized.split("/").some((part) => part === ".." || part === "");
}

function inferZipEntryMimeType(fileName: string) {
  const extension = getZipEntryExtension(fileName);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".xhtml": "application/xhtml+xml",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".mdx": "text/markdown",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".json": "application/json",
    ".jsonl": "application/jsonl",
    ".xml": "application/xml",
    ".opml": "text/x-opml",
    ".rtf": "application/rtf",
    ".pdf": "application/pdf",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".epub": "application/epub+zip",
    ".ipynb": "application/x-ipynb+json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
  };
  return mimeTypes[extension] ?? "application/octet-stream";
}

function uint8ArrayToArrayBuffer(data: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(arrayBuffer).set(data);
  return arrayBuffer;
}
