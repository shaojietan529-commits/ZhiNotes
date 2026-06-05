"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { usePages } from "@/hooks/usePages";
import {
  createPage,
  getAllDatabases,
  getFields,
  getRows,
  updatePage,
} from "@/lib/db/local/queries";
import { executeModuleStarter } from "@/lib/modules/actions";
import {
  buildResearchGraph,
  buildResearchGraphReport,
  classifyResearchDatabase,
  type ResearchDatabaseSnapshot,
} from "@/lib/modules/researchGraph";
import { buildResearchWorkbenchPacket } from "@/lib/modules/researchWorkbench";
import {
  RESEARCH_PROJECT_MODE_OPTIONS,
  buildResearchProjectBrief,
  buildResearchProjectBriefPageHtml,
  buildResearchProjectPageTitle,
  type ResearchProjectBrief,
  type ResearchProjectChecklistStatus,
  type ResearchProjectMode,
} from "@/lib/modules/researchProjectBrief";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database } from "@/lib/utils/types";

export default function ProjectsShell() {
  return (
    <DatabaseProvider>
      <ProjectsContent />
    </DatabaseProvider>
  );
}

function ProjectsContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <ProjectsDashboard />
      </main>
    </div>
  );
}

function ProjectsDashboard() {
  const router = useRouter();
  const { pages, refresh: refreshPages } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [snapshots, setSnapshots] = useState<ResearchDatabaseSnapshot[]>([]);
  const [topic, setTopic] = useState("");
  const [projectMode, setProjectMode] =
    useState<ResearchProjectMode>("initiation");
  const [horizon, setHorizon] = useState("本周");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load project databases:", err);
      });
  }, []);

  const researchDatabases = useMemo(
    () => databases.filter((database) => classifyResearchDatabase(database)),
    [databases]
  );

  useEffect(() => {
    let cancelled = false;

    void loadResearchDatabaseSnapshots(researchDatabases)
      .then((nextSnapshots) => {
        if (!cancelled) setSnapshots(nextSnapshots);
      })
      .catch((err) => {
        console.error("[Zhinote] Failed to load project graph snapshots:", err);
        if (!cancelled) setSnapshots([]);
      });

    return () => {
      cancelled = true;
    };
  }, [researchDatabases]);

  const graph = useMemo(
    () => buildResearchGraph(pages, snapshots),
    [pages, snapshots]
  );
  const graphReport = useMemo(
    () => buildResearchGraphReport(graph, snapshots),
    [graph, snapshots]
  );
  const workbenchPacket = useMemo(
    () => buildResearchWorkbenchPacket(graphReport),
    [graphReport]
  );
  const projectBrief = useMemo(
    () =>
      buildResearchProjectBrief({
        topic,
        projectMode,
        horizon,
        graphReport,
        workbench: workbenchPacket,
      }),
    [graphReport, horizon, projectMode, topic, workbenchPacket]
  );
  const projectTrackerDatabases = useMemo(
    () => databases.filter(isProjectTrackerDatabase),
    [databases]
  );
  const projectsModule = PLATFORM_MODULES.find(
    (module) => module.id === "projects"
  );
  const trackerStarter = projectsModule?.starter ?? null;

  const handleCreateProjectPage = async () => {
    setBusyAction("project-page");
    try {
      const page = await createPage({
        title: buildResearchProjectPageTitle(projectBrief),
        icon: "PRJ",
      });
      await updatePage(page.id, {
        content_text: buildResearchProjectBriefPageHtml(projectBrief),
      });
      await refreshPages();
      router.push(`/page/${page.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create project page:", err);
      window.alert("投研项目页创建失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunStarter = async (starter: ModuleStarter) => {
    setBusyAction(starter.label);
    try {
      const result = await executeModuleStarter(starter);
      if (result.database) {
        setDatabases((current) => [result.database as Database, ...current]);
      } else {
        const latest = await getAllDatabases();
        setDatabases(latest);
      }
      await refreshPages();
      router.push(result.route);
    } catch (err) {
      console.error("[Zhinote] Failed to run project starter:", err);
      window.alert("投研项目模块动作失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportBrief = () => {
    downloadJsonFile(`zhinote-project-brief-${fileSafeTimestamp()}.json`, {
      ...projectBrief,
      exported_at: new Date().toISOString(),
    });
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                投研模块
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                投研项目
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                把一个研究主题沉淀成项目页、项目 checklist、模块准备度和本地项目跟踪表。
                这里不会自动写 tracker row、relation 值、AI payload 或云同步。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/modules")}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                所有模块
              </button>
              <button
                type="button"
                onClick={() => router.push("/modules/research-graph")}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                打开研究图谱
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="项目跟踪表" value={projectTrackerDatabases.length} />
          <Metric label="图谱资产" value={projectBrief.summary.graph_assets} />
          <Metric label="待补关系" value={projectBrief.summary.relation_actions} />
          <Metric label="Checklist" value={projectBrief.summary.checklist_items} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Project Launcher
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                创建一个投研项目
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                先把研究问题变成项目页，再按需把项目接入跟踪表。项目跟踪表只创建 schema，
                不会自动保存你的研究观点、持仓、交易计划或文件内容。
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCreateProjectPage}
                disabled={busyAction === "project-page"}
                className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                {busyAction === "project-page" ? "创建中..." : "创建项目页"}
              </button>
              {trackerStarter && (
                <button
                  type="button"
                  onClick={() => void handleRunStarter(trackerStarter)}
                  disabled={busyAction === trackerStarter.label}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {busyAction === trackerStarter.label
                    ? "创建中..."
                    : trackerStarter.label}
                </button>
              )}
              <button
                type="button"
                onClick={handleExportBrief}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                导出 Brief
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.75fr]">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              研究主题
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="例如：AI capex 是否进入下修周期"
                className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              项目类型
              <select
                value={projectMode}
                onChange={(event) =>
                  setProjectMode(event.target.value as ResearchProjectMode)
                }
                className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
              >
                {RESEARCH_PROJECT_MODE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              时间范围
              <input
                value={horizon}
                onChange={(event) => setHorizon(event.target.value)}
                placeholder="本周 / 本季度 / 业绩前"
                className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                模块准备度
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {projectBrief.module_plans.map((plan) => (
                  <article
                    key={plan.kind}
                    className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {plan.label}
                        </h4>
                        <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                          {plan.role}
                        </p>
                      </div>
                      <StatusPill status={plan.readiness} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      {plan.assets} 资产 · {plan.connected_assets} 已连接 ·{" "}
                      {plan.unlinked_assets} 缺口 · {plan.connection_rate}% 覆盖
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(plan.next_action_route)}
                      className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {plan.next_action_label}
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <ProjectChecklistPanel
              brief={projectBrief}
              onOpenRoute={(route) => router.push(route)}
            />
          </div>
        </section>

        <ProjectTrackerPanel
          databases={projectTrackerDatabases}
          starter={trackerStarter}
          busyAction={busyAction}
          onRunStarter={handleRunStarter}
          onOpenDatabase={(databaseId) => router.push(`/database/${databaseId}`)}
        />
      </div>
    </div>
  );
}

function ProjectChecklistPanel({
  brief,
  onOpenRoute,
}: {
  brief: ResearchProjectBrief;
  onOpenRoute: (route: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          项目 Checklist
        </h3>
        <span className="text-xs text-zinc-400">
          {brief.summary.checklist_ready} ready ·{" "}
          {brief.summary.checklist_needing_review} review
        </span>
      </div>
      <div className="mt-2 grid gap-2">
        {brief.checklist.map((item) => (
          <article
            key={item.id}
            className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h4>
                  <StatusPill status={item.status} />
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {item.surface}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
                  {item.reason}
                </p>
                <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
                  {item.owner_decision}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenRoute(item.route)}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {item.route_label}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProjectTrackerPanel({
  databases,
  starter,
  busyAction,
  onRunStarter,
  onOpenDatabase,
}: {
  databases: Database[];
  starter: ModuleStarter | null;
  busyAction: string | null;
  onRunStarter: (starter: ModuleStarter) => Promise<void>;
  onOpenDatabase: (databaseId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            项目跟踪表
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">
            跟踪表只创建本地 schema：Project page、Status、Project mode、
            Related companies/reports/meetings/portfolio 等字段。具体 row 和 relation 值仍需手动写入。
          </p>
        </div>
        {starter && (
          <button
            type="button"
            onClick={() => void onRunStarter(starter)}
            disabled={busyAction === starter.label}
            className="w-fit rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            {busyAction === starter.label ? "创建中..." : starter.label}
          </button>
        )}
      </div>

      {databases.length === 0 ? (
        <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
          还没有识别到项目跟踪表。创建后可以在数据库里手动把项目页关联到公司、报告、会议和组合研究。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {databases.map((database) => (
            <article
              key={database.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {database.title || "未命名项目跟踪表"}
                </h3>
                <p className="mt-1 text-zinc-400">
                  {database.description || "本地项目 tracker"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenDatabase(database.id)}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                打开
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ResearchProjectChecklistStatus }) {
  const labels: Record<ResearchProjectChecklistStatus, string> = {
    ready: "Ready",
    "needs-review": "Review",
    missing: "Missing",
    "blocked-boundary": "Blocked",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "needs-review"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : status === "missing"
          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function isProjectTrackerDatabase(database: Database) {
  const searchable = `${database.title} ${database.description ?? ""}`.toLowerCase();
  return (
    searchable.includes("project") ||
    searchable.includes("项目") ||
    searchable.includes("投研项目")
  );
}

function downloadJsonFile(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function loadResearchDatabaseSnapshots(databases: Database[]) {
  return Promise.all(
    databases.map(async (database) => ({
      database,
      fields: await getFields(database.id),
      rows: await getRows(database.id),
    }))
  );
}
