const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const OBJECT_ID_PREFIXES = Object.freeze({
  Project: "project",
  Question: "question",
  Task: "task",
  Answer: "answer",
  Claim: "claim",
  Rebuttal: "rebuttal",
  Evaluation: "evaluation",
  Dataset: "dataset",
  Tool: "tool",
  Artifact: "artifact",
  Evidence: "evidence",
  Run: "run",
  Verification: "verification",
  Frontier: "frontier",
});

const PREFIX_BY_KIND = new Map(Object.entries(OBJECT_ID_PREFIXES));
const KIND_BY_PREFIX = new Map(
  Object.entries(OBJECT_ID_PREFIXES).map(([kind, prefix]) => [prefix, kind]),
);

function assertUuid(uuid) {
  if (typeof uuid !== "string" || !UUID_PATTERN.test(uuid)) {
    throw new TypeError("Object ID UUID must use canonical UUID syntax");
  }
}

export function formatObjectId(kind, uuid) {
  const prefix = PREFIX_BY_KIND.get(kind);
  if (!prefix) {
    throw new TypeError(`Unsupported object kind: ${kind}`);
  }

  assertUuid(uuid);
  return `${prefix}_${uuid.toLowerCase()}`;
}

export function parseObjectId(value) {
  if (typeof value !== "string") {
    throw new TypeError("Object ID must be a string");
  }

  const separator = value.lastIndexOf("_");
  if (separator <= 0 || separator === value.length - 1) {
    throw new TypeError("Object ID must be formatted as <prefix>_<uuid>");
  }

  const prefix = value.slice(0, separator);
  const uuid = value.slice(separator + 1);
  const kind = KIND_BY_PREFIX.get(prefix);
  if (!kind) {
    throw new TypeError(`Unsupported object ID prefix: ${prefix}`);
  }

  assertUuid(uuid);
  return Object.freeze({ kind, prefix, uuid: uuid.toLowerCase() });
}

export function isObjectId(value) {
  try {
    parseObjectId(value);
    return true;
  } catch {
    return false;
  }
}
