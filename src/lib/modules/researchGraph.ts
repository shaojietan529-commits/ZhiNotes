import { normalizeRelationValue } from "@/lib/database/relationValues";
import type {
  Database,
  DatabaseField,
  DatabaseRow,
  Page,
} from "@/lib/utils/types";

export type ResearchAssetKind = "company" | "report" | "meeting" | "portfolio";

export interface ResearchDatabaseSnapshot {
  database: Database;
  fields: DatabaseField[];
  rows: Array<DatabaseRow & { page: Page }>;
}

export interface ResearchAsset {
  id: string;
  kind: ResearchAssetKind;
  title: string;
  icon: string | null;
  updatedAt: string;
}

export interface ResearchRelationLink {
  id: string;
  source: ResearchAsset;
  target: ResearchAsset;
  fieldName: string;
  databaseTitle: string;
}

export interface ResearchGraph {
  assets: ResearchAsset[];
  relationLinks: ResearchRelationLink[];
  unlinkedAssets: ResearchAsset[];
  counts: Record<ResearchAssetKind, number>;
}

const KIND_LABELS: Record<ResearchAssetKind, string> = {
  company: "公司",
  report: "报告",
  meeting: "会议",
  portfolio: "组合",
};

const RELATION_FIELD_LABELS: Array<[string, string]> = [
  ["company page", "公司页面"],
  ["report page", "报告页面"],
  ["meeting note", "会议纪要"],
  ["transcript page", "转录稿页面"],
  ["related reports", "相关报告"],
  ["related report", "相关报告"],
  ["related meetings", "相关会议"],
  ["related meeting", "相关会议"],
  ["related memo", "相关备忘录"],
  ["memo", "备忘录"],
  ["公司", "公司"],
  ["报告", "报告"],
  ["会议", "会议"],
  ["电话会", "电话会"],
  ["转录稿", "转录稿"],
  ["备忘录", "备忘录"],
];

export function getResearchAssetKindLabel(kind: ResearchAssetKind) {
  return KIND_LABELS[kind];
}

export function getResearchRelationFieldLabel(fieldName: string) {
  const normalized = normalizeText(fieldName);
  return (
    RELATION_FIELD_LABELS.find(([term]) => normalized.includes(term))?.[1] ??
    fieldName
  );
}

export function classifyResearchDatabase(
  database: Pick<Database, "title" | "description">
): ResearchAssetKind | null {
  const text = normalizeText(`${database.title} ${database.description ?? ""}`);
  if (hasAny(text, ["company research", "company-level research", "公司研究"])) {
    return "company";
  }
  if (hasAny(text, ["report library", "report tracker", "报告库", "报告跟踪"])) {
    return "report";
  }
  if (hasAny(text, ["portfolio tracker", "watchlist", "组合跟踪", "观察名单"])) {
    return "portfolio";
  }
  if (hasAny(text, ["meeting", "call tracker", "会议", "电话会"])) {
    return "meeting";
  }
  return null;
}

export function classifyResearchPage(
  page: Pick<Page, "title" | "content_text">,
  fallback?: ResearchAssetKind | null
): ResearchAssetKind | null {
  const text = normalizeText(`${page.title} ${page.content_text ?? ""}`);
  if (
    hasAny(text, [
      "company research",
      "business model",
      "industry structure",
      "unit economics",
      "earnings review",
      "investment memo",
      "公司研究",
      "商业模式",
      "行业结构",
      "业绩复盘",
      "投资备忘录",
    ])
  ) {
    return "company";
  }
  if (
    hasAny(text, [
      "research report",
      "report review",
      "html report",
      "source report",
      "key takeaways",
      "file preview",
      "研究报告",
      "报告复盘",
      "核心结论",
      "文件预览",
    ])
  ) {
    return "report";
  }
  if (
    hasAny(text, [
      "meeting notes",
      "management call",
      "expert call",
      "earnings call",
      "transcript",
      "action items",
      "会议纪要",
      "电话会",
      "转录稿",
      "行动项",
    ])
  ) {
    return "meeting";
  }
  if (
    hasAny(text, [
      "portfolio",
      "watchlist",
      "position memo",
      "target weight",
      "conviction",
      "持仓",
      "组合",
      "观察名单",
      "仓位",
      "确信度",
    ])
  ) {
    return "portfolio";
  }
  return fallback ?? null;
}

export function buildResearchGraph(
  pages: Page[],
  snapshots: ResearchDatabaseSnapshot[]
): ResearchGraph {
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const assetsById = new Map<string, ResearchAsset>();
  const relationLinks: ResearchRelationLink[] = [];
  const seenLinks = new Set<string>();

  for (const page of pages) {
    const kind = classifyResearchPage(page);
    if (kind) {
      assetsById.set(page.id, createAsset(page, kind));
    }
  }

  for (const snapshot of snapshots) {
    const databaseKind = classifyResearchDatabase(snapshot.database);
    if (!databaseKind) continue;

    const relationFields = snapshot.fields.filter(
      (field) => field.field_type === "relation"
    );
    if (relationFields.length === 0) continue;

    for (const row of snapshot.rows) {
      const sourceKind = classifyResearchPage(row.page, databaseKind) ?? databaseKind;
      const sourceAsset = createAsset(row.page, sourceKind);
      assetsById.set(sourceAsset.id, sourceAsset);

      const fieldValues = parseFieldValues(row.field_values);
      for (const field of relationFields) {
        const targetIds = normalizeRelationValue(fieldValues[field.id]);
        for (const targetId of targetIds) {
          const targetPage = pagesById.get(targetId);
          if (!targetPage) continue;

          const targetKind =
            classifyResearchPage(targetPage) ??
            inferResearchKindFromRelationField(field.name);
          if (!targetKind) continue;

          const targetAsset = createAsset(targetPage, targetKind);
          assetsById.set(targetAsset.id, targetAsset);

          const linkId = `${row.id}:${field.id}:${targetId}`;
          if (seenLinks.has(linkId)) continue;
          seenLinks.add(linkId);

          relationLinks.push({
            id: linkId,
            source: sourceAsset,
            target: targetAsset,
            fieldName: field.name,
            databaseTitle: snapshot.database.title,
          });
        }
      }
    }
  }

  const connectionCounts = new Map<string, number>();
  for (const link of relationLinks) {
    connectionCounts.set(link.source.id, (connectionCounts.get(link.source.id) ?? 0) + 1);
    connectionCounts.set(link.target.id, (connectionCounts.get(link.target.id) ?? 0) + 1);
  }

  const assets = Array.from(assetsById.values()).sort(sortByUpdatedAtDesc);
  const unlinkedAssets = assets
    .filter((asset) => !connectionCounts.has(asset.id))
    .sort(sortByUpdatedAtDesc);

  return {
    assets,
    relationLinks: relationLinks.sort((a, b) =>
      sortByUpdatedAtDesc(a.source, b.source)
    ),
    unlinkedAssets,
    counts: {
      company: assets.filter((asset) => asset.kind === "company").length,
      report: assets.filter((asset) => asset.kind === "report").length,
      meeting: assets.filter((asset) => asset.kind === "meeting").length,
      portfolio: assets.filter((asset) => asset.kind === "portfolio").length,
    },
  };
}

function createAsset(page: Page, kind: ResearchAssetKind): ResearchAsset {
  return {
    id: page.id,
    kind,
    title: page.title || "未命名页面",
    icon: page.icon,
    updatedAt: page.updated_at,
  };
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(source: string, terms: string[]) {
  return terms.some((term) => source.includes(term.toLowerCase()));
}

export function inferResearchKindFromRelationField(
  fieldName: string
): ResearchAssetKind | null {
  const text = normalizeText(fieldName);
  if (hasAny(text, ["company page", "公司"])) return "company";
  if (hasAny(text, ["report page", "related report", "报告"])) return "report";
  if (
    hasAny(text, [
      "meeting note",
      "related meeting",
      "transcript page",
      "会议",
      "电话会",
      "转录稿",
    ])
  ) {
    return "meeting";
  }
  if (hasAny(text, ["related memo", "memo", "备忘录"])) return "company";
  return null;
}

function sortByUpdatedAtDesc(a: Pick<ResearchAsset, "updatedAt">, b: Pick<ResearchAsset, "updatedAt">) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
