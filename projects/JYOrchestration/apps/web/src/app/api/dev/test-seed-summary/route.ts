import { NextResponse } from "next/server";
import {
  TEST_SEED_CORRELATION_PREFIX,
  TEST_SEED_OWNER_EMAIL,
  TEST_SEED_PROJECT_NAME,
} from "@/lib/dev/testSeedConstants";
import { prisma } from "@/lib/prisma";

/**
 * 개발/테스트 환경에서만: 시드로 만든 프로젝트·계정·샘플 액션 ID 요약.
 * 운영에서는 항상 404 (라우트 자체가 빌드에 포함되더라도 응답 없음).
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }
  if (process.env.ENABLE_DEV_TEST_SEED_API !== "true" && process.env.ENABLE_DEV_TEST_SEED_API !== "1") {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { email: TEST_SEED_OWNER_EMAIL },
      select: { id: true, email: true, name: true },
    });
    if (!owner) {
      return NextResponse.json({
        success: true,
        data: {
          seeded: false,
          hint: "npm run seed:test 를 먼저 실행하세요.",
        },
      });
    }

    const project = await prisma.project.findFirst({
      where: { name: TEST_SEED_PROJECT_NAME, ownerUserId: owner.id },
      select: { id: true, name: true, description: true },
    });

    const humanMembers = project
      ? await prisma.projectMember.findMany({
          where: { projectId: project.id, memberType: "HUMAN" },
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { role: "asc" },
        })
      : [];

    const aiMembers = project
      ? await prisma.projectMember.findMany({
          where: { projectId: project.id, memberType: "AI" },
          orderBy: { aiAgentKey: "asc" },
        })
      : [];

    const sampleActions = project
      ? await prisma.projectMemberAction.findMany({
          where: {
            projectId: project.id,
            correlationKey: { startsWith: TEST_SEED_CORRELATION_PREFIX },
          },
          select: { id: true, actionType: true, correlationKey: true, status: true },
          orderBy: { actionType: "asc" },
        })
      : [];

    return NextResponse.json({
      success: true,
      data: {
        seeded: Boolean(project),
        project,
        ownerUser: owner,
        humanMembers: humanMembers.map((m) => ({
          id: m.id,
          role: m.role,
          userId: m.userId,
          email: m.user?.email ?? null,
          name: m.user?.name ?? null,
        })),
        aiMembers: aiMembers.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          role: m.role,
          aiProvider: m.aiProvider,
          aiAgentKey: m.aiAgentKey,
        })),
        sampleActions,
      },
    });
  } catch (e) {
    console.error("GET /api/dev/test-seed-summary error:", e);
    return NextResponse.json(
      { success: false, message: "요약 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
