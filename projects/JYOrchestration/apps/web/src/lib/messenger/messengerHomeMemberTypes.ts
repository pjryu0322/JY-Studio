/**
 * 메신저 홈 [멤버] 탭 — 휴먼/AI 표시용 프론트 전용 타입(백엔드 친구 API 연결 시 동일 필드로 매핑).
 */

export type HumanFriendStatus = "FRIEND" | "INVITED" | "PENDING" | "INACTIVE";

export type HumanMember = {
  id: string;
  displayName: string;
  email?: string;
  status: HumanFriendStatus;
  avatarUrl?: string;
};

export type AiMemberStatus = "AVAILABLE" | "COMING_SOON";

export type AiMember = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: AiMemberStatus;
  promptKey?: string;
};
