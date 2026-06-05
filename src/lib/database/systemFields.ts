import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";

export const DATABASE_CREATED_TIME_FIELD = "created_time";
export const DATABASE_LAST_EDITED_TIME_FIELD = "last_edited_time";

type RowWithOptionalPage = DatabaseRow & { page?: Page | null };

export function isDatabaseSystemFieldType(fieldType: string) {
  return (
    fieldType === DATABASE_CREATED_TIME_FIELD ||
    fieldType === DATABASE_LAST_EDITED_TIME_FIELD
  );
}

export function isDatabaseSystemField(field: Pick<DatabaseField, "field_type">) {
  return isDatabaseSystemFieldType(field.field_type);
}

export function getDatabaseSystemFieldValue(
  row: RowWithOptionalPage,
  field: Pick<DatabaseField, "field_type">
) {
  if (field.field_type === DATABASE_CREATED_TIME_FIELD) {
    return row.page?.created_at || row.created_at;
  }
  if (field.field_type === DATABASE_LAST_EDITED_TIME_FIELD) {
    return row.page?.updated_at || row.updated_at;
  }
  return "";
}

export function getDatabaseSystemFieldDateKey(
  row: RowWithOptionalPage,
  field: Pick<DatabaseField, "field_type">
) {
  const value = getDatabaseSystemFieldValue(row, field);
  return value ? value.slice(0, 10) : "";
}
