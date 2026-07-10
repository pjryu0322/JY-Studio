import { cookies } from "next/headers";
import { AuthRequiredCard } from "@/components/AuthRequiredCard";
import { ProviderPackCreateForm } from "@/components/ProviderPackCreateForm";
import { ProviderRequiredCard } from "@/components/ProviderRequiredCard";
import { getUserIdFromCookies } from "@/lib/auth-session";
import {
  createClientId,
  JYKSTORE_CLIENT_ID_COOKIE,
} from "@/lib/client-identity";
import { prisma } from "@/lib/prisma";
import { ensureProviderProfileForAccount } from "@/lib/provider-profile-service";

export const dynamic = "force-dynamic";

export default async function ProviderPackNewPage() {
  const userId = await getUserIdFromCookies();

  if (!userId) {
    return <AuthRequiredCard />;
  }

  const jar = await cookies();
  const clientId = jar.get(JYKSTORE_CLIENT_ID_COOKIE)?.value ?? createClientId();
  const ensured = await ensureProviderProfileForAccount({ userId, clientId });
  if (!ensured.ok) {
    return <ProviderRequiredCard />;
  }

  const categories = await prisma.packCategory.findMany({
    orderBy: { name: "asc" },
    select: { categoryId: true, name: true },
  });

  return (
    <div className="space-y-4">
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
