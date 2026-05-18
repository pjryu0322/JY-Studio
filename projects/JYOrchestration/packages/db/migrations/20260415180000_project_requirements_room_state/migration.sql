-- 요구사항 협의실 상태(채팅·회의록 등)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "requirementsRoomState" JSONB;
