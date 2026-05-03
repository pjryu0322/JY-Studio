"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export function WorkspaceEmptyState({
  title,
  description,
  action,
  screenLabel,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  /** `ScreenLabels` 켜졌을 때만 표시 */
  readonly screenLabel?: string;
}) {
  const show = useShowScreenLabels();
  return (
    <div style={{ position: "relative" }}>
      {screenLabel ? <ScreenLabel label={screenLabel} visible={show} /> : null}
      <EmptyState title={title} description={description} action={action} />
    </div>
  );
}
