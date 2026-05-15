"use client";

import type { OverlayRuntimeCoherenceSectionVM } from "@/lib/overlay-ui/overlayRuntimeCoherenceAdapter";
import type { OverlayRuntimeLifecycleSectionVM } from "@/lib/overlay-ui/overlayRuntimeLifecycleAdapter";
import { OverlayRuntimeCoherenceSection } from "./OverlayRuntimeCoherenceSection";
import { OverlayRuntimeLifecycleSection } from "./OverlayRuntimeLifecycleSection";

/** H14.5 — lifecycle·coherence 섹션을 한 그룹으로 접어 nested collapse 감소. */
export function OverlayRuntimeLifecycleCoherenceGroup({
  lifecycleVm,
  coherenceVm,
  lifecycleDefaultOpen,
  coherenceDefaultOpen,
  groupOpen,
  showLifecycle = true,
  showCoherence = true,
}: {
  readonly lifecycleVm: OverlayRuntimeLifecycleSectionVM;
  readonly coherenceVm: OverlayRuntimeCoherenceSectionVM;
  readonly lifecycleDefaultOpen?: boolean;
  readonly coherenceDefaultOpen?: boolean;
  readonly groupOpen?: boolean;
  readonly showLifecycle?: boolean;
  readonly showCoherence?: boolean;
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
        Lifecycle & coherence (H13.5–H14, read-only)
      </summary>
      {showLifecycle ? (
        <OverlayRuntimeLifecycleSection vm={lifecycleVm} defaultOpen={lifecycleDefaultOpen} />
      ) : null}
      {showCoherence ? (
        <OverlayRuntimeCoherenceSection vm={coherenceVm} defaultOpen={coherenceDefaultOpen} />
      ) : null}
    </details>
  );
}
