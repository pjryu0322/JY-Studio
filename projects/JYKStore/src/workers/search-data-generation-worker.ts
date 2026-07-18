/**
 * Search-data generation worker: claims PENDING Local E5 Draft generations
 * and runs Passage embedding + SearchIndexVector writes.
 *
 *   npm run worker:search-data
 */
import { randomUUID } from "node:crypto";
import {
  claimNextSearchDataGeneration,
  processSearchDataGenerationJob,
} from "@/lib/search-data/search-data-generation-service";
import { logSafeRouteError } from "@/lib/safe-logging";

const POLL_INTERVAL_MS = Number.parseInt(
  process.env.JYKSTORE_SEARCH_DATA_WORKER_POLL_MS ?? "2000",
  10,
);
const WORKER_ID =
  process.env.JYKSTORE_SEARCH_DATA_WORKER_ID?.trim() ||
  `search-data-worker-${randomUUID()}`;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSearchDataGenerationWorkerOnce(): Promise<boolean> {
  const claimed = await claimNextSearchDataGeneration();
  if (!claimed) return false;
  await processSearchDataGenerationJob(claimed);
  return true;
}

async function main(): Promise<void> {
  console.log(`[search-data-worker] started id=${WORKER_ID} pollMs=${POLL_INTERVAL_MS}`);
  for (;;) {
    try {
      const worked = await runSearchDataGenerationWorkerOnce();
      if (!worked) await sleep(POLL_INTERVAL_MS);
    } catch (error) {
      logSafeRouteError({
        scope: "search-data-generation-worker",
        method: "LOOP",
        path: "worker:search-data",
        error,
      });
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].includes("search-data-generation-worker") ||
    process.argv[1].endsWith("search-data-generation-worker.ts") ||
    process.argv[1].endsWith("search-data-generation-worker.js"));

if (isDirect) {
  void main();
}
