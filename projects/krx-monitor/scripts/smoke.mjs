const API_BASE = process.env.API_BASE ?? 'http://localhost:3001';

async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/v1/health`);
  if (!res.ok) throw new Error(`health status ${res.status}`);
  const data = await res.json();
  if (!data?.ok) throw new Error('health ok is not true');
  return data;
}

async function checkStockSearch() {
  const res = await fetch(`${API_BASE}/api/v1/stocks/search?q=DUMMY`);
  if (!res.ok) throw new Error(`stocks/search status ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length < 1) {
    throw new Error('stocks/search returned empty result');
  }
  return data[0];
}

async function main() {
  try {
    const health = await checkHealth();
    const first = await checkStockSearch();
    console.log('PASS smoke test');
    console.log('health:', health);
    console.log('search sample:', first);
  } catch (error) {
    console.error('FAIL smoke test');
    console.error(error);
    process.exit(1);
  }
}

main();
