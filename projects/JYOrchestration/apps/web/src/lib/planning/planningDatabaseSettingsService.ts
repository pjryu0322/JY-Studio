import { prisma } from "@/lib/prisma";
import {
  defaultPlanningDatabaseSettingsV1,
  parsePlanningDatabaseSettingsV1,
  sanitizePlanningDatabaseSettingsForClient,
  type PlanningDatabaseSettingsV1,
} from "@/lib/planning/planningDatabaseSettingsV1";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function maskPasswordForStorage(_password: string): string {
  return "••••••••";
}

export async function loadPlanningDatabaseSettingsForProject(projectId: string): Promise<PlanningDatabaseSettingsV1> {
  const pid = projectId.trim();
  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(project?.requirementsStateJson);
  const fromState = parsePlanningDatabaseSettingsV1(state.planningDatabaseSettingsV1);
  const setup = await prisma.executionSetup.findUnique({
    where: { projectId: pid },
    select: {
      planningDatabaseSettingsJson: true,
      planningPostgresPasswordMasked: true,
      planningPostgresPassword: true,
    },
  });
  const fromSetup = parsePlanningDatabaseSettingsV1(setup?.planningDatabaseSettingsJson);
  const merged = fromSetup ?? fromState ?? defaultPlanningDatabaseSettingsV1();
  const hasPassword = Boolean(String(setup?.planningPostgresPassword ?? "").trim());
  return sanitizePlanningDatabaseSettingsForClient({
    ...merged,
    hasPassword,
    passwordMasked: hasPassword
      ? setup?.planningPostgresPasswordMasked || maskPasswordForStorage("")
      : null,
  });
}

export async function savePlanningDatabaseSettingsForProject(input: Readonly<{
  readonly projectId: string;
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password?: string | null;
}>): Promise<PlanningDatabaseSettingsV1> {
  const pid = input.projectId.trim();
  const settings = {
    ...input.settings,
    version: 1 as const,
    provider: "POSTGRESQL" as const,
    passwordMasked: undefined,
    hasPassword: undefined,
  };
  const passwordTrim = String(input.password ?? "").trim();
  const setupUpdate: {
    planningDatabaseSettingsJson: unknown;
    planningPostgresPassword?: string;
    planningPostgresPasswordMasked?: string;
  } = {
    planningDatabaseSettingsJson: settings,
  };
  if (passwordTrim) {
    setupUpdate.planningPostgresPassword = passwordTrim;
    setupUpdate.planningPostgresPasswordMasked = maskPasswordForStorage(passwordTrim);
  }

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: pid },
      select: { requirementsStateJson: true },
    });
    const base = parseRequirementsStateJson(project?.requirementsStateJson);
    const existingSetup = await tx.executionSetup.findUnique({ where: { projectId: pid } });
    const hasPassword = passwordTrim
      ? true
      : Boolean(existingSetup?.planningPostgresPassword?.trim()) ||
        Boolean(base.planningDatabaseSettingsV1?.hasPassword);
    const clientSettings: PlanningDatabaseSettingsV1 = {
      ...settings,
      hasPassword,
      passwordMasked: hasPassword ? "••••••••" : null,
    };
    await tx.project.update({
      where: { id: pid },
      data: {
        requirementsStateJson: mergeRequirementsStateJson(base, {
          planningDatabaseSettingsV1: clientSettings,
        }) as object,
      },
    });
    if (existingSetup) {
      await tx.executionSetup.update({
        where: { projectId: pid },
        data: setupUpdate,
      });
    }
  });

  return loadPlanningDatabaseSettingsForProject(pid);
}

export async function resolvePlanningPostgresPassword(projectId: string): Promise<string | null> {
  const row = await prisma.executionSetup.findUnique({
    where: { projectId: projectId.trim() },
    select: { planningPostgresPassword: true },
  });
  const p = String(row?.planningPostgresPassword ?? "").trim();
  return p || null;
}
