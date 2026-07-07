import Link from "next/link";
import { ProviderPackEditor } from "@/components/ProviderPackEditor";
import { ROUTES } from "@/lib/routes";

type PageProps = {
  params: Promise<{ packId: string }>;
};

export default async function ProviderPackDetailPage({ params }: PageProps) {
  const { packId } = await params;

  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.provider}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 제공자 센터
      </Link>
      <ProviderPackEditor packId={packId} />
    </div>
  );
}
