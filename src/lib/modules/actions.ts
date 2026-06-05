import {
  addField,
  addView,
  createDatabase,
  createPage,
  updateDatabase,
  updatePage,
} from "@/lib/db/local/queries";
import { NOTE_TEMPLATES } from "@/lib/templates/noteTemplates";
import type { Database, Page } from "@/lib/utils/types";
import type { ModuleStarter } from "./registry";

export interface ModuleStarterResult {
  kind: "route" | "page" | "database";
  route: string;
  page?: Page;
  database?: Database;
}

interface PresetField {
  name: string;
  fieldType: string;
  options?: string[];
}

interface PresetView {
  name: string;
  viewType:
    | "table"
    | "list"
    | "kanban"
    | "calendar"
    | "gallery"
    | "timeline"
    | "chart"
    | "form"
    | "feed";
}

export async function executeModuleStarter(
  starter: ModuleStarter
): Promise<ModuleStarterResult> {
  if (starter.type === "route") {
    return {
      kind: "route",
      route: starter.route,
    };
  }

  if (starter.type === "database") {
    const database = await createDatabase({
      title: starter.title,
      icon: starter.icon,
    });
    return {
      kind: "database",
      route: `/database/${database.id}`,
      database,
    };
  }

  if (starter.type === "workspace") {
    const database = await createDatabase({
      title: starter.title,
      icon: starter.icon,
    });
    const configuredDatabase =
      (await applyWorkspacePreset(database.id, starter.preset)) ?? database;
    return {
      kind: "database",
      route: `/database/${database.id}`,
      database: configuredDatabase,
    };
  }

  const page = await createPage({
    title: starter.title,
    icon: starter.icon,
  });

  if (starter.templateTitle) {
    const templateTitle = starter.templateTitle;
    const template = NOTE_TEMPLATES.find(
      (item) =>
        item.title === templateTitle ||
        item.aliases.includes(templateTitle)
    );
    if (template) {
      await updatePage(page.id, { content_text: template.html });
    }
  }

  return {
    kind: "page",
    route: `/page/${page.id}`,
    page,
  };
}

async function applyWorkspacePreset(
  databaseId: string,
  preset:
    | "company-research"
    | "project-tracker"
    | "meeting-tracker"
    | "report-library"
    | "portfolio-tracker"
): Promise<Database | null> {
  if (preset === "project-tracker") {
    await updateDatabase(databaseId, {
      description:
        "Local research project tracker for project briefs, status, mode, horizon, owner confirmation, and links to companies, reports, meetings, and portfolio review.",
    });
    await addPresetFields(databaseId, [
      { name: "Project page", fieldType: "relation" },
      {
        name: "Status",
        fieldType: "status",
        options: ["Idea", "Scoping", "Researching", "Review", "Decision", "Archived"],
      },
      {
        name: "Project mode",
        fieldType: "select",
        options: [
          "First coverage",
          "Earnings review",
          "Variant view",
          "Meeting follow-up",
          "Portfolio review",
        ],
      },
      {
        name: "Priority",
        fieldType: "select",
        options: ["High", "Medium", "Low", "Paused"],
      },
      { name: "Horizon", fieldType: "text" },
      { name: "Next review", fieldType: "date" },
      { name: "Research question", fieldType: "text" },
      { name: "Owner confirmation", fieldType: "checkbox" },
      { name: "Related companies", fieldType: "relation" },
      { name: "Related reports", fieldType: "relation" },
      { name: "Related meetings", fieldType: "relation" },
      { name: "Related portfolio", fieldType: "relation" },
      { name: "Decision memo", fieldType: "relation" },
      { name: "Next action", fieldType: "text" },
    ]);
    await addPresetViews(databaseId, [
      { name: "Project table", viewType: "table" },
      { name: "Status board", viewType: "kanban" },
      { name: "Review calendar", viewType: "calendar" },
      { name: "Priority feed", viewType: "feed" },
      { name: "项目状态分布", viewType: "chart" },
    ]);
    return updateDatabase(databaseId, {});
  }

  if (preset === "company-research") {
    await updateDatabase(databaseId, {
      description:
        "公司级研究跟踪表，用来管理覆盖状态、催化剂、投资假设、估值假设、关联报告和关联会议。",
    });
    await addPresetFields(databaseId, [
      { name: "股票代码", fieldType: "text" },
      { name: "公司页", fieldType: "relation" },
      {
        name: "行业",
        fieldType: "select",
        options: [
          "软件",
          "互联网",
          "消费",
          "金融",
          "医疗健康",
          "工业",
          "能源",
        ],
      },
      {
        name: "状态",
        fieldType: "status",
        options: ["想法", "研究中", "正式覆盖", "观察名单", "已归档"],
      },
      {
        name: "评级",
        fieldType: "select",
        options: ["看多", "中性", "看空", "回避"],
      },
      { name: "下一催化剂", fieldType: "date" },
      { name: "投资假设", fieldType: "text" },
      { name: "估值假设", fieldType: "text" },
      { name: "关键指标", fieldType: "text" },
      { name: "最新报告", fieldType: "url" },
      { name: "关联报告", fieldType: "relation" },
      { name: "关联会议", fieldType: "relation" },
    ]);
    await addPresetViews(databaseId, [
      { name: "状态看板", viewType: "kanban" },
      { name: "催化剂时间线", viewType: "timeline" },
      { name: "估值观察", viewType: "table" },
      { name: "状态分布", viewType: "chart" },
      { name: "研究动态", viewType: "feed" },
    ]);
    return updateDatabase(databaseId, {});
  }

  if (preset === "report-library") {
    await updateDatabase(databaseId, {
      description:
        "本地报告库跟踪表，用来管理 HTML 报告、PDF、Office 文件、notebook、压缩包、核心结论、投资假设影响和关联研究。",
    });
    await addPresetFields(databaseId, [
      { name: "报告页", fieldType: "relation" },
      { name: "公司页", fieldType: "relation" },
      {
        name: "格式",
        fieldType: "select",
        options: [
          "HTML",
          "Markdown",
          "PDF",
          "Excel",
          "Word",
          "PowerPoint",
          "Notebook",
          "压缩包",
          "其他",
        ],
      },
      {
        name: "状态",
        fieldType: "status",
        options: ["收件箱", "复核中", "已总结", "已关联", "已归档"],
      },
      { name: "报告日期", fieldType: "date" },
      { name: "来源", fieldType: "text" },
      { name: "外部来源", fieldType: "url" },
      { name: "核心结论", fieldType: "text" },
      { name: "投资假设影响", fieldType: "text" },
      { name: "模型影响", fieldType: "text" },
      { name: "关联会议", fieldType: "relation" },
      { name: "关联备忘录", fieldType: "relation" },
    ]);
    await addPresetViews(databaseId, [
      { name: "报告表", viewType: "table" },
      { name: "复核看板", viewType: "kanban" },
      { name: "格式画廊", viewType: "gallery" },
      { name: "格式分布", viewType: "chart" },
      { name: "最近报告", viewType: "feed" },
    ]);
    return updateDatabase(databaseId, {});
  }

  if (preset === "portfolio-tracker") {
    await updateDatabase(databaseId, {
      description:
        "本地组合与观察名单跟踪表，用来管理状态、仓位纪律、投资假设、催化剂、风险和关联研究。",
    });
    await addPresetFields(databaseId, [
      { name: "股票代码", fieldType: "text" },
      { name: "公司页", fieldType: "relation" },
      {
        name: "状态",
        fieldType: "status",
        options: ["观察名单", "研究中", "持仓中", "降仓中", "已退出", "回避"],
      },
      {
        name: "组合角色",
        fieldType: "select",
        options: ["核心", "卫星", "对冲", "事件驱动", "潜在做空", "现金替代"],
      },
      {
        name: "方向",
        fieldType: "select",
        options: ["做多", "做空", "配对", "中性"],
      },
      {
        name: "确信度",
        fieldType: "select",
        options: ["高", "中", "低", "复核中"],
      },
      { name: "目标权重", fieldType: "number" },
      { name: "当前权重", fieldType: "number" },
      { name: "建仓价", fieldType: "number" },
      { name: "目标价", fieldType: "number" },
      { name: "下行价", fieldType: "number" },
      { name: "下一催化剂", fieldType: "date" },
      { name: "投资假设", fieldType: "text" },
      { name: "风险笔记", fieldType: "text" },
      { name: "关联备忘录", fieldType: "relation" },
      { name: "关联报告", fieldType: "relation" },
      { name: "关联会议", fieldType: "relation" },
    ]);
    await addPresetViews(databaseId, [
      { name: "组合表", viewType: "table" },
      { name: "状态看板", viewType: "kanban" },
      { name: "催化剂时间线", viewType: "timeline" },
      { name: "仓位观察", viewType: "table" },
      { name: "持仓状态分布", viewType: "chart" },
      { name: "持仓复盘", viewType: "feed" },
    ]);
    return updateDatabase(databaseId, {});
  }

  await updateDatabase(databaseId, {
    description:
      "Meeting and call tracker for schedules, meeting notes, transcripts, action items, follow-ups, and linked company research.",
  });
  await addPresetFields(databaseId, [
    { name: "Date", fieldType: "date" },
    { name: "Company", fieldType: "text" },
    { name: "Company page", fieldType: "relation" },
    { name: "Meeting note", fieldType: "relation" },
    {
      name: "Type",
      fieldType: "select",
      options: ["Management call", "Earnings call", "Expert call", "Internal review"],
    },
    {
      name: "Platform",
      fieldType: "select",
      options: ["Zoom", "Tencent Meeting", "Webex", "Jinmen Finance", "In person", "Other"],
    },
    {
      name: "Status",
      fieldType: "status",
      options: [
        "Scheduled",
        "Recorded",
        "Transcribed",
        "Notes to process",
        "Follow-up",
        "Done",
      ],
    },
    { name: "Follow-up needed", fieldType: "checkbox" },
    { name: "Action items", fieldType: "text" },
    { name: "Transcript page", fieldType: "relation" },
    { name: "Recording link", fieldType: "url" },
    { name: "Related report", fieldType: "relation" },
  ]);
  await addPresetViews(databaseId, [
    { name: "Calendar", viewType: "calendar" },
    { name: "Follow-up board", viewType: "kanban" },
    { name: "Transcript queue", viewType: "table" },
    { name: "会议状态分布", viewType: "chart" },
    { name: "Recent calls", viewType: "feed" },
  ]);
  return updateDatabase(databaseId, {});
}

async function addPresetFields(databaseId: string, fields: PresetField[]) {
  for (const field of fields) {
    await addField(databaseId, {
      name: field.name,
      fieldType: field.fieldType,
      config: field.options ? JSON.stringify({ options: field.options }) : undefined,
    });
  }
}

async function addPresetViews(databaseId: string, views: PresetView[]) {
  for (const view of views) {
    await addView(databaseId, {
      name: view.name,
      viewType: view.viewType,
    });
  }
}
