import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
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

  const original = job.files.find(
    (f) => f.sourceType === "original" && f.ext.toLowerCase() === "pdf"
  );
  if (!original || !original.storagePath || original.storagePath.startsWith("simulated/")) {
    return NextResponse.json(
      { error: "PDF preview unavailable for this job" },
      { status: 404 }
    );
  }

  try {
    const filePath = path.isAbsolute(original.storagePath)
      ? original.storagePath
      : path.join(process.cwd(), original.storagePath);
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

