"use client";

import { useEffect, useId, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CURRENCIES, convertMoney, displayCurrency, fxSource, type Currency, type CurrencyChoice, type FxRates } from "./currency";
import { useExchangeRates } from "./useExchangeRates";
import { CAP_UNITS, calculateTarget, createTargetDraft, parseTargetNumber, readTargetDraft, targetDraftKey, type CapUnit, type ShareBasis, type TargetDraft, type TargetField } from "./target-valuation";
import s from "./CompanyBoardPreview.module.css";

type Presentation = { currency: Currency; rates?: FxRates; onEditing: (editing: boolean) => void };
type Edit = { field: TargetField; text: string; currency: Currency; rates?: FxRates; unit: CapUnit };
const numberText = (n: number | null) => n === null || !Number.isFinite(n) ? "" : String(Number(n.toPrecision(12)));

export default function TargetValuation({ companyId, basis, defaultUnit = "hundredMillion", presentation }: {
  companyId: string; basis: ShareBasis; defaultUnit?: CapUnit; presentation?: Presentation;
}) {
  const [data, setData] = useState(() => createTargetDraft(companyId, defaultUnit));
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const errorId = useId();
  const needsFx = !presentation && data.currency !== "original" && data.currency !== basis.currency;
  const fx = useExchangeRates(ready && !!needsFx);
  const currency = edit?.currency ?? presentation?.currency ?? (fx.quote ? displayCurrency(data.currency, basis.currency) : basis.currency);
  const rates = edit ? edit.rates : presentation?.rates ?? fx.quote?.rates;
  const shares = data.shareMode === "reported" ? basis.shares : data.customShares;
  const validShares = shares !== null && Number.isFinite(shares) && shares > 0;
  const editNumber = edit ? parseTargetNumber(edit.text) : null;
  const editedAmount = editNumber === null || !edit ? null : convertMoney(editNumber, edit.currency, basis.currency, edit.rates) * (edit.field === "marketCap" ? CAP_UNITS[edit.unit].scale : 1);
  const invalidNumber = editNumber !== null && !Number.isFinite(editNumber);
  const invalidConversion = editedAmount !== null && (!Number.isFinite(editedAmount) || (editNumber! > 0 && editedAmount === 0) || calculateTarget(edit!.field, editedAmount, shares).overflow);
  const invalidInput = invalidNumber || invalidConversion;
  const result = calculateTarget(data.source, invalidInput ? null : data.amount, shares);
  const error = invalidNumber ? "请输入有效的非负金额。" : invalidConversion || result.overflow ? "金额超出可计算范围，请调小输入值。" : !validShares ? "请填写大于 0 的股本，才能换算。" : "";

  useEffect(() => {
    let active = true, stored = createTargetDraft(companyId, defaultUnit), failed = false;
    try { stored = readTargetDraft(localStorage.getItem(targetDraftKey(companyId)), companyId, defaultUnit); }
    catch { failed = true; }
    queueMicrotask(() => { if (active) { setData(stored); setStorageError(failed); setReady(true); } });
    return () => { active = false; };
  }, [companyId, defaultUnit]);

  function save(next: TargetDraft) {
    setData(next);
    try { localStorage.setItem(targetDraftKey(companyId), JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }

  function displayed(field: TargetField) {
    if (edit?.field === field) return edit.text;
    const value = result[field];
    return numberText(value === null ? null : convertMoney(value, basis.currency, currency, rates) / (field === "marketCap" ? CAP_UNITS[data.capUnit].scale : 1));
  }

  function change(field: TargetField, text: string) {
    // Store only the last edited amount in the original quote currency; never round-trip the derived field.
    const snapshot = edit?.field === field ? edit : { field, text, currency, rates, unit: data.capUnit };
    const value = parseTargetNumber(text);
    setEdit({ ...snapshot, text });
    if (value === null) { save({ ...data, source: field, amount: null }); return; }
    const amount = convertMoney(value, snapshot.currency, basis.currency, snapshot.rates) * (field === "marketCap" ? CAP_UNITS[snapshot.unit].scale : 1);
    if (Number.isFinite(amount) && amount >= 0 && !(value > 0 && amount === 0) && !calculateTarget(field, amount, shares).overflow) {
      save({ ...data, source: field, amount });
    } else {
      // Invalid drafts are kept visible, but cannot leave a stale converted amount on screen.
      save({ ...data, source: field, amount: null });
    }
  }

  return <div className={s.targetValuation} data-testid="target-valuation">
    <div className={s.targetToolbar}>
      <span className={s.source}>{storageError ? "本机保存失败 · 请勿关闭页面" : ready ? "本机草稿 · 未同步到账号" : "载入中"}</span>
      {!presentation ? <label>币种<select aria-label="目标估值币种" value={data.currency} disabled={!ready || invalidInput} onChange={e => { setEdit(null); save({ ...data, currency: e.target.value as CurrencyChoice }); }}>
        <option value="original">原始报价 · {basis.currency}</option>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}
      </select></label> : null}
    </div>
    <div className={s.targetAmounts}>
      <label className={s.targetField}><span>目标价 <small>{currency} / 股</small></span>
        <input aria-label="目标价" inputMode="decimal" placeholder="未填写" maxLength={80} disabled={!ready} value={displayed("price")} aria-invalid={edit?.field === "price" && !!error} aria-describedby={error ? errorId : undefined}
          onFocus={() => { setEdit({ field: "price", text: displayed("price"), currency, rates, unit: data.capUnit }); presentation?.onEditing(true); }}
          onChange={e => change("price", e.target.value)} onBlur={() => { if (!invalidInput) setEdit(null); presentation?.onEditing(false); }} />
        <small>{data.amount !== null ? data.source === "price" ? "手动设定" : "按目标市值换算" : "\u00a0"}</small>
      </label>
      <ArrowLeftRight className={s.targetArrow} size={20} aria-hidden="true" />
      <div className={s.targetField}><div className={s.targetCapLabel}><label htmlFor={`${errorId}-cap`}>目标市值</label><select aria-label="目标市值单位" disabled={!ready || invalidInput} value={data.capUnit} onChange={e => { setEdit(null); save({ ...data, capUnit: e.target.value as CapUnit }); }}>
        {Object.entries(CAP_UNITS).map(([id, unit]) => <option key={id} value={id}>{unit.label} {currency}</option>)}
      </select></div>
        <input id={`${errorId}-cap`} aria-label="目标市值" inputMode="decimal" placeholder="未填写" maxLength={80} disabled={!ready} value={displayed("marketCap")} aria-invalid={edit?.field === "marketCap" && !!error} aria-describedby={error ? errorId : undefined}
          onFocus={() => { setEdit({ field: "marketCap", text: displayed("marketCap"), currency, rates, unit: data.capUnit }); presentation?.onEditing(true); }}
          onChange={e => change("marketCap", e.target.value)} onBlur={() => { if (!invalidInput) setEdit(null); presentation?.onEditing(false); }} />
        <small>{data.amount !== null ? data.source === "marketCap" ? "手动设定" : "按目标价换算" : "\u00a0"}</small>
      </div>
    </div>
    <div className={s.targetBasis}>
      <label>股本口径<select aria-label="目标估值股本口径" disabled={!ready} value={data.shareMode} onChange={e => { setShareText(null); save({ ...data, shareMode: e.target.value as TargetDraft["shareMode"], customShares: data.customShares ?? basis.shares }); }}>
        <option value="reported">{basis.url ? "已披露股本" : "示例股本"}</option><option value="custom">自定预期股本</option>
      </select></label>
      <label>股本 · 亿股<input aria-label="目标估值股本" inputMode="decimal" maxLength={80} disabled={!ready || data.shareMode === "reported"} value={shareText ?? numberText(shares === null ? null : shares / 1e8)} aria-invalid={!validShares} aria-describedby={error ? errorId : undefined}
        onChange={e => { setShareText(e.target.value); const value = parseTargetNumber(e.target.value); save({ ...data, customShares: value !== null && value > 0 && Number.isFinite(value * 1e8) ? value * 1e8 : null }); }}
        onBlur={() => { if (validShares) setShareText(null); }} /></label>
    </div>
    {error ? <p id={errorId} className={s.researchWarning} role="alert">{error}</p> : null}
    {storageError ? <p className={s.researchWarning} role="alert">无法保留本次输入，刷新后可能丢失。</p> : null}
    <p className={s.source}>目标市值 = 目标价 × 股本 · {data.shareMode === "custom" ? "自定股本假设" : `${basis.approximate ? "约 " : ""}${numberText(basis.shares / 1e8)} 亿股 · ${basis.asOf}`}</p>
    <div className={s.source}>{basis.url ? <a href={basis.url} target="_blank" rel="noopener noreferrer">{basis.source}</a> : basis.source}{basis.url ? ` · 股本截至 ${basis.asOf}，非实时股本` : null}</div>
    {needsFx ? <p className={s.source} data-testid="target-fx-status">{fx.quote ? <><a href={fxSource(fx.quote).url} target="_blank" rel="noopener noreferrer">{fxSource(fx.quote).name}</a>{` · 汇率时间：${new Date(fx.quote.timestamp * 1000).toLocaleString("zh-CN", { hour12: false })} · ${fxSource(fx.quote).cadence}${fx.stale ? " · 较旧汇率" : ""}${fx.failed ? " · 更新失败，暂用上次汇率" : ""}`}</> : `${fx.failed ? "汇率获取失败" : "正在获取汇率"} · 暂显原币 ${basis.currency}`}</p> : null}
  </div>;
}
