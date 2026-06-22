#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { markdownToHtml } from "../src/lib/markdown/markdownToHtml.ts";

const UTF8 = new TextDecoder("utf-8");
const MAX_INGEST_HTML_BYTES = 800 * 1024;
const DEFAULT_ENDPOINT = "https://www.zhi-note.com/api/pages/ingest";

function usage() {
  console.log(`Usage:
  node scripts/notion-daily-notes-import.mjs <notion-export.zip> [options]

Options:
  --dry-run                  Parse and verify only. Default.
  --apply                    Write pages to ZhiNote through /api/pages/ingest.
  --endpoint <url>           ZhiNote ingest endpoint. Default: ${DEFAULT_ENDPOINT}
  --api-key-env <name>       Env var containing the ingest API key. Default: ZHINOTE_INGEST_API_KEY
  --out <path>               Write a metadata-only report JSON.
  --limit <n>                Import only the first n importable rows.
  --offset <n>               Skip the first n importable rows before importing.

The report intentionally excludes full page bodies.`);
}

function parseArgs(argv) {
  const args = {
    zipPath: null,
    apply: false,
    endpoint: DEFAULT_ENDPOINT,
    apiKeyEnv: "ZHINOTE_INGEST_API_KEY",
    out: null,
    limit: null,
    offset: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      args.apply = false;
      continue;
    }
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--endpoint") {
      args.endpoint = argv[++i];
      continue;
    }
    if (arg === "--api-key-env") {
      args.apiKeyEnv = argv[++i];
      continue;
    }
    if (arg === "--out") {
      args.out = argv[++i];
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number(argv[++i]);
      continue;
    }
    if (arg === "--offset") {
      args.offset = Number(argv[++i]);
      continue;
    }
    if (!args.zipPath) {
      args.zipPath = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.zipPath) {
    usage();
    process.exit(1);
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }
  if (!Number.isInteger(args.offset) || args.offset < 0) {
    throw new Error("--offset must be a non-negative integer.");
  }
  return args;
}

function readUInt16LE(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32LE(buffer, offset) === signature) return offset;
  }
  throw new Error("Cannot find ZIP central directory.");
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = readUInt16LE(buffer, eocdOffset + 10);
  let offset = readUInt32LE(buffer, eocdOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32LE(buffer, offset) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry.");
    }
    const generalPurposeFlag = readUInt16LE(buffer, offset + 8);
    const compressionMethod = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const fileNameLength = readUInt16LE(buffer, offset + 28);
    const extraFieldLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const entryPath = UTF8.decode(buffer.subarray(nameStart, nameEnd));

    entries.push({
      path: entryPath,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      generalPurposeFlag,
      localHeaderOffset,
    });
    offset = nameEnd + extraFieldLength + commentLength;
  }

  return entries.filter((entry) => !entry.path.endsWith("/"));
}

function readEntryData(buffer, entry) {
  if (entry.generalPurposeFlag & 0x0001) {
    throw new Error(`Encrypted ZIP entry is not supported: ${entry.path}`);
  }
  const offset = entry.localHeaderOffset;
  if (readUInt32LE(buffer, offset) !== 0x04034b50) {
    throw new Error(`Invalid local file header: ${entry.path}`);
  }
  const fileNameLength = readUInt16LE(buffer, offset + 26);
  const extraFieldLength = readUInt16LE(buffer, offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraFieldLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return Buffer.from(compressed);
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod}: ${entry.path}`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
    );
}

function chooseDailyCsv(entriesByPath) {
  const candidates = [];
  for (const [entryPath, entry] of entriesByPath.entries()) {
    if (!entryPath.toLowerCase().endsWith(".csv")) continue;
    const text = UTF8.decode(entry.data);
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    if (firstLine.includes("Name") && firstLine.includes("Date")) {
      candidates.push({ path: entryPath, text });
    }
  }
  if (candidates.length === 0) {
    throw new Error("No Notion database CSV with Name and Date columns was found.");
  }
  candidates.sort((a, b) => {
    const aAll = /_all\.csv$/i.test(a.path) ? 0 : 1;
    const bAll = /_all\.csv$/i.test(b.path) ? 0 : 1;
    const aDaily = a.path.includes("每日纪要") ? 0 : 1;
    const bDaily = b.path.includes("每日纪要") ? 0 : 1;
    return aDaily - bDaily || aAll - bAll || a.path.localeCompare(b.path);
  });
  return candidates[0];
}

function normalizeTitle(value) {
  return value
    .replace(/\.(?:md|markdown)$/i, "")
    .replace(/\s+[0-9a-f]{32}$/i, "")
    .replace(/\s+[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeLooseTitle(value) {
  return normalizeTitle(value)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function basenameTitle(entryPath) {
  return normalizeTitle(path.posix.basename(entryPath));
}

function normalizeDate(raw, title = "") {
  const value = String(raw ?? "").trim();
  if (value) {
    const first = value
      .split(/\s*(?:→|->| - )\s*/)[0]
      .replace(/\s+@\s+.*/, "")
      .trim();
    const fromProperty = normalizeDateText(first);
    if (fromProperty) return { date: fromProperty, source: "property" };
  }

  const fromTitle = inferDateFromTitle(title);
  if (fromTitle) return { date: fromTitle, source: "title" };
  return { date: null, source: value ? "unparsed-property" : "missing" };
}

function normalizeDateText(first) {
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(first);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const chinese = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(first);
  if (chinese) {
    return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  }
  const parsed = new Date(first);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function inferDateFromTitle(title) {
  const value = String(title ?? "").normalize("NFKC");
  const fourPart = /(?:^|[^\d])((?:20)?\d{2})[.\-/年 ]+(\d{1,2})[.\-/月 ]+(\d{1,2})(?:日)?(?:[^\d]|$)/.exec(value);
  if (fourPart) {
    return formatInferredDate(fourPart[1], fourPart[2], fourPart[3]);
  }
  const compact = /(?:^|[^\d])((?:20)?\d{2})(\d{2})(\d{2})(?:[^\d]|$)/.exec(value);
  if (compact) {
    return formatInferredDate(compact[1], compact[2], compact[3]);
  }
  return null;
}

function formatInferredDate(yearText, monthText, dayText) {
  const yearNumber = Number(yearText);
  const year = yearText.length === 2 ? 2000 + yearNumber : yearNumber;
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function stripExportTitle(markdown, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*#\\s+${escaped}\\s*\\n{1,2}`, "i");
  return markdown.replace(pattern, "");
}

function resolveRelativePath(fromPath, rawTarget) {
  const target = rawTarget.trim().replace(/^<|>$/g, "");
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) {
    return null;
  }
  const clean = target.split("#")[0].split("?")[0];
  const decoded = decodeURIComponent(clean);
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), decoded));
}

function mimeForPath(entryPath) {
  const ext = path.extname(entryPath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return null;
}

function inlineImageAssets(markdown, markdownPath, entriesByPath) {
  let inlined = 0;
  let missing = 0;
  const updated = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, target) => {
    const resolved = resolveRelativePath(markdownPath, target);
    if (!resolved) return match;
    const entry = entriesByPath.get(resolved);
    const mime = entry ? mimeForPath(resolved) : null;
    if (!entry || !mime) {
      missing += 1;
      return match;
    }
    inlined += 1;
    return `![${alt}](data:${mime};base64,${Buffer.from(entry.data).toString("base64")})`;
  });
  return { markdown: updated, inlined, missing };
}

function buildMarkdownIndex(entriesByPath) {
  const index = { strict: new Map(), loose: new Map() };
  for (const [entryPath, entry] of entriesByPath.entries()) {
    if (!/\.(md|markdown)$/i.test(entryPath)) continue;
    const key = basenameTitle(entryPath);
    const file = { path: entryPath, entry };
    const strictList = index.strict.get(key) ?? [];
    strictList.push(file);
    index.strict.set(key, strictList);

    const looseKey = normalizeLooseTitle(key);
    const looseList = index.loose.get(looseKey) ?? [];
    looseList.push(file);
    index.loose.set(looseKey, looseList);
  }
  return index;
}

function findMarkdownForTitle(title, markdownIndex) {
  const key = normalizeTitle(title);
  const exact = markdownIndex.strict.get(key);
  if (exact?.length) return exact[0];

  const loose = markdownIndex.loose.get(normalizeLooseTitle(title));
  if (loose?.length) {
    loose.sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path));
    return loose[0];
  }

  const titleLooseKey = normalizeLooseTitle(title);
  const looseFuzzy = [];
  for (const [candidateKey, files] of markdownIndex.loose.entries()) {
    if (
      candidateKey.length >= 24 &&
      titleLooseKey.length >= 24 &&
      (candidateKey.startsWith(titleLooseKey) || titleLooseKey.startsWith(candidateKey))
    ) {
      looseFuzzy.push(...files);
    }
  }
  if (looseFuzzy.length) {
    looseFuzzy.sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path));
    return looseFuzzy[0];
  }

  const fuzzy = [];
  for (const [candidateKey, files] of markdownIndex.strict.entries()) {
    if (
      candidateKey === key ||
      candidateKey.startsWith(`${key} `) ||
      key.startsWith(`${candidateKey} `)
    ) {
      fuzzy.push(...files);
    }
  }
  fuzzy.sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path));
  return fuzzy[0] ?? null;
}

function summarizeByDate(items) {
  const dates = new Map();
  for (const item of items) {
    if (!item.date) continue;
    dates.set(item.date, (dates.get(item.date) ?? 0) + 1);
  }
  return [...dates.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function planImport(buffer) {
  const zipEntries = readZipEntries(buffer);
  const entriesByPath = new Map();
  for (const entry of zipEntries) {
    entriesByPath.set(entry.path, { ...entry, data: readEntryData(buffer, entry) });
  }

  const csv = chooseDailyCsv(entriesByPath);
  const rows = parseCsv(csv.text);
  const markdownIndex = buildMarkdownIndex(entriesByPath);
  const items = [];

  for (const [index, row] of rows.entries()) {
    const title = String(row.Name ?? "").trim() || `未命名每日纪要 ${index + 1}`;
    const dateResult = normalizeDate(row.Date, title);
    const date = dateResult.date;
    const markdownFile = findMarkdownForTitle(title, markdownIndex);
    let bodyMarkdown = "";
    let bodyHtml = "";
    let inlinedImages = 0;
    let missingImages = 0;

    if (markdownFile) {
      const rawMarkdown = UTF8.decode(markdownFile.entry.data);
      const inlined = inlineImageAssets(
        stripExportTitle(rawMarkdown, title),
        markdownFile.path,
        entriesByPath
      );
      bodyMarkdown = inlined.markdown.trim();
      inlinedImages = inlined.inlined;
      missingImages = inlined.missing;
      bodyHtml = markdownToHtml(bodyMarkdown);
    }

    const htmlBytes = new TextEncoder().encode(bodyHtml).length;
    const status =
      !date ? "blocked-missing-date" :
      !markdownFile ? "blocked-missing-markdown" :
      htmlBytes > MAX_INGEST_HTML_BYTES ? "blocked-too-large" :
      "ready";

    items.push({
      row: index + 1,
      title,
      date,
      dateSource: dateResult.source,
      keyPoint: String(row["要点"] ?? "").trim(),
      quality: String(row["质量"] ?? "").trim(),
      markdownPath: markdownFile?.path ?? null,
      markdownBytes: bodyMarkdown.length,
      htmlBytes,
      inlinedImages,
      missingImages,
      status,
      bodyHtml,
    });
  }

  const counts = items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    { total: 0 }
  );

  return {
    csvPath: csv.path,
    zipFiles: zipEntries.length,
    markdownFiles: [...entriesByPath.keys()].filter((entryPath) => /\.(md|markdown)$/i.test(entryPath)).length,
    imageFiles: [...entriesByPath.keys()].filter((entryPath) => Boolean(mimeForPath(entryPath))).length,
    counts,
    byDate: summarizeByDate(items),
    items,
  };
}

function reportWithoutBodies(plan, result) {
  return {
    generatedAt: new Date().toISOString(),
    csvPath: plan.csvPath,
    zipFiles: plan.zipFiles,
    markdownFiles: plan.markdownFiles,
    imageFiles: plan.imageFiles,
    counts: plan.counts,
    byDate: plan.byDate,
    result,
    items: plan.items.map((item) => ({
      row: item.row,
      title: item.title,
      date: item.date,
      dateSource: item.dateSource,
      keyPoint: item.keyPoint,
      quality: item.quality,
      markdownPath: item.markdownPath,
      markdownBytes: item.markdownBytes,
      htmlBytes: item.htmlBytes,
      inlinedImages: item.inlinedImages,
      missingImages: item.missingImages,
      status: item.status,
    })),
  };
}

async function ingestOne(endpoint, apiKey, item) {
  const contentParts = [item.bodyHtml];
  const importMeta = [
    "<hr />",
    "<p><strong>Notion 导入校验</strong></p>",
    `<p>日期：${escapeHtml(item.date)}；原始 Markdown 字节：${item.markdownBytes}；HTML 字节：${item.htmlBytes}；内联图片：${item.inlinedImages}；缺失图片：${item.missingImages}</p>`,
  ].join("");
  contentParts.push(importMeta);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      title: item.title,
      content: contentParts.join("\n"),
      icon: "📝",
      source: "notion-daily-import",
      clientDate: item.date,
      placement: "daily",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const buffer = await readFile(args.zipPath);
  const plan = planImport(buffer);
  const readyItems = plan.items.filter((item) => item.status === "ready");
  const offsetItems = readyItems.slice(args.offset);
  const limitedItems = args.limit ? offsetItems.slice(0, args.limit) : offsetItems;

  let result = {
    mode: args.apply ? "apply" : "dry-run",
    endpoint: args.apply ? args.endpoint : null,
    offset: args.offset,
    selected: limitedItems.length,
    attempted: 0,
    created: 0,
    failed: 0,
    failures: [],
  };

  if (args.apply) {
    const apiKey = process.env[args.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Missing API key env var: ${args.apiKeyEnv}`);
    }
    for (const item of limitedItems) {
      result.attempted += 1;
      try {
        const response = await ingestOne(args.endpoint, apiKey, item);
        result.created += 1;
        if (response.placement !== "daily") {
          result.failures.push({
            row: item.row,
            title: item.title,
            error: "created outside daily workspace",
            pageId: response.pageId,
          });
          result.failed += 1;
          break;
        }
      } catch (err) {
        result.failed += 1;
        result.failures.push({
          row: item.row,
          title: item.title,
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }
      if (result.attempted % 25 === 0 || result.attempted === limitedItems.length) {
        console.error(
          `Imported ${result.attempted}/${limitedItems.length} selected ready items (${result.created} created).`
        );
      }
    }
  }

  const report = reportWithoutBodies(plan, result);
  if (args.out) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({
    csvPath: report.csvPath,
    zipFiles: report.zipFiles,
    markdownFiles: report.markdownFiles,
    imageFiles: report.imageFiles,
    counts: report.counts,
    dateCount: report.byDate.length,
    result,
    reportPath: args.out ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
