CREATE TABLE IF NOT EXISTS "project_structure_candidates" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'CANDIDATE',
  "sourceEventId" TEXT,
  "fingerprint" TEXT,
  "metadata" JSONB,
  "approvedGraphNodeId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_structure_candidates_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_structure_candidates_project_idempotency_key"
  ON "project_structure_candidates" ("projectId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "project_structure_candidates_project_lifecycle_idx"
  ON "project_structure_candidates" ("projectId", "lifecycleStatus");

CREATE INDEX IF NOT EXISTS "project_structure_candidates_project_nodeType_idx"
  ON "project_structure_candidates" ("projectId", "nodeType");

CREATE INDEX IF NOT EXISTS "project_structure_candidates_project_fingerprint_idx"
  ON "project_structure_candidates" ("projectId", "fingerprint");

CREATE INDEX IF NOT EXISTS "project_structure_candidates_sourceEventId_idx"
  ON "project_structure_candidates" ("sourceEventId");

CREATE TABLE IF NOT EXISTS "project_structure_candidate_edges" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "fromCandidateId" TEXT NOT NULL,
  "toCandidateId" TEXT NOT NULL,
  "edgeType" TEXT NOT NULL,
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'CANDIDATE',
  "sourceEventId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_structure_candidate_edges_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_structure_candidate_edges_fromCandidateId_fkey"
    FOREIGN KEY ("fromCandidateId") REFERENCES "project_structure_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_structure_candidate_edges_toCandidateId_fkey"
    FOREIGN KEY ("toCandidateId") REFERENCES "project_structure_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_structure_candidate_edges_project_idempotency_key"
  ON "project_structure_candidate_edges" ("projectId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "project_structure_candidate_edges_project_edgeType_idx"
  ON "project_structure_candidate_edges" ("projectId", "edgeType");

CREATE INDEX IF NOT EXISTS "project_structure_candidate_edges_fromCandidateId_idx"
  ON "project_structure_candidate_edges" ("fromCandidateId");

CREATE INDEX IF NOT EXISTS "project_structure_candidate_edges_toCandidateId_idx"
  ON "project_structure_candidate_edges" ("toCandidateId");

CREATE TABLE IF NOT EXISTS "project_node_lifecycle" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorId" TEXT,
  "reason" TEXT,
  "audit" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_node_lifecycle_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_node_lifecycle_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "project_structure_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_node_lifecycle_project_candidate_createdAt_idx"
  ON "project_node_lifecycle" ("projectId", "candidateId", "createdAt");

CREATE TABLE IF NOT EXISTS "project_merge_history" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "sourceCandidateId" TEXT NOT NULL,
  "targetCandidateId" TEXT NOT NULL,
  "mergedByUserId" TEXT,
  "mergeSummary" TEXT,
  "audit" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_merge_history_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_merge_history_project_createdAt_idx"
  ON "project_merge_history" ("projectId", "createdAt");

CREATE INDEX IF NOT EXISTS "project_merge_history_sourceCandidateId_idx"
  ON "project_merge_history" ("sourceCandidateId");

CREATE INDEX IF NOT EXISTS "project_merge_history_targetCandidateId_idx"
  ON "project_merge_history" ("targetCandidateId");
