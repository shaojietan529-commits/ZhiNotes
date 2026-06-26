"use client";

import { dataUrlToArrayBuffer } from "@/lib/files/dataUrl";
import { convertOdpToHtml } from "@/lib/files/openDocument";
import { convertPptxToHtml } from "@/lib/files/presentation";
import type { StoredPageFile } from "@/lib/files/localStore";

export async function convertPresentationToHtml(file: StoredPageFile) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".ppt")) {
    throw new Error("暂不支持旧版 .ppt 文件。请使用 .pptx。");
  }

  if (lowerName.endsWith(".odp")) {
    return convertOdpToHtml(await dataUrlToArrayBuffer(file.dataUrl));
  }

  if (!lowerName.endsWith(".pptx")) {
    throw new Error("暂不支持这个演示文稿格式。");
  }

  return convertPptxToHtml(await dataUrlToArrayBuffer(file.dataUrl));
}
