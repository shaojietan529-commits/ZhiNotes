import type { Metadata } from "next";
import CompanyBoardPreview from "@/components/company-board-preview/CompanyBoardPreview";

export const metadata: Metadata = {
  title: "公司看板样板",
  robots: { index: false, follow: false },
};

// Outside the workspace layout: no account, database or sync providers.
export default function CompanyBoardPreviewPage() {
  return <CompanyBoardPreview />;
}
