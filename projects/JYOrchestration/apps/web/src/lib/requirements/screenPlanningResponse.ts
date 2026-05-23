/**
 * Project SingleChat — screen planning responses (LLM preferred, deterministic fallback).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { formatScreenPlanningPromptTrace } from "@/lib/requirements/singleChatStageTrace";
import {
  runScreenPlanningLlm,
  type ScreenPlanningLlmResult,
} from "@/lib/requirements/screenPlanningLlm";

export type ScreenPlanningValidationIssueCode =
  | "screen_planning_message_too_short"
  | "screen_planning_missing_numbered_screens"
  | "screen_planning_missing_bullets"
  | "screen_planning_contains_execution_meta";

export type ScreenPlanningResponseSource = "llm" | "fallback";

export type ScreenPlanningResponseResult = Readonly<{
  readonly assistantMessage: string;
  readonly source: ScreenPlanningResponseSource;
  readonly promptTraceDetail: string;
}>;

const EXECUTION_META_PATTERN =
  /(service-flow\s*analyze|APPLY_PROPOSAL|대안\s*비교\s*Viewer|service_flow_proposal)/i;

export function validateScreenPlanningAssistantMessage(assistantMessage: string): {
  readonly ok: boolean;
  readonly issues: readonly ScreenPlanningValidationIssueCode[];
} {
  const t = String(assistantMessage ?? "").trim();
  const issues: ScreenPlanningValidationIssueCode[] = [];
  if (t.length < 160) issues.push("screen_planning_message_too_short");
  const numbered = (t.match(/(^|\n)\s*\d+\.\s+/g) ?? []).length;
  if (numbered < 3) issues.push("screen_planning_missing_numbered_screens");
  const bullets = (t.match(/(^|\n)\s*[-•]\s+/g) ?? []).length;
  if (bullets < 6) issues.push("screen_planning_missing_bullets");
  if (EXECUTION_META_PATTERN.test(t)) issues.push("screen_planning_contains_execution_meta");
  return { ok: issues.length === 0, issues };
}

function screenTitleFromStep(title: string, index: number): string {
  const t = String(title ?? "").trim();
  return t.length >= 2 ? `${t} 화면` : `화면 ${index + 1}`;
}

export function buildScreenPlanningAssistantMessage(input: {
  readonly projectName?: string;
  readonly flow?: RequirementsServiceFlowV1 | null;
}): string {
  const steps = input.flow?.steps ?? [];
  const intro = "앞서 정리한 서비스 흐름을 기준으로 화면 구성을 제안합니다.";
  const lines: string[] = [intro, ""];

  if (steps.length >= 3) {
    steps.slice(0, 6).forEach((step, i) => {
      const title = screenTitleFromStep(step.title, i);
      const desc = String(step.purpose ?? "").trim() || "주요 작업을 수행합니다.";
      lines.push(`${i + 1}. ${title}`);
      lines.push(`- 목적: ${desc}`);
      lines.push("- 주요 UI: 입력·목록·상태 표시 영역");
      lines.push("- 확인 정보: 진행 상태, 누락 항목");
      lines.push("");
    });
  } else {
    const defaults = [
      { title: "업로드·입력 화면", bullet: "파일 업로드, 진행 상태, 지원 형식 안내" },
      { title: "결과 확인 화면", bullet: "자동 생성 결과 목록, 요약, TODO 후보" },
      { title: "검수·수정 화면", bullet: "수정 요청, 변경 이력, 재실행" },
      { title: "최종 확정 화면", bullet: "승인/반려, 저장, 공유" },
    ];
    defaults.forEach((row, i) => {
      lines.push(`${i + 1}. ${row.title}`);
      lines.push(`- 목적: ${row.bullet}`);
      lines.push("- 주요 UI: 목록, 상세, 상태 표시");
      lines.push("- 확인 정보: 수정·승인 여부");
      lines.push("");
    });
  }

  lines.push("다음: 이 화면 구성을 기준으로 기능 범위를 정리할 수 있습니다.");
  return lines.join("\n").trim();
}

export function buildGenerationPrepareReadinessMessage(input: {
  readonly flow?: RequirementsServiceFlowV1 | null;
}): string {
  const hasFlow = (input.flow?.steps?.length ?? 0) >= 3;
  if (hasFlow) {
    return [
      "서비스 흐름 초안이 준비되었습니다.",
      "다음: 화면 구성·기능 범위를 더 정리한 뒤 생성 단계로 진행할 수 있습니다.",
    ].join("\n\n");
  }
  return [
    "생성 전에 서비스 흐름 초안(액터·단계 3개 이상)을 먼저 확정하는 것이 좋습니다.",
    "다음: 직전 절차를 서비스 흐름에 반영하거나 흐름 검토를 요청해 주세요.",
  ].join("\n\n");
}

export async function buildScreenPlanningResponse(input: {
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly flow?: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
  readonly userMessage: string;
  readonly runLlm?: (args: {
    readonly projectName: string;
    readonly projectDescription: string;
    readonly flow: RequirementsServiceFlowV1 | null;
    readonly recentMessages: string;
    readonly userMessage: string;
  }) => Promise<ScreenPlanningLlmResult>;
}): Promise<ScreenPlanningResponseResult> {
  const projectName = String(input.projectName ?? "").trim();
  const projectDescription = String(input.projectDescription ?? "").trim();
  const flow = input.flow ?? null;
  const runLlm = input.runLlm ?? runScreenPlanningLlm;

  const llmRes = await runLlm({
    projectName,
    projectDescription,
    flow,
    recentMessages: input.recentMessages,
    userMessage: input.userMessage,
  });

  if (llmRes.ok) {
    const validation = validateScreenPlanningAssistantMessage(llmRes.assistantMessage);
    if (validation.ok) {
      return {
        assistantMessage: llmRes.assistantMessage,
        source: "llm",
        promptTraceDetail: formatScreenPlanningPromptTrace({
          mode: "llm",
          status: "success",
        }),
      };
    }
    const fallback = buildScreenPlanningAssistantMessage({ projectName, flow });
    return {
      assistantMessage: fallback,
      source: "fallback",
      promptTraceDetail: formatScreenPlanningPromptTrace({
        mode: "llm",
        status: "validation_failed",
        issueCodes: validation.issues,
      }),
    };
  }

  const fallback = buildScreenPlanningAssistantMessage({ projectName, flow });
  return {
    assistantMessage: fallback,
    source: "fallback",
    promptTraceDetail: formatScreenPlanningPromptTrace({
      mode: "llm",
      status: "fallback",
    }),
  };
}
