"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalFirstDatabaseNavigation } from "@/hooks/useLocalFirstDatabaseNavigation";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { getFields, getRows } from "@/lib/db/local/queries";
import { parseLocalFirstDatabaseRoute } from "@/lib/database/localFirstDatabaseNavigation";
import {
  buildResearchGraph,
  buildResearchGraphReport,
  classifyResearchDatabase,
  getResearchAssetKindLabel,
  getResearchRelationFieldLabel,
  inferResearchKindFromRelationField,
  type ResearchAsset,
  type ResearchAssetKind,
  type ResearchDatabaseSnapshot,
  type ResearchGraphReport,
  type ResearchRelationLink,
} from "@/lib/modules/researchGraph";
import { getResearchModuleRoute } from "@/lib/modules/researchWorkflow";
import type { Database, Page } from "@/lib/utils/types";

interface ResearchConnectionsPanelProps {
  pages: Page[];
  databases: Database[];
  focusKind: ResearchAssetKind;
}

export default function ResearchConnectionsPanel({
  pages,
  databases,
  focusKind,
}: ResearchConnectionsPanelProps) {
  const router = useRouter();
  const openDatabase = useLocalFirstDatabaseNavigation();
  const openPage = useLocalFirstPageNavigation();
  const pagesById = useWorkspaceStore((s) => s.pagesById);
  const [snapshots, setSnapshots] = useState<ResearchDatabaseSnapshot[]>([]);
  const [exportingGraphReport, setExportingGraphReport] = useState(false);

  const researchDatabases = useMemo(
    () => databases.filter((database) => classifyResearchDatabase(database)),
    [databases]
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      researchDatabases.map(async (database) => ({
        database,
        fields: await getFields(database.id),
        rows: await getRows(database.id),
      }))
    )
      .then((nextSnapshots) => {
        if (!cancelled) setSnapshots(nextSnapshots);
      })
      .catch((err) => {
        console.error("[Zhinote] Failed to load research graph:", err);
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
  const focusLinks = useMemo(
    () =>
      graph.relationLinks
        .filter(
          (link) => link.source.kind === focusKind || link.target.kind === focusKind
        )
        .slice(0, 6),
    [focusKind, graph.relationLinks]
  );
  const focusUnlinkedAssets = useMemo(
    () =>
      graph.unlinkedAssets
        .filter((asset) => asset.kind === focusKind)
        .slice(0, 5),
    [focusKind, graph.unlinkedAssets]
  );
  const completionTargets = useMemo(
    () => getCompletionTargets(snapshots, focusKind),
    [focusKind, snapshots]
  );
  const focusHandoffPackets = useMemo(
    () =>
      graphReport.relation_handoff_packets
        .filter((packet) => packet.asset_kind === focusKind)
        .slice(0, 4),
    [focusKind, graphReport.relation_handoff_packets]
  );
  const primaryCompletionTarget = completionTargets[0] ?? null;
  const relationCount = graph.relationLinks.length;
  const connectedAssetCount = new Set(
    graph.relationLinks.flatMap((link) => [link.source.id, link.target.id])
  ).size;

  const handleExportGraphReport = () => {
    setExportingGraphReport(true);
    try {
      downloadJsonFile(`zhinote-research-graph-${fileSafeTimestamp()}.json`, {
        ...graphReport,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export research graph report:", err);
      window.alert("研究图谱报告导出失败，请查看控制台。");
    } finally {
      setExportingGraphReport(false);
    }
  };

  const openRoute = (route: string) => {
    const databaseRoute = parseLocalFirstDatabaseRoute(route);
    if (databaseRoute) {
      openDatabase(databaseRoute.databaseId, databaseRoute.options);
      return;
    }
    router.push(route);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            投研关联
          </p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            跨模块关联图谱
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">
            {researchDatabases.length} 个本地跟踪表
          </span>
          <button
            type="button"
            onClick={handleExportGraphReport}
            disabled={exportingGraphReport}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {exportingGraphReport ? "正在导出..." : "导出图谱报告"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="已识别资产" value={graph.assets.length} />
        <Metric label="已连接资产" value={connectedAssetCount} />
        <Metric label="关系连接" value={relationCount} />
        <Metric label="关系字段" value={graphReport.summary.relation_fields} />
        <Metric label="待补全关联" value={graph.unlinkedAssets.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <RelationList
          links={focusLinks}
          focusKind={focusKind}
          onOpenPage={(pageId) =>
            openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })
          }
        />
        <div className="space-y-4">
          <CompletionGuidePanel
            targets={completionTargets}
            focusKind={focusKind}
            onOpenDatabase={(databaseId) => openDatabase(databaseId)}
          />
          <CoveragePanel
            coverage={graphReport.coverage}
            onOpenModule={(kind) => router.push(getResearchModuleRoute(kind))}
          />
        </div>
      </div>

      <ModuleRelationHandoffPanel
        packets={focusHandoffPackets}
        focusKind={focusKind}
        totalPackets={
          graphReport.relation_handoff_packets.filter(
            (packet) => packet.asset_kind === focusKind
          ).length
        }
        onOpenRoute={openRoute}
      />

      <UnlinkedAssetList
        assets={focusUnlinkedAssets}
        focusKind={focusKind}
        completionTarget={primaryCompletionTarget}
        onOpenPage={(pageId) =>
          openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" })
        }
        onCompleteAsset={(asset, target) =>
          openRoute(buildDatabaseRoute(target.databaseId, asset))
        }
      />
    </section>
  );
}

function buildDatabaseRoute(databaseId: string, asset?: ResearchAsset) {
  if (!asset) return `/database/${databaseId}`;
  const params = new URLSearchParams({
    q: asset.title,
    focus: asset.id,
    handoff: "module-connections",
  });
  return `/database/${databaseId}?${params.toString()}`;
}

interface CompletionTarget {
  databaseId: string;
  databaseTitle: string;
  databaseKind: ResearchAssetKind;
  fieldNames: string[];
}

function getCompletionTargets(
  snapshots: ResearchDatabaseSnapshot[],
  focusKind: ResearchAssetKind
): CompletionTarget[] {
  return snapshots
    .map((snapshot) => {
      const databaseKind = classifyResearchDatabase(snapshot.database);
      const fieldsForFocus = snapshot.fields
        .filter((field) => field.field_type === "relation")
        .filter(
          (field) => inferResearchKindFromRelationField(field.name) === focusKind
        )
        .map((field) => field.name);

      if (databaseKind !== focusKind && fieldsForFocus.length === 0) {
        return null;
      }

      return {
        databaseId: snapshot.database.id,
        databaseTitle: snapshot.database.title,
        databaseKind: databaseKind ?? focusKind,
        fieldNames: fieldsForFocus,
      };
    })
    .filter((target): target is CompletionTarget => Boolean(target))
    .slice(0, 4);
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

function RelationList({
  links,
  focusKind,
  onOpenPage,
}: {
  links: ResearchRelationLink[];
  focusKind: ResearchAssetKind;
  onOpenPage: (pageId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {getResearchAssetKindLabel(focusKind)}相关连接
      </h3>
      {links.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无结构化关系连接。
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
              <div className="mt-1 text-xs text-zinc-400">
                来自 {link.databaseTitle}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompletionGuidePanel({
  targets,
  focusKind,
  onOpenDatabase,
}: {
  targets: CompletionTarget[];
  focusKind: ResearchAssetKind;
  onOpenDatabase: (databaseId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        补全入口
      </h3>
      {targets.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无可用于补全{getResearchAssetKindLabel(focusKind)}关系的本地跟踪表。
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {targets.map((target) => (
            <div
              key={target.databaseId}
              className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {target.databaseTitle}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {getResearchAssetKindLabel(target.databaseKind)}跟踪表
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDatabase(target.databaseId)}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  去补全
                </button>
              </div>
              {target.fieldNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {target.fieldNames.map((fieldName) => (
                    <span
                      key={fieldName}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {getResearchRelationFieldLabel(fieldName)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
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
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        模块覆盖
      </h3>
      <div className="mt-3 space-y-2">
        {coverage.map((item) => (
          <div
            key={item.kind}
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
          >
            <div>
              <div className="text-sm text-zinc-800 dark:text-zinc-200">
                {item.label}
              </div>
              <div className="text-xs text-zinc-400">
                {item.assets} 个资产 · {item.connected_assets} 已连接 ·{" "}
                {item.unlinked_assets} 待补
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenModule(item.kind)}
              className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              打开
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModuleRelationHandoffPanel({
  packets,
  focusKind,
  totalPackets,
  onOpenRoute,
}: {
  packets: ResearchGraphReport["relation_handoff_packets"];
  focusKind: ResearchAssetKind;
  totalPackets: number;
  onOpenRoute: (route: string) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            关系补全手册
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            当前模块的待补{getResearchAssetKindLabel(focusKind)}资产会被拆成可执行步骤。
            这里只打开本地页面和数据库，不自动写关系。
          </p>
        </div>
        <span className="text-xs text-zinc-400">{totalPackets} 个交接步骤</span>
      </div>

      {packets.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无可执行交接步骤。先创建跟踪表和关系字段后，这里会显示补全步骤。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {packets.map((packet) => (
            <article
              key={packet.id}
              className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {packet.asset_title}
                  </div>
                  <p className="mt-1 leading-5 text-zinc-400">
                    目标：{packet.target_database_title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenRoute(packet.database_route)}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  打开目标库
                </button>
              </div>
              {packet.relation_field_labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {packet.relation_field_labels.map((label) => (
                    <span
                      key={label}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <ol className="mt-2 grid gap-1.5">
                {packet.review_steps.map((step, index) => (
                  <li
                    key={step.id}
                    className="flex gap-2 rounded bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900"
                  >
                    <span className="text-[10px] font-semibold text-zinc-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300">
                        {step.title}
                      </div>
                      <p className="mt-0.5 leading-5 text-zinc-400">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function UnlinkedAssetList({
  assets,
  focusKind,
  completionTarget,
  onOpenPage,
  onCompleteAsset,
}: {
  assets: ResearchAsset[];
  focusKind: ResearchAssetKind;
  completionTarget: CompletionTarget | null;
  onOpenPage: (pageId: string) => void;
  onCompleteAsset: (asset: ResearchAsset, target: CompletionTarget) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        待补全的{getResearchAssetKindLabel(focusKind)}资产
      </h3>
      {assets.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-400">暂无待补全资产。</p>
      ) : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {asset.icon ? `${asset.icon} ` : ""}
                  {asset.title}
                </div>
                <div className="text-xs text-zinc-400">
                  {getResearchAssetKindLabel(asset.kind)}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {completionTarget && (
                  <button
                    type="button"
                    onClick={() => onCompleteAsset(asset, completionTarget)}
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
          ))}
        </ul>
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
