'use client';

import { Memo, NewsItem, SnapshotItem } from '../_types/monitor';

type Tab = 'news' | 'memo' | 'detail';

export function DetailTabs({
  tab,
  onTabChange,
  news,
  memo,
  memoDraft,
  onMemoDraftChange,
  onSave,
  snapshot,
  onInteraction,
}: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  news: NewsItem[];
  memo: Memo | null;
  memoDraft: string;
  onMemoDraftChange: (v: string) => void;
  onSave: () => void;
  snapshot?: SnapshotItem;
  onInteraction: () => void;
}) {
  return (
    <section style={{ border: '1px solid #ddd', background: '#fff', padding: 8, minHeight: 240 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {(['news', 'memo', 'detail'] as const).map((t) => (
          <button key={t} onClick={() => { onInteraction(); onTabChange(t); }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'news' && (
        <ul>
          {news.map((n) => (
            <li key={n.id} style={{ marginBottom: 8 }}>
              <div><strong>{n.title}</strong></div>
              <small>{n.source} · {n.category} · {new Date(n.ts).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}

      {tab === 'memo' && (
        <div>
          <textarea
            rows={7}
            style={{ width: '100%' }}
            value={memoDraft}
            onChange={(e) => { onInteraction(); onMemoDraftChange(e.target.value); }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <small>updated: {memo?.updated_at ?? '-'}</small>
            <button onClick={() => { onInteraction(); onSave(); }}>저장</button>
          </div>
        </div>
      )}

      {tab === 'detail' && (
        <div>
          <p>코드: {snapshot?.code ?? '-'}</p>
          <p>종목명: {snapshot?.name ?? '-'}</p>
          <p>현재가: {snapshot?.last?.toLocaleString() ?? '-'}</p>
          <p>등락률: {snapshot ? `${snapshot.changePct > 0 ? '+' : snapshot.changePct < 0 ? '-' : ''}${Math.abs(snapshot.changePct).toFixed(2)}%` : '-'}</p>
          <p>거래대금: {snapshot ? `${(snapshot.value / 100000000).toFixed(2)}억` : '-'}</p>
        </div>
      )}
    </section>
  );
}
