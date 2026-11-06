import type { Metadata } from "next";
import NvidiaResearchBoard from "@/components/company-board-preview/NvidiaResearchBoard";

export const metadata: Metadata = {
  title: "英伟达 NVDA · 公司研究",
  robots: { index: false, follow: false },
};

export default function NvidiaResearchPage() {
  return <NvidiaResearchBoard />;
}
