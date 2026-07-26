/**
 * Admin workbench step5 — 승인·게시 readiness ViewModel.
 */

import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { collectReviewWarnings } from "@/lib/admin-review-decision";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import type { AdminServiceChannelGatesSnapshot } from "@/lib/role-workspace/admin-service-validation-view-model";

export type AdminApprovalPublishStatus =
  | "BLOCKED"
  | "READY_TO_DECIDE"
  | "APPROVED"
  | "PUBLISHED";

export type AdminApprovalChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
};

export type AdminApprovalPublishViewModel = {
  status: AdminApprovalPublishStatus;
  blockedReasons: string[];
  warnings: string[];
  canDecide: boolean;
  primaryLabel: string;
  summaryMessage: string;
  checklist: AdminApprovalChecklistItem[];
};

export function buildAdminApprovalPublishViewModel(input: {
  detail: AdminReviewDetailDto | null;
  providerConfirmed: boolean;
  serviceDone: boolean;
  openSupplement: boolean;
  quality: AdminQualityGateSnapshot;
  workerZipPhase: AdminWorkerZipPhase;
  channelGates?: AdminServiceChannelGatesSnapshot | null;
}): AdminApprovalPublishViewModel {
  const packStatus = input.detail?.pack.status ?? null;
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  if (input.workerZipPhase !== "COMPLETED") {
    blockedReasons.push(
      `지식데이터 생성이 완료되지 않았습니다. (현재: ${input.workerZipPhase})`,
    );
  }
  if (!input.quality.completed) {
    blockedReasons.push("품질점검을 먼저 완료해야 합니다.");
  }
  if (input.quality.hasBlockers || input.quality.failCount > 0) {
    blockedReasons.push("품질점검 차단 이슈(FAIL)가 있어 승인할 수 없습니다.");
  }
  if (!input.providerConfirmed) {
    blockedReasons.push("제공자 확인이 완료되지 않았습니다.");
  }
  if (input.openSupplement) {
    blockedReasons.push("열린 제공자 보완요청을 먼저 처리해야 합니다.");
  }
  if (!input.serviceDone) {
    blockedReasons.push("서비스 검증이 완료되지 않았습니다.");
  }

  if (input.quality.hasWarnings) {
    warnings.push("품질점검에 WARNING이 있습니다. 승인 전 내용을 확인하세요.");
  }
  if (input.detail) {
    for (const w of collectReviewWarnings(input.detail)) {
      if (!warnings.includes(w)) warnings.push(w);
    }
  }
  const gates = input.channelGates;
  if (gates && gates.bindingStatus && gates.bindingStatus !== "CURRENT") {
    warnings.push(
      gates.bindingReason ??
        "서비스 채널은 통과했더라도 최신 산출물 바인딩을 다시 확인하세요.",
    );
  }

  const checklist: AdminApprovalChecklistItem[] = [
    {
      id: "queue",
      label: "자료 접수",
      done:
        input.workerZipPhase !== "NONE" &&
        input.workerZipPhase !== "REQUESTED" &&
        input.workerZipPhase !== "REJECTED",
    },
    {
      id: "generation",
      label: "생성·품질보정",
      done:
        input.workerZipPhase === "COMPLETED" &&
        input.quality.completed &&
        !input.quality.hasBlockers &&
        input.quality.failCount === 0,
      detail:
        input.quality.hasBlockers || input.quality.failCount > 0
          ? "품질 차단 이슈를 해소하세요."
          : undefined,
    },
    {
      id: "provider",
      label: "제공자 검토",
      done: input.providerConfirmed && !input.openSupplement,
      detail: input.openSupplement
        ? "보완요청 처리 필요"
        : input.providerConfirmed
          ? undefined
          : "제공자 확인 필요",
    },
    {
      id: "service",
      label: "서비스 검증",
      done: input.serviceDone,
    },
    {
      id: "distribution",
      label: "유통정보/채널 설정",
      done: Boolean(
        input.detail?.distribution?.licenseName?.trim() ||
          input.detail?.pack.status === "REVIEWING" ||
          input.detail?.pack.status === "PUBLISHED" ||
          input.detail?.pack.status === "VERIFIED",
      ),
    },
  ];

  if (packStatus === "PUBLISHED" || packStatus === "VERIFIED") {
    return {
      status: "PUBLISHED",
      blockedReasons: [],
      warnings,
      canDecide: false,
      primaryLabel: "공개 상태 확인",
      summaryMessage:
        packStatus === "VERIFIED"
          ? "검증 완료(VERIFIED) 상태입니다."
          : "공개(PUBLISHED) 상태입니다.",
      checklist: checklist.map((c) => ({ ...c, done: true })),
    };
  }

  if (packStatus === "REVIEWING" && blockedReasons.length === 0) {
    // Accepted or pending decision — ready for accept tab actions
  }

  const canDecide = blockedReasons.length === 0;
  if (canDecide) {
    return {
      status: "READY_TO_DECIDE",
      blockedReasons: [],
      warnings,
      canDecide: true,
      primaryLabel: "최종 승인·반려 진행",
      summaryMessage: "최종 게이트를 통과했습니다. 승인 또는 반려를 진행하세요.",
      checklist,
    };
  }

  return {
    status: "BLOCKED",
    blockedReasons,
    warnings,
    canDecide: false,
    primaryLabel: "승인 전 차단 조건 해소 필요",
    summaryMessage: blockedReasons[0] ?? "승인·게시 전 조건을 확인하세요.",
    checklist,
  };
}
