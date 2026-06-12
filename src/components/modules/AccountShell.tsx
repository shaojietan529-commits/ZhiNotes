"use client";

// Email-code login surface for the multi-account system. Shows a clear
// "not configured" state until the owner enables Resend + the allowlist,
// so this page is safe to ship ahead of the cloud rollout.

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/sidebar/Sidebar";

interface AccountInfo {
  id: string;
  email_hint: string;
  createdAt: string;
}

type Phase =
  | "loading"
  | "unconfigured"
  | "email"
  | "code"
  | "signed-in"
  | "error";

export default function AccountShell() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/account/me", { cache: "no-store" });
      if (res.status === 501) {
        setPhase("unconfigured");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        return;
      }
      const data = await res.json();
      if (data.authenticated && data.account) {
        setAccount(data.account as AccountInfo);
        setPhase("signed-in");
      } else {
        setPhase("email");
      }
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  async function handleSendCode() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/login/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "发送失败，请稍后重试。");
        return;
      }
      setPhase("code");
      setNotice("验证码已发送（如果该邮箱在受邀名单内），请查收邮件。");
    } catch {
      setNotice("网络错误，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "验证失败，请稍后重试。");
        return;
      }
      setAccount(data.account as AccountInfo);
      setCode("");
      setPhase("signed-in");
    } catch {
      setNotice("网络错误，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      // Cookie may already be gone; fall through to the signed-out view.
    } finally {
      setAccount(null);
      setNotice(null);
      setPhase("email");
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl px-8 py-10">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            <span className="text-3xl">👤</span> 账号
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            邮箱验证码登录。只在新设备上需要验证一次，之后 90
            天内自动保持登录；持续使用会自动续期。
          </p>

          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            {phase === "loading" && (
              <p className="text-sm text-zinc-500">正在检查登录状态…</p>
            )}

            {phase === "unconfigured" && (
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  账号系统尚未开通
                </p>
                <p>
                  需要管理员在部署平台配置邮件服务（RESEND_API_KEY）和受邀邮箱名单
                  （ZHINOTES_ACCOUNT_ALLOWED_EMAILS）后才会生效。配置前本页面不会
                  发送任何邮件，也不会写入任何云端数据。
                </p>
              </div>
            )}

            {phase === "error" && (
              <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <p>无法检查登录状态，请稍后重试。</p>
                <button
                  onClick={() => void refreshSession()}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  重试
                </button>
              </div>
            )}

            {phase === "email" && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  邮箱
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && email && !busy) {
                        void handleSendCode();
                      }
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <button
                  onClick={() => void handleSendCode()}
                  disabled={busy || !email.includes("@")}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {busy ? "发送中…" : "发送验证码"}
                </button>
                <p className="text-xs text-zinc-400">
                  仅受邀邮箱可以登录。验证码 10 分钟内有效。
                </p>
              </div>
            )}

            {phase === "code" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  验证码已发送到 <span className="font-medium">{email}</span>
                </p>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  6 位验证码
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && code.length === 6 && !busy) {
                        void handleVerify();
                      }
                    }}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    className="mt-1.5 w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleVerify()}
                    disabled={busy || code.length !== 6}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {busy ? "验证中…" : "登录"}
                  </button>
                  <button
                    onClick={() => {
                      setCode("");
                      setNotice(null);
                      setPhase("email");
                    }}
                    disabled={busy}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    换个邮箱
                  </button>
                </div>
              </div>
            )}

            {phase === "signed-in" && account && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg dark:bg-emerald-900/40">
                    ✓
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      已登录：{account.email_hint}
                    </p>
                    <p className="text-xs text-zinc-400">
                      注册于{" "}
                      {new Date(account.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void handleLogout()}
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  退出登录
                </button>
              </div>
            )}

            {notice && (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
                {notice}
              </p>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              账号能做什么
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>当前阶段：身份验证。笔记和持仓数据仍然只存在本机浏览器。</li>
              <li>下一阶段：登录后可把持仓数据按账号同步到云端，并邀请朋友共享工作区。</li>
              <li>登录只需要邮箱，不会读取或上传任何本地笔记、文件或数据库内容。</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
