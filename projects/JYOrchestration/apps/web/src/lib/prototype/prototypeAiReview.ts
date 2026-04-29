import type { PrototypeRun, PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";

export type PrototypeAiReviewResult =
  | { readonly outcome: "PASS"; readonly summary?: string }
  | { readonly outcome: "REWORK_REQUIRED"; readonly summary: string }
  | { readonly outcome: "BLOCKED"; readonly reason: "REVIEW_DATA_MISSING" | "REVIEW_ENGINE_NOT_READY" };

/**
 * 프로토타입 실행에 대한 AI 검토 경계. 엔진이 없으면 PASS 로 위장하지 않습니다.
 * @deprecated 단일 실행 검토 — reviewPrototypeWorkUnit 사용
 */
export async function reviewPrototypeRun(run: PrototypeRun): Promise<PrototypeAiReviewResult> {
  const branch = String(run.branchName ?? "").trim();
  const sha = String(run.commitSha ?? "").trim();
  if (!branch || !sha) {
    return { outcome: "BLOCKED", reason: "REVIEW_DATA_MISSING" };
  }
  const files = run.changedFiles?.length ? run.changedFiles : [];
  if (!files.length) {
    return {
      outcome: "PASS",
      summary: "변경 파일 상세를 확인하지 못했으나 커밋 감지는 완료됨. PR 생성/머지는 계속 진행합니다.",
    };
  }
  return { outcome: "PASS" };
}

/** WorkUnit 단위 검토(브랜치 tip + 커밋 SHA). */
export async function reviewPrototypeWorkUnit(unit: PrototypeWorkUnit): Promise<PrototypeAiReviewResult> {
  const branch = String(unit.branchName ?? "").trim();
  const sha = String(unit.commitSha ?? "").trim();
  if (!branch || !sha) {
    return { outcome: "BLOCKED", reason: "REVIEW_DATA_MISSING" };
  }
  const files = unit.changedFiles?.length ? unit.changedFiles : [];
  if (!files.length) {
    return {
      outcome: "PASS",
      summary: "변경 파일 상세를 확인하지 못했으나 커밋 감지는 완료됨. PR 생성/머지는 계속 진행합니다.",
    };
  }
  return { outcome: "PASS" };
}
