'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Mail,
  Eye,
  CalendarDays,
  Sparkles,
  CheckCircle,
  LayoutDashboard,
  MessageSquare,
} from 'lucide-react';
import { useTour, TOUR_TOTAL_STEPS } from '@/context/TourContext';

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  id: string;
  route: string | null;
  /** data-tour attribute value on the target DOM element, null = no spotlight */
  target: string | null;
  /** Which side to try first for the tooltip (auto-overridden by computePlacement) */
  preferSide?: 'right' | 'left' | 'top' | 'bottom';
  icon: React.ReactNode;
  label: string;
  title: string;
  subtitle: string;
  body: string;
  tip?: string;
  accentFrom: string;
  accentTo: string;
  accentText: string;
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    route: null,
    target: null,
    icon: <Sparkles className="w-8 h-8" strokeWidth={1.5} />,
    label: 'Welcome',
    title: 'Welcome to Grand Azure Bot',
    subtitle: 'Your hotel AI email assistant',
    body: "Grand Azure Bot analyses every incoming email, automatically matches it to the correct booking in the PMS, drafts replies in your style, and answers questions about reservations — all running in the background.\n\nThis guided tour covers the 5 key modules in under 2 minutes.",
    accentFrom: 'from-slate-900',
    accentTo: 'to-slate-700',
    accentText: 'text-white',
  },
  {
    id: 'pipeline',
    route: '/dashboard/review/matches',
    target: 'nav-pipeline',
    preferSide: 'right',
    icon: <Mail className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Matches',
    title: 'Email Routing',
    subtitle: 'AI automatic routing',
    body: "Every email in your inbox is analysed in real time. Grand Azure Bot identifies the matching booking using 8 combined matching methods.\n\nEmails matched with over 85% confidence are routed automatically. Others go to the review queue.",
    tip: "Click any row to open the detail panel.",
    accentFrom: 'from-indigo-600',
    accentTo: 'to-violet-600',
    accentText: 'text-white',
  },
  {
    id: 'drawer',
    route: '/dashboard/review/matches',
    target: 'detail-drawer',
    preferSide: 'left',
    icon: <Eye className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Detail panel',
    title: 'Everything at a glance',
    subtitle: 'Email · Booking · AI Reply · Questions',
    body: "Click any row and this panel opens. You immediately see the full email, the suggested booking, and the reasons for the match.\n\nTwo AI tools are built in directly here:\n\n✦ Draft a reply — the AI generates a draft in your personal style (intro, body, closing). Review, edit if needed, send in one click.\n\n✦ Booking assistant — ask a question about the reservation in plain English: 'Is there a check-in today?', 'What are the latest exchanges?' The AI searches your email history and answers in context.",
    tip: "Drafts automatically adapt to the tone of the reservation — formal, casual, or corporate.",
    accentFrom: 'from-violet-600',
    accentTo: 'to-purple-600',
    accentText: 'text-white',
  },
  {
    id: 'queue',
    route: '/dashboard/review/queue',
    target: 'review-queue',
    preferSide: 'top',
    icon: <CheckCircle className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Review queue',
    title: 'Review Queue',
    subtitle: 'Validate uncertain routing suggestions',
    body: "When the AI is not confident enough (60–85%), the email waits for your approval. You see the sender, the suggested booking, and the matching reasons.\n\nOne click to Approve or Reject. Each decision refines the model's accuracy for your hotel.",
    tip: "You can also generate and send a reply directly from the queue.",
    accentFrom: 'from-amber-500',
    accentTo: 'to-orange-500',
    accentText: 'text-white',
  },
  {
    id: 'calendar',
    route: '/dashboard/calendar',
    target: 'calendar-view',
    preferSide: 'bottom',
    icon: <CalendarDays className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Calendar',
    title: 'Smart Calendar',
    subtitle: 'Microsoft 365 agenda + AI suggestions',
    body: "View all your Microsoft 365 events directly in Grand Azure Bot — month, week, or agenda view.\n\nThe AI detects meeting intent in your emails and suggests adding the time slot to your calendar in one click.",
    tip: "Suggestions stay pending until you accept or dismiss them.",
    accentFrom: 'from-emerald-600',
    accentTo: 'to-teal-600',
    accentText: 'text-white',
  },
  {
    id: 'ai',
    route: null,
    target: 'ai-chat',
    preferSide: 'left',
    icon: <MessageSquare className="w-6 h-6" strokeWidth={1.5} />,
    label: 'AI Assistant',
    title: 'Global AI Assistant',
    subtitle: 'Natural language questions',
    body: "The ✦ icon opens the AI assistant. Ask questions about your emails in plain English:\n\n'Urgent booking requests this week' · 'Emails from corporate guests without a reply'\n\nThe AI understands hotel context and finds relevant emails.",
    tip: "The assistant is available from all dashboard pages.",
    accentFrom: 'from-blue-600',
    accentTo: 'to-cyan-600',
    accentText: 'text-white',
  },
  {
    id: 'done',
    route: '/dashboard',
    target: null,
    icon: <LayoutDashboard className="w-8 h-8" strokeWidth={1.5} />,
    label: 'Done',
    title: "You're all set!",
    subtitle: 'The platform is yours',
    body: "You now know the 5 key modules of Grand Azure Bot. The pipeline runs in the background — emails arrive, are analysed, and routed automatically.\n\nThe guide is always accessible from the Compass icon in the sidebar.",
    accentFrom: 'from-emerald-600',
    accentTo: 'to-emerald-500',
    accentText: 'text-white',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isFullScreen = (step: number) => step === 0 || step === TOUR_TOTAL_STEPS - 1;

const CARD_W = 380;
const CARD_H = 400; // conservative max height estimate
const MARGIN = 16;  // gap between spotlight and tooltip card

interface Placement {
  top: number;
  left: number;
  arrowSide: 'left' | 'right' | 'top' | 'bottom';
}

function computePlacement(rect: DOMRect): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceRight  = vw - rect.right;
  const spaceLeft   = rect.left;
  const spaceBottom = vh - rect.bottom;
  const spaceTop    = rect.top;

  const clampedVertical = (ideal: number) =>
    Math.max(8, Math.min(ideal, vh - CARD_H - 24));
  const clampedHorizontal = (ideal: number) =>
    Math.max(8, Math.min(ideal, vw - CARD_W - 8));

  // Try right first
  if (spaceRight >= CARD_W + MARGIN) {
    return {
      left: rect.right + MARGIN,
      top: clampedVertical(rect.top + rect.height / 2 - CARD_H / 2),
      arrowSide: 'left',
    };
  }
  // Try left
  if (spaceLeft >= CARD_W + MARGIN) {
    return {
      left: rect.left - CARD_W - MARGIN,
      top: clampedVertical(rect.top + rect.height / 2 - CARD_H / 2),
      arrowSide: 'right',
    };
  }
  // Try below
  if (spaceBottom >= CARD_H + MARGIN) {
    return {
      top: rect.bottom + MARGIN,
      left: clampedHorizontal(rect.left + rect.width / 2 - CARD_W / 2),
      arrowSide: 'top',
    };
  }
  // Try above
  if (spaceTop >= CARD_H + MARGIN) {
    return {
      top: rect.top - CARD_H - MARGIN,
      left: clampedHorizontal(rect.left + rect.width / 2 - CARD_W / 2),
      arrowSide: 'bottom',
    };
  }
  // Fallback: bottom-right clear of sidebar, anchored to bottom
  return {
    top: vh - CARD_H - 24,
    left: clampedHorizontal(vw - CARD_W - 24),
    arrowSide: 'bottom',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TourOverlay() {
  const { active, step, stop, next, prev } = useTour();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const prevStepRef = useRef(step);

  // Spotlight state
  const [spotRect, setSpotRect] = useState<DOMRect | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Navigate to the step's route when step changes
  useEffect(() => {
    if (!active) return;
    const target = STEPS[step]?.route;
    if (target) router.push(target);
  }, [active, step, router]);

  // Track direction for slide animation
  useEffect(() => {
    setDir(step >= prevStepRef.current ? 1 : -1);
    prevStepRef.current = step;
  }, [step]);

  // Find and track the target element
  const findTarget = useCallback(() => {
    const tourId = STEPS[step]?.target;
    if (!tourId) {
      setSpotRect(null);
      setPlacement(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${tourId}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSpotRect(rect);
    setPlacement(computePlacement(rect));
  }, [step]);

  useEffect(() => {
    if (!active) {
      setSpotRect(null);
      setPlacement(null);
      return;
    }

    // Clear previous poll
    if (pollRef.current) clearInterval(pollRef.current);
    setSpotRect(null);
    setPlacement(null);

    // Poll until target is found (handles route transitions)
    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts++;
      findTarget();
      const tourId = STEPS[step]?.target;
      if (!tourId || document.querySelector(`[data-tour="${tourId}"]`) || attempts > 25) {
        clearInterval(pollRef.current!);
      }
    }, 200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [active, step, findTarget]);

  // Update spotlight on scroll/resize
  useEffect(() => {
    if (!active || !STEPS[step]?.target) return;
    const update = () => findTarget();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active, step, findTarget]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); handleNext(); }
      if (e.key === 'ArrowLeft')                    { e.preventDefault(); handlePrev(); }
      if (e.key === 'Escape')                       stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  function handleNext() {
    if (step === TOUR_TOTAL_STEPS - 1) { stop(); return; }
    next();
  }

  function handlePrev() {
    if (step === 0) { stop(); return; }
    prev();
  }

  if (!mounted) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === TOUR_TOTAL_STEPS - 1;
  const full    = isFullScreen(step);
  const hasSpot = !full && !!spotRect && !!placement;

  const slideVariants = {
    enter:  { opacity: 0, x: dir * 30 },
    center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
    exit:   { opacity: 0, x: dir * -30, transition: { duration: 0.18 } },
  };

  // Arrow style for the tooltip pointer
  const arrowStyle = (side: 'left' | 'right' | 'top' | 'bottom'): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      pointerEvents: 'none',
    };
    switch (side) {
      case 'left': return { ...base, right: '100%', top: '50%', marginTop: -8, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '10px solid white' };
      case 'right': return { ...base, left: '100%', top: '50%', marginTop: -8, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '10px solid white' };
      case 'top': return { ...base, bottom: '100%', left: '50%', marginLeft: -8, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '10px solid white' };
      case 'bottom': return { ...base, top: '100%', left: '50%', marginLeft: -8, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '10px solid white' };
    }
  };

  return (
    <>
    {createPortal(
    <AnimatePresence>
      {active && (
        <>
          {/* ── Backdrop ──────────────────────────────────────────────────── */}
          {full ? (
            // Full opaque backdrop for welcome/done
            <motion.div
              key="backdrop-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
            />
          ) : hasSpot ? (
            // Spotlight: dark overlay with a cutout at the target element
            <motion.div
              key="backdrop-spot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ position: 'fixed', inset: 0, zIndex: 110, pointerEvents: 'none' }}
            >
              {/* The spotlight hole itself — box-shadow creates the surrounding dark area */}
              <motion.div
                key={`spot-${step}`}
                animate={{
                  top: spotRect!.top - 8,
                  left: spotRect!.left - 8,
                  width: spotRect!.width + 16,
                  height: spotRect!.height + 16,
                }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                style={{
                  position: 'absolute',
                  borderRadius: 12,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
                  border: '2px solid rgba(255,255,255,0.35)',
                  pointerEvents: 'none',
                }}
              />
            </motion.div>
          ) : (
            // Fallback subtle overlay when target not found
            <motion.div
              key="backdrop-fallback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[110] bg-black/30"
              onClick={stop}
            />
          )}

          {/* ── Full-screen card (welcome / done) ───────────────────────── */}
          {full && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`full-${step}`}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="pointer-events-auto w-full max-w-lg"
                >
                  <div className={`h-2 rounded-t-2xl bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`} />
                  <div className="bg-white rounded-b-2xl shadow-[0_32px_80px_rgba(0,0,0,0.3)] overflow-hidden">
                    <div className="px-8 py-8">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${current.accentFrom} ${current.accentTo} flex items-center justify-center text-white mb-6 shadow-lg`}>
                        {current.icon}
                      </div>
                      <h1 className="text-[26px] font-bold tracking-[-0.025em] text-[var(--foreground)] leading-tight">
                        {current.title}
                      </h1>
                      <p className="text-[14px] text-[var(--accent)] font-medium mt-1">
                        {current.subtitle}
                      </p>
                      <p className="text-[14px] text-[var(--muted-foreground)] leading-relaxed mt-4 whitespace-pre-line">
                        {current.body}
                      </p>
                    </div>

                    {/* Progress dots */}
                    <div className="px-8 pb-2 flex items-center gap-1.5">
                      {STEPS.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === step
                              ? `w-6 bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`
                              : i < step
                              ? 'w-1.5 bg-[var(--foreground)] opacity-40'
                              : 'w-1.5 bg-[var(--border)]'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="px-8 py-5 flex items-center justify-between border-t border-[var(--border)] bg-[var(--muted)]">
                      {!isFirst ? (
                        <button
                          onClick={handlePrev}
                          className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                          Previous
                        </button>
                      ) : (
                        <button
                          onClick={stop}
                          className="text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                          Skip tour
                        </button>
                      )}
                      <button
                        onClick={handleNext}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-gradient-to-r ${current.accentFrom} ${current.accentTo} text-white shadow-md hover:opacity-90 transition-opacity`}
                      >
                        {isLast ? "Let's go!" : isFirst ? 'Start tour' : 'Next'}
                        {!isLast && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* ── Spotlight tooltip card ────────────────────────────────────── */}
          {!full && hasSpot && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`tooltip-${step}`}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{
                  position: 'fixed',
                  top: placement!.top,
                  left: placement!.left,
                  width: CARD_W,
                  zIndex: 120,
                  // No overflow here — the arrow extends outside these bounds
                }}
              >
                {/* Relative wrapper so arrow positions against the card edge */}
                <div style={{ position: 'relative' }}>

                {/* Arrow pointer */}
                <div style={arrowStyle(placement!.arrowSide)} />

                <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.06)]">
                  <div className={`h-1 bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`} />
                  <div className="bg-white">
                    {/* Header */}
                    <div className="flex items-start gap-3 px-5 pt-4 pb-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${current.accentFrom} ${current.accentTo} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
                        {current.icon}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-[14px] font-bold tracking-[-0.015em] text-[var(--foreground)]">
                            {current.title}
                          </h2>
                          <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums font-medium">
                            {step}/{TOUR_TOTAL_STEPS - 2}
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--accent)] font-medium">{current.subtitle}</p>
                      </div>
                      <button
                        onClick={stop}
                        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-all flex-shrink-0"
                        title="Close tour"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                      </button>
                    </div>

                    {/* Body — scroll if content too tall */}
                    <div className="px-5 pb-3 max-h-[240px] overflow-y-auto">
                      <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed whitespace-pre-line">
                        {current.body}
                      </p>
                      {current.tip && (
                        <div className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`}>
                          <Sparkles className="w-3 h-3 text-white flex-shrink-0 mt-0.5" strokeWidth={2} />
                          <p className="text-[11px] text-white font-medium leading-relaxed">
                            {current.tip}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress + nav */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--muted)]">
                      <div className="flex items-center gap-1.5">
                        {STEPS.map((_, i) => (
                          <div
                            key={i}
                            className={`rounded-full transition-all duration-300 ${
                              i === 0 || i === TOUR_TOTAL_STEPS - 1
                                ? 'hidden'
                                : i === step
                                ? `h-1.5 w-5 bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`
                                : i < step
                                ? 'h-1.5 w-1.5 bg-[var(--foreground)] opacity-40'
                                : 'h-1.5 w-1.5 bg-[var(--border)]'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrev}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted-foreground)] hover:bg-white hover:text-[var(--foreground)] transition-all"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                          Back
                        </button>
                        <button
                          onClick={handleNext}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r ${current.accentFrom} ${current.accentTo} text-white shadow-sm hover:opacity-90 transition-opacity`}
                        >
                          {step === TOUR_TOTAL_STEPS - 2 ? 'Finish' : 'Next'}
                          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                </div>{/* end position:relative arrow wrapper */}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Fallback floating card (target not yet found) ─────────────── */}
          {!full && !hasSpot && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] w-[480px] pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`fallback-${step}`}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="pointer-events-auto rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.06)]"
                >
                  <div className={`h-1 bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`} />
                  <div className="bg-white px-5 py-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${current.accentFrom} ${current.accentTo} flex items-center justify-center text-white flex-shrink-0`}>
                      {current.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--foreground)]">{current.title}</p>
                      <p className="text-[12px] text-[var(--muted-foreground)] truncate">{current.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={handlePrev}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-all"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                        Back
                      </button>
                      <button
                        onClick={handleNext}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r ${current.accentFrom} ${current.accentTo} text-white shadow-sm hover:opacity-90 transition-opacity`}
                      >
                        {step === TOUR_TOTAL_STEPS - 2 ? 'Finish' : 'Next'}
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* ── Step progress pills (top-right, intermediate steps only) ──── */}
          {!full && (
            <div className="fixed top-4 right-4 z-[120] pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-[var(--border)] rounded-xl px-3 py-1.5 shadow-md pointer-events-auto"
              >
                {STEPS.filter((_, i) => i > 0 && i < TOUR_TOTAL_STEPS - 1).map((s, idx) => {
                  const realIdx = idx + 1;
                  return (
                    <button
                      key={s.id}
                      title={s.label}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 ${
                        realIdx === step
                          ? `bg-gradient-to-r ${STEPS[step]?.accentFrom} ${STEPS[step]?.accentTo} text-white`
                          : realIdx < step
                          ? 'text-[var(--foreground)] bg-[var(--muted)]'
                          : 'text-[var(--muted-foreground)]'
                      }`}
                    >
                      {realIdx < step && <CheckCircle className="w-3 h-3" strokeWidth={2.5} />}
                      {s.label}
                    </button>
                  );
                })}
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  )}
    </>
  );
}
