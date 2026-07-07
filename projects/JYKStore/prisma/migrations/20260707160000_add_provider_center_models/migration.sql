-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_PROFILE_UPSERT';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_PACK_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_PACK_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_PACK_VERSION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_SOURCE_DOCUMENT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_PACK_SUBMIT';

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT,
    "organizationId" TEXT,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_clientId_key" ON "ProviderProfile"("clientId");

-- CreateIndex
CREATE INDEX "ProviderProfile_userId_idx" ON "ProviderProfile"("userId");

-- CreateIndex
CREATE INDEX "ProviderProfile_organizationId_idx" ON "ProviderProfile"("organizationId");

-- CreateIndex
CREATE INDEX "ProviderProfile_status_idx" ON "ProviderProfile"("status");

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "KnowledgePack" ADD COLUMN "providerProfileId" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgePack_providerProfileId_idx" ON "KnowledgePack"("providerProfileId");

-- AddForeignKey
ALTER TABLE "KnowledgePack" ADD CONSTRAINT "KnowledgePack_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
