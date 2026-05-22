import type { AiPlannerPromptMode } from "@/lib/requirements/plannerPromptMode";

export type AiPlannerContextBlocks = {
  readonly explorationTopic?: readonly string[];
  readonly userConstraints?: readonly string[];
  readonly discardedDirections?: readonly string[];
  readonly openOptions?: readonly string[];
  readonly confirmedProjectDirection?: readonly string[];
  readonly confirmedConstraints?: readonly string[];
  readonly excludedScope?: readonly string[];
  readonly openItems?: readonly string[];
  readonly nextDeliverableCandidates?: readonly string[];
};

type Turn = { readonly role: "user" | "assistant"; readonly content: string };

function userLines(transcript: readonly Turn[]): string[] {
  return transcript
    .filter((m) => m.role === "user")
    .map((m) => String(m.content ?? "").trim())
    .filter((s) => s.length >= 4);
}

function lastUserLine(transcript: readonly Turn[]): string {
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i]!.role === "user") return String(transcript[i]!.content ?? "").trim();
  }
  return "";
}

function extractConstraints(lines: readonly string[]): string[] {
  const out: string[] = [];
  const patterns = [
    /(?:하지\s*말|안\s*함|없이|제외|빼|금지|불필요|로그인\s*없|공개\s*조회|JSON|DB|데이터베이스|저장하지)/i,
    /(?:필터|분야|세분|우선|반드시|꼭)/i,
  ];
  for (const line of lines) {
    const short = line.replace(/\s+/g, " ").slice(0, 200);
    if (patterns.some((p) => p.test(short)) && !out.includes(short)) out.push(short);
    if (out.length >= 6) break;
  }
  return out;
}

function extractDiscarded(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (/(?:제외|버리|폐기|하지\s*말|안\s*씀|불필요|빼\s*줘)/i.test(line)) {
      const short = line.replace(/\s+/g, " ").slice(0, 200);
      if (!out.includes(short)) out.push(short);
    }
    if (out.length >= 5) break;
  }
  return out;
}

function formatBlock(title: string, items: readonly string[]): string {
  if (!items.length) return "";
  return `${title}\n${items.map((x) => `- ${x}`).join("\n")}`;
}

export function buildAiPlannerContextBlocksFromTranscript(
  transcript: readonly Turn[],
  mode: AiPlannerPromptMode
): AiPlannerContextBlocks {
  const lines = userLines(transcript);
  const constraints = extractConstraints(lines);
  const discarded = extractDiscarded(lines);
  const topic = lastUserLine(transcript);
  const topicBullets = topic ? [topic.slice(0, 420)] : lines.slice(-2).map((l) => l.slice(0, 200));

  if (mode === "pre_project_brainstorm") {
    return {
      ...(topicBullets.length ? { explorationTopic: topicBullets } : {}),
      ...(constraints.length ? { userConstraints: constraints } : {}),
      ...(discarded.length ? { discardedDirections: discarded } : {}),
      ...(topicBullets.length ? { openOptions: ["방향 비교", "가벼운 MVP 접근", "확장 시나리오"] } : {}),
    };
  }

  return {
    ...(topicBullets.length ? { confirmedProjectDirection: topicBullets } : {}),
    ...(constraints.length ? { confirmedConstraints: constraints } : {}),
    ...(discarded.length ? { excludedScope: discarded } : {}),
    openItems: constraints.length ? ["범위 세부", "화면·흐름 우선순위"] : ["프로젝트 목표 구체화"],
    nextDeliverableCandidates: ["요구사항 초안", "서비스 흐름", "기능 후보 목록"],
  };
}

export function formatAiPlannerContextBlocksForPrompt(
  blocks: AiPlannerContextBlocks,
  mode: AiPlannerPromptMode
): string {
  if (mode === "pre_project_brainstorm") {
    const parts = [
      formatBlock("[현재 탐색 주제]", blocks.explorationTopic ?? []),
      formatBlock("[사용자가 명시한 제약]", blocks.userConstraints ?? []),
      formatBlock("[사용자가 제외한 방향]", blocks.discardedDirections ?? []),
      formatBlock("[아직 열려 있는 선택지]", blocks.openOptions ?? []),
    ].filter(Boolean);
    return parts.join("\n\n");
  }
  const parts = [
    formatBlock("[확정된 프로젝트 방향]", blocks.confirmedProjectDirection ?? []),
    formatBlock("[확정 제약]", blocks.confirmedConstraints ?? []),
    formatBlock("[제외 범위]", blocks.excludedScope ?? []),
    formatBlock("[미정 사항]", blocks.openItems ?? []),
    formatBlock("[다음 산출물 후보]", blocks.nextDeliverableCandidates ?? []),
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function formatAiPlannerContextBlocksForTimeline(blocks: AiPlannerContextBlocks): string {
  const lines: string[] = [];
  const push = (key: string, arr?: readonly string[]) => {
    if (arr?.length) lines.push(`${key}=[${arr.map((x) => JSON.stringify(x)).join(", ")}]`);
  };
  push("explorationTopic", blocks.explorationTopic);
  push("userConstraints", blocks.userConstraints);
  push("discardedDirections", blocks.discardedDirections);
  push("openOptions", blocks.openOptions);
  push("confirmedProjectDirection", blocks.confirmedProjectDirection);
  push("confirmedConstraints", blocks.confirmedConstraints);
  push("excludedScope", blocks.excludedScope);
  push("openItems", blocks.openItems);
  push("nextDeliverableCandidates", blocks.nextDeliverableCandidates);
  return lines.join("\n");
}
