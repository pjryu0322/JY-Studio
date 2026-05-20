/**
 * Deterministic artifact body builders — no service-flow-analyze / stage transition.
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  PROJECT_ARTIFACT_LABELS,
  type ProjectArtifact,
  type ProjectArtifactType,
  wireStageLabel,
} from "@/lib/requirements/projectArtifactTypes";
import { buildServiceFlowStateSummaryMessage } from "@/lib/requirements/serviceFlowProposalDecision";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

export type ProjectArtifactGenerateInput = Readonly<{
  readonly artifactType: ProjectArtifactType;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly sourceStage?: string | null;
  readonly serviceFlow?: RequirementsServiceFlowV1 | null;
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
  readonly nowIso?: string;
  readonly createdBy?: "ai" | "user";
}>;

function newArtifactId(nowIso: string): string {
  return `artifact-${nowIso.replace(/[^\d]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

function featurePlanningMarkdown(artifact: FeaturePlanningSlotsArtifactV1 | null | undefined): string {
  const slots = (artifact?.slots ?? []).filter((s) => !s.legacy);
  if (!slots.length) {
    return "_기능 정의 슬롯이 아직 비어 있습니다. 세부 기능 정의를 진행한 뒤 다시 생성해 주세요._";
  }
  const lines = ["## 기능 정의", ""];
  for (const slot of slots) {
    const title = String(slot.slotName ?? slot.slotKey ?? "기능").trim();
    const body = String(slot.slotDescription ?? slot.reason ?? "").trim() || "_내용 없음_";
    lines.push(`### ${title}`, "", body, "");
    for (const item of slot.items ?? []) {
      const name = String(item.name ?? "").trim();
      const desc = String(item.description ?? "").trim();
      if (name) lines.push(`- **${name}**${desc ? `: ${desc}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function screenSpecMarkdown(artifact: FeaturePlanningSlotsArtifactV1 | null | undefined): string {
  const screenSlots = (artifact?.slots ?? []).filter(
    (s) => !s.legacy && (s.slotType === "SCREEN" || s.slotType === "UI" || /screen|화면|ui/i.test(`${s.slotKey} ${s.slotName}`)),
  );
  if (!screenSlots.length) {
    return ["## 화면 정의", "", "_화면 정의 슬롯이 아직 없습니다._"].join("\n");
  }
  return featurePlanningMarkdown({ ...(artifact as FeaturePlanningSlotsArtifactV1), slots: screenSlots });
}

function apiSpecMarkdown(artifact: FeaturePlanningSlotsArtifactV1 | null | undefined): string {
  const apiSlots = (artifact?.slots ?? []).filter(
    (s) => !s.legacy && (s.slotType === "DATA" || /api|endpoint|interface/i.test(`${s.slotKey} ${s.slotName}`)),
  );
  if (!apiSlots.length) {
    return ["## API 정의", "", "_API 슬롯이 아직 없습니다. API 정의 작업 후 다시 생성해 주세요._"].join("\n");
  }
  return featurePlanningMarkdown({ ...(artifact as FeaturePlanningSlotsArtifactV1), slots: apiSlots });
}

export function buildProjectArtifactContent(input: ProjectArtifactGenerateInput): string {
  const projectName = String(input.projectName ?? "프로젝트").trim() || "프로젝트";
  const desc = String(input.projectDescription ?? "").trim();
  const flow = input.serviceFlow ? hydrateServiceFlowStepsFromAlternativePayload(input.serviceFlow) : null;
  const stage = wireStageLabel(input.sourceStage);

  switch (input.artifactType) {
    case "service-flow-doc":
      if (!flow || !(flow.steps?.length ?? 0)) {
        return ["# 서비스 흐름 문서", "", "_서비스 흐름 데이터가 없습니다._"].join("\n");
      }
      return [
        `# ${projectName} — 서비스 흐름 문서`,
        "",
        `생성 단계: ${stage}`,
        "",
        buildServiceFlowStateSummaryMessage({ flow, heading: "서비스 흐름", cta: "" }),
      ].join("\n");

    case "feature-spec":
      return [`# ${projectName} — 기능 정의서`, "", `생성 단계: ${stage}`, "", featurePlanningMarkdown(input.featurePlanning)].join(
        "\n",
      );

    case "screen-spec":
      return [`# ${projectName} — 화면 정의서`, "", `생성 단계: ${stage}`, "", screenSpecMarkdown(input.featurePlanning)].join(
        "\n",
      );

    case "api-spec":
      return [`# ${projectName} — API 명세서`, "", `생성 단계: ${stage}`, "", apiSpecMarkdown(input.featurePlanning)].join("\n");

    case "summary":
      return [
        `# ${projectName} — 프로젝트 요약서`,
        "",
        desc ? `## 개요\n\n${desc}` : "## 개요\n\n_설명 없음_",
        "",
        flow ? buildServiceFlowStateSummaryMessage({ flow, heading: "현재 흐름 스냅샷", cta: "" }) : "",
        "",
        input.featurePlanning ? featurePlanningMarkdown(input.featurePlanning) : "",
      ]
        .filter(Boolean)
        .join("\n");

    case "markdown-export": {
      const body = buildProjectArtifactContent({ ...input, artifactType: "summary" });
      return body;
    }

    case "pdf-export":
      return [
        buildProjectArtifactContent({ ...input, artifactType: "summary" }),
        "",
        "---",
        "",
        "_PDF Export는 Markdown 본문을 기준으로 뷰어에서 인쇄·저장할 수 있습니다._",
      ].join("\n");

    default:
      return "";
  }
}

export function generateProjectArtifact(input: ProjectArtifactGenerateInput): ProjectArtifact {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const content = buildProjectArtifactContent(input);
  return {
    id: newArtifactId(nowIso),
    type: input.artifactType,
    title: PROJECT_ARTIFACT_LABELS[input.artifactType],
    createdAt: nowIso,
    createdBy: input.createdBy ?? "ai",
    sourceStage: wireStageLabel(input.sourceStage),
    content,
  };
}
