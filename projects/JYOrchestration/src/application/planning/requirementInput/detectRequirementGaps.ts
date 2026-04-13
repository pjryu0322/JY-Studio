/**
 * Lightweight, deterministic “likely missing” hints for planning (not user-facing prompts).
 */

import type { RequirementDraft, RequirementGap } from "./requirementInputContracts";

export function detectRequirementGaps(normalizedText: string, drafts: readonly RequirementDraft[]): RequirementGap[] {
  const gaps: RequirementGap[] = [];
  const t = normalizedText.toLowerCase();

  if (normalizedText.trim().length > 0 && normalizedText.trim().length < 24) {
    gaps.push({
      code: "SHORT_INPUT",
      question: "Is the idea fully captured in one sentence, or should scope be expanded?",
      severity: "INFO",
    });
  }

  const mentionsAuth =
    /(로그인|인증|auth|login|password|비밀번호|sso|oauth|jwt)/iu.test(normalizedText) ||
    drafts.some((d) => /(로그인|인증|auth|login)/iu.test(d.description));
  if (!mentionsAuth && normalizedText.length > 12) {
    gaps.push({
      code: "AUTH_SCOPE",
      question: "Should access be authenticated, and who may use the feature?",
      severity: "IMPORTANT",
    });
  }

  const mentionsVisibility = /(공개|비공개|private|public|권한|역할|host|participant|참여자)/iu.test(normalizedText);
  if (!mentionsVisibility && /(화상회의|회의|meeting|collabor)/iu.test(normalizedText)) {
    gaps.push({
      code: "VISIBILITY_OR_ROLES",
      question: "Are meeting rooms public or private? Are host vs participant roles defined?",
      severity: "INFO",
    });
  }

  const mentionsScreens = /(화면|스크린|screen|페이지|page|목록|list|상세|detail)/iu.test(normalizedText);
  const explicitListDetailIntent =
    /(목록|리스트|list)/iu.test(normalizedText) && /(상세|detail)/iu.test(normalizedText);
  if (!gaps.some((x) => x.code === "LIST_DETAIL_SCREENS")) {
    if (explicitListDetailIntent) {
      gaps.push({
        code: "LIST_DETAIL_SCREENS",
        question: "Confirm separate list vs detail navigation for the described browse flow.",
        severity: "INFO",
      });
    } else if (!mentionsScreens && drafts.length >= 2) {
      gaps.push({
        code: "LIST_DETAIL_SCREENS",
        question: "Do you need separate list vs detail screens for any of these requirements?",
        severity: "INFO",
      });
    }
  }

  return gaps;
}
