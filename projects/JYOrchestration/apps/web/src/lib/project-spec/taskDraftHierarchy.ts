export type TaskNodeType = "requirement" | "design" | "feature" | "task";

const NODE_PREFIX: Record<TaskNodeType, string> = {
  requirement: "[R]",
  design: "[D]",
  feature: "[F]",
  task: "[T]",
};

export function nodeTypeLabel(t: TaskNodeType): string {
  return NODE_PREFIX[t];
}

export function stageForNodeType(t: TaskNodeType): "Requirement" | "Design" | "Development" {
  if (t === "requirement") return "Requirement";
  if (t === "task") return "Development";
  return "Design";
}

export function nodeTypeFromTitle(title: string): TaskNodeType {
  const v = String(title ?? "").trim().toUpperCase();
  if (v.startsWith("[R]")) return "requirement";
  if (v.startsWith("[D]")) return "design";
  if (v.startsWith("[F]")) return "feature";
  return "task";
}

export function withNodeTypePrefix(type: TaskNodeType, title: string): string {
  const core = stripNodeTypePrefix(title).trim();
  return `${NODE_PREFIX[type]} ${core || "Untitled"}`;
}

export function stripNodeTypePrefix(title: string): string {
  return String(title ?? "")
    .replace(/^\s*\[(R|D|F|T)\]\s*/i, "")
    .trim();
}

