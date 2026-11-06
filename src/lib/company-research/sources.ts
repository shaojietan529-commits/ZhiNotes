import type { ResearchCompany } from "./contract";
import type { ResearchSource } from "./types";
import type { ResearchStorage } from "./storage";

export type SourceExcerpt = ResearchSource & { text: string };
type PageRecord = { id: string; title: string; content_text: string | null; updated_at: string; deleted_at: string | null };
type NotionBlock = { id: string; type: string; has_children?: boolean; last_edited_time?: string; [key: string]: unknown };

// Deliberately bounded excerpts, not a workspace crawler. Unsupported children are disclosed.
export async function readSources(company: ResearchCompany, email: string, store: ResearchStorage, notionToken?: string, http: typeof fetch = fetch) {
  const sources: SourceExcerpt[] = [], warnings: string[] = [];
  const deadline = Date.now() + 20000;
  if (!company.zhinotePageIds.length) warnings.push("未绑定 ZhiNote 研究资料；本次不包含 ZhiNote 笔记。");
  if (!company.notionPageIds.length) warnings.push("未绑定 Notion 研究资料；本次不包含 Notion 笔记。");
  for (const id of company.zhinotePageIds) {
    if (Date.now() >= deadline) { warnings.push("资料读取已达时间上限；部分 ZhiNote 资料未读取。"); break; }
    try {
      const page = await store.get<PageRecord>(`zhinotes:pagesync:page:${email}:${id}`);
      if (!page || page.id !== id || page.deleted_at || typeof page.content_text !== "string") throw new Error("missing");
      const text = page.content_text.slice(0, 3000);
      sources.push({ id: `z-${id}`, kind: "zhinote", title: page.title.slice(0, 200), url: `https://zhi-note.com/page/${encodeURIComponent(id)}`,
        date: page.updated_at || null, dateKind: page.updated_at ? "modified" : "unknown", text });
      if (page.content_text.length > 3000) warnings.push(`ZhiNote「${page.title.slice(0, 80)}」仅使用前 3000 字符，请检查预览。`);
    } catch { warnings.push(`指定 ZhiNote 资料 ${id} 读取失败；未计入本次证据。`); }
  }
  for (const id of company.notionPageIds) {
    if (Date.now() >= deadline) { warnings.push("资料读取已达时间上限；部分 Notion 资料未读取。"); break; }
    if (!notionToken) { warnings.push("Notion 尚未授权；本次不包含 Notion 笔记。"); break; }
    try {
      await new Promise(resolve => setTimeout(resolve, 350));
      const response = await http(`https://api.notion.com/v1/blocks/${id}/children?page_size=100`, {
        headers: { Authorization: `Bearer ${notionToken}`, "Notion-Version": "2025-09-03" }, cache: "no-store", signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("notion-unavailable");
      const body = await response.json() as { results: NotionBlock[]; has_more: boolean };
      if (!Array.isArray(body.results)) throw new Error("notion-invalid");
      const blocks = body.results.filter(block => !["child_page", "child_database", "synced_block", "file", "image", "pdf"].includes(block.type));
      const text = blocks.map(block => {
        const data = block[block.type] as { rich_text?: { plain_text?: string }[] } | undefined;
        return (data?.rich_text ?? []).map(item => item.plain_text ?? "").join("");
      }).filter(Boolean).join("\n");
      if (!text.trim()) throw new Error("empty");
      sources.push({ id: `n-${id}`, kind: "notion", title: `Notion ${id}`, url: `https://www.notion.so/${id.replaceAll("-", "")}`,
        date: null, dateKind: "unknown", text: text.slice(0, 3000) });
      if (body.has_more || body.results.some(block => block.has_children) || text.length > 3000)
        warnings.push(`Notion ${id} 仅包含顶层文字摘录；未读取子页面、折叠块、附件或其余分页。`);
    } catch { warnings.push(`指定 Notion 资料 ${id} 读取失败；未计入本次证据。`); }
  }
  return { sources, warnings: [...new Set(warnings)] };
}
