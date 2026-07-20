/**
 * Shared DB-backed evidence checks used by the preparation / selected-channel /
 * current-evidence assertions in service-validation-evidence-asserts.ts.
 * Kept separate so each assertion function stays focused on its own gate order.
 */
import type { Prisma } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { assertSharedConfirmationEvidence } from "@/lib/distribution/service-validation-share";

type PrismaLike = Prisma.TransactionClient;

type ShareableResultItemRow = {
  rank: number;
  chunkId: string;
  sourceDocumentId: string;
  pageStart: number | null;
  pageEnd: number | null;
};

/** Pure: project full result-item rows down to the shared-evidence comparison shape. */
export function mapSharedEvidenceResultItems(items: ShareableResultItemRow[]) {
  return items.map((i) => ({
    rank: i.rank,
    chunkId: i.chunkId,
    sourceDocumentId: i.sourceDocumentId,
    pageStart: i.pageStart,
    pageEnd: i.pageEnd,
  }));
}

/**
 * When an API and MCP run were confirmed via the same shared-confirmation group,
 * re-validate that their retrieval evidence still matches (fail-closed on drift).
 * No-op when either run/group is missing or the runs aren't in the same group.
 */
export async function assertSharedApiMcpConfirmationEvidenceIfGrouped(
  db: PrismaLike,
  input: {
    apiRunId?: string | null;
    mcpRunId?: string | null;
    apiConfirmationId?: string | null;
    mcpConfirmationId?: string | null;
  },
): Promise<void> {
  if (!input.apiRunId || !input.mcpRunId) return;

  const [apiRun, mcpRun, apiConf, mcpConf] = await Promise.all([
    db.serviceValidationRun.findUnique({ where: { id: input.apiRunId } }),
    db.serviceValidationRun.findUnique({ where: { id: input.mcpRunId } }),
    input.apiConfirmationId
      ? db.serviceValidationProviderConfirmation.findUnique({ where: { id: input.apiConfirmationId } })
      : Promise.resolve(null),
    input.mcpConfirmationId
      ? db.serviceValidationProviderConfirmation.findUnique({ where: { id: input.mcpConfirmationId } })
      : Promise.resolve(null),
  ]);

  if (
    !apiConf?.sharedConfirmationGroupId ||
    apiConf.sharedConfirmationGroupId !== mcpConf?.sharedConfirmationGroupId
  ) {
    return;
  }

  const [apiResults, mcpResults] = await Promise.all([
    db.serviceValidationResultItem.findMany({
      where: { runId: input.apiRunId },
      orderBy: { rank: "asc" },
    }),
    db.serviceValidationResultItem.findMany({
      where: { runId: input.mcpRunId },
      orderBy: { rank: "asc" },
    }),
  ]);

  const asserted = assertSharedConfirmationEvidence({
    apiRun,
    mcpRun,
    apiResults: mapSharedEvidenceResultItems(apiResults),
    mcpResults: mapSharedEvidenceResultItems(mcpResults),
  });
  if (!asserted.ok) {
    throw new PayloadServiceError(asserted.code, asserted.message, 400);
  }
}

/** Loads the DOWNLOAD-channel test evidence for a run, or throws if it isn't ready. */
export async function assertDownloadTestEvidenceReady(
  db: PrismaLike,
  runId: string,
): Promise<string> {
  const downloadTest = await db.serviceValidationDownloadTest.findUnique({ where: { runId } });
  if (!downloadTest?.responseReady) {
    throw new PayloadServiceError(
      "SERVICE_DOWNLOAD_TEST_REQUIRED",
      "다운로드 테스트 증적이 필요합니다. 테스트 다운로드 후 품질 확인해 주세요.",
      400,
    );
  }
  return downloadTest.id;
}
