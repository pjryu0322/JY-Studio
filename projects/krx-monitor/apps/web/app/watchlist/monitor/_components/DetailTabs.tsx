'use client';

import { Memo, NewsItem, RotationState, SnapshotItem } from '../_types/monitor';

type Tab = 'news' | 'memo' | 'detail';

type Props = {
  code?: string;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  news: NewsItem[];
  memo: Memo | null;
  memoDraft: string;
  onMemoDraftChange: (value: string) => void;
  onMemoSave: () => void;
  snapshot?: SnapshotItem;
  rotationState: RotationState;
  onInteraction: () => void;
};

export function DetailTabs({
  code,
  tab,
  onTabChange,
  news,
  memo,
  memoDraft,
  onMemoDraftChange,
  onMemoSave,
  snapshot,
  rotationState,
  onInteraction,
}: Props) {
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: 8, minHeight: 220 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {(['news', 'memo', 'detail'] as const).map((item) => (
          <button
            key={item}
            onClick={() => {
              onInteraction();
              onTabChange(item);
            }}
            style={{ background: tab === item ? '#2563eb' : '#e5e7eb', color: tab === item ? '#fff' : '#111827' }}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'news' && (
        <div>
          {news.length === 0 ? (
            <p>뉴스가 없습니다.</p>
          ) : (
            <ul>
              {news.map((item) => (
                <li key={item.id} style={{ marginBottom: 8 }}>
                  <strong>{item.title}</strong>
                  <p style={{ margin: 0 }}>{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'memo' && (
        <div>
          <textarea
            value={memoDraft}
            onChange={(e) => {
              onInteraction();
              onMemoDraftChange(e.target.value);
            }}
            rows={6}
            style={{ width: '100%' }}
            placeholder={code ? `${code} 메모 입력` : '종목 선택 필요'}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <small>updated: {memo?.updated_at ?? '-'}</small>
            <button onClick={onMemoSave} disabled={!code}>
              저장
            </button>
          </div>
        </div>
      )}

      {tab === 'detail' && (
        <div>
          <p>state: {rotationState}</p>
          <p>code: {code ?? '-'}</p>
          <p>price: {snapshot?.price?.toLocaleString() ?? '-'}</p>
          <p>change: {snapshot ? `${snapshot.changePct.toFixed(2)}%` : '-'}</p>
          <p>volume: {snapshot?.volume?.toLocaleString() ?? '-'}</p>
        </div>
      )}
    </section>
  );
}
