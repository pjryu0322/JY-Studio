/**
 * Real Docling 3-file import E2E against PostgreSQL + MinIO.
 *
 * Requires:
 *   JYKSTORE_RUN_DOCLING_E2E=1  (or JYKSTORE_RUN_DISTRIBUTION_E2E=1)
 *   DATABASE_URL
 *   JYKSTORE_PAYLOAD_S3_*
 *   JYKSTORE_ANONYMOUS_ID_SECRET
 *
 * Prefer: npm run test:docling-e2e:full
 * Without the flag this suite is SKIPPED (never reported as PASS).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PackStatus } from "@prisma/client";

import { acceptPackReview, approvePackReview } from "../lib/admin-review-service.ts";
import { upsertProviderPackDistribution } from "../lib/distribution/distribution-metadata-service.ts";
import {
  getConfiguredPayloadStorage,
  resetPayloadStorageCache,
} from "../lib/distribution/payload-storage-factory.ts";
import { probePayloadObjectStorage } from "../lib/distribution/s3-payload-storage.ts";
import {
  deleteDoclingImportByBundleId,
  getActiveDoclingImport,
  uploadDoclingImportBundle,
} from "../lib/docling-import/docling-import-service.ts";
import { isDoclingImportError } from "../lib/docling-import/docling-import-errors.ts";
import { resolveReviewPackageMode } from "../lib/review/review-package-mode.ts";
import { prisma } from "../lib/prisma.ts";
import {
  createProviderPackForClient,
  submitProviderPackForReview,
} from "../lib/provider-pack-service.ts";
import { ensureProviderProfileForAccount } from "../lib/provider-profile-service.ts";
import { assertSafeE2ETargets } from "../../test/distribution-e2e-safety.mjs";
import { promoteDoclingStagingBundle } from "../lib/docling-import/docling-import-lifecycle-service.ts";

const runE2E =
  (process.env.JYKSTORE_RUN_DOCLING_E2E === "1" ||
    process.env.JYKSTORE_RUN_DISTRIBUTION_E2E === "1") &&
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim()) &&
  Boolean(process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim());

if (runE2E) {
  assertSafeE2ETargets(process.env);
}

const CATEGORY_ID = "e2e-docling-api";
const runId = `e2edoc${Date.now().toString(36)}`;

type Actors = {
  providerUserId: string;
  providerClientId: string;
  adminUserId: string;
  adminClientId: string;
  userIds: string[];
  packIds: string[];
};

const actors: Actors = {
  providerUserId: "",
  providerClientId: `e2e-doc-prov-${runId}`,
  adminUserId: "",
  adminClientId: `e2e-doc-adm-${runId}`,
  userIds: [],
  packIds: [],
};

const MINIMAL_DOCLING = {
  schema_name: "DoclingDocument",
  version: "1.10.0",
  name: "Sample",
  origin: { filename: "sample.pdf", mimetype: "application/pdf" },
  body: { children: [], self_ref: "#/body" },
  texts: [
    {
      self_ref: "#/texts/0",
      text: "Hello world sample content",
      label: "paragraph",
    },
  ],
  tables: [],
  pictures: [],
};

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
}

function jsonBytes(doc = MINIMAL_DOCLING): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(doc));
}

function mdBytes(): Uint8Array {
  return new TextEncoder().encode("# Sample\n\nHello world sample content\n");
}

function badJsonBytes(): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ ...MINIMAL_DOCLING, schema_name: "Other" }));
}

describe("docling-minio-e2e", { skip: !runE2E }, () => {
  before(async () => {
    resetPayloadStorageCache();
    process.env.JYKSTORE_TRUST_PROXY = "true";

    const probe = await probePayloadObjectStorage(getConfiguredPayloadStorage());
    if (!probe.ok) {
      throw new Error(`Object storage probe failed: ${probe.message}`);
    }

    await prisma.category.upsert({
      where: { id: CATEGORY_ID },
      create: {
        id: CATEGORY_ID,
        name: "Docling E2E",
        description: "Docling E2E category",
        icon: "📄",
        sortOrder: 9998,
      },
      update: { name: "Docling E2E" },
    });

    const provider = await prisma.user.create({
      data: {
        email: `docling-prov-${runId}@example.com`,
        name: "Docling E2E Provider",
        role: "PROVIDER",
      },
    });
    actors.providerUserId = provider.id;
    actors.userIds.push(provider.id);

    const admin = await prisma.user.create({
      data: {
        email: `docling-adm-${runId}@example.com`,
        name: "Docling E2E Admin",
        role: "ADMIN",
      },
    });
    actors.adminUserId = admin.id;
    actors.userIds.push(admin.id);

    await ensureProviderProfileForAccount(actors.providerUserId, actors.providerClientId, {
      displayName: "Docling E2E Provider",
      providerType: "INDIVIDUAL",
    });
  });

  after(async () => {
    for (const packId of actors.packIds) {
      await prisma.packReview.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.normalizedDocument.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackFile.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.doclingImportBundle.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.packDistributionMetadata.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
    }
    for (const userId of actors.userIds) {
      await prisma.providerProfile.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it("upload → REVIEW_READY → submit → accept → approve without release gate", async () => {
    const created = await createProviderPackForClient(
      actors.providerUserId,
      actors.providerClientId,
      {
        name: `Docling E2E ${runId}`,
        categoryId: CATEGORY_ID,
        shortDescription: "Docling three-file e2e",
        description: "Docling three-file import e2e pack",
        version: "1.0.0",
      },
    );
    if ("error" in created) {
      throw new Error(`create pack failed: ${JSON.stringify(created)}`);
    }
    const packId = created.pack.packId;
    actors.packIds.push(packId);

    const uploaded = await uploadDoclingImportBundle({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      source: {
        fileName: "sample.pdf",
        mimeType: "application/pdf",
        bytes: pdfBytes(),
      },
      json: {
        fileName: "sample.json",
        mimeType: "application/json",
        bytes: jsonBytes(),
      },
      markdown: {
        fileName: "sample.md",
        mimeType: "text/markdown",
        bytes: mdBytes(),
      },
    });
    assert.equal(uploaded.bundle.status, "REVIEW_READY");
    assert.equal(uploaded.bundle.isActive, true);

    await upsertProviderPackDistribution({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      body: {
        sourceTitle: "Docling E2E Source",
        sourceUrl: "https://example.com/docling-e2e",
        licenseName: "MIT",
        visibility: "PRIVATE",
        allowDownload: true,
      },
    });

    const submitted = await submitProviderPackForReview(
      actors.providerUserId,
      actors.providerClientId,
      packId,
    );
    if ("error" in submitted) {
      throw new Error(`submit failed: ${JSON.stringify(submitted)}`);
    }
    assert.equal(submitted.mode, "DOCLING_BUNDLE");
    assert.equal(resolveReviewPackageMode(submitted.snapshot), "DOCLING_BUNDLE");

    const packAfterSubmit = await prisma.knowledgePack.findUnique({ where: { packId } });
    assert.equal(packAfterSubmit?.status, PackStatus.REVIEWING);

    const accepted = await acceptPackReview({
      packId,
      reviewerClientId: actors.adminClientId,
      reviewerUserId: actors.adminUserId,
    });
    if ("error" in accepted) {
      throw new Error(`accept failed: ${JSON.stringify(accepted)}`);
    }

    const approved = await approvePackReview({
      packId,
      reviewerClientId: actors.adminClientId,
      reviewerUserId: actors.adminUserId,
    });
    if ("error" in approved) {
      throw new Error(`approve failed: ${JSON.stringify(approved)}`);
    }

    const published = await prisma.knowledgePack.findUnique({ where: { packId } });
    assert.ok(
      published?.status === PackStatus.PUBLISHED || published?.status === PackStatus.VERIFIED,
    );
  });

  it("preserves failed staging for retry", async () => {
    const created = await createProviderPackForClient(
      actors.providerUserId,
      actors.providerClientId,
      {
        name: `Docling Staging ${runId}`,
        categoryId: CATEGORY_ID,
        shortDescription: "Docling staging preserve e2e",
        description: "Docling failed staging preserve e2e",
        version: "1.0.0",
      },
    );
    if ("error" in created) {
      throw new Error(`create pack failed: ${JSON.stringify(created)}`);
    }
    const packId = created.pack.packId;
    actors.packIds.push(packId);

    let threw = false;
    try {
      await uploadDoclingImportBundle({
        userId: actors.providerUserId,
        clientId: actors.providerClientId,
        packId,
        source: {
          fileName: "sample.pdf",
          mimeType: "application/pdf",
          bytes: pdfBytes(),
        },
        json: {
          fileName: "bad.json",
          mimeType: "application/json",
          bytes: badJsonBytes(),
        },
        markdown: {
          fileName: "sample.md",
          mimeType: "text/markdown",
          bytes: mdBytes(),
        },
      });
    } catch {
      threw = true;
    }
    assert.equal(threw, true);

    const state = await getActiveDoclingImport({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
    });
    assert.equal(state.bundle, null);
    assert.ok(state.stagingBundle);
    assert.equal(state.stagingBundle?.isActive, false);
    assert.equal(state.stagingBundle?.storageStatus, "ACTIVE");
    assert.ok(
      state.stagingBundle?.status === "VALIDATION_FAILED" ||
        state.stagingBundle?.status === "NORMALIZATION_FAILED",
    );
    assert.ok(state.stagingBundle?.files.length === 3);
  });

  it("keeps active on replace failure then promotes on success and locks after submit", async () => {
    const created = await createProviderPackForClient(
      actors.providerUserId,
      actors.providerClientId,
      {
        name: `Docling Replace ${runId}`,
        categoryId: CATEGORY_ID,
        shortDescription: "Docling safe replace e2e",
        description: "Docling staging-first replace e2e",
        version: "1.0.0",
      },
    );
    if ("error" in created) {
      throw new Error(`create pack failed: ${JSON.stringify(created)}`);
    }
    const packId = created.pack.packId;
    actors.packIds.push(packId);

    const first = await uploadDoclingImportBundle({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      source: {
        fileName: "sample.pdf",
        mimeType: "application/pdf",
        bytes: pdfBytes(),
      },
      json: {
        fileName: "sample.json",
        mimeType: "application/json",
        bytes: jsonBytes(),
      },
      markdown: {
        fileName: "sample.md",
        mimeType: "text/markdown",
        bytes: mdBytes(),
      },
    });
    assert.equal(first.bundle.status, "REVIEW_READY");
    assert.equal(first.bundle.isActive, true);
    const activeId = first.bundle.id;

    let failedReplace = false;
    try {
      await uploadDoclingImportBundle({
        userId: actors.providerUserId,
        clientId: actors.providerClientId,
        packId,
        source: {
          fileName: "sample.pdf",
          mimeType: "application/pdf",
          bytes: pdfBytes(),
        },
        json: {
          fileName: "bad.json",
          mimeType: "application/json",
          bytes: badJsonBytes(),
        },
        markdown: {
          fileName: "sample.md",
          mimeType: "text/markdown",
          bytes: mdBytes(),
        },
      });
    } catch {
      failedReplace = true;
    }
    assert.equal(failedReplace, true);

    const afterFail = await getActiveDoclingImport({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
    });
    assert.equal(afterFail.bundle?.id, activeId);
    assert.equal(afterFail.bundle?.isActive, true);
    assert.ok(afterFail.stagingBundle);
    assert.equal(afterFail.stagingBundle?.isActive, false);
    const stagingId = afterFail.stagingBundle!.id;

    await deleteDoclingImportByBundleId({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      bundleId: stagingId,
    });

    const afterDeleteStaging = await getActiveDoclingImport({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
    });
    assert.equal(afterDeleteStaging.bundle?.id, activeId);
    assert.equal(afterDeleteStaging.stagingBundle, null);

    const replacementDoc = {
      ...MINIMAL_DOCLING,
      name: "Sample Replace",
      texts: [
        {
          self_ref: "#/texts/0",
          text: "Replacement content hello world",
          label: "paragraph",
        },
      ],
    };
    const second = await uploadDoclingImportBundle({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      source: {
        fileName: "sample.pdf",
        mimeType: "application/pdf",
        bytes: pdfBytes(),
      },
      json: {
        fileName: "sample.json",
        mimeType: "application/json",
        bytes: jsonBytes(replacementDoc),
      },
      markdown: {
        fileName: "sample.md",
        mimeType: "text/markdown",
        bytes: new TextEncoder().encode("# Sample Replace\n\nReplacement content hello world\n"),
      },
    });
    assert.equal(second.bundle.isActive, true);
    assert.notEqual(second.bundle.id, activeId);
    assert.equal(second.bundle.status, "REVIEW_READY");

    const previous = await prisma.doclingImportBundle.findUnique({ where: { id: activeId } });
    assert.ok(previous);
    assert.equal(previous?.isActive, false);

    await upsertProviderPackDistribution({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      body: {
        sourceTitle: "Docling Replace Source",
        sourceUrl: "https://example.com/docling-replace",
        licenseName: "MIT",
        visibility: "PRIVATE",
        allowDownload: true,
      },
    });

    const submitted = await submitProviderPackForReview(
      actors.providerUserId,
      actors.providerClientId,
      packId,
    );
    if ("error" in submitted) {
      throw new Error(`submit failed: ${JSON.stringify(submitted)}`);
    }
    assert.equal(submitted.mode, "DOCLING_BUNDLE");

    const afterSubmit = await getActiveDoclingImport({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
    });
    assert.equal(afterSubmit.bundle?.immutableAfterSubmission, true);
    assert.equal(afterSubmit.bundle?.canDelete, false);

    let blocked = false;
    try {
      await uploadDoclingImportBundle({
        userId: actors.providerUserId,
        clientId: actors.providerClientId,
        packId,
        source: {
          fileName: "sample.pdf",
          mimeType: "application/pdf",
          bytes: pdfBytes(),
        },
        json: {
          fileName: "sample.json",
          mimeType: "application/json",
          bytes: jsonBytes(),
        },
        markdown: {
          fileName: "sample.md",
          mimeType: "text/markdown",
          bytes: mdBytes(),
        },
      });
    } catch (error) {
      blocked = true;
      assert.ok(isDoclingImportError(error) || error instanceof Error);
    }
    assert.equal(blocked, true);

    // Concurrent promote vs open review should not flip active after submit.
    let promoteBlocked = false;
    try {
      await promoteDoclingStagingBundle({
        packId,
        versionId: second.bundle.versionId,
        stagingBundleId: second.bundle.id,
      });
    } catch {
      promoteBlocked = true;
    }
    // Already active: promote may no-op or conflict; active must remain the submitted bundle.
    void promoteBlocked;
    const finalState = await getActiveDoclingImport({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
    });
    assert.equal(finalState.bundle?.id, second.bundle.id);
  });
});
