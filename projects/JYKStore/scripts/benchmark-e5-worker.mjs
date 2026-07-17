/**
 * CPU embedding worker benchmark (stub or live worker).
 * Usage: node scripts/benchmark-e5-worker.mjs [workerBaseUrl]
 */
const base = (process.argv[2] ?? process.env.JYKSTORE_EMBEDDING_WORKER_URL ?? "http://127.0.0.1:8010").replace(
  /\/+$/,
  "",
);
const model = process.env.JYKSTORE_EMBEDDING_MODEL ?? "dragonkue/multilingual-e5-small-ko-v2";

async function post(path, texts) {
  const started = performance.now();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, texts, normalize: true }),
  });
  const elapsed = performance.now() - started;
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  await res.json();
  return elapsed;
}

async function main() {
  const ready = await fetch(`${base}/ready`);
  console.log("ready", ready.status, await ready.text());

  const passage = (i) => `passage: benchmark chunk ${i} 한국어 sample text for CPU throughput.`;
  const query = "query: 벤치마크 검색 질문";

  const sizes = [100, 1000];
  for (const n of sizes) {
    const texts = Array.from({ length: n }, (_, i) => passage(i));
    const t0 = performance.now();
    await post("/embed/passages", texts);
    const total = performance.now() - t0;
    console.log(`passages n=${n} totalMs=${total.toFixed(0)} perChunkMs=${(total / n).toFixed(2)}`);
  }

  const querySamples = [];
  for (let i = 0; i < 10; i++) {
    querySamples.push(await post("/embed/query", [query]));
  }
  querySamples.sort((a, b) => a - b);
  const p50 = querySamples[Math.floor(querySamples.length * 0.5)] ?? 0;
  const p95 = querySamples[Math.floor(querySamples.length * 0.95)] ?? 0;
  console.log(`query batch=10 p50Ms=${p50.toFixed(1)} p95Ms=${p95.toFixed(1)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
