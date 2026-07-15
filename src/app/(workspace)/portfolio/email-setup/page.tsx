"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Phase = "idle" | "waiting" | "done" | "error";

const PORTFOLIO_EMAIL_SETUP_ACTION_TIMEOUT_MS = 12000;

async function fetchPortfolioEmailSetupActionWithTimeout(
  body: Record<string, unknown>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    PORTFOLIO_EMAIL_SETUP_ACTION_TIMEOUT_MS
  );
  try {
    return await fetch("/api/portfolio/email-setup", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

// One-time wizard: signs in to the Outlook mailbox via Microsoft's
// device-code flow and shows the two values to paste into Vercel env vars.
// The refresh token is displayed once for manual copy and never stored here.
export default function EmailSetupPage() {
  const [clientId, setClientId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollInFlightRef.current = false;
    };
  }, []);

  const startAuth = async () => {
    const id = clientId.trim();
    if (!id) {
      setError("请先粘贴 Azure 应用的 Client ID。");
      return;
    }
    setError(null);
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    pollInFlightRef.current = false;
    try {
      const res = await fetchPortfolioEmailSetupActionWithTimeout({
        action: "start",
        clientId: id,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "启动授权失败。");
        return;
      }
      setUserCode(data.userCode);
      setVerificationUri(data.verificationUri);
      setPhase("waiting");

      const deviceCode: string = data.deviceCode;
      const intervalMs = Math.max(data.interval ?? 5, 5) * 1000;
      const deadline = Date.now() + (data.expiresIn ?? 900) * 1000;

      pollRef.current = window.setInterval(async () => {
        if (pollInFlightRef.current) return;
        if (Date.now() > deadline) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase("error");
          setError("授权超时，请点「开始授权」重试。");
          return;
        }
        pollInFlightRef.current = true;
        try {
          const pollRes = await fetchPortfolioEmailSetupActionWithTimeout({
            action: "poll",
            clientId: id,
            deviceCode,
          });
          const poll = await pollRes.json();
          if (poll.status === "ok") {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            setRefreshToken(poll.refreshToken);
            setPhase("done");
          } else if (poll.status === "error") {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            setPhase("error");
            setError(poll.error ?? "授权失败，请重试。");
          }
        } catch (error) {
          setError(
            isAbortError(error)
              ? "授权检查请求超时；本地组合数据不受影响，会继续轮询。"
              : "授权检查暂时失败；本地组合数据不受影响，会继续轮询。"
          );
        } finally {
          pollInFlightRef.current = false;
        }
      }, intervalMs);
    } catch (error) {
      setError(
        isAbortError(error)
          ? "启动邮箱授权请求超时；本地组合数据不受影响，可稍后重试。"
          : "网络错误，请重试。"
      );
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("请手动复制：", value);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/40 px-6 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/portfolio"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          ← 返回组合管理
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          📧 邮箱授权设置
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          一次性设置：让系统能从 zhinote1@outlook.com
          自动读取持仓邮件（只读权限，不能发送或删除邮件）。
        </p>

        {/* Step 1 */}
        <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            第 1 步：注册一个微软应用（免费，只需一次）
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            <li>
              打开{" "}
              <a
                href="https://portal.azure.com"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline dark:text-blue-400"
              >
                portal.azure.com
              </a>
              ，用任意微软账号登录（可以就用 zhinote1@outlook.com）
            </li>
            <li>
              顶部搜索框输入 <b>App registrations</b>，进入后点{" "}
              <b>New registration</b>
            </li>
            <li>
              名字填 <b>ZhiNotes Mail</b>；账户类型选最后一项{" "}
              <b>Personal Microsoft accounts only</b>；Redirect URI
              留空；点 Register
            </li>
            <li>
              注册完成后，左侧菜单点 <b>Authentication</b>，把页面底部的{" "}
              <b>Allow public client flows</b> 切换为 <b>Yes</b>，点 Save
            </li>
            <li>
              回到 <b>Overview</b> 页，复制{" "}
              <b>Application (client) ID</b>（一串字母数字）
            </li>
          </ol>
        </section>

        {/* Step 2 */}
        <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            第 2 步：粘贴 Client ID 并授权
          </h2>
          <div className="mt-3 flex gap-2">
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="粘贴 Application (client) ID"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => void startAuth()}
              disabled={phase === "waiting"}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {phase === "waiting" ? "等待授权…" : "开始授权"}
            </button>
          </div>

          {phase === "waiting" && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900/60 dark:bg-sky-950/40">
              <p className="text-sky-800 dark:text-sky-200">
                请在新标签页打开{" "}
                <a
                  href={verificationUri}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  {verificationUri}
                </a>
                ，输入下面的代码，然后用 <b>zhinote1@outlook.com</b>{" "}
                登录并同意授权：
              </p>
              <div className="mt-3 text-center text-3xl font-bold tracking-[0.3em] text-sky-900 dark:text-sky-100">
                {userCode}
              </div>
              <p className="mt-3 text-xs text-sky-700/80 dark:text-sky-300/80">
                完成后这个页面会自动进入下一步，请保持页面打开。
              </p>
            </div>
          )}
        </section>

        {/* Step 3 */}
        {phase === "done" && (
          <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              ✅ 授权成功！第 3 步：把两个值填入 Vercel
            </h2>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              打开 Vercel 项目 → Settings → Environment Variables，添加以下两条，
              然后在 Deployments 页对最新部署点 Redeploy：
            </p>
            <div className="mt-3 space-y-3">
              <EnvRow
                name="MS_GRAPH_CLIENT_ID"
                value={clientId.trim()}
                copied={copied}
                onCopy={copy}
              />
              <EnvRow
                name="MS_GRAPH_REFRESH_TOKEN"
                value={refreshToken}
                copied={copied}
                onCopy={copy}
                masked
              />
            </div>
            <p className="mt-3 text-xs text-emerald-700/80 dark:text-emerald-300/80">
              ⚠️ 这串 token 相当于邮箱的只读钥匙：只粘贴到 Vercel
              环境变量里，不要发给任何人。它只在本页显示这一次，系统不会保存。
              大约 90 天后会过期，到时回到本页重新授权一次即可。
            </p>
          </section>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function EnvRow({
  name,
  value,
  copied,
  onCopy,
  masked,
}: {
  name: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, value: string) => void;
  masked?: boolean;
}) {
  return (
    <div className="rounded-lg border border-emerald-300/60 bg-white p-3 dark:border-emerald-800/60 dark:bg-zinc-900">
      <div className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {name}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-800 dark:text-zinc-200">
          {masked ? `${value.slice(0, 12)}…（已隐藏，点复制获取完整值）` : value}
        </code>
        <button
          type="button"
          onClick={() => onCopy(name, value)}
          className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {copied === name ? "已复制 ✓" : "复制"}
        </button>
      </div>
    </div>
  );
}
