import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { runChunkingPipeline } from "@/lib/jobs/chunkingPipeline";
import type { Chunk, ChunkConfig } from "@/lib/chunking/types";
import { extractPdfTextFromBytes } from "@/lib/pdf/extractPdfText";

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
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { files: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

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
  let text = typeof meta.text === "string" ? meta.text : "";
  let extractionMethod =
    typeof meta.extractionMethod === "string" ? meta.extractionMethod : "RECHUNK";
  const shouldRetryPdfExtraction =
    extractionMethod.startsWith("PDF") &&
    (text.toLowerCase().includes("pdf extraction failed") ||
      (job.message ?? "").toLowerCase().includes("pdf extraction failed"));
  if (shouldRetryPdfExtraction) {
    const pdfFile = [...job.files]
      .filter((file) => file.ext.toLowerCase() === "pdf")
      .sort((a, b) => {
        if (a.sourceType === "replacement_pdf" && b.sourceType !== "replacement_pdf") return -1;
        if (a.sourceType !== "replacement_pdf" && b.sourceType === "replacement_pdf") return 1;
        if (a.sourceType === "original" && b.sourceType !== "original") return -1;
        if (a.sourceType !== "original" && b.sourceType === "original") return 1;
        return 0;
      })[0];
    if (pdfFile?.storagePath && !pdfFile.storagePath.startsWith("simulated/")) {
      const resolvedPath = path.isAbsolute(pdfFile.storagePath)
        ? pdfFile.storagePath
        : path.join(process.cwd(), pdfFile.storagePath);
      const buffer = await readFile(resolvedPath);
      const retried = await extractPdfTextFromBytes(
        new Uint8Array(buffer),
        pdfFile.originalName ?? "document.pdf"
      );
      text = retried.text;
      extractionMethod = "PDF_DIRECT";
    }
  }
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
    extractionMethod,
    message: "Rechunk completed.",
    preset: body.preset,
    chunkConfig: body.config,
    beforeChunks,
  });

  return NextResponse.json({ ok: true });
}

