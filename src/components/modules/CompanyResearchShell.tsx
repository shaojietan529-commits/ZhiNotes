"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import ResearchConnectionsPanel from "@/components/modules/ResearchConnectionsPanel";
import ResearchWorkflowSchemaPanel from "@/components/modules/ResearchWorkflowSchemaPanel";
import { usePages } from "@/hooks/usePages";
import {
  addRow,
  getAllDatabases,
  getFields,
  getRows,
} from "@/lib/db/local/queries";
import {
  buildCompanyCoverageReport,
  getCoverageAreaLabel,
  type CompanyCoverageReport,
  type CompanyCoverageStatus,
} from "@/lib/company/companyCoverage";
import {
  buildCompanyResearchPlaybook,
  type CompanyResearchPlaybook,
  type CompanyResearchPlaybookStatus,
} from "@/lib/company/companyResearchPlaybook";
import {
  buildCompanyTrackerIntakeDraft,
  findExistingCompanyTrackerRow,
  type CompanyTrackerIntakeItem,
} from "@/lib/company/companyTrackerIntake";
import { executeModuleStarter } from "@/lib/modules/actions";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const COMPANY_TEMPLATE_STARTERS: ModuleStarter[] = [
  {
    type: "page",
    label: "新建公司研究页",
    title: "未命名公司研究",
    templateTitle: "公司研究",
    icon: "CO",
  },
  {
    type: "page",
    label: "新建投资备忘录",
    title: "未命名投资备忘录",
    templateTitle: "投资备忘录",
    icon: "MEMO",
  },
  {
    type: "page",
    label: "新建业绩复盘",
    title: "未命名业绩复盘",
    templateTitle: "业绩复盘",
    icon: "Q",
  },
  {
    type: "page",
    label: "新建估值假设",
    title: "未命名估值假设",
    templateTitle: "估值假设",
    icon: "VAL",
  },
  {
    type: "page",
    label: "新建关键指标",
    title: "未命名关键指标看板",
    templateTitle: "关键指标看板",
    icon: "KPI",
  },
];

const WORKFLOW_STEPS = [
  {
    title: "公司主页",
    detail:
      "用公司研究页作为长期研究中枢，承载商业模式、行业结构、单位经济、待回答问题和相关链接。",
  },
  {
    title: "投资备忘录",
    detail:
      "沉淀投资假设、估值、风险、催化剂和下一步动作，形成决策备忘录。",
  },
  {
    title: "业绩复盘",
    detail:
      "记录季度数据、管理层表述、模型影响和后续问题。",
  },
  {
    title: "估值假设",
    detail:
      "把收入、利润率、倍数、DCF 和情景假设拆成可复盘的本地页面。",
  },
  {
    title: "关键指标",
    detail:
      "维护 KPI、单位经济、运营指标和趋势判断，连接业绩复盘与估值假设。",
  },
  {
    title: "跟踪数据库",
    detail:
      "用一个本地数据库跟踪覆盖状态、评级、催化剂日期、估值假设、相关报告和相关会议。",
  },
];

export default function CompanyResearchShell() {
  return (
    <DatabaseProvider>
      <CompanyResearchContent />
    </DatabaseProvider>
  );
}

function CompanyResearchContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <CompanyResearchDashboard />
      </main>
    </div>
  );
}

function CompanyResearchDashboard() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportingCoverage, setExportingCoverage] = useState(false);
  const [exportingPlaybook, setExportingPlaybook] = useState(false);
  const [trackerIntakeBusyId, setTrackerIntakeBusyId] = useState<string | null>(
    null
  );
  const [trackerIntakeMessage, setTrackerIntakeMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load company databases:", err);
      });
  }, []);

  const companyTrackers = useMemo(
    () => databases.filter(isCompanyResearchDatabase),
    [databases]
  );
  const companyPages = useMemo(() => getCompanyPages(pages), [pages]);
  const memoPages = useMemo(
    () =>
      pages.filter((page) =>
        pageMatches(page, ["investment memo", "投资备忘录", "投资假设"])
      ),
    [pages]
  );
  const earningsPages = useMemo(
    () => pages.filter((page) => pageMatches(page, ["earnings review", "业绩复盘"])),
    [pages]
  );
  const valuationPages = useMemo(
    () => pages.filter((page) => pageMatches(page, ["valuation", "估值假设"])),
    [pages]
  );
  const metricPages = useMemo(
    () =>
      pages.filter((page) =>
        pageMatches(page, ["key metrics", "关键指标", "kpi", "指标看板"])
      ),
    [pages]
  );
  const companyCoverage = useMemo(
    () => buildCompanyCoverageReport(pages, databases),
    [databases, pages]
  );
  const companyPlaybook = useMemo(
    () => buildCompanyResearchPlaybook(companyCoverage),
    [companyCoverage]
  );
  const companyTrackerIntakeItems = useMemo(
    () => buildCompanyTrackerIntakeItems(companyPages, companyCoverage),
    [companyCoverage, companyPages]
  );

  const companyModule = PLATFORM_MODULES.find(
    (module) => module.id === "company-research"
  );
  const trackerStarter = companyModule?.starter ?? null;

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
      console.error("[Zhinote] Failed to run company starter:", err);
      window.alert("公司研究动作失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportCoverage = () => {
    setExportingCoverage(true);
    try {
      downloadJsonFile(`zhinote-company-coverage-${fileSafeTimestamp()}.json`, {
        ...companyCoverage,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export company coverage:", err);
      window.alert("Company coverage export failed. Please check the console.");
    } finally {
      setExportingCoverage(false);
    }
  };

  const handleExportPlaybook = () => {
    setExportingPlaybook(true);
    try {
      downloadJsonFile(
        `zhinote-company-research-playbook-${fileSafeTimestamp()}.json`,
        {
          ...companyPlaybook,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export company playbook:", err);
      window.alert("公司研究 Playbook 导出失败，请查看控制台。");
    } finally {
      setExportingPlaybook(false);
    }
  };

  const handleCreateTrackerRow = async (item: CompanyTrackerIntakeItem) => {
    const tracker = companyTrackers[0];
    if (!tracker) {
      window.alert("请先创建公司跟踪表，再把公司页入库。");
      return;
    }

    setTrackerIntakeBusyId(item.page_id);
    setTrackerIntakeMessage(null);
    try {
      const [trackerFields, trackerRows] = await Promise.all([
        getFields(tracker.id),
        getRows(tracker.id),
      ]);
      const existingRow = findExistingCompanyTrackerRow(
        trackerRows,
        trackerFields,
        item.page_id
      );
      if (existingRow) {
        setTrackerIntakeMessage(
          `已存在 tracker row：${existingRow.row_title}。已打开公司跟踪表继续补 relation。`
        );
        router.push(
          `/database/${tracker.id}?q=${encodeURIComponent(item.page_title)}&focus=${
            item.page_id
          }`
        );
        return;
      }

      const draft = buildCompanyTrackerIntakeDraft(item, trackerFields);
      const hasCompanyPageRelation = draft.mapped_fields.some(
        (field) => field.mapped_value === "company-page-relation"
      );
      if (!hasCompanyPageRelation) {
        window.alert(
          "当前公司跟踪表缺少 Company page relation 字段，请先补字段后再入库。"
        );
        return;
      }

      await addRow(tracker.id, {
        title: draft.row_title,
        fieldValues: draft.field_values,
        contentText: draft.row_page_content,
      });
      setTrackerIntakeMessage(
        `已创建 tracker row：${draft.row_title}。已打开公司跟踪表继续补 relation。`
      );
      router.push(
        `/database/${tracker.id}?q=${encodeURIComponent(draft.row_title)}&focus=${
          item.page_id
        }`
      );
    } catch (err) {
      console.error("[Zhinote] Failed to create company tracker row:", err);
      window.alert("公司入库失败，请查看控制台。");
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
                公司研究
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                用本地页面、投资备忘录、业绩复盘、报告链接、会议链接和跟踪数据库，
                搭建公司级投研工作流。
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

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="公司页面" value={companyPages.length} />
          <Metric label="投资备忘录" value={memoPages.length} />
          <Metric label="业绩复盘" value={earningsPages.length} />
          <Metric label="估值假设" value={valuationPages.length} />
          <Metric label="关键指标" value={metricPages.length} />
          <Metric label="跟踪表" value={companyTrackers.length} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                创建研究资产
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                这些动作只会创建本地页面或数据库，不会发布、同步或调用外部服务。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMPANY_TEMPLATE_STARTERS.map((starter) => (
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

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                公司入库台
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把单个公司研究页创建成公司跟踪表 row，并自动填入 Company page relation、
                Status、Thesis，以及可识别时的 Ticker。点击后只做本地单条写入，
                不读取页面正文、数据库 row values、文件 bytes、持仓或交易计划。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-md px-2 py-1 ${
                  companyTrackers.length > 0
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {companyTrackers.length > 0 ? "Tracker ready" : "缺公司跟踪表"}
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                本地单条写入
              </span>
            </div>
          </div>
          {trackerIntakeMessage && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs leading-5 text-green-700 dark:bg-green-950 dark:text-green-300">
              {trackerIntakeMessage}
            </p>
          )}
          {companyTrackerIntakeItems.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {companyTrackerIntakeItems.slice(0, 6).map((item) => (
                <CompanyTrackerIntakeCard
                  key={item.page_id}
                  item={item}
                  trackerReady={companyTrackers.length > 0}
                  busy={trackerIntakeBusyId === item.page_id}
                  onCreate={() => void handleCreateTrackerRow(item)}
                  onOpen={() => router.push(`/page/${item.page_id}`)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有可入库的公司研究页。先新建公司研究页，再把它创建成公司跟踪表 row。
            </p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                公司覆盖雷达
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地扫描公司研究页面和数据库元数据，检查公司主页、投资 memo、
                业绩复盘、估值假设、关键指标、相关报告、相关会议和公司跟踪表是否齐备。
                导出不会包含页面正文、数据库 row 值、文件 bytes、持仓或投资计划。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCoverage}
              disabled={exportingCoverage}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingCoverage ? "Exporting..." : "Export coverage"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <CoverageMetric
              label="覆盖面"
              value={companyCoverage.summary.coverage_areas}
              detail="Research areas"
              status="ready"
            />
            <CoverageMetric
              label="Ready"
              value={companyCoverage.summary.ready}
              detail="Has structure"
              status="ready"
            />
            <CoverageMetric
              label="Missing"
              value={companyCoverage.summary.missing}
              detail="Needs setup"
              status="missing"
            />
            <CoverageMetric
              label="公司页"
              value={companyCoverage.summary.company_pages}
              detail="Home pages"
              status={
                companyCoverage.summary.company_pages > 0 ? "ready" : "missing"
              }
            />
            <CoverageMetric
              label="Memo"
              value={companyCoverage.summary.investment_memos}
              detail="Thesis docs"
              status={
                companyCoverage.summary.investment_memos > 0
                  ? "ready"
                  : "missing"
              }
            />
            <CoverageMetric
              label="业绩复盘"
              value={companyCoverage.summary.earnings_reviews}
              detail="Reviews"
              status={
                companyCoverage.summary.earnings_reviews > 0
                  ? "ready"
                  : "missing"
              }
            />
            <CoverageMetric
              label="待补齐"
              value={companyCoverage.summary.candidates_needing_work}
              detail="Company pages"
              status={
                companyCoverage.summary.candidates_needing_work > 0
                  ? "missing"
                  : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {companyCoverage.areas.map((area) => (
              <CompanyCoverageAreaCard key={area.id} area={area} />
            ))}
          </div>
          {companyCoverage.candidates.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {companyCoverage.candidates.slice(0, 6).map((candidate) => (
                <CompanyCoverageCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onOpen={() => router.push(candidate.route)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              暂无需要补齐的公司页。新建公司研究页后，这里会提示缺少的 memo、业绩复盘、
              估值、指标、报告或会议结构。
            </p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                公司研究 Playbook
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                把覆盖雷达转成行动队列：先补公司主页，再补投资 memo、业绩复盘、
                估值假设、关键指标、相关报告、相关会议和公司跟踪表。导出只包含结构状态，
                不包含页面正文、数据库 row values、持仓或交易计划。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPlaybook}
              disabled={exportingPlaybook}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingPlaybook ? "导出中..." : "导出 Playbook"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <CoverageMetric
              label="步骤"
              value={companyPlaybook.summary.workflow_steps}
              detail="Workflow"
              status="partial"
            />
            <CoverageMetric
              label="Ready"
              value={companyPlaybook.summary.ready_steps}
              detail="已覆盖"
              status="ready"
            />
            <CoverageMetric
              label="Missing"
              value={companyPlaybook.summary.missing_steps}
              detail="待补齐"
              status={
                companyPlaybook.summary.missing_steps > 0 ? "missing" : "ready"
              }
            />
            <CoverageMetric
              label="需确认"
              value={companyPlaybook.summary.manual_confirmation_steps}
              detail="复盘动作"
              status="partial"
            />
            <CoverageMetric
              label="行动队列"
              value={companyPlaybook.summary.action_queue_items}
              detail="Next actions"
              status={
                companyPlaybook.summary.action_queue_items > 0
                  ? "missing"
                  : "ready"
              }
            />
            <CoverageMetric
              label="候选公司"
              value={companyPlaybook.summary.candidate_companies}
              detail="Needs work"
              status={
                companyPlaybook.summary.candidate_companies > 0
                  ? "missing"
                  : "ready"
              }
            />
            <CoverageMetric
              label="跟踪表"
              value={companyPlaybook.summary.tracker_databases}
              detail="Local DB"
              status={
                companyPlaybook.summary.tracker_databases > 0
                  ? "ready"
                  : "missing"
              }
            />
            <CoverageMetric
              label="关系门"
              value={companyPlaybook.summary.relation_gates}
              detail="Reports/meetings"
              status={
                companyPlaybook.summary.relation_gates > 0
                  ? "missing"
                  : "ready"
              }
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                行动队列
              </div>
              {companyPlaybook.action_queue.length > 0 ? (
                companyPlaybook.action_queue.map((item) => (
                  <CompanyPlaybookActionCard key={item.id} item={item} />
                ))
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  当前没有结构性缺口。下一步可以维护 relation 值、复盘节奏和最新结论。
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                研究步骤
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {companyPlaybook.steps.map((step) => (
                  <CompanyPlaybookStepCard key={step.id} step={step} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              覆盖研究流程
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {WORKFLOW_STEPS.map((step) => (
                <WorkflowCard key={step.title} {...step} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              本地数据模型
            </h2>
            <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              <p>
                当前公司研究通过本地页面、数据库行、wiki 链接、上传文件块和 URL
                字段连接起来。
              </p>
              <p>
                下一步会继续强化 relation 字段，让公司页面、会议、报告和数据库可以更结构化地互相关联。
              </p>
            </div>
          </div>
        </section>

        <ResearchWorkflowSchemaPanel kind="company" />

        <ResearchConnectionsPanel
          pages={pages}
          databases={databases}
          focusKind="company"
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <ResourceList
            title="最近公司研究页面"
            emptyText="还没有公司研究页面。"
            items={companyPages.slice(0, 6).map((page) => ({
              id: page.id,
              label: page.title || "未命名公司研究",
              meta: formatUpdated(page.updated_at),
              onOpen: () => router.push(`/page/${page.id}`),
            }))}
          />
          <ResourceList
            title="公司跟踪表"
            emptyText="还没有公司跟踪数据库。"
            items={companyTrackers.map((database) => ({
              id: database.id,
              label: database.title || "公司研究跟踪表",
              meta: database.description ?? "本地研究数据库",
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

function CoverageMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: CompanyCoverageStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <CompanyCoverageStatusPill status={status} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function CompanyCoverageAreaCard({
  area,
}: {
  area: CompanyCoverageReport["areas"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {area.title}
        </div>
        <CompanyCoverageStatusPill status={area.status} />
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

function CompanyCoverageCandidateCard({
  candidate,
  onOpen,
}: {
  candidate: CompanyCoverageReport["candidates"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {candidate.title}
          </div>
          <div className="mt-1 text-zinc-400">
            缺少 {candidate.missing_sections.length} 个结构面
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
        {candidate.missing_sections.map((areaId) => (
          <span
            key={areaId}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            {getCoverageAreaLabel(areaId)}
          </span>
        ))}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        {candidate.next_action}
      </p>
    </article>
  );
}

function CompanyTrackerIntakeCard({
  item,
  trackerReady,
  busy,
  onCreate,
  onOpen,
}: {
  item: CompanyTrackerIntakeItem;
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
            {item.page_title}
          </div>
          <div className="mt-1 text-zinc-400">
            {item.missing_sections.length > 0
              ? `缺少 ${item.missing_sections.length} 个结构面`
              : "基础结构已覆盖"}
          </div>
        </div>
        <CompanyCoverageStatusPill
          status={item.missing_sections.length > 0 ? "missing" : "ready"}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {item.missing_sections.length > 0 ? (
          item.missing_sections.map((areaId) => (
            <span
              key={areaId}
              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            >
              缺 {getCoverageAreaLabel(areaId)}
            </span>
          ))
        ) : (
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-950 dark:text-green-300">
            Ready
          </span>
        )}
      </div>
      <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
        将创建一条本地 company tracker row，写入 Company page relation、
        Status、Thesis，并在标题可识别时填入 Ticker。
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        本地单条写入；不读取页面正文、数据库 row values、持仓、交易计划或文件 bytes。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={!trackerReady || busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {busy ? "创建中..." : "创建 tracker row"}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开公司页
        </button>
      </div>
    </article>
  );
}

function CompanyPlaybookActionCard({
  item,
}: {
  item: CompanyResearchPlaybook["action_queue"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {item.reason}
          </p>
        </div>
        <CompanyPlaybookStatusPill status={item.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        {item.applies_to.map((areaId) => (
          <span
            key={areaId}
            className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
          >
            {getCoverageAreaLabel(areaId)}
          </span>
        ))}
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          去：{item.suggested_destination}
        </span>
      </div>
    </article>
  );
}

function CompanyPlaybookStepCard({
  step,
}: {
  step: CompanyResearchPlaybook["steps"][number];
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </h3>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {step.evidence}
          </p>
        </div>
        <CompanyPlaybookStatusPill status={step.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {getSurfaceLabel(step.surface)}
        </span>
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {step.next_action}
      </p>
      <p className="mt-2 leading-5 text-zinc-400">
        {step.privacy_boundary}
      </p>
    </article>
  );
}

function CompanyCoverageStatusPill({
  status,
}: {
  status: CompanyCoverageStatus;
}) {
  const labels: Record<CompanyCoverageStatus, string> = {
    ready: "Ready",
    partial: "Partial",
    missing: "Missing",
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

function CompanyPlaybookStatusPill({
  status,
}: {
  status: CompanyResearchPlaybookStatus;
}) {
  const labels: Record<CompanyResearchPlaybookStatus, string> = {
    ready: "Ready",
    partial: "Partial",
    missing: "Missing",
    "manual-confirmation": "需确认",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "manual-confirmation"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function getSurfaceLabel(surface: CompanyResearchPlaybook["steps"][number]["surface"]) {
  const labels: Record<
    CompanyResearchPlaybook["steps"][number]["surface"],
    string
  > = {
    page: "页面",
    database: "数据库",
    file: "文件",
    relation: "Relation",
    analysis: "分析结构",
  };

  return labels[surface];
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

function getCompanyPages(pages: Page[]) {
  return pages.filter((page) =>
    pageMatches(page, [
      "company research",
      "公司研究",
      "business model",
      "industry structure",
      "unit economics",
    ])
  );
}

function buildCompanyTrackerIntakeItems(
  companyPages: Page[],
  coverage: CompanyCoverageReport
): CompanyTrackerIntakeItem[] {
  const candidateMap = new Map(
    coverage.candidates.map((candidate) => [candidate.id, candidate])
  );

  return companyPages.map((page) => {
    const candidate = candidateMap.get(page.id);
    return {
      page_id: page.id,
      page_title: page.title || "未命名公司研究",
      missing_sections: candidate?.missing_sections ?? [],
      next_action:
        candidate?.next_action ??
        "结构已覆盖基础公司研究面，下一步补 relation 值、复盘节奏和最新结论。",
    };
  });
}

function pageMatches(page: Page, terms: string[]) {
  const searchable = `${page.title ?? ""} ${page.content_text ?? ""}`.toLowerCase();
  return terms.some((term) => searchable.includes(term));
}

function isCompanyResearchDatabase(database: Database) {
  const searchable = `${database.title ?? ""} ${
    database.description ?? ""
  }`.toLowerCase();
  return (
    searchable.includes("company research") ||
    searchable.includes("company-level research") ||
    searchable.includes("公司研究")
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
