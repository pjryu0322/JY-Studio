import { prisma } from "@/lib/prisma";

export interface JobDocumentPayload {
  jobId: string;
  text: string;
  originalFilename: string | null;
}

export async function loadJobExtractedText(
  jobId: string
): Promise<JobDocumentPayload | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { files: true, artifacts: true },
  });
  if (!job) return null;

  const extracted = job.artifacts.find((a) => a.type === "EXTRACTED_TEXT");
  const meta =
    extracted && extracted.meta && typeof extracted.meta === "object"
      ? (extracted.meta as Record<string, unknown>)
      : null;
  const text = typeof meta?.text === "string" ? meta.text : "";
  return {
    jobId,
    text,
    originalFilename:
      job.files.find((f) => f.sourceType === "original")?.originalName ?? null,
  };
}

