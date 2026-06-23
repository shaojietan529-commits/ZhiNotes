import Link from "next/link";
import Sidebar from "@/components/sidebar/Sidebar";

export default function RepairDailyPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl px-8 py-10">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            修复每日纪要归档
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            这个工具会扫描当前登录账号云端里散落在“页面”下的纪要页，把能识别出日期的页面移动到“每日纪要”下面，并补上“日期”属性。
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            它不会读取或展示正文内容，也不会删除页面；无法判断日期的页面会跳过。
          </p>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <a
              href="/api/pages/account-sync?action=repair-daily-imports&confirm=manual-daily-repair"
              className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              执行修复
            </a>
            <Link
              href="/daily"
              className="ml-3 inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              返回每日纪要
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
