import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const REPORT_FILENAME = "platform-structure-diagnosis.md";
const ATTACHMENT_ASCII = "JYOrchestration-platform-structure-diagnosis.md";

function resolveReportPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "docs", REPORT_FILENAME),
    path.join(process.cwd(), "apps", "web", "docs", REPORT_FILENAME),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * 구조 진단 보고서 Markdown 파일 다운로드.
 * - 미들웨어에서 `/api/*`는 통과하므로 로그인 없이 호출 가능.
 * - 브라우저: `/api/diagnostics/platform-structure-report` 접속 시 저장 대화상자 또는 다운로드.
 */
export async function GET() {
  const filePath = resolveReportPath();
  if (!filePath) {
    return NextResponse.json(
      {
        ok: false,
        message: `진단 보고서 파일을 찾을 수 없습니다. apps/web/docs/${REPORT_FILENAME} 경로를 확인하세요.`,
      },
      { status: 404 }
    );
  }

  const body = readFileSync(filePath, "utf8");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ATTACHMENT_ASCII}"`,
      "Cache-Control": "no-store",
    },
  });
}
