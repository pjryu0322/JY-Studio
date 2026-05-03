import { isLegacyRolePlanningSlot } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

/** 업무 절차형으로 보이는 상위 영역 제목(슬롯명) 패턴 — 한글 UI 기준 */
const PROCESS_STEP_TITLE_RE =
  /업로드|다운로드|승인|변환|검토|요청|공유|분리|파싱|녹취|화자|텍스트\s*변환|오디오|전송|초안\s*생성|회의록\s*초안|최종\s*승인|처리\s*상태|대기\s*열/;

/**
 * 예전 생성본처럼 **연속 업무 단계**가 상위 영역(slotName)으로 잡혔는지 휴리스틱으로 추정한다.
 * (사용자에게는 내부 용어를 노출하지 않고, 재생성 권장 배너에만 사용)
 */
export function detectLikelyProcessStepPlanningArtifact(artifact: FeaturePlanningSlotsArtifactV1 | null): boolean {
  if (!artifact?.slots?.length) return false;
  if (artifact.slots.length <= 6) return false;
  let hit = 0;
  for (const s of artifact.slots) {
    if (isLegacyRolePlanningSlot(s)) continue;
    const n = (s.slotName ?? "").trim();
    if (n && PROCESS_STEP_TITLE_RE.test(n)) hit += 1;
  }
  return hit >= 2;
}
