export const OPEN_QUESTION_STATES = Object.freeze(["proposed", "under_review", "admissible", "active"]);
export const CONTEXT_MODES = Object.freeze(["frontier", "full_trace", "adversarial", "blind"]);

export class McpResourceError extends Error {
  constructor(message, code = "MCP_RESOURCE_INVALID") {
    super(message);
    this.name = "McpResourceError";
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new McpResourceError(`${field} is required`);
  return value.trim();
}

const STATIC_RESOURCES = Object.freeze([
  { uri: "evimesh://projects", name: "Projects", description: "All research projects with current revisions", mimeType: "application/json" },
  { uri: "evimesh://questions/open", name: "Open Questions", description: "Questions still open for research (proposed, under_review, admissible, active)", mimeType: "application/json" },
  { uri: "evimesh://tasks/open", name: "Open Tasks", description: "Tasks currently open for attempts", mimeType: "application/json" },
]);

const RESOURCE_TEMPLATES = Object.freeze([
  { uriTemplate: "evimesh://tasks/{taskId}/context/{mode}", name: "Task Context", description: "Immutable ContextBundle for one Task in one mode (frontier, full_trace, adversarial, blind)", mimeType: "application/json" },
  { uriTemplate: "evimesh://claims/{claimId}/revisions/{revision}", name: "Claim Revision", description: "One fixed immutable Claim revision", mimeType: "application/json" },
  { uriTemplate: "evimesh://projects/{projectId}/frontier/latest", name: "Latest Frontier", description: "Latest published FrontierSnapshot for one Project", mimeType: "application/json" },
  { uriTemplate: "evimesh://projects/{projectId}/frontier/sequence/{sequence}", name: "Frontier by Sequence", description: "One published FrontierSnapshot by sequence number", mimeType: "application/json" },
  { uriTemplate: "evimesh://actors/{actorId}/contributions", name: "Actor Contributions", description: "Contribution roles and attribution edges for one Actor", mimeType: "application/json" },
]);

function parseUri(uri) {
  requiredText(uri, "resource uri");
  const body = uri.replace(/^evimesh:\/\//, "");
  return body.split("/").map((segment) => decodeURIComponent(segment));
}

/** Read one resource by URI; returns `{ data }` where data is JSON-serializable. */
export async function readResource({ client, uri } = {}) {
  if (!client) throw new McpResourceError("client is required");
  const segments = parseUri(uri);

  if (segments.length === 1 && segments[0] === "projects") {
    return { data: await client.projects.list({}) };
  }
  if (segments.length === 2 && segments[0] === "questions" && segments[1] === "open") {
    const page = await client.questions.list({});
    return { data: { items: (page.items ?? []).filter((question) => OPEN_QUESTION_STATES.includes(question.state)), nextCursor: page.nextCursor ?? null } };
  }
  if (segments.length === 2 && segments[0] === "tasks" && segments[1] === "open") {
    return { data: await client.tasks.list({ status: "open" }) };
  }
  if (segments.length === 4 && segments[0] === "tasks" && segments[2] === "context") {
    const mode = segments[3];
    if (!CONTEXT_MODES.includes(mode)) throw new McpResourceError(`context mode must be one of ${CONTEXT_MODES.join(", ")}`);
    return { data: await client.tasks.context(segments[1], mode) };
  }
  if (segments.length === 4 && segments[0] === "claims" && segments[2] === "revisions") {
    const revision = Number(segments[3]);
    if (!Number.isInteger(revision) || revision < 1) throw new McpResourceError("claim revision must be a positive integer");
    return { data: await client.claims.revision(segments[1], revision) };
  }
  if (segments.length === 4 && segments[0] === "projects" && segments[2] === "frontier" && segments[3] === "latest") {
    return { data: await client.frontier.latest(segments[1]) };
  }
  if (segments.length === 5 && segments[0] === "projects" && segments[2] === "frontier" && segments[3] === "sequence") {
    const sequence = Number(segments[4]);
    if (!Number.isInteger(sequence) || sequence < 1) throw new McpResourceError("frontier sequence must be a positive integer");
    const history = await client.frontier.history(segments[1], { limit: 100 });
    const snapshot = (history.items ?? []).find((entry) => entry.sequence === sequence);
    if (!snapshot) throw new McpResourceError(`frontier sequence ${sequence} not found for this project`);
    return { data: snapshot };
  }
  if (segments.length === 3 && segments[0] === "actors" && segments[2] === "contributions") {
    return { data: await client.contributions.forActor(segments[1]) };
  }
  throw new McpResourceError(`unknown resource uri: ${uri}`);
}

export function listResources() {
  return { resources: [...STATIC_RESOURCES], resourceTemplates: [...RESOURCE_TEMPLATES] };
}
