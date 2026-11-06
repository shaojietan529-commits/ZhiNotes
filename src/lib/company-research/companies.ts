// Public identity only. Selecting a company does not grant access to private sources.
export const NVIDIA = {
  id: "NASDAQ-NVDA",
  name: "英伟达",
  legalName: "NVIDIA Corporation",
  ticker: "NVDA",
  exchange: "NASDAQ",
  publicSources: [
    { title: "投资者关系", url: "https://investor.nvidia.com/home/default.aspx" },
    { title: "财务报告", url: "https://investor.nvidia.com/financial-info/financial-reports/default.aspx" },
    { title: "季度业绩", url: "https://investor.nvidia.com/financial-info/quarterly-results/default.aspx" },
    { title: "官方新闻", url: "https://nvidianews.nvidia.com/" },
  ],
} as const;
