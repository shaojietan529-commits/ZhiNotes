"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchPages } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";

export default function QuickSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Page[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSearch = useCallback(async (value: string) => {
    setQuery(value);
    if (value.trim().length === 0) {
      setResults([]);
      return;
    }
    const found = await searchPages(value.trim());
    setResults(found);
  }, []);

  const handleSelect = (pageId: string) => {
    router.push(`/page/${pageId}`);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search pages..."
        className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500"
      />
      {open && results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {results.map((page) => (
            <li key={page.id}>
              <button
                onMouseDown={() => handleSelect(page.id)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              >
                <span className="mr-2">{page.icon || "📄"}</span>
                {page.title || "Untitled"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
