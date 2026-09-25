// Actual routes, installed Upstash SDK and production Lua against isolated Redis.
// Only login is synthetic; a loopback REST adapter forwards commands to redis-cli.
// No .env loading, existing Redis address, production credentials or user data.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const exec = promisify(execFile);
const bin = process.env.PORTFOLIO_NATIVE_REDIS_BIN;
assert.ok(bin && path.isAbsolute(bin), "Set PORTFOLIO_NATIVE_REDIS_BIN to a directory containing redis-server and redis-cli");
const now = "2026-09-26T01:00:00.000Z";
const initial = { snapshot: { positions: [] }, tagMap: { A: "original", B: "remove" },
  allocation: 100, maxNetPct: 12, lastEmailMessageId: null, updatedAt: now };
const encode = (value) => typeof value === "string" ? Buffer.from(value).toString("base64")
  : Array.isArray(value) ? value.map(encode) : value;

async function startRedis() {
  await mkdir(path.join(root, ".local"), { recursive: true });
  const dir = await mkdtemp(path.join(root, ".local", "redis-cas-"));
  const socket = path.join(dir, "r.sock");
  const server = spawn(path.join(bin, "redis-server"), ["--port", "0", "--unixsocket", socket,
    "--unixsocketperm", "700", "--save", "", "--appendonly", "no", "--dir", dir], { stdio: "ignore" });
  const exited = once(server, "exit");
  const command = async (...args) => {
    const { stdout } = await exec(path.join(bin, "redis-cli"), ["-s", socket, "--json", ...args.map(String)],
      { timeout: 4000, maxBuffer: 3 * 1024 * 1024 });
    return JSON.parse(stdout);
  };
  const close = async () => {
    if (server.exitCode === null && server.signalCode === null) server.kill("SIGTERM");
    await exited;
    await rm(dir, { recursive: true, force: true }); // This test's own empty/synthetic directory only.
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error("Isolated Redis exited before readiness");
      try { ready = await command("PING") === "PONG"; } catch { /* Socket may not exist yet. */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(ready, "Isolated Redis must become ready");
    return { command, close };
  } catch (error) { await close(); throw error; }
}

async function startRestAdapter(command) {
  const controls = { beforeReply: null, dropEvalReplies: 0, evals: 0 };
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.headers.authorization, "Bearer synthetic-only");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const text = Buffer.concat(chunks).toString();
      const pathname = new URL(request.url, "http://127.0.0.1").pathname;
      let commands;
      if (pathname.startsWith("/get/")) commands = [["GET", decodeURIComponent(pathname.slice(5))]];
      else if (pathname.startsWith("/set/")) commands = [["SET", decodeURIComponent(pathname.slice(5)), text]];
      else {
        assert.ok(pathname === "/" || pathname === "/pipeline");
        const parsed = JSON.parse(text);
        commands = pathname === "/pipeline" ? parsed : [parsed];
      }
      const replies = [];
      for (const args of commands) {
        assert.ok(["GET", "SET", "EVAL"].includes(String(args[0]).toUpperCase()));
        const evalCommand = String(args[0]).toUpperCase() === "EVAL";
        if (evalCommand) controls.evals++;
        const result = await command(...args);
        if (controls.beforeReply) await controls.beforeReply(args);
        if (evalCommand && controls.dropEvalReplies > 0) {
          controls.dropEvalReplies--;
          response.destroy();
          return;
        }
        replies.push({ result: request.headers["upstash-encoding"] === "base64" ? encode(result) : result });
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(pathname === "/pipeline" ? replies : replies[0]));
    } catch {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Isolated Redis rejected command" }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { controls, url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }) };
}

function loadRoutes(config, command) {
  const modules = new Map();
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name === "@/lib/account/server") return {
      accountIdentityMissingEnv: () => [], getAccountIdentityConfig: () => ({ kv: config, allowedEmails: new Set() }),
      getSessionAccount: async () => ({ id: "synthetic", email: "synthetic@example.invalid" }),
      readSessionToken: () => "synthetic-session", normalizeEmail: (email) => email ?? "",
      kvGet: (_, key) => command("GET", key), kvSet: (_, key, value) => command("SET", key, value),
    };
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    const file = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) + ".ts"
      : path.resolve(path.dirname(parent), name) + ".ts";
    if (modules.has(file)) return modules.get(file).exports;
    const loaded = { exports: {} }; modules.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(compiled, {
      exports: loaded.exports, module: loaded, require: (dependency) => load(dependency, file),
      Buffer, Date, AbortController, AbortSignal, setTimeout, clearTimeout, fetch,
      process: { env: { KV_REST_API_URL: config.url, KV_REST_API_TOKEN: config.token } },
    }, { filename: file });
    return loaded.exports;
  }
  const keys = load("@/lib/portfolio/accountSyncKeys");
  return (mode) => {
    const route = load(`@/app/api/portfolio/${mode === "account" ? "account-sync" : "sync"}/route`);
    const key = mode === "account" ? `${keys.PORTFOLIO_ACCOUNT_DATA_KEY_PREFIX}synthetic@example.invalid` : "zhinotes:portfolio:data:v1";
    const metadataKey = mode === "account" ? `${keys.PORTFOLIO_ACCOUNT_METADATA_KEY_PREFIX}synthetic@example.invalid` : null;
    const send = async (body) => {
      const response = await route.POST(new Request(`${config.url}/api/portfolio/sync`, {
        method: "POST", body: JSON.stringify({ expectedAccountId: "synthetic", passcode: "synthetic-only", ...body }),
      }));
      return { status: response.status, body: await response.json() };
    };
    return { key, metadataKey, send,
      push: (data, base, requestId) => send({ action: "push", protocol: 2, data, base, requestId }),
      pull: () => send({ action: "pull" }) };
  };
}

test("native Redis integration: real SDK/route/Lua comparison and writes", { timeout: 45000 }, async (t) => {
  const redis = await startRedis();
  let rest;
  try {
    rest = await startRestAdapter(redis.command);
    const routes = loadRoutes({ url: rest.url, token: "synthetic-only" }, redis.command);
    for (const mode of ["account", "passcode"]) {
      const route = routes(mode);
      await t.test(`${mode}: racing writes have one winner; content and metadata agree`, async () => {
        const first = await route.push(initial, null, "first");
        assert.equal(first.status, 200);
        assert.equal(first.body.ack.request_id, "first");
        let arrivals = 0, release;
        const bothRead = new Promise((resolve) => { release = resolve; });
        rest.controls.beforeReply = async (args) => {
          if (String(args[0]).toUpperCase() !== "GET" || args[1] !== route.key) return;
          if (++arrivals === 2) release();
          await bothRead;
        };
        const a = { ...initial, tagMap: { A: "device A" }, allocation: 200, updatedAt: "2026-09-26T01:00:01.000Z" };
        const b = { ...initial, tagMap: { A: "device B" }, allocation: 300, updatedAt: "2026-09-26T01:00:02.000Z" };
        let results;
        try { results = await Promise.all([route.push(a, first.body.version, "race-a"), route.push(b, first.body.version, "race-b")]); }
        finally { rest.controls.beforeReply = null; }
        assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
        const winner = results[0].status === 200 ? a : b;
        const losingReply = results.find((result) => result.status === 409);
        assert.equal(losingReply.body.ack, undefined);
        assert.deepEqual(losingReply.body.data, winner);
        assert.deepEqual(JSON.parse(await redis.command("GET", route.key)), winner);
        assert.deepEqual((await route.pull()).body.data, winner);
        if (route.metadataKey) {
          const metadata = JSON.parse(await redis.command("GET", route.metadataKey));
          assert.equal(metadata.updated_at, winner.updatedAt);
          assert.equal(metadata.owner, "synthetic@example.invalid");
        }
        assert.equal((await route.push(initial, first.body.version, "stale")).status, 409);
      });
      await t.test(`${mode}: SDK replay after one lost EVAL reply is not a false conflict`, async () => {
        const pulled = await route.pull();
        const data = { ...pulled.body.data, allocation: 400 };
        rest.controls.dropEvalReplies = 1;
        const replay = await route.push(data, pulled.body.version, "sdk-replay");
        assert.equal(replay.status, 200);
        assert.equal(replay.body.ack.request_id, "sdk-replay");
        assert.deepEqual(JSON.parse(await redis.command("GET", route.key)), data);
      });
      await t.test(`${mode}: no ACK when all replies are lost; explicit retry confirms persisted data`, async () => {
        const pulled = await route.pull();
        const data = { ...pulled.body.data, allocation: 450 };
        rest.controls.dropEvalReplies = 100;
        let lost;
        try { lost = await route.push(data, pulled.body.version, "lost-response"); }
        finally { rest.controls.dropEvalReplies = 0; }
        assert.ok(lost.status >= 500);
        assert.equal(lost.body.ack, undefined);
        assert.deepEqual(JSON.parse(await redis.command("GET", route.key)), data);
        const retry = await route.push(data, pulled.body.version, "retry-exact");
        assert.equal(retry.status, 200);
        assert.equal(retry.body.ack.request_id, "retry-exact");
        assert.equal(retry.body.ack.revision, (await route.pull()).body.version.revision);
      });
      await t.test(`${mode}: a third writer between lost reply and SDK replay is preserved`, async () => {
        const pulled = await route.pull();
        const desired = { ...pulled.body.data, allocation: 475 };
        const intervening = { ...pulled.body.data, allocation: 480, updatedAt: "2026-09-26T01:01:00.000Z" };
        const metadata = JSON.stringify({ owner: "synthetic@example.invalid", updated_at: intervening.updatedAt });
        rest.controls.dropEvalReplies = 1;
        rest.controls.beforeReply = async (args) => {
          if (String(args[0]).toUpperCase() !== "EVAL") return;
          rest.controls.beforeReply = null;
          await redis.command("MSET", route.key, JSON.stringify(intervening),
            ...(route.metadataKey ? [route.metadataKey, metadata] : []));
        };
        let result;
        try { result = await route.push(desired, pulled.body.version, "replay-with-newer-writer"); }
        finally { rest.controls.beforeReply = null; rest.controls.dropEvalReplies = 0; }
        assert.equal(result.status, 409);
        assert.equal(result.body.ack, undefined);
        assert.deepEqual(result.body.data, intervening);
        assert.deepEqual(JSON.parse(await redis.command("GET", route.key)), intervening);
        if (route.metadataKey) assert.equal(await redis.command("GET", route.metadataKey), metadata);
      });
      await t.test(`${mode}: OOM refusal produces no ACK and preserves prior content/metadata`, async () => {
        const pulled = await route.pull();
        const before = await redis.command("GET", route.key);
        const metadata = route.metadataKey ? await redis.command("GET", route.metadataKey) : null;
        await redis.command("CONFIG", "SET", "maxmemory-policy", "noeviction");
        await redis.command("CONFIG", "SET", "maxmemory", "1");
        try {
          const failed = await route.push({ ...pulled.body.data, allocation: 500 }, pulled.body.version, "out-of-memory");
          assert.ok(failed.status >= 500);
          assert.equal(failed.body.ack, undefined);
          assert.equal(await redis.command("GET", route.key), before);
          if (route.metadataKey) assert.equal(await redis.command("GET", route.metadataKey), metadata);
        } finally { await redis.command("CONFIG", "SET", "maxmemory", "0"); }
      });
    }
  } finally {
    if (rest) await rest.close();
    await redis.close();
  }
});
