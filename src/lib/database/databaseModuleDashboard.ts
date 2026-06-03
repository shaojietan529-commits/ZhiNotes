import {
  getDatabaseFieldTypeLabel,
  getDatabaseViewTypeLabel,
} from "@/lib/database/display";
import type { Database, DatabaseField, DatabaseView } from "@/lib/utils/types";

export const DATABASE_MODULE_VIEW_TYPES: DatabaseView["view_type"][] = [
  "table",
  "list",
  "kanban",
  "calendar",
  "gallery",
  "timeline",
  "chart",
  "form",
  "feed",
];

export interface DatabaseModuleSnapshot {
  database: Database;
  fields: DatabaseField[];
  views: DatabaseView[];
  rowCount: number;
}

export interface DatabaseModuleViewCoverage {
  view_type: DatabaseView["view_type"];
  label: string;
  database_count: number;
  view_count: number;
  status: "covered" | "missing";
}

export interface DatabaseModuleItem {
  database_id: string;
  title: string;
  description: string;
  field_count: number;
  row_count: number;
  view_count: number;
  relation_fields: number;
  select_like_fields: number;
  date_fields: number;
  number_fields: number;
  view_types: DatabaseView["view_type"][];
  export_ready: boolean;
  template_rows_available: true;
  relation_completion_ready: boolean;
  next_action: string;
  updated_at: string;
}

export interface DatabaseWorkflowStep {
  id: string;
  title: string;
  status: "ready" | "manual-confirmation" | "planned";
  evidence: string;
  local_boundary: string;
}

export interface DatabaseModuleDashboardReport {
  format: "zhinote-database-module-dashboard";
  format_version: 1;
  report_status: "local-database-module-only";
  privacy_note: string;
  boundary: {
    local_dashboard_only: true;
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
    fields: number;
    views: number;
    rows_counted: number;
    relation_fields: number;
    export_ready_databases: number;
    template_row_ready_databases: number;
    advanced_view_databases: number;
    covered_view_types: number;
    missing_view_types: number;
  };
  view_coverage: DatabaseModuleViewCoverage[];
  workflow_steps: DatabaseWorkflowStep[];
  databases: DatabaseModuleItem[];
}

export function buildDatabaseModuleDashboardReport(
  snapshots: DatabaseModuleSnapshot[]
): DatabaseModuleDashboardReport {
  const databaseItems = snapshots.map(toDatabaseItem);
  const viewCoverage = buildViewCoverage(snapshots);

  return {
    format: "zhinote-database-module-dashboard",
    format_version: 1,
    report_status: "local-database-module-only",
    privacy_note:
      "Generated locally from database schema, views, and row counts. This dashboard does not read database row values, page text, file bytes, prompts, tokens, credentials, cloud data, or private research content.",
    boundary: {
      local_dashboard_only: true,
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
    summary: {
      databases: snapshots.length,
      fields: snapshots.reduce((sum, item) => sum + item.fields.length, 0),
      views: snapshots.reduce((sum, item) => sum + item.views.length, 0),
      rows_counted: snapshots.reduce((sum, item) => sum + item.rowCount, 0),
      relation_fields: snapshots.reduce(
        (sum, item) =>
          sum + item.fields.filter((field) => field.field_type === "relation").length,
        0
      ),
      export_ready_databases: databaseItems.filter((item) => item.export_ready)
        .length,
      template_row_ready_databases: databaseItems.filter(
        (item) => item.template_rows_available
      ).length,
      advanced_view_databases: databaseItems.filter((item) =>
        item.view_types.some((viewType) =>
          ["kanban", "calendar", "gallery", "timeline", "chart", "form", "feed"].includes(
            viewType
          )
        )
      ).length,
      covered_view_types: viewCoverage.filter((item) => item.status === "covered")
        .length,
      missing_view_types: viewCoverage.filter((item) => item.status === "missing")
        .length,
    },
    view_coverage: viewCoverage,
    workflow_steps: buildWorkflowSteps(snapshots),
    databases: databaseItems,
  };
}

function toDatabaseItem(snapshot: DatabaseModuleSnapshot): DatabaseModuleItem {
  const viewTypes = Array.from(
    new Set(snapshot.views.map((view) => view.view_type))
  );
  const relationFields = snapshot.fields.filter(
    (field) => field.field_type === "relation"
  ).length;
  const selectLikeFields = snapshot.fields.filter((field) =>
    ["select", "status"].includes(field.field_type)
  ).length;
  const dateFields = snapshot.fields.filter(
    (field) => field.field_type === "date"
  ).length;
  const numberFields = snapshot.fields.filter(
    (field) => field.field_type === "number"
  ).length;

  return {
    database_id: snapshot.database.id,
    title: snapshot.database.title || "未命名数据库",
    description: snapshot.database.description || "本地投研数据库",
    field_count: snapshot.fields.length,
    row_count: snapshot.rowCount,
    view_count: snapshot.views.length,
    relation_fields: relationFields,
    select_like_fields: selectLikeFields,
    date_fields: dateFields,
    number_fields: numberFields,
    view_types: viewTypes,
    export_ready: snapshot.fields.length > 0,
    template_rows_available: true,
    relation_completion_ready: relationFields > 0,
    next_action: getDatabaseNextAction({
      relationFields,
      viewTypes,
      selectLikeFields,
      dateFields,
      numberFields,
      rowCount: snapshot.rowCount,
    }),
    updated_at: snapshot.database.updated_at,
  };
}

function buildViewCoverage(
  snapshots: DatabaseModuleSnapshot[]
): DatabaseModuleViewCoverage[] {
  return DATABASE_MODULE_VIEW_TYPES.map((viewType) => {
    const matchingDatabases = snapshots.filter((snapshot) =>
      snapshot.views.some((view) => view.view_type === viewType)
    );
    const viewCount = snapshots.reduce(
      (sum, snapshot) =>
        sum + snapshot.views.filter((view) => view.view_type === viewType).length,
      0
    );

    return {
      view_type: viewType,
      label: getDatabaseViewTypeLabel(viewType),
      database_count: matchingDatabases.length,
      view_count: viewCount,
      status: viewCount > 0 ? "covered" : "missing",
    };
  });
}

function buildWorkflowSteps(
  snapshots: DatabaseModuleSnapshot[]
): DatabaseWorkflowStep[] {
  const hasDatabases = snapshots.length > 0;
  const hasRelationFields = snapshots.some((snapshot) =>
    snapshot.fields.some((field) => field.field_type === "relation")
  );
  const hasAdvancedViews = snapshots.some((snapshot) =>
    snapshot.views.some((view) =>
      ["kanban", "calendar", "gallery", "timeline", "chart", "form", "feed"].includes(
        view.view_type
      )
    )
  );

  return [
    {
      id: "schema-design",
      title: "Schema 设计",
      status: hasDatabases ? "ready" : "planned",
      evidence: hasDatabases
        ? `${snapshots.length} 个本地数据库可用。`
        : "还没有本地数据库。",
      local_boundary: "只读取数据库 schema，不读取 row values。",
    },
    {
      id: "view-workflow",
      title: "多视图工作流",
      status: hasAdvancedViews ? "ready" : "planned",
      evidence: hasAdvancedViews
        ? "至少一个数据库已经配置高级视图。"
        : "可以继续添加看板、日历、画廊、时间线、图表、表单或动态视图。",
      local_boundary: "视图总览只读取 view metadata。",
    },
    {
      id: "relation-completion",
      title: "Relation 补全",
      status: hasRelationFields ? "ready" : "planned",
      evidence: hasRelationFields
        ? "至少一个 relation 字段可用于连接公司、报告、会议、memo 或组合。"
        : "还没有 relation 字段。",
      local_boundary: "Relation 补全由数据库页单条写入，不批量改动。",
    },
    {
      id: "template-rows",
      title: "模板行",
      status: "ready",
      evidence: "数据库页面保留 template-row 入口，可从研究模板创建行页面。",
      local_boundary: "模板行只创建本地 row/page，不上传。",
    },
    {
      id: "csv-xlsx-export",
      title: "CSV/XLSX 导出",
      status: "manual-confirmation",
      evidence: "数据库页面支持导出当前可见行。",
      local_boundary:
        "导出会包含当前可见 row values，用户应在数据库页面主动点击导出。",
    },
    {
      id: "spreadsheet-import",
      title: "表格导入",
      status: "manual-confirmation",
      evidence: "Excel/CSV/ODS 文件可在文件预览中进入本地数据库导入路径。",
      local_boundary: "批量写入前需要 typed confirmation receipt。",
    },
  ];
}

function getDatabaseNextAction(input: {
  relationFields: number;
  viewTypes: DatabaseView["view_type"][];
  selectLikeFields: number;
  dateFields: number;
  numberFields: number;
  rowCount: number;
}) {
  if (input.relationFields === 0) {
    return "补一个 relation 字段，把数据库连接到公司、报告、会议、memo 或组合页面。";
  }
  if (!input.viewTypes.includes("kanban") && input.selectLikeFields > 0) {
    return "基于 select/status 字段添加看板视图，用来管理状态流转。";
  }
  if (!input.viewTypes.includes("calendar") && input.dateFields > 0) {
    return "基于日期字段添加日历或时间线视图，用来跟踪催化剂和会议。";
  }
  if (!input.viewTypes.includes("chart") && input.numberFields + input.selectLikeFields > 0) {
    return "添加图表视图，快速检查状态、行业或数值字段分布。";
  }
  if (input.rowCount === 0) {
    return "创建第一条模板行，把数据库变成可执行的投研流程。";
  }
  return "继续补全 relation、保存筛选视图，并按需导出 CSV/XLSX。";
}

export function getDatabaseFieldTypeBreakdown(fields: DatabaseField[]) {
  const counts = fields.reduce<Record<string, number>>((summary, field) => {
    const label = getDatabaseFieldTypeLabel(field.field_type);
    summary[label] = (summary[label] ?? 0) + 1;
    return summary;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
