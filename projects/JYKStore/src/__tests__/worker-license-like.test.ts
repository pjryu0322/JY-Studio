import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLicenseLikePath,
  isLicenseLikeSourceDocument,
  isWorkerReviewOnlyDocument,
} from "../lib/python-worker/worker-license-like.ts";

describe("worker-license-like", () => {
  it("detects license basenames including webpack *.LICENSE", () => {
    assert.equal(isLicenseLikePath("라이선스"), true);
    assert.equal(isLicenseLikePath("docs/LICENSE"), true);
    assert.equal(isLicenseLikePath("main.2d074fad.js.LICENSE"), true);
    assert.equal(isLicenseLikePath("COPYRIGHT.txt"), true);
    assert.equal(isLicenseLikePath("api-guide.html"), false);
  });

  it("treats license_review / reviewOnly as review-only documents", () => {
    assert.equal(
      isWorkerReviewOnlyDocument({ sourceType: "license_review", sourcePath: "x" }),
      true,
    );
    assert.equal(isWorkerReviewOnlyDocument({ reviewOnly: true, sourcePath: "x" }), true);
    assert.equal(
      isLicenseLikeSourceDocument({ title: "라이선스", fileName: null }),
      true,
    );
  });
});
