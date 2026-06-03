export type CodeTokenKind =
  | "attribute"
  | "builtin"
  | "comment"
  | "function"
  | "keyword"
  | "literal"
  | "number"
  | "operator"
  | "property"
  | "string"
  | "tag";

export interface CodeHighlightToken {
  start: number;
  end: number;
  kind: CodeTokenKind;
}

interface LanguageConfig {
  keywords: Set<string>;
  literals: Set<string>;
  builtins: Set<string>;
  lineComments: string[];
  blockComments: Array<[string, string]>;
  propertyWords?: boolean;
  stringProperties?: boolean;
}

const JS_KEYWORDS = [
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "set",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
];

const TS_KEYWORDS = [
  ...JS_KEYWORDS,
  "as",
  "declare",
  "enum",
  "implements",
  "interface",
  "keyof",
  "namespace",
  "private",
  "protected",
  "public",
  "readonly",
  "satisfies",
  "type",
];

const PYTHON_KEYWORDS = [
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
];

const SQL_KEYWORDS = [
  "add",
  "alter",
  "and",
  "as",
  "asc",
  "between",
  "by",
  "case",
  "create",
  "delete",
  "desc",
  "distinct",
  "drop",
  "else",
  "end",
  "from",
  "group",
  "having",
  "in",
  "inner",
  "insert",
  "into",
  "is",
  "join",
  "left",
  "like",
  "limit",
  "not",
  "null",
  "on",
  "or",
  "order",
  "outer",
  "right",
  "select",
  "set",
  "table",
  "then",
  "union",
  "update",
  "values",
  "when",
  "where",
  "with",
];

const CSS_KEYWORDS = [
  "align-items",
  "background",
  "border",
  "color",
  "content",
  "display",
  "flex",
  "font",
  "gap",
  "grid",
  "height",
  "justify-content",
  "margin",
  "padding",
  "position",
  "width",
];

const BUILTINS = [
  "Array",
  "Boolean",
  "Date",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Set",
  "String",
  "console",
  "document",
  "window",
];

const PYTHON_BUILTINS = [
  "dict",
  "enumerate",
  "float",
  "int",
  "len",
  "list",
  "print",
  "range",
  "set",
  "str",
  "tuple",
];

const C_LIKE_KEYWORDS = [
  "abstract",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "defer",
  "do",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "for",
  "func",
  "function",
  "go",
  "if",
  "implements",
  "import",
  "interface",
  "let",
  "match",
  "mut",
  "namespace",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "struct",
  "switch",
  "throw",
  "trait",
  "try",
  "type",
  "using",
  "var",
  "while",
];

const RUBY_KEYWORDS = [
  "alias",
  "and",
  "begin",
  "break",
  "case",
  "class",
  "def",
  "defined",
  "do",
  "else",
  "elsif",
  "end",
  "ensure",
  "for",
  "if",
  "in",
  "module",
  "next",
  "not",
  "or",
  "redo",
  "rescue",
  "retry",
  "return",
  "self",
  "super",
  "then",
  "unless",
  "until",
  "when",
  "while",
  "yield",
];

const GRAPHQL_KEYWORDS = [
  "directive",
  "enum",
  "extend",
  "fragment",
  "implements",
  "input",
  "interface",
  "mutation",
  "on",
  "query",
  "scalar",
  "schema",
  "subscription",
  "type",
  "union",
];

const DOCKERFILE_KEYWORDS = [
  "add",
  "arg",
  "cmd",
  "copy",
  "entrypoint",
  "env",
  "expose",
  "from",
  "healthcheck",
  "label",
  "maintainer",
  "onbuild",
  "run",
  "shell",
  "stopsignal",
  "user",
  "volume",
  "workdir",
];

const LUA_KEYWORDS = [
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "until",
  "while",
];

const PERL_KEYWORDS = [
  "elsif",
  "else",
  "foreach",
  "if",
  "last",
  "my",
  "next",
  "our",
  "package",
  "redo",
  "return",
  "sub",
  "unless",
  "until",
  "use",
  "while",
];

const PROTOBUF_KEYWORDS = [
  "enum",
  "extend",
  "extensions",
  "import",
  "map",
  "message",
  "oneof",
  "option",
  "optional",
  "package",
  "repeated",
  "required",
  "reserved",
  "returns",
  "rpc",
  "service",
  "syntax",
];

const LANGUAGE_ALIASES: Record<string, string> = {
  "c++": "cpp",
  cjs: "javascript",
  cc: "cpp",
  cxx: "cpp",
  docker: "dockerfile",
  gql: "graphql",
  golang: "go",
  gradle: "groovy",
  htm: "html",
  js: "javascript",
  jsx: "javascript",
  kt: "kotlin",
  kts: "kotlin",
  md: "markdown",
  mjs: "javascript",
  mts: "typescript",
  pl: "perl",
  pm: "perl",
  proto: "protobuf",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  vue: "html",
  yml: "yaml",
};

export function normalizeCodeLanguage(language: string | null | undefined) {
  const normalized = (language ?? "")
    .trim()
    .toLowerCase()
    .replace(/^language-/, "");
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

export function findCodeHighlightTokens(
  code: string,
  rawLanguage: string | null | undefined
): CodeHighlightToken[] {
  const language = normalizeCodeLanguage(rawLanguage);
  if (!code.trim()) return [];
  if (!language || language === "plain" || language === "text") return [];
  if (language === "html" || language === "xml") return tokenizeMarkup(code);
  if (language === "markdown") return tokenizeMarkdown(code);
  return tokenizeGeneric(code, getLanguageConfig(language));
}

export function highlightCodeToHtml(
  code: string,
  rawLanguage: string | null | undefined
) {
  const tokens = findCodeHighlightTokens(code, rawLanguage);
  if (!tokens.length) return escapeHtml(code);

  let cursor = 0;
  let html = "";
  for (const token of tokens) {
    if (token.start < cursor || token.end <= token.start) continue;
    html += escapeHtml(code.slice(cursor, token.start));
    html += `<span class="zhinote-code-token zhinote-code-${token.kind}">${escapeHtml(
      code.slice(token.start, token.end)
    )}</span>`;
    cursor = token.end;
  }
  html += escapeHtml(code.slice(cursor));
  return html;
}

function tokenizeGeneric(code: string, config: LanguageConfig) {
  const tokens: CodeHighlightToken[] = [];
  let index = 0;

  while (index < code.length) {
    const blockComment = findBlockComment(code, index, config.blockComments);
    if (blockComment) {
      addToken(tokens, index, blockComment, "comment");
      index = blockComment;
      continue;
    }

    const lineComment = findLineComment(code, index, config.lineComments);
    if (lineComment) {
      addToken(tokens, index, lineComment, "comment");
      index = lineComment;
      continue;
    }

    const stringEnd = findString(code, index);
    if (stringEnd) {
      const kind = config.stringProperties && isPropertyString(code, stringEnd)
        ? "property"
        : "string";
      addToken(tokens, index, stringEnd, kind);
      index = stringEnd;
      continue;
    }

    const numberMatch = code.slice(index).match(/^0x[\da-f]+|^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
    if (numberMatch) {
      addToken(tokens, index, index + numberMatch[0].length, "number");
      index += numberMatch[0].length;
      continue;
    }

    const wordMatch = code.slice(index).match(/^[A-Za-z_$][\w$-]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const lowerWord = word.toLowerCase();
      const end = index + word.length;
      if (config.keywords.has(lowerWord)) {
        addToken(tokens, index, end, "keyword");
      } else if (config.literals.has(lowerWord)) {
        addToken(tokens, index, end, "literal");
      } else if (config.builtins.has(word) || config.builtins.has(lowerWord)) {
        addToken(tokens, index, end, "builtin");
      } else if (config.propertyWords && isPropertyWord(code, index, end)) {
        addToken(tokens, index, end, "property");
      } else if (isFunctionWord(code, end)) {
        addToken(tokens, index, end, "function");
      }
      index = end;
      continue;
    }

    if (/[{}()[\].,;:+*/%<>=!&|?-]/.test(code[index])) {
      addToken(tokens, index, index + 1, "operator");
    }
    index += 1;
  }

  return tokens;
}

function tokenizeMarkup(code: string) {
  const tokens: CodeHighlightToken[] = [];
  const pattern = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>\n]*(?:>|$)|&[A-Za-z0-9#]+;/g;
  for (const match of code.matchAll(pattern)) {
    const start = match.index ?? 0;
    const value = match[0];
    if (value.startsWith("<!--")) {
      addToken(tokens, start, start + value.length, "comment");
      continue;
    }
    if (value.startsWith("&")) {
      addToken(tokens, start, start + value.length, "literal");
      continue;
    }

    const tagName = value.match(/^<\/?\s*([A-Za-z][\w:-]*)/);
    if (tagName?.[1]) {
      const tagStart = start + value.indexOf(tagName[1]);
      addToken(tokens, tagStart, tagStart + tagName[1].length, "tag");
    }

    for (const attr of value.matchAll(/\s([A-Za-z_:][\w:.-]*)(?=\s*=|\s|\/?>)/g)) {
      const attrStart = start + (attr.index ?? 0) + 1;
      addToken(tokens, attrStart, attrStart + attr[1].length, "attribute");
    }

    for (const quoted of value.matchAll(/"[^"]*"|'[^']*'/g)) {
      const quotedStart = start + (quoted.index ?? 0);
      addToken(tokens, quotedStart, quotedStart + quoted[0].length, "string");
    }
  }
  return discardOverlaps(tokens);
}

function tokenizeMarkdown(code: string) {
  const tokens: CodeHighlightToken[] = [];
  let offset = 0;
  for (const line of code.split(/(\n)/)) {
    if (line === "\n") {
      offset += line.length;
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s/);
    if (heading) addToken(tokens, offset, offset + heading[1].length, "keyword");
    const list = line.match(/^\s{0,3}([-*+]|\d+\.)\s/);
    if (list) {
      const markerStart = offset + line.indexOf(list[1]);
      addToken(tokens, markerStart, markerStart + list[1].length, "operator");
    }
    const fence = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fence) addToken(tokens, offset, offset + line.length, "comment");
    for (const inlineCode of line.matchAll(/`[^`]+`/g)) {
      const start = offset + (inlineCode.index ?? 0);
      addToken(tokens, start, start + inlineCode[0].length, "string");
    }
    for (const link of line.matchAll(/\[[^\]]+\]\([^)]+\)/g)) {
      const start = offset + (link.index ?? 0);
      addToken(tokens, start, start + link[0].length, "literal");
    }
    offset += line.length;
  }
  return discardOverlaps(tokens);
}

function getLanguageConfig(language: string): LanguageConfig {
  if (language === "javascript") {
    return {
      keywords: toSet(JS_KEYWORDS),
      literals: toSet(["false", "null", "true", "undefined"]),
      builtins: toSet(BUILTINS),
      lineComments: ["//"],
      blockComments: [["/*", "*/"]],
      propertyWords: true,
    };
  }
  if (language === "typescript") {
    return {
      keywords: toSet(TS_KEYWORDS),
      literals: toSet(["false", "null", "true", "undefined"]),
      builtins: toSet(BUILTINS),
      lineComments: ["//"],
      blockComments: [["/*", "*/"]],
      propertyWords: true,
    };
  }
  if (language === "python") {
    return {
      keywords: toSet(PYTHON_KEYWORDS),
      literals: toSet(["false", "none", "true"]),
      builtins: toSet(PYTHON_BUILTINS),
      lineComments: ["#"],
      blockComments: [
        ["'''", "'''"],
        ['"""', '"""'],
      ],
    };
  }
  if (language === "sql") {
    return {
      keywords: toSet(SQL_KEYWORDS),
      literals: toSet(["false", "null", "true"]),
      builtins: toSet(["avg", "count", "max", "min", "sum"]),
      lineComments: ["--"],
      blockComments: [["/*", "*/"]],
    };
  }
  if (language === "css") {
    return {
      keywords: toSet(CSS_KEYWORDS),
      literals: toSet(["auto", "block", "flex", "grid", "none", "relative", "solid"]),
      builtins: toSet(["calc", "clamp", "minmax", "rgb", "rgba", "var"]),
      lineComments: [],
      blockComments: [["/*", "*/"]],
      propertyWords: true,
    };
  }
  if (language === "json") {
    return {
      keywords: new Set(),
      literals: toSet(["false", "null", "true"]),
      builtins: new Set(),
      lineComments: [],
      blockComments: [],
      propertyWords: true,
      stringProperties: true,
    };
  }
  if (language === "bash" || language === "yaml") {
    return {
      keywords: toSet([
        "case",
        "do",
        "done",
        "elif",
        "else",
        "esac",
        "fi",
        "for",
        "function",
        "if",
        "in",
        "then",
        "while",
      ]),
      literals: toSet(["false", "null", "true"]),
      builtins: toSet(["cat", "cd", "curl", "echo", "export", "grep", "ls", "mkdir", "npm", "pnpm", "rg"]),
      lineComments: ["#"],
      blockComments: [],
      propertyWords: language === "yaml",
    };
  }
  if (language === "toml" || language === "ini") {
    return {
      keywords: new Set(),
      literals: toSet(["false", "null", "true"]),
      builtins: new Set(),
      lineComments: ["#", ";"],
      blockComments: [],
      propertyWords: true,
      stringProperties: true,
    };
  }
  if (language === "ruby") {
    return {
      keywords: toSet(RUBY_KEYWORDS),
      literals: toSet(["false", "nil", "true"]),
      builtins: toSet(["Array", "Hash", "Integer", "String", "puts", "require"]),
      lineComments: ["#"],
      blockComments: [],
      propertyWords: true,
    };
  }
  if (
    [
      "cpp",
      "go",
      "java",
      "kotlin",
      "dart",
      "groovy",
      "php",
      "r",
      "rust",
      "swift",
    ].includes(language)
  ) {
    return {
      keywords: toSet(C_LIKE_KEYWORDS),
      literals: toSet(["false", "nil", "null", "nullptr", "true"]),
      builtins: toSet(["fmt", "printf", "println", "std"]),
      lineComments: language === "r" ? ["#"] : ["//"],
      blockComments: language === "r" ? [] : [["/*", "*/"]],
      propertyWords: true,
    };
  }
  if (language === "graphql") {
    return {
      keywords: toSet(GRAPHQL_KEYWORDS),
      literals: toSet(["false", "null", "true"]),
      builtins: new Set(),
      lineComments: ["#"],
      blockComments: [],
      propertyWords: true,
    };
  }
  if (language === "dockerfile") {
    return {
      keywords: toSet(DOCKERFILE_KEYWORDS),
      literals: new Set(),
      builtins: new Set(),
      lineComments: ["#"],
      blockComments: [],
      propertyWords: true,
    };
  }
  if (language === "makefile") {
    return {
      keywords: new Set(),
      literals: new Set(),
      builtins: new Set(),
      lineComments: ["#"],
      blockComments: [],
      propertyWords: true,
    };
  }
  if (language === "lua") {
    return {
      keywords: toSet(LUA_KEYWORDS),
      literals: toSet(["false", "nil", "true"]),
      builtins: toSet(["ipairs", "pairs", "print", "require", "string", "table"]),
      lineComments: ["--"],
      blockComments: [["--[[", "]]"]],
      propertyWords: true,
    };
  }
  if (language === "perl") {
    return {
      keywords: toSet(PERL_KEYWORDS),
      literals: toSet(["undef"]),
      builtins: toSet(["die", "print", "say", "warn"]),
      lineComments: ["#"],
      blockComments: [],
      propertyWords: true,
    };
  }
  if (language === "protobuf") {
    return {
      keywords: toSet(PROTOBUF_KEYWORDS),
      literals: toSet(["false", "true"]),
      builtins: new Set(),
      lineComments: ["//"],
      blockComments: [["/*", "*/"]],
      propertyWords: true,
    };
  }
  if (language === "log") {
    return {
      keywords: new Set(),
      literals: new Set(),
      builtins: new Set(),
      lineComments: [],
      blockComments: [],
    };
  }

  return {
    keywords: new Set(),
    literals: new Set(),
    builtins: new Set(),
    lineComments: [],
    blockComments: [],
    propertyWords: true,
  };
}

function findBlockComment(
  code: string,
  index: number,
  blockComments: Array<[string, string]>
) {
  for (const [open, close] of blockComments) {
    if (!code.startsWith(open, index)) continue;
    const closeIndex = code.indexOf(close, index + open.length);
    return closeIndex === -1 ? code.length : closeIndex + close.length;
  }
  return 0;
}

function findLineComment(code: string, index: number, lineComments: string[]) {
  for (const marker of lineComments) {
    if (!code.startsWith(marker, index)) continue;
    if (marker === "#" && index > 0 && /\S/.test(code.slice(0, index).split("\n").pop() ?? "")) {
      continue;
    }
    const lineEnd = code.indexOf("\n", index);
    return lineEnd === -1 ? code.length : lineEnd;
  }
  return 0;
}

function findString(code: string, index: number) {
  const quote = code[index];
  if (quote !== '"' && quote !== "'" && quote !== "`") return 0;

  const triple = code.slice(index, index + 3);
  if (triple === "'''" || triple === '"""') {
    const tripleEnd = code.indexOf(triple, index + 3);
    return tripleEnd === -1 ? code.length : tripleEnd + 3;
  }

  let cursor = index + 1;
  while (cursor < code.length) {
    const current = code[cursor];
    if (current === "\\") {
      cursor += 2;
      continue;
    }
    if (current === quote) return cursor + 1;
    if (quote !== "`" && current === "\n") return cursor;
    cursor += 1;
  }
  return code.length;
}

function isPropertyString(code: string, end: number) {
  const next = code.slice(end).match(/^\s*:/);
  return Boolean(next);
}

function isPropertyWord(code: string, start: number, end: number) {
  const previous = previousNonWhitespace(code, start);
  const next = code.slice(end).match(/^\s*:/);
  return previous === "." || Boolean(next);
}

function isFunctionWord(code: string, end: number) {
  return Boolean(code.slice(end).match(/^\s*\(/));
}

function previousNonWhitespace(code: string, start: number) {
  for (let index = start - 1; index >= 0; index -= 1) {
    if (!/\s/.test(code[index])) return code[index];
  }
  return "";
}

function addToken(
  tokens: CodeHighlightToken[],
  start: number,
  end: number,
  kind: CodeTokenKind
) {
  if (end <= start) return;
  tokens.push({ start, end, kind });
}

function discardOverlaps(tokens: CodeHighlightToken[]) {
  const sorted = [...tokens].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: CodeHighlightToken[] = [];
  let cursor = 0;
  for (const token of sorted) {
    if (token.start < cursor) continue;
    result.push(token);
    cursor = token.end;
  }
  return result;
}

function toSet(values: string[]) {
  return new Set(values.map((value) => value.toLowerCase()));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
