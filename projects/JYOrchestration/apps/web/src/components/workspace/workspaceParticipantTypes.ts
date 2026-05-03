/** 참여 멤버 모달·사이드바·`useWorkspaceParticipants` 등 공통 타입 */

export type ParticipantOption = {
  readonly id: string;
  readonly name: string;
  readonly kind: "ai" | "human";
  /** 현재 앱에 로그인한 사용자 본인 여부(간이 온라인 표시) */
  readonly onlineHint: boolean;
  /** AI 멤버: OpenAI 연결·호출 상태 한 줄(있으면 이 값을 우선 표시) */
  readonly aiStatusLabel?: string;
  /** 프로젝트 멤버 역할(표시용) */
  readonly roleLabel?: string;
  /** userId 없이 초대만 된 사람 멤버 */
  readonly invited?: boolean;
};
