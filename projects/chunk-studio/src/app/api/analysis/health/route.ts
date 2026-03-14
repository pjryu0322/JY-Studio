import { NextResponse } from "next/server";

export async function GET() {
  const external = process.env.ANALYSIS_SERVICE_URL?.trim();
  if (!external) {
    return NextResponse.json({
      mode: "local-fallback",
      available: true,
      message: "ANALYSIS_SERVICE_URL is not configured. Using local TypeScript classifier.",
    });
  }

  try {
    const url = `${external.replace(/\/$/, "")}/health`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return NextResponse.json(
        {
          mode: "external",
          available: false,
          message: `External analysis service unavailable (${res.status})`,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({
      mode: "external",
      available: true,
      message: "External analysis service is healthy.",
    });
  } catch {
    return NextResponse.json(
      {
        mode: "external",
        available: false,
        message: "Failed to reach external analysis service.",
      },
      { status: 503 }
    );
  }
}
