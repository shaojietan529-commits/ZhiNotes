import type { Page } from "@/lib/utils/types";
import {
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import { displayPageTitle } from "@/lib/pages/displayTitle";

// A company can live once in the knowledge base while appearing in many
// industry-chain branches. These lightweight chain nodes store only a pointer
// to the source company page, so research content does not split into copies.

export const INDUSTRY_COMPANY_LINK_TYPE = "知识库公司页";

const PROPERTY_NAMES = {
  linkType: "引用类型",
  companyPageId: "公司页ID",
  sourceModule: "来源模块",
  linkedAt: "链接时间",
} as const;

export function getLinkedKnowledgeCompanyPageId(page: Page): string | null {
  const properties = parsePageProperties(page.properties);
  const linkType = properties.find(
    (property) => property.name === PROPERTY_NAMES.linkType
  );
  const companyPage = properties.find(
    (property) => property.name === PROPERTY_NAMES.companyPageId
  );

  if (linkType?.value !== INDUSTRY_COMPANY_LINK_TYPE) return null;
  return companyPage?.value.trim() || null;
}

export function isKnowledgeCompanyLinkPage(page: Page): boolean {
  return Boolean(getLinkedKnowledgeCompanyPageId(page));
}

export function buildIndustryCompanyLinkProperties(
  companyPage: Page,
  linkedAt = new Date()
): string {
  const properties: PageProperty[] = [
    {
      id: "zhinote-industry-company-link-type",
      name: PROPERTY_NAMES.linkType,
      type: "select",
      value: INDUSTRY_COMPANY_LINK_TYPE,
      options: [INDUSTRY_COMPANY_LINK_TYPE],
    },
    {
      id: "zhinote-industry-company-link-target",
      name: PROPERTY_NAMES.companyPageId,
      type: "text",
      value: companyPage.id,
    },
    {
      id: "zhinote-industry-company-link-source",
      name: PROPERTY_NAMES.sourceModule,
      type: "select",
      value: "知识库",
      options: ["知识库"],
    },
    {
      id: "zhinote-industry-company-link-created-at",
      name: PROPERTY_NAMES.linkedAt,
      type: "date",
      value: linkedAt.toISOString().slice(0, 10),
    },
  ];

  return stringifyPageProperties(properties);
}

export function buildIndustryCompanyLinkContent(companyPage: Page): string {
  const title = escapeHtml(displayPageTitle(companyPage.title));
  const href = `/page/${encodeURIComponent(companyPage.id)}`;

  return [
    `<p>这是产业链层级里的公司页引用，原始研究内容仍维护在知识库公司页。</p>`,
    `<p><a href="${href}">${title}</a></p>`,
  ].join("");
}

export function resolveIndustryNodeTargetPageId(
  page: Page,
  allPages: Page[]
): string {
  const linkedPageId = getLinkedKnowledgeCompanyPageId(page);
  if (!linkedPageId) return page.id;
  return allPages.some((candidate) => candidate.id === linkedPageId)
    ? linkedPageId
    : page.id;
}

export function getIndustryNodeDisplayPage(
  page: Page,
  allPages: Page[]
): Page {
  const linkedPageId = getLinkedKnowledgeCompanyPageId(page);
  if (!linkedPageId) return page;
  return allPages.find((candidate) => candidate.id === linkedPageId) ?? page;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
