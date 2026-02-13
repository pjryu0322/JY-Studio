export type RotationState = 'STOPPED' | 'PLAYING' | 'PAUSED_USER' | 'PAUSED_INTERACTION' | 'PAUSED_NO_TARGET';

export type WatchSet = { id: number; name: string };
export type WatchGroup = { id: number; set_id: number; name: string; rotation_interval_sec: number };
export type WatchItem = { id: number; group_id: number; code: string; sort_order: number; pinned: boolean };

export type SnapshotItem = {
  code: string;
  name: string;
  last: number;
  prevClose: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  value: number;
  time: string;
};

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type NewsItem = { id: string; ts: string; title: string; source: string; category: string };

export type Memo = { code: string; content: string; updated_at: string | null };
