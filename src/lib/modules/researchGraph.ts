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

export interface ResearchGraphRelationHandoffStep {
  id: string;
  title: string;
  detail: string;
  route: string;
  action_label: string;
  workspace_effect:
    | "read-only-route"
    | "manual-review"
    | "manual-relation-value";
}

export interface ResearchGraphRelationHandoffPacket {
  id: string;
  asset_id: string;
  asset_title: string;
  asset_kind: ResearchAssetKind;
  asset_kind_label: string;
  source_page_route: string;
  target_database_id: string;
  target_database_title: string;
  target_database_kind: ResearchAssetKind | null;
  target_database_kind_label: string | null;
  relation_field_names: string[];
  relation_field_labels: string[];
  database_route: string;
  handoff_label: string;
  manual_relation_completion: true;
  review_steps: ResearchGraphRelationHandoffStep[];
  boundary: {
    local_only: true;
    reads_page_text: false;
    includes_page_text: false;
    reads_database_rows: false;
    includes_database_row_values: false;
    reads_file_bytes: false;
    includes_file_bytes: false;
    includes_holdings: false;
    includes_trading_plans: false;
    auto_writes_relation_values: false;
    creates_schema_fields: false;
    uploads_data: false;
  };
}

export type ResearchGraphPriorityLevel = "high" | "medium" | "low";

export interface ResearchGraphPriorityItem {
  id: string;
  asset_id: string;
  asset_title: string;
  asset_kind: ResearchAssetKind;
  asset_kind_label: string;
  priority: ResearchGraphPriorityLevel;
  updated_at: string;
  recommended_action: "open-page" | "complete-relation" | "create-target";
  action_label: string;
  action_route: string;
  target_database_title: string | null;
  relation_field_labels: string[];
  reason: string;
  privacy_boundary: string;
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
    priority_queue_items: number;
    high_priority_unlinked_assets: number;
    actionable_priority_items: number;
    relation_handoff_packets: number;
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
  health_summary: ResearchGraphHealthSummary[];
  priority_queue: ResearchGraphPriorityItem[];
  relation_handoff_packets: ResearchGraphRelationHandoffPacket[];
  completion_plan: ResearchGraphCompletionPlan;
  schema_gaps: ResearchGraphSchemaGap[];
}

export type ResearchGraphHealthStatus =
  | "ready"
  | "needs-assets"
  | "needs-links"
  | "needs-schema"
  | "needs-tracker";

export interface ResearchGraphHealthSummary {
  kind: ResearchAssetKind;
  kind_label: string;
  module_route: string;
  status: ResearchGraphHealthStatus;
  assets: number;
  connected_assets: number;
  connection_rate: number;
  unlinked_assets: number;
  relation_links: number;
  tracker_databases: number;
  required_relation_kinds: ResearchAssetKind[];
  required_relation_labels: string[];
  present_relation_kinds: ResearchAssetKind[];
  present_relation_labels: string[];
  missing_relation_kinds: ResearchAssetKind[];
  missing_relation_labels: string[];
  schema_gaps: number;
  completion_actions: number;
  next_action: {
    label: string;
    route: string;
    writes_workspace_data: boolean;
  };
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
  const relationHandoffPackets =
    buildResearchGraphRelationHandoffPackets(completionPlan);
  const priorityQueue = buildResearchGraphPriorityQueue(
    graph,
    completionPlan
  );
  const coverage = RESEARCH_ASSET_KINDS.map((kind) => {
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
  });
  const healthSummary = buildResearchGraphHealthSummary(
    coverage,
    snapshots,
    completionPlan,
    schemaGaps
  );

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
      priority_queue_items: priorityQueue.length,
      high_priority_unlinked_assets: priorityQueue.filter(
        (item) => item.priority === "high"
      ).length,
      actionable_priority_items: priorityQueue.filter(
        (item) => item.recommended_action === "complete-relation"
      ).length,
      relation_handoff_packets: relationHandoffPackets.length,
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
    coverage,
    health_summary: healthSummary,
    priority_queue: priorityQueue,
    relation_handoff_packets: relationHandoffPackets,
    completion_plan: completionPlan,
    schema_gaps: schemaGaps,
  };
}

export function buildResearchGraphHealthSummary(
  coverage: ResearchGraphReport["coverage"],
  snapshots: ResearchDatabaseSnapshot[],
  completionPlan: ResearchGraphCompletionPlan,
  schemaGaps: ResearchGraphSchemaGap[]
): ResearchGraphHealthSummary[] {
  return RESEARCH_ASSET_KINDS.map((kind) => {
    const item = coverage.find((coverageItem) => coverageItem.kind === kind);
    const trackerDatabases = snapshots.filter(
      (snapshot) => classifyResearchDatabase(snapshot.database) === kind
    );
    const requiredRelationKinds = getExpectedRelationKinds(kind);
    const missingRelationKinds = getMissingRelationKindsForHealth(
      kind,
      trackerDatabases.length,
      requiredRelationKinds,
      schemaGaps
    );
    const presentRelationKinds = requiredRelationKinds.filter(
      (relationKind) => !missingRelationKinds.includes(relationKind)
    );
    const schemaGapCount = schemaGaps.filter(
      (gap) => gap.database_kind === kind
    ).length;
    const completionActions = completionPlan.actions.filter(
      (action) => action.asset_kind === kind
    );
    const connectionRate = item?.assets
      ? Math.round((item.connected_assets / item.assets) * 100)
      : 0;
    const status = getResearchGraphHealthStatus({
      assets: item?.assets ?? 0,
      unlinkedAssets: item?.unlinked_assets ?? 0,
      trackerDatabases: trackerDatabases.length,
      missingRelationKinds: missingRelationKinds.length,
    });

    return {
      kind,
      kind_label: getResearchAssetKindLabel(kind),
      module_route: getResearchModuleRoute(kind),
      status,
      assets: item?.assets ?? 0,
      connected_assets: item?.connected_assets ?? 0,
      connection_rate: connectionRate,
      unlinked_assets: item?.unlinked_assets ?? 0,
      relation_links: item?.relation_links ?? 0,
      tracker_databases: trackerDatabases.length,
      required_relation_kinds: requiredRelationKinds,
      required_relation_labels: requiredRelationKinds.map(getResearchAssetKindLabel),
      present_relation_kinds: presentRelationKinds,
      present_relation_labels: presentRelationKinds.map(getResearchAssetKindLabel),
      missing_relation_kinds: missingRelationKinds,
      missing_relation_labels: missingRelationKinds.map(getResearchAssetKindLabel),
      schema_gaps:
        trackerDatabases.length === 0
          ? requiredRelationKinds.length
          : schemaGapCount,
      completion_actions: completionActions.length,
      next_action: getResearchGraphHealthNextAction(
        kind,
        trackerDatabases[0]?.database.id ?? null,
        missingRelationKinds.length,
        completionActions[0] ?? null,
        item?.assets ?? 0
      ),
    };
  });
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

export function buildResearchGraphRelationHandoffPackets(
  completionPlan: ResearchGraphCompletionPlan
): ResearchGraphRelationHandoffPacket[] {
  return completionPlan.actions.map((action) => {
    const sourcePageRoute = `/page/${action.asset_id}`;
    const relationLabels = action.relation_field_labels.length
      ? action.relation_field_labels.join(" / ")
      : "目标 relation 字段";

    return {
      id: `${action.id}:relation-handoff`,
      asset_id: action.asset_id,
      asset_title: action.asset_title,
      asset_kind: action.asset_kind,
      asset_kind_label: action.asset_kind_label,
      source_page_route: sourcePageRoute,
      target_database_id: action.target_database_id,
      target_database_title: action.target_database_title,
      target_database_kind: action.target_database_kind,
      target_database_kind_label: action.target_database_kind_label,
      relation_field_names: action.relation_field_names,
      relation_field_labels: action.relation_field_labels,
      database_route: action.database_route,
      handoff_label: `${action.asset_kind_label} → ${action.target_database_title}`,
      manual_relation_completion: true,
      review_steps: [
        {
          id: "review-source-asset",
          title: "确认资产",
          detail: `打开${action.asset_kind_label}页面，确认它确实需要进入跨模块 relation。`,
          route: sourcePageRoute,
          action_label: "打开资产页",
          workspace_effect: "manual-review",
        },
        {
          id: "open-target-database",
          title: "打开目标表",
          detail: `进入「${action.target_database_title}」，用页面标题搜索并定位要补关系的 row。`,
          route: action.database_route,
          action_label: "打开目标库",
          workspace_effect: "read-only-route",
        },
        {
          id: "check-relation-fields",
          title: "确认字段",
          detail: `优先检查 ${relationLabels}，只选择一个最准确的 relation 字段处理。`,
          route: action.database_route,
          action_label: "检查字段",
          workspace_effect: "manual-review",
        },
        {
          id: "manual-relation-value",
          title: "手动补 relation",
          detail:
            "在目标 row 里手动加入页面 relation，完成后回到研究图谱复核连接是否出现。",
          route: action.database_route,
          action_label: "手动补关系",
          workspace_effect: "manual-relation-value",
        },
      ],
      boundary: {
        local_only: true,
        reads_page_text: false,
        includes_page_text: false,
        reads_database_rows: false,
        includes_database_row_values: false,
        reads_file_bytes: false,
        includes_file_bytes: false,
        includes_holdings: false,
        includes_trading_plans: false,
        auto_writes_relation_values: false,
        creates_schema_fields: false,
        uploads_data: false,
      },
    };
  });
}

export function buildResearchGraphPriorityQueue(
  graph: ResearchGraph,
  completionPlan: ResearchGraphCompletionPlan
): ResearchGraphPriorityItem[] {
  const actionByAssetId = new Map(
    completionPlan.actions.map((action) => [action.asset_id, action])
  );
  const missingTargetByKind = new Map(
    completionPlan.missing_targets.map((target) => [target.kind, target])
  );

  return graph.unlinkedAssets
    .map((asset) => {
      const action = actionByAssetId.get(asset.id) ?? null;
      const missingTarget = missingTargetByKind.get(asset.kind) ?? null;
      const priority = getResearchGraphPriority(asset.kind, action, missingTarget);

      if (action) {
        return {
          id: `${asset.id}:priority`,
          asset_id: asset.id,
          asset_title: asset.title,
          asset_kind: asset.kind,
          asset_kind_label: getResearchAssetKindLabel(asset.kind),
          priority,
          updated_at: asset.updatedAt,
          recommended_action: "complete-relation",
          action_label: "补 relation 值",
          action_route: action.database_route,
          target_database_title: action.target_database_title,
          relation_field_labels: action.relation_field_labels,
          reason: `${getResearchAssetKindLabel(asset.kind)}已经有可用跟踪表或 relation 字段，下一步是补具体 relation 值。`,
          privacy_boundary:
            "只打开本地页面或目标数据库，不自动写 relation，不导出页面正文、数据库行值、文件 bytes、token 或凭证。",
        } satisfies ResearchGraphPriorityItem;
      }

      if (missingTarget) {
        return {
          id: `${asset.id}:priority`,
          asset_id: asset.id,
          asset_title: asset.title,
          asset_kind: asset.kind,
          asset_kind_label: getResearchAssetKindLabel(asset.kind),
          priority,
          updated_at: asset.updatedAt,
          recommended_action: "create-target",
          action_label: "补跟踪入口",
          action_route: missingTarget.recommended_module_route,
          target_database_title: null,
          relation_field_labels: [],
          reason: missingTarget.reason,
          privacy_boundary:
            "只打开对应模块创建本地跟踪入口，不读取页面正文、不写 relation 值、不上传或同步。",
        } satisfies ResearchGraphPriorityItem;
      }

      return {
        id: `${asset.id}:priority`,
        asset_id: asset.id,
        asset_title: asset.title,
        asset_kind: asset.kind,
        asset_kind_label: getResearchAssetKindLabel(asset.kind),
        priority,
        updated_at: asset.updatedAt,
        recommended_action: "open-page",
        action_label: "打开页面复核",
        action_route: `/page/${asset.id}`,
        target_database_title: null,
        relation_field_labels: [],
        reason:
          "这个资产尚未进入可执行补关系队列，先打开页面确认分类和需要关联的研究上下文。",
        privacy_boundary:
          "只打开本地页面，不导出页面正文、数据库行值、文件 bytes、token 或凭证。",
      } satisfies ResearchGraphPriorityItem;
    })
    .sort(sortPriorityItems);
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
    handoff: "research-graph",
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

function getResearchGraphPriority(
  kind: ResearchAssetKind,
  action: ResearchGraphCompletionAction | null,
  missingTarget: ResearchGraphMissingCompletionTarget | null
): ResearchGraphPriorityLevel {
  if (action && (kind === "company" || kind === "report")) return "high";
  if (missingTarget && (kind === "company" || kind === "report")) return "high";
  if (action || missingTarget) return "medium";
  return "low";
}

function sortPriorityItems(
  a: ResearchGraphPriorityItem,
  b: ResearchGraphPriorityItem
) {
  const priorityDelta =
    getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const actionDelta =
    getRecommendedActionWeight(b.recommended_action) -
    getRecommendedActionWeight(a.recommended_action);
  if (actionDelta !== 0) return actionDelta;

  const kindDelta =
    RESEARCH_ASSET_KINDS.indexOf(a.asset_kind) -
    RESEARCH_ASSET_KINDS.indexOf(b.asset_kind);
  if (kindDelta !== 0) return kindDelta;

  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function getPriorityWeight(priority: ResearchGraphPriorityLevel) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function getRecommendedActionWeight(
  action: ResearchGraphPriorityItem["recommended_action"]
) {
  if (action === "complete-relation") return 3;
  if (action === "create-target") return 2;
  return 1;
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

function getMissingRelationKindsForHealth(
  kind: ResearchAssetKind,
  trackerDatabases: number,
  requiredRelationKinds: ResearchAssetKind[],
  schemaGaps: ResearchGraphSchemaGap[]
) {
  if (trackerDatabases === 0) return requiredRelationKinds;

  const missingKinds = new Set(
    schemaGaps
      .filter((gap) => gap.database_kind === kind)
      .map((gap) => gap.missing_relation_kind)
  );
  return requiredRelationKinds.filter((relationKind) =>
    missingKinds.has(relationKind)
  );
}

function getResearchGraphHealthStatus({
  assets,
  unlinkedAssets,
  trackerDatabases,
  missingRelationKinds,
}: {
  assets: number;
  unlinkedAssets: number;
  trackerDatabases: number;
  missingRelationKinds: number;
}): ResearchGraphHealthStatus {
  if (trackerDatabases === 0) return "needs-tracker";
  if (missingRelationKinds > 0) return "needs-schema";
  if (assets === 0) return "needs-assets";
  if (unlinkedAssets > 0) return "needs-links";
  return "ready";
}

function getResearchGraphHealthNextAction(
  kind: ResearchAssetKind,
  trackerDatabaseId: string | null,
  missingRelationKinds: number,
  completionAction: ResearchGraphCompletionAction | null,
  assets: number
) {
  const kindLabel = getResearchAssetKindLabel(kind);

  if (!trackerDatabaseId) {
    return {
      label: `创建${kindLabel}跟踪表`,
      route: getResearchModuleRoute(kind),
      writes_workspace_data: false,
    };
  }

  if (missingRelationKinds > 0) {
    return {
      label: "补 relation 字段",
      route: `/database/${trackerDatabaseId}`,
      writes_workspace_data: true,
    };
  }

  if (completionAction) {
    return {
      label: "补 relation 值",
      route: completionAction.database_route,
      writes_workspace_data: false,
    };
  }

  if (assets === 0) {
    return {
      label: `创建${kindLabel}资产`,
      route: getResearchModuleRoute(kind),
      writes_workspace_data: false,
    };
  }

  return {
    label: "继续维护",
    route: getResearchModuleRoute(kind),
    writes_workspace_data: false,
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
