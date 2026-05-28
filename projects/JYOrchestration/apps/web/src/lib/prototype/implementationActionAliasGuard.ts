import {
  IMPLEMENTATION_ENVIRONMENT_CHECK_VIEW_CHIP,
  IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP,
  IMPLEMENTATION_SCM_CHECK_VIEW_CHIP,
} from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationActionId } from "@/lib/prototype/implementationIntentRouterTypes";
import { WORK_PLAN_DRAFT_GENERATE_CHIP } from "@/lib/prototype/implementationWorkPlanDraft";
import {
  isQuestionLikeWorkPlanUtterance,
  matchesExplicitWorkPlanExecutePattern,
} from "@/lib/prototype/implementationWorkPlanUtteranceGuards";

const MAX_ALIAS_LENGTH = 48;

/** 실행 보류·사전 검토 표현이 있으면 alias 매칭하지 않는다. */
const DEFER_OR_CONDITIONAL =
  /생성\s*전|만들\s*기\s*전|하기\s*전에|나중에\s*(만들|생성)|먼저\s*검토|누락.*검토|검토해|확인해\s*줘.*생성|아직\s*만들지/i;

function normalizeAliasText(text: string): string {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const EXACT_LABEL_TO_ACTION: Readonly<Record<string, ImplementationActionId>> = {
  [WORK_PLAN_DRAFT_GENERATE_CHIP]: "CREATE_WORK_PLAN",
  "구현 작업안 생성": "CREATE_WORK_PLAN",
  "구현 작업안 초안 생성해줘": "CREATE_WORK_PLAN",
  "작업계획 생성": "CREATE_WORK_PLAN",
  "작업계획 수립": "CREATE_WORK_PLAN",
  "작업 계획 생성": "CREATE_WORK_PLAN",
  "구현 작업안 확정": "CONFIRM_WORK_PLAN",
  "mock 기반 구현 진행": "CONFIRM_MOCK_IMPLEMENTATION",
  "mock으로 진행해": "CONFIRM_MOCK_IMPLEMENTATION",
  "일단 mock으로 구현해줘": "CONFIRM_MOCK_IMPLEMENTATION",
  "db 없이 진행해": "CONFIRM_MOCK_IMPLEMENTATION",
  "db 없이 구현해": "CONFIRM_MOCK_IMPLEMENTATION",
  "db 연동 필요성 검토": "REVIEW_DB_INTEGRATION",
  "db 검토": "REVIEW_DB_INTEGRATION",
  "wip 요청해줘": "REQUEST_CODE_AGENT_WIP",
  "코드 작업 진행해줘": "REQUEST_CODE_AGENT_WIP",
  "바로 구현해줘": "REQUEST_CODE_AGENT_WIP",
  "프롬프트 보기": "OPEN_PLANNER_PROMPT",
  [IMPLEMENTATION_SCM_CHECK_VIEW_CHIP]: "SHOW_SCM_CHECK",
  "scm 점검 결과": "SHOW_SCM_CHECK",
  [IMPLEMENTATION_ENVIRONMENT_CHECK_VIEW_CHIP]: "SHOW_ENV_CHECK",
  "환경설정 점검 결과": "SHOW_ENV_CHECK",
  [IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP]: "SHOW_ROLE_CHECK",
  "산출물 다시 보기": "SHOW_ARTIFACTS",
  "환경설정 열기": "OPEN_ENV_SETTINGS",
  "구현 범위 직접 입력": "DIRECT_IMPLEMENTATION_SCOPE_INPUT",
};

export function detectImplementationActionAlias(input: {
  readonly text: string;
  readonly visibleActionLabels?: readonly string[];
}): ImplementationActionId | null {
  const raw = String(input.text ?? "").trim();
  if (!raw || raw.length > MAX_ALIAS_LENGTH) return null;
  if (DEFER_OR_CONDITIONAL.test(raw)) return null;
  if (isQuestionLikeWorkPlanUtterance(raw)) return null;

  const normalized = normalizeAliasText(raw);
  if (EXACT_LABEL_TO_ACTION[normalized]) return EXACT_LABEL_TO_ACTION[normalized];
  if (EXACT_LABEL_TO_ACTION[raw]) return EXACT_LABEL_TO_ACTION[raw];

  for (const label of input.visibleActionLabels ?? []) {
    const chip = label.trim();
    if (!chip || chip.length > MAX_ALIAS_LENGTH) continue;
    const chipNorm = normalizeAliasText(chip);
    if (chipNorm === normalized) {
      const mapped = EXACT_LABEL_TO_ACTION[chip] ?? EXACT_LABEL_TO_ACTION[chipNorm];
      if (mapped) return mapped;
    }
    const mapped = EXACT_LABEL_TO_ACTION[chip] ?? EXACT_LABEL_TO_ACTION[chipNorm];
    if (
      mapped === "CREATE_WORK_PLAN" &&
      (normalized.startsWith(`${chipNorm}해`) || matchesExplicitWorkPlanExecutePattern(raw))
    ) {
      return mapped;
    }
  }

  if (matchesExplicitWorkPlanExecutePattern(raw)) {
    return "CREATE_WORK_PLAN";
  }

  return null;
}
