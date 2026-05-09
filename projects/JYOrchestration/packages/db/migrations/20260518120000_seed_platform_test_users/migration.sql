-- 플랫폼 테스트 사용자 3명 (로그인 비밀번호 공통: TestPass123!)
-- bcrypt cost 10, 동일 해시 사용
INSERT INTO "users" ("id", "email", "passwordHash", "name", "createdAt", "updatedAt")
VALUES
  (
    'cmseedtestuser01bin',
    'webpio@hanmail.com',
    '$2b$10$KEYPylsihbfxTZ7c4OdIqu83YDY8QJ.YLiNK7wNOzQfjdaNNaFsOS',
    '이진영',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cmseedtestuser02phi',
    'itplace@naver.com',
    '$2b$10$KEYPylsihbfxTZ7c4OdIqu83YDY8QJ.YLiNK7wNOzQfjdaNNaFsOS',
    '이빌립',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'cmseedtestuser03hwa',
    'pjryu0322@gmail.com',
    '$2b$10$KEYPylsihbfxTZ7c4OdIqu83YDY8QJ.YLiNK7wNOzQfjdaNNaFsOS',
    '황재성',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("email") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "updatedAt" = CURRENT_TIMESTAMP;
