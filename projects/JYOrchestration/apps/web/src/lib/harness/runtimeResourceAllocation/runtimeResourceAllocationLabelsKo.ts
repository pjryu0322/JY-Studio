/**
 * H21.5 — allocation planning **표시 라벨**(read-only).
 */

import type { RuntimeAllocationMode } from "./runtimeResourceAllocationTypes";

export const RUNTIME_RESOURCE_ALLOCATION_SECTION_DISCLAIMER_KO =
  "본 계층은 실제 리소스 할당·토큰 한도·컨텍스트 프루닝·실행 큐 제어를 수행하지 않으며, governance·resource 메타를 읽기 전용 allocation planning으로 해석합니다.";

export const RUNTIME_ALLOCATION_MODE_LABEL_KO: Readonly<Record<RuntimeAllocationMode, string>> = {
  not_needed: "할당 불필요(관측)",
  planning_only: "Planning 전용 권고",
  dry_run_candidate: "Dry-run 후보(실행 없음)",
  blocked_by_governance: "Governance에 의해 차단",
};
