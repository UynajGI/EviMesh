/*
 * Response hydration helpers (M13.8): some list endpoints return rows without
 * their joined relations, which live on detail endpoints instead.
 *
 * - GET /evidence?claimId= returns evidence rows WITHOUT links; the relation
 *   to claim revisions lives on GET /evidence/:evidenceId as `claimLinks`.
 * - GET /claims/:claimId/verifications returns receipt rows WITHOUT findings;
 *   findings live on GET /verifications/:receiptId.
 *
 * Both pages group by these relations, so we hydrate after listing. Calls run
 * in bounded chunks to avoid request storms, and failures degrade to the row
 * as returned (the grouping stays honest: unknown relation -> ungrouped).
 */

async function chunkMap(items, mapper, size = 8) {
  const out = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    out.push(...await Promise.all(chunk.map(mapper)));
  }
  return out;
}

async function fetchJson(api, path) {
  const response = await fetch(`${api}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `${path} is unavailable.`);
  return payload;
}

/** Attach `claimLinks` to every evidence row; falls back to row.links if present. */
export async function hydrateEvidenceLinks(api, evidenceItems) {
  return chunkMap(evidenceItems, async (item) => {
    if (Array.isArray(item.claimLinks) || Array.isArray(item.links)) return item;
    try {
      const detail = await fetchJson(api, `/evidence/${item.evidenceId}`);
      return { ...item, claimLinks: detail.claimLinks ?? [] };
    } catch {
      return { ...item, claimLinks: [] };
    }
  });
}

/** Attach `findings` to every verification receipt row. */
export async function hydrateReceiptFindings(api, receiptItems) {
  return chunkMap(receiptItems, async (receipt) => {
    if (Array.isArray(receipt.findings)) return receipt;
    try {
      const detail = await fetchJson(api, `/verifications/${receipt.receiptId}`);
      return { ...receipt, findings: detail.findings ?? [] };
    } catch {
      return { ...receipt, findings: [] };
    }
  });
}

/** Relation of an evidence row toward a claim: claimLinks first, then legacy links. */
export function evidenceRelations(item) {
  const links = Array.isArray(item.claimLinks) ? item.claimLinks : Array.isArray(item.links) ? item.links : [];
  return links.map((link) => link.relationType).filter(Boolean);
}
