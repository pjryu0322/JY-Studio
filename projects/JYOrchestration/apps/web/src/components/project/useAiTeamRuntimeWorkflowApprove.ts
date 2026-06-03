"use client";

import { useCallback, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

type ApproveResult = { success: boolean; message?: string };

export function useAiTeamRuntimeWorkflowApprove(onApproved?: () => void | Promise<void>) {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const approve = useCallback(
    async (taskId: string) => {
      const tid = taskId.trim();
      if (!tid || approving) return;
      setApproving(true);
      setSuccessMessage(null);
      setError(null);
      try {
        const res = await credentialsIncludeFetch("/api/task/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: tid,
            action: "workflow-approve-ai-team-runtime",
          }),
        });
        const json = (await res.json()) as ApproveResult;
        if (!res.ok || !json.success) {
          setError(json.message ?? "승인 요청에 실패했습니다.");
          return;
        }
        setSuccessMessage("승인 완료. 동일 Task 실행 시 merge 단계로 진행됩니다.");
        await onApproved?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "승인 요청 중 오류가 발생했습니다.");
      } finally {
        setApproving(false);
      }
    },
    [approving, onApproved],
  );

  return { approving, error, successMessage, approve };
}
