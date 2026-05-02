"use client";

import { FixedToast } from "@/components/ui";

type WorkspaceSuccessErrorSaveToastHostProps = {
  success: string | null;
  error: string | null;
  savePulse?: boolean;
  savePulseLabel?: string;
};

/**
 * `FixedToast` 성공·오류·저장 펄스를 한 컴포넌트로 묶어 워크스페이스 JSX 중복을 줄입니다.
 */
export function WorkspaceSuccessErrorSaveToastHost({
  success,
  error,
  savePulse,
  savePulseLabel = "저장되었습니다 ✓",
}: WorkspaceSuccessErrorSaveToastHostProps) {
  return (
    <>
      {savePulse ? <FixedToast tone="save">{savePulseLabel}</FixedToast> : null}
      {success ? <FixedToast tone="success">{success}</FixedToast> : null}
      {error ? (
        <FixedToast tone="error" role="alert" aria-live="assertive">
          {error}
        </FixedToast>
      ) : null}
    </>
  );
}
