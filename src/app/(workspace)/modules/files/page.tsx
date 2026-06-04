"use client";

import dynamic from "next/dynamic";

const FilesModule = dynamic(() => import("@/components/modules/FilesShell"), {
  ssr: false,
});

export default function FilesRoute() {
  return <FilesModule />;
}
