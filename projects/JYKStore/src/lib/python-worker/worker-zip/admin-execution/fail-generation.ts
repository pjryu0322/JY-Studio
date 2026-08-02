import { prisma } from "@/lib/prisma";
import type { ProviderWorkerZipImportResult } from "../import-run";

/**
 * Mark Working Copy failed after a non-ok Worker import result.
 */
export async function failGenerationOnImportError(args: {
  client: typeof prisma;
  workingCopyId: string;
  result: ProviderWorkerZipImportResult;
}): Promise<void> {
  const { client, workingCopyId, result } = args;
  const { markWorkerZipWorkingCopyFailed } = await import(
    "@/lib/python-worker/worker-zip-working-copy-service"
  );
  await markWorkerZipWorkingCopyFailed({
    workingCopyId,
    failureCode: result.error?.code ?? "WORKER_ZIP_IMPORT_FAILED",
    failureMessage: result.error?.message ?? "Worker 실행에 실패했습니다.",
    prismaClient: client,
  });
}
