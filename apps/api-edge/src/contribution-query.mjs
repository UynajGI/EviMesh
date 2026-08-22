import { contributionRoleSemantics } from "../../../packages/protocol/src/contribution-role.mjs";

export class ContributionQueryError extends Error {
  constructor(message, code = "CONTRIBUTION_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "ContributionQueryError";
    this.code = code;
    this.status = status;
  }
}

function requiredActorId(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ContributionQueryError("actor id must be a non-empty string");
  }
  return value.trim();
}

function actorIdentityCard(actor, profile) {
  if (!actor) return null;
  return {
    actorId: actor.actorId,
    actorType: actor.actorType ?? null,
    identityStrength: actor.identityStrength ?? null,
    displayName: profile?.displayName ?? actor.displayName ?? null,
    bio: profile?.bio ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    /* Self-declared agent attributes (nullable by design): the platform
     * never attests them, null means "not stated", never a guess. */
    modelName: actor.modelName ?? null,
    runtime: actor.runtime ?? null,
    scope: actor.scope ?? null,
    publicKeyFingerprint: actor.publicKeyFingerprint ?? null,
    ownerActorId: actor.ownerActorId ?? null,
    createdAt: actor.createdAt ?? null,
    updatedAt: actor.updatedAt ?? null,
  };
}

/**
 * List the actor directory (researchers, agents, services) newest first.
 * Bounded page without a cursor: the directory is small and ordered by
 * stable ids, so offset pagination is unnecessary.
 */
export async function listActors({ repository, limit = 100 } = {}) {
  if (!repository || typeof repository.listActors !== "function") {
    throw new ContributionQueryError("repository listActors is required");
  }
  const bounded = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 100, 200));
  const actors = await repository.listActors();
  const rows = Array.isArray(actors) ? actors : [];
  return { items: rows.slice(0, bounded).map((actor) => actorIdentityCard(actor) ?? actor) };
}

/** Return an Actor's identity card, contribution roles, and produced/used attribution edges. */
export async function getContribution({ repository, actorId } = {}) {
  actorId = requiredActorId(actorId);
  if (!repository || typeof repository.listContributionStatements !== "function" || typeof repository.listContributionEdges !== "function") {
    throw new ContributionQueryError("repository contribution query methods are required");
  }

  /* The actor row (and profile, when the repository exposes it) is the
   * identity card; contributions are loaded alongside it. */
  const reads = [repository.listContributionStatements(actorId)];
  if (typeof repository.getActor === "function") reads.push(repository.getActor(actorId));
  if (typeof repository.getActorProfile === "function") reads.push(repository.getActorProfile(actorId));
  const [statementRows, actor, profile] = await Promise.all(reads);

  const statements = Array.isArray(statementRows) ? statementRows : [];
  if (statements.length === 0 && !actor) {
    throw new ContributionQueryError("contribution statements not found", "CONTRIBUTION_NOT_FOUND", 404);
  }
  const statementIds = statements.map((statement) => statement.statementId);
  const edges = statementIds.length > 0 ? await repository.listContributionEdges(statementIds) : [];
  const normalizedEdges = Array.isArray(edges) ? edges : [];
  const actorEvents = typeof repository.listResearchEvents === "function"
    ? await repository.listResearchEvents({ actorId })
    : [];
  const lastEvent = (Array.isArray(actorEvents) ? actorEvents : []).reduce((latest, event) => {
    if (!latest) return event;
    const byTime = String(event.createdAt ?? "").localeCompare(String(latest.createdAt ?? ""));
    return byTime > 0 || (byTime === 0 && String(event.eventId ?? "").localeCompare(String(latest.eventId ?? "")) > 0) ? event : latest;
  }, null);
  const roles = [...new Set(statements.map((statement) => statement.role))].sort();
  const roleDetails = roles.map((role) => ({ role, semantics: contributionRoleSemantics(role) }));

  return {
    actorId,
    actor: actorIdentityCard(actor, profile),
    roles: roleDetails,
    produced: normalizedEdges.filter((edge) => edge.edgeType === "produced"),
    used: normalizedEdges.filter((edge) => edge.edgeType === "used"),
    statements,
    lastEventAt: lastEvent?.createdAt ?? null,
    lastEventId: lastEvent?.eventId ?? null,
  };
}
