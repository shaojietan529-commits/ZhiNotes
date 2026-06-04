export type ModuleStatus = "active" | "beta" | "planned";

export type ModuleCategory =
  | "Workspace"
  | "Research"
  | "Data"
  | "Automation";

export interface PlatformModule {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  category: ModuleCategory;
  status: ModuleStatus;
  route: string | null;
  icon: string;
  capabilities: string[];
  dataSurfaces: string[];
  extensionSlots: string[];
  starter: ModuleStarter | null;
}

export type ModuleStarter =
  | {
      type: "route";
      label: string;
      route: string;
    }
  | {
      type: "page";
      label: string;
      title: string;
      templateTitle?: string;
      icon?: string;
    }
  | {
      type: "database";
      label: string;
      title: string;
      icon?: string;
    }
  | {
      type: "workspace";
      label: string;
      title: string;
      preset:
        | "company-research"
        | "meeting-tracker"
        | "report-library"
        | "portfolio-tracker";
      icon?: string;
    };

export const MODULE_EXTENSION_SLOTS = [
  {
    id: "sidebar.navigation",
    title: "侧边栏导航",
    description: "给模块增加入口，同时不打断现有页面和数据库流程。",
  },
  {
    id: "quick-search.actions",
    title: "命令面板动作",
    description: "让模块可以通过 Cmd/Ctrl+K 暴露可搜索动作。",
  },
  {
    id: "page.blocks",
    title: "页面块",
    description: "让模块可以在笔记里增加斜杠菜单块。",
  },
  {
    id: "database.views",
    title: "数据库视图",
    description: "让模块可以增加表格、看板、时间线或报告类视图。",
  },
  {
    id: "file.renderers",
    title: "文件渲染器",
    description: "让模块可以在本地预览和导入新的文件格式。",
  },
] as const;

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "notes",
    title: "笔记与页面",
    shortTitle: "笔记",
    description:
      "类似 Notion 的投研页面、Markdown 笔记、页面链接、反向链接、评论和版本历史。",
    category: "Workspace",
    status: "active",
    route: "/modules/notes",
    icon: "NOTE",
    capabilities: [
      "独立模块页面",
      "笔记工作台",
      "投研结构总览",
      "页面树",
      "斜杠菜单",
      "反向链接",
      "版本历史",
      "Markdown 导入导出",
    ],
    dataSurfaces: ["pages", "wiki_links", "page_versions", "comments"],
    extensionSlots: ["sidebar.navigation", "quick-search.actions", "page.blocks"],
    starter: {
      type: "page",
      label: "新建笔记",
      title: "未命名研究笔记",
    },
  },
  {
    id: "databases",
    title: "投研数据库",
    shortTitle: "数据库",
    description:
      "本地表格、看板、日历、画廊、时间线、表单、动态流视图和 CSV/XLSX 工作流。",
    category: "Data",
    status: "active",
    route: "/modules/databases",
    icon: "DB",
    capabilities: [
      "独立模块页面",
      "表格/列表/看板视图",
      "CSV/XLSX 导出",
      "表格文件导入",
      "视图覆盖总览",
      "本地 schema dashboard",
      "数据库模板",
    ],
    dataSurfaces: ["databases", "database_fields", "database_rows", "database_views"],
    extensionSlots: ["sidebar.navigation", "quick-search.actions", "database.views"],
    starter: {
      type: "database",
      label: "新建数据库",
      title: "未命名投研数据库",
      icon: "DB",
    },
  },
  {
    id: "reports",
    title: "报告库",
    shortTitle: "报告",
    description:
      "本地预览 AI 生成的 HTML 报告、PDF、Office 文档、notebook 和压缩包。",
    category: "Research",
    status: "beta",
    route: "/modules/reports",
    icon: "RPT",
    capabilities: [
      "独立模块页面",
      "HTML 报告沙盒",
      "PDF 预览",
      "Office 导入",
      "Notebook 预览",
      "本地文件存储",
      "报告关联跟踪",
    ],
    dataSurfaces: [
      "pages",
      "page file blocks",
      "IndexedDB files",
      "workspace ZIP assets",
      "relations",
      "databases",
    ],
    extensionSlots: [
      "sidebar.navigation",
      "quick-search.actions",
      "page.blocks",
      "file.renderers",
      "database.views",
    ],
    starter: {
      type: "workspace",
      label: "创建报告跟踪表",
      title: "报告库跟踪表",
      preset: "report-library",
      icon: "RPT",
    },
  },
  {
    id: "company-research",
    title: "公司研究",
    shortTitle: "公司",
    description:
      "公司主页、投资备忘录、业绩复盘、估值假设和跟踪事项。",
    category: "Research",
    status: "beta",
    route: "/modules/company-research",
    icon: "CO",
    capabilities: [
      "公司主页",
      "投资备忘录模板",
      "业绩复盘模板",
      "估值假设",
      "关联报告和数据库",
    ],
    dataSurfaces: ["pages", "databases", "files", "wiki_links"],
    extensionSlots: ["sidebar.navigation", "quick-search.actions", "database.views"],
    starter: {
      type: "workspace",
      label: "创建公司跟踪表",
      title: "公司研究跟踪表",
      preset: "company-research",
      icon: "CO",
    },
  },
  {
    id: "portfolio",
    title: "组合与观察名单",
    shortTitle: "组合",
    description:
      "本地持仓、观察名单、仓位、催化剂、投资假设和风险跟踪，并关联研究资料。",
    category: "Research",
    status: "beta",
    route: "/modules/portfolio",
    icon: "PF",
    capabilities: [
      "持仓跟踪",
      "观察名单流程",
      "仓位笔记",
      "催化剂跟踪",
      "关联研究资料",
    ],
    dataSurfaces: ["pages", "databases", "relations", "reports", "meetings"],
    extensionSlots: ["sidebar.navigation", "quick-search.actions", "database.views"],
    starter: {
      type: "workspace",
      label: "创建组合跟踪表",
      title: "组合跟踪表",
      preset: "portfolio-tracker",
      icon: "PF",
    },
  },
  {
    id: "meetings",
    title: "会议与电话会",
    shortTitle: "会议",
    description:
      "会议纪要、管理层电话会记录、行动项，以及与公司和报告的关联。",
    category: "Research",
    status: "beta",
    route: "/modules/meetings",
    icon: "MTG",
    capabilities: [
      "独立模块页面",
      "会议纪要模板",
      "行动项跟踪",
      "公司关联",
      "Transcript 附件",
      "报告和公司关系",
    ],
    dataSurfaces: ["pages", "comments", "files", "databases", "relations"],
    extensionSlots: [
      "sidebar.navigation",
      "quick-search.actions",
      "page.blocks",
      "file.renderers",
      "database.views",
    ],
    starter: {
      type: "workspace",
      label: "创建会议跟踪表",
      title: "会议跟踪表",
      preset: "meeting-tracker",
      icon: "MTG",
    },
  },
  {
    id: "research-graph",
    title: "研究图谱",
    shortTitle: "图谱",
    description:
      "集中查看公司、报告、会议和组合之间的本地 relation 连接、覆盖率和待补全资产。",
    category: "Research",
    status: "beta",
    route: "/modules/research-graph",
    icon: "MAP",
    capabilities: [
      "跨模块关系总览",
      "资产覆盖率",
      "待补全资产",
      "Relation 连接清单",
      "本地图谱报告导出",
      "隐私边界可见",
    ],
    dataSurfaces: [
      "pages",
      "databases",
      "database_fields",
      "database_rows",
      "relations",
    ],
    extensionSlots: ["sidebar.navigation", "quick-search.actions", "database.views"],
    starter: null,
  },
  {
    id: "ai-workbench",
    title: "AI 工作台",
    shortTitle: "AI",
    description:
      "本地暂存 AI 请求，用于总结、问答、报告生成、文件对比和研究框架。",
    category: "Automation",
    status: "planned",
    route: "/modules/ai",
    icon: "AI",
    capabilities: [
      "本地上下文选择",
      "隐私确认",
      "AI payload 预览",
      "AI 执行策略",
      "禁用的 AI 运行 API",
      "请求草稿",
      "报告生成计划",
      "问答计划",
      "文档对比计划",
    ],
    dataSurfaces: ["pages", "files", "databases", "reports"],
    extensionSlots: ["sidebar.navigation", "quick-search.actions", "page.blocks"],
    starter: null,
  },
  {
    id: "sync",
    title: "Web 同步与权限",
    shortTitle: "同步",
    description:
      "本地 Web Beta 准备面板，用于备份、同步队列、恢复规划和权限边界。",
    category: "Workspace",
    status: "planned",
    route: "/modules/sync",
    icon: "SYNC",
    capabilities: [
      "本地备份导出",
      "同步队列可见性",
      "同步 payload 预览",
      "同步 replay 测试计划",
      "本地工作区身份",
      "账号 session 边界",
      "恢复规划",
      "恢复回滚计划",
      "恢复写入合同",
      "权限检查清单",
      "权限决策预览",
      "认证禁用路由 stub",
      "禁用 API 路由 stub",
      "云 schema 迁移计划",
      "云迁移 SQL 草稿",
      "环境 preflight",
      "Web Beta 上线清单",
      "审计轨迹策略",
      "禁用审计事件 API",
      "冲突处理计划",
      "冲突 review scaffold",
      "Web Beta 合同",
      "准备度报告",
    ],
    dataSurfaces: ["pages", "databases", "files", "sync_log", "workspace backup"],
    extensionSlots: ["sidebar.navigation", "quick-search.actions"],
    starter: null,
  },
];

export function getModulesByStatus(status: ModuleStatus) {
  return PLATFORM_MODULES.filter((module) => module.status === status);
}

export function getRoutableModules() {
  return PLATFORM_MODULES.filter((module) => Boolean(module.route));
}

export function getModuleStatusLabel(status: ModuleStatus) {
  switch (status) {
    case "active":
      return "已启用";
    case "beta":
      return "Beta";
    case "planned":
      return "规划中";
  }
}

export function getModuleCategoryLabel(category: ModuleCategory) {
  switch (category) {
    case "Workspace":
      return "工作区";
    case "Research":
      return "投研";
    case "Data":
      return "数据";
    case "Automation":
      return "自动化";
  }
}
