/**
 * Deterministic screen role from visible menu/screen title.
 */

import type { ScreenRole } from "./screenGenerationContracts";

export function inferScreenRoleFromMenuName(name: string): ScreenRole {
  const t = name.trim();
  if (/^root$/iu.test(t)) return "GENERAL";
  if (/(목록|리스트|list)\b|조회$/iu.test(t)) return "LIST";
  if (/상세|detail/iu.test(t)) return "DETAIL";
  if (/(생성|작성|등록|create)\s*$/iu.test(t) || /^작성$/u.test(t) || /^생성$/u.test(t)) return "CREATE";
  if (/(수정|편집|edit)/iu.test(t)) return "EDIT";
  if (/(로그인|sign\s*in|login|welcome|시작)/iu.test(t)) return "ENTRY";
  return "GENERAL";
}
