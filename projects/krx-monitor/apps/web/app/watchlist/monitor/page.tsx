'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChartPanel } from './_components/ChartPanel';
import { DetailTabs } from './_components/DetailTabs';
import { MonitorGrid } from './_components/MonitorGrid';
import { useRotation } from './_hooks/useRotation';
import { Candle, Memo, NewsItem, SnapshotItem, WatchGroup, WatchItem, WatchSet } from './_types/monitor';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

type Tab = 'news' | 'memo' | 'detail';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export default function MonitorPage() {
  const [sets, setSets] = useState<WatchSet[]>([]);
  const [groups, setGroups] = useState<WatchGroup[]>([]);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [tab, setTab] = useState<Tab>('news');
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId), [groups, selectedGroupId]);

  const rotation = useRotation({
    items,
    intervalSec: selectedGroup?.rotation_interval_sec ?? 5,
    initialCode: items[0]?.code,
  });

  const activeCode = rotation.activeCode ?? items[0]?.code;
  const viewCode = rotation.viewCode ?? activeCode;

  const activeSnapshot = useMemo(() => snapshots.find((snapshot) => snapshot.code === activeCode), [snapshots, activeCode]);

  const interactionPause = () => rotation.pauseByInteraction();

  useEffect(() => {
    api<WatchSet[]>('/api/v1/watch/sets')
      .then((data) => {
        setSets(data);
        if (data.length > 0) {
          setSelectedSetId(data[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : '세트 로딩 실패'));
  }, []);

  useEffect(() => {
    if (!selectedSetId) return;
    api<WatchGroup[]>(`/api/v1/watch/sets/${selectedSetId}/groups`)
      .then((data) => {
        setGroups(data);
        setSelectedGroupId(data[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '그룹 로딩 실패'));
  }, [selectedSetId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    api<WatchItem[]>(`/api/v1/watch/groups/${selectedGroupId}/items`)
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.sort_order - b.sort_order);
        setItems(sorted);
        if (sorted.length > 0) {
          rotation.setActiveCode(sorted[0].code);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : '아이템 로딩 실패'));
  }, [selectedGroupId]);

  useEffect(() => {
    if (items.length === 0) {
      setSnapshots([]);
      return;
    }

    const fetchSnapshot = () => {
      const codes = items.map((item) => item.code).join(',');
      api<SnapshotItem[]>(`/api/v1/market/snapshot?codes=${codes}`)
        .then(setSnapshots)
        .catch((e) => setError(e instanceof Error ? e.message : '시세 로딩 실패'));
    };

    fetchSnapshot();
    const timer = setInterval(fetchSnapshot, 3000);
    return () => clearInterval(timer);
  }, [items]);

  useEffect(() => {
    if (!viewCode) return;
    api<{ candles: Candle[] }>(`/api/v1/market/candles?code=${viewCode}&tf=5m&count=160`)
      .then((data) => setCandles(data.candles))
      .catch((e) => setError(e instanceof Error ? e.message : '차트 로딩 실패'));
  }, [viewCode]);

  useEffect(() => {
    if (!activeCode) return;
    api<NewsItem[]>(`/api/v1/news?code=${activeCode}&limit=5`)
      .then(setNews)
      .catch((e) => setError(e instanceof Error ? e.message : '뉴스 로딩 실패'));

    api<Memo>(`/api/v1/stocks/${activeCode}/memo`)
      .then((data) => {
        setMemo(data);
        setMemoDraft(data.content ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : '메모 로딩 실패'));
  }, [activeCode]);

  return (
    <main>
      <h1>Watchlist Monitor</h1>
      {error && <p style={{ color: '#b91c1c' }}>에러: {error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <select value={selectedSetId ?? ''} onChange={(e) => { interactionPause(); setSelectedSetId(Number(e.target.value) || null); }}>
          <option value="">세트 선택</option>
          {sets.map((setItem) => (
            <option key={setItem.id} value={setItem.id}>{setItem.name}</option>
          ))}
        </select>

        <select value={selectedGroupId ?? ''} onChange={(e) => { interactionPause(); setSelectedGroupId(Number(e.target.value) || null); }}>
          <option value="">그룹 선택</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>

        <button onClick={() => rotation.play()}>▶</button>
        <button onClick={() => rotation.pauseByUser()}>⏸</button>
        <button onClick={() => rotation.stop()}>■</button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={Boolean(rotation.lockCode)}
            onChange={(e) => {
              interactionPause();
              rotation.setLocked(e.target.checked);
            }}
          />
          LOCK(차트 고정)
        </label>

        <span>state: {rotation.state}</span>
        {rotation.state === 'PAUSED_NO_TARGET' && <span style={{ color: '#b45309' }}>회전 가능한 종목이 없습니다(PIN 제외 후 0개).</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        <section>
          <MonitorGrid
            items={items}
            snapshots={snapshots}
            activeCode={activeCode}
            onInteraction={interactionPause}
            onSelect={(code) => rotation.setActiveCode(code)}
          />
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <ChartPanel code={viewCode} candles={candles} onInteraction={interactionPause} />

          <DetailTabs
            code={activeCode}
            tab={tab}
            onTabChange={setTab}
            news={news}
            memo={memo}
            memoDraft={memoDraft}
            onMemoDraftChange={setMemoDraft}
            onMemoSave={async () => {
              if (!activeCode) return;
              interactionPause();
              const saved = await api<Memo>(`/api/v1/stocks/${activeCode}/memo`, {
                method: 'PUT',
                body: JSON.stringify({ content: memoDraft }),
              });
              setMemo(saved);
            }}
            snapshot={activeSnapshot}
            rotationState={rotation.state}
            onInteraction={interactionPause}
          />
        </section>
      </div>
    </main>
  );
}
