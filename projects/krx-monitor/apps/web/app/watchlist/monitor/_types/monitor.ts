export type RotationState = 'STOPPED' | 'PLAYING' | 'PAUSED_USER' | 'PAUSED_INTERACTION' | 'PAUSED_NO_TARGET';

export type WatchSet = { id: number; name: string };
export type WatchGroup = { id: number; set_id: number; name: string; rotation_interval_sec: number };
export type WatchItem = { id: number; group_id: number; code: string; sort_order: number; pinned: boolean };

export type SnapshotItem = {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  ts: string;
};

export type NewsItem = {
  id: string;
  code: string;
  title: string;
  summary: string;
  publishedAt: string;
};

export type Memo = {
  code: string;
  content: string;
  updated_at: string | null;
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
