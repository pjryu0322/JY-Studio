import { MyPacksPageClient } from "@/components/MyPacksPageClient";
import { StoreLoginGate } from "@/components/StoreLoginGate";

export default function MyPacksPage() {
  return (
    <StoreLoginGate>
      <div className="space-y-4 pb-4">
        <div className="px-1">
          <h1 className="text-lg font-bold text-slate-900">내 지식팩</h1>
          <p className="mt-1 text-sm text-store-muted">
            제공자로 등록한 지식팩과, 카탈로그에서 보관한 지식팩을 확인합니다.
          </p>
        </div>
        <MyPacksPageClient />
      </div>
    </StoreLoginGate>
  );
}
