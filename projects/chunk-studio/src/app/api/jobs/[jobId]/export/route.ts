import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteCtx = {
  params: Promise<{ jobId: string }>;
};

export async function GET(req: Request, ctx: RouteCtx) {
  const { jobId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "jsonl";
  if (format !== "jsonl") {
    return NextResponse.json({ error: "Only jsonl format is supported" }, { status: 400 });
  }

  const artifact = await prisma.artifact.findFirst({
    where: { jobId, type: "CHUNKS_JSON", path: `inline://jobs/${jobId}/chunks.jsonl` },
  });
  if (!artifact || !artifact.meta || typeof artifact.meta !== "object") {
    return NextResponse.json({ error: "JSONL export not found" }, { status: 404 });
  }
  const meta = artifact.meta as Record<string, unknown>;
  const content = typeof meta.content === "string" ? meta.content : "";
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Content-Disposition": `attachment; filename="job-${jobId}.jsonl"`,
      "Cache-Control": "no-store",
    },
  });
}

