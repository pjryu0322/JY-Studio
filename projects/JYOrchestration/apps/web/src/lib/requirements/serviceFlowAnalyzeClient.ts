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
};

export type ServiceFlowAnalyzeSuccessData = {
  assistantMessage?: string;
  updatedFlow?: RequirementsServiceFlowV1;
  nextQuestion?: string | null;
  quickReplies?: string[] | null;
  readiness?: { score?: number; readyForNext?: boolean } | null;
};

export type ServiceFlowAnalyzeResponse =
  | { readonly ok: true; readonly status: number; readonly data: ServiceFlowAnalyzeSuccessData }
  | { readonly ok: false; readonly status: number; readonly json: unknown };

export async function postServiceFlowAnalyze(body: ServiceFlowAnalyzeRequestBody): Promise<ServiceFlowAnalyzeResponse> {
  const res = await fetch("/api/requirements/service-flow-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: ServiceFlowAnalyzeSuccessData;
    code?: string;
    message?: string;
  };
  if (!res.ok || !json.success) {
    return { ok: false, status: res.status, json };
  }
  return { ok: true, status: res.status, data: json.data ?? {} };
}
