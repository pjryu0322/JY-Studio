-- CreateEnum
CREATE TYPE "MessengerAiParticipationMode" AS ENUM ('NONE', 'AUTO', 'MENTION_ONLY');

-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN "aiParticipationMode" "MessengerAiParticipationMode" NOT NULL DEFAULT 'AUTO';

-- Legacy: SOLO rooms that already had an AI member behave like DIRECT + AUTO
UPDATE "chat_rooms" AS cr
SET "type" = 'DIRECT'
WHERE cr."type" = 'SOLO'
  AND EXISTS (
    SELECT 1
    FROM "chat_room_members" AS m
    WHERE m."chatRoomId" = cr."id"
      AND m."memberType" = 'AI'
  );
