import { NextRequest, NextResponse } from "next/server";
import { hasEffectivePlatformAdminAccess, isSuperAdminUser, normalizePlatformRole } from "@/lib/admin/platformAdmin";
import { getSessionUserIdFromRequest } from "@/lib/auth/requestUser";
import { prisma } from "@/lib/prisma";
import { findUserForSessionOrMe } from "@/lib/prisma/userPlatformFieldsCompat";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

export async function GET(request: NextRequest) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ success: true, data: null });
  }

  const user = await findUserForSessionOrMe(userId);
  if (!user) {
    return NextResponse.json({ success: true, data: null });
  }

  const humanProjectCount = await prisma.projectMember.count({
    where: { userId, memberType: "HUMAN" },
  });

  const hasDefaultOpenaiApiKey = Boolean(String(user.defaultOpenaiApiKey ?? "").trim());
  const platformRole = normalizePlatformRole(user.globalRole);
  const displayName = platformUserDisplayName(user.nickname, user.name);

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      displayName,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      platformRole,
      createdAt: user.createdAt.toISOString(),
      isPlatformAdmin: hasEffectivePlatformAdminAccess(user.globalRole, user.email),
      isSuperAdmin: isSuperAdminUser(user.globalRole),
      accountStatus: user.accountStatus,
      planTier: user.planTier,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      defaultOpenaiApiKeyMasked: user.defaultOpenaiApiKeyMasked,
      hasDefaultOpenaiApiKey,
      humanProjectCount,
    },
  });
}
