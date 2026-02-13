'use client';

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';
import { SnapshotItem, WatchItem } from '../_types/monitor';

type RowData = SnapshotItem & { pinned: boolean };

type Props = {
  items: WatchItem[];
  snapshots: SnapshotItem[];
  activeCode?: string;
  onSelect: (code: string) => void;
  onInteraction: () => void;
};

export function MonitorGrid({ items, snapshots, activeCode, onSelect, onInteraction }: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo<RowData[]>(() => {
    const map = new Map(snapshots.map((s) => [s.code, s]));
    return items.map((item) => {
      const snapshot = map.get(item.code);
      return {
        code: item.code,
        price: snapshot?.price ?? 0,
        change: snapshot?.change ?? 0,
        changePct: snapshot?.changePct ?? 0,
        volume: snapshot?.volume ?? 0,
        ts: snapshot?.ts ?? '',
        pinned: item.pinned,
      };
    });
  }, [items, snapshots]);

  const columns = useMemo<ColumnDef<RowData>[]>(
    () => [
      { accessorKey: 'code', header: 'Code' },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => row.original.price.toLocaleString(),
      },
      {
        accessorKey: 'changePct',
        header: 'Chg%',
        cell: ({ row }) => `${row.original.changePct.toFixed(2)}%`,
      },
      {
        accessorKey: 'pinned',
        header: 'PIN',
        cell: ({ row }) => (row.original.pinned ? '📌' : ''),
      },
    ],
    [],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  const tableRows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      style={{ height: 520, overflow: 'auto', border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}
      onScroll={onInteraction}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} style={{ textAlign: 'left', fontSize: 12, padding: 8 }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
      </table>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = tableRows[virtualRow.index];
          const isActive = row.original.code === activeCode;

          return (
            <div
              key={row.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 0.6fr',
                width: '100%',
                padding: '8px',
                background: isActive ? '#dbeafe' : '#fff',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                fontSize: 13,
              }}
              onClick={() => {
                onInteraction();
                onSelect(row.original.code);
              }}
            >
              <span>{row.original.code}</span>
              <span>{row.original.price.toLocaleString()}</span>
              <span style={{ color: row.original.changePct >= 0 ? '#dc2626' : '#2563eb' }}>
                {row.original.changePct.toFixed(2)}%
              </span>
              <span>{row.original.pinned ? '📌' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
