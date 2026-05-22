"use client";

import { useCallback, useEffect, useState } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { fetchMessengerChatRoomDetail, fetchMessengerChatRoomMessages } from "@/lib/messenger/messengerChatRoomApi";
import type { MessengerRoomDetail } from "@/lib/messenger/messengerRoomParticipantMapping";
import { sessionUserFromAuthMe, type AuthMeDataWire } from "@/lib/user/platformProfile";

export function useMessengerChatRoomData(roomId: string) {
  const rid = roomId.trim();
  const [sessionName, setSessionName] = useState("나");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessengerRoomDetail | null>(null);
  const [messages, setMessages] = useState<readonly RequirementsMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as { success?: boolean; data?: AuthMeDataWire | null };
        if (res.ok && json.success && json.data) {
          const u = sessionUserFromAuthMe(json.data);
          setSessionUserId(u.id || null);
          setSessionName(u.name || "나");
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const reloadMessages = useCallback(async () => {
    if (!rid) return;
    setMessages(await fetchMessengerChatRoomMessages(rid));
  }, [rid]);

  const reloadDetail = useCallback(async () => {
    if (!rid) return;
    setDetail(await fetchMessengerChatRoomDetail(rid));
  }, [rid]);

  const applyRoomDetail = useCallback((next: MessengerRoomDetail) => {
    setDetail(next);
  }, []);

  useEffect(() => {
    if (!rid) {
      setLoadError("대화방 ID가 없습니다.");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      setMessages(null);
      try {
        await reloadDetail();
        await reloadMessages();
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "불러오기 실패");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rid, reloadDetail, reloadMessages]);

  return {
    rid,
    sessionName,
    sessionUserId,
    detail,
    messages,
    loadError,
    reloadDetail,
    reloadMessages,
    applyRoomDetail,
  };
}
