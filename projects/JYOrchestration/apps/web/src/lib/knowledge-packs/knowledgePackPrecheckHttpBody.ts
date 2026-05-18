import type { KnowledgePackPrecheckInput } from "@/lib/knowledge-packs/knowledgePackPrecheckTypes";
import { normalizeKnowledgePackAgentsFromApi } from "@/lib/knowledge-packs/knowledgePackManageFormHelpers";
import { isKnowledgePackCategory, type KnowledgePackCategory } from "@/lib/knowledge-packs/types";

function optionalStringField(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/** POST `/api/knowledge-packs/precheck` JSON 본문 → 서비스 입력. */
export function parseKnowledgePackPrecheckRequestBody(
  body: Record<string, unknown>
): { ok: true; input: KnowledgePackPrecheckInput } | { ok: false; message: string } {
  const productName = String(body.productName ?? "").trim();
  if (!productName) return { ok: false, message: "제품명이 필요합니다." };

  const categoryRaw = String(body.category ?? "GRID").trim();
  if (!isKnowledgePackCategory(categoryRaw)) {
    return { ok: false, message: "유효하지 않은 카테고리입니다." };
  }
  const category = categoryRaw as KnowledgePackCategory;

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
    },
  };
}

/** 저장 API 본문 `precheckSummary` → 이력 한 줄 (`Precheck: …`). */
export function parsePrecheckSummaryForHistory(body: Record<string, unknown>): string | undefined {
  const raw = body.precheckSummary;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const decision = String(o.decision ?? "").trim();
  const riskLevel = String(o.riskLevel ?? "").trim();
  const score = Number(o.score);
  if (!decision || !riskLevel || !Number.isFinite(score)) return undefined;
  return `Precheck: ${decision} / ${riskLevel} / ${Math.round(score)}`;
}
