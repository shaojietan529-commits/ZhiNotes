"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import ResearchConnectionsPanel from "@/components/modules/ResearchConnectionsPanel";
import ResearchWorkflowSchemaPanel from "@/components/modules/ResearchWorkflowSchemaPanel";
import { usePages } from "@/hooks/usePages";
import { getAllDatabases } from "@/lib/db/local/queries";
import {
  buildCompanyCoverageReport,
  getCoverageAreaLabel,
  type CompanyCoverageReport,
  type CompanyCoverageStatus,
} from "@/lib/company/companyCoverage";
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
  const companyCoverage = useMemo(
    () => buildCompanyCoverageReport(pages, databases),
    [databases, pages]
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

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="公司页面" value={companyPages.length} />
          <Metric label="投资备忘录" value={memoPages.length} />
          <Metric label="业绩复盘" value={earningsPages.length} />
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
