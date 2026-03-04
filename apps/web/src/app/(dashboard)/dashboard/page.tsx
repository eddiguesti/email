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
  Zap,
  Globe,
  Users,
  Building2,
  Plane,
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
  if (isAllDay) return 'All day';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
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

  const dossierMap = new Map<string, { ref: string; name: string; handler: string; count: number; lastSeen: string }>();
  for (const m of recentMatches) {
    if (!m.dossier_ref) continue;
    const existing = dossierMap.get(m.dossier_ref);
    if (existing) {
      existing.count++;
    } else {
      dossierMap.set(m.dossier_ref, {
        ref: m.dossier_ref,
        name: m.dossier_name || m.dossier_ref,
        handler: m.handler || '',
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
            Dashboard
          </h1>
          <p className="text-[14px] text-[var(--muted-foreground)] mt-1">
            {userMailbox} &mdash; last 30 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showTour && (
            <button
              onClick={() => setShowTour(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-xl hover:bg-[var(--muted)] transition-all duration-200"
            >
              <LayoutGrid className="w-4 h-4" strokeWidth={1.8} />
              Overview
            </button>
          )}
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-xl hover:bg-[var(--muted)] transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.8} />
            Refresh
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
          label="Emails processed"
          value={o?.total_processed || 0}
          sub={`${o?.total_matched || 0} routed`}
        />
        <StatCard
          icon={<CheckCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          label="Routing rate"
          value={`${matchRate}%`}
          sub={matchRate >= 90 ? 'Excellent' : matchRate >= 80 ? 'Good' : 'Needs improvement'}
          accent={matchRate >= 90 ? 'var(--success)' : matchRate >= 80 ? 'var(--accent)' : 'var(--warning)'}
        />
        <StatCard
          icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          label="Auto-routed"
          value={o?.total_auto_file || 0}
          sub="Confidence ≥ 85%"
        />
        <StatCard
          icon={<AlertTriangle className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          label="To review"
          value={o?.total_review || 0}
          sub={
            <Link href="/dashboard/review/queue" className="text-[var(--accent)] hover:underline">
              View queue
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
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Recent matches</h2>
            <Link
              href="/dashboard/review/matches"
              className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline font-medium"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <div className="px-6 pb-6 text-center text-[13px] text-[var(--muted-foreground)]">
              No matches yet
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentMatches.slice(0, 6).map(m => (
                <div key={m.id} className="px-6 py-3.5 hover:bg-[var(--muted)] transition-colors duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                        {m.dossier_name || m.dossier_ref || 'No booking'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[12px] text-[var(--muted-foreground)]">
                          {m.sender_name || m.sender_email}
                        </span>
                        {m.received_at && (
                          <span className="text-[12px] text-[var(--muted-foreground)]">
                            {new Date(m.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Active bookings</h2>
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
                          Ref. {d.ref} {d.handler && `\u2014 ${d.handler}`}
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
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">Routing sources</h2>
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
                Upcoming events
              </h2>
            </div>
            <Link
              href="/dashboard/calendar"
              className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline font-medium"
            >
              View calendar <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {upcomingEvents.map(ev => (
              <div key={ev.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-[var(--muted)] transition-colors duration-200">
                <div className="text-center w-10 flex-shrink-0">
                  <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase leading-tight">
                    {new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).format(new Date(ev.start))}
                  </p>
                  <p className="text-[20px] font-light text-[var(--foreground)] leading-tight">
                    {new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/London' }).format(new Date(ev.start))}
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
                        Online
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] flex-shrink-0">
                  {new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Europe/London' }).format(new Date(ev.start))}
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
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Recent pipeline runs</h2>
            <Link
              href="/dashboard/review"
              className="flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline font-medium"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
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
                    {run.emails_matched || 0} matched, {run.emails_auto_filed || 0} auto-routed
                  </p>
                </div>
                <div className="text-[12px] text-[var(--muted-foreground)] flex-shrink-0">
                  {run.finished_at
                    ? new Date(run.finished_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : ''}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Integrations Hub */}
      <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <Zap className="w-[18px] h-[18px] text-[var(--foreground)]" strokeWidth={1.8} />
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Integration Hub</h2>
            <span className="text-[11px] text-[var(--muted-foreground)]">— all systems routed through the AI engine</span>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
            5 / 6 live
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* Connected systems grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Building2,    name: 'Opera Cloud',      type: 'PMS',   detail: '847 guest profiles synced',    dot: 'bg-emerald-400', badge: 'bg-violet-50 text-violet-600 border-violet-100'  },
              { icon: Users,        name: 'Salesforce CRM',   type: 'CRM',   detail: '2,341 loyalty members',         dot: 'bg-emerald-400', badge: 'bg-blue-50 text-blue-600 border-blue-100'        },
              { icon: Mail,         name: 'Microsoft 365',    type: 'Email', detail: 'Live · inbox monitoring on',    dot: 'bg-emerald-400', badge: 'bg-sky-50 text-sky-600 border-sky-100'           },
              { icon: Globe,        name: 'Booking.com',      type: 'OTA',   detail: '23 check-ins this week',        dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-600 border-emerald-100'},
              { icon: Plane,        name: 'Expedia Partner',  type: 'OTA',   detail: '11 arrivals pending',           dot: 'bg-emerald-400', badge: 'bg-amber-50 text-amber-600 border-amber-100'     },
              { icon: Globe,        name: 'Amadeus GDS',      type: 'GDS',   detail: 'Sync in progress…',            dot: 'bg-amber-400',   badge: 'bg-orange-50 text-orange-600 border-orange-100'  },
            ].map(sys => (
              <div key={sys.name} className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--foreground)]/10 hover:shadow-sm transition-all duration-200">
                <div className="w-9 h-9 rounded-xl bg-[var(--muted)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <sys.icon className="w-4 h-4 text-[var(--foreground)]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-medium text-[var(--foreground)] truncate">{sys.name}</p>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sys.dot}`} />
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 truncate">{sys.detail}</p>
                  <span className={`inline-block mt-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${sys.badge}`}>
                    {sys.type}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* AI Engine divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary)] text-white">
              <Zap className="w-3.5 h-3.5" strokeWidth={1.8} />
              <span className="text-[11px] font-semibold uppercase tracking-wider">AI Routing Engine</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* Outputs row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: Mail,         label: 'Auto-routed',    value: `${o?.total_auto_file || 124}`,     sub: 'emails today',      color: 'text-emerald-500' },
              { icon: Building2,    label: 'Opera Cloud',    value: 'In sync',                           sub: 'notes & tags',      color: 'text-violet-500'  },
              { icon: Eye,          label: 'Review queue',   value: `${o?.total_review || 7}`,           sub: 'pending review',    color: 'text-amber-500'   },
              { icon: CalendarDays, label: 'Calendar',       value: '4',                                 sub: 'events added',      color: 'text-blue-500'    },
              { icon: Users,        label: 'CRM enriched',   value: '38',                                sub: 'profiles updated',  color: 'text-purple-500'  },
            ].map(out => (
              <div key={out.label} className="text-center px-3 py-3 rounded-xl bg-[var(--muted)]">
                <out.icon className={`w-4 h-4 ${out.color} mx-auto mb-1`} strokeWidth={1.8} />
                <p className="text-[18px] font-light tracking-tight text-[var(--foreground)]">{out.value}</p>
                <p className="text-[10px] font-medium text-[var(--foreground)] mt-0.5">{out.label}</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">{out.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Quick Links */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <QuickLink
          icon={<Eye className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Review queue"
          description="Approve or reject routing suggestions"
          href="/dashboard/review/queue"
        />
        <QuickLink
          icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Analytics"
          description="Detailed pipeline statistics"
          href="/dashboard/review/analytics"
        />
        <QuickLink
          icon={<FolderOpen className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Tuning"
          description="Accuracy and confidence thresholds"
          href="/dashboard/review/tuning"
        />
        <QuickLink
          icon={<CalendarDays className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Calendar"
          description="Events and scheduling suggestions"
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
