"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, RefreshCw, X } from "lucide-react";
import type { ResearchPreview, ResearchResult, ResearchSnapshot } from "@/lib/company-research/types";
import s from "./CompanyBoardPreview.module.css";

const API = "/api/company-research";
const DEMO: ResearchResult = {
  companyId: "DEMO", generatedAt: "2026-10-30T00:00:00Z", warnings: [],
  bull: [
    { text: "高速互联占比提升，产品结构有望带动利润率。", category: "alpha", basis: "inference", sourceIds: ["n1"] },
    { text: "客户验证转量产，是订单兑现的关键观察点。", category: "alpha", basis: "hypothesis", sourceIds: ["n2"] },
    { text: "若新平台放量延续，收入增长可能快于传统连接业务。", category: "industry", basis: "hypothesis", sourceIds: ["n2"] },
  ],
  bear: [
    { text: "应收与营运资金占用上升，利润未必转化为现金。", category: "alpha", basis: "inference", sourceIds: ["n1"] },
    { text: "扩产折旧与新线良率，可能抵消产品升级收益。", category: "alpha", basis: "inference", sourceIds: ["n3"] },
    { text: "客户导入延迟或集中度上升，会放大订单波动。", category: "industry", basis: "hypothesis", sourceIds: ["n2"] },
  ],
  sources: [
    { id: "n1", kind: "zhinote", title: "Q3 业绩复盘（虚构资料）", url: "", date: "2026-10-30", dateKind: "modified" },
    { id: "n2", kind: "zhinote", title: "高速互联观察点（虚构资料）", url: "", date: "2026-10-27", dateKind: "modified" },
    { id: "n3", kind: "zhinote", title: "产能与资本开支（虚构资料）", url: "", date: "2026-10-21", dateKind: "modified" },
  ],
};

class ResearchRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(companyId: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(body ? API : `${API}?companyId=${encodeURIComponent(companyId)}`, {
    method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
    signal: signal ?? AbortSignal.timeout(45000),
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new ResearchRequestError(value.error ?? "研究服务暂时不可用，原有观点已保留。", response.status);
  return value as T;
}

type Props = {
  thesis: string; companyId?: string; companyLabel?: string; openNote?: (id: string) => void;
};
export default function InvestmentJudgment(props: Props) {
  return <InvestmentJudgmentContent key={props.companyId ?? "DEMO"} {...props} />;
}
function InvestmentJudgmentContent({ thesis, companyId = "DEMO", companyLabel, openNote }: Props) {
  const demo = companyId === "DEMO";
  const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
  const [preview, setPreview] = useState<ResearchPreview | null>(null);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const activeJob = snapshot?.job?.status === "running" ? snapshot.job.id : null;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (dialog) ref.current?.showModal(); }, [dialog]);
  useEffect(() => {
    if (!activeJob || demo) return;
    let cancelled = false, attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") { timer = setTimeout(poll, 15000); return; }
      try {
        const next = await request<ResearchSnapshot>(companyId, undefined, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (cancelled) return;
        setSnapshot(next);
        if (next.job?.status !== "running") return;
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ResearchRequestError && [401, 403].includes(error.status)) { setSnapshot(null); setPreview(null); setError("账号会话已失效，请重新登录。"); return; }
        setError("暂时无法读取进度，原有观点已保留；可稍后重新检查。");
      }
      if (!cancelled && ++attempts < 8) timer = setTimeout(poll, Math.min(30000, 5000 * (attempts + 1)));
    };
    timer = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [activeJob, companyId, demo]);

  async function act(action: "prepare" | "start" | "check") {
    if (demo || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (action === "prepare") {
        setPreview(null); setConsent(false);
        const next = await request<ResearchPreview>(companyId, { action, allowRead: true });
        if (mounted.current) { setPreview(next); setConsent(false); }
      } else {
        if (action === "start" && (!preview || !consent)) return;
        const next = await request<ResearchSnapshot>(companyId, action === "check" ? undefined : {
          action, draftId: preview?.id, digest: preview?.digest, confirmed: true,
        });
        if (mounted.current) { setSnapshot(next); if (action === "start") { setDialog(false); setPreview(null); } }
      }
    } catch (e) {
      if (mounted.current) {
        if (e instanceof ResearchRequestError && [401, 403].includes(e.status)) { setSnapshot(null); setPreview(null); }
        if (e instanceof ResearchRequestError && e.status === 409) { setPreview(null); setConsent(false); }
        setError(e instanceof Error ? e.message : "更新失败，原有观点已保留。");
      }
    }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  const result = demo ? DEMO : snapshot?.result;
  const running = Boolean(activeJob);
  const close = () => { setDialog(false); setConsent(false); };
  return <>
    <div className={s.researchToolbar}>
      <span className={s.source}>{demo ? "示例观点 · 非实时研究" : running ? "后台更新中 · 保留上一版" : result ? `更新于 ${new Date(result.generatedAt).toLocaleString()}` : "尚无研究结果"}</span>
      <button type="button" className={s.secondaryButton} onClick={() => { setDialog(true); setConsent(false); if (!demo) void act("check"); }}><RefreshCw size={14} />{running ? "更新进度" : "更新"}</button>
    </div>
    <div className={s.thesisGrid}>
      <div className={s.thesisColumn}><span className={`${s.eyebrow} ${s.blue}`}>Investment Thesis</span><p>{thesis || "尚未填写"}</p><span className={s.source}>{demo ? "手动 · 本机样板" : "手动 · 本机草稿 · 未同步到账号"}</span></div>
      {(["bull", "bear"] as const).map(side => <div className={s.thesisColumn} key={side}>
        <span className={`${s.eyebrow} ${side === "bull" ? s.green : s.amber}`}>{side === "bull" ? "看多观点" : "看空观点"}</span>
        {result ? <ul className={s.researchPoints}>{result[side].map((point, index) => <li key={index}>
          <span>{point.text}</span><div className={s.researchPointMeta}>
            <span>{({ alpha: "Alpha", industry: "行业趋势", macro: "宏观" })[point.category]} · {({ fact: "事实", inference: "推断", hypothesis: "假设" })[point.basis]}</span>
            {point.sourceIds.map(id => { const source = result.sources.find(item => item.id === id); return source ? demo
              ? <button type="button" key={id} title={source.title} onClick={() => openNote?.(id)}>资料 {id.slice(1)}</button>
              : <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>来源 <ArrowUpRight size={11} /></a> : null; })}
          </div>
        </li>)}</ul> : <p className={s.muted}>待更新</p>}
      </div>)}
    </div>
    {result ? <details className={s.researchSources}><summary>来源与日期 · {result.sources.length}</summary>{result.sources.map(source => <div key={source.id}>{source.title} · {source.dateKind === "modified" ? "资料修改 " : source.dateKind === "published" ? "发布 " : ""}{source.date ?? "发布日期未核实"}</div>)}</details> : null}
    {result?.warnings.map(warning => <p key={warning} className={s.researchWarning}>{warning}</p>)}
    {snapshot?.job?.status === "failed" ? <p role="status" className={s.researchWarning}>{snapshot.job.error}</p> : null}
    {snapshot?.job?.estimatedUsd !== undefined ? <div className={s.source}>最近任务估算 ${snapshot.job.estimatedUsd.toFixed(4)} · {snapshot.job.searches} 次搜索</div> : null}
    {error && !dialog ? <p role="status" className={s.researchWarning}>{error}</p> : null}
    {dialog ? <dialog ref={ref} className={`${s.dialog} ${s.researchDialog}`} aria-label="更新研究观点" onCancel={close}>
      <div className={s.dialogHead}><h2>更新研究观点</h2><button className={s.iconButton} aria-label="关闭更新窗口" onClick={close}><X size={18} /></button></div>
      <div className={s.form}>
        {demo ? <><p>澄芯科技是虚构公司，不能进行真实公开资料检索。</p><ul className={s.researchChecklist}><li>真实上市公司：未绑定</li><li>Notion / ZhiNote 研究资料：未授权</li><li>付费 AI 更新：未启用</li></ul><p className={s.source}>本次未读取私人笔记，未调用 AI，也未产生费用。</p><button type="button" className={s.primaryButton} disabled>确认更新</button></> : <>
          {snapshot ? <><p>{snapshot.scope.name} · {snapshot.scope.exchange} / {snapshot.scope.ticker}</p><p>仅更新看多、看空观点。Investment Thesis 不会发送或改写。</p><p className={s.source}>指定 ZhiNote {snapshot.scope.zhinotePages} 页、Notion {snapshot.scope.notionPages} 页；公开检索最多 3 次。不读取附件或整个知识库。</p><p className={s.source}>Anthropic / {snapshot.scope.model} · 月度额度 ${snapshot.scope.monthlyBudgetUsd}，每次先预留 ${snapshot.scope.reservationUsd}，按用量估算结算。</p>{snapshot.scope.blockers.map(item => <p key={item} className={s.researchWarning}>{item}</p>)}</> : <><p>{companyLabel ?? companyId}</p><p>研究服务尚未确认连接。</p><p className={s.source}>账号登录、指定笔记范围及 AI 服务需确认后才可更新。未读取私人笔记，未发起付费研究。</p></>}
          {running ? <p role="status">任务正在后台执行，可关闭窗口。服务器中断时不会自动重试扣费。</p> : null}
          {preview && !running ? <><details open><summary>将发送给 AI 的私人资料与检索指令</summary><pre className={s.researchPayload}>{preview.outbound}</pre></details>{preview.warnings.map(item => <p key={item} className={s.researchWarning}>{item}</p>)}<p className={s.source}>预览暂存 10 分钟；观点及用量记录保留 90 天；不记录正文日志。AI 服务的数据保留遵循其商业 API 条款。</p><a href="https://privacy.claude.com/en/articles/7996868-how-long-do-you-store-my-data" target="_blank" rel="noopener noreferrer">Anthropic 数据处理说明</a><label className={s.researchConsent}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />我确认发送以上资料并使用付费 AI；随后仅追加公开检索结果。</label></> : null}
          <div className={s.formActions}><button type="button" className={s.secondaryButton} disabled={busy} onClick={() => void act("check")}><RefreshCw size={14} />检查状态</button>{preview && !running ? <button type="button" className={s.secondaryButton} disabled={busy} onClick={() => void act("prepare")}><RefreshCw size={14} />重读资料</button> : null}{!running && snapshot && snapshot.scope.blockers.length === 0 ? preview ? <button className={s.primaryButton} disabled={busy || !consent} onClick={() => void act("start")}><Check size={14} />确认更新</button> : <button className={s.primaryButton} disabled={busy} onClick={() => void act("prepare")}>读取指定资料并预览</button> : null}</div>
        </>}
        {busy ? <p role="status">处理中…</p> : null}{error ? <p role="alert" className={s.researchWarning}>{error}</p> : null}
      </div>
    </dialog> : null}
  </>;
}
