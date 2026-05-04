import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { getUserAvatarUrlForMutation, isPrismaPlatformUserColumnMismatch } from "@/lib/prisma/userPlatformFieldsCompat";
import { deleteUserAvatarFileIfOwned, writeUserAvatarFromUpload } from "@/lib/user/userAvatarStorage";

const AVATAR_SCHEMA_UNAVAILABLE_MESSAGE =
  "프로필 사진 필드를 사용할 수 없습니다. 개발 서버를 잠시 중지한 뒤 프로젝트 루트에서 `pnpm run db:generate`(apps/web)을 실행하고, DB에는 `pnpm run db:migrate`로 마이그레이션을 적용한 다음 다시 시도하세요.";

/**
 * 프로필 사진 업로드(multipart `file`). 본인만 POST.
 */
export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const avatarSupport = await getUserAvatarUrlForMutation(userId);
  if (!avatarSupport.supported) {
    return NextResponse.json({ success: false, message: AVATAR_SCHEMA_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: "multipart 요청이 필요합니다." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: "file 필드에 이미지를 넣어 주세요." }, { status: 400 });
  }

  const written = await writeUserAvatarFromUpload(userId, file);
  if ("error" in written) {
    return NextResponse.json({ success: false, message: written.error }, { status: 400 });
  }

  const prevUrl = avatarSupport.url;
  if (prevUrl && prevUrl !== written.publicPath) {
    await deleteUserAvatarFileIfOwned(userId, prevUrl);
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: written.publicPath },
    });
  } catch (e) {
    if (isPrismaPlatformUserColumnMismatch(e)) {
      return NextResponse.json(
        { success: false, message: "DB 스키마가 맞지 않습니다. 마이그레이션을 적용한 뒤 다시 시도하세요." },
        { status: 503 }
      );
    }
    throw e;
  }

  return NextResponse.json({
    success: true,
    message: "프로필 사진을 저장했습니다.",
    data: { avatarUrl: written.publicPath },
  });
}

/** 프로필 사진 삭제. 본인만 DELETE. */
export async function DELETE(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const avatarSupport = await getUserAvatarUrlForMutation(userId);
  if (!avatarSupport.supported) {
    return NextResponse.json({ success: false, message: AVATAR_SCHEMA_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
  } catch (e) {
    if (isPrismaPlatformUserColumnMismatch(e)) {
      return NextResponse.json(
        { success: false, message: "DB 스키마가 맞지 않습니다. 마이그레이션을 적용한 뒤 다시 시도하세요." },
        { status: 503 }
      );
    }
    throw e;
  }

  await deleteUserAvatarFileIfOwned(userId, avatarSupport.url);

  return NextResponse.json({ success: true, message: "프로필 사진을 삭제했습니다.", data: { avatarUrl: null } });
}