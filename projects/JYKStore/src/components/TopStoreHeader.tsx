import { HeaderProfileButton } from "@/components/HeaderProfileButton";
export function TopStoreHeader() {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-store-accent text-sm font-black text-white">
            JK
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black tracking-tight text-slate-900">JYKStore</p>
            <p className="truncate text-[11px] text-store-muted">AI가 참고할 제품 지식을 지식팩으로</p>
          </div>
        </div>
      </div>
      <div className="shrink-0">
        <HeaderProfileButton />
      </div>
    </div>
  );
}
