/**
 * 아이디어 구체화 화면의 4개 완료 조건(요약 편집 필드와 대응).
 * DB 스키마 변경 없이 기존 spec 필드 문자열만 사용합니다.
 */
export type IdeationChecklistSlice = {
  readonly goals: string;
  readonly targetUsers: string;
  readonly success: string;
  readonly nfr: string;
};

export type IdeationChecklistItem = {
  readonly id: "user_def" | "core_features" | "roles" | "operations";
  readonly label: string;
  readonly done: boolean;
};

export function ideationChecklistItems(slice: IdeationChecklistSlice): IdeationChecklistItem[] {
  const goals = slice.goals.trim();
  const targetUsers = slice.targetUsers.trim();
  const success = slice.success.trim();
  const nfr = slice.nfr.trim();
  return [
    { id: "user_def", label: "사용자 정의", done: targetUsers.length > 0 },
    { id: "core_features", label: "핵심 기능", done: goals.length > 0 },
    { id: "roles", label: "권한/역할", done: success.length > 0 },
    { id: "operations", label: "운영 요구사항", done: nfr.length > 0 },
  ];
}

export function ideationChecklistComplete(slice: IdeationChecklistSlice): boolean {
  return ideationChecklistItems(slice).every((x) => x.done);
}
