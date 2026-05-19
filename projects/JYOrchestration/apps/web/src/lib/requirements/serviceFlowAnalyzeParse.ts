/**
 * service-flow analyze JSON wire → typed pack (shared by analyze + fallback synthesis).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowAnalyzeParsed } from "@/lib/requirements/serviceFlowAnalyzeValidation";

export type ServiceFlowAnalyzeIntentWire =
  | "add_actor"
  | "update_actor"
  | "add_step"
  | "update_step"
  | "update_mapping"
  | "show_summary"
  | "delegate_to_ai"
  | "unclear";

function safeText(v: unknown, max = 520): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function clamp01Score(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function ensureServiceFlowShape(v: unknown, nowIso: string): RequirementsServiceFlowV1 | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const actorsRaw = Array.isArray(o.actors) ? o.actors : [];
  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];

  const actors = actorsRaw
    .map((a) => {
      const aa = a as Record<string, unknown>;
      const id = safeText(aa.id, 90);
      const name = safeText(aa.name, 60);
      const kind = safeText(aa.kind, 16) === "system" ? "system" : "human";
      const description = safeText(aa.description, 140);
      if (!id || !name) return null;
      return { id, name, kind, description };
    })
    .filter(Boolean) as RequirementsServiceFlowV1["actors"];

  const actorIds = new Set(actors.map((a) => a.id));
  const steps = stepsRaw
    .map((s) => {
      const ss = s as Record<string, unknown>;
      const id = safeText(ss.id, 140);
      const title = safeText(ss.title, 80);
      const purpose = safeText(ss.purpose, 240);
      const order = Number(ss.order);
      const primaryActorId = safeText(ss.primaryActorId, 90);
      const secondaryActorIds = Array.isArray(ss.secondaryActorIds)
        ? (ss.secondaryActorIds.map((x) => safeText(x, 90)).filter(Boolean) as string[])
        : [];
      const approved = Boolean(ss.approved);
      const updatedAt = safeText(ss.updatedAt, 40) || nowIso;
      if (!id || !title || !Number.isFinite(order)) return null;
      return {
        id,
        title,
        purpose,
        order: Math.max(1, Math.round(order)),
        primaryActorId: primaryActorId && actorIds.has(primaryActorId) ? primaryActorId : "",
        secondaryActorIds: secondaryActorIds.filter((x) => actorIds.has(x)),
        approved,
        updatedAt,
      };
    })
    .filter(Boolean) as RequirementsServiceFlowV1["steps"];

  return {
    createdAt: safeText(o.createdAt, 40) || nowIso,
    updatedAt: safeText(o.updatedAt, 40) || nowIso,
    actors,
    steps,
  };
}

export function parseServiceFlowAnalyzeWire(
  root: unknown,
  nowIso: string,
): { readonly ok: true; readonly data: ServiceFlowAnalyzeParsed & { intent: ServiceFlowAnalyzeIntentWire } } | { readonly ok: false; readonly message: string } {
  if (!root || typeof root !== "object") {
    return { ok: false, message: "root가 객체가 아닙니다." };
  }
  const r = root as Record<string, unknown>;
  const updatedFlow = ensureServiceFlowShape(r.updatedFlow, nowIso);
  if (!updatedFlow) return { ok: false, message: "updatedFlow 스키마가 올바르지 않습니다." };

  const intentRaw = safeText(r.intent, 40) as ServiceFlowAnalyzeIntentWire;
  const allowed: ServiceFlowAnalyzeIntentWire[] = [
    "add_actor",
    "update_actor",
    "add_step",
    "update_step",
    "update_mapping",
    "show_summary",
    "delegate_to_ai",
    "unclear",
  ];
  const intent: ServiceFlowAnalyzeIntentWire = allowed.includes(intentRaw) ? intentRaw : "unclear";

  const readinessRaw = (r.readiness ?? {}) as Record<string, unknown>;
  const readiness = {
    score: clamp01Score(readinessRaw.score),
    actorsReady: Boolean(readinessRaw.actorsReady),
    stepsReady: Boolean(readinessRaw.stepsReady),
    mappingReady: Boolean(readinessRaw.mappingReady),
    readyForNext: Boolean(readinessRaw.readyForNext),
  };

  const quickReplies = Array.isArray(r.quickReplies)
    ? (r.quickReplies.map((x) => safeText(x, 40)).filter(Boolean).slice(0, 3) as string[])
    : null;

  return {
    ok: true,
    data: {
      assistantMessage: safeText(r.assistantMessage, 1200) || "반영했습니다.",
      updatedFlow,
      intent,
      nextQuestion: safeText(r.nextQuestion, 240) || null,
      quickReplies: quickReplies && quickReplies.length ? quickReplies : null,
      readiness,
    },
  };
}
