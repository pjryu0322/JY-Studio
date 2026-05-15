"use client";

import type { OverlayRuntimeCriticalitySectionVM } from "@/lib/overlay-ui/overlayRuntimeCriticalityAdapter";
import type { OverlayRuntimeDependencyGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeDependencyAdapter";
import type { OverlayRuntimeReasoningSectionVM } from "@/lib/overlay-ui/overlayRuntimeReasoningAdapter";
import type { OverlayRuntimeSemanticGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticGraphAdapter";
import type { OverlayRuntimeSemanticNarrativeSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticNarrativeAdapter";
import type { OverlayRuntimeSemanticSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticAdapter";
import type { OverlayRuntimeTraceabilitySectionVM } from "@/lib/overlay-ui/overlayRuntimeTraceabilityAdapter";
import { OverlayRuntimeCriticalitySection } from "./OverlayRuntimeCriticalitySection";
import { OverlayRuntimeDependencyGraphSection } from "./OverlayRuntimeDependencyGraphSection";
import { OverlayRuntimeReasoningSection } from "./OverlayRuntimeReasoningSection";
import { OverlayRuntimeSemanticGraphSection } from "./OverlayRuntimeSemanticGraphSection";
import { OverlayRuntimeSemanticNarrativeSection } from "./OverlayRuntimeSemanticNarrativeSection";
import { OverlayRuntimeSemanticSection } from "./OverlayRuntimeSemanticSection";
import { OverlayRuntimeTraceabilitySection } from "./OverlayRuntimeTraceabilitySection";

/** H15–H18.5 — dependency·criticality·narrative·graph·semantic·reasoning·traceability 섹션을 한 그룹으로 접어 nested collapse 감소. */
export function OverlayRuntimeDependencyCriticalityGroup({
  dependencyVm,
  criticalityVm,
  semanticNarrativeVm,
  semanticGraphVm,
  semanticVm,
  reasoningVm,
  traceabilityVm,
  dependencyDefaultOpen,
  criticalityDefaultOpen,
  semanticNarrativeDefaultOpen,
  semanticGraphDefaultOpen,
  semanticDefaultOpen,
  reasoningDefaultOpen,
  traceabilityDefaultOpen,
  groupOpen,
  showDependency = true,
  showCriticality = true,
  showSemanticNarrative = true,
  showSemanticGraph = true,
  showSemantic = true,
  showReasoning = true,
  showTraceability = true,
}: {
  readonly dependencyVm: OverlayRuntimeDependencyGraphSectionVM;
  readonly criticalityVm: OverlayRuntimeCriticalitySectionVM;
  readonly semanticNarrativeVm: OverlayRuntimeSemanticNarrativeSectionVM;
  readonly semanticGraphVm: OverlayRuntimeSemanticGraphSectionVM;
  readonly semanticVm: OverlayRuntimeSemanticSectionVM;
  readonly reasoningVm: OverlayRuntimeReasoningSectionVM;
  readonly traceabilityVm: OverlayRuntimeTraceabilitySectionVM;
  readonly dependencyDefaultOpen?: boolean;
  readonly criticalityDefaultOpen?: boolean;
  readonly semanticNarrativeDefaultOpen?: boolean;
  readonly semanticGraphDefaultOpen?: boolean;
  readonly semanticDefaultOpen?: boolean;
  readonly reasoningDefaultOpen?: boolean;
  readonly traceabilityDefaultOpen?: boolean;
  readonly groupOpen?: boolean;
  readonly showDependency?: boolean;
  readonly showCriticality?: boolean;
  readonly showSemanticNarrative?: boolean;
  readonly showSemanticGraph?: boolean;
  readonly showSemantic?: boolean;
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
        Planning observability (H15–H18.5, read-only)
      </summary>
      {showSemanticNarrative ? (
        <OverlayRuntimeSemanticNarrativeSection
          vm={semanticNarrativeVm}
          defaultOpen={semanticNarrativeDefaultOpen}
        />
      ) : null}
      {showSemanticGraph ? (
        <OverlayRuntimeSemanticGraphSection vm={semanticGraphVm} defaultOpen={semanticGraphDefaultOpen} />
      ) : null}
      {showSemantic ? (
        <OverlayRuntimeSemanticSection vm={semanticVm} defaultOpen={semanticDefaultOpen} />
      ) : null}
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
