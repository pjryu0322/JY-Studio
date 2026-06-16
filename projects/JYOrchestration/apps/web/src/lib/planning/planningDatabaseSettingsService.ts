import { prisma } from "@/lib/prisma";
import {
  defaultPlanningDatabaseSettingsV1,
  parsePlanningDatabaseSettingsV1,
  sanitizePlanningDatabaseSettingsForClient,
  type PlanningDatabaseSettingsV1,
} from "@/lib/planning/planningDatabaseSettingsV1";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function maskPasswordForStorage(_password: string): string {
  return "••••••••";
}

function executionSetupCreateDefaults(projectId: string) {
  return {
    projectId,
    gitRepoUrl: "",
    gitRepoProvider: "github",
    gitRepoName: null as string | null,
    baseBranch: "main",
    branchStrategy: "feature-per-task",
    branchPrefix: null as string | null,
    cursorApiUrl: "https://api.cursor.com",
    workspacePath: "",
    projectRootPath: "",
    repoValidationCommands: [] as string[],
    allowedPathGlobs: [] as string[],
    autoCommit: true,
    autoPush: false,
    autoPr: false,
    requireApprovalBeforeApply: true,
    requireTestsBeforePush: true,
    dryRunAllowed: true,
    autoAdvanceToNextTask: true,
    maxAutoRetriesPerTask: 2,
    stopOnTestFailure: true,
    stopOnRepeatedFailure: true,
    stopOnOutOfScopeChange: true,
    requireApprovalForSensitiveTasks: false,
    status: "draft",
  };
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
      gitRepoName: true,
    },
  });
  const fromSetup = parsePlanningDatabaseSettingsV1(setup?.planningDatabaseSettingsJson);
  const merged = fromSetup ?? fromState ?? defaultPlanningDatabaseSettingsV1();
  const hasPassword = Boolean(String(setup?.planningPostgresPassword ?? "").trim());
  const withNames = syncPlanningDatabaseSettingsStoreNames({
    settings: merged,
    gitRepoName: setup?.gitRepoName,
    projectId: pid,
    preserveManualStoreName: Boolean(merged.databaseStoreName?.trim()),
  });
  return sanitizePlanningDatabaseSettingsForClient({
    ...withNames,
    hasPassword,
    passwordMasked: hasPassword ? setup?.planningPostgresPasswordMasked || maskPasswordForStorage("") : null,
  });
}

export async function savePlanningDatabaseSettingsForProject(input: Readonly<{
  readonly projectId: string;
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password?: string | null;
  readonly gitRepoName?: string | null;
}>): Promise<PlanningDatabaseSettingsV1> {
  const pid = input.projectId.trim();
  const synced = syncPlanningDatabaseSettingsStoreNames({
    settings: input.settings,
    gitRepoName: input.gitRepoName,
    projectId: pid,
    preserveManualStoreName: true,
  });
  const settings = {
    ...synced,
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
    await tx.executionSetup.upsert({
      where: { projectId: pid },
      create: {
        ...executionSetupCreateDefaults(pid),
        ...setupUpdate,
      },
      update: setupUpdate,
    });
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
