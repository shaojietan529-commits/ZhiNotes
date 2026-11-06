import type { Metadata } from "next";
import CompanyBoardPreview from "@/components/company-board-preview/CompanyBoardPreview";

export const metadata: Metadata = {
  title: "公司看板 · 虚构模板",
  robots: { index: false, follow: false },
};

export default function CompanyBoardTemplatePage() {
  return <CompanyBoardPreview />;
}
