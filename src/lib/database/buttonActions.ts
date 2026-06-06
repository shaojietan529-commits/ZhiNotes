// Pure, local, low-risk action runner for database "button" fields.
//
// Notion database buttons can run automations. ZhiNotes keeps this strictly
// local and reversible: a button may only set fields ON THE SAME ROW
// (status/select, checkbox, date), and every run produces an undo snapshot so
// the click can be reverted. This module is pure — it computes the next field
// values and the undo values but performs no writes, no uploads, and no AI.
//
// Backward compatible: a button with no configured actions yields no changes,
// preserving the existing preview-only behavior.

import type { DatabaseField } from "@/lib/utils/types";
import { isSelectLikeFieldType } from "./fields";

export type ButtonActionOperation =
  | "set-select"
  | "set-checkbox"
  | "toggle-checkbox"
  | "set-date-today"
  | "clear-field";

export interface ButtonAction {
  targetFieldId: string;
  operation: ButtonActionOperation;
  /** Option value for set-select; "true"/"false" for set-checkbox. */
  value?: string;
}

export interface ButtonActionStep {
  targetFieldId: string;
  targetFieldName: string;
  operation: ButtonActionOperation;
  fromValue: unknown;
  toValue: unknown;
  applied: boolean;
  skipReason?: string;
}

export interface ButtonActionResult {
  next_values: Record<string, unknown>;
  /** Prior value of each field that actually changed (for undo). */
  undo_values: Record<string, unknown>;
  steps: ButtonActionStep[];
  changed_field_ids: string[];
  has_changes: boolean;
}

const VALID_OPERATIONS: ButtonActionOperation[] = [
  "set-select",
  "set-checkbox",
  "toggle-checkbox",
  "set-date-today",
  "clear-field",
];

export function isButtonActionOperation(
  value: unknown
): value is ButtonActionOperation {
  return (
    typeof value === "string" &&
    VALID_OPERATIONS.includes(value as ButtonActionOperation)
  );
}

/** Parse the (optional) action list from a button field's JSON config. */
export function getButtonActions(
  field: Pick<DatabaseField, "config">
): ButtonAction[] {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    const raw = config.buttonActions;
    if (!Array.isArray(raw)) return [];
    const actions: ButtonAction[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const targetFieldId =
        typeof entry.targetFieldId === "string" ? entry.targetFieldId : "";
      const operation = entry.operation;
      if (!targetFieldId || !isButtonActionOperation(operation)) continue;
      actions.push({
        targetFieldId,
        operation,
        value: typeof entry.value === "string" ? entry.value : undefined,
      });
    }
    return actions;
  } catch {
    return [];
  }
}

function todayDateString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function operationAllowed(
  operation: ButtonActionOperation,
  fieldType: string
): boolean {
  switch (operation) {
    case "set-select":
      return isSelectLikeFieldType(fieldType);
    case "set-checkbox":
    case "toggle-checkbox":
      return fieldType === "checkbox";
    case "set-date-today":
      return fieldType === "date";
    case "clear-field":
      return true;
    default:
      return false;
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Treat null/undefined/"" as equivalent "empty"
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return true;
  return false;
}

/**
 * Compute the result of running a button's actions against a row's current
 * field values. Pure: returns next values + undo snapshot, writes nothing.
 */
export function computeButtonActionResult(
  actions: ButtonAction[],
  fields: Pick<DatabaseField, "id" | "name" | "field_type">[],
  currentValues: Record<string, unknown>,
  now: Date = new Date()
): ButtonActionResult {
  const next: Record<string, unknown> = { ...currentValues };
  const undo: Record<string, unknown> = {};
  const steps: ButtonActionStep[] = [];
  const changed = new Set<string>();

  for (const action of actions) {
    const field = fields.find((f) => f.id === action.targetFieldId);
    if (!field) {
      steps.push({
        targetFieldId: action.targetFieldId,
        targetFieldName: "(已删除字段)",
        operation: action.operation,
        fromValue: undefined,
        toValue: undefined,
        applied: false,
        skipReason: "目标字段不存在",
      });
      continue;
    }

    if (!operationAllowed(action.operation, field.field_type)) {
      steps.push({
        targetFieldId: field.id,
        targetFieldName: field.name,
        operation: action.operation,
        fromValue: next[field.id],
        toValue: next[field.id],
        applied: false,
        skipReason: `动作与字段类型(${field.field_type})不匹配`,
      });
      continue;
    }

    const fromValue = next[field.id];
    let toValue: unknown = fromValue;
    switch (action.operation) {
      case "set-select":
        toValue = action.value ?? "";
        break;
      case "set-checkbox":
        toValue = action.value === "true";
        break;
      case "toggle-checkbox":
        toValue = !next[field.id];
        break;
      case "set-date-today":
        toValue = todayDateString(now);
        break;
      case "clear-field":
        toValue = "";
        break;
    }

    if (valuesEqual(fromValue, toValue)) {
      steps.push({
        targetFieldId: field.id,
        targetFieldName: field.name,
        operation: action.operation,
        fromValue,
        toValue,
        applied: false,
        skipReason: "值未变化",
      });
      continue;
    }

    // Record the prior value once per field for undo.
    if (!(field.id in undo)) {
      undo[field.id] = fromValue;
    }
    next[field.id] = toValue;
    changed.add(field.id);
    steps.push({
      targetFieldId: field.id,
      targetFieldName: field.name,
      operation: action.operation,
      fromValue,
      toValue,
      applied: true,
    });
  }

  return {
    next_values: next,
    undo_values: undo,
    steps,
    changed_field_ids: Array.from(changed),
    has_changes: changed.size > 0,
  };
}

/** A short, human-readable summary of what a button run did (for receipts). */
export function summarizeButtonActionResult(
  result: ButtonActionResult
): string {
  if (!result.has_changes) return "没有字段被改变";
  const applied = result.steps.filter((s) => s.applied);
  return applied
    .map((s) => `${s.targetFieldName} → ${formatValue(s.toValue)}`)
    .join("，");
}

function formatValue(value: unknown): string {
  if (value === true) return "已勾选";
  if (value === false) return "未勾选";
  if (value === null || value === undefined || value === "") return "(清空)";
  return String(value);
}
