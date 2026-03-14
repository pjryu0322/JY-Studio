import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ChunkDTO } from "@/types/job";
import { appendAuditLog } from "@/lib/admin/auditLog";
import { getExportPolicy } from "@/lib/admin/adminConfigStore";

interface GraphExportBody {
  jobId?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as GraphExportBody;
    const jobId = body.jobId?.trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    const policy = await getExportPolicy();
    if (!policy.graphEnabled) {
      return NextResponse.json({ error: "Graph export is disabled by policy" }, { status: 403 });
    }

    const artifact = await prisma.artifact.findFirst({
      where: { jobId, type: "CHUNKS_JSON", path: `inline://jobs/${jobId}/chunks.json` },
    });
    const meta = artifact?.meta && typeof artifact.meta === "object" ? (artifact.meta as Record<string, unknown>) : null;
    const chunks = (Array.isArray(meta?.chunks) ? meta?.chunks : []) as ChunkDTO[];
    const nodes = chunks.map((chunk, index) => ({
      id: chunk.meta.chunkId,
      index,
      label: chunk.meta.sectionTitle ?? chunk.meta.chunkId,
      pageRange: (chunk.meta as { pageRange?: [number, number] }).pageRange ?? null,
    }));
    const edges = nodes
      .slice(0, -1)
      .map((node, idx) => ({ source: node.id, target: nodes[idx + 1].id, type: "adjacent" }));
    const payload = { jobId, nodes, edges };

    await appendAuditLog({
      category: "export",
      action: "export_graph",
      level: "info",
      jobId,
      detail: { nodes: nodes.length, edges: edges.length },
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[POST /api/export/graph]", error);
    return NextResponse.json({ error: "Failed to export graph" }, { status: 500 });
  }
}
