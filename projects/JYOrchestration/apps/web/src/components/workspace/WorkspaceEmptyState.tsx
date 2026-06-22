"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

export function WorkspaceEmptyState({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}) {
  return <EmptyState title={title} description={description} action={action} />;
}
