"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ProjectRightDrawerShell } from "@/components/ui/ProjectRightDrawerShell";
import type { ImplementationCandidateItem } from "@/lib/requirements/implementationCandidateLabels";
import {
  buildRefineSelectedImplementationCandidatesPrompt,
  REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT,
} from "@/lib/requirements/implementationCandidateLabels";
import type { ImplementationCandidateRefineRequestWire } from "@/lib/requirements/implementationCandidateRefineRequest";
import type { ImplementationSeedGapKey } from "@/lib/requirements/implementationSeed";

const headerStyle: CSSProperties = {
  padding: "16px 18px",
  borderBottom: "1px solid #e2e8f0",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "16px 18px",
};

const footerStyle: CSSProperties = {
  padding: "14px 18px",
  borderTop: "1px solid #e2e8f0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const primaryBtn: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  ...primaryBtn,
  background: "#f1f5f9",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
};

const ghostBtn: CSSProperties = {
  ...secondaryBtn,
  background: "#fff",
  fontWeight: 700,
};

const itemCard = (selected: boolean): CSSProperties => ({
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "12px 12px",
  borderRadius: 10,
  border: selected ? "1px solid #93c5fd" : "1px solid #e2e8f0",
  background: selected ? "#eff6ff" : "#f8fafc",
  cursor: "pointer",
});

export type ImplementationCandidateRefineDrawerProps = Readonly<{
  readonly open: boolean;
  readonly items: readonly ImplementationCandidateItem[];
  readonly onClose: () => void;
  readonly onInsertComposerPrompt: (text: string) => void;
  readonly onRefineRequest: (wire: ImplementationCandidateRefineRequestWire, composerPrompt: string) => void;
}>;

export function ImplementationCandidateRefineDrawer({
  open,
  items,
  onClose,
  onInsertComposerPrompt,
  onRefineRequest,
}: ImplementationCandidateRefineDrawerProps) {
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const itemKeys = useMemo(() => items.map((i) => i.key).join(","), [items]);

  useEffect(() => {
    if (!open) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set());
  }, [open, itemKeys]);

  const selectedLabels = useMemo(
    () =>
      items
        .filter((item) => selectedKeys.has(item.key))
        .map((item) => item.label),
    [items, selectedKeys],
  );

  const hasSelection = selectedLabels.length > 0;

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const closeAndRequest = (wire: ImplementationCandidateRefineRequestWire, composerPrompt: string) => {
    onRefineRequest(wire, composerPrompt);
    onInsertComposerPrompt(composerPrompt);
    onClose();
  };

  return (
    <ProjectRightDrawerShell open={open} onClose={onClose} ariaLabel="기획정보 보완 필요 항목">
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
            기획정보 보완 필요 항목
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "#64748b" }}>
            구현 전 확인이 필요한 후보 항목입니다.
            <br />
            항목을 선택하면 AI기획자에게 보완 요청을 보낼 수 있습니다.
          </p>
        </div>

        <div style={bodyStyle}>
          {items.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              현재 확인할 후보 항목이 없습니다. 채팅에서 직접 보완할 내용을 입력해 주세요.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item) => {
                const selected = selectedKeys.has(item.key);
                return (
                  <label key={item.key} style={itemCard(selected)}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleKey(item.key)}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#0f172a",
                          lineHeight: 1.35,
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
                          fontSize: 12.5,
                          color: "#64748b",
                          lineHeight: 1.45,
                        }}
                      >
                        {item.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button
            type="button"
            style={{
              ...primaryBtn,
              opacity: hasSelection ? 1 : 0.45,
              cursor: hasSelection ? "pointer" : "not-allowed",
            }}
            disabled={!hasSelection}
            onClick={() => {
              const prompt = buildRefineSelectedImplementationCandidatesPrompt(selectedLabels);
              if (!prompt) return;
              const keys = items
                .filter((item) => selectedKeys.has(item.key))
                .map((item) => item.key as ImplementationSeedGapKey);
              closeAndRequest(
                {
                  mode: "selected",
                  kind: "review",
                  keys,
                  labels: selectedLabels,
                  requestedAt: new Date().toISOString(),
                },
                prompt,
              );
            }}
          >
            선택 항목 보완 요청
          </button>
          <button
            type="button"
            style={secondaryBtn}
            disabled={items.length === 0}
            onClick={() =>
              closeAndRequest(
                {
                  mode: "all",
                  kind: "review",
                  keys: items.map((item) => item.key as ImplementationSeedGapKey),
                  labels: items.map((item) => item.label),
                  requestedAt: new Date().toISOString(),
                },
                REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT,
              )
            }
          >
            전체 후보 항목 검토 요청
          </button>
          <button type="button" style={ghostBtn} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </ProjectRightDrawerShell>
  );
}
