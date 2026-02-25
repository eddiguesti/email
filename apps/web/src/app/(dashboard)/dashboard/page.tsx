'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  FolderOpen,
  RefreshCw,
  Eye,
  CalendarDays,
  MapPin,
  Video,
  LayoutGrid,
} from 'lucide-react';
import type { PipelineStats, MatchLog, PipelineRun } from '@/types/pipeline';
import { MATCH_SOURCE_LABELS } from '@/types/pipeline';
import { getPipelineStats, getMatchLogs, getPipelineRuns } from '@/lib/pipeline-api';
import MatchRateChart from '@/components/pipeline/MatchRateChart';
import FeatureTour from '@/components/FeatureTour';
import { useAuth } from '@/context/AuthContext';

const TOUR_KEY = 'lb_tour_dismissed';

const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string;
  isAllDay: boolean;
  onlineMeetingUrl?: string;
}

function formatEventTime(iso: string, isAllDay: boolean): string {
  if (isAllDay) return 'Journée';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso));
}


export default function DashboardPage() {
  const { user } = useAuth();
  const userMailbox = user?.email || '';
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchLog[]>([]);
  const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  // Initialise tour visibility from localStorage (client-only)
  useEffect(() => {
    setShowTour(!localStorage.getItem(TOUR_KEY));
  }, []);

  const dismissTour = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setShowTour(false);
  };

  const load = async () => {
    if (!userMailbox) return;
    setLoading(true);
    try {
      const now = new Date();
      const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [statsRes, matchesRes, runsRes, eventsRes] = await Promise.all([
        getPipelineStats({ days: 30 }),
        getMatchLogs({ mailbox: userMailbox, matched: true, per_page: 10 }),
        getPipelineRuns({ limit: 3 }),
        fetch(
          `/api/calendar/events?startDate=${now.toISOString()}&endDate=${weekAhead.toISOString()}`
        ).then((r) => (r.ok ? r.json() : { events: [] })),
      ]);
      setStats(statsRes);
      setRecentMatches(matchesRes.matches);
      setRecentRuns(runsRes.runs);
      setUpcomingEvents((eventsRes.events || []).slice(0, 4));
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userMailbox]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 bg-[var(--muted)] rounded-xl w-1/3 animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-[var(--muted)] rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className="h-72 bg-[var(--muted)] rounded-2xl animate-shimmer" />
      </div>
    );
  }

  const o = stats?.overview;
  const matchRate = Math.round((o?.match_rate || 0) * 100);

  const dossierMap = new Map<string, { ref: string; name: string; lawyer: string; count: number; lastSeen: string }>();
  for (const m of recentMatches) {
    if (!m.dossier_ref) continue;
    const existing = dossierMap.get(m.dossier_ref);
    if (existing) {
      existing.count++;
    } else {
      dossierMap.set(m.dossier_ref, {
        ref: m.dossier_ref,
        name: m.dossier_name || m.dossier_ref,
        lawyer: m.lawyer || '',
        count: 1,
        lastSeen: m.received_at || m.created_at,
      });
    }
  }
  const topDossiers = Array.from(dossierMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">
            Tableau de bord
          </h1>
          <p className="text-[14px] text-[var(--muted-foreground)] mt-1">
            {userMailbox} &mdash; 30 derniers jours
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showTour && (
            <button
              onClick={() => setShowTour(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-xl hover:bg-[var(--muted)] transition-all duration-200"
            >
              <LayoutGrid className="w-4 h-4" strokeWidth={1.8} />
              Présentation
            </button>
          )}
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-xl hover:bg-[var(--muted)] transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.8} />
            Actualiser
          </button>
        </div>
      </motion.div>

      {/* Feature Tour */}
      <AnimatePresence>
        {showTour && (
          <motion.div variants={fadeUp}>
            <FeatureTour onDismiss={dismissTour} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          icon={<Mail className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          label="Emails traités"
          value={o?.total_processed || 0}
          sub={`${o?.total_matched || 0} classés`}
        />
        <StatCard
          icon={<CheckCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          label="Taux de classement"
          value={`${matchRate}%`}
          sub={matchRate >= 90 ? 'Excellent' : matchRate >= 80 ? 'Bon' : 'À améliorer'}
          accent={matchRate >= 90 ? 'var(--success)' : matchRate >= 80 ? 'var(--accent)' : 'var(--warning)'}
        />
        <StatCard
          icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          label="Auto-classés"
          value={o?.total_auto_file || 0}
          sub="Confiance ≥ 85 %"
        />
        <StatCard
          icon={<AlertTriangle className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          label="À revoir"
          value={o?.total_review || 0}
          sub={
            <Link href="/dashboard/review/queue" className="text-[var(--accent)] hover:underline">
              Voir la file
            </Link>
          }
        />
      </motion.div>

      {/* Chart */}
      {stats && stats.daily_stats.length > 0 && (
        <motion.div variants={fadeUp}>
          <MatchRateChart data={stats.daily_stats} />
        </motion.div>
      )}

      {/* Two-column layout */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Matches */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Correspondances récentes</h2>
            <Link
              href="/dashboard/review/matches"
              className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline font-medium"
            >
              Tout voir <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <div className="px-6 pb-6 text-center text-[13px] text-[var(--muted-foreground)]">
              Aucune correspondance
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentMatches.slice(0, 6).map(m => (
                <div key={m.id} className="px-6 py-3.5 hover:bg-[var(--muted)] transition-colors duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                        {m.dossier_name || m.dossier_ref || 'Sans dossier'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[12px] text-[var(--muted-foreground)]">
                          {m.sender_name || m.sender_email}
                        </span>
                        {m.received_at && (
                          <span className="text-[12px] text-[var(--muted-foreground)]">
                            {new Date(m.received_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.match_source && (
                        <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--muted)] text-[var(--muted-foreground)]">
                          {MATCH_SOURCE_LABELS[m.match_source] || m.match_source}
                        </span>
                      )}
                      <span className={`text-[12px] font-mono font-medium ${
                        (m.confidence || 0) >= 0.85 ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                      }`}>
                        {m.confidence ? `${Math.round(m.confidence * 100)}%` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Dossiers + Source Breakdown */}
        <div className="space-y-6">
          {topDossiers.length > 0 && (
            <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
              <div className="px-6 py-5">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Dossiers actifs</h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {topDossiers.map(d => (
                  <div key={d.ref} className="px-6 py-3.5 hover:bg-[var(--muted)] transition-colors duration-200">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                          {d.name}
                        </p>
                        <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                          Ref. {d.ref} {d.lawyer && `\u2014 ${d.lawyer}`}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] flex-shrink-0">
                        <Mail className="w-3 h-3" />
                        {d.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats && stats.source_breakdown.length > 0 && (
            <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">Sources de classement</h2>
              <div className="space-y-3.5">
                {stats.source_breakdown.map(s => {
                  const pct = o && o.total_matched > 0 ? Math.round((s.count / o.total_matched) * 100) : 0;
                  return (
                    <div key={s.source} className="flex items-center gap-3">
                      <div className="w-32 text-[12px] text-[var(--foreground)] truncate">
                        {MATCH_SOURCE_LABELS[s.source] || s.source.replace(/_/g, ' ')}
                      </div>
                      <div className="flex-1 bg-[var(--muted)] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-[var(--primary)] rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-8 text-right text-[12px] font-medium text-[var(--foreground)]">
                        {s.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Upcoming Calendar Events */}
      {upcomingEvents.length > 0 && (
        <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-[18px] h-[18px] text-[var(--muted-foreground)]" strokeWidth={1.8} />
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                Prochains rendez-vous
              </h2>
            </div>
            <Link
              href="/dashboard/calendar"
              className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline font-medium"
            >
              Voir le calendrier <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {upcomingEvents.map(ev => (
              <div key={ev.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-[var(--muted)] transition-colors duration-200">
                <div className="text-center w-10 flex-shrink-0">
                  <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase leading-tight">
                    {new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'Europe/Paris' }).format(new Date(ev.start))}
                  </p>
                  <p className="text-[20px] font-light text-[var(--foreground)] leading-tight">
                    {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(ev.start))}
                  </p>
                </div>
                <div className="w-px h-10 bg-[var(--border)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--foreground)] truncate">{ev.subject}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[12px] text-[var(--muted-foreground)]">
                      {formatEventTime(ev.start, ev.isAllDay)}
                      {!ev.isAllDay && ` – ${formatEventTime(ev.end, false)}`}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)] truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
                        {ev.location}
                      </span>
                    )}
                    {ev.onlineMeetingUrl && !ev.location && (
                      <span className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]">
                        <Video className="w-3 h-3" strokeWidth={1.8} />
                        En ligne
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] flex-shrink-0">
                  {new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'Europe/Paris' }).format(new Date(ev.start))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Pipeline Runs */}
      {recentRuns.length > 0 && (
        <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Exécutions récentes</h2>
            <Link
              href="/dashboard/review"
              className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline font-medium"
            >
              Tout voir <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentRuns.map(run => (
              <div key={run.id} className="px-6 py-3.5 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  run.status === 'completed' ? 'bg-[var(--success)]' : run.status === 'error' ? 'bg-[var(--destructive)]' : 'bg-[var(--warning)]'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--foreground)]">
                    {run.mailbox} &mdash; {run.emails_processed || 0} emails
                  </p>
                  <p className="text-[12px] text-[var(--muted-foreground)]">
                    {run.emails_matched || 0} classés, {run.emails_auto_filed || 0} auto-classés
                  </p>
                </div>
                <div className="text-[12px] text-[var(--muted-foreground)] flex-shrink-0">
                  {run.finished_at
                    ? new Date(run.finished_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : ''}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Links */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <QuickLink
          icon={<Eye className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="File de revue"
          description="Approuver ou rejeter les correspondances"
          href="/dashboard/review/queue"
        />
        <QuickLink
          icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Analytiques"
          description="Statistiques détaillées du pipeline"
          href="/dashboard/review/analytics"
        />
        <QuickLink
          icon={<FolderOpen className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Tuning"
          description="Précision et seuils de confiance"
          href="/dashboard/review/tuning"
        />
        <QuickLink
          icon={<CalendarDays className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Calendrier"
          description="Rendez-vous et suggestions d'agenda"
          href="/dashboard/calendar"
        />
      </motion.div>
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="p-5 bg-white rounded-2xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="text-[var(--muted-foreground)]">{icon}</div>
        <span className="text-[13px] text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className="text-[28px] font-light tracking-tight" style={accent ? { color: accent } : { color: 'var(--foreground)' }}>
        {value}
      </p>
      <div className="text-[12px] text-[var(--muted-foreground)] mt-1.5">{sub}</div>
    </div>
  );
}

function QuickLink({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 p-5 bg-white rounded-2xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-300 ease-out group"
    >
      <div className="p-2.5 rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)] group-hover:bg-[var(--primary)] group-hover:text-white transition-all duration-300">
        {icon}
      </div>
      <div>
        <p className="text-[14px] font-medium text-[var(--foreground)]">
          {title}
        </p>
        <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{description}</p>
      </div>
    </Link>
  );
}
