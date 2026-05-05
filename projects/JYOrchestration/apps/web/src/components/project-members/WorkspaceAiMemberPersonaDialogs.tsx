"use client";

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import type { PlatformAiMemberDef, WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { getWorkspaceAiExecutionProviderLabel } from "@/lib/ai-member/platformAiMembers";
import {
  formatWorkspaceAiPersonaPromptForExport,
  getWorkspaceAiPersonaDispositionSummary,
  getWorkspaceAiPersonaPromptParts,
  type WorkspaceAiPersonaPromptParts,
} from "@/lib/ai-member/workspaceAiPersonaPromptCatalog";
import { WORKSPACE_SCREEN_LABEL, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panelStyle: CSSProperties = {
  width: "min(520px, 100%)",
  maxHeight: "min(88vh, 720px)",
  overflow: "auto",
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 18px 50px rgba(15,23,42,0.18)",
  border: "1px solid #e2e8f0",
};

const promptPanelStyle: CSSProperties = {
  ...panelStyle,
  width: "min(720px, 100%)",
};

function useNarrowOverlay(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setNarrow(Boolean(mq.matches));
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return narrow;
}

async function copyText(text: string): Promise<boolean> {
  const t = text.trim();
  if (!t) return false;
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

function AiMemberProfileImageSection({ catalog }: { readonly catalog: PlatformAiMemberDef }) {
  return (
    <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
      <WorkspaceAiMemberAvatar memberId={catalog.id} size={56} />
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>프로필 이미지</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f766e" }}>
          {catalog.avatarUrl?.trim() ? "사용자 지정 이미지" : "기본 이미지 사용"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{catalog.avatarLabel}</div>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            disabled
            title="향후 프로젝트별로 이미지를 바꿀 수 있도록 예약된 동작입니다."
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#f1f5f9",
              color: "#94a3b8",
              fontWeight: 800,
              fontSize: 12,
              cursor: "not-allowed",
            }}
          >
            이미지 변경
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceAiMemberDetailModal(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly catalog: PlatformAiMemberDef;
  readonly screenKeys: readonly WorkspaceScreenKey[];
  readonly buildVisible: boolean;
  readonly projectEnabled: boolean;
  readonly onOpenPrompt: () => void;
}): ReactElement | null {
  const { open, onClose, catalog, screenKeys, buildVisible, projectEnabled } = props;
  const titleId = useId();
  const narrow = useNarrowOverlay();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const screens =
    screenKeys.length > 0 ? screenKeys.map((k) => WORKSPACE_SCREEN_LABEL[k]).filter(Boolean).join(" · ") : "—";
  const promptParts = getWorkspaceAiPersonaPromptParts(catalog.id);

  return (
    <div
      role="presentation"
      style={
        narrow
          ? { ...overlayStyle, alignItems: "stretch", justifyContent: "stretch", padding: 0 }
          : overlayStyle
      }
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={
          narrow
            ? {
                ...panelStyle,
                width: "100%",
                height: "100%",
                maxHeight: "100%",
                borderRadius: 0,
                borderLeft: "none",
                borderRight: "none",
                borderTop: "none",
                borderBottom: "none",
              }
            : panelStyle
        }
      >
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id={titleId} style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
              AI 멤버 상세
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>역할·프롬프트는 조회 전용입니다.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ padding: "16px 18px 20px" }}>
          <AiMemberProfileImageSection catalog={catalog} />
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
              <tbody>
                {[
                  ["이름", catalog.title || "—"],
                  ["역할", catalog.briefRole || "—"],
                  ["참여 화면", screens || "—"],
                  ["엔진", getWorkspaceAiExecutionProviderLabel(catalog.id) || "—"],
                  ["성향 설명", getWorkspaceAiPersonaDispositionSummary(catalog.id) || "—"],
                ].map(([label, value], idx) => (
                  <tr key={label} style={{ borderTop: idx === 0 ? "none" : "1px solid #f1f5f9" }}>
                    <td
                      style={{
                        width: 104,
                        padding: "10px 12px",
                        background: "#f8fafc",
                        color: "#64748b",
                        fontWeight: 900,
                        fontSize: 11,
                        letterSpacing: 0.02,
                        verticalAlign: "top",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#0f172a", fontWeight: 700, lineHeight: 1.55, wordBreak: "break-word" }}>
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            {promptReadonlyField(
              "system_prompt",
              promptParts.system_prompt,
              "workspace-ai-prompt-inline-system",
              () => void copyText(promptParts.system_prompt),
              "이 섹션 복사"
            )}
            {promptReadonlyField(
              "persona_prompt",
              promptParts.persona_prompt,
              "workspace-ai-prompt-inline-persona",
              () => void copyText(promptParts.persona_prompt),
              "이 섹션 복사"
            )}
            {promptReadonlyField(
              "workspace_override_prompt",
              promptParts.workspace_override_prompt.trim() || "",
              "workspace-ai-prompt-inline-workspace-override",
              () => void copyText(promptParts.workspace_override_prompt),
              "이 섹션 복사"
            )}
            {!promptParts.workspace_override_prompt.trim() ? (
              <p style={{ fontSize: 12, color: "#64748b", marginTop: -8, marginBottom: 16, lineHeight: 1.45 }}>
                현재 비어 있습니다. 추후 프로젝트·화면별 오버라이드를 저장하면 이 필드에 표시됩니다.
              </p>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => void copyText(formatWorkspaceAiPersonaPromptForExport(promptParts))}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #0d9488",
                  background: "#ecfdf5",
                  color: "#0f766e",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                전체 복사 (헤더 포함)
              </button>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
            빌드 표시: <strong style={{ color: buildVisible ? "#0f766e" : "#94a3b8" }}>{buildVisible ? "표시" : "숨김"}</strong>
            {" · "}
            프로젝트 활성: <strong style={{ color: projectEnabled ? "#0f766e" : "#94a3b8" }}>{projectEnabled ? "켜짐" : "꺼짐"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function promptReadonlyField(label: string, value: string, testId: string, onCopy: () => void, copyLabel: string) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{label}</span>
        <button
          type="button"
          onClick={onCopy}
          style={{
            padding: "5px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            color: "#334155",
          }}
        >
          {copyLabel}
        </button>
      </div>
      <textarea
        readOnly
        value={value}
        rows={6}
        spellCheck={false}
        data-testid={testId}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontSize: 12.5,
          lineHeight: 1.5,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          color: "#0f172a",
          resize: "vertical",
          minHeight: 68,
        }}
      />
    </div>
  );
}

export function WorkspaceAiPersonaPromptModal(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly memberTitle: string;
  readonly memberId: WorkspaceAiMemberId;
  /** 향후 편집 모드 — 현재는 항상 읽기 전용 */
  readonly readOnly?: boolean;
  readonly onCopied?: (message: string) => void;
}): ReactElement | null {
  const { open, onClose, memberTitle, memberId, readOnly = true, onCopied } = props;
  const titleId = useId();
  const narrow = useNarrowOverlay();
  const [parts, setParts] = useState<WorkspaceAiPersonaPromptParts>(() => getWorkspaceAiPersonaPromptParts(memberId));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setParts(getWorkspaceAiPersonaPromptParts(memberId));
  }, [open, memberId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const notify = useCallback(
    (ok: boolean) => {
      onCopied?.(ok ? "클립보드에 복사했습니다." : "복사에 실패했습니다.");
    },
    [onCopied]
  );

  const copySection = useCallback(
    async (text: string) => {
      const ok = await copyText(text);
      notify(ok);
    },
    [notify]
  );

  const copyAll = useCallback(async () => {
    const ok = await copyText(formatWorkspaceAiPersonaPromptForExport(parts));
    notify(ok);
  }, [parts, notify]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={
        narrow
          ? { ...overlayStyle, zIndex: 70, alignItems: "stretch", justifyContent: "stretch", padding: 0 }
          : { ...overlayStyle, zIndex: 70 }
      }
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={
          narrow
            ? {
                ...promptPanelStyle,
                width: "100%",
                height: "100%",
                maxHeight: "100%",
                borderRadius: 0,
                borderLeft: "none",
                borderRight: "none",
                borderTop: "none",
                borderBottom: "none",
              }
            : promptPanelStyle
        }
      >
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id={titleId} style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
              프롬프트 · {memberTitle}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {readOnly ? "읽기 전용" : "편집"} · system / persona / workspace_override 분리
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ padding: "16px 18px 22px" }}>
          {promptReadonlyField(
            "system_prompt",
            parts.system_prompt,
            "workspace-ai-prompt-system",
            () => void copySection(parts.system_prompt),
            "이 섹션 복사"
          )}
          {promptReadonlyField(
            "persona_prompt",
            parts.persona_prompt,
            "workspace-ai-prompt-persona",
            () => void copySection(parts.persona_prompt),
            "이 섹션 복사"
          )}
          {promptReadonlyField(
            "workspace_override_prompt",
            parts.workspace_override_prompt.trim() || "",
            "workspace-ai-prompt-workspace-override",
            () => void copySection(parts.workspace_override_prompt),
            "이 섹션 복사"
          )}
          {!parts.workspace_override_prompt.trim() ? (
            <p style={{ fontSize: 12, color: "#64748b", marginTop: -8, marginBottom: 16, lineHeight: 1.45 }}>
              현재 비어 있습니다. 추후 프로젝트·화면별 오버라이드를 저장하면 이 필드에 표시됩니다.
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={() => void copyAll()}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #0d9488",
                background: "#ecfdf5",
                color: "#0f766e",
                fontWeight: 900,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              전체 복사 (헤더 포함)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
