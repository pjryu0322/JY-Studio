"use client";

import { useState } from "react";

export function DocsCodeBlock({
  code,
  language = "text",
}: {
  readonly code: string;
  readonly language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-store-border bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs text-slate-300">{language}</span>
        <button type="button" onClick={() => void copy()} className="text-xs font-semibold text-white">
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
