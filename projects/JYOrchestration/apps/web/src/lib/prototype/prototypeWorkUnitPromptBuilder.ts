import type { PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";

export type BuildWorkUnitCursorPromptParams = Readonly<{
  projectName: string;
  projectDescription: string;
  selectedTemplate: string;
  allWorkUnits: readonly PrototypeWorkUnit[];
  currentWorkUnit: PrototypeWorkUnit;
  completedWorkUnits: readonly PrototypeWorkUnit[];
  ideationSummary: string;
  actorFlowSummary: string;
  featureSummary: string;
}>;

function linesCompletedSummary(completed: readonly PrototypeWorkUnit[]): string {
  if (!completed.length) return "(없음)";
  return completed
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((u) =>
      u.status === "SKIPPED"
        ? `- WorkUnit${u.order}: ${u.title} (관리자 건너뜀)`
        : `- WorkUnit${u.order}: ${u.title} 완료`,
    )
    .join("\n");
}

function suggestAllowedFiles(u: PrototypeWorkUnit): string {
  const parts = [u.targetArea, u.implementationScope].map((s) => String(s ?? "").trim()).filter(Boolean);
  const joined = parts.join(", ");
  if (joined) return joined;
  return "web/src/components, web/src/pages, web/src/layout (Vite `web/` 앱 기준)";
}

/**
 * Cursor Cloud Agent에 전달할 **단일 WorkUnit** 프롬프트(전역 기획 스냅샷 미포함).
 */
export function buildWorkUnitCursorPrompt(params: BuildWorkUnitCursorPromptParams): string {
  const u = params.currentWorkUnit;
  const goal = String(params.projectDescription ?? "").trim() || "(프로젝트 설명 없음)";
  const ideation = String(params.ideationSummary ?? "").trim() || "(없음)";
  const flow = String(params.actorFlowSummary ?? "").trim() || "(없음)";
  const features = String(params.featureSummary ?? "").trim() || "(없음)";
  const completed = linesCompletedSummary(params.completedWorkUnits);

  return [
    "--------------------------------------------------",
    "",
    `Project:`,
    params.projectName.trim() || "Project",
    "",
    `Goal:`,
    goal,
    "",
    `Template / context key:`,
    String(params.selectedTemplate ?? "").trim() || "(미지정)",
    "",
    `Ideation (요약):`,
    ideation,
    "",
    `Actor / service flow (요약):`,
    flow,
    "",
    `Features (요약):`,
    features,
    "",
    `Current WorkUnit:`,
    `#${u.order} ${u.title}`,
    "",
    `Task Scope:`,
    String(u.description ?? "").trim() || u.title,
    "",
    `Allowed Files (이번 유닛 관련 경로만):`,
    suggestAllowedFiles(u),
    "",
    `Acceptance criteria:`,
    u.acceptanceCriteria.length ? u.acceptanceCriteria.map((c) => `- ${c}`).join("\n") : "- (플래너 기준 기본 검증)",
    "",
    `Already Completed:`,
    completed,
    "",
    "Do NOT break previous completed work.",
    "",
    "Strict Rules:",
    "1. Only implement current WorkUnit.",
    "2. Do not redesign unrelated areas.",
    "3. Keep build passing.",
    "4. If needed, update styles minimally.",
    "5. Commit changes when done.",
    "6. Push branch when done.",
    "",
    "GitHub Pages:",
    "- The app may be published under a project path (Vite `base` like `/repo/`). If you use React Router `BrowserRouter`, set `basename` to `import.meta.env.BASE_URL`.",
    "- The route `/` under that basename must render the main workspace (avoid showing an in-app 404 at the published root URL).",
    "",
    "Expected Output:",
    "- code updated",
    "- build passes",
    "- commit pushed",
    "",
    "--------------------------------------------------",
  ].join("\n");
}
