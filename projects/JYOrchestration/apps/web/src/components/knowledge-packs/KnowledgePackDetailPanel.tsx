"use client";

import { useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { KnowledgePackApplyPreview } from "@/components/knowledge-packs/KnowledgePackApplyPreview";
import { KNOWLEDGE_PACK_AGENT_LABEL, KNOWLEDGE_PACK_CATEGORY_LABEL } from "@/lib/knowledge-packs/developerGridPacks";
import { downloadKnowledgePackMarkdownFile } from "@/lib/knowledge-packs/knowledgePackMarkdown";
import type { KnowledgePack } from "@/lib/knowledge-packs/types";

function MarkdownDownloadIcon({ size = 20 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

const DETAIL_TABS = [
  { id: "summary" as const, label: "요약" },
  { id: "implementation" as const, label: "구현 지침" },
  { id: "cursor" as const, label: "Cursor 반영" },
  { id: "forbidden" as const, label: "금지사항" },
  { id: "review" as const, label: "검수" },
  { id: "preview" as const, label: "미리보기" },
];
type DetailTabId = (typeof DETAIL_TABS)[number]["id"];

function SectionTitle({ children }: { readonly children: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 900, color: t.textSecondary, marginBottom: 8, letterSpacing: "0.02em" }}>{children}</div>
  );
}

function BulletList({ items }: { readonly items: readonly string[] }) {
  if (!items.length) return <div style={{ fontSize: 13, color: t.textMuted }}>—</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: t.textPrimary, lineHeight: 1.55, overflowWrap: "anywhere" }}>
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

export type KnowledgePackDetailPanelProps = Readonly<{
  pack: KnowledgePack;
  /** 독립 팝업 창에서 사용 시 세로 높이를 뷰포트에 맞춤 */
  embed?: boolean;
}>;

export function KnowledgePackDetailPanel({ pack, embed }: KnowledgePackDetailPanelProps) {
  const [tab, setTab] = useState<DetailTabId>("summary");
  const licenseLabel =
    pack.license.type === "MIT" ? "MIT" : pack.license.type === "OPEN_SOURCE" ? "Open Source" : pack.license.type;

  const maxHeight = embed ? "calc(100dvh - 88px)" : "min(calc(100dvh - 12.5rem), 880px)";

  return (
    <div
      style={{
        border: `1px solid ${t.borderStrong}`,
        borderRadius: t.radiusLg,
        background: t.bgCard,
        boxShadow: t.shadowSoft,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        maxWidth: "100%",
        maxHeight,
        overflow: "hidden",
        overflowX: "hidden",
        flex: embed ? "1 1 auto" : undefined,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "14px 16px 10px",
          borderBottom: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: t.textPrimary, marginBottom: 4, overflowWrap: "anywhere" }}>{pack.name}</div>
          <div style={{ fontSize: 12, color: t.textMuted, overflowWrap: "anywhere" }}>
            v{pack.version} · {KNOWLEDGE_PACK_CATEGORY_LABEL[pack.category]} ·{" "}
            {pack.agents.map((a) => KNOWLEDGE_PACK_AGENT_LABEL[a]).join(", ")} · {pack.status}
          </div>
        </div>
        <button
          type="button"
          onClick={() => downloadKnowledgePackMarkdownFile(pack)}
          title="상세 내용을 Markdown(.md)으로 다운로드"
          aria-label="Markdown 파일로 다운로드"
          style={{
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            padding: 0,
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: "#fff",
            color: t.textSecondary,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <MarkdownDownloadIcon />
        </button>
      </div>

      <div
        role="tablist"
        aria-label="지식팩 상세 섹션"
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "8px 10px",
          borderBottom: `1px solid ${t.border}`,
          rowGap: 8,
          background: "#f8fafc",
          minWidth: 0,
        }}
      >
        {DETAIL_TABS.map((tb) => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.id)}
              style={{
                flex: "0 0 auto",
                whiteSpace: "nowrap",
                padding: "8px 12px",
                borderRadius: 8,
                border: active ? `1px solid ${t.accentTeal}` : `1px solid ${t.border}`,
                background: active ? t.accentTealSurface : "#fff",
                color: active ? t.accentTealFg : t.textSecondary,
                fontSize: 12,
                fontWeight: active ? 900 : 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {tb.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          padding: "16px 16px 20px",
        }}
      >
        {tab === "summary" ? (
          <>
            <SectionTitle>개요</SectionTitle>
            <p style={{ fontSize: 14, color: t.textPrimary, lineHeight: 1.6, margin: "0 0 18px", overflowWrap: "anywhere" }}>{pack.summary}</p>

            <SectionTitle>적용 권장 상황</SectionTitle>
            <div style={{ marginBottom: 18 }}>
              <BulletList items={pack.recommendedUseCases} />
            </div>

            <SectionTitle>적용 비권장 상황</SectionTitle>
            <div style={{ marginBottom: 18 }}>
              <BulletList items={pack.notRecommendedUseCases} />
            </div>

            <SectionTitle>라이선스 / 제약</SectionTitle>
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

            <SectionTitle>주요 기능</SectionTitle>
            <div style={{ marginBottom: 18 }}>
              <BulletList items={pack.capabilities} />
            </div>

            <SectionTitle>대체 / 비교 기준</SectionTitle>
            <div style={{ marginBottom: 18 }}>
              <BulletList items={pack.alternatives} />
            </div>

            <SectionTitle>참고 링크</SectionTitle>
            <RefLinks refs={pack.references} />

            <div
              style={{
                marginTop: 20,
                padding: "10px 12px",
                borderRadius: t.radiusMd,
                background: "#f8fafc",
                border: `1px solid ${t.border}`,
                fontSize: 11,
                color: t.textMuted,
                lineHeight: 1.55,
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontWeight: 900, color: t.textSecondary, marginBottom: 6, letterSpacing: "0.02em" }}>운영 정보 (MVP)</div>
              <div>Scope: {pack.scope}</div>
              <div>Version: v{pack.version}</div>
              <div>Status: {pack.status}</div>
              <div style={{ marginTop: 6 }}>향후 버전·승인 이력이 이 화면과 연동될 예정입니다.</div>
              <div>향후 Agent별 최적화 프로필은 별도 설정으로 분리될 예정입니다.</div>
            </div>
          </>
        ) : null}

        {tab === "implementation" ? (
          <>
            <SectionTitle>AI개발자 구현 지침</SectionTitle>
            <BulletList items={pack.implementationGuidelines} />
          </>
        ) : null}

        {tab === "cursor" ? (
          <>
            <SectionTitle>Cursor 프롬프트 반영 기준</SectionTitle>
            <BulletList items={pack.cursorPromptRules} />
          </>
        ) : null}

        {tab === "forbidden" ? (
          <>
            <SectionTitle>금지사항</SectionTitle>
            <BulletList items={pack.forbiddenPatterns} />
          </>
        ) : null}

        {tab === "review" ? (
          <>
            <SectionTitle>검수 체크리스트</SectionTitle>
            <BulletList items={pack.reviewChecklist} />
          </>
        ) : null}

        {tab === "preview" ? (
          <>
            <SectionTitle>적용 미리보기</SectionTitle>
            <KnowledgePackApplyPreview packId={pack.id} />
          </>
        ) : null}
      </div>
    </div>
  );
}
