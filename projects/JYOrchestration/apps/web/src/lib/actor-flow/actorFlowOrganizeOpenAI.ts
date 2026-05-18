import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { runActorFlowAnalyzeOpenAI, type ActorFlowAnalyzeResult } from "@/lib/actor-flow/actorFlowAnalyzerOpenAI";

/**
 * "정리 요청"용: 대화 내용 + 기존 초안 + 아이디어 산출물로 전체 재정리.
 * - 아이디어 구체화 스타일과 동일하게 JSON 기반 갱신
 * - 내부적으로는 analyze 엔진을 확장해 "delegate_to_ai" 성격으로 유도
 */
export async function runActorFlowOrganizeOpenAI(input: {
  projectName: string;
  projectDescription: string;
  dialogueExcerpt: string;
  ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  currentFlow: RequirementsServiceFlowV1 | null;
  latestAiQuestion: string;
}): Promise<ActorFlowAnalyzeResult> {
  const assetsBlock = input.ideationAssets
    .map((a) => {
      const type = String(a?.type ?? "").trim();
      const title = String(a?.title ?? "").trim();
      const content = String(a?.content ?? "").trim();
      if (!content) return "";
      return `- ${type || "산출물"}${title ? `: ${title}` : ""}\n${content.slice(0, 2500)}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const userMessage = `정리 요청입니다. 아래 정보를 바탕으로 액터/서비스 흐름/담당 매핑을 최신 대화 기준으로 다시 정리해 주세요.

[최근 대화 요약(원문 발췌)]
${String(input.dialogueExcerpt ?? "").trim().slice(0, 12000) || "(대화 없음)"}

[아이디어 구체화 산출물]
${assetsBlock || "(산출물 없음)"}

요구사항:
- 액터는 최소 2명 이상, 흐름은 최소 3단계 이상으로 구성
- 각 단계는 주 담당(primaryActorId)을 반드시 갖게
- 사용자가 명시한 정책/제약(예: 외부 공유 금지 등)은 단계 목적/설명에 자연스럽게 반영
- 결과는 간결하고 실행 가능한 초안으로`; // analyzer가 JSON으로 업데이트하도록 유도

  return await runActorFlowAnalyzeOpenAI({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    userMessage,
    latestAiQuestion: input.latestAiQuestion,
    currentFlow: input.currentFlow,
  });
}

