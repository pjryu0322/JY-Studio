/**
 * H9 — 역할별 **자원 운영 계획** 힌트(표·registry 기반, read-only).
 */

import { resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";
import type { ResourceOrchestrationStance, RoleResourcePlan } from "./resourceOrchestrationTypes";

const DISCLAIMER =
  "이 블록은 운영 관측용 계획 메타데이터입니다. 실제 토큰·프로바이더·검색·프루닝을 자동으로 바꾸지 않습니다.";

function stanceFromCapabilities(capabilities: readonly string[]): ResourceOrchestrationStance {
  if (capabilities.includes("knowledge_retrieval")) return "expanded";
  if (capabilities.includes("slot_orchestration")) return "balanced";
  return "minimal";
}

function memoryStanceFor(roleKey: string | null): ResourceOrchestrationStance {
  if (roleKey === "prototype_build") return "expanded";
  if (roleKey === "planner" || roleKey === "solution-architect") return "balanced";
  return "balanced";
}

function knowledgeStanceFor(knowledgeScopeCount: number): ResourceOrchestrationStance {
  if (knowledgeScopeCount >= 2) return "expanded";
  return "balanced";
}

export function buildRoleResourcePlan(input: { readonly roleKey: string | null | undefined }): RoleResourcePlan {
  const raw = String(input.roleKey ?? "").trim();
  const rawRoleKey = raw.length ? raw : null;
  const contract = resolveAiIdentityContract(rawRoleKey);
  const resolvedContractRoleKey = contract?.roleKey ?? null;

  if (!contract) {
    return {
      rawRoleKey,
      resolvedContractRoleKey: null,
      providerPlanLabel: "등록되지 않은 역할 — 기본(OpenAI 단일 호출 가정) 계획 힌트",
      retrievalStance: "balanced",
      memoryStance: "balanced",
      knowledgeStance: "balanced",
      orchestrationConcurrencyHint:
        "역할 계약이 없어 병렬·검색 강도를 보수적으로 가정합니다. 카탈로그 역할 키를 맞추면 세부 힌트가 붙습니다.",
      planningDisclaimer: DISCLAIMER,
    };
  }

  const caps = contract.capabilities.map((c) => String(c));
  const retrievalStance = stanceFromCapabilities(caps);
  const memoryStance = memoryStanceFor(contract.roleKey);
  const knowledgeStance = knowledgeStanceFor(contract.knowledgeScopes.length);

  const providerPlanLabel =
    contract.provider === "cursor"
      ? "Cursor 코드 에이전트 중심 — 도구·워크스페이스 I/O가 입력 길이에 민감"
      : "OpenAI API 호출 중심 — 슬롯·JSON 모드 조합에 따른 지연·비용 변동";

  const orchestrationConcurrencyHint =
    contract.provider === "cursor"
      ? "Cursor 실행 경로는 에이전트 루프가 길어질 수 있어 컨텍스트·도구 호출을 수동으로 모니터링하는 편이 안전합니다."
      : caps.includes("slot_orchestration")
        ? "멀티 슬롯 오케스트레이션 역할 — 동시 슬롯이 늘면 컨텍스트 합성 비용이 함께 증가할 수 있습니다."
        : "단일 스트림 호출 위주 — 병렬성은 낮게 가정합니다.";

  return {
    rawRoleKey,
    resolvedContractRoleKey,
    providerPlanLabel,
    retrievalStance,
    memoryStance,
    knowledgeStance,
    orchestrationConcurrencyHint,
    planningDisclaimer: DISCLAIMER,
  };
}
