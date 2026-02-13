'use client';

import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { SnapshotItem, WatchItem } from '../_types/monitor';

type Row = SnapshotItem & { itemId: number; pinned: boolean };

const fmtInt = (v: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const fmtSigned = (v: number) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(Math.round(v)).toLocaleString('ko-KR')}`;
const fmtPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(2)}%`;
const fmtEok = (v: number) => `${(v / 100000000).toFixed(2)}억`;
const hhmmss = (iso: string) => new Date(iso).toTimeString().slice(0, 8);

export function WatchGrid({
  items,
  snapshots,
  activeCode,
  search,
  onSearch,
  onSelect,
  onTogglePin,
  onInteraction,
}: {
  items: WatchItem[];
  snapshots: SnapshotItem[];
  activeCode?: string;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (code: string) => void;
  onTogglePin: (itemId: number, pinned: boolean) => void;
  onInteraction: () => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'changePct', desc: true }]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo<Row[]>(() => {
    const map = new Map(snapshots.map((v) => [v.code, v]));
    return items
      .map((item) => {
        const s = map.get(item.code);
        if (!s) return null;
        return { ...s, itemId: item.id, pinned: item.pinned };
      })
      .filter(Boolean) as Row[];
  }, [items, snapshots]);

  const filtered = useMemo(
    () => rows.filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'pinned',
        header: 'PIN',
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInteraction();
              onTogglePin(row.original.itemId, !row.original.pinned);
            }}
          >
            {row.original.pinned ? '📌' : '○'}
          </button>
        ),
      },
      { accessorKey: 'code', header: '코드' },
      { accessorKey: 'name', header: '종목명' },
      { accessorKey: 'last', header: '현재가', cell: ({ row }) => fmtInt(row.original.last) },
      { accessorKey: 'change', header: '전일대비', cell: ({ row }) => fmtSigned(row.original.change) },
      { accessorKey: 'changePct', header: '등락률', cell: ({ row }) => fmtPct(row.original.changePct) },
      { accessorKey: 'volume', header: '거래량', cell: ({ row }) => fmtInt(row.original.volume) },
      { accessorKey: 'value', header: '거래대금', cell: ({ row }) => fmtEok(row.original.value) },
      { accessorKey: 'open', header: '시가', cell: ({ row }) => fmtInt(row.original.open) },
      { accessorKey: 'high', header: '고가', cell: ({ row }) => fmtInt(row.original.high) },
      { accessorKey: 'low', header: '저가', cell: ({ row }) => fmtInt(row.original.low) },
      { accessorKey: 'prevClose', header: '전일종가', cell: ({ row }) => fmtInt(row.original.prevClose) },
      { accessorKey: 'time', header: '시간', cell: ({ row }) => hhmmss(row.original.time) },
    ],
    [onInteraction, onTogglePin],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      onInteraction();
      setSorting(typeof updater === 'function' ? updater(sorting) : updater);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const v = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => wrapRef.current,
    estimateSize: () => 34,
    overscan: 10,
  });

  return (
    <section>
      <input
        placeholder="검색(코드/종목명)"
        value={search}
        onChange={(e) => {
          onInteraction();
          onSearch(e.target.value);
        }}
        style={{ width: '100%', marginBottom: 8 }}
      />
      <div ref={wrapRef} onScroll={onInteraction} style={{ height: 560, overflow: 'auto', border: '1px solid #ddd' }}>
        <table style={{ width: '100%', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} style={{ textAlign: 'left', padding: 6, cursor: h.column.getCanSort() ? 'pointer' : 'default' }} onClick={h.column.getToggleSortingHandler()}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        </table>
        <div style={{ height: v.getTotalSize(), position: 'relative' }}>
          {v.getVirtualItems().map((vr) => {
            const row = table.getRowModel().rows[vr.index];
            const up = row.original.change > 0;
            const down = row.original.change < 0;
            const color = up ? '#b91c1c' : down ? '#1d4ed8' : '#4b5563';
            const bg = row.original.code === activeCode ? '#dbeafe' : '#fff';
            return (
              <div
                key={row.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vr.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: '0.7fr 1fr 1.2fr repeat(10, 1fr)',
                  padding: '6px',
                  borderBottom: '1px solid #f1f5f9',
                  background: bg,
                  fontSize: 12,
                  color,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  onInteraction();
                  onSelect(row.original.code);
                }}
              >
                <span>{row.original.pinned ? '📌' : ''}</span>
                <span>{row.original.code}</span>
                <span style={{ color: '#111827' }}>{row.original.name}</span>
                <span>{fmtInt(row.original.last)}</span>
                <span>{fmtSigned(row.original.change)}</span>
                <span>{fmtPct(row.original.changePct)}</span>
                <span>{fmtInt(row.original.volume)}</span>
                <span>{fmtEok(row.original.value)}</span>
                <span>{fmtInt(row.original.open)}</span>
                <span>{fmtInt(row.original.high)}</span>
                <span>{fmtInt(row.original.low)}</span>
                <span>{fmtInt(row.original.prevClose)}</span>
                <span>{hhmmss(row.original.time)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
