"use client";

import type { ComponentProps } from "react";
import { RequirementsDeliverableChatCard } from "@/components/requirements/RequirementsDeliverableChatCard";

/** AI 산출물 카드 — 요구사항 Deliverable 카드와 동일(추후 단계별 스킨 확장). */
export function WorkspaceResultCard(props: ComponentProps<typeof RequirementsDeliverableChatCard>) {
  return <RequirementsDeliverableChatCard {...props} />;
}
