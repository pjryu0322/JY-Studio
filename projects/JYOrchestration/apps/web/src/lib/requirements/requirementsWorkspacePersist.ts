import type { Project } from "@/components/project-spec/types";
import type { RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/** 요구사항 워크스페이스 원격 저장(`persistRemote`) 공통 시그니처 */
export type PersistRemoteFn = (
  nextRoom: RequirementsRoomStateV3,
  spec: Partial<Project>,
  meta?: Partial<RequirementsStateJson>
) => Promise<unknown>;
