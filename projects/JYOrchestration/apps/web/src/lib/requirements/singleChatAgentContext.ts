import { listPlatformAiMemberCatalog, type WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { listProjectMembers } from "@/lib/service/projectMemberService";
import { getEnabledCatalogKeysForScreen, getWorkspaceAiGraphWireWithMemberPrefs } from "@/lib/service/workspaceAiMemberGraphService";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import {
  resolveEnabledCatalogKeysForScreen,
  WORKSPACE_SCREEN_LABEL,
  WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS,
  type WorkspaceScreenKey,
} from "@/lib/workspace-ai/workspaceScreenKeys";
import { SINGLE_CHAT_SERVICE_PLANNING_GROUP } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";

/** AI Agent 설정 + 오케스트레이션 멤버 집계용 와이어 */
export type SingleChatSelectedAgentWire = {
  readonly source: "catalog" | "project_member";
  readonly catalogKey?: WorkspaceAiMemberId;
  readonly displayName: string;
  readonly aiOrchestrationRole?: string | null;
  readonly orchestrationStage?: string | null;
  readonly aiProvider?: string | null;
  readonly aiAgentKey?: string | null;
  readonly aiModelOverride?: string | null;
  readonly enginePreference?: string | null;
};

export function requirementsWorkspaceStageToWorkspaceScreenKey(
  stage: RequirementsWorkspaceStage
): WorkspaceScreenKey {
  if (stage === "service-flow") return "requirements_service_flow";
  if (stage === "feature-planning") return "feature_planning";
  return "requirements_ideation";
}

/** promptTimeline `stage` 필드용 */
export function timelineStageForWorkspaceScreen(screenKey: WorkspaceScreenKey): string {
  const m: Partial<Record<WorkspaceScreenKey, string>> = {
    requirements_ideation: "ideation",
    requirements_service_flow: "service-flow",
    feature_planning: "feature-planning",
    prototype_build: "prototype-generation",
    prototype_review: "prototype-review",
    deploy_gate: "deploy-gate",
    work_note: "work-note",
  };
  return m[screenKey] ?? screenKey;
}

export function workspaceStageGroupLabel(screenKey: WorkspaceScreenKey): string {
  if (
    screenKey === "requirements_ideation" ||
    screenKey === "requirements_service_flow" ||
    screenKey === "feature_planning"
  ) {
    return "서비스 기획";
  }
  if (screenKey === "prototype_build") return "프로토타입 생성";
  if (screenKey === "prototype_review") return "프로토타입 검토";
  if (screenKey === "deploy_gate") return "배포 전 보안 검증";
  return WORKSPACE_SCREEN_LABEL[screenKey] ?? screenKey;
}

/** ProjectMember.orchestrationStage 필터 — 화면별 DB 단계 문자열 */
export function orchestrationDbStageForWorkspaceScreen(screenKey: WorkspaceScreenKey): string | null {
  if (screenKey === "requirements_ideation") return "spec";
  if (screenKey === "requirements_service_flow") return "service-flow";
  if (screenKey === "feature_planning") return "task";
  if (screenKey === "prototype_build") return "prototype-generation";
  if (screenKey === "prototype_review") return "execution-review";
  if (screenKey === "deploy_gate") return "scm-manager";
  return null;
}

function formatAgentPromptBlock(params: {
  readonly stageGroup: string;
  readonly screenLabel: string;
  readonly agents: readonly SingleChatSelectedAgentWire[];
}): string {
  const lines: string[] = [];
  lines.push(`현재 절차 그룹: ${params.stageGroup}`);
  lines.push(`현재 화면: ${params.screenLabel}`);
  lines.push("");
  if (!params.agents.length) {
    lines.push(
      "참여 Agent(프로젝트 설정): 없음 — 기본 플랫폼 페르소나만 적용됩니다."
    );
  } else {
    lines.push("참여 Agent(프로젝트 AI Agent 설정·오케스트레이션):");
    for (const a of params.agents) {
      const parts = [
        a.displayName,
        a.source === "catalog" ? `(카탈로그${a.catalogKey ? `:${a.catalogKey}` : ""})` : "(프로젝트 멤버)",
        a.aiOrchestrationRole ? `역할:${a.aiOrchestrationRole}` : null,
        a.orchestrationStage ? `단계:${a.orchestrationStage}` : null,
        a.aiProvider ? `provider:${a.aiProvider}` : null,
        a.aiAgentKey ? `agentKey:${a.aiAgentKey}` : null,
        a.aiModelOverride ? `modelOverride:${a.aiModelOverride}` : null,
        a.enginePreference ? `engine:${a.enginePreference}` : null,
      ].filter(Boolean);
      lines.push(`- ${parts.join(" · ")}`);
    }
  }
  lines.push("");
  lines.push(
    "응답 규칙: 위 목록에 나온 Agent 관점·역할 범위 내에서만 답합니다. 목록에 없는 전문 역할(예: 보안 전담·검수자)은 이 절차에 참여한 것으로 가정하지 않습니다."
  );
  return lines.join("\n");
}

/**
 * SingleChat LLM 호출 전 컨텍스트 — AI Agent 탭의 절차별 매핑(workspace 그래프) +
 * 동일 하위 단계(spec/service-flow/task)의 오케스트레이션 AI 멤버.
 */
function mergeAgentWiresUnique(agents: readonly SingleChatSelectedAgentWire[]): SingleChatSelectedAgentWire[] {
  const seen = new Set<string>();
  const out: SingleChatSelectedAgentWire[] = [];
  for (const x of agents) {
    const role = String(x.aiOrchestrationRole ?? "").trim().toLowerCase();
    const key = `${x.source}:${x.catalogKey ?? ""}:${x.displayName}:${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }
  return out;
}

/**
 * spec / service-flow / task 에 매핑된 참여 Agent를 통합 조회.
 * SingleChat 오케스트레이션·최초 진입 시 planner 우선 선택에 사용.
 */
export async function resolveServicePlanningOrchestrationContext(projectId: string): Promise<{
  stageGroup: string;
  stageGroupDisplay: string;
  timelineStage: string;
  primaryWorkspaceScreenKey: WorkspaceScreenKey;
  /** resolveSingleChatAgentContext와 동일 키 — 타임라인·화면 식별 */
  workspaceScreenKey: WorkspaceScreenKey;
  selectedAgents: SingleChatSelectedAgentWire[];
  promptBlock: string;
}> {
  const pid = projectId.trim();
  const merged: SingleChatSelectedAgentWire[] = [];
  if (pid) {
    for (const screen of WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS) {
      const ctx = await resolveSingleChatAgentContext(pid, screen);
      merged.push(...ctx.selectedAgents);
    }
  }
  const selectedAgents = mergeAgentWiresUnique(merged);
  const primaryWorkspaceScreenKey: WorkspaceScreenKey = "requirements_ideation";
  const timelineStage = timelineStageForWorkspaceScreen(primaryWorkspaceScreenKey);
  const stageGroupDisplay = workspaceStageGroupLabel(primaryWorkspaceScreenKey);
  const promptBlock = formatAgentPromptBlock({
    stageGroup: `${stageGroupDisplay} (${SINGLE_CHAT_SERVICE_PLANNING_GROUP}: spec · service-flow · task)`,
    screenLabel: "SingleChat · 서비스 기획 통합",
    agents: selectedAgents,
  });
  return {
    stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
    stageGroupDisplay,
    timelineStage,
    primaryWorkspaceScreenKey,
    workspaceScreenKey: primaryWorkspaceScreenKey,
    selectedAgents,
    promptBlock,
  };
}

export async function resolveSingleChatAgentContext(
  projectId: string,
  workspaceScreenKey: WorkspaceScreenKey
): Promise<{
  stageGroup: string;
  timelineStage: string;
  workspaceScreenKey: WorkspaceScreenKey;
  selectedAgents: SingleChatSelectedAgentWire[];
  promptBlock: string;
}> {
  const pid = projectId.trim();
  const stageGroup = workspaceStageGroupLabel(workspaceScreenKey);
  const timelineStage = timelineStageForWorkspaceScreen(workspaceScreenKey);
  const screenLabel = WORKSPACE_SCREEN_LABEL[workspaceScreenKey] ?? workspaceScreenKey;

  const selectedAgents: SingleChatSelectedAgentWire[] = [];

  if (pid) {
    const catalogKeys = await getEnabledCatalogKeysForScreen(pid, workspaceScreenKey);
    const graph = await getWorkspaceAiGraphWireWithMemberPrefs(pid);
    const catalog = listPlatformAiMemberCatalog();

    for (const key of catalogKeys) {
      const def = catalog.find((c) => c.id === key);
      const row = graph.find((g) => g.catalogKey === key);
      const roleFromCatalog = orchestrationRoleFromCatalogKey(key);
      selectedAgents.push({
        source: "catalog",
        catalogKey: key,
        displayName: def?.title ?? key,
        aiOrchestrationRole: roleFromCatalog,
        enginePreference: row?.enginePreference ?? null,
        aiProvider: row?.aiProvider ?? null,
        aiModelOverride: row?.aiModelOverride ?? null,
      });
    }

    const orch = orchestrationDbStageForWorkspaceScreen(workspaceScreenKey);
    if (orch) {
      const members = await listProjectMembers(pid);
      for (const m of members) {
        if (m.memberType !== "AI") continue;
        if (m.orchestrationEnabled === false) continue;
        const st = String(m.orchestrationStage ?? "").trim().toLowerCase();
        if (st !== orch) continue;
        selectedAgents.push({
          source: "project_member",
          displayName: m.displayName,
          aiOrchestrationRole: m.aiOrchestrationRole,
          orchestrationStage: m.orchestrationStage,
          aiProvider: m.aiProvider,
          aiAgentKey: m.aiAgentKey,
          aiModelOverride: m.aiModelOverride,
        });
      }
    }
  }

  const promptBlock = formatAgentPromptBlock({ stageGroup, screenLabel, agents: selectedAgents });

  return {
    stageGroup,
    timelineStage,
    workspaceScreenKey,
    selectedAgents,
    promptBlock,
  };
}

function orchestrationRoleFromCatalogKey(key: WorkspaceAiMemberId): string | null {
  // 서비스 기획 슬롯/라우팅에서 사용하는 내부 역할 문자열로 정규화.
  if (key === "ideation") return "planner";
  if (key === "actor_flow") return "service-designer";
  if (key === "feature_planning") return "spec-reviewer";
  if (key === "designer") return "spec-reviewer";
  if (key === "security_reviewer") return "security-reviewer";
  return null;
}

/** 단위 테스트·경량 호출: 메모리 그래프로 카탈로그만 해석 */
export function resolveEnabledCatalogKeysForScreenFromWire(
  graph: readonly WorkspaceAiGraphMemberWire[],
  screenKey: WorkspaceScreenKey
): WorkspaceAiMemberId[] {
  return resolveEnabledCatalogKeysForScreen(graph, screenKey);
}
