import {
  ESTIMATED_SIZES,
  EXECUTION_TASK_KINDS,
  MIN_INPUT_OUTPUT_LEN,
  MIN_TASK_TITLE_LEN,
  type GeneratedExecutionTask,
  TASK_PRIORITIES,
} from "@/lib/project-spec/generatedExecutionTask";

export type TaskValidationResult = {
  ok: boolean;
  errors: string[];
};

function normalizeTitleKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 방향 그래프에서 순환 탐지 (DFS) */
function hasCycle(ids: Set<string>, adj: Map<string, string[]>): boolean {
  const visiting = new Set<string>();
  const done = new Set<string>();

  function visit(u: string): boolean {
    if (done.has(u)) return false;
    if (visiting.has(u)) return true;
    visiting.add(u);
    for (const v of adj.get(u) ?? []) {
      if (visit(v)) return true;
    }
    visiting.delete(u);
    done.add(u);
    return false;
  }

  for (const id of ids) {
    if (visit(id)) return true;
  }
  return false;
}

/** 무방향 연결성: 의존성 간선으로 연결된 컴포넌트가 하나인지 */
function isWeaklyConnected(ids: Set<string>, edges: Array<[string, string]>): boolean {
  if (ids.size <= 1) return true;
  const adj = new Map<string, Set<string>>();
  for (const id of ids) adj.set(id, new Set());
  for (const [a, b] of edges) {
    if (!ids.has(a) || !ids.has(b)) continue;
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const start = [...ids][0];
  const q = [start];
  const seen = new Set<string>([start]);
  while (q.length) {
    const u = q.pop()!;
    for (const v of adj.get(u) ?? []) {
      if (!seen.has(v)) {
        seen.add(v);
        q.push(v);
      }
    }
  }
  return seen.size === ids.size;
}

export function validateGeneratedExecutionTasks(tasks: GeneratedExecutionTask[]): TaskValidationResult {
  const errors: string[] = [];

  if (tasks.length < 3 || tasks.length > 7) {
    errors.push(`Task 개수는 3~7개여야 합니다 (현재 ${tasks.length}).`);
  }

  const idSet = new Set(tasks.map((t) => t.localId));
  if (idSet.size !== tasks.length) {
    errors.push("localId가 중복되었습니다.");
  }

  const titleKeys = new Map<string, number>();
  for (const t of tasks) {
    const k = normalizeTitleKey(t.title);
    titleKeys.set(k, (titleKeys.get(k) ?? 0) + 1);
  }
  for (const [k, c] of titleKeys) {
    if (c > 1) errors.push(`제목이 중복됩니다: "${k.slice(0, 60)}…"`);
  }

  for (const t of tasks) {
    if (t.title.trim().length < MIN_TASK_TITLE_LEN) {
      errors.push(`제목이 너무 짧거나 모호합니다 (최소 ${MIN_TASK_TITLE_LEN}자): ${t.localId}`);
    }
    if (!t.description?.trim() || t.description.trim().length < 20) {
      errors.push(`설명이 충분하지 않습니다: ${t.localId}`);
    }
    if (t.input.trim().length < MIN_INPUT_OUTPUT_LEN) {
      errors.push(`input이 비어 있거나 너무 짧습니다: ${t.localId}`);
    }
    if (t.output.trim().length < MIN_INPUT_OUTPUT_LEN) {
      errors.push(`output이 비어 있거나 너무 짧습니다: ${t.localId}`);
    }
    if (t.acceptanceCriteria.length < 3 || t.acceptanceCriteria.length > 5) {
      errors.push(`acceptanceCriteria는 3~5개여야 합니다: ${t.localId}`);
    }
    for (const c of t.acceptanceCriteria) {
      if (String(c).trim().length < 8) {
        errors.push(`수용 기준 항목이 너무 짧습니다: ${t.localId}`);
      }
    }
    if (!ESTIMATED_SIZES.includes(t.estimatedSize)) {
      errors.push(`estimatedSize 오류: ${t.localId}`);
    }
    if (!TASK_PRIORITIES.includes(t.priority)) {
      errors.push(`priority는 P0/P1/P2여야 합니다: ${t.localId}`);
    }
    if (!EXECUTION_TASK_KINDS.includes(t.taskKind)) {
      errors.push(`taskKind 오류: ${t.localId}`);
    }
    for (const d of t.dependsOn) {
      if (!idSet.has(d)) {
        errors.push(`dependsOn이 알 수 없는 localId를 참조합니다: ${t.localId} → ${d}`);
      }
      if (d === t.localId) {
        errors.push(`자기 자신을 dependsOn 할 수 없습니다: ${t.localId}`);
      }
    }
  }

  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(t.localId, [...t.dependsOn]);
  }
  if (idSet.size > 0 && hasCycle(idSet, adj)) {
    errors.push("Task 의존성에 순환이 있습니다.");
  }

  const undirectedEdges: Array<[string, string]> = [];
  for (const t of tasks) {
    for (const d of t.dependsOn) {
      undirectedEdges.push([t.localId, d]);
    }
  }
  if (tasks.length > 1 && !isWeaklyConnected(idSet, undirectedEdges)) {
    errors.push("고립된 Task가 있거나 서로 분리된 그룹이 있습니다. 단일 DAG로 연결되어야 합니다.");
  }

  if (tasks.length > 1) {
    const roots = tasks.filter((t) => t.dependsOn.length === 0);
    if (roots.length === 0) {
      errors.push("의존성이 없는 루트 Task가 최소 1개 필요합니다.");
    }
    if (roots.length > 1) {
      errors.push("루트 Task는 1개만 허용됩니다 (API/계약 정의 등 단일 진입점).");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function buildFallbackExecutionTasks(feature: {
  title: string;
  description: string;
  priority: string;
}): GeneratedExecutionTask[] {
  const t0 = "t-contract";
  const t1 = "t-impl";
  const t2 = "t-test";
  const p: "P0" | "P1" | "P2" =
    String(feature.priority).toUpperCase() === "HIGH" || String(feature.priority).toUpperCase() === "P0"
      ? "P0"
      : String(feature.priority).toUpperCase() === "LOW" || String(feature.priority).toUpperCase() === "P2"
        ? "P2"
        : "P1";
  return [
    {
      localId: t0,
      dependsOn: [],
      title: `${feature.title.slice(0, 70)} — API/데이터 계약 및 스키마 정의 (자동 폴백)`,
      description: `${feature.description.slice(0, 400)}\n\n[자동 폴백] 검증 실패 시 최소 DAG(계약→구현→테스트)로 생성되었습니다.`,
      input: "Project Spec, Feature 설명, 기존 API/DB 규칙",
      output: "명시된 요청/응답 형식, 에러 코드, DB 마이그레이션 초안 또는 인터페이스 정의 문서",
      acceptanceCriteria: [
        "요청·응답 필드가 스펙과 모순되지 않는다",
        "에러 응답 규칙이 문서화된다",
        "리뷰어가 구현에 착수할 수 있는 수준의 계약이 있다",
      ],
      estimatedSize: "M",
      priority: p,
      taskKind: "api",
    },
    {
      localId: t1,
      dependsOn: [t0],
      title: `${feature.title.slice(0, 70)} — 비즈니스 로직 및 연동 구현 (자동 폴백)`,
      description: "정의된 계약에 따라 서비스 로직과 저장소/외부 연동을 구현한다.",
      input: "확정된 API 계약, 환경 설정, 테스트 더블(필요 시)",
      output: "배포 가능한 코드 변경(커밋), 로컬에서 검증 가능한 동작",
      acceptanceCriteria: [
        "계약에 맞는 성공·실패 경로가 구현된다",
        "로깅/관측 가능한 지점이 최소 1곳 이상 있다",
        "보안상 민감 데이터가 로그에 노출되지 않는다",
      ],
      estimatedSize: "L",
      priority: p === "P0" ? "P0" : "P1",
      taskKind: "logic",
    },
    {
      localId: t2,
      dependsOn: [t1],
      title: `${feature.title.slice(0, 60)} — 테스트 및 회귀 검증 (자동 폴백)`,
      description: "구현에 대한 자동/수동 테스트를 추가하고 회귀를 확인한다.",
      input: "구현 브랜치, 계약 문서, 샘플 페이로드",
      output: "통과한 테스트 근거(명령/리포트), 알려진 한계 목록",
      acceptanceCriteria: [
        "핵심 경로 테스트가 CI 또는 로컬에서 통과한다",
        "실패 시 재현 절차가 남는다",
        "회귀 범위가 한 줄 이상 요약된다",
      ],
      estimatedSize: "S",
      priority: "P1",
      taskKind: "test",
    },
  ];
}
