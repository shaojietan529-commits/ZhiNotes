export type ResearchAssetKind = "company" | "report" | "meeting" | "portfolio";

export interface ResearchWorkflowStage {
  id: string;
  title: string;
  detail: string;
  surface: "page" | "database" | "file" | "relation";
}

export interface ResearchWorkflowSpec {
  kind: ResearchAssetKind;
  label: string;
  module_route: string;
  primary_database_preset: string;
  primary_assets: string[];
  required_relation_kinds: ResearchAssetKind[];
  key_tracker_fields: string[];
  stages: ResearchWorkflowStage[];
  privacy_boundary: string;
}

export const RESEARCH_ASSET_KINDS: ResearchAssetKind[] = [
  "company",
  "report",
  "meeting",
  "portfolio",
];

export const RESEARCH_WORKFLOW_SPECS: Record<
  ResearchAssetKind,
  ResearchWorkflowSpec
> = {
  company: {
    kind: "company",
    label: "公司",
    module_route: "/modules/company-research",
    primary_database_preset: "company-research",
    primary_assets: ["公司主页", "投资备忘录", "业绩复盘", "估值假设"],
    required_relation_kinds: ["report", "meeting"],
    key_tracker_fields: [
      "股票代码",
      "公司页",
      "行业",
      "状态",
      "评级",
      "下一催化剂",
      "投资假设",
      "估值假设",
      "关键指标",
      "关联报告",
      "关联会议",
    ],
    stages: [
      {
        id: "company-home",
        title: "公司主页",
        detail: "长期研究中枢，承载商业模式、行业结构、关键指标和开放问题。",
        surface: "page",
      },
      {
        id: "memo",
        title: "投资备忘录",
        detail: "沉淀投资假设、估值、风险、催化剂和下一步动作。",
        surface: "page",
      },
      {
        id: "earnings-review",
        title: "业绩复盘",
        detail: "记录季度数据、管理层表述、模型影响和后续问题。",
        surface: "page",
      },
      {
        id: "company-relations",
        title: "研究关联",
        detail: "用 relation 连接相关报告和会议，形成公司级研究上下文。",
        surface: "relation",
      },
    ],
    privacy_boundary: "只创建和读取本地页面、数据库字段、关系和文件块；不上传公司研究内容。",
  },
  report: {
    kind: "report",
    label: "报告",
    module_route: "/modules/reports",
    primary_database_preset: "report-library",
    primary_assets: ["HTML 报告", "Markdown 笔记", "PDF", "Office 文件", "Notebook"],
    required_relation_kinds: ["company", "meeting"],
    key_tracker_fields: [
      "Report page",
      "Company page",
      "Format",
      "Status",
      "Report date",
      "Source",
      "Key takeaways",
      "Thesis impact",
      "Model impact",
      "Related meetings",
      "Related memo",
    ],
    stages: [
      {
        id: "capture-report",
        title: "收集报告",
        detail: "把本地文件挂到报告页，保留来源、格式和阅读状态。",
        surface: "file",
      },
      {
        id: "review-report",
        title: "复盘总结",
        detail: "提炼核心结论、对 thesis 的影响、模型影响和待回答问题。",
        surface: "page",
      },
      {
        id: "report-tracker",
        title: "报告跟踪表",
        detail: "用本地数据库跟踪报告状态、格式、来源和 review 节奏。",
        surface: "database",
      },
      {
        id: "report-relations",
        title: "关联研究",
        detail: "把报告关联到公司、会议、备忘录和后续研究动作。",
        surface: "relation",
      },
    ],
    privacy_boundary: "文件预览和转换留在浏览器本地；外部资源、AI 和云同步需要单独确认。",
  },
  meeting: {
    kind: "meeting",
    label: "会议",
    module_route: "/modules/meetings",
    primary_database_preset: "meeting-tracker",
    primary_assets: ["会议纪要", "转录稿", "行动项", "会议跟踪表"],
    required_relation_kinds: ["company", "report"],
    key_tracker_fields: [
      "日期",
      "公司",
      "公司页",
      "会议页",
      "类型",
      "平台",
      "状态",
      "需要 follow-up",
      "行动项",
      "转录稿页面",
      "关联报告",
    ],
    stages: [
      {
        id: "meeting-context",
        title: "日程与背景",
        detail: "记录平台、组织者、公司、议程和会前研究问题。",
        surface: "database",
      },
      {
        id: "meeting-notes",
        title: "纪要与转录",
        detail: "把原始转录、关键表述、决策和会议观察放入本地页面。",
        surface: "page",
      },
      {
        id: "meeting-actions",
        title: "行动项",
        detail: "跟踪 follow-up、开放问题、模型调整和负责人。",
        surface: "database",
      },
      {
        id: "meeting-relations",
        title: "研究关联",
        detail: "把会议关联回公司页面、报告、备忘录和业绩复盘。",
        surface: "relation",
      },
    ],
    privacy_boundary: "当前只管理本地会议页面和跟踪表；不会自动入会、录音、上传或调用 AI。",
  },
  portfolio: {
    kind: "portfolio",
    label: "组合",
    module_route: "/modules/portfolio",
    primary_database_preset: "portfolio-tracker",
    primary_assets: ["持仓记录", "观察名单", "仓位 memo", "催化剂复盘"],
    required_relation_kinds: ["company", "report", "meeting"],
    key_tracker_fields: [
      "股票代码",
      "公司页",
      "状态",
      "组合角色",
      "方向",
      "确信度",
      "目标权重",
      "当前权重",
      "下一催化剂",
      "投资假设",
      "风险笔记",
      "关联报告",
      "关联会议",
    ],
    stages: [
      {
        id: "portfolio-watchlist",
        title: "观察名单",
        detail: "记录潜在标的、方向、确信度、催化剂和研究状态。",
        surface: "database",
      },
      {
        id: "position-memo",
        title: "仓位 memo",
        detail: "跟踪 thesis、风险、目标仓位、目标价和 downside。",
        surface: "page",
      },
      {
        id: "portfolio-review",
        title: "组合复盘",
        detail: "围绕状态、仓位、催化剂和风险做周期性 review。",
        surface: "database",
      },
      {
        id: "portfolio-relations",
        title: "关联研究",
        detail: "把组合条目关联到公司、报告、会议和研究 memo。",
        surface: "relation",
      },
    ],
    privacy_boundary: "当前不连接券商、价格源或云分享；持仓和观察名单数据留在本地。",
  },
};

export function getResearchWorkflowSpec(kind: ResearchAssetKind) {
  return RESEARCH_WORKFLOW_SPECS[kind];
}

export function getResearchAssetKindLabel(kind: ResearchAssetKind) {
  return RESEARCH_WORKFLOW_SPECS[kind].label;
}

export function getResearchModuleRoute(kind: ResearchAssetKind) {
  return RESEARCH_WORKFLOW_SPECS[kind].module_route;
}

export function getExpectedRelationKinds(kind: ResearchAssetKind) {
  return RESEARCH_WORKFLOW_SPECS[kind].required_relation_kinds;
}
