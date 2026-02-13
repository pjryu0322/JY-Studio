'use client';

import { useEffect, useMemo, useState } from 'react';

type WatchSet = { id: number; name: string };
type WatchGroup = { id: number; set_id: number; name: string; rotation_interval_sec: number };
type WatchItem = { id: number; group_id: number; code: string; sort_order: number; pinned: boolean };
type StockOption = { code: string; name: string; market: string | null };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export default function WatchlistEditorPage() {
  const [sets, setSets] = useState<WatchSet[]>([]);
  const [groups, setGroups] = useState<WatchGroup[]>([]);
  const [items, setItems] = useState<WatchItem[]>([]);

  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const [setName, setSetName] = useState('');
  const [groupName, setGroupName] = useState('');

  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<StockOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedItems = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items]);

  async function loadSets() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<WatchSet[]>('/api/v1/watch/sets');
      setSets(data);
      if (!selectedSetId && data.length > 0) {
        setSelectedSetId(data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '세트 로딩 실패');
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups(setId: number) {
    setError(null);
    try {
      const data = await api<WatchGroup[]>(`/api/v1/watch/sets/${setId}/groups`);
      setGroups(data);
      if (data.length > 0) {
        setSelectedGroupId((prev) => (prev && data.some((g) => g.id === prev) ? prev : data[0].id));
      } else {
        setSelectedGroupId(null);
        setItems([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '그룹 로딩 실패');
    }
  }

  async function loadItems(groupId: number) {
    setError(null);
    try {
      const data = await api<WatchItem[]>(`/api/v1/watch/groups/${groupId}/items`);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '아이템 로딩 실패');
    }
  }

  useEffect(() => {
    loadSets();
  }, []);

  useEffect(() => {
    if (selectedSetId) {
      loadGroups(selectedSetId);
    }
  }, [selectedSetId]);

  useEffect(() => {
    if (selectedGroupId) {
      loadItems(selectedGroupId);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 1) {
        setOptions([]);
        return;
      }

      try {
        const data = await api<StockOption[]>(`/api/v1/stocks/search?q=${encodeURIComponent(query)}`);
        setOptions(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : '검색 실패');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  async function createSet() {
    if (!setName.trim()) return;
    await api('/api/v1/watch/sets', { method: 'POST', body: JSON.stringify({ name: setName.trim() }) });
    setSetName('');
    await loadSets();
  }

  async function deleteSet() {
    if (!selectedSetId) return;
    await api(`/api/v1/watch/sets/${selectedSetId}`, { method: 'DELETE' });
    setSelectedSetId(null);
    setGroups([]);
    setItems([]);
    await loadSets();
  }

  async function createGroup() {
    if (!selectedSetId || !groupName.trim()) return;
    await api(`/api/v1/watch/sets/${selectedSetId}/groups`, {
      method: 'POST',
      body: JSON.stringify({ name: groupName.trim() }),
    });
    setGroupName('');
    await loadGroups(selectedSetId);
  }

  async function deleteGroup() {
    if (!selectedSetId || !selectedGroupId) return;
    await api(`/api/v1/watch/sets/${selectedSetId}/groups/${selectedGroupId}`, { method: 'DELETE' });
    await loadGroups(selectedSetId);
  }

  async function addCode(code: string) {
    if (!selectedGroupId) return;
    await api(`/api/v1/watch/groups/${selectedGroupId}/items`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    await loadItems(selectedGroupId);
  }

  async function removeItem(itemId: number) {
    if (!selectedGroupId) return;
    await api(`/api/v1/watch/groups/${selectedGroupId}/items/${itemId}`, { method: 'DELETE' });
    await loadItems(selectedGroupId);
  }

  async function togglePin(item: WatchItem) {
    if (!selectedGroupId) return;
    await api(`/api/v1/watch/groups/${selectedGroupId}/items/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned: !item.pinned }),
    });
    await loadItems(selectedGroupId);
  }

  async function moveItem(index: number, dir: -1 | 1) {
    if (!selectedGroupId) return;
    const target = index + dir;
    if (target < 0 || target >= orderedItems.length) return;

    const reordered = [...orderedItems];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(target, 0, removed);

    await api(`/api/v1/watch/groups/${selectedGroupId}/items/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedCodes: reordered.map((item) => item.code) }),
    });

    await loadItems(selectedGroupId);
  }

  return (
    <main>
      <h1>Watchlist Editor</h1>
      {loading && <p>로딩 중...</p>}
      {error && <p style={{ color: '#b91c1c' }}>에러: {error}</p>}

      <section>
        <h2>세트</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selectedSetId ?? ''} onChange={(e) => setSelectedSetId(Number(e.target.value) || null)}>
            <option value="">세트 선택</option>
            {sets.map((setItem) => (
              <option key={setItem.id} value={setItem.id}>
                {setItem.name}
              </option>
            ))}
          </select>
          <input placeholder="세트 이름" value={setName} onChange={(e) => setSetName(e.target.value)} />
          <button onClick={createSet}>생성</button>
          <button onClick={deleteSet} disabled={!selectedSetId}>
            삭제
          </button>
        </div>
        {sets.length === 0 && <p>세트가 없습니다. 새로 만들어 주세요.</p>}
      </section>

      <section>
        <h2>그룹</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selectedGroupId ?? ''} onChange={(e) => setSelectedGroupId(Number(e.target.value) || null)}>
            <option value="">그룹 선택</option>
            {groups.map((groupItem) => (
              <option key={groupItem.id} value={groupItem.id}>
                {groupItem.name}
              </option>
            ))}
          </select>
          <input placeholder="그룹 이름" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <button onClick={createGroup} disabled={!selectedSetId}>
            생성
          </button>
          <button onClick={deleteGroup} disabled={!selectedGroupId}>
            삭제
          </button>
        </div>
        {selectedSetId && groups.length === 0 && <p>그룹이 없습니다. 새로 만들어 주세요.</p>}
      </section>

      <section>
        <h2>종목 검색 및 추가</h2>
        <input
          placeholder="종목 코드/이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!selectedGroupId}
        />
        {query && options.length === 0 && <p>검색 결과가 없습니다.</p>}
        <ul>
          {options.map((stock) => (
            <li key={stock.code}>
              {stock.code} - {stock.name} ({stock.market ?? 'N/A'})
              <button onClick={() => addCode(stock.code)} disabled={!selectedGroupId} style={{ marginLeft: 8 }}>
                추가
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>아이템 목록</h2>
        {selectedGroupId && orderedItems.length === 0 && <p>아이템이 없습니다.</p>}
        <ul>
          {orderedItems.map((item, index) => (
            <li key={item.id}>
              {item.sort_order}. {item.code} {item.pinned ? '📌' : ''}
              <button onClick={() => moveItem(index, -1)} disabled={index === 0} style={{ marginLeft: 8 }}>
                ↑
              </button>
              <button
                onClick={() => moveItem(index, 1)}
                disabled={index === orderedItems.length - 1}
                style={{ marginLeft: 4 }}
              >
                ↓
              </button>
              <button onClick={() => togglePin(item)} style={{ marginLeft: 4 }}>
                PIN 토글
              </button>
              <button onClick={() => removeItem(item.id)} style={{ marginLeft: 4 }}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
