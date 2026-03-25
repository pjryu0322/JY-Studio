/**
 * seed → API Vitest → Playwright E2E → 결과 집계
 *
 * Next.js 동일 워크스페이스에서는 dev 서버 단일 인스턴스만 허용되므로,
 * 먼저 다른 터미널에서 `pnpm dev` (포트 3000)를 띄운 뒤 이 스크립트를 실행하세요.
 * CI 등에서는 PLAYWRIGHT/API가 자체 서버를 띄울 수 있도록 구성할 수 있습니다.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function waitForDevLogin(base = "http://127.0.0.1:3000", maxAttempts = 40) {
  const url = `${base.replace(/\/$/, "")}/login`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "manual" });
      if (res.ok || res.status === 307 || res.status === 302) return true;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function run(label, cmd, args) {
  console.log(`\n>>> ${label}\n`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0 && r.status !== null) {
    console.error(`[harness] ${label} exited with ${r.status}`);
    process.exit(r.status);
  }
}

run("seed:test (+actions)", "npm", ["run", "seed:test", "--", "--with-actions"]);
run("ensure artifacts dir", "node", [join(root, "scripts", "ensure-artifacts-dir.mjs")]);

const ready = await waitForDevLogin();
if (!ready) {
  console.error(
    "[harness] http://127.0.0.1:3000 에 앱이 응답하지 않습니다.\n" +
      "  먼저 별도 터미널에서 `pnpm dev` 로 Next 개발 서버를 실행한 뒤 `npm run test:all` 을 다시 실행하세요.\n" +
      "  (API 테스트는 TEST_BASE_URL=http://127.0.0.1:3000 을 사용합니다.)"
  );
  process.exit(1);
}
run("test:api (Vitest)", "npm", ["run", "test:api"]);
run("test:e2e (Playwright)", "npm", ["run", "test:e2e"]);
run("aggregate", "node", [join(root, "apps", "web", "scripts", "aggregate-test-results.mjs")]);

console.log(
  "\n[harness] 완료. .artifacts/test-results/latest.json 및 /dev/test-results (로그인 후) 에서 확인하세요.\n"
);
