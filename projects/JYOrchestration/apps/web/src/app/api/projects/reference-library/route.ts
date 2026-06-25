import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/lib/auth/requestUser";
import { listReferenceLibraryItems } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryQuery";

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const q = sp.get("q") ?? undefined;
    const purposeRaw = sp.get("purpose") ?? "all";
    const purpose =
      purposeRaw === "candidate" || purposeRaw === "package" || purposeRaw === "all" ? purposeRaw : "all";
    const sort = sp.get("sort") === "name" ? "name" : "recent";
    const limitRaw = Number(sp.get("limit") ?? "50");
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

    const items = await listReferenceLibraryItems({
      userId,
      q,
      purpose,
      sort,
      limit,
    });

    return NextResponse.json({
      success: true,
      message: "참조 프로젝트 목록을 불러왔습니다.",
      data: { items },
    });
  } catch (error) {
    console.error("GET /api/projects/reference-library error:", error);
    return NextResponse.json({ success: false, message: "목록 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
