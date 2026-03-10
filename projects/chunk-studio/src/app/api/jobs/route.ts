import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getExtension,
  isAllowedExtension,
  getStatusForExtension,
  ACTION_REQUIRED_MESSAGE,
  DOC_CONVERTING_MESSAGE,
  isDocExtension,
  isMarkdownExtension,
  isPptExtension,
  PPT_CONVERTING_MESSAGE,
} from "@/lib/jobs/upload";
import { extractDocText } from "@/lib/doc/extractDocText";
import { runChunkingPipeline } from "@/lib/jobs/chunkingPipeline";
import { extractPptText } from "@/lib/ppt/extractPptText";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { ensureJobDir, getOriginalPath, saveWebFile } from "@/lib/files/storage";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      include: { files: true },
    });
    const list = jobs.map((j) => ({
      id: j.id,
      status: j.status,
      progress: j.progress,
      message: j.message ?? null,
      originalFilename: j.files.find((f) => f.sourceType === "original")?.originalName ?? null,
      errorDetail: j.errorDetail ?? null,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    }));
    return NextResponse.json({ jobs: list });
  } catch (e) {
    console.error("[GET /api/jobs]", e);
    return NextResponse.json({ error: "Failed to list jobs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

  const name = file.name?.trim() || "upload";
  const ext = getExtension(name);

  if (!isAllowedExtension(ext)) {
    return NextResponse.json(
      { error: `Unsupported extension. Allowed: pdf, doc, docx, ppt, pptx, md, hwp, hwpx` },
      { status: 400 }
    );
  }

  const status = getStatusForExtension(ext);
  const message =
    status === "ACTION_REQUIRED"
      ? ACTION_REQUIRED_MESSAGE
      : status === "CONVERTING"
        ? isPptExtension(ext)
          ? PPT_CONVERTING_MESSAGE
          : DOC_CONVERTING_MESSAGE
        : null;

  try {
    const job = await prisma.job.create({
      data: {
        status,
        progress: 0,
        message,
      },
    });
    console.log("[POST /api/jobs] created", { jobId: job.id, ext, status });

    await ensureJobDir(job.id);
    const storagePath = getOriginalPath(job.id, ext);
    await saveWebFile(file, storagePath);

    await prisma.jobFile.create({
      data: {
        jobId: job.id,
        sourceType: "original",
        originalName: name,
        ext,
        mime: file.type || null,
        sizeBytes: file.size ?? null,
        storagePath,
      },
    });

    // DOC/DOCX fallback path: process directly without LibreOffice conversion.
    if (isDocExtension(ext)) {
      const extracted = await extractDocText(file, ext);
      await runChunkingPipeline({
        jobId: job.id,
        text: extracted.text,
        extractionMethod: ext === "docx" ? "DOCX_DIRECT" : "DOC_DIRECT_FALLBACK",
        message: extracted.message,
      });
      return NextResponse.json({
        jobId: job.id,
        status: "DONE",
        message: extracted.message,
      });
    }

    // Markdown direct path.
    if (isMarkdownExtension(ext)) {
      const text = await file.text();
      await runChunkingPipeline({
        jobId: job.id,
        text,
        extractionMethod: "MARKDOWN_DIRECT",
        message: "Markdown processed directly.",
      });
      return NextResponse.json({
        jobId: job.id,
        status: "DONE",
        message: "Markdown processed directly.",
      });
    }

    // PPT/PPTX direct extraction path.
    if (isPptExtension(ext)) {
      const extracted = await extractPptText(file, ext);
      await runChunkingPipeline({
        jobId: job.id,
        text: extracted.text,
        extractionMethod: ext === "pptx" ? "PPTX_DIRECT" : "PPT_DIRECT_HEURISTIC",
        message: extracted.message,
      });
      return NextResponse.json({
        jobId: job.id,
        status: "DONE",
        message: extracted.message,
      });
    }

    // PDF direct extraction + chunking path.
    if (ext === "pdf") {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "EXTRACTING_TEXT",
          progress: 30,
          message: "PDF 텍스트를 추출하는 중...",
        },
      });
      const extracted = await extractPdfText(file);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "CHUNKING",
          progress: 70,
          message: "청크 생성 중...",
        },
      });
      await runChunkingPipeline({
        jobId: job.id,
        text: extracted.text,
        extractionMethod: "PDF_DIRECT",
        message: extracted.message,
      });
      console.log("[POST /api/jobs] chunking completed", {
        jobId: job.id,
        extractionMethod: "PDF_DIRECT",
      });
      return NextResponse.json({
        jobId: job.id,
        status: "DONE",
        message: extracted.message,
      });
    }

    return NextResponse.json({
      jobId: job.id,
      status,
      message: status === "ACTION_REQUIRED" ? ACTION_REQUIRED_MESSAGE : undefined,
    });
  } catch (e) {
    console.error("[POST /api/jobs]", e);
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }
}
