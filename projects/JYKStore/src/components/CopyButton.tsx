"use client";

import { useCallback, useState } from "react";

export type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback below */
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = "복사",
  copiedLabel = "복사됨",
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    const ok = await copyText(value);
    if (!ok) {
      window.alert("복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent active:bg-slate-50 ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
