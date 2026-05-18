import { Suspense } from "react";
import { TasksPageClient } from "@/app/tasks/TasksPageClient";

export default function TasksPage() {
  return (
    <Suspense fallback={<div />}>
      <TasksPageClient />
    </Suspense>
  );
}

