import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function ProviderRequiredCard({
  title = "제공자 프로필이 필요합니다",
  body = "제품·솔루션 지식을 등록하려면 제공자 정보를 먼저 등록하세요.",
}: {
  readonly title?: string;
  readonly body?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-card">
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-700">{body}</p>
      <Link
        href={`${ROUTES.accountProfile}#provider-profile`}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
      >
        제공자 프로필 등록
      </Link>
    </div>
  );
}
