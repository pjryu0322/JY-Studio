"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  RECOMMENDATION_EVIDENCE_STAGE_LABELS,
  recommendationEvidenceStatusLabel,
  summarizeRecommendationEvidenceCounts,
  type RecommendationEvidenceItem,
} from "@/lib/recommendation/recommendationEvidence";

const panelIntro =
  "AI가 제안한 추천안과 그 근거를 확인합니다. 내부 프롬프트 조립 정보가 아니라, 사용자가 확인할 수 있는 판단 근거만 표시합니다.";

const emptyCopy =
  "아직 표시할 추천근거가 없습니다.\n\nAI팀이 기획안, 서비스 흐름, 구현 작업안 등을 제안하면 이곳에서 추천 근거를 확인할 수 있습니다.";

function statusPillStyle(status: RecommendationEvidenceItem["status"]): CSSProperties {
  const base: CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 999,
    flexShrink: 0,
  };
  if (status === "confirmed") return { ...base, background: "#ecfdf5", color: "#065f46" };
  if (status === "candidate") return { ...base, background: "#faf5ff", color: "#6b21a8" };
  if (status === "needs_review") return { ...base, background: "#fffbeb", color: "#92400e" };
  return { ...base, background: "#f1f5f9", color: "#475569" };
}

function BulletList({ items, label }: { readonly items: readonly string[]; readonly label: string }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#334155", lineHeight: 1.45 }}>
        {items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export type RecommendationEvidencePanelProps = Readonly<{
  readonly items: readonly RecommendationEvidenceItem[];
  readonly selectedId?: string;
  readonly onSelect?: (id: string) => void;
  readonly onClose?: () => void;
}>;

export function RecommendationEvidencePanel({
  items,
  selectedId,
  onSelect,
  onClose,
}: RecommendationEvidencePanelProps) {
  const counts = useMemo(() => summarizeRecommendationEvidenceCounts(items), [items]);
  const [internalSelected, setInternalSelected] = useState<string | undefined>(undefined);
  const activeId = selectedId ?? internalSelected ?? items[0]?.id;
  const selected = items.find((i) => i.id === activeId) ?? null;

  const pick = (id: string) => {
    if (onSelect) onSelect(id);
    else setInternalSelected(id);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "#fff",
      }}
    >
      <header
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>AI 추천근거</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{panelIntro}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 8,
              width: 32,
              height: 32,
              fontSize: 18,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        ) : null}
      </header>

      {items.length === 0 ? (
        <p style={{ padding: "20px 18px", margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55, whiteSpace: "pre-line" }}>
          {emptyCopy}
        </p>
      ) : (
        <>
          <div
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 12,
              color: "#475569",
            }}
          >
            <span>
              전체 <strong>{counts.total}</strong>건
            </span>
            {counts.confirmed > 0 ? (
              <span>
                확정 <strong>{counts.confirmed}</strong>건
              </span>
            ) : null}
            {counts.candidate > 0 ? (
              <span>
                후보 <strong>{counts.candidate}</strong>건
              </span>
            ) : null}
            {counts.needsReview > 0 ? (
              <span>
                확인필요 <strong>{counts.needsReview}</strong>건
              </span>
            ) : null}
            {counts.deferred > 0 ? (
              <span>
                보류 <strong>{counts.deferred}</strong>건
              </span>
            ) : null}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
            <nav
              aria-label="최근 추천근거"
              style={{
                width: "min(42%, 200px)",
                borderRight: "1px solid #e2e8f0",
                overflow: "auto",
                padding: "10px 8px",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", margin: "0 6px 8px" }}>최근 추천근거</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((item) => {
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => pick(item.id)}
                        aria-current={active ? "true" : undefined}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: `1px solid ${active ? "#0d9488" : "#e2e8f0"}`,
                          background: active ? "#ecfdf5" : "#f8fafc",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0f172a", marginBottom: 4 }}>{item.title}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                          <span style={statusPillStyle(item.status)}>{recommendationEvidenceStatusLabel(item.status)}</span>
                          <span style={{ fontSize: 10.5, color: "#64748b" }}>
                            {RECOMMENDATION_EVIDENCE_STAGE_LABELS[item.stage]} · {item.aiMemberLabel}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "14px 16px" }}>
              {selected ? (
                <article>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{selected.title}</h3>
                    <span style={statusPillStyle(selected.status)}>
                      {recommendationEvidenceStatusLabel(selected.status)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                    AI멤버: {selected.aiMemberLabel} · 연결 단계: {RECOMMENDATION_EVIDENCE_STAGE_LABELS[selected.stage]}
                  </div>
                  <section>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>추천 내용</div>
                    <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{selected.summary}</p>
                  </section>
                  <BulletList items={selected.reasons} label="근거" />
                  <BulletList items={selected.sourceInputs} label="사용자 입력" />
                  <BulletList items={selected.referencedArtifacts} label="참조 산출물" />
                  <BulletList items={selected.unresolvedItems} label="확인 필요" />
                  <BulletList items={selected.nextActions} label="다음 작업" />
                </article>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
