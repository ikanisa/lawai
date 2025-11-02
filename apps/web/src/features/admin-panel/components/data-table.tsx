'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@avocat-ai/ui';
import { Input } from '@avocat-ai/ui';
import { Badge } from '@avocat-ai/ui';
import { ArrowDownToLine, FileJson, Filter } from 'lucide-react';

export interface AdminTableColumn<T> {
  key: keyof T & string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface AdminDataTableProps<T> {
  data: T[];
  columns: AdminTableColumn<T>[];
  emptyState?: string;
  filterLabel?: string;
  searchQuery?: string;
  storageKey?: string;
  onRowSelect?: (row: T) => void;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv<T>(rows: T[], columns: AdminTableColumn<T>[]) {
  const header = columns.map((col) => JSON.stringify(col.header)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key as keyof T];
        if (value === null || value === undefined) {
          return '""';
        }
        return JSON.stringify(String(value));
      })
      .join(','),
  );
  return [header, ...lines].join('\n');
}

interface SavedView {
  name: string;
  filter: string;
  createdAt: string;
}

export function AdminDataTable<T extends Record<string, unknown>>({
  data,
  columns,
  emptyState = 'No entries found',
  filterLabel = 'Filters',
  searchQuery,
  storageKey,
  onRowSelect,
}: AdminDataTableProps<T>) {
  const [filter, setFilter] = useState('');
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedView, setSelectedView] = useState<string>('');

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedView[];
        setViews(parsed);
      }
    } catch (error) {
      console.warn('Failed to load saved views', error);
    }
  }, [storageKey]);

  const persistViews = (nextViews: SavedView[]) => {
    setViews(nextViews);
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(nextViews));
    }
  };

  const tokens = useMemo(() => {
    return [filter, searchQuery]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }, [filter, searchQuery]);

  const filtered = useMemo(() => {
    if (tokens.length === 0) return data;
    return data.filter((row) =>
      tokens.every((token) =>
        columns.some((col) => {
          const value = row[col.key];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(token);
          }
          if (typeof value === 'number') {
            return value.toString().includes(token);
          }
          return false;
        }),
      ),
    );
  }, [columns, data, tokens]);

  const handleSaveView = () => {
    const name = prompt('Name this view');
    if (!name) return;
    const view: SavedView = { name, filter, createdAt: new Date().toISOString() };
    persistViews([...views.filter((existing) => existing.name !== name), view]);
    setSelectedView(name);
  };

  const handleApplyView = (name: string) => {
    if (!name) {
      setSelectedView('');
      setFilter('');
      return;
    }
    const view = views.find((item) => item.name === name);
    if (view) {
      setSelectedView(name);
      setFilter(view.filter);
    }
  };

  const handleDeleteView = (name: string) => {
    persistViews(views.filter((item) => item.name !== name));
    if (selectedView === name) {
      setSelectedView('');
      setFilter('');
    }
  };

  const handleCsvExport = () => {
    const csv = toCsv(filtered, columns);
    downloadFile('admin-export.csv', csv, 'text/csv;charset=utf-8;');
  };

  const handleJsonExport = () => {
    const json = JSON.stringify(filtered, null, 2);
    downloadFile('admin-export.json', json, 'application/json');
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="h-4 w-4" />
          <span>{filterLabel}</span>
          {filter && <Badge variant="secondary">{filter}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search rows"
            className="h-9 w-48 bg-slate-900/80"
          />
          {views.length > 0 && (
            <select
              value={selectedView}
              onChange={(event) => handleApplyView(event.target.value)}
              className="h-9 rounded-md border border-slate-700/70 bg-slate-900 px-2 text-sm"
              aria-label="Saved views"
            >
              <option value="">Default view</option>
              {views.map((view) => (
                <option key={view.name} value={view.name}>
                  {view.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" size="sm" onClick={handleSaveView}>
            Save view
          </Button>
          {selectedView && (
            <Button variant="ghost" size="sm" onClick={() => handleDeleteView(selectedView)}>
              Delete view
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCsvExport}>
            <ArrowDownToLine className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleJsonExport}>
            <FileJson className="h-4 w-4" /> JSON
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2 font-semibold">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filtered.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={columns.length}>
                  {emptyState}
                </td>
              </tr>
            )}
            {filtered.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`hover:bg-slate-800/40 ${onRowSelect ? 'cursor-pointer' : ''}`}
                onClick={() => onRowSelect?.(row)}
                tabIndex={onRowSelect ? 0 : -1}
                onKeyDown={(event) => {
                  if (onRowSelect && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onRowSelect(row);
                  }
                }}
                role={onRowSelect ? 'button' : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
