"use client";

import { useRouter } from "next/navigation";
import { useCallback, type MouseEvent } from "react";
import { ConnectActionButton } from "@/components/ConnectActionButton";
import { useMyPacks } from "@/hooks/useMyPacks";
import type { PublicPackCapabilities } from "@/lib/public-pack-capability";
import { isPackApiIntegrationReady } from "@/lib/public-pack-capability";
import { myPackConnectPath, ROUTES } from "@/lib/routes";
import Link from "next/link";

export type AddToMyPacksButtonProps = {
  packId: string;
  variant?: "detail" | "card";
  capabilities?: PublicPackCapabilities | null;
};

export function AddToMyPacksButton({
  packId,
  variant = "card",
  capabilities,
}: AddToMyPacksButtonProps) {
  const router = useRouter();
  const { mounted, isMyPack, addMyPack } = useMyPacks();
  const added = isMyPack(packId);
  const apiReady = capabilities ? isPackApiIntegrationReady(capabilities) : false;

  const onAdd = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void addMyPack(packId).catch(() => {
        window.alert("내 지식팩에 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      });
    },
    [addMyPack, packId],
  );

  const onConnect = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      router.push(myPackConnectPath(packId));
    },
    [packId, router],
  );

  if (!mounted) {
    return (
      <div
        className={`min-h-[44px] w-full rounded-xl bg-slate-100 ${variant === "detail" ? "h-[92px]" : ""}`}
        aria-hidden
      />
    );
  }

  if (added) {
    if (variant === "detail") {
      return (
        <div className="flex flex-col gap-2">
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            ✓ 내 지식팩에 추가됨
          </p>
          <ConnectActionButton packId={packId} capabilities={capabilities} />
          <Link
            href={ROUTES.myPacks}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-slate-800 active:bg-slate-50"
          >
            내 지식팩에서 보기
          </Link>
        </div>
      );
    }
    if (!apiReady) {
      return (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-900">
          ✓ 내 지식팩에 추가됨
        </p>
      );
    }
    return (
      <button
        type="button"
        className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent active:bg-slate-50"
        onClick={onConnect}
      >
        연동하기
      </button>
    );
  }

  return (
    <button
      type="button"
      className="min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white active:opacity-90"
      onClick={onAdd}
    >
      내 지식팩에 추가
    </button>
  );
}
