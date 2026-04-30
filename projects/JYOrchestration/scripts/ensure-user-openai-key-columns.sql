-- Prototype planner (user-level OpenAI key) columns.
-- Idempotent. Same Postgres as Next.js:
--   pnpm --filter web db:fix:user-openai-key-columns
--
-- Background:
-- `resolvePrototypePlannerOpenAiCredential` may read `User.defaultOpenaiApiKey`.
-- In some dev DBs the column is missing and Prisma throws P2022 (column does not exist).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultOpenaiApiKey" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultOpenaiApiKeyMasked" TEXT;

