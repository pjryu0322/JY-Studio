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
import {
  internalOwnerToLlmExternalRole,
  SINGLE_CHAT_SERVICE_PLANNING_GROUP,
} from "@/lib/requirements/singleChatOrchestrationSlots";
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
  // LLM prompt 용: “실제 참여 AI 목록”만 노출. displayName+외부역할 기준 dedupe 후 한 줄씩.
  lines.push("[참여 AI]");
  if (!params.agents.length) {
    lines.push("- (없음)");
  } else {
    for (const a of params.agents) {
      const roleExternal = internalOwnerToLlmExternalRole(String(a.aiOrchestrationRole ?? ""));
      const provider = String(a.aiProvider ?? "").trim();
      const model = String(a.aiModelOverride ?? "").trim();
      const parts = [
        a.displayName,
        roleExternal ? `역할:${roleExternal}` : null,
        provider ? `provider:${provider}` : null,
        model ? `model:${model}` : null,
        a.enginePreference ? `engine:${a.enginePreference}` : null,
      ].filter(Boolean);
      lines.push(`- ${parts.join(" · ")}`);
    }
  }
  return lines.join("\n");
}

function agentMetadataRichness(a: SingleChatSelectedAgentWire): number {
  let s = 0;
  if (String(a.aiModelOverride ?? "").trim()) s += 4;
  if (String(a.aiProvider ?? "").trim()) s += 2;
  if (String(a.aiAgentKey ?? "").trim()) s += 1;
  if (String(a.enginePreference ?? "").trim()) s += 1;
  return s;
}

/**
 * 동일 displayName + 외부 오케스트레이션 역할이 카탈로그/프로젝트 멤버에서 중복될 때 한 줄로 합친다.
 * model·provider 등 메타가 더 풍부한 쪽을 남긴다(동점이면 먼저 등장한 항목 유지).
 */
export function dedupeParticipatingAgentsForPrompt(agents: readonly SingleChatSelectedAgentWire[]): SingleChatSelectedAgentWire[] {
  const byKey = new Map<string, SingleChatSelectedAgentWire>();
  for (const a of agents) {
    const dn = String(a.displayName ?? "").trim().toLowerCase();
    const ext = internalOwnerToLlmExternalRole(String(a.aiOrchestrationRole ?? ""));
    const key = `${dn}\0${ext}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, a);
      continue;
    }
    const rNew = agentMetadataRichness(a);
    const rOld = agentMetadataRichness(prev);
    if (rNew > rOld) byKey.set(key, a);
  }
  return Array.from(byKey.values());
}

/** 워크스페이스에 설정된 모델 오버라이드(플래너 우선) — bootstrap 실제 호출 모델과 비교용 */
export function pickConfiguredModelOverrideFromAgents(agents: readonly SingleChatSelectedAgentWire[]): string | null {
  const roleLo = (r: string | null | undefined) => String(r ?? "").trim().toLowerCase();
  const planner = agents.find((a) => roleLo(a.aiOrchestrationRole) === "planner");
  const fromPlanner = String(planner?.aiModelOverride ?? "").trim();
  if (fromPlanner) return fromPlanner;
  for (const a of agents) {
    const m = String(a.aiModelOverride ?? "").trim();
    if (m) return m;
  }
  return null;
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
  const selectedAgents = dedupeParticipatingAgentsForPrompt(mergeAgentWiresUnique(merged));
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

  const deduped = dedupeParticipatingAgentsForPrompt(selectedAgents);
  const promptBlock = formatAgentPromptBlock({ stageGroup, screenLabel, agents: deduped });

  return {
    stageGroup,
    timelineStage,
    workspaceScreenKey,
    selectedAgents: deduped,
    promptBlock,
  };
}

function orchestrationRoleFromCatalogKey(key: WorkspaceAiMemberId): string | null {
  // 서비스 기획 슬롯/라우팅에서 사용하는 내부 역할 문자열로 정규화.
  if (key === "ideation") return "planner";
  if (key === "actor_flow") return "service-designer";
  if (key === "feature_planning") return "solution-architect";
  if (key === "designer") return "ui-designer";
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
