"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { ProviderReviewTargetCard } from "@/components/ProviderReviewTargetCard";
import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import {
  buildProviderPacksStatusSummary,
  type ProviderPacksStatusSummary,
} from "@/lib/provider-pack-progress";
import { isProviderAccountRole } from "@/lib/account-role";
import { fetchAuthSession } from "@/lib/auth-api";
import { fetchProviderPacks, fetchProviderProfile } from "@/lib/provider-center-api";
import {
  PROVIDER_CENTER_LOGIN_CTA,
  PROVIDER_CENTER_LOGIN_TITLE,
  PROVIDER_CENTER_BEFORE_PROFILE_BODY,
  PROVIDER_CENTER_BEFORE_PROFILE_TITLE,
  PROVIDER_PACK_EMPTY_BODY,
  PROVIDER_PACK_EMPTY_TITLE,
  PROVIDER_PACK_REGISTER_CTA,
  PROVIDER_PACK_REGISTER_HINT,
} from "@/lib/role-based-ux-copy";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";

type StatusFilter =
  | "all"
  | "draft"
  | "reviewing"
  | "providerReviewRequested"
  | "published"
  | "changesRequested";

type ViewState = "loading" | "notLoggedIn" | "notProvider" | "ready";

function matchesFilter(pack: ProviderPackListItemDto, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "providerReviewRequested") {
    return (
      pack.progress?.storeWorkflowStatus === "PROVIDER_REVIEW_REQUESTED" ||
      pack.progress?.currentStep === "PROVIDER_REVIEW_REQUESTED"
    );
  }
  if (filter === "reviewing") return pack.status === "REVIEWING";
  if (filter === "published") {
    return pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  }
  if (filter === "changesRequested") {
    return pack.progress?.currentStep === "CHANGES_REQUESTED";
  }
  if (filter === "draft") {
    return (
      pack.status === "DRAFT" &&
      pack.progress?.currentStep !== "CHANGES_REQUESTED" &&
      pack.progress?.currentStep !== "PROVIDER_REVIEW_REQUESTED" &&
      pack.progress?.storeWorkflowStatus !== "PROVIDER_REVIEW_REQUESTED"
    );
  }
  return true;
}

function ProviderStatusDashboard({
  summary,
  filter,
  onFilter,
}: {
  readonly summary: ProviderPacksStatusSummary;
  readonly filter: StatusFilter;
  readonly onFilter: (next: StatusFilter) => void;
}) {
  const cards: Array<{ key: StatusFilter; label: string; value: number }> = [
    { key: "all", label: "전체", value: summary.total },
    { key: "draft", label: "초안", value: summary.draft },
    {
      key: "providerReviewRequested",
      label: "검토대상",
      value: summary.providerReviewRequested,
    },
    { key: "reviewing", label: "검수 중", value: summary.reviewing },
    {
      key: "published",
      label: "공개",
      value: summary.published + summary.verified,
    },
    { key: "changesRequested", label: "보완 요청", value: summary.changesRequested },
  ];

  return (
    <section aria-label="지식팩 현황" className="flex flex-wrap items-center gap-1.5">
      <h2 className="mr-1 shrink-0 text-xs font-bold text-slate-900">현황</h2>
      {cards.map((card) => {
        const active = filter === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onFilter(card.key)}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-left ${
              active
                ? "border-store-accent bg-store-accent/10"
                : "border-store-border bg-white"
            }`}
          >
            <span className="text-[11px] font-semibold text-store-muted">{card.label}</span>
            <span className="text-sm font-bold tabular-nums text-slate-900">{card.value}</span>
          </button>
        );
      })}
    </section>
  );
}

function ProviderPackCard({
  pack,
  reviewInbox = false,
}: {
  readonly pack: ProviderPackListItemDto;
  readonly reviewInbox?: boolean;
}) {
  const detail = providerPackDetailPath(pack.packId);
  const progress = pack.progress;
  const reviewRequested =
    progress?.storeWorkflowStatus === "PROVIDER_REVIEW_REQUESTED" ||
    progress?.currentStep === "PROVIDER_REVIEW_REQUESTED";
  const actions = reviewRequested
    ? [{ label: "검토하기", href: `${detail}?tab=knowledge` }]
    : (progress?.actions?.slice(0, 2) ?? [{ label: "상세 보기", href: detail }]);

  const versionLabel =
    progress?.workingVersion &&
    progress.workingVersion !== progress.publishedVersion
      ? `작업 ${progress.workingVersion}`
      : progress?.publishedVersion
        ? `공개 ${progress.publishedVersion}`
        : progress?.workingVersion
          ? `v${progress.workingVersion}`
          : null;

  const metaParts = reviewRequested
    ? [versionLabel, "품질 요약은 상세 검토에서 확인"].filter(Boolean)
    : [
        versionLabel,
        progress?.currentStepLabel ? `단계 ${progress.currentStepLabel}` : null,
        progress?.nextActionLabel ? `다음 ${progress.nextActionLabel}` : null,
      ].filter(Boolean);

  return (
    <li className="rounded-xl border border-store-border bg-white px-3 py-2 shadow-sm">
      <div className="flex items-start gap-2">
        <Link href={reviewRequested ? `${detail}?tab=knowledge` : detail} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{pack.name}</p>
            {reviewRequested ? (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                {reviewInbox ? "검토대상" : "검토 요청"}
              </span>
            ) : (
              <ProviderPackStatusBadge status={pack.status} />
            )}
          </div>
          {metaParts.length > 0 ? (
            <p className="mt-0.5 truncate text-[11px] text-store-muted">{metaParts.join(" · ")}</p>
          ) : (
            <p className="mt-0.5 truncate font-mono text-[11px] text-store-muted">{pack.packId}</p>
          )}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
          {actions.map((action) => (
            <Link
              key={`${action.label}:${action.href}`}
              href={action.href}
              className="inline-flex min-h-[32px] items-center rounded-lg px-2 text-[11px] font-bold text-store-accent hover:bg-slate-50"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </li>
  );
}

export function ProviderCenterPageClient({
  initialFilter = "all",
  variant = "center",
}: {
  readonly initialFilter?: StatusFilter;
  readonly variant?: "center" | "reviewInbox";
}) {
  const reviewInbox = variant === "reviewInbox";
  const [view, setView] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProviderProfileDto | null>(null);
  const [packs, setPacks] = useState<ProviderPackListItemDto[]>([]);
  const [summary, setSummary] = useState<ProviderPacksStatusSummary>(
    buildProviderPacksStatusSummary([]),
  );
  const [filter, setFilter] = useState<StatusFilter>(
    reviewInbox ? "providerReviewRequested" : initialFilter,
  );

  const refresh = useCallback(async () => {
    setError(null);
    setView("loading");
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn) {
        setView("notLoggedIn");
        return;
      }

      const role = session.accountRole ?? session.user?.accountRole;
      const canProvider = isProviderAccountRole(role);

      if (!canProvider) {
        setView("notProvider");
        return;
      }

      let profileData = session.providerProfile ?? null;
      if (!profileData) {
        const ensured = await fetchProviderProfile();
        profileData = ensured.profile;
      }
      setProfile(profileData);

      const packsRes = await fetchProviderPacks();
      setPacks(packsRes.items);
      setSummary(packsRes.summary ?? buildProviderPacksStatusSummary(packsRes.items));
      setView("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider Center를 불러오지 못했습니다.");
      setView("notLoggedIn");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredPacks = useMemo(
    () => packs.filter((pack) => matchesFilter(pack, filter)),
    [packs, filter],
  );

  if (view === "loading") {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (view === "notLoggedIn") {
    return (
      <div className="space-y-4 pb-6">
        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
          <p className="text-sm font-bold text-amber-950">{PROVIDER_CENTER_LOGIN_TITLE}</p>
        </div>
        <Link
          href={ROUTES.login}
          className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
        >
          {PROVIDER_CENTER_LOGIN_CTA}
        </Link>
      </div>
    );
  }

  if (view === "notProvider") {
    return (
      <div className="space-y-4 pb-6">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
          <p className="text-sm font-bold text-amber-950">{PROVIDER_CENTER_BEFORE_PROFILE_TITLE}</p>
          <p className="mt-1 text-xs text-amber-900">{PROVIDER_CENTER_BEFORE_PROFILE_BODY}</p>
        </div>
        <Link
          href={ROUTES.login}
          className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
        >
          제공자 계정으로 로그인
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!reviewInbox && packs.length > 0 ? (
        <ProviderStatusDashboard summary={summary} filter={filter} onFilter={setFilter} />
      ) : null}

      <section
        id="provider-packs"
        className={
          reviewInbox
            ? "scroll-mt-24"
            : "scroll-mt-24 rounded-2xl border border-store-border bg-white p-4 shadow-card"
        }
      >
        {!reviewInbox ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">내가 등록한 지식팩</h2>
              {profile ? (
                <p className="mt-0.5 text-[11px] text-store-muted">
                  {PROVIDER_PACK_REGISTER_HINT}
                </p>
              ) : null}
            </div>
            <Link
              href={ROUTES.providerPackNew}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
            >
              {PROVIDER_PACK_REGISTER_CTA}
            </Link>
          </div>
        ) : null}

        {packs.length === 0 ? (
          <div
            className={`${reviewInbox ? "" : "mt-4 "}rounded-xl border border-dashed border-store-border bg-slate-50 px-4 py-5 text-center`}
          >
            {reviewInbox ? (
              <>
                <p className="text-sm font-semibold text-slate-900">검토대상이 없습니다</p>
                <p className="mt-1 text-xs text-store-muted">
                  관리자가 생성 결과 검토를 요청하면 여기에 표시됩니다.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">{PROVIDER_PACK_EMPTY_TITLE}</p>
                <p className="mt-1 text-xs text-store-muted">{PROVIDER_PACK_EMPTY_BODY}</p>
                <Link
                  href={ROUTES.providerPackNew}
                  className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
                >
                  {PROVIDER_PACK_REGISTER_CTA}
                </Link>
              </>
            )}
          </div>
        ) : filteredPacks.length === 0 ? (
          <p className={`${reviewInbox ? "" : "mt-4 "}text-sm text-store-muted`}>
            {reviewInbox
              ? "현재 대기 중인 검토대상이 없습니다."
              : "선택한 상태의 지식팩이 없습니다."}
          </p>
        ) : (
          <ul className={`${reviewInbox ? "" : "mt-2 "}space-y-1.5`}>
            {filteredPacks.map((pack) =>
              reviewInbox ? (
                <ProviderReviewTargetCard
                  key={pack.packId}
                  pack={pack}
                  onChanged={refresh}
                />
              ) : (
                <ProviderPackCard key={pack.packId} pack={pack} />
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
