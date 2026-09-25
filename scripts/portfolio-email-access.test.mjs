// Real relay/setup handlers; fake identity store and Graph responses only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const compiled = new Map();
function fixture(overrides = {}) {
  const controls = { configured: true, owner: "owner@example.invalid", allowed: true, token: "synthetic",
    account: { id: "owner-id", email: "owner@example.invalid" }, failSession: false, ...overrides };
  const modules = new Map(), requests = [];
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name === "@/lib/account/server") return {
      getAccountIdentityConfig: () => controls.configured ? { allowedEmails: new Set(controls.allowed ? ["owner@example.invalid"] : []) } : null,
      normalizeEmail: (value) => typeof value === "string" && value.includes("@") ? value.trim().toLowerCase() : "",
      readSessionToken: () => controls.token,
      getSessionAccount: async () => { if (controls.failSession) throw new Error("synthetic timeout"); return controls.account; },
    };
    if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
    const file = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) + ".ts" : path.resolve(path.dirname(parent), name) + ".ts";
    if (modules.has(file)) return modules.get(file).exports;
    const loaded = { exports: {} }; modules.set(file, loaded);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    vm.runInNewContext(compiled.get(file), {
      exports: loaded.exports, module: loaded, require: (dependency) => load(dependency, file),
      Date, URLSearchParams, AbortController, setTimeout, clearTimeout,
      process: { env: { ZHINOTES_PORTFOLIO_EMAIL_OWNER_EMAIL: controls.owner, MS_GRAPH_CLIENT_ID: "synthetic-client", MS_GRAPH_REFRESH_TOKEN: "synthetic-token" } },
      fetch: async (url, init) => {
        requests.push({ url, init });
        if (url.endsWith("/devicecode")) return Response.json({ user_code: "synthetic-code", device_code: "synthetic-device", verification_uri: "https://example.invalid" });
        if (url.endsWith("/token")) return Response.json({ access_token: "synthetic-access", refresh_token: "synthetic-refresh" });
        if (url.includes("/attachments/")) return Response.json({ contentBytes: "c3ludGhldGlj" });
        if (url.includes("/attachments?")) return Response.json({ value: [{ id: "file", name: "roger pos synthetic.xlsx", size: 9 }] });
        if (url.includes("/me/messages?")) return Response.json({ value: [{ id: "message", hasAttachments: true, receivedDateTime: "2026-09-25T00:00:00Z" }] });
        throw new Error(`Unexpected synthetic request: ${url}`);
      },
    }, { filename: file });
    return loaded.exports;
  }
  async function send(kind, expected = "owner-id", action = "start") {
    const isRead = kind === "email-position";
    const request = new Request(`https://synthetic.invalid/api/portfolio/${kind}`, {
      method: isRead ? "GET" : "POST",
      headers: expected === null ? {} : { "x-zhinote-account-id": expected },
      ...(!isRead ? { body: JSON.stringify({ action, clientId: "synthetic-client", deviceCode: "synthetic-device" }) } : {}),
    });
    const response = await load(`@/app/api/portfolio/${kind}/route`)[isRead ? "GET" : "POST"](request);
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  return { controls, requests, send };
}

for (const kind of ["email-position", "email-setup"]) {
  test(`${kind}: rejects unowned, signed-out, foreign or stale-account requests before Graph`, async () => {
    for (const [controls, expected, status] of [
      [{ configured: false }, "owner-id", 501], [{ owner: "" }, "owner-id", 501],
      [{ allowed: false }, "owner-id", 501], [{ token: null }, "owner-id", 401],
      [{ account: null }, "owner-id", 503], [{ failSession: true }, "owner-id", 503],
      [{}, null, 428], [{}, "old-id", 409],
      [{ account: { id: "other-id", email: "other@example.invalid" } }, "other-id", 403],
    ]) {
      const f = fixture(controls), result = await f.send(kind, expected);
      assert.equal(result.status, status);
      assert.equal(f.requests.length, 0, "must not refresh Graph token or read mailbox");
      assert.equal(result.headers.get("set-cookie"), null, "auth uncertainty cannot revoke login");
      for (const key of ["contentBase64", "refreshToken", "deviceCode", "accountId"]) assert.equal(result.body[key], undefined);
    }
  });
}

test("mailbox owner: confirms response identity and prevents caching report bytes or tokens", async () => {
  const f = fixture();
  const report = await f.send("email-position");
  assert.equal(report.status, 200);
  assert.equal(report.body.accountId, "owner-id");
  assert.equal(report.body.contentBase64, "c3ludGhldGlj");
  for (const result of [report, await f.send("email-setup"), await f.send("email-setup", "owner-id", "poll")]) {
    assert.equal(result.status, 200);
    assert.equal(result.body.accountId, "owner-id");
    assert.match(result.headers.get("cache-control"), /no-store/);
  }
});
