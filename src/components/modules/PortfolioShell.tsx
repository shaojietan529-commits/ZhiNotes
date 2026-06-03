"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import ResearchConnectionsPanel from "@/components/modules/ResearchConnectionsPanel";
import { usePages } from "@/hooks/usePages";
import { getAllDatabases } from "@/lib/db/local/queries";
import { executeModuleStarter } from "@/lib/modules/actions";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const PORTFOLIO_TEMPLATE_STARTERS: ModuleStarter[] = [
  {
    type: "page",
    label: "新建持仓备忘录",
    title: "未命名持仓备忘录",
    templateTitle: "投资备忘录",
    icon: "PF",
  },
];

const WORKFLOW_STEPS = [
  {
    title: "想法收集",
    detail:
      "先把公司想法放进本地观察名单，再决定是否进入正式持仓。",
  },
  {
    title: "仓位纪律",
    detail:
      "跟踪目标权重、当前权重、确信度、上行、下行和组合角色。",
  },
  {
    title: "催化剂复盘",
    detail:
      "把下一催化剂、投资假设检查点和风险笔记放在可复盘的位置。",
  },
  {
    title: "研究关联",
    detail:
      "通过 relation 字段把持仓关联回公司页面、备忘录、报告和会议。",
  },
];

export default function PortfolioShell() {
  return (
    <DatabaseProvider>
      <PortfolioContent />
    </DatabaseProvider>
  );
}

function PortfolioContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <PortfolioDashboard />
      </main>
    </div>
  );
}

function PortfolioDashboard() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load portfolio databases:", err);
      });
  }, []);

  const portfolioTrackers = useMemo(
    () => databases.filter(isPortfolioTrackerDatabase),
    [databases]
  );
  const positionPages = useMemo(() => getPositionPages(pages), [pages]);
  const watchlistPages = useMemo(() => getWatchlistPages(pages), [pages]);

  const portfolioModule = PLATFORM_MODULES.find((module) => module.id === "portfolio");
  const trackerStarter = portfolioModule?.starter ?? null;

  const runStarter = async (starter: ModuleStarter) => {
    setBusyAction(starter.label);
    try {
      const result = await executeModuleStarter(starter);
      await refresh();
      if (result.database) {
        setDatabases(await getAllDatabases());
      }
      router.push(result.route);
    } catch (err) {
      console.error("[Zhinote] Failed to run portfolio starter:", err);
      window.alert("组合动作失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
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
                组合与观察名单
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                在本地跟踪持仓、观察名单想法、仓位纪律、催化剂、风险和关联研究；
                当前不会连接行情数据或券商账户。
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/modules")}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              所有模块
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="持仓页面" value={positionPages.length} />
          <Metric label="观察名单页面" value={watchlistPages.length} />
          <Metric label="跟踪表" value={portfolioTrackers.length} />
          <Metric label="研究关联" value={portfolioTrackers.length ? 4 : 0} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                创建组合资产
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这些动作只会创建本地页面或数据库，不会获取价格、同步持仓、连接账户或发送数据。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PORTFOLIO_TEMPLATE_STARTERS.map((starter) => (
                <StarterButton
                  key={starter.label}
                  label={starter.label}
                  busy={busyAction === starter.label}
                  onClick={() => void runStarter(starter)}
                />
              ))}
              {trackerStarter && (
                <StarterButton
                  label={trackerStarter.label}
                  busy={busyAction === trackerStarter.label}
                  emphasis
                  onClick={() => void runStarter(trackerStarter)}
                />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              组合工作流
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {WORKFLOW_STEPS.map((step) => (
                <WorkflowCard key={step.title} {...step} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              本地边界
            </h2>
            <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              <p>
                组合数据只保存在浏览器本地数据库里。当前模块不会请求实时价格、券商余额、
                账户 ID 或交易历史。
              </p>
              <p>
                未来如果加入价格源、券商导入或云分享，必须先经过明确确认，并使用独立权限模型。
              </p>
            </div>
          </div>
        </section>

        <ResearchConnectionsPanel
          pages={pages}
          databases={databases}
          focusKind="portfolio"
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <ResourceList
            title="最近持仓页面"
            emptyText="还没有持仓页面。"
            items={positionPages.slice(0, 6).map((page) => ({
              id: page.id,
              label: page.title || "未命名持仓备忘录",
              meta: formatUpdated(page.updated_at),
              onOpen: () => router.push(`/page/${page.id}`),
            }))}
          />
          <ResourceList
            title="组合跟踪表"
            emptyText="还没有组合跟踪数据库。"
            items={portfolioTrackers.map((database) => ({
              id: database.id,
              label: database.title || "组合跟踪表",
              meta: database.description ?? "本地组合数据库",
              onOpen: () => router.push(`/database/${database.id}`),
            }))}
          />
        </section>
      </div>
    </div>
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

function StarterButton({
  label,
  busy,
  emphasis,
  onClick,
}: {
  label: string;
  busy: boolean;
  emphasis?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${
        emphasis
          ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {busy ? "创建中..." : label}
    </button>
  );
}

function WorkflowCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {detail}
      </p>
    </article>
  );
}

function ResourceList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: Array<{
    id: string;
    label: string;
    meta: string;
    onOpen: () => void;
  }>;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-400">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {item.label}
                </div>
                <div className="truncate text-xs text-zinc-400">{item.meta}</div>
              </div>
              <button
                type="button"
                onClick={item.onOpen}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                打开
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getPositionPages(pages: Page[]) {
  return pages.filter((page) =>
    pageMatches(page, [
      "position memo",
      "investment memo",
      "target weight",
      "持仓",
      "投资备忘录",
    ])
  );
}

function getWatchlistPages(pages: Page[]) {
  return pages.filter((page) =>
    pageMatches(page, ["watchlist", "next catalyst", "conviction", "观察名单"])
  );
}

function pageMatches(page: Page, terms: string[]) {
  const searchable = `${page.title ?? ""} ${page.content_text ?? ""}`.toLowerCase();
  return terms.some((term) => searchable.includes(term));
}

function isPortfolioTrackerDatabase(database: Database) {
  const searchable = `${database.title ?? ""} ${
    database.description ?? ""
  }`.toLowerCase();
  return (
    searchable.includes("portfolio tracker") ||
    searchable.includes("portfolio and watchlist") ||
    searchable.includes("组合跟踪") ||
    searchable.includes("观察名单")
  );
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新";
  return `更新于 ${date.toLocaleDateString()}`;
}
