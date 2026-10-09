"use client";

import { useRef, useState } from "react";

export default function AiExposureInput({ stockKey, value, readOnly, onChange }: {
  stockKey: string;
  value: number | undefined;
  readOnly: boolean;
  onChange: (value: number | undefined, expected: number | undefined) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const base = useRef(value);
  const busy = useRef(false);
  const dirty = useRef(false);

  const commit = async (input: HTMLInputElement) => {
    if (readOnly || busy.current || !dirty.current) return;
    if (input.validity.badInput) { setError("请输入 -1 到 1 的数字"); return; }
    const next = input.value.trim() === "" ? undefined : Number(input.value);
    if (next !== undefined && (!Number.isFinite(next) || next < -1 || next > 1)) {
      setError("范围为 -1 到 1"); return;
    }
    busy.current = true; setSaving(true);
    try {
      if (next !== value && !await onChange(next, base.current)) {
        setError("未保存，请核对后重试"); return;
      }
      dirty.current = false;
      setDraft(null); setError(null);
    } catch { setError("未保存，请重试"); }
    finally { busy.current = false; setSaving(false); }
  };

  return <div className="w-28">
    <input type="number" min={-1} max={1} step="any" placeholder="未填写"
      aria-label={`${stockKey} AI Exposure`} aria-invalid={!!error} aria-busy={saving}
      title="AI Exposure (-1 ~ 1)" readOnly={readOnly || saving}
      value={readOnly ? (value ?? "") : (draft ?? value ?? "")}
      onFocus={() => { if (!dirty.current) base.current = value; }}
      onChange={(event) => { dirty.current = true; setDraft(event.target.value); setError(null); }}
      onBlur={(event) => void commit(event.currentTarget)}
      onKeyDown={(event) => {
        if (busy.current) return;
        if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === "Escape") {
          dirty.current = false; setDraft(null); setError(null); event.currentTarget.blur();
        }
      }}
      className="h-8 w-full rounded border border-zinc-300 bg-transparent px-2 text-right text-xs tabular-nums text-zinc-800 outline-none focus:border-sky-500 aria-invalid:border-red-500 read-only:border-transparent dark:border-zinc-700 dark:text-zinc-100" />
    {error && <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
  </div>;
}
