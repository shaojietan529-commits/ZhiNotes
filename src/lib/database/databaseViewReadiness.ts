import { getDatabaseViewTypeLabel } from "@/lib/database/display";
import type { DatabaseField, DatabaseView } from "@/lib/utils/types";
import type { DatabaseModuleSnapshot } from "@/lib/database/databaseModuleDashboard";

export type DatabaseViewReadinessStatus =
  | "configured"
  | "configured-limited"
  | "ready-to-add"
  | "needs-schema";

export type DatabaseViewReadinessGateStatus =
  | "ready"
  | "manual-confirmation"
  | "planned";

export interface DatabaseViewReadinessRequirement {
  view_type: DatabaseView["view_type"];
  label: string;
  required_field_types: string[];
  optional_field_types: string[];
  use_case: string;
  missing_field_guidance: string;
}

export interface DatabaseViewReadinessItem {
  id: string;
  database_id: string;
  database_title: string;
  view_type: DatabaseView["view_type"];
  label: string;
  status: DatabaseViewReadinessStatus;
  configured: boolean;
  row_count: number;
  field_count: number;
  matching_required_fields: number;
  matching_optional_fields: number;
  missing_required_field_types: string[];
  use_case: string;
  next_action: string;
}

export interface DatabaseViewReadinessDatabase {
  database_id: string;
  title: string;
  row_count: number;
  field_count: number;
  configured_view_types: DatabaseView["view_type"][];
  ready_to_add_view_types: DatabaseView["view_type"][];
  needs_schema_view_types: DatabaseView["view_type"][];
  configured_limited_view_types: DatabaseView["view_type"][];
  recommended_next_view: DatabaseView["view_type"] | null;
  recommended_next_action: string;
}

export interface DatabaseViewReadinessGate {
  id: string;
  title: string;
  status: DatabaseViewReadinessGateStatus;
  evidence: string;
  required_action: string;
}

export interface DatabaseViewReadinessReport {
  format: "zhinote-database-view-readiness";
  format_version: 1;
  report_status: "local-view-readiness-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_database_schema: true;
    reads_database_views: true;
    reads_database_row_count: true;
    reads_database_rows: false;
    reads_database_row_values: false;
    reads_page_text: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    databases: number;
    view_types: number;
    readiness_items: number;
    configured: number;
    configured_limited: number;
    ready_to_add: number;
    needs_schema: number;
    date_ready_databases: number;
    status_ready_databases: number;
    chart_ready_databases: number;
    relation_ready_databases: number;
  };
  requirements: DatabaseViewReadinessRequirement[];
  gates: DatabaseViewReadinessGate[];
  databases: DatabaseViewReadinessDatabase[];
  items: DatabaseViewReadinessItem[];
}

export const DATABASE_VIEW_READINESS_REQUIREMENTS: DatabaseViewReadinessRequirement[] =
  [
    requirement(
      "table",
      [],
      ["text", "number", "select", "status", "date", "relation"],
      "默认表格视图，适合完整编辑字段和批量检查结构。",
      "表格不需要额外字段，但至少补一个业务字段后才有研究价值。"
    ),
    requirement(
      "list",
      [],
      ["status", "date", "relation"],
      "轻量列表视图，适合按报告、会议或公司资产快速扫一遍。",
      "列表不需要额外字段；建议补状态、日期或 relation 字段提升扫描效率。"
    ),
    requirement(
      "kanban",
      ["select", "status"],
      ["date", "relation"],
      "按状态或分类做研究流程看板，例如待读、复盘中、已入库。",
      "新增 select 或 status 字段，例如 Status、Stage、Priority。"
    ),
    requirement(
      "calendar",
      ["date"],
      ["status", "relation"],
      "跟踪会议、业绩、催化剂、回访和任务截止日期。",
      "新增 date 字段，例如 Date、Meeting date、Catalyst date。"
    ),
    requirement(
      "gallery",
      [],
      ["url", "relation", "select", "status"],
      "用卡片方式浏览公司、报告、会议或资产页面。",
      "画廊不需要额外字段；建议补 URL、relation、status 或分类字段。"
    ),
    requirement(
      "timeline",
      ["date"],
      ["status", "relation"],
      "按时间线复盘事件、会议、业绩窗口和催化剂。",
      "新增 date 字段，时间线才能准确排序和展示。"
    ),
    requirement(
      "chart",
      ["number", "select", "status"],
      ["date", "relation"],
      "做状态分布、行业分类、分数、权重或估值假设的快速图表。",
      "新增 number、select 或 status 字段，例如 Rating、Score、Status。"
    ),
    requirement(
      "form",
      [],
      ["text", "select", "status", "date", "relation"],
      "把固定字段做成录入表单，适合新增报告、会议和公司跟踪项。",
      "表单不需要额外字段；建议先设计核心字段，避免录入后再大改 schema。"
    ),
    requirement(
      "feed",
      [],
      ["date", "status", "relation"],
      "按更新顺序浏览研究资产动态，适合复盘最近新增内容。",
      "动态视图不需要额外字段；建议补日期、状态或 relation 方便后续筛选。"
    ),
  ];

export function buildDatabaseViewReadinessReport(
  snapshots: DatabaseModuleSnapshot[]
): DatabaseViewReadinessReport {
  const items = snapshots.flatMap((snapshot) => buildReadinessItems(snapshot));
  const databases = snapshots.map((snapshot) =>
    buildDatabaseReadiness(snapshot, items)
  );
  const gates = buildReadinessGates(snapshots, items, databases);

  return {
    format: "zhinote-database-view-readiness",
    format_version: 1,
    report_status: "local-view-readiness-only",
    privacy_note:
      "Generated locally from database schema, view metadata, and row counts. This report does not read database row values, page text, file bytes, prompts, credentials, cloud data, holdings, or trading plans.",
    boundary: {
      local_report_only: true,
      reads_database_schema: true,
      reads_database_views: true,
      reads_database_row_count: true,
      reads_database_rows: false,
      reads_database_row_values: false,
      reads_page_text: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: summarizeReadiness(snapshots, items),
    requirements: DATABASE_VIEW_READINESS_REQUIREMENTS,
    gates,
    databases,
    items,
  };
}

function buildReadinessItems(
  snapshot: DatabaseModuleSnapshot
): DatabaseViewReadinessItem[] {
  const configuredViewTypes = new Set(
    snapshot.views.map((view) => view.view_type)
  );

  return DATABASE_VIEW_READINESS_REQUIREMENTS.map((requirement) => {
    const configured = configuredViewTypes.has(requirement.view_type);
    const matchingRequiredFields = countMatchingFields(
      snapshot.fields,
      requirement.required_field_types
    );
    const matchingOptionalFields = countMatchingFields(
      snapshot.fields,
      requirement.optional_field_types
    );
    const missingRequiredFieldTypes = getMissingRequiredFieldTypes(
      snapshot.fields,
      requirement.required_field_types
    );
    const requirementsMet = missingRequiredFieldTypes.length === 0;
    const status = getReadinessStatus(configured, requirementsMet);

    return {
      id: `${snapshot.database.id}:${requirement.view_type}`,
      database_id: snapshot.database.id,
      database_title: snapshot.database.title || "未命名数据库",
      view_type: requirement.view_type,
      label: requirement.label,
      status,
      configured,
      row_count: snapshot.rowCount,
      field_count: snapshot.fields.length,
      matching_required_fields: matchingRequiredFields,
      matching_optional_fields: matchingOptionalFields,
      missing_required_field_types: missingRequiredFieldTypes,
      use_case: requirement.use_case,
      next_action: getViewNextAction(requirement, status),
    };
  });
}

function buildDatabaseReadiness(
  snapshot: DatabaseModuleSnapshot,
  allItems: DatabaseViewReadinessItem[]
): DatabaseViewReadinessDatabase {
  const items = allItems.filter((item) => item.database_id === snapshot.database.id);
  const readyToAdd = items.filter((item) => item.status === "ready-to-add");
  const needsSchema = items.filter((item) => item.status === "needs-schema");
  const configuredLimited = items.filter(
    (item) => item.status === "configured-limited"
  );
  const recommended = pickRecommendedNextView(items);

  return {
    database_id: snapshot.database.id,
    title: snapshot.database.title || "未命名数据库",
    row_count: snapshot.rowCount,
    field_count: snapshot.fields.length,
    configured_view_types: items
      .filter((item) => item.configured)
      .map((item) => item.view_type),
    ready_to_add_view_types: readyToAdd.map((item) => item.view_type),
    needs_schema_view_types: needsSchema.map((item) => item.view_type),
    configured_limited_view_types: configuredLimited.map((item) => item.view_type),
    recommended_next_view: recommended?.view_type ?? null,
    recommended_next_action:
      recommended?.next_action ??
      "继续补 relation、保存常用筛选视图，并按需导出 CSV/XLSX。",
  };
}

function buildReadinessGates(
  snapshots: DatabaseModuleSnapshot[],
  items: DatabaseViewReadinessItem[],
  databases: DatabaseViewReadinessDatabase[]
): DatabaseViewReadinessGate[] {
  const dateReady = databases.filter((database) =>
    hasAnyReadyOrConfigured(items, database.database_id, ["calendar", "timeline"])
  ).length;
  const statusReady = databases.filter((database) =>
    hasAnyReadyOrConfigured(items, database.database_id, ["kanban"])
  ).length;
  const chartReady = databases.filter((database) =>
    hasAnyReadyOrConfigured(items, database.database_id, ["chart"])
  ).length;
  const needsSchema = items.filter((item) => item.status === "needs-schema").length;
  const configuredLimited = items.filter(
    (item) => item.status === "configured-limited"
  ).length;

  return [
    {
      id: "view-schema-map",
      title: "视图字段适配图",
      status: snapshots.length > 0 ? "ready" : "planned",
      evidence:
        snapshots.length > 0
          ? `${snapshots.length} 个数据库已经按字段类型映射到 9 类视图。`
          : "还没有本地数据库可以评估视图适配。",
      required_action:
        "每次新增数据库模板时，同步检查看板、日历、时间线、图表和表单所需字段。",
    },
    {
      id: "date-driven-views",
      title: "日期驱动视图",
      status: dateReady > 0 ? "ready" : "planned",
      evidence: `${dateReady} 个数据库已经具备或可添加日历/时间线视图。`,
      required_action:
        "给会议、业绩、催化剂、任务和回访类数据库补 date 字段。",
    },
    {
      id: "status-workflow-views",
      title: "状态流转视图",
      status: statusReady > 0 ? "ready" : "planned",
      evidence: `${statusReady} 个数据库具备或可添加看板视图。`,
      required_action:
        "给报告、公司、会议和组合 tracker 补 Status、Stage 或 Priority 字段。",
    },
    {
      id: "chartable-fields",
      title: "图表字段",
      status: chartReady > 0 ? "ready" : "planned",
      evidence: `${chartReady} 个数据库具备或可添加图表视图。`,
      required_action:
        "给打分、权重、估值、行业分类或状态统计补 number/select/status 字段。",
    },
    {
      id: "limited-configured-views",
      title: "已配置但字段不足",
      status: configuredLimited > 0 ? "manual-confirmation" : "ready",
      evidence: `${configuredLimited} 个已配置视图缺少关键字段，可能只能显示空状态或弱信息。`,
      required_action:
        "打开对应数据库，先补字段再保存视图配置。",
    },
    {
      id: "schema-gaps",
      title: "待补字段缺口",
      status: needsSchema > 0 ? "manual-confirmation" : "ready",
      evidence: `${needsSchema} 个视图机会需要补字段后才能使用。`,
      required_action:
        "优先补 date、status/select、number 和 relation 字段，避免视图只是空壳。",
    },
  ];
}

function summarizeReadiness(
  snapshots: DatabaseModuleSnapshot[],
  items: DatabaseViewReadinessItem[]
) {
  return {
    databases: snapshots.length,
    view_types: DATABASE_VIEW_READINESS_REQUIREMENTS.length,
    readiness_items: items.length,
    configured: items.filter((item) => item.status === "configured").length,
    configured_limited: items.filter(
      (item) => item.status === "configured-limited"
    ).length,
    ready_to_add: items.filter((item) => item.status === "ready-to-add").length,
    needs_schema: items.filter((item) => item.status === "needs-schema").length,
    date_ready_databases: countDatabasesWithFieldTypes(snapshots, ["date"]),
    status_ready_databases: countDatabasesWithFieldTypes(snapshots, [
      "select",
      "status",
    ]),
    chart_ready_databases: countDatabasesWithFieldTypes(snapshots, [
      "number",
      "select",
      "status",
    ]),
    relation_ready_databases: countDatabasesWithFieldTypes(snapshots, [
      "relation",
    ]),
  };
}

function requirement(
  viewType: DatabaseView["view_type"],
  requiredFieldTypes: string[],
  optionalFieldTypes: string[],
  useCase: string,
  missingFieldGuidance: string
): DatabaseViewReadinessRequirement {
  return {
    view_type: viewType,
    label: getDatabaseViewTypeLabel(viewType),
    required_field_types: requiredFieldTypes,
    optional_field_types: optionalFieldTypes,
    use_case: useCase,
    missing_field_guidance: missingFieldGuidance,
  };
}

function countMatchingFields(fields: DatabaseField[], fieldTypes: string[]) {
  return fields.filter((field) => fieldTypes.includes(field.field_type)).length;
}

function getMissingRequiredFieldTypes(
  fields: DatabaseField[],
  requiredFieldTypes: string[]
) {
  if (requiredFieldTypes.length === 0) return [];
  const existingTypes = new Set(fields.map((field) => field.field_type));
  const hasAtLeastOne = requiredFieldTypes.some((type) => existingTypes.has(type));
  return hasAtLeastOne ? [] : requiredFieldTypes;
}

function getReadinessStatus(
  configured: boolean,
  requirementsMet: boolean
): DatabaseViewReadinessStatus {
  if (configured && requirementsMet) return "configured";
  if (configured && !requirementsMet) return "configured-limited";
  if (!configured && requirementsMet) return "ready-to-add";
  return "needs-schema";
}

function getViewNextAction(
  requirement: DatabaseViewReadinessRequirement,
  status: DatabaseViewReadinessStatus
) {
  if (status === "configured") {
    return `${requirement.label}视图已配置；继续保存筛选、排序和隐藏字段偏好。`;
  }
  if (status === "configured-limited") {
    return `${requirement.label}视图已配置但字段不足。${requirement.missing_field_guidance}`;
  }
  if (status === "ready-to-add") {
    return `字段条件已满足，可以添加${requirement.label}视图。`;
  }
  return requirement.missing_field_guidance;
}

function pickRecommendedNextView(items: DatabaseViewReadinessItem[]) {
  const preferredOrder: DatabaseView["view_type"][] = [
    "kanban",
    "calendar",
    "timeline",
    "gallery",
    "chart",
    "form",
    "feed",
    "list",
  ];

  return (
    preferredOrder
      .map((viewType) =>
        items.find(
          (item) => item.view_type === viewType && item.status === "ready-to-add"
        )
      )
      .find(Boolean) ??
    preferredOrder
      .map((viewType) =>
        items.find(
          (item) => item.view_type === viewType && item.status === "needs-schema"
        )
      )
      .find(Boolean) ??
    null
  );
}

function hasAnyReadyOrConfigured(
  items: DatabaseViewReadinessItem[],
  databaseId: string,
  viewTypes: DatabaseView["view_type"][]
) {
  return items.some(
    (item) =>
      item.database_id === databaseId &&
      viewTypes.includes(item.view_type) &&
      (item.status === "configured" || item.status === "ready-to-add")
  );
}

function countDatabasesWithFieldTypes(
  snapshots: DatabaseModuleSnapshot[],
  fieldTypes: string[]
) {
  return snapshots.filter((snapshot) =>
    snapshot.fields.some((field) => fieldTypes.includes(field.field_type))
  ).length;
}
