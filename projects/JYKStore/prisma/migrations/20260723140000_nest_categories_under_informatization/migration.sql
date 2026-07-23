-- Nest existing leaf categories under the new root "정보화지식" (informatization).

INSERT INTO "PackCategory" (
  "id",
  "categoryId",
  "name",
  "description",
  "icon",
  "parentCategoryId",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'cm_informatization_root_001',
  'informatization',
  '정보화지식',
  '정보화·IT 관련 지식팩을 분야별로 모아 둔 상위 카테고리입니다.',
  E'\U0001F5C2\uFE0F',
  NULL,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "PackCategory" WHERE "categoryId" = 'informatization'
);

UPDATE "PackCategory"
SET
  "parentCategoryId" = 'informatization',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "categoryId" <> 'informatization'
  AND "parentCategoryId" IS NULL;