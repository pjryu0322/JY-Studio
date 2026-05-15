/**
 * H10 — 런타임 **시뮬레이션 메타데이터**(항상 dry-run, 실행 없음).
 */

import type { RuntimeSimulationSummary } from "./runtimeTrialTypes";

export function buildRuntimeSimulationSummary(): RuntimeSimulationSummary {
  return {
    mode: "dry_run_simulation_metadata_only",
    disclaimerKo:
      "아래는 통제 시험을 가정한 메타데이터 표시입니다. 토큰·프로바이더·라우팅·프루닝·Cursor 실행은 자동으로 수행되지 않습니다.",
    simulatedActions: [
      { labelKo: "토큰 예산 강제 적용", wouldOccur: false },
      { labelKo: "프로바이더 라우팅 전환", wouldOccur: false },
      { labelKo: "실행 라우팅 실제 반영", wouldOccur: false },
      { labelKo: "컨텍스트 자동 프루닝", wouldOccur: false },
      { labelKo: "검색 오케스트레이션 실제 실행", wouldOccur: false },
      { labelKo: "Cursor 에이전트 자동 실행", wouldOccur: false },
    ],
  };
}

/** 진단 API용 직렬화(breaking change 없음). */
export function serializeRuntimeSimulationSummaryForDiagnostic(
  summary: RuntimeSimulationSummary
): Readonly<{
  mode: RuntimeSimulationSummary["mode"];
  disclaimerKo: string;
  simulatedActions: ReadonlyArray<{ labelKo: string; wouldOccur: false }>;
}> {
  return {
    mode: summary.mode,
    disclaimerKo: summary.disclaimerKo,
    simulatedActions: summary.simulatedActions.map((a) => ({ labelKo: a.labelKo, wouldOccur: a.wouldOccur })),
  };
}
