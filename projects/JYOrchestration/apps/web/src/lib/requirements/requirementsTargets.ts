import type { RequirementsMessage, RequirementsMessageTarget } from "@/lib/requirements/requirementsMessage";

/** 질문 대상 멤버 참조(저장·API 공통) */
export type RequirementMemberRef = RequirementsMessageTarget;

export function dedupeMemberRefs(refs: readonly RequirementMemberRef[]): RequirementMemberRef[] {
  const seen = new Set<string>();
  const out: RequirementMemberRef[] = [];
  for (const r of refs) {
    const id = String(r.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = String(r.name ?? "").trim() || id;
    out.push({ id, name });
  }
  return out;
}

export function getMessageTargets(m: RequirementsMessage): RequirementsMessageTarget[] {
  if (Array.isArray(m.targets) && m.targets.length > 0) {
    return dedupeMemberRefs(m.targets);
  }
  const tid = m.targetId != null ? String(m.targetId).trim() : "";
  const tname = m.targetName != null ? String(m.targetName).trim() : "";
  if (tid && tname) return [{ id: tid, name: tname }];
  if (tid) return [{ id: tid, name: tname || tid }];
  return [];
}

/** 채팅 헤더용: "이름" 또는 "이름1, 이름2" */
export function formatTargetNamesForUi(m: RequirementsMessage): string {
  const t = getMessageTargets(m);
  if (!t.length) return "";
  return t.map((x) => x.name).join(", ");
}

/**
 * 입력 텍스트의 @토큰을 참가자 이름과 매칭해 대상 후보를 반환합니다.
 * (이름 전체 일치 > 이름이 토큰으로 시작 > 토큰이 이름 접두로 시작)
 */
export function resolveMentionTargetsFromText(text: string, participants: readonly RequirementMemberRef[]): RequirementMemberRef[] {
  if (!text.trim() || !participants.length) return [];
  const re = /@([^\s@\n]+)/g;
  const found: RequirementMemberRef[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1].trim();
    if (!raw) continue;
    const rl = raw.toLowerCase();
    let best: RequirementMemberRef | null = null;
    let bestScore = 0;
    for (const p of participants) {
      const nl = p.name.trim().toLowerCase();
      if (!nl) continue;
      let score = 0;
      if (nl === rl) score = 100 + nl.length;
      else if (nl.startsWith(rl)) score = 50 + nl.length;
      else if (rl.length >= 2 && nl.startsWith(rl.slice(0, Math.min(rl.length, nl.length)))) score = 20 + nl.length;
      if (score > bestScore) {
        bestScore = score;
        best = { id: p.id, name: p.name.trim() };
      }
    }
    if (best) found.push(best);
  }
  return dedupeMemberRefs(found);
}
