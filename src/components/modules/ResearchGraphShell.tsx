"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { usePages } from "@/hooks/usePages";
import {
  addField,
  getAllDatabases,
  getFields,
  getRows,
} from "@/lib/db/local/queries";
import {
  buildResearchGraph,
  buildResearchGraphReport,
  classifyResearchDatabase,
  getResearchAssetKindLabel,
  getResearchRelationFieldLabel,
  inferResearchKindFromRelationField,
  type ResearchAsset,
  type ResearchGraphCompletionAction,
  type ResearchAssetKind,
  type ResearchDatabaseSnapshot,
  type ResearchGraphReport,
  type ResearchGraphSchemaGap,
  type ResearchRelationLink,
} from "@/lib/modules/researchGraph";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database } from "@/lib/utils/types";

const MODULE_ROUTES: Record<ResearchAssetKind, string> = {
  company: "/modules/company-research",
  report: "/modules/reports",
  meeting: "/modules/meetings",
  portfolio: "/modules/portfolio",
};

interface SchemaFieldCreationResult {
  id: string;
  databaseTitle: string;
  fieldName: string;
  relationLabel: string;
  created: boolean;
  createdAt: string;
  nextRoute: string;
}

export default function ResearchGraphShell() {
  return (
    <DatabaseProvider>
      <ResearchGraphContent />
    </DatabaseProvider>
  );
}

function ResearchGraphContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <ResearchGraphDashboard />
      </main>
    </div>
  );
}

function ResearchGraphDashboard() {
  const router = useRouter();
  const { pages } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [snapshots, setSnapshots] = useState<ResearchDatabaseSnapshot[]>([]);
  const [exportingGraphReport, setExportingGraphReport] = useState(false);
  const [schemaGapBusyId, setSchemaGapBusyId] = useState<string | null>(null);
  const [schemaFieldCreationResult, setSchemaFieldCreationResult] =
    useState<SchemaFieldCreationResult | null>(null);

  useEffect(() => {
    void getAllDatabases()
      .then(setDatabases)
      .catch((err) => {
        console.error("[Zhinote] Failed to load research graph databases:", err);
      });
  }, []);

  const researchDatabases = useMemo(
    () => databases.filter((database) => classifyResearchDatabase(database)),
    [databases]
  );

  const reloadSnapshots = useCallback(async () => {
    const nextSnapshots = await loadResearchDatabaseSnapshots(researchDatabases);
    setSnapshots(nextSnapshots);
  }, [researchDatabases]);

  useEffect(() => {
    let cancelled = false;

    void loadResearchDatabaseSnapshots(researchDatabases)
      .then((nextSnapshots) => {
        if (!cancelled) setSnapshots(nextSnapshots);
      })
      .catch((err) => {
        console.error("[Zhinote] Failed to load research graph snapshots:", err);
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
  const recentLinks = graph.relationLinks.slice(0, 12);
  const unlinkedAssets = graph.unlinkedAssets.slice(0, 12);
  const completionActions = graphReport.completion_plan.actions.slice(0, 10);
  const schemaGaps = graphReport.schema_gaps.slice(0, 8);
  const completionActionByAssetId = useMemo(
    () =>
      new Map(
        graphReport.completion_plan.actions.map((action) => [
          action.asset_id,
          action,
        ])
      ),
    [graphReport.completion_plan.actions]
  );

  const handleExportGraphReport = () => {
    setExportingGraphReport(true);
    try {
      downloadJsonFile(`zhinote-research-graph-${fileSafeTimestamp()}.json`, {
        ...graphReport,
        local_schema_field_action: schemaFieldCreationResult
          ? {
              status: schemaFieldCreationResult.created
                ? "created"
                : "already-present",
              database_title: schemaFieldCreationResult.databaseTitle,
              field_name: schemaFieldCreationResult.fieldName,
              relation_target: schemaFieldCreationResult.relationLabel,
              action_at: schemaFieldCreationResult.createdAt,
              boundary: {
                local_only: true,
                writes_field_schema: schemaFieldCreationResult.created,
                writes_rows: false,
                includes_page_text: false,
                includes_database_row_values: false,
                includes_file_bytes: false,
                uploads_data: false,
              },
            }
          : null,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export research graph report:", err);
      window.alert("研究图谱报告导出失败，请查看控制台。");
    } finally {
      setExportingGraphReport(false);
    }
  };

  const handleCreateSchemaGapField = async (gap: ResearchGraphSchemaGap) => {
    const confirmed = window.confirm(
      `在「${gap.database_title}」里创建 relation 字段「${gap.suggested_field_name}」？\n\n这只会修改本地数据库结构，不会写入行数据、同步或上传。`
    );
    if (!confirmed) return;

    setSchemaGapBusyId(gap.id);
    try {
      const latestFields = await getFields(gap.database_id);
      const coveringField = latestFields.find(
        (field) =>
          field.field_type === "relation" &&
          inferResearchKindFromRelationField(field.name) ===
            gap.missing_relation_kind
      );
      const alreadyCovered = Boolean(coveringField);

      if (!alreadyCovered) {
        await addField(gap.database_id, {
          name: gap.suggested_field_name,
          fieldType: "relation",
        });
      }
      setSchemaFieldCreationResult({
        id: gap.id,
        databaseTitle: gap.database_title,
        fieldName: coveringField?.name ?? gap.suggested_field_name,
        relationLabel: gap.missing_relation_label,
        created: !alreadyCovered,
        createdAt: new Date().toISOString(),
        nextRoute: gap.database_route,
      });
      await reloadSnapshots();
    } catch (err) {
      console.error("[Zhinote] Failed to create relation field:", err);
      window.alert("relation 字段创建失败，请查看控制台。");
    } finally {
      setSchemaGapBusyId(null);
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
                研究图谱
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                集中查看公司、报告、会议和组合之间的本地 relation 连接，
                找到已经串起来的研究资产和还需要补关系的空白点。
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
                onClick={handleExportGraphReport}
                disabled={exportingGraphReport}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                {exportingGraphReport ? "正在导出..." : "导出图谱报告"}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="已识别资产" value={graphReport.summary.assets} />
          <Metric label="已连接资产" value={graphReport.summary.connected_assets} />
          <Metric label="Relation 连接" value={graphReport.summary.relation_links} />
          <Metric label="Relation 字段" value={graphReport.summary.relation_fields} />
          <Metric label="待补全资产" value={graphReport.summary.unlinked_assets} />
          <Metric
            label="补关系建议"
            value={graphReport.summary.completion_actions}
          />
          <Metric label="结构缺口" value={graphReport.summary.schema_gaps} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <CoveragePanel
            coverage={graphReport.coverage}
            onOpenModule={(kind) => router.push(MODULE_ROUTES[kind])}
          />
          <BoundaryPanel report={graphReport} />
        </section>

        <SchemaGapPanel
          gaps={schemaGaps}
          totalGaps={graphReport.schema_gaps.length}
          onOpenDatabaseRoute={(route) => router.push(route)}
          busyGapId={schemaGapBusyId}
          onCreateField={(gap) => void handleCreateSchemaGapField(gap)}
        />

        <SchemaFieldCreationResultPanel
          result={schemaFieldCreationResult}
          onOpenDatabase={(route) => router.push(route)}
        />

        <CompletionPlanPanel
          actions={completionActions}
          totalActions={graphReport.completion_plan.actions.length}
          missingTargets={graphReport.completion_plan.missing_targets}
          onOpenDatabaseRoute={(route) => router.push(route)}
          onOpenModule={(kind) => router.push(MODULE_ROUTES[kind])}
        />

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <RelationLinksPanel
            links={recentLinks}
            total={graph.relationLinks.length}
            onOpenPage={(pageId) => router.push(`/page/${pageId}`)}
          />
          <UnlinkedAssetsPanel
            assets={unlinkedAssets}
            total={graph.unlinkedAssets.length}
            actionByAssetId={completionActionByAssetId}
            onOpenPage={(pageId) => router.push(`/page/${pageId}`)}
            onCompleteAction={(action) => router.push(action.database_route)}
          />
        </section>

        <DatabaseSurfacePanel
          surfaces={graphReport.database_surfaces}
          onOpenDatabase={(databaseId) => router.push(`/database/${databaseId}`)}
        />
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

function CoveragePanel({
  coverage,
  onOpenModule,
}: {
  coverage: ResearchGraphReport["coverage"];
  onOpenModule: (kind: ResearchAssetKind) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        模块覆盖
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {coverage.map((item) => {
          const rate = item.assets
            ? Math.round((item.connected_assets / item.assets) * 100)
            : 0;

          return (
            <article
              key={item.kind}
              className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.label}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    {item.assets} 个资产 · {item.connected_assets} 已连接
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenModule(item.kind)}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  打开
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded bg-zinc-900 dark:bg-zinc-100"
                  style={{ width: `${rate}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {rate}% 覆盖 · {item.unlinked_assets} 待补 ·{" "}
                {item.relation_links} 条连接
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BoundaryPanel({ report }: { report: ResearchGraphReport }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        本地边界
      </h2>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
        <BoundaryItem
          label="读取正文用于分类"
          value={report.boundary.reads_page_text_for_classification ? "是" : "否"}
        />
        <BoundaryItem
          label="导出页面正文"
          value={report.boundary.includes_page_text ? "是" : "否"}
        />
        <BoundaryItem
          label="导出表格行值"
          value={report.boundary.includes_database_row_values ? "是" : "否"}
        />
        <BoundaryItem
          label="导出文件字节"
          value={report.boundary.includes_file_bytes ? "是" : "否"}
        />
        <BoundaryItem
          label="上传数据"
          value={report.boundary.uploads_data ? "是" : "否"}
        />
        <BoundaryItem
          label="写入工作区"
          value={report.boundary.writes_workspace_data ? "是" : "否"}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-400">
        导出报告只包含标题、类型、连接字段、覆盖统计和本地页面 id。
      </p>
    </section>
  );
}

function BoundaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <span>{label}</span>
      <span className="font-medium text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

function SchemaGapPanel({
  gaps,
  totalGaps,
  onOpenDatabaseRoute,
  busyGapId,
  onCreateField,
}: {
  gaps: ResearchGraphSchemaGap[];
  totalGaps: number;
  onOpenDatabaseRoute: (route: string) => void;
  busyGapId: string | null;
  onCreateField: (gap: ResearchGraphSchemaGap) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            关系结构检查
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            检查公司、报告、会议和组合跟踪表是否具备最低 relation 字段结构。
            创建字段前会二次确认。
          </p>
        </div>
        <span className="text-xs text-zinc-400">{totalGaps} 个缺口</span>
      </div>

      {gaps.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无结构缺口。当前已识别跟踪表的 relation 字段覆盖了基础投研连接。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {gaps.map((gap) => (
            <article
              key={gap.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {gap.database_title}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  缺少 {gap.missing_relation_label} relation · 建议字段：
                  {gap.suggested_field_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenDatabaseRoute(gap.database_route)}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                打开表
              </button>
              <button
                type="button"
                disabled={busyGapId === gap.id}
                onClick={() => onCreateField(gap)}
                className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                {busyGapId === gap.id ? "创建中..." : "创建字段"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SchemaFieldCreationResultPanel({
  result,
  onOpenDatabase,
}: {
  result: SchemaFieldCreationResult | null;
  onOpenDatabase: (route: string) => void;
}) {
  if (!result) return null;

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
            本地结构动作
          </p>
          <h2 className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
            {result.created ? "已创建 relation 字段" : "字段已存在，已刷新图谱"}
          </h2>
          <p className="mt-2 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
            {result.databaseTitle} · {result.fieldName} · 指向
            {result.relationLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
            这是本地结构动作，不包含页面正文、表格行值、文件内容、同步或上传。
            下一步可以打开对应数据库，手动补充具体 relation 值。
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span className="text-xs text-emerald-700 dark:text-emerald-300">
            {formatDateTime(result.createdAt)}
          </span>
          <button
            type="button"
            onClick={() => onOpenDatabase(result.nextRoute)}
            className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
          >
            打开数据库
          </button>
        </div>
      </div>
    </section>
  );
}

function CompletionPlanPanel({
  actions,
  totalActions,
  missingTargets,
  onOpenDatabaseRoute,
  onOpenModule,
}: {
  actions: ResearchGraphCompletionAction[];
  totalActions: number;
  missingTargets: ResearchGraphReport["completion_plan"]["missing_targets"];
  onOpenDatabaseRoute: (route: string) => void;
  onOpenModule: (kind: ResearchAssetKind) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            补关系建议
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            这些建议只打开目标数据库并聚焦资产，不会自动写入 relation。
          </p>
        </div>
        <span className="text-xs text-zinc-400">{totalActions} 条建议</span>
      </div>

      {actions.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无可执行补关系建议。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {actions.map((action) => (
            <article
              key={action.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {action.asset_title}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {action.asset_kind_label} → {action.target_database_title}
                </p>
                {action.relation_field_labels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {action.relation_field_labels.map((fieldLabel) => (
                      <span
                        key={fieldLabel}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {fieldLabel}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenDatabaseRoute(action.database_route)}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                去补关系
              </button>
            </article>
          ))}
        </div>
      )}

      {missingTargets.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
          <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            还缺补全入口
          </h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {missingTargets.map((target) => (
              <div
                key={target.kind}
                className="flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300"
              >
                <span>
                  {target.kind_label}：{target.unlinked_assets} 个资产需要先建跟踪表或 relation 字段
                </span>
                <button
                  type="button"
                  onClick={() => onOpenModule(target.kind)}
                  className="shrink-0 rounded-md border border-amber-300 px-2 py-1 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900"
                >
                  打开模块
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RelationLinksPanel({
  links,
  total,
  onOpenPage,
}: {
  links: ResearchRelationLink[];
  total: number;
  onOpenPage: (pageId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          最近连接
        </h2>
        <span className="text-xs text-zinc-400">{total} 条</span>
      </div>
      {links.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无 relation 连接。先在公司、报告、会议或组合跟踪表里添加 relation 字段。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <AssetButton asset={link.source} onOpenPage={onOpenPage} />
                <span className="text-xs text-zinc-400">
                  通过 {getResearchRelationFieldLabel(link.fieldName)}
                </span>
                <AssetButton asset={link.target} onOpenPage={onOpenPage} />
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                来自 {link.databaseTitle}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UnlinkedAssetsPanel({
  assets,
  total,
  actionByAssetId,
  onOpenPage,
  onCompleteAction,
}: {
  assets: ResearchAsset[];
  total: number;
  actionByAssetId: Map<string, ResearchGraphCompletionAction>;
  onOpenPage: (pageId: string) => void;
  onCompleteAction: (action: ResearchGraphCompletionAction) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          待补全资产
        </h2>
        <span className="text-xs text-zinc-400">{total} 个</span>
      </div>
      {assets.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无待补全资产。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {assets.map((asset) => (
            <UnlinkedAssetItem
              key={asset.id}
              asset={asset}
              completionAction={actionByAssetId.get(asset.id) ?? null}
              onOpenPage={onOpenPage}
              onCompleteAction={onCompleteAction}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function UnlinkedAssetItem({
  asset,
  completionAction,
  onOpenPage,
  onCompleteAction,
}: {
  asset: ResearchAsset;
  completionAction: ResearchGraphCompletionAction | null;
  onOpenPage: (pageId: string) => void;
  onCompleteAction: (action: ResearchGraphCompletionAction) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {asset.icon ? `${asset.icon} ` : ""}
          {asset.title}
        </h3>
        <p className="text-xs text-zinc-400">
          {getResearchAssetKindLabel(asset.kind)} · {formatUpdated(asset.updatedAt)}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {completionAction && (
          <button
            type="button"
            onClick={() => onCompleteAction(completionAction)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            补关系
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenPage(asset.id)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          打开
        </button>
      </div>
    </li>
  );
}

function DatabaseSurfacePanel({
  surfaces,
  onOpenDatabase,
}: {
  surfaces: ResearchGraphReport["database_surfaces"];
  onOpenDatabase: (databaseId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          本地跟踪表
        </h2>
        <span className="text-xs text-zinc-400">{surfaces.length} 个</span>
      </div>
      {surfaces.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无已识别的投研跟踪表。可以先从公司研究、报告库、会议或组合模块创建模板表。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {surfaces.map((surface) => (
            <article
              key={surface.database_id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {surface.title || "未命名跟踪表"}
                </h3>
                <p className="text-xs text-zinc-400">
                  {surface.kind_label ?? "未分类"} · {surface.rows} 行 ·{" "}
                  {surface.relation_fields} 个 relation 字段
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenDatabase(surface.database_id)}
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

function AssetButton({
  asset,
  onOpenPage,
}: {
  asset: ResearchAsset;
  onOpenPage: (pageId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenPage(asset.id)}
      className="min-w-0 max-w-[220px] truncate text-left text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      title={asset.title}
    >
      {asset.icon ? `${asset.icon} ` : ""}
      {asset.title}
    </button>
  );
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
