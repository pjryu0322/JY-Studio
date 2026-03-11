import { NextResponse } from "next/server";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type RouteCtx = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_: Request, ctx: RouteCtx) {
  const { jobId } = await ctx.params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { files: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const filePath = await resolvePdfPath(job.files);
  if (!filePath) {
    return NextResponse.json(
      { error: "PDF preview unavailable for this job" },
      { status: 404 }
    );
  }

  try {
    const data = await readFile(filePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF preview unavailable" }, { status: 404 });
  }
}

export async function HEAD(_: Request, ctx: RouteCtx) {
  const { jobId } = await ctx.params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { files: true },
  });
  if (!job) {
    return new NextResponse(null, { status: 404 });
  }
  const filePath = await resolvePdfPath(job.files);
  return new NextResponse(null, { status: filePath ? 200 : 404 });
}

async function resolvePdfPath(
  files: Array<{ sourceType: string; ext: string; storagePath: string }>
): Promise<string | null> {
  const candidates = files
    .filter((file) => file.ext.toLowerCase() === "pdf")
    .sort((a, b) => {
      if (a.sourceType === "original" && b.sourceType !== "original") return -1;
      if (a.sourceType !== "original" && b.sourceType === "original") return 1;
      return 0;
    });
  for (const file of candidates) {
    if (!file.storagePath || file.storagePath.startsWith("simulated/")) continue;
    const resolved = path.isAbsolute(file.storagePath)
      ? file.storagePath
      : path.join(process.cwd(), file.storagePath);
    try {
      await access(resolved);
      return resolved;
    } catch {
      continue;
    }
  }
  return null;
}

