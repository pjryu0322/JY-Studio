import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsDraftDoc } from "@/lib/requirements/draftStore";

function pickBullets(text: string, max = 8): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, ""))
    .filter((l) => l.length >= 2)
    .slice(0, max);
}

function lastAt(messages: readonly RequirementsMessage[]): string | undefined {
  const last = messages[messages.length - 1];
  return last?.createdAt;
}

export function buildDraftFromConversation(input: {
  projectId: string;
  projectName: string;
  projectDescription: string;
  messages: readonly RequirementsMessage[];
  previous: RequirementsDraftDoc | null;
}): Omit<RequirementsDraftDoc, "version" | "status" | "updatedAt"> {
  const { projectId, projectName, projectDescription, messages } = input;
  const userText = messages
    .filter((m) => m.speakerType === "USER")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join("\n");

  const overviewBase = [projectName.trim(), projectDescription.trim()].filter(Boolean).join(" — ");
  const overview = overviewBase || "프로젝트 개요가 아직 충분히 정리되지 않았습니다.";

  const users = (() => {
    const m = userText.match(/(대상\s*사용자|사용자|유저)[^\n]*\n([\s\S]{0,350})/i);
    if (m?.[2]) return pickBullets(m[2], 8);
    return [];
  })();

  const features = (() => {
    const m = userText.match(/(핵심\s*기능|기능|요구사항)[^\n]*\n([\s\S]{0,700})/i);
    if (m?.[2]) return pickBullets(m[2], 10);
    const sents = userText
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => /(작성|검색|공유|권한|업로드|요약|추출|관리)/.test(s));
    return sents.slice(0, 10);
  })();

  const excluded = (() => {
    const m = userText.match(/(제외|하지\s*않을|아웃\s*오브\s*스코프)[^\n]*\n([\s\S]{0,350})/i);
    if (m?.[2]) return pickBullets(m[2], 8);
    return [];
  })();

  const nonFunctional = (() => {
    const m = userText.match(/(비기능|성능|보안|가용성|로그|감사)[^\n]*\n([\s\S]{0,500})/i);
    if (m?.[2]) return pickBullets(m[2], 10);
    return [];
  })();

  const successCriteria = (() => {
    const m = userText.match(/(성공\s*기준|성과|지표)[^\n]*\n([\s\S]{0,350})/i);
    if (m?.[2]) return pickBullets(m[2], 8);
    return [];
  })();

  const openIssues = (() => {
    const m = userText.match(/(미결정|오픈\s*이슈|리스크|논의\s*필요)[^\n]*\n([\s\S]{0,350})/i);
    if (m?.[2]) return pickBullets(m[2], 10);
    return [];
  })();

  const goals = (() => {
    const m = userText.match(/(목표|핵심\s*목표)[^\n]*\n([\s\S]{0,350})/i);
    if (m?.[2]) return pickBullets(m[2], 8);
    return [];
  })();

  return {
    projectId,
    overview,
    goals,
    users,
    features,
    excluded,
    nonFunctional,
    successCriteria,
    openIssues,
    createdAt: input.previous?.createdAt ?? new Date().toISOString(),
    source: {
      messageCount: messages.length,
      lastMessageAt: lastAt(messages),
    },
  };
}

