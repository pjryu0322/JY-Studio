"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  PRECHECK_DECISION_LABEL,
  PRECHECK_RISK_LABEL,
  type KnowledgePackPrecheckResult,
} from "@/lib/knowledge-packs/knowledgePackPrecheckTypes";

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

const btnPrecheck: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: "#fff",
  color: t.textPrimary,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
  marginBottom: 10,
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

const cardPrecheck: CSSProperties = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: "#fafafa",
  fontSize: 12,
  color: t.textSecondary,
  lineHeight: 1.55,
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
  onRunPrecheck: () => void | Promise<void>;
  precheckBusy?: boolean;
  precheckResult: KnowledgePackPrecheckResult | null;
  draftBlockedByPrecheck: boolean;
  precheckDraftHint: string | null;
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
          RAG 색인은 원천자료를 청크/임베딩/벡터 저장소에 저장해 Agent가 검색할 수 있게 만드는 후속 기능입니다. (현재 1단계: 수집·파싱·청크·KEYWORD 검색까지 지원)
        </div>
      </div>

      <div style={noticeRag}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>RAG 준비 상태</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>원천자료 링크/본문 등록: 지원</li>
          <li>원천자료 수집: 지원</li>
          <li>문서 파싱: 지원</li>
          <li>청크 분할/저장: 지원</li>
          <li>KEYWORD 기반 검색: 지원</li>
          <li>임베딩 생성: 다음 단계</li>
          <li>벡터저장소 저장: 다음 단계</li>
          <li>Agent별 자동 프롬프트 주입: 준비 중</li>
        </ul>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <button
          type="button"
          disabled={p.precheckBusy || p.draftBusy}
          onClick={() => void p.onRunPrecheck()}
          style={{
            ...btnPrecheck,
            opacity: p.precheckBusy || p.draftBusy ? 0.7 : 1,
            cursor: p.precheckBusy || p.draftBusy ? "wait" : "pointer",
          }}
        >
          {p.precheckBusy ? "사전점검 중..." : "지식팩 등록 가능성 사전점검"}
        </button>
      </div>

      {p.precheckResult ? (
        <div style={cardPrecheck}>
          <div style={{ fontWeight: 900, fontSize: 13, color: t.textPrimary, marginBottom: 8 }}>사전점검 결과</div>
          <div style={{ marginBottom: 6 }}>
            <strong>판정</strong> {PRECHECK_DECISION_LABEL[p.precheckResult.decision]} · <strong>위험도</strong>{" "}
            {PRECHECK_RISK_LABEL[p.precheckResult.riskLevel]} · <strong>점수</strong> {p.precheckResult.score}
          </div>
          <div style={{ marginBottom: 8, color: t.textPrimary }}>{p.precheckResult.summary}</div>
          {p.precheckResult.reasons.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>판정 근거</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {p.precheckResult.reasons.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.precheckResult.issues.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>위험·보완 요소</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {p.precheckResult.issues.map((iss, i) => (
                  <li key={i}>
                    <span style={{ fontWeight: 700 }}>{iss.title}</span> ({PRECHECK_RISK_LABEL[iss.riskLevel]}) — {iss.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>필수 자료</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {p.precheckResult.requiredSources.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>권장 자료</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {p.precheckResult.recommendedSources.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>다음 조치</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {p.precheckResult.nextActions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted }}>
            검토 필요 — 보안: {p.precheckResult.shouldRequireSecurityReview ? "예" : "아니오"} · 라이선스:{" "}
            {p.precheckResult.shouldRequireLicenseReview ? "예" : "아니오"} · 사용자 제공 문서:{" "}
            {p.precheckResult.shouldRequireUserProvidedDocs ? "예" : "아니오"}
          </div>
        </div>
      ) : null}

      {p.precheckDraftHint ? (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            background: p.draftBlockedByPrecheck ? "#fef2f2" : "#fffbeb",
            border: p.draftBlockedByPrecheck ? "1px solid #fecaca" : "1px solid #fcd34d",
            color: p.draftBlockedByPrecheck ? "#991b1b" : "#78350f",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          {p.precheckDraftHint}
        </div>
      ) : null}

      <button
        type="button"
        disabled={p.draftBusy || p.draftBlockedByPrecheck}
        onClick={() => void p.onGenerateDraft()}
        style={{
          ...btnDraft,
          opacity: p.draftBusy || p.draftBlockedByPrecheck ? 0.75 : 1,
          cursor: p.draftBusy || p.draftBlockedByPrecheck ? "not-allowed" : "pointer",
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
