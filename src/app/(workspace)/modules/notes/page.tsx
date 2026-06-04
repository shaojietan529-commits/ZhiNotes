"use client";

import dynamic from "next/dynamic";

const NotesModule = dynamic(() => import("@/components/modules/NotesShell"), {
  ssr: false,
});

export default function NotesRoute() {
  return <NotesModule />;
}
