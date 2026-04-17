export type DeliberationQuestion = Readonly<{
  id: string;
  prompt: string;
  hint: string;
}>;

/** AI 숙의 단계용 가이드 질문(답변은 프로젝트 설명 하단에 텍스트로 누적 저장) */
export const REQUIREMENTS_DELIBERATION_QUESTIONS: readonly DeliberationQuestion[] = [
  {
    id: "users",
    prompt: "주요 사용자는 누구인가요?",
    hint: "역할, 경험 수준, 사용 환경을 적어 주세요.",
  },
  {
    id: "top3",
    prompt: "가장 중요한 기능 세 가지는 무엇인가요?",
    hint: "번호 목록으로 적어 주세요.",
  },
  {
    id: "admin",
    prompt: "관리자 화면이 필요한가요?",
    hint: "필요 / 불필요 / 나중에,와 이유를 적어 주세요.",
  },
  {
    id: "platform",
    prompt: "웹만 필요한가요? 모바일도 필요한가요?",
    hint: "우선순위와 함께 적어 주세요.",
  },
  {
    id: "auth",
    prompt: "로그인·권한 관리가 필요한가요?",
    hint: "소셜 로그인, 사내 계정 등 구체적으로 적어 주세요.",
  },
  {
    id: "success",
    prompt: "성공 기준은 무엇인가요?",
    hint: "측정 가능한 문장이면 더 좋습니다.",
  },
] as const;
