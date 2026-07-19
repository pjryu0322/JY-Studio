import { createPublicExportRoute } from "@/lib/public-export-route";
import { buildPublicRagExportPackage } from "@/lib/exports/rag-export-public";

export const GET = createPublicExportRoute({
  build: buildPublicRagExportPackage,
  metadata: (data) => ({
    exportType: "JYKSTORE_RAG_EXPORT_ZIP",
    schemaVersion: data.schemaVersion,
    policyVersion: data.policyVersion,
    chunkCount: data.chunkCount,
    sourceCount: data.sourceCount,
    exportFingerprint: data.exportFingerprint,
  }),
  response: (data) =>
    new Response(Buffer.from(data.zipBytes ?? new Uint8Array()), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${data.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-JYK-Rag-Export-Fingerprint": data.exportFingerprint,
      },
    }),
});
