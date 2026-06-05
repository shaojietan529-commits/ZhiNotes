import type { DatabaseModuleSnapshot } from "@/lib/database/databaseModuleDashboard";

export type DatabaseImportExportStatus =
  | "ready"
  | "manual-confirmation"
  | "needs-schema"
  | "empty";

export type DatabaseImportExportRisk = "low" | "medium" | "high";

export type DatabaseImportExportGateStatus =
  | "ready"
  | "manual-confirmation"
  | "planned";

export interface DatabaseImportExportItem {
  database_id: string;
  title: string;
  row_count: number;
  field_count: number;
  view_count: number;
  relation_fields: number;
  value_export_status: DatabaseImportExportStatus;
  append_import_status: DatabaseImportExportStatus;
  csv_export_route: string;
  xlsx_export_route: string;
  append_import_route: string;
  export_risk: DatabaseImportExportRisk;
  import_risk: DatabaseImportExportRisk;
  typed_confirmation_required_for_import: true;
  values_included_on_export: boolean;
  recommended_next_action: string;
  privacy_boundary: string;
}

export interface DatabaseImportExportGate {
  id:
    | "module-metadata-only"
    | "value-export-confirmation"
    | "spreadsheet-import-confirmation"
    | "empty-database-bootstrap"
    | "schema-matching"
    | "cloud-ai-boundary";
  title: string;
  status: DatabaseImportExportGateStatus;
  evidence: string;
  required_action: string;
}

export interface DatabaseImportExportReadinessReport {
  format: "zhinote-database-import-export-readiness";
  format_version: 1;
  report_status: "local-import-export-readiness-only";
  readiness_verdict: "ready-with-manual-value-gates";
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
    exports_row_values: false;
    imports_file_values: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    databases: number;
    export_ready_databases: number;
    value_export_databases: number;
    append_import_ready_databases: number;
    empty_databases: number;
    needs_schema_databases: number;
    import_confirmation_databases: number;
    high_risk_databases: number;
  };
  gates: DatabaseImportExportGate[];
  databases: DatabaseImportExportItem[];
}

export function buildDatabaseImportExportReadinessReport(
  snapshots: DatabaseModuleSnapshot[]
): DatabaseImportExportReadinessReport {
  const databases = snapshots.map(buildImportExportItem).sort(sortItems);
  const summary = summarize(databases);

  return {
    format: "zhinote-database-import-export-readiness",
    format_version: 1,
    report_status: "local-import-export-readiness-only",
    readiness_verdict: "ready-with-manual-value-gates",
    privacy_note:
      "Generated locally from database schema, view metadata, and row counts. This readiness report does not read database rows, row values, page text, uploaded file bytes, spreadsheet values, prompts, tokens, credentials, cloud data, holdings, or trading plans.",
    boundary: {
      local_report_only: true,
      reads_database_schema: true,
      reads_database_views: true,
      reads_database_row_count: true,
      reads_database_rows: false,
      reads_database_row_values: false,
      reads_page_text: false,
      writes_workspace_data: false,
      exports_row_values: false,
      imports_file_values: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary,
    gates: buildGates(summary),
    databases,
  };
}

function buildImportExportItem(
  snapshot: DatabaseModuleSnapshot
): DatabaseImportExportItem {
  const fieldCount = snapshot.fields.length;
  const rowCount = snapshot.rowCount;
  const relationFields = snapshot.fields.filter(
    (field) => field.field_type === "relation"
  ).length;
  const hasBusinessFields = fieldCount > 1;
  const hasRows = rowCount > 0;
  const databaseRoute = `/database/${snapshot.database.id}`;
  const valueExportStatus = getValueExportStatus(fieldCount, rowCount);
  const appendImportStatus = getAppendImportStatus(fieldCount, hasBusinessFields);

  return {
    database_id: snapshot.database.id,
    title: snapshot.database.title || "未命名数据库",
    row_count: rowCount,
    field_count: fieldCount,
    view_count: snapshot.views.length,
    relation_fields: relationFields,
    value_export_status: valueExportStatus,
    append_import_status: appendImportStatus,
    csv_export_route: `${databaseRoute} -> CSV`,
    xlsx_export_route: `${databaseRoute} -> XLSX`,
    append_import_route: `${databaseRoute} -> 追加导入当前数据库`,
    export_risk: hasRows ? "high" : "low",
    import_risk: appendImportStatus === "needs-schema" ? "medium" : "high",
    typed_confirmation_required_for_import: true,
    values_included_on_export: hasRows,
    recommended_next_action: getRecommendedNextAction({
      fieldCount,
      rowCount,
      hasBusinessFields,
      relationFields,
      valueExportStatus,
      appendImportStatus,
    }),
    privacy_boundary:
      "模块中心只显示导入/导出 readiness，不导出 row values、不读取 spreadsheet values；真实 CSV/XLSX 导出和追加导入仍在具体数据库页手动触发。",
  };
}

function getValueExportStatus(
  fieldCount: number,
  rowCount: number
): DatabaseImportExportStatus {
  if (fieldCount === 0) return "needs-schema";
  if (rowCount === 0) return "empty";
  return "manual-confirmation";
}

function getAppendImportStatus(
  fieldCount: number,
  hasBusinessFields: boolean
): DatabaseImportExportStatus {
  if (fieldCount === 0) return "needs-schema";
  if (!hasBusinessFields) return "needs-schema";
  return "manual-confirmation";
}

function getRecommendedNextAction(input: {
  fieldCount: number;
  rowCount: number;
  hasBusinessFields: boolean;
  relationFields: number;
  valueExportStatus: DatabaseImportExportStatus;
  appendImportStatus: DatabaseImportExportStatus;
}) {
  if (input.fieldCount === 0) {
    return "先补数据库字段，再考虑 CSV/XLSX 导出或 Excel/CSV 追加导入。";
  }
  if (!input.hasBusinessFields) {
    return "先补业务字段，例如 Status、Date、Company page、Source 或 Key takeaways。";
  }
  if (input.rowCount === 0) {
    return "先用模板行或追加导入创建首批行；空表导出价值有限。";
  }
  if (input.relationFields === 0) {
    return "导出前建议补 relation 字段，把 row 连接到公司、报告、会议或 memo。";
  }
  if (input.appendImportStatus === "manual-confirmation") {
    return "可在数据库页追加导入 Excel/CSV/ODS；批量写入前必须输入确认短语。";
  }
  if (input.valueExportStatus === "manual-confirmation") {
    return "可在数据库页导出当前可见行为 CSV/XLSX；导出会包含 row values。";
  }
  return "继续补 schema、保存常用视图，并按需在具体数据库页执行导入或导出。";
}

function summarize(
  items: DatabaseImportExportItem[]
): DatabaseImportExportReadinessReport["summary"] {
  return {
    databases: items.length,
    export_ready_databases: items.filter(
      (item) => item.value_export_status !== "needs-schema"
    ).length,
    value_export_databases: items.filter((item) => item.values_included_on_export)
      .length,
    append_import_ready_databases: items.filter(
      (item) => item.append_import_status === "manual-confirmation"
    ).length,
    empty_databases: items.filter((item) => item.row_count === 0).length,
    needs_schema_databases: items.filter(
      (item) =>
        item.value_export_status === "needs-schema" ||
        item.append_import_status === "needs-schema"
    ).length,
    import_confirmation_databases: items.filter(
      (item) => item.typed_confirmation_required_for_import
    ).length,
    high_risk_databases: items.filter(
      (item) => item.export_risk === "high" || item.import_risk === "high"
    ).length,
  };
}

function buildGates(
  summary: DatabaseImportExportReadinessReport["summary"]
): DatabaseImportExportGate[] {
  return [
    gate(
      "module-metadata-only",
      "模块中心只读元数据",
      "ready",
      "导入/导出 readiness 只使用 schema、view metadata 和 row count。",
      "真实 row values 只能在具体数据库页由用户主动导出或导入。"
    ),
    gate(
      "value-export-confirmation",
      "CSV/XLSX 值导出",
      summary.value_export_databases > 0 ? "manual-confirmation" : "ready",
      `${summary.value_export_databases} 个数据库导出时会包含当前可见 row values。`,
      "导出前在具体数据库页确认筛选、隐藏字段和可见行范围。"
    ),
    gate(
      "spreadsheet-import-confirmation",
      "表格追加导入",
      summary.append_import_ready_databases > 0
        ? "manual-confirmation"
        : "planned",
      `${summary.append_import_ready_databases} 个数据库可以作为 Excel/CSV/ODS 追加导入目标。`,
      "批量写入前必须预览字段映射、行数、字段新增数量，并输入确认短语。"
    ),
    gate(
      "empty-database-bootstrap",
      "空数据库启动",
      summary.empty_databases > 0 ? "planned" : "ready",
      `${summary.empty_databases} 个数据库还没有行。`,
      "优先用模板行或小样本 CSV 导入启动，不建议把空表作为正式 tracker。"
    ),
    gate(
      "schema-matching",
      "Schema 匹配",
      summary.needs_schema_databases > 0 ? "planned" : "ready",
      `${summary.needs_schema_databases} 个数据库导入/导出前还需要补业务字段。`,
      "先补 title 之外的业务字段，减少表格导入时自动新建字段的风险。"
    ),
    gate(
      "cloud-ai-boundary",
      "云端和 AI 边界",
      "planned",
      "这个 readiness 不触发云同步、AI、外部上传或服务器审计写入。",
      "任何数据库 row values 进入云同步或 AI 前，都必须先走 payload preview 和用户确认。"
    ),
  ];
}

function gate(
  id: DatabaseImportExportGate["id"],
  title: string,
  status: DatabaseImportExportGateStatus,
  evidence: string,
  requiredAction: string
): DatabaseImportExportGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}

function sortItems(a: DatabaseImportExportItem, b: DatabaseImportExportItem) {
  return (
    statusRank(a.append_import_status) - statusRank(b.append_import_status) ||
    statusRank(a.value_export_status) - statusRank(b.value_export_status) ||
    b.row_count - a.row_count ||
    a.title.localeCompare(b.title)
  );
}

function statusRank(status: DatabaseImportExportStatus) {
  if (status === "manual-confirmation") return 0;
  if (status === "ready") return 1;
  if (status === "needs-schema") return 2;
  return 3;
}
