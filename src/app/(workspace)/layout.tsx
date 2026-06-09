"use client";

import DatabaseProvider from "@/components/providers/DatabaseProvider";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DatabaseProvider>{children}</DatabaseProvider>;
}
