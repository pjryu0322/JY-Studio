import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Prisma 클라이언트가 아직 `passwordResetToken` 델리게이트 없이 생성된 경우에도 동작하도록 Raw SQL 사용 */

export async function sqlReplacePasswordResetTokenForUser(input: {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}): Promise<void> {
  const id = randomBytes(16).toString("hex");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "password_reset_tokens"
      SET "usedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${input.userId} AND "usedAt" IS NULL
    `;
    await tx.$executeRaw`
      INSERT INTO "password_reset_tokens" ("id", "userId", "tokenHash", "expiresAt", "createdAt")
      VALUES (${id}, ${input.userId}, ${input.tokenHash}, ${input.expiresAt}, CURRENT_TIMESTAMP)
    `;
  });
}

export type ActivePasswordResetRow = { readonly id: string; readonly userId: string };

export async function sqlFindActivePasswordResetByTokenHash(tokenHash: string): Promise<ActivePasswordResetRow | null> {
  const rows = await prisma.$queryRaw<ActivePasswordResetRow[]>`
    SELECT id, "userId"
    FROM "password_reset_tokens"
    WHERE "tokenHash" = ${tokenHash}
      AND "usedAt" IS NULL
      AND "expiresAt" > CURRENT_TIMESTAMP
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function sqlCompletePasswordReset(input: {
  readonly rowId: string;
  readonly userId: string;
  readonly passwordHash: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { passwordHash: input.passwordHash },
    });
    await tx.$executeRaw`
      UPDATE "password_reset_tokens"
      SET "usedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.rowId}
    `;
    await tx.$executeRaw`
      UPDATE "password_reset_tokens"
      SET "usedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${input.userId} AND "usedAt" IS NULL AND "id" <> ${input.rowId}
    `;
  });
}
