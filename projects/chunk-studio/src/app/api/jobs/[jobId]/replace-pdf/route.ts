import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPdfMime } from "@/lib/jobs/upload";
import { ensureJobDir, getReplacementPdfPath, saveWebFile } from "@/lib/files/storage";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { runChunkingPipeline } from "@/lib/jobs/chunkingPipeline";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing or invalid file field" },
      { status: 400 }
    );
  }

  if (!isPdfMime(file.type)) {
    return NextResponse.json(
      { error: "File must be PDF (application/pdf)" },
      { status: 400 }
    );
  }

  const name = file.name?.trim() || "replacement.pdf";
  if (!name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "File must have .pdf extension" },
      { status: 400 }
    );
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { files: true },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.status !== "ACTION_REQUIRED") {
      return NextResponse.json(
        { error: "Only jobs with status ACTION_REQUIRED accept a replacement PDF" },
        { status: 400 }
      );
    }

    await ensureJobDir(jobId);
    const storagePath = getReplacementPdfPath(jobId);
    await saveWebFile(file, storagePath);

    await prisma.$transaction([
      prisma.jobFile.create({
        data: {
          jobId,
          sourceType: "replacement_pdf",
          originalName: name,
          ext: "pdf",
          mime: file.type || "application/pdf",
          sizeBytes: file.size ?? null,
          storagePath,
        },
      }),
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: "EXTRACTING_TEXT",
          progress: 30,
          message: "Replacement PDF text extraction in progress...",
        },
      }),
    ]);

    const extracted = await extractPdfText(file);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "CHUNKING",
        progress: 70,
        message: "청크 생성 중...",
      },
    });
    await runChunkingPipeline({
      jobId,
      text: extracted.text,
      extractionMethod: "PDF_REPLACEMENT",
      message: extracted.message,
    });
    console.log("[POST /api/jobs/:id/replace-pdf] chunking completed", { jobId });

    return NextResponse.json({
      ok: true,
      jobId,
      status: "DONE",
    });
  } catch (e) {
    console.error("[POST /api/jobs/:id/replace-pdf]", e);
    return NextResponse.json(
      { error: "Failed to upload replacement PDF" },
      { status: 500 }
    );
  }
}
