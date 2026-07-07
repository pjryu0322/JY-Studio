-- CreateIndex
CREATE UNIQUE INDEX "PackInstallation_userId_packId_key" ON "PackInstallation"("userId", "packId");

-- CreateIndex
CREATE UNIQUE INDEX "PackInstallation_organizationId_packId_key" ON "PackInstallation"("organizationId", "packId");
