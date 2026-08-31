import { paginate } from "./pagination.mjs";

const TYPES = Object.freeze({
  answer: Object.freeze({ plural: "answers", idField: "answerId", list: "listAnswers", get: "getAnswer", current: "getCurrentAnswerRevision" }),
  rebuttal: Object.freeze({ plural: "rebuttals", idField: "rebuttalId", list: "listRebuttals", get: "getRebuttal", current: "getCurrentRebuttalRevision" }),
  evaluation: Object.freeze({ plural: "evaluations", idField: "evaluationId", list: "listEvaluations", get: "getEvaluation", current: "getCurrentEvaluationRevision", related: "listEvaluationBases" }),
  dataset: Object.freeze({ plural: "datasets", idField: "datasetId", list: "listDatasets", get: "getDataset", current: "getCurrentDatasetRevision" }),
  tool: Object.freeze({ plural: "tools", idField: "toolId", list: "listTools", get: "getTool", current: "getCurrentToolRevision" }),
});

export class TypedResearchQueryError extends Error {
  constructor(message, code = "TYPED_RESEARCH_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "TypedResearchQueryError";
    this.code = code;
    this.status = status;
  }
}

function config(kind) {
  const value = TYPES[kind];
  if (!value) throw new TypedResearchQueryError(`unsupported typed research node: ${String(kind)}`, "RESEARCH_NODE_KIND_INVALID");
  return value;
}

function optionalText(value, field) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.trim().length === 0) throw new TypedResearchQueryError(`${field} must be a non-empty string or null`);
  return value.trim();
}

function requiredText(value, field) {
  const normalized = optionalText(value, field);
  if (normalized === null) throw new TypedResearchQueryError(`${field} is required`);
  return normalized;
}

export async function listTypedResearchNodes({ repository, kind, projectId = null, state = null, stance = null, toolKind = null, limit = 20, cursor = null, accessToken = null, actorId = null } = {}) {
  const type = config(kind);
  if (!repository || typeof repository[type.list] !== "function") throw new TypedResearchQueryError(`repository ${type.list} is required`, "TYPED_RESEARCH_UNAVAILABLE", 503);
  const filters = {
    projectId: optionalText(projectId, "project id"),
    state: optionalText(state, "state"),
    stance: optionalText(stance, "stance"),
    toolKind: optionalText(toolKind, "tool kind"),
  };
  const rows = await repository[type.list]({ ...filters, accessToken, actorId });
  return paginate(rows, { limit, cursor, getKey: (row) => ({ createdAt: row.createdAt, id: row[type.idField] }) });
}

export async function getTypedResearchNode({ repository, kind, id, accessToken = null, actorId = null } = {}) {
  const type = config(kind);
  id = requiredText(id, `${kind} id`);
  if (!repository || typeof repository[type.get] !== "function" || typeof repository[type.current] !== "function") {
    throw new TypedResearchQueryError(`repository ${kind} detail methods are required`, "TYPED_RESEARCH_UNAVAILABLE", 503);
  }
  const identity = await repository[type.get](id, { accessToken, actorId });
  if (!identity) throw new TypedResearchQueryError(`${kind} not found`, `${kind.toUpperCase()}_NOT_FOUND`, 404);
  const currentRevision = await repository[type.current](id, { accessToken, actorId });
  if (!currentRevision) throw new TypedResearchQueryError(`${kind} current revision not found`, `${kind.toUpperCase()}_REVISION_NOT_FOUND`, 500);
  const detail = { [kind]: identity, currentRevision };
  if (type.related && typeof repository[type.related] === "function") {
    const bases = await repository[type.related](id, currentRevision.revision, { accessToken, actorId });
    detail.bases = bases.map((basis) => ({ kind: basis.basisKind, id: basis.basisId, revision: basis.basisRevision }));
  }
  return detail;
}

export const TYPED_RESEARCH_TYPES = TYPES;
