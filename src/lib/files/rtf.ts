const RTF_SKIPPED_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "datafield",
  "themedata",
  "xmlnstbl",
  "generator",
  "nonshppict",
  "shp",
  "shptxt",
  "filetbl",
  "listtable",
  "listoverridetable",
  "rsidtbl",
  "latentstyles",
]);

const RTF_HEX_BYTE_FALLBACK: Record<number, string> = {
  0x85: "...",
  0x91: "'",
  0x92: "'",
  0x93: '"',
  0x94: '"',
  0x96: "-",
  0x97: "--",
};

export function convertRtfToHtml(rtf: string) {
  const text = rtfToPlainText(rtf);
  if (!text.trim()) {
    return "<p>这个 RTF 文件没有生成可见内容。</p>";
  }

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line).replace(/\t/g, "    ")}</p>`)
    .join("");
}

function rtfToPlainText(rtf: string) {
  let output = "";
  let index = 0;
  let skipDepth = 0;
  let unicodeFallbackLength = 1;
  const groupSkipStack: boolean[] = [];

  while (index < rtf.length) {
    const char = rtf[index];

    if (char === "{") {
      const destination = readRtfGroupDestination(rtf, index + 1);
      const shouldSkip =
        skipDepth > 0 ||
        destination.unknown ||
        (destination.name
          ? RTF_SKIPPED_DESTINATIONS.has(destination.name)
          : false);
      groupSkipStack.push(shouldSkip);
      if (shouldSkip) skipDepth += 1;
      index += 1;
      continue;
    }

    if (char === "}") {
      const wasSkipping = groupSkipStack.pop();
      if (wasSkipping) skipDepth = Math.max(0, skipDepth - 1);
      index += 1;
      continue;
    }

    if (skipDepth > 0) {
      index = skipRtfToken(rtf, index);
      continue;
    }

    if (char === "\\") {
      const parsed = readRtfControl(rtf, index, unicodeFallbackLength);
      output += parsed.text;
      unicodeFallbackLength = parsed.unicodeFallbackLength;
      index = parsed.nextIndex;
      continue;
    }

    if (char !== "\r" && char !== "\n") {
      output += char;
    }
    index += 1;
  }

  return output
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readRtfGroupDestination(rtf: string, index: number) {
  let cursor = index;
  let unknown = false;

  if (rtf[cursor] !== "\\") return { name: "", unknown };
  cursor += 1;

  if (rtf[cursor] === "*") {
    unknown = true;
    cursor += 1;
    if (rtf[cursor] === "\\") cursor += 1;
  }

  const match = rtf.slice(cursor).match(/^[a-zA-Z]+/);
  return { name: match?.[0].toLowerCase() ?? "", unknown };
}

function skipRtfToken(rtf: string, index: number) {
  if (rtf[index] === "\\" && rtf[index + 1] === "'") return index + 4;
  return index + 1;
}

function readRtfControl(
  rtf: string,
  startIndex: number,
  unicodeFallbackLength: number
) {
  const next = rtf[startIndex + 1];

  if (!next) {
    return { text: "", nextIndex: startIndex + 1, unicodeFallbackLength };
  }

  if (next === "\\" || next === "{" || next === "}") {
    return {
      text: next,
      nextIndex: startIndex + 2,
      unicodeFallbackLength,
    };
  }

  if (next === "~") {
    return { text: " ", nextIndex: startIndex + 2, unicodeFallbackLength };
  }

  if (next === "-") {
    return { text: "", nextIndex: startIndex + 2, unicodeFallbackLength };
  }

  if (next === "_") {
    return { text: "-", nextIndex: startIndex + 2, unicodeFallbackLength };
  }

  if (next === "'") {
    const hex = rtf.slice(startIndex + 2, startIndex + 4);
    const byte = Number.parseInt(hex, 16);
    return {
      text: Number.isFinite(byte)
        ? RTF_HEX_BYTE_FALLBACK[byte] ?? String.fromCharCode(byte)
        : "",
      nextIndex: startIndex + 4,
      unicodeFallbackLength,
    };
  }

  const controlMatch = rtf.slice(startIndex + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
  if (!controlMatch) {
    return { text: "", nextIndex: startIndex + 2, unicodeFallbackLength };
  }

  const [, word, parameter] = controlMatch;
  let nextIndex = startIndex + 1 + controlMatch[0].length;
  let fallbackLength = unicodeFallbackLength;
  const controlWord = word.toLowerCase();

  switch (controlWord) {
    case "par":
    case "line":
      return { text: "\n", nextIndex, unicodeFallbackLength: fallbackLength };
    case "tab":
      return { text: "\t", nextIndex, unicodeFallbackLength: fallbackLength };
    case "bullet":
      return { text: "* ", nextIndex, unicodeFallbackLength: fallbackLength };
    case "emdash":
      return { text: "--", nextIndex, unicodeFallbackLength: fallbackLength };
    case "endash":
      return { text: "-", nextIndex, unicodeFallbackLength: fallbackLength };
    case "lquote":
    case "rquote":
      return { text: "'", nextIndex, unicodeFallbackLength: fallbackLength };
    case "ldblquote":
    case "rdblquote":
      return { text: '"', nextIndex, unicodeFallbackLength: fallbackLength };
    case "uc":
      fallbackLength = Math.max(0, Number.parseInt(parameter ?? "1", 10) || 0);
      return { text: "", nextIndex, unicodeFallbackLength: fallbackLength };
    case "u": {
      const parsedCodePoint = Number.parseInt(parameter ?? "", 10);
      const codePoint =
        parsedCodePoint < 0 ? parsedCodePoint + 65536 : parsedCodePoint;
      const text =
        Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : "";
      nextIndex = skipRtfUnicodeFallback(rtf, nextIndex, fallbackLength);
      return { text, nextIndex, unicodeFallbackLength: fallbackLength };
    }
    default:
      return { text: "", nextIndex, unicodeFallbackLength: fallbackLength };
  }
}

function skipRtfUnicodeFallback(
  rtf: string,
  index: number,
  fallbackLength: number
) {
  let cursor = index;
  for (
    let skipped = 0;
    skipped < fallbackLength && cursor < rtf.length;
    skipped += 1
  ) {
    if (rtf[cursor] === "\\" && rtf[cursor + 1] === "'") {
      cursor += 4;
    } else {
      cursor += 1;
    }
  }
  return cursor;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
