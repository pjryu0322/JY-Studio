"use client";

import type { OverlayRuntimeCriticalitySectionVM } from "@/lib/overlay-ui/overlayRuntimeCriticalityAdapter";
import type { OverlayRuntimeDependencyGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeDependencyAdapter";
import type { OverlayRuntimeReasoningSectionVM } from "@/lib/overlay-ui/overlayRuntimeReasoningAdapter";
import type { OverlayRuntimeTraceabilitySectionVM } from "@/lib/overlay-ui/overlayRuntimeTraceabilityAdapter";
import { OverlayRuntimeCriticalitySection } from "./OverlayRuntimeCriticalitySection";
import { OverlayRuntimeDependencyGraphSection } from "./OverlayRuntimeDependencyGraphSection";
import { OverlayRuntimeReasoningSection } from "./OverlayRuntimeReasoningSection";
import { OverlayRuntimeTraceabilitySection } from "./OverlayRuntimeTraceabilitySection";

/** H15–H16.5 — dependency·criticality·reasoning·traceability 섹션을 한 그룹으로 접어 nested collapse 감소. */
export function OverlayRuntimeDependencyCriticalityGroup({
  dependencyVm,
  criticalityVm,
  reasoningVm,
  traceabilityVm,
  dependencyDefaultOpen,
  criticalityDefaultOpen,
  reasoningDefaultOpen,
  traceabilityDefaultOpen,
  groupOpen,
  showDependency = true,
  showCriticality = true,
  showReasoning = true,
  showTraceability = true,
}: {
  readonly dependencyVm: OverlayRuntimeDependencyGraphSectionVM;
  readonly criticalityVm: OverlayRuntimeCriticalitySectionVM;
  readonly reasoningVm: OverlayRuntimeReasoningSectionVM;
  readonly traceabilityVm: OverlayRuntimeTraceabilitySectionVM;
  readonly dependencyDefaultOpen?: boolean;
  readonly criticalityDefaultOpen?: boolean;
  readonly reasoningDefaultOpen?: boolean;
  readonly traceabilityDefaultOpen?: boolean;
  readonly groupOpen?: boolean;
  readonly showDependency?: boolean;
  readonly showCriticality?: boolean;
  readonly showReasoning?: boolean;
  readonly showTraceability?: boolean;
}) {
  return (
    <details open={groupOpen} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <summary
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#64748b",
          padding: "0 2px",
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        Planning reasoning (H15–H16.5, read-only)
      </summary>
      {showReasoning ? (
        <OverlayRuntimeReasoningSection vm={reasoningVm} defaultOpen={reasoningDefaultOpen} />
      ) : null}
      {showDependency ? (
        <OverlayRuntimeDependencyGraphSection vm={dependencyVm} defaultOpen={dependencyDefaultOpen} />
      ) : null}
      {showCriticality ? (
        <OverlayRuntimeCriticalitySection vm={criticalityVm} defaultOpen={criticalityDefaultOpen} />
      ) : null}
      {showTraceability ? (
        <OverlayRuntimeTraceabilitySection vm={traceabilityVm} defaultOpen={traceabilityDefaultOpen} />
      ) : null}
    </details>
  );
}
