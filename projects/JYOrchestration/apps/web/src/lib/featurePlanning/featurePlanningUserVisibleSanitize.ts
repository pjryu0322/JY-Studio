/**
 * 기능 정리 채팅에 노출되는 한글에서 내부 용어·구버전 문구를 완화한다.
 * (DB에 남은 과거 메시지도 표시 시 정리)
 */
export function sanitizeFeaturePlanningUserVisibleKorean(text: string): string {
  let s = text;
  s = s.replace(/^기능\s*정리\s*단계(?:입니다)?[!。.…\s]*/gim, "");
  s = s.replace(/^기능정리\s*단계(?:입니다)?[!。.…\s]*/gim, "");
  s = s.replace(/다른\s*영역을\s*더\s*자세히\s*편집하려면[^\n.]*정리\s*현황[^\n.]*\.\s*/g, "");
  s = s.replace(/[^\n.]*상단\s*진행도(?:로|에서)[^\n.]*정리\s*현황[^\n.]*\.\s*/g, "");
  s = s.replace(/목록을\s*직접\s*고치려면[^\n.]*정리\s*현황[^\n.]*\.\s*/g, "");
  s = s.replace(/\(나머지\s*영역의\s*항목은\s*여기서\s*한꺼번에\s*펼치지\s*않습니다\.\s*상단\s*진행도로\s*정리\s*현황을\s*열거나,[^\)]*\)\s*/g, "");
  s = s.replace(/기능\s*정리\s*슬롯이/g, "기능 정리 초안이");
  s = s.replace(/기능\s*정리\s*슬롯을/g, "기능 정리 초안을");
  s = s.replace(/기능\s*정리\s*슬롯/g, "기능 정리 초안");
  s = s.replace(/기능정리\s*슬롯/g, "기능 정리 초안");
  s = s.replace(/\[슬롯\s*다시\s*생성\]/g, "[초안 다시 만들기]");
  s = s.replace(/슬롯/g, "영역");
  return s;
}
