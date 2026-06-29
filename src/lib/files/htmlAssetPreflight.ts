export interface HtmlAssetPreflightContract {
  format: "zhinote-html-assets-preflight-contract";
  format_version: 1;
  report_status: "metadata-contract-only";
  summary: {
    resource_classes: number;
    supported_bundle_sources: number;
    required_gates: number;
    blocked_until_owner_review: number;
  };
  boundaries: {
    reads_html_file_now: false;
    reads_asset_file_names_now: false;
    reads_asset_bytes_now: false;
    returns_resource_urls: false;
    returns_asset_file_names: false;
    rewrites_html_now: false;
    creates_pages_now: false;
    loads_external_resources: false;
    uploads_data: false;
    enables_ai: false;
  };
  bundle_sources: HtmlAssetBundleSource[];
  resource_classes: HtmlAssetResourceClass[];
  required_gates: HtmlAssetGate[];
  next_steps: string[];
}

export interface HtmlAssetReferencePreview {
  format: "zhinote-html-assets-reference-preview";
  format_version: 1;
  preview_status: "metadata-only";
  summary: {
    selected_files: number;
    candidate_asset_files: number;
    html_resource_references: number;
    local_relative_resources: number;
    matched_local_assets: number;
    missing_local_assets: number;
    remote_resources: number;
    inline_data_resources: number;
    blocked_protocol_resources: number;
    asset_extension_groups: number;
    total_asset_size_bytes: number;
  };
  boundaries: {
    reads_html_text_now: true;
    reads_asset_file_names_now: true;
    reads_asset_bytes_now: false;
    returns_html_text: false;
    returns_resource_urls: false;
    returns_asset_file_names: false;
    rewrites_html_now: false;
    creates_pages_now: false;
    loads_external_resources: false;
    uploads_data: false;
    enables_ai: false;
  };
  resource_groups: HtmlAssetReferenceGroup[];
  asset_extension_groups: HtmlAssetExtensionGroup[];
  required_gates: HtmlAssetGate[];
  privacy_note: string;
  next_steps: string[];
}

export interface HtmlAssetSourceFile {
  name: string;
  size_bytes: number;
  webkit_relative_path?: string;
}

export interface HtmlAssetLocalBundle {
  format: "zhinote-html-assets-local-bundle";
  format_version: 1;
  bundle_status: "local-bundle-ready";
  suggested_file_name: string;
  html_text: string;
  summary: {
    selected_files: number;
    candidate_asset_files: number;
    rewritten_references: number;
    inlined_stylesheets: number;
    inlined_scripts: number;
    missing_local_assets: number;
    remote_resources_left_blocked: number;
    blocked_protocol_resources_left_blocked: number;
    total_asset_bytes_read: number;
  };
  boundaries: {
    reads_html_text_now: true;
    reads_asset_file_names_now: true;
    reads_asset_bytes_now: true;
    returns_html_text_to_caller: true;
    returns_resource_urls: false;
    returns_asset_file_names: false;
    rewrites_html_now: true;
    creates_pages_now: false;
    loads_external_resources: false;
    uploads_data: false;
    enables_ai: false;
  };
  privacy_note: string;
}

export interface HtmlAssetBundleSource {
  id: string;
  label: string;
  status: "supported" | "planned" | "blocked";
  review_note: string;
}

export interface HtmlAssetResourceClass {
  id: HtmlAssetReferenceKind;
  label: string;
  default_policy: "allow-local-after-review" | "block-remote" | "block-protocol";
  review_note: string;
}

export interface HtmlAssetGate {
  id: string;
  label: string;
  required_before: string;
  reason: string;
}

export type HtmlAssetReferenceKind =
  | "script"
  | "stylesheet"
  | "image"
  | "font"
  | "media"
  | "frame"
  | "css-url"
  | "other";

export interface HtmlAssetReferenceGroup {
  kind: HtmlAssetReferenceKind;
  label: string;
  total: number;
  local_relative: number;
  matched_local_assets: number;
  missing_local_assets: number;
  remote: number;
  inline_data: number;
  blocked_protocol: number;
}

export interface HtmlAssetExtensionGroup {
  extension: string;
  files: number;
  total_size_bytes: number;
  referenced_matches: number;
}

interface ExtractedHtmlReference {
  kind: HtmlAssetReferenceKind;
  value: string;
}

const HTML_ASSET_LOCAL_BUNDLE_MAX_BYTES = 25 * 1024 * 1024;

const RESOURCE_CLASSES: HtmlAssetResourceClass[] = [
  {
    id: "stylesheet",
    label: "CSS 样式",
    default_policy: "allow-local-after-review",
    review_note: "同目录 CSS 可以保留版式；远程 CSS 默认阻止。",
  },
  {
    id: "script",
    label: "脚本",
    default_policy: "block-remote",
    review_note: "本地脚本也必须先复核；远程脚本默认阻止。",
  },
  {
    id: "image",
    label: "图片 / 图表",
    default_policy: "allow-local-after-review",
    review_note: "本地图表图片可用于保真展示；远程图片默认阻止。",
  },
  {
    id: "font",
    label: "字体",
    default_policy: "block-remote",
    review_note: "本地字体需复核体积和来源；远程字体默认阻止。",
  },
  {
    id: "media",
    label: "音视频",
    default_policy: "allow-local-after-review",
    review_note: "本地媒体可留存；自动播放和远程媒体默认阻止。",
  },
  {
    id: "frame",
    label: "iframe / embed",
    default_policy: "block-remote",
    review_note: "iframe 可能连接外部站点，默认阻止。",
  },
  {
    id: "css-url",
    label: "CSS url()",
    default_policy: "allow-local-after-review",
    review_note: "CSS 内图片或字体先做本地匹配，不直接加载远程 URL。",
  },
  {
    id: "other",
    label: "其他引用",
    default_policy: "block-protocol",
    review_note: "其他协议和未知引用先进入人工复核。",
  },
];

const BUNDLE_SOURCES: HtmlAssetBundleSource[] = [
  {
    id: "same-folder-html-assets",
    label: "HTML + 同目录 assets",
    status: "supported",
    review_note:
      "用户一次选择 HTML 和 assets 文件后，只做引用匹配和数量统计，不读取 asset bytes。",
  },
  {
    id: "zip-html-assets",
    label: "ZIP assets 包",
    status: "planned",
    review_note:
      "先走 ZIP central directory 预览；解包、改写 HTML、创建页面前必须再次确认。",
  },
  {
    id: "standalone-html",
    label: "单 HTML 文件",
    status: "supported",
    review_note:
      "没有本地 assets 时继续沙盒预览；缺失资源会进入修复建议，不自动联网补全。",
  },
  {
    id: "remote-html-assets",
    label: "远程外部资源",
    status: "blocked",
    review_note:
      "远程图片、脚本、样式、字体、iframe 默认阻止，必须走 allowlist 确认。",
  },
];

const REQUIRED_GATES: HtmlAssetGate[] = [
  {
    id: "html-document-selection",
    label: "选择 HTML 主文件",
    required_before: "生成 assets 匹配预览前",
    reason: "HTML 正文可能包含私人报告内容；只在用户主动选择后读取。",
  },
  {
    id: "local-asset-match-preview",
    label: "本地 assets 匹配预览",
    required_before: "保留或改写本地 assets 前",
    reason: "必须先确认本地资源是否齐全，且导出结果不包含 assets 文件名。",
  },
  {
    id: "external-resource-allowlist",
    label: "外部资源 allowlist",
    required_before: "加载任何远程资源前",
    reason: "远程脚本、样式、字体、图片和 iframe 可能外发访问行为。",
  },
  {
    id: "sandbox-render-confirmation",
    label: "沙盒渲染确认",
    required_before: "把保真 HTML 作为 page 预览展示前",
    reason: "HTML 仍需保持 sandbox；脚本和网络访问默认关闭。",
  },
  {
    id: "html-assets-import-receipt",
    label: "HTML assets 导入 receipt",
    required_before: "写入 page 或保留 assets 后",
    reason: "需要记录本地动作 metadata，不能记录 HTML 正文、URL 或文件名。",
  },
];

export function buildHtmlAssetPreflightContract(): HtmlAssetPreflightContract {
  return {
    format: "zhinote-html-assets-preflight-contract",
    format_version: 1,
    report_status: "metadata-contract-only",
    summary: {
      resource_classes: RESOURCE_CLASSES.length,
      supported_bundle_sources: BUNDLE_SOURCES.filter(
        (source) => source.status === "supported"
      ).length,
      required_gates: REQUIRED_GATES.length,
      blocked_until_owner_review: BUNDLE_SOURCES.filter(
        (source) => source.status === "blocked"
      ).length,
    },
    boundaries: {
      reads_html_file_now: false,
      reads_asset_file_names_now: false,
      reads_asset_bytes_now: false,
      returns_resource_urls: false,
      returns_asset_file_names: false,
      rewrites_html_now: false,
      creates_pages_now: false,
      loads_external_resources: false,
      uploads_data: false,
      enables_ai: false,
    },
    bundle_sources: BUNDLE_SOURCES,
    resource_classes: RESOURCE_CLASSES,
    required_gates: REQUIRED_GATES,
    next_steps: [
      "先选择 HTML 主文件和可选的同目录 assets，生成 metadata-only 匹配预览。",
      "只展示资源类别、数量、是否本地匹配和扩展名分布；不展示 URL 或 assets 文件名。",
      "缺失的本地 assets 进入修复建议；远程资源继续保持阻止。",
      "确认后再实现本地 assets 保留、HTML 引用改写和 page 沙盒预览 receipt。",
    ],
  };
}

export function buildHtmlAssetReferencePreview(input: {
  htmlText: string;
  files: HtmlAssetSourceFile[];
}): HtmlAssetReferencePreview {
  const htmlFiles = input.files.filter((file) =>
    isHtmlFileName(file.name || file.webkit_relative_path || "")
  );
  const assetFiles = input.files.filter(
    (file) => !isHtmlFileName(file.name || file.webkit_relative_path || "")
  );
  const references = extractHtmlAssetReferences(input.htmlText);
  const assetPathIndex = buildAssetPathIndex(assetFiles);
  const groups = new Map<HtmlAssetReferenceKind, HtmlAssetReferenceGroup>();
  const assetMatchesByExtension = new Map<string, number>();

  for (const reference of references) {
    const classification = classifyReference(reference.value, assetPathIndex);
    const group = groups.get(reference.kind) ?? createEmptyReferenceGroup(reference.kind);
    group.total += 1;
    group.local_relative += classification.local_relative ? 1 : 0;
    group.matched_local_assets += classification.matched_local_asset ? 1 : 0;
    group.missing_local_assets += classification.missing_local_asset ? 1 : 0;
    group.remote += classification.remote ? 1 : 0;
    group.inline_data += classification.inline_data ? 1 : 0;
    group.blocked_protocol += classification.blocked_protocol ? 1 : 0;
    groups.set(reference.kind, group);

    if (classification.matched_local_asset) {
      const extension = getReferenceExtension(reference.value);
      assetMatchesByExtension.set(
        extension,
        (assetMatchesByExtension.get(extension) ?? 0) + 1
      );
    }
  }

  const assetExtensionGroups = buildAssetExtensionGroups(
    assetFiles,
    assetMatchesByExtension
  );
  const summary = summarizeReferenceGroups(Array.from(groups.values()));

  return {
    format: "zhinote-html-assets-reference-preview",
    format_version: 1,
    preview_status: "metadata-only",
    summary: {
      selected_files: input.files.length || htmlFiles.length,
      candidate_asset_files: assetFiles.length,
      html_resource_references: references.length,
      local_relative_resources: summary.local_relative,
      matched_local_assets: summary.matched_local_assets,
      missing_local_assets: summary.missing_local_assets,
      remote_resources: summary.remote,
      inline_data_resources: summary.inline_data,
      blocked_protocol_resources: summary.blocked_protocol,
      asset_extension_groups: assetExtensionGroups.length,
      total_asset_size_bytes: assetFiles.reduce(
        (sum, file) => sum + file.size_bytes,
        0
      ),
    },
    boundaries: {
      reads_html_text_now: true,
      reads_asset_file_names_now: true,
      reads_asset_bytes_now: false,
      returns_html_text: false,
      returns_resource_urls: false,
      returns_asset_file_names: false,
      rewrites_html_now: false,
      creates_pages_now: false,
      loads_external_resources: false,
      uploads_data: false,
      enables_ai: false,
    },
    resource_groups: Array.from(groups.values()).sort(
      (a, b) => b.total - a.total || a.label.localeCompare(b.label)
    ),
    asset_extension_groups: assetExtensionGroups,
    required_gates: REQUIRED_GATES,
    privacy_note:
      "这个预览只返回资源类别、数量、扩展名分布和本地匹配状态；不会返回 HTML 正文、资源 URL、assets 文件名、assets bytes、页面正文、token、凭证或 AI 输出。",
    next_steps: buildReferencePreviewNextSteps(summary, assetFiles.length),
  };
}

export async function buildBundledHtmlWithLocalAssets(input: {
  htmlFile: File;
  files: File[];
}): Promise<HtmlAssetLocalBundle> {
  const selectedFiles = input.files.length > 0 ? input.files : [input.htmlFile];
  const assetFiles = selectedFiles.filter((file) => file !== input.htmlFile);
  const totalAssetBytes = assetFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalAssetBytes > HTML_ASSET_LOCAL_BUNDLE_MAX_BYTES) {
    throw new Error(
      "本地 assets 超过 25 MB。为保持页面流畅，请先精简 assets、拆分报告，或改用 ZIP 预检路线。"
    );
  }
  const htmlText = await input.htmlFile.text();
  const assetIndex = await buildHtmlAssetDataIndex(assetFiles);
  const stats = {
    rewritten_references: 0,
    inlined_stylesheets: 0,
    inlined_scripts: 0,
    missing_local_assets: 0,
    remote_resources_left_blocked: 0,
    blocked_protocol_resources_left_blocked: 0,
  };

  let bundledHtml = rewriteStylesheetLinks(htmlText, assetIndex, stats);
  bundledHtml = rewriteScriptSources(bundledHtml, assetIndex, stats);
  bundledHtml = rewriteInlineStyleBlocks(bundledHtml, assetIndex, stats);
  bundledHtml = rewriteElementAssetAttributes(bundledHtml, assetIndex, stats);

  return {
    format: "zhinote-html-assets-local-bundle",
    format_version: 1,
    bundle_status: "local-bundle-ready",
    suggested_file_name: buildBundledHtmlFileName(input.htmlFile.name),
    html_text: bundledHtml,
    summary: {
      selected_files: selectedFiles.length,
      candidate_asset_files: assetFiles.length,
      rewritten_references: stats.rewritten_references,
      inlined_stylesheets: stats.inlined_stylesheets,
      inlined_scripts: stats.inlined_scripts,
      missing_local_assets: stats.missing_local_assets,
      remote_resources_left_blocked: stats.remote_resources_left_blocked,
      blocked_protocol_resources_left_blocked:
        stats.blocked_protocol_resources_left_blocked,
      total_asset_bytes_read: totalAssetBytes,
    },
    boundaries: {
      reads_html_text_now: true,
      reads_asset_file_names_now: true,
      reads_asset_bytes_now: true,
      returns_html_text_to_caller: true,
      returns_resource_urls: false,
      returns_asset_file_names: false,
      rewrites_html_now: true,
      creates_pages_now: false,
      loads_external_resources: false,
      uploads_data: false,
      enables_ai: false,
    },
    privacy_note:
      "这个 bundle 只在浏览器本地读取用户主动选择的 HTML 和 assets，把可匹配的本地相对资源改写为 data URL 或内联样式/脚本；不会加载远程资源、不会上传、不会调用 AI，也不会在导出报告中返回资源 URL 或 assets 文件名。",
  };
}

function extractHtmlAssetReferences(htmlText: string): ExtractedHtmlReference[] {
  const references: ExtractedHtmlReference[] = [];
  const attrPattern =
    /<\s*([a-zA-Z0-9:-]+)\b[^>]*?\b(src|href|poster|data|srcset)\s*=\s*(["'])(.*?)\3/gi;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrPattern.exec(htmlText)) !== null) {
    const tag = attrMatch[1].toLowerCase();
    const attr = attrMatch[2].toLowerCase();
    const value = attrMatch[4].trim();
    if (!value) continue;

    if (attr === "srcset") {
      for (const srcsetValue of splitSrcset(value)) {
        references.push({
          kind: inferReferenceKind(tag, attr, srcsetValue, attrMatch[0]),
          value: srcsetValue,
        });
      }
      continue;
    }

    references.push({
      kind: inferReferenceKind(tag, attr, value, attrMatch[0]),
      value,
    });
  }

  const cssUrlPattern = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
  let cssMatch: RegExpExecArray | null;
  while ((cssMatch = cssUrlPattern.exec(htmlText)) !== null) {
    const value = cssMatch[2].trim();
    if (!value) continue;
    references.push({
      kind: inferCssUrlKind(value),
      value,
    });
  }

  return references;
}

interface HtmlAssetDataEntry {
  dataUrl: string;
  text: string | null;
  mimeType: string;
  size: number;
}

interface HtmlAssetBundleStats {
  rewritten_references: number;
  inlined_stylesheets: number;
  inlined_scripts: number;
  missing_local_assets: number;
  remote_resources_left_blocked: number;
  blocked_protocol_resources_left_blocked: number;
}

async function buildHtmlAssetDataIndex(files: File[]) {
  const index = new Map<string, HtmlAssetDataEntry>();

  for (const file of files) {
    const entry: HtmlAssetDataEntry = {
      dataUrl: await readFileAsDataUrl(file),
      text: isTextAsset(file) ? await file.text() : null,
      mimeType: file.type || inferMimeType(file.name),
      size: file.size,
    };
    const withPath = file as File & { webkitRelativePath?: string };
    for (const candidate of [file.name, withPath.webkitRelativePath]) {
      const normalized = normalizeLocalPath(candidate ?? "");
      if (normalized) index.set(normalized, entry);
    }
  }

  return index;
}

function rewriteStylesheetLinks(
  html: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats
) {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = getHtmlAttribute(tag, "rel")?.toLowerCase() ?? "";
    const href = getHtmlAttribute(tag, "href");
    if (!rel.includes("stylesheet") || !href) {
      return rewriteTagAssetAttributes(tag, assetIndex, stats, ["href"]);
    }

    const entry = resolveLocalAsset(href, assetIndex, stats);
    if (!entry?.text) return tag;

    stats.inlined_stylesheets += 1;
    return `<style data-zhinote-local-asset="stylesheet">\n${rewriteCssUrls(
      entry.text,
      assetIndex,
      stats
    )}\n</style>`;
  });
}

function rewriteScriptSources(
  html: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats
) {
  return html.replace(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/script>/gi, (tag, _quote, src) => {
    const entry = resolveLocalAsset(src, assetIndex, stats);
    if (!entry?.text) return tag;

    stats.inlined_scripts += 1;
    return `<script data-zhinote-local-asset="script">\n${escapeScriptText(
      entry.text
    )}\n</script>`;
  });
}

function rewriteInlineStyleBlocks(
  html: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats
) {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_tag, attrs, css) => {
    return `<style${attrs}>${rewriteCssUrls(css, assetIndex, stats)}</style>`;
  });
}

function rewriteElementAssetAttributes(
  html: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats
) {
  return html.replace(
    /<\s*(img|source|video|audio|track|embed|object|iframe)\b[^>]*>/gi,
    (tag) =>
      rewriteTagAssetAttributes(tag, assetIndex, stats, [
        "src",
        "poster",
        "data",
        "srcset",
      ])
  );
}

function rewriteTagAssetAttributes(
  tag: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats,
  attributeNames: string[]
) {
  let nextTag = tag;
  for (const attributeName of attributeNames) {
    const pattern = new RegExp(
      `\\b${attributeName}\\s*=\\s*(["'])(.*?)\\1`,
      "i"
    );
    nextTag = nextTag.replace(pattern, (attr, quote, value) => {
      if (attributeName === "srcset") {
        const rewritten = rewriteSrcset(value, assetIndex, stats);
        return rewritten === value ? attr : `${attributeName}=${quote}${rewritten}${quote}`;
      }
      const entry = resolveLocalAsset(value, assetIndex, stats);
      return entry ? `${attributeName}=${quote}${entry.dataUrl}${quote}` : attr;
    });
  }
  return nextTag;
}

function rewriteSrcset(
  value: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats
) {
  return value
    .split(",")
    .map((part) => {
      const pieces = part.trim().split(/\s+/);
      const url = pieces[0];
      const entry = resolveLocalAsset(url, assetIndex, stats);
      if (!entry) return part.trim();
      return [entry.dataUrl, ...pieces.slice(1)].join(" ");
    })
    .join(", ");
}

function rewriteCssUrls(
  css: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats
) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, value) => {
    const entry = resolveLocalAsset(value, assetIndex, stats);
    if (!entry) return match;
    return `url(${quote}${entry.dataUrl}${quote})`;
  });
}

function resolveLocalAsset(
  reference: string,
  assetIndex: Map<string, HtmlAssetDataEntry>,
  stats: HtmlAssetBundleStats
) {
  const normalized = normalizeReference(reference);
  if (!normalized || normalized.startsWith("#")) return null;
  if (/^(https?:)?\/\//i.test(normalized) || /^(data|blob):/i.test(normalized)) {
    if (/^(https?:)?\/\//i.test(normalized)) {
      stats.remote_resources_left_blocked += 1;
    }
    return null;
  }
  if (/^(javascript|file|ftp|mailto|tel):/i.test(normalized)) {
    stats.blocked_protocol_resources_left_blocked += 1;
    return null;
  }

  const localPath = normalizeLocalPath(normalized.replace(/^\/+/, ""));
  for (const [path, entry] of assetIndex.entries()) {
    if (path === localPath || path.endsWith(`/${localPath}`)) {
      stats.rewritten_references += 1;
      return entry;
    }
  }

  stats.missing_local_assets += 1;
  return null;
}

function getHtmlAttribute(tag: string, attributeName: string) {
  const match = tag.match(
    new RegExp(`\\b${attributeName}\\s*=\\s*(["'])(.*?)\\1`, "i")
  );
  return match?.[2] ?? null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isTextAsset(file: File) {
  const extension = getReferenceExtension(file.name);
  return (
    file.type.startsWith("text/") ||
    [".css", ".js", ".mjs", ".json", ".svg", ".xml"].includes(extension)
  );
}

function inferMimeType(fileName: string) {
  const extension = getReferenceExtension(fileName);
  const mimeTypes: Record<string, string> = {
    ".css": "text/css",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
  };
  return mimeTypes[extension] ?? "application/octet-stream";
}

function buildBundledHtmlFileName(fileName: string) {
  const base = fileName.replace(/\.(html|htm|xhtml)$/i, "").trim();
  return `${base || "html-report"} bundled.html`;
}

function escapeScriptText(value: string) {
  return value.replace(/<\/script/gi, "<\\/script");
}

function inferReferenceKind(
  tag: string,
  attr: string,
  value: string,
  rawTag: string
): HtmlAssetReferenceKind {
  if (tag === "script") return "script";
  if (tag === "iframe" || tag === "frame" || tag === "embed") return "frame";
  if (tag === "video" || tag === "audio" || tag === "track") return "media";
  if (attr === "poster") return "image";
  if (tag === "img" || tag === "picture" || tag === "source") {
    const extension = getReferenceExtension(value);
    return isMediaExtension(extension) ? "media" : "image";
  }
  if (tag === "link") {
    const lower = rawTag.toLowerCase();
    if (lower.includes("stylesheet")) return "stylesheet";
    if (lower.includes('as="font"') || lower.includes("as='font'")) return "font";
    if (lower.includes("icon")) return "image";
  }
  return inferCssUrlKind(value);
}

function inferCssUrlKind(value: string): HtmlAssetReferenceKind {
  const extension = getReferenceExtension(value);
  if (isFontExtension(extension)) return "font";
  if (isImageExtension(extension)) return "image";
  if (isMediaExtension(extension)) return "media";
  if (extension === ".css") return "stylesheet";
  if (extension === ".js" || extension === ".mjs") return "script";
  return "css-url";
}

function classifyReference(
  value: string,
  assetPathIndex: Set<string>
): {
  local_relative: boolean;
  matched_local_asset: boolean;
  missing_local_asset: boolean;
  remote: boolean;
  inline_data: boolean;
  blocked_protocol: boolean;
} {
  const normalized = normalizeReference(value);
  const remote = /^(https?:)?\/\//i.test(normalized);
  const inlineData = /^(data|blob):/i.test(normalized);
  const blockedProtocol = /^(javascript|file|ftp|mailto|tel):/i.test(normalized);
  const localRelative =
    Boolean(normalized) &&
    !remote &&
    !inlineData &&
    !blockedProtocol &&
    !normalized.startsWith("#");
  const matchedLocalAsset =
    localRelative && referenceMatchesAsset(normalized, assetPathIndex);

  return {
    local_relative: localRelative,
    matched_local_asset: matchedLocalAsset,
    missing_local_asset: localRelative && !matchedLocalAsset,
    remote,
    inline_data: inlineData,
    blocked_protocol: blockedProtocol,
  };
}

function buildAssetPathIndex(files: HtmlAssetSourceFile[]) {
  const index = new Set<string>();
  for (const file of files) {
    for (const candidate of [file.name, file.webkit_relative_path]) {
      const normalized = normalizeLocalPath(candidate ?? "");
      if (normalized) index.add(normalized);
    }
  }
  return index;
}

function referenceMatchesAsset(reference: string, assetPathIndex: Set<string>) {
  const normalized = normalizeLocalPath(reference.replace(/^\/+/, ""));
  if (!normalized) return false;
  for (const path of assetPathIndex) {
    if (path === normalized || path.endsWith(`/${normalized}`)) return true;
  }
  return false;
}

function buildAssetExtensionGroups(
  files: HtmlAssetSourceFile[],
  assetMatchesByExtension: Map<string, number>
): HtmlAssetExtensionGroup[] {
  const groups = new Map<string, HtmlAssetExtensionGroup>();
  for (const file of files) {
    const extension = getReferenceExtension(file.name || file.webkit_relative_path || "");
    const existing = groups.get(extension) ?? {
      extension,
      files: 0,
      total_size_bytes: 0,
      referenced_matches: 0,
    };
    existing.files += 1;
    existing.total_size_bytes += file.size_bytes;
    groups.set(extension, existing);
  }

  for (const [extension, matches] of assetMatchesByExtension) {
    const existing = groups.get(extension);
    if (existing) existing.referenced_matches = matches;
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      b.files - a.files ||
      b.referenced_matches - a.referenced_matches ||
      a.extension.localeCompare(b.extension)
  );
}

function createEmptyReferenceGroup(
  kind: HtmlAssetReferenceKind
): HtmlAssetReferenceGroup {
  return {
    kind,
    label: RESOURCE_CLASSES.find((resource) => resource.id === kind)?.label ?? kind,
    total: 0,
    local_relative: 0,
    matched_local_assets: 0,
    missing_local_assets: 0,
    remote: 0,
    inline_data: 0,
    blocked_protocol: 0,
  };
}

function summarizeReferenceGroups(groups: HtmlAssetReferenceGroup[]) {
  return groups.reduce(
    (summary, group) => ({
      local_relative: summary.local_relative + group.local_relative,
      matched_local_assets:
        summary.matched_local_assets + group.matched_local_assets,
      missing_local_assets:
        summary.missing_local_assets + group.missing_local_assets,
      remote: summary.remote + group.remote,
      inline_data: summary.inline_data + group.inline_data,
      blocked_protocol: summary.blocked_protocol + group.blocked_protocol,
    }),
    {
      local_relative: 0,
      matched_local_assets: 0,
      missing_local_assets: 0,
      remote: 0,
      inline_data: 0,
      blocked_protocol: 0,
    }
  );
}

function buildReferencePreviewNextSteps(
  summary: ReturnType<typeof summarizeReferenceGroups>,
  assetFileCount: number
) {
  const steps = [
    "先复核本地匹配数量和缺失数量；预览不返回 URL 或 assets 文件名。",
  ];
  if (summary.missing_local_assets > 0) {
    steps.push("缺失的本地资源需要重新选择完整 assets 文件夹或改用 ZIP assets 预检。");
  }
  if (summary.remote > 0 || summary.blocked_protocol > 0) {
    steps.push("远程资源和特殊协议继续阻止；加载前必须走 allowlist 确认。");
  }
  if (assetFileCount > 0 && summary.matched_local_assets > 0) {
    steps.push("本地 assets 已有匹配；下一阶段才允许生成本地保真预览 receipt。");
  }
  steps.push("确认后再考虑本地引用改写、沙盒渲染和 page 创建。");
  return steps;
}

function splitSrcset(value: string) {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function normalizeReference(value: string) {
  return value.trim().replace(/&amp;/g, "&").split("#")[0].split("?")[0];
}

function normalizeLocalPath(value: string) {
  try {
    return decodeURIComponent(normalizeReference(value))
      .replace(/\\/g, "/")
      .replace(/^\.\//, "")
      .toLowerCase();
  } catch {
    return normalizeReference(value)
      .replace(/\\/g, "/")
      .replace(/^\.\//, "")
      .toLowerCase();
  }
}

function getReferenceExtension(value: string) {
  const clean = normalizeReference(value).split("/").filter(Boolean).at(-1) ?? "";
  const dotIndex = clean.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === clean.length - 1) return "unknown";
  return clean.slice(dotIndex).toLowerCase();
}

function isHtmlFileName(value: string) {
  const extension = getReferenceExtension(value);
  return extension === ".html" || extension === ".htm" || extension === ".xhtml";
}

function isImageExtension(extension: string) {
  return [
    ".avif",
    ".bmp",
    ".gif",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".webp",
  ].includes(extension);
}

function isFontExtension(extension: string) {
  return [".eot", ".otf", ".ttf", ".woff", ".woff2"].includes(extension);
}

function isMediaExtension(extension: string) {
  return [
    ".aac",
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".ogg",
    ".ogv",
    ".wav",
    ".webm",
  ].includes(extension);
}
