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
        "Company-level research tracker for coverage status, catalysts, thesis, valuation assumptions, linked reports, and linked meetings.",
    });
    await addPresetFields(databaseId, [
      { name: "Ticker", fieldType: "text" },
      { name: "Company page", fieldType: "relation" },
      {
        name: "Sector",
        fieldType: "select",
        options: [
          "Software",
          "Internet",
          "Consumer",
          "Financials",
          "Healthcare",
          "Industrials",
          "Energy",
        ],
      },
      {
        name: "Status",
        fieldType: "status",
        options: ["Idea", "Researching", "Active coverage", "Watchlist", "Archived"],
      },
      {
        name: "Rating",
        fieldType: "select",
        options: ["Bullish", "Neutral", "Bearish", "Avoid"],
      },
      { name: "Next catalyst", fieldType: "date" },
      { name: "Thesis", fieldType: "text" },
      { name: "Valuation assumptions", fieldType: "text" },
      { name: "Key metrics", fieldType: "text" },
      { name: "Latest report", fieldType: "url" },
      { name: "Related reports", fieldType: "relation" },
      { name: "Related meetings", fieldType: "relation" },
    ]);
    await addPresetViews(databaseId, [
      { name: "Status board", viewType: "kanban" },
      { name: "Catalyst timeline", viewType: "timeline" },
      { name: "Valuation watchlist", viewType: "table" },
      { name: "状态分布", viewType: "chart" },
      { name: "Research feed", viewType: "feed" },
    ]);
    return updateDatabase(databaseId, {});
  }

  if (preset === "report-library") {
    await updateDatabase(databaseId, {
      description:
        "Local report library tracker for HTML reports, PDFs, Office files, notebooks, archives, takeaways, thesis impact, and linked research.",
    });
    await addPresetFields(databaseId, [
      { name: "Report page", fieldType: "relation" },
      { name: "Company page", fieldType: "relation" },
      {
        name: "Format",
        fieldType: "select",
        options: [
          "HTML",
          "Markdown",
          "PDF",
          "Excel",
          "Word",
          "PowerPoint",
          "Notebook",
          "Archive",
          "Other",
        ],
      },
      {
        name: "Status",
        fieldType: "status",
        options: ["Inbox", "Reviewing", "Summarized", "Linked", "Archived"],
      },
      { name: "Report date", fieldType: "date" },
      { name: "Source", fieldType: "text" },
      { name: "External source", fieldType: "url" },
      { name: "Key takeaways", fieldType: "text" },
      { name: "Thesis impact", fieldType: "text" },
      { name: "Model impact", fieldType: "text" },
      { name: "Related meetings", fieldType: "relation" },
      { name: "Related memo", fieldType: "relation" },
    ]);
    await addPresetViews(databaseId, [
      { name: "Report table", viewType: "table" },
      { name: "Review board", viewType: "kanban" },
      { name: "Format gallery", viewType: "gallery" },
      { name: "格式分布", viewType: "chart" },
      { name: "Recent reports", viewType: "feed" },
    ]);
    return updateDatabase(databaseId, {});
  }

  if (preset === "portfolio-tracker") {
    await updateDatabase(databaseId, {
      description:
        "Local portfolio and watchlist tracker for position status, sizing, thesis, catalysts, risks, and linked research.",
    });
    await addPresetFields(databaseId, [
      { name: "Ticker", fieldType: "text" },
      { name: "Company page", fieldType: "relation" },
      {
        name: "Status",
        fieldType: "status",
        options: ["Watchlist", "Researching", "Active", "Trimming", "Exited", "Avoid"],
      },
      {
        name: "Portfolio role",
        fieldType: "select",
        options: ["Core", "Satellite", "Hedge", "Event", "Short candidate", "Cash proxy"],
      },
      {
        name: "Direction",
        fieldType: "select",
        options: ["Long", "Short", "Pair", "Neutral"],
      },
      {
        name: "Conviction",
        fieldType: "select",
        options: ["High", "Medium", "Low", "Review"],
      },
      { name: "Target weight", fieldType: "number" },
      { name: "Current weight", fieldType: "number" },
      { name: "Entry price", fieldType: "number" },
      { name: "Target price", fieldType: "number" },
      { name: "Downside price", fieldType: "number" },
      { name: "Next catalyst", fieldType: "date" },
      { name: "Thesis", fieldType: "text" },
      { name: "Risk notes", fieldType: "text" },
      { name: "Related memo", fieldType: "relation" },
      { name: "Related reports", fieldType: "relation" },
      { name: "Related meetings", fieldType: "relation" },
    ]);
    await addPresetViews(databaseId, [
      { name: "Portfolio table", viewType: "table" },
      { name: "Status board", viewType: "kanban" },
      { name: "Catalyst timeline", viewType: "timeline" },
      { name: "Sizing watchlist", viewType: "table" },
      { name: "持仓状态分布", viewType: "chart" },
      { name: "Position review", viewType: "feed" },
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
