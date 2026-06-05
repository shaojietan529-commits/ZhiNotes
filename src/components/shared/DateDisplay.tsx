"use client";

import { formatFullDate, formatRelativeDate } from "@/lib/utils/dates";

interface DateDisplayProps {
  createdAt: string;
  updatedAt: string;
}

export default function DateDisplay({ createdAt, updatedAt }: DateDisplayProps) {
  return (
    <div className="flex items-center gap-4 text-xs text-zinc-400">
      <span title={formatFullDate(createdAt)}>
        创建于 {formatFullDate(createdAt)}
      </span>
      <span title={formatFullDate(updatedAt)}>
        更新于 {formatRelativeDate(updatedAt)}
      </span>
    </div>
  );
}
