import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function AuthRequiredCard({
  title = "로그인이 필요합니다",
  body = "지식팩을 등록하거나 API Key를 발급하려면 먼저 로그인하세요.",
}: {
  readonly title?: string;
  readonly body?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-card">
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-700">{body}</p>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={ROUTES.accountProfile}
          className="flex min-h-[48px] items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
        >
          로그인하기
        </Link>
        <Link
          href={ROUTES.search}
          className="flex min-h-[44px] items-center justify-center rounded-2xl border border-store-border bg-white text-sm font-semibold text-slate-800"
        >
          공개 지식팩 둘러보기
        </Link>
      </div>
    </div>
  );
}
