import { findDescendantPageMetadataByTitle } from "@/lib/db/local/queries";
import { getModuleRootId } from "./moduleWorkspaces";

export async function findIndustryChainPageId(
  name: string
): Promise<string | null> {
  const rootId = await getModuleRootId("industry-chain");
  const page = await findDescendantPageMetadataByTitle(rootId, name);
  return page?.id ?? null;
}
