import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  hasImplementationTaskListReady,
  type ImplementationTaskListV1,
} from "@/lib/requirements/implementationTaskList";

export type ImplementationTaskListReadinessStatus =
  | "ready_to_generate_from_seed"
  | "missing_seed"
  | "seed_not_confirmed"
  | "task_list_exists"
  | "unknown";

export type ImplementationTaskListReadiness = Readonly<{
  readonly status: ImplementationTaskListReadinessStatus;
  readonly message: string;
  readonly canGenerateTaskList: boolean;
}>;

function isSeedReadyForTaskListGeneration(seed: ImplementationSeedV1 | null | undefined): boolean {
  if (!seed) return false;
  if (!seed.readiness?.ready) return false;
  if (seed.lifecycleStatus === "candidate") return false;
  return true;
}

export function deriveImplementationTaskListReadiness(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}): ImplementationTaskListReadiness {
  if (hasImplementationTaskListReady(input.implementationTaskListV1)) {
    return {
      status: "task_list_exists",
      message: "구현 작업목록이 준비되어 있습니다.",
      canGenerateTaskList: false,
    };
  }

  const seed = input.implementationSeedV1;
  if (!seed) {
    return {
      status: "missing_seed",
      message: "구현 작업목록을 생성하려면 먼저 기획단계에서 Quick Design을 확정해야 합니다.",
      canGenerateTaskList: false,
    };
  }

  if (!isSeedReadyForTaskListGeneration(seed)) {
    return {
      status: "seed_not_confirmed",
      message:
        "구현 준비정보(Implementation Seed)가 아직 확정되지 않았습니다. 기획단계에서 Quick Design 확정을 완료해 주세요.",
      canGenerateTaskList: false,
    };
  }

  return {
    status: "ready_to_generate_from_seed",
    message:
      "확정된 Quick Design과 구현 준비정보(Implementation Seed)를 기준으로 구현 작업목록을 생성할 수 있습니다.",
    canGenerateTaskList: true,
  };
}
