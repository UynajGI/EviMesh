import { FrontierContextCompileError, compileFrontierContext } from "./frontier-context-compiler.mjs";

function requiredPointer(value, field) {
  if (typeof value !== "string" || value.length < 2 || !value.startsWith("/")) {
    throw new FrontierContextCompileError(`${field} must be a non-root JSON Pointer`, "BLIND_PATH_INVALID");
  }
  return value;
}

function pointerSegments(pointer) {
  return pointer.slice(1).split("/").map((segment) => {
    if (segment.includes("~") && /~(?:[^01]|$)/.test(segment)) {
      throw new FrontierContextCompileError("blind path contains an invalid JSON Pointer escape", "BLIND_PATH_INVALID");
    }
    const value = segment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (["__proto__", "prototype", "constructor"].includes(value)) {
      throw new FrontierContextCompileError("blind path targets an unsafe property", "BLIND_PATH_INVALID");
    }
    return value;
  });
}

function deleteAtPointer(bundle, pointer) {
  const segments = pointerSegments(pointer);
  let parent = bundle;
  for (const segment of segments.slice(0, -1)) {
    if (parent === null || typeof parent !== "object" || !Object.hasOwn(parent, segment)) {
      throw new FrontierContextCompileError("blind path is not present in the fixed context", "BLIND_PATH_NOT_FOUND");
    }
    parent = parent[segment];
  }
  const finalSegment = segments.at(-1);
  if (Array.isArray(parent) && !/^(0|[1-9]\d*)$/.test(finalSegment)) {
    throw new FrontierContextCompileError("blind path indexes an array with a non-numeric segment", "BLIND_PATH_INVALID");
  }
  if (parent === null || typeof parent !== "object" || !Object.hasOwn(parent, finalSegment)) {
    throw new FrontierContextCompileError("blind path is not present in the fixed context", "BLIND_PATH_NOT_FOUND");
  }
  if (Array.isArray(parent)) {
    // Preserve original indexes so subsequent JSON Pointers still address the
    // same elements when multiple siblings are redacted from one array.
    delete parent[Number(finalSegment)];
  }
  else delete parent[finalSegment];
}

/**
 * Compile a reproducible blind ContextBundle from a fixed Frontier.
 *
 * Expected outputs are always withheld. `hiddenPaths` supplies additional,
 * explicit JSON Pointer redactions and is intentionally not retained in the
 * returned payload, so it cannot disclose target-label locations to a verifier.
 */
export function compileBlindContext({ hiddenPaths = [], ...frontierContext } = {}) {
  if (!Array.isArray(hiddenPaths)) throw new FrontierContextCompileError("blind paths must be an array", "BLIND_PATH_INVALID");
  const bundle = compileFrontierContext(frontierContext);
  delete bundle.task.outputs;
  const pointers = [...new Set(hiddenPaths.map((value, index) => requiredPointer(value, `blind path ${index}`)))].sort();
  for (const pointer of pointers) deleteAtPointer(bundle, pointer);
  return { ...bundle, mode: "blind" };
}

/** Compile a blind context using the same immutable repository contract as Frontier Context. */
export async function compileBlindContextJob({ repository, taskId, taskRevision, frontierSnapshotId, hiddenPaths = [] } = {}) {
  if (!repository || ["getTaskRevision", "getFrontierSnapshot", "listFrontierMembers", "getClaimRevision", "listFrontierDependencies"].some((method) => typeof repository[method] !== "function")) {
    throw new FrontierContextCompileError("repository blind context methods are required");
  }
  const [task, frontier, members] = await Promise.all([
    repository.getTaskRevision(taskId, taskRevision),
    repository.getFrontierSnapshot(frontierSnapshotId),
    repository.listFrontierMembers(frontierSnapshotId),
  ]);
  if (!task) throw new FrontierContextCompileError("task revision not found", "TASK_REVISION_NOT_FOUND");
  if (!frontier) throw new FrontierContextCompileError("frontier snapshot not found", "FRONTIER_SNAPSHOT_NOT_FOUND");
  const hydratedMembers = await Promise.all((members ?? []).map(async (member) => ({
    ...member,
    claimRevisionData: await repository.getClaimRevision(member.claimId, member.claimRevision),
  })));
  const dependencies = await repository.listFrontierDependencies({ frontierSnapshotId, members: hydratedMembers.map(({ claimId, claimRevision }) => ({ claimId, revision: claimRevision })) });
  return compileBlindContext({ taskRevision: task, frontierSnapshot: frontier, frontierMembers: hydratedMembers, dependencies, hiddenPaths });
}
