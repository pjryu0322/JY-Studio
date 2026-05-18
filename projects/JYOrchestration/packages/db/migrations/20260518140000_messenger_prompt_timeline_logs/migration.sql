-- CreateTable
CREATE TABLE "messenger_prompt_timeline_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT,
    "projectId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT,
    "outbound" TEXT NOT NULL,
    "inbound" TEXT NOT NULL,
    "status" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messenger_prompt_timeline_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messenger_prompt_timeline_logs_userId_createdAt_idx" ON "messenger_prompt_timeline_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "messenger_prompt_timeline_logs_projectId_createdAt_idx" ON "messenger_prompt_timeline_logs"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "messenger_prompt_timeline_logs" ADD CONSTRAINT "messenger_prompt_timeline_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
