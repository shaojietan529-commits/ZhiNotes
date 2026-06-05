import type { DatabaseField, Page } from "@/lib/utils/types";
import { getDatabaseRollupConfig } from "@/lib/database/fields";
import {
  normalizeRelationValue,
  stringifyRelationValue,
} from "@/lib/database/relationValues";

export type DatabaseRollupStatus =
  | "ready"
  | "empty"
  | "missing-relation"
  | "unconfigured";

export interface DatabaseRollupResult {
  status: DatabaseRollupStatus;
  label: string;
  value: number | string;
  detail: string;
}

export function evaluateDatabaseRollup(
  field: DatabaseField,
  fields: DatabaseField[],
  fieldValues: Record<string, unknown>,
  relationPages: Page[]
): DatabaseRollupResult {
  const config = getDatabaseRollupConfig(field);
  const relationField = fields.find(
    (candidate) =>
      candidate.id === config.relationFieldId &&
      candidate.field_type === "relation"
  );

  if (!config.relationFieldId) {
    return {
      status: "unconfigured",
      label: "未配置汇总",
      value: "",
      detail: "请先选择一个 relation 字段作为汇总来源。",
    };
  }

  if (!relationField) {
    return {
      status: "missing-relation",
      label: "关联字段不存在",
      value: "",
      detail: "这个汇总字段引用的 relation 字段已被删除或改成其他类型。",
    };
  }

  const relationValue = fieldValues[relationField.id];
  const relatedIds = normalizeRelationValue(relationValue);

  if (config.aggregation === "titles") {
    const label = stringifyRelationValue(relatedIds, relationPages);
    return {
      status: label ? "ready" : "empty",
      label: label || "无关联",
      value: label,
      detail: `汇总 ${relationField.name} 的关联页面标题；只读取本地页面标题，不读取页面正文。`,
    };
  }

  const count = relatedIds.length;
  return {
    status: count > 0 ? "ready" : "empty",
    label: String(count),
    value: count,
    detail: `汇总 ${relationField.name} 的关联数量；只读取本地 relation id。`,
  };
}
