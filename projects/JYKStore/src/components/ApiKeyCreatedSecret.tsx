"use client";

import { CopyButton } from "@/components/CopyButton";

export function ApiKeyCreatedSecret({
  plainKey,
  onDismiss,
}: {
  readonly plainKey: string;
  readonly onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-950">API Key가 발급되었습니다</p>
      <p className="mt-2 text-xs leading-relaxed text-amber-900">
        아래 Key는 이번에만 표시됩니다. 안전한 곳에 복사해 두세요. 새로고침하면 다시 볼 수 없습니다.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2 text-xs text-slate-800">
          {plainKey}
        </code>
        <CopyButton value={plainKey} label="Key 복사" className="w-full sm:w-auto" />
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 min-h-[44px] w-full rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 active:bg-slate-50"
      >
        확인했습니다
      </button>
    </div>
  );
}
