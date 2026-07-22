import { cookies } from "next/headers";
import { AuthRequiredCard } from "@/components/AuthRequiredCard";
import { ProviderPackCreateForm } from "@/components/ProviderPackCreateForm";
import { ProviderRequiredCard } from "@/components/ProviderRequiredCard";
import { isAdminAccountRole, isProviderAccountRole } from "@/lib/account-role";
import { getUserIdFromCookies } from "@/lib/auth-session";
import {
  createClientId,
  JYKSTORE_CLIENT_ID_COOKIE,
} from "@/lib/client-identity";
import { listCategoriesWithPublishedCounts } from "@/lib/pack-catalog-service";
import { prisma } from "@/lib/prisma";
import { findProviderProfileForUser } from "@/lib/provider-profile-service";
import { PROVIDER_PAYLOAD_IMPORT_PREP_HINT } from "@/lib/role-based-ux-copy";

export const dynamic = "force-dynamic";

export default async function ProviderPackNewPage() {
  const userId = await getUserIdFromCookies();

  if (!userId) {
    return <AuthRequiredCard />;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountRole: true },
  });

  const jar = await cookies();
  const clientId = jar.get(JYKSTORE_CLIENT_ID_COOKIE)?.value ?? createClientId();
  const providerProfile = await findProviderProfileForUser(userId, clientId);

  // Match Provider Center / session: role OR linked provider profile.
  const canProvider =
    isProviderAccountRole(user?.accountRole) ||
    isAdminAccountRole(user?.accountRole) ||
    Boolean(providerProfile);

  if (!canProvider) {
    return <ProviderRequiredCard />;
  }

  const categories = await listCategoriesWithPublishedCounts();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <p className="text-sm leading-relaxed text-store-muted">
          외부 도구에서 생성한 Payload를 등록해 지식팩을 제출할 수 있습니다.
        </p>
        <p className="mt-2 text-xs text-store-muted">{PROVIDER_PAYLOAD_IMPORT_PREP_HINT}</p>
      </div>
      <ProviderPackCreateForm
        categories={categories.map((c) => ({ categoryId: c.categoryId, name: c.name }))}
      />
    </div>
  );
}
