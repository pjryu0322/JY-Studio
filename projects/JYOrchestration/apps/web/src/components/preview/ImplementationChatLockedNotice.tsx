"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ImplementationChatAvailabilityStatus } from "@/lib/prototype/implementationChatAvailability";

const card: CSSProperties = {
  margin: "0 12px 10px",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  lineHeight: 1.5,
};

export function ImplementationChatLockedNotice(props: {
  readonly title: string;
  readonly message: string;
  readonly status: ImplementationChatAvailabilityStatus;
}): ReactNode {
  return (
    <div
      style={card}
      data-testid="implementation-chat-locked-notice"
      data-availability-status={props.status}
      role="status"
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.45 }}>
        Preview 준비 후 대화 가능
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginTop: 6, lineHeight: 1.5 }}>{props.title}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{props.message}</div>
    </div>
  );
}
