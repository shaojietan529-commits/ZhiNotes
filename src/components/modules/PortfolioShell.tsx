"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import ResearchConnectionsPanel from "@/components/modules/ResearchConnectionsPanel";
import ResearchWorkflowSchemaPanel from "@/components/modules/ResearchWorkflowSchemaPanel";
import { useDatabases } from "@/hooks/useDatabases";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { usePages } from "@/hooks/usePages";
import { getFields, getRows } from "@/lib/db/local/queries";
import { addRow } from "@/lib/database/cloudDatabaseMutations";
import { executeModuleStarter } from "@/lib/modules/actions";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { getResearchTemplateStarters } from "@/lib/modules/researchTemplateStarters";
import {
  buildPortfolioReviewReport,
  getPortfolioReviewAreaLabel,
  type PortfolioReviewReport,
  type PortfolioReviewStatus,
} from "@/lib/portfolio/portfolioReview";
import {
  buildPortfolioTrackerIntakeDraft,
  findExistingPortfolioTrackerRow,
  type PortfolioTrackerIntakeItem,
} from "@/lib/portfolio/portfolioTrackerIntake";
import {
  buildPortfolioWorkbenchPacket,
  type PortfolioDecisionSummaryStatus,
  type PortfolioWorkbenchPacket,
  type PortfolioWorkbenchPriority,
  type PortfolioWorkbenchStatus,
} from "@/lib/portfolio/portfolioWorkbench";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const PORTFOLIO_TEMPLATE_STARTERS = getResearchTemplateStarters("portfolio");

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
      "通过关系字段把持仓关联回公司页面、备忘录、报告和会议。",
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
  const openPage = useLocalFirstPageNavigation();
  const { pages, refresh } = usePages({ includeContent: true });
  const { databases, refresh: refreshDatabases } = useDatabases();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportingReview, setExportingReview] = useState(false);
  const [exportingWorkbench, setExportingWorkbench] = useState(false);
  const [trackerIntakeBusyId, setTrackerIntakeBusyId] = useState<string | null>(
    null
  );
  const [trackerIntakeMessage, setTrackerIntakeMessage] = useState<string | null>(
    null
  );

  const portfolioTrackers = useMemo(
    () => databases.filter(isPortfolioTrackerDatabase),
    [databases]
  );
  const positionPages = useMemo(() => getPositionPages(pages), [pages]);
  const watchlistPages = useMemo(() => getWatchlistPages(pages), [pages]);
  const portfolioReview = useMemo(
    () => buildPortfolioReviewReport(pages, databases),
    [databases, pages]
  );
  const portfolioTrackerIntakeItems = useMemo(
    () =>
      buildPortfolioTrackerIntakeItems(
        positionPages,
        watchlistPages,
        portfolioReview
      ),
    [portfolioReview, positionPages, watchlistPages]
  );
  const portfolioWorkbench = useMemo(
    () =>
      buildPortfolioWorkbenchPacket({
        review: portfolioReview,
        trackerIntakeItems: portfolioTrackerIntakeItems,
      }),
    [portfolioReview, portfolioTrackerIntakeItems]
  );

  const portfolioModule = PLATFORM_MODULES.find((module) => module.id === "portfolio");
  const trackerStarter = portfolioModule?.starter ?? null;

  const handleReviewStepNavigate = (
    step: PortfolioWorkbenchPacket["review_sequence"][number]
  ) => {
    if (step.route === "/modules/portfolio") {
      document
        .getElementById(step.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push(step.route);
  };

  const handleDecisionOpen = (
    decision: PortfolioWorkbenchPacket["decision_summary"]["decisions"][number]
  ) => {
    if (decision.route === "/modules/portfolio") {
      document
        .getElementById(decision.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push(`${decision.route}#${decision.target_section_id}`);
  };

  const runStarter = async (starter: ModuleStarter) => {
    setBusyAction(starter.label);
    try {
      const result = await executeModuleStarter(starter);
      await refresh();
      if (result.database) {
        await refreshDatabases();
      }
      if (result.page) {
        openPage(result.page, { source: "module-create" });
      } else {
        router.push(result.route);
      }
    } catch (err) {
      console.error("[Zhinote] Failed to run portfolio starter:", err);
      window.alert("组合动作失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportReview = () => {
    setExportingReview(true);
    try {
      downloadJsonFile(`zhinote-portfolio-review-${fileSafeTimestamp()}.json`, {
        ...portfolioReview,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export portfolio review:", err);
      window.alert("组合复盘导出失败，请查看控制台。");
    } finally {
      setExportingReview(false);
    }
  };

  const handleExportWorkbench = () => {
    setExportingWorkbench(true);
    try {
      downloadJsonFile(
        `zhinote-portfolio-workbench-${fileSafeTimestamp()}.json`,
        {
          ...portfolioWorkbench,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export portfolio workbench:", err);
      window.alert("组合工作台导出失败，请查看控制台。");
    } finally {
      setExportingWorkbench(false);
    }
  };

  const handleCreateTrackerRow = async (item: PortfolioTrackerIntakeItem) => {
    const tracker = portfolioTrackers[0];
    if (!tracker) {
      window.alert("请先创建组合跟踪表，再把组合资产入库。");
      return;
    }

    setTrackerIntakeBusyId(item.page_id);
    setTrackerIntakeMessage(null);
    try {
      const [trackerFields, trackerRows] = await Promise.all([
        getFields(tracker.id),
        getRows(tracker.id),
      ]);
      const existingRow = findExistingPortfolioTrackerRow(
        trackerRows,
        trackerFields,
        item.page_id
      );
      if (existingRow) {
        setTrackerIntakeMessage(
          "已存在跟踪表行。已打开组合跟踪表继续补关系和复盘字段。"
        );
        router.push(
          `/database/${tracker.id}?q=${encodeURIComponent(
            item.redacted_label
          )}&focus=${item.page_id}&handoff=portfolio-workbench`
        );
        return;
      }

      const draft = buildPortfolioTrackerIntakeDraft(item, trackerFields);
      const hasRelatedMemoRelation = draft.mapped_fields.some(
        (field) => field.mapped_value === "related-memo-relation"
      );
      if (!hasRelatedMemoRelation) {
        window.alert(
          "当前组合跟踪表缺少关联备忘录关系字段，请先补字段后再入库。"
        );
        return;
      }

      await addRow(tracker.id, {
        title: draft.row_title,
        fieldValues: draft.field_values,
        contentText: draft.row_page_content,
      });
      setTrackerIntakeMessage(
        "已创建脱敏跟踪表行。已打开组合跟踪表继续补关系和复盘字段。"
      );
      router.push(
        `/database/${tracker.id}?q=${encodeURIComponent(draft.row_title)}&focus=${
          item.page_id
        }&handoff=portfolio-workbench`
      );
    } catch (err) {
      console.error("[Zhinote] Failed to create portfolio tracker row:", err);
      window.alert("组合入库失败，请查看控制台。");
    } finally {
      setTrackerIntakeBusyId(null);
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

        <PortfolioDecisionSummaryPanel
          summary={portfolioWorkbench.decision_summary}
          exportingWorkbench={exportingWorkbench}
          onExportWorkbench={handleExportWorkbench}
          onOpenDecision={handleDecisionOpen}
        />

        <section
          id="portfolio-create-assets"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
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

        <section
          id="portfolio-workbench"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                组合工作台
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把组合复盘雷达和组合入库台合并成一个本地动作包：
                先建立观察名单或持仓备忘录，再补仓位纪律、投资假设、风险、
                催化剂、研究关联、组合入库和隐私边界。导出不包含页面标题、
                股票代码、权重、持仓名、交易计划、交易记录、券商账户或价格源。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWorkbench}
              disabled={exportingWorkbench}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingWorkbench ? "导出中..." : "导出组合工作台"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <PortfolioWorkbenchMetric
              label="复盘缺口"
              value={portfolioWorkbench.summary.missing_areas}
            />
            <PortfolioWorkbenchMetric
              label="备忘录"
              value={portfolioWorkbench.summary.portfolio_memos}
            />
            <PortfolioWorkbenchMetric
              label="观察名单"
              value={portfolioWorkbench.summary.watchlist_pages}
            />
            <PortfolioWorkbenchMetric
              label="待复盘"
              value={portfolioWorkbench.summary.items_needing_review}
            />
            <PortfolioWorkbenchMetric
              label="入库候选"
              value={portfolioWorkbench.summary.tracker_intake_candidates}
            />
            <PortfolioWorkbenchMetric
              label="总动作"
              value={portfolioWorkbench.summary.actions}
            />
            <PortfolioWorkbenchMetric
              label="高优先级"
              value={portfolioWorkbench.summary.high_priority_actions}
            />
            <PortfolioWorkbenchMetric
              label="边界阻止"
              value={portfolioWorkbench.summary.blocked_actions}
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                工作台分组
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {portfolioWorkbench.lanes.map((lane) => (
                  <PortfolioWorkbenchLaneCard key={lane.id} lane={lane} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                优先动作
              </div>
              <div className="mt-2 space-y-2">
                {portfolioWorkbench.actions.slice(0, 6).map((action) => (
                  <PortfolioWorkbenchActionCard
                    key={action.id}
                    action={action}
                    onNavigate={(route) => router.push(route)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {portfolioWorkbench.review_sequence.map((step) => (
              <PortfolioWorkbenchReviewStepCard
                key={step.id}
                step={step}
                onOpen={() => handleReviewStepNavigate(step)}
              />
            ))}
          </div>
        </section>

        <section
          id="portfolio-tracker-intake"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                组合入库台
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把本地持仓备忘录或观察名单页面创建成组合跟踪表行，并自动填入
                关联备忘录、状态、确信度、投资假设和风险笔记。
                点击后只做本地单条写入，不读取页面正文、页面标题、数据库行值、
                股票代码、权重、持仓名、交易计划或交易记录，不连接券商或价格源。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-md px-2 py-1 ${
                  portfolioTrackers.length > 0
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {portfolioTrackers.length > 0 ? "跟踪表就绪" : "缺组合跟踪表"}
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                本地单条写入
              </span>
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                脱敏标签
              </span>
            </div>
          </div>
          {trackerIntakeMessage && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs leading-5 text-green-700 dark:bg-green-950 dark:text-green-300">
              {trackerIntakeMessage}
            </p>
          )}
          {portfolioTrackerIntakeItems.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {portfolioTrackerIntakeItems.slice(0, 6).map((item) => (
                <PortfolioTrackerIntakeCard
                  key={item.page_id}
                  item={item}
                  trackerReady={portfolioTrackers.length > 0}
                  busy={trackerIntakeBusyId === item.page_id}
                  onCreate={() => void handleCreateTrackerRow(item)}
                  onOpen={() => openPage(item.page_id, { source: "module-open" })}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有可入库的持仓备忘录或观察名单页面。先新建组合资产，再把它创建成组合跟踪表行。
            </p>
          )}
        </section>

        <section
          id="portfolio-review-radar"
          className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                组合复盘雷达
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地扫描组合页面和数据库元数据，检查持仓备忘录、观察名单、仓位纪律、
                确信度、催化剂、风险笔记、投资假设、研究关联和组合跟踪表结构。
                导出不会包含页面标题、股票代码、权重、持仓名、交易计划或交易记录。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportReview}
              disabled={exportingReview}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingReview ? "导出中..." : "导出复盘"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <ReviewMetric
              label="复盘面"
              value={portfolioReview.summary.review_areas}
              detail="复盘结构面"
              status="ready"
            />
            <ReviewMetric
              label="就绪"
              value={portfolioReview.summary.ready}
              detail="已有结构"
              status="ready"
            />
            <ReviewMetric
              label="缺失"
              value={portfolioReview.summary.missing}
              detail="需要补齐"
              status={
                portfolioReview.summary.missing > 0 ? "missing" : "ready"
              }
            />
            <ReviewMetric
              label="备忘录"
              value={portfolioReview.summary.portfolio_memos}
              detail="仅本地"
              status={
                portfolioReview.summary.portfolio_memos > 0
                  ? "ready"
                  : "missing"
              }
            />
            <ReviewMetric
              label="观察名单"
              value={portfolioReview.summary.watchlist_pages}
              detail="想法池"
              status={
                portfolioReview.summary.watchlist_pages > 0
                  ? "ready"
                  : "missing"
              }
            />
            <ReviewMetric
              label="跟踪表"
              value={portfolioReview.summary.tracker_databases}
              detail="元数据"
              status={
                portfolioReview.summary.tracker_databases > 0
                  ? "ready"
                  : "missing"
              }
            />
            <ReviewMetric
              label="待复盘"
              value={portfolioReview.summary.items_needing_review}
              detail="脱敏"
              status={
                portfolioReview.summary.items_needing_review > 0
                  ? "missing"
                  : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {portfolioReview.areas.map((area) => (
              <PortfolioReviewAreaCard key={area.id} area={area} />
            ))}
          </div>
          {portfolioReview.items.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {portfolioReview.items.slice(0, 6).map((item) => (
                <PortfolioReviewItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => router.push(item.route)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              暂无需要复盘的组合结构缺口。新建持仓备忘录或观察名单后，这里会用脱敏标签提示缺少的结构面。
            </p>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div
            id="portfolio-privacy-boundary"
            className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
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

        <ResearchWorkflowSchemaPanel kind="portfolio" />

        <div id="portfolio-research-connections" className="scroll-mt-6">
          <ResearchConnectionsPanel
            pages={pages}
            databases={databases}
            focusKind="portfolio"
          />
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          <ResourceList
            title="最近持仓页面"
            emptyText="还没有持仓页面。"
            items={positionPages.slice(0, 6).map((page) => ({
              id: page.id,
              label: page.title || "未命名持仓备忘录",
              meta: formatUpdated(page.updated_at),
              onOpen: () => openPage(page, { source: "module-open" }),
            }))}
          />
          <ResourceList
            title="组合跟踪表"
            emptyText="还没有组合跟踪表。"
            items={portfolioTrackers.map((database) => ({
              id: database.id,
              label: database.title || "组合跟踪表",
              meta: database.description ?? "本地组合跟踪表",
              onOpen: () => router.push(`/database/${database.id}`),
            }))}
          />
        </section>
      </div>
    </div>
  );
}

function PortfolioWorkbenchMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function PortfolioDecisionSummaryPanel({
  summary,
  exportingWorkbench,
  onExportWorkbench,
  onOpenDecision,
}: {
  summary: PortfolioWorkbenchPacket["decision_summary"];
  exportingWorkbench: boolean;
  onExportWorkbench: () => void;
  onOpenDecision: (
    decision: PortfolioWorkbenchPacket["decision_summary"]["decisions"][number]
  ) => void;
}) {
  return (
    <section
      id="portfolio-decision-summary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            组合决策摘要
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            组合决策摘要
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {summary.current_conclusion}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportWorkbench}
          disabled={exportingWorkbench}
          className="w-fit whitespace-nowrap rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          {exportingWorkbench ? "导出中..." : "导出组合工作台"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summary.decisions.map((decision) => (
          <PortfolioDecisionCard
            key={decision.id}
            decision={decision}
            onOpen={() => onOpenDecision(decision)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <PortfolioDecisionList title="当前可做" items={summary.safe_local_work} />
        <PortfolioDecisionList title="保持关闭" items={summary.blocked_work} />
        <PortfolioDecisionList
          title="用户待确认"
          items={summary.required_owner_decisions}
        />
      </div>

      <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        组合决策摘要只读取本地摘要元数据，不包含页面标题、页面正文、
        持仓名、股票代码、权重、持仓、交易计划、交易记录、券商数据、价格、
        提示词、token、凭证、云端数据或 AI 输出。
      </p>
    </section>
  );
}

function PortfolioDecisionCard({
  decision,
  onOpen,
}: {
  decision: PortfolioWorkbenchPacket["decision_summary"]["decisions"][number];
  onOpen: () => void;
}) {
  return (
    <article className="flex min-h-[230px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">
              {decision.title}
            </h3>
            <p className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {decision.answer}
            </p>
          </div>
          <PortfolioDecisionStatusPill status={decision.status} />
        </div>
        <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
          {decision.evidence}
        </p>
      </div>
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs leading-5 text-zinc-400">
          {decision.next_action}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          打开对应区域
        </button>
      </div>
    </article>
  );
}

function PortfolioDecisionList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-900">
      <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function PortfolioDecisionStatusPill({
  status,
}: {
  status: PortfolioDecisionSummaryStatus;
}) {
  const label: Record<PortfolioDecisionSummaryStatus, string> = {
    "available-local": "本地可做",
    "requires-owner-confirmation": "需确认",
    blocked: "阻塞",
  };
  const className: Record<PortfolioDecisionSummaryStatus, string> = {
    "available-local":
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    "requires-owner-confirmation":
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    blocked: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${className[status]}`}
    >
      {label[status]}
    </span>
  );
}

function PortfolioWorkbenchReviewStepCard({
  step,
  onOpen,
}: {
  step: PortfolioWorkbenchPacket["review_sequence"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] text-zinc-400">步骤 {step.order}</div>
          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          打开步骤
        </button>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {step.reason}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">
        完成信号：{step.completion_signal}
      </p>
    </article>
  );
}

function PortfolioWorkbenchLaneCard({
  lane,
}: {
  lane: PortfolioWorkbenchPacket["lanes"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {lane.title}
        </div>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {lane.action_count} 动作
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {lane.description}
      </p>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          高优先级 {lane.high_priority_count}
        </span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {lane.route}
        </span>
      </div>
    </article>
  );
}

function PortfolioWorkbenchActionCard({
  action,
  onNavigate,
}: {
  action: PortfolioWorkbenchPacket["actions"][number];
  onNavigate: (route: string) => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <PortfolioWorkbenchPriorityPill priority={action.priority} />
        <PortfolioWorkbenchStatusPill status={action.status} />
        {action.requires_manual_confirmation && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            需确认
          </span>
        )}
      </div>
      <div className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">
        {action.title}
      </div>
      <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
        {action.next_action}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {action.applies_to.map((areaId) => (
          <span
            key={areaId}
            className="rounded bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
          >
            {getPortfolioReviewAreaLabel(areaId)}
          </span>
        ))}
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        {action.privacy_boundary}
      </p>
      <button
        type="button"
        onClick={() => onNavigate(action.action_route)}
        className="mt-3 rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {action.route_label}
      </button>
    </article>
  );
}

function PortfolioWorkbenchPriorityPill({
  priority,
}: {
  priority: PortfolioWorkbenchPriority;
}) {
  const labels: Record<PortfolioWorkbenchPriority, string> = {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  };
  const className =
    priority === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : priority === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[priority]}
    </span>
  );
}

function PortfolioWorkbenchStatusPill({
  status,
}: {
  status: PortfolioWorkbenchStatus;
}) {
  const labels: Record<PortfolioWorkbenchStatus, string> = {
    ready: "就绪",
    "review-needed": "需复核",
    missing: "缺失",
    "blocked-boundary": "边界阻止",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "review-needed"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "blocked-boundary"
          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
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

function ReviewMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: PortfolioReviewStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <PortfolioReviewStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function PortfolioReviewAreaCard({
  area,
}: {
  area: PortfolioReviewReport["areas"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {area.title}
        </div>
        <PortfolioReviewStatusPill status={area.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {area.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        {area.next_action}
      </p>
    </article>
  );
}

function PortfolioReviewItemCard({
  item,
  onOpen,
}: {
  item: PortfolioReviewReport["items"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.label}
          </div>
          <div className="mt-1 text-zinc-400">
            已隐藏页面标题、股票代码、持仓名和权重
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {item.missing_areas.map((areaId) => (
          <span
            key={areaId}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            {getPortfolioReviewAreaLabel(areaId)}
          </span>
        ))}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {item.next_action}
      </p>
    </article>
  );
}

function PortfolioTrackerIntakeCard({
  item,
  trackerReady,
  busy,
  onCreate,
  onOpen,
}: {
  item: PortfolioTrackerIntakeItem;
  trackerReady: boolean;
  busy: boolean;
  onCreate: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.redacted_label}
          </div>
          <div className="mt-1 text-zinc-400">
            {item.source_kind === "watchlist" ? "观察名单" : "持仓备忘录"} ·
            已隐藏页面标题、股票代码、持仓名和权重
          </div>
        </div>
        <PortfolioReviewStatusPill
          status={item.missing_areas.length > 0 ? "missing" : "ready"}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {item.missing_areas.length > 0 ? (
          item.missing_areas.map((areaId) => (
            <span
              key={areaId}
              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            >
              缺 {getPortfolioReviewAreaLabel(areaId)}
            </span>
          ))
        ) : (
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-950 dark:text-green-300">
            就绪
          </span>
        )}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        将创建一条本地组合跟踪表行，写入关联备忘录、状态、确信度、投资假设和风险笔记。
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        本地单条写入；不读取页面正文、页面标题、股票代码、权重、持仓名、交易计划、
        交易记录、券商账户或价格源。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={!trackerReady || busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {busy ? "创建中..." : "创建跟踪表行"}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开来源页
        </button>
      </div>
    </article>
  );
}

function PortfolioReviewStatusPill({
  status,
}: {
  status: PortfolioReviewStatus;
}) {
  const labels: Record<PortfolioReviewStatus, string> = {
    ready: "就绪",
    partial: "部分就绪",
    missing: "缺失",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
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

function buildPortfolioTrackerIntakeItems(
  positionPages: Page[],
  watchlistPages: Page[],
  review: PortfolioReviewReport
): PortfolioTrackerIntakeItem[] {
  const reviewItemMap = new Map(review.items.map((item) => [item.id, item]));
  const sourceMap = new Map<
    string,
    { page: Page; source_kind: PortfolioTrackerIntakeItem["source_kind"] }
  >();

  for (const page of watchlistPages) {
    sourceMap.set(page.id, { page, source_kind: "watchlist" });
  }
  for (const page of positionPages) {
    sourceMap.set(page.id, { page, source_kind: "position" });
  }

  return Array.from(sourceMap.values()).map(({ page, source_kind }, index) => {
    const reviewItem = reviewItemMap.get(page.id);
    return {
      page_id: page.id,
      redacted_label: reviewItem?.label ?? `本地组合资产 ${index + 1}`,
      source_kind,
      missing_areas: reviewItem?.missing_areas ?? [],
      next_action:
        reviewItem?.next_action ??
        "结构已覆盖基础组合复盘面，下一步补关系值和最新复盘结论。",
      updated_at: page.updated_at,
    };
  });
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
