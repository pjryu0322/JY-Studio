import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export function knowledgePackFormFieldStyle(): CSSProperties {
  return {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    fontSize: 13,
    fontFamily: "inherit",
  };
}
