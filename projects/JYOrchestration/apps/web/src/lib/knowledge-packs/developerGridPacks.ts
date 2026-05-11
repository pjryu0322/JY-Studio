import type { KnowledgePack, KnowledgePackAgent } from "@/lib/knowledge-packs/types";

const PACK_AG_GRID: KnowledgePack = {
  id: "grid.ag-grid-community",
  name: "AG Grid Community",
  version: "1.0.0",
  scope: "PLATFORM",
  category: "GRID",
  agents: ["AI_DEVELOPER"],
  status: "ACTIVE",
  summary:
    "업무용 데이터 그리드 구현에 적합한 MIT 라이선스 기반 Grid 라이브러리입니다. 정렬, 필터, 페이지네이션, 행 선택 등 일반적인 업무용 목록 화면 구현에 적합합니다. 단, Enterprise 전용 기능과 Community 기능을 구분해야 합니다.",
  license: {
    type: "MIT",
    notes: [
      "AG Grid Community와 AG Grid Enterprise 기능을 혼동하면 안 된다.",
      "ag-grid-enterprise 패키지를 임의로 import하면 안 된다.",
      "Enterprise 전용 기능이 필요한 경우 사용자에게 별도 라이선스 필요성을 안내해야 한다.",
    ],
  },
  recommendedUseCases: [
    "업무용 목록 화면이 필요한 경우",
    "정렬, 필터, 페이지네이션, 행 선택이 필요한 경우",
    "단순 HTML table보다 실제 업무 시스템에 가까운 Grid UX가 필요한 경우",
    "IBSheet 등 상용 Grid 대체 후보가 필요한 경우",
    "React 기반 프로토타입에서 빠르게 Grid를 구성해야 하는 경우",
  ],
  notRecommendedUseCases: [
    "Enterprise 전용 기능이 필수인 경우",
    "피벗, 고급 그룹핑, 마스터-디테일, 고급 Excel 기능 등이 명확히 필요한 경우",
    "라이선스 경계가 불명확한 기능을 요구하는 경우",
  ],
  capabilities: [
    "컬럼 기반 데이터 표시",
    "정렬",
    "필터",
    "페이지네이션",
    "행 선택",
    "셀 편집 일부 구현 가능",
    "React 연동",
    "업무용 Grid UX 구현에 적합",
  ],
  constraints: [
    "AG Grid Community와 AG Grid Enterprise 기능을 혼동하면 안 된다.",
    "ag-grid-enterprise 패키지를 임의로 import하면 안 된다.",
    "Enterprise 전용 기능이 필요한 경우 사용자에게 별도 라이선스 필요성을 안내해야 한다.",
  ],
  implementationGuidelines: [
    "단순 HTML table 대신 업무용 Grid 컴포넌트로 구현한다.",
    "Community 기능 범위 안에서 정렬, 필터, 페이지네이션, 행 선택을 구현한다.",
    "프로토타입에는 테스트 데이터와 상태 컬럼을 포함한다.",
    "조회 조건 영역과 Grid 영역을 분리해 업무용 화면처럼 구성한다.",
    "대량 데이터처럼 보이도록 충분한 샘플 데이터를 제공한다.",
    "Enterprise 기능으로 의심되는 기능은 임의 구현하지 않고 주석 또는 안내로 분리한다.",
  ],
  cursorPromptRules: [
    "AG Grid Community를 사용한다는 점을 명확히 적는다.",
    "ag-grid-enterprise 사용 금지를 명시한다.",
    "정렬/필터/페이지네이션/행 선택/상태 컬럼을 구현 대상으로 명시한다.",
    "단순 table 구현 금지를 명시한다.",
    "Enterprise 기능 요구가 있는 경우 구현하지 말고 별도 안내하도록 지시한다.",
  ],
  forbiddenPatterns: [
    "ag-grid-enterprise 직접 import 금지",
    "Enterprise 기능을 Community 기능처럼 설명 금지",
    "라이선스 키 하드코딩 금지",
    "단순 HTML table로 대체 구현 금지",
  ],
  reviewChecklist: [
    "Community 패키지만 사용했는가?",
    "Enterprise import가 없는가?",
    "단순 HTML table이 아닌 Grid 컴포넌트로 구현했는가?",
    "정렬/필터/페이지네이션/행 선택이 동작하는가?",
    "테스트 데이터와 운영 데이터가 분리되어 있는가?",
    "라이선스 키가 코드에 하드코딩되어 있지 않은가?",
  ],
  alternatives: [
    "UI 자유도가 더 중요하면 TanStack Table 기반 JY Basic Grid를 고려한다.",
    "Vanilla JS 기반 독립형 Grid가 필요하면 Tabulator를 고려한다.",
    "상용 Grid가 필요하고 사용자가 라이선스를 보유한 경우 IBSheet 등 벤더 제품을 별도 검토한다.",
  ],
  references: [
    { label: "AG Grid 공식", url: "https://www.ag-grid.com/" },
    { label: "AG Grid Community License", url: "https://www.ag-grid.com/eula/AG-Grid-Community-License.html" },
  ],
};

const PACK_TANSTACK: KnowledgePack = {
  id: "grid.tanstack-table",
  name: "TanStack Table",
  version: "1.0.0",
  scope: "PLATFORM",
  category: "GRID",
  agents: ["AI_DEVELOPER"],
  status: "ACTIVE",
  summary:
    "TanStack Table은 완성형 UI Grid가 아니라 headless table engine입니다. 정렬, 필터, 페이지네이션, 행 선택 등 테이블 상태와 로직을 제공하며, UI는 플랫폼이 직접 구현해야 합니다. JY Basic Grid 같은 자체 표준 업무용 Grid를 만들 때 적합합니다.",
  license: {
    type: "OPEN_SOURCE",
    notes: ["오픈소스 라이선스로 일반적인 상용 라이선스 리스크가 낮다."],
  },
  recommendedUseCases: [
    "JYOrchestration 자체 표준 Grid를 만들고 싶은 경우",
    "UI 스타일을 플랫폼 디자인 시스템에 맞추고 싶은 경우",
    "React 상태관리와 테이블 로직을 세밀하게 제어하고 싶은 경우",
    "라이선스 리스크 없는 기본 업무용 Grid가 필요한 경우",
    "단순 목록이 아니라 정렬/필터/페이지네이션이 필요한 경우",
  ],
  notRecommendedUseCases: [
    "완성형 Grid UI를 즉시 사용해야 하는 경우",
    "복잡한 Grid 기능을 직접 구현할 여력이 없는 경우",
    "비개발자가 바로 인식할 수 있는 상용 Grid 수준의 내장 UI가 필요한 경우",
  ],
  capabilities: [
    "Headless table engine",
    "정렬 상태 관리",
    "필터 상태 관리",
    "페이지네이션",
    "행 선택",
    "컬럼 정의",
    "React 등 다양한 프레임워크 지원",
    "커스텀 UI 구현에 적합",
  ],
  constraints: [
    "TanStack Table은 UI 컴포넌트가 아니다.",
    "Grid처럼 보이게 하려면 테이블 UI, 버튼, 필터, 페이지네이션, 상태 표시를 직접 구현해야 한다.",
    "단순 map 렌더링과 혼동하면 안 된다.",
  ],
  implementationGuidelines: [
    "TanStack Table은 UI 컴포넌트가 아니라 headless table engine으로 사용한다.",
    "JY Basic Grid를 만들 때 내부 테이블 로직으로 사용한다.",
    "정렬, 필터, 페이지네이션, 행 선택 상태를 명시적으로 구현한다.",
    "화면 스타일은 JYOrchestration 공통 UI 규칙을 따른다.",
    "업무용 Grid처럼 보이도록 조회 조건, compact row, 상태 컬럼, 액션 버튼을 포함한다.",
    "접근성을 고려해 키보드 포커스와 버튼 레이블을 명확히 한다.",
  ],
  cursorPromptRules: [
    "TanStack Table을 headless table engine으로 사용한다고 명시한다.",
    "UI는 JYOrchestration 공통 컴포넌트/스타일로 직접 구현하도록 지시한다.",
    "정렬/필터/페이지네이션/행 선택 상태 구현을 명시한다.",
    "단순 배열 map 렌더링으로 끝내지 말라고 명시한다.",
    "업무용 Grid UX를 위해 조회 조건 영역과 결과 Grid 영역을 분리하도록 지시한다.",
  ],
  forbiddenPatterns: [
    "TanStack Table을 완성형 UI Grid처럼 설명 금지",
    "정렬/필터/페이지네이션 없이 단순 map으로 테이블만 렌더링 금지",
    "접근성 없는 클릭 전용 테이블 구현 금지",
    "공통 UI 스타일과 무관한 임의 스타일 난립 금지",
  ],
  reviewChecklist: [
    "TanStack Table을 headless engine으로 올바르게 사용했는가?",
    "정렬/필터/페이지네이션 상태가 구현되어 있는가?",
    "단순 table map 렌더링으로 끝나지 않았는가?",
    "JYOrchestration 공통 UI 스타일을 따르는가?",
    "업무용 화면처럼 조회 조건과 결과 영역이 분리되어 있는가?",
    "접근성 기본 요소가 반영되어 있는가?",
  ],
  alternatives: [
    "빠르게 완성형 Grid가 필요하면 AG Grid Community를 고려한다.",
    "Vanilla JS 중심의 내장 기능 많은 Grid가 필요하면 Tabulator를 고려한다.",
    "플랫폼 표준 Grid를 장기적으로 구축하려면 TanStack Table 기반 JY Basic Grid가 적합하다.",
  ],
  references: [{ label: "TanStack Table", url: "https://tanstack.com/table/latest" }],
};

const PACK_TABULATOR: KnowledgePack = {
  id: "grid.tabulator",
  name: "Tabulator",
  version: "1.0.0",
  scope: "PLATFORM",
  category: "GRID",
  agents: ["AI_DEVELOPER"],
  status: "ACTIVE",
  summary:
    "Tabulator는 MIT 라이선스 기반의 오픈소스 JavaScript 데이터 Grid 라이브러리입니다. 정렬, 그룹핑, Ajax, 편집, Virtual DOM 등 다양한 내장 기능을 제공하며, Vanilla JS 중심으로 빠르게 데이터 Grid를 구성할 수 있습니다. React 프로젝트에서는 컴포넌트 생명주기와 DOM 직접 제어 충돌을 주의해야 합니다.",
  license: {
    type: "MIT",
    notes: ["MIT 라이선스 — 상업적 사용 전 라이선스 문서를 확인한다."],
  },
  recommendedUseCases: [
    "Vanilla JS 성향의 독립형 Grid가 필요한 경우",
    "내장 기능이 풍부한 오픈소스 Grid가 필요한 경우",
    "빠르게 정렬/필터/편집 가능한 Grid를 구성해야 하는 경우",
    "React 외 환경에서도 재사용 가능한 Grid 후보가 필요한 경우",
  ],
  notRecommendedUseCases: [
    "React 상태관리와 완전히 일체화된 구조가 중요한 경우",
    "JYOrchestration 공통 컴포넌트 체계 안에서 세밀하게 제어해야 하는 경우",
    "DOM 직접 제어를 최소화해야 하는 화면인 경우",
  ],
  capabilities: [
    "데이터 Grid",
    "정렬",
    "필터",
    "그룹핑",
    "Ajax 데이터 로딩",
    "셀 편집",
    "Virtual DOM",
    "다양한 포맷터",
    "Vanilla JS 중심 사용",
  ],
  constraints: [
    "React 프로젝트에서는 Tabulator 인스턴스 생성/해제 시점을 명확히 관리해야 한다.",
    "컴포넌트 렌더링마다 인스턴스를 중복 생성하면 안 된다.",
    "DOM 직접 조작이 React 상태와 충돌하지 않도록 해야 한다.",
    "CDN 스크립트를 임의 삽입하지 말고 패키지 의존성 방식을 우선 검토한다.",
  ],
  implementationGuidelines: [
    "Tabulator는 내장 기능이 풍부한 JS 데이터 Grid로 사용한다.",
    "React 프로젝트에서는 useEffect 등으로 초기화/해제 로직을 명확히 분리한다.",
    "데이터 변경 시 React 상태 변경과 Tabulator 인스턴스 업데이트 방식을 구분한다.",
    "컴포넌트 unmount 시 인스턴스를 정리한다.",
    "공통 UI와 충돌하지 않도록 Grid 영역을 명확히 캡슐화한다.",
  ],
  cursorPromptRules: [
    "Tabulator 사용 시 React 생명주기 관리 주의사항을 명시한다.",
    "인스턴스 중복 생성 금지를 명시한다.",
    "초기화/해제 로직을 분리하도록 지시한다.",
    "CDN 스크립트 직접 삽입보다 패키지 기반 사용을 우선하도록 지시한다.",
    "데이터 변경과 Grid 업데이트 방식을 명확히 구현하도록 지시한다.",
  ],
  forbiddenPatterns: [
    "React 렌더링마다 Tabulator 인스턴스 중복 생성 금지",
    "DOM 직접 조작으로 React 상태와 충돌시키는 구현 금지",
    "정리되지 않은 CDN 스크립트 삽입 금지",
    "컴포넌트 unmount 시 인스턴스 정리 누락 금지",
  ],
  reviewChecklist: [
    "Tabulator 인스턴스가 중복 생성되지 않는가?",
    "컴포넌트 unmount 시 정리 로직이 있는가?",
    "React 상태와 Tabulator 데이터 업데이트가 충돌하지 않는가?",
    "CDN 스크립트 직접 삽입이 없는가?",
    "Grid 영역이 공통 UI와 충돌하지 않게 캡슐화되어 있는가?",
  ],
  alternatives: [
    "React 중심 업무용 Grid는 AG Grid Community를 우선 검토한다.",
    "플랫폼 자체 표준 Grid는 TanStack Table 기반 JY Basic Grid를 우선 검토한다.",
    "독립형 JS Grid 또는 내장 기능이 많은 Grid가 필요하면 Tabulator를 검토한다.",
  ],
  references: [
    { label: "Tabulator", url: "https://tabulator.info/" },
    { label: "Tabulator License", url: "https://tabulator.info/docs/6.4/license" },
  ],
};

/** 플랫폼 정적 seed — AI개발자 / Grid (MVP) */
export const DEVELOPER_GRID_KNOWLEDGE_PACKS: readonly KnowledgePack[] = [
  PACK_AG_GRID,
  PACK_TANSTACK,
  PACK_TABULATOR,
];

export function getKnowledgePackById(id: string): KnowledgePack | undefined {
  const q = id.trim();
  return DEVELOPER_GRID_KNOWLEDGE_PACKS.find((p) => p.id === q);
}

export function filterKnowledgePacks(input: {
  readonly agent: KnowledgePack["agents"][number] | "ALL";
  readonly category: KnowledgePack["category"] | "ALL";
}): readonly KnowledgePack[] {
  return DEVELOPER_GRID_KNOWLEDGE_PACKS.filter((p) => {
    if (input.agent !== "ALL" && !p.agents.includes(input.agent)) return false;
    if (input.category !== "ALL" && p.category !== input.category) return false;
    return true;
  });
}

export const KNOWLEDGE_PACK_AGENT_LABEL: Record<KnowledgePackAgent, string> = {
  AI_DEVELOPER: "AI개발자",
  AI_PLANNER: "AI기획자",
  AI_ANALYST: "AI분석가",
  AI_ARCHITECT: "AI설계자",
  AI_DESIGNER: "AI디자이너",
  AI_REVIEWER: "AI검수자",
  AI_SECURITY: "AI보안관",
};

export const KNOWLEDGE_PACK_CATEGORY_LABEL: Record<KnowledgePack["category"], string> = {
  GRID: "Grid",
  AUTH: "인증",
  SECURITY: "보안",
  UI: "UI",
  API: "API",
  DATA: "데이터",
  INTEGRATION: "연동",
};
