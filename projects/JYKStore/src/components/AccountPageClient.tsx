"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminRoleVerifier } from "@/components/AdminAccessGate";
import {
  clearConsumerProfile,
  isConsumerRegistered,
  loadConsumerProfile,
  saveConsumerProfile,
  type ConsumerProfile,
} from "@/lib/account-role-storage";
import { isAdminSessionVerified } from "@/lib/admin-ops-session";
import {
  ACCOUNT_GUEST_DESCRIPTION,
  ACCOUNT_GUEST_TITLE,
  ACCOUNT_SECTION_ROLE_MENUS,
  ACCOUNT_SECTION_ROLE_REGISTRATION,
  ACCOUNT_SECTION_SETTINGS,
} from "@/lib/role-based-ux-copy";
import { fetchProviderProfile } from "@/lib/provider-center-api";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import { ROUTES } from "@/lib/routes";

function StatusBadge({ label, tone }: { label: string; tone: "muted" | "ok" | "warn" }) {
  const styles =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-900"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${styles}`}>{label}</span>
  );
}

function MenuLink({ title, description, href }: { title: string; description: string; href: string }) {
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

export function AccountPageClient() {
  const [consumer, setConsumer] = useState<ConsumerProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfileDto | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [adminVerified, setAdminVerified] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [registering, setRegistering] = useState(false);

  const refreshRoles = useCallback(async () => {
    if (typeof window === "undefined") return;
    setConsumer(loadConsumerProfile(localStorage));
    setAdminVerified(isAdminSessionVerified(sessionStorage));
    try {
      const res = await fetchProviderProfile();
      setClientId(res.clientId);
      setProviderProfile(res.profile);
    } catch {
      setProviderProfile(null);
    }
  }, []);

  useEffect(() => {
    void refreshRoles();
  }, [refreshRoles]);

  const onRegisterConsumer = (e: FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const saved = saveConsumerProfile(localStorage, { displayName, purpose });
      setConsumer(saved);
    } finally {
      setRegistering(false);
    }
  };

  const onResetConsumer = () => {
    clearConsumerProfile(localStorage);
    setConsumer(null);
    setDisplayName("");
    setPurpose("");
  };

  const providerRegistered = Boolean(providerProfile);

  const profileTitle = consumer?.displayName ?? ACCOUNT_GUEST_TITLE;
  const profileSubtitle = consumer
    ? consumer.purpose
    : ACCOUNT_GUEST_DESCRIPTION;

  const roleLabels: string[] = [];
  if (consumer) roleLabels.push("일반 사용자");
  if (providerRegistered) roleLabels.push("제공자");
  if (adminVerified) roleLabels.push("운영자");

  return (
    <div className="space-y-5 pb-8">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl">
            👤
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-900">{profileTitle}</p>
            <p className="mt-1 text-xs text-store-muted">{profileSubtitle}</p>
            {clientId ? (
              <p className="mt-2 truncate font-mono text-[10px] text-store-muted">clientId: {clientId}</p>
            ) : null}
            {roleLabels.length > 0 ? (
              <p className="mt-2 text-[11px] font-semibold text-slate-700">활성 역할: {roleLabels.join(" · ")}</p>
            ) : (
              <p className="mt-2 text-[11px] font-semibold text-amber-800">먼저 사용할 역할을 선택하세요.</p>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">
          {ACCOUNT_SECTION_ROLE_REGISTRATION}
        </h2>

        <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">일반 사용자 계정</p>
            <StatusBadge
              label={consumer ? "등록됨" : "미등록"}
              tone={consumer ? "ok" : "muted"}
            />
          </div>
          <p className="mt-1 text-xs text-store-muted">지식팩을 검색하고 API로 연결합니다.</p>
          {consumer ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-700">{consumer.displayName}</p>
              <button
                type="button"
                onClick={onResetConsumer}
                className="text-xs font-semibold text-store-muted underline-offset-2 hover:underline"
              >
                등록 정보 초기화 (테스트)
              </button>
            </div>
          ) : (
            <form onSubmit={onRegisterConsumer} className="mt-3 space-y-2">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="표시 이름 (예: JYK 테스트 사용자)"
                required
                maxLength={80}
                className="min-h-[40px] w-full rounded-lg border border-store-border px-3 text-sm"
              />
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="사용 목적 (예: 지식팩 검색 및 API 연결 테스트)"
                required
                maxLength={200}
                className="min-h-[40px] w-full rounded-lg border border-store-border px-3 text-sm"
              />
              <button
                type="submit"
                disabled={registering}
                className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
              >
                {registering ? "등록 중…" : "일반 사용자로 등록"}
              </button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">지식팩 제공자 계정</p>
            <StatusBadge
              label={providerRegistered ? "등록됨" : "프로필 등록 필요"}
              tone={providerRegistered ? "ok" : "warn"}
            />
          </div>
          <p className="mt-1 text-xs text-store-muted">제품 지식을 등록하고 지식팩을 만듭니다.</p>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href={ROUTES.provider}
              className="min-h-[44px] rounded-xl border border-store-border bg-white text-center text-sm font-bold leading-[44px] text-slate-800"
            >
              {providerRegistered ? "제공자 센터 열기" : "제공자 등록하러 가기"}
            </Link>
            {providerRegistered ? (
              <Link
                href={ROUTES.providerPackNew}
                className="min-h-[44px] rounded-xl bg-store-accent text-center text-sm font-bold leading-[44px] text-white"
              >
                새 지식팩 만들기
              </Link>
            ) : null}
          </div>
        </div>

        <div
          id="account-role-admin"
          className="scroll-mt-24 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-700">지식팩 운영자 계정</p>
            <StatusBadge
              label={adminVerified ? "권한 확인됨" : "권한 확인 필요"}
              tone={adminVerified ? "ok" : "warn"}
            />
          </div>
          <p className="mt-1 text-xs text-store-muted">지식팩 승인, 공개, 사용량을 관리합니다.</p>
          <span className="mt-2 inline-flex rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            운영자 전용
          </span>
          <AdminRoleVerifier verified={adminVerified} onVerified={() => void refreshRoles()} />
        </div>
      </section>

      {consumer ? (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">
            {ACCOUNT_SECTION_ROLE_MENUS}
          </h2>
          <ul className="space-y-2">
            <li>
              <MenuLink title="API Key 관리" description="연동용 API Key 발급 및 폐기" href={ROUTES.apiKeys} />
            </li>
            <li>
              <MenuLink title="내 지식팩" description="보관한 지식팩 및 연결 설정" href={ROUTES.myPacks} />
            </li>
            <li>
              <MenuLink title="문서" description="API 문서 및 SDK 샘플" href={ROUTES.docs} />
            </li>
            <li>
              <MenuLink title="이용 플랜" description="현재 무료 이용 상태 및 사용량" href={ROUTES.accountPlan} />
            </li>
          </ul>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-store-border bg-slate-50 px-4 py-3 text-xs text-store-muted">
          일반 사용자로 등록하면 API Key, 내 지식팩, 이용 플랜 메뉴가 열립니다.{" "}
          <Link href={ROUTES.docs} className="font-semibold text-store-accent underline-offset-2 hover:underline">
            문서 보기
          </Link>
          는 등록 없이 이용할 수 있습니다.
        </section>
      )}

      {adminVerified ? (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">운영자 도구</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <MenuLink title="관리자 콘솔" description="지식팩 검수 및 승인" href={ROUTES.adminReviews} />
            </li>
            <li>
              <MenuLink
                title="Knowledge Unit draft 검수"
                description="GitHub 자동수집 초안 승인/활성화"
                href={ROUTES.adminKnowledgeUnitDrafts}
              />
            </li>
            <li>
              <MenuLink title="운영 사용량 확인" description="API UsageLog 조회" href={ROUTES.adminOpsUsage} />
            </li>
            <li>
              <MenuLink title="AuditLog" description="감사 로그 조회" href={ROUTES.adminOpsAudit} />
            </li>
            <li>
              <MenuLink title="Ops 대시보드" description="Health, Quota, API Keys" href={ROUTES.adminOps} />
            </li>
          </ul>
        </section>
      ) : null}

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
