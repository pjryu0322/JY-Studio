"use client";

import { CopyButton } from "@/components/CopyButton";

export type CodeSnippetProps = {
  title: string;
  description?: string;
  language: string;
  code: string;
};

export function CodeSnippet({ title, description, language, code }: CodeSnippetProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {description ? <p className="mt-1 text-xs text-store-muted">{description}</p> : null}
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-store-muted">{language}</p>
        </div>
        <CopyButton value={code} label="코드 복사" />
      </div>
      <div className="mt-3 max-w-full overflow-x-auto rounded-xl bg-slate-900 p-3">
        <pre className="text-xs leading-relaxed text-slate-100">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
