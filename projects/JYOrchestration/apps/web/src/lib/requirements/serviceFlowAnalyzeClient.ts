import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";

export type ServiceFlowAnalyzeRequestBody = {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
  readonly latestAiQuestion: string;
  /** 직전 화면(아이디어 구체화 등)에서 넘어온 맥락 — 클라이언트가 1회 소비 */
  readonly priorScreenHandoff?: string;
  /** 서비스 설계 Harness(서버는 미사용 필드 허용) */
  readonly serviceDesignStage?: RequirementsWorkspaceStage;
  readonly mentionedAI?: string | null;
  readonly responsePolicy?: unknown;
  /** SingleChat 절차별 Agent 매핑 — 서버에서 requirements_service_flow 등으로 해석 */
  readonly workspaceScreenKey?: string;
  /** ideation→service-flow 자동 handoff (silentUserAppend) */
  readonly autoHandoff?: boolean;
  readonly quickActionLabel?: string;
  readonly proposalDecision?: string;
};

export type ServiceFlowVisibleMode =
  | "visible_proposal"
  | "handoff_state_only"
  | "visible_delta"
  | "state_transition";

export type ServiceFlowAnalyzeSuccessData = {
  assistantMessage?: string;
  updatedFlow?: RequirementsServiceFlowV1;
  nextQuestion?: string | null;
  quickReplies?: string[] | null;
  readiness?: { score?: number; readyForNext?: boolean } | null;
  visibleMode?: ServiceFlowVisibleMode;
  visibleMessageSuppressed?: boolean;
  suppressReason?: string;
  proposalDecision?: string;
  acceptedProposalSnapshot?: string | null;
  alternativeProposalPayload?: unknown;
  openAlternativeCanvas?: boolean;
};

export type ServiceFlowAnalyzeMeta = {
  readonly model?: string | null;
  readonly promptTrace?: unknown;
  readonly userFacingMessage?: string;
  readonly quickReplies?: readonly string[];
};

export type ServiceFlowAnalyzeResponse =
  | { readonly ok: true; readonly status: number; readonly data: ServiceFlowAnalyzeSuccessData; readonly meta?: ServiceFlowAnalyzeMeta }
  | { readonly ok: false; readonly status: number; readonly json: unknown };

export async function postServiceFlowAnalyze(body: ServiceFlowAnalyzeRequestBody): Promise<ServiceFlowAnalyzeResponse> {
  const res = await fetch("/api/requirements/service-flow-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      workspaceScreenKey: body.workspaceScreenKey ?? "requirements_service_flow",
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: ServiceFlowAnalyzeSuccessData;
    meta?: ServiceFlowAnalyzeMeta;
    code?: string;
    message?: string;
  };
  if (!res.ok || !json.success) {
    return { ok: false, status: res.status, json };
  }
  return { ok: true, status: res.status, data: json.data ?? {}, meta: json.meta };
}
