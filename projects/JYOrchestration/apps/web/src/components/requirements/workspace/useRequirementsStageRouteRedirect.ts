"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * `/requirements?...&stage=features|execution|prototype-review` 는 전용 라우트로 보냅니다.
 */
export function useRequirementsStageRouteRedirect(initialProjectId: string, initialStage: string | undefined) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const pid = String(searchParams?.get("projectId") ?? initialProjectId ?? "").trim();
    if (!pid) return;
    const stage = String(searchParams?.get("stage") ?? initialStage ?? "").trim().toLowerCase();
    if (stage === "features") router.replace(`/features?projectId=${encodeURIComponent(pid)}`);
    if (stage === "execution") router.replace(`/execution?projectId=${encodeURIComponent(pid)}`);
    if (stage === "prototype-review") router.replace(`/prototype-review?projectId=${encodeURIComponent(pid)}`);
  }, [router, searchParams, initialProjectId, initialStage]);
}
