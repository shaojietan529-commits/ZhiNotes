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
check(me.includes("display_name"), "me 响应应包含账号用户名 display_name");
check(me.includes("export async function PATCH"), "me route 应支持修改用户名");
check(
  me.includes("normalizeDisplayName"),
  "me route 修改用户名前必须做长度和空值校验"
);

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

// 5. Account-scoped portfolio sync: session-gated, share allowlist enforced
const accountSync = read("src/app/api/portfolio/account-sync/route.ts");
for (const token of [
  "getAccountConfig",
  "readSessionToken",
  "getSessionAccount",
  "501",
  "401",
  "allowedEmails.has",
  "readOnly",
]) {
  check(accountSync.includes(token), `account-sync route 缺少 ${token}`);
}
check(!accountSync.includes("console."), "account-sync route 不应该写日志");

// 6. Shell: viewing a shared portfolio is read-only and never pushes
const board = read("src/components/modules/PortfolioBoardShell.tsx");
check(
  board.includes("if (viewingOwner) return;"),
  "查看共享持仓时不应触发云端 push"
);
check(
  (board.match(/if \(viewingOwnerRef\.current\) return;/g) ?? []).length >= 6,
  "查看共享持仓时导入/打标/修改操作应全部禁用"
);

// 7. Page cloud sync: session-gated route, opt-in client toggle, no logging
const pageSyncRoute = read("src/app/api/pages/account-sync/route.ts");
for (const token of [
  "getAccountConfig",
  "readSessionToken",
  "getSessionAccount",
  "501",
  "401",
  "MAX_PAYLOAD_BYTES",
]) {
  check(pageSyncRoute.includes(token), `pages account-sync route 缺少 ${token}`);
}
check(
  !pageSyncRoute.includes("console."),
  "pages account-sync route 不应该写日志"
);
check(
  pageSyncRoute.includes("existing.u >= record.updated_at"),
  "pages account-sync push 必须拒绝旧数据覆盖新数据"
);

const pageSyncClient = read("src/lib/pages/accountPageSync.ts");
check(
  pageSyncClient.includes("if (!isPageSyncEnabled())"),
  "reconcile 必须在开关关闭时直接返回（默认不上传）"
);
check(
  !pageSyncClient.includes("console.log"),
  "页面同步客户端不应该 console.log（避免泄露页面内容）"
);

const accountShell = read("src/components/modules/AccountShell.tsx");
check(
  accountShell.includes("window.confirm"),
  "开启页面云同步前必须有确认弹窗"
);
check(
  accountShell.includes("setPageSyncEnabled"),
  "AccountShell 缺少页面同步开关"
);
check(accountShell.includes("用户名"), "AccountShell 缺少用户名编辑入口");
check(
  accountShell.includes("display_name"),
  "AccountShell 应读取和保存 display_name"
);

const sidebar = read("src/components/sidebar/Sidebar.tsx");
check(
  sidebar.includes("/api/account/me"),
  "Sidebar 应读取当前账号资料"
);
check(
  sidebar.includes("accountLabel"),
  "Sidebar 应显示登录用户名，而不是固定显示账号"
);

if (errors.length > 0) {
  console.error("verify:account 失败：");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(
  "verify:account 通过 ✓ （门控、哈希、限流、httpOnly、掩码邮箱、页面同步默认关闭）"
);
