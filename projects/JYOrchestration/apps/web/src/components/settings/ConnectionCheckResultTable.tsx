"use client";

import type { MutableRefObject, CSSProperties } from "react";
import { prototypeEnvReadinessToneColors } from "@/lib/project/prototypeEnvSettingsReadiness";
import type { SplitPreflightTableRow } from "@/lib/prototype/autoGenerationSplitPreflightDisplay";

const itemHeaderStyle: CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  width: 110,
  minWidth: 96,
  whiteSpace: "normal",
};

const statusHeaderStyle: CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  width: 64,
  minWidth: 64,
  whiteSpace: "nowrap",
};

const valueHeaderStyle: CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  whiteSpace: "nowrap",
};

const helpHeaderStyle: CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  width: 48,
  minWidth: 48,
  whiteSpace: "nowrap",
  textAlign: "center",
};

const itemCellStyle: CSSProperties = {
  padding: "10px",
  fontWeight: 700,
  color: "#334155",
  width: 110,
  minWidth: 96,
  whiteSpace: "normal",
  verticalAlign: "top",
};

const statusCellStyle: CSSProperties = {
  padding: "10px",
  width: 64,
  minWidth: 64,
  whiteSpace: "nowrap",
  verticalAlign: "top",
};

const valueCellStyle: CSSProperties = {
  padding: "10px",
  color: "#475569",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  verticalAlign: "top",
};

const helpCellStyle: CSSProperties = {
  padding: "10px",
  width: 48,
  minWidth: 48,
  whiteSpace: "nowrap",
  textAlign: "center",
  verticalAlign: "top",
};

export function ConnectionCheckResultTable(input: {
  readonly title: string;
  readonly testId: string;
  readonly rows: readonly SplitPreflightTableRow[];
  readonly showPlaceholder: boolean;
  readonly openHelpKey: string | null;
  readonly onToggleHelp: (key: string) => void;
  readonly triggerRefs: MutableRefObject<Partial<Record<string, HTMLButtonElement | null>>>;
}) {
  return (
    <div data-testid={input.testId} style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>{input.title}</div>
      {input.showPlaceholder ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>연결 테스트를 실행하면 결과가 표시됩니다.</p>
      ) : (
        <table
          data-testid={`${input.testId}-table`}
          style={{
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <colgroup>
            <col style={{ width: 110 }} />
            <col style={{ width: 64 }} />
            <col />
            <col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
              <th style={itemHeaderStyle}>항목</th>
              <th style={statusHeaderStyle}>상태</th>
              <th style={valueHeaderStyle}>현재 값/결과</th>
              <th style={helpHeaderStyle}>도움말</th>
            </tr>
          </thead>
          <tbody>
            {input.rows.map((row) => {
              const colors = prototypeEnvReadinessToneColors(row.statusTone);
              const valueTitle = String(row.detailMessage ?? "").trim() || undefined;
              return (
                <tr
                  key={row.key}
                  data-testid={`${input.testId}-row-${row.key}`}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <td style={itemCellStyle}>{row.label}</td>
                  <td style={statusCellStyle}>
                    <span style={{ fontWeight: 800, color: colors.color }}>{row.status}</span>
                  </td>
                  <td style={valueCellStyle} title={valueTitle || undefined}>
                    {row.currentValue}
                  </td>
                  <td style={helpCellStyle}>
                    <button
                      type="button"
                      ref={(el) => {
                        input.triggerRefs.current[`${input.testId}:${row.key}`] = el;
                      }}
                      aria-label={`${row.label} 도움말`}
                      data-split-preflight-help-trigger
                      onClick={() => input.onToggleHelp(`${input.testId}:${row.key}`)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        border: "1px solid #cbd5e1",
                        background: input.openHelpKey === `${input.testId}:${row.key}` ? "#f1f5f9" : "#fff",
                        color: "#475569",
                        fontWeight: 900,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ?
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
