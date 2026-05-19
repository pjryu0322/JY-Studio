-- CreateEnum
CREATE TYPE "ChatRoomMemberInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "platform_user_friends" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_user_friends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_room_member_invites" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status" "ChatRoomMemberInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "chat_room_member_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_user_friends_friendUserId_idx" ON "platform_user_friends"("friendUserId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_friends_userId_friendUserId_key" ON "platform_user_friends"("userId", "friendUserId");

-- CreateIndex
CREATE INDEX "chat_room_member_invites_inviteeUserId_status_idx" ON "chat_room_member_invites"("inviteeUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "chat_room_member_invites_chatRoomId_inviteeUserId_key" ON "chat_room_member_invites"("chatRoomId", "inviteeUserId");

-- AddForeignKey
ALTER TABLE "platform_user_friends" ADD CONSTRAINT "platform_user_friends_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_friends" ADD CONSTRAINT "platform_user_friends_friendUserId_fkey" FOREIGN KEY ("friendUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_member_invites" ADD CONSTRAINT "chat_room_member_invites_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_member_invites" ADD CONSTRAINT "chat_room_member_invites_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_member_invites" ADD CONSTRAINT "chat_room_member_invites_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
