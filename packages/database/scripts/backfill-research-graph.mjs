#!/usr/bin/env node
import { runResearchGraphBackfillEntrypoint } from '../src/research-graph-backfill-entrypoint.mjs';

try {
  const outcome = await runResearchGraphBackfillEntrypoint();
  process.exitCode = outcome.exitCode;
} catch (error) {
  process.stderr.write(`${error?.code ?? 'RESEARCH_GRAPH_BACKFILL_FAILED'}: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
}
