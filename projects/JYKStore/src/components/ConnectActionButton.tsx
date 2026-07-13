import Link from "next/link";
import type { PublicPackCapabilities } from "@/lib/public-pack-capability";
import { isPackApiIntegrationReady } from "@/lib/public-pack-capability";
import { myPackConnectPath } from "@/lib/routes";

export function ConnectActionButton({
  packId,
  capabilities,
  label = "연동하기",
  className = "",
}: {
  readonly packId: string;
  readonly capabilities?: PublicPackCapabilities | null;
  readonly label?: string;
  readonly className?: string;
}) {
  if (!capabilities || !isPackApiIntegrationReady(capabilities)) {
    return null;
  }

  return (
    <Link
      href={myPackConnectPath(packId)}
      className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent active:bg-slate-50 ${className}`}
    >
      {label}
    </Link>
  );
}
