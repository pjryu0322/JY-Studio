 "use client";
 
 import { useEffect, useRef } from "react";
 import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
 import { runServiceDesignHarnessTurn } from "@/lib/service-design/runServiceDesignHarnessTurn";
 import { useFeaturePlanningWorkspace } from "@/components/feature-planning/useFeaturePlanningWorkspace";
 
 export function useFeaturePlanningSingleChatBridge(params: {
   readonly projectId: string;
   /** expose existing send logic to parent without UI mount */
   readonly singleChatSendRef?: {
     current: ((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null;
   };
   readonly onSingleChatAiMessages?: (messages: readonly { content: string; speakerName?: string }[]) => void | Promise<void>;
 }) {
   const shell = useFeaturePlanningWorkspace(params.projectId);
   const messagesRef = useRef(shell.messages);
   useEffect(() => {
     messagesRef.current = shell.messages;
   }, [shell.messages]);
 
   const waitForNewAiMessages = async (beforeIds: Set<string>): Promise<readonly { content: string; speakerName?: string }[]> => {
     const start = Date.now();
     while (Date.now() - start < 2500) {
       const cur = messagesRef.current ?? [];
       const added = cur.filter((m) => !beforeIds.has(m.id) && m.role === "ai" && String(m.text ?? "").trim());
       if (added.length) {
         return added.map((m) => ({ content: String(m.text ?? "").trim() }));
       }
       await new Promise<void>((r) => window.requestAnimationFrame(() => r()));
     }
     return [];
   };
 
   useEffect(() => {
     const ref = params.singleChatSendRef;
     if (!ref) return;
     ref.current = async (payload, text) => {
       if (payload.serviceDesignStage !== "feature-planning") return;
       const pid = params.projectId.trim();
       if (!pid) return;
 
       // Keep harness execution for parity with the full workspace.
       const harness = await runServiceDesignHarnessTurn({
         input: text,
         stage: "feature-planning",
         mentionedAI: payload.mentionedAI ?? null,
       });
       console.debug("[HARNESS:feature-planning]", harness);
 
       const before = messagesRef.current ?? [];
       const beforeIds = new Set(before.map((m) => m.id));
       await shell.sendMessage(text);
       try {
         const newlyAddedAi = await waitForNewAiMessages(beforeIds);
         if (newlyAddedAi.length) {
           await params.onSingleChatAiMessages?.(newlyAddedAi);
         }
       } catch {
         // best-effort mirror; do not break send path
       }
     };
     return () => {
       if (ref.current) ref.current = null;
     };
     // eslint-disable-next-line react-hooks/exhaustive-deps -- ref assignment depends on stable `ref`
   }, [params.projectId, params.singleChatSendRef, params.onSingleChatAiMessages, shell]);
 }

