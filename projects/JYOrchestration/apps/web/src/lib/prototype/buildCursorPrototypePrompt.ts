import { PROTOTYPE_TEMPLATES } from "@/lib/templates/prototypeTemplates";
import type { PrototypeContextAnalysis } from "@/lib/prototype/prototypeContextAnalyzer";

export type PrototypePromptBuildInput = Readonly<{
  analysis: PrototypeContextAnalysis;
  projectName: string;
  projectDescription: string;
  actors: ReadonlyArray<{ name: string; kind: string; description?: string | null }>;
  flowSteps: ReadonlyArray<{ title: string; purpose: string; primaryActorId: string; ownerName?: string }>;
  featureDraftTitles?: readonly string[];
}>;

export function buildCursorPrototypePromptPackage(input: PrototypePromptBuildInput): string {
  const t = PROTOTYPE_TEMPLATES.find((x) => x.id === input.analysis.recommendedTemplate);
  const flowLine = input.flowSteps.map((s) => s.title.trim()).filter(Boolean).join(" -> ");
  const actorBlock = input.actors.map((a) => `- ${a.name} (${a.kind === "human" ? "Human" : "System"})`).join("\n");
  const pages = input.analysis.recommendedPages.map((p, i) => `${i + 1}. ${p}`).join("\n");
  const features =
    input.featureDraftTitles?.length ?
      input.featureDraftTitles.map((x, i) => `${i + 1}. ${x}`).join("\n")
    : "(아직 기능 정리 초안이 없으면 서비스 흐름만으로 1차 프로토타입 생성)";

  return `Create a responsive web prototype for the following product context.

Project:
${input.projectName}

Summary:
${input.projectDescription.trim() || "(설명 없음 — 채팅·아이디어 자산을 반영해 주세요)"}

Project type (analyzer): ${input.analysis.projectType}
Primary user type: ${input.analysis.userType}
Workflow complexity: ${input.analysis.workflowComplexity}

Template seed (starting layout only — customize all labels, navigation, and flows):
${t?.nameEn ?? "Dashboard"} (${t?.nameKo ?? ""})

Suggested pages (rename/merge as needed):
${pages}

Actors:
${actorBlock}

Service flow (high level):
${flowLine || "(흐름 단계를 데이터에 맞게 정의)"}

Priority interactions:
${input.analysis.priorityActions.map((a) => `- ${a}`).join("\n")}

Feature backlog hints (optional):
${features}

Style:
modern B2B SaaS, clear hierarchy, accessible contrast

Tech:
React + Tailwind (or existing stack in the repo you open in Cursor)

Deliverable:
clickable multi-page prototype with mocked data, router between pages, and short README on how to run.

---
한국어 요약: 위 프로젝트에 맞는 실제 동작 가능한 웹 프로토타입을 Cursor에서 생성해 주세요. 템플릿은 레이아웃 시드일 뿐이며, 액터·흐름·화면 이름은 모두 프로젝트에 맞게 바꿔 주세요.
`;
}
