/*
 * List endpoints carry identifiers, not research words. Read the words of the
 * first rows that will render from their detail endpoints, bounded and in
 * parallel. Any failure leaves the row as it was, so a list never breaks on
 * a missing detail.
 */
export const WORDS_LIMIT = 30;

function wordsOf(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^[a-z]+_[0-9a-f-]{8,}$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * @param {string} api base URL
 * @param {object[]} items list rows
 * @param {{ idKey: string, path: string, record: string, fields: string[] }} spec
 * @returns {Promise<object[]>} rows with `words` set where a detail supplied them
 */
export async function withWords(api, items, { idKey, path, record, fields }) {
  if (!api) return items;
  const head = await Promise.all(items.slice(0, WORDS_LIMIT).map(async (item) => {
    const id = item[idKey];
    if (!id) return item;
    try {
      const response = await fetch(`${api}${path}/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!response.ok) return item;
      const body = await response.json();
      const revision = body.currentRevision ?? {};
      const row = body[record] ?? {};
      const words = fields.map((field) => wordsOf(revision[field]) ?? wordsOf(row[field])).find(Boolean) ?? null;
      return words ? { ...item, words } : item;
    } catch {
      return item;
    }
  }));
  return [...head, ...items.slice(WORDS_LIMIT)];
}
