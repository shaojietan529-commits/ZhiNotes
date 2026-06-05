"use client";

import { nanoid } from "nanoid";

const DB_NAME = "zhinote-files";
const DB_VERSION = 1;
const STORE_NAME = "files";
const TEXT_FILE_EXTENSIONS = [
  ".txt",
  ".text",
  ".log",
  ".lock",
  ".json",
  ".jsonl",
  ".ipynb",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".conf",
  ".properties",
  ".env",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".vue",
  ".svelte",
  ".css",
  ".scss",
  ".less",
  ".sql",
  ".graphql",
  ".gql",
  ".py",
  ".r",
  ".sh",
  ".bash",
  ".zsh",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".kts",
  ".dart",
  ".lua",
  ".pl",
  ".pm",
  ".proto",
  ".gradle",
];
const TEXT_FILE_NAMES = [
  ".babelrc",
  ".dockerignore",
  ".editorconfig",
  ".env",
  ".eslintrc",
  ".gitignore",
  ".npmrc",
  ".prettierrc",
  ".yarnrc",
  "dockerfile",
  "gemfile",
  "makefile",
  "procfile",
  "rakefile",
];

export type PageFileKind =
  | "html"
  | "markdown"
  | "opml"
  | "rtf"
  | "epub"
  | "archive"
  | "pdf"
  | "image"
  | "audio"
  | "video"
  | "text"
  | "notebook"
  | "spreadsheet"
  | "word"
  | "presentation"
  | "unknown";

export interface StoredPageFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: PageFileKind;
  dataUrl: string;
  textContent?: string;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openFilesDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前浏览器不支持 IndexedDB，无法在本地保存文件。"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isTextReadable(kind: PageFileKind, mimeType: string) {
  return (
    kind === "html" ||
    kind === "markdown" ||
    kind === "opml" ||
    kind === "rtf" ||
    kind === "notebook" ||
    kind === "text" ||
    mimeType.startsWith("text/")
  );
}

export function getPageFileKind(name: string, mimeType: string): PageFileKind {
  const lowerName = name.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (
    lowerMime === "text/html" ||
    lowerMime === "application/xhtml+xml" ||
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm") ||
    lowerName.endsWith(".xhtml")
  ) {
    return "html";
  }

  if (
    lowerMime === "text/markdown" ||
    lowerMime === "text/x-markdown" ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    lowerName.endsWith(".mdx") ||
    lowerName.endsWith(".mdown") ||
    lowerName.endsWith(".mkd") ||
    lowerName.endsWith(".mkdn")
  ) {
    return "markdown";
  }

  if (lowerName.endsWith(".opml") || lowerMime === "text/x-opml") {
    return "opml";
  }

  if (
    lowerName.endsWith(".rtf") ||
    lowerMime === "application/rtf" ||
    lowerMime === "text/rtf" ||
    lowerMime === "application/x-rtf"
  ) {
    return "rtf";
  }

  if (
    lowerName.endsWith(".epub") ||
    lowerMime === "application/epub+zip"
  ) {
    return "epub";
  }

  if (lowerName.endsWith(".ipynb") || lowerMime.includes("notebook")) {
    return "notebook";
  }

  if (
    lowerName.endsWith(".zip") ||
    lowerMime === "application/zip" ||
    lowerMime === "application/x-zip-compressed"
  ) {
    return "archive";
  }

  if (lowerMime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    lowerMime.startsWith("image/") ||
    [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".svg",
      ".bmp",
      ".ico",
      ".avif",
      ".heic",
      ".heif",
    ].some((extension) => lowerName.endsWith(extension))
  ) {
    return "image";
  }

  if (
    lowerMime.startsWith("audio/") ||
    [".mp3", ".wav", ".m4a", ".ogg", ".oga", ".flac", ".aac"].some(
      (extension) => lowerName.endsWith(extension)
    )
  ) {
    return "audio";
  }

  if (
    lowerMime.startsWith("video/") ||
    [".mp4", ".mov", ".m4v", ".webm", ".ogv", ".avi", ".mkv"].some(
      (extension) => lowerName.endsWith(extension)
    )
  ) {
    return "video";
  }

  if (
    isTextLikeFileName(lowerName) ||
    lowerMime.includes("json") ||
    lowerMime.includes("xml") ||
    lowerMime.includes("yaml") ||
    lowerMime.includes("toml") ||
    lowerMime.includes("graphql")
  ) {
    return "text";
  }

  if (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".tsv") ||
    lowerName.endsWith(".ods") ||
    lowerMime.includes("spreadsheet") ||
    lowerMime.includes("excel") ||
    lowerMime === "text/tab-separated-values" ||
    lowerMime === "application/vnd.oasis.opendocument.spreadsheet"
  ) {
    return "spreadsheet";
  }

  if (
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".odt") ||
    lowerMime.includes("wordprocessingml") ||
    lowerMime.includes("msword") ||
    lowerMime === "application/vnd.oasis.opendocument.text"
  ) {
    return "word";
  }

  if (
    lowerName.endsWith(".pptx") ||
    lowerName.endsWith(".ppt") ||
    lowerName.endsWith(".odp") ||
    lowerMime.includes("presentationml") ||
    lowerMime.includes("powerpoint") ||
    lowerMime === "application/vnd.oasis.opendocument.presentation"
  ) {
    return "presentation";
  }

  if (lowerMime.startsWith("text/")) {
    return "text";
  }

  return "unknown";
}

function isTextLikeFileName(lowerName: string) {
  const baseName = lowerName.split(/[\\/]/).pop() ?? lowerName;
  return (
    TEXT_FILE_EXTENSIONS.some((extension) => baseName.endsWith(extension)) ||
    TEXT_FILE_NAMES.includes(baseName) ||
    baseName.startsWith(".env.") ||
    baseName.startsWith("dockerfile.")
  );
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export async function savePageFile(file: File): Promise<StoredPageFile> {
  const kind = getPageFileKind(file.name, file.type);
  const dataUrl = await readAsDataUrl(file);
  const textContent = isTextReadable(kind, file.type)
    ? await file.text()
    : undefined;

  const storedFile: StoredPageFile = {
    id: nanoid(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind,
    dataUrl,
    textContent,
    createdAt: new Date().toISOString(),
  };

  const db = await openFilesDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(storedFile);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return storedFile;
}

export async function getStoredPageFile(
  id: string
): Promise<StoredPageFile | null> {
  const db = await openFilesDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () =>
      resolve((request.result as StoredPageFile | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function listStoredPageFiles(): Promise<StoredPageFile[]> {
  const db = await openFilesDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredPageFile[]);
    request.onerror = () => reject(request.error);
  });
}
