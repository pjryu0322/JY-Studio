-- 플랫폼 계정 필드(프로젝트 멤버와 별개)
CREATE TYPE "PlatformAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "users" ADD COLUMN "accountStatus" "PlatformAccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "planTier" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
