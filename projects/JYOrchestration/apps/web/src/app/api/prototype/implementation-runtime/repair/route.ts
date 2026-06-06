import { NextRequest, NextResponse } from "next/server";

/** P3-M43: 실행 상태 복구 — projects implementation-runtime actions로 위임 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const projectIdx = segments.indexOf("projects");
  const projectId =
    projectIdx >= 0 ? String(segments[projectIdx + 1] ?? "").trim() : "";
  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  const target = new URL(
    `/api/projects/${encodeURIComponent(projectId)}/implementation-runtime/actions`,
    url.origin,
  );
  const body = await request.text();
  const proxy = new Request(target, {
    method: "POST",
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...(body ? JSON.parse(body) : {}),
      action: "repair_quick_run",
    }),
  });
  const response = await fetch(proxy);
  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
