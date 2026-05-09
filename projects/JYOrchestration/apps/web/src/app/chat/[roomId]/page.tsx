"use client";

import { useParams } from "next/navigation";
import { MessengerChatRoomClient } from "@/components/messenger/MessengerChatRoomClient";

export default function MessengerChatRoomPage() {
  const params = useParams();
  const roomId = String(params?.roomId ?? "");
  return <MessengerChatRoomClient roomId={roomId} />;
}
