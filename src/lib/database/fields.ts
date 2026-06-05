import type { DatabaseField } from "@/lib/utils/types";
import {
  DATABASE_CREATED_TIME_FIELD,
  DATABASE_LAST_EDITED_TIME_FIELD,
  DATABASE_UNIQUE_ID_FIELD,
} from "@/lib/database/systemFields";

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

export function buildFieldConfig(fieldType: string, optionsText: string) {
  return isSelectLikeFieldType(fieldType)
    ? JSON.stringify({ options: parseSelectOptions(optionsText) })
    : null;
}
