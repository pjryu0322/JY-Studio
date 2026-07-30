import { NextRequest, NextResponse } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { buildRagExportPackage } from "@/lib/exports/rag-export-builder";
import { prisma } from "@/lib/prisma";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;
  const trimmed = packId?.trim() ?? "";

  try {
    const version = await prisma.knowledgePackVersion.findFirst({
      where: { packId: trimmed },
      orderBy: latestKnowledgePackVersionOrderBy,
      select: { id: true },
    });
    if (!version) {
      return NextResponse.json({ error: "지식팩을 찾을 수 없습니다." }, { status: 404 });
    }
    const generation = await prisma.searchIndexGeneration.findFirst({
      where: {
        packId: trimmed,
        versionId: version.id,
        status: { in: ["READY", "PROMOTED"] },
        staleAt: null,
        retiredAt: null,
      },
      orderBy: [{ promotedAt: "desc" }, { createdAt: "desc" }],
    });
    if (!generation) {
      return NextResponse.json({ error: "RAG Export를 생성할 검색데이터가 없습니다." }, { status: 404 });
    }
    const pkg = await buildRagExportPackage({
      packId: trimmed,
      versionId: version.id,
      expectedPipelineRunId: generation.pipelineRunId,
      expectedSearchIndexGenerationId: generation.id,
      expectedNormalizedDocumentId: generation.normalizedDocumentId,
      expectedFingerprint: generation.fingerprint,
      includeZipBytes: true,
    });
    if (!pkg.zipBytes) {
      return NextResponse.json({ error: "RAG Export 생성에 실패했습니다." }, { status: 500 });
    }
    return new NextResponse(Buffer.from(pkg.zipBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${pkg.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-JYK-Rag-Export-Fingerprint": pkg.exportFingerprint,
      },
    });
  } catch (error) {
    logSafeRouteError({
      scope: "admin-pack-rag-export",
      method: "GET",
      path: "/api/v1/admin/packs/[packId]/exports/rag",
      error,
    });
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
