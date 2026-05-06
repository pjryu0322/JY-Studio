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
  const protoHref = appFlowStepHref("execution", pid || null);

  const step1Active = activeStage === "ideation";
  const step2Active = activeStage === "service-flow";
  const step3Active = activeStage === "feature-planning";
  const step4Active = false;

  const step2Reachable = ideationReadyForServiceFlow;
  const step3Reachable = serviceFlowReadyForFeaturePlanning;
  const step4Reachable = serviceFlowReadyForFeaturePlanning;

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
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginRight: 4 }}>단계</span>
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
        <span style={{ color: t.textMuted, fontSize: 12 }} aria-hidden>
          →
        </span>
        {step4Reachable || step4Active ? (
          <Link href={protoHref} prefetch={false} style={stepShell(step4Active, true)}>
            프로토타입 생성
          </Link>
        ) : (
          <span style={stepShell(step4Active, false)} aria-disabled>
            프로토타입 생성
          </span>
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
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.borderStrong}`,
            background: ideationReadyForServiceFlow ? t.bgPage : t.border,
            fontSize: 12,
            fontWeight: 700,
            cursor: ideationReadyForServiceFlow ? "pointer" : "not-allowed",
            color: ideationReadyForServiceFlow ? t.textPrimary : t.textMuted,
          }}
        >
          액터/흐름 정의로 이동
        </button>
        <button
          type="button"
          disabled={!serviceFlowReadyForFeaturePlanning}
          onClick={() => {
            if (!serviceFlowReadyForFeaturePlanning || !pid) return;
            router.push(requirementsHref(pid, "feature-planning"));
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.borderStrong}`,
            background: serviceFlowReadyForFeaturePlanning ? t.bgPage : t.border,
            fontSize: 12,
            fontWeight: 700,
            cursor: serviceFlowReadyForFeaturePlanning ? "pointer" : "not-allowed",
            color: serviceFlowReadyForFeaturePlanning ? t.textPrimary : t.textMuted,
          }}
        >
          기능정리로 이동
        </button>
        <Link
          href={protoHref}
          prefetch={false}
          aria-disabled={!serviceFlowReadyForFeaturePlanning}
          onClick={(e) => {
            if (!serviceFlowReadyForFeaturePlanning) e.preventDefault();
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.borderStrong}`,
            background: serviceFlowReadyForFeaturePlanning ? t.accentTealSurface : t.border,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            color: serviceFlowReadyForFeaturePlanning ? t.accentTealFg : t.textMuted,
            pointerEvents: serviceFlowReadyForFeaturePlanning ? "auto" : "none",
            opacity: serviceFlowReadyForFeaturePlanning ? 1 : 0.55,
          }}
        >
          프로토타입 생성으로 이동
        </Link>
      </div>
    </div>
  );
}
