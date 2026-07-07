import { EmptyState } from "@/components/EmptyState";
import { ROUTES } from "@/lib/routes";

export default function MyPacksPage() {
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">내 지식팩</h1>
        <p className="mt-1 text-sm text-store-muted">
          필요한 지식팩을 선택하면 연동에 필요한 정보를 바로 확인할 수 있습니다.
        </p>
      </div>
      <EmptyState
        title="아직 추가한 지식팩이 없습니다."
        description="필요한 지식팩을 찾아 내 지식팩에 추가하면, 연동에 필요한 Pack ID와 API 예시를 확인할 수 있습니다."
        ctaLabel="지식팩 둘러보기"
        ctaHref={ROUTES.today}
      />
    </div>
  );
}
