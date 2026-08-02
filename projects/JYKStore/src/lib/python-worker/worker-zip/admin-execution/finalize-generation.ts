import { prisma } from "@/lib/prisma";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import { WorkerZipImportServiceError } from "../errors";
import type { OpenRequestMarker, ResolvedAdminGenerationPack } from "./types";

/**
 * On successful Worker run: re-check marker revision, activate source revision,
 * and mark open request markers PASS.
 */
export async function finalizeSuccessfulGeneration(args: {
  client: typeof prisma;
  pack: ResolvedAdminGenerationPack["pack"];
  version: ResolvedAdminGenerationPack["version"];
  revision: { id: string };
  workingCopy: { id: string };
  openMarker: OpenRequestMarker | null;
}): Promise<void> {
  const { client, pack, version, revision, workingCopy, openMarker } = args;
  const { activateWorkerZipSourceRevision } = await import(
    "@/lib/python-worker/worker-zip-source-revision-service"
  );
  const { markWorkerZipWorkingCopyFailed } = await import(
    "@/lib/python-worker/worker-zip-working-copy-service"
  );

  try {
    // Re-check marker still points at the same revision before pointer flip.
    if (openMarker) {
      const markerNow = await client.pipelineRun.findUnique({
        where: { id: openMarker.id },
        select: { sourceRevisionId: true },
      });
      if (markerNow?.sourceRevisionId && markerNow.sourceRevisionId !== revision.id) {
        throw new WorkerZipImportServiceError(
          "REQUEST_SOURCE_REVISION_MISMATCH",
          "실행 중 요청 marker의 원본 revision이 변경되었습니다.",
          409,
        );
      }
    }
    await activateWorkerZipSourceRevision({
      revisionId: revision.id,
      versionId: version.id,
      workingCopyId: workingCopy.id,
      prismaClient: client,
    });
    await client.pipelineRun.updateMany({
      where: {
        packId: pack.packId,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
      },
      data: { status: "PASS", finishedAt: new Date() },
    });
  } catch (error) {
    await markWorkerZipWorkingCopyFailed({
      workingCopyId: workingCopy.id,
      failureCode: "SOURCE_ACTIVATION_FAILED",
      failureMessage:
        error instanceof Error ? error.message : "원본/작업본 활성화에 실패했습니다.",
      prismaClient: client,
    });
    throw new WorkerZipImportServiceError(
      "SOURCE_ACTIVATION_FAILED",
      "생성은 완료됐지만 현재 원본·작업본 활성화에 실패했습니다. 기존 현재 pointer는 유지됩니다.",
      500,
    );
  }
}
