import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export type DraftReadiness =
  | { ok: true }
  | { ok: false; message: string; needs: string[] };

export function validateDraftReadiness(messages: readonly RequirementsMessage[]): DraftReadiness {
  const userMsgs = messages.filter((m) => m.speakerType === "USER" && m.content.trim());
  const needs: string[] = [];

  if (userMsgs.length < 2) {
    needs.push("대상 사용자", "핵심 기능", "운영 방식");
    return {
      ok: false,
      needs,
      message: `초안을 만들기 전에 아래 내용을 더 논의해야 합니다.\n- ${needs.join("\n- ")}`,
    };
  }

  const blob = userMsgs.map((m) => m.content).join("\n");
  const hasUsers = /대상|사용자|유저|권한|역할/.test(blob);
  const hasFeatures = /기능|작성|검색|공유|권한|업로드|요약|추출|관리/.test(blob);
  const hasOps = /운영|관리자|정책|권한|승인|보관|감사/.test(blob);
  if (!hasUsers) needs.push("대상 사용자");
  if (!hasFeatures) needs.push("핵심 기능");
  if (!hasOps) needs.push("운영 방식");

  if (needs.length) {
    return {
      ok: false,
      needs,
      message: `초안을 만들기 전에 아래 내용을 더 논의해야 합니다.\n- ${needs.join("\n- ")}`,
    };
  }
  return { ok: true };
}

