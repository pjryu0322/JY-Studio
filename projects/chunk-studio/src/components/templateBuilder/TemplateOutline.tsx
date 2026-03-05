"use client";

import type { OutlineModel } from "@/lib/template/outlineBuilder";

interface TemplateOutlineProps {
  outline: OutlineModel;
}

export default function TemplateOutline({ outline }: TemplateOutlineProps) {
  return (
    <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Outline</h4>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        {outline.title}
        {outline.docType ? ` (${outline.docType})` : ""}
      </div>
      {outline.sections.length === 0 ? (
        <div style={{ fontSize: 12, color: "#666" }}>아직 섹션이 없습니다.</div>
      ) : (
        outline.sections.map((section) => (
          <div key={section.id} style={{ marginBottom: 8, fontSize: 12 }}>
            <div style={{ fontWeight: 600 }}>
              - {section.title}{" "}
              <span
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 999,
                  fontSize: 10,
                  padding: "1px 6px",
                  color: "#666",
                }}
              >
                {section.required ? "required" : "optional"}
              </span>
            </div>
            {section.fields.map((field) => (
              <div key={field.key} style={{ marginLeft: 12 }}>
                · Field: {field.label}
              </div>
            ))}
            {section.tables.map((table) => (
              <div key={table.id} style={{ marginLeft: 12 }}>
                · Table: {table.name}
              </div>
            ))}
            {section.repeatBlocks.map((repeat) => (
              <div key={repeat.id} style={{ marginLeft: 12 }}>
                · Repeat: {repeat.name}{" "}
                {repeat.pattern ? `(pattern=${repeat.pattern}` : "(pattern=none"}
                {repeat.min !== undefined ? `, min=${repeat.min}` : ""}
                {repeat.max !== undefined ? `, max=${repeat.max}` : ""}
                )
              </div>
            ))}
          </div>
        ))
      )}
      {(outline.unassigned.fields.length > 0 ||
        outline.unassigned.tables.length > 0 ||
        outline.unassigned.repeatBlocks.length > 0) && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
          <div style={{ fontWeight: 600 }}>Unassigned</div>
          {outline.unassigned.fields.map((field) => (
            <div key={field.key}>· Field: {field.label}</div>
          ))}
          {outline.unassigned.tables.map((table) => (
            <div key={table.id}>· Table: {table.name}</div>
          ))}
          {outline.unassigned.repeatBlocks.map((repeat) => (
            <div key={repeat.id}>· Repeat: {repeat.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
