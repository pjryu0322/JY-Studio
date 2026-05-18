-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('SOLO', 'DIRECT', 'GROUP', 'PROJECT');

-- CreateEnum
CREATE TYPE "ChatRoomMemberKind" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "ChatMessageSenderKind" AS ENUM ('USER', 'AI', 'SYSTEM');

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ChatRoomType" NOT NULL DEFAULT 'SOLO',
    "ownerUserId" TEXT NOT NULL,
    "projectId" TEXT,
    "lastMessagePreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_room_members" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "memberType" "ChatRoomMemberKind" NOT NULL,
    "userId" TEXT,
    "aiMemberId" TEXT,
    "displayName" TEXT NOT NULL,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "projectId" TEXT,
    "senderType" "ChatMessageSenderKind" NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_from_chat_drafts" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_from_chat_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_rooms_ownerUserId_updatedAt_idx" ON "chat_rooms"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "chat_rooms_projectId_idx" ON "chat_rooms"("projectId");

-- CreateIndex
CREATE INDEX "chat_room_members_chatRoomId_idx" ON "chat_room_members"("chatRoomId");

-- CreateIndex
CREATE INDEX "chat_room_members_userId_idx" ON "chat_room_members"("userId");

-- CreateIndex
CREATE INDEX "chat_messages_chatRoomId_createdAt_idx" ON "chat_messages"("chatRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "project_from_chat_drafts_chatRoomId_status_idx" ON "project_from_chat_drafts"("chatRoomId", "status");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_from_chat_drafts" ADD CONSTRAINT "project_from_chat_drafts_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
