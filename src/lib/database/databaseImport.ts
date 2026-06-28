"use client";

import { addField, addRow } from "@/lib/database/cloudDatabaseMutations";
import {
  DATABASE_DIRECT_IMPORT_COLUMN_LIMIT,
  DATABASE_DIRECT_IMPORT_ROW_LIMIT,
} from "@/lib/database/databaseImportLimits";
import { isDatabaseSystemFieldType } from "@/lib/database/systemFields";
import { formatFileSize } from "@/lib/files/localStore";
import type { DatabaseField } from "@/lib/utils/types";

export type DatabaseImportFieldType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "multi_select"
  | "formula"
  | "rollup"
  | "created_time"
  | "last_edited_time"
  | "unique_id";

type SpreadsheetCell = string | number | boolean | null;

export interface DatabaseImportColumnPlan {
  source_header: string;
  target_field_id: string | null;
  target_field_name: string;
  target_field_type: DatabaseImportFieldType;
  target_status: "title-field" | "existing-field" | "new-field";
  source_column_index: number;
}

export interface DatabaseImportRowDraft {
  title: string;
  field_values: Record<string, string | number | boolean | string[]>;
}

export interface DatabaseImportPreview {
  format: "zhinote-database-direct-import-preview";
  format_version: 1;
  preview_status: "local-spreadsheet-values-preview";
  source: {
    file_name: string;
    mime_type: string;
    size_bytes: number;
    size_label: string;
    sheet_name: string;
    truncated_rows: boolean;
    truncated_columns: boolean;
  };
  boundary: {
    local_preview_only: true;
    reads_selected_file_values: true;
    writes_workspace_data: false;
    uploads_data: false;
    calls_external_service: false;
    enables_ai: false;
    requires_typed_confirmation_before_write: true;
  };
  summary: {
    source_columns: number;
    planned_columns: number;
    rows_available: number;
    rows_planned: number;
    existing_fields_matched: number;
    new_fields_planned: number;
  };
  columns: DatabaseImportColumnPlan[];
  rows: DatabaseImportRowDraft[];
}

export interface DatabaseImportReceipt {
  format: "zhinote-database-direct-import-receipt";
  format_version: 1;
  receipt_status: "local-database-import-metadata-only";
  created_at: string;
  required_phrase: string;
  typed_phrase_matches: boolean;
  privacy_note: string;
  source: {
    file_name_included: false;
    file_extension: string;
    mime_type: string;
    size_bytes: number;
    size_label: string;
    sheet_name: string;
  };
  write_summary: {
    database_id: string;
    rows_written: number;
    fields_created: number;
    fields_matched: number;
  };
  boundary: {
    local_receipt_only: true;
    includes_file_name: false;
    includes_file_bytes: false;
    includes_file_text: false;
    includes_spreadsheet_cell_values: false;
    uploads_data: false;
    calls_external_service: false;
    enables_ai: false;
    writes_workspace_data: true;
  };
}

export async function buildDatabaseImportPreview(
  file: File,
  fields: DatabaseField[]
): Promise<DatabaseImportPreview> {
  const XLSX = await import("xlsx");
  const lowerName = file.name.toLowerCase();
  const isDelimited = lowerName.endsWith(".csv") || lowerName.endsWith(".tsv");
  const input = isDelimited ? await file.text() : await file.arrayBuffer();
  const workbook = XLSX.read(input, {
    type: typeof input === "string" ? "string" : "array",
    ...(lowerName.endsWith(".tsv") ? { FS: "\t" } : {}),
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("这个表格文件没有可导入的工作表。");
  }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Array<SpreadsheetCell>>(worksheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: "",
    });
    const normalizedRows = rawRows
      .map((row) => row.map(normalizeSpreadsheetCell))
      .filter((row) => row.some((cell) => stringifyCell(cell).trim()));

    if (normalizedRows.length === 0) continue;

    const sourceColumnCount = normalizedRows.reduce(
      (max, row) => Math.max(max, row.length),
      0
    );
    const columnCount = Math.min(
      DATABASE_DIRECT_IMPORT_COLUMN_LIMIT,
      sourceColumnCount
    );
    const headers = dedupeHeaders(
      Array.from({ length: columnCount }, (_value, index) => {
        const header = stringifyCell(normalizedRows[0][index]).trim();
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
      .filter((row) => row.some((cell) => stringifyCell(cell).trim()));
    const plannedRows = dataRows.slice(0, DATABASE_DIRECT_IMPORT_ROW_LIMIT);
    const columns = buildColumnPlans(headers, plannedRows, fields);

    return {
      format: "zhinote-database-direct-import-preview",
      format_version: 1,
      preview_status: "local-spreadsheet-values-preview",
      source: {
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        size_label: formatFileSize(file.size),
        sheet_name: sheetName,
        truncated_rows: dataRows.length > plannedRows.length,
        truncated_columns: sourceColumnCount > columnCount,
      },
      boundary: {
        local_preview_only: true,
        reads_selected_file_values: true,
        writes_workspace_data: false,
        uploads_data: false,
        calls_external_service: false,
        enables_ai: false,
        requires_typed_confirmation_before_write: true,
      },
      summary: {
        source_columns: sourceColumnCount,
        planned_columns: columns.length,
        rows_available: dataRows.length,
        rows_planned: plannedRows.length,
        existing_fields_matched: columns.filter(
          (column) => column.target_status === "existing-field"
        ).length,
        new_fields_planned: columns.filter(
          (column) => column.target_status === "new-field"
        ).length,
      },
      columns,
      rows: plannedRows.map((row) => buildRowDraft(row, columns)),
    };
  }

  throw new Error("这个表格文件不包含可见行。");
}

export async function applyDatabaseImportPreview(
  databaseId: string,
  preview: DatabaseImportPreview,
  requiredPhrase: string,
  typedPhrase: string
): Promise<DatabaseImportReceipt> {
  const typedPhraseMatches = typedPhrase.trim() === requiredPhrase.trim();
  if (!typedPhraseMatches) {
    throw new Error(`请输入确认短语 ${requiredPhrase} 后再导入当前数据库。`);
  }

  const fieldIdBySourceColumnIndex = new Map<number, string>();
  let fieldsCreated = 0;
  let fieldsMatched = 0;

  for (const column of preview.columns) {
    if (column.target_status === "title-field") continue;

    if (isDatabaseImportReadOnlyFieldType(column.target_field_type)) {
      if (column.target_field_id) fieldsMatched += 1;
      continue;
    }

    if (column.target_field_id) {
      fieldIdBySourceColumnIndex.set(
        column.source_column_index,
        column.target_field_id
      );
      fieldsMatched += 1;
      continue;
    }

    const field = await addField(databaseId, {
      name: column.target_field_name,
      fieldType: column.target_field_type,
    });
    fieldIdBySourceColumnIndex.set(column.source_column_index, field.id);
    fieldsCreated += 1;
  }

  for (const row of preview.rows) {
    const fieldValues: Record<string, unknown> = {};
    for (const column of preview.columns) {
      if (column.target_status === "title-field") continue;
      if (isDatabaseImportReadOnlyFieldType(column.target_field_type)) continue;
      const fieldId = fieldIdBySourceColumnIndex.get(column.source_column_index);
      const value = row.field_values[String(column.source_column_index)];
      if (fieldId && value !== "" && value !== null && value !== undefined) {
        fieldValues[fieldId] = value;
      }
    }
    await addRow(databaseId, {
      title: row.title || "未命名导入行",
      fieldValues,
    });
  }

  return {
    format: "zhinote-database-direct-import-receipt",
    format_version: 1,
    receipt_status: "local-database-import-metadata-only",
    created_at: new Date().toISOString(),
    required_phrase: requiredPhrase,
    typed_phrase_matches: true,
    privacy_note:
      "Generated locally after importing a spreadsheet into the current database. This receipt records metadata only and does not include file names, file bytes, file text, spreadsheet cell values, page body text, tokens, credentials, prompts, cloud data, or AI output.",
    source: {
      file_name_included: false,
      file_extension: getSafeExtension(preview.source.file_name),
      mime_type: preview.source.mime_type,
      size_bytes: preview.source.size_bytes,
      size_label: preview.source.size_label,
      sheet_name: preview.source.sheet_name,
    },
    write_summary: {
      database_id: databaseId,
      rows_written: preview.rows.length,
      fields_created: fieldsCreated,
      fields_matched: fieldsMatched,
    },
    boundary: {
      local_receipt_only: true,
      includes_file_name: false,
      includes_file_bytes: false,
      includes_file_text: false,
      includes_spreadsheet_cell_values: false,
      uploads_data: false,
      calls_external_service: false,
      enables_ai: false,
      writes_workspace_data: true,
    },
  };
}

function buildColumnPlans(
  headers: string[],
  dataRows: SpreadsheetCell[][],
  fields: DatabaseField[]
): DatabaseImportColumnPlan[] {
  const fieldsByName = new Map(
    fields.map((field) => [normalizeName(field.name), field])
  );

  return headers.map((header, index) => {
    if (index === 0) {
      const titleField = fields[0] ?? null;
      return {
        source_header: header,
        target_field_id: titleField?.id ?? null,
        target_field_name: titleField?.name ?? "名称",
        target_field_type: "text",
        target_status: "title-field",
        source_column_index: index,
      };
    }

    const existingField = fieldsByName.get(normalizeName(header));
    const values = dataRows.map((row) => stringifyCell(row[index]));
    const inferredType = inferFieldType(values);

    return {
      source_header: header,
      target_field_id: existingField?.id ?? null,
      target_field_name: existingField?.name ?? header,
      target_field_type: coerceFieldType(
        existingField?.field_type ?? inferredType
      ),
      target_status: existingField ? "existing-field" : "new-field",
      source_column_index: index,
    };
  });
}

function buildRowDraft(
  row: SpreadsheetCell[],
  columns: DatabaseImportColumnPlan[]
): DatabaseImportRowDraft {
  const titleColumn = columns[0];
  const title = stringifyCell(row[titleColumn.source_column_index]).trim();
  const fieldValues: DatabaseImportRowDraft["field_values"] = {};

  for (const column of columns.slice(1)) {
    if (isDatabaseImportReadOnlyFieldType(column.target_field_type)) continue;
    const rawValue = stringifyCell(row[column.source_column_index]);
    const value = coerceFieldValue(rawValue, column.target_field_type);
    if (value !== "" && value !== null) {
      fieldValues[String(column.source_column_index)] = value;
    }
  }

  return {
    title: title || "未命名导入行",
    field_values: fieldValues,
  };
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
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function stringifyCell(value: SpreadsheetCell | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function dedupeHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `列 ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function inferFieldType(values: string[]): DatabaseImportFieldType {
  const nonEmpty = values.map((value) => value.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every(isBooleanValue)) return "checkbox";
  if (nonEmpty.every(isIsoDateValue)) return "date";
  if (nonEmpty.every(isUrlValue)) return "url";
  if (nonEmpty.every(isEmailValue)) return "email";
  if (nonEmpty.every(isPhoneValue)) return "phone";
  if (nonEmpty.every(isNumberValue)) return "number";
  return "text";
}

function coerceFieldType(fieldType: string): DatabaseImportFieldType {
  if (
    fieldType === "number" ||
    fieldType === "date" ||
    fieldType === "checkbox" ||
    fieldType === "url" ||
    fieldType === "email" ||
    fieldType === "phone" ||
    fieldType === "multi_select" ||
    fieldType === "formula" ||
    fieldType === "rollup"
  ) {
    return fieldType;
  }
  if (isDatabaseSystemFieldType(fieldType)) {
    return fieldType as DatabaseImportFieldType;
  }
  return "text";
}

function coerceFieldValue(
  value: string,
  fieldType: DatabaseImportFieldType
): string | number | boolean | string[] | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (fieldType === "checkbox") return parseBooleanValue(trimmed);
  if (fieldType === "date") return normalizeDateValue(trimmed);
  if (fieldType === "number") return Number(trimmed.replace(/,/g, ""));
  if (fieldType === "multi_select") return parseMultiSelectValue(trimmed);
  return trimmed;
}

function isDatabaseImportReadOnlyFieldType(fieldType: string) {
  return (
    fieldType === "formula" ||
    fieldType === "rollup" ||
    isDatabaseSystemFieldType(fieldType)
  );
}

function isBooleanValue(value: string) {
  return /^(true|false|yes|no|y|n|1|0)$/i.test(value.trim());
}

function parseBooleanValue(value: string) {
  return /^(true|yes|y|1)$/i.test(value.trim());
}

function parseMultiSelectValue(value: string) {
  return value
    .split(/[,;；，]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function isEmailValue(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPhoneValue(value: string) {
  const trimmed = value.trim();
  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  return digitCount >= 7 && /[+()\-\s.]/.test(trimmed) && /^[+()\-\s.\d]+$/.test(trimmed);
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getSafeExtension(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop() ?? fileName;
  const lastDot = baseName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === baseName.length - 1) return "";
  return baseName.slice(lastDot).toLowerCase();
}
