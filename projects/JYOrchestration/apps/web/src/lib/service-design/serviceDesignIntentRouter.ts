export type Intent = "FEATURE" | "FLOW" | "DESIGN" | "SECURITY" | "DEPLOY" | "GENERAL";

export function detectIntent(input: string): Intent {
  const t = input.toLowerCase();

  if (t.includes("보안") || t.includes("취약")) return "SECURITY";
  if (t.includes("배포")) return "DEPLOY";
  if (t.includes("화면") || t.includes("ui")) return "DESIGN";
  if (t.includes("기능")) return "FEATURE";
  if (t.includes("흐름")) return "FLOW";

  return "GENERAL";
}
