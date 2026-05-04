import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { FeaturePlanningSlotV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

const MAX_TOTAL = 9000;
const MAX_ASSET_BODY = 900;
const MAX_STEP_LINE = 400;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatServiceFlow(sf: RequirementsServiceFlowV1): string {
  const actorLines = (sf.actors ?? [])
    .slice(0, 24)
    .map((a) => `- [${a.kind}] ${a.name}${a.description ? `: ${clip(String(a.description), 160)}` : ""}`)
    .join("\n");
  const stepLines = (sf.steps ?? [])
    .slice(0, 20)
    .sort((a, b) => a.order - b.order)
    .map(
      (s) =>
        `- (${s.order}) ${s.title}: ${clip(s.purpose, MAX_STEP_LINE)} (승인: ${s.approved ? "Y" : "N"})`
    )
    .join("\n");
  return [`[액터]`, actorLines || "(없음)", "", `[서비스 흐름 단계]`, stepLines || "(없음)"].join("\n");
}

function formatFeatureSlots(slots: readonly FeaturePlanningSlotV1[]): string {
  return slots
    .filter((s) => !s.legacy)
    .slice(0, 14)
    .map(
      (s) =>
        `- [${s.slotType}] ${s.slotName}: ${clip(s.slotDescription ?? s.reason, 220)} (항목 ${s.items?.length ?? 0}개)`
    )
    .join("\n");
}

/**
 * 프로젝트에 이미 저장된 요구사항·기능정리 데이터를 읽기 전용 문자열로 묶습니다.
 */
export async function buildProjectContext(projectId: string): Promise<string> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return "";

  const row = await findProjectScalarsByIdSafe(pid);
  if (!row) return "";

  const state = parseRequirementsStateJson(row.requirementsStateJson);
  const parts: string[] = [];

  parts.push("[프로젝트 정보]");
  parts.push(`- 제목: ${row.name}`);
  parts.push(`- 설명: ${clip(String(row.description ?? ""), 1200) || "(없음)"}`);

  parts.push("\n[아이디어·구체화 산출물]");
  const assets = state.deliverableAssets ?? [];
  if (!assets.length) {
    parts.push("(등록된 산출물 없음)");
  } else {
    for (const a of assets.slice(0, 8)) {
      const title = String(a.title ?? "").trim() || "(제목 없음)";
      const typ = String(a.type ?? "").trim();
      const body = clip(String(a.content ?? ""), MAX_ASSET_BODY);
      parts.push(`- ${typ ? `[${typ}] ` : ""}${title}\n  ${body}`);
    }
  }

  parts.push("\n[서비스 흐름 · 액터 workspace]");
  const sf = state.serviceFlowV1;
  parts.push(sf ? formatServiceFlow(sf) : "(serviceFlowV1 없음)");

  parts.push("\n[기능 정리 슬롯]");
  const fp = state.featurePlanningSlotsV1;
  const slots = fp?.slots ?? [];
  parts.push(slots.length ? formatFeatureSlots(slots) : "(기능 정리 슬롯 없음)");

  let out = parts.join("\n").trim();
  if (out.length > MAX_TOTAL) {
    out = `${out.slice(0, MAX_TOTAL - 1)}…`;
  }
  return out;
}
