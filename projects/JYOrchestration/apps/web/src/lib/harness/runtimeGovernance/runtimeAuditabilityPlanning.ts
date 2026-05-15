/**
 * H10.5 — **감사 추적 계획** 메타데이터(read-only). 실제 audit log 저장 없음.
 */

import type { RuntimeAuditabilitySummary } from "./runtimeGovernanceTypes";

const DISCLAIMER =
  "아래는 향후 감사·재현을 위해 추적하면 좋은 이벤트 유형입니다. 본 응답은 저장·전송·실행을 수행하지 않습니다.";

export function buildRuntimeAuditabilitySummary(): RuntimeAuditabilitySummary {
  return {
    mode: "auditability_planning_only",
    actualAuditPersistenceEnabled: false,
    disclaimerKo: DISCLAIMER,
    plannedTraceTargets: [
      {
        kind: "prompt_assembly",
        labelKo: "프롬프트 조립(assembly) 결정",
        planningNoteKo: "역할·컨텍스트 선택 근거를 타임라인/메타에 남길지 운영 정책으로 정의.",
      },
      {
        kind: "provider_selection",
        labelKo: "프로바이더·모델 선택",
        planningNoteKo: "정책 힌트 대비 실제 요청 파라미터 불일치 여부를 추적 후보로 둠.",
      },
      {
        kind: "operator_override",
        labelKo: "운영자 override·수동 분기",
        planningNoteKo: "자동 경로와 다른 수동 조치가 있었다면 요약 필드로 기록할지 설계.",
      },
      {
        kind: "rollback_request",
        labelKo: "롤백 요청·시험 중단",
        planningNoteKo: "시험 단계·시점·담당을 메타로 묶어 사후 감사 가능하게 할지 계획.",
      },
      {
        kind: "execution_safety",
        labelKo: "실행 안전(review/routing safety)",
        planningNoteKo: "라우팅·리뷰 하네스 요약과 경고 코드를 동일 상관 ID로 엮을지 정의.",
      },
    ],
  };
}

export function serializeRuntimeAuditabilitySummaryForDiagnostic(
  summary: RuntimeAuditabilitySummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualAuditPersistenceEnabled: summary.actualAuditPersistenceEnabled,
    disclaimerKo: summary.disclaimerKo,
    plannedTraceTargets: summary.plannedTraceTargets.map((r) => ({
      kind: r.kind,
      labelKo: r.labelKo,
      planningNoteKo: r.planningNoteKo,
    })),
  };
}
