"use client";

import { useRouter } from "next/navigation";
import { useCallback, type MouseEvent } from "react";
import { ConnectActionButton } from "@/components/ConnectActionButton";
import { useMyPacks } from "@/hooks/useMyPacks";
import { myPackConnectPath } from "@/lib/routes";

export type AddToMyPacksButtonProps = {
  packId: string;
  variant?: "detail" | "card";
};

export function AddToMyPacksButton({ packId, variant = "card" }: AddToMyPacksButtonProps) {
  const router = useRouter();
  const { mounted, isMyPack, addMyPack } = useMyPacks();
  const added = isMyPack(packId);

  const onAdd = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      addMyPack(packId);
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
          <button
            type="button"
            disabled
            className="min-h-[44px] w-full cursor-default rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-600"
          >
            추가됨
          </button>
          <ConnectActionButton packId={packId} />
        </div>
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
