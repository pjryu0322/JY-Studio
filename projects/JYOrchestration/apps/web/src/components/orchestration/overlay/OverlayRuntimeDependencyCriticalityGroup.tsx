"use client";

import type { OverlayRuntimeCriticalitySectionVM } from "@/lib/overlay-ui/overlayRuntimeCriticalityAdapter";
import type { OverlayRuntimeDependencyGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeDependencyAdapter";
import type { OverlayRuntimeReasoningSectionVM } from "@/lib/overlay-ui/overlayRuntimeReasoningAdapter";
import type { OverlayRuntimeSemanticGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticGraphAdapter";
import type { OverlayRuntimeSemanticNarrativeSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticNarrativeAdapter";
import type { OverlayRuntimeDecisionSectionVM } from "@/lib/overlay-ui/overlayRuntimeDecisionAdapter";
import type { OverlayRuntimeForecastSectionVM } from "@/lib/overlay-ui/overlayRuntimeForecastAdapter";
import type { OverlayRuntimeResourceAllocationSectionVM } from "@/lib/overlay-ui/overlayRuntimeResourceAllocationAdapter";
import type { OverlayRuntimeResourceGovernanceSectionVM } from "@/lib/overlay-ui/overlayRuntimeResourceGovernanceAdapter";
import type { OverlayRuntimeResourceSectionVM } from "@/lib/overlay-ui/overlayRuntimeResourceAdapter";
import type { OverlayRuntimeResourceTrialSectionVM } from "@/lib/overlay-ui/overlayRuntimeResourceTrialAdapter";
import type { OverlayRuntimeControlBoundarySectionVM } from "@/lib/overlay-ui/overlayRuntimeControlBoundaryAdapter";
import type { OverlayRuntimeExecutionCandidateSectionVM } from "@/lib/overlay-ui/overlayRuntimeExecutionCandidateAdapter";
import type { OverlayRuntimeSemanticVocabularySectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticVocabularyAdapter";
import type { OverlayRuntimeSemanticSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticAdapter";
import type { OverlayRuntimeTraceabilitySectionVM } from "@/lib/overlay-ui/overlayRuntimeTraceabilityAdapter";
import { OverlayRuntimeCriticalitySection } from "./OverlayRuntimeCriticalitySection";
import { OverlayRuntimeDependencyGraphSection } from "./OverlayRuntimeDependencyGraphSection";
import { OverlayRuntimeReasoningSection } from "./OverlayRuntimeReasoningSection";
import { OverlayRuntimeSemanticGraphSection } from "./OverlayRuntimeSemanticGraphSection";
import { OverlayRuntimeSemanticNarrativeSection } from "./OverlayRuntimeSemanticNarrativeSection";
import { OverlayRuntimeDecisionSection } from "./OverlayRuntimeDecisionSection";
import { OverlayRuntimeForecastSection } from "./OverlayRuntimeForecastSection";
import { OverlayRuntimeResourceSection } from "./OverlayRuntimeResourceSection";
import { OverlayRuntimeResourceGovernanceSection } from "./OverlayRuntimeResourceGovernanceSection";
import { OverlayRuntimeResourceAllocationSection } from "./OverlayRuntimeResourceAllocationSection";
import { OverlayRuntimeResourceTrialSection } from "./OverlayRuntimeResourceTrialSection";
import { OverlayRuntimeControlBoundarySection } from "./OverlayRuntimeControlBoundarySection";
import { OverlayRuntimeExecutionCandidateSection } from "./OverlayRuntimeExecutionCandidateSection";
import { OverlayRuntimeSemanticVocabularySection } from "./OverlayRuntimeSemanticVocabularySection";
import { OverlayRuntimeSemanticSection } from "./OverlayRuntimeSemanticSection";
import { OverlayRuntimeTraceabilitySection } from "./OverlayRuntimeTraceabilitySection";

/** H15–H23 — dependency·criticality·resource·…·control boundary·execution candidate·forecast·… */
export function OverlayRuntimeDependencyCriticalityGroup({
  dependencyVm,
  criticalityVm,
  resourceVm,
  resourceGovernanceVm,
  resourceAllocationVm,
  resourceTrialVm,
  runtimeControlBoundaryVm,
  runtimeExecutionCandidateVm,
  forecastVm,
  decisionVm,
  semanticVocabularyVm,
  semanticNarrativeVm,
  semanticGraphVm,
  semanticVm,
  reasoningVm,
  traceabilityVm,
  dependencyDefaultOpen,
  criticalityDefaultOpen,
  resourceDefaultOpen,
  resourceGovernanceDefaultOpen,
  resourceAllocationDefaultOpen,
  resourceTrialDefaultOpen,
  controlBoundaryDefaultOpen,
  executionCandidateDefaultOpen,
  forecastDefaultOpen,
  decisionDefaultOpen,
  semanticVocabularyDefaultOpen,
  semanticNarrativeDefaultOpen,
  semanticGraphDefaultOpen,
  semanticDefaultOpen,
  reasoningDefaultOpen,
  traceabilityDefaultOpen,
  groupOpen,
  showDependency = true,
  showCriticality = true,
  showResource = true,
  showResourceGovernance = true,
  showResourceAllocation = true,
  showResourceTrial = true,
  showRuntimeControlBoundary = true,
  showRuntimeExecutionCandidate = true,
  showForecast = true,
  showDecision = true,
  showSemanticVocabulary = true,
  showSemanticNarrative = true,
  showSemanticGraph = true,
  showSemantic = true,
  showReasoning = true,
  showTraceability = true,
}: {
  readonly dependencyVm: OverlayRuntimeDependencyGraphSectionVM;
  readonly criticalityVm: OverlayRuntimeCriticalitySectionVM;
  readonly resourceVm: OverlayRuntimeResourceSectionVM;
  readonly resourceGovernanceVm: OverlayRuntimeResourceGovernanceSectionVM;
  readonly resourceAllocationVm: OverlayRuntimeResourceAllocationSectionVM;
  readonly resourceTrialVm: OverlayRuntimeResourceTrialSectionVM;
  readonly runtimeControlBoundaryVm: OverlayRuntimeControlBoundarySectionVM;
  readonly runtimeExecutionCandidateVm: OverlayRuntimeExecutionCandidateSectionVM;
  readonly forecastVm: OverlayRuntimeForecastSectionVM;
  readonly decisionVm: OverlayRuntimeDecisionSectionVM;
  readonly semanticVocabularyVm: OverlayRuntimeSemanticVocabularySectionVM;
  readonly semanticNarrativeVm: OverlayRuntimeSemanticNarrativeSectionVM;
  readonly semanticGraphVm: OverlayRuntimeSemanticGraphSectionVM;
  readonly semanticVm: OverlayRuntimeSemanticSectionVM;
  readonly reasoningVm: OverlayRuntimeReasoningSectionVM;
  readonly traceabilityVm: OverlayRuntimeTraceabilitySectionVM;
  readonly dependencyDefaultOpen?: boolean;
  readonly criticalityDefaultOpen?: boolean;
  readonly resourceDefaultOpen?: boolean;
  readonly resourceGovernanceDefaultOpen?: boolean;
  readonly resourceAllocationDefaultOpen?: boolean;
  readonly resourceTrialDefaultOpen?: boolean;
  readonly controlBoundaryDefaultOpen?: boolean;
  readonly executionCandidateDefaultOpen?: boolean;
  readonly forecastDefaultOpen?: boolean;
  readonly decisionDefaultOpen?: boolean;
  readonly semanticVocabularyDefaultOpen?: boolean;
  readonly semanticNarrativeDefaultOpen?: boolean;
  readonly semanticGraphDefaultOpen?: boolean;
  readonly semanticDefaultOpen?: boolean;
  readonly reasoningDefaultOpen?: boolean;
  readonly traceabilityDefaultOpen?: boolean;
  readonly groupOpen?: boolean;
  readonly showDependency?: boolean;
  readonly showCriticality?: boolean;
  readonly showResource?: boolean;
  readonly showResourceGovernance?: boolean;
  readonly showResourceAllocation?: boolean;
  readonly showResourceTrial?: boolean;
  readonly showRuntimeControlBoundary?: boolean;
  readonly showRuntimeExecutionCandidate?: boolean;
  readonly showForecast?: boolean;
  readonly showDecision?: boolean;
  readonly showSemanticVocabulary?: boolean;
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
        Planning observability (H15–H23, read-only)
      </summary>
      {showResource ? (
        <OverlayRuntimeResourceSection vm={resourceVm} defaultOpen={resourceDefaultOpen} />
      ) : null}
      {showResourceGovernance ? (
        <OverlayRuntimeResourceGovernanceSection
          vm={resourceGovernanceVm}
          defaultOpen={resourceGovernanceDefaultOpen}
        />
      ) : null}
      {showResourceAllocation ? (
        <OverlayRuntimeResourceAllocationSection
          vm={resourceAllocationVm}
          defaultOpen={resourceAllocationDefaultOpen}
        />
      ) : null}
      {showResourceTrial ? (
        <OverlayRuntimeResourceTrialSection vm={resourceTrialVm} defaultOpen={resourceTrialDefaultOpen} />
      ) : null}
      {showRuntimeControlBoundary ? (
        <OverlayRuntimeControlBoundarySection
          vm={runtimeControlBoundaryVm}
          defaultOpen={controlBoundaryDefaultOpen}
        />
      ) : null}
      {showRuntimeExecutionCandidate ? (
        <OverlayRuntimeExecutionCandidateSection
          vm={runtimeExecutionCandidateVm}
          defaultOpen={executionCandidateDefaultOpen}
        />
      ) : null}
      {showForecast ? (
        <OverlayRuntimeForecastSection vm={forecastVm} defaultOpen={forecastDefaultOpen} />
      ) : null}
      {showDecision ? (
        <OverlayRuntimeDecisionSection vm={decisionVm} defaultOpen={decisionDefaultOpen} />
      ) : null}
      {showSemanticVocabulary ? (
        <OverlayRuntimeSemanticVocabularySection
          vm={semanticVocabularyVm}
          defaultOpen={semanticVocabularyDefaultOpen}
        />
      ) : null}
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
