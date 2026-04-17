/**
 * JYOrchestration 개발/테스트용 고정 데이터 시드 (idempotent).
 *
 * 실행 디렉터리: 저장소 루트 (projects/JYOrchestration)
 *   npm run seed:test
 *   npm run seed:test -- --with-actions
 *
 * DATABASE_URL은 .env(루트)에서 읽습니다.
 *
 * 프로젝트명·소유자 이메일·correlation 접두어는
 * apps/web/src/lib/dev/testSeedConstants.ts 와 맞출 것.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const BCRYPT_ROUNDS = 10;
const SEED_PASSWORD = "JyoTest!123";
const PROJECT_NAME = "Web Meeting MVP";
const PROJECT_DESCRIPTION = "웹 기반 화상회의 서비스 검증 프로젝트";
const PROJECT_TYPE = "web-service";
const SEED_CORRELATION_PREFIX = "jyo:test-seed:v1";

const USERS = [
  { email: "owner@jyo.local", name: "Owner Kim", projectRole: "OWNER" },
  { email: "editor@jyo.local", name: "Editor Lee", projectRole: "EDITOR" },
  { email: "reviewer@jyo.local", name: "Reviewer Park", projectRole: "REVIEWER" },
  { email: "viewer@jyo.local", name: "Viewer Choi", projectRole: "VIEWER" },
];

const AI_MEMBERS = [
  {
    displayName: "OpenAI Reviewer",
    role: "REVIEWER",
    aiProvider: "OPENAI",
    aiAgentKey: "openai-reviewer-01",
    aiOrchestrationRole: "reviewer",
    orchestrationStage: "execution-review",
  },
  {
    displayName: "Draft Assistant",
    role: "EDITOR",
    aiProvider: "INTERNAL",
    aiAgentKey: "draft-assistant-01",
  },
  {
    displayName: "QA Checker",
    role: "EDITOR",
    aiProvider: "INTERNAL",
    aiAgentKey: "qa-checker-01",
  },
];

/** 액션 유형 → 대상 AI 에이전트 키 */
const SEED_ACTIONS = [
  { actionType: "REVIEW_REQUEST", aiAgentKey: "openai-reviewer-01" },
  { actionType: "TASK_DRAFT_REQUEST", aiAgentKey: "draft-assistant-01" },
  { actionType: "QA_CHECK_REQUEST", aiAgentKey: "qa-checker-01" },
];

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function loadEnv() {
  const cwd = process.cwd();
  loadDotEnvFile(resolve(cwd, ".env"));
  loadDotEnvFile(resolve(cwd, "apps/web/.env.local"));
}

function parseArgs(argv) {
  const withActions =
    argv.includes("--with-actions") ||
    String(process.env.JYO_SEED_WITH_ACTIONS ?? "").toLowerCase() === "true" ||
    process.env.JYO_SEED_WITH_ACTIONS === "1";
  return { withActions };
}

function bump(stats, key, field) {
  stats[key][field] += 1;
}

async function ensureUser(prisma, stats, email, name, passwordHash) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    bump(stats, "users", "skipped");
    return existing;
  }
  const created = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      globalRole: "USER",
    },
  });
  bump(stats, "users", "created");
  return created;
}

async function ensureProject(prisma, stats, ownerUserId) {
  /** 전체 스칼라를 읽으면 DB에 아직 없는 컬럼이 있을 때 P2022가 납니다. 시드는 id만 필요합니다. */
  const existing = await prisma.project.findFirst({
    where: { name: PROJECT_NAME, ownerUserId },
    select: { id: true },
  });
  if (existing) {
    bump(stats, "project", "skipped");
    return existing;
  }
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name: PROJECT_NAME,
        description: PROJECT_DESCRIPTION,
        ownerUserId,
        projectType: PROJECT_TYPE,
        repoUrl: null,
        defaultBranch: "main",
        status: "ACTIVE",
      },
    });
    await tx.projectMember.create({
      data: {
        projectId: p.id,
        userId: ownerUserId,
        role: "OWNER",
        memberType: "HUMAN",
        invitedByUserId: null,
      },
    });
    bump(stats, "humanMembers", "created");
    return p;
  });
  bump(stats, "project", "created");
  return project;
}

async function ensureHumanMember(prisma, stats, projectId, userId, role, invitedByUserId) {
  const existing = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true, role: true },
  });
  if (existing) {
    if (existing.role !== role) {
      await prisma.projectMember.update({
        where: { id: existing.id },
        data: { role },
      });
    }
    bump(stats, "humanMembers", "skipped");
    return existing;
  }
  await prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role,
      memberType: "HUMAN",
      invitedByUserId,
    },
  });
  bump(stats, "humanMembers", "created");
}

async function ensureAiMember(prisma, stats, projectId, spec, invitedByUserId) {
  const existing = await prisma.projectMember.findFirst({
    where: {
      projectId,
      memberType: "AI",
      aiAgentKey: spec.aiAgentKey,
    },
    select: {
      id: true,
      displayName: true,
      aiProvider: true,
      role: true,
      aiOrchestrationRole: true,
      orchestrationStage: true,
    },
  });
  const orchRole = spec.aiOrchestrationRole ?? null;
  const orchStage = spec.orchestrationStage ?? null;
  if (existing) {
    if (
      existing.displayName !== spec.displayName ||
      existing.aiProvider !== spec.aiProvider ||
      existing.role !== spec.role ||
      (existing.aiOrchestrationRole ?? null) !== orchRole ||
      (existing.orchestrationStage ?? null) !== orchStage
    ) {
      await prisma.projectMember.update({
        where: { id: existing.id },
        data: {
          displayName: spec.displayName,
          aiProvider: spec.aiProvider,
          role: spec.role,
          aiOrchestrationRole: orchRole,
          orchestrationStage: orchStage,
        },
      });
    }
    bump(stats, "aiMembers", "skipped");
    return existing;
  }
  const created = await prisma.projectMember.create({
    data: {
      projectId,
      userId: null,
      memberType: "AI",
      displayName: spec.displayName,
      aiProvider: spec.aiProvider,
      aiAgentKey: spec.aiAgentKey,
      role: spec.role,
      invitedByUserId,
      aiOrchestrationRole: orchRole,
      orchestrationStage: orchStage,
    },
  });
  bump(stats, "aiMembers", "created");
  return created;
}

async function ensureSeedAction(prisma, stats, projectId, ownerUserId, aiByKey, spec) {
  const correlationKey = `${SEED_CORRELATION_PREFIX}:${spec.actionType}`;
  const existing = await prisma.projectMemberAction.findFirst({
    where: { projectId, correlationKey },
    select: { id: true },
  });
  if (existing) {
    bump(stats, "aiActions", "skipped");
    return existing;
  }
  const pm = aiByKey.get(spec.aiAgentKey);
  if (!pm) {
    console.warn(`[seed] AI 멤버 없음 (${spec.aiAgentKey}), 액션 생략: ${spec.actionType}`);
    bump(stats, "aiActions", "skipped");
    return null;
  }
  const row = await prisma.projectMemberAction.create({
    data: {
      projectId,
      projectMemberId: pm.id,
      actionType: spec.actionType,
      status: "REQUESTED",
      requestedByUserId: ownerUserId,
      executionMode: "STUB",
      correlationKey,
      requestPayload: { source: "jyo-test-seed", actionType: spec.actionType },
      resolvedApprovalMode: "AUTO_APPROVE",
      resolvedApplyMode: "MANUAL_APPLY",
    },
  });
  bump(stats, "aiActions", "created");
  return row;
}

async function main() {
  loadEnv();
  const { withActions } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error(
      "[seed] DATABASE_URL이 없습니다. JYOrchestration 루트의 .env(또는 apps/web/.env.local)를 확인하세요."
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const stats = {
    users: { created: 0, skipped: 0 },
    project: { created: 0, skipped: 0 },
    humanMembers: { created: 0, skipped: 0 },
    aiMembers: { created: 0, skipped: 0 },
    aiActions: { created: 0, skipped: 0 },
  };

  try {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);
    const userByEmail = new Map();

    for (const u of USERS) {
      const row = await ensureUser(prisma, stats, u.email, u.name, passwordHash);
      userByEmail.set(u.email, row);
    }

    const owner = userByEmail.get("owner@jyo.local");
    if (!owner) {
      throw new Error("owner@jyo.local 사용자를 만들 수 없습니다.");
    }

    const project = await ensureProject(prisma, stats, owner.id);

    const ownerMember = await prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: owner.id },
      select: { id: true },
    });
    if (!ownerMember) {
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: owner.id,
          role: "OWNER",
          memberType: "HUMAN",
        },
      });
      bump(stats, "humanMembers", "created");
    }

    for (const u of USERS) {
      if (u.projectRole === "OWNER") continue;
      const userRow = userByEmail.get(u.email);
      await ensureHumanMember(
        prisma,
        stats,
        project.id,
        userRow.id,
        u.projectRole,
        owner.id
      );
    }

    for (const spec of AI_MEMBERS) {
      await ensureAiMember(prisma, stats, project.id, spec, owner.id);
    }

    const aiRows = await prisma.projectMember.findMany({
      where: { projectId: project.id, memberType: "AI" },
      select: { id: true, aiAgentKey: true },
    });
    const aiByKey = new Map(aiRows.map((r) => [r.aiAgentKey, r]));

    if (withActions) {
      for (const spec of SEED_ACTIONS) {
        await ensureSeedAction(prisma, stats, project.id, owner.id, aiByKey, spec);
      }
    }

    const actionRows = await prisma.projectMemberAction.findMany({
      where: { projectId: project.id, correlationKey: { startsWith: SEED_CORRELATION_PREFIX } },
      select: { id: true, actionType: true, correlationKey: true },
      orderBy: { actionType: "asc" },
    });

    console.log("\n=== JYOrchestration test seed 요약 ===\n");
    console.log(
      `users:        created=${stats.users.created} skipped=${stats.users.skipped}`
    );
    console.log(
      `project:      created=${stats.project.created} skipped=${stats.project.skipped}`
    );
    console.log(
      `humanMembers: created=${stats.humanMembers.created} skipped=${stats.humanMembers.skipped}`
    );
    console.log(
      `aiMembers:    created=${stats.aiMembers.created} skipped=${stats.aiMembers.skipped}`
    );
    console.log(
      `aiActions:    created=${stats.aiActions.created} skipped=${stats.aiActions.skipped} (withActions=${withActions})`
    );
    console.log("\n--- 점검용 ID ---");
    console.log(`projectId:     ${project.id}`);
    console.log(`ownerUserId:   ${owner.id}`);
    console.log(`editorUserId:  ${userByEmail.get("editor@jyo.local")?.id ?? "—"}`);
    for (const m of AI_MEMBERS) {
      const row = aiByKey.get(m.aiAgentKey);
      console.log(`ai ${m.aiAgentKey}: ${row?.id ?? "—"}`);
    }
    if (actionRows.length) {
      console.log("sample actions:");
      for (const a of actionRows) {
        console.log(`  ${a.actionType}  ${a.id}`);
      }
    }
    console.log("\n비밀번호(공통): JyoTest!123\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed] 실패:", e);
  process.exit(1);
});
