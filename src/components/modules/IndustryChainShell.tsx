"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import {
  updateWikiLinks,
} from "@/lib/db/local/queries";
import {
  createPageWithCloud,
  updatePageWithCloud,
} from "@/lib/pages/cloudPageMutations";
import { getModuleRootId } from "@/lib/pages/moduleWorkspaces";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  buildIndustryCompanyLinkContent,
  buildIndustryCompanyLinkProperties,
  getIndustryNodeDisplayPage,
  getLinkedKnowledgeCompanyPageId,
  isKnowledgeCompanyLinkPage,
  resolveIndustryNodeTargetPageId,
} from "@/lib/pages/industryChainCompanyLinks";
import PageContextMenu from "@/components/page/PageContextMenu";
import type { Page } from "@/lib/utils/types";

// A rotating palette so each top-level sector reads as its own color family.
// The same hue cascades down its descendants, so the eye can trace a branch
// from root to leaf at a glance.
const SECTOR_THEMES = [
  {
    accent: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    rootBg:
      "bg-gradient-to-r from-blue-50 to-white border-blue-200 dark:from-blue-950/40 dark:to-zinc-900 dark:border-blue-900/50",
    hover: "hover:text-blue-600 dark:hover:text-blue-400",
  },
  {
    accent: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    rootBg:
      "bg-gradient-to-r from-emerald-50 to-white border-emerald-200 dark:from-emerald-950/40 dark:to-zinc-900 dark:border-emerald-900/50",
    hover: "hover:text-emerald-600 dark:hover:text-emerald-400",
  },
  {
    accent: "bg-purple-500",
    chip: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    rootBg:
      "bg-gradient-to-r from-purple-50 to-white border-purple-200 dark:from-purple-950/40 dark:to-zinc-900 dark:border-purple-900/50",
    hover: "hover:text-purple-600 dark:hover:text-purple-400",
  },
  {
    accent: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    rootBg:
      "bg-gradient-to-r from-amber-50 to-white border-amber-200 dark:from-amber-950/40 dark:to-zinc-900 dark:border-amber-900/50",
    hover: "hover:text-amber-600 dark:hover:text-amber-400",
  },
  {
    accent: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    rootBg:
      "bg-gradient-to-r from-rose-50 to-white border-rose-200 dark:from-rose-950/40 dark:to-zinc-900 dark:border-rose-900/50",
    hover: "hover:text-rose-600 dark:hover:text-rose-400",
  },
  {
    accent: "bg-cyan-500",
    chip: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
    rootBg:
      "bg-gradient-to-r from-cyan-50 to-white border-cyan-200 dark:from-cyan-950/40 dark:to-zinc-900 dark:border-cyan-900/50",
    hover: "hover:text-cyan-600 dark:hover:text-cyan-400",
  },
] as const;

type SectorTheme = (typeof SECTOR_THEMES)[number];

export default function IndustryChainShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { pages, refresh } = usePages();
  const [rootId, setRootId] = useState<string | null>(null);
  const [knowledgeRootId, setKnowledgeRootId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [companyLinkParentId, setCompanyLinkParentId] = useState<string | null>(
    null
  );
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void getModuleRootId("industry-chain").then(setRootId);
      void getModuleRootId("knowledge-base").then(setKnowledgeRootId);
    });
  }, [dbReady]);

  // Top-level sectors are the direct children of the root page.
  const sectors = useMemo(
    () =>
      rootId
        ? pages
            .filter((p) => p.parent_id === rootId)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [],
    [pages, rootId]
  );

  const companyCandidates = useMemo(
    () =>
      knowledgeRootId
        ? pages
            .filter((p) => p.parent_id === knowledgeRootId)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [],
    [pages, knowledgeRootId]
  );

  const companyLinkParent = useMemo(
    () =>
      companyLinkParentId
        ? pages.find((page) => page.id === companyLinkParentId) ?? null
        : null,
    [pages, companyLinkParentId]
  );

  const addChild = useCallback(
    async (parentId: string, navigate: boolean) => {
      const child = await createPageWithCloud({
        parentId,
        title: "未命名分类",
      });
      await refresh();
      if (navigate) router.push(`/page/${child.id}`);
    },
    [refresh, router]
  );

  const renameNode = useCallback(
    async (id: string, title: string) => {
      await updatePageWithCloud(id, { title });
      await refresh();
    },
    [refresh]
  );

  const linkCompanyToParent = useCallback(
    async (companyPageId: string) => {
      if (!companyLinkParentId) return;
      const companyPage = pages.find((page) => page.id === companyPageId);
      if (!companyPage) return;

      const existing = pages.find(
        (page) =>
          page.parent_id === companyLinkParentId &&
          getLinkedKnowledgeCompanyPageId(page) === companyPageId
      );

      if (existing) {
        setCompanyLinkParentId(null);
        setLinkNotice("这个层级已经链接过这家公司。");
        window.setTimeout(() => setLinkNotice(null), 2600);
        return;
      }

      const linkPage = await createPageWithCloud({
        parentId: companyLinkParentId,
        title: displayPageTitle(companyPage.title),
        icon: companyPage.icon ?? "🏢",
      });
      await updatePageWithCloud(linkPage.id, {
        properties: buildIndustryCompanyLinkProperties(companyPage),
        content_text: buildIndustryCompanyLinkContent(companyPage),
      });
      await updateWikiLinks(linkPage.id, [companyPage.id]);
      await refresh();
      setCompanyLinkParentId(null);
      setLinkNotice(`已把「${displayPageTitle(companyPage.title)}」链接到产业链层级。`);
      window.setTimeout(() => setLinkNotice(null), 2600);
    },
    [companyLinkParentId, pages, refresh]
  );

  const openIndustryNode = useCallback(
    (id: string) => {
      const page = pages.find((candidate) => candidate.id === id);
      const targetId = page
        ? resolveIndustryNodeTargetPageId(page, pages)
        : id;
      router.push(`/page/${targetId}`);
    },
    [pages, router]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span className="text-3xl">🧭</span> 产业链研究
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                分级化的产业链看板。分类节点是页面；公司节点可直接引用知识库里的公司页。
              </p>
            </div>
            {rootId && (
              <button
                type="button"
                onClick={() => void addChild(rootId, false)}
                className="shrink-0 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-700 hover:shadow active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                + 新建一级分类
              </button>
            )}
          </div>

          {linkNotice && (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {linkNotice}
            </p>
          )}

          {!rootId ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              正在加载产业链看板…
            </div>
          ) : sectors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-3 text-4xl">🌱</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                还没有分类。先建一个一级分类，比如「科技」「医药」「制造」。
              </p>
              <button
                type="button"
                onClick={() => void addChild(rootId, true)}
                className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                + 创建第一个分类
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sectors.map((sector, index) => (
                <SectorCard
                  key={sector.id}
                  sector={sector}
                  allPages={pages}
                  theme={SECTOR_THEMES[index % SECTOR_THEMES.length]}
                  descendantCount={countDescendants(pages, sector.id)}
                  onOpen={openIndustryNode}
                  onAddChild={(id) => void addChild(id, false)}
                  onLinkCompany={(id) => setCompanyLinkParentId(id)}
                  onRename={(id, title) => void renameNode(id, title)}
                  onContextMenu={(id, x, y) =>
                    setContextMenu({ pageId: id, x, y })
                  }
                />
              ))}
            </div>
          )}

          <p className="mt-8 text-xs leading-5 text-zinc-400">
            提示：单击分类节点进入分类页，单击公司引用节点进入知识库公司页；双击分类可就地重命名。
            公司引用只保存指针，不复制研究内容。
          </p>
        </div>
      </main>

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => router.push(`/page/${id}`)}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void refresh()}
        />
      )}

      {companyLinkParent && (
        <CompanyLinkDialog
          parentPage={companyLinkParent}
          candidates={companyCandidates}
          allPages={pages}
          onChoose={(companyPageId) => void linkCompanyToParent(companyPageId)}
          onClose={() => setCompanyLinkParentId(null)}
        />
      )}
    </div>
  );
}

// Count every descendant of a node so the root cards can show their scale.
function countDescendants(pages: Page[], id: string): number {
  const children = pages.filter((p) => p.parent_id === id);
  return children.reduce(
    (sum, child) => sum + 1 + countDescendants(pages, child.id),
    0
  );
}

function CompanyLinkDialog({
  parentPage,
  candidates,
  allPages,
  onChoose,
  onClose,
}: {
  parentPage: Page;
  candidates: Page[];
  allPages: Page[];
  onChoose: (companyPageId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const existingTargetIds = useMemo(() => {
    return new Set(
      allPages
        .filter((page) => page.parent_id === parentPage.id)
        .map(getLinkedKnowledgeCompanyPageId)
        .filter((id): id is string => Boolean(id))
    );
  }, [allPages, parentPage.id]);

  const visibleCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return candidates.filter((page) => {
      const title = displayPageTitle(page.title).toLowerCase();
      return !normalizedQuery || title.includes(normalizedQuery);
    });
  }, [candidates, query]);

  const parentTitle = displayPageTitle(parentPage.title);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                链接知识库公司页
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                链接到「{parentTitle}」下面。这里只创建引用节点，不复制公司页内容。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="关闭"
            >
              ×
            </button>
          </div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索公司页…"
            className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:bg-zinc-950"
          />
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-2">
          {candidates.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              知识库里还没有公司页。先到「知识库」创建公司卡片，再回到这里链接。
            </div>
          ) : visibleCandidates.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              没有匹配的公司页。
            </div>
          ) : (
            <div className="space-y-1">
              {visibleCandidates.map((company) => {
                const alreadyLinked = existingTargetIds.has(company.id);
                const childCount = allPages.filter(
                  (page) => page.parent_id === company.id
                ).length;
                return (
                  <button
                    key={company.id}
                    type="button"
                    disabled={alreadyLinked || Boolean(busyId)}
                    onClick={() => {
                      setBusyId(company.id);
                      onChoose(company.id);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-zinc-900"
                  >
                    <span className="text-lg">{company.icon || "🏢"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {displayPageTitle(company.title)}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-400">
                        知识库公司页
                        {childCount > 0 ? ` · ${childCount} 个子页面` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                      {alreadyLinked
                        ? "已在此层级"
                        : busyId === company.id
                          ? "链接中…"
                          : "链接"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Each top-level sector is rendered as a colored card containing its tree.
function SectorCard({
  sector,
  allPages,
  theme,
  descendantCount,
  onOpen,
  onAddChild,
  onLinkCompany,
  onRename,
  onContextMenu,
}: {
  sector: Page;
  allPages: Page[];
  theme: SectorTheme;
  descendantCount: number;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
  onLinkCompany: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(sector.title);
  const children = allPages
    .filter((p) => p.parent_id === sector.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const hasChildren = children.length > 0;

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== sector.title) onRename(sector.id, next);
    else setDraft(sector.title);
  };

  return (
    <section className="group/card overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {/* Sector header */}
      <div className={`flex items-center gap-2.5 border-b px-3 py-3 ${theme.rootBg}`}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/60 dark:hover:bg-zinc-800 ${
            hasChildren ? "visible" : "invisible"
          }`}
          title={expanded ? "折叠" : "展开"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.accent}`} />
        <span className="shrink-0 text-lg">{sector.icon || "📂"}</span>

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(sector.title);
                setRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5 text-base font-semibold text-zinc-800 outline-none ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen(sector.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              setDraft(sector.title);
              setRenaming(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(sector.id, e.clientX, e.clientY);
            }}
            className={`min-w-0 flex-1 truncate text-left text-base font-semibold text-zinc-800 transition-colors dark:text-zinc-100 ${theme.hover}`}
            title={`${displayPageTitle(sector.title)}（点击进入，双击重命名）`}
          >
            {displayPageTitle(sector.title)}
          </button>
        )}

        {descendantCount > 0 && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${theme.chip}`}
          >
            {descendantCount} 项
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            onAddChild(sector.id);
            setExpanded(true);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 opacity-0 transition-all hover:bg-white/60 hover:text-zinc-700 group-hover/card:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="添加下级分类"
        >
          + 下级
        </button>
        <button
          type="button"
          onClick={() => {
            onLinkCompany(sector.id);
            setExpanded(true);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 opacity-0 transition-all hover:bg-white/60 hover:text-zinc-700 group-hover/card:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="把知识库公司页链接到这个层级"
        >
          + 公司
        </button>
      </div>

      {/* Sector body */}
      {expanded && (
        <div className="px-3 py-2">
          {hasChildren ? (
            <ul className="space-y-0.5">
              {children.map((child) => (
                <ChainNode
                  key={child.id}
                  node={child}
                  allPages={allPages}
                  theme={theme}
                  level={1}
                  onOpen={onOpen}
                  onAddChild={onAddChild}
                  onLinkCompany={onLinkCompany}
                  onRename={onRename}
                  onContextMenu={onContextMenu}
                />
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap gap-2 px-2 py-2">
              <button
                type="button"
                onClick={() => onLinkCompany(sector.id)}
                className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                + 链接公司页
              </button>
              <button
                type="button"
                onClick={() => onAddChild(sector.id)}
                className="rounded-md px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
              >
                + 添加下级分类
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// A recursive sub-node (level >= 1). Uses a left guide line and the inherited
// sector color for its connector dot so branches stay visually linked.
function ChainNode({
  node,
  allPages,
  theme,
  level,
  onOpen,
  onAddChild,
  onLinkCompany,
  onRename,
  onContextMenu,
}: {
  node: Page;
  allPages: Page[];
  theme: SectorTheme;
  level: number;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
  onLinkCompany: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const children = allPages
    .filter((p) => p.parent_id === node.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const hasChildren = children.length > 0;
  const isCompanyLink = isKnowledgeCompanyLinkPage(node);
  const displayPage = getIndustryNodeDisplayPage(node, allPages);
  const displayTitle = displayPageTitle(displayPage.title);

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== node.title) onRename(node.id, next);
    else setDraft(node.title);
  };

  return (
    <li>
      <div className="group/node flex items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 ${
            hasChildren ? "visible" : "invisible"
          }`}
          title={expanded ? "折叠" : "展开"}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            level === 1 ? theme.accent : "bg-zinc-300 dark:bg-zinc-600"
          }`}
        />
        {(displayPage.icon || isCompanyLink) && (
          <span className="shrink-0 text-sm">
            {displayPage.icon || "🏢"}
          </span>
        )}

        {renaming && !isCompanyLink ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(node.title);
                setRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded bg-white px-1 py-0.5 text-sm text-zinc-800 outline-none ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen(node.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              if (isCompanyLink) return;
              setDraft(node.title);
              setRenaming(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(node.id, e.clientX, e.clientY);
            }}
            className={`min-w-0 flex-1 truncate text-left text-sm text-zinc-700 transition-colors dark:text-zinc-200 ${
              level === 1 ? "font-medium" : ""
            } ${theme.hover}`}
            title={
              isCompanyLink
                ? `${displayTitle}（知识库公司页引用，点击打开原页）`
                : `${displayTitle}（点击进入，双击重命名）`
            }
          >
            {displayTitle}
          </button>
        )}

        {isCompanyLink && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            公司页
          </span>
        )}

        {hasChildren && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
            {children.length}
          </span>
        )}

        {!isCompanyLink && (
          <>
            <button
              type="button"
              onClick={() => {
                onAddChild(node.id);
                setExpanded(true);
              }}
              className="shrink-0 rounded px-1.5 text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover/node:opacity-100 dark:hover:text-zinc-200"
              title="添加下级分类"
            >
              + 下级
            </button>
            <button
              type="button"
              onClick={() => {
                onLinkCompany(node.id);
                setExpanded(true);
              }}
              className="shrink-0 rounded px-1.5 text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover/node:opacity-100 dark:hover:text-zinc-200"
              title="把知识库公司页链接到这个层级"
            >
              + 公司
            </button>
          </>
        )}
      </div>

      {expanded && hasChildren && (
        <ul className="ml-[10px] space-y-0.5 border-l border-zinc-200 pl-2.5 dark:border-zinc-700/70">
          {children.map((child) => (
            <ChainNode
              key={child.id}
              node={child}
              allPages={allPages}
              theme={theme}
              level={level + 1}
              onOpen={onOpen}
              onAddChild={onAddChild}
              onLinkCompany={onLinkCompany}
              onRename={onRename}
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
