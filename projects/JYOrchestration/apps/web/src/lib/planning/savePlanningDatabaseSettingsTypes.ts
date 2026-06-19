import type { ProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

export type SavePlanningDatabaseUsageSettingsResult = Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly saved: boolean;
  readonly message: string;
  readonly projectDbStatus?: ProjectDatabaseLifecycleStatus;
}>;
