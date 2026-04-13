/**
 * MVP — upstream domain model (Requirement → Feature → IA → Screen → Task).
 *
 * This layer is additive and does NOT integrate with execution yet.
 */

export type MvpRequirementStatus = "DRAFT" | "CONFIRMED" | "DONE";

export type MvpRequirement = {
  id: string;
  projectId: string;
  description: string;
  status: MvpRequirementStatus;
};

export type MvpFeature = {
  id: string;
  projectId: string;
  name: string;
  requirementIds: string[];
  order: number;
};

export type MvpMenuNode = {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  order: number;
};

export type MvpScreen = {
  id: string;
  projectId: string;
  name: string;
  menuId: string;
  routePath: string;
  order: number;
};

