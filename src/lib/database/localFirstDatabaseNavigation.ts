"use client";

let databaseShellWarmupPromise: Promise<unknown> | null = null;

export function warmDatabaseShellModule(): void {
  if (!databaseShellWarmupPromise) {
    databaseShellWarmupPromise = import(
      "@/components/providers/DatabasePageShell"
    ).catch(() => {
      databaseShellWarmupPromise = null;
    });
  }
}

