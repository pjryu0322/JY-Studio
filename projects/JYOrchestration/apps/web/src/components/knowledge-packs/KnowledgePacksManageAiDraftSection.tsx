"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

type FieldProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly blockStyle?: CSSProperties;
};

function Field({ label, children, blockStyle }: FieldProps) {
  return (
    <label style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 800, color: t.textSecondary, ...blockStyle }}>
      {label}
      {children}
    </label>
  );
}

const noticeAiSecurity: CSSProperties = {
  marginBottom: 10,
  padding: 10,
  borderRadius: 8,
  background: "#fffbeb",
  border: "1px solid #fcd34d",
  fontSize: 12,
  color: "#78350f",
  lineHeight: 1.55,
};

const noticeRag: CSSProperties = {
  marginBottom: 12,
  padding: 10,
  borderRadius: 8,
  background: "#f0f9ff",
  border: "1px solid #bae6fd",
  fontSize: 12,
  color: "#0c4a6e",
  lineHeight: 1.5,
};

const btnDraft: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "#6366f1",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
  marginBottom: 10,
};

const noticeLlmVsRag: CSSProperties = {
  marginBottom: 10,
  padding: 10,
  borderRadius: 8,
  background: "#f8fafc",
  border: `1px solid #e2e8f0`,
  fontSize: 12,
  color: "#334155",
  lineHeight: 1.55,
};

export type KnowledgePacksManageAiDraftSectionProps = Readonly<{
  inputStyle: CSSProperties;
  draftBusy?: boolean;
  categories: readonly string[];
  name: string;
  onNameChange: (v: string) => void;
  aiProductUrl: string;
  onAiProductUrlChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  agents: string;
  onAgentsChange: (v: string) => void;
  aiPurpose: string;
  onAiPurposeChange: (v: string) => void;
  aiOfficialDocsUrl: string;
  onAiOfficialDocsUrlChange: (v: string) => void;
  aiApiDocsUrl: string;
  onAiApiDocsUrlChange: (v: string) => void;
  aiRepositoryUrl: string;
  onAiRepositoryUrlChange: (v: string) => void;
  aiLicenseHint: string;
  onAiLicenseHintChange: (v: string) => void;
  aiMemo: string;
  onAiMemoChange: (v: string) => void;
  onGenerateDraft: () => void | Promise<void>;
  lastDraftWarnings: readonly string[];
  lastSourceCandidates: string;
}>;

export function KnowledgePacksManageAiDraftSection(p: KnowledgePacksManageAiDraftSectionProps) {
  const s = p.inputStyle;
  const ta = { ...s, marginTop: 4, resize: "vertical" as const };

  return (
    <>
      <Field label="제품명 (필수)">
        <input
          value={p.name}
          onChange={(e) => p.onNameChange(e.target.value)}
          placeholder="예: NHN TOAST UI Grid, Kakao Login, 금융인증서"
          style={{ ...s, marginTop: 4 }}
        />
      </Field>
      <Field label="제품 URL (권장)">
        <input
          value={p.aiProductUrl}
          onChange={(e) => p.onAiProductUrlChange(e.target.value)}
          placeholder="예: https://ui.toast.com/tui-grid"
          style={{ ...s, marginTop: 4 }}
        />
      </Field>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <Field label="카테고리" blockStyle={{ flex: "1 1 140px", marginBottom: 0 }}>
          <select value={p.category} onChange={(e) => p.onCategoryChange(e.target.value)} style={{ ...s, marginTop: 4 }}>
            {p.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="대상 Agent (줄바꿈, 기본 AI_DEVELOPER)">
        <textarea value={p.agents} onChange={(e) => p.onAgentsChange(e.target.value)} rows={2} style={ta} />
      </Field>
      <Field label="사용 목적 (권장)">
        <textarea
          value={p.aiPurpose}
          onChange={(e) => p.onAiPurposeChange(e.target.value)}
          placeholder="예: 업무용 목록 화면 Grid 구현 기준으로 사용"
          rows={2}
          style={ta}
        />
      </Field>
      <Field label="공식 문서 URL">
        <input value={p.aiOfficialDocsUrl} onChange={(e) => p.onAiOfficialDocsUrlChange(e.target.value)} style={{ ...s, marginTop: 4 }} />
      </Field>
      <Field label="API 문서 URL">
        <input value={p.aiApiDocsUrl} onChange={(e) => p.onAiApiDocsUrlChange(e.target.value)} style={{ ...s, marginTop: 4 }} />
      </Field>
      <Field label="GitHub / npm URL">
        <input value={p.aiRepositoryUrl} onChange={(e) => p.onAiRepositoryUrlChange(e.target.value)} style={{ ...s, marginTop: 4 }} />
      </Field>
      <Field label="라이선스 힌트 (텍스트, 초안 생성 시 유형 추정에만 사용)">
        <input
          value={p.aiLicenseHint}
          onChange={(e) => p.onAiLicenseHintChange(e.target.value)}
          placeholder="예: MIT, 상용, 외부 서비스(OAuth)"
          style={{ ...s, marginTop: 4 }}
        />
      </Field>
      <Field label="추가 메모">
        <textarea value={p.aiMemo} onChange={(e) => p.onAiMemoChange(e.target.value)} rows={2} style={ta} />
      </Field>

      <div style={noticeAiSecurity}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>AI·보안 검토 안내</div>
        <div>AI가 생성한 라이선스·보안·API Key·개인정보 관련 내용은 반드시 사용자가 공식 문서 기준으로 확인해야 합니다.</div>
        <div style={{ marginTop: 8 }}>
          보안 검토 대상: Secret, API Key, Access Token, Refresh Token, Client Secret, 개인정보 수집/저장, 외부 스크립트/CDN, 상용 라이선스/서비스 약관
        </div>
      </div>

      <div style={noticeLlmVsRag}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>AI 초안 vs RAG 색인</div>
        <div>AI 초안 생성은 현재 입력값 기반 지식팩 초안 생성 기능입니다.</div>
        <div style={{ marginTop: 6 }}>
          RAG 색인은 원천자료를 청크/임베딩/벡터 저장소에 저장해 Agent가 검색할 수 있게 만드는 후속 기능입니다.
        </div>
      </div>

      <div style={noticeRag}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>RAG 준비 상태</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>원천자료 링크: 입력 가능</li>
          <li>원천자료 수집: 다음 단계</li>
          <li>문서 파싱: 다음 단계</li>
          <li>청크 분할: 다음 단계</li>
          <li>임베딩 생성: 다음 단계</li>
          <li>벡터저장소 저장: 다음 단계</li>
          <li>Agent별 검색/프롬프트 주입: 다음 단계</li>
        </ul>
      </div>

      <button
        type="button"
        disabled={p.draftBusy}
        onClick={() => void p.onGenerateDraft()}
        style={{
          ...btnDraft,
          opacity: p.draftBusy ? 0.75 : 1,
          cursor: p.draftBusy ? "wait" : "pointer",
        }}
      >
        {p.draftBusy ? "AI 초안 생성 중..." : "AI로 지식팩 초안 생성"}
      </button>

      {p.lastDraftWarnings.length > 0 ? (
        <div style={{ marginBottom: 10, fontSize: 12, color: t.textSecondary }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>초안 경고</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {p.lastDraftWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {p.lastSourceCandidates ? (
        <Field label="원천자료 후보 (직전 생성 결과, 읽기 전용)">
          <textarea readOnly value={p.lastSourceCandidates} rows={8} style={{ ...ta, background: "#f8fafc" }} />
        </Field>
      ) : null}
    </>
  );
}
