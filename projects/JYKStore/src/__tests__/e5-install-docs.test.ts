import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readme = readFileSync(join(root, "embedding-worker", "README.md"), "utf8");
const envExample = readFileSync(join(root, ".env.example"), "utf8");

describe("Local E5 install documentation invariants", () => {
  it("requires E5_MODEL_REVISION and E5_MODEL_DIR in the install example", () => {
    assert.match(readme, /E5_MODEL_REVISION\s*=/);
    assert.match(readme, /E5_MODEL_DIR\s*=/);
    assert.match(readme, /npm run embedding-model:install/);
    assert.match(readme, /E5_MODEL_REVISION.*\*\*Required\*\*/i);
    assert.match(readme, /E5_MODEL_DIR.*\*\*Required\*\*/i);
  });

  it("does not document optional revision, latest resolve, or auto model dir", () => {
    assert.doesNotMatch(readme, /optional;\s*install resolves latest/i);
    assert.doesNotMatch(readme, /생략\s*시\s*latest/i);
    assert.doesNotMatch(readme, /Revision optional/i);
    assert.doesNotMatch(readme, /Model Dir 자동/i);
    assert.doesNotMatch(readme, /Worker 시작 시 자동 설치/i);
    assert.doesNotMatch(readme, /Default install root/i);
  });

  it("does not include a Docker run section", () => {
    assert.doesNotMatch(readme, /##\s*Docker\s*\(production\)/i);
    assert.doesNotMatch(readme, /docker build/i);
    assert.doesNotMatch(readme, /docker run/i);
    assert.doesNotMatch(readme, /Docker Compose/i);
    assert.doesNotMatch(readme, /Docker Volume/i);
    assert.match(readme, /Docker 기반 배포는 현재 JYKStore 작업 범위에 포함되지 않는다/);
  });

  it("documents required E5 install env in .env.example", () => {
    assert.match(envExample, /E5_MODEL_REVISION=/);
    assert.match(envExample, /E5_MODEL_DIR=/);
    assert.match(envExample, /E5_MODEL_OFFLINE=true/);
    assert.match(envExample, /E5_MODEL_REVISION and E5_MODEL_DIR are required/);
  });
});
