import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const ACCOUNT_ITEMS = [
  {
    title: "API Key 관리",
    description: "연동용 API Key 발급 및 폐기",
    href: ROUTES.apiKeys,
    status: null,
  },
  { title: "사용량 확인", description: "지식팩 호출 및 사용량", href: null, status: "준비 중" },
  {
    title: "지식팩 제공자 센터",
    description: "제공자 등록 및 지식팩 관리",
    href: ROUTES.provider,
    status: null,
  },
  { title: "관리자 콘솔", description: "검수 및 운영 도구", href: ROUTES.admin, status: null },
  { title: "설정", description: "알림 및 계정 설정", href: null, status: "준비 중" },
] as const;

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">👤</div>
          <div>
            <p className="text-base font-bold text-slate-900">게스트</p>
            <p className="text-xs text-store-muted">로그인은 다음 단계에서 제공됩니다.</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {ACCOUNT_ITEMS.map((item) => (
          <li key={item.title}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-store-muted">{item.description}</p>
                </div>
                <span className="shrink-0 text-store-accent" aria-hidden>
                  →
                </span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 text-left opacity-80"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-store-muted">{item.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-store-muted">
                  {item.status}
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
