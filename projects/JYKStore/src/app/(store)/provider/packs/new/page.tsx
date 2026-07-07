import Link from "next/link";
import { ProviderPackCreateForm } from "@/components/ProviderPackCreateForm";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function ProviderPackNewPage() {
  const categories = await prisma.packCategory.findMany({
    orderBy: { name: "asc" },
    select: { categoryId: true, name: true },
  });

  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.provider}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 제공자 센터
      </Link>
      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">새 지식팩 초안</h1>
        <p className="mt-1 text-sm text-store-muted">생성 후 상세 화면에서 원천 문서를 추가하고 검수를 요청할 수 있습니다.</p>
      </div>
      <ProviderPackCreateForm categories={categories} />
    </div>
  );
}
