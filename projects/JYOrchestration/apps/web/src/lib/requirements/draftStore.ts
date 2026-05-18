export type RequirementsDraftStatus = "DRAFT" | "CONFIRMED";

export type RequirementsDraftDoc = {
  projectId: string;
  version: number;
  status: RequirementsDraftStatus;
  overview: string;
  goals: string[];
  users: string[];
  features: string[];
  excluded: string[];
  nonFunctional: string[];
  successCriteria: string[];
  openIssues: string[];
  createdAt: string;
  updatedAt: string;
  source: {
    messageCount: number;
    lastMessageAt?: string;
  };
};

export function bumpDraftVersion(prev: RequirementsDraftDoc | null, next: Omit<RequirementsDraftDoc, "version" | "status" | "updatedAt">): RequirementsDraftDoc {
  const version = (prev?.version ?? 0) + 1;
  const now = new Date().toISOString();
  return {
    ...next,
    version,
    status: "DRAFT",
    updatedAt: now,
  };
}

export function confirmDraft(prev: RequirementsDraftDoc): RequirementsDraftDoc {
  return { ...prev, status: "CONFIRMED", updatedAt: new Date().toISOString() };
}

export function draftMeetsMinimum(d: RequirementsDraftDoc | null): { ok: true } | { ok: false; missing: string[] } {
  if (!d) return { ok: false, missing: ["정리 초안"] };
  const missing: string[] = [];
  if (!d.overview.trim()) missing.push("프로젝트 개요");
  if (d.users.length === 0) missing.push("대상 사용자");
  if (d.features.length === 0) missing.push("핵심 기능(1개 이상)");
  if (d.successCriteria.length === 0) missing.push("성공 기준");
  return missing.length ? { ok: false, missing } : { ok: true };
}

