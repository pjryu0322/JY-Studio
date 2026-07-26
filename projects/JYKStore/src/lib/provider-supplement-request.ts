/**
 * Provider → Admin 보완요청 lifecycle (PipelineRun marker, no DB enum migration).
 *
 * triggerType: STORE_PROVIDER_SUPPLEMENT
 *   PENDING  → 접수 대기
 *   RUNNING  → 관리자 처리 중
 *   PASS     → 보완 완료
 *   FAIL     → 반려됨
 *   WARNING  → 제공자 추가 확인 필요
 *   SKIPPED  → 철회/무효
 */

import type { ProviderChangesRequestPayload } from "@/lib/provider-review-workbench";
import {
  PROVIDER_CHANGES_REQUEST_TARGETS,
  PROVIDER_CHANGES_REQUEST_TYPES,
} from "@/lib/provider-review-workbench";

export const STORE_PROVIDER_SUPPLEMENT_TRIGGER = "STORE_PROVIDER_SUPPLEMENT";

export const PROVIDER_SUPPLEMENT_SUMMARY_KIND = "provider_supplement_request" as const;

export type ProviderSupplementAdminPhase =
  | "PENDING"
  | "ACCEPTED"
  | "RESOLVED"
  | "REJECTED"
  | "CLARIFY"
  | "WITHDRAWN";

export type ProviderSupplementHistoryEntry = {
  at: string;
  action:
    | "SUBMIT"
    | "ACCEPT"
    | "RESOLVE"
    | "REJECT"
    | "CLARIFY"
    | "NOTE"
    | "WITHDRAW"
    | "REQUEST_REVIEW_AGAIN";
  byRole: "PROVIDER" | "ADMIN";
  note?: string;
};

export type ProviderSupplementRequestState = {
  v: 1;
  kind: typeof PROVIDER_SUPPLEMENT_SUMMARY_KIND;
  changeType: ProviderChangesRequestPayload["changeType"];
  targetKind: ProviderChangesRequestPayload["targetKind"];
  targetLabel: string | null;
  details: string;
  submittedAt: string;
  adminPhase: ProviderSupplementAdminPhase;
  acceptedAt: string | null;
  acceptedByClientId: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  /** When resolve suggests admin re-enter generation/quality. */
  nextAdminStep: "NONE" | "WORKER_REPROCESS" | "QUALITY_RECHECK" | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  clarifyAt: string | null;
  clarifyMessage: string | null;
  providerNotes: Array<{ at: string; text: string; clientId: string }>;
  history: ProviderSupplementHistoryEntry[];
};

export type ProviderSupplementPipelineStatus =
  | "PENDING"
  | "RUNNING"
  | "PASS"
  | "FAIL"
  | "WARNING"
  | "SKIPPED"
  | "NONE";

export function mapSupplementStatusToAdminPhase(
  status: string | null | undefined,
): ProviderSupplementAdminPhase | "NONE" {
  switch (status) {
    case "PENDING":
      return "PENDING";
    case "RUNNING":
      return "ACCEPTED";
    case "PASS":
      return "RESOLVED";
    case "FAIL":
      return "REJECTED";
    case "WARNING":
      return "CLARIFY";
    case "SKIPPED":
      return "WITHDRAWN";
    default:
      return "NONE";
  }
}

export function mapAdminPhaseToPipelineStatus(
  phase: ProviderSupplementAdminPhase,
): Exclude<ProviderSupplementPipelineStatus, "NONE"> {
  switch (phase) {
    case "PENDING":
      return "PENDING";
    case "ACCEPTED":
      return "RUNNING";
    case "RESOLVED":
      return "PASS";
    case "REJECTED":
      return "FAIL";
    case "CLARIFY":
      return "WARNING";
    case "WITHDRAWN":
      return "SKIPPED";
  }
}

export function encodeProviderSupplementRequestState(
  state: ProviderSupplementRequestState,
): string {
  return JSON.stringify(state);
}

export function parseProviderSupplementRequestState(
  summary: string | null | undefined,
): ProviderSupplementRequestState | null {
  if (!summary?.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(summary) as Partial<ProviderSupplementRequestState> & {
      kind?: string;
      v?: number;
    };
    if (parsed.kind !== PROVIDER_SUPPLEMENT_SUMMARY_KIND) return null;
    if (typeof parsed.details !== "string" || !parsed.details.trim()) return null;
    if (typeof parsed.changeType !== "string" || typeof parsed.targetKind !== "string") {
      return null;
    }
    const adminPhase = (parsed.adminPhase ?? "PENDING") as ProviderSupplementAdminPhase;
    return {
      v: 1,
      kind: PROVIDER_SUPPLEMENT_SUMMARY_KIND,
      changeType: parsed.changeType as ProviderChangesRequestPayload["changeType"],
      targetKind: parsed.targetKind as ProviderChangesRequestPayload["targetKind"],
      targetLabel:
        typeof parsed.targetLabel === "string" ? parsed.targetLabel : null,
      details: parsed.details.trim(),
      submittedAt:
        typeof parsed.submittedAt === "string"
          ? parsed.submittedAt
          : new Date(0).toISOString(),
      adminPhase,
      acceptedAt: typeof parsed.acceptedAt === "string" ? parsed.acceptedAt : null,
      acceptedByClientId:
        typeof parsed.acceptedByClientId === "string"
          ? parsed.acceptedByClientId
          : null,
      resolvedAt: typeof parsed.resolvedAt === "string" ? parsed.resolvedAt : null,
      resolutionNote:
        typeof parsed.resolutionNote === "string" ? parsed.resolutionNote : null,
      nextAdminStep:
        parsed.nextAdminStep === "WORKER_REPROCESS" ||
        parsed.nextAdminStep === "QUALITY_RECHECK" ||
        parsed.nextAdminStep === "NONE"
          ? parsed.nextAdminStep
          : null,
      rejectedAt: typeof parsed.rejectedAt === "string" ? parsed.rejectedAt : null,
      rejectionReason:
        typeof parsed.rejectionReason === "string" ? parsed.rejectionReason : null,
      clarifyAt: typeof parsed.clarifyAt === "string" ? parsed.clarifyAt : null,
      clarifyMessage:
        typeof parsed.clarifyMessage === "string" ? parsed.clarifyMessage : null,
      providerNotes: Array.isArray(parsed.providerNotes)
        ? parsed.providerNotes.filter(
            (n): n is { at: string; text: string; clientId: string } =>
              Boolean(n) &&
              typeof n === "object" &&
              typeof (n as { at?: unknown }).at === "string" &&
              typeof (n as { text?: unknown }).text === "string" &&
              typeof (n as { clientId?: unknown }).clientId === "string",
          )
        : [],
      history: Array.isArray(parsed.history)
        ? parsed.history.filter(
            (h): h is ProviderSupplementHistoryEntry =>
              Boolean(h) &&
              typeof h === "object" &&
              typeof (h as { at?: unknown }).at === "string" &&
              typeof (h as { action?: unknown }).action === "string" &&
              typeof (h as { byRole?: unknown }).byRole === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

/** Build initial state when provider submits a structured 보완요청. */
export function buildInitialProviderSupplementState(input: {
  changesRequest: ProviderChangesRequestPayload;
  submittedAt?: string;
  clientId: string;
}): ProviderSupplementRequestState {
  const at = input.submittedAt ?? new Date().toISOString();
  return {
    v: 1,
    kind: PROVIDER_SUPPLEMENT_SUMMARY_KIND,
    changeType: input.changesRequest.changeType,
    targetKind: input.changesRequest.targetKind,
    targetLabel: input.changesRequest.targetLabel?.trim() || null,
    details: input.changesRequest.details.trim(),
    submittedAt: at,
    adminPhase: "PENDING",
    acceptedAt: null,
    acceptedByClientId: null,
    resolvedAt: null,
    resolutionNote: null,
    nextAdminStep: null,
    rejectedAt: null,
    rejectionReason: null,
    clarifyAt: null,
    clarifyMessage: null,
    providerNotes: [],
    history: [
      {
        at,
        action: "SUBMIT",
        byRole: "PROVIDER",
        note: input.changesRequest.details.trim().slice(0, 200),
      },
    ],
  };
}

export function changeTypeLabel(changeType: string): string {
  return (
    PROVIDER_CHANGES_REQUEST_TYPES.find((t) => t.value === changeType)?.label ?? changeType
  );
}

export function targetKindLabel(targetKind: string): string {
  return (
    PROVIDER_CHANGES_REQUEST_TARGETS.find((t) => t.value === targetKind)?.label ??
    targetKind
  );
}

export type ProviderSupplementRequestViewModel = {
  displayStatus: string;
  statusTone: "info" | "warning" | "success" | "danger";
  headline: string;
  guidance: string;
  adminProcessingState: string;
  primaryActions: Array<{ id: string; label: string }>;
  secondaryActions: Array<{ id: string; label: string }>;
  canEditSource: boolean;
  canWithdraw: boolean;
  canAddNote: boolean;
  showMaterialsLink: boolean;
};

export function buildProviderSupplementRequestViewModel(
  state: ProviderSupplementRequestState | null,
): ProviderSupplementRequestViewModel | null {
  if (!state) return null;

  switch (state.adminPhase) {
    case "PENDING":
      return {
        displayStatus: "보완요청 제출됨",
        statusTone: "info",
        headline: "관리자에게 보완요청이 제출되었습니다.",
        guidance:
          "관리자가 요청사항을 확인하고 있습니다. 처리 결과가 등록되면 다시 검토할 수 있습니다.",
        adminProcessingState: "접수 대기",
        primaryActions: [
          { id: "view_request", label: "요청 내용 보기" },
          { id: "add_note", label: "추가 의견 남기기" },
        ],
        secondaryActions: [{ id: "withdraw", label: "요청 철회" }],
        canEditSource: false,
        canWithdraw: true,
        canAddNote: true,
        showMaterialsLink: false,
      };
    case "ACCEPTED":
      return {
        displayStatus: "보완 요청 처리 중",
        statusTone: "warning",
        headline: "관리자가 보완 요청을 접수해 처리 중입니다.",
        guidance: "처리가 완료되면 이 화면에 결과가 표시됩니다. 잠시만 기다려 주세요.",
        adminProcessingState: "처리 중",
        primaryActions: [
          { id: "view_request", label: "요청 내용 보기" },
          { id: "add_note", label: "추가 의견 남기기" },
        ],
        secondaryActions: [],
        canEditSource: false,
        canWithdraw: false,
        canAddNote: true,
        showMaterialsLink: false,
      };
    case "CLARIFY":
      return {
        displayStatus: "추가 확인 필요",
        statusTone: "warning",
        headline: "관리자가 추가 확인을 요청했습니다.",
        guidance:
          "아래 관리자 메시지를 확인한 뒤 추가 의견을 남겨 주세요. 필요하면 자료를 보완할 수 있습니다.",
        adminProcessingState: "제공자 추가 확인 필요",
        primaryActions: [
          { id: "add_note", label: "추가 의견 남기기" },
          { id: "view_request", label: "요청 내용 보기" },
        ],
        secondaryActions: [{ id: "go_materials", label: "자료등록으로 이동" }],
        canEditSource: true,
        canWithdraw: false,
        canAddNote: true,
        showMaterialsLink: true,
      };
    case "REJECTED":
      return {
        displayStatus: "보완 요청 반려됨",
        statusTone: "danger",
        headline: "관리자가 보완 요청을 반려했습니다.",
        guidance:
          "반려 사유를 확인한 뒤 필요하면 자료를 수정하고 생성 결과 검토를 다시 진행하세요.",
        adminProcessingState: "반려됨",
        primaryActions: [{ id: "view_request", label: "요청·반려 사유 보기" }],
        secondaryActions: [{ id: "go_materials", label: "자료등록으로 이동" }],
        canEditSource: true,
        canWithdraw: false,
        canAddNote: false,
        showMaterialsLink: true,
      };
    case "RESOLVED":
      return {
        displayStatus: "보완 완료",
        statusTone: "success",
        headline: "관리자가 보완 처리를 완료했습니다.",
        guidance:
          "처리 내용을 확인하세요. 관리자 안내에 따라 재검토하거나 다음 단계를 진행합니다.",
        adminProcessingState: "보완 완료",
        primaryActions: [{ id: "view_request", label: "처리 결과 보기" }],
        secondaryActions: [],
        canEditSource: false,
        canWithdraw: false,
        canAddNote: false,
        showMaterialsLink: false,
      };
    case "WITHDRAWN":
      return {
        displayStatus: "요청 철회됨",
        statusTone: "info",
        headline: "보완 요청을 철회했습니다.",
        guidance: "필요하면 생성 결과 검토에서 다시 보완 요청을 제출할 수 있습니다.",
        adminProcessingState: "철회됨",
        primaryActions: [],
        secondaryActions: [{ id: "go_materials", label: "자료등록으로 이동" }],
        canEditSource: true,
        canWithdraw: false,
        canAddNote: false,
        showMaterialsLink: true,
      };
  }
}

export type AdminSupplementQueueDisplay = {
  displayStatus: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

export type AdminSupplementAction =
  | "ACCEPT"
  | "ADMIN_FIX"
  | "RUN_REPROCESS"
  | "ASK_PROVIDER_MORE_INFO"
  | "REJECT"
  | "REQUEST_PROVIDER_REVIEW_AGAIN";

export type AdminSupplementHandlingHint = {
  owner: "ADMIN" | "PROVIDER" | "EITHER";
  title: string;
  guidance: string;
};

export type AdminSupplementRequestViewModel = {
  displayStatus: string;
  adminQueueGroup: "PROVIDER_SUPPLEMENT_REQUIRED";
  summary: string;
  issueTypeLabel: string;
  targetKindLabel: string;
  targetLabel: string | null;
  details: string;
  requestedAt: string;
  issueCount: number;
  availableActions: AdminSupplementAction[];
  handlingHint: AdminSupplementHandlingHint;
  evidenceLinks: Array<{ id: string; label: string; step: string }>;
};

/** Classify whether admin can fix in-house or should return to provider. */
export function resolveSupplementHandlingHint(
  changeType: ProviderChangesRequestPayload["changeType"],
): AdminSupplementHandlingHint {
  switch (changeType) {
    case "CHUNKING":
      return {
        owner: "ADMIN",
        title: "관리자 보완 가능",
        guidance:
          "Chunk 분리·병합 오류로 보입니다. 청킹 규칙 조정 후 Worker 재처리하거나 품질점검을 다시 실행하세요.",
      };
    case "RETRIEVAL":
      return {
        owner: "ADMIN",
        title: "관리자 보완 가능",
        guidance:
          "검색 결과 부정확 이슈입니다. retrieval chunk·키워드·임베딩/재순위 설정을 점검한 뒤 재처리하세요.",
      };
    case "STRUCTURE":
      return {
        owner: "ADMIN",
        title: "관리자 보완 가능",
        guidance:
          "구조화·원문 매핑 문제로 보입니다. 파서/정규화·섹션 매핑을 점검한 뒤 재처리하세요.",
      };
    case "MISSING":
      return {
        owner: "PROVIDER",
        title: "제공자 확인 필요",
        guidance:
          "원본 문서 누락·내용 오류 가능성이 큽니다. 관리자가 임의로 고치지 말고 추가 확인 요청 또는 반려하세요.",
      };
    case "OTHER":
    default:
      return {
        owner: "EITHER",
        title: "조치 판단 필요",
        guidance:
          "요청 근거를 확인한 뒤 관리자 보완, 추가 확인 요청, 반려 중 하나를 선택하세요. 원본·라이선스 문제는 제공자에게 되돌리세요.",
      };
  }
}

export function buildAdminSupplementAvailableActions(
  phase: ProviderSupplementAdminPhase | "NONE",
): AdminSupplementAction[] {
  switch (phase) {
    case "PENDING":
      return ["ACCEPT"];
    case "ACCEPTED":
      return ["ADMIN_FIX", "RUN_REPROCESS", "ASK_PROVIDER_MORE_INFO", "REJECT"];
    case "CLARIFY":
      return ["ADMIN_FIX", "ASK_PROVIDER_MORE_INFO", "REJECT"];
    case "RESOLVED":
      return ["REQUEST_PROVIDER_REVIEW_AGAIN", "RUN_REPROCESS"];
    case "REJECTED":
    case "WITHDRAWN":
    case "NONE":
    default:
      return [];
  }
}

export function buildAdminSupplementRequestViewModel(
  state: ProviderSupplementRequestState,
): AdminSupplementRequestViewModel {
  const display = buildAdminSupplementQueueDisplay(state.adminPhase);
  const summary =
    state.details.trim().length > 80
      ? `${state.details.trim().slice(0, 80)}…`
      : state.details.trim();
  return {
    displayStatus: display.displayStatus,
    adminQueueGroup: "PROVIDER_SUPPLEMENT_REQUIRED",
    summary,
    issueTypeLabel: changeTypeLabel(state.changeType),
    targetKindLabel: targetKindLabel(state.targetKind),
    targetLabel: state.targetLabel,
    details: state.details,
    requestedAt: state.submittedAt,
    issueCount: 1,
    availableActions: buildAdminSupplementAvailableActions(state.adminPhase),
    handlingHint: resolveSupplementHandlingHint(state.changeType),
    evidenceLinks: [
      { id: "generation", label: "생성·재처리", step: "generation" },
      { id: "quality", label: "품질점검", step: "quality" },
      { id: "providerConfirm", label: "제공자 검토 단계", step: "providerConfirm" },
    ],
  };
}

export function buildAdminSupplementQueueDisplay(
  phase: ProviderSupplementAdminPhase | "NONE",
): AdminSupplementQueueDisplay {
  switch (phase) {
    case "PENDING":
      return {
        displayStatus: "보완요청 접수 대기",
        ctaLabel: "요청사항 확인",
        isWaitingForAdmin: true,
      };
    case "ACCEPTED":
      return {
        displayStatus: "보완요청 처리 중",
        ctaLabel: "조치하기",
        isWaitingForAdmin: true,
      };
    case "CLARIFY":
      return {
        displayStatus: "제공자 추가 확인 필요",
        ctaLabel: "요청 상세 보기",
        isWaitingForAdmin: false,
      };
    case "RESOLVED":
      return {
        displayStatus: "보완 완료",
        ctaLabel: "재검토 요청",
        isWaitingForAdmin: true,
      };
    case "REJECTED":
      return {
        displayStatus: "반려됨",
        ctaLabel: "요청 상세 보기",
        isWaitingForAdmin: false,
      };
    case "WITHDRAWN":
    case "NONE":
    default:
      return {
        displayStatus: "기타",
        ctaLabel: "상세 보기",
        isWaitingForAdmin: false,
      };
  }
}

/** Open (admin-visible) pipeline statuses for the supplement queue. */
export const OPEN_SUPPLEMENT_PIPELINE_STATUSES = [
  "PENDING",
  "RUNNING",
  "WARNING",
  "PASS",
  "FAIL",
] as const;
