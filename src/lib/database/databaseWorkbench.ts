import type {
  DatabaseImportExportReadinessReport,
  DatabaseImportExportStatus,
} from "@/lib/database/databaseImportExportReadiness";
import type {
  DatabaseModuleDashboardReport,
  DatabaseModuleItem,
} from "@/lib/database/databaseModuleDashboard";
import { getDatabaseViewTypeLabel } from "@/lib/database/display";
import type { DatabaseTemplateCatalogGroupId } from "@/lib/database/databaseTemplateCatalog";
import type {
  DatabaseTemplateRowReadinessDatabase,
  DatabaseTemplateRowReadinessReport,
  DatabaseTemplateRowReadinessStatus,
} from "@/lib/database/databaseTemplateRowReadiness";
import type {
  DatabaseViewReadinessDatabase,
  DatabaseViewReadinessReport,
} from "@/lib/database/databaseViewReadiness";
import type { DatabaseView } from "@/lib/utils/types";

export type DatabaseWorkbenchLaneId =
  | "tracker-fit"
  | "relation-setup"
  | "template-intake"
  | "view-design"
  | "import-export"
  | "manual-review";

export type DatabaseWorkbenchActionStatus =
  | "ready-to-use"
  | "ready-to-add"
  | "needs-schema"
  | "manual-confirmation"
  | "needs-tracker"
  | "review-only";

export type DatabaseWorkbenchPriority = "high" | "medium" | "low";

export type DatabaseWorkbenchDecisionStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

export interface DatabaseWorkbenchLane {
  id: DatabaseWorkbenchLaneId;
  title: string;
  description: string;
  route: string;
  action_count: number;
  high_priority_count: number;
  manual_confirmation_count: number;
  privacy_boundary: string;
}

export interface DatabaseWorkbenchDatabase {
  database_id: string;
  title: string;
  role_id: DatabaseTemplateCatalogGroupId | "general";
  role_label: string;
  row_count: number;
  field_count: number;
  view_count: number;
  relation_fields: number;
  configured_view_types: DatabaseView["view_type"][];
  recommended_template_group_id: DatabaseTemplateCatalogGroupId | null;
  recommended_template_group_label: string | null;
  template_row_status: DatabaseTemplateRowReadinessStatus | null;
  recommended_next_view: DatabaseView["view_type"] | null;
  export_status: DatabaseImportExportStatus | null;
  import_status: DatabaseImportExportStatus | null;
  readiness_score: number;
  next_action: string;
  open_route: string;
  writes_workspace_data: false;
  privacy_boundary: string;
}

export interface DatabaseWorkbenchAction {
  id: string;
  lane_id: DatabaseWorkbenchLaneId;
  database_id: string | null;
  title: string;
  priority: DatabaseWorkbenchPriority;
  status: DatabaseWorkbenchActionStatus;
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  requires_manual_confirmation: boolean;
  writes_workspace_data: false;
  privacy_boundary: string;
}

export interface DatabaseWorkbenchReviewStep {
  id: string;
  order: number;
  title: string;
  route: string;
  target_section_id: string;
  reason: string;
  completion_signal: string;
}

export interface DatabaseWorkbenchDecision {
  id:
    | "schema-view-review"
    | "relation-schema-review"
    | "template-row-intake"
    | "spreadsheet-import-export"
    | "cloud-ai-sync-boundary";
  title: string;
  status: DatabaseWorkbenchDecisionStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: string;
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocked_until_cloud_ai_gate: boolean;
  workbench_writes_workspace_data: false;
  reads_database_row_values: false;
  exports_row_values: false;
  imports_file_values: false;
  uploads_data: false;
  enables_ai: false;
}

export interface DatabaseWorkbenchDecisionSummary {
  current_state: "local-database-owner-review";
  current_conclusion: string;
  can_review_schema_now: true;
  can_review_views_now: true;
  can_open_relation_schema_gate_now: true;
  can_create_template_rows_without_manual_click_now: false;
  can_bulk_import_spreadsheet_now: true;
  can_export_row_values_from_module_now: false;
  can_send_database_values_to_ai_now: false;
  can_sync_database_values_now: false;
  safe_local_work: string[];
  blocked_work: string[];
  required_owner_decisions: string[];
  top_blockers: string[];
  decisions: DatabaseWorkbenchDecision[];
}

export interface DatabaseWorkbenchPacket {
  format: "zhinote-database-workbench-packet";
  format_version: 1;
  packet_status: "local-database-workbench-only";
  workbench_verdict: "ready-for-local-research-database-review";
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_database_dashboard: true;
    reads_view_readiness: true;
    reads_template_row_readiness: true;
    reads_import_export_readiness: true;
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
    creates_database_rows: false;
    creates_schema_fields: false;
    exports_row_values: false;
    imports_file_values: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    databases: number;
    lanes: number;
    actions: number;
    high_priority_actions: number;
    manual_confirmation_actions: number;
    relation_schema_actions: number;
    template_intake_actions: number;
    view_design_actions: number;
    import_export_actions: number;
    empty_databases: number;
    relation_ready_databases: number;
    template_ready_databases: number;
    view_ready_databases: number;
    import_ready_databases: number;
  };
  decision_summary: DatabaseWorkbenchDecisionSummary;
  lanes: DatabaseWorkbenchLane[];
  databases: DatabaseWorkbenchDatabase[];
  actions: DatabaseWorkbenchAction[];
  review_sequence: DatabaseWorkbenchReviewStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  DatabaseWorkbenchLaneId,
  Omit<
    DatabaseWorkbenchLane,
    "action_count" | "high_priority_count" | "manual_confirmation_count"
  >
> = {
  "tracker-fit": {
    id: "tracker-fit",
    title: "跟踪表定位",
    description: "判断哪些本地数据库适合做公司、报告、会议或组合跟踪表。",
    route: "/modules/databases",
    privacy_boundary:
      "只使用数据库标题、描述、结构、视图元数据和行数，不读取行值。",
  },
  "relation-setup": {
    id: "relation-setup",
    title: "关系结构",
    description: "先补公司、报告、会议、组合之间的关系字段，再补具体关系值。",
    route: "/modules/research-graph",
    privacy_boundary:
      "只提示关系结构缺口，不自动创建字段、不写入关系值。",
  },
  "template-intake": {
    id: "template-intake",
    title: "模板行入库",
    description: "检查模板行能否安全创建首批结构化投研行。",
    route: "/modules/databases",
    privacy_boundary:
      "只读取模板元数据和结构；模板行写入必须在具体数据库页由用户触发。",
  },
  "view-design": {
    id: "view-design",
    title: "视图设计",
    description: "把看板、日历、时间线、图表、表单和动态流对齐到字段结构。",
    route: "/modules/databases",
    privacy_boundary:
      "只读取视图元数据和字段类型，不读取筛选后的行值或页面正文。",
  },
  "import-export": {
    id: "import-export",
    title: "导入导出闸门",
    description: "把 CSV/XLSX 值导出和 Excel/CSV/ODS 导入留在手动确认路径里。",
    route: "/modules/databases",
    privacy_boundary:
      "模块页不导出行值、不读取表格值；真实导入导出只能在具体数据库页确认。",
  },
  "manual-review": {
    id: "manual-review",
    title: "人工复核",
    description: "保留需要用户判断的结构、模板、视图和安全边界事项。",
    route: "/modules/databases",
    privacy_boundary:
      "只形成本地 review 队列，不连接云服务、不调用 AI、不上传工作区数据。",
  },
};

const FORBIDDEN_ACTIONS = [
  "read_database_row_values_from_module_center",
  "export_row_values_from_database_workbench",
  "bulk_import_spreadsheet_without_typed_confirmation",
  "auto_create_database_rows_from_packet",
  "auto_create_schema_fields_from_packet",
  "auto_write_relation_values",
  "read_page_text_for_database_routing",
  "send_database_values_to_ai",
  "connect_cloud_database",
  "upload_workspace_data",
];

export function buildDatabaseWorkbenchPacket(input: {
  dashboard: DatabaseModuleDashboardReport;
  viewReadiness: DatabaseViewReadinessReport;
  templateRowReadiness: DatabaseTemplateRowReadinessReport;
  importExportReadiness: DatabaseImportExportReadinessReport;
}): DatabaseWorkbenchPacket {
  const databases = buildWorkbenchDatabases(input).sort(sortDatabases);
  const actions = buildWorkbenchActions(input, databases).sort(sortActions);
  const lanes = buildLanes(actions);

  return {
    format: "zhinote-database-workbench-packet",
    format_version: 1,
    packet_status: "local-database-workbench-only",
    workbench_verdict: "ready-for-local-research-database-review",
    privacy_note:
      "这份数据库工作台包只在本地生成，来源是数据库模块总览、视图就绪、模板行就绪和导入/导出就绪。它把数据库元数据转成一个本地投研数据库行动队列；不会读取数据库行、行值、页面正文、文件字节、表格值、prompt、token、凭证、云端数据、持仓或交易计划；也不会写入工作区、创建行或字段、导出行值、导入文件值、上传数据、连接云服务或启用 AI。",
    boundary: {
      local_packet_only: true,
      reads_database_dashboard: true,
      reads_view_readiness: true,
      reads_template_row_readiness: true,
      reads_import_export_readiness: true,
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
      creates_database_rows: false,
      creates_schema_fields: false,
      exports_row_values: false,
      imports_file_values: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      databases: databases.length,
      lanes: lanes.length,
      actions: actions.length,
      high_priority_actions: actions.filter((action) => action.priority === "high")
        .length,
      manual_confirmation_actions: actions.filter(
        (action) => action.requires_manual_confirmation
      ).length,
      relation_schema_actions: actions.filter(
        (action) => action.lane_id === "relation-setup"
      ).length,
      template_intake_actions: actions.filter(
        (action) => action.lane_id === "template-intake"
      ).length,
      view_design_actions: actions.filter(
        (action) => action.lane_id === "view-design"
      ).length,
      import_export_actions: actions.filter(
        (action) => action.lane_id === "import-export"
      ).length,
      empty_databases: databases.filter((database) => database.row_count === 0)
        .length,
      relation_ready_databases: databases.filter(
        (database) => database.relation_fields > 0
      ).length,
      template_ready_databases: databases.filter(
        (database) => database.template_row_status === "ready"
      ).length,
      view_ready_databases: databases.filter((database) =>
        Boolean(database.recommended_next_view)
      ).length,
      import_ready_databases: databases.filter(
        (database) => database.import_status === "manual-confirmation"
      ).length,
    },
    decision_summary: buildDecisionSummary(databases, actions),
    lanes,
    databases,
    actions,
    review_sequence: buildReviewSequence(databases, actions),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_verification_commands: [
      "npm run verify:database",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildDecisionSummary(
  databases: DatabaseWorkbenchDatabase[],
  actions: DatabaseWorkbenchAction[]
): DatabaseWorkbenchDecisionSummary {
  const relationActions = actions.filter(
    (action) => action.lane_id === "relation-setup"
  );
  const templateActions = actions.filter(
    (action) => action.lane_id === "template-intake"
  );
  const viewActions = actions.filter((action) => action.lane_id === "view-design");
  const importExportActions = actions.filter(
    (action) => action.lane_id === "import-export"
  );
  const manualActions = actions.filter(
    (action) => action.requires_manual_confirmation
  );
  const topBlockers = [
    databases.length === 0
      ? "还没有本地跟踪表，数据库模块没有承载容器。"
      : null,
    relationActions.length > 0
      ? `${relationActions.length} 个跟踪表需要先补关系结构。`
      : null,
    importExportActions.length > 0
      ? "导入导出会触碰行值或表格值，必须留在具体数据库页确认。"
      : null,
    "云同步、AI 执行和数据库值外发仍未启用。",
  ].filter(Boolean) as string[];

  return {
    current_state: "local-database-owner-review",
    current_conclusion:
      "可以继续在本地复核数据库结构、视图、关系缺口和模板行入口；Excel/CSV/ODS 可在确认后导入本地数据库，模板行写入、CSV/XLSX 导出、云同步和 AI 使用数据库值仍然必须由你单独确认。",
    can_review_schema_now: true,
    can_review_views_now: true,
    can_open_relation_schema_gate_now: true,
    can_create_template_rows_without_manual_click_now: false,
    can_bulk_import_spreadsheet_now: true,
    can_export_row_values_from_module_now: false,
    can_send_database_values_to_ai_now: false,
    can_sync_database_values_now: false,
    safe_local_work: [
      "继续用数据库中心复核结构、视图元数据、行数、模板就绪和关系缺口。",
      "继续从工作台打开跟踪表、研究图谱和就绪区域做人工复核。",
      "继续导出仅元数据数据库工作台包，不包含字段名、行值或页面正文。",
      "继续在具体数据库页手动创建模板行，敏感投资字段仍由用户手动填写。",
      "继续通过确认后的文件批量导入或页面预览流程，把 Excel/CSV/ODS 转成本地数据库。",
    ],
    blocked_work: [
      "不能从模块中心读取、展示或导出数据库行值。",
      "不能从工作台包自动创建行、结构字段或关系值。",
      "不能在没有确认文本的情况下批量导入 Excel/CSV/ODS。",
      "不能把数据库值发送给 AI、云同步、外部 API 或远端数据库。",
    ],
    required_owner_decisions: manualActions
      .slice(0, 5)
      .map((action) => action.next_action),
    top_blockers: topBlockers,
    decisions: [
      {
        id: "schema-view-review",
        title: "Schema 与视图复核",
        status: "available-local",
        answer: "可以继续",
        evidence: `${databases.length} 个本地数据库可用结构、视图元数据和行数复核；${viewActions.length} 个视图行动可进入人工判断。`,
        next_action:
          "先在数据库中心检查字段结构、视图覆盖、行数和跟踪表角色是否符合真实投研流程。",
        route: "/modules/databases",
        target_section_id: "databases-dashboard",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_database_row_values: false,
        exports_row_values: false,
        imports_file_values: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "relation-schema-review",
        title: "关系结构",
        status:
          relationActions.length > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer: relationActions.length > 0 ? "先补结构" : "继续复核",
        evidence:
          relationActions.length > 0
            ? `${relationActions.length} 个跟踪表缺少关系字段，需要你确认字段方向后再创建。`
            : "当前工作台没有发现高优先级关系结构缺口。",
        next_action:
          "打开研究图谱或具体数据库，先确认公司、报告、会议、备忘录和组合之间应该如何互相连接。",
        route: "/modules/research-graph",
        target_section_id: "databases-relation-setup",
        allowed_now: true,
        requires_owner_confirmation: relationActions.length > 0,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_database_row_values: false,
        exports_row_values: false,
        imports_file_values: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "template-row-intake",
        title: "模板行入库",
        status:
          templateActions.length > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer: templateActions.length > 0 ? "可手动写入" : "暂无紧急缺口",
        evidence:
          templateActions.length > 0
            ? `${templateActions.length} 个模板行行动需要在具体数据库页手动触发。`
            : "当前工作台没有发现必须立即处理的模板行行动。",
        next_action:
          "只在具体数据库或行内数据库的「+ 模板行」菜单里创建本地行；方向性投资字段仍保持人工填写。",
        route: "/modules/databases",
        target_section_id: "databases-template-readiness",
        allowed_now: true,
        requires_owner_confirmation: templateActions.length > 0,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_database_row_values: false,
        exports_row_values: false,
        imports_file_values: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "spreadsheet-import-export",
        title: "导入导出闸门",
        status: "requires-owner-confirmation",
        answer: "确认后执行",
        evidence:
          importExportActions.length > 0
            ? `${importExportActions.length} 个数据库存在导入/导出确认动作；模块中心只显示就绪状态。`
            : "导入导出就绪状态已保留手动闸门；文件批量导入或具体数据库页确认后才能写入真实值。",
        next_action:
          "CSV/XLSX 导出、Excel/CSV/ODS 导入和字段映射都必须在文件批量导入计划、页面预览块或具体数据库页复核后执行。",
        route: "/modules/databases",
        target_section_id: "databases-import-export-readiness",
        allowed_now: true,
        requires_owner_confirmation: true,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_database_row_values: false,
        exports_row_values: false,
        imports_file_values: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "cloud-ai-sync-boundary",
        title: "云同步与 AI 边界",
        status: "blocked",
        answer: "保持关闭",
        evidence:
          "当前数据库工作台没有连接云数据库、没有调用 AI，也没有把行值放进导出包。",
        next_action:
          "等 Web beta 的账号、权限、发送内容预览、审计和回滚合同确认后，再决定数据库值是否进入云同步或 AI。",
        route: "/modules/sync",
        target_section_id: "sync-architecture",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocked_until_cloud_ai_gate: true,
        workbench_writes_workspace_data: false,
        reads_database_row_values: false,
        exports_row_values: false,
        imports_file_values: false,
        uploads_data: false,
        enables_ai: false,
      },
    ],
  };
}

function buildWorkbenchDatabases(input: {
  dashboard: DatabaseModuleDashboardReport;
  viewReadiness: DatabaseViewReadinessReport;
  templateRowReadiness: DatabaseTemplateRowReadinessReport;
  importExportReadiness: DatabaseImportExportReadinessReport;
}): DatabaseWorkbenchDatabase[] {
  return input.dashboard.databases.map((database) => {
    const template = input.templateRowReadiness.databases.find(
      (item) => item.database_id === database.database_id
    );
    const view = input.viewReadiness.databases.find(
      (item) => item.database_id === database.database_id
    );
    const importExport = input.importExportReadiness.databases.find(
      (item) => item.database_id === database.database_id
    );
    const roleId = template?.recommended_group_id ?? inferRoleId(database);

    return {
      database_id: database.database_id,
      title: database.title,
      role_id: roleId,
      role_label: getRoleLabel(roleId, template),
      row_count: database.row_count,
      field_count: database.field_count,
      view_count: database.view_count,
      relation_fields: database.relation_fields,
      configured_view_types: view?.configured_view_types ?? database.view_types,
      recommended_template_group_id: template?.recommended_group_id ?? null,
      recommended_template_group_label: template?.recommended_group_label ?? null,
      template_row_status: template?.recommended_status ?? null,
      recommended_next_view: view?.recommended_next_view ?? null,
      export_status: importExport?.value_export_status ?? null,
      import_status: importExport?.append_import_status ?? null,
      readiness_score: scoreDatabase(database, template, view, importExport),
      next_action: getDatabaseNextAction(database, template, view, importExport),
      open_route: `/database/${database.database_id}`,
      writes_workspace_data: false,
      privacy_boundary:
        "工作台数据库汇总只使用标题、由描述推断的角色、结构计数、视图元数据、模板就绪、导入/导出就绪和行数；不包含字段名、行值、页面正文、文件字节、持仓、交易计划或云端数据。",
    };
  });
}

function buildWorkbenchActions(
  input: {
    dashboard: DatabaseModuleDashboardReport;
    viewReadiness: DatabaseViewReadinessReport;
    templateRowReadiness: DatabaseTemplateRowReadinessReport;
    importExportReadiness: DatabaseImportExportReadinessReport;
  },
  databases: DatabaseWorkbenchDatabase[]
): DatabaseWorkbenchAction[] {
  const actions: DatabaseWorkbenchAction[] = [];

  if (databases.length === 0) {
    actions.push({
      id: "database-workbench:create-first-tracker",
      lane_id: "tracker-fit",
      database_id: null,
      title: "创建第一个投研跟踪表",
      priority: "high",
      status: "needs-tracker",
      evidence: "当前本地工作区还没有数据库。",
      next_action:
        "从公司、报告、会议或组合预设里创建一个本地跟踪表，再回到数据库工作台复核结构。",
      action_route: "/modules/databases",
      route_label: "打开数据库中心",
      requires_manual_confirmation: true,
      writes_workspace_data: false,
      privacy_boundary:
        "这里只把用户带到本地数据库模块；只有用户点击 starter 后才会创建数据库。",
    });
    return actions;
  }

  for (const database of databases) {
    if (database.relation_fields === 0) {
      actions.push({
        id: `database-workbench:relation:${database.database_id}`,
        lane_id: "relation-setup",
        database_id: database.database_id,
        title: `${database.title} 缺少关系字段`,
        priority: "high",
        status: "needs-schema",
        evidence: "这个数据库还不能把公司、报告、会议、备忘录或组合互相连接。",
        next_action:
          "打开数据库，按需要新增公司页面、关联报告、关联会议或关联备忘录关系字段。",
        action_route: database.open_route,
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "这个行动只会打开数据库页；创建关系字段仍然是手动的本地结构编辑。",
      });
    }

    if (database.row_count === 0) {
      actions.push({
        id: `database-workbench:first-row:${database.database_id}`,
        lane_id: "template-intake",
        database_id: database.database_id,
        title: `${database.title} 需要首批模板行`,
        priority: "high",
        status: "ready-to-use",
        evidence: "这个跟踪表目前还是空表。",
        next_action:
          "打开数据库页，用「+ 模板行」创建第一批公司、报告、会议或组合行；敏感投资字段仍手动填写。",
        action_route: database.open_route,
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "模板行创建只会在用户进入数据库页并点击后写入本地行；工作台包不包含行值。",
      });
    }

    if (database.template_row_status === "needs-schema") {
      actions.push({
        id: `database-workbench:template-schema:${database.database_id}`,
        lane_id: "template-intake",
        database_id: database.database_id,
        title: `${database.title} 模板行需要补结构`,
        priority: "medium",
        status: "needs-schema",
        evidence: database.recommended_template_group_label
          ? `推荐方向是 ${database.recommended_template_group_label}，但必需字段组还不完整。`
          : "模板行就绪报告认为这个数据库需要先补字段。",
        next_action:
          "先补状态、日期、格式或关系等结构字段，再使用模板行写入本地行。",
        action_route: database.open_route,
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "这个行动只指向结构复核；不会在导出包里检查字段名，也不会自动创建字段。",
      });
    } else if (database.template_row_status === "partial") {
      actions.push({
        id: `database-workbench:template-partial:${database.database_id}`,
        lane_id: "template-intake",
        database_id: database.database_id,
        title: `${database.title} 模板行部分就绪`,
        priority: "low",
        status: "ready-to-use",
        evidence: database.recommended_template_group_label
          ? `${database.recommended_template_group_label} 模板可以开始用，但还有字段可补。`
          : "模板行可以开始使用，但部分推荐字段还未覆盖。",
        next_action:
          "可以先创建模板行，再逐步补齐推荐字段；方向性投资信息仍保持人工填写。",
        action_route: database.open_route,
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "模板行使用仍然留在数据库页，并且只在用户手动操作后写入本地行。",
      });
    }

    if (database.recommended_next_view) {
      actions.push({
        id: `database-workbench:view:${database.database_id}:${database.recommended_next_view}`,
        lane_id: "view-design",
        database_id: database.database_id,
        title: `${database.title} 可添加 ${getDatabaseViewTypeLabel(
          database.recommended_next_view
        )} 视图`,
        priority: "medium",
        status: "ready-to-add",
        evidence:
          "视图就绪报告显示这个数据库已有适合下一种工作流视图的字段结构。",
        next_action:
          "打开数据库页添加推荐视图，并保存常用筛选、排序和隐藏字段配置。",
        action_route: database.open_route,
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "工作台只推荐视图；新增视图仍然是在数据库页手动进行的本地元数据写入。",
      });
    }

    if (
      database.import_status === "manual-confirmation" ||
      database.export_status === "manual-confirmation"
    ) {
      actions.push({
        id: `database-workbench:import-export:${database.database_id}`,
        lane_id: "import-export",
        database_id: database.database_id,
        title: `${database.title} 导入/导出需要手动闸门`,
        priority: database.row_count > 0 ? "medium" : "low",
        status: "manual-confirmation",
        evidence:
          database.row_count > 0
            ? "这个数据库的 CSV/XLSX 导出会包含当前可见行值。"
            : "这个数据库可以追加导入表格，但批量写入必须输入确认短语。",
        next_action:
          "只在具体数据库页执行 CSV/XLSX 导出或 Excel/CSV/ODS 追加导入，并先确认可见行、隐藏字段和确认短语。",
        action_route: database.open_route,
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "模块工作台不会导出值，也不会读取表格值。真实导入/导出仍然留在数据库页的手动确认之后。",
      });
    }
  }

  const missingViewTypes = input.dashboard.view_coverage.filter(
    (item) => item.status === "missing"
  );
  if (missingViewTypes.length > 0) {
    actions.push({
      id: "database-workbench:missing-view-coverage",
      lane_id: "manual-review",
      database_id: null,
      title: "补齐尚未覆盖的数据库视图类型",
      priority: "low",
      status: "review-only",
      evidence: `尚未覆盖：${missingViewTypes
        .map((item) => item.label)
        .join("、")}。`,
      next_action:
        "先确认这些视图是否对投研工作流有用，再在合适的跟踪表中手动添加。",
      action_route: "/modules/databases",
      route_label: "查看数据库中心",
      requires_manual_confirmation: false,
      writes_workspace_data: false,
      privacy_boundary:
        "视图覆盖只使用元数据计数，不读取行、值或页面正文。",
    });
  }

  return actions;
}

function buildLanes(actions: DatabaseWorkbenchAction[]): DatabaseWorkbenchLane[] {
  return (Object.keys(LANE_META) as DatabaseWorkbenchLaneId[]).map((id) => {
    const laneActions = actions.filter((action) => action.lane_id === id);
    return {
      ...LANE_META[id],
      action_count: laneActions.length,
      high_priority_count: laneActions.filter(
        (action) => action.priority === "high"
      ).length,
      manual_confirmation_count: laneActions.filter(
        (action) => action.requires_manual_confirmation
      ).length,
    };
  });
}

function buildReviewSequence(
  databases: DatabaseWorkbenchDatabase[],
  actions: DatabaseWorkbenchAction[]
): DatabaseWorkbenchReviewStep[] {
  if (databases.length === 0) {
    return [
      reviewStep(
        "create-first-tracker",
        1,
        "创建第一个投研跟踪表",
        "/modules/databases",
        "databases-create-workspace",
        "没有数据库时，后续关系、模板行、导入导出都没有承载容器。",
        "至少创建一个公司、报告、会议或组合跟踪表。"
      ),
    ];
  }

  const steps: DatabaseWorkbenchReviewStep[] = [];

  if (actions.some((action) => action.lane_id === "relation-setup")) {
    steps.push(
      reviewStep(
        "relation-first",
        steps.length + 1,
        "先补关系字段",
        "/modules/research-graph",
        "databases-relation-setup",
        "投研平台的核心是把公司、报告、会议、备忘录和组合连接起来。",
        "关键跟踪表至少有一个关系字段。"
      )
    );
  }

  if (actions.some((action) => action.lane_id === "template-intake")) {
    steps.push(
      reviewStep(
        "template-rows",
        steps.length + 1,
        "用模板行建立首批结构",
        "/modules/databases",
        "databases-template-readiness",
        "模板行能让投研资产用一致结构进入数据库，后面更容易搜索、关联和复盘。",
        "空跟踪表至少有一批本地模板行，敏感投资字段保持人工填写。"
      )
    );
  }

  if (actions.some((action) => action.lane_id === "view-design")) {
    steps.push(
      reviewStep(
        "view-design",
        steps.length + 1,
        "补常用视图",
        "/modules/databases",
        "databases-view-readiness",
        "不同投研动作需要不同视角：看板看状态，日历看催化剂，时间线看事件，图表看分布。",
        "核心跟踪表保存了适合自己字段结构的视图。"
      )
    );
  }

  if (actions.some((action) => action.lane_id === "import-export")) {
    steps.push(
      reviewStep(
        "import-export-gates",
        steps.length + 1,
        "最后处理导入导出",
        "/modules/databases",
        "databases-import-export-readiness",
        "导入导出会碰到真实行值或表格值，应该放在结构复核之后。",
        "只在具体数据库页手动执行导入或导出，并留下本地记录。"
      )
    );
  }

  if (steps.length === 0) {
    steps.push(
      reviewStep(
        "manual-review",
        1,
        "人工复核数据库工作流",
        "/modules/databases",
        "databases-workbench-databases",
        "当前没有紧急缺口，可以继续按投研流程检查跟踪表是否符合真实使用方式。",
        "确认每个跟踪表的角色、视图、模板行和导入导出路径都清楚。"
      )
    );
  }

  return steps;
}

function reviewStep(
  id: string,
  order: number,
  title: string,
  route: string,
  targetSectionId: string,
  reason: string,
  completionSignal: string
): DatabaseWorkbenchReviewStep {
  return {
    id,
    order,
    title,
    route,
    target_section_id: targetSectionId,
    reason,
    completion_signal: completionSignal,
  };
}

function scoreDatabase(
  database: DatabaseModuleItem,
  template: DatabaseTemplateRowReadinessDatabase | undefined,
  view: DatabaseViewReadinessDatabase | undefined,
  importExport:
    | DatabaseImportExportReadinessReport["databases"][number]
    | undefined
): number {
  let score = 0;
  if (database.relation_fields > 0) score += 25;
  if (database.row_count > 0) score += 20;
  if (template?.recommended_status === "ready") score += 20;
  if (template?.recommended_status === "partial") score += 10;
  if (view?.configured_view_types.length) score += 15;
  if (view?.ready_to_add_view_types.length) score += 10;
  if (importExport?.append_import_status === "manual-confirmation") score += 5;
  return score;
}

function getDatabaseNextAction(
  database: DatabaseModuleItem,
  template: DatabaseTemplateRowReadinessDatabase | undefined,
  view: DatabaseViewReadinessDatabase | undefined,
  importExport:
    | DatabaseImportExportReadinessReport["databases"][number]
    | undefined
): string {
  if (database.relation_fields === 0) {
    return "先补关系字段，让这个跟踪表能连接公司、报告、会议、备忘录或组合。";
  }
  if (template?.recommended_status === "needs-schema") {
    return template.next_action;
  }
  if (database.row_count === 0) {
    return "先用模板行创建首批本地行，再补人工字段。";
  }
  if (view?.recommended_next_view) {
    return `下一步可添加 ${getDatabaseViewTypeLabel(
      view.recommended_next_view
    )} 视图。`;
  }
  if (importExport?.append_import_status === "manual-confirmation") {
    return "可在具体数据库页追加导入 Excel/CSV/ODS；批量写入前必须输入确认短语。";
  }
  return database.next_action;
}

function inferRoleId(
  database: DatabaseModuleItem
): DatabaseTemplateCatalogGroupId | "general" {
  const searchable = `${database.title} ${database.description}`.toLowerCase();
  if (searchable.includes("公司") || searchable.includes("company")) {
    return "company";
  }
  if (searchable.includes("报告") || searchable.includes("report")) {
    return "report";
  }
  if (
    searchable.includes("会议") ||
    searchable.includes("meeting") ||
    searchable.includes("call")
  ) {
    return "meeting";
  }
  if (
    searchable.includes("组合") ||
    searchable.includes("portfolio") ||
    searchable.includes("watchlist")
  ) {
    return "portfolio";
  }
  return "general";
}

function getRoleLabel(
  roleId: DatabaseTemplateCatalogGroupId | "general",
  template: DatabaseTemplateRowReadinessDatabase | undefined
): string {
  if (template?.recommended_group_label) return template.recommended_group_label;
  const labels: Record<DatabaseTemplateCatalogGroupId | "general", string> = {
    company: "公司研究",
    report: "报告库",
    meeting: "会议与电话会",
    portfolio: "组合与观察名单",
    general: "通用投研数据库",
  };
  return labels[roleId];
}

function sortDatabases(
  left: DatabaseWorkbenchDatabase,
  right: DatabaseWorkbenchDatabase
) {
  if (left.readiness_score !== right.readiness_score) {
    return left.readiness_score - right.readiness_score;
  }
  return left.title.localeCompare(right.title, "zh-CN");
}

function sortActions(
  left: DatabaseWorkbenchAction,
  right: DatabaseWorkbenchAction
) {
  const priorityRank: Record<DatabaseWorkbenchPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const laneRank: Record<DatabaseWorkbenchLaneId, number> = {
    "tracker-fit": 0,
    "relation-setup": 1,
    "template-intake": 2,
    "view-design": 3,
    "import-export": 4,
    "manual-review": 5,
  };
  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority];
  }
  if (laneRank[left.lane_id] !== laneRank[right.lane_id]) {
    return laneRank[left.lane_id] - laneRank[right.lane_id];
  }
  return left.title.localeCompare(right.title, "zh-CN");
}
