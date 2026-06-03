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
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database, Page } from "@/lib/utils/types";

type AiWorkflowId = "summary" | "qa" | "report" | "compare" | "framework";

const AI_WORKFLOWS: Array<{
  id: AiWorkflowId;
  title: string;
  detail: string;
  output: string;
}> = [
  {
    id: "summary",
    title: "Research summary",
    detail: "Condense selected notes, reports, and meeting context.",
    output: "Summary brief",
  },
  {
    id: "qa",
    title: "Research Q&A",
    detail: "Answer a focused question against explicit local context.",
    output: "Answer with cited local inputs",
  },
  {
    id: "report",
    title: "Report draft",
    detail: "Stage a memo or report generation request from selected material.",
    output: "Draft structure",
  },
  {
    id: "compare",
    title: "Compare documents",
    detail: "Prepare side-by-side comparison for reports, notes, or files.",
    output: "Diff and deltas",
  },
  {
    id: "framework",
    title: "Research framework",
    detail: "Turn a topic into a reusable investment research checklist.",
    output: "Framework template",
  },
];

const PRIVACY_GATES = [
  "AI calls are disabled in this local module.",
  "Only explicitly selected pages should become AI context.",
  "Uploaded files and HTML reports require separate confirmation before use.",
  "External providers, model choice, and retention rules must be confirmed before any outbound request.",
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
        if (mounted) setLoadError("Could not load all local AI surfaces.");
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
  const selectedWorkflow = AI_WORKFLOWS.find((workflow) => workflow.id === workflowId)
    ?? AI_WORKFLOWS[0];
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
      window.alert("AI payload preview export failed. Please check the console.");
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
      window.alert("AI execution policy export failed. Please check the console.");
    } finally {
      setExportingExecutionPolicy(false);
    }
  };

  return (
    <div className="w-full px-6 py-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Automation module
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                AI Workbench
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Stage AI research workflows locally with explicit context,
                privacy gates, and request drafts before any external model is
                connected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/modules")}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              All modules
            </button>
          </div>
        </header>

        {loadError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {loadError}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Pages" value={pages.length} />
          <Metric label="Databases" value={databases.length} />
          <Metric label="Files" value={storedFiles.length} />
          <Metric label="Selected context" value={selectedPages.length} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Workflow
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
              Privacy gates
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

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Local context
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
                  No local pages yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Request draft
            </h2>
            <textarea
              value={researchQuestion}
              onChange={(event) => setResearchQuestion(event.target.value)}
              placeholder="Research question, memo objective, or comparison focus"
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
                Run AI disabled
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
                  AI payload preview
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Local metadata-only preview. Page body text, file bytes,
                  prompt text, and model calls remain excluded.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPayloadPreview}
                disabled={exportingPayloadPreview}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingPayloadPreview ? "Exporting..." : "Export preview"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <PayloadMetric
                label="Pages"
                value={aiPayloadPreview.summary.selected_pages}
                detail="Selected context"
                tone="high"
              />
              <PayloadMetric
                label="Files"
                value={aiPayloadPreview.summary.files_available}
                detail="Available, excluded"
                tone={aiPayloadPreview.summary.files_available > 0 ? "high" : "low"}
              />
              <PayloadMetric
                label="Prompt"
                value={aiPayloadPreview.prompt.provided ? "Drafted" : "Empty"}
                detail={`${aiPayloadPreview.prompt.character_count} chars`}
                tone={aiPayloadPreview.prompt.provided ? "medium" : "low"}
              />
              <PayloadMetric
                label="Approvals"
                value={aiPayloadPreview.summary.approvals_required}
                detail="Before AI execution"
                tone="medium"
              />
              <PayloadMetric
                label="Boundary"
                value="No send"
                detail="Local preview only"
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
                  AI execution policy
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Local policy for enabling AI later. The run endpoint is
                  disabled and does not read request bodies or call providers.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportExecutionPolicy}
                disabled={exportingExecutionPolicy}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {exportingExecutionPolicy ? "Exporting..." : "Export policy"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <ExecutionMetric
                label="Gates"
                value={aiExecutionPolicy.summary.gates}
                detail="Before AI can run"
                status="planned"
              />
              <ExecutionMetric
                label="Blocked"
                value={aiExecutionPolicy.summary.blocked}
                detail="Provider and audit gaps"
                status="blocked"
              />
              <ExecutionMetric
                label="Confirm"
                value={aiExecutionPolicy.summary.manual_confirmation}
                detail="User approval gates"
                status="manual-confirmation"
              />
              <ExecutionMetric
                label="Endpoint"
                value="/api/ai/run"
                detail="Disabled local stub"
                status="blocked"
              />
              <ExecutionMetric
                label="Boundary"
                value="No model"
                detail="No provider call"
                status="planned"
              />
            </div>
            <div className="mt-4 space-y-2">
              {aiExecutionPolicy.gates.map((gate) => (
                <ExecutionGateRow key={gate.id} gate={gate} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              File readiness
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
                No uploaded files are stored locally yet.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Connection boundary
            </h2>
            <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Model provider, selected context, outbound payload preview, usage
              logging, and retention policy remain required before AI execution
              can be enabled.
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
          Selected pages
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
            No page body text is selected or included.
          </p>
        )}
      </div>
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          Available files
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
            No file bytes are available or included.
          </p>
        )}
      </div>
    </div>
  );
}

function PayloadRiskPill({ risk }: { risk: AiPayloadRisk }) {
  const className =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : risk === "medium"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {risk}
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

function ExecutionStatusPill({
  status,
}: {
  status: AiExecutionGateStatus;
}) {
  const labels: Record<AiExecutionGateStatus, string> = {
    planned: "Planned",
    "manual-confirmation": "Confirm",
    blocked: "Blocked",
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
        Open
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
  workflow: (typeof AI_WORKFLOWS)[number];
  selectedPages: Page[];
  question: string;
}) {
  const pageLines = selectedPages.length
    ? selectedPages
        .map((page) => `- ${page.title || "Untitled"} (${page.id})`)
        .join("\n")
    : "- No pages selected";
  const objective = question.trim() || "Not specified";

  return [
    `Workflow: ${workflow.title}`,
    `Expected output: ${workflow.output}`,
    `Objective: ${objective}`,
    "",
    "Selected local context:",
    pageLines,
    "",
    "Privacy gates:",
    "- Preview outbound payload before sending",
    "- Confirm model provider and retention policy",
    "- Keep files and HTML reports excluded unless separately approved",
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
