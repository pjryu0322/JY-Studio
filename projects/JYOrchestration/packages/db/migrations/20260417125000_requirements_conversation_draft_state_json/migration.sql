-- Add split requirements persistence columns (canonical DB source of truth).
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "requirementsConversationJson" JSONB,
  ADD COLUMN IF NOT EXISTS "requirementsDraftJson" JSONB,
  ADD COLUMN IF NOT EXISTS "requirementsStateJson" JSONB;

