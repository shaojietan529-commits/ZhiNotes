"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { usePages } from "@/hooks/usePages";
import { getAllDatabases } from "@/lib/db/local/queries";
import { listStoredPageFiles, type StoredPageFile } from "@/lib/files/localStore";
import {
  buildAiPayloadPreview,
  type AiPayloadPreview,
  type AiPayloadRisk,
} from "@/lib/ai/aiPayloadPreview";
import {
  buildAiExecutionPolicy,
  type AiExecutionGateStatus,
  type AiExecutionPolicy,
} from "@/lib/ai/aiExecutionPolicy";
import {
  AI_WORKFLOWS,
  getAiWorkflowSpec,
  type AiWorkflowId,
  type AiWorkflowSpec,
} from "@/lib/ai/aiWorkflowContract";
import {
  buildAiWorkflowReadinessReport,
  type AiWorkflowReadinessReport,
} from "@/lib/ai/aiWorkflowReadiness";
import {
  buildAiResearchRunbook,
  type AiResearchRunbook,
} from "@/lib/ai/aiResearchRunbook";
import {
  buildAiOutputReviewContract,
  type AiOutputReviewContract,
} from "@/lib/ai/aiOutputReview";
import { getHighRiskRequiredPhrase } from "@/lib/security/highRiskActionRegistry";
import { buildHighRiskConfirmationReceipt } from "@/lib/security/typedConfirmation";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

const PRIVACY_GATES = [
  "当前模块不调用 AI，/api/ai/run 是禁用的本地 stub。",
  "只有显式勾选的页面才会进入候选上下文。",
  "上传文件和 HTML 报告进入 AI 前需要单独确认。",
  "外部 provider、模型、账号边界和 retention 规则必须先确认。",
];

export default function AiWorkbenchShell() {
  return (
    <DatabaseProvider>
      <AiWorkbenchContent />
    </DatabaseProvider>
  );
}

function AiWorkbenchContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <AiWorkbenchDashboard />
      </main>
    </div>
  );
}

function AiWorkbenchDashboard() {
  const router = useRouter();
  const { pages } = usePages();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredPageFile[]>([]);
  const [workflowId, setWorkflowId] = useState<AiWorkflowId>("summary");
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [researchQuestion, setResearchQuestion] = useState("");
  const [exportingPayloadPreview, setExportingPayloadPreview] = useState(false);
  const [exportingExecutionPolicy, setExportingExecutionPolicy] =
    useState(false);
  const [exportingResearchRunbook, setExportingResearchRunbook] =
    useState(false);
  const [exportingOutputReview, setExportingOutputReview] = useState(false);
  const [exportingConfirmationReceipt, setExportingConfirmationReceipt] =
    useState(false);
  const [aiConfirmationPhrase, setAiConfirmationPhrase] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadLocalSurfaces() {
      try {
        const [loadedDatabases, loadedFiles] = await Promise.all([
          getAllDatabases(),
          listStoredPageFiles().catch(() => [] as StoredPageFile[]),
        ]);
        if (!mounted) return;
        setDatabases(loadedDatabases);
        setStoredFiles(loadedFiles);
      } catch (err) {
        console.error("[Zhinote] Failed to load AI workbench surfaces:", err);
        if (mounted) setLoadError("无法加载全部本地 AI 工作台资源。");
      }
    }

    void loadLocalSurfaces();

    return () => {
      mounted = false;
    };
  }, []);

  const recentPages = useMemo(() => pages.slice(0, 8), [pages]);
  const selectedPages = useMemo(
    () => pages.filter((page) => selectedPageIds.includes(page.id)),
    [pages, selectedPageIds]
  );
  const selectedWorkflow = getAiWorkflowSpec(workflowId);
  const aiWorkflowReadiness = useMemo(
    () => buildAiWorkflowReadinessReport(),
    []
  );
  const fileSummary = useMemo(() => summarizeFiles(storedFiles), [storedFiles]);
  const requestDraft = useMemo(
    () =>
      buildRequestDraft({
        workflow: selectedWorkflow,
        selectedPages,
        question: researchQuestion,
      }),
    [researchQuestion, selectedPages, selectedWorkflow]
  );
  const aiPayloadPreview = useMemo(
    () =>
      buildAiPayloadPreview({
        workflow: selectedWorkflow,
        selectedPages,
        storedFiles,
        question: researchQuestion,
      }),
    [researchQuestion, selectedPages, selectedWorkflow, storedFiles]
  );
  const aiExecutionPolicy = useMemo(
    () => buildAiExecutionPolicy({ payloadPreview: aiPayloadPreview }),
    [aiPayloadPreview]
  );
  const aiResearchRunbook = useMemo(
    () =>
      buildAiResearchRunbook({
        workflow: selectedWorkflow,
        payloadPreview: aiPayloadPreview,
        executionPolicy: aiExecutionPolicy,
      }),
    [aiExecutionPolicy, aiPayloadPreview, selectedWorkflow]
  );
  const aiOutputReview = useMemo(
    () =>
      buildAiOutputReviewContract({
        workflow: selectedWorkflow,
        payloadPreview: aiPayloadPreview,
        executionPolicy: aiExecutionPolicy,
        researchRunbook: aiResearchRunbook,
      }),
    [
      aiExecutionPolicy,
      aiPayloadPreview,
      aiResearchRunbook,
      selectedWorkflow,
    ]
  );
  const aiConfirmationReceipt = useMemo(
    () =>
      buildHighRiskConfirmationReceipt({
        actionId: "ai-external-run",
        requiredPhrase: getHighRiskRequiredPhrase("ai-external-run"),
        typedPhrase: aiConfirmationPhrase,
        scopeSummary: `${selectedWorkflow.title}; ${aiPayloadPreview.summary.selected_pages} selected pages; ${aiPayloadPreview.summary.files_available} available local files; prompt text included in receipt: no.`,
        riskSummary:
          "未来 AI 执行可能把已确认的页面正文、prompt 文本和获批文件内容发送到外部模型 provider。",
        destinationSummary:
          "尚未选择 AI provider；/api/ai/run 仍禁用且不读取 request body。",
      }),
    [aiConfirmationPhrase, aiPayloadPreview, selectedWorkflow]
  );

  const togglePage = (pageId: string) => {
    setSelectedPageIds((current) =>
      current.includes(pageId)
        ? current.filter((id) => id !== pageId)
        : [...current, pageId]
    );
  };

  const handleExportPayloadPreview = () => {
    setExportingPayloadPreview(true);
    try {
      downloadJsonFile(
        `zhinote-ai-payload-preview-${fileSafeTimestamp()}.json`,
        {
          ...aiPayloadPreview,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export AI payload preview:", err);
      window.alert("AI payload preview 导出失败，请查看控制台。");
    } finally {
      setExportingPayloadPreview(false);
    }
  };

  const handleExportExecutionPolicy = () => {
    setExportingExecutionPolicy(true);
    try {
      downloadJsonFile(
        `zhinote-ai-execution-policy-${fileSafeTimestamp()}.json`,
        {
          ...aiExecutionPolicy,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export AI execution policy:", err);
      window.alert("AI execution policy 导出失败，请查看控制台。");
    } finally {
      setExportingExecutionPolicy(false);
    }
  };

  const handleExportResearchRunbook = () => {
    setExportingResearchRunbook(true);
    try {
      downloadJsonFile(
        `zhinote-ai-research-runbook-${fileSafeTimestamp()}.json`,
        {
          ...aiResearchRunbook,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export AI research runbook:", err);
      window.alert("AI research runbook 导出失败，请查看控制台。");
    } finally {
      setExportingResearchRunbook(false);
    }
  };

  const handleExportOutputReview = () => {
    setExportingOutputReview(true);
    try {
      downloadJsonFile(
        `zhinote-ai-output-review-${fileSafeTimestamp()}.json`,
        {
          ...aiOutputReview,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export AI output review:", err);
      window.alert("AI output review 导出失败，请查看控制台。");
    } finally {
      setExportingOutputReview(false);
    }
  };

  const handleExportConfirmationReceipt = () => {
    setExportingConfirmationReceipt(true);
    try {
      downloadJsonFile(
        `zhinote-ai-confirmation-receipt-${fileSafeTimestamp()}.json`,
        {
          ...aiConfirmationReceipt,
          exported_at: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export AI confirmation receipt:", err);
      window.alert("AI confirmation receipt 导出失败，请查看控制台。");
    } finally {
      setExportingConfirmationReceipt(false);
    }
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                自动化模块
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                AI 工作台
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                在连接任何外部模型前，先在本地暂存 AI 投研任务、显式上下文、
                隐私边界和请求草稿。
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

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="页面" value={pages.length} />
          <Metric label="数据库" value={databases.length} />
          <Metric label="文件" value={storedFiles.length} />
          <Metric label="已选上下文" value={selectedPages.length} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              AI 工作流
            </h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {AI_WORKFLOWS.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => setWorkflowId(workflow.id)}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    workflow.id === workflowId
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="text-xs font-semibold">{workflow.title}</div>
                  <div
                    className={`mt-1 text-xs leading-5 ${
                      workflow.id === workflowId
                        ? "text-zinc-200 dark:text-zinc-700"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {workflow.detail}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              隐私门禁
            </h2>
            <div className="mt-3 space-y-3">
              {PRIVACY_GATES.map((gate) => (
                <p
                  key={gate}
                  className="text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                >
                  {gate}
                </p>
              ))}
            </div>
          </div>
        </section>

        <AiWorkflowReadinessPanel report={aiWorkflowReadiness} />

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              本地上下文
            </h2>
            <div className="mt-3 space-y-2">
              {recentPages.length > 0 ? (
                recentPages.map((page) => (
                  <ContextPageRow
                    key={page.id}
                    page={page}
                    selected={selectedPageIds.includes(page.id)}
                    onToggle={() => togglePage(page.id)}
                    onOpen={() => router.push(`/page/${page.id}`)}
                  />
                ))
              ) : (
                <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  还没有本地页面。
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              请求草稿
            </h2>
            <textarea
              value={researchQuestion}
              onChange={(event) => setResearchQuestion(event.target.value)}
              placeholder="研究问题、memo 目标或对比重点"
              className="mt-3 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600"
            />
            <div className="mt-3 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
              <pre className="whitespace-pre-wrap text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                {requestDraft}
              </pre>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-400 dark:border-zinc-800"
              >
                AI 执行已禁用
              </button>
              <span className="rounded-md bg-zinc-100 px-2 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {selectedWorkflow.output}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI payload 预览
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  本地 metadata-only 预览。页面正文、文件 bytes、prompt 正文和模型调用仍被排除。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPayloadPreview}
                disabled={exportingPayloadPreview}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingPayloadPreview ? "导出中..." : "导出预览"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <PayloadMetric
                label="页面"
                value={aiPayloadPreview.summary.selected_pages}
                detail="已选上下文"
                tone="high"
              />
              <PayloadMetric
                label="文件"
                value={aiPayloadPreview.summary.files_available}
                detail="可用但排除"
                tone={aiPayloadPreview.summary.files_available > 0 ? "high" : "low"}
              />
              <PayloadMetric
                label="Prompt"
                value={aiPayloadPreview.prompt.provided ? "已草拟" : "空"}
                detail={`${aiPayloadPreview.prompt.character_count} 字符`}
                tone={aiPayloadPreview.prompt.provided ? "medium" : "low"}
              />
              <PayloadMetric
                label="确认项"
                value={aiPayloadPreview.summary.approvals_required}
                detail="执行前必须确认"
                tone="medium"
              />
              <PayloadMetric
                label="边界"
                value="不发送"
                detail="仅本地预览"
                tone="low"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-2">
                {aiPayloadPreview.approvals_required.map((approval) => (
                  <PayloadApprovalRow key={approval} approval={approval} />
                ))}
              </div>
              <PayloadPreviewPanel preview={aiPayloadPreview} />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI 执行策略
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  未来启用 AI 前的本地策略。当前 run endpoint 已禁用，
                  不读取 request body，也不调用 provider。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportExecutionPolicy}
                disabled={exportingExecutionPolicy}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingExecutionPolicy ? "导出中..." : "导出策略"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <ExecutionMetric
                label="门禁"
                value={aiExecutionPolicy.summary.gates}
                detail="AI 执行前"
                status="planned"
              />
              <ExecutionMetric
                label="阻塞"
                value={aiExecutionPolicy.summary.blocked}
                detail="Provider 和审计缺口"
                status="blocked"
              />
              <ExecutionMetric
                label="确认"
                value={aiExecutionPolicy.summary.manual_confirmation}
                detail="用户确认门禁"
                status="manual-confirmation"
              />
              <ExecutionMetric
                label="Endpoint"
                value="/api/ai/run"
                detail="禁用本地 stub"
                status="blocked"
              />
              <ExecutionMetric
                label="边界"
                value="无模型"
                detail="不调用 provider"
                status="planned"
              />
            </div>
            <div className="mt-4 space-y-2">
              {aiExecutionPolicy.gates.map((gate) => (
                <ExecutionGateRow key={gate.id} gate={gate} />
              ))}
            </div>
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <label
                htmlFor="ai-confirmation-phrase"
                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100"
              >
                输入 AI 外发确认短语
              </label>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                <input
                  id="ai-confirmation-phrase"
                  value={aiConfirmationPhrase}
                  onChange={(event) =>
                    setAiConfirmationPhrase(event.target.value)
                  }
                  placeholder={aiConfirmationReceipt.required_phrase}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                />
                <button
                  type="button"
                  onClick={handleExportConfirmationReceipt}
                  disabled={exportingConfirmationReceipt}
                  className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {exportingConfirmationReceipt
                    ? "导出中..."
                    : "导出 AI receipt"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
                即使短语匹配，当前仍不会调用 AI；/api/ai/run disabled. 收据不包含页面正文、prompt 正文、文件内容、token 或 secret。
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <ExecutionMetric
                  label="短语匹配"
                  value={
                    aiConfirmationReceipt.typed_phrase_matches ? "是" : "否"
                  }
                  detail={aiConfirmationReceipt.status}
                  status={
                    aiConfirmationReceipt.typed_phrase_matches
                      ? "planned"
                      : "manual-confirmation"
                  }
                />
                <ExecutionMetric
                  label="Receipt"
                  value="仅本地"
                  detail="不调用模型"
                  status="planned"
                />
                <ExecutionMetric
                  label="目标"
                  value="/api/ai/run"
                  detail="禁用本地 stub"
                  status="blocked"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI 研究 Runbook
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  本地 AI 研究运行手册。它把任务范围、上下文确认、payload
                  预览、provider 政策、审计和输出保存串成审批队列。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportResearchRunbook}
                disabled={exportingResearchRunbook}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingResearchRunbook ? "导出中..." : "导出 Runbook"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <ExecutionMetric
                label="步骤"
                value={aiResearchRunbook.summary.steps}
                detail="端到端流程"
                status="planned"
              />
              <ExecutionMetric
                label="阻塞"
                value={aiResearchRunbook.summary.blocked_steps}
                detail="执行前必须解决"
                status="blocked"
              />
              <ExecutionMetric
                label="确认"
                value={aiResearchRunbook.summary.manual_confirmation_steps}
                detail="需要 owner 确认"
                status="manual-confirmation"
              />
              <ExecutionMetric
                label="审批队列"
                value={aiResearchRunbook.summary.approval_queue_items}
                detail="本地待确认"
                status="manual-confirmation"
              />
              <ExecutionMetric
                label="敏感边界"
                value="已排除"
                detail="持仓/交易/客户/token"
                status="planned"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  审批队列
                </div>
                {aiResearchRunbook.approval_queue.map((approval) => (
                  <RunbookApprovalRow key={approval.id} approval={approval} />
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  执行步骤
                </div>
                {aiResearchRunbook.steps.map((step) => (
                  <RunbookStepRow key={step.id} step={step} />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI 输出接收合同
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  定义未来 AI 输出进入页面、数据库或报告前的本地审批门槛。
                  当前不读取 AI 输出正文，不创建页面，不覆盖页面，不更新数据库。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportOutputReview}
                disabled={exportingOutputReview}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingOutputReview ? "导出中..." : "导出输出合同"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-6">
              <ExecutionMetric
                label="保存目标"
                value={aiOutputReview.summary.destinations}
                detail="候选输出去向"
                status="manual-confirmation"
              />
              <ExecutionMetric
                label="写入路径"
                value={aiOutputReview.summary.disabled_write_paths}
                detail="当前全部禁用"
                status="blocked"
              />
              <ExecutionMetric
                label="门禁"
                value={aiOutputReview.summary.acceptance_gates}
                detail="保存前检查"
                status="manual-confirmation"
              />
              <ExecutionMetric
                label="阻塞"
                value={aiOutputReview.summary.blocked_gates}
                detail="需先实现"
                status="blocked"
              />
              <ExecutionMetric
                label="正文"
                value="不读取"
                detail="不含 AI output"
                status="planned"
              />
              <ExecutionMetric
                label="覆盖"
                value="禁止"
                detail="不自动覆盖页面"
                status="blocked"
              />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  保存前门禁
                </div>
                {aiOutputReview.acceptance_gates.map((gate) => (
                  <OutputReviewGateRow key={gate.id} gate={gate} />
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  输出去向
                </div>
                {aiOutputReview.destinations.map((destination) => (
                  <OutputDestinationRow
                    key={destination.id}
                    destination={destination}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              文件准备度
            </h2>
            {fileSummary.kinds.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {fileSummary.kinds.map((item) => (
                  <span
                    key={item.kind}
                    className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {item.kind}: {item.count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                还没有本地存储的上传文件。
              </p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              连接边界
            </h2>
            <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              AI 执行启用前仍必须确认模型 provider、已选上下文、外发 payload
              预览、使用日志和 retention policy。
            </p>
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

function PayloadMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: AiPayloadRisk;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <PayloadRiskPill risk={tone} />
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function AiWorkflowReadinessPanel({
  report,
}: {
  report: AiWorkflowReadinessReport;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            AI workflow readiness
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            五类 AI 投研能力的本地安全目录。这里只读取 workflow metadata，
            不读取页面正文、prompt 正文、文件 bytes，也不会调用模型 provider。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          <ReadinessMetric label="工作流" value={report.summary.workflows} />
          <ReadinessMetric
            label="确认门槛"
            value={report.summary.confirmation_gates}
          />
          <ReadinessMetric
            label="默认排除"
            value={report.summary.default_exclusions}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-5">
        {report.items.map((item) => (
          <article
            key={item.id}
            className="flex min-h-[240px] flex-col justify-between rounded-md border border-zinc-100 p-3 text-xs dark:border-zinc-800"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-zinc-400">{item.output}</p>
                </div>
                <ReadinessStatusPill status={item.status} />
              </div>
              <p className="mt-3 leading-5 text-zinc-500 dark:text-zinc-400">
                {item.privacy_boundary}
              </p>
              <div className="mt-3">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  必需上下文
                </div>
                <ul className="mt-1 space-y-1 text-zinc-500 dark:text-zinc-400">
                  {item.required_context.map((context) => (
                    <li key={context}>- {context}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  确认门槛
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.confirmation_gates.slice(0, 4).map((gate) => (
                    <span
                      key={gate}
                      className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    >
                      {gate}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800">
              {item.next_action}
            </p>
          </article>
        ))}
      </div>
      <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        默认排除：{report.items[0]?.default_exclusions.join("；") ?? "无"}。
      </p>
    </section>
  );
}

function ReadinessMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <div>{label}</div>
      <div className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function ReadinessStatusPill({
  status,
}: {
  status: AiWorkflowReadinessReport["items"][number]["status"];
}) {
  const labels: Record<
    AiWorkflowReadinessReport["items"][number]["status"],
    string
  > = {
    "local-ready": "本地就绪",
    "manual-confirmation": "需确认",
    "blocked-external-run": "外发关闭",
  };
  const className =
    status === "local-ready"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span className={`shrink-0 rounded px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PayloadApprovalRow({ approval }: { approval: string }) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
      {approval}
    </article>
  );
}

function PayloadPreviewPanel({ preview }: { preview: AiPayloadPreview }) {
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          已选页面
        </div>
        {preview.selected_pages.length > 0 ? (
          <div className="mt-2 space-y-1">
            {preview.selected_pages.map((page) => (
              <div
                key={page.page_id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">
                  {page.title}
                </span>
                <PayloadRiskPill risk={page.risk} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
            未选择或包含任何页面正文。
          </p>
        )}
      </div>
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          可用文件
        </div>
        {preview.available_files.length > 0 ? (
          <div className="mt-2 space-y-1">
            {preview.available_files.map((file) => (
              <div
                key={file.kind}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-zinc-500 dark:text-zinc-400">
                  {file.kind}: {file.count}
                </span>
                <PayloadRiskPill risk={file.risk} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
            没有可用或已包含的文件 bytes。
          </p>
        )}
      </div>
    </div>
  );
}

function PayloadRiskPill({ risk }: { risk: AiPayloadRisk }) {
  const labels: Record<AiPayloadRisk, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };
  const className =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[risk]}
    </span>
  );
}

function ExecutionMetric({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: number | string;
  detail: string;
  status: AiExecutionGateStatus;
}) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{label}</div>
        <ExecutionStatusPill status={status} />
      </div>
      <div className="mt-2 break-all text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div>
    </div>
  );
}

function ExecutionGateRow({
  gate,
}: {
  gate: AiExecutionPolicy["gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {gate.evidence}
          </p>
        </div>
        <ExecutionStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
    </article>
  );
}

function RunbookApprovalRow({
  approval,
}: {
  approval: AiResearchRunbook["approval_queue"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {approval.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {approval.reason}
          </p>
        </div>
        <ExecutionStatusPill status={approval.status} />
      </div>
    </article>
  );
}

function RunbookStepRow({
  step,
}: {
  step: AiResearchRunbook["steps"][number];
}) {
  const phaseLabels: Record<
    AiResearchRunbook["steps"][number]["phase"],
    string
  > = {
    scope: "范围",
    context: "上下文",
    payload: "Payload",
    provider: "Provider",
    confirmation: "确认",
    audit: "审计",
    output: "输出",
  };
  const ownerLabels: Record<
    AiResearchRunbook["steps"][number]["owner"],
    string
  > = {
    researcher: "研究员",
    system: "系统",
    "future-provider": "未来 Provider",
  };

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
        <ExecutionStatusPill status={step.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          {phaseLabels[step.phase]}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          {ownerLabels[step.owner]}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          {step.blocks_ai_run ? "阻塞 AI 执行" : "可选"}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {step.required_decision}
      </p>
    </article>
  );
}

function OutputReviewGateRow({
  gate,
}: {
  gate: AiOutputReviewContract["acceptance_gates"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {gate.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {gate.evidence}
          </p>
        </div>
        <ExecutionStatusPill status={gate.status} />
      </div>
      <p className="mt-2 border-t border-zinc-100 pt-2 leading-5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {gate.required_action}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
        {gate.blocks_output_save ? "阻塞输出保存" : "不阻塞输出保存"}
      </p>
    </article>
  );
}

function OutputDestinationRow({
  destination,
}: {
  destination: AiOutputReviewContract["destinations"][number];
}) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {destination.title}
          </div>
          <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
            {destination.default_behavior}
          </p>
        </div>
        <ExecutionStatusPill status={destination.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          {destination.write_status}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          {destination.id}
        </span>
      </div>
      <p className="mt-2 leading-5 text-zinc-400 dark:text-zinc-500">
        {destination.required_confirmation}
      </p>
    </article>
  );
}

function ExecutionStatusPill({
  status,
}: {
  status: AiExecutionGateStatus;
}) {
  const labels: Record<AiExecutionGateStatus, string> = {
    planned: "规划",
    "manual-confirmation": "确认",
    blocked: "阻塞",
  };

  const className =
    status === "blocked"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : status === "manual-confirmation"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function ContextPageRow({
  page,
  selected,
  onToggle,
  onOpen,
}: {
  page: Page;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">
          {page.title || "Untitled"}
        </span>
      </label>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        打开
      </button>
    </div>
  );
}

function summarizeFiles(files: StoredPageFile[]) {
  const kindCounts = files.reduce<Record<string, number>>((counts, file) => {
    counts[file.kind] = (counts[file.kind] ?? 0) + 1;
    return counts;
  }, {});

  return {
    kinds: Object.entries(kindCounts)
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
  };
}

function buildRequestDraft({
  workflow,
  selectedPages,
  question,
}: {
  workflow: AiWorkflowSpec;
  selectedPages: Page[];
  question: string;
}) {
  const pageLines = selectedPages.length
    ? selectedPages
        .map((page) => `- ${page.title || "未命名页面"} (${page.id})`)
        .join("\n")
    : "- 未选择页面";
  const objective = question.trim() || "未指定";

  return [
    `工作流：${workflow.title}`,
    `预期输出：${workflow.output}`,
    `目标：${objective}`,
    "",
    "已选本地上下文：",
    pageLines,
    "",
    "建议 prompt 结构：",
    ...workflow.prompt_sections.map((section) => `- ${section}`),
    "",
    "隐私门禁：",
    "- 发送前预览最终 outbound payload",
    "- 确认模型 provider、账号边界和 retention policy",
    "- 文件和 HTML 报告默认排除，除非单独确认",
  ].join("\n");
}

function downloadJsonFile(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
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
