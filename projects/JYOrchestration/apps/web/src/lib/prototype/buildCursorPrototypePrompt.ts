import { PROTOTYPE_TEMPLATES } from "@/lib/templates/prototypeTemplates";
import type { PrototypeContextAnalysis } from "@/lib/prototype/prototypeContextAnalyzer";
import { formatPrototypeTemplateLayoutContract } from "@/lib/prototype/prototypeTemplateLayoutContract";

export type PrototypePromptBuildInput = Readonly<{
  analysis: PrototypeContextAnalysis;
  projectName: string;
  projectDescription: string;
  actors: ReadonlyArray<{ name: string; kind: string; description?: string | null }>;
  flowSteps: ReadonlyArray<{ title: string; purpose: string; primaryActorId: string; ownerName?: string }>;
  featureDraftTitles?: readonly string[];
  /** 지식팩 RAG 기반 컨텍스트(선택). 비어 있으면 삽입하지 않음. 최대 6000자. */
  knowledgePackContextText?: string;
}>;

const KP_CTX_MAX = 6000;

function clampPrototypeKp(raw: string | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (t.length <= KP_CTX_MAX) return t;
  return `${t.slice(0, KP_CTX_MAX - 20)}\n…(truncated)`;
}

export function buildCursorPrototypePromptPackage(input: PrototypePromptBuildInput): string {
  const templateId = input.analysis.recommendedTemplate;
  const t = PROTOTYPE_TEMPLATES.find((x) => x.id === templateId);
  const layoutContract = formatPrototypeTemplateLayoutContract(templateId);
  const flowLine = input.flowSteps.map((s) => s.title.trim()).filter(Boolean).join(" -> ");
  const actorBlock = input.actors.map((a) => `- ${a.name} (${a.kind === "human" ? "Human" : "System"})`).join("\n");
  const pages = input.analysis.recommendedPages.map((p, i) => `${i + 1}. ${p}`).join("\n");
  const features =
    input.featureDraftTitles?.length ?
      input.featureDraftTitles.map((x, i) => `${i + 1}. ${x}`).join("\n")
    : "(아직 기능 정리 초안이 없으면 서비스 흐름만으로 1차 프로토타입 생성)";

  const kpClamped = clampPrototypeKp(input.knowledgePackContextText);
  const kpBlock = kpClamped
    ? `

## Knowledge Pack Context

${kpClamped}
`
    : "";

  return `Create a responsive web prototype for the following product context.

Project:
${input.projectName}

Summary:
${input.projectDescription.trim() || "(설명 없음 — 채팅·아이디어 자산을 반영해 주세요)"}${kpBlock}

Project type (analyzer): ${input.analysis.projectType}
Primary user type: ${input.analysis.userType}
Workflow complexity: ${input.analysis.workflowComplexity}

Selected template in JY Orchestration (user chose this — **keep the same information architecture as the in-app template preview**):
${t?.nameKo ?? String(templateId)} / ${t?.nameEn ?? ""} (id: ${templateId})

=== Template layout contract (match preview structure; adjust wording to the project) ===
${layoutContract}

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

GitHub Pages (project site under https://<owner>.github.io/<repo>/):
- The repo uses Vite under the \`web/\` folder. Keep \`web/vite.config.ts\` \`base\` as \`"/<repo>/"\` (the platform may set this automatically).
- If you use React Router \`BrowserRouter\`, set \`basename={import.meta.env.BASE_URL}\` (must match Vite \`base\`, including trailing slash).
- Register the main/home UI at path \`"/"\` under that basename so opening \`https://<owner>.github.io/<repo>/\` does not show an in-app 404.
- Ensure \`web/dist/index.html\` exists after \`npm run build\`; the deploy workflow copies it to \`404.html\` for SPA deep links.

Deliverable:
clickable multi-page prototype with mocked data, router between pages, and short README on how to run.

---
한국어 요약: 위 프로젝트에 맞는 클릭 가능한 웹 프로토타입을 Cursor에서 생성해 주세요. **위 "템플릿 레이아웃 계약"의 패널 구조·기본 한글 제목은 유지**하고, 앱 제목·샘플 문구·목 데이터만 프로젝트 맥락에 맞게 다듬어 주세요.
`;
}
