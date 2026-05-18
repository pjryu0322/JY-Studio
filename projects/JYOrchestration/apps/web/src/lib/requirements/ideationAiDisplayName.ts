import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";

/** 아이디어 구체화 화면에서 쓰는 AI 기획자 표시명(멤버 정의 기준). */
export const IDEATION_AI_DISPLAY_NAME = getWorkspaceAiMember("ideation")?.title ?? "AI 기획자";
