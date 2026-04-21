import type { RequirementsPromptPresenterView } from "@/lib/requirements/promptPresenter";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { parseDeliverableAssetsFromState } from "@/lib/requirements/ideationDeliverables";

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
  /** 4/4 완료 안내 AI 메시지를 대화에 1회만 삽입했는지 */
  ideationCompletionAiNoticeSent?: boolean;
  /** AI 산출물 초안(회의 요약·문제정의서 등), 버전은 유형별로 증가 */
  deliverableAssets?: IdeationDeliverableAsset[] | null;
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
    ideationCompletionAiNoticeSent:
      typeof o.ideationCompletionAiNoticeSent === "boolean" ? o.ideationCompletionAiNoticeSent : undefined,
    deliverableAssets: o.deliverableAssets === null ? null : parseDeliverableAssetsFromState(o.deliverableAssets),
  };
}

export function mergeRequirementsStateJson(base: RequirementsStateJson, patch: Partial<RequirementsStateJson>): RequirementsStateJson {
  return { ...base, ...patch };
}
