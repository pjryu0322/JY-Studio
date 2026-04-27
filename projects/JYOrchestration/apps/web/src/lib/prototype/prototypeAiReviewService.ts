import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

export type PrototypeAiReviewInput = Readonly<{
  run: PrototypeRun;
  /** 커밋 diff 또는 변경 파일 목록(향후). */
  changedFiles?: readonly string[];
  commitSha?: string | null;
}>;

export type PrototypeAiReviewOutcome =
  | { readonly decision: "PENDING"; readonly summary: "NOT_IMPLEMENTED" }
  | { readonly decision: "NOT_IMPLEMENTED"; readonly summary: string };

/**
 * AI 기획자 검토 — 현재는 구현되지 않았으며 성공을 가장하지 않습니다.
 */
export async function reviewPrototypeCommit(input: PrototypeAiReviewInput): Promise<PrototypeAiReviewOutcome> {
  void input.run;
  if (!input.commitSha || !input.changedFiles?.length) {
    return { decision: "PENDING", summary: "NOT_IMPLEMENTED" };
  }
  return {
    decision: "NOT_IMPLEMENTED",
    summary: "커밋 메타는 있으나 diff 기반 검토 파이프라인이 아직 연결되지 않았습니다.",
  };
}
