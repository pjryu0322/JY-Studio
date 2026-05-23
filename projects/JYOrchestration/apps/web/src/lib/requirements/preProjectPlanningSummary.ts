import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export const PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE = "pre_project_planning_summary" as const;

const FORBIDDEN_SUMMARY_PHRASES =
  /추천안을 검토해 주세요|추천안 적용|일부 수정|다른 대안 보기|서비스 흐름 초안을 정리했습니다|프로젝트 승격|초안\s*JSON/i;

export function hasPreProjectPlanningSummaryMessage(messages: readonly RequirementsMessage[]): boolean {
  return messages.some(
    (m) =>
      m.meta?.internalType === PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE ||
      String(m.content ?? "").includes("프로젝트 생성 전 대화를 바탕으로 1차 기획 요약")
  );
}

export function isProjectSeededFromPreProjectChat(state: RequirementsStateJson): boolean {
  if (state.seededFromPreProjectChat === true) return true;
  if (String(state.lastUserDraftText ?? "").trim()) return true;
  if (String(state.lastPromptText ?? "").trim()) return true;
  const openIssues = String(state.openIssues ?? "").trim();
  const priorityFeatures = String(state.priorityFeatures ?? "").trim();
  if (priorityFeatures && openIssues) return true;
  // createProject mirrors description into originalProjectDescription for all projects;
  // require draft-derived fields beyond bare description mirror.
  if ((openIssues || priorityFeatures) && String(state.originalProjectDescription ?? "").trim()) {
    return true;
  }
  return false;
}

export function shouldSuppressInitialServiceFlowVisibleMessage(input: {
  readonly isInitialProjectEntry: boolean;
  readonly userInitiated: boolean;
  readonly quickActionId?: string | null;
}): boolean {
  if (!input.isInitialProjectEntry) return false;
  if (input.userInitiated) return false;
  if (String(input.quickActionId ?? "").trim()) return false;
  return true;
}

/** 초기 boot / silent auto handoff 시 service-flow analyze·visible append 차단 */
export function shouldSuppressInitialVisibleServiceFlowRun(input: {
  readonly suppressInitialAutoServiceFlowVisibleMessage: boolean;
  readonly silentUserAppend?: boolean;
  readonly quickActionId?: string | null;
  readonly quickActionLabel?: string | null;
  readonly userMessageText: string;
}): boolean {
  if (!input.suppressInitialAutoServiceFlowVisibleMessage) return false;
  if (!input.silentUserAppend) return false;
  if (String(input.quickActionId ?? "").trim()) return false;
  if (String(input.quickActionLabel ?? "").trim()) return false;
  const body = String(input.userMessageText ?? "").trim();
  if (!body) return false;
  return true;
}

export function shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry(input: {
  readonly conversationStatus: string;
  readonly hasProject: boolean;
  readonly loadedConversationProjectMatches: boolean;
  readonly alreadyApplied: boolean;
  readonly hasExistingPlanningSummary: boolean;
  readonly existingMessageCount: number;
  readonly seededFromPreProject: boolean;
}): boolean {
  if (input.conversationStatus !== "loaded") return false;
  if (!input.hasProject) return false;
  if (!input.loadedConversationProjectMatches) return false;
  if (input.alreadyApplied) return false;
  if (input.hasExistingPlanningSummary) return false;
  if (input.existingMessageCount > 0) return false;
  return input.seededFromPreProject;
}

/** Pre-Project 유래 프로젝트 첫 진입 시 service-flow 자동 visible append 억제 */
export function shouldSuppressInitialServiceFlowOnProjectEntry(
  state: RequirementsStateJson,
  persistedServiceFlowMessageCount: number
): boolean {
  return persistedServiceFlowMessageCount === 0 && isProjectSeededFromPreProjectChat(state);
}

function splitLines(text: string | null | undefined, max = 8): string[] {
  const lines = String(text ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const bullets: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2).trim());
    } else if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, "").trim());
    } else {
      bullets.push(line);
    }
    if (bullets.length >= max) break;
  }
  return bullets.slice(0, max);
}

function formatBulletSection(title: string, items: readonly string[]): string[] {
  if (!items.length) return [];
  return [title, ...items.map((item) => `- ${item.slice(0, 420)}`)];
}

function extractPreferredDirections(input: {
  readonly constraints?: readonly string[];
  readonly preferredDirections?: readonly string[];
  readonly projectDescription?: string | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = String(raw ?? "").trim();
    if (!t || seen.has(t) || FORBIDDEN_SUMMARY_PHRASES.test(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const c of input.constraints ?? []) push(c);
  for (const p of input.preferredDirections ?? []) push(p);
  for (const line of splitLines(input.projectDescription, 12)) {
    if (/제외|하지 않|빼고|우선|중심|먼저/i.test(line)) push(line);
  }
  return out.slice(0, 6);
}

export function buildPreProjectPlanningSummaryMessage(input: {
  readonly projectName: string;
  readonly projectDescription?: string | null;
  readonly preProjectSummary?: string | null;
  readonly latestUserIntent?: string | null;
  readonly constraints?: readonly string[];
  readonly preferredDirections?: readonly string[];
  readonly featureCandidates?: readonly string[];
  readonly openQuestions?: readonly string[];
}): string {
  const name = String(input.projectName ?? "").trim() || "프로젝트";
  const description = String(input.projectDescription ?? input.preProjectSummary ?? "").trim();
  const latestIntent = String(input.latestUserIntent ?? "").trim();

  const ideaBullets: string[] = [];
  if (description) {
    const fromDesc = splitLines(description, 4);
    if (fromDesc.length === 1) {
      ideaBullets.push(fromDesc[0]!);
    } else {
      ideaBullets.push(...fromDesc);
    }
  }
  if (latestIntent && !ideaBullets.some((b) => b.includes(latestIntent.slice(0, 40)))) {
    ideaBullets.unshift(latestIntent);
  }
  if (!ideaBullets.length) {
    ideaBullets.push(name);
  }

  const preferred = extractPreferredDirections({
    constraints: input.constraints,
    preferredDirections: input.preferredDirections,
    projectDescription: description,
  });

  const features = (input.featureCandidates ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 8);

  const openItems = (input.openQuestions ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 8);

  const parts: string[] = ["프로젝트 생성 전 대화를 바탕으로 1차 기획 요약을 정리했습니다.", ""];
  parts.push(...formatBulletSection("현재 아이디어", ideaBullets.slice(0, 4)));

  if (preferred.length) {
    parts.push("");
    parts.push(...formatBulletSection("사용자가 선택/선호한 방향", preferred));
  }

  if (features.length) {
    parts.push("");
    parts.push(...formatBulletSection("초기 핵심 기능 후보", features));
  } else if (description) {
    parts.push("");
    parts.push(...formatBulletSection("초기 핵심 기능 후보", [
      "녹취·음성 입력과 텍스트 변환",
      "발화자별 발언 정리 및 주제별 요약",
      "잔여업무 TODO 추출·관리",
    ]));
  }

  if (openItems.length) {
    parts.push("");
    parts.push(...formatBulletSection("아직 정해야 할 것", openItems));
  } else {
    parts.push("");
    parts.push(...formatBulletSection("아직 정해야 할 것", [
      "1차 MVP 범위에서 우선순위가 높은 입력·출력 방식",
      "발화자 구분·요약 품질 목표",
      "TODO 생성·검토 흐름",
    ]));
  }

  parts.push("");
  parts.push("다음 단계에서는 서비스 흐름, 화면 구성, 기능 범위를 차례로 구체화하면 됩니다.");

  const text = parts.join("\n");
  if (FORBIDDEN_SUMMARY_PHRASES.test(text)) {
    return text
      .replace(/추천안 적용/g, "")
      .replace(/일부 수정/g, "")
      .replace(/다른 대안 보기/g, "")
      .replace(/서비스 흐름 초안을 정리했습니다\.?/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return text;
}

export function buildPreProjectPlanningSummaryFromWorkspaceState(input: {
  readonly projectName: string;
  readonly projectDescription?: string | null;
  readonly state: RequirementsStateJson;
}): string {
  const description =
    String(input.projectDescription ?? "").trim() ||
    String(input.state.originalProjectDescription ?? "").trim();
  return buildPreProjectPlanningSummaryMessage({
    projectName: input.projectName,
    projectDescription: description,
    preProjectSummary: description,
    latestUserIntent: String(input.state.lastUserDraftText ?? "").trim() || undefined,
    constraints: splitLines(input.state.openIssues, 4).filter((l) => /제외|하지 않|빼고/i.test(l)),
    preferredDirections: splitLines(description, 6).filter((l) => /제외|우선|중심|먼저|빼고/i.test(l)),
    featureCandidates: splitLines(input.state.priorityFeatures, 8),
    openQuestions: splitLines(input.state.openIssues, 8).filter((l) => !/제외|빼고/i.test(l)),
  });
}
