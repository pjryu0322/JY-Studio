import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getExtension,
  isAllowedExtension,
  getStatusForExtension,
} from "@/lib/jobs/upload";
import { runChunkingPipeline } from "@/lib/jobs/chunkingPipeline";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { ensureJobDir, getOriginalPath, saveWebFile } from "@/lib/files/storage";
import { appendAuditLog } from "@/lib/admin/auditLog";

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
    await appendAuditLog({
      category: "job",
      action: "list_jobs",
      level: "info",
      detail: { count: list.length },
    });
    return NextResponse.json({ jobs: list });
  } catch (e) {
    console.error("[GET /api/jobs]", e);
    return NextResponse.json({ error: "Failed to list jobs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let createdJobId: string | null = null;
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
      { error: "Unsupported extension. Allowed: pdf" },
      { status: 400 }
    );
  }

  const status = getStatusForExtension(ext);
  const message = null;

  try {
    const job = await prisma.job.create({
      data: {
        status,
        progress: 0,
        message,
      },
    });
    createdJobId = job.id;
    await appendAuditLog({
      category: "job",
      action: "create_job",
      level: "info",
      jobId: job.id,
      detail: { ext, status },
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
      message: undefined,
    });
  } catch (e) {
    console.error("[POST /api/jobs]", e);
    await appendAuditLog({
      category: "job",
      action: "create_job_failed",
      level: "error",
      jobId: createdJobId,
      detail: { message: e instanceof Error ? e.message : "unknown error" },
    });
    if (createdJobId) {
      try {
        await prisma.job.update({
          where: { id: createdJobId },
          data: {
            status: "FAILED",
            progress: 100,
            message: "작업 처리 중 오류가 발생했습니다.",
            errorDetail: e instanceof Error ? e.message : "unknown error",
          },
        });
      } catch (updateError) {
        console.error("[POST /api/jobs] failed to mark job as FAILED", updateError);
      }
    }
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }
}
