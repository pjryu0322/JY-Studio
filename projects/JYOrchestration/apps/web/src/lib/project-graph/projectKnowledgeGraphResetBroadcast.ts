export const PROJECT_KNOWLEDGE_GRAPH_RESET_BROADCAST_CHANNEL = "jyo:project-knowledge-graph-reset" as const;

export type ProjectKnowledgeGraphResetBroadcast = Readonly<{
  readonly type: "project-knowledge-graph-reset";
  readonly projectId: string;
  readonly resetAt: string;
  readonly reason: "planning_reset" | "planning_regenerated" | "manual";
}>;

const STORAGE_KEY = "jyo.projectKnowledgeGraphReset";

export function emitProjectKnowledgeGraphResetBroadcast(
  message: ProjectKnowledgeGraphResetBroadcast,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify(message);
    window.localStorage.setItem(STORAGE_KEY, payload);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: payload }));
    window.dispatchEvent(
      new CustomEvent(PROJECT_KNOWLEDGE_GRAPH_RESET_BROADCAST_CHANNEL, { detail: message }),
    );
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(PROJECT_KNOWLEDGE_GRAPH_RESET_BROADCAST_CHANNEL);
      channel.postMessage(message);
      channel.close();
    }
  } catch {
    // ignore broadcast failures
  }
}

export function subscribeProjectKnowledgeGraphResetBroadcast(
  onMessage: (message: ProjectKnowledgeGraphResetBroadcast) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handle = (raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const m = raw as ProjectKnowledgeGraphResetBroadcast;
    if (m.type !== "project-knowledge-graph-reset") return;
    const pid = String(m.projectId ?? "").trim();
    if (!pid) return;
    onMessage({
      type: "project-knowledge-graph-reset",
      projectId: pid,
      resetAt: String(m.resetAt ?? ""),
      reason:
        m.reason === "planning_regenerated" || m.reason === "manual" ? m.reason : "planning_reset",
    });
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      handle(JSON.parse(event.newValue));
    } catch {
      // ignore
    }
  };

  let channel: BroadcastChannel | null = null;
  const onChannel = (event: MessageEvent) => handle(event.data);
  const onCustom = (event: Event) => handle((event as CustomEvent).detail);

  window.addEventListener("storage", onStorage);
  window.addEventListener(PROJECT_KNOWLEDGE_GRAPH_RESET_BROADCAST_CHANNEL, onCustom);
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(PROJECT_KNOWLEDGE_GRAPH_RESET_BROADCAST_CHANNEL);
    channel.addEventListener("message", onChannel);
  }

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PROJECT_KNOWLEDGE_GRAPH_RESET_BROADCAST_CHANNEL, onCustom);
    channel?.removeEventListener("message", onChannel);
    channel?.close();
  };
}
