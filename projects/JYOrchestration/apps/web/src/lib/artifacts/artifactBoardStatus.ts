export type ArtifactBoardStatus =
  | "created"
  | "missing"
  | "generatable"
  | "waiting"
  | "needs_revision"
  | "candidate"
  | "stale";

export const ARTIFACT_BOARD_STATUS_LABELS: Readonly<Record<ArtifactBoardStatus, string>> = {
  created: "생성완료",
  missing: "미생성",
  generatable: "생성가능",
  waiting: "생성대기",
  needs_revision: "보완필요",
  candidate: "후보",
  stale: "최신아님",
};

const MEANINGLESS_CONTENT = new Set(["", "-", "—", "(empty)", "empty", "n/a", "none"]);

export function isArtifactContentMeaningful(content: string | undefined | null): boolean {
  const t = String(content ?? "").trim();
  if (!t || MEANINGLESS_CONTENT.has(t.toLowerCase())) return false;
  if (/^슬롯이 아직 없습니다|^데이터가 없습니다/i.test(t)) return false;
  return t.length >= 8;
}

export function isArtifactBoardStatusCreated(status: ArtifactBoardStatus): boolean {
  return status === "created" || status === "needs_revision" || status === "candidate";
}
