"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import {
  buildProviderPacksStatusSummary,
  type ProviderPacksStatusSummary,
} from "@/lib/provider-pack-progress";
import { isProviderAccountRole, isAdminAccountRole } from "@/lib/account-role";
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

type StatusFilter = "all" | "draft" | "reviewing" | "published" | "changesRequested";

type ViewState = "loading" | "notLoggedIn" | "notProvider" | "ready";

function matchesFilter(pack: ProviderPackListItemDto, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "reviewing") return pack.status === "REVIEWING";
  if (filter === "published") {
    return pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  }
  if (filter === "changesRequested") {
    return pack.progress?.currentStep === "CHANGES_REQUESTED";
  }
  if (filter === "draft") {
    return (
      pack.status === "DRAFT" && pack.progress?.currentStep !== "CHANGES_REQUESTED"
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
    { key: "reviewing", label: "검수 중", value: summary.reviewing },
    {
      key: "published",
      label: "공개",
      value: summary.published + summary.verified,
    },
    { key: "changesRequested", label: "보완 요청", value: summary.changesRequested },
  ];

  return (
    <section aria-label="지식팩 현황" className="space-y-2">
      <h2 className="px-1 text-sm font-bold text-slate-900">현황</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cards.map((card) => {
          const active = filter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onFilter(card.key)}
              className={`min-h-[64px] rounded-2xl border px-3 py-3 text-left shadow-card ${
                active
                  ? "border-store-accent bg-store-accent/10"
                  : "border-store-border bg-white"
              }`}
            >
              <p className="text-[11px] font-semibold text-store-muted">{card.label}</p>
              <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{card.value}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProviderPackCard({ pack }: { readonly pack: ProviderPackListItemDto }) {
  const detail = providerPackDetailPath(pack.packId);
  const progress = pack.progress;
  const actions = progress?.actions?.slice(0, 2) ?? [
    { label: "상세 보기", href: detail },
  ];

  return (
    <li className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <Link href={detail} className="block min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-slate-900">{pack.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-store-muted">{pack.packId}</p>
          </div>
          <ProviderPackStatusBadge status={pack.status} />
        </div>
        <div className="mt-3 space-y-1 text-xs text-store-muted">
          {progress?.publishedVersion ? (
            <p>
              공개 Version:{" "}
              <span className="font-semibold text-slate-800">{progress.publishedVersion}</span>
            </p>
          ) : null}
          {progress?.workingVersion &&
          progress.workingVersion !== progress.publishedVersion ? (
            <p>
              작업 Version:{" "}
              <span className="font-semibold text-slate-800">{progress.workingVersion}</span>
            </p>
          ) : null}
          {progress?.currentStepLabel ? (
            <p>
              현재 단계:{" "}
              <span className="font-semibold text-slate-800">{progress.currentStepLabel}</span>
            </p>
          ) : null}
          {progress?.nextActionLabel ? (
            <p>
              다음 작업:{" "}
              <span className="font-semibold text-slate-800">{progress.nextActionLabel}</span>
            </p>
          ) : null}
        </div>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link
            key={`${action.label}:${action.href}`}
            href={action.href}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-store-border bg-slate-50 px-3 text-xs font-bold text-store-accent"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </li>
  );
}

export function ProviderCenterPageClient() {
  const [view, setView] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProviderProfileDto | null>(null);
  const [packs, setPacks] = useState<ProviderPackListItemDto[]>([]);
  const [summary, setSummary] = useState<ProviderPacksStatusSummary>(
    buildProviderPacksStatusSummary([]),
  );
  const [filter, setFilter] = useState<StatusFilter>("all");

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
      const canProvider =
        isProviderAccountRole(role) ||
        isAdminAccountRole(role) ||
        Boolean(session.providerProfile);

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

      {packs.length > 0 ? (
        <ProviderStatusDashboard summary={summary} filter={filter} onFilter={setFilter} />
      ) : null}

      <section
        id="provider-packs"
        className="scroll-mt-24 rounded-2xl border border-store-border bg-white p-4 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">내 지식팩</h2>
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

        {packs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-store-border bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-slate-900">{PROVIDER_PACK_EMPTY_TITLE}</p>
            <p className="mt-1 text-xs text-store-muted">{PROVIDER_PACK_EMPTY_BODY}</p>
            <Link
              href={ROUTES.providerPackNew}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
            >
              {PROVIDER_PACK_REGISTER_CTA}
            </Link>
          </div>
        ) : filteredPacks.length === 0 ? (
          <p className="mt-4 text-sm text-store-muted">선택한 상태의 지식팩이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {filteredPacks.map((pack) => (
              <ProviderPackCard key={pack.packId} pack={pack} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
