-- 다중 작업메모 + 제목: stageKey 유니크 제거, title 추가
ALTER TABLE "work_notes" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';

UPDATE "work_notes" SET "title" = CASE "stageKey"
  WHEN 'GLOBAL' THEN '프로젝트 메모'
  WHEN 'IDEATION' THEN '아이디어 구체화'
  WHEN 'SERVICE_FLOW' THEN '액터 및 서비스 흐름 정의'
  WHEN 'FEATURES' THEN '기능 정리'
  WHEN 'TASKS' THEN '작업 정리'
  WHEN 'PLANNING' THEN '실행 계획·Spec'
  WHEN 'PROTOTYPE_BUILD' THEN '프로토타입 생성'
  WHEN 'PROTOTYPE_REVIEW' THEN '프로토타입 검토'
  WHEN 'TRACE' THEN '추적'
  ELSE COALESCE(NULLIF(TRIM("stageKey"), ''), '메모')
END
WHERE COALESCE(TRIM("title"), '') = '';

DROP INDEX IF EXISTS "work_notes_projectId_userId_stageKey_key";
DROP INDEX IF EXISTS "work_notes_projectId_userId_stageKey_idx";

ALTER TABLE "work_notes" DROP COLUMN IF EXISTS "stageKey";

CREATE INDEX IF NOT EXISTS "work_notes_projectId_userId_idx" ON "work_notes"("projectId", "userId");
