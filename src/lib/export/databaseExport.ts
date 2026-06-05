"use client";

import type { Database, DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import { evaluateDatabaseFormula } from "@/lib/database/formula";
import { stringifyMultiSelectValue } from "@/lib/database/multiSelectValues";
import { stringifyRelationValue } from "@/lib/database/relationValues";
import {
  getDatabaseSystemFieldValue,
  isDatabaseSystemField,
} from "@/lib/database/systemFields";
import { downloadTextFile } from "./pageExport";

type RowWithPage = DatabaseRow & { page: Page };

export function exportDatabaseAsCsv(
  database: Database,
  fields: DatabaseField[],
  rows: RowWithPage[],
  relationPages: Page[] = []
) {
  const table = buildDatabaseExportTable(fields, rows, relationPages);
  const csv = table
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  downloadTextFile(
    `${safeFileName(database.title || "数据库")}.csv`,
    "text/csv;charset=utf-8",
    csv
  );
}

export async function exportDatabaseAsXlsx(
  database: Database,
  fields: DatabaseField[],
  rows: RowWithPage[],
  relationPages: Page[] = []
) {
  const XLSX = await import("xlsx");
  const table = buildDatabaseExportTable(fields, rows, relationPages);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(table);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    safeSheetName(database.title || "Rows")
  );
  XLSX.writeFile(workbook, `${safeFileName(database.title || "数据库")}.xlsx`, {
    compression: true,
  });
}

function buildDatabaseExportTable(
  fields: DatabaseField[],
  rows: RowWithPage[],
  relationPages: Page[]
) {
  const header = fields.map((field) => getDatabaseFieldDisplayName(field));
  const body = rows.map((row) => {
    const values = parseFieldValues(row.field_values);
    return fields.map((field, index) => {
      if (index === 0) return row.page?.title || "";
      if (isDatabaseSystemField(field)) {
        return getDatabaseSystemFieldValue(row, field);
      }
      if (field.field_type === "formula") {
        return evaluateDatabaseFormula(field, fields, row, values).label;
      }
      return stringifyCell(values[field.id], field, relationPages);
    });
  });

  return [header, ...body];
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
  if (field.field_type === "multi_select") {
    return stringifyMultiSelectValue(value);
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

function safeSheetName(value: string) {
  return (
    value
      .trim()
      .replace(/[:\\/?*[\]]/g, "")
      .slice(0, 31) || "Rows"
  );
}
