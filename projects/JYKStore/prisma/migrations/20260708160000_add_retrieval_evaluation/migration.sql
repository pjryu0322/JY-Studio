-- CreateTable
CREATE TABLE "RetrievalEvaluationSet" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetrievalEvaluationSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalEvaluationCase" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'both',
    "topK" INTEGER NOT NULL DEFAULT 5,
    "expectedChunkIds" TEXT[],
    "expectedSourceDocumentIds" TEXT[],
    "expectedSections" TEXT[],
    "expectedTags" TEXT[],
    "expectedMetadata" JSONB,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetrievalEvaluationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalEvaluationRun" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retrievalMode" TEXT NOT NULL,
    "totalCaseCount" INTEGER NOT NULL DEFAULT 0,
    "evaluatedCaseCount" INTEGER NOT NULL DEFAULT 0,
    "passCaseCount" INTEGER NOT NULL DEFAULT 0,
    "warningCaseCount" INTEGER NOT NULL DEFAULT 0,
    "failCaseCount" INTEGER NOT NULL DEFAULT 0,
    "hitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meanReciprocalRank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageTopRank" DOUBLE PRECISION,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "blockingIssueCount" INTEGER NOT NULL DEFAULT 0,
    "warningIssueCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL DEFAULT 'SYSTEM_RULE',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalEvaluationResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "retrievalMode" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "topK" INTEGER NOT NULL,
    "hit" BOOLEAN NOT NULL DEFAULT false,
    "firstHitRank" INTEGER,
    "reciprocalRank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchedChunkIds" TEXT[],
    "matchedSourceIds" TEXT[],
    "returnedChunkIds" TEXT[],
    "returnedSourceIds" TEXT[],
    "issueCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalEvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalEvaluationIssue" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalEvaluationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetrievalEvaluationSet_packId_idx" ON "RetrievalEvaluationSet"("packId");
CREATE INDEX "RetrievalEvaluationSet_versionId_idx" ON "RetrievalEvaluationSet"("versionId");
CREATE INDEX "RetrievalEvaluationSet_status_idx" ON "RetrievalEvaluationSet"("status");

CREATE INDEX "RetrievalEvaluationCase_setId_idx" ON "RetrievalEvaluationCase"("setId");
CREATE INDEX "RetrievalEvaluationCase_packId_idx" ON "RetrievalEvaluationCase"("packId");
CREATE INDEX "RetrievalEvaluationCase_versionId_idx" ON "RetrievalEvaluationCase"("versionId");
CREATE INDEX "RetrievalEvaluationCase_isActive_idx" ON "RetrievalEvaluationCase"("isActive");

CREATE INDEX "RetrievalEvaluationRun_setId_idx" ON "RetrievalEvaluationRun"("setId");
CREATE INDEX "RetrievalEvaluationRun_packId_idx" ON "RetrievalEvaluationRun"("packId");
CREATE INDEX "RetrievalEvaluationRun_versionId_idx" ON "RetrievalEvaluationRun"("versionId");
CREATE INDEX "RetrievalEvaluationRun_status_idx" ON "RetrievalEvaluationRun"("status");
CREATE INDEX "RetrievalEvaluationRun_checkedAt_idx" ON "RetrievalEvaluationRun"("checkedAt");

CREATE INDEX "RetrievalEvaluationResult_runId_idx" ON "RetrievalEvaluationResult"("runId");
CREATE INDEX "RetrievalEvaluationResult_caseId_idx" ON "RetrievalEvaluationResult"("caseId");
CREATE INDEX "RetrievalEvaluationResult_packId_idx" ON "RetrievalEvaluationResult"("packId");
CREATE INDEX "RetrievalEvaluationResult_versionId_idx" ON "RetrievalEvaluationResult"("versionId");
CREATE INDEX "RetrievalEvaluationResult_status_idx" ON "RetrievalEvaluationResult"("status");

CREATE INDEX "RetrievalEvaluationIssue_runId_idx" ON "RetrievalEvaluationIssue"("runId");
CREATE INDEX "RetrievalEvaluationIssue_severity_idx" ON "RetrievalEvaluationIssue"("severity");
CREATE INDEX "RetrievalEvaluationIssue_code_idx" ON "RetrievalEvaluationIssue"("code");

-- AddForeignKey
ALTER TABLE "RetrievalEvaluationSet" ADD CONSTRAINT "RetrievalEvaluationSet_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationSet" ADD CONSTRAINT "RetrievalEvaluationSet_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetrievalEvaluationCase" ADD CONSTRAINT "RetrievalEvaluationCase_setId_fkey" FOREIGN KEY ("setId") REFERENCES "RetrievalEvaluationSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationCase" ADD CONSTRAINT "RetrievalEvaluationCase_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationCase" ADD CONSTRAINT "RetrievalEvaluationCase_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetrievalEvaluationRun" ADD CONSTRAINT "RetrievalEvaluationRun_setId_fkey" FOREIGN KEY ("setId") REFERENCES "RetrievalEvaluationSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationRun" ADD CONSTRAINT "RetrievalEvaluationRun_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationRun" ADD CONSTRAINT "RetrievalEvaluationRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetrievalEvaluationResult" ADD CONSTRAINT "RetrievalEvaluationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RetrievalEvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationResult" ADD CONSTRAINT "RetrievalEvaluationResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RetrievalEvaluationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationResult" ADD CONSTRAINT "RetrievalEvaluationResult_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalEvaluationResult" ADD CONSTRAINT "RetrievalEvaluationResult_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetrievalEvaluationIssue" ADD CONSTRAINT "RetrievalEvaluationIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RetrievalEvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
