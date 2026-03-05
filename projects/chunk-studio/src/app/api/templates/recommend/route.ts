import { NextResponse } from "next/server";
import { loadJobExtractedText } from "@/lib/template/jobDocument";
import { detectLayoutProfile } from "@/lib/template/templateDetector";
import { getLatestTemplates } from "@/lib/template/templateRepository";
import { matchTemplates } from "@/lib/template/templateMatcher";

interface RecommendBody {
  jobId?: string;
  family?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RecommendBody;
  const jobId = body.jobId?.trim();
  const family = body.family?.trim() || "default/general";
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const doc = await loadJobExtractedText(jobId);
  if (!doc || !doc.text.trim()) {
    return NextResponse.json(
      { error: "Document text not found. Upload/process file first." },
      { status: 404 }
    );
  }

  const profile = detectLayoutProfile(doc.text);
  const templates = await getLatestTemplates(family, profile.docType);
  const recommendations = matchTemplates(profile, templates);

  return NextResponse.json({
    profile,
    recommendations,
  });
}

