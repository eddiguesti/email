'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Zap,
  Mail,
  Building2,
  Users,
  Globe,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Clock,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Info,
} from 'lucide-react';

interface PlatformInfoPanelProps {
  open: boolean;
  onClose: () => void;
}

const SYSTEMS = [
  { name: 'Opera Cloud',     label: 'PMS',   color: 'bg-violet-400', dot: 'bg-violet-400' },
  { name: 'Salesforce CRM',  label: 'CRM',   color: 'bg-blue-400',   dot: 'bg-blue-400'   },
  { name: 'Microsoft 365',   label: 'Email', color: 'bg-sky-400',    dot: 'bg-sky-400'    },
  { name: 'Booking.com',     label: 'OTA',   color: 'bg-emerald-400',dot: 'bg-emerald-400'},
  { name: 'Expedia Partner', label: 'OTA',   color: 'bg-amber-400',  dot: 'bg-amber-400'  },
  { name: 'Amadeus GDS',     label: 'GDS',   color: 'bg-orange-400', dot: 'bg-orange-400' },
];

const CAPABILITIES = [
  {
    icon: Mail,
    title: 'AI Email Triage',
    description:
      'Every incoming email — whether from a guest, OTA, or corporate travel desk — is read, classified, and matched to the correct booking in seconds. No manual sorting. No shared-inbox chaos.',
    stat: '30 min',
    statLabel: 'avg. response time (down from 12 hrs)',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
  },
  {
    icon: Building2,
    title: 'Opera Cloud Sync',
    description:
      'Guest profiles, stay history, check-in dates, and reservation data flow in real time from Opera Cloud into every routed email thread. Your team sees the full picture before they type a single word.',
    stat: '847',
    statLabel: 'guest profiles synced',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: Users,
    title: 'CRM Enrichment',
    description:
      'Salesforce records are enriched automatically with every email, booking activity, and guest interaction. Loyalty members are recognised instantly. Personalization that actually scales.',
    stat: '5–15%',
    statLabel: 'revenue lift from personalisation (McKinsey)',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Globe,
    title: 'OTA Intelligence',
    description:
      'Booking.com and Expedia notifications are decoded, cross-referenced against Opera Cloud, and matched to the right dossier — before your team ever opens their inbox. High-commission OTA bookings become direct relationships.',
    stat: '40%+',
    statLabel: 'of bookings arrive via OTA',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: BarChart3,
    title: 'Revenue Visibility',
    description:
      'Routing rate, auto-filed count, review queue depth, CRM enrichment, and pipeline run history — live on your dashboard from day one. Numbers you can hand to ownership every week.',
    stat: '93%',
    statLabel: 'auto-routing accuracy at ≥ 85% confidence',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
];

const METRICS = [
  { value: '< 30 min',  label: 'Response time',       icon: Clock       },
  { value: '93%',       label: 'Auto-routed',          icon: CheckCircle2 },
  { value: '6 systems', label: 'Live integrations',    icon: Zap          },
  { value: '0',         label: 'Manual cross-checks',  icon: ShieldCheck  },
];

export default function PlatformInfoPanel({ open, onClose }: PlatformInfoPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed top-0 right-0 z-50 h-full w-[440px] bg-white border-l border-[var(--border)] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="relative bg-[var(--primary)] px-6 pt-6 pb-7 text-white overflow-hidden flex-shrink-0">
              {/* decorative blobs */}
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5" />

              <div className="relative flex items-start justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <Sparkles className="w-4.5 h-4.5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Platform overview</p>
                    <h2 className="text-[18px] font-semibold tracking-[-0.02em] leading-tight">Grand Azure Bot</h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>

              <p className="relative text-[14px] text-white/80 leading-relaxed mb-5">
                Your hotel inbox, turned into a revenue system. One AI engine connects every platform your property runs — so your team focuses on guests, not admin.
              </p>

              {/* Metric strip */}
              <div className="relative grid grid-cols-4 gap-2">
                {METRICS.map(m => (
                  <div key={m.label} className="text-center p-2.5 rounded-xl bg-white/10">
                    <m.icon className="w-3.5 h-3.5 text-white/70 mx-auto mb-1" strokeWidth={1.8} />
                    <p className="text-[13px] font-semibold text-white leading-none">{m.value}</p>
                    <p className="text-[9px] text-white/60 mt-1 leading-tight">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Scrollable body ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">

              {/* Connected systems */}
              <div className="px-6 pt-5 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                  Connected systems
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SYSTEMS.map(s => (
                    <div key={s.name} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[var(--foreground)] truncate leading-tight">{s.name}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Flow arrow */}
                <div className="flex items-center gap-3 mt-4 px-1">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--primary)]/8 border border-[var(--primary)]/20">
                    <Zap className="w-3 h-3 text-[var(--primary)]" strokeWidth={1.8} />
                    <span className="text-[10px] font-semibold text-[var(--primary)] uppercase tracking-wider">AI Routing Engine</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
              </div>

              <div className="h-px bg-[var(--border)] mx-6" />

              {/* Capabilities */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  What it does
                </p>

                {CAPABILITIES.map((cap, i) => (
                  <motion.div
                    key={cap.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i + 0.1, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="rounded-2xl border border-[var(--border)] overflow-hidden"
                  >
                    <div className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg ${cap.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <cap.icon className={`w-4 h-4 ${cap.color}`} strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--foreground)] mb-1">{cap.title}</p>
                          <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">{cap.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className={`px-4 py-2.5 ${cap.bg} border-t border-[var(--border)] flex items-center gap-2`}>
                      <TrendingUp className={`w-3 h-3 ${cap.color} flex-shrink-0`} strokeWidth={2} />
                      <span className={`text-[11px] font-semibold ${cap.color}`}>{cap.stat}</span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">{cap.statLabel}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ROI callout */}
              <div className="mx-6 mb-6 rounded-2xl bg-[var(--muted)] border border-[var(--border)] p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--foreground)] mb-1">The numbers hotels hand to ownership</p>
                    <ul className="space-y-1.5">
                      {[
                        'Up to 15–20% RevPAR lift from routing automation',
                        '20–30 hours/month returned to revenue managers',
                        '$2–3M annual saving from OTA mix shift of 8–10%',
                        '5–15% total revenue increase from personalisation',
                      ].map(line => (
                        <li key={line} className="flex items-start gap-2">
                          <ArrowRight className="w-3 h-3 text-[var(--primary)] flex-shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

            </div>

            {/* ── Footer ────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--border)] bg-white">
              <p className="text-[11px] text-[var(--muted-foreground)] text-center">
                Grand Azure Bot · AI-powered hotel operations platform
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
