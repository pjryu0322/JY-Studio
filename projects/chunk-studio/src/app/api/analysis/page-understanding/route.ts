import { NextResponse } from "next/server";
import {
  classifyPageUnderstanding,
  type DocumentFamily,
  type PageClassificationRecord,
} from "@/lib/analysis/pageUnderstanding";
import type { PageTextBlock } from "@/components/workspace/pageTypeClassifier";
import { appendAuditLog } from "@/lib/admin/auditLog";

interface PageUnderstandingBody {
  pageNumber?: number;
  pageSize?: { width: number; height: number };
  blocks?: PageTextBlock[];
  familyHint?: DocumentFamily;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PageUnderstandingBody;
    const pageNumber = Number(body.pageNumber);
    const pageSize = body.pageSize;
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];
    if (!Number.isFinite(pageNumber) || pageNumber <= 0 || !pageSize) {
      return NextResponse.json({ error: "pageNumber and pageSize are required" }, { status: 400 });
    }

    const external = process.env.ANALYSIS_SERVICE_URL?.trim();
    if (external) {
      const url = `${external.replace(/\/$/, "")}/analyze/page-understanding`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_number: pageNumber,
          width: pageSize.width,
          height: pageSize.height,
          blocks,
          family_hint: body.familyHint ?? null,
        }),
      });
      if (res.ok) {
        const payload = (await res.json()) as PageClassificationRecord;
        await appendAuditLog({
          category: "page_classifier",
          action: "classify_page_external",
          level: "info",
          detail: {
            pageNumber,
            familyHint: body.familyHint ?? null,
            confidence: payload.confidence,
            pageType: payload.pageTypeFinal,
            subType: payload.subTypeFinal,
            orientation: payload.orientationFinal,
          },
        });
        return NextResponse.json(payload);
      }
    }

    const fallback = classifyPageUnderstanding({
      pageNumber,
      pageSize,
      blocks,
      familyHint: body.familyHint,
    });
    await appendAuditLog({
      category: "page_classifier",
      action: "classify_page_local",
      level: "info",
      detail: {
        pageNumber,
        family: fallback.documentFamily,
        confidence: fallback.confidence,
        pageType: fallback.pageTypeFinal,
        subType: fallback.subTypeFinal,
        orientation: fallback.orientationFinal,
      },
    });
    return NextResponse.json(fallback);
  } catch (error) {
    console.error("[POST /api/analysis/page-understanding]", error);
    return NextResponse.json({ error: "Failed to classify page understanding" }, { status: 500 });
  }
}
