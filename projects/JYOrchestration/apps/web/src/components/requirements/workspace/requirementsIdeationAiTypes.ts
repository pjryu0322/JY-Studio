import type { RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type IdeationPlannerTail =
  | { needsTailPersist: true; finalRoom: RequirementsRoomStateV3; persistMeta?: Partial<RequirementsStateJson> }
  | { needsTailPersist: false };

