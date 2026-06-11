#!/usr/bin/env node
// One-time helper: sign in to the Outlook mailbox via Microsoft's device-code
// flow and print the refresh token to paste into Vercel env vars.
//
// Usage: node scripts/get-outlook-token.mjs <Azure 应用的 Client ID>
//
// The token grants read-only mail access (Mail.Read). Keep it secret — do not
// commit it, paste it into pages, or share it.

const clientId = process.argv[2];
if (!clientId) {
  console.error("用法: node scripts/get-outlook-token.mjs <Azure 应用的 Client ID>");
  process.exit(1);
}

const BASE = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const SCOPE = "https://graph.microsoft.com/Mail.Read offline_access";

const deviceRes = await fetch(`${BASE}/devicecode`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: clientId, scope: SCOPE }),
});
const device = await deviceRes.json();
if (!device.device_code) {
  console.error("获取设备码失败：", device.error_description ?? device.error);
  process.exit(1);
}

console.log("");
console.log("请打开浏览器访问:", device.verification_uri);
console.log("输入代码:", device.user_code);
console.log("然后用 zhinote1@outlook.com 登录并同意授权。");
console.log("");
console.log("等待授权中…");

const intervalMs = (device.interval ?? 5) * 1000;
const deadline = Date.now() + (device.expires_in ?? 900) * 1000;

while (Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
  const tokenRes = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: device.device_code,
    }),
  });
  const token = await tokenRes.json();
  if (token.refresh_token) {
    console.log("");
    console.log("授权成功！把下面两个值填入 Vercel 的环境变量（不要提交到代码库）：");
    console.log("");
    console.log("MS_GRAPH_CLIENT_ID =", clientId);
    console.log("MS_GRAPH_REFRESH_TOKEN =", token.refresh_token);
    console.log("");
    process.exit(0);
  }
  if (token.error && token.error !== "authorization_pending") {
    console.error("授权失败：", token.error_description ?? token.error);
    process.exit(1);
  }
}

console.error("授权超时，请重新运行。");
process.exit(1);
