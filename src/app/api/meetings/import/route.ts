import { createHash } from "crypto";
import { NextResponse } from "next/server";
import {
  accountMissingEnv,
  getAccountConfig,
  normalizeEmail,
} from "@/lib/account/server";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
  type PagePropertyType,
} from "@/lib/pages/pageProperties";
import {
  isValidPageSyncId,
  readPageSyncPage,
  upsertPageSyncRecords,
  type PageSyncRecord,
} from "@/lib/pages/accountPageStore";

export const dynamic = "force-dynamic";

const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
const MAX_MINUTES_CHARS = 250_000;
const MAX_TRANSCRIPT_CHARS = 120_000;

type ImportBody = {
  schema_version?: unknown;
  workspace_id?: unknown;
  meeting?: unknown;
  content?: unknown;
  recording?: unknown;
  source_manifest?: unknown;
};

export async function POST(request: Request) {
  if (!authorizeImport(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = getAccountConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "account page sync is not configured",
        missing_env: accountMissingEnv(),
      },
      { status: 501 }
    );
  }

  const ownerEmail = importOwnerEmail(config.allowedEmails);
  if (!ownerEmail) {
    return NextResponse.json(
      {
        error:
          "ZHINOTES_IMPORT_ACCOUNT_EMAIL is required when multiple account emails are allowed.",
      },
      { status: 501 }
    );
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (bodyText.length > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let body: ImportBody;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (body.schema_version !== "zhinotes.meeting_import.v1") {
    return NextResponse.json({ error: "unsupported schema_version" }, { status: 400 });
  }

  const meeting = objectValue(body.meeting);
  const content = objectValue(body.content);
  if (!meeting || !content) {
    return NextResponse.json({ error: "missing meeting/content" }, { status: 400 });
  }

  const parentPageId = firstText(
    meeting.source_page_id,
    meeting.zhinote_page_id,
    meeting.page_id
  );
  if (!isValidPageSyncId(parentPageId)) {
    return NextResponse.json(
      { error: "missing or invalid meeting source page id" },
      { status: 400 }
    );
  }

  const parent = await readPageSyncPage(config, ownerEmail, parentPageId);
  if (!parent || parent.deleted_at) {
    return NextResponse.json(
      {
        error:
          "meeting page is not available in account page sync; open ZhiNote once so the meeting page can sync before importing minutes",
      },
      { status: 409 }
    );
  }

  const minutes = firstText(content.minutes_markdown).slice(0, MAX_MINUTES_CHARS);
  if (!minutes.trim()) {
    return NextResponse.json({ error: "missing minutes_markdown" }, { status: 400 });
  }
  const transcript = firstText(content.transcript).slice(0, MAX_TRANSCRIPT_CHARS);
  const now = new Date().toISOString();
  const childId = buildMinutesPageId(parentPageId, body);
  const childTitle = buildMinutesTitle(meeting);
  const child: PageSyncRecord = {
    id: childId,
    parent_id: parentPageId,
    title: childTitle,
    icon: "📝",
    cover_url: null,
    content_text: buildMinutesPageHtml({
      title: childTitle,
      meeting,
      minutes,
      transcript,
      transcriptTruncated: firstText(content.transcript).length > MAX_TRANSCRIPT_CHARS,
      recording: objectValue(body.recording),
      sourceManifest: objectValue(body.source_manifest),
      importedAt: now,
    }),
    properties: stringifyPageProperties([
      { ...createPageProperty("select", "类型"), value: "会议纪要", options: ["会议纪要"] },
      { ...createPageProperty("date", "日期"), value: firstText(meeting.date_label) },
      { ...createPageProperty("text", "导入时间"), value: now },
      {
        ...createPageProperty("text", "来源会议页"),
        value: parentPageId,
      },
    ]),
    position: Date.now(),
    depth: parent.depth + 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  const parentProps = parsePageProperties(parent.properties);
  const updatedParent: PageSyncRecord = {
    ...parent,
    properties: stringifyPageProperties(
      upsertProperties(parentProps, [
        ["会议痕迹", "select", "已完成", ["已留痕-待执行", "已留痕-待补时间", "导入失败-已留痕", "已完成", "已取消"]],
        ["录制状态", "select", "录制成功", ["待执行", "录制中", "录制成功", "录制失败", "未执行"]],
        ["录制链路", "select", "验证通过", ["未验证", "验证通过", "录制链路未就绪"]],
        ["纪要页面", "url", `/page/${childId}`],
        ["纪要导入时间", "text", now],
        ["内容指纹", "text", contentFingerprint(body) ?? ""],
      ])
    ),
    updated_at: now,
  };

  const { accepted, skipped } = await upsertPageSyncRecords(config, ownerEmail, [
    child,
    updatedParent,
  ]);

  return NextResponse.json({
    ok: true,
    id: childId,
    page_id: childId,
    parent_page_id: parentPageId,
    url: `/page/${childId}`,
    accepted,
    skipped,
  });
}

function authorizeImport(request: Request) {
  const expected =
    process.env.ZHINOTES_IMPORT_API_KEY || process.env.ZHINOTES_API_KEY || "";
  if (!expected) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  return token.length > 0 && token === expected;
}

function importOwnerEmail(allowedEmails: Set<string>) {
  const configured = normalizeEmail(
    process.env.ZHINOTES_IMPORT_ACCOUNT_EMAIL ??
      process.env.ZHINOTES_OWNER_EMAIL ??
      ""
  );
  if (configured && allowedEmails.has(configured)) return configured;
  if (allowedEmails.size === 1) return Array.from(allowedEmails)[0];
  return null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return "";
}

function buildMinutesPageId(parentPageId: string, body: ImportBody) {
  const base = [
    parentPageId,
    firstText(objectValue(body.meeting)?.meeting_key),
    contentFingerprint(body),
    firstText(objectValue(body.meeting)?.start_time),
  ].join("\n");
  return `zhihui-min-${createHash("sha256").update(base).digest("hex").slice(0, 24)}`;
}

function contentFingerprint(body: ImportBody) {
  const sourceManifest = objectValue(body.source_manifest);
  const fingerprint = objectValue(sourceManifest?.content_fingerprint);
  return firstText(fingerprint?.sha256);
}

function buildMinutesTitle(meeting: Record<string, unknown>) {
  const date = firstText(meeting.date_label, firstText(meeting.start_time).slice(0, 10));
  return `会议纪要-${firstText(meeting.topic, meeting.title, "未命名会议")}-${date}`;
}

function upsertProperties(
  properties: PageProperty[],
  updates: [string, PagePropertyType, string, string[]?][]
) {
  let next = properties;
  for (const [name, type, value, options] of updates) {
    const index = next.findIndex((property) => property.name === name);
    if (index >= 0) {
      next = next.map((property, i) =>
        i === index
          ? {
              ...property,
              type,
              value,
              ...(options ? { options } : property.options ? { options: property.options } : {}),
            }
          : property
      );
    } else {
      next = [
        ...next,
        {
          ...createPageProperty(type, name),
          value,
          ...(options ? { options } : {}),
        },
      ];
    }
  }
  return next;
}

function buildMinutesPageHtml({
  title,
  meeting,
  minutes,
  transcript,
  transcriptTruncated,
  recording,
  sourceManifest,
  importedAt,
}: {
  title: string;
  meeting: Record<string, unknown>;
  minutes: string;
  transcript: string;
  transcriptTruncated: boolean;
  recording: Record<string, unknown> | null;
  sourceManifest: Record<string, unknown> | null;
  importedAt: string;
}) {
  const rows = [
    ["会议主题", firstText(meeting.topic, meeting.title)],
    ["组织者", firstText(meeting.organizer)],
    ["平台", firstText(meeting.platform)],
    ["时间", firstText(meeting.start_time, meeting.date_label)],
    ["导入时间", importedAt],
    ["录音文件", firstText(recording?.filename)],
    ["录音大小", formatBytes(recording?.size_bytes)],
    ["录音 SHA-256", firstText(recording?.sha256)],
    ["内容指纹", firstText(objectValue(sourceManifest?.content_fingerprint)?.sha256)],
  ].filter(([, value]) => value);

  return [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>ZhiHui 已把本次转写完成后的纪要保存到原会议页面下方。录音目前只入库元数据，原始录音文件仍由 runner 的录音存储负责保留。</p>`,
    `<table><tbody>${rows
      .map(
        ([label, value]) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
      )
      .join("")}</tbody></table>`,
    "<h2>会议纪要</h2>",
    markdownToHtml(minutes || "无纪要内容。"),
    transcript
      ? `<h2>转写稿</h2><pre><code>${escapeHtml(transcript)}</code></pre>${
          transcriptTruncated
            ? "<p>转写稿较长，页面内只保留前段；完整性以内容指纹和 runner 本地 artifact 为准。</p>"
            : ""
        }`
      : "",
  ].join("");
}

function formatBytes(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "";
  }
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
