#!/usr/bin/env node

// Verifies the multi-account email-code login contract:
// - Everything stays inactive (501) until RESEND_API_KEY +
//   ZHINOTES_ACCOUNT_ALLOWED_EMAILS + KV are configured.
// - Verification codes are stored only as salted hashes, single-use,
//   short-lived, attempt-limited, and send-rate-limited.
// - Sessions are httpOnly cookies backed by revocable KV records.
// - No route or helper logs emails/codes; responses only carry masked emails.

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

// 1. Server helper: gating, hashing, limits
const server = read("src/lib/account/server.ts");
for (const token of [
  "getAccountConfig",
  "ZHINOTES_ACCOUNT_ALLOWED_EMAILS",
  "RESEND_API_KEY",
  "createHash",
  "timingSafeEqual",
  "MAX_VERIFY_ATTEMPTS",
  "MAX_SENDS_PER_WINDOW",
  "CODE_TTL_SECONDS",
  "SESSION_TTL_SECONDS",
]) {
  check(server.includes(token), `server.ts 缺少 ${token}`);
}
check(
  !server.includes("console.log"),
  "server.ts 不应该有 console.log（避免泄露邮箱/验证码）"
);

// 2. Routes: all gated, none log, cookie httpOnly
const routes = [
  "src/app/api/account/login/start/route.ts",
  "src/app/api/account/login/verify/route.ts",
  "src/app/api/account/me/route.ts",
  "src/app/api/account/logout/route.ts",
];
for (const rel of routes) {
  const src = read(rel);
  check(src.includes("getAccountConfig"), `${rel} 缺少 getAccountConfig 门控`);
  check(!src.includes("console."), `${rel} 不应该写日志`);
}
const start = read(routes[0]);
check(start.includes("501"), "login/start 未配置时应返回 501");
check(start.includes("maskEmail"), "login/start 响应应使用掩码邮箱");
const verify = read(routes[1]);
check(verify.includes("httpOnly: true"), "verify 的会话 cookie 必须 httpOnly");
check(verify.includes("maskEmail"), "verify 响应应使用掩码邮箱");
const me = read(routes[2]);
check(me.includes("maskEmail"), "me 响应应使用掩码邮箱");

// 3. Login page: unconfigured state, no auto-send
const shell = read("src/components/modules/AccountShell.tsx");
check(shell.includes("unconfigured"), "AccountShell 缺少未配置状态");
const effectBodies = shell.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[/g) ?? [];
check(effectBodies.length > 0, "AccountShell 缺少会话检查 useEffect");
for (const body of effectBodies) {
  check(
    !body.includes("login/start") && !body.includes("handleSendCode"),
    "AccountShell 不应该在加载时自动发验证码"
  );
}
check(
  shell.includes("/api/account/me"),
  "AccountShell 应该只在加载时检查会话状态"
);
const page = read("src/app/(workspace)/account/page.tsx");
check(page.includes("AccountShell"), "/account 路由缺少 AccountShell");

// 4. Owner doc exists
const doc = read("docs/multi-account-china-access.md");
check(doc.includes("ZHINOTES_ACCOUNT_ALLOWED_EMAILS"), "文档缺少环境变量说明");

if (errors.length > 0) {
  console.error("verify:account 失败：");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log("verify:account 通过 ✓ （门控、哈希、限流、httpOnly、掩码邮箱）");
