export type MessengerHomePanel = "chat" | "aichat" | "friends";

export function parseMessengerHomePanel(raw: string | null | undefined): MessengerHomePanel {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "aichat" || v === "ai-chat") return "aichat";
  if (v === "friends" || v === "friend") return "friends";
  return "chat";
}
