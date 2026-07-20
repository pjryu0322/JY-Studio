"use client";

import { CopyButton } from "@/components/CopyButton";

export function IssuedApiKeyNotice({
  rawKey,
  onHide,
}: {
  readonly rawKey: string;
  readonly onHide: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
    >
      <p className="text-sm font-bold text-amber-950">API Key가 발급되었습니다.</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900">
        이 Key는 지금만 전체 값이 표시됩니다. 안전한 곳에 복사해 보관하세요.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton value={rawKey} label="Key 복사" className="min-w-[5.5rem]" />
        <button
          type="button"
          onClick={onHide}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold text-slate-800 active:bg-slate-50"
        >
          확인했습니다 / Key 숨기기
        </button>
      </div>
    </div>
  );
}
