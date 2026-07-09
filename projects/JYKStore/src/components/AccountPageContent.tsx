import Link from "next/link";
import {
  ACCOUNT_GUEST_DESCRIPTION,
  ACCOUNT_GUEST_TITLE,
  ACCOUNT_SECTION_BASIC,
  ACCOUNT_SECTION_ROLES,
  ACCOUNT_SECTION_SETTINGS,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

const BASIC_ITEMS = [
  {
    title: "API Key 관리",
    description: "연동용 API Key 발급 및 폐기",
    href: ROUTES.apiKeys,
  },
  {
    title: "문서",
    description: "API 문서 및 SDK 샘플",
    href: ROUTES.docs,
  },
  {
    title: "이용 플랜",
    description: "현재 무료 이용 상태 및 사용량",
    href: ROUTES.accountPlan,
  },
] as const;

function MenuLink({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-store-muted">{description}</p>
      </div>
      <span className="shrink-0 text-store-accent" aria-hidden>
        →
      </span>
    </Link>
  );
}

export function AccountPageContent({
  showOperatorEntry,
}: {
  readonly showOperatorEntry: boolean;
}) {
  return (
    <div className="space-y-5 pb-4">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">👤</div>
          <div>
            <p className="text-base font-bold text-slate-900">{ACCOUNT_GUEST_TITLE}</p>
            <p className="text-xs text-store-muted">{ACCOUNT_GUEST_DESCRIPTION}</p>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">{ACCOUNT_SECTION_BASIC}</h2>
        <ul className="space-y-2">
          {BASIC_ITEMS.map((item) => (
            <li key={item.title}>
              <MenuLink title={item.title} description={item.description} href={item.href} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">{ACCOUNT_SECTION_ROLES}</h2>

        <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <p className="text-sm font-bold text-slate-900">지식팩 사용자</p>
          <p className="mt-1 text-xs text-store-muted">
            지식팩을 검색하고 내 지식팩에 담아 API로 연결합니다.
          </p>
          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            기본 역할
          </span>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={ROUTES.search}
              className="min-h-[36px] rounded-full border border-store-border px-3 text-xs font-semibold leading-9 text-slate-800"
            >
              지식팩 검색
            </Link>
            <Link
              href={ROUTES.myPacks}
              className="min-h-[36px] rounded-full border border-store-border px-3 text-xs font-semibold leading-9 text-slate-800"
            >
              내 지식팩 열기
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <p className="text-sm font-bold text-slate-900">지식팩 제공자</p>
          <p className="mt-1 text-xs text-store-muted">
            제품 문서, 매뉴얼, GitHub 공개 저장소를 기반으로 지식팩을 등록합니다.
          </p>
          <Link
            href={ROUTES.provider}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
          >
            제공자 센터 열기
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            showOperatorEntry
              ? "border-dashed border-slate-300 bg-slate-50"
              : "border-dashed border-slate-200 bg-slate-50/60 opacity-90"
          }`}
        >
          <p className="text-sm font-bold text-slate-700">지식팩 운영자</p>
          <p className="mt-1 text-xs text-store-muted">
            지식팩 검수, 승인, 활성화, 공개 상태와 사용량을 관리합니다.
          </p>
          <span className="mt-2 inline-flex rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            운영자 전용
          </span>
          {showOperatorEntry ? (
            <div className="mt-3 space-y-2">
              <Link
                href={ROUTES.admin}
                className="flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
              >
                운영자 콘솔 열기
              </Link>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link href={ROUTES.adminKnowledgeUnitDrafts} className="font-semibold text-slate-700 underline-offset-2 hover:underline">
                    Knowledge Unit 초안 검수
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.adminOpsUsage} className="font-semibold text-slate-700 underline-offset-2 hover:underline">
                    운영 사용량 확인
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.adminOps} className="font-semibold text-slate-700 underline-offset-2 hover:underline">
                    Ops 대시보드
                  </Link>
                </li>
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-xs text-store-muted">
              운영 도구는 운영자 권한이 있는 환경에서만 사용할 수 있습니다. 일반 이용 메뉴와 별도로
              관리됩니다.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">{ACCOUNT_SECTION_SETTINGS}</h2>
        <button
          type="button"
          disabled
          className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 text-left opacity-80"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">설정</p>
            <p className="text-xs text-store-muted">알림 및 계정 설정</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-store-muted">
            준비 중
          </span>
        </button>
      </section>
    </div>
  );
}
