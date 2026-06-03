"use client";

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

export interface ZipEntryInfo {
  path: string;
  compressedSize: number;
  compressionMethod: number;
}

interface CentralDirectoryEntry {
  path: string;
  compressedSize: number;
  compressionMethod: number;
  generalPurposeFlag: number;
  localHeaderOffset: number;
}

const textDecoder = new TextDecoder();
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_EOCD_MIN_SIZE = 22;
const ZIP_MAX_COMMENT_SIZE = 0xffff;

export async function readZipEntries(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const directoryEntries = readCentralDirectoryEntries(view, bytes);

  const entries: ZipEntry[] = [];

  for (const entry of directoryEntries) {
    if (entry.path.endsWith("/")) continue;

    const data = await readLocalFileData(view, bytes, entry);
    entries.push({ path: entry.path, data });
  }

  return entries;
}

export function listZipEntries(arrayBuffer: ArrayBuffer): ZipEntryInfo[] {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  return readCentralDirectoryEntries(view, bytes).map((entry) => ({
    path: entry.path,
    compressedSize: entry.compressedSize,
    compressionMethod: entry.compressionMethod,
  }));
}

function readCentralDirectoryEntries(view: DataView, bytes: Uint8Array) {
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries: CentralDirectoryEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    const directoryEntry = readCentralDirectoryEntry(view, bytes, offset);
    entries.push(directoryEntry.entry);
    offset = directoryEntry.nextOffset;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView) {
  const minOffset = Math.max(
    0,
    view.byteLength - ZIP_EOCD_MIN_SIZE - ZIP_MAX_COMMENT_SIZE
  );

  for (let offset = view.byteLength - ZIP_EOCD_MIN_SIZE; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("这个 ZIP 类文件无法解析。");
}

function readCentralDirectoryEntry(
  view: DataView,
  bytes: Uint8Array,
  offset: number
) {
  if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
    throw new Error("这个 ZIP 类文件的目录结构无效。");
  }

  const generalPurposeFlag = view.getUint16(offset + 8, true);
  const compressionMethod = view.getUint16(offset + 10, true);
  const compressedSize = view.getUint32(offset + 20, true);
  const fileNameLength = view.getUint16(offset + 28, true);
  const extraFieldLength = view.getUint16(offset + 30, true);
  const commentLength = view.getUint16(offset + 32, true);
  const localHeaderOffset = view.getUint32(offset + 42, true);
  const nameStart = offset + 46;
  const nameEnd = nameStart + fileNameLength;
  const path = textDecoder.decode(bytes.slice(nameStart, nameEnd));

  return {
    entry: {
      path,
      compressedSize,
      compressionMethod,
      generalPurposeFlag,
      localHeaderOffset,
    },
    nextOffset: nameEnd + extraFieldLength + commentLength,
  };
}

async function readLocalFileData(
  view: DataView,
  bytes: Uint8Array,
  entry: CentralDirectoryEntry
) {
  if (entry.generalPurposeFlag & 0x0001) {
    throw new Error("暂不支持加密的 ZIP 类文件。");
  }

  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error("这个 ZIP 类文件的本地文件头无效。");
  }

  const fileNameLength = view.getUint16(offset + 26, true);
  const extraFieldLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + fileNameLength + extraFieldLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return decompressRawDeflate(compressed);

  throw new Error(
    `暂不支持 ZIP 压缩方式 ${entry.compressionMethod}。`
  );
}

async function decompressRawDeflate(data: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "当前浏览器暂时无法在本地解压这个 ZIP 类文件。"
    );
  }

  const stream = new Blob([uint8ArrayToArrayBuffer(data)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function uint8ArrayToArrayBuffer(data: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(arrayBuffer).set(data);
  return arrayBuffer;
}
