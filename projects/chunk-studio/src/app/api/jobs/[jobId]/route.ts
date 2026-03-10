import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteCtx = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_: Request, ctx: RouteCtx) {
  const { jobId } = await ctx.params;
  if (!jobId) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        files: true,
        artifacts: {
          where: { type: { in: ["EXTRACTED_TEXT", "CHUNKS_JSON"] } },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const extracted = job.artifacts.find((a) => a.type === "EXTRACTED_TEXT");
    const chunksArtifact = job.artifacts.find((a) => a.type === "CHUNKS_JSON");
    const reportArtifact = job.artifacts.find((a) =>
      a.path.endsWith("/chunk-report.json")
    );
    const chunkQualityArtifact = job.artifacts.find((a) =>
      a.path.endsWith("/chunk-quality.json")
    );
    const cleaningArtifact = job.artifacts.find((a) =>
      a.path.endsWith("/cleaning-log.json")
    );
    const diffArtifact = job.artifacts.find((a) =>
      a.path.endsWith("/chunk-diff.json")
    );
    const ocrArtifact = job.artifacts.find((a) =>
      a.path.endsWith("/ocr-quality.json")
    );
    const extractedMeta =
      extracted && extracted.meta && typeof extracted.meta === "object"
        ? (extracted.meta as Record<string, unknown>)
        : null;
    const chunksMeta =
      chunksArtifact && chunksArtifact.meta && typeof chunksArtifact.meta === "object"
        ? (chunksArtifact.meta as Record<string, unknown>)
        : null;
    const reportMeta =
      reportArtifact && reportArtifact.meta && typeof reportArtifact.meta === "object"
        ? (reportArtifact.meta as Record<string, unknown>)
        : null;
    const chunkQualityMeta =
      chunkQualityArtifact &&
      chunkQualityArtifact.meta &&
      typeof chunkQualityArtifact.meta === "object"
        ? (chunkQualityArtifact.meta as Record<string, unknown>)
        : null;
    const cleaningMeta =
      cleaningArtifact && cleaningArtifact.meta && typeof cleaningArtifact.meta === "object"
        ? (cleaningArtifact.meta as Record<string, unknown>)
        : null;
    const diffMeta =
      diffArtifact && diffArtifact.meta && typeof diffArtifact.meta === "object"
        ? (diffArtifact.meta as Record<string, unknown>)
        : null;
    const ocrMeta =
      ocrArtifact && ocrArtifact.meta && typeof ocrArtifact.meta === "object"
        ? (ocrArtifact.meta as Record<string, unknown>)
        : null;

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message ?? null,
      errorDetail: job.errorDetail ?? null,
      originalFilename:
        job.files.find((f) => f.sourceType === "original")?.originalName ?? null,
      extractionMethod:
        typeof extractedMeta?.extractionMethod === "string"
          ? extractedMeta.extractionMethod
          : null,
      pipelineVersion:
        typeof extractedMeta?.pipelineVersion === "string"
          ? extractedMeta.pipelineVersion
          : null,
      extractedText: typeof extractedMeta?.text === "string" ? extractedMeta.text : "",
      chunks: Array.isArray(chunksMeta?.chunks) ? chunksMeta?.chunks : [],
      report: reportMeta ?? null,
      chunkQualityReport: chunkQualityMeta ?? null,
      cleaningLog: cleaningMeta
        ? {
            method: cleaningMeta.method ?? "freq",
            params: cleaningMeta.params ?? { threshold: 0.6 },
            removedSummary: Array.isArray(cleaningMeta.removed)
              ? (cleaningMeta.removed as Array<Record<string, unknown>>)
                  .slice(0, 10)
                  .map((r) => ({
                    kind: r.kind,
                    text: r.text,
                    count: r.count,
                  }))
              : [],
            removedCount: Array.isArray(cleaningMeta.removed)
              ? cleaningMeta.removed.length
              : 0,
          }
        : null,
      diff: diffMeta ?? null,
      ocrQuality: ocrMeta?.quality ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/jobs/:jobId]", error);
    return NextResponse.json({ error: "Failed to load job detail" }, { status: 500 });
  }
}

