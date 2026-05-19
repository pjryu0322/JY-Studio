export type MessengerFriendApiRow = {
  id: string;
  displayName: string;
  email: string | null;
};

export async function fetchMessengerFriends(): Promise<MessengerFriendApiRow[]> {
  const res = await fetch("/api/me/messenger-friends", { credentials: "include", cache: "no-store" });
  const json = (await res.json()) as { success?: boolean; data?: MessengerFriendApiRow[] };
  if (!res.ok || !json.success || !Array.isArray(json.data)) return [];
  return json.data;
}

export async function addMessengerFriendApi(friendUserId: string): Promise<MessengerFriendApiRow | null> {
  const res = await fetch("/api/me/messenger-friends", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friendUserId }),
  });
  const json = (await res.json()) as { success?: boolean; data?: MessengerFriendApiRow };
  if (!res.ok || !json.success || !json.data) return null;
  return json.data;
}

export async function syncMessengerFriendsToServer(userIds: readonly string[]): Promise<void> {
  if (!userIds.length) return;
  await fetch("/api/me/messenger-friends", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds }),
  });
}

export async function requestChatRoomMemberInvite(roomId: string, inviteeUserId: string) {
  const res = await fetch(`/api/chat-rooms/${encodeURIComponent(roomId)}/member-invites`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteeUserId }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    outcome?: string;
  };
  return { ok: res.ok && json.success !== false, message: json.message ?? "", outcome: json.outcome ?? "" };
}

export async function fetchPendingChatRoomMemberInvites(roomId: string) {
  const res = await fetch(`/api/chat-rooms/${encodeURIComponent(roomId)}/member-invites`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: Array<{ inviteId: string; inviteeUserId: string; displayName: string }>;
  };
  if (!res.ok || !json.success || !Array.isArray(json.data)) return [];
  return json.data;
}
