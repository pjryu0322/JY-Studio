import { MyPacksPageClient } from "@/components/MyPacksPageClient";
import { StoreLoginGate } from "@/components/StoreLoginGate";

export default function MyPacksPage() {
  return (
    <StoreLoginGate>
      <div className="space-y-4 pb-4">
        <div className="px-1">
          <h1 className="text-lg font-bold text-slate-900">내 지식팩</h1>
          <p className="mt-1 text-sm text-store-muted">
            Pack ID와 예시 코드를 복사해 외부 AI 도구에서 사용할 수 있습니다.
          </p>
        </div>
        <MyPacksPageClient />
      </div>
    </StoreLoginGate>
  );
}
