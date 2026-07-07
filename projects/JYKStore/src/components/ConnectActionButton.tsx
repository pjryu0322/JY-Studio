import Link from "next/link";
import { myPackConnectPath } from "@/lib/routes";

export function ConnectActionButton({
  packId,
  label = "연동하기",
  className = "",
}: {
  readonly packId: string;
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <Link
      href={myPackConnectPath(packId)}
      className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent active:bg-slate-50 ${className}`}
    >
      {label}
    </Link>
  );
}
