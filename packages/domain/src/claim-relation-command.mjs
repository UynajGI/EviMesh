import { assertClaimRelationType } from "../../protocol/src/claim-relation.mjs";
import { assertDependencyAddition } from "../../protocol/src/dependency-graph.mjs";
import { assertProjectRoleForAction } from "./project-authorization.mjs";

export class ClaimRelationCommandError extends Error {
  constructor(message, code = "CLAIM_RELATION_INVALID", status = 400) {
    super(message);
    this.name = "ClaimRelationCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ClaimRelationCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

/** Create a ClaimRelation and its audit event atomically. */
export async function createClaimRelation({
  repository,
  actorId,
  actorRole,
  sourceClaimId,
  targetClaimId,
  relationType,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ClaimRelationCommandError("repository withTransaction is required");
  for (const method of ["listClaimRelations", "insertClaimRelation", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ClaimRelationCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  sourceClaimId = requiredText(sourceClaimId, "source claim id");
  targetClaimId = requiredText(targetClaimId, "target claim id");
  try {
    assertClaimRelationType(relationType);
  } catch (error) {
    throw new ClaimRelationCommandError(error.message, "RELATION_TYPE_INVALID");
  }
  if (typeof eventFactory !== "function") throw new ClaimRelationCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const existing = await transaction.listClaimRelations();
    const edges = (existing ?? []).map((relation) => ({
      type: relation.relationType ?? relation.type,
      source: relation.sourceClaimId ?? relation.source,
      target: relation.targetClaimId ?? relation.target,
    }));
    if (edges.some((edge) => edge.type === relationType && edge.source === sourceClaimId && edge.target === targetClaimId)) {
      throw new ClaimRelationCommandError("claim relation already exists", "RELATION_EXISTS", 409);
    }
    if (relationType === "depends_on") {
      try {
        assertDependencyAddition(edges.filter((edge) => edge.type === "depends_on"), sourceClaimId, targetClaimId);
      } catch (error) {
        throw new ClaimRelationCommandError(error.message, "DEPENDENCY_CYCLE", 409);
      }
    }
    const relation = { sourceClaimId, targetClaimId, relationType, createdBy: actorId };
    const event = await eventFactory({
      eventType: "claim.relation_created",
      payload: { entity_type: "claim_relation", source_claim_id: sourceClaimId, target_claim_id: targetClaimId, relation_type: relationType, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new ClaimRelationCommandError("eventFactory must return an event object");
    const persistedRelation = await transaction.insertClaimRelation(relation);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { relation: persistedRelation ?? relation, event: persistedEvent ?? event };
  });
}
