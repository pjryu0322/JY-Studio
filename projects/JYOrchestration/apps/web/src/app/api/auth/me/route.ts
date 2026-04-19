import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdminUser } from "@/lib/admin/platformAdmin";
import { getSessionUserIdFromRequest } from "@/lib/auth/requestUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ success: true, data: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, globalRole: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ success: true, data: null });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      createdAt: user.createdAt.toISOString(),
      isPlatformAdmin: isPlatformAdminUser(user.globalRole, user.email),
    },
  });
}
