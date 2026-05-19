/**
 * currentFlow → review presentation (summary / detailed / compact).
 */

import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowReviewDepth } from "@/lib/requirements/serviceFlowConversationState";

function actorName(actors: readonly RequirementsServiceFlowActorV1[], id: string): string {
  return actors.find((a) => a.id === id)?.name?.trim() || "담당 액터";
}

function splitPurposeSections(purpose: string): { goal: string; input: string; process: string; result: string } {
  const p = String(purpose ?? "").trim();
  if (!p) {
    return { goal: "", input: "", process: "", result: "" };
  }

  const labeled = {
    goal: p.match(/(?:목적|goal)\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? "",
    input: p.match(/(?:입력|input)\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? "",
    process: p.match(/(?:처리|process)\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? "",
    result: p.match(/(?:결과|result)\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? "",
  };

  if (labeled.goal || labeled.input || labeled.process || labeled.result) {
    return labeled;
  }

  const parts = p.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 4) {
    return { goal: parts[0], input: parts[1], process: parts[2], result: parts[3] };
  }
  if (parts.length === 3) {
    return { goal: parts[0], input: parts[1], process: parts[2], result: "" };
  }
  if (parts.length === 2) {
    return { goal: parts[0], input: "", process: parts[1], result: "" };
  }

  return { goal: p, input: "", process: "", result: "" };
}

function inferFromTitle(title: string): { goal: string; input: string; process: string; result: string } {
  const t = String(title ?? "").trim();
  if (!t) return { goal: "", input: "", process: "", result: "" };

  if (/제공|입력|등록|업로드|요청/.test(t)) {
    return {
      goal: t.endsWith("다") ? t : `${t} 단계를 수행`,
      input: /업로드|등록/.test(t) ? "사용자·시스템 입력 데이터" : "사용자 입력·요청 맥락",
      process: t,
      result: "다음 단계로 전달",
    };
  }
  if (/처리|전사|생성|분석|변환|요약/.test(t)) {
    return {
      goal: `단계 목표: ${t}`,
      input: "이전 단계 산출물",
      process: t,
      result: "후속 단계에서 활용",
    };
  }
  if (/확인|조정|승인|검토/.test(t)) {
    return {
      goal: t,
      input: "이전 처리 결과",
      process: "사용자 확인·피드백 반영",
      result: "흐름 완료 또는 수정 요청",
    };
  }

  return {
    goal: t,
    input: "(이전 단계 결과)",
    process: t,
    result: "다음 단계 진행",
  };
}

function buildStepDetailedBlock(
  step: RequirementsServiceFlowStepV1,
  actors: readonly RequirementsServiceFlowActorV1[],
  index: number,
): string {
  const fromPurpose = splitPurposeSections(step.purpose);
  const fromTitle = inferFromTitle(step.title);
  const goal = fromPurpose.goal || fromTitle.goal || step.title;
  const input = fromPurpose.input || fromTitle.input;
  const processActor = actorName(actors, step.primaryActorId);
  const process =
    fromPurpose.process ||
    fromTitle.process ||
    (step.purpose.trim() ? `${processActor} — ${step.purpose.trim()}` : processActor);
  const result = fromPurpose.result || fromTitle.result;

  const lines = [`${index}. ${step.title}`, `- 목적:`, `  ${goal}`];
  if (input) lines.push(`- 입력:`, `  ${input}`);
  lines.push(`- 처리:`, `  ${process}`);
  if (result) lines.push(`- 결과:`, `  ${result}`);
  return lines.join("\n");
}

export function buildServiceFlowReviewPresentation(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly depth: ServiceFlowReviewDepth;
  readonly heading?: string;
  readonly cta?: string;
}): string {
  const actors = input.flow.actors ?? [];
  const steps = [...(input.flow.steps ?? [])].sort((a, b) => a.order - b.order);

  if (input.depth === "compact") {
    const titles = steps.map((s) => s.title).filter(Boolean);
    const lines = [
      String(input.heading ?? "현재 흐름은 이미 승인 상태입니다.").trim(),
      "",
      "필요하면 단계 수정 또는 세부 기능 정리를 진행할 수 있습니다.",
    ];
    if (titles.length) {
      lines.splice(2, 0, "", "확정된 흐름 요약", ...titles.map((t, i) => `${i + 1}. ${t}`));
    }
    return lines.join("\n").trim();
  }

  if (input.depth === "detailed") {
    const lines = [
      String(input.heading ?? "현재 서비스 흐름 상세 검토").trim(),
      "",
      "각 단계의 목적·입력·처리·결과를 확인한 뒤 승인하거나 수정할 수 있습니다.",
      "",
    ];
    if (actors.length) {
      lines.push("액터", ...actors.map((a) => `- ${a.name}`), "");
    }
    steps.forEach((step, i) => {
      lines.push(buildStepDetailedBlock(step, actors, i + 1));
      lines.push("");
    });
    lines.push(
      String(input.cta ?? "다음: 흐름을 승인하거나 단계·액터를 수정할 수 있습니다.").trim(),
    );
    return lines.join("\n").trim();
  }

  const actorLines = actors.map((a) => `- ${a.name}`).filter(Boolean);
  const stepLines = steps.map((s, i) => `${i + 1}. ${s.title}`);
  const lines = [String(input.heading ?? "현재 서비스 흐름을 정리했습니다.").trim(), ""];
  if (actorLines.length) {
    lines.push("액터", ...actorLines, "");
  }
  if (stepLines.length) {
    lines.push("흐름", ...stepLines, "");
  }
  lines.push(String(input.cta ?? "다음: 이 흐름을 승인하거나 일부 수정할 수 있습니다.").trim());
  return lines.join("\n").trim();
}
