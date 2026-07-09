import Link from "next/link";
import { cookies } from "next/headers";
import { ProviderPackCreateForm } from "@/components/ProviderPackCreateForm";
import { JYKSTORE_CLIENT_ID_COOKIE } from "@/lib/client-identity";
import { prisma } from "@/lib/prisma";
import { getProviderProfileByClientId } from "@/lib/provider-profile-service";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function ProviderPackNewPage() {
  const cookieStore = await cookies();
  const clientId = cookieStore.get(JYKSTORE_CLIENT_ID_COOKIE)?.value ?? null;
  const profile = clientId ? await getProviderProfileByClientId(clientId) : null;

  const categories = await prisma.packCategory.findMany({
    orderBy: { name: "asc" },
    select: { categoryId: true, name: true },
  });

  if (!profile) {
    return (
      <div className="space-y-4">
        <Link
          href={ROUTES.provider}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
        >
          ← 제공자 센터
        </Link>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-card">
          <h1 className="text-lg font-bold text-slate-900">제공자 프로필이 필요합니다</h1>
          <p className="mt-2 text-sm text-slate-700">
            지식팩 초안을 만들려면 먼저 제공자 프로필을 등록해 주세요. 프로필 등록 후 이 화면에서 바로
            지식팩을 생성할 수 있습니다.
          </p>
          <Link
            href={`${ROUTES.provider}#provider-profile`}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
          >
            제공자 프로필 등록하러 가기
          </Link>
        </div>
      </div>
    );
  }

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
        <p className="mt-1 text-sm text-store-muted">
          생성 후 상세 화면에서 GitHub URL 자동수집을 실행하거나 문서를 등록하세요.
        </p>
      </div>
      <ProviderPackCreateForm categories={categories} />
    </div>
  );
}
