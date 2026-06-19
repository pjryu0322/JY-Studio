import { prisma } from "@/lib/prisma";
import {
  defaultPlanningDatabaseSettingsV1,
  parsePlanningDatabaseSettingsV1,
  sanitizePlanningDatabaseSettingsForClient,
  type PlanningDatabaseSettingsV1,
} from "@/lib/planning/planningDatabaseSettingsV1";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import {
  isDatabaseUsageEnabledMode,
  normalizePlanningDatabaseSettingsUsageOnSave,
  resolveDatabaseUsageMode,
} from "@/lib/planning/planningDatabaseUsageMode";
import { projectDatabaseSaveOutcomeMessage } from "@/lib/planning/projectDatabaseUserDisplay";
import type { SavePlanningDatabaseUsageSettingsResult } from "@/lib/planning/savePlanningDatabaseSettingsTypes";
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
    preserveManualStoreName: false,
  });
  return sanitizePlanningDatabaseSettingsForClient({
    ...withNames,
    hasPassword,
    passwordMasked: hasPassword ? setup?.planningPostgresPasswordMasked || maskPasswordForStorage("") : null,
  });
}

/** Server-side load including platform-managed connection fields (not for client). */
export async function loadPlanningDatabaseSettingsRawForProject(
  projectId: string,
): Promise<PlanningDatabaseSettingsV1> {
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
      gitRepoName: true,
    },
  });
  const fromSetup = parsePlanningDatabaseSettingsV1(setup?.planningDatabaseSettingsJson);
  const merged = fromSetup ?? fromState ?? defaultPlanningDatabaseSettingsV1();
  return syncPlanningDatabaseSettingsStoreNames({
    settings: merged,
    gitRepoName: setup?.gitRepoName,
    projectId: pid,
    preserveManualStoreName: false,
  });
}

export async function savePlanningDatabaseSettingsForProject(input: Readonly<{
  readonly projectId: string;
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password?: string | null;
  readonly gitRepoName?: string | null;
  readonly skipProjectDatabaseProvisioning?: boolean;
}>): Promise<SavePlanningDatabaseUsageSettingsResult> {
  const pid = input.projectId.trim();
  let synced = syncPlanningDatabaseSettingsStoreNames({
    settings: normalizePlanningDatabaseSettingsUsageOnSave(input.settings),
    gitRepoName: input.gitRepoName,
    projectId: pid,
    preserveManualStoreName: false,
  });
  const usage = resolveDatabaseUsageMode(synced);
  const passwordTrim = String(input.password ?? "").trim();

  async function persistToDb(toPersist: PlanningDatabaseSettingsV1): Promise<void> {
    const settings = {
      ...toPersist,
      version: 1 as const,
      provider: "POSTGRESQL" as const,
      passwordMasked: undefined,
      hasPassword: undefined,
    };
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
  }

  if (usage === "DISABLED_JSON_SAMPLE" || resolveDatabaseUsageMode(synced) === "DISABLED_JSON_SAMPLE") {
    synced = {
      ...synced,
      projectDbStatus: "NOT_REQUIRED",
      connectionStatus: "NOT_REQUIRED",
      lastErrorMessage: null,
    };
    await persistToDb(synced);
    const settings = await loadPlanningDatabaseSettingsForProject(pid);
    return {
      settings,
      saved: true,
      message: projectDatabaseSaveOutcomeMessage(settings),
      projectDbStatus: "NOT_REQUIRED",
    };
  }

  if (isDatabaseUsageEnabledMode(usage)) {
    synced = {
      ...synced,
      projectDbStatus: synced.projectDbStatus === "CREATED" ? "CREATED" : "PLANNED",
      connectionStatus: "NOT_CONFIGURED",
      projectDbFailureReason: null,
      lastErrorMessage: null,
    };
    await persistToDb(synced);
  } else {
    await persistToDb(synced);
  }

  const settings = await loadPlanningDatabaseSettingsForProject(pid);
  return {
    settings,
    saved: true,
    message: projectDatabaseSaveOutcomeMessage(settings),
    projectDbStatus: settings.projectDbStatus,
  };
}

export async function resolvePlanningPostgresPassword(projectId: string): Promise<string | null> {
  const pid = projectId.trim();
  const stored = await loadPlanningDatabaseSettingsRawForProject(pid);
  const { resolvePlanningPostgresPasswordForProject } = await import(
    "@/lib/planning/resolvePlanningPostgresConnection.server"
  );
  const row = await prisma.executionSetup.findUnique({
    where: { projectId: pid },
    select: { planningPostgresPassword: true },
  });
  return resolvePlanningPostgresPasswordForProject(
    pid,
    stored,
    String(row?.planningPostgresPassword ?? "").trim() || null,
  );
}
