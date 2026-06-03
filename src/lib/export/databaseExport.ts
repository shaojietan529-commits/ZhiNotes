"use client";

import type { Database, DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import { stringifyRelationValue } from "@/lib/database/relationValues";
import { downloadTextFile } from "./pageExport";

type RowWithPage = DatabaseRow & { page: Page };

export function exportDatabaseAsCsv(
  database: Database,
  fields: DatabaseField[],
  rows: RowWithPage[],
  relationPages: Page[] = []
) {
  const header = fields.map((field) => getDatabaseFieldDisplayName(field));
  const csvRows = rows.map((row) => {
    const values = parseFieldValues(row.field_values);
    return fields.map((field, index) => {
      if (index === 0) return row.page?.title || "";
      return stringifyCell(values[field.id], field, relationPages);
    });
  });

  const csv = [header, ...csvRows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  downloadTextFile(
    `${safeFileName(database.title || "数据库")}.csv`,
    "text/csv;charset=utf-8",
    csv
  );
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringifyCell(value: unknown, field: DatabaseField, relationPages: Page[]) {
  if (value === null || value === undefined) return "";
  if (field.field_type === "relation") {
    return stringifyRelationValue(value, relationPages);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\w\s.-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "数据库"
  );
}
