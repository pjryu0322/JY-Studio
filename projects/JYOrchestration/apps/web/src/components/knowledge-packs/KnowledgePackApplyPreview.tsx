"use client";

import { uiTokens as t } from "@/components/ui/tokens";

const MOCK_ROWS: readonly { code: string; name: string; status: string; owner: string; updated: string }[] = [
  { code: "SRV-1024", name: "청구서 조회 API", status: "검수", owner: "AI개발자", updated: "2026-05-08" },
  { code: "SRV-1025", name: "결제 이력 동기화", status: "진행", owner: "박백엔드", updated: "2026-05-07" },
  { code: "SRV-1026", name: "알림 템플릿 관리", status: "대기", owner: "이기획", updated: "2026-05-06" },
  { code: "SRV-1027", name: "권한 매트릭스", status: "진행", owner: "최보안", updated: "2026-05-05" },
  { code: "SRV-1028", name: "배치 작업 모니터", status: "완료", owner: "AI개발자", updated: "2026-05-04" },
  { code: "SRV-1029", name: "외부 연동 로그", status: "진행", owner: "정연동", updated: "2026-05-03" },
];

function PreviewNotice({ children }: { readonly children: string }) {
  return (
    <p style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.55, margin: "0 0 12px", padding: 10, background: t.surfaceInfoSoft, border: `1px solid ${t.borderInfoSoft}`, borderRadius: t.radiusMd }}>
      {children}
    </p>
  );
}

function AgGridCommunityPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <PreviewNotice>
        AG Grid Community 적용 예시입니다. Community 기능 범위에서 업무용 목록, 정렬, 필터, 페이지네이션, 행 선택 UX를 반영합니다. Enterprise 전용 기능은 포함하지 않습니다.
      </PreviewNotice>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", padding: 10, border: `1px solid ${t.border}`, borderRadius: t.radiusMd, background: "#f8fafc" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: t.textMuted }}>
          검색어
          <input readOnly placeholder="서비스명·코드" style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, fontSize: 12, minWidth: 160 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: t.textMuted }}>
          상태
          <select style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, fontSize: 12, minWidth: 120 }} defaultValue="ALL">
            <option>전체</option>
            <option>진행</option>
            <option>완료</option>
          </select>
        </label>
        <button type="button" style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: t.accentTeal, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "default" }}>
          조회
        </button>
      </div>
      <div style={{ border: `1px solid ${t.borderStrong}`, borderRadius: t.radiusMd, overflow: "auto", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, width: 36, textAlign: "center" }}>
                <span aria-hidden>☑</span>
              </th>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left", fontWeight: 800 }}>
                코드 ↕
              </th>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left", fontWeight: 800 }}>
                서비스명 <span style={{ color: t.primary }}>▾</span>
              </th>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left", fontWeight: 800 }}>
                상태
              </th>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left", fontWeight: 800 }}>
                담당
              </th>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left", fontWeight: 800 }}>
                수정일
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ROWS.map((row, i) => (
              <tr key={row.code} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "center" }}>
                  <input type="checkbox" readOnly checked={i === 1} aria-label="행 선택" style={{ cursor: "default" }} />
                </td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}`, fontFamily: "monospace", color: t.textSecondary }}>{row.code}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}`, fontWeight: 600 }}>{row.name}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: row.status === "완료" ? "#dcfce7" : row.status === "검수" ? "#fef3c7" : "#e2e8f0",
                      color: t.textPrimary,
                    }}
                  >
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>{row.owner}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}`, color: t.textMuted }}>{row.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, color: t.textMuted }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>페이지 1 / 3</span>
          <button type="button" style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "#fff", cursor: "default" }}>
            이전
          </button>
          <button type="button" style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "#fff", cursor: "default" }}>
            다음
          </button>
        </div>
        <button type="button" style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "#fff", fontWeight: 700, cursor: "default" }}>
          다운로드 (Mock)
        </button>
      </div>
    </div>
  );
}

function TanStackTablePreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <PreviewNotice>
        TanStack Table은 headless table engine이므로, UI는 JYOrchestration 공통 스타일로 직접 구성합니다. JY Basic Grid의 내부 테이블 로직 후보로 적합합니다.
      </PreviewNotice>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "8px 10px", background: "#0f172a", color: "#f8fafc", borderRadius: t.radiusMd, fontSize: 12, fontWeight: 800 }}>
        <span>JY Basic Grid</span>
        <span style={{ opacity: 0.85, fontWeight: 600 }}>플랫폼 공통 UI · TanStack Table (headless)</span>
      </div>
      <div style={{ padding: 10, border: `1px solid ${t.border}`, borderRadius: t.radiusMd, background: "#f8fafc", display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted }}>정렬: 코드 ↑</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted }}>필터: 상태 = 진행</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted }}>선택: 2행</span>
      </div>
      <div style={{ border: `1px solid ${t.borderStrong}`, borderRadius: t.radiusMd, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
          <thead>
            <tr style={{ background: "#fff" }}>
              <th style={{ padding: 8, borderBottom: `2px solid ${t.accentTeal}`, textAlign: "left" }}>코드</th>
              <th style={{ padding: 8, borderBottom: `2px solid ${t.accentTeal}`, textAlign: "left" }}>업무명</th>
              <th style={{ padding: 8, borderBottom: `2px solid ${t.accentTeal}`, textAlign: "left" }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ROWS.slice(0, 6).map((row, i) => (
              <tr key={row.code} style={{ background: i % 2 === 0 ? "#fff" : "#f1f5f9" }}>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}`, fontFamily: "ui-monospace, monospace" }}>{row.code}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>{row.name}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ padding: "2px 8px", borderRadius: 6, background: "#e0f2fe", color: t.info, fontSize: 11, fontWeight: 800 }}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, fontSize: 12 }}>
        <button type="button" style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "#fff", cursor: "default" }}>
          이전
        </button>
        <button type="button" style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.border}`, background: "#fff", cursor: "default" }}>
          다음
        </button>
      </div>
    </div>
  );
}

function TabulatorPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <PreviewNotice>
        Tabulator 적용 예시입니다. 내장 기능이 풍부한 독립형 Grid 후보이지만, React 프로젝트에서는 인스턴스 생성/해제와 상태 충돌을 주의해야 합니다.
      </PreviewNotice>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 900, padding: "4px 10px", borderRadius: 999, background: t.surfaceCaution, color: t.textCautionStrong, border: `1px solid ${t.borderCaution}` }}>React 생명주기 주의</span>
        <button type="button" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "#fff", cursor: "default" }}>
          그룹
        </button>
        <button type="button" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "#fff", cursor: "default" }}>
          필터
        </button>
        <button type="button" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`, background: "#fff", cursor: "default" }}>
          정렬
        </button>
        <span style={{ fontSize: 11, color: t.textMuted, marginLeft: "auto" }}>데이터 로딩…</span>
      </div>
      <div style={{ border: `1px solid ${t.borderStrong}`, borderRadius: t.radiusMd, overflow: "auto", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 500 }}>
          <thead>
            <tr style={{ background: "linear-gradient(180deg,#f8fafc,#eef2ff)" }}>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left" }}>코드</th>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left" }}>항목</th>
              <th style={{ padding: 8, borderBottom: `1px solid ${t.border}`, textAlign: "left" }}>비고 (편집)</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ROWS.slice(0, 7).map((row, i) => (
              <tr key={row.code} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>{row.code}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>{row.name}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${t.border}`, background: i === 2 ? "#fff7ed" : undefined, outline: i === 2 ? `1px dashed ${t.warning}` : undefined }}>
                  {i === 2 ? "편집 중…" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 실제 Grid 라이브러리 없이, 지식팩별 적용 감각을 보여주는 정적 Mock입니다. */
export function KnowledgePackApplyPreview({ packId }: { readonly packId: string }) {
  switch (packId) {
    case "grid.ag-grid-community":
      return <AgGridCommunityPreview />;
    case "grid.tanstack-table":
      return <TanStackTablePreview />;
    case "grid.tabulator":
      return <TabulatorPreview />;
    default:
      return (
        <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
          이 지식팩에 대한 시각적 미리보기 템플릿이 아직 없습니다. 목록에서 Grid 지식팩을 선택해 보세요.
        </p>
      );
  }
}
