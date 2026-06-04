import {
  buildDatabaseTemplateCatalogReport,
  type DatabaseTemplateCatalogGroupId,
} from "@/lib/database/databaseTemplateCatalog";
import type { DatabaseModuleSnapshot } from "@/lib/database/databaseModuleDashboard";
import type { DatabaseField } from "@/lib/utils/types";

export type DatabaseTemplateRowReadinessStatus =
  | "ready"
  | "partial"
  | "needs-schema";

export type DatabaseTemplateRowGateStatus =
  | "ready"
  | "manual-confirmation"
  | "planned";

export interface DatabaseTemplateRowFieldRequirement {
  id: string;
  label: string;
  field_types: string[];
  candidate_field_names: string[];
  minimum_count: number;
  reason: string;
}

export interface DatabaseTemplateRowGroupRequirement {
  group_id: DatabaseTemplateCatalogGroupId;
  group_label: string;
  recommended_database: string;
  template_titles: string[];
  required_field_groups: DatabaseTemplateRowFieldRequirement[];
  optional_field_groups: DatabaseTemplateRowFieldRequirement[];
  starter_value_hints: string[];
}

export interface DatabaseTemplateRowReadinessItem {
  id: string;
  database_id: string;
  database_title: string;
  group_id: DatabaseTemplateCatalogGroupId;
  group_label: string;
  status: DatabaseTemplateRowReadinessStatus;
  readiness_score: number;
  row_count: number;
  field_count: number;
  template_rows_available: number;
  required_field_groups: number;
  matched_required_field_groups: number;
  missing_required_field_groups: string[];
  missing_required_field_types: string[];
  optional_field_groups: number;
  matched_optional_field_groups: number;
  next_action: string;
  starter_value_hints: string[];
  row_write_boundary: string;
}

export interface DatabaseTemplateRowReadinessDatabase {
  database_id: string;
  title: string;
  row_count: number;
  field_count: number;
  recommended_group_id: DatabaseTemplateCatalogGroupId | null;
  recommended_group_label: string | null;
  recommended_status: DatabaseTemplateRowReadinessStatus | null;
  ready_group_ids: DatabaseTemplateCatalogGroupId[];
  partial_group_ids: DatabaseTemplateCatalogGroupId[];
  needs_schema_group_ids: DatabaseTemplateCatalogGroupId[];
  missing_required_field_groups: string[];
  next_action: string;
}

export interface DatabaseTemplateRowGate {
  id: string;
  title: string;
  status: DatabaseTemplateRowGateStatus;
  evidence: string;
  required_action: string;
}

export interface DatabaseTemplateRowReadinessReport {
  format: "zhinote-database-template-row-readiness";
  format_version: 1;
  report_status: "local-template-row-schema-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_template_metadata: true;
    reads_database_schema: true;
    reads_database_views: true;
    reads_database_row_count: true;
    reads_database_rows: false;
    reads_database_row_values: false;
    reads_page_text: false;
    includes_database_field_names: false;
    includes_database_row_values: false;
    includes_page_text: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    databases: number;
    template_groups: number;
    template_rows: number;
    readiness_items: number;
    ready_items: number;
    partial_items: number;
    needs_schema_items: number;
    ready_databases: number;
    partial_databases: number;
    needs_schema_databases: number;
    missing_relation_requirements: number;
    missing_status_requirements: number;
    missing_date_requirements: number;
    missing_number_requirements: number;
  };
  requirements: DatabaseTemplateRowGroupRequirement[];
  gates: DatabaseTemplateRowGate[];
  databases: DatabaseTemplateRowReadinessDatabase[];
  items: DatabaseTemplateRowReadinessItem[];
}

const TEMPLATE_ROW_REQUIREMENTS: DatabaseTemplateRowGroupRequirement[] = [
  {
    group_id: "company",
    group_label: "公司研究",
    recommended_database: "公司研究跟踪表",
    template_titles: ["公司研究", "投资备忘录", "业绩复盘", "估值假设", "关键指标看板"],
    required_field_groups: [
      fieldRequirement(
        "company-relation",
        "公司主页 relation",
        ["relation"],
        ["Company page", "公司页面", "公司主页"],
        1,
        "模板行需要能连接回公司主页。"
      ),
      fieldRequirement(
        "research-status",
        "研究状态",
        ["status", "select"],
        ["Status", "Stage", "Coverage status", "研究状态"],
        1,
        "公司研究需要状态流转，方便看板和复盘。"
      ),
      fieldRequirement(
        "research-notes",
        "研究文本字段",
        ["text"],
        ["Thesis", "Valuation assumptions", "Key metrics", "投资假设"],
        2,
        "公司模板通常需要承载 thesis、估值假设或关键指标摘要。"
      ),
    ],
    optional_field_groups: [
      fieldRequirement(
        "catalyst-date",
        "催化剂日期",
        ["date"],
        ["Next catalyst", "Catalyst date", "下个催化剂"],
        1,
        "日期字段可以驱动日历和时间线。"
      ),
      fieldRequirement(
        "research-relations",
        "报告/会议 relation",
        ["relation"],
        ["Related reports", "Related meetings", "相关报告", "相关会议"],
        2,
        "多 relation 字段能把公司、报告和会议串起来。"
      ),
    ],
    starter_value_hints: [
      "Status: Researching",
      "Rating: Neutral",
      "Next catalyst: manual date",
    ],
  },
  {
    group_id: "report",
    group_label: "报告库",
    recommended_database: "报告库跟踪表",
    template_titles: ["研究报告"],
    required_field_groups: [
      fieldRequirement(
        "report-relation",
        "报告页 relation",
        ["relation"],
        ["Report page", "报告页面", "报告页"],
        1,
        "模板行需要能连接到本地报告 page 或文件预览 page。"
      ),
      fieldRequirement(
        "report-format",
        "报告格式",
        ["select", "status"],
        ["Format", "File type", "文件格式", "格式"],
        1,
        "HTML、Markdown、PDF、Excel、Word 等报告需要格式字段。"
      ),
      fieldRequirement(
        "review-status",
        "复核状态",
        ["status", "select"],
        ["Status", "Review status", "复核状态"],
        1,
        "报告入库需要 Inbox、Reviewing、Summarized、Linked 等状态。"
      ),
    ],
    optional_field_groups: [
      fieldRequirement(
        "report-date",
        "报告日期",
        ["date"],
        ["Report date", "Published date", "报告日期"],
        1,
        "报告日期可驱动近期报告和时间线视图。"
      ),
      fieldRequirement(
        "report-context",
        "公司/会议 relation",
        ["relation"],
        ["Company page", "Related meetings", "Related memo", "公司页面"],
        2,
        "报告应能连接公司、会议和 memo。"
      ),
    ],
    starter_value_hints: [
      "Format: HTML or Markdown",
      "Status: Inbox",
      "Report date: manual date",
    ],
  },
  {
    group_id: "meeting",
    group_label: "会议与电话会",
    recommended_database: "会议跟踪表",
    template_titles: ["会议纪要", "会议转录稿", "会议行动项"],
    required_field_groups: [
      fieldRequirement(
        "meeting-date",
        "会议日期",
        ["date"],
        ["Date", "Meeting date", "会议日期"],
        1,
        "会议模板行需要日期字段，方便日历、时间线和复盘。"
      ),
      fieldRequirement(
        "meeting-status",
        "会议状态",
        ["status", "select"],
        ["Status", "Follow-up status", "会议状态"],
        1,
        "会议后续处理需要状态流转。"
      ),
      fieldRequirement(
        "meeting-relations",
        "纪要/公司 relation",
        ["relation"],
        ["Meeting note", "Company page", "Transcript page", "会议纪要", "公司页面"],
        2,
        "会议模板行需要连接纪要、公司和 transcript 页面。"
      ),
    ],
    optional_field_groups: [
      fieldRequirement(
        "meeting-type",
        "会议类型",
        ["select", "status"],
        ["Type", "Platform", "会议类型", "平台"],
        1,
        "类型和平台字段方便筛选管理层电话会、业绩会或专家电话会。"
      ),
      fieldRequirement(
        "meeting-actions",
        "行动项文本",
        ["text", "checkbox"],
        ["Action items", "Follow-up needed", "行动项"],
        1,
        "行动项字段能承接会议后的研究任务。"
      ),
    ],
    starter_value_hints: [
      "Status: Notes to process",
      "Type: Management call",
      "Follow-up needed: false",
    ],
  },
  {
    group_id: "portfolio",
    group_label: "组合与观察名单",
    recommended_database: "组合跟踪表",
    template_titles: ["持仓备忘录", "观察名单", "催化剂与风险复盘"],
    required_field_groups: [
      fieldRequirement(
        "portfolio-status",
        "组合状态",
        ["status", "select"],
        ["Status", "Portfolio role", "Direction", "组合状态"],
        2,
        "组合模板需要状态、角色、方向或确信度字段。"
      ),
      fieldRequirement(
        "portfolio-relations",
        "研究 relation",
        ["relation"],
        ["Company page", "Related memo", "Related reports", "Related meetings"],
        2,
        "组合行需要连接回公司、memo、报告和会议。"
      ),
      fieldRequirement(
        "portfolio-sizing",
        "仓位/价格数字字段",
        ["number"],
        ["Target weight", "Current weight", "Entry price", "Target price"],
        2,
        "组合模板需要数字字段承载仓位、价格或情景假设。"
      ),
    ],
    optional_field_groups: [
      fieldRequirement(
        "portfolio-catalyst",
        "下个催化剂",
        ["date"],
        ["Next catalyst", "Review date", "下次复盘"],
        1,
        "日期字段可以驱动催化剂和复盘时间线。"
      ),
      fieldRequirement(
        "portfolio-thesis",
        "投资假设/风险文本",
        ["text"],
        ["Thesis", "Risk notes", "投资假设", "风险笔记"],
        2,
        "文本字段承载 thesis 和风险复盘摘要。"
      ),
    ],
    starter_value_hints: [
      "Status: Watchlist",
      "Conviction: Review",
      "Direction: Long or Neutral",
    ],
  },
];

export function buildDatabaseTemplateRowReadinessReport(
  snapshots: DatabaseModuleSnapshot[]
): DatabaseTemplateRowReadinessReport {
  const catalog = buildDatabaseTemplateCatalogReport();
  const requirements = TEMPLATE_ROW_REQUIREMENTS.map((requirement) => {
    const group = catalog.groups.find((item) => item.id === requirement.group_id);
    return {
      ...requirement,
      template_titles: group?.template_titles ?? requirement.template_titles,
    };
  });
  const items = snapshots.flatMap((snapshot) =>
    requirements.map((requirement) => buildReadinessItem(snapshot, requirement))
  );
  const databases = snapshots.map((snapshot) =>
    buildDatabaseSummary(snapshot, items)
  );

  return {
    format: "zhinote-database-template-row-readiness",
    format_version: 1,
    report_status: "local-template-row-schema-only",
    privacy_note:
      "Generated locally from template metadata, database field types, view metadata, and row counts. It does not include field names, database row values, page body text, file bytes, holdings, trading plans, cloud data, or AI prompts.",
    boundary: {
      local_report_only: true,
      reads_template_metadata: true,
      reads_database_schema: true,
      reads_database_views: true,
      reads_database_row_count: true,
      reads_database_rows: false,
      reads_database_row_values: false,
      reads_page_text: false,
      includes_database_field_names: false,
      includes_database_row_values: false,
      includes_page_text: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: summarizeTemplateRows(snapshots, requirements, items, databases),
    requirements,
    gates: buildTemplateRowGates(snapshots, items, databases),
    databases,
    items,
  };
}

function fieldRequirement(
  id: string,
  label: string,
  fieldTypes: string[],
  candidateFieldNames: string[],
  minimumCount: number,
  reason: string
): DatabaseTemplateRowFieldRequirement {
  return {
    id,
    label,
    field_types: fieldTypes,
    candidate_field_names: candidateFieldNames,
    minimum_count: minimumCount,
    reason,
  };
}

function buildReadinessItem(
  snapshot: DatabaseModuleSnapshot,
  requirement: DatabaseTemplateRowGroupRequirement
): DatabaseTemplateRowReadinessItem {
  const requiredMatches = requirement.required_field_groups.map((fieldGroup) =>
    requirementMatch(snapshot.fields, fieldGroup)
  );
  const optionalMatches = requirement.optional_field_groups.map((fieldGroup) =>
    requirementMatch(snapshot.fields, fieldGroup)
  );
  const matchedRequired = requiredMatches.filter((match) => match.matched).length;
  const matchedOptional = optionalMatches.filter((match) => match.matched).length;
  const missingRequired = requiredMatches.filter((match) => !match.matched);
  const status = getTemplateRowStatus(
    requirement.required_field_groups.length,
    matchedRequired
  );
  const readinessScore = scoreTemplateRowReadiness({
    requiredTotal: requirement.required_field_groups.length,
    matchedRequired,
    optionalTotal: requirement.optional_field_groups.length,
    matchedOptional,
    titleAffinity: getTitleAffinityScore(snapshot, requirement.group_id),
  });

  return {
    id: `${snapshot.database.id}:${requirement.group_id}`,
    database_id: snapshot.database.id,
    database_title: snapshot.database.title || "未命名数据库",
    group_id: requirement.group_id,
    group_label: requirement.group_label,
    status,
    readiness_score: readinessScore,
    row_count: snapshot.rowCount,
    field_count: snapshot.fields.length,
    template_rows_available: requirement.template_titles.length,
    required_field_groups: requirement.required_field_groups.length,
    matched_required_field_groups: matchedRequired,
    missing_required_field_groups: missingRequired.map((match) => match.label),
    missing_required_field_types: Array.from(
      new Set(missingRequired.flatMap((match) => match.fieldTypes))
    ),
    optional_field_groups: requirement.optional_field_groups.length,
    matched_optional_field_groups: matchedOptional,
    next_action: getTemplateRowNextAction(status, missingRequired),
    starter_value_hints: requirement.starter_value_hints,
    row_write_boundary:
      "Template-row creation still happens only after the user clicks inside a database page; this readiness report does not create pages or rows.",
  };
}

function buildDatabaseSummary(
  snapshot: DatabaseModuleSnapshot,
  allItems: DatabaseTemplateRowReadinessItem[]
): DatabaseTemplateRowReadinessDatabase {
  const items = allItems
    .filter((item) => item.database_id === snapshot.database.id)
    .sort((a, b) => {
      if (b.readiness_score !== a.readiness_score) {
        return b.readiness_score - a.readiness_score;
      }
      return a.group_label.localeCompare(b.group_label);
    });
  const recommended = items[0] ?? null;
  const missingGroups = recommended?.missing_required_field_groups ?? [];

  return {
    database_id: snapshot.database.id,
    title: snapshot.database.title || "未命名数据库",
    row_count: snapshot.rowCount,
    field_count: snapshot.fields.length,
    recommended_group_id: recommended?.group_id ?? null,
    recommended_group_label: recommended?.group_label ?? null,
    recommended_status: recommended?.status ?? null,
    ready_group_ids: items
      .filter((item) => item.status === "ready")
      .map((item) => item.group_id),
    partial_group_ids: items
      .filter((item) => item.status === "partial")
      .map((item) => item.group_id),
    needs_schema_group_ids: items
      .filter((item) => item.status === "needs-schema")
      .map((item) => item.group_id),
    missing_required_field_groups: missingGroups,
    next_action: recommended
      ? recommended.next_action
      : "先创建一个公司、报告、会议或组合 tracker 数据库。",
  };
}

function buildTemplateRowGates(
  snapshots: DatabaseModuleSnapshot[],
  items: DatabaseTemplateRowReadinessItem[],
  databases: DatabaseTemplateRowReadinessDatabase[]
): DatabaseTemplateRowGate[] {
  const readyItems = items.filter((item) => item.status === "ready").length;
  const partialItems = items.filter((item) => item.status === "partial").length;
  const relationReady = items.filter(
    (item) =>
      item.status === "ready" &&
      item.group_id !== "report" &&
      !item.missing_required_field_types.includes("relation")
  ).length;
  const recommendedReady = databases.filter(
    (database) => database.recommended_status === "ready"
  ).length;

  return [
    {
      id: "template-row-schema-map",
      title: "模板行字段适配图",
      status: snapshots.length > 0 ? "ready" : "planned",
      evidence:
        snapshots.length > 0
          ? `${snapshots.length} 个数据库已按公司、报告、会议、组合模板检查字段适配。`
          : "还没有本地数据库可以检查模板行适配。",
      required_action:
        "新增 tracker 模板时，同步补 required field groups，避免模板行只生成空 page。",
    },
    {
      id: "template-row-ready-groups",
      title: "可直接使用的模板组",
      status: readyItems > 0 ? "ready" : partialItems > 0 ? "manual-confirmation" : "planned",
      evidence: `${readyItems} 个数据库/模板组组合已就绪，${partialItems} 个组合只差少量字段。`,
      required_action:
        "优先把最常用数据库补到 ready，再在具体数据库页手动创建模板行。",
    },
    {
      id: "relation-backed-templates",
      title: "Relation 支撑",
      status: relationReady > 0 ? "ready" : "planned",
      evidence: `${relationReady} 个 ready 模板组具备 relation 支撑。`,
      required_action:
        "公司、会议和组合模板应优先补 relation 字段，再补状态和日期字段。",
    },
    {
      id: "recommended-database-fit",
      title: "推荐数据库匹配",
      status: recommendedReady > 0 ? "ready" : "manual-confirmation",
      evidence: `${recommendedReady} 个数据库的推荐模板组已经 ready。`,
      required_action:
        "打开未 ready 的数据库，按推荐缺口补字段，再使用 + 模板行。",
    },
    {
      id: "local-row-write-boundary",
      title: "本地写入边界",
      status: "manual-confirmation",
      evidence: "Readiness 报告不写入；真正创建模板行仍由数据库页面的用户点击触发。",
      required_action:
        "模板行会创建本地 row/page；未来批量模板写入必须继续保留显式确认。",
    },
  ];
}

function summarizeTemplateRows(
  snapshots: DatabaseModuleSnapshot[],
  requirements: DatabaseTemplateRowGroupRequirement[],
  items: DatabaseTemplateRowReadinessItem[],
  databases: DatabaseTemplateRowReadinessDatabase[]
) {
  const readyItems = items.filter((item) => item.status === "ready");
  const partialItems = items.filter((item) => item.status === "partial");
  const needsSchemaItems = items.filter((item) => item.status === "needs-schema");

  return {
    databases: snapshots.length,
    template_groups: requirements.length,
    template_rows: requirements.reduce(
      (sum, requirement) => sum + requirement.template_titles.length,
      0
    ),
    readiness_items: items.length,
    ready_items: readyItems.length,
    partial_items: partialItems.length,
    needs_schema_items: needsSchemaItems.length,
    ready_databases: databases.filter(
      (database) => database.recommended_status === "ready"
    ).length,
    partial_databases: databases.filter(
      (database) => database.recommended_status === "partial"
    ).length,
    needs_schema_databases: databases.filter(
      (database) => database.recommended_status === "needs-schema"
    ).length,
    missing_relation_requirements: countMissingType(items, "relation"),
    missing_status_requirements: countMissingType(items, "status"),
    missing_date_requirements: countMissingType(items, "date"),
    missing_number_requirements: countMissingType(items, "number"),
  };
}

function requirementMatch(
  fields: DatabaseField[],
  requirement: DatabaseTemplateRowFieldRequirement
) {
  const count = fields.filter((field) => matchesRequirement(field, requirement))
    .length;

  return {
    label: requirement.label,
    fieldTypes: requirement.field_types,
    matched: count >= requirement.minimum_count,
  };
}

function matchesRequirement(
  field: DatabaseField,
  requirement: DatabaseTemplateRowFieldRequirement
) {
  if (requirement.field_types.includes(field.field_type)) {
    return true;
  }

  const normalizedName = normalizeText(field.name);
  return requirement.candidate_field_names.some((candidate) =>
    normalizedName.includes(normalizeText(candidate))
  );
}

function getTemplateRowStatus(
  requiredTotal: number,
  matchedRequired: number
): DatabaseTemplateRowReadinessStatus {
  if (requiredTotal === matchedRequired) {
    return "ready";
  }
  if (matchedRequired >= Math.max(1, requiredTotal - 1)) {
    return "partial";
  }
  return "needs-schema";
}

function scoreTemplateRowReadiness(input: {
  requiredTotal: number;
  matchedRequired: number;
  optionalTotal: number;
  matchedOptional: number;
  titleAffinity: number;
}) {
  const requiredScore =
    input.requiredTotal > 0
      ? (input.matchedRequired / input.requiredTotal) * 75
      : 75;
  const optionalScore =
    input.optionalTotal > 0 ? (input.matchedOptional / input.optionalTotal) * 15 : 15;
  return Math.min(100, Math.round(requiredScore + optionalScore + input.titleAffinity));
}

function getTitleAffinityScore(
  snapshot: DatabaseModuleSnapshot,
  groupId: DatabaseTemplateCatalogGroupId
) {
  const haystack = normalizeText(
    `${snapshot.database.title} ${snapshot.database.description ?? ""}`
  );
  const keywords: Record<DatabaseTemplateCatalogGroupId, string[]> = {
    company: ["company", "公司", "coverage", "研究跟踪"],
    report: ["report", "报告", "library", "文件", "html", "pdf"],
    meeting: ["meeting", "call", "会议", "电话会", "transcript"],
    portfolio: ["portfolio", "watchlist", "组合", "持仓", "观察名单"],
  };

  return keywords[groupId].some((keyword) => haystack.includes(normalizeText(keyword)))
    ? 10
    : 0;
}

function getTemplateRowNextAction(
  status: DatabaseTemplateRowReadinessStatus,
  missingRequired: Array<{ label: string; fieldTypes: string[] }>
) {
  if (status === "ready") {
    return "可以在具体数据库页使用 + 模板行，并手动补 relation 和状态字段。";
  }
  const missingLabels = missingRequired.map((item) => item.label).join("、");
  if (status === "partial") {
    return `补齐 ${missingLabels} 后，这组模板行就可以稳定复用。`;
  }
  return `先补 ${missingLabels}，再创建模板行，避免 row/page 脱离投研 workflow。`;
}

function countMissingType(
  items: DatabaseTemplateRowReadinessItem[],
  fieldType: string
) {
  return items.filter((item) =>
    item.missing_required_field_types.includes(fieldType)
  ).length;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}
