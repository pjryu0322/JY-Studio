import type { ExecutionSetupDto } from "@/components/project-spec/api";

export type CursorApiValidationPayload = {
  overallOk: boolean;
  stages: Array<{
    stage: "config" | "connectivity" | "auth" | "readiness";
    status: "pass" | "fail" | "skip";
    reason?: string;
    latencyMs?: number;
    detail?: string;
  }>;
  summaryKr: string;
  detailLines: string[];
};

export type ValidateResponseData = {
  status: ExecutionSetupDto["status"];
  lastValidatedAt: string | null;
  needsRevalidation?: boolean;
  lastValidationError?: string | null;
  repoConnectionOk?: boolean | null;
  executorConnectionOk?: boolean | null;
  repoValidatedAt?: string | null;
  executorValidatedAt?: string | null;
  repoValidationError?: string | null;
  executorValidationError?: string | null;
  cursorApiValidation?: CursorApiValidationPayload;
};

export function mergeValidateIntoSetup(prev: ExecutionSetupDto, d: ValidateResponseData): ExecutionSetupDto {
  return {
    ...prev,
    status: d.status,
    lastValidatedAt: d.lastValidatedAt ?? prev.lastValidatedAt,
    needsRevalidation: d.needsRevalidation ?? prev.needsRevalidation,
    lastValidationError: d.lastValidationError ?? null,
    repoConnectionOk: d.repoConnectionOk ?? prev.repoConnectionOk ?? null,
    executorConnectionOk: d.executorConnectionOk ?? prev.executorConnectionOk ?? null,
    repoValidatedAt: d.repoValidatedAt ?? prev.repoValidatedAt ?? null,
    executorValidatedAt: d.executorValidatedAt ?? prev.executorValidatedAt ?? null,
    repoValidationError: d.repoValidationError ?? prev.repoValidationError ?? null,
    executorValidationError: d.executorValidationError ?? prev.executorValidationError ?? null,
  };
}
