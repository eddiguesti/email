'use client';

import { useEffect, useState, useRef } from 'react';
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
  icon: React.ReactNode;
  label: string;          // short nav label
  title: string;
  subtitle: string;
  body: string;
  tip?: string;           // highlighted "pro tip"
  accentFrom: string;     // tailwind gradient from
  accentTo: string;       // tailwind gradient to
  accentText: string;     // text colour on accent bg
  cta?: string;           // optional in-step action label
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    route: null,
    icon: <Sparkles className="w-8 h-8" strokeWidth={1.5} />,
    label: 'Bienvenue',
    title: 'Bienvenue sur LB-Bot',
    subtitle: 'Votre assistant juridique IA',
    body: "LB-Bot analyse chaque email entrant, le classe automatiquement dans le bon dossier Kleos, rédige des réponses dans votre style et répond à vos questions sur vos dossiers — le tout en arrière-plan.\n\nCette visite guidée vous présente les 5 modules clés en moins de 2 minutes.",
    accentFrom: 'from-slate-900',
    accentTo: 'to-slate-700',
    accentText: 'text-white',
  },
  {
    id: 'pipeline',
    route: '/dashboard/review/matches',
    icon: <Mail className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Correspondances',
    title: 'Pipeline Email',
    subtitle: 'Classement automatique IA',
    body: "Chaque email de votre boîte est analysé en temps réel. LB-Bot identifie le dossier Kleos correspondant grâce à 8 méthodes de matching combinées (référence, expéditeur, mots-clés, IA).\n\nLes emails classés avec plus de 85 % de confiance sont archivés automatiquement. Les autres passent en file de revue.",
    tip: "Cliquez sur n'importe quelle ligne pour ouvrir le panneau de détail.",
    accentFrom: 'from-indigo-600',
    accentTo: 'to-violet-600',
    accentText: 'text-white',
  },
  {
    id: 'drawer',
    route: '/dashboard/review/matches',
    icon: <Eye className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Panneau de détail',
    title: 'Email + IA dans un seul panneau',
    subtitle: 'Contexte complet, actions rapides',
    body: "En cliquant sur une correspondance, le panneau de détail s'ouvre à droite. Vous y voyez le message complet, le fil de discussion, et le dossier associé.\n\nDeux outils IA y sont intégrés : l'assistant dossier (posez des questions sur l'affaire sans ouvrir Kleos) et la génération de réponse dans votre style d'écriture personnel.",
    tip: "Les réponses générées utilisent vos vraies formules d'introduction et de clôture.",
    accentFrom: 'from-violet-600',
    accentTo: 'to-purple-600',
    accentText: 'text-white',
  },
  {
    id: 'queue',
    route: '/dashboard/review/queue',
    icon: <CheckCircle className="w-6 h-6" strokeWidth={1.5} />,
    label: 'File de revue',
    title: 'File de revue',
    subtitle: 'Validez les classements incertains',
    body: "Quand l'IA n'est pas suffisamment confiante (60–85 %), l'email attend votre validation dans la file de revue. Vous voyez l'expéditeur, le dossier suggéré et les raisons du matching.\n\nUn clic sur Approuver ou Rejeter. Chaque décision affine la précision du modèle pour votre cabinet.",
    tip: "Vous pouvez aussi générer et envoyer une réponse directement depuis la file.",
    accentFrom: 'from-amber-500',
    accentTo: 'to-orange-500',
    accentText: 'text-white',
  },
  {
    id: 'calendar',
    route: '/dashboard/calendar',
    icon: <CalendarDays className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Calendrier',
    title: 'Calendrier intelligent',
    subtitle: 'Agenda Microsoft 365 + suggestions IA',
    body: "Retrouvez tous vos rendez-vous Microsoft 365 directement dans LB-Bot — vue mois, semaine ou agenda. Cliquez sur un événement pour en voir les détails.\n\nL'IA détecte les intentions de réunion dans vos emails (« réunion lundi à 14h », « disponible pour un appel ») et propose d'ajouter le créneau à votre agenda en un clic.",
    tip: "Les suggestions restent en attente jusqu'à ce que vous les acceptiez ou les ignoriez.",
    accentFrom: 'from-emerald-600',
    accentTo: 'to-teal-600',
    accentText: 'text-white',
  },
  {
    id: 'ai',
    route: null,
    icon: <MessageSquare className="w-6 h-6" strokeWidth={1.5} />,
    label: 'Assistant IA',
    title: 'Assistant IA global',
    subtitle: 'Questions en langage naturel',
    body: "L'icône ✦ en bas à droite de chaque page ouvre l'assistant IA. Posez des questions sur vos emails en français courant :\n\n« Emails urgents du tribunal cette semaine » · « Dossiers sans réponse depuis 3 jours » · « Courriers de Charlotte Liron »\n\nL'IA comprend le contexte juridique et retrouve les emails pertinents.",
    tip: "L'assistant est disponible depuis toutes les pages du tableau de bord.",
    accentFrom: 'from-blue-600',
    accentTo: 'to-cyan-600',
    accentText: 'text-white',
  },
  {
    id: 'done',
    route: '/dashboard/review',
    icon: <LayoutDashboard className="w-8 h-8" strokeWidth={1.5} />,
    label: 'Terminé',
    title: 'Vous êtes prêt !',
    subtitle: 'La plateforme est à vous',
    body: "Vous connaissez maintenant les 5 modules clés de LB-Bot. Le pipeline tourne en arrière-plan — les emails arrivent, sont analysés et classés automatiquement.\n\nLe guide est toujours accessible depuis l'icône Boussole dans la barre latérale.",
    accentFrom: 'from-emerald-600',
    accentTo: 'to-emerald-500',
    accentText: 'text-white',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isFullScreen = (step: number) => step === 0 || step === TOUR_TOTAL_STEPS - 1;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TourOverlay() {
  const { active, step, stop, next, prev } = useTour();
  const router   = useRouter();
  const [mounted, setMounted] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1); // slide direction
  const prevStepRef = useRef(step);

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

  const slideVariants = {
    enter: { opacity: 0, x: dir * 40 },
    center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
    exit: { opacity: 0, x: dir * -40, transition: { duration: 0.2 } },
  };

  return (
    <>
    {createPortal(
    <AnimatePresence>
      {active && (
        <>
          {/* Backdrop — darker for welcome/done, subtle for intermediate steps */}
          <motion.div
            key={`backdrop-${full ? 'full' : 'partial'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`fixed inset-0 ${full ? 'z-[110] bg-black/70 backdrop-blur-sm' : 'z-[110] bg-black/25 backdrop-blur-[2px]'}`}
            onClick={full ? undefined : stop}
          />

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
                  {/* Gradient top cap */}
                  <div className={`h-2 rounded-t-2xl bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`} />

                  <div className="bg-white rounded-b-2xl shadow-[0_32px_80px_rgba(0,0,0,0.3)] overflow-hidden">
                    {/* Body */}
                    <div className="px-8 py-8">
                      {/* Icon */}
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

                    {/* Footer actions */}
                    <div className="px-8 py-5 flex items-center justify-between border-t border-[var(--border)] bg-[var(--muted)]">
                      {!isFirst ? (
                        <button
                          onClick={handlePrev}
                          className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                          Précédent
                        </button>
                      ) : (
                        <button
                          onClick={stop}
                          className="text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                          Passer la visite
                        </button>
                      )}

                      <button
                        onClick={handleNext}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-gradient-to-r ${current.accentFrom} ${current.accentTo} text-white shadow-md hover:opacity-90 transition-opacity`}
                      >
                        {isLast ? 'Commencer !' : isFirst ? 'Commencer la visite' : 'Suivant'}
                        {!isLast && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* ── Floating bottom card (intermediate steps) ───────────────── */}
          {!full && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] w-[540px] pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`card-${step}`}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="pointer-events-auto rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.06)]"
                >
                  {/* Gradient top stripe */}
                  <div className={`h-1 bg-gradient-to-r ${current.accentFrom} ${current.accentTo}`} />

                  <div className="bg-white">
                    {/* Header */}
                    <div className="flex items-start gap-3 px-5 pt-4 pb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${current.accentFrom} ${current.accentTo} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
                        {current.icon}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-[15px] font-bold tracking-[-0.015em] text-[var(--foreground)]">
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
                        title="Fermer la visite"
                      >
                        <X className="w-4 h-4" strokeWidth={1.8} />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="px-5 pb-3">
                      <p className="text-[13px] text-[var(--muted-foreground)] leading-relaxed whitespace-pre-line">
                        {current.body}
                      </p>

                      {current.tip && (
                        <div className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r ${current.accentFrom} ${current.accentTo} bg-opacity-10`}>
                          <Sparkles className="w-3.5 h-3.5 text-white flex-shrink-0 mt-0.5" strokeWidth={2} />
                          <p className="text-[12px] text-white font-medium leading-relaxed">
                            {current.tip}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress + nav */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--muted)]">
                      {/* Dot progress */}
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

                      {/* Nav buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrev}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted-foreground)] hover:bg-white hover:text-[var(--foreground)] transition-all"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                          Retour
                        </button>
                        <button
                          onClick={handleNext}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-semibold bg-gradient-to-r ${current.accentFrom} ${current.accentTo} text-white shadow-sm hover:opacity-90 transition-opacity`}
                        >
                          {step === TOUR_TOTAL_STEPS - 2 ? 'Terminer' : 'Suivant'}
                          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* ── Step nav pills (visible at top right for intermediate steps) */}
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
