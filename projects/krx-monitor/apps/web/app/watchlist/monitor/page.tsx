'use client';

import { QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ChartPanel } from './_components/ChartPanel';
import { DetailTabs } from './_components/DetailTabs';
import { RotationControls } from './_components/RotationControls';
import { WatchGrid } from './_components/WatchGrid';
import { useRotation } from './_hooks/useRotation';
import { Candle, Memo, NewsItem, SnapshotItem, WatchGroup, WatchItem, WatchSet } from './_types/monitor';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
const queryClient = new QueryClient();

type Tab = 'news' | 'memo' | 'detail';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export default function MonitorPage() {
  const [sets, setSets] = useState<WatchSet[]>([]);
  const [groups, setGroups] = useState<WatchGroup[]>([]);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [tab, setTab] = useState<Tab>('news');
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = useMemo(() => groups.find((g) => g.id === selectedGroupId), [groups, selectedGroupId]);
  const rotation = useRotation(items, selectedGroup?.rotation_interval_sec ?? 5);
  const activeCode = rotation.activeCode ?? items[0]?.code;
  const viewCode = rotation.viewCode ?? activeCode;

  const activeSnapshot = useMemo(() => snapshots.find((s) => s.code === activeCode), [snapshots, activeCode]);

  const pauseInteraction = () => rotation.pauseByInteraction();

  useEffect(() => {
    api<WatchSet[]>('/api/v1/watch/sets')
      .then((data) => {
        setSets(data);
        setSelectedSetId(data[0]?.id ?? null);
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
        if (sorted.length > 0) rotation.setActiveCode(sorted[0].code);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '아이템 로딩 실패'));
  }, [selectedGroupId]);

  useEffect(() => {
    if (items.length === 0) {
      setSnapshots([]);
      return;
    }

    const fetchSnapshot = () => {
      const codes = items.map((i) => i.code).join(',');
      api<SnapshotItem[]>(`/api/v1/market/snapshot?codes=${codes}`).then(setSnapshots).catch(() => setError('시세 로딩 실패'));
    };

    fetchSnapshot();
    const t = setInterval(fetchSnapshot, 2000);
    return () => clearInterval(t);
  }, [items]);

  useEffect(() => {
    if (!viewCode) return;
    api<Candle[]>(`/api/v1/market/candles?code=${viewCode}&tf=1d&count=200`).then(setCandles).catch(() => setError('차트 로딩 실패'));
  }, [viewCode]);

  useEffect(() => {
    if (!activeCode) return;
    api<NewsItem[]>(`/api/v1/news?code=${activeCode}&limit=50`).then(setNews).catch(() => setError('뉴스 로딩 실패'));
    api<Memo>(`/api/v1/stocks/${activeCode}/memo`).then((m) => {
      setMemo(m);
      setMemoDraft(m.content ?? '');
    });
  }, [activeCode]);

  useEffect(() => {
    if (rotation.state !== 'PLAYING') return;
    const candidates = items.filter((i) => !i.pinned).map((i) => i.code);
    if (candidates.length < 2 || !activeCode) return;
    const idx = candidates.indexOf(activeCode);
    const next = candidates[(idx + 1) % candidates.length];
    if (!next) return;

    queryClient.prefetchQuery({ queryKey: ['candles', next], queryFn: () => api<Candle[]>(`/api/v1/market/candles?code=${next}&tf=1d&count=200`) });
    queryClient.prefetchQuery({ queryKey: ['news', next], queryFn: () => api<NewsItem[]>(`/api/v1/news?code=${next}&limit=50`) });
  }, [rotation.state, activeCode, items]);

  return (
    <main>
      <h1>Watchlist Monitor (Split View)</h1>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={selectedSetId ?? ''} onChange={(e) => { pauseInteraction(); setSelectedSetId(Number(e.target.value) || null); }}>
          <option value="">세트 선택</option>
          {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={selectedGroupId ?? ''} onChange={(e) => { pauseInteraction(); setSelectedGroupId(Number(e.target.value) || null); }}>
          <option value="">그룹 선택</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <RotationControls
        state={rotation.state}
        remainingSec={rotation.remainingSec}
        lockCode={rotation.lockCode}
        lockEnabled={Boolean(rotation.lockCode)}
        onPrev={() => { pauseInteraction(); rotation.prev(); }}
        onPlay={() => rotation.play()}
        onPause={() => rotation.pauseByUser()}
        onNext={() => { pauseInteraction(); rotation.next(); }}
        onToggleLock={(on) => { pauseInteraction(); rotation.toggleLock(on); }}
        onLockCurrent={() => { pauseInteraction(); rotation.lockCurrent(); }}
      />
      {rotation.state === 'PAUSED_NO_TARGET' && <p style={{ color: '#b45309' }}>PIN 제외 후 로테이션 대상이 없습니다.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginTop: 8 }}>
        <WatchGrid
          items={items}
          snapshots={snapshots}
          activeCode={activeCode}
          search={search}
          onSearch={setSearch}
          onInteraction={pauseInteraction}
          onSelect={(code) => rotation.setActiveCode(code)}
          onTogglePin={async (itemId, pinned) => {
            if (!selectedGroupId) return;
            pauseInteraction();
            await api(`/api/v1/watch/groups/${selectedGroupId}/items/${itemId}`, {
              method: 'PATCH',
              body: JSON.stringify({ pinned }),
            });
            const refreshed = await api<WatchItem[]>(`/api/v1/watch/groups/${selectedGroupId}/items`);
            setItems(refreshed.sort((a, b) => a.sort_order - b.sort_order));
          }}
        />

        <div style={{ display: 'grid', gap: 12 }}>
          <ChartPanel code={viewCode} candles={candles} onInteraction={pauseInteraction} />
          <DetailTabs
            tab={tab}
            onTabChange={setTab}
            news={news}
            memo={memo}
            memoDraft={memoDraft}
            onMemoDraftChange={setMemoDraft}
            onSave={async () => {
              if (!activeCode) return;
              const saved = await api<Memo>(`/api/v1/stocks/${activeCode}/memo`, {
                method: 'PUT',
                body: JSON.stringify({ content: memoDraft }),
              });
              setMemo(saved);
            }}
            snapshot={activeSnapshot}
            onInteraction={pauseInteraction}
          />
        </div>
      </div>
    </main>
  );
}
