import { NextResponse } from "next/server";
import type { ChunkDTO } from "@/types/job";
import { prisma } from "@/lib/prisma";
import { buildChunkQualityOverview } from "@/lib/admin/chunkQualityOverview";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitJobs = Number(
      url.searchParams.get("limitJobs") ?? "20",
    );
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take:
        Number.isFinite(limitJobs) && limitJobs > 0
          ? limitJobs
          : 20,
      include: {
        artifacts: {
          where: { type: "CHUNKS_JSON" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const chunks: ChunkDTO[] = [];
    for (const job of jobs) {
      const artifact = job.artifacts[0];
      const meta =
        artifact?.meta &&
        typeof artifact.meta === "object" &&
        !Array.isArray(artifact.meta)
          ? (artifact.meta as Record<string, unknown>)
          : null;
      const chunkList = Array.isArray(meta?.chunks)
        ? (meta.chunks as ChunkDTO[])
        : [];
      for (const chunk of chunkList) {
        chunks.push(chunk);
      }
    }

    const overview = buildChunkQualityOverview(chunks);
    return NextResponse.json({
      overview,
      sampledJobs: jobs.length,
    });
  } catch (error) {
    console.error("[GET /api/admin/chunk-quality-overview]", error);
    return NextResponse.json(
      { error: "Failed to build chunk quality overview" },
      { status: 500 },
    );
  }
}
