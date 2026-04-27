import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

export type PrototypeAiReviewResult =
  | { readonly outcome: "PASS" }
  | { readonly outcome: "REWORK_REQUIRED"; readonly summary: string }
  | { readonly outcome: "BLOCKED"; readonly reason: "REVIEW_DATA_MISSING" | "REVIEW_ENGINE_NOT_READY" };

/**
 * 프로토타입 실행에 대한 AI 검토 경계. 엔진이 없으면 PASS 로 위장하지 않습니다.
 */
export async function reviewPrototypeRun(run: PrototypeRun): Promise<PrototypeAiReviewResult> {
  const files = run.changedFiles?.length ? run.changedFiles : [];
  if (!files.length) {
    return { outcome: "BLOCKED", reason: "REVIEW_DATA_MISSING" };
  }
  void run.commitSha;
  return { outcome: "BLOCKED", reason: "REVIEW_ENGINE_NOT_READY" };
}
