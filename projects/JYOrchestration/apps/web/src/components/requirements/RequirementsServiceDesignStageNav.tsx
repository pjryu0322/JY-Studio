"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import { uiTokens as t } from "@/components/ui/tokens";

function requirementsHref(projectId: string, stage: RequirementsWorkspaceStage): string {
  const pid = projectId.trim();
  const q = encodeURIComponent(pid);
  if (stage === "ideation") return `/requirements?projectId=${q}`;
  return `/requirements?projectId=${q}&stage=${stage}`;
}

const stepShell = (active: boolean, enabled: boolean): CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: active ? 800 : 600,
  textDecoration: "none",
  whiteSpace: "nowrap",
  border: `1px solid ${active ? t.borderStrong : t.border}`,
  background: active ? t.surfaceInfoSoft : t.bgPage,
  color: enabled ? t.textSecondary : t.textMuted,
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.5,
});

export function RequirementsServiceDesignStageNav({
  projectId,
  activeStage,
  ideationReadyForServiceFlow,
  serviceFlowReadyForFeaturePlanning,
}: Readonly<{
  projectId: string;
  activeStage: RequirementsWorkspaceStage;
  ideationReadyForServiceFlow: boolean;
  serviceFlowReadyForFeaturePlanning: boolean;
}>) {
  const router = useRouter();
  const pid = projectId.trim();

  const step1Active = activeStage === "ideation";
  const step2Active = activeStage === "service-flow";
  const step3Active = activeStage === "feature-planning";

  const step2Reachable = ideationReadyForServiceFlow;
  const step3Reachable = serviceFlowReadyForFeaturePlanning;

  const pill = (label: string, active: boolean, reachable: boolean, href: string | null) => {
    const enabled = reachable || active;
    const style = stepShell(active, enabled);
    if (href && enabled) {
      return (
        <Link href={href} prefetch={false} style={style}>
          {label}
        </Link>
      );
    }
    return (
      <span style={style} aria-disabled>
        {label}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4, marginBottom: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {pill("아이디어 구체화", step1Active, true, requirementsHref(pid, "ideation"))}
        <span style={{ color: t.textMuted, fontSize: 12 }} aria-hidden>
          →
        </span>
        {pill(
          "액터/흐름 정의",
          step2Active,
          step2Reachable,
          step2Reachable || step2Active ? requirementsHref(pid, "service-flow") : null
        )}
        <span style={{ color: t.textMuted, fontSize: 12 }} aria-hidden>
          →
        </span>
        {pill(
          "기능정리",
          step3Active,
          step3Reachable,
          step3Reachable || step3Active ? requirementsHref(pid, "feature-planning") : null
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          disabled={!ideationReadyForServiceFlow}
          onClick={() => {
            if (!ideationReadyForServiceFlow || !pid) return;
            router.push(requirementsHref(pid, "service-flow"));
          }}
          style={{
            padding: "5px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "transparent",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: ideationReadyForServiceFlow ? "pointer" : "not-allowed",
            color: ideationReadyForServiceFlow ? t.textSecondary : t.textMuted,
          }}
        >
          다음 추천 흐름: 액터/흐름 정의
        </button>
        <button
          type="button"
          disabled={!serviceFlowReadyForFeaturePlanning}
          onClick={() => {
            if (!serviceFlowReadyForFeaturePlanning || !pid) return;
            router.push(requirementsHref(pid, "feature-planning"));
          }}
          style={{
            padding: "5px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "transparent",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: serviceFlowReadyForFeaturePlanning ? "pointer" : "not-allowed",
            color: serviceFlowReadyForFeaturePlanning ? t.textSecondary : t.textMuted,
          }}
        >
          다음 추천 흐름: 기능 정리
        </button>
      </div>
    </div>
  );
}
