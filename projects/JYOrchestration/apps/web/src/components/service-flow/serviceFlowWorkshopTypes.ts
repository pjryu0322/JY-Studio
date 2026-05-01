import type { CSSProperties } from "react";

export type WorkshopRole = "ai" | "expert" | "member" | "user";

export type WorkshopMessage = {
  id: string;
  role: WorkshopRole;
  name: string;
  body: string;
};

export function messageTone(role: WorkshopRole): CSSProperties {
  if (role === "user") return { background: "#f0fdf4", borderColor: "#bbf7d0", justifySelf: "end" };
  if (role === "expert") return { background: "#fff7ed", borderColor: "#fed7aa", justifySelf: "start" };
  if (role === "member") return { background: "#f8fafc", borderColor: "#cbd5e1", justifySelf: "start" };
  return { background: "#fff", borderColor: "#e2e8f0", justifySelf: "start" };
}
