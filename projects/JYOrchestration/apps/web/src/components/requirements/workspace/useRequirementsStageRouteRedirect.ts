"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * `/requirements?...&stage=features|execution|prototype-review` 는 전용 라우트로 보냅니다.
 * `service-flow|feature-planning` 은 SingleChat 통합 화면 정책에 따라 stage를 제거합니다.
 */
export function useRequirementsStageRouteRedirect(initialProjectId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const pid = String(searchParams?.get("projectId") ?? initialProjectId ?? "").trim();
    if (!pid) return;
    const stage = String(searchParams?.get("stage") ?? "").trim().toLowerCase();
    if (stage === "service-flow" || stage === "service_flow" || stage === "feature-planning" || stage === "feature_planning") {
      router.replace(`/requirements?projectId=${encodeURIComponent(pid)}`);
      return;
    }
    if (stage === "features") {
      router.replace(`/requirements?projectId=${encodeURIComponent(pid)}`);
      return;
    }
    if (stage === "execution") router.replace(`/execution?projectId=${encodeURIComponent(pid)}`);
    if (stage === "prototype-review") router.replace(`/prototype-review?projectId=${encodeURIComponent(pid)}`);
  }, [router, searchParams, initialProjectId]);
}
