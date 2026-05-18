import type { Project } from "@/components/project-spec/types";

export type FormState = {
  name: string;
  description: string;
  projectType: string;
  specCoreGoals: string;
  specScopeIn: string;
  specScopeOut: string;
  specTargetUsers: string;
  specSuccessCriteria: string;
};

export function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    projectType: "web-service",
    specCoreGoals: "",
    specScopeIn: "",
    specScopeOut: "",
    specTargetUsers: "",
    specSuccessCriteria: "",
  };
}

export function projectToForm(p: Project | null): FormState {
  if (!p) {
    return emptyForm();
  }
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    projectType: p.projectType || "web-service",
    specCoreGoals: p.specCoreGoals ?? "",
    specScopeIn: p.specScopeIn ?? "",
    specScopeOut: p.specScopeOut ?? "",
    specTargetUsers: p.specTargetUsers ?? "",
    specSuccessCriteria: p.specSuccessCriteria ?? "",
  };
}
