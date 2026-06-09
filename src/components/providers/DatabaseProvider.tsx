"use client";

import { useLocalDb } from "@/hooks/useLocalDb";

export default function DatabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dbReady } = useLocalDb();

  if (!dbReady) {
    return null;
  }

  return <>{children}</>;
}
