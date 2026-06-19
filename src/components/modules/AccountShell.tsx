"use client";

// Email-code login surface for the multi-account system. Shows a clear
// "not configured" state until the owner enables Resend + the allowlist,
// so this page is safe to ship ahead of the cloud rollout.

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import {
  addShareEmail,
  fetchShares,
  removeShareEmail,
} from "@/lib/portfolio/accountSync";
import {
  getLastPageSyncAt,
  isPageSyncEnabled,
  reconcilePageSync,
  setPageSyncEnabled,
} from "@/lib/pages/accountPageSync";
import {
  notifyAccountProfileUpdated,
  type ClientAccountInfo,
} from "@/lib/account/clientProfile";

type Phase =
  | "loading"
  | "unconfigured"
  | "email"
  | "code"
  | "signed-in"
  | "error";

export default function AccountShell() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [account, setAccount] = useState<ClientAccountInfo | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  // Portfolio sharing: emails I shared with / owners who shared with me.
  const [shareMembers, setShareMembers] = useState<string[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<string[]>([]);
  const [shareInput, setShareInput] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  // Page cloud sync: off by default, owner flips it on per browser.
  const [pageSyncOn, setPageSyncOn] = useState(false);
  const [pageSyncBusy, setPageSyncBusy] = useState(false);
  const [pageSyncNotice, setPageSyncNotice] = useState<string | null>(null);
  const [pageSyncLastAt, setPageSyncLastAt] = useState<string | null>(null);
  // API Key for external tools (Claude, web clipper extension)
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);

  useEffect(() => {
    setPageSyncOn(isPageSyncEnabled());
    setPageSyncLastAt(getLastPageSyncAt());
  }, []);

  const setSignedInAccount = useCallback((nextAccount: ClientAccountInfo) => {
    setAccount(nextAccount);
    setDisplayNameInput(nextAccount.display_name);
    notifyAccountProfileUpdated();
  }, []);

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
        setSignedInAccount(data.account as ClientAccountInfo);
        setPhase("signed-in");
      } else {
        setPhase("email");
      }
    } catch {
      setPhase("error");
    }
  }, [setSignedInAccount]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Load sharing lists once signed in.
  useEffect(() => {
    if (phase !== "signed-in") return;
    void fetchShares().then((result) => {
      if (result.status === "ok") {
        setShareMembers(result.data.members);
        setSharedWithMe(result.data.sharedWithMe);
      }
    });
    // Load existing API key
    void fetch("/api/pages/ingest?action=current")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setApiKey(d.apiKey); })
      .catch(() => {});
  }, [phase]);

  async function handleShareAdd() {
    const email = shareInput.trim().toLowerCase();
    if (!email.includes("@")) return;
    setShareBusy(true);
    setShareNotice(null);
    const result = await addShareEmail(email);
    if (result.status === "ok") {
      setShareMembers(result.data);
      setShareInput("");
      setShareNotice("已共享。对方登录后在组合管理页可以切换查看你的持仓。");
    } else {
      setShareNotice(
        result.status === "error" && result.message
          ? result.message
          : "共享失败，请稍后重试。"
      );
    }
    setShareBusy(false);
  }

  async function handleShareRemove(email: string) {
    setShareBusy(true);
    setShareNotice(null);
    const result = await removeShareEmail(email);
    if (result.status === "ok") {
      setShareMembers(result.data);
    } else {
      setShareNotice("移除失败，请稍后重试。");
    }
    setShareBusy(false);
  }

  async function handlePageSyncRun() {
    setPageSyncBusy(true);
    setPageSyncNotice(null);
    const result = await reconcilePageSync();
    if (result.status === "ok") {
      setPageSyncLastAt(getLastPageSyncAt());
      setPageSyncNotice(
        `同步完成：拉取 ${result.pulled} 页，推送 ${result.pushed} 页。`
      );
    } else if (result.status === "unauthenticated") {
      setPageSyncNotice("登录已过期，请重新登录后再同步。");
    } else if (result.status === "disabled") {
      setPageSyncNotice("请先打开页面云同步开关。");
    } else {
      setPageSyncNotice(result.message ?? "同步失败，请稍后重试。");
    }
    setPageSyncBusy(false);
  }

  function handlePageSyncToggle() {
    const next = !pageSyncOn;
    if (next) {
      const ok = window.confirm(
        "开启后，本浏览器的页面（标题、正文、层级、属性、封面）会上传到你账号的云端存储，并和其他登录了同一账号的浏览器双向同步。数据库表格、本地文件不会上传。确定开启吗？"
      );
      if (!ok) return;
    }
    setPageSyncEnabled(next);
    setPageSyncOn(next);
    setPageSyncNotice(
      next ? "已开启。首次同步会在后台自动进行。" : "已关闭。云端已有数据保留，不再继续同步。"
    );
    if (next) {
      void handlePageSyncRun();
    }
  }

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
      setSignedInAccount(data.account as ClientAccountInfo);
      setCode("");
      setPhase("signed-in");
    } catch {
      setNotice("网络错误，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisplayNameSave() {
    const displayName = displayNameInput.trim().replace(/\s+/g, " ");
    if (!displayName) {
      setProfileNotice("用户名不能为空。");
      return;
    }
    setProfileBusy(true);
    setProfileNotice(null);
    try {
      const res = await fetch("/api/account/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileNotice(data.error ?? "用户名保存失败，请稍后重试。");
        return;
      }
      setSignedInAccount(data.account as ClientAccountInfo);
      setProfileNotice("用户名已保存。");
    } catch {
      setProfileNotice("网络错误，请稍后重试。");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleGenerateApiKey() {
    setApiKeyBusy(true);
    setApiKeyNotice(null);
    try {
      const res = await fetch("/api/pages/ingest?action=generate");
      const data = await res.json();
      if (res.ok && data.ok) {
        setApiKey(data.apiKey);
        setApiKeyNotice("已生成新密钥（旧密钥已失效）。");
      } else {
        setApiKeyNotice(data.error ?? "生成失败。");
      }
    } catch {
      setApiKeyNotice("网络错误。");
    } finally {
      setApiKeyBusy(false);
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
      setDisplayNameInput("");
      notifyAccountProfileUpdated();
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
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg dark:bg-emerald-900/40">
                    ✓
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      已登录：{account.display_name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {account.email_hint} · 注册于{" "}
                      {new Date(account.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    用户名
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !profileBusy) {
                            void handleDisplayNameSave();
                          }
                        }}
                        maxLength={32}
                        placeholder="输入你想显示的名字"
                        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      <button
                        onClick={() => void handleDisplayNameSave()}
                        disabled={
                          profileBusy ||
                          displayNameInput.trim() === account.display_name
                        }
                        className="shrink-0 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        {profileBusy ? "保存中…" : "保存"}
                      </button>
                    </div>
                  </label>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-400">
                    保存后，左侧栏会显示这个用户名；每个邮箱账号可以有自己的用户名。
                  </p>
                  {profileNotice && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      {profileNotice}
                    </p>
                  )}
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

          {phase === "signed-in" && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                持仓共享
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                把你的组合管理数据共享给指定邮箱（只读）。对方需要在登录白名单内。
              </p>

              <div className="mt-4 flex items-center gap-2">
                <input
                  type="email"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !shareBusy) void handleShareAdd();
                  }}
                  placeholder="friend@example.com"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  onClick={() => void handleShareAdd()}
                  disabled={shareBusy || !shareInput.includes("@")}
                  className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  共享
                </button>
              </div>

              {shareNotice && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {shareNotice}
                </p>
              )}

              {shareMembers.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {shareMembers.map((email) => (
                    <li
                      key={email}
                      className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                    >
                      <span className="truncate">{email}</span>
                      <button
                        onClick={() => void handleShareRemove(email)}
                        disabled={shareBusy}
                        className="ml-3 shrink-0 text-xs text-zinc-400 hover:text-rose-500"
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sharedWithMe.length > 0 && (
                <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    共享给我的持仓
                  </p>
                  <ul className="mt-2 space-y-1">
                    {sharedWithMe.map((email) => (
                      <li
                        key={email}
                        className="text-sm text-zinc-600 dark:text-zinc-300"
                      >
                        {email} —— 在组合管理页右上角可切换查看
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {phase === "signed-in" && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    页面云同步
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    默认开启：页面与会议安排（标题、正文、层级、属性、封面）跟随账号
                    实时云端同步，登录同一账号的两个域名 / 多台设备会自动保持一致。
                    切换标签页或几秒内即会自动对齐，也可点“立即同步”。
                  </p>
                </div>
                <button
                  onClick={handlePageSyncToggle}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    pageSyncOn
                      ? "bg-emerald-500"
                      : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  role="switch"
                  aria-checked={pageSyncOn}
                  title={pageSyncOn ? "关闭页面云同步" : "开启页面云同步"}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      pageSyncOn ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {pageSyncOn && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => void handlePageSyncRun()}
                    disabled={pageSyncBusy}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {pageSyncBusy ? "同步中…" : "立即同步"}
                  </button>
                  {pageSyncLastAt && (
                    <span className="text-xs text-zinc-400">
                      上次同步：
                      {new Date(pageSyncLastAt).toLocaleString("zh-CN")}
                    </span>
                  )}
                </div>
              )}

              {pageSyncNotice && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {pageSyncNotice}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                不上传：数据库表格、本地文件、评论、版本历史。同步走你自己的
                Upstash 云存储，只有登录此账号的浏览器能读取。冲突时保留较新的修改。
              </p>
            </div>
          )}

          {phase === "signed-in" && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                API 密钥
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                用于外部工具（如 Claude、浏览器扩展）通过 API 保存内容到 ZhiNotes。
              </p>

              {apiKey ? (
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {apiKey}
                  </code>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(apiKey);
                      setApiKeyNotice("已复制到剪贴板。");
                      setTimeout(() => setApiKeyNotice(null), 2000);
                    }}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    复制
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">尚未生成密���。</p>
              )}

              <button
                onClick={() => void handleGenerateApiKey()}
                disabled={apiKeyBusy}
                className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {apiKeyBusy
                  ? "生成中…"
                  : apiKey
                    ? "重新生成（旧密钥失效）"
                    : "生成 API 密钥"}
              </button>

              {apiKeyNotice && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {apiKeyNotice}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                使用方法：POST /api/pages/ingest，Header 加上 Authorization: Bearer
                你的密钥，Body 传 {`{title, content}`}。保存的内容默认进入「每日纪要」
                当天那一栏；浏览器扩展可在设置里填入此密钥。
              </p>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              账号能做什么
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>登录后，组合管理的数据自动跟随账号云同步，任何设备登录都能看到同一份。</li>
              <li>可以把持仓共享给指定邮箱（只读），对方登录后即可查看。</li>
              <li>页面与会议安排默认实时云同步，登录同一账号的设备自动保持一致，可随时关闭。</li>
              <li>生成 API 密钥后，可用外部工具（Claude 等）或浏览器扩展一键保存内容到 ZhiNotes。</li>
              <li>数据库表格和本地文件始终只存在本机浏览器，不会上传。</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
