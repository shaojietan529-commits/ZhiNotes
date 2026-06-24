import { getAllPageMetadata } from "@/lib/db/local/queries";
import { getModuleRootId } from "./moduleWorkspaces";

export async function findIndustryChainPageId(
  name: string
): Promise<string | null> {
  const rootId = await getModuleRootId("industry-chain");
  const allPages = await getAllPageMetadata();

  const descendants = new Set<string>();
  const collect = (parentId: string) => {
    for (const p of allPages) {
      if (p.parent_id === parentId && !descendants.has(p.id)) {
        descendants.add(p.id);
        collect(p.id);
      }
    }
  };
  collect(rootId);

  const chainPages = allPages.filter((p) => descendants.has(p.id));

  const exact = chainPages.find((p) => p.title === name);
  if (exact) return exact.id;

  const partial = chainPages.find(
    (p) => p.title?.includes(name) || name.includes(p.title || "\0")
  );
  return partial?.id ?? null;
}
