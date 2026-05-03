/** 기능 정리 워크스페이스 산출물(초안 타입 — API 연동 전) */

export type FeatureItem = Readonly<{
  id: string;
  title: string;
  summary?: string | null;
  priority?: "low" | "medium" | "high" | null;
}>;

export type MenuItem = Readonly<{
  id: string;
  label: string;
  parentId?: string | null;
  routeHint?: string | null;
}>;

export type ScreenItem = Readonly<{
  id: string;
  title: string;
  route?: string | null;
}>;

export type ScreenFunctionItem = Readonly<{
  id: string;
  screenId: string;
  title: string;
  description?: string | null;
}>;

export type WorkflowTaskDraft = Readonly<{
  id: string;
  title: string;
  order: number;
  linkedFeatureIds?: readonly string[] | null;
}>;
