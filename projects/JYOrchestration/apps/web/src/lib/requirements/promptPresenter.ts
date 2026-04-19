import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export type RequirementsPromptPresenterView = {
  title: string;
  roleText: string;
  projectName: string;
  projectDescription: string;
  stageText: string;
  recentSummaryBullets: string[];
  latestUserQuestion: string;
  targetName: string;
  copyText: string;
};

function recentBullets(messages: readonly RequirementsMessage[], max = 6): string[] {
  const texts = messages
    .filter((m) => m.speakerType === "USER" || m.speakerType === "AI")
    .slice(-18)
    .map((m) => m.content.trim())
    .filter(Boolean);
  const joined = texts.join("\n");
  const candidates = joined
    .split(/\r?\n|[•*-]\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length >= 4)
    .filter((s) => s.length <= 80);
  const uniq: string[] = [];
  for (const c of candidates) {
    const norm = c.replace(/\s+/g, " ");
    if (uniq.includes(norm)) continue;
    uniq.push(norm);
    if (uniq.length >= max) break;
  }
  return uniq;
}

export function buildPromptPresenterView(input: {
  projectName: string;
  projectDescription: string;
  targetName: string;
  messages: readonly RequirementsMessage[];
  latestUserMessage: string;
}): RequirementsPromptPresenterView {
  const roleText = "당신은 제품 아이디어를 함께 다듬는 AI 기획 파트너입니다.";
  const stageText = "아이디어 구체화";
  const bullets = recentBullets(input.messages);
  const latest = input.latestUserMessage.trim();

  const copyText = [
    "AI에게 전달되는 맥락",
    "",
    "역할:",
    roleText,
    "",
    "프로젝트:",
    input.projectName.trim() || "(이름 없음)",
    "",
    "프로젝트 설명:",
    input.projectDescription.trim() || "(설명 없음)",
    "",
    "현재 단계:",
    stageText,
    "",
    "최근 논의 요약:",
    ...(bullets.length ? bullets.map((b) => `- ${b}`) : ["- (아직 요약할 논의가 부족합니다)"]),
    "",
    "사용자 최신 질문:",
    latest || "(없음)",
    "",
    "선택 대상:",
    input.targetName,
  ].join("\n");

  return {
    title: "AI에게 전달되는 맥락",
    roleText,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    stageText,
    recentSummaryBullets: bullets,
    latestUserQuestion: latest,
    targetName: input.targetName,
    copyText,
  };
}

