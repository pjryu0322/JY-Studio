import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";

export async function dispatchServiceFlowSingleChatSend(params: {
  readonly payload: ServiceDesignHarnessPayload;
  readonly text: string;
  readonly sendRefCurrent:
    | ((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>)
    | null
    | undefined;
  readonly onAfterDispatch: () => void;
}): Promise<{ dispatched: boolean }> {
  if (params.payload.serviceDesignStage !== "service-flow") return { dispatched: false };
  const text = String(params.text ?? "").trim();
  if (!text) return { dispatched: false };
  const fn = params.sendRefCurrent;
  if (!fn) return { dispatched: false };
  await fn(params.payload, text);
  params.onAfterDispatch();
  return { dispatched: true };
}

