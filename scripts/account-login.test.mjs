import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url).pathname;
const require = createRequire(import.meta.url);
const email = "synthetic@example.invalid";

function fixture(fetcher, options = {}) {
  const calls = [], logs = [], cache = new Map();
  const environment = {
    Buffer, Request, Response, Headers, AbortController, URL,
    setTimeout: (callback, ms) => setTimeout(callback, options.fastTimeout ? 5 : ms),
    clearTimeout,
    console: { error: (...args) => logs.push(args) },
    process: { env: {
      KV_REST_API_URL: "https://synthetic.invalid",
      KV_REST_API_TOKEN: "synthetic-secret-never-log",
      RESEND_API_KEY: "synthetic-mail-secret-never-log",
      ZHINOTES_ACCOUNT_ALLOWED_EMAILS: email,
    } },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return fetcher(url, init, calls.length);
    },
  };
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name === "@/lib/cloud/api") return { maskEmail: () => "s***@example.invalid" };
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    const file = (name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(parent), name)) + ".ts";
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { ...environment, module: loaded, exports: loaded.exports, require: (dependency) => load(dependency, file) }, { filename: file });
    return loaded.exports;
  }
  return { load, calls, logs, async send(body = { email }) {
    return load("@/app/api/account/login/start/route").POST(new Request("https://app.invalid/api/account/login/start", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
  } };
}

function success(url) {
  if (url.includes("/get/")) return Response.json({ result: null });
  if (url.includes("api.resend.com")) return Response.json({ id: "synthetic-delivery" });
  if (url.includes("/del/")) return Response.json({ result: 1 });
  return Response.json({ result: "OK" });
}

for (const [status, providerBody, reason] of [
  [401, { error: "invalid token synthetic-secret" }, "access"],
  [403, { error: "daily request limit exceeded" }, "quota"],
  [429, { error: "rate limited" }, "quota"],
  [503, { error: "unavailable" }, "upstream"],
  [200, { error: "ERR max requests limit exceeded" }, "quota"],
  [200, { unexpected: "synthetic-private" }, "invalid-response"],
  [200, { result: { unexpected: "synthetic-private" } }, "invalid-response"],
]) {
  test(`storage failure ${status}/${reason} blocks mail and emits sanitized diagnostics`, async () => {
    const f = fixture(() => Response.json(providerBody, { status }));
    const response = await f.send();
    assert.equal(response.status, 502);
    assert.equal((await response.json()).reason, "storage-unavailable");
    assert.equal(f.calls.length, 1);
    assert.equal(f.logs[0][1].reason, reason);
    assert.equal(f.logs[0][1].operation, "storage-get");
    assert.doesNotMatch(JSON.stringify(f.logs), /example|synthetic|Bearer|https|stack|token/);
  });
}

test("a Redis command error in a 200 write response is not treated as saved", async () => {
  const f = fixture((url) => url.includes("/get/") ? success(url) : Response.json({ error: "ERR storage full" }));
  assert.equal((await f.send()).status, 502);
  assert.equal(f.calls.length, 2);
  assert.equal(f.logs[0][1].operation, "storage-setex");
});

test("network failures and timeouts remain distinct and never log the raw error", async () => {
  for (const timedOut of [false, true]) {
    const f = fixture((_url, init) => {
      if (!timedOut) throw new Error("synthetic-secret-never-log");
      return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("synthetic-secret-never-log"))));
    }, { fastTimeout: timedOut });
    assert.equal((await f.send()).status, 502);
    assert.equal(f.logs[0][1].reason, timedOut ? "timeout" : "network");
    assert.doesNotMatch(JSON.stringify(f.logs), /synthetic-secret/);
  }
});

test("mail failure remains mail failure even when cleanup cannot reach storage", async () => {
  const f = fixture((url) => {
    if (url.includes("api.resend.com")) return Response.json({ name: "daily_quota_exceeded" }, { status: 403 });
    if (url.includes("/del/")) return Response.json({ error: "unavailable" }, { status: 503 });
    return success(url);
  });
  const response = await f.send();
  assert.equal((await response.json()).reason, "email-unavailable");
  assert.equal(f.logs[0][1].operation, "email-send");
  assert.equal(f.logs[0][1].reason, "quota");
  assert.equal(f.logs[1][1].operation, "storage-del");
});

test("an uncertain mail delivery does not invalidate a code that may have been sent", async () => {
  const f = fixture((url) => {
    if (url.includes("api.resend.com")) throw new Error("lost response");
    return success(url);
  });
  const response = await f.send();
  assert.equal((await response.json()).reason, "email-unavailable");
  assert.equal(f.calls.filter((call) => call.url.includes("/del/")).length, 0);
});

test("successful send only stores hashed code and leaves response masked", async () => {
  const f = fixture(success);
  const response = await f.send();
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "sent");
  assert.doesNotMatch(JSON.stringify(payload), /synthetic@example/);
  assert.equal(f.logs.length, 0);
  const codeWrite = f.calls.find((call) => call.url.includes("/setex/") && call.url.includes("code"));
  const record = JSON.parse(codeWrite.init.body);
  assert.equal(typeof record.hash, "string");
  assert.equal(record.attempts, 0);
  assert.equal(record.code, undefined);
});

test("unknown email keeps the existing non-enumerating response without any upstream calls", async () => {
  const f = fixture(() => assert.fail("no upstream calls allowed"));
  assert.equal((await (await f.send({ email: "unknown@example.invalid" })).json()).status, "sent");
  assert.equal(f.calls.length, 0);
});

test("malformed JSON values return 400 without calling upstream services", async () => {
  for (const body of [null, [], "synthetic", {}, { email: 7 }]) {
    const f = fixture(() => assert.fail("no upstream calls allowed"));
    assert.equal((await f.send(body)).status, 400);
  }
});

test("send rate limit still applies and supplies Retry-After", async () => {
  const f = fixture(() => Response.json({ result: JSON.stringify({ count: 3, resetAt: Date.now() + 600_000 }) }));
  const response = await f.send();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "600");
  assert.equal(f.calls.length, 1);
});

test("repeated service failure logs are bounded within an instance", async () => {
  const f = fixture(() => Response.json({ error: "unavailable" }, { status: 503 }));
  await f.send(); await f.send();
  assert.equal(f.logs.length, 1);
});

test("HTML and empty responses never become a false code-sent success", () => {
  const f = fixture(success);
  const { isLoginCodeSent, loginSendFailureMessage } = f.load("@/lib/account/loginResponse");
  for (const payload of [null, {}, "<html>challenge</html>", { status: "unknown" }]) {
    assert.equal(isLoginCodeSent(payload), false);
  }
  assert.equal(isLoginCodeSent({ status: "sent" }), true);
  assert.match(loginSendFailureMessage(403, {}), /访问检查/);
  assert.match(loginSendFailureMessage(404, {}), /zhi-note.com/);
  assert.match(loginSendFailureMessage(502, {}), /502/);
  assert.match(loginSendFailureMessage(429, {}), /10/);
  assert.equal(loginSendFailureMessage(502, { error: "cloud failed" }), "cloud failed");
});
