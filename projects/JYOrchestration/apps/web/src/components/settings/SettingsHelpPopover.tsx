"use client";

import type { ReactNode } from "react";
import type { SettingsHelpPopoverContent } from "@/lib/prototype/githubProviderPreflightHelp";

export type SettingsHelpPopoverProps = SettingsHelpPopoverContent;

function HelpTitle({ children }: { readonly children: ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>{children}</div>;
}

function HelpSubTitle({ children }: { readonly children: ReactNode }) {
  return <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: "#334155" }}>{children}</div>;
}

function HelpList({ children }: { readonly children: ReactNode }) {
  return (
    <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
      {children}
    </ul>
  );
}

export function SettingsHelpPopoverContentView(props: SettingsHelpPopoverProps) {
  return (
    <>
      <HelpTitle>{props.title}</HelpTitle>
      {props.description ? (
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55 }}>{props.description}</div>
      ) : null}
      {props.examples?.map((ex, i) => (
        <div key={i} style={{ marginTop: 10, fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
          {ex.label ? <span style={{ fontWeight: 700 }}>{ex.label}: </span> : null}
          <code style={{ fontSize: 12 }}>{ex.value}</code>
        </div>
      ))}
      {props.checklist?.length ? (
        <>
          <HelpSubTitle>확인할 것</HelpSubTitle>
          <HelpList>
            {props.checklist.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </HelpList>
        </>
      ) : null}
      {props.actionGuide?.length ? (
        <>
          <HelpSubTitle>조치 방법</HelpSubTitle>
          <HelpList>
            {props.actionGuide.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </HelpList>
        </>
      ) : null}
      {props.footerNote ? (
        <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{props.footerNote}</div>
      ) : null}
    </>
  );
}
