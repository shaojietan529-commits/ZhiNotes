import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import { getDatabaseFormulaExpression } from "@/lib/database/fields";
import { formatDatabaseNumberValue } from "@/lib/database/numberValues";
import { getDatabaseSystemFieldValue } from "@/lib/database/systemFields";

export type DatabaseFormulaStatus =
  | "empty"
  | "ready"
  | "missing-field"
  | "invalid-value"
  | "invalid-expression";

export interface DatabaseFormulaResult {
  status: DatabaseFormulaStatus;
  value: number | null;
  label: string;
  detail: string;
}

export function evaluateDatabaseFormula(
  field: DatabaseField,
  fields: DatabaseField[],
  row: DatabaseRow & { page?: Page | null },
  fieldValues: Record<string, unknown>
): DatabaseFormulaResult {
  const formula = getDatabaseFormulaExpression(field);
  if (!formula) {
    return {
      status: "empty",
      value: null,
      label: "未配置公式",
      detail: "在字段设置里用 {字段名} 引用同一行数字字段。",
    };
  }

  const referencedFieldNames: string[] = [];
  const expression = formula.replace(
    /\{([^{}]+)}/g,
    (_match: string, rawName: string) => {
      const fieldName = rawName.trim();
      referencedFieldNames.push(fieldName);
      const referencedField = findFormulaField(fieldName, fields);
      if (!referencedField || referencedField.id === field.id) {
        return "NaN";
      }
      const rawValue = getFormulaFieldRawValue(referencedField, row, fieldValues);
      const numberValue = toFormulaNumber(rawValue);
      return Number.isFinite(numberValue) ? String(numberValue) : "NaN";
    }
  );

  if (referencedFieldNames.length === 0) {
    return {
      status: "invalid-expression",
      value: null,
      label: "公式需要字段引用",
      detail: "请使用 {字段名} 引用同一行已有字段。",
    };
  }

  if (expression.includes("NaN")) {
    return {
      status: hasMissingFormulaField(referencedFieldNames, fields, field.id)
        ? "missing-field"
        : "invalid-value",
      value: null,
      label: "公式无法计算",
      detail: "请检查引用字段是否存在，并确认引用值可以转为数字。",
    };
  }

  const value = evaluateArithmeticExpression(expression);
  if (!Number.isFinite(value)) {
    return {
      status: "invalid-expression",
      value: null,
      label: "公式错误",
      detail: "仅支持数字、括号和 + - * / 基础四则运算。",
    };
  }

  return {
    status: "ready",
    value,
    label: formatDatabaseNumberValue(value, field) || String(value),
    detail: formula,
  };
}

function findFormulaField(fieldName: string, fields: DatabaseField[]) {
  const normalizedName = normalizeFormulaFieldName(fieldName);
  return fields.find(
    (field) =>
      normalizeFormulaFieldName(field.name) === normalizedName ||
      normalizeFormulaFieldName(getDatabaseFieldDisplayName(field)) ===
        normalizedName
  );
}

function hasMissingFormulaField(
  fieldNames: string[],
  fields: DatabaseField[],
  formulaFieldId: string
) {
  return fieldNames.some((fieldName) => {
    const field = findFormulaField(fieldName, fields);
    return !field || field.id === formulaFieldId;
  });
}

function normalizeFormulaFieldName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function getFormulaFieldRawValue(
  field: DatabaseField,
  row: DatabaseRow & { page?: Page | null },
  fieldValues: Record<string, unknown>
) {
  if (field.position === 0) return row.page?.title ?? "";
  if (
    field.field_type === "created_time" ||
    field.field_type === "last_edited_time" ||
    field.field_type === "unique_id"
  ) {
    return getDatabaseSystemFieldValue(row, field);
  }
  return fieldValues[field.id];
}

function toFormulaNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || value === undefined || value === "") return 0;
  const numericText = String(value).replace(/[,%$¥x倍]/g, "").trim();
  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function evaluateArithmeticExpression(expression: string) {
  const normalized = expression.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(normalized)) return Number.NaN;

  const tokens = tokenizeArithmeticExpression(normalized);
  if (!tokens.length) return Number.NaN;
  const output: string[] = [];
  const operators: string[] = [];

  for (const token of tokens) {
    if (isNumberToken(token)) {
      output.push(token);
      continue;
    }
    if (isOperatorToken(token)) {
      while (
        operators.length > 0 &&
        isOperatorToken(operators[operators.length - 1]) &&
        precedence(operators[operators.length - 1]) >= precedence(token)
      ) {
        output.push(operators.pop() ?? "");
      }
      operators.push(token);
      continue;
    }
    if (token === "(") {
      operators.push(token);
      continue;
    }
    if (token === ")") {
      while (operators.length > 0 && operators[operators.length - 1] !== "(") {
        output.push(operators.pop() ?? "");
      }
      if (operators.pop() !== "(") return Number.NaN;
    }
  }

  while (operators.length > 0) {
    const operator = operators.pop() ?? "";
    if (operator === "(" || operator === ")") return Number.NaN;
    output.push(operator);
  }

  return evaluateReversePolish(output);
}

function tokenizeArithmeticExpression(expression: string) {
  const tokens: string[] = [];
  let cursor = 0;
  let previousToken = "";

  while (cursor < expression.length) {
    const char = expression[cursor];
    const isUnaryMinus =
      char === "-" &&
      (!previousToken || previousToken === "(" || isOperatorToken(previousToken));
    if (/\d|\./.test(char) || isUnaryMinus) {
      const start = cursor;
      cursor += 1;
      while (cursor < expression.length && /[\d.]/.test(expression[cursor])) {
        cursor += 1;
      }
      const token = expression.slice(start, cursor);
      tokens.push(token);
      previousToken = token;
      continue;
    }
    if (isOperatorToken(char) || char === "(" || char === ")") {
      tokens.push(char);
      previousToken = char;
      cursor += 1;
      continue;
    }
    return [];
  }

  return tokens;
}

function evaluateReversePolish(tokens: string[]) {
  const stack: number[] = [];
  for (const token of tokens) {
    if (isNumberToken(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) return Number.NaN;
      stack.push(value);
      continue;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) return Number.NaN;
    if (token === "+") stack.push(left + right);
    if (token === "-") stack.push(left - right);
    if (token === "*") stack.push(left * right);
    if (token === "/") stack.push(right === 0 ? Number.NaN : left / right);
  }
  return stack.length === 1 ? stack[0] : Number.NaN;
}

function isNumberToken(token: string) {
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(token);
}

function isOperatorToken(token: string) {
  return token === "+" || token === "-" || token === "*" || token === "/";
}

function precedence(operator: string) {
  return operator === "*" || operator === "/" ? 2 : 1;
}
