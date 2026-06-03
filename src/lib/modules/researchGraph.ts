import { normalizeRelationValue } from "@/lib/database/relationValues";
import type {
  Database,
  DatabaseField,
  DatabaseRow,
  Page,
} from "@/lib/utils/types";
import {
  RESEARCH_ASSET_KINDS,
  getExpectedRelationKinds,
  getResearchAssetKindLabel,
  getResearchModuleRoute,
  type ResearchAssetKind,
} from "@/lib/modules/researchWorkflow";

export type { ResearchAssetKind } from "@/lib/modules/researchWorkflow";
export { getResearchAssetKindLabel } from "@/lib/modules/researchWorkflow";

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

export interface ResearchGraphCompletionTarget {
  kind: ResearchAssetKind;
  kind_label: string;
  database_id: string;
  database_title: string;
  database_kind: ResearchAssetKind | null;
  database_kind_label: string | null;
  relation_field_names: string[];
  relation_field_labels: string[];
  reason: string;
}

export interface ResearchGraphCompletionAction {
  id: string;
  asset_id: string;
  asset_title: string;
  asset_kind: ResearchAssetKind;
  asset_kind_label: string;
  updated_at: string;
  target_database_id: string;
  target_database_title: string;
  target_database_kind: ResearchAssetKind | null;
  target_database_kind_label: string | null;
  relation_field_names: string[];
  relation_field_labels: string[];
  database_route: string;
  reason: string;
}

export interface ResearchGraphMissingCompletionTarget {
  kind: ResearchAssetKind;
  kind_label: string;
  unlinked_assets: number;
  recommended_module_route: string;
  reason: string;
}

export interface ResearchGraphCompletionPlan {
  targets: ResearchGraphCompletionTarget[];
  actions: ResearchGraphCompletionAction[];
  missing_targets: ResearchGraphMissingCompletionTarget[];
}

export interface ResearchGraphSchemaGap {
  id: string;
  database_id: string;
  database_title: string;
  database_kind: ResearchAssetKind;
  database_kind_label: string;
  missing_relation_kind: ResearchAssetKind;
  missing_relation_label: string;
  suggested_field_name: string;
  suggested_field_label: string;
  database_route: string;
  reason: string;
}

export interface ResearchGraphReport {
  format: "zhinote-research-graph-report";
  format_version: 1;
  report_status: "local-graph-summary";
  privacy_note: string;
  boundary: {
    reads_page_text_for_classification: boolean;
    includes_page_text: boolean;
    includes_database_row_values: boolean;
    includes_file_bytes: boolean;
    uploads_data: boolean;
    writes_workspace_data: boolean;
  };
  summary: {
    assets: number;
    connected_assets: number;
    relation_links: number;
    unlinked_assets: number;
    company: number;
    report: number;
    meeting: number;
    portfolio: number;
    databases: number;
    relation_fields: number;
    completion_actions: number;
    missing_completion_targets: number;
    schema_gaps: number;
  };
  assets: Array<{
    id: string;
    kind: ResearchAssetKind;
    kind_label: string;
    title: string;
    icon: string | null;
    updated_at: string;
    connected: boolean;
    relation_count: number;
  }>;
  relation_links: Array<{
    id: string;
    source_id: string;
    source_title: string;
    source_kind: ResearchAssetKind;
    source_kind_label: string;
    target_id: string;
    target_title: string;
    target_kind: ResearchAssetKind;
    target_kind_label: string;
    field_name: string;
    field_label: string;
    database_title: string;
  }>;
  unlinked_assets: Array<{
    id: string;
    kind: ResearchAssetKind;
    kind_label: string;
    title: string;
    updated_at: string;
  }>;
  database_surfaces: Array<{
    database_id: string;
    title: string;
    kind: ResearchAssetKind | null;
    kind_label: string | null;
    relation_fields: number;
    rows: number;
  }>;
  coverage: Array<{
    kind: ResearchAssetKind;
    label: string;
    assets: number;
    connected_assets: number;
    unlinked_assets: number;
    relation_links: number;
  }>;
  completion_plan: ResearchGraphCompletionPlan;
  schema_gaps: ResearchGraphSchemaGap[];
}

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

export function buildResearchGraphReport(
  graph: ResearchGraph,
  snapshots: ResearchDatabaseSnapshot[]
): ResearchGraphReport {
  const relationCounts = new Map<string, number>();
  for (const link of graph.relationLinks) {
    relationCounts.set(link.source.id, (relationCounts.get(link.source.id) ?? 0) + 1);
    relationCounts.set(link.target.id, (relationCounts.get(link.target.id) ?? 0) + 1);
  }

  const connectedAssetIds = new Set(relationCounts.keys());
  const databaseSurfaces = snapshots.map((snapshot) => {
    const kind = classifyResearchDatabase(snapshot.database);
    const relationFields = snapshot.fields.filter(
      (field) => field.field_type === "relation"
    );

    return {
      database_id: snapshot.database.id,
      title: snapshot.database.title,
      kind,
      kind_label: kind ? getResearchAssetKindLabel(kind) : null,
      relation_fields: relationFields.length,
      rows: snapshot.rows.length,
    };
  });

  const completionPlan = buildResearchGraphCompletionPlan(graph, snapshots);
  const schemaGaps = buildResearchGraphSchemaGaps(snapshots);

  return {
    format: "zhinote-research-graph-report",
    format_version: 1,
    report_status: "local-graph-summary",
    privacy_note:
      "This report is generated locally and excludes page bodies, database row values, uploaded file bytes, prompts, tokens, and cloud data.",
    boundary: {
      reads_page_text_for_classification: true,
      includes_page_text: false,
      includes_database_row_values: false,
      includes_file_bytes: false,
      uploads_data: false,
      writes_workspace_data: false,
    },
    summary: {
      assets: graph.assets.length,
      connected_assets: connectedAssetIds.size,
      relation_links: graph.relationLinks.length,
      unlinked_assets: graph.unlinkedAssets.length,
      company: graph.counts.company,
      report: graph.counts.report,
      meeting: graph.counts.meeting,
      portfolio: graph.counts.portfolio,
      databases: databaseSurfaces.length,
      relation_fields: databaseSurfaces.reduce(
        (total, surface) => total + surface.relation_fields,
        0
      ),
      completion_actions: completionPlan.actions.length,
      missing_completion_targets: completionPlan.missing_targets.length,
      schema_gaps: schemaGaps.length,
    },
    assets: graph.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      kind_label: getResearchAssetKindLabel(asset.kind),
      title: asset.title,
      icon: asset.icon,
      updated_at: asset.updatedAt,
      connected: connectedAssetIds.has(asset.id),
      relation_count: relationCounts.get(asset.id) ?? 0,
    })),
    relation_links: graph.relationLinks.map((link) => ({
      id: link.id,
      source_id: link.source.id,
      source_title: link.source.title,
      source_kind: link.source.kind,
      source_kind_label: getResearchAssetKindLabel(link.source.kind),
      target_id: link.target.id,
      target_title: link.target.title,
      target_kind: link.target.kind,
      target_kind_label: getResearchAssetKindLabel(link.target.kind),
      field_name: link.fieldName,
      field_label: getResearchRelationFieldLabel(link.fieldName),
      database_title: link.databaseTitle,
    })),
    unlinked_assets: graph.unlinkedAssets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      kind_label: getResearchAssetKindLabel(asset.kind),
      title: asset.title,
      updated_at: asset.updatedAt,
    })),
    database_surfaces: databaseSurfaces,
    coverage: RESEARCH_ASSET_KINDS.map((kind) => {
      const assets = graph.assets.filter((asset) => asset.kind === kind);
      return {
        kind,
        label: getResearchAssetKindLabel(kind),
        assets: assets.length,
        connected_assets: assets.filter((asset) => connectedAssetIds.has(asset.id))
          .length,
        unlinked_assets: graph.unlinkedAssets.filter((asset) => asset.kind === kind)
          .length,
        relation_links: graph.relationLinks.filter(
          (link) => link.source.kind === kind || link.target.kind === kind
        ).length,
      };
    }),
    completion_plan: completionPlan,
    schema_gaps: schemaGaps,
  };
}

export function buildResearchGraphCompletionPlan(
  graph: ResearchGraph,
  snapshots: ResearchDatabaseSnapshot[]
): ResearchGraphCompletionPlan {
  const targets = buildCompletionTargets(snapshots);
  const targetsByKind = new Map<ResearchAssetKind, ResearchGraphCompletionTarget[]>();
  for (const target of targets) {
    const current = targetsByKind.get(target.kind) ?? [];
    targetsByKind.set(target.kind, [...current, target]);
  }

  const actions: ResearchGraphCompletionAction[] = [];
  for (const asset of graph.unlinkedAssets) {
    const target = targetsByKind.get(asset.kind)?.[0];
    if (!target) continue;

    actions.push({
      id: `${asset.id}:${target.database_id}`,
      asset_id: asset.id,
      asset_title: asset.title,
      asset_kind: asset.kind,
      asset_kind_label: getResearchAssetKindLabel(asset.kind),
      updated_at: asset.updatedAt,
      target_database_id: target.database_id,
      target_database_title: target.database_title,
      target_database_kind: target.database_kind,
      target_database_kind_label: target.database_kind_label,
      relation_field_names: target.relation_field_names,
      relation_field_labels: target.relation_field_labels,
      database_route: buildDatabaseCompletionRoute(target.database_id, asset),
      reason: target.reason,
    });
  }

  const missingTargets = RESEARCH_ASSET_KINDS.map((kind) => {
    const unlinkedAssets = graph.unlinkedAssets.filter(
      (asset) => asset.kind === kind
    ).length;
    if (unlinkedAssets === 0 || targetsByKind.has(kind)) return null;

    return {
      kind,
      kind_label: getResearchAssetKindLabel(kind),
      unlinked_assets: unlinkedAssets,
      recommended_module_route: getResearchModuleRoute(kind),
      reason: `缺少可用于补全${getResearchAssetKindLabel(kind)}关系的本地跟踪表或 relation 字段。`,
    };
  }).filter(
    (target): target is ResearchGraphMissingCompletionTarget => Boolean(target)
  );

  return {
    targets,
    actions: actions.sort(sortCompletionActions),
    missing_targets: missingTargets,
  };
}

function buildCompletionTargets(
  snapshots: ResearchDatabaseSnapshot[]
): ResearchGraphCompletionTarget[] {
  return snapshots.flatMap((snapshot) => {
    const databaseKind = classifyResearchDatabase(snapshot.database);
    const relationFields = snapshot.fields.filter(
      (field) => field.field_type === "relation"
    );

    return RESEARCH_ASSET_KINDS.map((kind) => {
      const fieldsForKind = relationFields.filter(
        (field) => inferResearchKindFromRelationField(field.name) === kind
      );

      if (databaseKind !== kind && fieldsForKind.length === 0) return null;

      const fieldNames = fieldsForKind.map((field) => field.name);
      return {
        kind,
        kind_label: getResearchAssetKindLabel(kind),
        database_id: snapshot.database.id,
        database_title: snapshot.database.title,
        database_kind: databaseKind,
        database_kind_label: databaseKind
          ? getResearchAssetKindLabel(databaseKind)
          : null,
        relation_field_names: fieldNames,
        relation_field_labels: fieldNames.map(getResearchRelationFieldLabel),
        reason:
          databaseKind === kind
            ? `${getResearchAssetKindLabel(kind)}自己的跟踪表可以作为补全入口。`
            : `这个跟踪表已有指向${getResearchAssetKindLabel(kind)}的 relation 字段。`,
      };
    }).filter(
      (target): target is ResearchGraphCompletionTarget => Boolean(target)
    );
  });
}

export function buildResearchGraphSchemaGaps(
  snapshots: ResearchDatabaseSnapshot[]
): ResearchGraphSchemaGap[] {
  return snapshots.flatMap((snapshot) => {
    const databaseKind = classifyResearchDatabase(snapshot.database);
    if (!databaseKind) return [];

    const presentRelationKinds = new Set(
      snapshot.fields
        .filter((field) => field.field_type === "relation")
        .map((field) => inferResearchKindFromRelationField(field.name))
        .filter((kind): kind is ResearchAssetKind => Boolean(kind))
    );

    return getExpectedRelationKinds(databaseKind)
      .filter((kind) => !presentRelationKinds.has(kind))
      .map((missingKind) => {
        const suggestedFieldName = getSuggestedRelationFieldName(
          databaseKind,
          missingKind
        );

        return {
          id: `${snapshot.database.id}:${missingKind}`,
          database_id: snapshot.database.id,
          database_title: snapshot.database.title,
          database_kind: databaseKind,
          database_kind_label: getResearchAssetKindLabel(databaseKind),
          missing_relation_kind: missingKind,
          missing_relation_label: getResearchAssetKindLabel(missingKind),
          suggested_field_name: suggestedFieldName,
          suggested_field_label: getResearchRelationFieldLabel(suggestedFieldName),
          database_route: `/database/${snapshot.database.id}`,
          reason: `${getResearchAssetKindLabel(databaseKind)}跟踪表缺少指向${getResearchAssetKindLabel(missingKind)}的 relation 字段。`,
        };
      });
  });
}

function buildDatabaseCompletionRoute(databaseId: string, asset: ResearchAsset) {
  const params = new URLSearchParams({
    q: asset.title,
    focus: asset.id,
  });
  return `/database/${databaseId}?${params.toString()}`;
}

function sortCompletionActions(
  a: ResearchGraphCompletionAction,
  b: ResearchGraphCompletionAction
) {
  const kindDelta =
    RESEARCH_ASSET_KINDS.indexOf(a.asset_kind) -
    RESEARCH_ASSET_KINDS.indexOf(b.asset_kind);
  if (kindDelta !== 0) return kindDelta;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function getSuggestedRelationFieldName(
  sourceKind: ResearchAssetKind,
  targetKind: ResearchAssetKind
) {
  if (targetKind === "company") return "Company page";
  if (targetKind === "report") return "Related reports";
  if (targetKind === "meeting") return "Related meetings";
  if (targetKind === "portfolio") return "Related portfolio";
  return `${getResearchAssetKindLabel(sourceKind)} relation`;
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
