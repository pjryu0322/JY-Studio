"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiContextRow, OverlayUiContextSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import {
  OverlayUiEmptyHint,
  OverlayUiKeyValueRow,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
} from "./OverlayUiPrimitives";

const MISSING_REASON = "ㅡ";

function SelectedRow({ row }: { readonly row: OverlayUiContextRow }) {
  return (
    <OverlayUiRowCard layout={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      <strong style={{ color: t.textPrimary }}>{row.typeLabel}</strong>
      <span>· {row.source}</span>
      {row.reason && row.reason !== MISSING_REASON ? (
        <span style={{ color: t.textMuted }}>{` (${row.reason})`}</span>
      ) : null}
    </OverlayUiRowCard>
  );
}

function SubGroupHeader({ children }: { readonly children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, margin: "6px 0" }}>{children}</div>
  );
}

function joinedValue(values: readonly string[]) {
  return <span style={{ wordBreak: "break-all" }}>{values.join(", ")}</span>;
}

export function OverlayContextSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayUiContextSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection title="컨텍스트" description={vm.planningComment} defaultOpen={defaultOpen}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="이 시점에 선택·우선순위 컨텍스트 정보가 기록되지 않았습니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {vm.identityRoleLabel ? <OverlayUiKeyValueRow label="역할" value={vm.identityRoleLabel} /> : null}
          {vm.memoryScopes.length ? (
            <OverlayUiKeyValueRow label="기억 범위" value={joinedValue(vm.memoryScopes)} />
          ) : null}
          {vm.knowledgeHints.length ? (
            <OverlayUiKeyValueRow label="지식 힌트" value={joinedValue(vm.knowledgeHints)} />
          ) : null}
          {vm.selected.length ? (
            <div>
              <SubGroupHeader>선택된 컨텍스트</SubGroupHeader>
              <OverlayUiRowList>
                {vm.selected.map((row, i) => (
                  <SelectedRow key={`sel-${i}`} row={row} />
                ))}
              </OverlayUiRowList>
            </div>
          ) : null}
          {vm.prioritized.length ? (
            <div>
              <SubGroupHeader>우선순위 컨텍스트(계획)</SubGroupHeader>
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
