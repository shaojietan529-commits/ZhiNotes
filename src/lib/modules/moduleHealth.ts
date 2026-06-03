import { PLATFORM_MODULES, type ModuleStatus } from "@/lib/modules/registry";

export type ModuleHealthStatus = "ready" | "partial" | "blocked";

export type ModuleHealthAreaId =
  | "module-platform"
  | "notes"
  | "databases"
  | "files-reports"
  | "company-research"
  | "meetings"
  | "portfolio"
  | "research-graph"
  | "ai"
  | "web-beta";

export interface ModuleHealthArea {
  id: ModuleHealthAreaId;
  title: string;
  status: ModuleHealthStatus;
  phase: "phase-1" | "phase-2" | "phase-3" | "phase-4" | "phase-5";
  module_ids: string[];
  evidence: string;
  next_action: string;
  privacy_boundary: string;
}

export interface ModuleHealthReport {
  format: "zhinote-module-health-report";
  format_version: 1;
  report_status: "local-module-health-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_registry_metadata_only: true;
    reads_page_text: false;
    reads_database_rows: false;
    reads_file_bytes: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    areas: number;
    ready: number;
    partial: number;
    blocked: number;
    registry_modules: number;
    active_modules: number;
    beta_modules: number;
    planned_modules: number;
  };
  areas: ModuleHealthArea[];
}

export function buildModuleHealthReport(): ModuleHealthReport {
  const areas = buildHealthAreas();

  return {
    format: "zhinote-module-health-report",
    format_version: 1,
    report_status: "local-module-health-only",
    privacy_note:
      "Generated locally from module registry metadata. This report maps product goals to module coverage and gaps only. It does not read page text, database rows, file bytes, prompts, tokens, credentials, cloud data, or private research content.",
    boundary: {
      local_report_only: true,
      reads_registry_metadata_only: true,
      reads_page_text: false,
      reads_database_rows: false,
      reads_file_bytes: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: summarizeAreas(areas),
    areas,
  };
}

function buildHealthAreas(): ModuleHealthArea[] {
  return [
    {
      id: "module-platform",
      title: "模块化平台底座",
      status: hasModules(["notes", "databases", "reports", "company-research"])
        ? "ready"
        : "blocked",
      phase: "phase-2",
      module_ids: ["notes", "databases", "reports", "company-research"],
      evidence:
        "Module registry, module manifest, module onboarding contract, sidebar navigation, quick search actions, and module starter verification are available.",
      next_action:
        "Keep every new module behind registry, route, starter, extension slot, privacy boundary, documentation, and verify:modules checks.",
      privacy_boundary:
        "The platform layer uses module metadata only and must not read private research content.",
    },
    {
      id: "notes",
      title: "笔记和 page 核心",
      status: moduleStatus("notes") === "active" ? "ready" : "partial",
      phase: "phase-1",
      module_ids: ["notes"],
      evidence:
        "Notes/pages are active with page tree, slash commands, backlinks, comments, version history, Markdown import/export, and block editor surfaces.",
      next_action:
        "Continue tightening Notion-like shortcuts, templates, comments, formulas, and block ergonomics without breaking local-first storage.",
      privacy_boundary:
        "Notes remain browser-local unless the user explicitly opts into cloud sync or AI payload sharing.",
    },
    {
      id: "databases",
      title: "投研数据库",
      status: moduleStatus("databases") === "active" ? "ready" : "partial",
      phase: "phase-1",
      module_ids: ["databases"],
      evidence:
        "Research databases are active with table, list, kanban, calendar, gallery, timeline, form, feed, template rows, CSV export, XLSX export, and spreadsheet import contracts.",
      next_action:
        "Add deeper relation rollups, formulas, filtered linked views, and database templates as the research workflows mature.",
      privacy_boundary:
        "Database module health uses schema and module metadata only, not row values.",
    },
    {
      id: "files-reports",
      title: "文件和报告",
      status: moduleStatus("reports") === "beta" ? "partial" : "blocked",
      phase: "phase-1",
      module_ids: ["reports"],
      evidence:
        "Report Library is beta and covers local HTML reports, Markdown notes, PDF, Office files, notebooks, archives, local file storage, takeaways, local tracker-row intake, and linked trackers.",
      next_action:
        "Move more preview types from contract to polished in-page rendering and add safer report-to-company linking workflows.",
      privacy_boundary:
        "File previews must stay local by default and must not load external assets without confirmation.",
    },
    {
      id: "company-research",
      title: "公司研究",
      status: moduleStatus("company-research") === "beta" ? "partial" : "blocked",
      phase: "phase-3",
      module_ids: ["company-research"],
      evidence:
        "Company Research is beta with company pages, investment memo templates, earnings review templates, valuation assumptions, reports, meetings, local tracker-row intake, and tracker presets.",
      next_action:
        "Add richer company home dashboards, KPI sections, valuation assumption tables, earnings review workflows, and safer report/meeting relation cleanup.",
      privacy_boundary:
        "Company module links local research assets only and should not infer holdings or unpublished financial details.",
    },
    {
      id: "meetings",
      title: "会议和电话会",
      status: moduleStatus("meetings") === "beta" ? "partial" : "blocked",
      phase: "phase-3",
      module_ids: ["meetings"],
      evidence:
        "Meetings module is beta with meeting notes, transcript attachment surfaces, action items, follow-ups, local tracker-row intake, company links, report links, and meeting tracker presets.",
      next_action:
        "Connect meeting assistant imports, transcript parsing, action item follow-up, and company/report relation capture.",
      privacy_boundary:
        "Meeting workflows must not join calls, publish notes, or upload transcripts without explicit user confirmation.",
    },
    {
      id: "portfolio",
      title: "组合和观察名单",
      status: moduleStatus("portfolio") === "beta" ? "partial" : "blocked",
      phase: "phase-3",
      module_ids: ["portfolio"],
      evidence:
        "Portfolio module is beta with position memos, watchlists, sizing discipline, catalysts, risk notes, local tracker-row intake, and links to company/report/meeting assets.",
      next_action:
        "Add portfolio dashboards, catalyst reminders, thesis drift tracking, and risk review templates without broker connections by default.",
      privacy_boundary:
        "Portfolio workflows must not infer holdings or connect external brokers without explicit confirmation.",
    },
    {
      id: "research-graph",
      title: "跨模块研究图谱",
      status: moduleStatus("research-graph") === "beta" ? "partial" : "blocked",
      phase: "phase-3",
      module_ids: ["research-graph"],
      evidence:
        "Research Graph is beta and maps local relation coverage across companies, reports, meetings, and portfolio assets.",
      next_action:
        "Use the graph as the central gap detector for missing company-report-meeting-portfolio links.",
      privacy_boundary:
        "Graph health should use relation metadata and coverage counts, not private note bodies or file bytes.",
    },
    {
      id: "ai",
      title: "AI 工作台",
      status: moduleStatus("ai-workbench") === "planned" ? "blocked" : "partial",
      phase: "phase-5",
      module_ids: ["ai-workbench"],
      evidence:
        "AI Workbench is planned with local request staging, payload preview, output review contracts, disabled /api/ai/run, and privacy gates, but live AI execution remains disabled.",
      next_action:
        "Implement provider selection, final payload preview, source attribution, retention policy, audit events, and owner confirmation before enabling AI execution or output write-back.",
      privacy_boundary:
        "AI must never receive page text, file bytes, prompts, or private research context, and AI output must never overwrite workspace data until the user confirms the exact payload and save target.",
    },
    {
      id: "web-beta",
      title: "Web Beta 上线准备",
      status: moduleStatus("sync") === "planned" ? "partial" : "blocked",
      phase: "phase-4",
      module_ids: ["sync"],
      evidence:
        "Sync module contains local backup export, sync queue visibility, payload preview, conflict review and resolution contracts, side-by-side conflict review preview, remote baseline request, staging, stage schema/cursor proof, disposable replay/RLS proof contracts, disposable replay confirmation receipt, replay plan, account/session boundary, cloud schema plan, deployment target, smoke test plan, and permission contracts.",
      next_action:
        "Resolve GitHub credentials, configure disposable Supabase/Vercel preview, export owner confirmation before any empty-data replay, run the replay/RLS proof on empty disposable data, and keep writes disabled until rollback and owner confirmation are proven.",
      privacy_boundary:
        "Web Beta work must keep local data as source of truth and avoid cloud writes or uploads until explicit opt-in.",
    },
  ];
}

function summarizeAreas(areas: ModuleHealthArea[]) {
  return {
    areas: areas.length,
    ready: areas.filter((area) => area.status === "ready").length,
    partial: areas.filter((area) => area.status === "partial").length,
    blocked: areas.filter((area) => area.status === "blocked").length,
    registry_modules: PLATFORM_MODULES.length,
    active_modules: PLATFORM_MODULES.filter((module) => module.status === "active")
      .length,
    beta_modules: PLATFORM_MODULES.filter((module) => module.status === "beta")
      .length,
    planned_modules: PLATFORM_MODULES.filter(
      (module) => module.status === "planned"
    ).length,
  };
}

function moduleStatus(moduleId: string): ModuleStatus | null {
  return PLATFORM_MODULES.find((module) => module.id === moduleId)?.status ?? null;
}

function hasModules(moduleIds: string[]) {
  return moduleIds.every((moduleId) =>
    PLATFORM_MODULES.some((module) => module.id === moduleId)
  );
}
