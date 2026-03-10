"use client";

import type { TemplateDraftValidation } from "@/lib/template/validateTemplateDraft";

interface TemplateWarningsProps {
  validation: TemplateDraftValidation;
}

export default function TemplateWarnings({ validation }: TemplateWarningsProps) {
  return (
    <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>
        Warnings {validation.errors.length > 0 ? `(errors ${validation.errors.length})` : ""}
      </h4>
      {validation.errors.length === 0 && validation.warnings.length === 0 ? (
        <div style={{ fontSize: 12, color: "#666" }}>경고 없음</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {validation.errors.map((error, idx) => (
            <div
              key={`err-${error.code}-${idx}`}
              style={{
                fontSize: 12,
                border: "1px solid #ffcdd2",
                background: "#ffebee",
                borderRadius: 6,
                padding: 8,
              }}
            >
              [ERROR] {error.message}
            </div>
          ))}
          {validation.warnings.map((warning, idx) => (
            <div
              key={`warn-${warning.code}-${idx}`}
              style={{
                fontSize: 12,
                border: "1px solid #ffe082",
                background: "#fff8e1",
                borderRadius: 6,
                padding: 8,
              }}
            >
              [WARN] {warning.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
