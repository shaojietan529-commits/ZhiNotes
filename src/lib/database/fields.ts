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

export const DATABASE_ROLLUP_AGGREGATIONS = [
  { value: "count", label: "关联数量" },
  { value: "titles", label: "页面标题" },
] as const;

export type DatabaseRollupAggregation =
  (typeof DATABASE_ROLLUP_AGGREGATIONS)[number]["value"];

export const DEFAULT_DATABASE_ROLLUP_AGGREGATION: DatabaseRollupAggregation =
  "count";

export const DATABASE_FIELD_TYPES = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "relation", label: "关联" },
  { value: "rollup", label: "汇总" },
  { value: "select", label: "单选" },
  { value: "multi_select", label: "多选" },
  { value: "status", label: "状态" },
  { value: "date", label: "日期" },
  { value: "checkbox", label: "复选框" },
  { value: "url", label: "链接" },
  { value: "email", label: "邮箱" },
  { value: "phone", label: "电话" },
  { value: "formula", label: "公式" },
  { value: "button", label: "按钮草案" },
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

export function getDatabaseFieldDescription(
  field: Pick<DatabaseField, "config">
) {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    return typeof config.description === "string"
      ? config.description.trim()
      : "";
  } catch {
    return "";
  }
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

export function getDatabaseRollupConfig(
  field: Pick<DatabaseField, "config">
) {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    return {
      relationFieldId:
        typeof config.relationFieldId === "string"
          ? config.relationFieldId
          : "",
      aggregation: isDatabaseRollupAggregation(config.aggregation)
        ? config.aggregation
        : DEFAULT_DATABASE_ROLLUP_AGGREGATION,
    };
  } catch {
    return {
      relationFieldId: "",
      aggregation: DEFAULT_DATABASE_ROLLUP_AGGREGATION,
    };
  }
}

export function getDatabaseButtonConfig(field: Pick<DatabaseField, "config">) {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    return {
      label:
        typeof config.buttonLabel === "string" && config.buttonLabel.trim()
          ? config.buttonLabel.trim()
          : "预览动作",
      actionPreview:
        typeof config.buttonActionPreview === "string" &&
        config.buttonActionPreview.trim()
          ? config.buttonActionPreview.trim()
          : "尚未配置动作。当前按钮只显示预览，不会写入数据。",
    };
  } catch {
    return {
      label: "预览动作",
      actionPreview: "尚未配置动作。当前按钮只显示预览，不会写入数据。",
    };
  }
}

export function buildFieldConfig(
  fieldType: string,
  optionsText: string,
  numberFormat: string = DEFAULT_DATABASE_NUMBER_FORMAT,
  formulaExpression: string = "",
  rollupRelationFieldId: string = "",
  rollupAggregation: string = DEFAULT_DATABASE_ROLLUP_AGGREGATION,
  description: string = "",
  buttonLabel: string = "",
  buttonActionPreview: string = ""
) {
  if (isSelectLikeFieldType(fieldType)) {
    return stringifyFieldConfig(
      { options: parseSelectOptions(optionsText) },
      description
    );
  }
  if (fieldType === "rollup") {
    return stringifyFieldConfig(
      {
        relationFieldId: rollupRelationFieldId,
        aggregation: isDatabaseRollupAggregation(rollupAggregation)
          ? rollupAggregation
          : DEFAULT_DATABASE_ROLLUP_AGGREGATION,
      },
      description
    );
  }
  if (fieldType === "formula") {
    return stringifyFieldConfig(
      {
        formula: formulaExpression.trim(),
        numberFormat: isDatabaseNumberFormat(numberFormat)
          ? numberFormat
          : DEFAULT_DATABASE_NUMBER_FORMAT,
      },
      description
    );
  }
  if (fieldType === "button") {
    return stringifyFieldConfig(
      {
        buttonLabel: buttonLabel.trim() || "预览动作",
        buttonActionPreview:
          buttonActionPreview.trim() ||
          "尚未配置动作。当前按钮只显示预览，不会写入数据。",
      },
      description
    );
  }
  if (
    fieldType === "number" &&
    numberFormat !== DEFAULT_DATABASE_NUMBER_FORMAT
  ) {
    return stringifyFieldConfig(
      {
        numberFormat: isDatabaseNumberFormat(numberFormat)
          ? numberFormat
          : DEFAULT_DATABASE_NUMBER_FORMAT,
      },
      description
    );
  }
  return stringifyFieldConfig({}, description);
}

function stringifyFieldConfig(
  config: Record<string, unknown>,
  description: string
) {
  const nextConfig = { ...config };
  const nextDescription = description.trim();
  if (nextDescription) {
    nextConfig.description = nextDescription;
  }
  return Object.keys(nextConfig).length > 0 ? JSON.stringify(nextConfig) : null;
}

function isDatabaseNumberFormat(value: unknown): value is DatabaseNumberFormat {
  return DATABASE_NUMBER_FORMATS.some((format) => format.value === value);
}

function isDatabaseRollupAggregation(
  value: unknown
): value is DatabaseRollupAggregation {
  return DATABASE_ROLLUP_AGGREGATIONS.some(
    (aggregation) => aggregation.value === value
  );
}
