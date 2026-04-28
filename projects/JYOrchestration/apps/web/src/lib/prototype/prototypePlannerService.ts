import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

export type PrototypePlannerTask = Readonly<{ order: number; title: string }>;

export function planPrototypeTasks(input: {
  selectedTemplate: string;
  promptSnapshot: string;
}): { tasks: PrototypePlannerTask[] } {
  const tpl = String(input.selectedTemplate ?? "").trim();
  const snap = String(input.promptSnapshot ?? "");
  const lower = `${tpl}\n${snap}`.toLowerCase();

  // MVP: deterministic task lists per template/keywords.
  const meetingSignals = /meeting-workspace|회의록|녹취|음성파일|화자|화자분리|스크립트|stt|전사/.test(lower);
  if (tpl === "meeting-workspace" || meetingSignals) {
    return {
      tasks: [
        { order: 1, title: "기본 레이아웃(3컬럼 워크스페이스) 생성" },
        { order: 2, title: "좌측 회의 파일 목록/참여자·화자/상태 패널" },
        { order: 3, title: "중앙 업로드 카드 + 타임라인 + 메시지 입력" },
        { order: 4, title: "우측 요약본 탭(핵심 안건/결정/할 일)" },
        { order: 5, title: "우측 스크립트 탭(화자별 발언 목록) + 탭 전환" },
        { order: 6, title: "반응형/레이아웃 정리 및 카드 UI polish" },
        { order: 7, title: "정적 배포 가이드(예: GitHub Pages) + README" },
      ],
    };
  }

  // Generic fallback
  return {
    tasks: [
      { order: 1, title: "기본 페이지/라우팅/레이아웃 생성" },
      { order: 2, title: "핵심 화면 UI 구성(리스트/상세/폼)" },
      { order: 3, title: "Mock 데이터 및 상호작용(필터/탭/모달 등)" },
      { order: 4, title: "반응형/접근성/스타일 정리" },
      { order: 5, title: "README 및 실행/배포 안내" },
    ],
  };
}

export function cursorTaskProgressFromRun(run: PrototypeRun): { current: number; total: number } | null {
  const total = run.plannerTasks?.length ? run.plannerTasks.length : 0;
  if (!total) return null;
  const s = run.status;
  if (s === "CURSOR_REQUESTED" || s === "CURSOR_RUNNING") return { current: 1, total };
  if (s === "COMMIT_DETECTED" || s === "PUSH_CONFIRMED" || s === "AI_REVIEWING" || s === "PR_OPENED" || s === "MERGED" || s === "PREVIEW_READY")
    return { current: total, total };
  return { current: 0, total };
}

