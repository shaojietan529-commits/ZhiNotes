import { NOTE_TEMPLATES } from "@/lib/templates/noteTemplates";

export type DatabaseTemplateCatalogGroupId =
  | "company"
  | "report"
  | "meeting"
  | "portfolio";

export interface DatabaseTemplateCatalogTemplate {
  title: string;
  description: string;
  available: boolean;
}

export interface DatabaseTemplateCatalogGroup {
  id: DatabaseTemplateCatalogGroupId;
  label: string;
  recommended_database: string;
  relation_goal: string;
  row_usage: string;
  template_titles: string[];
  templates: DatabaseTemplateCatalogTemplate[];
  privacy_boundary: string;
}

export interface DatabaseTemplateCatalogReport {
  format: "zhinote-database-template-catalog";
  format_version: 1;
  report_status: "local-template-metadata-only";
  privacy_note: string;
  boundary: {
    local_catalog_only: true;
    reads_template_metadata: true;
    template_rows_read_workspace_data: false;
    reads_database_rows: false;
    includes_database_row_values: false;
    includes_page_text: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    groups: number;
    template_rows: number;
    available_template_rows: number;
    unavailable_template_rows: number;
  };
  groups: DatabaseTemplateCatalogGroup[];
}

const TEMPLATE_GROUPS: Array<
  Omit<DatabaseTemplateCatalogGroup, "templates">
> = [
  {
    id: "company",
    label: "公司研究",
    recommended_database: "公司研究跟踪表",
    relation_goal: "把公司主页、投资备忘录、业绩复盘、估值假设、关键指标、行业对比和决策日志连接到报告与会议。",
    row_usage: "适合在公司跟踪表中创建公司级研究资产行，后续补公司页面、关联报告、关联会议和复盘结论关系。",
    template_titles: [
      "公司研究",
      "投资备忘录",
      "业绩复盘",
      "估值假设",
      "关键指标看板",
      "行业对比",
      "投研决策日志",
    ],
    privacy_boundary: "模板目录只列出模板标题和用途，不读取公司页面正文、ticker、估值假设或数据库行值。",
  },
  {
    id: "report",
    label: "报告库",
    recommended_database: "报告库跟踪表",
    relation_goal: "把 HTML、Markdown、PDF、Office、notebook 等本地报告资产接入公司和会议上下文。",
    row_usage: "适合在报告跟踪表中创建报告复盘行，后续补报告页面、公司页面、关联会议和关键结论。",
    template_titles: ["研究报告", "报告摄取清单"],
    privacy_boundary: "模板目录不读取报告正文、文件 bytes、文件名、文件文本或报告数据库行值。",
  },
  {
    id: "meeting",
    label: "会议与电话会",
    recommended_database: "会议跟踪表",
    relation_goal: "把会议纪要、转录稿、行动项、专家电话和管理层会议连接到公司、报告和后续研究动作。",
    row_usage: "适合在会议跟踪表中创建会议资产行，后续补会议纪要、转录稿页面、行动项、专家或管理层来源、公司页面和关联报告。",
    template_titles: [
      "会议纪要",
      "会议转录稿",
      "会议行动项",
      "专家电话纪要",
      "管理层会议纪要",
    ],
    privacy_boundary: "模板目录不读取会议正文、转录稿、录音 bytes、参会人详情、会议链接或会议密码。",
  },
  {
    id: "portfolio",
    label: "组合与观察名单",
    recommended_database: "组合跟踪表",
    relation_goal: "把持仓备忘录、观察名单、催化剂和风险复盘连接回公司、报告和会议。",
    row_usage: "适合在组合跟踪表中创建脱敏结构行，后续手动补关联备忘录、公司页面、关联报告和关联会议。",
    template_titles: ["持仓备忘录", "观察名单", "催化剂与风险复盘"],
    privacy_boundary: "模板目录不读取或导出持仓名、ticker、权重、交易计划、交易记录、券商账户或价格源。",
  },
];

export function buildDatabaseTemplateCatalogReport(): DatabaseTemplateCatalogReport {
  const groups = TEMPLATE_GROUPS.map((group) => ({
    ...group,
    templates: group.template_titles.map((title) => {
      const template = NOTE_TEMPLATES.find((item) => item.title === title);
      return {
        title,
        description: template?.description ?? "模板尚未注册",
        available: Boolean(template),
      };
    }),
  }));
  const templates = groups.flatMap((group) => group.templates);

  return {
    format: "zhinote-database-template-catalog",
    format_version: 1,
    report_status: "local-template-metadata-only",
    privacy_note:
      "只由已注册的笔记模板元数据在本地生成。它不读取数据库行、页面正文、文件字节、私人投资细节、云端数据或 AI prompt。",
    boundary: {
      local_catalog_only: true,
      reads_template_metadata: true,
      template_rows_read_workspace_data: false,
      reads_database_rows: false,
      includes_database_row_values: false,
      includes_page_text: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      groups: groups.length,
      template_rows: templates.length,
      available_template_rows: templates.filter((template) => template.available)
        .length,
      unavailable_template_rows: templates.filter((template) => !template.available)
        .length,
    },
    groups,
  };
}
