import type { RequirementsPromptPresenterView } from "@/lib/requirements/promptPresenter";
import type { IdeationDeliverableAsset, IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { parseDeliverableAssetsFromState } from "@/lib/requirements/ideationDeliverables";
import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
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
  /** 프로젝트 생성 시 입력한 원본 설명(프로젝트 카드 표시는 이 값만 사용) */
  originalProjectDescription?: string | null;
  /** 아이디어 구체화: 문제정의 인터뷰(반복 질문 방지용 슬롯 상태) */
  problemInterview?: ProblemInterviewState | null;
  /** 정리 요청 완료 시 아카이브 */
  problemInterviewHistory?: Array<{ archivedAt: string; state: ProblemInterviewState }> | null;
  /** 액터 및 서비스 흐름 정의(단계 2) — MVP v1 */
  serviceFlowV1?: RequirementsServiceFlowV1 | null;
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

export type RequirementsServiceFlowActorKind = "human" | "system";

export type RequirementsServiceFlowActorV1 = {
  id: string;
  name: string;
  kind: RequirementsServiceFlowActorKind;
  description?: string | null;
};

export type RequirementsServiceFlowStepV1 = {
  id: string;
  order: number;
  title: string;
  purpose: string;
  primaryActorId: string;
  secondaryActorIds: string[];
  approved: boolean;
  updatedAt: string;
};

export type RequirementsServiceFlowV1 = {
  createdAt: string;
  updatedAt: string;
  steps: RequirementsServiceFlowStepV1[];
  actors: RequirementsServiceFlowActorV1[];
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

  const serviceFlowRaw = "serviceFlowV1" in o ? (o.serviceFlowV1 as unknown) : undefined;
  const serviceFlowV1 =
    serviceFlowRaw === undefined
      ? undefined
      : serviceFlowRaw === null
        ? null
        : parseRequirementsServiceFlowV1(serviceFlowRaw) ?? null;

  const originalProjectDescriptionRaw = "originalProjectDescription" in o ? (o.originalProjectDescription as unknown) : undefined;
  const originalProjectDescription =
    originalProjectDescriptionRaw === undefined
      ? undefined
      : originalProjectDescriptionRaw === null
        ? null
        : typeof originalProjectDescriptionRaw === "string"
          ? originalProjectDescriptionRaw
          : String(originalProjectDescriptionRaw ?? "");

  const problemInterviewRaw = "problemInterview" in o ? (o.problemInterview as unknown) : undefined;
  const problemInterview =
    problemInterviewRaw === undefined
      ? undefined
      : problemInterviewRaw === null
        ? null
        : parseProblemInterview(problemInterviewRaw);

  const problemInterviewHistoryRaw = "problemInterviewHistory" in o ? (o.problemInterviewHistory as unknown) : undefined;
  const problemInterviewHistory =
    problemInterviewHistoryRaw === undefined
      ? undefined
      : problemInterviewHistoryRaw === null
        ? null
        : Array.isArray(problemInterviewHistoryRaw)
          ? (problemInterviewHistoryRaw as unknown[])
              .map((row) => {
                if (!row || typeof row !== "object") return null;
                const r = row as Record<string, unknown>;
                const archivedAt = typeof r.archivedAt === "string" ? r.archivedAt : "";
                const state = parseProblemInterview(r.state);
                if (!archivedAt || !state) return null;
                return { archivedAt, state };
              })
              .filter((x): x is { archivedAt: string; state: ProblemInterviewState } => Boolean(x))
              .slice(-24)
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
    ...(originalProjectDescription !== undefined ? { originalProjectDescription } : {}),
    ...(problemInterview !== undefined ? { problemInterview } : {}),
    ...(problemInterviewHistory !== undefined ? { problemInterviewHistory } : {}),
    ...(serviceFlowV1 !== undefined ? { serviceFlowV1 } : {}),
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

function parseProblemInterview(raw: unknown): ProblemInterviewState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const coreUser = typeof o.coreUser === "boolean" ? o.coreUser : false;
  const painPoint = typeof o.painPoint === "boolean" ? o.painPoint : false;
  const currentMethod = typeof o.currentMethod === "boolean" ? o.currentMethod : false;
  const needForImprovement = typeof o.needForImprovement === "boolean" ? o.needForImprovement : false;
  const coreFeatures = typeof o.coreFeatures === "boolean" ? o.coreFeatures : false;
  const mvpPriority = typeof o.mvpPriority === "boolean" ? o.mvpPriority : false;
  const kpiSuccess = typeof o.kpiSuccess === "boolean" ? o.kpiSuccess : false;
  const constraints = typeof o.constraints === "boolean" ? o.constraints : false;
  const operations = typeof o.operations === "boolean" ? o.operations : false;
  const notesRaw = o.notes && typeof o.notes === "object" ? (o.notes as Record<string, unknown>) : null;
  const notes: Record<string, string> = {};
  if (notesRaw) {
    for (const [k, v] of Object.entries(notesRaw)) {
      const key = String(k ?? "").trim();
      const val = typeof v === "string" ? v : String(v ?? "");
      if (key && val.trim()) notes[key] = val.trim().slice(0, 8000);
    }
  }
  const partialRaw = o.partial && typeof o.partial === "object" ? (o.partial as Record<string, unknown>) : null;
  const partial: Record<string, boolean> = {};
  if (partialRaw) {
    for (const [k, v] of Object.entries(partialRaw)) {
      const key = String(k ?? "").trim();
      if (!key) continue;
      partial[key] = v === true;
    }
  }
  const askedSlotsRaw = Array.isArray(o.askedSlots) ? (o.askedSlots as unknown[]) : null;
  const askedSlots = askedSlotsRaw ? askedSlotsRaw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 32) : undefined;
  const active = typeof o.active === "boolean" ? o.active : undefined;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : undefined;
  return {
    coreUser,
    painPoint,
    currentMethod,
    needForImprovement,
    coreFeatures,
    mvpPriority,
    kpiSuccess,
    constraints,
    operations,
    notes,
    ...(Object.keys(partial).length ? { partial } : {}),
    ...(askedSlots ? { askedSlots: askedSlots as any } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function parseRequirementsServiceFlowV1(raw: unknown): RequirementsServiceFlowV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  const stepsRaw = Array.isArray(o.steps) ? (o.steps as unknown[]) : [];
  const actorsRaw = Array.isArray(o.actors) ? (o.actors as unknown[]) : [];
  const steps: RequirementsServiceFlowStepV1[] = stepsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const order = typeof r.order === "number" && Number.isFinite(r.order) ? r.order : NaN;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const purpose = typeof r.purpose === "string" ? r.purpose.trim() : "";
      const primaryActorId = typeof r.primaryActorId === "string" ? r.primaryActorId.trim() : "";
      const secondaryActorIds = Array.isArray(r.secondaryActorIds)
        ? (r.secondaryActorIds as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
      const approved = typeof r.approved === "boolean" ? r.approved : false;
      const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : "";
      if (!id || !Number.isFinite(order) || !title || !purpose || !primaryActorId || !updatedAt) return null;
      return { id, order, title, purpose, primaryActorId, secondaryActorIds, approved, updatedAt };
    })
    .filter((x): x is RequirementsServiceFlowStepV1 => Boolean(x));

  const actors: RequirementsServiceFlowActorV1[] = actorsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const kind = r.kind === "human" || r.kind === "system" ? (r.kind as RequirementsServiceFlowActorKind) : null;
      const description =
        r.description === null ? null : typeof r.description === "string" ? r.description.trim() : undefined;
      if (!id || !name || !kind) return null;
      return { id, name, kind, ...(description !== undefined ? { description } : {}) };
    })
    .filter((x): x is RequirementsServiceFlowActorV1 => Boolean(x));

  if (!createdAt || !updatedAt) return null;
  return { createdAt, updatedAt, steps, actors };
}
