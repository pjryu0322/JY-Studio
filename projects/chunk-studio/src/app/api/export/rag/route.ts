import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyRagRefinements,
  buildRagRecords,
  formatRagRecords,
  type RagFormat,
  type RagRefinementPayload,
} from "@/lib/analysis/ragExportOptimizer";
import type { ChunkDTO } from "@/types/job";

interface RagExportBody {
  jobId?: string;
  format?: RagFormat;
  refinements?: RagRefinementPayload;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RagExportBody;
    const jobId = body.jobId?.trim();
    const format: RagFormat =
      body.format === "json" || body.format === "csv" || body.format === "jsonl"
        ? body.format
        : "jsonl";

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        files: true,
        artifacts: {
          where: { type: "CHUNKS_JSON" },
        },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const chunksArtifact = job.artifacts.find((a) => a.type === "CHUNKS_JSON");
    const chunksMeta =
      chunksArtifact && chunksArtifact.meta && typeof chunksArtifact.meta === "object"
        ? (chunksArtifact.meta as Record<string, unknown>)
        : null;
    const chunks = (Array.isArray(chunksMeta?.chunks) ? chunksMeta.chunks : []) as ChunkDTO[];
    const documentTitle =
      job.files.find((f) => f.sourceType === "original")?.originalName ?? null;

    const records = applyRagRefinements(
      buildRagRecords(chunks, documentTitle),
      body.refinements
    );
    const content = formatRagRecords(records, format);
    const extension = format === "jsonl" ? "jsonl" : format;
    const safeJobId = jobId.replace(/[^\w.-]+/g, "_");
    const contentType =
      format === "json"
        ? "application/json; charset=utf-8"
        : format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/x-ndjson; charset=utf-8";

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="rag_dataset_${safeJobId}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[POST /api/export/rag]", error);
    return NextResponse.json({ error: "Failed to export RAG dataset" }, { status: 500 });
  }
}
