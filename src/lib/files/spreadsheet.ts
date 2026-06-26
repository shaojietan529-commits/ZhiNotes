"use client";

import {
  addField,
  addRow,
  createDatabase,
  deleteDatabaseWithCloud,
  deleteRowWithCloud,
  updateField,
} from "@/lib/database/cloudDatabaseMutations";
import { getFields, getRows } from "@/lib/db/local/queries";
import { dataUrlToArrayBuffer } from "@/lib/files/dataUrl";
import type { StoredPageFile } from "@/lib/files/localStore";

export const SPREADSHEET_DATABASE_ROW_LIMIT = 500;
export const SPREADSHEET_DATABASE_COLUMN_LIMIT = 50;

type SpreadsheetCell = string | number | boolean | null;
type SpreadsheetFieldType = "text" | "number" | "date" | "checkbox" | "url";

export interface SpreadsheetTable {
  sheetName: string;
  headers: string[];
  rows: SpreadsheetCell[][];
}

export interface SpreadsheetDatabaseImportResult {
  database_id: string;
  database_title: string;
  sheet_name: string;
  rows_available: number;
  rows_imported: number;
  columns_imported: number;
  truncated_rows: boolean;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function convertSpreadsheetToHtml(file: StoredPageFile) {
  const XLSX = await import("xlsx");
  const { input, options } = await getSpreadsheetInput(file);
  const workbook = XLSX.read(input, {
    type: typeof input === "string" ? "string" : "array",
    ...options,
  });

  if (workbook.SheetNames.length === 0) {
    return "<p>这个表格文件没有工作表。</p>";
  }

  const renderedSheets = workbook.SheetNames.slice(0, 5).map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(
      worksheet,
      {
        header: 1,
        blankrows: false,
        raw: false,
      }
    );
    const visibleRows = rows.slice(0, 200);
    const visibleColumnCount = Math.max(
      1,
      Math.min(
        50,
        visibleRows.reduce((max, row) => Math.max(max, row.length), 0)
      )
    );

    if (visibleRows.length === 0) {
      return `<section><h2>${escapeHtml(sheetName)}</h2><p>这个工作表为空。</p></section>`;
    }

    const headerRow = visibleRows[0] ?? [];
    const bodyRows = visibleRows.slice(1);
    const headerCells = Array.from({ length: visibleColumnCount }, (_value, index) => {
      const value = String(headerRow[index] ?? "").trim() || `列 ${index + 1}`;
      return `<th scope="col">${escapeHtml(value)}</th>`;
    }).join("");
    const tableRows =
      bodyRows.length > 0
        ? bodyRows
            .map((row) => {
              const cells = Array.from(
                { length: visibleColumnCount },
                (_value, index) => `<td>${escapeHtml(String(row[index] ?? ""))}</td>`
              ).join("");
              return `<tr>${cells}</tr>`;
            })
            .join("")
        : `<tr><td colspan="${visibleColumnCount}">这个工作表没有数据行。</td></tr>`;
    const summary = `<p><small>工作表预览：共 ${rows.length} 行，显示 ${visibleRows.length} 行、${visibleColumnCount} 列。</small></p>`;

    const truncated =
      rows.length > visibleRows.length
        ? `<p><small>仅显示前 ${visibleRows.length} 行。</small></p>`
        : "";

    return `<section><h2>${escapeHtml(sheetName)}</h2>${summary}${truncated}<table><thead>${headerCells}</thead><tbody>${tableRows}</tbody></table></section>`;
  });

  const sheetNotice =
    workbook.SheetNames.length > 5
      ? `<p><small>仅显示 ${workbook.SheetNames.length} 个工作表中的前 5 个。</small></p>`
      : "";

  return `${sheetNotice}${renderedSheets.join("\n")}`;
}

export async function readSpreadsheetTable(file: StoredPageFile): Promise<SpreadsheetTable> {
  const XLSX = await import("xlsx");
  const { input, options } = await getSpreadsheetInput(file);
  const workbook = XLSX.read(input, {
    type: typeof input === "string" ? "string" : "array",
    ...options,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("这个表格文件没有可导入的工作表。");
  }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<SpreadsheetCell>>(worksheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: "",
    });
    const normalizedRows = rows
      .map((row) => row.map(normalizeSpreadsheetCell))
      .filter((row) => row.some((cell) => stringifySpreadsheetCell(cell).trim()));

    if (normalizedRows.length === 0) continue;

    const columnCount = Math.min(
      SPREADSHEET_DATABASE_COLUMN_LIMIT,
      normalizedRows.reduce((max, row) => Math.max(max, row.length), 0)
    );
    const headers = dedupeSpreadsheetHeaders(
      Array.from({ length: columnCount }, (_value, index) => {
        const header = stringifySpreadsheetCell(normalizedRows[0][index]).trim();
        return header || `列 ${index + 1}`;
      })
    );
    const dataRows = normalizedRows
      .slice(1)
      .map((row) =>
        Array.from({ length: columnCount }, (_value, index) =>
          normalizeSpreadsheetCell(row[index] ?? "")
        )
      )
      .filter((row) => row.some((cell) => stringifySpreadsheetCell(cell).trim()));

    return { sheetName, headers, rows: dataRows };
  }

  throw new Error("这个表格文件不包含可见行。");
}

export async function importSpreadsheetAsDatabase(
  file: StoredPageFile
): Promise<SpreadsheetDatabaseImportResult> {
  const table = await readSpreadsheetTable(file);
  if (table.rows.length === 0) {
    throw new Error("这个表格没有可导入的数据行。第一个非空行会被当作表头。");
  }

  const importedRows = table.rows.slice(0, SPREADSHEET_DATABASE_ROW_LIMIT);
  const databaseTitle = spreadsheetDatabaseTitle(file.name);
  let databaseId: string | null = null;

  try {
    const database = await createDatabase({ title: databaseTitle });
    databaseId = database.id;
    const fields = await getFields(database.id);
    const nameField = fields[0];
    if (nameField) {
      await updateField(nameField.id, { name: table.headers[0] || "名称" });
    }

    const dataFields = [];
    for (let columnIndex = 1; columnIndex < table.headers.length; columnIndex += 1) {
      const values = importedRows.map((row) => stringifySpreadsheetCell(row[columnIndex]));
      const fieldType = inferSpreadsheetFieldType(values);
      const field = await addField(database.id, {
        name: table.headers[columnIndex],
        fieldType,
      });
      dataFields.push({ field, columnIndex, fieldType });
    }

    for (let rowIndex = 0; rowIndex < importedRows.length; rowIndex += 1) {
      const row = importedRows[rowIndex];
      const title = stringifySpreadsheetCell(row[0]).trim() || `第 ${rowIndex + 1} 行`;
      const fieldValues: Record<string, unknown> = {};

      for (const { field, columnIndex, fieldType } of dataFields) {
        const value = coerceSpreadsheetFieldValue(
          stringifySpreadsheetCell(row[columnIndex]),
          fieldType
        );
        if (value !== "" && value !== null) {
          fieldValues[field.id] = value;
        }
      }

      await addRow(database.id, { title, fieldValues });
    }

    return {
      database_id: database.id,
      database_title: databaseTitle,
      sheet_name: table.sheetName,
      rows_available: table.rows.length,
      rows_imported: importedRows.length,
      columns_imported: table.headers.length,
      truncated_rows: table.rows.length > importedRows.length,
    };
  } catch (err) {
    if (databaseId) await rollbackSpreadsheetDatabase(databaseId);
    throw err;
  }
}

export async function rollbackSpreadsheetDatabase(databaseId: string): Promise<number> {
  let deletedRows = 0;
  try {
    const rows = await getRows(databaseId, { includePageContent: false });
    for (const row of [...rows].reverse()) {
      await deleteRowWithCloud(row.id);
      deletedRows += 1;
    }
  } finally {
    await deleteDatabaseWithCloud(databaseId);
  }
  return deletedRows;
}

async function getSpreadsheetInput(file: StoredPageFile) {
  const lowerName = file.name.toLowerCase();
  if (
    (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) &&
    file.textContent
  ) {
    return {
      input: file.textContent,
      options: lowerName.endsWith(".tsv") ? { FS: "\t" } : {},
    };
  }

  return { input: await dataUrlToArrayBuffer(file.dataUrl), options: {} };
}

function normalizeSpreadsheetCell(value: unknown): SpreadsheetCell {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function stringifySpreadsheetCell(value: SpreadsheetCell | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function dedupeSpreadsheetHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `列 ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function inferSpreadsheetFieldType(values: string[]): SpreadsheetFieldType {
  const nonEmpty = values.map((value) => value.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every(isBooleanValue)) return "checkbox";
  if (nonEmpty.every(isIsoDateValue)) return "date";
  if (nonEmpty.every(isNumberValue)) return "number";
  if (nonEmpty.every(isUrlValue)) return "url";
  return "text";
}

function coerceSpreadsheetFieldValue(value: string, fieldType: SpreadsheetFieldType) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (fieldType === "checkbox") return parseBooleanValue(trimmed);
  if (fieldType === "date") return normalizeDateValue(trimmed);
  if (fieldType === "number") return Number(trimmed.replace(/,/g, ""));

  return trimmed;
}

function isBooleanValue(value: string) {
  return /^(true|false|yes|no|y|n|1|0)$/i.test(value.trim());
}

function parseBooleanValue(value: string) {
  return /^(true|yes|y|1)$/i.test(value.trim());
}

function isIsoDateValue(value: string) {
  return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value.trim());
}

function normalizeDateValue(value: string) {
  const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isNumberValue(value: string) {
  return /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(value.trim());
}

function isUrlValue(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export function spreadsheetDatabaseTitle(fileName: string) {
  const title = fileName.replace(/\.[^.]+$/, "").trim();
  return title ? `${title} 数据库` : "导入的表格数据库";
}
