import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  countSourceValidationFromStatuses,
  meetsSourceValidationSubmitGate,
} from "@/lib/source-validation-readiness";
import {
  chunkQualityGateSnapshotFromSummary,
  getChunkQualityBlockingMessage,
  meetsChunkQualityGate,
} from "@/lib/chunk-quality/chunk-quality-readiness";
import {
  getRetrievalEvaluationBlockingMessage,
  meetsRetrievalEvaluationGate,
  retrievalEvaluationGateSnapshotFromSummary,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-readiness";
import {
  meetsReleaseGateSubmitGate,
  releaseGateSnapshotFromSummary,
} from "@/lib/release-gate/release-gate-readiness";
import {
  getStructureQualityBlockingMessage,
  meetsStructureQualityGate,
  structureQualityGateSnapshotFromSummary,
} from "@/lib/structure-quality/structure-quality-readiness";

export type SubmitReadinessNextAction =
  | "RUN_STRUCTURE_QUALITY"
  | "RUN_CHUNK_QUALITY"
  | "GENERATE_RETRIEVAL_CASES"
  | "RUN_RETRIEVAL_EVALUATION"
  | "RUN_RELEASE_GATE"
  | "SUBMIT_REVIEW"
  | "WAIT_ADMIN_REVIEW"
  | "BLOCKED";

export type SubmitReadinessStepStatus =
  | "completed"
  | "current"
  | "waiting"
  | "blocked"
  | "failed";

export type SubmitReadinessStepKey =
  | "structure_quality"
  | "chunk_quality"
  | "retrieval_cases"
  | "retrieval_evaluation"
  | "release_gate"
  | "submit_review";

export type SubmitReadinessStep = {
  key: SubmitReadinessStepKey;
  title: string;
  description: string;
  status: SubmitReadinessStepStatus;
  actionLabel?: string;
  actionKind?: SubmitReadinessNextAction;
  blockingReasons?: string[];
};

export type ProviderSubmitReadinessPlan = {
  nextAction: SubmitReadinessNextAction;
  nextActionLabel: string;
  nextActionDescription: string;
  currentStepTitle: string;
  completedStepCount: number;
  totalStepCount: number;
  canSubmitReview: boolean;
  releaseGateDone: boolean;
  requiresFinalGateOnSubmit: boolean;
  submitBlockedReasons: string[];
  incompleteStepTitles: string[];
  steps: SubmitReadinessStep[];
};

const QUALITY_STEP_COUNT = 5;

function hasRetrievalCases(pack: ProviderPackDetailDto): boolean {
  return (pack.retrievalEvaluation?.set?.activeCaseCount ?? 0) > 0;
}

function structureFailed(gate: ReturnType<typeof structureQualityGateSnapshotFromSummary>): boolean {
  return (
    gate.structureCoverageStatus === "FAIL" || gate.knowledgeQualityStatus === "FAIL"
  );
}

function chunkFailed(gate: ReturnType<typeof chunkQualityGateSnapshotFromSummary>): boolean {
  return gate.reportStatus === "FAIL";
}

function retrievalFailed(
  gate: ReturnType<typeof retrievalEvaluationGateSnapshotFromSummary>,
): boolean {
  return gate.reportStatus === "FAIL";
}

export function getStructureQualityEvaluateLabel(pack: ProviderPackDetailDto): string {
  const gate = structureQualityGateSnapshotFromSummary(pack.structureQuality ?? null);
  if (gate.freshnessStatus === "MISSING" || !pack.structureQuality?.structureCoverage) {
    return "구조/품질 자동 점검";
  }
  return "구조/품질 자동 재점검";
}

export function getChunkQualityEvaluateLabel(pack: ProviderPackDetailDto): string {
  const gate = chunkQualityGateSnapshotFromSummary(pack.chunkQuality ?? null);
  if (gate.freshnessStatus === "MISSING" || !pack.chunkQuality?.report) {
    return "Chunk 자동 생성 및 품질 점검";
  }
  return "Chunk 자동 재생성 및 점검";
}

export function getRetrievalCasesActionLabel(pack: ProviderPackDetailDto): string {
  return hasRetrievalCases(pack) ? "검색 평가 케이스 다시 생성" : "검색 평가 케이스 생성";
}

export function getRetrievalRunActionLabel(pack: ProviderPackDetailDto): string {
  if (!pack.retrievalEvaluation?.latestRun) {
    return "검색 품질 자동 점검";
  }
  return "검색 품질 자동 재점검";
}

export function getReleaseGateActionLabel(pack: ProviderPackDetailDto): string {
  if (!pack.releaseGate?.latestRun) {
    return "릴리스 게이트 사전 점검";
  }
  return "릴리스 게이트 재점검";
}

export function buildProviderSubmitReadinessPlan(input: {
  pack: ProviderPackDetailDto;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount: number;
}): ProviderSubmitReadinessPlan {
  const { pack, sourceDocumentCount, knowledgeUnitDraftCount } = input;
  const docs = pack.versions.flatMap((v) => v.sourceDocuments);
  const validation = countSourceValidationFromStatuses(docs.map((d) => d.validationStatus));
  const structureGate = structureQualityGateSnapshotFromSummary(pack.structureQuality ?? null);
  const chunkGate = chunkQualityGateSnapshotFromSummary(pack.chunkQuality ?? null);
  const retrievalGate = retrievalEvaluationGateSnapshotFromSummary(pack.retrievalEvaluation ?? null);
  const releaseGate = releaseGateSnapshotFromSummary(pack.releaseGate ?? null);

  const structureDone = meetsStructureQualityGate(structureGate);
  const chunkDone = meetsChunkQualityGate(chunkGate);
  const casesDone = hasRetrievalCases(pack);
  const retrievalDone = meetsRetrievalEvaluationGate(retrievalGate);
  const releaseGateDone = meetsReleaseGateSubmitGate(releaseGate);

  const submitBlockedReasons: string[] = [];
  if (sourceDocumentCount === 0) submitBlockedReasons.push("원천 문서 등록");
  if (knowledgeUnitDraftCount === 0) submitBlockedReasons.push("Knowledge Unit 후보 확인");
  if (!meetsSourceValidationSubmitGate(validation)) {
    submitBlockedReasons.push("원천 문서 검증 통과");
  }
  if (!structureDone) submitBlockedReasons.push("구조/품질 점검");
  if (!chunkDone) submitBlockedReasons.push("청킹 품질 점검");
  if (!retrievalDone) submitBlockedReasons.push("검색 품질 평가");

  let nextAction: SubmitReadinessNextAction = "BLOCKED";
  let nextActionLabel = "대기 중";
  let nextActionDescription = "검수 요청 준비를 진행할 수 없습니다.";
  let currentStepTitle = "사전 준비";

  if (pack.status === "REVIEWING") {
    nextAction = "WAIT_ADMIN_REVIEW";
    nextActionLabel = "관리자 검토 대기";
    nextActionDescription =
      "검수 요청이 접수되었습니다. 관리자가 Chunk 품질과 공개 여부를 확인합니다.";
    currentStepTitle = "관리자 검토";
  } else if (pack.status === "PUBLISHED" || pack.status === "VERIFIED") {
    nextAction = "BLOCKED";
    nextActionLabel = "공개 완료";
    nextActionDescription = "이미 승인·공개된 지식팩입니다.";
    currentStepTitle = "공개됨";
  } else if (sourceDocumentCount === 0 || knowledgeUnitDraftCount === 0) {
    nextAction = "BLOCKED";
    nextActionLabel = "자료·초안 준비 필요";
    nextActionDescription =
      "검수 요청 전에 원천 문서 등록과 Knowledge Unit 후보 생성을 완료해 주세요.";
    currentStepTitle = "사전 준비";
  } else if (!meetsSourceValidationSubmitGate(validation)) {
    nextAction = "BLOCKED";
    nextActionLabel = "원천 문서 검증 필요";
    nextActionDescription = "검증 실패 또는 미검사 문서를 해결한 뒤 다시 시도해 주세요.";
    currentStepTitle = "원천 문서 검증";
  } else if (!structureDone) {
    nextAction = "RUN_STRUCTURE_QUALITY";
    nextActionLabel = getStructureQualityEvaluateLabel(pack);
    nextActionDescription =
      getStructureQualityBlockingMessage(structureGate, pack.structureQuality) ??
      "검수 요청 전 원천 문서 구성과 품질을 먼저 점검해야 합니다.";
    currentStepTitle = "구조/품질 점검";
  } else if (!chunkDone) {
    nextAction = "RUN_CHUNK_QUALITY";
    nextActionLabel = getChunkQualityEvaluateLabel(pack);
    nextActionDescription =
      getChunkQualityBlockingMessage(chunkGate, pack.chunkQuality) ??
      "시스템이 생성한 Chunk의 기본 품질을 확인합니다.";
    currentStepTitle = "청킹 품질 점검";
  } else if (!casesDone) {
    nextAction = "GENERATE_RETRIEVAL_CASES";
    nextActionLabel = getRetrievalCasesActionLabel(pack);
    nextActionDescription = "검색 품질 평가에 사용할 질의 케이스를 생성합니다.";
    currentStepTitle = "검색 평가 케이스 생성";
  } else if (!retrievalDone) {
    nextAction = "RUN_RETRIEVAL_EVALUATION";
    nextActionLabel = getRetrievalRunActionLabel(pack);
    nextActionDescription =
      getRetrievalEvaluationBlockingMessage(retrievalGate, pack.retrievalEvaluation) ??
      "Context API 검색 품질을 확인합니다.";
    currentStepTitle = "검색 품질 평가 실행";
  } else {
    nextAction = "SUBMIT_REVIEW";
    nextActionLabel = "최종 점검 후 검수 요청";
    nextActionDescription =
      "제출 시 시스템이 원천 문서, Chunk, 검색 품질, 릴리스 게이트를 최신 상태로 다시 점검합니다. 최종 점검을 통과하면 관리자 검토 단계로 제출됩니다.";
    currentStepTitle = "검수 요청 제출";
  }

  const completedStepCount =
    (structureDone ? 1 : 0) +
    (chunkDone ? 1 : 0) +
    (casesDone ? 1 : 0) +
    (retrievalDone ? 1 : 0) +
    (releaseGateDone ? 1 : 0);

  const incompleteStepTitles: string[] = [];
  if (!structureDone) incompleteStepTitles.push("구조/품질 점검");
  if (!chunkDone) incompleteStepTitles.push("청킹 품질 점검");
  if (!casesDone) incompleteStepTitles.push("검색 평가 케이스 생성");
  if (!retrievalDone) incompleteStepTitles.push("검색 품질 평가");

  const canSubmit =
    pack.status === "DRAFT" &&
    structureDone &&
    chunkDone &&
    retrievalDone &&
    meetsSourceValidationSubmitGate(validation) &&
    sourceDocumentCount > 0 &&
    knowledgeUnitDraftCount > 0;

  const requiresFinalGateOnSubmit = canSubmit && !releaseGateDone;

  const steps = buildSteps({
    pack,
    structureGate,
    chunkGate,
    structureDone,
    chunkDone,
    casesDone,
    retrievalDone,
    releaseGateDone,
    nextAction,
    canSubmit,
  });

  return {
    nextAction,
    nextActionLabel,
    nextActionDescription,
    currentStepTitle,
    completedStepCount,
    totalStepCount: QUALITY_STEP_COUNT,
    canSubmitReview: canSubmit,
    releaseGateDone,
    requiresFinalGateOnSubmit,
    submitBlockedReasons,
    incompleteStepTitles,
    steps,
  };
}

function buildSteps(args: {
  pack: ProviderPackDetailDto;
  structureGate: ReturnType<typeof structureQualityGateSnapshotFromSummary>;
  chunkGate: ReturnType<typeof chunkQualityGateSnapshotFromSummary>;
  structureDone: boolean;
  chunkDone: boolean;
  casesDone: boolean;
  retrievalDone: boolean;
  releaseGateDone: boolean;
  nextAction: SubmitReadinessNextAction;
  canSubmit: boolean;
}): SubmitReadinessStep[] {
  const {
    pack,
    structureGate,
    chunkGate,
    structureDone,
    chunkDone,
    casesDone,
    retrievalDone,
    releaseGateDone,
    nextAction,
    canSubmit,
  } = args;

  const structureStatus: SubmitReadinessStepStatus = structureDone
    ? "completed"
    : nextAction === "RUN_STRUCTURE_QUALITY"
      ? structureFailed(structureGate)
        ? "failed"
        : "current"
      : "waiting";

  const chunkStatus: SubmitReadinessStepStatus = chunkDone
    ? "completed"
    : !structureDone
      ? "waiting"
      : nextAction === "RUN_CHUNK_QUALITY"
        ? chunkFailed(chunkGate)
          ? "failed"
          : "current"
        : "waiting";

  const casesStatus: SubmitReadinessStepStatus = casesDone
    ? "completed"
    : !structureDone || !chunkDone
      ? "waiting"
      : nextAction === "GENERATE_RETRIEVAL_CASES"
        ? "current"
        : "waiting";

  const evalStatus: SubmitReadinessStepStatus = retrievalDone
    ? "completed"
    : !casesDone
      ? "waiting"
      : nextAction === "RUN_RETRIEVAL_EVALUATION"
        ? retrievalFailed(
            retrievalEvaluationGateSnapshotFromSummary(pack.retrievalEvaluation ?? null),
          )
          ? "failed"
          : "current"
        : "waiting";

  const releaseFailed =
    releaseGateSnapshotFromSummary(pack.releaseGate ?? null).status === "FAIL";
  const releaseStatus: SubmitReadinessStepStatus = releaseGateDone
    ? "completed"
    : !retrievalDone
      ? "waiting"
      : releaseFailed
        ? "failed"
        : canSubmit
          ? "waiting"
          : "waiting";

  let submitStatus: SubmitReadinessStepStatus = "waiting";
  if (pack.status === "REVIEWING") submitStatus = "completed";
  else if (canSubmit && nextAction === "SUBMIT_REVIEW") submitStatus = "current";
  else if (!canSubmit && pack.status === "DRAFT") submitStatus = "blocked";

  return [
    {
      key: "structure_quality",
      title: "구조/품질 점검",
      description: "원천 문서 구성과 기본 품질을 확인합니다.",
      status: structureStatus,
      actionLabel:
        structureStatus === "current" ? getStructureQualityEvaluateLabel(pack) : undefined,
      actionKind: structureStatus === "current" ? "RUN_STRUCTURE_QUALITY" : undefined,
    },
    {
      key: "chunk_quality",
      title: "Chunk 생성 및 청킹 품질 점검",
      description:
        "Chunk는 시스템이 자동 생성합니다. 제공자는 직접 편집하지 않고, 자동 생성된 Chunk 품질 점검 결과만 확인합니다.",
      status: chunkStatus,
      actionLabel: chunkStatus === "current" ? getChunkQualityEvaluateLabel(pack) : undefined,
      actionKind: chunkStatus === "current" ? "RUN_CHUNK_QUALITY" : undefined,
      blockingReasons:
        chunkStatus === "waiting" && !structureDone
          ? ["구조/품질 점검 완료 후 실행할 수 있습니다."]
          : undefined,
    },
    {
      key: "retrieval_cases",
      title: "검색 평가 케이스 생성",
      description: "검색 품질 평가에 사용할 질의 케이스를 생성합니다.",
      status: casesStatus,
      actionLabel: casesStatus === "current" ? getRetrievalCasesActionLabel(pack) : undefined,
      actionKind: casesStatus === "current" ? "GENERATE_RETRIEVAL_CASES" : undefined,
      blockingReasons:
        casesStatus === "waiting" && (!structureDone || !chunkDone)
          ? ["구조/품질·청킹 품질 점검 완료 후 실행할 수 있습니다."]
          : undefined,
    },
    {
      key: "retrieval_evaluation",
      title: "검색 품질 평가 실행",
      description: "Context API 검색 품질을 확인합니다.",
      status: evalStatus,
      actionLabel: evalStatus === "current" ? getRetrievalRunActionLabel(pack) : undefined,
      actionKind: evalStatus === "current" ? "RUN_RETRIEVAL_EVALUATION" : undefined,
      blockingReasons:
        evalStatus === "waiting" && !casesDone
          ? ["검색 평가 케이스 생성 후 실행할 수 있습니다."]
          : undefined,
    },
    {
      key: "release_gate",
      title: "릴리스 게이트 사전 점검",
      description: canSubmit
        ? "검수 요청 시 시스템이 최신 상태로 자동 실행합니다."
        : "공개 전 Source·구조·청킹·검색 품질을 통합 점검합니다.",
      status: releaseStatus,
      actionLabel:
        retrievalDone && !releaseGateDone && pack.status === "DRAFT"
          ? getReleaseGateActionLabel(pack)
          : undefined,
      actionKind:
        retrievalDone && !releaseGateDone && pack.status === "DRAFT"
          ? "RUN_RELEASE_GATE"
          : undefined,
      blockingReasons:
        releaseStatus === "waiting" && !retrievalDone
          ? ["검색 품질 평가 완료 후 실행할 수 있습니다."]
          : releaseStatus === "waiting" && canSubmit
            ? ["최종 제출 시 자동 실행됩니다. 사전 점검은 선택 사항입니다."]
            : undefined,
    },
    {
      key: "submit_review",
      title: "최종 점검 후 검수 요청",
      description: "제출 시 시스템이 최신 상태로 최종 점검을 다시 실행합니다.",
      status: submitStatus,
      actionLabel: submitStatus === "current" ? "최종 점검 후 검수 요청" : undefined,
      actionKind: submitStatus === "current" ? "SUBMIT_REVIEW" : undefined,
    },
  ];
}
