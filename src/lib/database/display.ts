import type { DatabaseField, DatabaseView } from "@/lib/utils/types";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "文本",
  number: "数字",
  relation: "关联",
  select: "单选",
  multi_select: "多选",
  status: "状态",
  date: "日期",
  checkbox: "复选框",
  url: "链接",
  email: "邮箱",
  phone: "电话",
  created_time: "创建时间",
  last_edited_time: "最后编辑时间",
};

const VIEW_TYPE_LABELS: Record<DatabaseView["view_type"], string> = {
  table: "表格",
  list: "列表",
  kanban: "看板",
  calendar: "日历",
  gallery: "画廊",
  timeline: "时间线",
  chart: "图表",
  form: "表单",
  feed: "动态",
};

export function getDatabaseFieldTypeLabel(fieldType: string) {
  return FIELD_TYPE_LABELS[fieldType] ?? fieldType;
}

export function getDatabaseFieldDisplayName(field: DatabaseField) {
  if (field.position === 0 && field.name === "Name") {
    return "名称";
  }
  return field.name;
}

export function getDatabaseViewTypeLabel(viewType: DatabaseView["view_type"]) {
  return VIEW_TYPE_LABELS[viewType];
}

export function getDatabaseViewDisplayName(view: DatabaseView) {
  if (view.position === 0 && view.view_type === "table" && view.name === "Table") {
    return "表格";
  }
  return view.name;
}
