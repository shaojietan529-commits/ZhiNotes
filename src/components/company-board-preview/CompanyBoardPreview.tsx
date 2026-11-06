"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, BarChart3, BookOpen, Check, ChevronRight, Columns2, EyeOff, FileText, GripVertical, LayoutDashboard, Link2, Maximize2, Menu, Network, Pencil, Plus, RotateCcw, Search, Settings2, Star, Target, Trash2, X } from "lucide-react";
import MarketChart from "./MarketChart";
import Fundamentals from "./Fundamentals";
import InvestmentJudgment from "./InvestmentJudgment";
import TargetValuation from "./TargetValuation";
import { DEMO_SHARE_BASIS } from "./target-valuation";
import { createDemo, defaultSections, moveSection, readDemo, PRICE, STORAGE_KEY, valuation, type DemoState, type Note, type Section, type SectionKind } from "./model";
import { CURRENCIES, REPORT_CURRENCY, QUOTE_CURRENCY, FX_SOURCE, displayCurrency, convertMoney, formatMoney, type Currency, type CurrencyChoice, type FxRates, type FxQuote } from "./currency";
import { useExchangeRates } from "./useExchangeRates";
import s from "./CompanyBoardPreview.module.css";

type View = "board" | "notes" | "chains";
type Modal = "section" | "thesis" | "link" | "reset" | null;
const CATEGORIES = ["研究笔记", "会议纪要", "业绩复盘", "估值假设"];
const GROWTH = [
  { name: "高速互联新平台", metric: "2027E 收入占比 65%", note: "客户验证 → 小批量 → 规模量产", date: "2027 H1", color: "green" },
  { name: "车载连接产品升级", metric: "单车价值量提升", note: "平台定点与实际交付节奏", date: "2027 H2", color: "blue" },
  { name: "产品组合改善", metric: "2026E 毛利率 43.5%", note: "高端产品占比与新产线良率", date: "每季度", color: "amber" },
];
const CUSTOM_CHAIN_OPTIONS = [{ chain: "AI 算力", role: "高速互联" }, { chain: "智能汽车", role: "车载连接" }, { chain: "工业自动化", role: "工业连接" }, { chain: "数据中心", role: "连接基础设施" }];
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

function IconButton({ label, children, onClick, disabled = false }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className={s.iconButton} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

function ModalFrame({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={s.dialog} aria-label={title} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className={s.dialogHead}><h2>{title}</h2><IconButton label="关闭对话框" onClick={close}><X size={18} /></IconButton></div>
    {children}
  </dialog>;
}

export default function CompanyBoardPreview() {
  const [data, setData] = useState<DemoState>(createDemo);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState<View>("board");
  const [layout, setLayout] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [range, setRange] = useState<"1M" | "3M" | "6M">("6M");
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [note, setNote] = useState<Note | null>(null);
  const [thesis, setThesis] = useState("");
  const [sectionKind, setSectionKind] = useState<SectionKind>("custom");
  const [sectionTitle, setSectionTitle] = useState("");
  const [rename, setRename] = useState<Section | null>(null);
  const [selectedChain, setSelectedChain] = useState("ai");
  const [selectedNode, setSelectedNode] = useState("company");
  const [chainChoice, setChainChoice] = useState("AI 算力");
  const [chainRole, setChainRole] = useState("高速互联");
  const [toast, setToast] = useState("");
  const [editingFx, setEditingFx] = useState<{ quote: FxQuote | null; currency: CurrencyChoice } | null>(null);
  const needsFx = data.currency !== "original" && data.currency !== REPORT_CURRENCY;
  const fx = useExchangeRates(ready && needsFx);
  const dragId = useRef<string | null>(null);
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    let stored = createDemo(), failed = false;
    try { stored = readDemo(localStorage.getItem(STORAGE_KEY)); } catch { failed = true; }
    queueMicrotask(() => { if (active) { setData(stored); setSaveError(failed); setReady(true); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  function save(next: DemoState) {
    setData(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaveError(false); }
    catch { setSaveError(true); }
  }
  function updateSection(id: string, patch: Partial<Section>) {
    save({ ...data, sections: data.sections.map(section => section.id === id ? { ...section, ...patch } : section) });
  }
  function openView(next: View) { setView(next); setSidebar(false); main.current?.scrollTo({ top: 0 }); }
  function jump(id: string) {
    setView("board"); setSidebar(false);
    requestAnimationFrame(() => document.getElementById(`demo-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function openNote(item?: Note) {
    setNote(item ? { ...item } : { id: crypto.randomUUID(), title: "", category: "研究笔记", date: new Date().toISOString().slice(0, 10), body: "" });
  }
  function openChain(id: string) { setSelectedChain(id); setSelectedNode("company"); openView("chains"); }
  const visible = data.sections.filter(section => !section.hidden);
  const filteredNotes = data.notes.filter(n => (category === "全部" || n.category === category) && `${n.title} ${n.body}`.toLowerCase().includes(search.toLowerCase()));
  const model = valuation(data.pe, data.eps);
  // Freeze the displayed conversion while an amount is being edited.
  const appliedFx = editingFx ? editingFx.quote : fx.quote;
  const choice = editingFx?.currency ?? data.currency;
  const currency = appliedFx ? displayCurrency(choice) : REPORT_CURRENCY;
  const quoteCurrency = appliedFx ? displayCurrency(choice, QUOTE_CURRENCY) : QUOTE_CURRENCY;
  const rates = appliedFx?.rates;
  const money = (value: number) => formatMoney(value, currency, REPORT_CURRENCY, 2, rates);
  const quote = (value: number) => formatMoney(value, quoteCurrency, QUOTE_CURRENCY, 2, rates);

  function renderNotes(compact = false) {
    const items = compact ? data.notes.slice(0, 3) : filteredNotes;
    return <div className={s.noteList}>
      {items.map(n => <button key={n.id} type="button" className={s.noteRow} onClick={() => openNote(n)}>
        <span className={s.documentIcon}><FileText size={17} /></span>
        <span className={s.noteInfo}><strong>{n.title}</strong><span>{n.category}<i />{n.date}</span></span><ChevronRight size={15} />
      </button>)}
      {items.length === 0 ? <div className={s.empty}><Search size={24} /><p>没有匹配的笔记</p><button className={s.textButton} onClick={() => { setSearch(""); setCategory("全部"); }}>清除筛选</button></div> : null}
      {compact ? <button className={s.textButton} onClick={() => openView("notes")}>全部 {data.notes.length} 篇笔记 <ArrowRight size={14} /></button> : null}
    </div>;
  }

  function content(section: Section) {
    switch (section.kind) {
      case "thesis": return <InvestmentJudgment thesis={data.investmentThesis} openNote={id => { const item = data.notes.find(n => n.id === id); if (item) openNote(item); }} />;
      case "target": return <TargetValuation companyId="DEMO-CHENGXIN" basis={DEMO_SHARE_BASIS} presentation={{ currency: quoteCurrency, rates, onEditing: editing => setEditingFx(editing ? { quote: appliedFx, currency: choice } : null) }} />;
      case "market": return <>
        <div className={s.marketTop}><div><strong data-testid="market-price">{quote(PRICE)}</strong><span className={s.green}>+{quote(1.28)} (+1.50%)</span></div><div className={s.segmented} aria-label="股价时间范围">{(["1M", "3M", "6M"] as const).map(r => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}</div></div>
        <MarketChart range={range} currency={quoteCurrency} rates={rates} />
        <div className={s.inlineStats}><span>市值 <b>{quote(276.5)} 亿 {quoteCurrency}</b></span><span>2025A P/E <b>36.0×</b></span><span>52 周 <b>{quote(50.1)} – {quote(94.6)} {quoteCurrency}</b></span></div>
        <div className={s.source}>示例行情 · 2026-10-30 收盘 · 原始报价 {QUOTE_CURRENCY} · 非真实股价{quoteCurrency !== QUOTE_CURRENCY ? ` · 按所示汇率展示 ${quoteCurrency}` : ""}</div>
      </>;
      case "fundamentals": return <Fundamentals view={data.fundamentalsView} ready={ready} currency={currency} rates={rates} onChange={fundamentalsView => save({ ...data, fundamentalsView })} />;
      case "earnings": return <>
        <div className={s.sectionSubrow}><span><span className={s.dot} /> 2026 Q3：收入较上次示例预测高 {money(.4)} 亿 {currency}</span><div className={s.segmented}><button aria-pressed={period === "annual"} onClick={() => setPeriod("annual")}>年度</button><button aria-pressed={period === "quarterly"} onClick={() => setPeriod("quarterly")}>季度</button></div></div>
        <div className={s.tableScroll}><table className={s.table}><thead><tr><th>指标 / {currency}</th>{(period === "annual" ? ["2024A", "2025A", "2026E · 我的预测", "2026E · 示例一致预期", "2027E · 我的预测"] : ["2026 Q1A", "2026 Q2A", "2026 Q3A", "2026 Q4E"]).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
          {(period === "annual" ? [[`收入 / 亿 ${currency}`, ...[21.8, 28.6, 38.8, 36.1, 50.5].map(money)], ["毛利率", "37.5%", "41.8%", "43.5%", "42.2%", "45.0%"], [`EPS / ${currency}`, ...[1.85, 2.4, 3.2, 2.95, data.eps].map(money)]] : [[`收入 / 亿 ${currency}`, ...[7.8, 8.7, 9.4, 12.9].map(money)], ["毛利率", "42.0%", "43.0%", "43.5%", "44.7%"], [`EPS / ${currency}`, ...[.61, .72, .79, 1.08].map(money)]]).map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i} className={i === (period === "annual" ? 3 : 4) ? s.forecastCell : ""}>{cell}</td>)}</tr>)}
        </tbody></table></div>
        <div className={s.source}>示例版本 · 2026-10-30 · A = 实际值样例，E = 预测样例 · 非真实市场一致预期</div>
      </>;
      case "business": return <>
        <div className={s.businessTotal}><span>2025A 收入构成 · 亿 {currency}</span><b data-testid="business-total">{money(28.6)}</b></div>
        <div className={s.stackedBar} role="img" aria-label="高速互联 58%，工业连接 27%，车载连接 15%"><span style={{ width: "58%", background: "#65d6ac" }} /><span style={{ width: "27%", background: "#78a7e8" }} /><span style={{ width: "15%", background: "#dcb66a" }} /></div>
        {[["高速互联", "16.59", "58%", "#65d6ac", "ai"], ["工业连接", "7.72", "27%", "#78a7e8", "industrial"], ["车载连接", "4.29", "15%", "#dcb66a", "auto"]].map(([name, revenue, pct, color, id]) => <div className={s.businessRow} key={name}><span><i style={{ background: color }} />{name}</span><b>{money(Number(revenue))}</b><span>{pct}</span><button title={`查看${name}产业链`} aria-label={`查看${name}产业链`} className={s.iconButton} onClick={() => { const link = data.links.find(l => l.id === id); if (link) openChain(link.id); else { setChainChoice("工业自动化"); setChainRole("工业连接"); setModal("link"); } }}><ArrowUpRight size={15} /></button></div>)}
        <div className={s.source}>示例分部数据 · 2025 财年 · 原始报表 {REPORT_CURRENCY}</div>
      </>;
      case "expectations": return <>
        <div className={s.modelHead}><span>当前价格隐含的 EPS 年复合增长</span><strong data-testid="implied-growth">{model.impliedGrowth.toFixed(1)}<small>%</small></strong><span>2025A → 2027E</span></div>
        <div className={s.modelControls}><label>2027E P/E <b>{data.pe}×</b><input aria-label="2027E 估值倍数" type="range" min="16" max="40" step="1" value={data.pe} onChange={e => save({ ...data, pe: Number(e.target.value) })} /></label><label>我的 2027E EPS · {currency}<EpsInput key={currency} value={data.eps} currency={currency} rates={rates} onEditing={editing => setEditingFx(editing ? { quote: appliedFx, currency: choice } : null)} onChange={eps => save({ ...data, eps })} /></label></div>
        <div className={s.modelResults}><span>价格隐含 EPS <b>{money(model.impliedEps)} {currency}</b></span><span>我的情景价格 <b data-testid="scenario-price">{money(model.target)} {currency}</b></span><span>较当前价 <b className={model.upside >= 0 ? s.green : s.amber}>{signed(model.upside)}</b></span></div>
        <div className={s.source}>示例模型 · 2025A EPS {money(2.4)} {currency} · 股本不变 · 情景价格未折现</div>
      </>;
      case "growth": return <div className={s.growthList}>{GROWTH.map((g, i) => <div key={g.name} className={s.growthRow}><span className={`${s.growthMark} ${s[g.color]}`}>{String(i + 1).padStart(2, "0")}</span><div><strong>{g.name}</strong><p>{g.metric}</p><small>{g.note}</small><span className={s.growthDate}>{g.date}</span></div><select aria-label={`${g.name}状态`} value={data.growth[i]} onChange={e => save({ ...data, growth: data.growth.map((v, index) => index === i ? e.target.value : v) })}>{["跟踪中", "待验证", "已兑现"].map(v => <option key={v}>{v}</option>)}</select></div>)}</div>;
      case "notes": return renderNotes(true);
      case "relations": return <div className={s.memberships}>{data.links.map(l => <button key={l.id} className={s.membership} onClick={() => openChain(l.id)}><span className={s.chainIcon}><Network size={19} /></span><span><strong>{l.chain}</strong><small>{l.role}</small></span><ArrowUpRight size={17} /></button>)}<button className={s.addMembership} onClick={() => setModal("link")}><Plus size={17} />添加产业链归属</button></div>;
      case "custom": return <textarea className={s.customText} aria-label={section.title} placeholder="记录你的研究判断…" maxLength={20000} value={section.text ?? ""} onChange={e => updateSection(section.id, { text: e.target.value })} />;
    }
  }

  return <div className={s.app} lang="zh-CN">
    {sidebar ? <button className={s.sidebarBackdrop} aria-label="关闭导航" onClick={() => setSidebar(false)} /> : null}
    <aside className={`${s.sidebar} ${sidebar ? s.sidebarOpen : ""}`}>
      <div className={s.logo}><Image src="/brand/zhinote-app-icon-512.png" width={30} height={30} alt="ZhiNote" /><b>ZhiNote<span>.</span></b><span className={s.workspaceTag}>RESEARCH</span></div>
      <div className={s.sidebarGroupLabel}>研究空间</div>
      <nav className={s.nav} aria-label="样板导航">
        <Link className={s.secondaryButton} href="/knowledge-base" prefetch={false}><ArrowRight size={17} />返回工作区</Link>
        <button aria-current={view === "board" ? "page" : undefined} onClick={() => openView("board")}><LayoutDashboard size={17} />公司看板<span>01</span></button>
        <button aria-current={view === "chains" ? "page" : undefined} onClick={() => openView("chains")}><Network size={17} />产业链<span>{String(data.links.length).padStart(2, "0")}</span></button>
        <button aria-current={view === "notes" ? "page" : undefined} onClick={() => openView("notes")}><BookOpen size={17} />研究笔记<span>{String(data.notes.length).padStart(2, "0")}</span></button>
      </nav>
      <div className={s.sidebarRule} /><div className={s.sidebarGroupLabel}>当前公司</div>
      <button className={s.currentCompany} onClick={() => openView("board")}><span className={s.companyMini}>澄</span><span><b>澄芯科技</b><small>CHENGXIN · DEMO</small></span></button>
      <div className={s.sectionNav}>{visible.map(section => <button key={section.id} onClick={() => jump(section.id)}><span />{section.title}</button>)}</div>
      <div className={s.sidebarBottom}><span className={s.demoAvatar}>D</span><span><b>样板工作区</b><small>独立本地数据</small></span><span className={s.statusDot} /></div>
    </aside>

    <main className={s.main} ref={main}>
      <div className={s.topbar}><button className={`${s.iconButton} ${s.mobileMenu}`} aria-label="打开导航" onClick={() => setSidebar(true)}><Menu size={19} /></button><div className={s.breadcrumb}><span>公司研究</span><ChevronRight size={13} /><span>澄芯科技</span></div><div className={s.topbarRight}><span className={s.demoBadge}>模板预览 · 公司数据为示例</span><span className={s.saved}>{saveError ? "未能保存到本机" : ready ? "仅本机 · 已保存" : "载入中"}</span></div></div>
      <div className={s.content}>
        <header className={s.companyHeader}><div className={s.companyIdentity}><span className={s.companyMark}><Activity size={29} /></span><div><div className={s.companyTitle}><h1>澄芯科技</h1><span className={s.ticker}>DEMO · CNY</span></div><p>高速互联 / 工业连接 / 车载连接 <span>虚构公司</span></p></div></div><div className={s.headerActions}><span className={s.coverage}><Star size={13} />重点跟踪</span><button className={s.primaryButton} onClick={() => openNote()} disabled={!ready}><Plus size={15} />新建笔记</button></div></header>
        <div className={s.realCompanyEntry}><Link href="/companies/nvda" prefetch={false}>英伟达 · NASDAQ: NVDA<ArrowRight size={14} /></Link></div>
        <div className={s.currencyBar}>
          <label>显示币种<select aria-label="显示币种" value={data.currency} disabled={!ready} onChange={e => { setEditingFx(null); save({ ...data, currency: e.target.value as CurrencyChoice }); }}><option value="original">原始报表（{REPORT_CURRENCY}）</option>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}</select></label>
          <div className={s.currencyNote} role="status" data-testid="fx-status">
            {!needsFx ? <span>原始报表：{REPORT_CURRENCY} · 原始报价：{QUOTE_CURRENCY}</span> : appliedFx ? <>
              <span>1 {REPORT_CURRENCY} = {convertMoney(1, REPORT_CURRENCY, currency, rates).toFixed(6)} {currency}</span>
              <span><a href={FX_SOURCE} target="_blank" rel="noreferrer">ExchangeRate.fun</a> · 每小时更新 · 非逐秒报价</span>
              <span>汇率时间：<time dateTime={new Date(appliedFx.timestamp * 1000).toISOString()}>{new Date(appliedFx.timestamp * 1000).toLocaleString("zh-CN", { hour12: false })}</time></span>
              {fx.stale ? <span>较旧汇率（超过 2 小时）</span> : null}
              {fx.failed ? <span>更新失败，暂用上次汇率</span> : fx.loading ? <span>正在检查更新</span> : null}
              {editingFx ? <span>金额编辑中，汇率已锁定</span> : null}
            </> : <span>{fx.failed ? "汇率获取失败，稍后自动重试" : "正在获取汇率"} · 暂显原币 {REPORT_CURRENCY}，尚未换算为 {data.currency}</span>}
          </div>
        </div>
        <div className={s.summaryBand}><div><span>最新收盘价 · {quoteCurrency}</span><strong data-testid="summary-price">{quote(PRICE)} <small className={s.green}>+1.50%</small></strong></div><div><span>2025A 营业收入 · 亿 {currency}</span><strong data-testid="summary-revenue">{money(28.6)}</strong></div><div><span>2026E EPS · {currency} · 我的预测</span><strong data-testid="summary-eps">{money(3.2)}</strong></div><div><span>下一研究节点</span><strong className={s.nextEvent}>2026 年度业绩<small>2027 Q1 · 示例日程</small></strong></div></div>
        <div className={s.tabsRow}><div className={s.tabs} role="tablist" aria-label="公司研究视图">{([["board", "研究看板"], ["notes", "笔记与资料"], ["chains", "产业链关系"]] as const).map(([id, title]) => <button key={id} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={view === id} onClick={() => openView(id)}>{title}{id !== "board" ? <span>{id === "notes" ? data.notes.length : data.links.length}</span> : null}</button>)}</div>{view === "board" ? <button className={`${s.secondaryButton} ${layout ? s.activeButton : ""}`} disabled={!ready} onClick={() => setLayout(!layout)}>{layout ? <Check size={15} /> : <Settings2 size={15} />}{layout ? "完成调整" : "调整看板"}</button> : null}</div>

        {view === "board" ? <div id="panel-board" role="tabpanel" aria-labelledby="tab-board">
          {layout ? <div className={s.layoutBar}><span><Columns2 size={16} />看板布局 <b>{visible.length} 个区块</b></span><div><button className={s.textButton} onClick={() => setModal("reset")}><RotateCcw size={14} />恢复默认布局</button><button className={s.secondaryButton} onClick={() => { setSectionKind("custom"); setSectionTitle(""); setModal("section"); }}><Plus size={15} />添加区块</button></div></div> : null}
          <div className={s.boardGrid}>
            {visible.map((section, index) => <section key={section.id} id={`demo-${section.id}`} data-section={section.id} className={`${s.section} ${section.wide ? s.wide : ""} ${layout ? s.editableSection : ""}`} onDragOver={e => { if (layout && dragId.current) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (layout && dragId.current) { save({ ...data, sections: moveSection(data.sections, dragId.current, section.id) }); dragId.current = null; } }}>
              <div className={s.sectionHeader}><div>{layout ? <button className={`${s.iconButton} ${s.dragHandle}`} title={`拖动${section.title}`} aria-label={`拖动${section.title}`} draggable onDragStart={e => { dragId.current = section.id; e.dataTransfer.setData("text/plain", section.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { dragId.current = null; }}><GripVertical size={16} /></button> : <span className={s.sectionNumber}>{String(index + 1).padStart(2, "0")}</span>}<h2>{section.title}</h2>{section.kind === "thesis" ? <span className={s.smallBadge}>研究假设 · 原文 {REPORT_CURRENCY}</span> : null}</div>
                <div className={s.sectionTools}>{layout ? <>
                  <IconButton label={`上移${section.title}`} disabled={index === 0} onClick={() => save({ ...data, sections: moveSection(data.sections, section.id, visible[index - 1].id) })}><ArrowUp size={14} /></IconButton>
                  <IconButton label={`下移${section.title}`} disabled={index === visible.length - 1} onClick={() => save({ ...data, sections: moveSection(data.sections, section.id, visible[index + 1].id) })}><ArrowDown size={14} /></IconButton>
                  <IconButton label={section.wide ? `将${section.title}设为半宽` : `将${section.title}设为整行`} onClick={() => updateSection(section.id, { wide: !section.wide })}>{section.wide ? <Columns2 size={14} /> : <Maximize2 size={14} />}</IconButton>
                  <IconButton label={`重命名${section.title}`} onClick={() => setRename({ ...section })}><Pencil size={14} /></IconButton>
                  <IconButton label={`隐藏${section.title}`} onClick={() => { updateSection(section.id, { hidden: true }); setToast("区块已隐藏，内容仍保留"); }}><EyeOff size={14} /></IconButton>
                </> : section.kind === "thesis" ? <IconButton label="编辑投资判断" onClick={() => { setThesis(data.investmentThesis); setModal("thesis"); }}><Pencil size={15} /></IconButton> : section.kind === "notes" ? <IconButton label="新增研究笔记" onClick={() => openNote()}><Plus size={17} /></IconButton> : section.kind === "relations" ? <span className={s.muted}>{data.links.length} 个业务归属</span> : null}</div>
              </div>{content(section)}
            </section>)}
          </div>
          <button className={s.addSection} disabled={!ready || data.sections.length >= 30} onClick={() => { setSectionKind("custom"); setSectionTitle(""); setModal("section"); }}><Plus size={17} />添加研究区块</button>
        </div> : view === "notes" ? <div id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" className={s.notesView}>
          <div className={s.viewHeading}><div><h2>笔记与资料</h2><p>澄芯科技 / {data.notes.length} 篇研究记录 · 原文金额 {REPORT_CURRENCY}</p></div><button className={s.secondaryButton} onClick={() => openNote()}><Plus size={15} />新建笔记</button></div>
          <div className={s.filterRow}><div className={s.filters}>{["全部", ...CATEGORIES].map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div><label className={s.search}><Search size={16} /><input aria-label="搜索笔记" placeholder="搜索笔记…" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
          {renderNotes()}
        </div> : <div id="panel-chains" role="tabpanel" aria-labelledby="tab-chains"><Chains data={data} selectedChain={selectedChain} selectedNode={selectedNode} onSelectChain={id => { setSelectedChain(id); setSelectedNode("company"); }} onSelectNode={setSelectedNode} onAdd={() => setModal("link")} onRemove={id => { save({ ...data, links: data.links.filter(l => l.id !== id) }); setToast("已移除产业链引用，公司看板与资料不变"); }} onBoard={() => openView("board")} /></div>}
        <footer className={s.footer}><span>ZhiNote / Company Research</span><span>独立样板 · 未连接账号、行情或云同步</span></footer>
      </div>
    </main>
    {toast ? <div className={s.toast} role="status"><Check size={16} />{toast}</div> : null}

    {modal === "thesis" ? <ModalFrame title="编辑投资判断" close={() => setModal(null)}><form onSubmit={e => { e.preventDefault(); save({ ...data, investmentThesis: thesis }); setModal(null); }} className={s.form}><label>Investment Thesis<textarea autoFocus value={thesis} maxLength={16000} rows={10} onChange={e => setThesis(e.target.value)} /></label><div className={s.formActions}><button type="button" className={s.secondaryButton} onClick={() => setModal(null)}>取消</button><button className={s.primaryButton}><Check size={15} />保存判断</button></div></form></ModalFrame> : null}
    {note ? <ModalFrame title={data.notes.some(n => n.id === note.id) ? "研究笔记" : "新建笔记"} close={() => setNote(null)}><form className={s.form} onSubmit={e => { e.preventDefault(); if (!note.title.trim()) return; save({ ...data, notes: data.notes.some(n => n.id === note.id) ? data.notes.map(n => n.id === note.id ? { ...note, title: note.title.trim() } : n) : [{ ...note, title: note.title.trim() }, ...data.notes].slice(0, 100) }); setNote(null); setToast("笔记已保存在本机样板"); }}><label>标题<input autoFocus required maxLength={200} value={note.title} onChange={e => setNote({ ...note, title: e.target.value })} /></label><div className={s.formColumns}><label>分类<select value={note.category} onChange={e => setNote({ ...note, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>日期<input type="date" required value={note.date} onChange={e => setNote({ ...note, date: e.target.value })} /></label></div><label>正文<textarea rows={12} maxLength={20000} value={note.body} onChange={e => setNote({ ...note, body: e.target.value })} /></label><div className={s.formActions}><button type="button" className={s.secondaryButton} onClick={() => setNote(null)}>取消</button><button className={s.primaryButton}><Check size={15} />保存笔记</button></div></form></ModalFrame> : null}
    {modal === "section" ? <ModalFrame title="添加研究区块" close={() => setModal(null)}><form className={s.form} onSubmit={e => { e.preventDefault(); if (sectionKind === "custom") { if (!sectionTitle.trim()) return; save({ ...data, sections: [...data.sections, { id: `custom-${crypto.randomUUID()}`, kind: "custom", title: sectionTitle.trim(), wide: false, hidden: false, text: "" }] }); } else { const found = data.sections.find(sec => sec.kind === sectionKind && sec.hidden); if (found) updateSection(found.id, { hidden: false }); } setModal(null); setLayout(true); }}><label>区块类型<select value={sectionKind} onChange={e => setSectionKind(e.target.value as SectionKind)}><option value="custom">自由笔记</option>{data.sections.filter(sec => sec.hidden && sec.kind !== "custom").map(sec => <option key={sec.id} value={sec.kind}>恢复：{sec.title}</option>)}</select></label>{sectionKind === "custom" ? <label>区块名称<input autoFocus required maxLength={80} placeholder="例如：催化剂日历" value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} /></label> : null}<div className={s.formActions}><button type="button" className={s.secondaryButton} onClick={() => setModal(null)}>取消</button><button className={s.primaryButton}><Plus size={15} />添加区块</button></div></form>{data.sections.some(sec => sec.hidden && sec.kind === "custom") ? <div className={s.hiddenSections}><span>已隐藏的自由笔记</span>{data.sections.filter(sec => sec.hidden && sec.kind === "custom").map(sec => <button className={s.textButton} key={sec.id} onClick={() => { updateSection(sec.id, { hidden: false }); setModal(null); }}><Plus size={14} />{sec.title}</button>)}</div> : null}</ModalFrame> : null}
    {rename ? <ModalFrame title="重命名区块" close={() => setRename(null)}><form className={s.form} onSubmit={e => { e.preventDefault(); if (!rename.title.trim()) return; updateSection(rename.id, { title: rename.title.trim() }); setRename(null); }}><label>区块名称<input autoFocus required maxLength={80} value={rename.title} onChange={e => setRename({ ...rename, title: e.target.value })} /></label><div className={s.formActions}><button className={s.primaryButton}><Check size={15} />保存名称</button></div></form></ModalFrame> : null}
    {modal === "link" ? <ModalFrame title="添加产业链归属" close={() => setModal(null)}><form className={s.form} onSubmit={e => { e.preventDefault(); if (!chainRole.trim()) return; const exists = data.links.some(l => l.chain === chainChoice && l.role === chainRole.trim()); if (!exists) save({ ...data, links: [...data.links, { id: crypto.randomUUID(), chain: chainChoice, role: chainRole.trim() }].slice(0, 20) }); setModal(null); setToast(exists ? "该产业链归属已存在" : "已添加产业链引用"); }}><label>产业链<select value={chainChoice} onChange={e => { setChainChoice(e.target.value); setChainRole(CUSTOM_CHAIN_OPTIONS.find(c => c.chain === e.target.value)?.role ?? ""); }}>{CUSTOM_CHAIN_OPTIONS.map(c => <option key={c.chain}>{c.chain}</option>)}</select></label><label>业务 / 环节<input required maxLength={80} value={chainRole} onChange={e => setChainRole(e.target.value)} /></label><div className={s.formActions}><button type="button" className={s.secondaryButton} onClick={() => setModal(null)}>取消</button><button className={s.primaryButton}><Link2 size={15} />添加引用</button></div></form></ModalFrame> : null}
    {modal === "reset" ? <ModalFrame title="恢复默认布局" close={() => setModal(null)}><div className={s.form}><p>恢复默认区块的顺序、名称和宽度。你编辑的笔记、判断和模型参数不变，自建区块会保留在末尾。</p><div className={s.formActions}><button className={s.secondaryButton} onClick={() => setModal(null)}>取消</button><button className={s.primaryButton} onClick={() => { save({ ...data, sections: [...defaultSections(), ...data.sections.filter(sec => sec.kind === "custom")] }); setModal(null); }}><RotateCcw size={15} />恢复布局</button></div></div></ModalFrame> : null}
  </div>;
}

function EpsInput({ value, currency, rates, onChange, onEditing }: { value: number; currency: Currency; rates?: FxRates; onChange: (value: number) => void; onEditing: (editing: boolean) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const minimum = convertMoney(.1, REPORT_CURRENCY, currency, rates), maximum = convertMoney(20, REPORT_CURRENCY, currency, rates);
  return <input aria-label="我的 2027E EPS" type="number" min={minimum} max={maximum} step="any"
    value={draft ?? Number(convertMoney(value, REPORT_CURRENCY, currency, rates).toFixed(6))}
    onFocus={() => onEditing(true)} onBlur={() => { setDraft(null); onEditing(false); }} onChange={e => {
      setDraft(e.target.value);
      const native = convertMoney(e.target.valueAsNumber, currency, REPORT_CURRENCY, rates);
      if (Number.isFinite(native) && native >= .1 && native <= 20) onChange(Number(native.toPrecision(12)));
    }} />;
}

function Chains({ data, selectedChain, selectedNode, onSelectChain, onSelectNode, onAdd, onRemove, onBoard }: {
  data: DemoState; selectedChain: string; selectedNode: string; onSelectChain: (id: string) => void; onSelectNode: (id: string) => void; onAdd: () => void; onRemove: (id: string) => void; onBoard: () => void;
}) {
  const link = data.links.find(l => l.id === selectedChain) ?? data.links[0];
  const auto = link?.chain === "智能汽车";
  const nodes = [{ id: "materials", name: "材料与组件", type: "上游供给", detail: "示例关系：原材料成本与供给稳定性，影响连接产品的交付及毛利率。", state: "待验证" },
    { id: "company", name: "澄芯科技", type: link?.role ?? "连接业务", detail: `示例研究：${link?.role ?? "连接业务"}业务的产品组合、客户导入与量产进度。需要进一步核对收入贡献和资本开支回报。`, state: "公司引用" },
    { id: "customer", name: auto ? "整车与系统平台" : "系统与设备平台", type: "下游客户", detail: "示例关系：平台导入、采购份额与交付节奏是收入兑现的重要验证点。", state: "研究假设" },
    { id: "demand", name: auto ? "汽车电子升级" : "终端需求与投资", type: "需求驱动", detail: "示例传导：终端需求变化经由客户资本开支与订单，影响公司对应业务。方向与时滞需要独立验证。", state: "研究假设" }];
  const selected = nodes.find(n => n.id === selectedNode) ?? nodes[1];
  return <div className={s.chainsView}>
    <div className={s.viewHeading}><div><h2>产业链关系</h2><p>澄芯科技 / {data.links.length} 个业务归属</p></div><button className={s.secondaryButton} onClick={onAdd}><Plus size={15} />添加归属</button></div>
    {data.links.length ? <>
      <div className={s.chainTabs}>{data.links.map(l => <button key={l.id} aria-pressed={l.id === link?.id} onClick={() => onSelectChain(l.id)}><Network size={15} />{l.chain}<span>{l.role}</span></button>)}</div>
      <div className={s.chainHeading}><span><b>{link.chain}</b><ChevronRight size={14} />{link.role}</span><span className={s.smallBadge}>示例关系 · 未验证</span></div>
      <div className={s.chainWorkspace}><div className={s.chainGraph}>
        <div className={s.graphLegend}><span><i className={s.solidLine} />业务关系</span><span><i className={s.dashedLine} />需求传导假设</span></div>
        <div className={s.nodeRow}>{nodes.map((n, i) => <div key={n.id} className={s.nodeColumn}><span className={s.nodeLabel}>{n.type}</span><button className={`${s.chainNode} ${n.id === "company" ? s.companyNode : ""}`} aria-pressed={selected.id === n.id} onClick={() => onSelectNode(n.id)}>{n.id === "company" ? <Activity size={21} /> : n.id === "demand" ? <Target size={21} /> : <BarChart3 size={21} />}<strong>{n.name}</strong><small>{n.state}</small></button>{i < nodes.length - 1 ? <span className={s.connector}><span>{["供应", "供应", "服务"][i]}</span><ArrowRight size={16} /></span> : null}</div>)}</div>
        <div className={s.transmission}><Target size={16} /><span>需求传导假设</span><span>{auto ? "电子化率提升" : "资本开支变化"}</span><ArrowRight size={14} /><span>平台订单</span><ArrowRight size={14} /><span>{link.role}收入</span></div>
      </div><aside className={s.nodeDetail}><span className={s.eyebrow}>当前节点</span><h3>{selected.name}</h3><span className={s.smallBadge}>{selected.type}</span><p>{selected.detail}</p><dl><div><dt>来源</dt><dd>样板研究资料</dd></div><div><dt>更新日期</dt><dd>2026-10-30</dd></div><div><dt>验证状态</dt><dd>{selected.state}</dd></div></dl>{selected.id === "company" ? <button className={s.textButton} onClick={onBoard}>打开公司看板 <ArrowUpRight size={14} /></button> : null}</aside></div>
      <div className={s.crossChain}><div><Link2 size={18} /><h3>跨产业链联系</h3><span className={s.smallBadge}>待验证</span></div><p>高速连接能力在不同应用场景中的复用</p><div className={s.crossChainPath}>{data.links.map((l, i) => <span key={l.id}>{i ? <Link2 size={15} /> : null}<button onClick={() => onSelectChain(l.id)}>{l.chain}<ChevronRight size={14} /></button></span>)}</div><small>技术复用是示例研究假设，不等于订单或收入已经兑现。</small></div>
    </> : <div className={s.empty}><Network size={30} /><p>还没有产业链归属</p><button className={s.primaryButton} onClick={onAdd}><Plus size={15} />添加归属</button></div>}
    <div className={s.membershipTable}><h3>公司归属清单</h3>{data.links.map(l => <div key={l.id}><Network size={16} /><strong>{l.chain}</strong><span>{l.role}</span><IconButton label={`移除${l.chain}归属`} onClick={() => onRemove(l.id)}><Trash2 size={15} /></IconButton></div>)}</div>
  </div>;
}
