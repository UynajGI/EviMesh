function encode(value) {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    throw new TypeError("invalid pagination cursor");
  }
}

/** Stable ascending pagination by (createdAt, id), with an opaque cursor. */
export function paginate(items, { limit = 20, cursor = null, getKey = (item) => ({ createdAt: item.createdAt, id: item.id }) } = {}) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("limit must be between 1 and 100");
  const decoded = cursor ? decode(cursor) : null;
  const sorted = [...items].sort((left, right) => {
    const a = getKey(left); const b = getKey(right);
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
  const start = decoded ? sorted.findIndex((item) => {
    const key = getKey(item);
    return key.createdAt > decoded.createdAt || (key.createdAt === decoded.createdAt && key.id > decoded.id);
  }) : 0;
  const offset = start < 0 ? sorted.length : start;
  const page = sorted.slice(offset, offset + limit);
  const last = page.at(-1);
  return { items: page, nextCursor: last && offset + page.length < sorted.length ? encode(getKey(last)) : null };
}
