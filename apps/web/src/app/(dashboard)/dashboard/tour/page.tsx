'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ScanSearch,
  CalendarDays,
  Activity,
  Settings,
  Mail,
  CheckCircle,
  Eye,
  BarChart3,
  Sliders,
  Users,
  Sparkles,
  ArrowRight,
  Compass,
  MessageSquare,
  Bell,
  Play,
  Zap,
  Shield,
} from 'lucide-react';
import { useTour } from '@/context/TourContext';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

interface Section {
  number: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  features: { icon: React.ReactNode; label: string; detail: string }[];
  link: string | null;
  linkLabel: string | null;
  color: string;
}

const sections: Section[] = [
  {
    number: '01',
    icon: <LayoutDashboard className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Dashboard',
    subtitle: 'Real-time overview',
    description:
      'The home page of the platform. It surfaces key pipeline metrics, recent matches, the most active bookings, and your upcoming events.',
    features: [
      { icon: <BarChart3 className="w-4 h-4" strokeWidth={1.8} />, label: '30-day statistics', detail: 'Emails processed, routing rate, auto-routed and items to review.' },
      { icon: <Mail className="w-4 h-4" strokeWidth={1.8} />, label: 'Recent matches', detail: 'The latest emails matched to a booking with their confidence score.' },
      { icon: <CalendarDays className="w-4 h-4" strokeWidth={1.8} />, label: 'Upcoming events', detail: 'The next 4 events from your Microsoft 365 calendar.' },
    ],
    link: '/dashboard',
    linkLabel: 'Open dashboard',
    color: 'var(--primary)',
  },
  {
    number: '02',
    icon: <ScanSearch className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Email Routing',
    subtitle: 'All email → booking matches',
    description:
      'The core of the system. Every incoming email is analysed by AI and matched to the most likely booking. This section lets you explore the full processing pipeline.',
    features: [
      { icon: <CheckCircle className="w-4 h-4" strokeWidth={1.8} />, label: 'Matches', detail: 'Complete list of all processed emails and their assigned booking. Filterable by mailbox, date, and source.' },
      { icon: <Eye className="w-4 h-4" strokeWidth={1.8} />, label: 'Review queue', detail: 'Emails below the confidence threshold (85%) waiting for your approval. Approve or reject in one click.' },
      { icon: <BarChart3 className="w-4 h-4" strokeWidth={1.8} />, label: 'Analytics', detail: 'Detailed charts: daily routing rate, breakdown of matching sources.' },
      { icon: <Sliders className="w-4 h-4" strokeWidth={1.8} />, label: 'Tuning', detail: 'Adjust confidence thresholds per source to fine-tune routing accuracy.' },
    ],
    link: '/dashboard/review/matches',
    linkLabel: 'View matches',
    color: 'var(--accent)',
  },
  {
    number: '03',
    icon: <Eye className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Review Queue',
    subtitle: 'Validate uncertain routing suggestions',
    description:
      "When the AI confidence is below 85%, the email is placed in the review queue for you to make the final decision. Each decision improves the model.",
    features: [
      { icon: <CheckCircle className="w-4 h-4" strokeWidth={1.8} />, label: 'Approve', detail: 'Confirm the suggested booking — the email is routed in the PMS.' },
      { icon: <Mail className="w-4 h-4" strokeWidth={1.8} />, label: 'Reject', detail: 'Mark the suggestion as incorrect — the model learns from your feedback.' },
      { icon: <ScanSearch className="w-4 h-4" strokeWidth={1.8} />, label: 'Full context', detail: 'Subject, sender, email excerpt and confidence score visible for each item.' },
    ],
    link: '/dashboard/review/queue',
    linkLabel: 'Open review queue',
    color: 'var(--warning)',
  },
  {
    number: '04',
    icon: <CalendarDays className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Calendar',
    subtitle: 'Microsoft 365 agenda + AI suggestions',
    description:
      'View your events directly from Microsoft 365. The AI engine also detects meeting intent in your emails and suggests time slots to add to your calendar.',
    features: [
      { icon: <CalendarDays className="w-4 h-4" strokeWidth={1.8} />, label: 'Month / week / agenda view', detail: 'Switch between monthly, weekly, and list views to suit your workflow.' },
      { icon: <Sparkles className="w-4 h-4" strokeWidth={1.8} />, label: 'AI suggestions', detail: 'Time slots automatically detected in your emails. Accept or dismiss in one click.' },
      { icon: <Bell className="w-4 h-4" strokeWidth={1.8} />, label: 'Event details', detail: 'Click any event to see location, online meeting link, and full details.' },
    ],
    link: '/dashboard/calendar',
    linkLabel: 'Open calendar',
    color: 'var(--success)',
  },
  {
    number: '05',
    icon: <Activity className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Activity',
    subtitle: 'Full audit log',
    description:
      'View the history of all actions performed on the platform: approvals, rejections, settings changes, sign-ins. Filter by user or action type.',
    features: [
      { icon: <CheckCircle className="w-4 h-4" strokeWidth={1.8} />, label: 'All actions', detail: 'Approvals, rejections, drafts generated, sign-ins, setting changes.' },
      { icon: <Users className="w-4 h-4" strokeWidth={1.8} />, label: 'Filter by user', detail: 'Show only your actions or the full team activity.' },
      { icon: <Activity className="w-4 h-4" strokeWidth={1.8} />, label: 'Precise timestamps', detail: 'Each entry is dated to the second with the associated user account.' },
    ],
    link: '/dashboard/activity',
    linkLabel: 'View activity',
    color: 'var(--foreground)',
  },
  {
    number: '06',
    icon: <Sparkles className="w-5 h-5" strokeWidth={1.8} />,
    title: 'AI Assistant',
    subtitle: 'Natural language search',
    description:
      'Click the ✦ icon in the bottom right of any page to open the AI assistant. Ask questions about your emails in plain English and get instant answers.',
    features: [
      { icon: <MessageSquare className="w-4 h-4" strokeWidth={1.8} />, label: 'Free-form questions', detail: '"Urgent booking requests this week", "Emails from James Wilson about check-in".' },
      { icon: <ScanSearch className="w-4 h-4" strokeWidth={1.8} />, label: 'Semantic search', detail: 'The AI understands hotel context and finds relevant emails even without exact keywords.' },
      { icon: <Sparkles className="w-4 h-4" strokeWidth={1.8} />, label: 'Available everywhere', detail: 'The AI panel is accessible from all dashboard pages.' },
    ],
    link: null,
    linkLabel: null,
    color: 'var(--accent)',
  },
  {
    number: '07',
    icon: <Settings className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Settings',
    subtitle: 'Platform configuration',
    description:
      'Manage your preferences, external service connections (Microsoft 365, PMS) and email processing rules.',
    features: [
      { icon: <Settings className="w-4 h-4" strokeWidth={1.8} />, label: 'Preferences', detail: 'Notifications, language and display options.' },
      { icon: <Mail className="w-4 h-4" strokeWidth={1.8} />, label: 'Connections', detail: 'Microsoft 365 connection status and PMS account.' },
    ],
    link: '/dashboard/settings',
    linkLabel: 'Open settings',
    color: 'var(--muted-foreground)',
  },
];

const highlights = [
  {
    icon: <Zap className="w-4 h-4" strokeWidth={1.8} />,
    label: 'Auto-routing',
    detail: '85% of emails routed without manual input',
  },
  {
    icon: <MessageSquare className="w-4 h-4" strokeWidth={1.8} />,
    label: 'AI Replies',
    detail: 'Draft replies in your personal style',
  },
  {
    icon: <Shield className="w-4 h-4" strokeWidth={1.8} />,
    label: 'No data shared',
    detail: 'Everything stays within your Azure tenant',
  },
];

export default function TourPage() {
  const { start } = useTour();

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-10 max-w-4xl"
    >
      <motion.div variants={fadeUp}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />

          <div className="relative px-8 pt-8 pb-6">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 text-[11px] font-medium rounded-full px-3 py-1 mb-5">
              <Compass className="w-3.5 h-3.5" strokeWidth={2} />
              Interactive guided tour
            </div>

            <h1 className="text-[30px] font-bold tracking-[-0.03em] leading-tight mb-2">
              Discover Grand Azure Bot in 2 minutes
            </h1>
            <p className="text-[14px] text-white/70 leading-relaxed max-w-xl mb-7">
              A step-by-step tour of each key module — AI routing, review queue,
              calendar, booking assistant. We show you everything in context.
            </p>

            <div className="flex flex-wrap gap-3 mb-7">
              {highlights.map(h => (
                <div
                  key={h.label}
                  className="flex items-center gap-2.5 bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-white/90"
                >
                  <div className="text-white/60">{h.icon}</div>
                  <div>
                    <p className="text-[12px] font-semibold leading-none mb-0.5">{h.label}</p>
                    <p className="text-[11px] text-white/55 leading-none">{h.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => start(0)}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-slate-900 text-[14px] font-bold shadow-lg hover:bg-white/90 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4" strokeWidth={2.5} fill="currentColor" />
                Start guided tour
              </button>
              <span className="text-[12px] text-white/40">← ~2 minutes · 5 steps</span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-[var(--muted)] text-[var(--foreground)]">
            <Compass className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            Full reference
          </h2>
        </div>
        <p className="text-[13px] text-[var(--muted-foreground)] leading-relaxed ml-[52px]">
          Detailed documentation of each module. Click a link to navigate directly.
        </p>
      </motion.div>

      {sections.map((s) => (
        <motion.div
          key={s.number}
          variants={fadeUp}
          className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
        >
          <div className="px-6 py-5 flex items-start gap-4 border-b border-[var(--border)]">
            <span
              className="text-[11px] font-mono font-medium tabular-nums mt-0.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {s.number}
            </span>
            <div
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'var(--muted)', color: s.color }}
            >
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                    {s.title}
                  </h3>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{s.subtitle}</p>
                </div>
                {s.link && (
                  <Link
                    href={s.link}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-white transition-all duration-200 flex-shrink-0"
                  >
                    {s.linkLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
              <p className="text-[13px] text-[var(--muted-foreground)] leading-relaxed mt-3">
                {s.description}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {s.features.map((f) => (
              <div key={f.label} className="px-6 py-4 flex items-start gap-4">
                <div className="p-1.5 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] flex-shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{f.label}</p>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                    {f.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between p-5 rounded-2xl border border-dashed border-[var(--border)]"
      >
        <p className="text-[13px] text-[var(--muted-foreground)]">
          This guide is always accessible from the{' '}
          <Compass className="w-3.5 h-3.5 inline-block -mt-0.5" strokeWidth={1.8} /> icon in the
          sidebar.
        </p>
        <button
          onClick={() => start(0)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-[var(--foreground)] text-white hover:opacity-80 transition-opacity flex-shrink-0 ml-4"
        >
          <Play className="w-3.5 h-3.5" strokeWidth={2.5} fill="currentColor" />
          Restart tour
        </button>
      </motion.div>
    </motion.div>
  );
}
