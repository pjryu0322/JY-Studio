"use client";

import type { OverlayRuntimeCriticalitySectionVM } from "@/lib/overlay-ui/overlayRuntimeCriticalityAdapter";
import type { OverlayRuntimeDependencyGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeDependencyAdapter";
import type { OverlayRuntimeTraceabilitySectionVM } from "@/lib/overlay-ui/overlayRuntimeTraceabilityAdapter";
import { OverlayRuntimeCriticalitySection } from "./OverlayRuntimeCriticalitySection";
import { OverlayRuntimeDependencyGraphSection } from "./OverlayRuntimeDependencyGraphSection";
import { OverlayRuntimeTraceabilitySection } from "./OverlayRuntimeTraceabilitySection";

/** H15–H16 — dependency·criticality·traceability 섹션을 한 그룹으로 접어 nested collapse 감소. */
export function OverlayRuntimeDependencyCriticalityGroup({
  dependencyVm,
  criticalityVm,
  traceabilityVm,
  dependencyDefaultOpen,
  criticalityDefaultOpen,
  traceabilityDefaultOpen,
  groupOpen,
  showDependency = true,
  showCriticality = true,
  showTraceability = true,
}: {
  readonly dependencyVm: OverlayRuntimeDependencyGraphSectionVM;
  readonly criticalityVm: OverlayRuntimeCriticalitySectionVM;
  readonly traceabilityVm: OverlayRuntimeTraceabilitySectionVM;
  readonly dependencyDefaultOpen?: boolean;
  readonly criticalityDefaultOpen?: boolean;
  readonly traceabilityDefaultOpen?: boolean;
  readonly groupOpen?: boolean;
  readonly showDependency?: boolean;
  readonly showCriticality?: boolean;
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
        Planning trace (H15–H16, read-only)
      </summary>
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
