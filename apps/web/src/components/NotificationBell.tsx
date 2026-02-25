'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getMatchLogs, getPipelineStats } from '@/lib/pipeline-api';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { MatchLog } from '@/types/pipeline';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<MatchLog[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe } = usePushNotifications();

  // Poll review count every minute
  useEffect(() => {
    async function loadCount() {
      try {
        const stats = await getPipelineStats({ days: 30 });
        setCount(stats.overview?.total_review ?? 0);
      } catch {}
    }
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch preview items when panel opens
  useEffect(() => {
    if (!open) return;
    setItems([]);
    getMatchLogs({
      matched: true,
      confidence_min: 0.60,
      confidence_max: 0.849,
      reviewed: 'false',
      per_page: 5,
    }).then(res => setItems(res.matches)).catch(() => {});
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative px-3 pb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ease-out ${
          open
            ? 'bg-[var(--sidebar-muted)] text-[var(--foreground)]'
            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-muted)]'
        }`}
      >
        <div className="relative w-[18px] h-[18px] flex-shrink-0">
          <Bell className="w-full h-full" strokeWidth={1.8} />
          <AnimatePresence>
            {count > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none"
              >
                {count > 9 ? '9+' : count}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span>Notifications</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-full top-0 ml-3 w-80 bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-[var(--border)] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[var(--foreground)]">À revoir</h3>
              {count > 0 && (
                <span className="text-[11px] font-medium text-amber-500 bg-amber-50 px-2.5 py-0.5 rounded-full">
                  {count} en attente
                </span>
              )}
            </div>

            {/* Review items */}
            {items.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-[var(--muted-foreground)]">
                {count === 0 ? 'Tout est à jour ✓' : 'Chargement...'}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="px-4 py-3"
                  >
                    <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                      {item.sender_name || item.sender_email}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                      {item.dossier_name ? `→ ${item.dossier_name}` : item.sender_email}
                    </p>
                    {item.confidence !== null && (
                      <p className="text-[10px] text-amber-500 mt-0.5 font-medium">
                        {Math.round((item.confidence ?? 0) * 100)}% confiance
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* View all */}
            <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--muted)]">
              <Link
                href="/dashboard/review/queue"
                onClick={() => setOpen(false)}
                className="block text-center text-[12px] font-medium text-[var(--foreground)] hover:opacity-60 transition-opacity duration-150"
              >
                Voir toute la file →
              </Link>
            </div>

            {/* Push notification toggle */}
            {isSupported && permission !== 'denied' && (
              <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSubscribed ? (
                    <Bell className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.8} />
                  ) : (
                    <BellOff className="w-3.5 h-3.5 text-[var(--muted-foreground)]" strokeWidth={1.8} />
                  )}
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    {isSubscribed ? 'Alertes bureau actives' : 'Alertes bureau désactivées'}
                  </span>
                </div>
                <button
                  onClick={isSubscribed ? unsubscribe : subscribe}
                  disabled={isLoading}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all duration-200 disabled:opacity-50 ${
                    isSubscribed
                      ? 'text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50'
                      : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {isLoading ? '...' : isSubscribed ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            )}

            {isSupported && permission === 'denied' && (
              <div className="px-4 py-2.5 border-t border-[var(--border)]">
                <p className="text-[10px] text-[var(--muted-foreground)] text-center">
                  Alertes bloquées — autoriser dans les paramètres du navigateur
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
