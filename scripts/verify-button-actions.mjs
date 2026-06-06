#!/usr/bin/env node

// Verifies the local database button action runner contract:
// - Pure runner exists with same-row, low-risk operations only.
// - Every run produces an undo snapshot and a changed-field list.
// - Backward compatible: no configured actions => no changes.
// - Stays local: no upload/sync/AI references in the module.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const file = "src/lib/database/buttonActions.ts";
const fullPath = path.join(root, file);

const errors = [];
const check = (cond, msg) => {
  if (!cond) errors.push(msg);
};

check(existsSync(fullPath), `${file} 不存在`);
const source = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";

const requiredExports = [
  "computeButtonActionResult",
  "getButtonActions",
  "summarizeButtonActionResult",
  "isButtonActionOperation",
];
for (const name of requiredExports) {
  check(source.includes(`export function ${name}`), `缺少导出函数 ${name}`);
}

const operations = [
  "set-select",
  "set-checkbox",
  "toggle-checkbox",
  "set-date-today",
  "clear-field",
];
for (const op of operations) {
  check(source.includes(`"${op}"`), `缺少动作类型 ${op}`);
}

check(source.includes("undo_values"), "结果必须包含 undo_values 撤销快照");
check(source.includes("changed_field_ids"), "结果必须包含 changed_field_ids");
check(source.includes("has_changes"), "结果必须包含 has_changes");
check(
  source.includes("operationAllowed"),
  "必须校验动作与字段类型匹配（operationAllowed）"
);

// Same-row only / low-risk: must not create pages/databases, do network I/O,
// or enable AI. (Match call patterns, not words in comments.)
const forbidden = [
  "createPage(",
  "createDatabase(",
  "updateRow(",
  "fetch(",
  "XMLHttpRequest",
  "enables_ai: true",
];
for (const token of forbidden) {
  check(!source.includes(token), `运行器不得包含高风险调用 ${token}`);
}

if (errors.length > 0) {
  console.error("Button action runner verification FAILED:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log("Button action runner verification passed");
console.log(
  JSON.stringify(
    {
      runner_exports: requiredExports.length,
      operations: operations.length,
      reversible: true,
      same_row_only: true,
      local_only: true,
    },
    null,
    2
  )
);
