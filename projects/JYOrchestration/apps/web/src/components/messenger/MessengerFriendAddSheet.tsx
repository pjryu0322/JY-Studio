"use client";

import { useCallback, useMemo, useState } from "react";
import { BottomSheet, Button, uiTokens as t } from "@/components/ui";
import { PlatformUserSearchCombobox, type PlatformUserRow } from "@/components/requirements/PlatformUserSearchCombobox";

export function MessengerFriendAddSheet(p: {
  readonly open: boolean;
  readonly sheetKey: number;
  readonly existingFriendUserIds: ReadonlySet<string>;
  readonly onClose: () => void;
  readonly onPickPlatformUser: (u: PlatformUserRow) => void;
}) {
  const [copyDone, setCopyDone] = useState(false);

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const base = window.location.origin;
    return `${base}/?intent=friend-invite`;
  }, []);

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2400);
    } catch {
      setCopyDone(false);
    }
  }, [inviteUrl]);

  const onPick = useCallback(
    (u: PlatformUserRow) => {
      if (p.existingFriendUserIds.has(u.id)) return;
      p.onPickPlatformUser(u);
    },
    [p.existingFriendUserIds, p.onPickPlatformUser]
  );

  return (
    <BottomSheet open={p.open} onClose={p.onClose} ariaLabel="친구 추가">
      <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary, marginBottom: 6 }}>친구 추가</div>
      <p style={{ fontSize: 12, color: t.textSecondary, margin: "0 0 14px", lineHeight: 1.5 }}>
        플랫폼에 가입한 사용자만 검색·선택할 수 있습니다. 목록에서 사람을 고르면 친구로 추가됩니다.
      </p>

      {p.open ? (
        <PlatformUserSearchCombobox
          key={p.sheetKey}
          bootstrapRecent
          existingMemberUserIds={p.existingFriendUserIds}
          duplicateBadgeLabel="추가됨"
          onPick={onPick}
        />
      ) : null}

      <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, margin: "14px 0 0" }}>
        추가한 친구는 계정에 저장되며, 대화방 참여 요청 등에서 사용됩니다.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        <Button type="button" variant="secondary" size="md" onClick={() => void copyInvite()}>
          {copyDone ? "복사됨" : "앱 초대 링크 복사"}
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={p.onClose}>
          닫기
        </Button>
      </div>
    </BottomSheet>
  );
}
