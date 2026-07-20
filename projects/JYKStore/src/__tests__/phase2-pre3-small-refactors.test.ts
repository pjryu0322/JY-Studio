import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminHistoryNeedsComputedFilter,
  adminHistoryPaginationMeta,
  buildAdminHistoryBaseWhere,
  normalizeAdminHistoryPagination,
  resolveAdminHistoryVersionScope,
} from "@/lib/distribution/service-validation-admin-listing-helpers";
import {
  buildProviderPackScalarPatch,
  buildProviderPackVersionPatch,
} from "@/lib/provider-pack/provider-pack-write-service";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";

describe("admin history listing helpers", () => {
  it("normalizes pagination bounds", () => {
    assert.deepEqual(normalizeAdminHistoryPagination({}), { page: 1, pageSize: 20 });
    assert.deepEqual(normalizeAdminHistoryPagination({ page: 0, pageSize: 999 }), {
      page: 1,
      pageSize: 100,
    });
  });

  it("resolves version scope without DB", () => {
    const versions = [{ id: "v1" }, { id: "v2" }];
    assert.deepEqual(
      resolveAdminHistoryVersionScope({
        versions,
        latestVersionId: "v1",
        versionScope: "LATEST",
      }),
      { versionScope: "LATEST", filterVersionId: "v1" },
    );
    assert.deepEqual(
      resolveAdminHistoryVersionScope({
        versions,
        latestVersionId: "v1",
        versionId: "v2",
      }),
      { versionScope: "VERSION", filterVersionId: "v2" },
    );
    assert.throws(
      () =>
        resolveAdminHistoryVersionScope({
          versions,
          latestVersionId: "v1",
          versionId: "missing",
        }),
      (e: unknown) => e instanceof PayloadServiceError && e.code === "NOT_FOUND",
    );
  });

  it("builds base where and detects computed filters", () => {
    const where = buildAdminHistoryBaseWhere({
      packId: "p1",
      filterVersionId: "v1",
      channel: "API",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-02",
    });
    assert.equal(where.packId, "p1");
    assert.equal(where.versionId, "v1");
    assert.equal(where.channel, "API");
    assert.ok(where.createdAt?.gte instanceof Date);
    assert.ok(where.createdAt?.lte instanceof Date);

    assert.equal(
      adminHistoryNeedsComputedFilter({ systemStatus: "STALE" }).needsComputedFilter,
      true,
    );
    assert.equal(
      adminHistoryNeedsComputedFilter({ systemStatus: "FAIL" }).needsComputedFilter,
      false,
    );
    assert.deepEqual(adminHistoryPaginationMeta({ page: 2, pageSize: 10, totalCount: 25 }), {
      page: 2,
      pageSize: 10,
      totalCount: 25,
      totalPages: 3,
    });
  });
});

describe("provider pack update patch helpers", () => {
  it("builds scalar and version patches without side effects", () => {
    const scalar = buildProviderPackScalarPatch({
      name: "  Pack  ",
      tags: [" a ", "", "b"],
      icon: "",
    });
    assert.deepEqual(scalar, {
      name: "Pack",
      tags: ["a", "b"],
      icon: "📦",
    });

    const version = buildProviderPackVersionPatch(
      { versionOverview: "  ov  ", versionSummary: " sum " },
      "ko",
    );
    assert.equal(version.overview, "ov");
    assert.equal(version.versionSummary, "sum");
    assert.equal(version.language, "KO");
  });
});
