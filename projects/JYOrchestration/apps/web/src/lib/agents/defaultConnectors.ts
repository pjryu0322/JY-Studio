import type { ConnectorDescriptor } from "@/lib/agents/connectorDescriptorTypes";

export const DEFAULT_CONNECTORS: readonly ConnectorDescriptor[] = [
  {
    id: "cursor",
    type: "cursor",
    name: "Cursor",
    description: "AI개발자의 코드 생성 및 수정 작업을 수행하는 코드어시스턴트 Connector 후보",
    enabled: true,
    authorityProfile: "code-assistant",
  },
  {
    id: "github",
    type: "github",
    name: "GitHub",
    description: "브랜치, 커밋, PR, 리뷰, 머지 상태를 관리하는 SCM Connector 후보",
    enabled: true,
    authorityProfile: "scm",
  },
  {
    id: "codex",
    type: "codex",
    name: "Codex",
    description: "향후 코드 검토 또는 코드 생성에 활용 가능한 Worker Runtime 후보",
    enabled: false,
  },
  {
    id: "copilot",
    type: "copilot",
    name: "Copilot",
    description: "향후 코드 검토 또는 개발 보조에 활용 가능한 Worker Runtime 후보",
    enabled: false,
  },
  {
    id: "openai",
    type: "openai",
    name: "OpenAI",
    description: "LLM Provider Gateway 경유 대화·분석 (기존 facilitator 경로)",
    enabled: true,
    authorityProfile: "llm",
  },
] as const;
