import { NextRequest, NextResponse } from "next/server";
import { buildGraphExport } from "@/lib/knowledge-export-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { packId } = await context.params;
  const trimmed = packId?.trim() ?? "";

  try {
    const data = await buildGraphExport(trimmed);
    if (!data) {
      return NextResponse.json({ error: "지식팩을 찾을 수 없습니다." }, { status: 404 });
    }
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jykstore-${trimmed}-graph.json"`,
      },
    });
  } catch (error) {
    console.error("GET graph export failed", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
