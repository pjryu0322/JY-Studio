"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { uiTokens as t } from "@/components/ui/tokens";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import {
  DEVELOPER_GRID_KNOWLEDGE_PACKS,
  filterKnowledgePacks,
  getKnowledgePackById,
  KNOWLEDGE_PACK_AGENT_LABEL,
  KNOWLEDGE_PACK_CATEGORY_LABEL,
} from "@/lib/knowledge-packs/developerGridPacks";
import type { KnowledgePack, KnowledgePackAgent, KnowledgePackCategory } from "@/lib/knowledge-packs/types";

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

function SectionTitle({ children }: { readonly children: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 900, color: t.textSecondary, marginBottom: 8, letterSpacing: "0.02em" }}>{children}</div>
  );
}

function BulletList({ items }: { readonly items: readonly string[] }) {
  if (!items.length) return <div style={{ fontSize: 13, color: t.textMuted }}>—</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: t.textPrimary, lineHeight: 1.55 }}>
      {items.map((line, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          {line}
        </li>
      ))}
    </ul>
  );
}

function RefLinks({ refs }: { readonly refs: readonly { label: string; url: string }[] }) {
  if (!refs.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {refs.map((r) => (
        <a
          key={r.url}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, fontWeight: 700, color: t.info, wordBreak: "break-all" }}
        >
          {r.label}
        </a>
      ))}
    </div>
  );
}

function KnowledgePackDetail({ pack }: { readonly pack: KnowledgePack }) {
  const licenseLabel =
    pack.license.type === "MIT" ? "MIT" : pack.license.type === "OPEN_SOURCE" ? "Open Source" : pack.license.type;
  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: t.radiusLg,
        background: t.bgCard,
        padding: 16,
        maxHeight: "min(72dvh, 720px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        boxShadow: t.shadowSoft,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, color: t.textPrimary, marginBottom: 4 }}>{pack.name}</div>
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
        v{pack.version} · {KNOWLEDGE_PACK_CATEGORY_LABEL[pack.category]} ·{" "}
        {pack.agents.map((a) => KNOWLEDGE_PACK_AGENT_LABEL[a]).join(", ")} · {pack.status}
      </div>

      <SectionTitle>1. 개요</SectionTitle>
      <p style={{ fontSize: 14, color: t.textPrimary, lineHeight: 1.6, margin: "0 0 18px" }}>{pack.summary}</p>

      <SectionTitle>2. 적용 권장 상황</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.recommendedUseCases} />
      </div>

      <SectionTitle>3. 적용 비권장 상황</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.notRecommendedUseCases} />
      </div>

      <SectionTitle>4. 라이선스 / 제약</SectionTitle>
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 800, color: t.textSecondary }}>라이선스: {licenseLabel}</div>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.license.notes} />
      </div>
      {pack.constraints.length ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>추가 제약</div>
          <div style={{ marginBottom: 18 }}>
            <BulletList items={pack.constraints} />
          </div>
        </>
      ) : null}

      <SectionTitle>5. 주요 기능</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.capabilities} />
      </div>

      <SectionTitle>6. AI개발자 구현 지침</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.implementationGuidelines} />
      </div>

      <SectionTitle>7. Cursor 프롬프트 반영 기준</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.cursorPromptRules} />
      </div>

      <SectionTitle>8. 금지사항</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.forbiddenPatterns} />
      </div>

      <SectionTitle>9. 대체 / 비교 기준</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.alternatives} />
      </div>

      <SectionTitle>10. 검수 체크리스트</SectionTitle>
      <div style={{ marginBottom: 18 }}>
        <BulletList items={pack.reviewChecklist} />
      </div>

      <SectionTitle>11. 참고 링크</SectionTitle>
      <RefLinks refs={pack.references} />
    </div>
  );
}

export function KnowledgePacksPageClient() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const isNarrow = useMediaQuery("(max-width: 900px)");

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

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", padding: isNarrow ? "12px 12px 24px" : "20px 20px 32px" }}>
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: isNarrow ? 20 : 22, fontWeight: 900, color: t.textPrimary, margin: 0 }}>지식팩</h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: "8px 0 0", maxWidth: 640, lineHeight: 1.55 }}>
            AI Agent가 기획, 설계, 개발, 검수 과정에서 참조하는 제품·기술·표준 지식입니다. 현재는 AI개발자용 Grid 지식팩을 우선 제공합니다.
          </p>
        </div>
        <Link href="/workspace" prefetch={false} style={{ fontSize: 13, fontWeight: 700, color: t.accentTealFg }}>
          ← 프로젝트 목록
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "minmax(260px, 340px) 1fr",
            gap: isNarrow ? 16 : 20,
            alignItems: "start",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((pack) => {
              const active = selected?.id === pack.id;
              const lic =
                pack.license.type === "MIT" ? "MIT" : pack.license.type === "OPEN_SOURCE" ? "Open Source" : pack.license.type;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPackId(pack.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: t.radiusLg,
                    border: `1px solid ${active ? t.accentTeal : t.border}`,
                    background: active ? t.accentTealSurface : t.bgCard,
                    cursor: "pointer",
                    boxShadow: active ? `0 0 0 2px rgba(13, 148, 136, 0.2)` : t.shadowSoft,
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

          {selected ? (
            <KnowledgePackDetail pack={selected} />
          ) : (
            <div style={{ fontSize: 14, color: t.textMuted }}>지식팩을 선택하세요.</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: t.textMuted }}>
        정적 seed 기반 MVP입니다. 상세 URL 예:{" "}
        <code style={{ fontSize: 11 }}>/knowledge-packs?id={DEVELOPER_GRID_KNOWLEDGE_PACKS[0]?.id}</code>
      </div>
    </div>
  );
}
