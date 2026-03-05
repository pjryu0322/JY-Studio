import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runChunkingPipeline } from "@/lib/jobs/chunkingPipeline";
import type { Chunk, ChunkConfig } from "@/lib/chunking/types";

type RouteCtx = {
  params: Promise<{ jobId: string }>;
};

interface RechunkBody {
  preset?: "RFP_DEFAULT" | "SHORT" | "LONG" | "REQUIREMENT_FIRST";
  config?: Partial<ChunkConfig>;
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { jobId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as RechunkBody;

  const extractedArtifact = await prisma.artifact.findFirst({
    where: { jobId, type: "EXTRACTED_TEXT" },
  });
  if (!extractedArtifact || !extractedArtifact.meta || typeof extractedArtifact.meta !== "object") {
    return NextResponse.json(
      { error: "Extracted text not found. Rechunk requires prior extraction." },
      { status: 400 }
    );
  }
  const meta = extractedArtifact.meta as Record<string, unknown>;
  const text = typeof meta.text === "string" ? meta.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "No extracted text available." }, { status: 400 });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "CHUNKING", progress: 70, message: "Rechunking with updated policy..." },
  });

  const prevChunkArtifact = await prisma.artifact.findFirst({
    where: { jobId, type: "CHUNKS_JSON", path: `inline://jobs/${jobId}/chunks.json` },
  });
  const prevMeta =
    prevChunkArtifact?.meta && typeof prevChunkArtifact.meta === "object"
      ? (prevChunkArtifact.meta as Record<string, unknown>)
      : null;
  const beforeChunks = Array.isArray(prevMeta?.chunks)
    ? (prevMeta.chunks as Chunk[])
    : [];

  await runChunkingPipeline({
    jobId,
    text,
    extractionMethod:
      typeof meta.extractionMethod === "string" ? meta.extractionMethod : "RECHUNK",
    message: "Rechunk completed.",
    preset: body.preset,
    chunkConfig: body.config,
    beforeChunks,
  });

  return NextResponse.json({ ok: true });
}

