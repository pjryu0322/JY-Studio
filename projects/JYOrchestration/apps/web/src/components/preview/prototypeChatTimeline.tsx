"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";
import type {
  PrototypeChatAction,
  PrototypeChatBlock,
  PrototypeChatBuiltMessage,
} from "@/lib/prototype/buildPrototypeChatMessages";

const bubbleBase: CSSProperties = {
  borderRadius: 14,
  padding: "10px 12px",
  maxWidth: "min(92%, 560px)",
  fontSize: 12.5,
  lineHeight: 1.55,
};

const chipBtn: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  color: "#0f172a",
};

const chipPrimary: CSSProperties = {
  ...chipBtn,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
};

const chipMuted: CSSProperties = {
  ...chipBtn,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
};

function toneColor(tone: string): string {
  if (tone === "done") return "#16a34a";
  if (tone === "running") return "#2563eb";
  if (tone === "failed") return "#dc2626";
  if (tone === "warn") return "#ea580c";
  return "#94a3b8";
}

export function PrototypeActionChips(p: {
  readonly actions: readonly PrototypeChatAction[];
  readonly onAction: (a: PrototypeChatAction) => void;
}) {
  if (!p.actions?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {p.actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={Boolean(a.disabled)}
          onClick={() => p.onAction(a)}
          style={
            a.intent === "CONFIRM_EXECUTION" || a.intent === "CREATE_PLAN"
              ? { ...chipPrimary, opacity: a.disabled ? 0.5 : 1, cursor: a.disabled ? "not-allowed" : "pointer" }
              : { ...chipMuted, opacity: a.disabled ? 0.5 : 1, cursor: a.disabled ? "not-allowed" : "pointer" }
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function renderBlocks(blocks: readonly PrototypeChatBlock[] | undefined): ReactNode {
  if (!blocks?.length) return null;
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      {blocks.map((b, i) => {
        if (b.kind === "text") {
          return (
            <div key={`t-${i}`} style={{ color: "#334155", fontWeight: 650, whiteSpace: "pre-wrap" }}>
              {b.text}
            </div>
          );
        }
        if (b.kind === "env_table") {
          return (
            <div
              key={`e-${i}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                overflow: "hidden",
                fontSize: 12,
              }}
            >
              {b.rows.map((r) => (
                <div
                  key={r.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 10px",
                    borderTop: r.key === b.rows[0]?.key ? undefined : "1px solid #f1f5f9",
                    background: "#fafbfc",
                  }}
                >
                  <span style={{ fontWeight: 800, color: "#475569" }}>{r.label}</span>
                  <span style={{ fontWeight: 900, color: r.state === "완료" ? "#16a34a" : r.state === "오류" ? "#dc2626" : "#b45309" }}>{r.state}</span>
                </div>
              ))}
            </div>
          );
        }
        if (b.kind === "ordered_titles") {
          return (
            <ol key={`o-${i}`} style={{ margin: 0, paddingLeft: 18, color: "#0f172a", fontWeight: 750 }}>
              {b.items.map((it) => (
                <li key={it.order} style={{ marginBottom: 4 }}>
                  {it.title}
                </li>
              ))}
            </ol>
          );
        }
        if (b.kind === "pipeline_grid") {
          return (
            <div key={`p-${i}`} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
              {b.rows.map((r) => (
                <div key={r.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", marginBottom: 4 }}>{r.label}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: toneColor(r.tone),
                      padding: "6px 4px",
                      borderRadius: 8,
                      background: "#f1f5f9",
                    }}
                  >
                    {r.stateKo}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        if (b.kind === "bullet_list") {
          return (
            <ul key={`u-${i}`} style={{ margin: 0, paddingLeft: 18, color: "#475569", fontWeight: 750 }}>
              {b.items.map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "url_line") {
          return (
            <div key={`url-${i}`} style={{ fontSize: 12, wordBreak: "break-all", fontWeight: 800, color: "#0f766e" }}>
              {b.url}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export function PrototypeAiMessage(p: {
  readonly message: PrototypeChatBuiltMessage;
  readonly onAction: (a: PrototypeChatAction) => void;
}) {
  const m = p.message;
  return (
    <div style={{ alignSelf: "flex-start", ...bubbleBase, background: "#fff", border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 11, fontWeight: 950, color: "#64748b", marginBottom: 4 }}>AI기획자</div>
      {m.title ? (
        <div style={{ fontSize: 13, fontWeight: 950, color: "#0f172a", marginBottom: 4 }}>{m.title}</div>
      ) : null}
      {m.body ? (
        <div style={{ fontSize: 12.5, color: "#334155", fontWeight: 650, whiteSpace: "pre-wrap" }}>{m.body}</div>
      ) : null}
      {renderBlocks(m.blocks)}
      {m.actions?.length ? <PrototypeActionChips actions={m.actions} onAction={p.onAction} /> : null}
    </div>
  );
}

export function PrototypeUserMessage(p: { readonly text: string; readonly atLabel?: string }) {
  return (
    <div style={{ alignSelf: "flex-end", ...bubbleBase, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
      <div style={{ fontSize: 11, fontWeight: 950, color: "#166534", marginBottom: 4 }}>사용자</div>
      <div style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 800, whiteSpace: "pre-wrap" }}>{p.text}</div>
    </div>
  );
}

export function PrototypeSystemMessage(p: { readonly text: string }) {
  return (
    <div
      style={{
        alignSelf: "center",
        maxWidth: "min(92%, 520px)",
        fontSize: 12,
        color: "#64748b",
        fontWeight: 750,
        padding: "6px 10px",
        borderRadius: 8,
        background: "#f1f5f9",
      }}
    >
      {p.text}
    </div>
  );
}

export type TimelineUserBubble = Readonly<{ id: string; text: string; at: number }>;
export type TimelineEphemeralAi = Readonly<{ id: string; text: string; at: number }>;

export function PrototypeChatTimeline(p: {
  readonly derived: readonly PrototypeChatBuiltMessage[];
  readonly userBubbles: readonly TimelineUserBubble[];
  readonly ephemeralAi: readonly TimelineEphemeralAi[];
  readonly onAction: (a: PrototypeChatAction) => void;
  readonly cursorPromptResolver: (order: number) => PrototypeWorkUnit | null;
}) {
  const rows = useMemo(() => {
    type Row =
      | { sort: number; kind: "derived"; m: PrototypeChatBuiltMessage }
      | { sort: number; kind: "user"; u: TimelineUserBubble }
      | { sort: number; kind: "ephemeral"; e: TimelineEphemeralAi };
    const list: Row[] = [
      ...p.derived.map((m) => ({ sort: m.orderKey, kind: "derived" as const, m })),
      ...p.userBubbles.map((u) => ({ sort: u.at, kind: "user" as const, u })),
      ...p.ephemeralAi.map((e) => ({ sort: e.at, kind: "ephemeral" as const, e })),
    ];
    list.sort((a, b) => (a.sort === b.sort ? (a.kind === "derived" ? -1 : 1) : a.sort - b.sort));
    return list;
  }, [p.derived, p.userBubbles, p.ephemeralAi]);

  const [promptWu, setPromptWu] = useState<PrototypeWorkUnit | null>(null);

  const handleAction = (a: PrototypeChatAction) => {
    if (a.intent === "OPEN_CURSOR_PROMPT" && typeof a.workUnitOrder === "number") {
      const u = p.cursorPromptResolver(a.workUnitOrder);
      if (u) setPromptWu(u);
      return;
    }
    p.onAction(a);
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, overflow: "auto", paddingRight: 2 }}>
        {rows.map((row) => {
          if (row.kind === "derived") {
            if (row.m.role === "system") {
              return <PrototypeSystemMessage key={row.m.id} text={row.m.body ?? ""} />;
            }
            return <PrototypeAiMessage key={row.m.id} message={row.m} onAction={handleAction} />;
          }
          if (row.kind === "user") {
            return <PrototypeUserMessage key={row.u.id} text={row.u.text} />;
          }
          return (
            <div
              key={row.e.id}
              style={{ alignSelf: "flex-start", ...bubbleBase, background: "#fff", border: "1px solid #e2e8f0" }}
            >
              <div style={{ fontSize: 11, fontWeight: 950, color: "#64748b", marginBottom: 4 }}>AI기획자</div>
              <div style={{ fontSize: 12.5, color: "#334155", fontWeight: 650, whiteSpace: "pre-wrap" }}>{row.e.text}</div>
            </div>
          );
        })}
      </div>

      {promptWu ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setPromptWu(null)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              maxHeight: "min(80vh, 720px)",
              overflow: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 1000, color: "#0f172a", marginBottom: 8 }}>
              Cursor 프롬프트 · #{promptWu.order} {promptWu.title}
            </div>
            <pre style={{ fontSize: 11.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
              {promptWu.cursorPrompt ?? ""}
            </pre>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setPromptWu(null)} style={chipMuted}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PrototypeChatInput(p: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 10,
        background: "#fff",
      }}
    >
      <textarea
        ref={p.inputRef}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        onKeyDown={p.onKeyDown}
        placeholder={p.placeholder}
        rows={2}
        disabled={p.disabled}
        style={{
          flex: 1,
          resize: "none",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          padding: 8,
          fontSize: 12.5,
          lineHeight: 1.45,
          fontWeight: 800,
          minHeight: 44,
        }}
      />
      <button type="button" onClick={() => p.onSend()} disabled={p.disabled || !p.value.trim()} style={chipPrimary}>
        전송
      </button>
    </div>
  );
}

export function PrototypeChatShell(p: {
  readonly children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#fafafa",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        minHeight: 0,
        flex: "1 1 auto",
        height: "100%",
      }}
    >
      {p.children}
    </div>
  );
}
