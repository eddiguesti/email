'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import type { SenderHistoryEntry } from '@/types/pipeline';
import { getSenderHistory } from '@/lib/pipeline-api';

export default function SendersPage() {
  const [senders, setSenders] = useState<SenderHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSenderHistory({ limit: 200, search: search || undefined });
      setSenders(res.senders);
      setTotal(res.total);
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
        <input
          type="text"
          placeholder="Search a sender..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 text-[13px] rounded-xl bg-[var(--muted)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200"
        />
      </div>

      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
        <span className="text-[13px] text-[var(--muted-foreground)]">
          {total} known sender{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--border)] text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
          <div className="flex-1">Sender</div>
          <div className="w-48 hidden md:block">Booking</div>
          <div className="w-20 text-center">Occurrences</div>
          <div className="w-20 text-center">Confidence</div>
          <div className="w-28 text-right">Last Contact</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-[13px] text-[var(--muted-foreground)]">Loading...</div>
        ) : senders.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[var(--muted-foreground)]">No senders found</div>
        ) : (
          senders.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)] transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--foreground)] truncate">{s.sender_email}</p>
              </div>
              <div className="w-48 hidden md:block">
                <p className="text-[13px] text-[var(--foreground)] truncate">{s.dossier_name}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">[{s.dossier_ref}]</p>
              </div>
              <div className="w-20 text-center">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-[13px] font-medium ${
                  s.match_count >= 5
                    ? 'bg-emerald-50 text-emerald-600'
                    : s.match_count >= 2
                    ? 'bg-blue-50 text-[var(--accent)]'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                }`}>
                  {s.match_count}
                </span>
              </div>
              <div className="w-20 text-center">
                <span className={`text-[13px] font-medium ${
                  s.avg_confidence >= 0.85 ? 'text-emerald-500' :
                  s.avg_confidence >= 0.60 ? 'text-amber-500' : 'text-red-400'
                }`}>
                  {Math.round(s.avg_confidence * 100)}%
                </span>
              </div>
              <div className="w-28 text-right">
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {s.last_seen && !isNaN(new Date(s.last_seen).getTime()) ? formatDistanceToNow(new Date(s.last_seen), { addSuffix: true }) : '—'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
