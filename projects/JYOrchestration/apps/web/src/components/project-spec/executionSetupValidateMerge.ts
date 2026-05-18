import type {
  CursorApiValidationPayload,
  ExecutionSetupDto,
  GithubCapabilityValidationSnapshot,
} from "@/components/project-spec/api";

export type { CursorApiValidationPayload } from "@/components/project-spec/api";

export type ValidateResponseData = {
  status: ExecutionSetupDto["status"];
  lastValidatedAt: string | null;
  needsRevalidation?: boolean;
  lastValidationError?: string | null;
  repoConnectionOk?: boolean | null;
  githubAuthConnectionOk?: boolean | null;
  githubAuthValidatedAt?: string | null;
  githubAuthValidationError?: string | null;
  githubCapabilityValidation?: GithubCapabilityValidationSnapshot | null;
  cursorApiConnectionOk?: boolean | null;
  executorConnectionOk?: boolean | null;
  repoValidatedAt?: string | null;
  cursorApiValidatedAt?: string | null;
  executorValidatedAt?: string | null;
  repoValidationError?: string | null;
  cursorApiValidationError?: string | null;
  executorValidationError?: string | null;
  cursorApiValidation?: CursorApiValidationPayload | null;
};

/**
 * 검증 API 응답을 실행 설정에 병합합니다.
 * `??` 를 쓰지 않습니다 — 서버가 `null` 로 필드를 지울 때 이전 값이 남는 버그를 막기 위함입니다.
 */
export function mergeValidateIntoSetup(prev: ExecutionSetupDto, d: ValidateResponseData): ExecutionSetupDto {
  return {
    ...prev,
    status: d.status,
    lastValidatedAt: d.lastValidatedAt !== undefined ? d.lastValidatedAt : prev.lastValidatedAt,
    needsRevalidation: d.needsRevalidation !== undefined ? d.needsRevalidation : prev.needsRevalidation,
    lastValidationError:
      d.lastValidationError !== undefined ? d.lastValidationError ?? null : prev.lastValidationError ?? null,
    repoConnectionOk: d.repoConnectionOk !== undefined ? d.repoConnectionOk : prev.repoConnectionOk,
    githubAuthConnectionOk:
      d.githubAuthConnectionOk !== undefined ? d.githubAuthConnectionOk : prev.githubAuthConnectionOk,
    githubAuthValidatedAt:
      d.githubAuthValidatedAt !== undefined ? d.githubAuthValidatedAt ?? null : prev.githubAuthValidatedAt ?? null,
    githubAuthValidationError:
      d.githubAuthValidationError !== undefined
        ? d.githubAuthValidationError ?? null
        : prev.githubAuthValidationError ?? null,
    githubCapabilityValidation:
      d.githubCapabilityValidation !== undefined
        ? d.githubCapabilityValidation ?? null
        : prev.githubCapabilityValidation ?? null,
    cursorApiConnectionOk: d.cursorApiConnectionOk !== undefined ? d.cursorApiConnectionOk : prev.cursorApiConnectionOk,
    executorConnectionOk: d.executorConnectionOk !== undefined ? d.executorConnectionOk : prev.executorConnectionOk,
    repoValidatedAt: d.repoValidatedAt !== undefined ? d.repoValidatedAt ?? null : prev.repoValidatedAt ?? null,
    cursorApiValidatedAt:
      d.cursorApiValidatedAt !== undefined ? d.cursorApiValidatedAt ?? null : prev.cursorApiValidatedAt ?? null,
    executorValidatedAt:
      d.executorValidatedAt !== undefined ? d.executorValidatedAt ?? null : prev.executorValidatedAt ?? null,
    repoValidationError:
      d.repoValidationError !== undefined ? d.repoValidationError ?? null : prev.repoValidationError ?? null,
    cursorApiValidationError:
      d.cursorApiValidationError !== undefined ? d.cursorApiValidationError ?? null : prev.cursorApiValidationError ?? null,
    executorValidationError:
      d.executorValidationError !== undefined ? d.executorValidationError ?? null : prev.executorValidationError ?? null,
    cursorApiValidation:
      d.cursorApiValidation !== undefined ? d.cursorApiValidation ?? null : prev.cursorApiValidation,
  };
}
