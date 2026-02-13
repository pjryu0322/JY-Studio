import Link from 'next/link';

type HealthResponse = {
  ok: boolean;
  ts: string;
};

async function getHealth(): Promise<HealthResponse | { error: string }> {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';

  try {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export default async function HomePage() {
  const health = await getHealth();

  return (
    <main>
      <h1>KRX Monitor Web</h1>
      <p>/api/v1/health 호출 결과:</p>
      <pre>{JSON.stringify(health, null, 2)}</pre>
      <p>
        <Link href="/watchlist/editor">Watchlist Editor로 이동</Link>
      </p>
    </main>
  );
}
