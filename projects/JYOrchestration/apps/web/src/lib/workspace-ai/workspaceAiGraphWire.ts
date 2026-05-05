import type { WorkspaceAiIntegrationCapability, WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

/** 소유자 Integrations 중 선택지(API `integrationPicklists` 항목과 동형) */
export type WorkspaceAiIntegrationPickItemWire = {
  readonly id: string;
  readonly provider: string;
  readonly displayName: string | null;
  readonly maskedPreview: string | null;
  readonly isDefault: boolean;
};

/** 화면(단계)별 참여 + 자동 실행 — DB `workspace_screen_ai_mapping`과 동형 */
export type WorkspaceAiScreenMappingWire = {
  readonly screenKey: WorkspaceScreenKey;
  readonly autoRun: boolean;
};

/** GET/PUT `/api/project/workspace-ai` 및 Prisma 그래프와 동일한 와이어 */
export type WorkspaceAiGraphMemberWire = {
  readonly rowId: string | null;
  readonly catalogKey: WorkspaceAiMemberId;
  readonly enabled: boolean;
  /** 참여 중인 화면 키(`screens`와 동일 순서 보장은 하지 않음·하위 호환) */
  readonly screenKeys: readonly WorkspaceScreenKey[];
  /** 화면별 참여·자동 실행(권장 소스) */
  readonly screens: readonly WorkspaceAiScreenMappingWire[];
  /** USER_DEFAULT | OPENAI | ANTHROPIC | GEMINI | CURSOR — 사용자 기본은 USER_DEFAULT */
  readonly enginePreference: string | null;
  /** 이 멤버가 사용하는 Integrations capability(LLM vs CODE_AGENT 등) */
  readonly integrationCapability: WorkspaceAiIntegrationCapability;
  /**
   * 멤버별 연동 핀(`ai_member_providers`). null이면 프로젝트 연동 → 사용자 기본 순으로 해석됩니다.
   * 엔진 UI는 `enginePreference`로 표시하며, 저장 시 엔진에 맞춰 이 값이 갱신됩니다.
   */
  readonly pinnedUserIntegrationId: string | null;
};
