'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Zap,
  Eye,
  CheckCircle,
  ArrowRight,
  Download,
  SlidersHorizontal,
  Mail,
  Filter,
  Puzzle,
  Sparkles,
  Compass,
} from 'lucide-react';
import { saveUserPreferences } from '@/lib/pipeline-api';
import { useAuth } from '@/context/AuthContext';
import { useTour } from '@/context/TourContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type BotMode = 'observation' | 'assiste' | 'automatique';
type EmailFilter = 'smart' | 'all' | 'clients';

interface OnboardingModalProps {
  onComplete: () => void;
}

// ─── Step data ────────────────────────────────────────────────────────────────

const BOT_MODES: { id: BotMode; icon: React.ReactNode; label: string; description: string; tag: string; tagColor: string }[] = [
  {
    id: 'automatique',
    icon: <Zap className="w-6 h-6" strokeWidth={1.8} />,
    label: 'Automatic',
    description: 'Emails with ≥ 85% confidence are automatically routed to the PMS. Emails at 60–85% wait for your approval.',
    tag: 'Recommended',
    tagColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'assiste',
    icon: <SlidersHorizontal className="w-6 h-6" strokeWidth={1.8} />,
    label: 'Assisted',
    description: 'All matches go through the review queue. You approve each routing before it is applied.',
    tag: 'Full control',
    tagColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'observation',
    icon: <Eye className="w-6 h-6" strokeWidth={1.8} />,
    label: 'Observation',
    description: 'The bot analyses and suggests only — no actions in the PMS. Ideal for testing accuracy.',
    tag: 'Current mode',
    tagColor: 'bg-gray-100 text-gray-600',
  },
];

const EMAIL_FILTERS: { id: EmailFilter; icon: React.ReactNode; label: string; description: string }[] = [
  {
    id: 'smart',
    icon: <Sparkles className="w-5 h-5" strokeWidth={1.8} />,
    label: 'Smart',
    description: 'Automatically ignores newsletters, spam and notifications. Processes all genuine emails.',
  },
  {
    id: 'clients',
    icon: <Filter className="w-5 h-5" strokeWidth={1.8} />,
    label: 'Guests only',
    description: 'Processes only emails from senders already linked to a booking or known in the PMS.',
  },
  {
    id: 'all',
    icon: <Mail className="w-5 h-5" strokeWidth={1.8} />,
    label: 'Process all',
    description: 'Attempts to route every incoming email without pre-filtering.',
  },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const slideVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { user } = useAuth();
  const { start } = useTour();
  const [step, setStep] = useState(0);
  const [botMode, setBotMode] = useState<BotMode>('automatique');
  const [emailFilter, setEmailFilter] = useState<EmailFilter>('smart');
  const [saving, setSaving] = useState(false);

  const TOTAL_STEPS = 4; // Welcome, Bot mode, Email filter, Add-in

  const savePreferences = async () => {
    const payload = {
      display_name: user?.displayName ?? null,
      bot_mode: botMode,
      email_filter: emailFilter,
      onboarded: true,
      onboarded_at: new Date().toISOString(),
      email_notifications: true,
      urgent_alerts: true,
      language: 'fr',
    };
    // Try up to 2 times so a transient network hiccup doesn't leave
    // the user in an unboarded state on other devices.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await saveUserPreferences(payload);
        return; // success
      } catch {
        if (attempt === 1) {
          // Both attempts failed — proceed anyway so onboarding doesn't block
        }
      }
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    await savePreferences();
    setSaving(false);
    onComplete();
  };

  const handleFinishAndTour = async () => {
    setSaving(true);
    await savePreferences();
    setSaving(false);
    start(0);   // launch guided tour before closing so TourOverlay activates
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-xl mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-[var(--muted)]">
          <motion.div
            className="h-full bg-[var(--foreground)]"
            animate={{ width: `${((step + 1) / (TOTAL_STEPS + 1)) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-1">
          {Array.from({ length: TOTAL_STEPS + 1 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step ? 'w-5 h-2 bg-[var(--foreground)]' :
                i < step ? 'w-2 h-2 bg-[var(--foreground)]/40' :
                'w-2 h-2 bg-[var(--muted-foreground)]/20'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="welcome"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex flex-col items-center text-center flex-1"
              >
                <div className="w-16 h-16 rounded-2xl bg-[var(--foreground)] flex items-center justify-center mb-5 mt-2">
                  <Bot className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
                <h1 className="text-[26px] font-light tracking-[-0.02em] text-[var(--foreground)] mb-3">
                  Welcome, {user?.displayName?.split(' ')[0] || 'there'} 👋
                </h1>
                <p className="text-[14px] text-[var(--muted-foreground)] leading-relaxed max-w-sm">
                  Grand Azure Bot monitors your hotel inbox, identifies emails linked to bookings and routes them to the right department automatically.
                </p>
                <div className="grid grid-cols-3 gap-3 mt-7 w-full">
                  {[
                    { icon: <Mail className="w-4 h-4" />, label: 'Auto\nAnalysis' },
                    { icon: <CheckCircle className="w-4 h-4" />, label: 'PMS\nRouting' },
                    { icon: <Sparkles className="w-4 h-4" />, label: 'AI\nDrafts' },
                  ].map((f, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-[var(--muted)] flex flex-col items-center gap-2">
                      <div className="text-[var(--muted-foreground)]">{f.icon}</div>
                      <span className="text-[11px] text-[var(--muted-foreground)] text-center whitespace-pre-line leading-tight">{f.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="bot-mode"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex-1"
              >
                <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-1">
                  How should the bot work?
                </h2>
                <p className="text-[13px] text-[var(--muted-foreground)] mb-5">
                  You can change this at any time in settings.
                </p>
                <div className="space-y-2.5">
                  {BOT_MODES.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setBotMode(mode.id)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-start gap-4 ${
                        botMode === mode.id
                          ? 'border-[var(--foreground)] bg-[var(--foreground)]/[0.03]'
                          : 'border-[var(--border)] hover:border-[var(--foreground)]/30'
                      }`}
                    >
                      <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${botMode === mode.id ? 'bg-[var(--foreground)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                        {mode.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[14px] font-semibold text-[var(--foreground)]">{mode.label}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${mode.tagColor}`}>{mode.tag}</span>
                        </div>
                        <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">{mode.description}</p>
                      </div>
                      {botMode === mode.id && (
                        <CheckCircle className="w-5 h-5 text-[var(--foreground)] flex-shrink-0 mt-0.5" strokeWidth={2} />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="email-filter"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex-1"
              >
                <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-1">
                  Which emails to process?
                </h2>
                <p className="text-[13px] text-[var(--muted-foreground)] mb-5">
                  Define the scope of your inbox analysis.
                </p>
                <div className="space-y-2.5">
                  {EMAIL_FILTERS.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setEmailFilter(filter.id)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-start gap-4 ${
                        emailFilter === filter.id
                          ? 'border-[var(--foreground)] bg-[var(--foreground)]/[0.03]'
                          : 'border-[var(--border)] hover:border-[var(--foreground)]/30'
                      }`}
                    >
                      <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${emailFilter === filter.id ? 'bg-[var(--foreground)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                        {filter.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-[var(--foreground)] mb-0.5">{filter.label}</p>
                        <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">{filter.description}</p>
                      </div>
                      {emailFilter === filter.id && (
                        <CheckCircle className="w-5 h-5 text-[var(--foreground)] flex-shrink-0 mt-0.5" strokeWidth={2} />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="addin"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex-1"
              >
                <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-1">
                  Outlook Add-in
                </h2>
                <p className="text-[13px] text-[var(--muted-foreground)] mb-5">
                  Access Grand Azure Bot directly inside Outlook — optional, you can do this later.
                </p>
                <div className="p-5 rounded-2xl border border-[var(--border)] space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-[var(--muted)]">
                      <Puzzle className="w-5 h-5 text-[var(--muted-foreground)]" strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--foreground)] mb-1">Grand Azure Bot for Outlook</p>
                      <div className="space-y-1">
                        {[
                          'Suggested booking visible directly on the email',
                          'Automatic colour coding by routing status',
                          'Route to PMS in one click',
                          'Generate AI draft replies inside Outlook',
                        ].map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" strokeWidth={2} />
                            <span className="text-[12px] text-[var(--muted-foreground)]">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <a
                    href="/api/outlook-addin/manifest"
                    download="grand-azure-manifest.xml"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium hover:opacity-90 transition-all duration-200"
                  >
                    <Download className="w-4 h-4" strokeWidth={1.8} />
                    Download Outlook Manifest
                  </a>
                </div>

                <p className="text-[12px] text-[var(--muted-foreground)] text-center mt-4">
                  You can find this download in <strong>Settings → Outlook Add-in</strong>
                </p>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="done"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex flex-col items-center text-center flex-1"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-5 mt-2"
                >
                  <CheckCircle className="w-8 h-8 text-emerald-500" strokeWidth={1.5} />
                </motion.div>
                <h2 className="text-[24px] font-light tracking-[-0.02em] text-[var(--foreground)] mb-3">
                  All set!
                </h2>
                <p className="text-[13px] text-[var(--muted-foreground)] leading-relaxed max-w-sm mb-6">
                  Grand Azure Bot will start analysing your hotel inbox.
                </p>

                <div className="w-full space-y-2 text-left">
                  <SummaryRow
                    icon={<Bot className="w-4 h-4" />}
                    label="Mode"
                    value={BOT_MODES.find(m => m.id === botMode)?.label || botMode}
                  />
                  <SummaryRow
                    icon={<Filter className="w-4 h-4" />}
                    label="Email filter"
                    value={EMAIL_FILTERS.find(f => f.id === emailFilter)?.label || emailFilter}
                  />
                  <SummaryRow
                    icon={<Puzzle className="w-4 h-4" />}
                    label="Outlook Add-in"
                    value="Available in Settings"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-[var(--border)] flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium hover:opacity-90 transition-all duration-200"
            >
              {step === 0 ? 'Start setup' : step === 3 ? 'Almost done' : 'Next'}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleFinish}
                disabled={saving}
                className="text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
              >
                Skip
              </button>
              <button
                onClick={handleFinishAndTour}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-40 transition-all duration-200"
              >
                {saving ? 'Saving...' : (
                  <>
                    <Compass className="w-4 h-4" strokeWidth={1.8} />
                    Explore the platform
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--muted)]">
      <div className="text-[var(--muted-foreground)]">{icon}</div>
      <span className="text-[13px] text-[var(--muted-foreground)] flex-1">{label}</span>
      <span className="text-[13px] font-medium text-[var(--foreground)]">{value}</span>
    </div>
  );
}
