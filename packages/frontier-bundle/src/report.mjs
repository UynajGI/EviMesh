/** Generate report.md (M12-10): frontier state summary with contested blockers. */
export function buildReport({ snapshot, members, claimRevisions, evidenceEntries, receiptEntries, checkpoints }) {
  const stateCounts = new Map();
  const contested = [];
  const accepted = [];
  for (const { member, revision } of claimRevisions) {
    const state = member.status ?? revision.state ?? "unknown";
    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
    if (state === "contested") contested.push(`${member.claimId}@${member.claimRevision}`);
    if (state === "accepted") accepted.push(`${member.claimId}@${member.claimRevision}`);
  }
  const outcomes = new Map();
  for (const { outcome } of receiptEntries) {
    const key = outcome ?? "unknown";
    outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
  }

  const lines = [];
  lines.push(`# Frontier Bundle Report`);
  lines.push("");
  lines.push(`- Project: \`${snapshot.projectId}\``);
  lines.push(`- Frontier snapshot: \`${snapshot.snapshotId}\` (sequence ${snapshot.sequence})`);
  lines.push(`- Claims: ${members.length}`);
  lines.push(`- Evidence objects: ${evidenceEntries.length}`);
  lines.push(`- Verification receipts: ${receiptEntries.length}`);
  lines.push(`- Merkle checkpoints: ${checkpoints}`);
  lines.push("");
  lines.push("## Claims by state");
  lines.push("");
  for (const [state, count] of [...stateCounts.entries()].sort()) lines.push(`- ${state}: ${count}`);
  lines.push("");
  lines.push("## Accepted claims");
  lines.push("");
  if (accepted.length === 0) lines.push("(none)");
  for (const claim of accepted) lines.push(`- ${claim}`);
  lines.push("");
  lines.push("## Open blockers (contested claims)");
  lines.push("");
  if (contested.length === 0) lines.push("(none)");
  for (const claim of contested) lines.push(`- ${claim}`);
  lines.push("");
  lines.push("## Verification outcomes");
  lines.push("");
  if (outcomes.size === 0) lines.push("(none)");
  for (const [outcome, count] of [...outcomes.entries()].sort()) lines.push(`- ${outcome}: ${count}`);
  lines.push("");
  return `${lines.join("\n")}`;
}
