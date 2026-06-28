"use client";

import { useMemo } from "react";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { evaluateDatabaseFormula } from "@/lib/database/formula";
import { evaluateDatabaseRollup } from "@/lib/database/rollup";
import { normalizeMultiSelectValue } from "@/lib/database/multiSelectValues";
import { stringifyRelationValue } from "@/lib/database/relationValues";
import {
  getDatabaseSystemFieldValue,
  isDatabaseSystemTimeField,
} from "@/lib/database/systemFields";
import {
  getDatabaseFieldDisplayName,
  getDatabaseFieldTypeLabel,
} from "@/lib/database/display";

interface ChartViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  chartGroupFieldId?: string;
  relationPages: Page[];
  onOpenRow: (pageId: string) => void;
  onPrimeRow?: (pageId: string) => void;
}

interface ChartBucket {
  label: string;
  rows: (DatabaseRow & { page: Page })[];
}

const MAX_BUCKETS = 12;

export default function ChartView({
  fields,
  rows,
  chartGroupFieldId,
  relationPages,
  onOpenRow,
  onPrimeRow,
}: ChartViewProps) {
  const groupField = useMemo(
    () => pickChartGroupField(fields, chartGroupFieldId),
    [fields, chartGroupFieldId]
  );

  const buckets = useMemo(() => {
    return buildBuckets({
      rows,
      fields,
      field: groupField,
      relationPages,
    });
  }, [fields, rows, groupField, relationPages]);

  const maxCount = Math.max(...buckets.map((bucket) => bucket.rows.length), 1);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">还没有行。</p>;
  }

  if (!groupField) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 p-5 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          图表视图会按属性统计行数。
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          请先添加状态、单选、日期、系统时间、关联、复选框或数字字段，再使用图表。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            按 {getDatabaseFieldDisplayName(groupField)} 分布
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {getDatabaseFieldTypeLabel(groupField.field_type)} 字段 · {rows.length} 行
          </p>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
          本地图表
        </span>
      </div>

      <div className="space-y-3">
        {buckets.map((bucket) => {
          const percent = Math.round((bucket.rows.length / rows.length) * 100);
          const width = `${Math.max(
            5,
            Math.round((bucket.rows.length / maxCount) * 100)
          )}%`;

          return (
            <div key={bucket.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-200">
                  {bucket.label}
                </span>
                <span className="shrink-0 text-zinc-400">
                  {bucket.rows.length} 行 · {percent}%
                </span>
              </div>
              <div className="h-8 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="flex h-full items-center rounded bg-blue-500/80 px-2 text-[11px] font-medium text-white"
                  style={{ width }}
                >
                  {bucket.rows.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {bucket.rows.slice(0, 4).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onPointerEnter={() => onPrimeRow?.(row.page_id)}
                    onPointerDown={() => onPrimeRow?.(row.page_id)}
                    onFocus={() => onPrimeRow?.(row.page_id)}
                    onClick={() => onOpenRow(row.page_id)}
                    className="max-w-[180px] truncate rounded border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
                  >
                    {row.page?.title || "未命名页面"}
                  </button>
                ))}
                {bucket.rows.length > 4 && (
                  <span className="px-1 py-0.5 text-[11px] text-zinc-400">
                    +{bucket.rows.length - 4}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pickChartGroupField(
  fields: DatabaseField[],
  fieldId: string | undefined
) {
  const selected = fields.find((field) => field.id === fieldId);
  if (selected && isChartableField(selected)) return selected;

  return (
    fields.find((field) => field.field_type === "status") ||
    fields.find((field) => field.field_type === "select") ||
    fields.find((field) => field.field_type === "multi_select") ||
    fields.find((field) => field.field_type === "relation") ||
    fields.find((field) => field.field_type === "date") ||
    fields.find(isDatabaseSystemTimeField) ||
    fields.find((field) => field.field_type === "checkbox") ||
    fields.find((field) => field.field_type === "number") ||
    fields.find((field) => field.field_type === "formula") ||
    fields.find((field) => field.field_type === "rollup") ||
    null
  );
}

function buildBuckets({
  rows,
  fields,
  field,
  relationPages,
}: {
  rows: (DatabaseRow & { page: Page })[];
  fields: DatabaseField[];
  field: DatabaseField | null;
  relationPages: Page[];
}) {
  if (!field) return [];

  const groups = new Map<string, (DatabaseRow & { page: Page })[]>();

  for (const row of rows) {
    const values = parseFieldValues(row.field_values);
    const value =
      field.field_type === "formula"
        ? evaluateDatabaseFormula(field, fields, row, values).value
        : field.field_type === "rollup"
          ? evaluateDatabaseRollup(field, fields, values, relationPages).value
        : isDatabaseSystemTimeField(field)
          ? getDatabaseSystemFieldValue(row, field)
          : values[field.id];
    const labels = getBucketLabels(value, field, relationPages);
    for (const label of labels) {
      const group = groups.get(label) ?? [];
      group.push(row);
      groups.set(label, group);
    }
  }

  const buckets = Array.from(groups.entries())
    .map(([label, groupRows]): ChartBucket => ({ label, rows: groupRows }))
    .sort((left, right) => {
      if (right.rows.length !== left.rows.length) {
        return right.rows.length - left.rows.length;
      }
      return left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

  if (buckets.length <= MAX_BUCKETS) return buckets;

  const visible = buckets.slice(0, MAX_BUCKETS - 1);
  const otherRows = buckets
    .slice(MAX_BUCKETS - 1)
    .flatMap((bucket) => bucket.rows);
  return [...visible, { label: "其他", rows: otherRows }];
}

function getBucketLabels(
  value: unknown,
  field: DatabaseField,
  relationPages: Page[]
) {
  if (field.field_type === "relation") {
    const label = stringifyRelationValue(value, relationPages);
    return splitRelationLabel(label);
  }

  if (field.field_type === "checkbox") {
    return [value ? "已勾选" : "未勾选"];
  }

  if (field.field_type === "multi_select") {
    const selected = normalizeMultiSelectValue(value);
    return selected.length > 0 ? selected : ["无值"];
  }

  if (field.field_type === "date" || isDatabaseSystemTimeField(field)) {
    const text = String(value ?? "");
    return [text ? text.slice(0, 7) : "无日期"];
  }

  if (field.field_type === "number" || field.field_type === "formula") {
    const number = Number(value);
    if (!Number.isFinite(number)) return ["无数值"];
    if (number < 0) return ["小于 0"];
    if (number === 0) return ["0"];
    if (number < 1) return ["0-1"];
    if (number < 10) return ["1-10"];
    if (number < 100) return ["10-100"];
    return ["100+"];
  }

  if (field.field_type === "rollup") {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return ["无汇总"];
      if (value === 0) return ["0"];
      if (value < 3) return ["1-2"];
      if (value < 6) return ["3-5"];
      return ["6+"];
    }
    return splitRelationLabel(String(value ?? ""));
  }

  const text = String(value ?? "").trim();
  return [text || "无值"];
}

function splitRelationLabel(label: string) {
  if (!label) return ["无关联"];
  const labels = label
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return labels.length > 0 ? labels : ["无关联"];
}

function isChartableField(field: DatabaseField) {
  return [
    "status",
    "select",
    "multi_select",
    "relation",
    "date",
    "created_time",
    "last_edited_time",
    "checkbox",
    "number",
    "formula",
    "rollup",
  ].includes(field.field_type);
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
