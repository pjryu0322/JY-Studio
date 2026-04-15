export type RequirementStatus = "DRAFT" | "IN_DISCUSSION" | "APPROVED" | "DONE";

export type RequirementMock = {
  id: string;
  title: string;
  description: string;
  status: RequirementStatus;
  sessionCount: number;
  featureCount: number;
};

export type CollaborationSessionMock = {
  id: string;
  requirementId: string;
  title: string;
  createdAt: string;
  status: "OPEN" | "CLOSED";
};

export type MeetingMinutesMock = {
  summary: string;
  decisions: string[];
  pending: string[];
  excluded: string[];
};

export type FeatureMock = {
  id: string;
  name: string;
  description: string;
  status: "DRAFT" | "PLANNED" | "IN_PROGRESS" | "DONE";
  userFlow: string[];
  nonFunctional: string[];
};

export const mockRequirements: RequirementMock[] = [
  {
    id: "req-101",
    title: "프로젝트 온보딩 워크플로",
    description: "프로젝트를 만들고 멤버를 초대하며 첫 협업 세션을 시작하기 쉽게 만든다.",
    status: "IN_DISCUSSION",
    sessionCount: 2,
    featureCount: 4,
  },
  {
    id: "req-102",
    title: "회의록과 파생 기능",
    description: "회의록을 남기고 실행 계획을 위한 기능 목록을 정리한다.",
    status: "DRAFT",
    sessionCount: 1,
    featureCount: 2,
  },
  {
    id: "req-103",
    title: "실행 준비 상태 가시성",
    description: "작업과 기능에서 준비됨·차단됨·이유를 한눈에 보여준다.",
    status: "APPROVED",
    sessionCount: 3,
    featureCount: 6,
  },
];

export const mockSessions: CollaborationSessionMock[] = [
  {
    id: "sess-201",
    requirementId: "req-101",
    title: "킥오프: 온보딩 흐름",
    createdAt: "2026-04-07",
    status: "OPEN",
  },
  {
    id: "sess-202",
    requirementId: "req-101",
    title: "후속: 권한과 초대 UX",
    createdAt: "2026-04-06",
    status: "CLOSED",
  },
  {
    id: "sess-203",
    requirementId: "req-102",
    title: "회의록 구조와 기능 추출",
    createdAt: "2026-04-05",
    status: "OPEN",
  },
];

export function getMockRequirement(id: string): RequirementMock | null {
  return mockRequirements.find((r) => r.id === id) ?? null;
}

export function getMockSessionsForRequirement(requirementId: string): CollaborationSessionMock[] {
  return mockSessions.filter((s) => s.requirementId === requirementId);
}

export function getMockSession(id: string): CollaborationSessionMock | null {
  return mockSessions.find((s) => s.id === id) ?? null;
}

export function getMockMinutesForSession(sessionId: string): MeetingMinutesMock {
  return {
    summary:
      sessionId === "sess-201"
        ? "온보딩 단계를 맞추고 담당과 다음 마일스톤을 정리했다."
        : "논의 요약을 기록했고, 다음 반복에서 다룰 보류 항목을 식별했다.",
    decisions: [
      "요구사항 → 세션 → 회의록 → 기능으로 이어지는 단일 진입 흐름을 사용한다.",
      "지금은 자리 표시자로 두고, 다음 단계에서 백엔드를 연동한다.",
    ],
    pending: ["탭 내비게이션과 딥링크를 확정한다.", "기능 상태와 작업 매핑을 정의한다."],
    excluded: ["이 단계에서는 AI 자동화 없음.", "백엔드 오케스트레이션 변경 없음."],
  };
}

export function getMockFeaturesForSession(sessionId: string): FeatureMock[] {
  const base: FeatureMock[] = [
    {
      id: "feat-301",
      name: "요구사항 워크스페이스 뼈대",
      description: "워크플로를 시각화할 수 있는 탐색 가능한 페이지와 탭을 제공한다.",
      status: "IN_PROGRESS",
      userFlow: ["요구사항 목록 열기", "요구사항 상세 열기", "회의록·기능 탭 이동"],
      nonFunctional: ["런타임 오류 없음", "최소 UX, 리디자인 없음"],
    },
    {
      id: "feat-302",
      name: "협업 워크스페이스 레이아웃",
      description: "논의 타임라인과 요약 패널, 세션 하이라이트를 외부 도구로 동기화하기 위한 훅.",
      status: "PLANNED",
      userFlow: ["세션 열기", "논의 항목 추가", "회의록 요약 검토"],
      nonFunctional: ["경량 로컬 상태만", "이 단계에서는 파트너 연동 스텁만"],
    },
  ];
  if (sessionId === "sess-201") return base;
  return [
    ...base,
    {
      id: "feat-303",
      name: "회의록 패널",
      description: "재사용 가능한 회의록 패널(요약·결정·보류·제외).",
      status: "IN_PROGRESS",
      userFlow: ["세션에서 회의록 보기", "요구사항 상세에서 회의록 보기"],
      nonFunctional: ["재사용 컴포넌트", "지금은 목 데이터"],
    },
  ];
}
