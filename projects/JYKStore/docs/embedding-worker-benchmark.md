# E5 Embedding Worker — CPU Benchmark

Model: `dragonkue/multilingual-e5-small-ko-v2` · Provider: `local-e5` · 384-dim · cosine · CPU only.

> STATUS: **NOT YET MEASURED on target hardware.**
>
> The numbers below are placeholders. They must be filled in by running the live benchmark on the
> actual deployment host — do **not** substitute estimates. Run:
>
> ```powershell
> $env:E5_WORKER_STUB="false"; $env:E5_MODEL_REVISION="<commit-sha>"
> npm run embedding-worker:benchmark:live
> ```
>
> The stub-based CI contract tests do not exercise the real model and therefore produce no
> benchmark numbers.

## Environment

| Field                 | Value |
| --------------------- | ----- |
| CPU model             | TBD   |
| vCPU                  | TBD   |
| RAM                   | TBD   |
| OS                    | TBD   |
| Python                | TBD   |
| torch                 | 2.5.1 |
| sentence-transformers | 3.3.1 |
| model revision        | TBD   |
| batch size            | 32    |
| thread settings       | TBD   |

## Results

| Metric              | Value |
| ------------------- | ----- |
| First load time (s) | TBD   |
| Cached restart (s)  | TBD   |
| Peak RSS (MB)       | TBD   |
| CPU utilization     | TBD   |
| 100 chunks (s)      | TBD   |
| 1,000 chunks (s)    | TBD   |
| Chunks/sec          | TBD   |
| Query P50 (ms)      | TBD   |
| Query P95 (ms)      | TBD   |
| Error rate          | TBD   |
| Verdict             | TBD   |
