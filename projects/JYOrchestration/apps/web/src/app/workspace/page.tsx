"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { WorkspaceHomeProjectsView } from "@/components/home/WorkspaceHomeProjectsView";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <WorkspaceHomeProjectsView />
    </Suspense>
  );
}
