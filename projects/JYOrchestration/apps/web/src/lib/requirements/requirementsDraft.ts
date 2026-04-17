import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export type RequirementsDraft = {
  projectOverview: string;
  goals: string[];
  targetUsers: string[];
  coreFeatures: string[];
  outOfScope: string[];
  nonFunctionalRequirements: string[];
  successCriteria: string[];
  openIssues: string[];
  createdAt: string;
  source: {
    messageCount: number;
    lastMessageAt?: string;
  };
};

export type DraftReadiness =
  | { ok: true }
  | { ok: false; code: "TOO_FEW_MESSAGES" | "MISSING_SIGNAL"; message: string };

function lastAt(messages: readonly RequirementsMessage[]): string | undefined {
  const last = messages[messages.length - 1];
  return last?.createdAt;
}

export function validateDraftReadiness(messages: readonly RequirementsMessage[]): DraftReadiness {
  const userMsgs = messages.filter((m) => m.speakerType === "USER" && m.content.trim());
  const aiMsgs = messages.filter((m) => m.speakerType === "AI" && m.content.trim());
  if (userMsgs.length < 2) {
    return {
      ok: false,
      code: "TOO_FEW_MESSAGES",
      message: "초안을 만들기 전에 핵심 기능과 대상 사용자를 조금 더 논의해야 합니다.",
    };
  }
  const hasAnyScopeSignal =
    /기능|권한|검색|공유|목록|상세|요약|업로드|다운로드|역할|사용자/i.test(
      userMsgs.map((m) => m.content).join("\n")
    ) || aiMsgs.length > 0;
  if (!hasAnyScopeSignal) {
    return {
      ok: false,
      code: "MISSING_SIGNAL",
      message: "초안을 만들기 전에 핵심 기능과 사용자 역할을 한두 개만 더 정리해 주세요.",
    };
  }
  return { ok: true };
}

function pickBullets(text: string, max = 6): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, ""))
    .filter((l) => l.length >= 2);
  return bullets.slice(0, max);
}

/** JSON 메시지 기반 초안 생성(로컬 휴리스틱). */
export function buildRequirementsDraftFromMessages(input: {
  projectName: string;
  projectDescription: string;
  messages: readonly RequirementsMessage[];
}): RequirementsDraft {
  const { projectName, projectDescription, messages } = input;
  const userText = messages
    .filter((m) => m.speakerType === "USER")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join("\n");

  const overviewBase = [projectName.trim(), projectDescription.trim()].filter(Boolean).join(" — ");
  const projectOverview = overviewBase || "프로젝트 개요가 아직 충분히 정리되지 않았습니다.";

  // 아주 단순한 추출(초안을 잃지 않게 구조를 채우는 목적).
  const targetUsers = (() => {
    const m = userText.match(/(대상\s*사용자|사용자|유저)[^\n]*\n([\s\S]{0,300})/i);
    if (m?.[2]) return pickBullets(m[2], 6);
    return [];
  })();

  const coreFeatures = (() => {
    const m = userText.match(/(핵심\s*기능|기능|요구사항)[^\n]*\n([\s\S]{0,600})/i);
    if (m?.[2]) return pickBullets(m[2], 8);
    // fallback: 문장형에서 키워드 포함 문장 일부
    const sents = userText
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => /(작성|검색|공유|권한|업로드|요약|추출|관리)/.test(s));
    return sents.slice(0, 8);
  })();

  const outOfScope = (() => {
    const m = userText.match(/(제외|하지\s*않을|아웃\s*오브\s*스코프)[^\n]*\n([\s\S]{0,300})/i);
    if (m?.[2]) return pickBullets(m[2], 6);
    return [];
  })();

  const nfr = (() => {
    const m = userText.match(/(비기능|성능|보안|가용성|로그|감사)[^\n]*\n([\s\S]{0,400})/i);
    if (m?.[2]) return pickBullets(m[2], 8);
    return [];
  })();

  const successCriteria = (() => {
    const m = userText.match(/(성공\s*기준|성과|지표)[^\n]*\n([\s\S]{0,300})/i);
    if (m?.[2]) return pickBullets(m[2], 6);
    return [];
  })();

  const openIssues = (() => {
    const m = userText.match(/(미결정|오픈\s*이슈|리스크|논의\s*필요)[^\n]*\n([\s\S]{0,300})/i);
    if (m?.[2]) return pickBullets(m[2], 8);
    return [];
  })();

  const goals = (() => {
    const m = userText.match(/(목표|핵심\s*목표)[^\n]*\n([\s\S]{0,300})/i);
    if (m?.[2]) return pickBullets(m[2], 6);
    return [];
  })();

  return {
    projectOverview,
    goals,
    targetUsers,
    coreFeatures,
    outOfScope,
    nonFunctionalRequirements: nfr,
    successCriteria,
    openIssues,
    createdAt: new Date().toISOString(),
    source: {
      messageCount: messages.length,
      lastMessageAt: lastAt(messages),
    },
  };
}

