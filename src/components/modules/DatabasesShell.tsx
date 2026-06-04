"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import {
  createDatabase,
  getAllDatabases,
  getDatabaseRowCount,
  getFields,
  getViews,
} from "@/lib/db/local/queries";
import {
  buildDatabaseModuleDashboardReport,
  getDatabaseFieldTypeBreakdown,
  type DatabaseModuleDashboardReport,
  type DatabaseModuleSnapshot,
} from "@/lib/database/databaseModuleDashboard";
import {
  buildDatabaseTemplateCatalogReport,
  type DatabaseTemplateCatalogReport,
} from "@/lib/database/databaseTemplateCatalog";
import {
  buildDatabaseTemplateRowReadinessReport,
  type DatabaseTemplateRowReadinessReport,
  type DatabaseTemplateRowReadinessStatus,
} from "@/lib/database/databaseTemplateRowReadiness";
import {
  DATABASE_TEMPLATE_ROW_RECEIPT_EVENT,
  listDatabaseTemplateRowReceipts,
  type DatabaseTemplateRowReceipt,
} from "@/lib/database/databaseTemplateRows";
import {
  buildDatabaseViewReadinessReport,
  type DatabaseViewReadinessReport,
  type DatabaseViewReadinessStatus,
} from "@/lib/database/databaseViewReadiness";
import {
  getDatabaseViewTypeLabel,
} from "@/lib/database/display";
import { executeModuleStarter } from "@/lib/modules/actions";
import { PLATFORM_MODULES, type ModuleStarter } from "@/lib/modules/registry";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const DATABASE_STARTER_MODULE_IDS = [
  "company-research",
  "reports",
  "meetings",
  "portfolio",
];

export default function DatabasesShell() {
  return (
    <DatabaseProvider>
      <DatabasesContent />
    </DatabaseProvider>
  );
}

function DatabasesContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <DatabasesDashboard />
      </main>
    </div>
  );
}

function DatabasesDashboard() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<DatabaseModuleSnapshot[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportingDashboard, setExportingDashboard] = useState(false);
  const [exportingViewReadiness, setExportingViewReadiness] = useState(false);
  const [exportingTemplateReadiness, setExportingTemplateReadiness] =
    useState(false);
  const [templateRowReceipts, setTemplateRowReceipts] = useState<
    DatabaseTemplateRowReceipt[]
  >([]);
  const [exportingTemplateRowReceipts, setExportingTemplateRowReceipts] =
    useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoadError(null);
      const databases = await getAllDatabases();
      const loadedSnapshots = await Promise.all(
        databases.map(async (database) => {
          const [fields, views, rowCount] = await Promise.all([
            getFields(database.id),
            getViews(database.id),
            getDatabaseRowCount(database.id),
          ]);

          return {
            database,
            fields,
            views,
            rowCount,
          };
        })
      );
      setSnapshots(loadedSnapshots);
    } catch (err) {
      console.error("[Zhinote] Failed to load database module dashboard:", err);
      setLoadError("无法加载本地数据库总览。");
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const refreshReceipts = () => {
      setTemplateRowReceipts(listDatabaseTemplateRowReceipts());
    };

    refreshReceipts();
    window.addEventListener(
      DATABASE_TEMPLATE_ROW_RECEIPT_EVENT,
      refreshReceipts
    );

    return () => {
      window.removeEventListener(
        DATABASE_TEMPLATE_ROW_RECEIPT_EVENT,
        refreshReceipts
      );
    };
  }, []);

  const dashboardReport = useMemo(
    () => buildDatabaseModuleDashboardReport(snapshots),
    [snapshots]
  );
  const fieldTypeBreakdown = useMemo(
    () =>
      getDatabaseFieldTypeBreakdown(
        snapshots.flatMap((snapshot) => snapshot.fields)
      ),
    [snapshots]
  );
  const templateCatalog = useMemo(
    () => buildDatabaseTemplateCatalogReport(),
    []
  );
  const viewReadiness = useMemo(
    () => buildDatabaseViewReadinessReport(snapshots),
    [snapshots]
  );
  const templateRowReadiness = useMemo(
    () => buildDatabaseTemplateRowReadinessReport(snapshots),
    [snapshots]
  );
  const templateRowReceiptSummary = useMemo(
    () => summarizeTemplateRowReceipts(templateRowReceipts),
    [templateRowReceipts]
  );
  const starterModules = useMemo(
    () =>
      PLATFORM_MODULES.filter(
        (module) =>
          DATABASE_STARTER_MODULE_IDS.includes(module.id) &&
          module.starter?.type === "workspace"
      ),
    []
  );

  const handleCreateDatabase = async () => {
    setBusyAction("new-database");
    try {
      const database = await createDatabase({
        title: "未命名投研数据库",
        icon: "DB",
      });
      await loadDashboard();
      router.push(`/database/${database.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create database:", err);
      window.alert("数据库创建失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunStarter = async (starter: ModuleStarter) => {
    setBusyAction(starter.label);
    try {
      const result = await executeModuleStarter(starter);
      await loadDashboard();
      router.push(result.route);
    } catch (err) {
      console.error("[Zhinote] Failed to run database starter:", err);
      window.alert("数据库模板创建失败，请查看控制台。");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportDashboard = () => {
    setExportingDashboard(true);
    try {
      downloadJsonFile(
        `zhinote-database-module-dashboard-${fileSafeTimestamp()}.json`,
        {
          ...dashboardReport,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export database dashboard:", err);
      window.alert("数据库总览导出失败，请查看控制台。");
    } finally {
      setExportingDashboard(false);
    }
  };

  const handleExportViewReadiness = () => {
    setExportingViewReadiness(true);
    try {
      downloadJsonFile(
        `zhinote-database-view-readiness-${fileSafeTimestamp()}.json`,
        {
          ...viewReadiness,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export database view readiness:", err);
      window.alert("数据库视图 readiness 导出失败，请查看控制台。");
    } finally {
      setExportingViewReadiness(false);
    }
  };

  const handleExportTemplateReadiness = () => {
    setExportingTemplateReadiness(true);
    try {
      downloadJsonFile(
        `zhinote-database-template-row-readiness-${fileSafeTimestamp()}.json`,
        {
          ...templateRowReadiness,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export database template row readiness:",
        err
      );
      window.alert("模板行 readiness 导出失败，请查看控制台。");
    } finally {
      setExportingTemplateReadiness(false);
    }
  };

  const handleExportTemplateRowReceipts = () => {
    setExportingTemplateRowReceipts(true);
    try {
      downloadJsonFile(
        `zhinote-database-template-row-receipts-${fileSafeTimestamp()}.json`,
        {
          format: "zhinote-database-template-row-receipt-history",
          format_version: 1,
          history_status: "local-metadata-only",
          exported_at: new Date().toISOString(),
          boundary: {
            local_export_only: true,
            reads_browser_local_storage: true,
            includes_database_title: false,
            includes_database_field_names: false,
            includes_database_row_values: false,
            includes_page_body_text: false,
            includes_tokens_or_credentials: false,
            uploads_data: false,
            enables_ai: false,
          },
          summary: templateRowReceiptSummary,
          receipts: templateRowReceipts,
        }
      );
    } catch (err) {
      console.error(
        "[Zhinote] Failed to export database template row receipts:",
        err
      );
      window.alert("模板行 receipts 导出失败，请查看控制台。");
    } finally {
      setExportingTemplateRowReceipts(false);
    }
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                数据模块
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                投研数据库中心
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                集中查看本地数据库、字段、视图、行数、模板入口、导出路线和
                relation 补全状态。这个页面只读 schema、view 和 row count。
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

        {loadError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {loadError}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Metric label="数据库" value={dashboardReport.summary.databases} />
          <Metric label="字段" value={dashboardReport.summary.fields} />
          <Metric label="视图" value={dashboardReport.summary.views} />
          <Metric label="行数" value={dashboardReport.summary.rows_counted} />
          <Metric
            label="Relation"
            value={dashboardReport.summary.relation_fields}
          />
          <Metric
            label="可导出"
            value={dashboardReport.summary.export_ready_databases}
          />
          <Metric
            label="高级视图"
            value={dashboardReport.summary.advanced_view_databases}
          />
          <Metric
            label="覆盖视图"
            value={dashboardReport.summary.covered_view_types}
          />
        </section>

        <TemplateCatalogPanel catalog={templateCatalog} />

        <TemplateRowReadinessPanel
          report={templateRowReadiness}
          exporting={exportingTemplateReadiness}
          onExport={handleExportTemplateReadiness}
          onOpen={(databaseId) => router.push(`/database/${databaseId}`)}
        />

        <TemplateRowReceiptHistoryPanel
          receipts={templateRowReceipts}
          summary={templateRowReceiptSummary}
          exporting={exportingTemplateRowReceipts}
          onExport={handleExportTemplateRowReceipts}
        />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                创建数据库工作区
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                可以创建空白数据库，也可以用公司、报告、会议、组合这些投研模板生成
                带 relation 字段和多视图的本地 tracker。所有动作只写本地浏览器数据库。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StarterButton
                label="新建空白数据库"
                busy={busyAction === "new-database"}
                emphasis
                onClick={() => void handleCreateDatabase()}
              />
              {starterModules.map((module) => (
                <StarterButton
                  key={module.id}
                  label={module.starter?.label ?? module.shortTitle}
                  busy={busyAction === module.starter?.label}
                  onClick={() =>
                    module.starter && void handleRunStarter(module.starter)
                  }
                />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                数据库模块总览
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                本地可导出的 dashboard report。它只包含数据库标题、描述、字段数量、
                视图类型和 row count，不包含 row values 或页面正文。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportDashboard}
              disabled={exportingDashboard}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingDashboard ? "导出中..." : "导出数据库总览"}
            </button>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                工作流步骤
              </div>
              {dashboardReport.workflow_steps.map((step) => (
                <WorkflowStepCard key={step.id} step={step} />
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                视图覆盖
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {dashboardReport.view_coverage.map((coverage) => (
                  <ViewCoverageCard
                    key={coverage.view_type}
                    coverage={coverage}
                  />
                ))}
              </div>
              {fieldTypeBreakdown.length > 0 && (
                <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    字段类型
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {fieldTypeBreakdown.map((item) => (
                      <span
                        key={item.label}
                        className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
                      >
                        {item.label}: {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                视图适配 readiness
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                按字段类型判断每个数据库是否适合添加看板、日历、画廊、时间线、
                图表、表单和动态视图。这个报告只读 schema、view metadata 和 row count，
                不读取 row values 或页面正文。
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportViewReadiness}
              disabled={exportingViewReadiness}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {exportingViewReadiness ? "导出中..." : "导出视图 readiness"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Metric
              label="已配置"
              value={viewReadiness.summary.configured}
            />
            <Metric
              label="可添加"
              value={viewReadiness.summary.ready_to_add}
            />
            <Metric
              label="需补字段"
              value={viewReadiness.summary.needs_schema}
            />
            <Metric
              label="配置受限"
              value={viewReadiness.summary.configured_limited}
            />
            <Metric
              label="日期就绪"
              value={viewReadiness.summary.date_ready_databases}
            />
            <Metric
              label="状态就绪"
              value={viewReadiness.summary.status_ready_databases}
            />
            <Metric
              label="图表就绪"
              value={viewReadiness.summary.chart_ready_databases}
            />
            <Metric
              label="Relation"
              value={viewReadiness.summary.relation_ready_databases}
            />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Readiness gates
              </div>
              {viewReadiness.gates.map((gate) => (
                <ViewReadinessGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                数据库视图建议
              </div>
              {viewReadiness.databases.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {viewReadiness.databases.map((item) => (
                    <ViewReadinessDatabaseCard
                      key={item.database_id}
                      item={item}
                      onOpen={() => router.push(`/database/${item.database_id}`)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                  还没有数据库。创建 tracker 后，这里会按字段类型推荐适合添加的视图。
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              数据库清单
            </h2>
            {dashboardReport.databases.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {dashboardReport.databases.map((item) => (
                  <DatabaseCard
                    key={item.database_id}
                    item={item}
                    onOpen={() => router.push(`/database/${item.database_id}`)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
                还没有本地数据库。可以先创建空白数据库，或用公司、报告、会议、
                组合模板生成 tracker。
              </p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              本地安全边界
            </h2>
            <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              <p>
                当前模块页只读取数据库 schema、view metadata 和 row count，
                不读取 row values、页面正文、文件 bytes、prompt、token 或云端数据。
              </p>
              <p>
                CSV/XLSX 导出仍在具体数据库页面里手动触发，因为导出会包含当前可见行值。
              </p>
              <p>
                Excel/CSV/ODS 可以在具体数据库页面追加导入当前数据库，或在文件预览中创建新数据库；
                批量写入仍需要 typed confirmation receipt。云同步和 AI 使用数据库内容前也需要单独确认 payload。
              </p>
            </div>
          </div>
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

function TemplateCatalogPanel({
  catalog,
}: {
  catalog: DatabaseTemplateCatalogReport;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            投研模板行目录
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            这些模板会出现在具体数据库页的「+ 模板行」菜单里，用于把公司、报告、
            会议和组合资产写成本地 row。当前目录只读模板 metadata，不读取 row values
            或页面正文。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          <CatalogMetric label="模板组" value={catalog.summary.groups} />
          <CatalogMetric label="模板行" value={catalog.summary.template_rows} />
          <CatalogMetric
            label="已注册"
            value={catalog.summary.available_template_rows}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {catalog.groups.map((group) => (
          <article
            key={group.id}
            className="rounded-md border border-zinc-100 p-3 text-xs dark:border-zinc-800"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {group.label}
                </h3>
                <p className="mt-1 text-zinc-400">
                  推荐数据库：{group.recommended_database}
                </p>
              </div>
              <span className="w-fit rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {group.templates.filter((template) => template.available).length}/
                {group.templates.length} ready
              </span>
            </div>
            <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
              {group.relation_goal}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {group.templates.map((template) => (
                <span
                  key={template.title}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    template.available
                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                  title={template.description}
                >
                  {template.title}
                </span>
              ))}
            </div>
            <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {group.row_usage}
            </p>
            <p className="mt-2 leading-5 text-zinc-400">
              隐私边界：{group.privacy_boundary}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CatalogMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <div>{label}</div>
      <div className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function TemplateRowReadinessPanel({
  report,
  exporting,
  onExport,
  onOpen,
}: {
  report: DatabaseTemplateRowReadinessReport;
  exporting: boolean;
  onExport: () => void;
  onOpen: (databaseId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            模板行 readiness
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            按公司、报告、会议和组合模板检查每个数据库是否具备推荐字段。
            这个报告只读 template metadata、schema、view metadata 和 row count，
            不包含 field names、row values 或页面正文。
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {exporting ? "导出中..." : "导出模板行 readiness"}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="模板组" value={report.summary.template_groups} />
        <Metric label="模板行" value={report.summary.template_rows} />
        <Metric label="Ready" value={report.summary.ready_items} />
        <Metric label="Partial" value={report.summary.partial_items} />
        <Metric label="需补 schema" value={report.summary.needs_schema_items} />
        <Metric label="缺 Relation" value={report.summary.missing_relation_requirements} />
        <Metric label="缺 Status" value={report.summary.missing_status_requirements} />
        <Metric label="缺 Date" value={report.summary.missing_date_requirements} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Template-row gates
          </div>
          {report.gates.map((gate) => (
            <TemplateRowGateRow key={gate.id} gate={gate} />
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            数据库模板建议
          </div>
          {report.databases.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {report.databases.map((database) => (
                <TemplateRowDatabaseCard
                  key={database.database_id}
                  database={database}
                  onOpen={() => onOpen(database.database_id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
              还没有数据库。创建 tracker 后，这里会判断它适合哪些模板行。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function TemplateRowGateRow({
  gate,
}: {
  gate: DatabaseTemplateRowReadinessReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <StepStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function TemplateRowDatabaseCard({
  database,
  onOpen,
}: {
  database: DatabaseTemplateRowReadinessReport["databases"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {database.title}
          </h3>
          <p className="mt-1 text-zinc-400">
            {database.field_count} fields · {database.row_count} rows
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {database.recommended_status && (
          <TemplateRowStatusPill status={database.recommended_status} />
        )}
        {database.recommended_group_label && (
          <Chip label={`推荐 ${database.recommended_group_label}`} />
        )}
        {database.ready_group_ids.length > 0 && (
          <Chip label={`Ready ${database.ready_group_ids.length}`} />
        )}
        {database.partial_group_ids.length > 0 && (
          <Chip label={`Partial ${database.partial_group_ids.length}`} />
        )}
        {database.needs_schema_group_ids.length > 0 && (
          <Chip label={`需补 ${database.needs_schema_group_ids.length}`} />
        )}
      </div>
      {database.missing_required_field_groups.length > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 leading-5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          缺口：{database.missing_required_field_groups.join("、")}
        </p>
      )}
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {database.next_action}
      </p>
    </article>
  );
}

function TemplateRowStatusPill({
  status,
}: {
  status: DatabaseTemplateRowReadinessStatus;
}) {
  const labels: Record<DatabaseTemplateRowReadinessStatus, string> = {
    ready: "Ready",
    partial: "Partial",
    "needs-schema": "需补 schema",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "partial"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function TemplateRowReceiptHistoryPanel({
  receipts,
  summary,
  exporting,
  onExport,
}: {
  receipts: DatabaseTemplateRowReceipt[];
  summary: ReturnType<typeof summarizeTemplateRowReceipts>;
  exporting: boolean;
  onExport: () => void;
}) {
  const latestReceipts = receipts.slice(0, 6);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            模板行 receipts
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            记录从完整数据库页和 inline database 创建模板行后的本地 receipt 历史。
            这里读取浏览器 localStorage 里的 metadata-only receipts，不含 field
            names、row values、页面正文或敏感投资字段。
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting || receipts.length === 0}
          className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {exporting ? "导出中..." : "导出 receipts"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Receipts" value={summary.total} />
        <Metric label="DB page" value={summary.database_page} />
        <Metric label="Inline" value={summary.inline_database} />
        <Metric label="Company" value={summary.company} />
        <Metric label="Report" value={summary.report} />
        <Metric label="Meeting" value={summary.meeting} />
        <Metric label="Portfolio" value={summary.portfolio} />
        <Metric label="已预填字段" value={summary.prefilled_fields} />
      </div>

      {latestReceipts.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {latestReceipts.map((receipt) => (
            <TemplateRowReceiptCard
              key={receipt.receipt_id}
              receipt={receipt}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
          暂时没有模板行 receipt。你在完整数据库页或 inline database 里使用
          「+ 模板行」后，这里会显示最近的本地创建记录。
        </p>
      )}
    </section>
  );
}

function TemplateRowReceiptCard({
  receipt,
}: {
  receipt: DatabaseTemplateRowReceipt;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {receipt.template.template_title}
          </h3>
          <p className="mt-1 text-zinc-400">
            {getTemplateRowGroupLabel(receipt.template.group_id)} ·{" "}
            {getTemplateRowSourceLabel(receipt.source_surface)}
          </p>
        </div>
        <span className="w-fit rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {formatDate(receipt.created_at)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Chip
          label={`预填 ${receipt.field_draft_summary.fields_prefilled}`}
        />
        <Chip
          label={`手动 ${receipt.field_draft_summary.fields_left_manual}`}
        />
        {receipt.field_draft_summary.value_kinds_prefilled.map((valueKind) => (
          <Chip key={valueKind} label={valueKind} />
        ))}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        本地 receipt 只记录模板行动作 metadata。不含 field names、row values、
        页面正文或敏感投资字段。
      </p>
    </article>
  );
}

function WorkflowStepCard({
  step,
}: {
  step: DatabaseModuleDashboardReport["workflow_steps"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {step.evidence}
          </p>
        </div>
        <StepStatusPill status={step.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
        {step.local_boundary}
      </p>
    </article>
  );
}

function ViewCoverageCard({
  coverage,
}: {
  coverage: DatabaseModuleDashboardReport["view_coverage"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {coverage.label}
        </div>
        <CoveragePill status={coverage.status} />
      </div>
      <div className="mt-2 text-zinc-500 dark:text-zinc-400">
        {coverage.database_count} 个数据库 · {coverage.view_count} 个视图
      </div>
    </article>
  );
}

function ViewReadinessGateRow({
  gate,
}: {
  gate: DatabaseViewReadinessReport["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {gate.id}
          </div>
        </div>
        <StepStatusPill status={gate.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function ViewReadinessDatabaseCard({
  item,
  onOpen,
}: {
  item: DatabaseViewReadinessReport["databases"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </h3>
          <p className="mt-1 text-zinc-400">
            {item.field_count} fields · {item.row_count} rows
          </p>
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
        {item.configured_view_types.map((viewType) => (
          <Chip
            key={`configured-${viewType}`}
            label={`已配置 ${getDatabaseViewTypeLabel(viewType)}`}
          />
        ))}
        {item.ready_to_add_view_types.slice(0, 5).map((viewType) => (
          <Chip
            key={`ready-${viewType}`}
            label={`可添加 ${getDatabaseViewTypeLabel(viewType)}`}
          />
        ))}
        {item.needs_schema_view_types.slice(0, 5).map((viewType) => (
          <Chip
            key={`needs-${viewType}`}
            label={`需字段 ${getDatabaseViewTypeLabel(viewType)}`}
          />
        ))}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {item.recommended_next_action}
      </p>
      {item.recommended_next_view && (
        <div className="mt-2">
          <ViewReadinessStatusPill status="ready-to-add" />
          <span className="ml-2 text-[11px] text-zinc-400">
            推荐下一步：{getDatabaseViewTypeLabel(item.recommended_next_view)}
          </span>
        </div>
      )}
    </article>
  );
}

function DatabaseCard({
  item,
  onOpen,
}: {
  item: DatabaseModuleDashboardReport["databases"][number];
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-2 leading-5 text-zinc-500 dark:text-zinc-400">
            {item.description}
          </p>
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
        <Chip label={`字段 ${item.field_count}`} />
        <Chip label={`行数 ${item.row_count}`} />
        <Chip label={`视图 ${item.view_count}`} />
        <Chip label={`Relation ${item.relation_fields}`} />
        {item.view_types.map((viewType) => (
          <Chip key={viewType} label={getDatabaseViewTypeLabel(viewType)} />
        ))}
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {item.next_action}
      </p>
      <div className="mt-2 text-[11px] text-zinc-400">
        更新于 {formatDate(item.updated_at)}
      </div>
    </article>
  );
}

function ViewReadinessStatusPill({
  status,
}: {
  status: DatabaseViewReadinessStatus;
}) {
  const labels: Record<DatabaseViewReadinessStatus, string> = {
    configured: "已配置",
    "configured-limited": "配置受限",
    "ready-to-add": "可添加",
    "needs-schema": "需补字段",
  };
  const className =
    status === "configured"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "ready-to-add"
        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        : status === "configured-limited"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {label}
    </span>
  );
}

function StepStatusPill({
  status,
}: {
  status: DatabaseModuleDashboardReport["workflow_steps"][number]["status"];
}) {
  const labels: Record<
    DatabaseModuleDashboardReport["workflow_steps"][number]["status"],
    string
  > = {
    ready: "就绪",
    "manual-confirmation": "需确认",
    planned: "规划",
  };
  const className =
    status === "ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function CoveragePill({ status }: { status: "covered" | "missing" }) {
  const className =
    status === "covered"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] ${className}`}>
      {status === "covered" ? "已覆盖" : "未使用"}
    </span>
  );
}

function summarizeTemplateRowReceipts(receipts: DatabaseTemplateRowReceipt[]) {
  const summary = {
    total: receipts.length,
    database_page: 0,
    inline_database: 0,
    company: 0,
    report: 0,
    meeting: 0,
    portfolio: 0,
    prefilled_fields: 0,
    manual_fields: 0,
  };

  for (const receipt of receipts) {
    if (receipt.source_surface === "database-page") {
      summary.database_page += 1;
    } else {
      summary.inline_database += 1;
    }

    summary[receipt.template.group_id] += 1;
    summary.prefilled_fields += receipt.field_draft_summary.fields_prefilled;
    summary.manual_fields += receipt.field_draft_summary.fields_left_manual;
  }

  return summary;
}

function getTemplateRowSourceLabel(
  source: DatabaseTemplateRowReceipt["source_surface"]
) {
  if (source === "database-page") return "完整数据库页";
  return "Inline database";
}

function getTemplateRowGroupLabel(
  groupId: DatabaseTemplateRowReceipt["template"]["group_id"]
) {
  const labels: Record<
    DatabaseTemplateRowReceipt["template"]["group_id"],
    string
  > = {
    company: "公司研究",
    report: "报告库",
    meeting: "会议",
    portfolio: "组合",
  };

  return labels[groupId];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近";
  return date.toLocaleDateString();
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
