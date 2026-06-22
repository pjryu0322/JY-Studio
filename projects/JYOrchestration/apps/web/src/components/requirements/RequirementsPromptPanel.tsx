"use client";

import type { RequirementsPromptView } from "@/lib/requirements/requirementsPromptView";

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 12,
  padding: "10px 12px",
};

function preStyle(): React.CSSProperties {
  return {
    margin: 0,
    whiteSpace: "pre-wrap",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#0f172a",
  };
}

export function RequirementsPromptPanel({ view }: { readonly view: RequirementsPromptView }) {  return (
    <section className="relative" style={{ position: "relative", ...card }}>      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>System prompt</div>
          <pre style={preStyle()}>{view.systemPrompt}</pre>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Project context</div>
          <pre
            style={preStyle()}
          >{`프로젝트명: ${view.projectContext.name || "(없음)"}\n설명: ${view.projectContext.description || "(없음)"}\n현재 단계: ${view.projectContext.stage}`}</pre>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Target</div>
          <pre style={preStyle()}>{`대상: ${view.target.targetName} (${view.target.targetId})`}</pre>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Recent conversation excerpt</div>
          <pre style={preStyle()}>{view.conversationExcerpt || "(없음)"}</pre>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Final composed prompt (safe view)</div>
          <pre style={preStyle()}>{view.finalComposedPrompt}</pre>
        </div>
      </div>
    </section>
  );
}

