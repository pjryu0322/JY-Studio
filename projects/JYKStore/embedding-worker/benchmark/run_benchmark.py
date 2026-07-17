"""Live CPU benchmark for the E5 embedding worker model (J.28/J.29).

Loads the real sentence-transformers model directly (no HTTP), measures load time,
memory, and throughput, and prints a Markdown-ready summary. Requires E5_WORKER_STUB=false.

Usage:
  E5_WORKER_STUB=false E5_MODEL_REVISION=<sha> python benchmark/run_benchmark.py
"""
from __future__ import annotations

import os
import platform
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

if os.getenv("E5_WORKER_STUB", "true").lower() in ("1", "true", "yes", "on"):
    print("Refusing to benchmark in stub mode. Set E5_WORKER_STUB=false.", file=sys.stderr)
    sys.exit(2)


def _rss_mb() -> float:
    try:
        import resource

        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0
    except Exception:
        try:
            import psutil

            return psutil.Process().memory_info().rss / (1024 * 1024)
        except Exception:
            return float("nan")


def main() -> None:
    from app.settings import settings
    from sentence_transformers import SentenceTransformer

    t0 = time.perf_counter()
    model = SentenceTransformer(
        settings.model_id, revision=settings.model_revision or None, device="cpu"
    )
    load_s = time.perf_counter() - t0

    passages = [f"passage: benchmark chunk {i} 한국어 sample text." for i in range(1000)]
    queries = ["query: 벤치마크 검색 질문"]

    def bench_passages(n: int) -> float:
        subset = passages[:n]
        start = time.perf_counter()
        model.encode(subset, normalize_embeddings=True, batch_size=settings.max_batch_size)
        return time.perf_counter() - start

    t_100 = bench_passages(100)
    t_1000 = bench_passages(1000)

    latencies = []
    for _ in range(20):
        start = time.perf_counter()
        model.encode(queries, normalize_embeddings=True)
        latencies.append((time.perf_counter() - start) * 1000)
    latencies.sort()
    p50 = latencies[len(latencies) // 2]
    p95 = latencies[int(len(latencies) * 0.95)]

    print("## Environment")
    print(f"- CPU: {platform.processor() or platform.machine()}")
    print(f"- OS: {platform.platform()}")
    print(f"- Python: {platform.python_version()}")
    print(f"- Model: {settings.model_id}")
    print(f"- Revision: {settings.effective_revision}")
    print(f"- Batch size: {settings.max_batch_size}")
    print()
    print("## Results")
    print(f"- Load time (s): {load_s:.2f}")
    print(f"- Peak RSS (MB): {_rss_mb():.0f}")
    print(f"- 100 chunks (s): {t_100:.2f}  ({100 / t_100:.1f} chunks/s)")
    print(f"- 1,000 chunks (s): {t_1000:.2f}  ({1000 / t_1000:.1f} chunks/s)")
    print(f"- Query P50 (ms): {p50:.1f}")
    print(f"- Query P95 (ms): {p95:.1f}")


if __name__ == "__main__":
    main()
