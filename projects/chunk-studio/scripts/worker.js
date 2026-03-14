/**
 * Chunk Studio Worker
 * - Polls for QUEUED jobs
 * - For HWP/HWPX originals: processes only if replacement_pdf exists
 * - Simulates pipeline: CONVERTING → PDF_READY → EXTRACTING_TEXT → CHUNKING → DONE
 * Run: DATABASE_URL=... node scripts/worker.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const { PrismaClient } = require("@prisma/client");
const path = require("path");

const prisma = new PrismaClient();

const STAGES = ["CONVERTING", "PDF_READY", "EXTRACTING_TEXT", "CHUNKING", "DONE"];
const DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getOriginalExtension(jobId) {
  const original = await prisma.jobFile.findFirst({
    where: { jobId, sourceType: "original" },
  });
  if (!original) return null;
  if (typeof original.ext === "string" && original.ext) {
    return original.ext.toLowerCase();
  }
  if (typeof original.storagePath === "string") {
    return path.extname(original.storagePath).toLowerCase().replace(".", "");
  }
  return null;
}

async function hasReplacementPdf(jobId) {
  const f = await prisma.jobFile.findFirst({
    where: { jobId, sourceType: "replacement_pdf" },
  });
  return !!f;
}

async function processJob(job) {
  const ext = await getOriginalExtension(job.id);
  const isHwp = ext === "hwp" || ext === "hwpx";
  if (isHwp) {
    const hasReplacement = await hasReplacementPdf(job.id);
    if (!hasReplacement) {
      console.log(`[worker] Skip job ${job.id}: HWP/HWPX without replacement PDF`);
      return;
    }
  }

  console.log(`[worker] Processing job ${job.id}`);
  for (let i = 0; i < STAGES.length; i++) {
    const status = STAGES[i];
    const progress = Math.round(((i + 1) / STAGES.length) * 100);
    await prisma.job.update({
      where: { id: job.id },
      data: { status, progress, message: `${status}...` },
    });
    await sleep(DELAY_MS);
  }
  await prisma.job.update({
    where: { id: job.id },
    data: { status: "DONE", progress: 100, message: null },
  });
  console.log(`[worker] Job ${job.id} DONE`);
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  console.log("[worker] Started, polling for QUEUED jobs...");
  while (true) {
    try {
      const jobs = await prisma.job.findMany({
        where: { status: "QUEUED" },
        take: 1,
      });
      for (const job of jobs) {
        await processJob(job);
      }
      if (jobs.length === 0) {
        await sleep(3000);
      }
    } catch (err) {
      console.error("[worker] Error:", err);
      await sleep(5000);
    }
  }
}

run();
