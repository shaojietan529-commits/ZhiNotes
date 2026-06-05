import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";

export const DATABASE_CREATED_TIME_FIELD = "created_time";
export const DATABASE_LAST_EDITED_TIME_FIELD = "last_edited_time";
export const DATABASE_UNIQUE_ID_FIELD = "unique_id";

type RowWithOptionalPage = DatabaseRow & { page?: Page | null };

export function isDatabaseSystemFieldType(fieldType: string) {
  return isDatabaseSystemTimeFieldType(fieldType) || fieldType === DATABASE_UNIQUE_ID_FIELD;
}

export function isDatabaseSystemTimeFieldType(fieldType: string) {
  return (
    fieldType === DATABASE_CREATED_TIME_FIELD ||
    fieldType === DATABASE_LAST_EDITED_TIME_FIELD
  );
}

export function isDatabaseSystemField(field: Pick<DatabaseField, "field_type">) {
  return isDatabaseSystemFieldType(field.field_type);
}

export function isDatabaseSystemTimeField(
  field: Pick<DatabaseField, "field_type">
) {
  return isDatabaseSystemTimeFieldType(field.field_type);
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
  if (field.field_type === DATABASE_UNIQUE_ID_FIELD) {
    return formatDatabaseUniqueRowId(row.id);
  }
  return "";
}

export function getDatabaseSystemFieldDateKey(
  row: RowWithOptionalPage,
  field: Pick<DatabaseField, "field_type">
) {
  if (!isDatabaseSystemTimeField(field)) return "";
  const value = getDatabaseSystemFieldValue(row, field);
  return value ? value.slice(0, 10) : "";
}

function formatDatabaseUniqueRowId(rowId: string) {
  const stableSuffix = rowId.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return `ZN-${stableSuffix.toUpperCase() || "ROW"}`;
}
