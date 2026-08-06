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

function normalizeRelation({ sourceClaimId, targetClaimId, relationType }) {
  sourceClaimId = requiredText(sourceClaimId, "source claim id");
  targetClaimId = requiredText(targetClaimId, "target claim id");
  try {
    assertClaimRelationType(relationType);
  } catch (error) {
    throw new ClaimRelationCommandError(error.message, "RELATION_TYPE_INVALID");
  }
  return { sourceClaimId, targetClaimId, relationType };
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
  ({ sourceClaimId, targetClaimId, relationType } = normalizeRelation({ sourceClaimId, targetClaimId, relationType }));
  if (typeof eventFactory !== "function") throw new ClaimRelationCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const existing = await transaction.listClaimRelations();
    const edges = (existing ?? []).filter((relation) => !relation.deletedAt).map((relation) => ({
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
      eventType: "claim.relation.created",
      payload: { entity_type: "claim_relation", source_claim_id: sourceClaimId, target_claim_id: targetClaimId, relation_type: relationType, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new ClaimRelationCommandError("eventFactory must return an event object");
    const persistedRelation = await transaction.insertClaimRelation(relation);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { relation: persistedRelation ?? relation, event: persistedEvent ?? event };
  });
}

async function changeClaimRelation({ repository, actorId, actorRole, sourceClaimId, targetClaimId, relationType, replacement = null, now = new Date(), eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ClaimRelationCommandError("repository withTransaction is required");
  for (const method of ["listClaimRelations", "updateClaimRelation", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ClaimRelationCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  ({ sourceClaimId, targetClaimId, relationType } = normalizeRelation({ sourceClaimId, targetClaimId, relationType }));
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new ClaimRelationCommandError("relation time is invalid");
  if (typeof eventFactory !== "function") throw new ClaimRelationCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  let replacementRelation = null;
  if (replacement !== null) {
    if (!repository.insertClaimRelation) throw new ClaimRelationCommandError("repository insertClaimRelation is required");
    replacementRelation = normalizeRelation(replacement);
    replacementRelation.createdBy = actorId;
  }

  return repository.withTransaction(async (transaction) => {
    const existing = await transaction.listClaimRelations();
    const current = (existing ?? []).find((relation) =>
      (relation.sourceClaimId ?? relation.source) === sourceClaimId &&
      (relation.targetClaimId ?? relation.target) === targetClaimId &&
      (relation.relationType ?? relation.type) === relationType &&
      !relation.deletedAt,
    );
    if (!current) throw new ClaimRelationCommandError("active claim relation not found", "RELATION_NOT_FOUND", 404);
    if (replacementRelation) {
      const activeEdges = (existing ?? []).filter((relation) => !relation.deletedAt).map((relation) => ({
        type: relation.relationType ?? relation.type,
        source: relation.sourceClaimId ?? relation.source,
        target: relation.targetClaimId ?? relation.target,
      })).filter((edge) => !(edge.type === relationType && edge.source === sourceClaimId && edge.target === targetClaimId));
      if (activeEdges.some((edge) => edge.type === replacementRelation.relationType && edge.source === replacementRelation.sourceClaimId && edge.target === replacementRelation.targetClaimId)) {
        throw new ClaimRelationCommandError("replacement claim relation already exists", "RELATION_EXISTS", 409);
      }
      if (replacementRelation.relationType === "depends_on") {
        try {
          assertDependencyAddition(activeEdges.filter((edge) => edge.type === "depends_on"), replacementRelation.sourceClaimId, replacementRelation.targetClaimId);
        } catch (error) {
          throw new ClaimRelationCommandError(error.message, "DEPENDENCY_CYCLE", 409);
        }
      }
    }
    const endedAt = nowDate.toISOString();
    const ended = await transaction.updateClaimRelation(sourceClaimId, targetClaimId, relationType, { deletedAt: endedAt });
    const event = await eventFactory({
      eventType: replacementRelation ? "claim.relation.replaced" : "claim.relation.ended",
      payload: {
        entity_type: "claim_relation", source_claim_id: sourceClaimId, target_claim_id: targetClaimId, relation_type: relationType,
        ended_at: endedAt, replacement: replacementRelation, actor_id: actorId,
      },
    });
    if (!event || typeof event !== "object") throw new ClaimRelationCommandError("eventFactory must return an event object");
    const created = replacementRelation ? await transaction.insertClaimRelation(replacementRelation) : null;
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { ended: ended ?? { ...current, deletedAt: endedAt }, replacement: created ?? replacementRelation, event: persistedEvent ?? event };
  });
}

/** End a ClaimRelation without deleting its historical row. */
export async function endClaimRelation(options = {}) {
  return changeClaimRelation(options);
}

/** End one ClaimRelation and create its replacement in the same transaction. */
export async function replaceClaimRelation(options = {}) {
  if (options.replacement === null || options.replacement === undefined) throw new ClaimRelationCommandError("replacement relation is required");
  return changeClaimRelation(options);
}
