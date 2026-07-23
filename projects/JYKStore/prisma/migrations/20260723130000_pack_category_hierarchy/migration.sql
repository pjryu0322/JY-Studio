-- PackCategory parent/child hierarchy + sort order
ALTER TABLE "PackCategory" ADD COLUMN "parentCategoryId" TEXT;
ALTER TABLE "PackCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "PackCategory_parentCategoryId_idx" ON "PackCategory"("parentCategoryId");
CREATE INDEX "PackCategory_sortOrder_idx" ON "PackCategory"("sortOrder");

ALTER TABLE "PackCategory"
  ADD CONSTRAINT "PackCategory_parentCategoryId_fkey"
  FOREIGN KEY ("parentCategoryId") REFERENCES "PackCategory"("categoryId")
  ON DELETE RESTRICT ON UPDATE CASCADE;