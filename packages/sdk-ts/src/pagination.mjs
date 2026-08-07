/**
 * Iterate every item across cursor pages.
 * `fetchPage` receives `{ limit, cursor }` and must return `{ items, nextCursor }`.
 */
export async function* iterateItems(fetchPage, { limit = 50, startCursor = null } = {}) {
  if (typeof fetchPage !== "function") throw new TypeError("iterateItems requires a fetchPage function");
  let cursor = startCursor;
  for (;;) {
    const page = await fetchPage({ limit, cursor });
    const items = Array.isArray(page?.items) ? page.items : [];
    for (const item of items) yield item;
    cursor = page?.nextCursor ?? null;
    if (!cursor || items.length === 0) return;
  }
}

/** Collect every page item into one array. */
export async function collectItems(fetchPage, options = {}) {
  const items = [];
  for await (const item of iterateItems(fetchPage, options)) items.push(item);
  return items;
}
