import { runMirrorQueuePass, buildMirrorClientFromEnv } from "./mirror-queue.mjs";

export class MirrorWorkerError extends Error {
  constructor(message, code = "MIRROR_WORKER_INVALID") {
    super(message);
    this.name = "MirrorWorkerError";
    this.code = code;
  }
}

/**
 * Cloudflare Worker entrypoint for the frontier mirror processor (M12-20).
 *
 * The repository adapter is injected at deploy time (consistent with the rest
 * of the codebase, where workers receive an injected repository). The returned
 * handler object can back a scheduled trigger or a queue consumer; each
 * invocation runs one outbox pass that mirrors `frontier.published` jobs.
 */
export function createMirrorWorker({ repository } = {}) {
  if (!repository || typeof repository.claimPendingOutboxJobs !== "function") {
    throw new MirrorWorkerError("repository claimPendingOutboxJobs is required");
  }
  return Object.freeze({
    async scheduled(event, env) {
      const mirrorClient = buildMirrorClientFromEnv(env ?? {});
      return runMirrorQueuePass({
        repository,
        mirrorClient,
        workerId: `mirror-worker-${event?.scheduledTime ?? Date.now()}`,
        limit: 10,
      });
    },
    async queue(batch, env) {
      const mirrorClient = buildMirrorClientFromEnv(env ?? {});
      return runMirrorQueuePass({
        repository,
        mirrorClient,
        workerId: `mirror-queue-${batch?.batchId ?? Date.now()}`,
        limit: batch?.messages?.length ?? 10,
      });
    },
  });
}

async function resolveRepository(repositoryFactory, env) {
  return typeof repositoryFactory === "function" ? repositoryFactory(env) : null;
}

/**
 * Default Cloudflare Worker handler for the mirror processor (M12-20). The
 * repository adapter is supplied by `repositoryFactory` at deploy time; until
 * it is wired the handler responds 503 rather than failing silently. The
 * mirror client itself is built from the `GITHUB_MIRROR_*` Wrangler vars.
 */
export function createMirrorWorkerHandler({ repositoryFactory = null } = {}) {
  return Object.freeze({
    async scheduled(event, env) {
      const repository = await resolveRepository(repositoryFactory, env);
      if (!repository || typeof repository.claimPendingOutboxJobs !== "function") {
        return new Response("mirror repository not configured", { status: 503 });
      }
      const result = await createMirrorWorker({ repository }).scheduled(event, env);
      return Response.json(result);
    },
    async fetch(request, env) {
      const repository = await resolveRepository(repositoryFactory, env);
      if (!repository || typeof repository.claimPendingOutboxJobs !== "function") {
        return new Response("mirror repository not configured", { status: 503 });
      }
      const result = await runMirrorQueuePass({
        repository,
        mirrorClient: buildMirrorClientFromEnv(env ?? {}),
        workerId: `mirror-fetch-${Date.now()}`,
        limit: 10,
      });
      return Response.json(result);
    },
  });
}

export default createMirrorWorkerHandler();
