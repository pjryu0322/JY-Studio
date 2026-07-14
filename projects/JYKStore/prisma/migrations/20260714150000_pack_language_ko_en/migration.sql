-- Provider-managed pack language (ko/en only). No backfill of existing rows.

CREATE TYPE "PackLanguage" AS ENUM ('KO', 'EN');

ALTER TABLE "KnowledgePackVersion"
  ADD COLUMN "language" "PackLanguage";
