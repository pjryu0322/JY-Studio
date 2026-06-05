import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";

export type GeneratedAppPreviewPanelId = "shell" | "sample_data" | "input" | "result" | "other";

export type GeneratedAppPreviewPanelVm = Readonly<{
  readonly id: GeneratedAppPreviewPanelId;
  readonly title: string;
  readonly codeTaskId: string;
  readonly completed: boolean;
}>;

function classifyPanel(title: string, codeTaskId: string): GeneratedAppPreviewPanelId {
  const t = title.trim();
  const id = codeTaskId.trim().toUpperCase();
  if (/shell|앱\s*shell|프레임/i.test(t) || id.includes("SHELL")) return "shell";
  if (/샘플|mock|sample/i.test(t) || id.includes("MOCK")) return "sample_data";
  if (/입력|input/i.test(t)) return "input";
  if (/결과|output|result/i.test(t)) return "result";
  return "other";
}

export function buildGeneratedAppPreviewPanels(scope: ImplementationPreviewScopeV1): readonly GeneratedAppPreviewPanelVm[] {
  const included = scope.includedCodeTasks.map((row) => ({
    id: classifyPanel(row.title, row.codeTaskId),
    title: row.title,
    codeTaskId: row.codeTaskId,
    completed: true,
  }));

  const excludedPlaceholders = scope.excludedCodeTasks
    .filter((row) => classifyPanel(row.title, row.codeTaskId) !== "other")
    .slice(0, 6)
    .map((row) => ({
      id: classifyPanel(row.title, row.codeTaskId),
      title: row.title,
      codeTaskId: row.codeTaskId,
      completed: false,
    }));

  const order: GeneratedAppPreviewPanelId[] = ["shell", "sample_data", "input", "result", "other"];
  const merged = [...included, ...excludedPlaceholders];
  const seen = new Set<string>();
  const panels: GeneratedAppPreviewPanelVm[] = [];
  for (const id of order) {
    for (const row of merged) {
      if (row.id !== id) continue;
      const key = `${row.id}:${row.codeTaskId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      panels.push(row);
    }
  }
  if (!panels.length && included.length) {
    return included;
  }
  return panels;
}

export function pickDefaultGeneratedAppPreviewPanelId(
  panels: readonly GeneratedAppPreviewPanelVm[],
): GeneratedAppPreviewPanelId {
  for (const preferred of ["input", "result", "shell", "sample_data", "other"] as const) {
    const hit = panels.find((p) => p.id === preferred && p.completed);
    if (hit) return hit.id;
  }
  return panels[0]?.id ?? "shell";
}
