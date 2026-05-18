-- CreateEnum
CREATE TYPE "ProjectMemberInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "project_member_invites" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL,
    "status" "ProjectMemberInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "project_member_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "inviteId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_member_invites_projectId_inviteeUserId_key" ON "project_member_invites"("projectId", "inviteeUserId");

-- CreateIndex
CREATE INDEX "project_member_invites_inviteeUserId_status_idx" ON "project_member_invites"("inviteeUserId", "status");

-- CreateIndex
CREATE INDEX "platform_notifications_userId_readAt_idx" ON "platform_notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "platform_notifications_userId_inviteId_idx" ON "platform_notifications"("userId", "inviteId");

-- AddForeignKey
ALTER TABLE "project_member_invites" ADD CONSTRAINT "project_member_invites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member_invites" ADD CONSTRAINT "project_member_invites_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member_invites" ADD CONSTRAINT "project_member_invites_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_notifications" ADD CONSTRAINT "platform_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
