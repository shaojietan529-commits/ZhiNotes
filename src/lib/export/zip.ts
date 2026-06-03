"use client";

export interface ZipFileInput {
  path: string;
  data: string | Uint8Array;
  mimeType?: string;
}

interface PreparedZipFile {
  pathBytes: Uint8Array;
  dataBytes: Uint8Array;
  crc32: number;
  localHeaderOffset: number;
}

const textEncoder = new TextEncoder();
const CRC_TABLE = createCrcTable();

export function downloadZip(fileName: string, files: ZipFileInput[]) {
  const zipBytes = createZip(files);
  const blob = new Blob([zipBytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createZip(files: ZipFileInput[]) {
  const chunks: Uint8Array[] = [];
  const preparedFiles: PreparedZipFile[] = [];
  let offset = 0;

  for (const file of files) {
    const pathBytes = textEncoder.encode(normalizeZipPath(file.path));
    const dataBytes =
      typeof file.data === "string" ? textEncoder.encode(file.data) : file.data;
    const crc32 = calculateCrc32(dataBytes);
    const localHeader = createLocalFileHeader(pathBytes, dataBytes, crc32);

    preparedFiles.push({
      pathBytes,
      dataBytes,
      crc32,
      localHeaderOffset: offset,
    });
    chunks.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectoryOffset = offset;
  for (const file of preparedFiles) {
    const centralHeader = createCentralDirectoryHeader(file);
    chunks.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralDirectorySize = offset - centralDirectoryOffset;
  chunks.push(
    createEndOfCentralDirectory(
      preparedFiles.length,
      centralDirectorySize,
      centralDirectoryOffset
    )
  );

  return concatBytes(chunks);
}

function createLocalFileHeader(
  pathBytes: Uint8Array,
  dataBytes: Uint8Array,
  crc32: number
) {
  const header = new Uint8Array(30 + pathBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, getDosTime(), true);
  view.setUint16(12, getDosDate(), true);
  view.setUint32(14, crc32, true);
  view.setUint32(18, dataBytes.length, true);
  view.setUint32(22, dataBytes.length, true);
  view.setUint16(26, pathBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(pathBytes, 30);
  return header;
}

function createCentralDirectoryHeader(file: PreparedZipFile) {
  const header = new Uint8Array(46 + file.pathBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, getDosTime(), true);
  view.setUint16(14, getDosDate(), true);
  view.setUint32(16, file.crc32, true);
  view.setUint32(20, file.dataBytes.length, true);
  view.setUint32(24, file.dataBytes.length, true);
  view.setUint16(28, file.pathBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, file.localHeaderOffset, true);
  header.set(file.pathBytes, 46);
  return header;
}

function createEndOfCentralDirectory(
  fileCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);
  return header;
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function calculateCrc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function getDosTime() {
  const now = new Date();
  return (
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2)
  );
}

function getDosDate() {
  const now = new Date();
  return (
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate()
  );
}

function normalizeZipPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim().replace(/^\.|\.$/g, "") || "untitled")
    .join("/");
}
