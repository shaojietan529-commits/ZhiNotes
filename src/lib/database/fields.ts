import type { DatabaseField } from "@/lib/utils/types";
import {
  DATABASE_CREATED_TIME_FIELD,
  DATABASE_LAST_EDITED_TIME_FIELD,
  DATABASE_UNIQUE_ID_FIELD,
} from "@/lib/database/systemFields";

export const DATABASE_NUMBER_FORMATS = [
  { value: "plain", label: "普通数字" },
  { value: "percent", label: "百分比" },
  { value: "currency_usd", label: "美元" },
  { value: "currency_cny", label: "人民币" },
  { value: "multiple", label: "倍数" },
] as const;

export type DatabaseNumberFormat =
  (typeof DATABASE_NUMBER_FORMATS)[number]["value"];

export const DEFAULT_DATABASE_NUMBER_FORMAT: DatabaseNumberFormat = "plain";

export const DATABASE_FIELD_TYPES = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "relation", label: "关联" },
  { value: "select", label: "单选" },
  { value: "multi_select", label: "多选" },
  { value: "status", label: "状态" },
  { value: "date", label: "日期" },
  { value: "checkbox", label: "复选框" },
  { value: "url", label: "链接" },
  { value: "email", label: "邮箱" },
  { value: "phone", label: "电话" },
  { value: "formula", label: "公式" },
  { value: DATABASE_CREATED_TIME_FIELD, label: "创建时间" },
  { value: DATABASE_LAST_EDITED_TIME_FIELD, label: "最后编辑时间" },
  { value: DATABASE_UNIQUE_ID_FIELD, label: "唯一 ID" },
];

export function isSelectLikeFieldType(fieldType: string) {
  return fieldType === "select" || fieldType === "multi_select" || fieldType === "status";
}

export function parseSelectOptions(value: string) {
  const options = Array.from(
    new Set(
      value
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean)
    )
  );

  return options.length > 0 ? options : ["选项"];
}

export function getFieldOptions(field: Pick<DatabaseField, "config">) {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    return Array.isArray(config.options)
      ? config.options.filter((option: unknown): option is string =>
          typeof option === "string"
        )
      : [];
  } catch {
    return [];
  }
}

export function formatFieldOptions(field: Pick<DatabaseField, "config">) {
  return getFieldOptions(field).join(", ");
}

export function getDatabaseNumberFormat(
  field: Pick<DatabaseField, "config">
): DatabaseNumberFormat {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    const value = config.numberFormat;
    return isDatabaseNumberFormat(value)
      ? value
      : DEFAULT_DATABASE_NUMBER_FORMAT;
  } catch {
    return DEFAULT_DATABASE_NUMBER_FORMAT;
  }
}

export function getDatabaseFormulaExpression(
  field: Pick<DatabaseField, "config">
) {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    return typeof config.formula === "string" ? config.formula : "";
  } catch {
    return "";
  }
}

export function buildFieldConfig(
  fieldType: string,
  optionsText: string,
  numberFormat: string = DEFAULT_DATABASE_NUMBER_FORMAT,
  formulaExpression: string = ""
) {
  if (isSelectLikeFieldType(fieldType)) {
    return JSON.stringify({ options: parseSelectOptions(optionsText) });
  }
  if (fieldType === "formula") {
    return JSON.stringify({
      formula: formulaExpression.trim(),
      numberFormat: isDatabaseNumberFormat(numberFormat)
        ? numberFormat
        : DEFAULT_DATABASE_NUMBER_FORMAT,
    });
  }
  if (
    fieldType === "number" &&
    numberFormat !== DEFAULT_DATABASE_NUMBER_FORMAT
  ) {
    return JSON.stringify({
      numberFormat: isDatabaseNumberFormat(numberFormat)
        ? numberFormat
        : DEFAULT_DATABASE_NUMBER_FORMAT,
    });
  }
  return null;
}

function isDatabaseNumberFormat(value: unknown): value is DatabaseNumberFormat {
  return DATABASE_NUMBER_FORMATS.some((format) => format.value === value);
}
