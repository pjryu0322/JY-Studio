import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function ProviderRequiredCard({
  title = "제공자 권한이 필요합니다",
  body = "지식팩 제공자 계정으로 로그인하면 제공자 센터를 이용할 수 있습니다.",
}: {
  readonly title?: string;
  readonly body?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-card">
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-700">{body}</p>
      <Link
        href={ROUTES.login}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
      >
        제공자 계정으로 로그인
      </Link>
    </div>
  );
}
