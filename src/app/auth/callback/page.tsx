"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseSupabaseAuthHash,
  readCloudSession,
  writeCloudSession,
} from "@/lib/cloud/clientSession";

type CallbackState =
  | {
      status: "checking";
      title: string;
      detail: string;
    }
  | {
      status: "ready";
      title: string;
      detail: string;
    }
  | {
      status: "error";
      title: string;
      detail: string;
    };

export default function CloudAuthCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>({
    status: "checking",
    title: "正在完成登录",
    detail: "ZhiNotes 正在读取 Supabase 返回的登录结果。",
  });

  useEffect(() => {
    let redirectTimer: number | null = null;
    const effectTimer = window.setTimeout(() => {
      const result = parseSupabaseAuthHash(window.location.hash);

      if (result.status === "authenticated") {
        writeCloudSession(result.session);
        window.history.replaceState(null, "", "/auth/callback");
        setState({
          status: "ready",
          title: "云端登录已连接",
          detail: "已保存本地云 session，正在回到 Web Sync 模块。",
        });

        redirectTimer = window.setTimeout(() => {
          router.replace("/modules/sync?cloud=connected");
        }, 1200);
        return;
      }

      if (result.status === "error") {
        window.history.replaceState(null, "", "/auth/callback");
        setState({
          status: "error",
          title: "登录没有完成",
          detail: `${result.error}: ${result.description}`,
        });
        return;
      }

      const existing = readCloudSession();
      if (existing) {
        setState({
          status: "ready",
          title: "云端 session 已存在",
          detail: "浏览器里已经有本地云 session，可以回到 Web Sync 模块继续。",
        });
        return;
      }

      setState({
        status: "error",
        title: "没有找到登录结果",
        detail:
          "请从 ZhiNotes 的 Web Sync 模块重新发送登录链接，并使用同一个浏览器打开邮件链接。",
      });
    }, 0);

    return () => {
      window.clearTimeout(effectTimer);
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [router]);

  const isReady = state.status === "ready";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div
          className={`mb-4 h-1.5 w-16 rounded-full ${
            state.status === "checking"
              ? "bg-blue-500"
              : isReady
                ? "bg-green-500"
                : "bg-red-500"
          }`}
        />
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          ZhiNotes Cloud Alpha
        </p>
        <h1 className="mt-2 text-xl font-semibold">{state.title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {state.detail}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.replace("/modules/sync")}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            回到 Web Sync
          </button>
          {!isReady && (
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              回到首页
            </button>
          )}
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-400">
          这个 Alpha 回调只保存登录 token，不读取本地笔记、文件或数据库。
        </p>
      </section>
    </main>
  );
}
