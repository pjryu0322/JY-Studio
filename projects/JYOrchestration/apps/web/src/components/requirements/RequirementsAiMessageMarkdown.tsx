"use client";

import Markdown from "react-markdown";
import type { Components } from "react-markdown";

const textMain = "#0f172a";
const textMuted = "#475569";

function mdComponents(variant: "default" | "error"): Components {
  const accent = variant === "error" ? "#991b1b" : textMain;
  return {
    h1: ({ children, ...rest }) => (
      <h1
        style={{
          fontSize: "1.2rem",
          fontWeight: 800,
          color: accent,
          margin: "12px 0 6px",
          lineHeight: 1.35,
          letterSpacing: "-0.02em",
        }}
        {...rest}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...rest }) => (
      <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: accent, margin: "12px 0 6px", lineHeight: 1.35 }} {...rest}>
        {children}
      </h2>
    ),
    h3: ({ children, ...rest }) => (
      <h3 style={{ fontSize: "0.98rem", fontWeight: 800, color: variant === "error" ? "#b91c1c" : "#334155", margin: "12px 0 6px", lineHeight: 1.4 }} {...rest}>
        {children}
      </h3>
    ),
    p: ({ children, ...rest }) => (
      <p style={{ margin: "0 0 8px", lineHeight: 1.55, color: variant === "error" ? "#7f1d1d" : textMain }} {...rest}>
        {children}
      </p>
    ),
    ul: ({ children, ...rest }) => (
      <ul style={{ margin: "6px 0", paddingLeft: "20px", color: textMain, listStyleType: "disc" }} {...rest}>
        {children}
      </ul>
    ),
    ol: ({ children, ...rest }) => (
      <ol style={{ margin: "6px 0", paddingLeft: "20px", color: textMain, listStyleType: "decimal" }} {...rest}>
        {children}
      </ol>
    ),
    li: ({ children, ...rest }) => (
      <li style={{ margin: "2px 0", lineHeight: 1.5 }} {...rest}>
        {children}
      </li>
    ),
    strong: ({ children, ...rest }) => (
      <strong style={{ fontWeight: 800, color: accent }} {...rest}>
        {children}
      </strong>
    ),
    em: ({ children, ...rest }) => (
      <em style={{ fontStyle: "italic", color: textMuted }} {...rest}>
        {children}
      </em>
    ),
    blockquote: ({ children, ...rest }) => (
      <blockquote
        style={{
          margin: "0.5em 0",
          padding: "0.35em 0 0.35em 0.85em",
          borderLeft: "3px solid #94a3b8",
          color: textMuted,
          background: "#f8fafc",
          borderRadius: "0 8px 8px 0",
        }}
        {...rest}
      >
        {children}
      </blockquote>
    ),
    hr: () => <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "0.85em 0" }} />,
    a: ({ children, href, ...rest }) => (
      <a href={href} style={{ color: "#0d9488", fontWeight: 700, textDecoration: "underline" }} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    ),
    pre: ({ children, ...rest }) => (
      <pre
        style={{
          margin: "0.55em 0",
          padding: "12px 14px",
          borderRadius: 10,
          background: "#f1f5f9",
          overflow: "auto",
          fontSize: "0.82rem",
          lineHeight: 1.5,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
        {...rest}
      >
        {children}
      </pre>
    ),
    code: ({ className, children, ...rest }) => {
      const isFenced = Boolean(className?.includes("language-"));
      if (isFenced) {
        return (
          <code
            className={className}
            style={{ fontFamily: "inherit", fontSize: "inherit", background: "transparent", display: "block", whiteSpace: "pre" }}
            {...rest}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.88em",
            background: "#f1f5f9",
            padding: "0.12em 0.4em",
            borderRadius: 6,
            color: "#0f172a",
          }}
          {...rest}
        >
          {children}
        </code>
      );
    },
  };
}

export function RequirementsAiMessageMarkdown({
  text,
  variant = "default",
}: {
  readonly text: string;
  readonly variant?: "default" | "error";
}) {
  return (
    <div className="jyo-requirements-md messageMarkdown" data-variant={variant}>
      <Markdown components={mdComponents(variant)} skipHtml>
        {text}
      </Markdown>
    </div>
  );
}
