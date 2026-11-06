"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Pencil, X } from "lucide-react";
import { NVIDIA } from "@/lib/company-research/companies";
import InvestmentJudgment from "./InvestmentJudgment";
import TargetValuation from "./TargetValuation";
import { NVIDIA_SHARE_BASIS } from "./target-valuation";
import { readThesisDraft, thesisDraftKey } from "./research-draft";
import s from "./CompanyBoardPreview.module.css";

export default function NvidiaResearchBoard() {
  const [thesis, setThesis] = useState("");
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [editing, setEditing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true, stored = "", error = "";
    try { stored = readThesisDraft(localStorage.getItem(thesisDraftKey(NVIDIA.id)), NVIDIA.id); }
    catch { error = "本机草稿无法读取，请勿关闭未保存的内容。"; }
    queueMicrotask(() => { if (active) { setThesis(stored); setStorageError(error); setReady(true); } });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (editing) dialog.current?.showModal(); }, [editing]);

  function save() {
    try {
      localStorage.setItem(thesisDraftKey(NVIDIA.id), JSON.stringify({ version: 1, companyId: NVIDIA.id, thesis: draft }));
      setThesis(draft); setStorageError(""); setEditing(false);
    } catch { setStorageError("本机保存失败，编辑内容仍保留在窗口中。"); }
  }

  return <div className={s.app}>
    <main className={s.main}>
      <nav className={`${s.topbar} ${s.realTopbar}`} aria-label="公司研究导航">
        <div className={s.breadcrumb}><Image src="/brand/zhinote-app-icon-512.png" alt="ZhiNote" width={26} height={26} /><span>公司研究</span></div>
        <div className={s.realSourceLinks}>
          <Link className={s.secondaryButton} href="/knowledge-base" prefetch={false}><ArrowLeft size={14} />工作区</Link>
          <Link className={s.secondaryButton} href="/companies/template" prefetch={false}>虚构模板</Link>
        </div>
      </nav>
      <div className={`${s.content} ${s.realContent}`}>
        <header className={s.companyHeader}>
          <div className={s.companyIdentity}><div><div className={s.companyTitle}><h1>{NVIDIA.name}</h1><span className={s.ticker}>{NVIDIA.exchange}: {NVIDIA.ticker}</span></div><p>{NVIDIA.legalName}</p></div></div>
          <span className={s.demoBadge}>研究资料待接入</span>
        </header>
        <section className={s.section} aria-labelledby="nvda-judgment">
          <div className={s.sectionHeader}><h2 id="nvda-judgment">投资判断</h2><button type="button" className={s.iconButton} title="编辑 Investment Thesis" aria-label="编辑 Investment Thesis" disabled={!ready} onClick={() => { setDraft(thesis); setEditing(true); }}><Pencil size={15} /></button></div>
          <InvestmentJudgment companyId={NVIDIA.id} companyLabel={`${NVIDIA.name} · ${NVIDIA.exchange}: ${NVIDIA.ticker}`} thesis={thesis} />
          {storageError && !editing ? <p role="alert" className={s.researchWarning}>{storageError}</p> : null}
        </section>
        <section className={s.section} aria-labelledby="nvda-target">
          <div className={s.sectionHeader}><h2 id="nvda-target">目标估值</h2><span className={s.smallBadge}>我的假设</span></div>
          <TargetValuation companyId={NVIDIA.id} basis={NVIDIA_SHARE_BASIS} defaultUnit="trillion" />
        </section>
        <section className={s.section} aria-labelledby="nvda-sources">
          <div className={s.sectionHeader}><h2 id="nvda-sources">研究资料</h2><span className={s.smallBadge}>公开资料 + 指定笔记</span></div>
          <div className={s.realSourceRows}>
            <div><h3>公开资料</h3><div className={s.realSourceLinks}>{NVIDIA.publicSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={13} /></a>)}</div></div>
            <div><h3>Notion</h3><span>待指定页面链接</span></div>
            <div><h3>ZhiNote</h3><span>待指定页面链接</span></div>
          </div>
        </section>
        <section className={s.section} aria-labelledby="nvda-data">
          <div className={s.sectionHeader}><h2 id="nvda-data">公司数据</h2><span className={s.smallBadge}>未导入</span></div>
          <dl className={s.realDataRows}>
            <div><dt>基本面关键数据</dt><dd>待核实财报</dd></div>
            <div><dt>股价与交易</dt><dd>待接入行情</dd></div>
            <div><dt>业绩复盘与预测</dt><dd>尚无资料</dd></div>
            <div><dt>股价隐含预期</dt><dd>尚无模型</dd></div>
            <div><dt>业务拆分 / 增长点</dt><dd>尚无资料</dd></div>
            <div><dt>产业链归属</dt><dd>尚未添加</dd></div>
          </dl>
        </section>
      </div>
    </main>
    {editing ? <dialog ref={dialog} className={s.dialog} aria-label="编辑 Investment Thesis" onCancel={() => setEditing(false)}>
      <div className={s.dialogHead}><h2>Investment Thesis</h2><button type="button" className={s.iconButton} aria-label="关闭编辑窗口" onClick={() => setEditing(false)}><X size={18} /></button></div>
      <form className={s.form} onSubmit={event => { event.preventDefault(); save(); }}>
        <label>Investment Thesis<textarea autoFocus rows={10} maxLength={16000} value={draft} onChange={event => setDraft(event.target.value)} /></label>
        <span className={s.source}>本机草稿 · 未同步到账号</span>
        {storageError ? <p role="alert" className={s.researchWarning}>{storageError}</p> : null}
        <div className={s.formActions}><button type="button" className={s.secondaryButton} onClick={() => setEditing(false)}>取消</button><button type="submit" className={s.primaryButton}><Check size={14} />保存判断</button></div>
      </form>
    </dialog> : null}
  </div>;
}
