import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import type { ProviderPackTabId } from "@/lib/provider-pack-tabs";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";
import type { RoleRailItem } from "@/lib/role-workspace/types";

/**
 * Provider pack workflow rail — Store process stages (not consumer CTAs).
 */
export function getProviderPackRailState(input: {
  packId: string;
  activeTab: ProviderPackTabId;
  pack: ProviderPackDetailDto | null;
  tabLocks?: Partial<Record<ProviderPackTabId, { locked: boolean; reason?: string }>>;
}): RoleRailItem[] {
  const { packId, activeTab, pack, tabLocks } = input;
  const base = providerPackDetailPath(packId);

  const reviewStatus = pack?.latestReviewStatus ?? null;
  const submitted = reviewStatus === "PENDING" || reviewStatus === "IN_REVIEW";
  const rejected = pack?.status === "DRAFT" && Boolean(pack.latestRejectionReason);
  const published = pack?.status === "PUBLISHED" || pack?.status === "VERIFIED";
  const hold = pack?.adminGenerationHold ?? null;
  const providerPhase = pack?.providerReviewPhase ?? "NONE";
  const adminProcessing =
    hold === "ACCEPTED" || hold === "PROCESSING" || hold === "COMPLETED";
  const needsGenerationReview = providerPhase === "REQUESTED";
  const waitingAfterConfirm =
    providerPhase === "CONFIRMED" || submitted;

  const tabs: Array<{ id: string; label: string; href: string }> = [
    { id: "list", label: "내 지식팩", href: ROUTES.provider },
    { id: "basic", label: "기본정보", href: `${base}?tab=basic` },
    { id: "payload", label: "자료등록", href: `${base}?tab=payload` },
    { id: "request", label: "처리요청", href: `${base}?tab=payload` },
    { id: "adminStatus", label: "관리자 처리상태", href: `${base}?tab=knowledge` },
    { id: "generationReview", label: "생성 결과 검토", href: `${base}?tab=knowledge` },
    { id: "reviewStatus", label: "검수 상태", href: `${base}?tab=distributionReview` },
    { id: "publish", label: "공개 정보", href: `${base}?tab=distributionReview` },
    { id: "insights", label: "사용 통계", href: ROUTES.accountPlan },
  ];

  const order = [
    "basic",
    "payload",
    "request",
    "adminStatus",
    "generationReview",
    "reviewStatus",
    "publish",
    "insights",
  ] as const;

  let activeRailId: string = activeTab;
  if (activeTab === "knowledge") {
    activeRailId = needsGenerationReview
      ? "generationReview"
      : adminProcessing
        ? "adminStatus"
        : "generationReview";
  } else if (activeTab === "payload") {
    activeRailId = adminProcessing || needsGenerationReview ? "payload" : "payload";
  } else if (activeTab === "distributionReview") {
    activeRailId = published ? "publish" : waitingAfterConfirm || rejected ? "reviewStatus" : "reviewStatus";
  } else if (activeTab === "serviceValidation") {
    activeRailId = "adminStatus";
  } else if (activeTab === "basic") {
    activeRailId = "basic";
  }

  const activeIdx = order.indexOf(activeRailId as (typeof order)[number]);

  return tabs.map((tab) => {
    if (tab.id === "list") {
      return { id: tab.id, label: tab.label, href: tab.href, status: "idle" as const };
    }

    if (tab.id === "generationReview") {
      let status: RoleRailItem["status"] = "idle";
      if (needsGenerationReview) status = activeRailId === "generationReview" ? "current" : "next";
      else if (providerPhase === "CONFIRMED" || submitted || published) status = "completed";
      else if (adminProcessing && hold === "COMPLETED") status = "next";
      return { id: tab.id, label: tab.label, href: tab.href, status };
    }

    if (tab.id === "adminStatus") {
      let status: RoleRailItem["status"] = "idle";
      if (adminProcessing && !needsGenerationReview && providerPhase !== "CONFIRMED") {
        status = activeRailId === "adminStatus" ? "current" : "current";
      } else if (
        providerPhase === "CONFIRMED" ||
        providerPhase === "REQUESTED" ||
        submitted ||
        published
      ) {
        status = "completed";
      }
      return { id: tab.id, label: tab.label, href: tab.href, status };
    }

    if (tab.id === "request") {
      const lock = tabLocks?.payload;
      let status: RoleRailItem["status"] = "idle";
      if (lock?.locked) status = "blocked";
      else if (adminProcessing || providerPhase === "REQUESTED" || providerPhase === "CONFIRMED") {
        status = "completed";
      } else if (activeRailId === "request" || activeRailId === "payload") {
        status = activeTab === "payload" ? "current" : "idle";
      }
      return {
        id: tab.id,
        label: tab.label,
        href: tab.href,
        status,
        blockedReason: lock?.locked ? lock.reason : undefined,
      };
    }

    if (tab.id === "reviewStatus") {
      return {
        id: tab.id,
        label: tab.label,
        href: tab.href,
        status:
          activeRailId === "reviewStatus"
            ? ("current" as const)
            : submitted || rejected || providerPhase === "CONFIRMED"
              ? ("current" as const)
              : published
                ? ("completed" as const)
                : ("idle" as const),
      };
    }

    if (tab.id === "publish" || tab.id === "insights") {
      return {
        id: tab.id,
        label: tab.label,
        href: tab.href,
        status: published
          ? tab.id === activeRailId
            ? ("current" as const)
            : ("next" as const)
          : ("idle" as const),
      };
    }

    const lock = tabLocks?.[tab.id === "payload" ? "payload" : (tab.id as ProviderPackTabId)];
    const idx = order.indexOf(tab.id as (typeof order)[number]);
    let status: RoleRailItem["status"] = "idle";
    if (lock?.locked) status = "blocked";
    else if (tab.id === activeRailId) status = "current";
    else if (idx >= 0 && activeIdx >= 0 && idx < activeIdx) status = "completed";
    else if (idx === activeIdx + 1) status = "next";

    return {
      id: tab.id,
      label: tab.label,
      href: tab.href,
      status,
      blockedReason: lock?.locked ? lock.reason : undefined,
    };
  });
}
