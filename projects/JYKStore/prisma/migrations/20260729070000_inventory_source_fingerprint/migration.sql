-- P3.1: Working Copy fingerprint for Inventory consistency
ALTER TABLE "KnowledgeScopeInventory"
ADD COLUMN IF NOT EXISTS "inventorySourceFingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "KnowledgeScopeInventory_inventorySourceFingerprint_idx"
ON "KnowledgeScopeInventory"("inventorySourceFingerprint");
