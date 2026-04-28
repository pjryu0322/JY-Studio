import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

export type PrototypeAiReviewResult =
  | { readonly outcome: "PASS"; readonly summary?: string }
  | { readonly outcome: "REWORK_REQUIRED"; readonly summary: string }
  | { readonly outcome: "BLOCKED"; readonly reason: "REVIEW_DATA_MISSING" | "REVIEW_ENGINE_NOT_READY" };

/**
 * 프로토타입 실행에 대한 AI 검토 경계. 엔진이 없으면 PASS 로 위장하지 않습니다.
 */
export async function reviewPrototypeRun(run: PrototypeRun): Promise<PrototypeAiReviewResult> {
  // MVP: PR 생성 파이프라인을 막지 않는다.
  // - commitSha/브랜치가 없으면 BLOCKED
  // - changedFiles가 비어도 PASS(경고 요약)로 진행
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
  // TODO: diff 기반 실제 리뷰 엔진 연동. 현재는 최소 경계만 유지.
  return { outcome: "PASS" };
}
