"use client";

import type { ReactNode } from "react";

export type ApiGuardFieldStatus = "allowed" | "forbidden";
export type ApiGuardValidationStatus = "accepted" | "rejected";

export interface ApiGuardSummaryItem {
  label: string;
  value: number | string;
  detail: string;
  status: ApiGuardValidationStatus;
}

export interface ApiGuardField {
  field: string;
  status: ApiGuardFieldStatus;
  reason: string;
}

export interface ApiGuardFixture {
  id: string;
  expected_status: ApiGuardValidationStatus;
  actual_status: ApiGuardValidationStatus;
  forbidden_field_names?: string[];
  reason: string;
}

export interface ApiGuardGate {
  id: string;
  title: string;
  required_before_enablement: string;
}

interface ApiGuardPanelProps {
  title: string;
  description: string;
  exportLabel: string;
  exportingLabel?: string;
  busy: boolean;
  onExport: () => void;
  summaries: ApiGuardSummaryItem[];
  allowedFields: ApiGuardField[];
  forbiddenFields: ApiGuardField[];
  fixtures: ApiGuardFixture[];
  gates: ApiGuardGate[];
  summaryColumnsClassName?: string;
  gateColumnsClassName?: string;
}

export function ApiGuardPanel({
  title,
  description,
  exportLabel,
  exportingLabel = "导出中...",
  busy,
  onExport,
  summaries,
  allowedFields,
  forbiddenFields,
  fixtures,
  gates,
  summaryColumnsClassName = "mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7",
  gateColumnsClassName = "grid gap-2 md:grid-cols-2 xl:grid-cols-3",
}: ApiGuardPanelProps) {
  return (
    <article className="mt-4 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {busy ? exportingLabel : exportLabel}
        </button>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      <div className={summaryColumnsClassName}>
        {summaries.map((item) => (
          <ApiGuardSummaryCard key={item.label} item={item} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <ApiGuardSection title="请求结构">
          <div className="space-y-2">
            {allowedFields.slice(0, 6).map((field) => (
              <ApiGuardFieldRow key={field.field} field={field} />
            ))}
            {forbiddenFields.slice(0, 6).map((field) => (
              <ApiGuardFieldRow key={field.field} field={field} />
            ))}
          </div>
        </ApiGuardSection>
        <ApiGuardSection title="Fixture 检查">
          <div className="space-y-2">
            {fixtures.map((fixture) => (
              <ApiGuardFixtureRow key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </ApiGuardSection>
      </div>
      <ApiGuardSection title="启用门槛" className="mt-4">
        <div className={gateColumnsClassName}>
          {gates.map((gate) => (
            <ApiGuardGateRow key={gate.id} gate={gate} />
          ))}
        </div>
      </ApiGuardSection>
    </article>
  );
}

function ApiGuardSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-md border border-zinc-100 p-3 dark:border-zinc-800 ${
        className ?? ""
      }`}
    >
      <div className="mb-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      {children}
    </section>
  );
}

function ApiGuardSummaryCard({ item }: { item: ApiGuardSummaryItem }) {
  return (
    <div className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">{item.label}</div>
        <ApiGuardValidationPill status={item.status} />
      </div>
      <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {item.value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-zinc-400">
        {item.detail}
      </div>
    </div>
  );
}

function ApiGuardFieldRow({ field }: { field: ApiGuardField }) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          {field.field}
        </div>
        <ApiGuardFieldStatusPill status={field.status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {field.reason}
      </p>
    </article>
  );
}

function ApiGuardFixtureRow({ fixture }: { fixture: ApiGuardFixture }) {
  const forbiddenFieldNames = fixture.forbidden_field_names ?? [];

  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {fixture.id}
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            预期 {fixture.expected_status}
          </div>
        </div>
        <ApiGuardValidationPill status={fixture.actual_status} />
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {fixture.reason}
      </p>
      {forbiddenFieldNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {forbiddenFieldNames.map((fieldName) => (
            <span
              key={fieldName}
              className="rounded-md bg-white px-2 py-1 font-mono text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
            >
              {fieldName}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function ApiGuardGateRow({ gate }: { gate: ApiGuardGate }) {
  return (
    <article className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
        {gate.title}
      </div>
      <div className="mt-1 font-mono text-[10px] text-zinc-400">
        {gate.id}
      </div>
      <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
        {gate.required_before_enablement}
      </p>
    </article>
  );
}

function ApiGuardFieldStatusPill({ status }: { status: ApiGuardFieldStatus }) {
  const className =
    status === "allowed"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {status === "allowed" ? "允许" : "禁止"}
    </span>
  );
}

function ApiGuardValidationPill({
  status,
}: {
  status: ApiGuardValidationStatus;
}) {
  const className =
    status === "accepted"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {status === "accepted" ? "通过" : "拒绝"}
    </span>
  );
}
