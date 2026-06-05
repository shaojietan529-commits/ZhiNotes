import type {
  ResearchAssetKind,
  ResearchGraphReport,
} from "@/lib/modules/researchGraph";
import type {
  ResearchWorkbenchPacket,
  ResearchWorkbenchReviewStep,
} from "@/lib/modules/researchWorkbench";
import {
  RESEARCH_ASSET_KINDS,
  getResearchAssetKindLabel,
  getResearchModuleRoute,
} from "@/lib/modules/researchWorkflow";

export type ResearchProjectMode =
  | "initiation"
  | "earnings-review"
  | "variant-view"
  | "meeting-follow-up"
  | "portfolio-review";

export type ResearchProjectChecklistStatus =
  | "ready"
  | "needs-review"
  | "missing"
  | "blocked-boundary";

export interface ResearchProjectModeOption {
  id: ResearchProjectMode;
  label: string;
  description: string;
}

export interface ResearchProjectBriefInput {
  topic: string;
  projectMode: ResearchProjectMode;
  horizon: string;
  graphReport: ResearchGraphReport;
  workbench: ResearchWorkbenchPacket;
  createdAt?: string;
}

export interface ResearchProjectModulePlan {
  kind: ResearchAssetKind;
  label: string;
  role: string;
  route: string;
  health_status: ResearchGraphReport["health_summary"][number]["status"];
  assets: number;
  connected_assets: number;
  unlinked_assets: number;
  relation_links: number;
  schema_gaps: number;
  connection_rate: number;
  next_action_label: string;
  next_action_route: string;
  readiness: ResearchProjectChecklistStatus;
  privacy_boundary: string;
}

export interface ResearchProjectChecklistItem {
  id: string;
  title: string;
  status: ResearchProjectChecklistStatus;
  surface: "page" | "database" | "file" | "relation" | "boundary";
  route: string;
  route_label: string;
  reason: string;
  owner_decision: string;
  requires_owner_confirmation: boolean;
  writes_workspace_data: false;
  uploads_data: false;
}

export interface ResearchProjectBrief {
  format: "zhinote-research-project-brief";
  format_version: 1;
  brief_status: "local-project-brief-only";
  topic: string;
  topic_status: "empty-draft" | "owner-entered";
  project_mode: ResearchProjectMode;
  project_mode_label: string;
  horizon: string;
  created_at: string;
  privacy_note: string;
  boundary: {
    local_brief_only: true;
    reads_research_graph_report: true;
    reads_research_workbench_packet: true;
    includes_owner_entered_topic: boolean;
    reads_page_text: false;
    includes_page_text: false;
    reads_database_rows: false;
    includes_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    includes_holdings: false;
    includes_trading_plans: false;
    writes_workspace_data: false;
    creates_pages: false;
    creates_database_rows: false;
    creates_relation_values: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    module_plans: number;
    ready_modules: number;
    modules_needing_review: number;
    missing_modules: number;
    graph_assets: number;
    connected_assets: number;
    unlinked_assets: number;
    relation_links: number;
    workbench_actions: number;
    high_priority_actions: number;
    relation_actions: number;
    schema_actions: number;
    tracker_actions: number;
    checklist_items: number;
    checklist_ready: number;
    checklist_needing_review: number;
    checklist_missing: number;
    checklist_blocked: number;
    recommended_first_route: string;
    recommended_first_label: string;
  };
  module_plans: ResearchProjectModulePlan[];
  checklist: ResearchProjectChecklistItem[];
  review_sequence: ResearchWorkbenchReviewStep[];
  blocked_actions: string[];
  required_owner_decisions: string[];
  required_verification_commands: string[];
}

export const RESEARCH_PROJECT_MODE_OPTIONS: ResearchProjectModeOption[] = [
  {
    id: "initiation",
    label: "首次覆盖",
    description: "从公司主页、报告证据、会议验证和 memo 结构开始。",
  },
  {
    id: "earnings-review",
    label: "业绩复盘",
    description: "围绕业绩变化、模型影响、管理层表述和后续问题整理。",
  },
  {
    id: "variant-view",
    label: "反向观点",
    description: "把反向证据、风险、开放问题和待验证材料串起来。",
  },
  {
    id: "meeting-follow-up",
    label: "会议跟进",
    description: "从纪要、转录、行动项和公司/报告关系开始收口。",
  },
  {
    id: "portfolio-review",
    label: "组合复盘",
    description: "把研究资产连接到观察名单、仓位纪律、风险和催化剂。",
  },
];

const MODE_FIRST_KIND: Record<ResearchProjectMode, ResearchAssetKind> = {
  initiation: "company",
  "earnings-review": "company",
  "variant-view": "report",
  "meeting-follow-up": "meeting",
  "portfolio-review": "portfolio",
};

const MODULE_ROLES: Record<ResearchAssetKind, string> = {
  company: "研究对象和长期 thesis 的锚点。",
  report: "证据、可视化报告、模型影响和来源记录。",
  meeting: "管理层、专家、渠道或客户反馈后的复盘入口。",
  portfolio: "把研究结论连接到观察名单、风险和催化剂复盘。",
};

const BLOCKED_ACTIONS = [
  "auto_create_research_project_pages",
  "auto_write_relation_values",
  "bulk_update_database_rows",
  "send_project_context_to_ai",
  "upload_project_brief",
  "sync_project_assets_to_cloud",
  "read_file_bytes_for_project_context",
  "export_holdings_or_trading_plans",
];

export function buildResearchProjectBrief(
  input: ResearchProjectBriefInput
): ResearchProjectBrief {
  const topic = input.topic.trim();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const modulePlans = buildModulePlans(input.graphReport, input.workbench);
  const checklist = buildChecklist(input, modulePlans);
  const recommended = getRecommendedFirstAction(input, modulePlans, checklist);
  const projectModeLabel = getProjectModeLabel(input.projectMode);

  return {
    format: "zhinote-research-project-brief",
    format_version: 1,
    brief_status: "local-project-brief-only",
    topic,
    topic_status: topic ? "owner-entered" : "empty-draft",
    project_mode: input.projectMode,
    project_mode_label: projectModeLabel,
    horizon: input.horizon.trim() || "未设置",
    created_at: createdAt,
    privacy_note:
      "这份投研项目简报只在本地由研究图谱报告、研究工作台行动包和你手动输入的项目字段生成。它不读取页面正文、数据库行值、文件名、文件字节、持仓、交易计划、云端数据、AI 提示词、token 或凭证；也不会创建页面、写入关系值、上传数据、连接云服务或启用 AI。",
    boundary: {
      local_brief_only: true,
      reads_research_graph_report: true,
      reads_research_workbench_packet: true,
      includes_owner_entered_topic: Boolean(topic),
      reads_page_text: false,
      includes_page_text: false,
      reads_database_rows: false,
      includes_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      includes_holdings: false,
      includes_trading_plans: false,
      writes_workspace_data: false,
      creates_pages: false,
      creates_database_rows: false,
      creates_relation_values: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      module_plans: modulePlans.length,
      ready_modules: modulePlans.filter((plan) => plan.readiness === "ready")
        .length,
      modules_needing_review: modulePlans.filter(
        (plan) => plan.readiness === "needs-review"
      ).length,
      missing_modules: modulePlans.filter((plan) => plan.readiness === "missing")
        .length,
      graph_assets: input.graphReport.summary.assets,
      connected_assets: input.graphReport.summary.connected_assets,
      unlinked_assets: input.graphReport.summary.unlinked_assets,
      relation_links: input.graphReport.summary.relation_links,
      workbench_actions: input.workbench.summary.actions,
      high_priority_actions: input.workbench.summary.high_priority,
      relation_actions: input.workbench.summary.relation_actions,
      schema_actions: input.workbench.summary.schema_actions,
      tracker_actions: input.workbench.summary.tracker_actions,
      checklist_items: checklist.length,
      checklist_ready: countChecklistStatus(checklist, "ready"),
      checklist_needing_review: countChecklistStatus(checklist, "needs-review"),
      checklist_missing: countChecklistStatus(checklist, "missing"),
      checklist_blocked: countChecklistStatus(checklist, "blocked-boundary"),
      recommended_first_route: recommended.route,
      recommended_first_label: recommended.label,
    },
    module_plans: modulePlans,
    checklist,
    review_sequence: buildProjectReviewSequence(
      input.projectMode,
      input.workbench.review_sequence
    ),
    blocked_actions: BLOCKED_ACTIONS,
    required_owner_decisions: buildRequiredOwnerDecisions(input, checklist),
    required_verification_commands: [
      "npm run verify:research-workflow",
      "npm run verify:modules",
      "npm run lint",
      "npm run build",
    ],
  };
}

export function buildResearchProjectBriefPageHtml(
  brief: ResearchProjectBrief
) {
  const checklistItems = brief.checklist
    .map(
      (item) => `
        <li data-type="taskItem" data-checked="${item.status === "ready"}">
          <label><input type="checkbox" ${
            item.status === "ready" ? "checked" : ""
          } /></label>
          <div>
            <p><strong>${escapeHtml(item.title)}</strong> · ${escapeHtml(
              getChecklistStatusLabel(item.status)
            )}</p>
            <p>${escapeHtml(item.reason)}</p>
            <p>${escapeHtml(item.owner_decision)}</p>
          </div>
        </li>
      `
    )
    .join("");
  const moduleRows = brief.module_plans
    .map(
      (plan) => `
        <tr>
          <td>${escapeHtml(plan.label)}</td>
          <td>${escapeHtml(getChecklistStatusLabel(plan.readiness))}</td>
          <td>${plan.assets}</td>
          <td>${plan.connected_assets}</td>
          <td>${plan.unlinked_assets}</td>
          <td>${plan.connection_rate}%</td>
        </tr>
      `
    )
    .join("");
  const reviewSteps = brief.review_sequence
    .map(
      (step) => `
        <li>
          <strong>${step.order}. ${escapeHtml(step.title)}</strong>
          <p>${escapeHtml(step.reason)}</p>
        </li>
      `
    )
    .join("");
  const ownerDecisions = brief.required_owner_decisions
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const blockedActions = brief.blocked_actions
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <h1>${escapeHtml(buildResearchProjectPageTitle(brief))}</h1>
    <blockquote>
      <p>本页面由研究图谱的投研项目启动器在本地生成。它只使用图谱/工作台摘要元数据和你手动输入的项目字段，不包含页面正文、数据库行值、文件名、文件内容、持仓或交易计划。</p>
    </blockquote>
    <h2>项目设置</h2>
    <ul>
      <li>研究主题：${escapeHtml(brief.topic || "未填写")}</li>
      <li>项目类型：${escapeHtml(brief.project_mode_label)}</li>
      <li>时间范围：${escapeHtml(brief.horizon)}</li>
      <li>创建时间：${escapeHtml(brief.created_at)}</li>
    </ul>
    <h2>核心仪表盘</h2>
    <table>
      <tbody>
        <tr><th>图谱资产</th><th>已连接资产</th><th>未连接资产</th><th>关系连接</th><th>工作台行动</th></tr>
        <tr>
          <td>${brief.summary.graph_assets}</td>
          <td>${brief.summary.connected_assets}</td>
          <td>${brief.summary.unlinked_assets}</td>
          <td>${brief.summary.relation_links}</td>
          <td>${brief.summary.workbench_actions}</td>
        </tr>
      </tbody>
    </table>
    <h2>模块准备度</h2>
    <table>
      <tbody>
        <tr><th>模块</th><th>状态</th><th>资产</th><th>已连接</th><th>缺口</th><th>覆盖率</th></tr>
        ${moduleRows}
      </tbody>
    </table>
    <h2>项目清单</h2>
    <ul data-type="taskList">
      ${checklistItems}
    </ul>
    <h2>推荐顺序</h2>
    <ol>
      ${reviewSteps}
    </ol>
    <h2>待你确认</h2>
    <ul>
      ${ownerDecisions}
    </ul>
    <h2>保持关闭</h2>
    <ul>
      ${blockedActions}
    </ul>
    <h2>隐私边界</h2>
    <ul>
      <li>读取页面正文：${brief.boundary.reads_page_text ? "是" : "否"}</li>
      <li>导出数据库行值：${brief.boundary.includes_database_row_values ? "是" : "否"}</li>
      <li>读取文件内容：${brief.boundary.reads_file_bytes ? "是" : "否"}</li>
      <li>写关系值：${brief.boundary.creates_relation_values ? "是" : "否"}</li>
      <li>上传数据：${brief.boundary.uploads_data ? "是" : "否"}</li>
      <li>启用 AI：${brief.boundary.enables_ai ? "是" : "否"}</li>
    </ul>
  `;
}

export function buildResearchProjectPageTitle(brief: ResearchProjectBrief) {
  if (brief.topic) return `投研项目：${brief.topic}`;
  return `${brief.project_mode_label}项目简报`;
}

function buildModulePlans(
  graphReport: ResearchGraphReport,
  workbench: ResearchWorkbenchPacket
): ResearchProjectModulePlan[] {
  return RESEARCH_ASSET_KINDS.map((kind) => {
    const health = graphReport.health_summary.find((item) => item.kind === kind);
    const rollup = workbench.module_rollups.find((item) => item.kind === kind);
    const label = getResearchAssetKindLabel(kind);
    const route = getResearchModuleRoute(kind);
    const healthStatus = health?.status ?? "needs-assets";
    const readiness = getModuleReadiness(healthStatus);

    return {
      kind,
      label,
      role: MODULE_ROLES[kind],
      route,
      health_status: healthStatus,
      assets: health?.assets ?? rollup?.assets ?? 0,
      connected_assets: health?.connected_assets ?? rollup?.connected_assets ?? 0,
      unlinked_assets: health?.unlinked_assets ?? rollup?.unlinked_assets ?? 0,
      relation_links: health?.relation_links ?? rollup?.relation_links ?? 0,
      schema_gaps: health?.schema_gaps ?? rollup?.schema_gaps ?? 0,
      connection_rate: health?.connection_rate ?? rollup?.connection_rate ?? 0,
      next_action_label:
        health?.next_action.label ?? rollup?.next_action_label ?? "打开模块",
      next_action_route:
        health?.next_action.route ?? rollup?.next_action_route ?? route,
      readiness,
      privacy_boundary:
        rollup?.privacy_boundary ??
        "模块计划只使用本地图谱元数据，不包含页面正文、数据库行值、文件字节、持仓、交易计划或云端数据。",
    };
  });
}

function buildChecklist(
  input: ResearchProjectBriefInput,
  modulePlans: ResearchProjectModulePlan[]
): ResearchProjectChecklistItem[] {
  const companyPlan = getModulePlan(modulePlans, "company");
  const reportPlan = getModulePlan(modulePlans, "report");
  const meetingPlan = getModulePlan(modulePlans, "meeting");
  const portfolioPlan = getModulePlan(modulePlans, "portfolio");
  const topicReady = input.topic.trim().length > 0;

  return [
    {
      id: "project-question",
      title: "确认研究问题",
      status: topicReady ? "ready" : "missing",
      surface: "page",
      route: "/modules/notes",
      route_label: "打开笔记",
      reason: topicReady
        ? "项目主题已填写，可以围绕这个问题组织证据和行动。"
        : "先写清楚研究问题，否则公司、报告、会议和组合材料会变成松散资料。",
      owner_decision: "确认本次研究要回答的问题、时间范围和产出格式。",
      requires_owner_confirmation: !topicReady,
      writes_workspace_data: false,
      uploads_data: false,
    },
    {
      id: "company-anchor",
      title: "建立公司研究锚点",
      status: companyPlan.readiness,
      surface: "page",
      route: companyPlan.next_action_route,
      route_label: companyPlan.next_action_label,
      reason: `${companyPlan.assets} 个公司资产，${companyPlan.connection_rate}% 连接覆盖。`,
      owner_decision: "确认是否需要公司主页、投资 memo、业绩复盘或估值假设入口。",
      requires_owner_confirmation: companyPlan.readiness !== "ready",
      writes_workspace_data: false,
      uploads_data: false,
    },
    {
      id: "report-evidence",
      title: "补齐报告证据",
      status: reportPlan.readiness,
      surface: "file",
      route: reportPlan.next_action_route,
      route_label: reportPlan.next_action_label,
      reason: `${reportPlan.assets} 个报告资产，${reportPlan.unlinked_assets} 个待补关系。`,
      owner_decision: "确认 HTML、Markdown、PDF、Office 或 Notebook 报告是否需要入库和关联。",
      requires_owner_confirmation: reportPlan.readiness !== "ready",
      writes_workspace_data: false,
      uploads_data: false,
    },
    {
      id: "meeting-validation",
      title: "检查会议验证",
      status: meetingPlan.readiness,
      surface: "page",
      route: meetingPlan.next_action_route,
      route_label: meetingPlan.next_action_label,
      reason: `${meetingPlan.assets} 个会议资产，${meetingPlan.relation_links} 条会议相关连接。`,
      owner_decision: "确认是否有管理层、专家、渠道或客户会议需要转成行动项。",
      requires_owner_confirmation: meetingPlan.readiness !== "ready",
      writes_workspace_data: false,
      uploads_data: false,
    },
    {
      id: "portfolio-impact",
      title: "确认组合影响",
      status: portfolioPlan.readiness,
      surface: "database",
      route: portfolioPlan.next_action_route,
      route_label: portfolioPlan.next_action_label,
      reason: `${portfolioPlan.assets} 个组合资产，${portfolioPlan.schema_gaps} 个结构缺口。`,
      owner_decision: "确认这个研究项目是否影响观察名单、仓位备忘录、风险或催化剂复盘。",
      requires_owner_confirmation: portfolioPlan.readiness !== "ready",
      writes_workspace_data: false,
      uploads_data: false,
    },
    {
      id: "relation-repair",
      title: "修复跨模块关系",
      status:
        input.workbench.summary.relation_actions > 0
          ? "needs-review"
          : "ready",
      surface: "relation",
      route: "/modules/research-graph#research-graph-relation-handoff",
      route_label: "打开交接包",
      reason: `${input.workbench.summary.relation_actions} 个关系行动，${input.graphReport.summary.relation_handoff_packets} 个交接包。`,
      owner_decision: "确认来源页面、目标跟踪表、关系字段和行后再手动补值。",
      requires_owner_confirmation: input.workbench.summary.relation_actions > 0,
      writes_workspace_data: false,
      uploads_data: false,
    },
    {
      id: "schema-and-tracker",
      title: "补结构和跟踪表",
      status:
        input.workbench.summary.schema_actions +
          input.workbench.summary.tracker_actions >
        0
          ? "needs-review"
          : "ready",
      surface: "database",
      route: "/modules/research-graph#research-graph-schema-gaps",
      route_label: "检查结构",
      reason: `${input.workbench.summary.schema_actions} 个结构行动，${input.workbench.summary.tracker_actions} 个跟踪表行动。`,
      owner_decision: "确认是否要创建关系字段或跟踪表；不要批量写行。",
      requires_owner_confirmation:
        input.workbench.summary.schema_actions +
          input.workbench.summary.tracker_actions >
        0,
      writes_workspace_data: false,
      uploads_data: false,
    },
    {
      id: "externalization-boundary",
      title: "外发和自动化边界",
      status: "blocked-boundary",
      surface: "boundary",
      route: "/modules/sync",
      route_label: "查看边界",
      reason: "AI、云同步、批量写入和外部数据连接仍保持关闭。",
      owner_decision:
        "只有载荷预览、权限、审计、回滚和输入确认齐备后，才讨论外发或自动化。",
      requires_owner_confirmation: true,
      writes_workspace_data: false,
      uploads_data: false,
    },
  ];
}

function buildProjectReviewSequence(
  mode: ResearchProjectMode,
  workbenchSequence: ResearchWorkbenchReviewStep[]
) {
  const firstKind = MODE_FIRST_KIND[mode];
  const firstLabel = getResearchAssetKindLabel(firstKind);
  const firstRoute = getResearchModuleRoute(firstKind);

  return [
    {
      id: `project-first-${firstKind}`,
      order: 1,
      title: `先看${firstLabel}模块`,
      route: firstRoute,
      reason: getModeFirstReason(mode, firstLabel),
      completion_signal: `${firstLabel}模块的资产、断点和下一步动作已复核。`,
    },
    ...workbenchSequence.map((step, index) => ({
      ...step,
      order: index + 2,
    })),
  ];
}

function buildRequiredOwnerDecisions(
  input: ResearchProjectBriefInput,
  checklist: ResearchProjectChecklistItem[]
) {
  const manualChecklist = checklist.filter(
    (item) => item.requires_owner_confirmation
  );

  return [
    "确认研究主题、时间范围和本次输出形式。",
    ...manualChecklist.map((item) => item.owner_decision),
    input.topic.trim()
      ? "确认导出的项目简报可以包含你手动输入的主题。"
      : "如果要导出项目简报，先确认是否需要补充项目主题。",
  ];
}

function getRecommendedFirstAction(
  input: ResearchProjectBriefInput,
  modulePlans: ResearchProjectModulePlan[],
  checklist: ResearchProjectChecklistItem[]
) {
  const missingTopic = checklist.find((item) => item.id === "project-question");
  if (missingTopic?.status === "missing") {
    return {
      route: missingTopic.route,
      label: missingTopic.route_label,
    };
  }

  const firstKind = MODE_FIRST_KIND[input.projectMode];
  const modePlan = getModulePlan(modulePlans, firstKind);
  if (modePlan.readiness !== "ready") {
    return {
      route: modePlan.next_action_route,
      label: modePlan.next_action_label,
    };
  }

  const firstManual = checklist.find(
    (item) =>
      item.status === "needs-review" || item.status === "missing"
  );
  if (firstManual) {
    return {
      route: firstManual.route,
      label: firstManual.route_label,
    };
  }

  return {
    route: "/modules/research-graph#research-graph-workbench",
    label: "打开工作台",
  };
}

function getModulePlan(
  modulePlans: ResearchProjectModulePlan[],
  kind: ResearchAssetKind
) {
  const plan = modulePlans.find((item) => item.kind === kind);
  if (!plan) {
    throw new Error(`Missing research project module plan: ${kind}`);
  }
  return plan;
}

function getModuleReadiness(
  status: ResearchGraphReport["health_summary"][number]["status"]
): ResearchProjectChecklistStatus {
  if (status === "ready") return "ready";
  if (status === "needs-assets" || status === "needs-tracker") return "missing";
  return "needs-review";
}

function countChecklistStatus(
  checklist: ResearchProjectChecklistItem[],
  status: ResearchProjectChecklistStatus
) {
  return checklist.filter((item) => item.status === status).length;
}

function getProjectModeLabel(mode: ResearchProjectMode) {
  return (
    RESEARCH_PROJECT_MODE_OPTIONS.find((option) => option.id === mode)?.label ??
    "投研项目"
  );
}

function getModeFirstReason(mode: ResearchProjectMode, label: string) {
  switch (mode) {
    case "earnings-review":
      return "业绩复盘先确认公司级 thesis、业绩页面、模型影响和报告证据。";
    case "variant-view":
      return "反向观点先从报告和证据缺口开始，避免直接改写结论。";
    case "meeting-follow-up":
      return "会议跟进先处理纪要、转录、行动项和公司/报告关系。";
    case "portfolio-review":
      return "组合复盘先看观察名单、仓位 memo、风险和催化剂连接。";
    case "initiation":
    default:
      return `${label}模块是首次覆盖的起点，先建立研究锚点再补证据。`;
  }
}

function getChecklistStatusLabel(status: ResearchProjectChecklistStatus) {
  const labels: Record<ResearchProjectChecklistStatus, string> = {
    ready: "已就绪",
    "needs-review": "需复核",
    missing: "缺失",
    "blocked-boundary": "边界阻塞",
  };
  return labels[status];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
