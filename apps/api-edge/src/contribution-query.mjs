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

/** Return an Actor's contribution roles and produced/used attribution edges. */
export async function getContribution({ repository, actorId } = {}) {
  actorId = requiredActorId(actorId);
  if (!repository || typeof repository.listContributionStatements !== "function" || typeof repository.listContributionEdges !== "function") {
    throw new ContributionQueryError("repository contribution query methods are required");
  }

  const statements = await repository.listContributionStatements(actorId);
  if (!Array.isArray(statements) || statements.length === 0) {
    throw new ContributionQueryError("contribution statements not found", "CONTRIBUTION_NOT_FOUND", 404);
  }
  const statementIds = statements.map((statement) => statement.statementId);
  const edges = await repository.listContributionEdges(statementIds);
  const normalizedEdges = Array.isArray(edges) ? edges : [];
  const roles = [...new Set(statements.map((statement) => statement.role))].sort();
  const roleDetails = roles.map((role) => ({ role, semantics: contributionRoleSemantics(role) }));

  return {
    actorId,
    roles: roleDetails,
    produced: normalizedEdges.filter((edge) => edge.edgeType === "produced"),
    used: normalizedEdges.filter((edge) => edge.edgeType === "used"),
    statements,
  };
}
