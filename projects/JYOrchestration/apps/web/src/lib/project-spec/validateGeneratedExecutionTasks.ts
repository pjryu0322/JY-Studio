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

  if (tasks.length < 4 || tasks.length > 8) {
    errors.push(`Task 개수는 4~8개여야 합니다 (현재 ${tasks.length}).`);
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
  }

  return { ok: errors.length === 0, errors };
}

export function buildFallbackExecutionTasks(feature: {
  title: string;
  description: string;
  priority: string;
}): GeneratedExecutionTask[] {
  const t0 = "T-fb-data";
  const t1 = "T-fb-logic";
  const t2 = "T-fb-api";
  const t3 = "T-fb-test";
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
      title: `${feature.title.slice(0, 60)} — DB 스키마·DTO·데이터 계약 정의 (자동 폴백)`,
      description: `${feature.description.slice(0, 400)}\n\n[자동 폴백] 검증 실패 시 data→logic→api→test 단일 체인으로 생성되었습니다.`,
      input: "Project Spec, Feature 설명, 기존 DB/API 규칙",
      output: "스키마·DTO·요청/응답 필드 정의가 코드 또는 문서로 정리됨",
      acceptanceCriteria: [
        "요청·응답 필드가 스펙과 모순되지 않는다",
        "저장소 스키마 또는 마이그레이션 초안이 식별 가능하다",
        "다음 Task(로직)가 이 계약만으로 구현을 시작할 수 있다",
      ],
      estimatedSize: "M",
      priority: p,
      taskKind: "data",
    },
    {
      localId: t1,
      dependsOn: [t0],
      title: `${feature.title.slice(0, 60)} — 도메인 로직·유효성 검증 구현 (자동 폴백)`,
      description: "확정된 데이터 계약에 따라 서비스·검증 로직과 저장소 연동을 구현한다.",
      input: "데이터 계약(DTO/스키마), 환경 설정",
      output: "커밋 가능한 로직 코드, 로컬에서 검증 가능한 동작",
      acceptanceCriteria: [
        "계약에 맞는 성공·실패 경로가 구현된다",
        "입력 유효성이 명시된 규칙과 일치한다",
        "외부 의존은 인터페이스 뒤에 격리된다",
      ],
      estimatedSize: "L",
      priority: p === "P0" ? "P0" : "P1",
      taskKind: "logic",
    },
    {
      localId: t2,
      dependsOn: [t1],
      title: `${feature.title.slice(0, 60)} — HTTP API·컨트롤러 노출 (자동 폴백)`,
      description: "로직을 REST/JSON 등 API 경계로 노출하고 라우팅·상태코드를 맞춘다.",
      input: "서비스 계약, 라우팅 규칙, 에러 매핑 표",
      output: "호출 가능한 엔드포인트, OpenAPI 또는 동등한 계약 힌트",
      acceptanceCriteria: [
        "엔드포인트가 스펙의 URL·메서드·본문과 일치한다",
        "에러 응답이 공통 규칙을 따른다",
        "인증·권한 훅이 필요 시 연결 지점이 명시된다",
      ],
      estimatedSize: "M",
      priority: p === "P0" ? "P0" : "P1",
      taskKind: "api",
    },
    {
      localId: t3,
      dependsOn: [t2],
      title: `${feature.title.slice(0, 55)} — API·로직 자동 테스트 (자동 폴백)`,
      description: "API 및 핵심 로직에 대한 테스트를 추가하고 회귀를 확인한다.",
      input: "구현 브랜치, 샘플 페이로드, 계약 문서",
      output: "통과한 테스트 근거, 실패 시 재현 절차",
      acceptanceCriteria: [
        "핵심 성공·실패 경로가 테스트로 검증된다",
        "CI 또는 로컬에서 재현 가능한 명령이 남는다",
        "회귀 범위가 한 줄 이상 요약된다",
      ],
      estimatedSize: "S",
      priority: "P1",
      taskKind: "test",
    },
  ];
}
