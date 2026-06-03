"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getFields, getRows } from "@/lib/db/local/queries";
import {
  buildResearchGraph,
  classifyResearchDatabase,
  getResearchAssetKindLabel,
  getResearchRelationFieldLabel,
  inferResearchKindFromRelationField,
  type ResearchAsset,
  type ResearchAssetKind,
  type ResearchDatabaseSnapshot,
  type ResearchRelationLink,
} from "@/lib/modules/researchGraph";
import type { Database, Page } from "@/lib/utils/types";

interface ResearchConnectionsPanelProps {
  pages: Page[];
  databases: Database[];
  focusKind: ResearchAssetKind;
}

const MODULE_ROUTES: Record<ResearchAssetKind, string> = {
  company: "/modules/company-research",
  report: "/modules/reports",
  meeting: "/modules/meetings",
  portfolio: "/modules/portfolio",
};

export default function ResearchConnectionsPanel({
  pages,
  databases,
  focusKind,
}: ResearchConnectionsPanelProps) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<ResearchDatabaseSnapshot[]>([]);

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
  const primaryCompletionTarget = completionTargets[0] ?? null;
  const relationCount = graph.relationLinks.length;
  const connectedAssetCount = new Set(
    graph.relationLinks.flatMap((link) => [link.source.id, link.target.id])
  ).size;

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
        <div className="text-xs text-zinc-400">
          {researchDatabases.length} 个本地跟踪表
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="已识别资产" value={graph.assets.length} />
        <Metric label="已连接资产" value={connectedAssetCount} />
        <Metric label="Relation 连接" value={relationCount} />
        <Metric label="待补全关联" value={graph.unlinkedAssets.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <RelationList
          links={focusLinks}
          focusKind={focusKind}
          onOpenPage={(pageId) => router.push(`/page/${pageId}`)}
        />
        <div className="space-y-4">
          <CompletionGuidePanel
            targets={completionTargets}
            focusKind={focusKind}
            onOpenDatabase={(databaseId) =>
              router.push(buildDatabaseRoute(databaseId))
            }
          />
          <CoveragePanel
            counts={graph.counts}
            onOpenModule={(kind) => router.push(MODULE_ROUTES[kind])}
          />
        </div>
      </div>

      <UnlinkedAssetList
        assets={focusUnlinkedAssets}
        focusKind={focusKind}
        completionTarget={primaryCompletionTarget}
        onOpenPage={(pageId) => router.push(`/page/${pageId}`)}
        onCompleteAsset={(asset, target) =>
          router.push(buildDatabaseRoute(target.databaseId, asset))
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
          暂无结构化 relation 连接。
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
  counts,
  onOpenModule,
}: {
  counts: Record<ResearchAssetKind, number>;
  onOpenModule: (kind: ResearchAssetKind) => void;
}) {
  const kinds: ResearchAssetKind[] = ["company", "report", "meeting", "portfolio"];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        模块覆盖
      </h3>
      <div className="mt-3 space-y-2">
        {kinds.map((kind) => (
          <div
            key={kind}
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
          >
            <div>
              <div className="text-sm text-zinc-800 dark:text-zinc-200">
                {getResearchAssetKindLabel(kind)}
              </div>
              <div className="text-xs text-zinc-400">{counts[kind]} 个资产</div>
            </div>
            <button
              type="button"
              onClick={() => onOpenModule(kind)}
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
