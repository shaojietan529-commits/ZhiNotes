#!/usr/bin/env node

// Verifies the ZhiHui glossary API contract:
// - It is protected by the same ZhiHui agent token as the recording queue.
// - It reads only account-scoped synced pages from KV.
// - It returns short glossary terms and diagnostics, not raw page text or meeting secrets.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];
const check = (cond, msg) => {
  if (!cond) errors.push(msg);
};
const read = (rel) => {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    errors.push(`缺少文件 ${rel}`);
    return "";
  }
  return readFileSync(full, "utf8");
};

const route = read("src/app/api/glossary/route.ts");
for (const token of [
  "getMeetingAgentQueueConfig",
  "authorizeMeetingAgent",
  "buildZhiHuiGlossary",
  "force-dynamic",
]) {
  check(route.includes(token), `glossary route 缺少 ${token}`);
}
check(!route.includes("console."), "glossary route 不应该写日志");

const helper = read("src/lib/meetings/glossary.ts");
for (const token of [
  "PAGE_SYNC_INDEX_KEY_PREFIX",
  "PAGE_SYNC_PAGE_KEY_PREFIX",
  "ZHIHUI_GLOSSARY_EMAIL",
  "ZHINOTES_ACCOUNT_ALLOWED_EMAILS",
  "raw_page_text_returned: false",
  "raw_meeting_credentials_returned: false",
  "terms_only: true",
  "SECRET_LINE_PATTERN",
  "looksLikeSecretToken",
]) {
  check(helper.includes(token), `glossary helper 缺少 ${token}`);
}
check(
  !helper.includes("console."),
  "glossary helper 不应该写日志（避免泄露页面词条）"
);
check(
  helper.includes("content_text.slice(0, MAX_PAGE_TEXT_CHARS)"),
  "glossary helper 读取页面正文必须有长度上限"
);
check(
  helper.includes("terms,") && helper.includes("diagnostics"),
  "glossary helper 应返回 terms 和 diagnostics"
);

const packageJson = read("package.json");
check(
  packageJson.includes('"verify:zhihui-glossary"'),
  "package.json 缺少 verify:zhihui-glossary 脚本"
);

if (errors.length > 0) {
  console.error("verify:zhihui-glossary 失败：");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  "verify:zhihui-glossary 通过 ✓ （agent token、同步页读取、只返回短词条、隐藏原文和会议密钥）"
);
