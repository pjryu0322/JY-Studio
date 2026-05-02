"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Project } from "@/components/project-spec/types";
import { concatIdeationUserContext } from "@/lib/requirements/concatIdeationUserContext";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export function useRequirementsServiceFlowDraft(p: {
  readonly resolvedProjectId: string;
  readonly persistServiceFlow: (next: RequirementsServiceFlowV1 | null) => Promise<void>;
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
  readonly project: Project | null;
  readonly ideationReadyForServiceFlow: boolean;
  readonly ideationReadyNotice: string;
  readonly setError: (message: string | null) => void;
  readonly showSuccessToast: (message: string) => void;
  readonly showErrorToast: (message: string) => void;
  readonly roomRef: MutableRefObject<RequirementsRoomStateV3>;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly aiBackgroundBusy: boolean;
  readonly setAiBackgroundBusy: (busy: boolean) => void;
  readonly activeStage: string;
  readonly fetchNonce: number;
  readonly ideationConversationOnly: readonly RequirementsMessage[];
}) {
  const [serviceFlowDraftGenerationCount, setServiceFlowDraftGenerationCount] = useState(0);
  const serviceFlowAutoBootstrapRef = useRef<string | null>(null);
  const serviceFlowRef = useRef<RequirementsServiceFlowV1 | null>(p.serviceFlow);
  useEffect(() => {
    serviceFlowRef.current = p.serviceFlow;
  }, [p.serviceFlow]);

  const handleGenerateServiceFlowDraft = useCallback(
    async (opts?: { silent?: boolean }) => {
      const pid = p.resolvedProjectId.trim();
      if (!pid) {
        p.setError("프로젝트에 연결된 뒤 사용할 수 있습니다.");
        return;
      }
      if (!p.ideationReadyForServiceFlow) {
        p.setError(p.ideationReadyNotice);
        return;
      }
      p.setAiBackgroundBusy(true);
      p.setError(null);
      try {
        const assets = (p.stateJsonRef.current.deliverableAssets ?? []).map((a) => ({
          type: a.type,
          title: a.title,
          content: a.content,
        }));
        const extraAssets: Array<{ type?: string; title?: string; content?: string }> = [];
        const lastPrompt = String(p.stateJsonRef.current.lastPromptText ?? "").trim();
        if (lastPrompt) extraAssets.push({ type: "ideation_summary", title: "아이디어 요약", content: lastPrompt });
        const draftText = String(p.stateJsonRef.current.lastUserDraftText ?? "").trim();
        if (draftText) extraAssets.push({ type: "requirements_draft", title: "사용자 초안", content: draftText });
        const convo = concatIdeationUserContext(p.roomRef.current.requirementsConversation.messages).trim();
        if (convo) extraAssets.push({ type: "requirements_conversation", title: "최근 대화", content: convo.slice(0, 8000) });
        const res = await fetch("/api/requirements/service-flow-draft", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            projectName: p.project?.name ?? "",
            projectDescription: p.project?.description ?? "",
            ideationAssets: [...assets, ...extraAssets],
          }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          code?: string;
          message?: string;
          data?: {
            steps?: Array<{ title?: string; purpose?: string; primary?: string; secondary?: string[] }>;
            actors?: Array<{ name?: string; kind?: string; description?: string }>;
            reviewPoints?: string[];
          };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message || "AI 초안 생성에 실패했습니다.");
        }
        const now = new Date().toISOString();
        const actorsRaw = Array.isArray(json.data.actors) ? json.data.actors : [];
        const stepsRaw = Array.isArray(json.data.steps) ? json.data.steps : [];

        const actorIdByName = new Map<string, string>();
        const actors = actorsRaw
          .map((a) => {
            const name = String(a?.name ?? "").trim();
            const kind = String(a?.kind ?? "").trim().toLowerCase();
            if (!name) return null;
            const id = `actor:${name}`;
            actorIdByName.set(name, id);
            return {
              id,
              name,
              kind: kind === "system" ? ("system" as const) : ("human" as const),
              description: typeof a?.description === "string" ? a.description.trim() : null,
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));
        if (!actors.length) {
          actors.push({ id: "actor:사용자", name: "사용자", kind: "human" as const, description: null });
        }

        const steps = stepsRaw
          .map((s, idx) => {
            const title = String(s?.title ?? "").trim();
            const purpose = String(s?.purpose ?? "").trim();
            const primaryName = String(s?.primary ?? "").trim();
            let primaryActorId = actorIdByName.get(primaryName) ?? "";
            if (!primaryActorId && primaryName) {
              primaryActorId = `actor:${primaryName}`;
              actorIdByName.set(primaryName, primaryActorId);
              actors.push({ id: primaryActorId, name: primaryName, kind: "human" as const, description: null });
            }
            if (!primaryActorId) primaryActorId = actors[0]!.id;
            const secondary = Array.isArray(s?.secondary) ? s.secondary.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
            const secondaryActorIds = secondary
              .map((nm) => {
                const known = actorIdByName.get(nm);
                if (known) return known;
                const id = `actor:${nm}`;
                actorIdByName.set(nm, id);
                actors.push({ id, name: nm, kind: "system" as const, description: null });
                return id;
              })
              .filter((id) => id !== primaryActorId);
            if (!title || !purpose) return null;
            return {
              id: `step:${idx + 1}:${title}`,
              order: idx + 1,
              title,
              purpose,
              primaryActorId,
              secondaryActorIds,
              approved: false,
              updatedAt: now,
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));

        const next: RequirementsServiceFlowV1 = {
          createdAt: serviceFlowRef.current?.createdAt ?? now,
          updatedAt: now,
          steps,
          actors,
        };
        await p.persistServiceFlow(next);
        setServiceFlowDraftGenerationCount((n) => n + 1);
        if (!opts?.silent) p.showSuccessToast("서비스 흐름 초안 생성 완료");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        p.setError(msg);
        if (!opts?.silent) p.showErrorToast(msg);
      } finally {
        p.setAiBackgroundBusy(false);
      }
    },
    [
      p.resolvedProjectId,
      p.ideationReadyForServiceFlow,
      p.ideationReadyNotice,
      p.project?.name,
      p.project?.description,
      p.persistServiceFlow,
      p.setError,
      p.showSuccessToast,
      p.showErrorToast,
      p.setAiBackgroundBusy,
      p.stateJsonRef,
      p.roomRef,
    ],
  );

  useEffect(() => {
    if (p.activeStage !== "service-flow") return;
    if (p.aiBackgroundBusy) return;
    const pid = p.resolvedProjectId.trim();
    if (!pid) return;
    const flowEmpty = !p.serviceFlow || !(p.serviceFlow.actors?.length || p.serviceFlow.steps?.length);
    if (!flowEmpty) return;
    const assets = p.stateJsonRef.current.deliverableAssets ?? [];
    const hasIdeationAssets = assets.length > 0;
    const hasConversation = p.ideationConversationOnly.some((m) => m.role === "human" && String(m.content ?? "").trim());
    if (!(hasIdeationAssets || hasConversation)) return;
    if (!p.ideationReadyForServiceFlow) return;
    const flightKey = `${pid}:${p.fetchNonce}:${assets.length}`;
    if (serviceFlowAutoBootstrapRef.current === flightKey) return;
    serviceFlowAutoBootstrapRef.current = flightKey;
    void handleGenerateServiceFlowDraft({ silent: true });
  }, [
    p.activeStage,
    p.aiBackgroundBusy,
    p.resolvedProjectId,
    p.serviceFlow,
    p.ideationReadyForServiceFlow,
    p.fetchNonce,
    p.ideationConversationOnly,
    handleGenerateServiceFlowDraft,
    p.stateJsonRef,
  ]);

  return {
    handleGenerateServiceFlowDraft,
    serviceFlowDraftGenerationCount,
  };
}
