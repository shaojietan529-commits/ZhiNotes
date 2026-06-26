"use client";

import { dataUrlToArrayBuffer } from "@/lib/files/dataUrl";
import { convertOdtToHtml } from "@/lib/files/openDocument";
import type { StoredPageFile } from "@/lib/files/localStore";

export async function convertWordToHtml(file: StoredPageFile) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".doc")) {
    throw new Error("暂不支持旧版 .doc 文件。请使用 .docx。");
  }

  if (lowerName.endsWith(".odt")) {
    return convertOdtToHtml(await dataUrlToArrayBuffer(file.dataUrl));
  }

  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({
    arrayBuffer: await dataUrlToArrayBuffer(file.dataUrl),
  });

  if (!result.value.trim()) {
    return "<p>这个 Word 文档没有生成可见内容。</p>";
  }

  return result.value;
}
