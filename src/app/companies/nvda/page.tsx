import type { Metadata } from "next";
import NvidiaResearchBoard from "@/components/company-board-preview/NvidiaResearchBoard";

export const metadata: Metadata = {
  title: "英伟达 NVDA · 公司看板",
  robots: { index: false, follow: false },
};

export default function NvidiaCompanyBoardPage() {
  return <NvidiaResearchBoard />;
}
