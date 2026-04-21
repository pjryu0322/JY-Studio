import type { RequirementsPromptPresenterView } from "@/lib/requirements/promptPresenter";
import type { IdeationDeliverableAsset, IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { parseDeliverableAssetsFromState } from "@/lib/requirements/ideationDeliverables";
import {
  parseRequirementsOrganizeContextV1,
  type RequirementsOrganizeContextV1,
} from "@/lib/requirements/requirementsOrganizeContext";

function unwrapDbJsonField(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

/**
 * `Project.requirementsStateJson` — 클라이언트·서버 공통 형태(필드 추가 시 하위 호환 유지).
 */
export type RequirementsOrganizePlannerState = {
  requestedType: IdeationDeliverableType;
  requestedLabel?: string;
  pendingQuestions: string[];
  requiredSlots?: string[] | null;
  slotStatus?: Record<string, "filled" | "missing"> | null;
  lastAnalyzerResult?: {
    ready: boolean;
    message: string;
    questions: string[];
    analyzedAt: string;
  } | null;
};

export type RequirementsStateJson = {
  lastSavedAt?: string;
  lastOrganizedAt?: string;
  selectedTargetId?: string | null;
  /** 좌측 멤버·멘션으로 지정한 질문 대상(복수) */
  selectedMembers?: Array<{ id: string; name: string }> | null;
  onboardingShown?: boolean;
  openIssues?: string;
  priorityFeatures?: string;
  /** 마지막으로 빌드되어 AI에 전달된 프롬프트(화면 복원·감사용) */
  lastPromptView?: RequirementsPromptPresenterView | null;
  /** 원문 프롬프트(복사·디버그용, 보통 `lastPromptView.copyText`) */
  lastPromptText?: string;
  lastPromptGeneratedAt?: string;
  /** 전송 전 입력창 초안(세션 간 복원) */
  lastUserDraftText?: string;
  /** AI 산출물 초안(회의 요약·문제정의서 등), 버전은 유형별로 증가 */
  deliverableAssets?: IdeationDeliverableAsset[] | null;
  /**
   * 정리 요청용 맥락(원문 대화는 `requirementsConversationJson`이 단일 소스).
   * `memoryFacts`·`rollingSummary`·`recentMessagesSnapshot`으로 AI 입력을 압축한다.
   */
  organizeContext?: RequirementsOrganizeContextV1 | null;
  /**
   * 정리요청(플래너 내부 리뷰) 상태: 부족한 슬롯이 있으면 1~2개 질문을 남기고,
   * 충분하면 산출물 생성(writer)로 이어진다.
   */
  organizePlannerState?: RequirementsOrganizePlannerState | null;
};

export function isRequirementsPromptPresenterView(v: unknown): v is RequirementsPromptPresenterView {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.copyText === "string" &&
    typeof o.roleText === "string" &&
    typeof o.projectName === "string" &&
    typeof o.projectDescription === "string" &&
    typeof o.stageText === "string" &&
    Array.isArray(o.recentSummaryBullets) &&
    typeof o.latestUserQuestion === "string" &&
    typeof o.targetName === "string"
  );
}

function isIdeationDeliverableType(v: unknown): v is IdeationDeliverableType {
  // keep permissive for forward-compat (server/client may add new types)
  return typeof v === "string" && v.trim().length > 0;
}

function parseOrganizePlannerState(raw: unknown): RequirementsOrganizePlannerState | undefined {
  if (raw === null) return undefined;
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const requestedType = isIdeationDeliverableType(o.requestedType) ? o.requestedType : "";
  const requestedLabel = typeof o.requestedLabel === "string" ? o.requestedLabel.trim() : "";
  const pendingQuestions = Array.isArray(o.pendingQuestions)
    ? o.pendingQuestions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4)
    : [];
  const requiredSlots =
    Array.isArray(o.requiredSlots)
      ? o.requiredSlots.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24)
      : o.requiredSlots === null
        ? null
        : undefined;
  if (!requestedType || pendingQuestions.length === 0) {
    // allow stored state with empty questions only if explicitly null (treated as no state)
    if (!requestedType) return undefined;
  }

  const slotStatusRaw = o.slotStatus;
  const slotStatus: Record<string, "filled" | "missing"> | null | undefined =
    slotStatusRaw && typeof slotStatusRaw === "object"
      ? (Object.fromEntries(
          Object.entries(slotStatusRaw as Record<string, unknown>).map(([k, v]) => {
            const key = String(k);
            const val: "filled" | "missing" = v === "filled" ? "filled" : "missing";
            return [key, val] as const;
          })
        ) as Record<string, "filled" | "missing">)
      : slotStatusRaw === null
        ? null
        : undefined;

  const lastRaw = o.lastAnalyzerResult;
  let lastAnalyzerResult: RequirementsOrganizePlannerState["lastAnalyzerResult"];
  if (lastRaw === null) lastAnalyzerResult = null;
  else if (lastRaw && typeof lastRaw === "object") {
    const r = lastRaw as Record<string, unknown>;
    const analyzedAt = typeof r.analyzedAt === "string" ? r.analyzedAt.trim() : "";
    const message = typeof r.message === "string" ? r.message.trim() : "";
    const ready = r.ready === true;
    const questions = Array.isArray(r.questions) ? r.questions.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4) : [];
    if (analyzedAt && message) {
      lastAnalyzerResult = { ready, message, questions, analyzedAt };
    }
  }

  return {
    requestedType,
    ...(requestedLabel ? { requestedLabel } : {}),
    pendingQuestions,
    ...(requiredSlots !== undefined ? { requiredSlots } : {}),
    ...(slotStatus !== undefined ? { slotStatus } : {}),
    ...(lastAnalyzerResult !== undefined ? { lastAnalyzerResult } : {}),
  };
}

export function parseRequirementsStateJson(raw: unknown): RequirementsStateJson {
  const root = unwrapDbJsonField(raw);
  if (!root || typeof root !== "object") return {};
  const o = root as Record<string, unknown>;
  const lastPromptViewRaw = o.lastPromptView;
  const lastPromptView =
    lastPromptViewRaw === null
      ? null
      : isRequirementsPromptPresenterView(lastPromptViewRaw)
        ? lastPromptViewRaw
        : undefined;

  return {
    lastSavedAt: typeof o.lastSavedAt === "string" ? o.lastSavedAt : undefined,
    lastOrganizedAt: typeof o.lastOrganizedAt === "string" ? o.lastOrganizedAt : undefined,
    selectedTargetId:
      typeof o.selectedTargetId === "string" ? o.selectedTargetId : o.selectedTargetId === null ? null : undefined,
    selectedMembers: Array.isArray(o.selectedMembers)
      ? (o.selectedMembers as unknown[])
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const id = typeof r.id === "string" ? r.id.trim() : "";
            const name = typeof r.name === "string" ? r.name.trim() : "";
            if (!id) return null;
            return { id, name: name || id };
          })
          .filter((x): x is { id: string; name: string } => Boolean(x))
      : o.selectedMembers === null
        ? null
        : undefined,
    onboardingShown: typeof o.onboardingShown === "boolean" ? o.onboardingShown : undefined,
    openIssues: typeof o.openIssues === "string" ? o.openIssues : undefined,
    priorityFeatures: typeof o.priorityFeatures === "string" ? o.priorityFeatures : undefined,
    ...(lastPromptView !== undefined ? { lastPromptView } : {}),
    lastPromptText: typeof o.lastPromptText === "string" ? o.lastPromptText : undefined,
    lastPromptGeneratedAt: typeof o.lastPromptGeneratedAt === "string" ? o.lastPromptGeneratedAt : undefined,
    lastUserDraftText: typeof o.lastUserDraftText === "string" ? o.lastUserDraftText : undefined,
    deliverableAssets: o.deliverableAssets === null ? null : parseDeliverableAssetsFromState(o.deliverableAssets),
    organizeContext: !("organizeContext" in o)
      ? undefined
      : o.organizeContext === null
        ? null
        : parseRequirementsOrganizeContextV1(o.organizeContext) ?? null,
    organizePlannerState: !("organizePlannerState" in o)
      ? undefined
      : o.organizePlannerState === null
        ? null
        : parseOrganizePlannerState(o.organizePlannerState) ?? null,
  };
}

export function mergeRequirementsStateJson(base: RequirementsStateJson, patch: Partial<RequirementsStateJson>): RequirementsStateJson {
  return { ...base, ...patch };
}
