import assert from "node:assert/strict";
import { test } from "node:test";
import { configuredLocalVerificationServer } from "./lib/local-verification-target.mjs";

test("local verification target: accepts only explicit localhost origins", () => {
  assert.deepEqual(configuredLocalVerificationServer("http://127.0.0.1:3026"), {
    baseUrl: "http://127.0.0.1:3026", port: 3026,
  });
  assert.deepEqual(configuredLocalVerificationServer("http://localhost:3026/"), {
    baseUrl: "http://localhost:3026", port: 3026,
  });
});

for (const [label, value] of Object.entries({
  production: "https://zhi-note.com",
  remoteHttp: "http://example.invalid:3026",
  remoteLookalike: "http://localhost.example.invalid:3026",
  https: "https://127.0.0.1:3026",
  file: "file:///tmp/synthetic",
  credentials: "http://synthetic:secret@localhost:3026",
  pagePath: "http://localhost:3026/portfolio",
  query: "http://localhost:3026/?synthetic=1",
  fragment: "http://localhost:3026/#synthetic",
  missingPort: "http://localhost",
  zeroPort: "http://localhost:0",
  empty: "",
  invalid: "not-a-url",
})) {
  test(`local verification target: rejects ${label} without echoing input`, () => {
    assert.throws(() => configuredLocalVerificationServer(value), (error) =>
      error.message === "ZHINOTES_VERIFY_BASE_URL must be a localhost HTTP origin with an explicit port.");
  });
}
