import { DEVELOPER_SEED_KNOWLEDGE_PACKS } from "@/lib/knowledge-packs/developerKnowledgePacks";
import type { KnowledgePack, KnowledgePackAgent } from "@/lib/knowledge-packs/types";
import { prisma } from "@/lib/prisma";

export type KnowledgePackRecommendationInput = Readonly<{
  userId: string;
  projectId?: string;
  text: string;
  agentRole?: "AI_DEVELOPER" | string;
  categoryHints?: readonly string[];
  limit?: number;
}>;

export type RecommendedKnowledgePack = Readonly<{
  knowledgePackId: string;
  name: string;
  category: string;
  source: "STATIC" | "DB";
  score: number;
  reasons: readonly string[];
}>;

export type KnowledgePackRecommendationResult = Readonly<{
  recommendations: readonly RecommendedKnowledgePack[];
  diagnostics: readonly string[];
}>;

const GRID_KEYWORDS = [
  "grid",
  "table",
  "datagrid",
  "목록",
  "그리드",
  "테이블",
  "정렬",
  "필터",
  "페이지네이션",
  "엑셀",
  "ibsheet",
  "toast ui",
  "ag grid",
  "tanstack",
  "tabulator",
];

const AUTH_KEYWORDS = [
  "login",
  "oauth",
  "sso",
  "auth",
  "인증",
  "로그인",
  "카카오 로그인",
  "kakao login",
  "redirect uri",
  "token",
  "secret",
  "kakao",
  "카카오",
];

const API_KEYWORDS = [
  "api",
  "연동",
  "interface",
  "endpoint",
  "webhook",
  "request",
  "response",
];

const GRID_PRODUCT_HINTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["grid.toast-ui-grid", ["toast", "toast-ui", "tui grid", "tui-grid", "toast ui"]],
  ["grid.ag-grid-community", ["ag-grid", "ag grid", "aggrid"]],
  ["grid.tanstack-table", ["tanstack", "react-table", "@tanstack"]],
  ["grid.tabulator", ["tabulator"]],
];

function normalizeHaystack(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(hay: string, needles: readonly string[]): boolean {
  for (const n of needles) {
    if (n && hay.includes(n)) return true;
  }
  return false;
}

function tokenOverlapScore(hay: string, blob: string): number {
  const tokens = hay
    .split(/[^a-z0-9가-힣]+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
    .slice(0, 80);
  if (!tokens.length || !blob.trim()) return 0;
  const b = blob.toLowerCase();
  let hits = 0;
  for (const t of new Set(tokens)) {
    if (t.length >= 3 && b.includes(t)) hits += 1;
  }
  return Math.min(20, hits * 4);
}

function parseAgentsJson(raw: string): readonly KnowledgePackAgent[] {
  try {
    const v = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(v)) return ["AI_DEVELOPER"];
    const out: KnowledgePackAgent[] = [];
    for (const x of v) {
      const s = String(x ?? "").trim();
      if (s === "AI_DEVELOPER" || s === "AI_PLANNER" || s === "AI_ANALYST" || s === "AI_ARCHITECT" || s === "AI_DESIGNER" || s === "AI_REVIEWER" || s === "AI_SECURITY") {
        out.push(s);
      }
    }
    return out.length ? out : ["AI_DEVELOPER"];
  } catch {
    return ["AI_DEVELOPER"];
  }
}

function scoreStaticPack(p: KnowledgePack, hay: string, input: KnowledgePackRecommendationInput): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const nameBlob = `${p.name} ${p.vendor ?? ""} ${p.summary}`.toLowerCase();

  const role = String(input.agentRole ?? "").trim();
  if (role && p.agents.includes(role as KnowledgePackAgent)) {
    score += 10;
    reasons.push(`Agent 역할(${role}) 매칭`);
  }

  const hints = (input.categoryHints ?? []).map((h) => String(h).trim().toUpperCase()).filter(Boolean);
  if (hints.includes(p.category)) {
    score += 20;
    reasons.push(`${p.category} 카테고리 힌트 매칭`);
  }

  if (p.category === "GRID") {
    if (containsAny(hay, GRID_KEYWORDS)) {
      score += 20;
      reasons.push("GRID 관련 키워드");
    }
    const row = GRID_PRODUCT_HINTS.find(([id]) => id === p.id);
    if (row && containsAny(hay, row[1])) {
      score += 50;
      reasons.push("제품/라이브러리명 직접 매칭");
    }
  }

  if (p.category === "AUTH") {
    if (containsAny(hay, AUTH_KEYWORDS)) {
      score += 20;
      reasons.push("AUTH 관련 키워드");
    }
    if (hay.includes("kakao") || hay.includes("카카오")) {
      score += 50;
      reasons.push("카카오 로그인 키워드 매칭");
    }
  }

  const overlap = tokenOverlapScore(hay, nameBlob);
  if (overlap > 0) {
    score += Math.min(20, overlap);
    reasons.push("이름·요약·벤더 토큰 매칭");
  }

  return { score, reasons };
}

function scoreDbPack(
  row: { id: string; name: string; category: string; summary: string; vendor: string; status: string; agentsJson: string },
  hay: string,
  input: KnowledgePackRecommendationInput,
): { score: number; reasons: string[] } | null {
  const cat = row.category.trim().toUpperCase();
  const isApiCat = cat === "API" || cat === "INTEGRATION";
  const apiHit = containsAny(hay, API_KEYWORDS);

  let score = 0;
  const reasons: string[] = [];

  const agents = parseAgentsJson(row.agentsJson);
  const role = String(input.agentRole ?? "").trim();
  if (role && agents.includes(role as KnowledgePackAgent)) {
    score += 10;
    reasons.push(`Agent 역할(${role}) 매칭`);
  }

  const hints = (input.categoryHints ?? []).map((h) => String(h).trim().toUpperCase()).filter(Boolean);
  if (hints.includes(cat)) {
    score += 20;
    reasons.push(`${cat} 카테고리 힌트 매칭`);
  }

  if (isApiCat && apiHit) {
    score += 20;
    reasons.push("API/연동 키워드 + 카테고리");
  }

  const nameBlob = `${row.name} ${row.vendor} ${row.summary}`.toLowerCase();
  const overlap = tokenOverlapScore(hay, nameBlob);
  if (overlap > 0) {
    score += Math.min(20, overlap);
    reasons.push("이름·요약·벤더 토큰 매칭");
  }

  const st = String(row.status ?? "").trim().toUpperCase();
  if (st === "ACTIVE") {
    score += 10;
    reasons.push("DB ACTIVE 가중");
  } else if (st === "DRAFT") {
    score -= 5;
    reasons.push("DB DRAFT(점수 감점)");
  }

  if (score <= 0) return null;

  return { score, reasons };
}

/**
 * 룰 기반 지식팩 후보 추천(LLM 없음). 정적 seed + 소유 DB 지식팩을 함께 고려한다.
 */
export async function recommendKnowledgePacks(input: KnowledgePackRecommendationInput): Promise<KnowledgePackRecommendationResult> {
  const diagnostics: string[] = [];
  const text = String(input.text ?? "").trim();
  const limit = Math.min(24, Math.max(1, Math.floor(input.limit ?? 5)));

  if (!text) {
    diagnostics.push("empty_text");
    return { recommendations: [], diagnostics };
  }

  const hay = normalizeHaystack(text);
  diagnostics.push(`text_chars=${text.length}`);

  const candidates: RecommendedKnowledgePack[] = [];

  for (const p of DEVELOPER_SEED_KNOWLEDGE_PACKS) {
    const { score, reasons } = scoreStaticPack(p, hay, input);
    if (score <= 0) continue;
    candidates.push({
      knowledgePackId: p.id,
      name: p.name,
      category: p.category,
      source: "STATIC",
      score,
      reasons,
    });
  }

  const uid = String(input.userId ?? "").trim();
  if (uid) {
    const rows = await prisma.kpKnowledgePack.findMany({
      where: {
        ownerUserId: uid,
        status: { in: ["ACTIVE", "DRAFT"] },
      },
      select: {
        id: true,
        name: true,
        category: true,
        summary: true,
        vendor: true,
        status: true,
        agentsJson: true,
      },
    });
    diagnostics.push(`db_packs_scanned=${rows.length}`);

    for (const row of rows) {
      const scored = scoreDbPack(row, hay, input);
      if (!scored) continue;
      candidates.push({
        knowledgePackId: row.id,
        name: row.name,
        category: row.category,
        source: "DB",
        score: scored.score,
        reasons: scored.reasons,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const recommendations = candidates.slice(0, limit);
  diagnostics.push(`candidates_total=${candidates.length}`, `returned=${recommendations.length}`);

  return { recommendations, diagnostics };
}
