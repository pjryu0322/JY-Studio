import type { KnowledgePackDraftInput } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";
import { normalizeKnowledgePackAgentsFromApi } from "@/lib/knowledge-packs/knowledgePackManageFormHelpers";
import type { KnowledgePackPrecheckDecision, KnowledgePackPrecheckRiskLevel } from "@/lib/knowledge-packs/knowledgePackPrecheckTypes";
import { isKnowledgePackCategory, type KnowledgePackCategory } from "@/lib/knowledge-packs/types";

const PRECHECK_DECISIONS = new Set<KnowledgePackPrecheckDecision>([
  "REGISTERABLE",
  "LIMITED_REGISTERABLE",
  "USER_SOURCE_REQUIRED",
  "NOT_RECOMMENDED",
]);

const PRECHECK_RISKS = new Set<KnowledgePackPrecheckRiskLevel>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function optionalStringField(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function optionalPrecheckDecision(body: Record<string, unknown>): KnowledgePackPrecheckDecision | undefined {
  const s = String(body.precheckDecision ?? "").trim();
  if (!s) return undefined;
  return PRECHECK_DECISIONS.has(s as KnowledgePackPrecheckDecision) ? (s as KnowledgePackPrecheckDecision) : undefined;
}

function optionalPrecheckRisk(body: Record<string, unknown>): KnowledgePackPrecheckRiskLevel | undefined {
  const s = String(body.precheckRiskLevel ?? "").trim();
  if (!s) return undefined;
  return PRECHECK_RISKS.has(s as KnowledgePackPrecheckRiskLevel) ? (s as KnowledgePackPrecheckRiskLevel) : undefined;
}

function optionalPrecheckIssues(body: Record<string, unknown>): readonly string[] | undefined {
  const raw = body.precheckIssues;
  if (Array.isArray(raw)) {
    const lines = raw.map((x) => String(x).trim()).filter(Boolean);
    return lines.length ? lines : undefined;
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return undefined;
}

/** POST `/api/knowledge-packs/draft` JSON 본문 → 서비스 입력. */
export function parseKnowledgePackDraftRequestBody(
  body: Record<string, unknown>
): { ok: true; input: KnowledgePackDraftInput } | { ok: false; message: string } {
  const productName = String(body.productName ?? "").trim();
  if (!productName) return { ok: false, message: "제품명이 필요합니다." };

  const categoryRaw = String(body.category ?? "GRID").trim();
  if (!isKnowledgePackCategory(categoryRaw)) {
    return { ok: false, message: "유효하지 않은 카테고리입니다." };
  }
  const category = categoryRaw as KnowledgePackCategory;

  const precheckDecision = optionalPrecheckDecision(body);
  const precheckRiskLevel = optionalPrecheckRisk(body);
  const precheckIssues = optionalPrecheckIssues(body);

  return {
    ok: true,
    input: {
      productName,
      productUrl: optionalStringField(body, "productUrl"),
      category,
      agents: normalizeKnowledgePackAgentsFromApi(body.agents),
      purpose: optionalStringField(body, "purpose"),
      officialDocsUrl: optionalStringField(body, "officialDocsUrl"),
      apiDocsUrl: optionalStringField(body, "apiDocsUrl"),
      repositoryUrl: optionalStringField(body, "repositoryUrl"),
      licenseHint: optionalStringField(body, "licenseHint"),
      memo: optionalStringField(body, "memo"),
      ...(precheckDecision ? { precheckDecision } : {}),
      ...(precheckRiskLevel ? { precheckRiskLevel } : {}),
      ...(precheckIssues ? { precheckIssues } : {}),
    },
  };
}
