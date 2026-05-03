import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { workspaceStandardChatScrollAreaStyle } from "@/components/workspace/workspaceStandardChatScroll";

export const serviceFlowStageRootSectionStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  height: "100%",
  display: "flex",
  flexDirection: "column",
};

export const serviceFlowStageShellGridStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "stretch",
  overflow: "hidden",
  background: t.bgCard,
  height: "100%",
};

export const serviceFlowStageMainChatStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  background: t.bgPage,
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  position: "relative",
};

export const serviceFlowStageScrollAreaStyle: CSSProperties = workspaceStandardChatScrollAreaStyle;

export const serviceFlowStageComposerColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  minWidth: 0,
};

export const serviceFlowChipRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

export const serviceFlowPanelCardStyle: CSSProperties = {
  border: `1px solid ${t.border}`,
  borderRadius: 14,
  padding: 12,
  background: t.bgCard,
};

export const serviceFlowCautionCalloutStyle: CSSProperties = {
  border: `1px solid ${t.borderCaution}`,
  borderRadius: 14,
  padding: 12,
  background: t.surfaceCaution,
};

export const serviceFlowInfoHeaderPanelStyle: CSSProperties = {
  border: `1px solid ${t.borderInfoSoft}`,
  borderRadius: 14,
  padding: 12,
  background: t.bgCard,
};

export const serviceFlowListMutedLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: t.textMuted,
};
