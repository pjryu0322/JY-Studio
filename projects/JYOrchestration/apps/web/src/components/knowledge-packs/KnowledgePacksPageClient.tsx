"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceModeOptional } from "@/components/layout/WorkspaceModeContext";
import { uiTokens as t } from "@/components/ui/tokens";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import {
  DEVELOPER_GRID_KNOWLEDGE_PACKS,
  filterKnowledgePacks,
  getKnowledgePackById,
  KNOWLEDGE_PACK_AGENT_LABEL,
  KNOWLEDGE_PACK_CATEGORY_LABEL,
} from "@/lib/knowledge-packs/developerGridPacks";
import {
  buildKnowledgePackDetailAbsoluteUrl,
  openKnowledgePackDetailWindow,
  resolveKnowledgePackOpenLayout,
} from "@/lib/knowledge-packs/openKnowledgePackDetailWindow";
import type { KnowledgePackAgent, KnowledgePackCategory } from "@/lib/knowledge-packs/types";

const AGENTS: Array<KnowledgePackAgent | "ALL"> = [
  "ALL",
  "AI_DEVELOPER",
  "AI_PLANNER",
  "AI_ANALYST",
  "AI_ARCHITECT",
  "AI_DESIGNER",
  "AI_REVIEWER",
  "AI_SECURITY",
];
const CATEGORIES: Array<KnowledgePackCategory | "ALL"> = ["ALL", "GRID", "AUTH", "SECURITY", "UI", "API", "DATA", "INTEGRATION"];

const managementBtnStyle: CSSProperties = {
  flex: "1 1 140px",
  minWidth: 0,
  maxWidth: "100%",
  padding: "8px 12px",
  borderRadius: t.radiusMd,
  border: `1px solid ${t.border}`,
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: t.textSecondary,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "center",
  boxSizing: "border-box",
};

export function KnowledgePacksPageClient() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const workspaceModeCtx = useWorkspaceModeOptional();

  const [agentFilter, setAgentFilter] = useState<KnowledgePackAgent | "ALL">("AI_DEVELOPER");
  const [categoryFilter, setCategoryFilter] = useState<KnowledgePackCategory | "ALL">("GRID");

  const selectedId = useMemo(() => String(searchParams.get("id") ?? "").trim(), [searchParams]);

  const filtered = useMemo(
    () => filterKnowledgePacks({ agent: agentFilter, category: categoryFilter }),
    [agentFilter, categoryFilter]
  );

  const selected = useMemo(() => {
    const fromUrl = selectedId ? getKnowledgePackById(selectedId) : undefined;
    if (fromUrl && filtered.some((p) => p.id === fromUrl.id)) return fromUrl;
    return filtered[0] ?? null;
  }, [selectedId, filtered]);

  useEffect(() => {
    if (!selected) return;
    if (selected.id === selectedId) return;
    const u = new URLSearchParams(searchParams.toString());
    u.set("id", selected.id);
    router.replace(`${pathname}?${u.toString()}`, { scroll: false });
  }, [selected, selectedId, router, pathname, searchParams]);

  const setPackId = useCallback(
    (id: string) => {
      const u = new URLSearchParams(searchParams.toString());
      u.set("id", id);
      router.replace(`${pathname}?${u.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const openDetailForPack = useCallback(
    (packId: string) => {
      setPackId(packId);
      const layoutOpts =
        workspaceModeCtx != null
          ? { workspaceMode: workspaceModeCtx.mode, effectiveLayout: workspaceModeCtx.effectiveLayout }
          : undefined;
      const opened = openKnowledgePackDetailWindow(packId, layoutOpts);
      if (!opened) {
        const { mode } = resolveKnowledgePackOpenLayout(layoutOpts);
        window.open(buildKnowledgePackDetailAbsoluteUrl(packId, mode), "_blank", "noopener,noreferrer");
      }
    },
    [setPackId, workspaceModeCtx]
  );

  const bottomPad = "max(72px, calc(env(safe-area-inset-bottom, 0px) + 56px))";
  const pagePadding = isNarrow ? `12px 12px ${bottomPad}` : `20px 20px ${bottomPad}`;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: pagePadding,
        boxSizing: "border-box",
      }}
    >
      <div style={{ flexShrink: 0, marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, justifyContent: "space-between" }}>
        <h1 style={{ fontSize: isNarrow ? 20 : 22, fontWeight: 900, color: t.textPrimary, margin: 0 }}>지식팩</h1>
        <Link href="/workspace" prefetch={false} style={{ fontSize: 13, fontWeight: 700, color: t.accentTealFg }}>
          ← 프로젝트 목록
        </Link>
      </div>

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12,
          alignItems: "stretch",
          maxWidth: "100%",
        }}
      >
        <button
          type="button"
          style={managementBtnStyle}
          onClick={() => window.alert("지식팩 등록 기능은 다음 단계에서 제공됩니다.")}
        >
          지식팩 등록
        </button>
        <button
          type="button"
          style={managementBtnStyle}
          onClick={() => window.alert("AI Agent와 카테고리 매핑 설정은 다음 단계에서 제공됩니다.")}
        >
          Agent 매핑 설정
        </button>
        <button
          type="button"
          style={managementBtnStyle}
          onClick={() => window.alert("지식팩 변경 이력 관리는 다음 단계에서 제공됩니다.")}
        >
          변경 이력
        </button>
      </div>

      <div
        style={{
          flexShrink: 0,
          marginBottom: 14,
          padding: "12px 14px",
          borderRadius: t.radiusLg,
          border: `1px solid ${t.border}`,
          background: "#f8fafc",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, marginBottom: 6, letterSpacing: "0.03em" }}>운영 구조 안내</div>
        <p style={{ fontSize: 13, color: t.textPrimary, lineHeight: 1.55, margin: 0, overflowWrap: "anywhere" }}>
          현재는 플랫폼 기본 AI개발자 Grid 지식팩을 정적 seed로 제공합니다. 다음 단계에서는 사용자/조직/프로젝트 단위 지식팩 등록, AI 구조화, Agent별 최적화, 검수/승인, 버전/이력관리를 지원할 예정입니다.
        </p>
      </div>

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
          alignItems: "flex-end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          AI Agent
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value as KnowledgePackAgent | "ALL")}
            style={{
              minWidth: 160,
              padding: "8px 10px",
              borderRadius: t.radiusMd,
              border: `1px solid ${t.border}`,
              fontSize: 13,
              background: "#fff",
            }}
          >
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a === "ALL" ? "전체" : KNOWLEDGE_PACK_AGENT_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          카테고리
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as KnowledgePackCategory | "ALL")}
            style={{
              minWidth: 140,
              padding: "8px 10px",
              borderRadius: t.radiusMd,
              border: `1px solid ${t.border}`,
              fontSize: 13,
              background: "#fff",
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "전체" : KNOWLEDGE_PACK_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: 24,
            borderRadius: t.radiusLg,
            border: `1px dashed ${t.border}`,
            color: t.textMuted,
            fontSize: 14,
          }}
        >
          선택한 Agent·카테고리에 해당하는 지식팩이 없습니다. 필터를 바꿔 보세요.
        </div>
      ) : (
        <div style={{ maxWidth: 760, width: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, letterSpacing: "0.04em", marginBottom: 8 }}>지식팩 목록</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((pack) => {
              const active = selected?.id === pack.id;
              const lic =
                pack.license.type === "MIT" ? "MIT" : pack.license.type === "OPEN_SOURCE" ? "Open Source" : pack.license.type;
              return (
                <button
                  key={pack.id}
                  type="button"
                  data-testid={`knowledge-pack-list-${pack.id}`}
                  title="클릭하면 새 창에서 상세가 열립니다"
                  aria-label={`${pack.name} 상세를 새 창에서 열기`}
                  onClick={() => openDetailForPack(pack.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: t.radiusLg,
                    border: `1px solid ${active ? t.accentTeal : t.border}`,
                    background: active ? t.accentTealSurface : t.bgCard,
                    cursor: "pointer",
                    boxShadow: active ? `0 0 0 2px rgba(13, 148, 136, 0.18)` : t.shadowSoft,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary, marginBottom: 6 }}>{pack.name}</div>
                  <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.45, marginBottom: 8 }}>
                    {pack.summary.length > 140 ? `${pack.summary.slice(0, 140)}…` : pack.summary}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, fontWeight: 800, color: t.textMuted }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f1f5f9" }}>Category: {KNOWLEDGE_PACK_CATEGORY_LABEL[pack.category]}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f1f5f9" }}>
                      Agent: {pack.agents.map((a) => KNOWLEDGE_PACK_AGENT_LABEL[a]).join(", ")}
                    </span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#ecfdf5", color: t.accentTealFg }}>License: {lic}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#eff6ff", color: t.info }}>Status: {pack.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ flexShrink: 0, marginTop: 24, fontSize: 11, color: t.textMuted }}>
        정적 seed 기반 MVP입니다. 상세 전용 URL:{" "}
        <code style={{ fontSize: 11 }}>/knowledge-packs/detail?id={DEVELOPER_GRID_KNOWLEDGE_PACKS[0]?.id}</code>
      </div>
    </div>
  );
}
