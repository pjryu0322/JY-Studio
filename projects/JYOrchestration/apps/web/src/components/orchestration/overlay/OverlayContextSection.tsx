"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiContextSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { OverlayUiEmptyHint, OverlayUiKeyValueRow, OverlayUiSection } from "./OverlayUiPrimitives";

export function OverlayContextSection({ vm }: { readonly vm: OverlayUiContextSectionVM }) {
  return (
    <OverlayUiSection title="컨텍스트" description={vm.planningComment}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="이 시점에 선택·우선순위 컨텍스트 정보가 기록되지 않았습니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {vm.identityRoleLabel ? (
            <OverlayUiKeyValueRow label="역할" value={vm.identityRoleLabel} />
          ) : null}
          {vm.memoryScopes.length ? (
            <OverlayUiKeyValueRow
              label="기억 범위"
              value={<span style={{ wordBreak: "break-all" }}>{vm.memoryScopes.join(", ")}</span>}
            />
          ) : null}
          {vm.knowledgeHints.length ? (
            <OverlayUiKeyValueRow
              label="지식 힌트"
              value={<span style={{ wordBreak: "break-all" }}>{vm.knowledgeHints.join(", ")}</span>}
            />
          ) : null}
          {vm.selected.length ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, margin: "6px 0" }}>선택된 컨텍스트</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {vm.selected.map((row, i) => (
                  <li
                    key={`sel-${i}`}
                    style={{
                      fontSize: 12,
                      color: t.textSecondary,
                      padding: "4px 8px",
                      background: "#fff",
                      border: `1px solid ${t.border}`,
                      borderRadius: 6,
                    }}
                  >
                    <strong style={{ color: t.textPrimary }}>{row.typeLabel}</strong>
                    {" · "}
                    <span>{row.source}</span>
                    {row.reason && row.reason !== "ㅡ" ? (
                      <span style={{ color: t.textMuted }}>{` (${row.reason})`}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {vm.prioritized.length ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, margin: "6px 0" }}>
                우선순위 컨텍스트(계획)
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {vm.prioritized.map((row, i) => (
                  <li key={`pri-${i}`} style={{ fontSize: 12, color: t.textSecondary }}>
                    <strong style={{ color: t.textPrimary }}>{row.typeLabel}</strong> · {row.source}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </OverlayUiSection>
  );
}
