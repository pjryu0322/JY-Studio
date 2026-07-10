"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderOnboardingStepper } from "@/components/ProviderOnboardingStepper";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import { fetchAuthSession } from "@/lib/auth-api";
import { buildProviderOnboardingSteps } from "@/lib/provider-onboarding-steps";
import {
  fetchProviderKnowledgeUnitDraftsApi,
  fetchProviderPack,
  fetchProviderPacks,
} from "@/lib/provider-center-api";
import {
  PROVIDER_CENTER_LOGIN_CTA,
  PROVIDER_CENTER_LOGIN_TITLE,
  PROVIDER_CENTER_BEFORE_PROFILE_BODY,
  PROVIDER_CENTER_BEFORE_PROFILE_TITLE,
  PROVIDER_CENTER_NEXT_TASK,
  PROVIDER_CENTER_PROFILE_LINK_LABEL,
  PROVIDER_CENTER_REGISTERED_BODY,
  PROVIDER_CENTER_REGISTERED_TITLE,
  PROVIDER_PACK_EMPTY_BODY,
  PROVIDER_PACK_EMPTY_TITLE,
} from "@/lib/role-based-ux-copy";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";

function packDetailActions(pack: ProviderPackListItemDto) {
  const detail = providerPackDetailPath(pack.packId);
  const actions: { label: string; href: string }[] = [{ label: "편집", href: detail }];
  if (pack.status === "DRAFT") {
    actions.push({ label: "GitHub 자동수집", href: `${detail}#github-auto-collect` });
    actions.push({ label: "검수 요청", href: `${detail}#pack-review` });
  }
  return actions;
}

type ViewState = "loading" | "notLoggedIn" | "loggedInWithoutProviderProfile" | "loggedInWithProviderProfile";

export function ProviderCenterPageClient() {
  const [view, setView] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProviderProfileDto | null>(null);
  const [packs, setPacks] = useState<ProviderPackListItemDto[]>([]);
  const [sourceDocumentCount, setSourceDocumentCount] = useState(0);
  const [knowledgeUnitDraftCount, setKnowledgeUnitDraftCount] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    setView("loading");
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn) {
        setView("notLoggedIn");
        return;
      }

      const profileData = session.providerProfile ?? null;
      setProfile(profileData);

      if (!profileData) {
        setPacks([]);
        setView("loggedInWithoutProviderProfile");
        return;
      }

      const packsRes = await fetchProviderPacks();
      setPacks(packsRes.items);

      let sources = 0;
      let drafts = 0;
      const primary = packsRes.items[0];
      if (primary) {
        try {
          const detail = await fetchProviderPack(primary.packId);
          sources = detail.pack.versions.flatMap((v) => v.sourceDocuments).length;
          if (primary.status === "DRAFT") {
            const draftRes = await fetchProviderKnowledgeUnitDraftsApi(primary.packId);
            drafts = draftRes.items.length;
          }
        } catch {
          sources = 0;
          drafts = 0;
        }
      }
      setSourceDocumentCount(sources);
      setKnowledgeUnitDraftCount(drafts);
      setView("loggedInWithProviderProfile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider Center를 불러오지 못했습니다.");
      setView("notLoggedIn");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasReviewingPack = packs.some((p) => p.status === "REVIEWING");
  const hasPublishedOrVerifiedPack = packs.some(
    (p) => p.status === "PUBLISHED" || p.status === "VERIFIED",
  );

  const onboardingSteps = useMemo(
    () =>
      buildProviderOnboardingSteps({
        hasProfile: Boolean(profile),
        packCount: packs.length,
        sourceDocumentCount,
        knowledgeUnitDraftCount,
        hasReviewingPack,
        hasPublishedOrVerifiedPack,
        primaryPackId: packs[0]?.packId,
      }),
    [
      profile,
      packs,
      sourceDocumentCount,
      knowledgeUnitDraftCount,
      hasReviewingPack,
      hasPublishedOrVerifiedPack,
    ],
  );

  if (view === "loading") {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (view === "notLoggedIn") {
    return (
      <div className="space-y-4 pb-6">
        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
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

  if (view === "loggedInWithoutProviderProfile") {
    return (
      <div className="space-y-4 pb-6">
        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
          <p className="text-sm font-bold text-amber-950">{PROVIDER_CENTER_BEFORE_PROFILE_TITLE}</p>
          <p className="mt-1 text-xs text-amber-900">{PROVIDER_CENTER_BEFORE_PROFILE_BODY}</p>
        </div>
        <Link
          href={`${ROUTES.accountProfile}#provider-profile`}
          className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
        >
          제공자 프로필 등록
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={ROUTES.accountProfile}
          className="text-xs font-semibold text-store-accent underline-offset-2 hover:underline"
        >
          {PROVIDER_CENTER_PROFILE_LINK_LABEL}
        </Link>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-card">
        <p className="text-xs font-bold text-emerald-900">{PROVIDER_CENTER_REGISTERED_TITLE}</p>
        <p className="mt-1 text-sm text-slate-800">{PROVIDER_CENTER_REGISTERED_BODY}</p>
        {profile ? (
          <p className="mt-2 text-sm font-semibold text-slate-900">{profile.displayName}</p>
        ) : null}
        <p className="mt-2 text-xs font-semibold text-store-accent">{PROVIDER_CENTER_NEXT_TASK}</p>
        <Link
          href={ROUTES.providerPackNew}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-store-accent px-4 text-sm font-bold text-white"
        >
          새 지식팩 만들기
        </Link>
      </div>

      <ProviderOnboardingStepper steps={onboardingSteps} />

      <section id="provider-packs" className="scroll-mt-24 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">내 지식팩</h2>
        {packs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-store-border bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-slate-900">{PROVIDER_PACK_EMPTY_TITLE}</p>
            <p className="mt-1 text-xs text-store-muted">{PROVIDER_PACK_EMPTY_BODY}</p>
            <Link
              href={ROUTES.providerPackNew}
              className="mt-3 inline-block text-sm font-semibold text-store-accent underline-offset-2 hover:underline"
            >
              첫 지식팩 만들기
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {packs.map((pack) => (
              <li key={pack.packId} className="rounded-xl border border-store-border">
                <Link
                  href={providerPackDetailPath(pack.packId)}
                  className="flex min-h-[44px] items-center gap-3 px-3 py-2 active:bg-slate-50"
                >
                  <span className="text-xl">{pack.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{pack.name}</p>
                    <p className="truncate text-xs text-store-muted">{pack.shortDescription}</p>
                  </div>
                  <ProviderPackStatusBadge status={pack.status} />
                </Link>
                <div className="flex flex-wrap gap-2 border-t border-store-border px-3 py-2">
                  {packDetailActions(pack).map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="text-xs font-semibold text-store-accent underline-offset-2 hover:underline"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
