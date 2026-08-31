import { buildClient } from "./client.mjs";
import { flagString, flagBool, requirePositional } from "./args.mjs";
import { formatTable } from "./output.mjs";

function listFlags(flags, extra = {}) {
  const query = { ...extra };
  const limit = flagString(flags, "limit", null);
  if (limit) query.limit = Number(limit);
  const cursor = flagString(flags, "cursor", null);
  if (cursor) query.cursor = cursor;
  return query;
}

export async function projectList({ flags, output, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const query = listFlags(flags, { state: flagString(flags, "state", null) });
  const page = await client.projects.list(query);
  output.emit({ json: flagBool(flags, "json") }, page, (data) => formatTable(data.items ?? [], [
    { label: "PROJECT", value: (row) => row.projectId },
    { label: "STATE", value: (row) => row.state },
    { label: "NAME", value: (row) => row.name ?? row.currentRevision?.name ?? "" },
  ]));
  return 0;
}

export async function questionList({ flags, output, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const query = listFlags(flags, {
    state: flagString(flags, "state", null),
    projectId: flagString(flags, "project", flagString(flags, "project-id", null)),
    field: flagString(flags, "field", null),
  });
  const page = await client.questions.list(query);
  let items = page.items ?? [];
  const field = flagString(flags, "field", null);
  if (field) items = items.filter((question) => (question.field ?? question.domain ?? "") === field);
  output.emit({ json: flagBool(flags, "json") }, { ...page, items }, (data) => formatTable(data.items, [
    { label: "QUESTION", value: (row) => row.questionId },
    { label: "STATE", value: (row) => row.state },
    { label: "TITLE", value: (row) => row.title ?? row.currentRevision?.title ?? "" },
  ]));
  return 0;
}

export async function taskList({ flags, output, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const query = listFlags(flags, {
    status: flagString(flags, "status", null),
    tag: flagString(flags, "tag", null),
    type: flagString(flags, "type", null),
    projectId: flagString(flags, "project", flagString(flags, "project-id", null)),
  });
  const page = await client.tasks.list(query);
  output.emit({ json: flagBool(flags, "json") }, page, (data) => formatTable(data.items ?? [], [
    { label: "TASK", value: (row) => row.taskId },
    { label: "STATUS", value: (row) => row.status ?? row.state },
    { label: "TYPE", value: (row) => row.type ?? "" },
    { label: "TAG", value: (row) => row.tag ?? "" },
  ]));
  return 0;
}

export async function taskInspect({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const taskId = requirePositional(positionals, 0, "taskId");
  const detail = await client.tasks.get(taskId);
  output.emit({ json: flagBool(flags, "json") }, detail, (data) => {
    const revision = data.currentRevision ?? {};
    const dependencies = (data.dependencies ?? []).map((dependency) => `${dependency.sourceTaskId} -> ${dependency.targetTaskId} (${dependency.dependencyType ?? "depends_on"})`);
    const leases = (data.leases ?? []).map((lease) => `${lease.holderActorId}${lease.expiresAt ? ` until ${lease.expiresAt}` : ""}`);
    return [
      `task: ${data.task?.taskId ?? taskId}`,
      `state: ${data.task?.state ?? revision.state ?? "unknown"}`,
      `title: ${revision.title ?? ""}`,
      `context mode: ${revision.contextMode ?? ""}`,
      `dependencies: ${dependencies.length ? `\n  ${dependencies.join("\n  ")}` : "(none)"}`,
      `leases: ${leases.length ? `\n  ${leases.join("\n  ")}` : "(none)"}`,
      `etag: ${data.etag ?? ""}`,
    ].join("\n");
  });
  return 0;
}

export async function graphInspect({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const kind = requirePositional(positionals, 0, "kind");
  const id = requirePositional(positionals, 1, "id");
  const revisionText = flagString(flags, "revision", null);
  const commaValues = (name) => {
    const value = flagString(flags, name, null);
    return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
  };
  const neighborhood = await client.researchGraph.neighborhood(kind, id, {
    revision: revisionText === null ? undefined : Number(revisionText),
    direction: flagString(flags, "direction", "both"),
    depth: Number(flagString(flags, "depth", "1")),
    kinds: commaValues("kinds"),
    edgeTypes: commaValues("edge-types"),
    cursor: flagString(flags, "cursor", undefined),
  });
  output.emit({ json: flagBool(flags, "json") }, neighborhood, (data) => {
    const root = data.resolvedRoot ?? data.requestedRoot ?? { kind, id, revision: revisionText ?? "?" };
    const nodes = (data.nodes ?? []).map((node) => `${node.ref.kind.padEnd(18)} ${node.ref.id}@${node.ref.revision}  ${node.state ?? "unknown"}  ${node.label ?? ""}`);
    const edges = (data.edges ?? []).map((edge) => `${edge.source.kind}:${edge.source.id}@${edge.source.revision} -> ${edge.target.kind}:${edge.target.id}@${edge.target.revision}  ${edge.type}`);
    return [
      `root: ${root.kind}:${root.id}@${root.revision ?? "current"}`,
      `nodes: ${nodes.length}${nodes.length ? `\n  ${nodes.join("\n  ")}` : ""}`,
      `edges: ${edges.length}${edges.length ? `\n  ${edges.join("\n  ")}` : ""}`,
      `truncated: ${Boolean(data.truncated)}`,
      `next cursor: ${data.nextCursor ?? "(none)"}`,
    ].join("\n");
  });
  return 0;
}

export async function provenance({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const objectType = requirePositional(positionals, 0, "objectType");
  const objectId = requirePositional(positionals, 1, "objectId");
  const revision = Number(flagString(flags, "revision", "1"));
  const path = await client.contributions.provenance(objectType, objectId, revision);
  output.emit({ json: flagBool(flags, "json") }, path, (data) => {
    const actorLines = (data.actorEvents ?? []).map(({ actor, event }) => `${actor.actorId} (${actor.role ?? "contributor"}) via ${event?.eventId ?? "?"} ${event?.eventType ?? ""}`);
    const frontierLines = (data.frontier ?? []).map((snapshot) => `${snapshot.snapshotId} seq=${snapshot.sequence}`);
    return [
      `object: ${data.object?.objectType} ${data.object?.objectId}@${data.object?.revision}`,
      `actors: ${actorLines.length ? `\n  ${actorLines.join("\n  ")}` : "(none)"}`,
      `frontiers: ${frontierLines.length ? `\n  ${frontierLines.join("\n  ")}` : "(none)"}`,
    ].join("\n");
  });
  return 0;
}
