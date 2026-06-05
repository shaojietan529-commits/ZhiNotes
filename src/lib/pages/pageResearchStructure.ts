"use client";

export type PageResearchStructureStatus =
  | "ready"
  | "needs-structure"
  | "thin"
  | "empty";

export type PageResearchSignalStatus = "ready" | "review" | "empty";

export type PageResearchActionPriority = "high" | "medium" | "low";

export type PageResearchStructureSignalId =
  | "outline"
  | "decision"
  | "thesis"
  | "sources"
  | "actions"
  | "relations"
  | "files"
  | "databases"
  | "versioning"
  | "local-boundary";

export interface PageResearchStructureOutlineItem {
  id: string;
  level: number;
  title: string;
}

export interface PageResearchStructureSignal {
  id: PageResearchStructureSignalId;
  label: string;
  value: number | string;
  status: PageResearchSignalStatus;
  detail: string;
}

export interface PageResearchStructureGate {
  id:
    | "page-outline"
    | "investment-decision"
    | "evidence-sources"
    | "next-actions"
    | "research-relations"
    | "review-trail";
  label: string;
  status: PageResearchSignalStatus;
  detail: string;
  evidence: string;
}

export interface PageResearchStructureAction {
  id:
    | "apply-research-template"
    | "add-outline"
    | "write-investment-decision"
    | "add-evidence-sources"
    | "add-next-actions"
    | "link-research-relations"
    | "save-review-trail"
    | "review-cadence";
  label: string;
  priority: PageResearchActionPriority;
  gate_id: PageResearchStructureGate["id"];
  surface: "editor" | "page-action" | "relation" | "review";
  action_status: "suggested-only";
  detail: string;
  suggested_block: string;
  insert_html: string;
  local_only: true;
  suggestion_writes_workspace_data: false;
}

export interface PageResearchStructureReport {
  format: "zhinote-page-research-structure";
  format_version: 1;
  report_status: "local-page-structure-only";
  structure_status: PageResearchStructureStatus;
  privacy_note: string;
  boundary: {
    local_page_structure_only: true;
    reads_current_page_html: true;
    reads_page_metadata: true;
    reads_linked_page_bodies: false;
    reads_database_rows: false;
    reads_file_bytes: false;
    uploads_data: false;
    connects_cloud_services: false;
    enables_ai: false;
    writes_workspace_data: false;
  };
  summary: {
    blocks: number;
    characters: number;
    words: number;
    headings: number;
    tables: number;
    links: number;
    page_mentions: number;
    file_blocks: number;
    database_blocks: number;
    callouts: number;
    toggles: number;
    toc_blocks: number;
    code_blocks: number;
    equations: number;
    task_items: number;
    checked_task_items: number;
    decision_markers: number;
    thesis_markers: number;
    source_markers: number;
    action_markers: number;
    risk_markers: number;
    catalyst_markers: number;
  };
  outline: PageResearchStructureOutlineItem[];
  gates: PageResearchStructureGate[];
  next_actions: PageResearchStructureAction[];
  signals: PageResearchStructureSignal[];
}

export function buildPageResearchStructureReport(input: {
  html: string;
  title: string;
  metadata: {
    favorite: boolean;
    hasCover: boolean;
    locked: boolean;
    versionsCount: number;
    widePage: boolean;
  };
}): PageResearchStructureReport {
  const doc = parsePageDocument(input.html);
  const text = doc?.body.textContent ?? stripHtml(input.html);
  const outline = doc ? extractOutline(doc) : [];
  const summary = buildSummary(doc, text, outline.length);
  const gates = buildGates(summary, input.metadata);
  const structureStatus = getStructureStatus(summary, gates);
  const nextActions = buildNextActions(summary, gates);

  return {
    format: "zhinote-page-research-structure",
    format_version: 1,
    report_status: "local-page-structure-only",
    structure_status: structureStatus,
    privacy_note:
      "这份结构体检只在本地根据当前页面 HTML 和基础页面元数据生成。它不读取关联页面正文、数据库行值或文件字节，不上传数据、不连接云服务、不调用 AI，也不写入工作区。",
    boundary: {
      local_page_structure_only: true,
      reads_current_page_html: true,
      reads_page_metadata: true,
      reads_linked_page_bodies: false,
      reads_database_rows: false,
      reads_file_bytes: false,
      uploads_data: false,
      connects_cloud_services: false,
      enables_ai: false,
      writes_workspace_data: false,
    },
    summary,
    outline,
    gates,
    next_actions: nextActions,
    signals: buildSignals(summary, input.metadata, structureStatus),
  };
}

function parsePageDocument(html: string) {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html || "", "text/html");
}

function buildSummary(
  doc: Document | null,
  text: string,
  outlineCount: number
): PageResearchStructureReport["summary"] {
  const normalizedText = normalizeText(text);
  const taskItems = doc?.body.querySelectorAll('[data-type="taskItem"]').length ?? 0;
  const checkedTaskItems =
    doc?.body.querySelectorAll('[data-type="taskItem"][data-checked="true"]')
      .length ?? 0;
  const pageMentions =
    doc?.body.querySelectorAll(
      '[data-type="mention"], [data-type="wiki-reference"]'
    ).length ?? 0;

  return {
    blocks:
      doc?.body.querySelectorAll(
        "p,h1,h2,h3,h4,li,blockquote,pre,table,[data-type]"
      ).length ?? 0,
    characters: normalizedText.replace(/\s+/g, "").length,
    words: countWords(normalizedText),
    headings: outlineCount,
    tables: doc?.body.querySelectorAll("table").length ?? 0,
    links: doc?.body.querySelectorAll("a[href]").length ?? 0,
    page_mentions: pageMentions,
    file_blocks:
      doc?.body.querySelectorAll('[data-type="file-preview"]').length ?? 0,
    database_blocks:
      doc?.body.querySelectorAll('[data-type="inline-database"]').length ?? 0,
    callouts:
      doc?.body.querySelectorAll('[data-type="callout-block"]').length ?? 0,
    toggles:
      doc?.body.querySelectorAll('[data-type="toggle-block"]').length ?? 0,
    toc_blocks: doc?.body.querySelectorAll('[data-type="toc-block"]').length ?? 0,
    code_blocks: doc?.body.querySelectorAll("pre, code").length ?? 0,
    equations:
      doc?.body.querySelectorAll(
        '[data-type="equation-block"], [data-type="inline-equation"]'
      ).length ?? 0,
    task_items: taskItems,
    checked_task_items: checkedTaskItems,
    decision_markers: countKeywordHits(normalizedText, [
      "结论",
      "核心结论",
      "decision",
      "takeaway",
      "recommendation",
      "rating",
    ]),
    thesis_markers: countKeywordHits(normalizedText, [
      "thesis",
      "投资假设",
      "核心假设",
      "观点",
      "假设",
    ]),
    source_markers: countKeywordHits(normalizedText, [
      "source",
      "来源",
      "引用",
      "citation",
      "出处",
      "原文",
    ]),
    action_markers: countKeywordHits(normalizedText, [
      "下一步",
      "行动项",
      "todo",
      "follow-up",
      "open question",
      "开放问题",
    ]),
    risk_markers: countKeywordHits(normalizedText, [
      "risk",
      "风险",
      "downside",
      "bear case",
      "反方",
    ]),
    catalyst_markers: countKeywordHits(normalizedText, [
      "catalyst",
      "催化剂",
      "事件",
      "milestone",
      "里程碑",
    ]),
  };
}

function extractOutline(doc: Document): PageResearchStructureOutlineItem[] {
  return Array.from(doc.body.querySelectorAll("h1, h2, h3, h4"))
    .map((heading, index) => ({
      id: `page-heading-${index + 1}`,
      level: Number(heading.tagName.slice(1)),
      title: normalizeText(heading.textContent ?? "") || "未命名标题",
    }))
    .filter((item) => item.title)
    .slice(0, 8);
}

function buildGates(
  summary: PageResearchStructureReport["summary"],
  metadata: {
    favorite: boolean;
    hasCover: boolean;
    locked: boolean;
    versionsCount: number;
    widePage: boolean;
  }
): PageResearchStructureGate[] {
  const relationCount =
    summary.page_mentions + summary.database_blocks + summary.file_blocks;
  const evidenceCount =
    summary.source_markers + summary.links + summary.tables + summary.file_blocks;
  const actionCount = summary.action_markers + summary.task_items;
  const decisionCount =
    summary.decision_markers +
    summary.thesis_markers +
    summary.risk_markers +
    summary.catalyst_markers;

  return [
    {
      id: "page-outline",
      label: "页面骨架",
      status:
        summary.headings >= 2 || summary.toc_blocks > 0
          ? "ready"
          : summary.words > 120
            ? "review"
            : "empty",
      detail:
        summary.headings >= 2 || summary.toc_blocks > 0
          ? "已经有标题或目录，可以快速扫读。"
          : "建议补 H2/H3 或目录，让长笔记像 memo 一样可导航。",
      evidence: `${summary.headings} 个标题 / ${summary.toc_blocks} 个目录块`,
    },
    {
      id: "investment-decision",
      label: "结论与假设",
      status:
        decisionCount >= 2 ? "ready" : decisionCount > 0 ? "review" : "empty",
      detail:
        decisionCount >= 2
          ? "已经出现结论、假设、风险或催化剂线索。"
          : "建议明确核心结论、投资假设、风险和催化剂。",
      evidence: `${decisionCount} 个投研关键词线索`,
    },
    {
      id: "evidence-sources",
      label: "证据与来源",
      status:
        evidenceCount >= 2 ? "ready" : evidenceCount > 0 ? "review" : "empty",
      detail:
        evidenceCount >= 2
          ? "已有来源、链接、表格或文件作为证据。"
          : "建议补来源、表格、报告文件或原始链接，方便回溯。",
      evidence: `${evidenceCount} 个证据线索`,
    },
    {
      id: "next-actions",
      label: "下一步动作",
      status: actionCount > 0 ? "ready" : "empty",
      detail:
        actionCount > 0
          ? "已经有行动项或待办，可进入跟踪。"
          : "建议记录下一步问题、模型更新或 follow-up。",
      evidence: `${actionCount} 个行动线索`,
    },
    {
      id: "research-relations",
      label: "研究关系",
      status:
        relationCount >= 2 ? "ready" : relationCount > 0 ? "review" : "empty",
      detail:
        relationCount >= 2
          ? "页面已经连接到文件、页面或数据库。"
          : "建议关联公司、报告、会议或数据库，形成投研网络。",
      evidence: `${relationCount} 个本地关系线索`,
    },
    {
      id: "review-trail",
      label: "审阅痕迹",
      status:
        metadata.versionsCount > 0 || metadata.locked || metadata.favorite
          ? "ready"
          : metadata.hasCover || metadata.widePage
            ? "review"
            : "empty",
      detail:
        metadata.versionsCount > 0 || metadata.locked || metadata.favorite
          ? "已有版本、收藏或锁定状态，适合沉淀重要页面。"
          : "重要研究页建议保存版本或收藏，方便后续复盘。",
      evidence: `${metadata.versionsCount} 个版本 / ${metadata.favorite ? "已收藏" : "未收藏"}`,
    },
  ];
}

function buildSignals(
  summary: PageResearchStructureReport["summary"],
  metadata: {
    favorite: boolean;
    hasCover: boolean;
    locked: boolean;
    versionsCount: number;
    widePage: boolean;
  },
  structureStatus: PageResearchStructureStatus
): PageResearchStructureSignal[] {
  return [
    {
      id: "outline",
      label: "大纲",
      value: summary.headings,
      status: summary.headings > 0 ? "ready" : "empty",
      detail: "页面标题层级和目录线索。",
    },
    {
      id: "decision",
      label: "结论",
      value: summary.decision_markers,
      status: summary.decision_markers > 0 ? "ready" : "empty",
      detail: "结论、关键观点、推荐动作等关键词线索。",
    },
    {
      id: "thesis",
      label: "投资假设",
      value: summary.thesis_markers,
      status: summary.thesis_markers > 0 ? "ready" : "empty",
      detail: "投资假设、观点或核心判断线索。",
    },
    {
      id: "sources",
      label: "来源",
      value: summary.source_markers + summary.links,
      status:
        summary.source_markers + summary.links > 0 ? "ready" : "empty",
      detail: "来源、引用和外链线索。",
    },
    {
      id: "actions",
      label: "行动",
      value: summary.action_markers + summary.task_items,
      status:
        summary.action_markers + summary.task_items > 0 ? "ready" : "empty",
      detail: "行动项、待办、开放问题或后续跟进。",
    },
    {
      id: "relations",
      label: "关系",
      value: summary.page_mentions,
      status: summary.page_mentions > 0 ? "ready" : "empty",
      detail: "本地页面提及和页面链接。",
    },
    {
      id: "files",
      label: "文件",
      value: summary.file_blocks,
      status: summary.file_blocks > 0 ? "ready" : "empty",
      detail: "页面内本地文件预览块。",
    },
    {
      id: "databases",
      label: "数据库",
      value: summary.database_blocks,
      status: summary.database_blocks > 0 ? "ready" : "empty",
      detail: "页面内内联数据库块。",
    },
    {
      id: "versioning",
      label: "版本",
      value: metadata.versionsCount,
      status: metadata.versionsCount > 0 ? "ready" : "review",
      detail: "本地版本快照数量。",
    },
    {
      id: "local-boundary",
      label: "本地边界",
      value: getStatusLabel(structureStatus),
      status: "ready",
      detail: "只做本地结构分析，不上传、不调用 AI、不写工作区。",
    },
  ];
}

function buildNextActions(
  summary: PageResearchStructureReport["summary"],
  gates: PageResearchStructureGate[]
): PageResearchStructureAction[] {
  const actions: PageResearchStructureAction[] = [];
  const outlineGate = findGate(gates, "page-outline");
  const decisionGate = findGate(gates, "investment-decision");
  const evidenceGate = findGate(gates, "evidence-sources");
  const actionsGate = findGate(gates, "next-actions");
  const relationsGate = findGate(gates, "research-relations");
  const reviewGate = findGate(gates, "review-trail");

  if (summary.words === 0 || summary.blocks === 0) {
    actions.push({
      id: "apply-research-template",
      label: "套用投研模板",
      priority: "high",
      gate_id: "page-outline",
      surface: "editor",
      action_status: "suggested-only",
      detail: "空页面建议先插入公司研究、投资备忘录、会议纪要或研究报告模板。",
      suggested_block: "/template 或工具栏模板按钮",
      insert_html: [
        "<h2>核心结论</h2>",
        "<p></p>",
        "<h2>投资假设</h2>",
        "<p></p>",
        "<h2>证据与来源</h2>",
        "<ul><li>来源：</li><li>关键数据：</li></ul>",
        "<h2>风险与反向证据</h2>",
        "<p></p>",
        "<h2>下一步</h2>",
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li></ul>',
      ].join(""),
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  if (outlineGate?.status !== "ready") {
    actions.push({
      id: "add-outline",
      label: "补页面骨架",
      priority: summary.words > 120 ? "high" : "medium",
      gate_id: "page-outline",
      surface: "editor",
      action_status: "suggested-only",
      detail: "补 H2/H3、目录或小标题，让长笔记可以像 memo 一样扫读。",
      suggested_block: "H2: 核心结论 / 证据 / 风险 / 下一步",
      insert_html:
        "<h2>核心结论</h2><p></p><h2>证据</h2><p></p><h2>风险</h2><p></p><h2>下一步</h2><p></p>",
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  if (decisionGate?.status !== "ready") {
    actions.push({
      id: "write-investment-decision",
      label: "补结论与假设",
      priority: decisionGate?.status === "empty" ? "high" : "medium",
      gate_id: "investment-decision",
      surface: "editor",
      action_status: "suggested-only",
      detail: "明确核心结论、投资假设、风险、催化剂或反向证据。",
      suggested_block: "H2: 核心结论 / 投资假设 / 风险 / 催化剂",
      insert_html:
        "<h2>核心结论</h2><p></p><h2>投资假设</h2><p></p><h2>风险</h2><p></p><h2>催化剂</h2><p></p>",
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  if (evidenceGate?.status !== "ready") {
    actions.push({
      id: "add-evidence-sources",
      label: "补证据与来源",
      priority: evidenceGate?.status === "empty" ? "high" : "medium",
      gate_id: "evidence-sources",
      surface: "editor",
      action_status: "suggested-only",
      detail: "补来源、引用、表格、文件预览或原始链接，方便后续回溯。",
      suggested_block: "H2: 来源 / 数据表 / 原始报告",
      insert_html:
        "<h2>证据与来源</h2><ul><li>来源：</li><li>关键数据：</li><li>原始报告：</li><li>引用：</li></ul>",
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  if (actionsGate?.status !== "ready") {
    actions.push({
      id: "add-next-actions",
      label: "补下一步动作",
      priority: "medium",
      gate_id: "next-actions",
      surface: "editor",
      action_status: "suggested-only",
      detail: "记录待验证问题、模型更新、follow-up 或复盘窗口。",
      suggested_block: "Task list: 待验证问题 / 模型更新 / 跟进动作",
      insert_html:
        '<h2>下一步动作</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>待验证问题</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>模型更新</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>跟进动作</p></div></li></ul>',
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  if (relationsGate?.status !== "ready") {
    actions.push({
      id: "link-research-relations",
      label: "补研究关系",
      priority: relationsGate?.status === "empty" ? "medium" : "low",
      gate_id: "research-relations",
      surface: "relation",
      action_status: "suggested-only",
      detail: "把页面连接到公司、报告、会议、数据库或文件预览，形成投研网络。",
      suggested_block: "页面提及 / 内联数据库 / 文件预览",
      insert_html:
        "<h2>关联研究</h2><ul><li>公司页面：</li><li>相关报告：</li><li>相关会议：</li><li>相关数据库：</li></ul>",
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  if (reviewGate?.status !== "ready") {
    actions.push({
      id: "save-review-trail",
      label: "补审阅痕迹",
      priority: "low",
      gate_id: "review-trail",
      surface: "page-action",
      action_status: "suggested-only",
      detail: "重要页面建议保存版本、收藏或锁定，方便后续复盘。",
      suggested_block: "保存版本 / 收藏 / 锁定",
      insert_html:
        "<h2>复盘记录</h2><ul><li>本次更新：</li><li>下次复盘日期：</li><li>需要重新检查的假设：</li></ul>",
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "review-cadence",
      label: "进入周期复盘",
      priority: "low",
      gate_id: "review-trail",
      surface: "review",
      action_status: "suggested-only",
      detail: "结构已经较完整，下一步适合设置复盘节奏或连接到跟踪表。",
      suggested_block: "下次复盘日期 / 关联跟踪表行",
      insert_html:
        "<h2>复盘节奏</h2><ul><li>下次复盘日期：</li><li>触发条件：</li><li>关联 tracker row：</li></ul>",
      local_only: true,
      suggestion_writes_workspace_data: false,
    });
  }

  return actions.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

function findGate(
  gates: PageResearchStructureGate[],
  id: PageResearchStructureGate["id"]
) {
  return gates.find((gate) => gate.id === id);
}

function priorityRank(priority: PageResearchActionPriority) {
  const ranks: Record<PageResearchActionPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return ranks[priority];
}

function getStructureStatus(
  summary: PageResearchStructureReport["summary"],
  gates: PageResearchStructureGate[]
): PageResearchStructureStatus {
  if (summary.words === 0 && summary.blocks === 0) return "empty";
  if (summary.words < 80 && summary.blocks < 4) return "thin";

  const readyGates = gates.filter((gate) => gate.status === "ready").length;
  const emptyGates = gates.filter((gate) => gate.status === "empty").length;
  if (readyGates >= 4 && emptyGates === 0) return "ready";
  return "needs-structure";
}

function countKeywordHits(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.reduce((count, keyword) => {
    const normalized = keyword.toLowerCase();
    if (!normalized) return count;
    const matches = lower.match(new RegExp(escapeRegExp(normalized), "g"));
    return count + (matches?.length ?? 0);
  }, 0);
}

function countWords(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  const cjkMatches = normalized.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const wordMatches = normalized
    .replace(/[\u4e00-\u9fff]/g, " ")
    .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjkMatches + wordMatches;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getStatusLabel(status: PageResearchStructureStatus) {
  const labels: Record<PageResearchStructureStatus, string> = {
    ready: "已就绪",
    "needs-structure": "需补结构",
    thin: "偏薄",
    empty: "空白",
  };

  return labels[status];
}
