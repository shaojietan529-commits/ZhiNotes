"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PagePeekModal, {
  warmPagePeekModal,
} from "@/components/page/LazyPagePeekModal";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { useDatabases } from "@/hooks/useDatabases";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { usePages } from "@/hooks/usePages";
import { getFields, getRows } from "@/lib/db/local/queries";
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
  type ResearchGraphPriorityLevel,
  type ResearchGraphReport,
  type ResearchGraphSchemaGap,
  type ResearchRelationLink,
} from "@/lib/modules/researchGraph";
import {
  buildResearchWorkbenchPacket,
  type ResearchWorkbenchActionStatus,
  type ResearchWorkbenchDecisionStatus,
  type ResearchWorkbenchPacket,
} from "@/lib/modules/researchWorkbench";
import {
  RESEARCH_PROJECT_MODE_OPTIONS,
  buildResearchProjectBriefPageHtml,
  buildResearchProjectPageTitle,
  buildResearchProjectBrief,
  type ResearchProjectBrief,
  type ResearchProjectChecklistStatus,
  type ResearchProjectMode,
} from "@/lib/modules/researchProjectBrief";
import { getResearchModuleRoute } from "@/lib/modules/researchWorkflow";
import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import { rememberPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations");
const loadDatabaseMutationModule = () =>
  import("@/lib/database/cloudDatabaseMutations");

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
  const openPage = useLocalFirstPageNavigation();
  const pagesById = useWorkspaceStore((s) => s.pagesById);
  const { pages, upsertPages } = usePages({
    includeContent: true,
    deferContent: true,
    autoHydrateContent: false,
  });
  const { databases, refresh: refreshDatabases } = useDatabases();
  const [snapshots, setSnapshots] = useState<ResearchDatabaseSnapshot[]>([]);
  const [exportingGraphReport, setExportingGraphReport] = useState(false);
  const [exportingWorkbenchPacket, setExportingWorkbenchPacket] =
    useState(false);
  const [exportingProjectBrief, setExportingProjectBrief] = useState(false);
  const [creatingProjectPage, setCreatingProjectPage] = useState(false);
  const [projectTopic, setProjectTopic] = useState("");
  const [projectMode, setProjectMode] =
    useState<ResearchProjectMode>("initiation");
  const [projectHorizon, setProjectHorizon] = useState("本周");
  const [schemaGapBusyId, setSchemaGapBusyId] = useState<string | null>(null);
  const [schemaFieldCreationResult, setSchemaFieldCreationResult] =
    useState<SchemaFieldCreationResult | null>(null);
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);

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
  const workbenchPacket = useMemo(
    () => buildResearchWorkbenchPacket(graphReport),
    [graphReport]
  );
  const projectBrief = useMemo(
    () =>
      buildResearchProjectBrief({
        topic: projectTopic,
        projectMode,
        horizon: projectHorizon,
        graphReport,
        workbench: workbenchPacket,
      }),
    [graphReport, projectHorizon, projectMode, projectTopic, workbenchPacket]
  );
  const openGraphPage = useCallback((pageId: string) => {
    openPage(pagesById.get(pageId) ?? pageId, { source: "module-open" });
  }, [openPage, pagesById]);
  const openCreatedResearchPage = useCallback((page: Page) => {
    rememberPendingPageDraft(page);
    rememberPageRouteHandoff(page, "module-create");
    warmPagePeekModal();
    setPeekInitialPage(page);
    setPeekPageId(page.id);
  }, []);
  const openResearchFullPageById = useCallback(
    (pageId: string) => {
      const page =
        (peekInitialPage?.id === pageId ? peekInitialPage : null) ??
        pagesById.get(pageId);
      if (page) {
        openPage(page, { source: "module-open" });
        return;
      }
      openPage(pageId, { source: "module-open" });
    },
    [openPage, pagesById, peekInitialPage]
  );
  const recentLinks = graph.relationLinks.slice(0, 12);
  const unlinkedAssets = graph.unlinkedAssets.slice(0, 12);
  const completionActions = graphReport.completion_plan.actions.slice(0, 10);
  const relationHandoffPackets =
    graphReport.relation_handoff_packets.slice(0, 8);
  const schemaGaps = graphReport.schema_gaps.slice(0, 8);
  const priorityQueue = graphReport.priority_queue.slice(0, 10);
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

  const handleExportWorkbenchPacket = () => {
    setExportingWorkbenchPacket(true);
    try {
      downloadJsonFile(
        `zhinote-research-workbench-${fileSafeTimestamp()}.json`,
        {
          ...workbenchPacket,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export research workbench packet:", err);
      window.alert("投研工作台行动包导出失败，请查看控制台。");
    } finally {
      setExportingWorkbenchPacket(false);
    }
  };

  const handleExportProjectBrief = () => {
    setExportingProjectBrief(true);
    try {
      downloadJsonFile(`zhinote-research-project-${fileSafeTimestamp()}.json`, {
        ...projectBrief,
        exported_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Zhinote] Failed to export research project brief:", err);
      window.alert("研究项目简报导出失败，请查看控制台。");
    } finally {
      setExportingProjectBrief(false);
    }
  };

  const handleCreateProjectPage = async () => {
    setCreatingProjectPage(true);
    warmPagePeekModal();
    try {
      const { createPageWithCloud, updatePageWithCloud } =
        await loadPageMutationModule();
      const page = await createPageWithCloud({
        title: buildResearchProjectPageTitle(projectBrief),
        icon: "🧭",
      });
      const updatedPage = await updatePageWithCloud(page.id, {
        content_text: buildResearchProjectBriefPageHtml(projectBrief),
      });
      const createdPage = updatedPage ?? page;
      upsertPages([createdPage]);
      openCreatedResearchPage(createdPage);
    } catch (err) {
      console.error("[Zhinote] Failed to create research project page:", err);
      window.alert("研究项目页创建失败，请查看控制台。");
    } finally {
      setCreatingProjectPage(false);
    }
  };

  const handleDecisionOpen = (
    decision: ResearchWorkbenchPacket["decision_summary"]["decisions"][number]
  ) => {
    if (decision.route === "/modules/research-graph") {
      document
        .getElementById(decision.target_section_id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push(`${decision.route}#${decision.target_section_id}`);
  };

  const handleCreateSchemaGapField = async (gap: ResearchGraphSchemaGap) => {
    const confirmed = window.confirm(
      `在「${gap.database_title}」里创建关系字段「${gap.suggested_field_name}」？\n\n这只会修改本地数据库结构，不会写入行数据、同步或上传。`
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
        const { addField } = await loadDatabaseMutationModule();
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
      await refreshDatabases();
      await reloadSnapshots();
    } catch (err) {
      console.error("[Zhinote] Failed to create relation field:", err);
      window.alert("关系字段创建失败，请查看控制台。");
    } finally {
      setSchemaGapBusyId(null);
    }
  };

  return (
    <>
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
                集中查看公司、报告、会议和组合之间的本地关系连接，
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
              <button
                type="button"
                onClick={handleExportWorkbenchPacket}
                disabled={exportingWorkbenchPacket}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingWorkbenchPacket
                  ? "正在导出..."
                  : "导出工作台行动包"}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Metric label="已识别资产" value={graphReport.summary.assets} />
          <Metric label="已连接资产" value={graphReport.summary.connected_assets} />
          <Metric label="关系连接" value={graphReport.summary.relation_links} />
          <Metric label="关系字段" value={graphReport.summary.relation_fields} />
          <Metric label="待补全资产" value={graphReport.summary.unlinked_assets} />
          <Metric
            label="补关系建议"
            value={graphReport.summary.completion_actions}
          />
          <Metric label="结构缺口" value={graphReport.summary.schema_gaps} />
          <Metric label="工作队列" value={workbenchPacket.summary.actions} />
        </section>

        <ResearchGraphDecisionSummaryPanel
          summary={workbenchPacket.decision_summary}
          exportingWorkbench={exportingWorkbenchPacket}
          onExportWorkbench={handleExportWorkbenchPacket}
          onOpenDecision={handleDecisionOpen}
        />

        <ResearchProjectBriefPanel
          brief={projectBrief}
          topic={projectTopic}
          projectMode={projectMode}
          horizon={projectHorizon}
          exporting={exportingProjectBrief}
          creatingPage={creatingProjectPage}
          onTopicChange={setProjectTopic}
          onModeChange={setProjectMode}
          onHorizonChange={setProjectHorizon}
          onExport={handleExportProjectBrief}
          onCreatePage={handleCreateProjectPage}
          onOpenRoute={(route) => router.push(route)}
        />

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <CoveragePanel
            coverage={graphReport.coverage}
            onOpenModule={(kind) => router.push(getResearchModuleRoute(kind))}
          />
          <BoundaryPanel report={graphReport} />
        </section>

        <HealthSummaryPanel
          items={graphReport.health_summary}
          onOpenRoute={(route) => router.push(route)}
        />

        <ResearchWorkbenchPanel
          packet={workbenchPacket}
          onOpenRoute={(route) => router.push(route)}
        />

        <PriorityQueuePanel
          items={priorityQueue}
          totalItems={graphReport.priority_queue.length}
          highPriorityItems={graphReport.summary.high_priority_unlinked_assets}
          actionableItems={graphReport.summary.actionable_priority_items}
          onOpenRoute={(route) => router.push(route)}
          onOpenPage={openGraphPage}
        />

        <RelationHandoffPanel
          packets={relationHandoffPackets}
          totalPackets={graphReport.summary.relation_handoff_packets}
          onOpenRoute={(route) => router.push(route)}
        />

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
          onOpenModule={(kind) => router.push(getResearchModuleRoute(kind))}
        />

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <RelationLinksPanel
            links={recentLinks}
            total={graph.relationLinks.length}
            onOpenPage={openGraphPage}
          />
          <UnlinkedAssetsPanel
            assets={unlinkedAssets}
            total={graph.unlinkedAssets.length}
            actionByAssetId={completionActionByAssetId}
            onOpenPage={openGraphPage}
            onCompleteAction={(action) => router.push(action.database_route)}
          />
        </section>

        <DatabaseSurfacePanel
          surfaces={graphReport.database_surfaces}
          onOpenDatabase={(databaseId) => router.push(`/database/${databaseId}`)}
        />
      </div>
      </div>
      {peekPageId && (
        <PagePeekModal
          pageId={peekPageId}
          initialPage={peekInitialPage}
          onClose={() => {
            setPeekPageId(null);
            setPeekInitialPage(null);
          }}
          onOpenFull={(id) => {
            setPeekPageId(null);
            setPeekInitialPage(null);
            openResearchFullPageById(id);
          }}
        />
      )}
    </>
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

function ResearchGraphDecisionSummaryPanel({
  summary,
  exportingWorkbench,
  onExportWorkbench,
  onOpenDecision,
}: {
  summary: ResearchWorkbenchPacket["decision_summary"];
  exportingWorkbench: boolean;
  onExportWorkbench: () => void;
  onOpenDecision: (
    decision: ResearchWorkbenchPacket["decision_summary"]["decisions"][number]
  ) => void;
}) {
  return (
    <section
      id="research-graph-decision-summary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            研究图谱决策总览
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            研究图谱决策摘要
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
          {exportingWorkbench ? "导出中..." : "导出工作台行动包"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summary.decisions.map((decision) => (
          <ResearchGraphDecisionCard
            key={decision.id}
            decision={decision}
            onOpen={() => onOpenDecision(decision)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ResearchGraphDecisionList
          title="当前可做"
          items={summary.safe_local_work}
        />
        <ResearchGraphDecisionList
          title="保持关闭"
          items={summary.blocked_work}
        />
        <ResearchGraphDecisionList
          title="待你确认"
          items={summary.required_owner_decisions}
        />
      </div>

      <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        研究图谱决策摘要只读取本地摘要元数据，不包含页面正文、数据库行值、
        文件名、文件字节、持仓、交易计划、提示词、token、凭证、云端数据或 AI 输出。
      </p>
    </section>
  );
}

function ResearchGraphDecisionCard({
  decision,
  onOpen,
}: {
  decision: ResearchWorkbenchPacket["decision_summary"]["decisions"][number];
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
          <ResearchGraphDecisionStatusPill status={decision.status} />
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

function ResearchGraphDecisionList({
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

function ResearchGraphDecisionStatusPill({
  status,
}: {
  status: ResearchWorkbenchDecisionStatus;
}) {
  const label: Record<ResearchWorkbenchDecisionStatus, string> = {
    "available-local": "本地可做",
    "requires-owner-confirmation": "需确认",
    blocked: "阻塞",
  };
  const className: Record<ResearchWorkbenchDecisionStatus, string> = {
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

function ResearchProjectBriefPanel({
  brief,
  topic,
  projectMode,
  horizon,
  exporting,
  creatingPage,
  onTopicChange,
  onModeChange,
  onHorizonChange,
  onExport,
  onCreatePage,
  onOpenRoute,
}: {
  brief: ResearchProjectBrief;
  topic: string;
  projectMode: ResearchProjectMode;
  horizon: string;
  exporting: boolean;
  creatingPage: boolean;
  onTopicChange: (value: string) => void;
  onModeChange: (value: ResearchProjectMode) => void;
  onHorizonChange: (value: string) => void;
  onExport: () => void;
  onCreatePage: () => void;
  onOpenRoute: (route: string) => void;
}) {
  const selectedMode =
    RESEARCH_PROJECT_MODE_OPTIONS.find((option) => option.id === projectMode) ??
    RESEARCH_PROJECT_MODE_OPTIONS[0];
  const topChecklist = brief.checklist.slice(0, 8);
  const topSequence = brief.review_sequence.slice(0, 5);

  return (
    <section
      id="research-project-brief"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            投研项目简报
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            投研项目启动器
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {brief.topic_status === "owner-entered"
              ? `当前主题：${brief.topic}`
              : "先输入一个研究主题，系统会把公司、报告、会议、组合和关系工作排成一个本地清单。"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreatePage}
            disabled={creatingPage}
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            {creatingPage ? "创建中..." : "创建项目页"}
          </button>
          <button
            type="button"
            onClick={() => onOpenRoute(brief.summary.recommended_first_route)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {brief.summary.recommended_first_label}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {exporting ? "导出中..." : "导出简报"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.75fr]">
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          研究主题
          <input
            value={topic}
            onChange={(event) => onTopicChange(event.target.value)}
            placeholder="例如：AI capex 是否进入下修周期"
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          项目类型
          <select
            value={projectMode}
            onChange={(event) =>
              onModeChange(event.target.value as ResearchProjectMode)
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
            onChange={(event) => onHorizonChange(event.target.value)}
            placeholder="本周 / 本季度 / 业绩前"
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400"
          />
        </label>
      </div>

      <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        {selectedMode.description} 简报只读取图谱和工作台摘要元数据；
        导出会包含你手动输入的主题，但不包含页面正文、数据库行值、文件名、文件内容、持仓或交易计划。
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <WorkbenchMetric
          label="图谱资产"
          value={brief.summary.graph_assets}
        />
        <WorkbenchMetric
          label="已连接"
          value={brief.summary.connected_assets}
        />
        <WorkbenchMetric
          label="待补关系"
          value={brief.summary.relation_actions}
        />
        <WorkbenchMetric
          label="清单"
          value={brief.summary.checklist_items}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              模块准备度
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {brief.module_plans.map((plan) => (
                <ResearchProjectModuleCard
                  key={plan.kind}
                  plan={plan}
                  onOpenRoute={onOpenRoute}
                />
              ))}
            </div>
          </div>
          <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              推荐顺序
            </h3>
            <div className="mt-2 grid gap-2">
              {topSequence.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onOpenRoute(step.route)}
                  className="rounded-md bg-zinc-50 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {step.order}. {step.title}
                  </div>
                  <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                    {step.reason}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              项目清单
            </h3>
            <span className="text-xs text-zinc-400">
              {brief.summary.checklist_ready} 已就绪 ·{" "}
              {brief.summary.checklist_needing_review} 需复核
            </span>
          </div>
          <div className="mt-2 grid gap-2">
            {topChecklist.map((item) => (
              <ResearchProjectChecklistRow
                key={item.id}
                item={item}
                onOpenRoute={onOpenRoute}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-400 dark:bg-zinc-900">
        保持关闭：{brief.blocked_actions.join(" / ")}
      </p>
    </section>
  );
}

function ResearchProjectModuleCard({
  plan,
  onOpenRoute,
}: {
  plan: ResearchProjectBrief["module_plans"][number];
  onOpenRoute: (route: string) => void;
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {plan.label}
          </h4>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {plan.role}
          </p>
        </div>
        <ResearchProjectStatusPill status={plan.readiness} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <HealthNumber label="资产" value={plan.assets} />
        <HealthNumber label="已连" value={plan.connected_assets} />
        <HealthNumber label="缺口" value={plan.unlinked_assets} />
      </div>
      <p className="mt-2 leading-5 text-zinc-400">
        {plan.connection_rate}% 覆盖 · {plan.schema_gaps} 个结构缺口
      </p>
      <button
        type="button"
        onClick={() => onOpenRoute(plan.next_action_route)}
        className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {plan.next_action_label}
      </button>
    </article>
  );
}

function ResearchProjectChecklistRow({
  item,
  onOpenRoute,
}: {
  item: ResearchProjectBrief["checklist"][number];
  onOpenRoute: (route: string) => void;
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {item.title}
            </h4>
            <ResearchProjectStatusPill status={item.status} />
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {getProjectSurfaceLabel(item.surface)}
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
  );
}

function ResearchProjectStatusPill({
  status,
}: {
  status: ResearchProjectChecklistStatus;
}) {
  const labels: Record<ResearchProjectChecklistStatus, string> = {
    ready: "就绪",
    "needs-review": "需复核",
    missing: "缺失",
    "blocked-boundary": "阻塞",
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
    <span
      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${className}`}
    >
      {labels[status]}
    </span>
  );
}

function getProjectSurfaceLabel(
  surface: ResearchProjectBrief["checklist"][number]["surface"]
) {
  const labels: Record<typeof surface, string> = {
    page: "页面",
    database: "数据库",
    file: "文件",
    relation: "关系",
    boundary: "边界",
  };
  return labels[surface];
}

function CoveragePanel({
  coverage,
  onOpenModule,
}: {
  coverage: ResearchGraphReport["coverage"];
  onOpenModule: (kind: ResearchAssetKind) => void;
}) {
  return (
    <section
      id="research-graph-coverage"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
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
    <section
      id="research-graph-local-boundary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
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

function HealthSummaryPanel({
  items,
  onOpenRoute,
}: {
  items: ResearchGraphReport["health_summary"];
  onOpenRoute: (route: string) => void;
}) {
  return (
    <section
      id="research-graph-health-summary"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            连接健康摘要
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            按公司、报告、会议和组合检查跟踪表、关系字段和待补关系值。
          </p>
        </div>
        <span className="text-xs text-zinc-400">仅本地元数据</span>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.kind}
            className="flex min-h-[180px] flex-col justify-between rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.kind_label}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    {getHealthStatusLabel(item.status)}
                  </p>
                </div>
                <span className={getHealthBadgeClassName(item.status)}>
                  {item.connection_rate}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <HealthNumber label="资产" value={item.assets} />
                <HealthNumber label="已连" value={item.connected_assets} />
                <HealthNumber label="待补" value={item.unlinked_assets} />
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                跟踪表 {item.tracker_databases} 个 · 关系连接{" "}
                {item.relation_links} 条 · 建议 {item.completion_actions} 条
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                必需关系：{formatRelationLabels(item.required_relation_labels)}
              </p>
              {item.missing_relation_labels.length > 0 && (
                <p className="mt-1 text-xs leading-5 text-amber-600 dark:text-amber-300">
                  缺少：{formatRelationLabels(item.missing_relation_labels)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenRoute(item.next_action.route)}
              className="mt-3 w-fit rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {item.next_action.label}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function HealthNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900">
      <div className="text-zinc-400">{label}</div>
      <div className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function getHealthStatusLabel(
  status: ResearchGraphReport["health_summary"][number]["status"]
) {
  switch (status) {
    case "ready":
      return "连接健康";
    case "needs-assets":
      return "缺研究资产";
    case "needs-links":
      return "缺关系值";
    case "needs-schema":
      return "缺关系字段";
    case "needs-tracker":
      return "缺跟踪表";
  }
}

function getHealthBadgeClassName(
  status: ResearchGraphReport["health_summary"][number]["status"]
) {
  const base =
    "shrink-0 rounded-md px-2 py-1 text-xs font-semibold";
  if (status === "ready") {
    return `${base} bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300`;
  }
  if (status === "needs-links") {
    return `${base} bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300`;
  }
  if (status === "needs-assets") {
    return `${base} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`;
  }
  return `${base} bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300`;
}

function formatRelationLabels(labels: string[]) {
  if (labels.length === 0) return "无";
  return labels.join(" / ");
}

function ResearchWorkbenchPanel({
  packet,
  onOpenRoute,
}: {
  packet: ResearchWorkbenchPacket;
  onOpenRoute: (route: string) => void;
}) {
  const topActions = packet.actions.slice(0, 8);

  return (
    <section
      id="research-graph-workbench"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            投研工作台行动包
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            把研究图谱转换成公司、报告、会议、组合和关系结构的下一步队列。
            这里只打开本地页面或模块，不自动写关系、不创建字段、不上传数据。
          </p>
        </div>
        <span className="text-xs text-zinc-400">
          {packet.summary.actions} 个行动 · {packet.summary.high_priority} 个高优先级
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <WorkbenchMetric
          label="补关系"
          value={packet.summary.relation_actions}
        />
        <WorkbenchMetric label="补字段" value={packet.summary.schema_actions} />
        <WorkbenchMetric
          label="补跟踪表"
          value={packet.summary.tracker_actions}
        />
        <WorkbenchMetric
          label="手动确认"
          value={packet.summary.manual_confirmation_actions}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-2">
          {topActions.length > 0 ? (
            topActions.map((action) => (
              <WorkbenchActionRow
                key={action.id}
                action={action}
                onOpenRoute={onOpenRoute}
              />
            ))
          ) : (
            <p className="rounded-md border border-zinc-100 px-3 py-2 text-xs leading-5 text-zinc-400 dark:border-zinc-800">
              暂无工作台行动。当前图谱没有发现需要处理的断点、结构缺口或跟踪表缺口。
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {packet.module_rollups.map((rollup) => (
              <WorkbenchModuleRollupCard
                key={rollup.kind}
                rollup={rollup}
                onOpenRoute={onOpenRoute}
              />
            ))}
          </div>
	          <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
	            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
	              复核顺序
	            </h3>
            <div className="mt-2 grid gap-2">
              {packet.review_sequence.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onOpenRoute(step.route)}
                  className="rounded-md bg-zinc-50 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {step.order}. {step.title}
                  </div>
                  <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                    {step.reason}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkbenchMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function WorkbenchActionRow({
  action,
  onOpenRoute,
}: {
  action: ResearchWorkbenchPacket["actions"][number];
  onOpenRoute: (route: string) => void;
}) {
  return (
    <article className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {action.title}
            </h3>
            <PriorityPill priority={action.priority} />
            <WorkbenchStatusPill status={action.status} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {action.module_label} · {action.source}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenRoute(action.action_route)}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {action.route_label}
        </button>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {action.evidence}
      </p>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {action.next_action}
      </p>
    </article>
  );
}

function WorkbenchModuleRollupCard({
  rollup,
  onOpenRoute,
}: {
  rollup: ResearchWorkbenchPacket["module_rollups"][number];
  onOpenRoute: (route: string) => void;
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {rollup.label}
          </h3>
          <p className="mt-1 text-zinc-400">{rollup.health_status}</p>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {rollup.connection_rate}%
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {rollup.assets} 资产 · {rollup.unlinked_assets} 待补 ·{" "}
        {rollup.schema_gaps} 结构缺口
      </p>
      <button
        type="button"
        onClick={() => onOpenRoute(rollup.next_action_route)}
        className="mt-2 w-fit rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {rollup.next_action_label}
      </button>
    </article>
  );
}

function WorkbenchStatusPill({
  status,
}: {
  status: ResearchWorkbenchActionStatus;
}) {
  const labels: Record<ResearchWorkbenchActionStatus, string> = {
    "ready-to-start": "就绪",
    "needs-relation": "关系",
    "needs-schema": "结构",
    "needs-tracker": "跟踪表",
    "review-only": "复核",
  };

  const className =
    status === "needs-relation"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : status === "needs-schema"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : status === "needs-tracker"
          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          : status === "ready-to-start"
            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PriorityQueuePanel({
  items,
  totalItems,
  highPriorityItems,
  actionableItems,
  onOpenRoute,
  onOpenPage,
}: {
  items: ResearchGraphReport["priority_queue"];
  totalItems: number;
  highPriorityItems: number;
  actionableItems: number;
  onOpenRoute: (route: string) => void;
  onOpenPage: (pageId: string) => void;
}) {
  return (
    <section
      id="research-graph-priority-queue"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            断点优先队列
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            把未连接资产按公司/报告优先、可补关系优先排序。这里只给出本地打开入口，
            不自动写关系、不导出正文或行值。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
          <span>{totalItems} 个断点</span>
          <span>{highPriorityItems} 个高优先级</span>
          <span>{actionableItems} 个可直接补关系</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无断点队列。当前已识别资产都已有关系连接，或还没有可分类资产。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-md border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {item.asset_title}
                    </h3>
                    <PriorityPill priority={item.priority} />
                  </div>
                  <p className="mt-1 text-zinc-400">
                    {item.asset_kind_label} · {formatUpdated(item.updated_at)}
                    {item.target_database_title
                      ? ` · ${item.target_database_title}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPage(item.asset_id)}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  打开
                </button>
              </div>
              {item.relation_field_labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.relation_field_labels.map((label) => (
                    <span
                      key={label}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
                {item.reason}
              </p>
              <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
                {item.privacy_boundary}
              </p>
              <button
                type="button"
                onClick={() => onOpenRoute(item.action_route)}
                className="mt-3 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                {item.action_label}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PriorityPill({ priority }: { priority: ResearchGraphPriorityLevel }) {
  const labels: Record<ResearchGraphPriorityLevel, string> = {
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
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {labels[priority]}
    </span>
  );
}

function RelationHandoffPanel({
  packets,
  totalPackets,
  onOpenRoute,
}: {
  packets: ResearchGraphReport["relation_handoff_packets"];
  totalPackets: number;
  onOpenRoute: (route: string) => void;
}) {
  return (
    <section
      id="research-graph-relation-handoff"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            关系补全手册
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            把每个可执行补关系建议拆成确认资产、打开目标库、确认字段、手动补关系四步。
            手册只使用本地元数据，不自动写入关系值。
          </p>
        </div>
        <span className="text-xs text-zinc-400">{totalPackets} 个交接包</span>
      </div>

      {packets.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无交接包。需要先有可用跟踪表和关系字段，图谱才会生成手动补全步骤。
        </p>
      ) : (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {packets.map((packet) => (
            <article
              key={packet.id}
              className="rounded-md border border-zinc-100 px-3 py-3 text-xs dark:border-zinc-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {packet.handoff_label}
                  </div>
                  <h3 className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {packet.asset_title}
                  </h3>
                  <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                    目标：{packet.target_database_title}
                    {packet.target_database_kind_label
                      ? ` · ${packet.target_database_kind_label}跟踪表`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenRoute(packet.source_page_route)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    打开资产
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenRoute(packet.database_route)}
                    className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                  >
                    打开目标库
                  </button>
                </div>
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

              <HandoffStepList
                steps={packet.review_steps}
                onOpenRoute={onOpenRoute}
              />

              <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
                仅本地 · 不读正文 · 不导出行值 · 不自动写关系 · 不上传
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HandoffStepList({
  steps,
  onOpenRoute,
}: {
  steps: ResearchGraphReport["relation_handoff_packets"][number]["review_steps"];
  onOpenRoute: (route: string) => void;
}) {
  return (
    <ol className="mt-3 grid gap-2">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className="flex items-start gap-2 rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-900"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {step.title}
              </span>
              <button
                type="button"
                onClick={() => onOpenRoute(step.route)}
                className="rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {step.action_label}
              </button>
            </div>
            <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
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
    <section
      id="research-graph-schema-gaps"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            关系结构检查
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            检查公司、报告、会议和组合跟踪表是否具备最低关系字段结构。
            创建字段前会二次确认。
          </p>
        </div>
        <span className="text-xs text-zinc-400">{totalGaps} 个缺口</span>
      </div>

      {gaps.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无结构缺口。当前已识别跟踪表的关系字段覆盖了基础投研连接。
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
                  缺少 {gap.missing_relation_label} 关系 · 建议字段：
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
    <section
      id="research-graph-schema-action-result"
      className="scroll-mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
            本地结构动作
          </p>
          <h2 className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
            {result.created ? "已创建关系字段" : "字段已存在，已刷新图谱"}
          </h2>
          <p className="mt-2 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
            {result.databaseTitle} · {result.fieldName} · 指向
            {result.relationLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
            这是本地结构动作，不包含页面正文、表格行值、文件内容、同步或上传。
            下一步可以打开对应数据库，手动补充具体关系值。
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
    <section
      id="research-graph-completion-plan"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            补关系建议
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            这些建议只打开目标数据库并聚焦资产，不会自动写入关系。
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
                  {target.kind_label}：{target.unlinked_assets} 个资产需要先建跟踪表或关系字段
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
    <section
      id="research-graph-relation-links"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          最近连接
        </h2>
        <span className="text-xs text-zinc-400">{total} 条</span>
      </div>
      {links.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          暂无关系连接。先在公司、报告、会议或组合跟踪表里添加关系字段。
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
    <section
      id="research-graph-unlinked-assets"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
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
    <section
      id="research-graph-database-surfaces"
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
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
                  {surface.relation_fields} 个关系字段
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
