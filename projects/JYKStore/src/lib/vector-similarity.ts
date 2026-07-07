export function isValidVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

export function dotProduct(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

export function magnitude(vector: number[]): number {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  return Math.sqrt(sumSquares);
}

// cosine similarity: -1 ~ 1
export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// 음수 similarity는 0으로 clamp한다. (0 ~ 1)
export function clampedCosineSimilarity(a: number[], b: number[]): number {
  const similarity = cosineSimilarity(a, b);
  if (Number.isNaN(similarity)) return 0;
  return Math.max(0, Math.min(1, similarity));
}
