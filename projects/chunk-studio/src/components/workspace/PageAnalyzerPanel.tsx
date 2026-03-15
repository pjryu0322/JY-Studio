"use client";

// Analyzer-only presentation layer for page classification and overrides.
import { type PageType } from "./pageTypeClassifier";
import type {
  DocumentFamily,
  PageClassificationRecord,
  PageOrientation,
  PageSubType,
} from "@/lib/analysis/pageUnderstanding";

interface PageAnalyzerPanelProps {
  familyHint: DocumentFamily;
  pageProfiles: PageClassificationRecord[];
  currentPage: number;
  onFamilyHintChange: (value: DocumentFamily) => void;
  onHoverPage: (page: number | null) => void;
  onSelectPage: (page: number) => void;
  onOverrideOrientation: (
    page: number,
    value: PageOrientation,
  ) => void;
  onOverridePageType: (
    page: number,
    value: PageType,
  ) => void;
  onOverrideSubType: (
    page: number,
    value: PageSubType,
  ) => void;
}

export default function PageAnalyzerPanel({
  familyHint,
  pageProfiles,
  currentPage,
  onFamilyHintChange,
  onHoverPage,
  onSelectPage,
  onOverrideOrientation,
  onOverridePageType,
  onOverrideSubType,
}: PageAnalyzerPanelProps) {
  return (
    <aside
      style={{
        minHeight: 0,
        overflowY: "auto",
        borderRight: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: 12,
        display: "grid",
        gap: 10,
        alignContent: "start",
        order: 1,
      }}
      aria-label="Page Type Analyzer"
    >
      <div style={{ display: "grid", gap: 2 }}>
        <strong style={{ fontSize: 14, color: "#0f172a" }}>
          Page Type Analyzer
        </strong>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          페이지 구조를 먼저 점검하고 필요하면 타입을 수동
          보정하세요.
        </span>
      </div>
      <div
        style={{
          border: "1px solid #dbe3f1",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 8,
          background: "#f8fafc",
        }}
      >
        <label
          style={{
            display: "grid",
            gap: 4,
            fontSize: 12,
            color: "#334155",
          }}
        >
          document family
          <select
            value={familyHint}
            onChange={(e) =>
              onFamilyHintChange(
                e.target.value as DocumentFamily,
              )
            }
            style={selector}
          >
            <option value="guide_manual">
              guide_manual
            </option>
            <option value="public_rfp">public_rfp</option>
            <option value="policy_manual">
              policy_manual
            </option>
            <option value="unknown_generic">
              unknown_generic
            </option>
          </select>
        </label>
      </div>
      {pageProfiles.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          페이지 분석 데이터를 준비 중입니다.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {pageProfiles.map((profile) => (
            <button
              key={`page-profile-${profile.pageNumber}`}
              type="button"
              onMouseEnter={() =>
                onHoverPage(profile.pageNumber)
              }
              onMouseLeave={() => onHoverPage(null)}
              onClick={() =>
                onSelectPage(profile.pageNumber)
              }
              style={{
                textAlign: "left",
                border: "1px solid #dbe3f1",
                borderRadius: 10,
                background:
                  currentPage === profile.pageNumber
                    ? "rgba(59,130,246,0.08)"
                    : "#fff",
                padding: 10,
                display: "grid",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong
                  style={{ fontSize: 13, color: "#0f172a" }}
                >
                  Page {profile.pageNumber}
                </strong>
                <span
                  style={{ fontSize: 11, color: "#64748b" }}
                >
                  {Math.round(profile.confidence * 100)}%
                </span>
              </div>
              <Row
                label="orientation"
                value={profile.orientationFinal}
              />
              <Row
                label="type"
                value={profile.pageTypeFinal}
              />
              <Row
                label="subtype"
                value={profile.subTypeFinal}
              />
              <Row
                label="confidence"
                value={
                  profile.confidence > 0
                    ? profile.confidence.toFixed(2)
                    : "-"
                }
              />
              <label
                style={{
                  display: "grid",
                  gap: 4,
                  fontSize: 11,
                  color: "#475569",
                }}
              >
                orientation override
                <select
                  value={profile.orientationFinal}
                  onChange={(event) => {
                    event.stopPropagation();
                    onOverrideOrientation(
                      profile.pageNumber,
                      event.target.value as PageOrientation,
                    );
                  }}
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  style={selector}
                >
                  <option value="portrait">portrait</option>
                  <option value="landscape">
                    landscape
                  </option>
                </select>
              </label>
              <label
                style={{
                  display: "grid",
                  gap: 4,
                  fontSize: 11,
                  color: "#475569",
                }}
              >
                page type override
                <select
                  value={profile.pageTypeFinal}
                  onChange={(event) => {
                    event.stopPropagation();
                    onOverridePageType(
                      profile.pageNumber,
                      event.target.value as PageType,
                    );
                  }}
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  style={selector}
                >
                  <option value="cover">cover</option>
                  <option value="toc">toc</option>
                  <option value="table">table</option>
                  <option value="body">body</option>
                  <option value="revision_or_form">
                    revision_or_form
                  </option>
                </select>
              </label>
              <label
                style={{
                  display: "grid",
                  gap: 4,
                  fontSize: 11,
                  color: "#475569",
                }}
              >
                subtype override
                <select
                  value={profile.subTypeFinal}
                  onChange={(event) => {
                    event.stopPropagation();
                    onOverrideSubType(
                      profile.pageNumber,
                      event.target.value as PageSubType,
                    );
                  }}
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  style={selector}
                >
                  <option value="title_cover">
                    title_cover
                  </option>
                  <option value="revision_history_table">
                    revision_history_table
                  </option>
                  <option value="narrative_body">
                    narrative_body
                  </option>
                  <option value="body_with_diagram">
                    body_with_diagram
                  </option>
                  <option value="body_with_table">
                    body_with_table
                  </option>
                  <option value="table_reference">
                    table_reference
                  </option>
                  <option value="body_with_examples">
                    body_with_examples
                  </option>
                </select>
              </label>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr",
        gap: 8,
        fontSize: 12,
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#1f2937" }}>{value}</span>
    </div>
  );
}

const selector = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 8px",
  color: "#334155",
  width: "100%",
} as const;
