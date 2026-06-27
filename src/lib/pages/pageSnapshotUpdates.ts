import type { Page } from "@/lib/utils/types";

export function collectMovedPageSnapshots(
  allPages: Page[],
  movedPage: Page
): Page[] {
  const childrenByParent = new Map<string, Page[]>();
  for (const page of allPages) {
    if (!page.parent_id) continue;
    const children = childrenByParent.get(page.parent_id) ?? [];
    children.push(page);
    childrenByParent.set(page.parent_id, children);
  }

  const snapshots: Page[] = [movedPage];
  const stack = [movedPage];
  while (stack.length > 0) {
    const parent = stack.pop();
    if (!parent) continue;
    for (const child of childrenByParent.get(parent.id) ?? []) {
      const nextChild = {
        ...child,
        depth: parent.depth + 1,
        updated_at: movedPage.updated_at,
      };
      snapshots.push(nextChild);
      stack.push(nextChild);
    }
  }
  return snapshots;
}
