'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { X, Mail, Sparkles, CalendarDays, Eye, ArrowRight, Compass } from 'lucide-react';
import { useTour } from '@/context/TourContext';

const features = [
  {
    number: '01',
    icon: <Mail className="w-[18px] h-[18px]" strokeWidth={1.8} />,
    title: 'Pipeline Email',
    description:
      "Chaque email entrant est analysé par l'IA et classé automatiquement dans le bon dossier Kleos. Les emails sous 85 % de confiance attendent votre validation.",
    link: '/dashboard/review/queue',
    linkLabel: 'Voir la file de revue',
  },
  {
    number: '02',
    icon: <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.8} />,
    title: 'Assistant IA',
    description:
      "Cliquez sur l'icône ✦ en bas à droite pour interroger vos emails en langage naturel : « Emails urgents du tribunal cette semaine ».",
    link: null,
    linkLabel: null,
  },
  {
    number: '03',
    icon: <CalendarDays className="w-[18px] h-[18px]" strokeWidth={1.8} />,
    title: 'Calendrier',
    description:
      "Visualisez vos rendez-vous Microsoft 365 et acceptez les suggestions d'agenda détectées automatiquement dans vos emails.",
    link: '/dashboard/calendar',
    linkLabel: 'Ouvrir le calendrier',
  },
  {
    number: '04',
    icon: <Eye className="w-[18px] h-[18px]" strokeWidth={1.8} />,
    title: 'File de revue',
    description:
      "Approuvez ou rejetez les classements suggérés par l'IA. Chaque décision améliore la précision du modèle pour votre cabinet.",
    link: '/dashboard/review/queue',
    linkLabel: 'Ouvrir la file',
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function FeatureTour({ onDismiss }: { onDismiss: () => void }) {
  const { start } = useTour();

  const handleStartTour = () => {
    onDismiss();
    start(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white rounded-2xl shadow-[var(--shadow-card)] border border-[var(--border)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)]">
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            Découvrir la plateforme
          </h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
            Les 4 modules clés de LB-Bot
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-2 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-all duration-200"
          aria-label="Fermer la présentation"
        >
          <X className="w-4 h-4" strokeWidth={1.8} />
        </button>
      </div>

      {/* Feature cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]"
      >
        {features.map((f) => (
          <motion.div key={f.number} variants={fadeUp} className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono font-medium text-[var(--muted-foreground)] tabular-nums">
                {f.number}
              </span>
              <div className="p-2 rounded-xl bg-[var(--muted)] text-[var(--foreground)]">
                {f.icon}
              </div>
              <span className="text-[13px] font-semibold text-[var(--foreground)]">{f.title}</span>
            </div>
            <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed flex-1">
              {f.description}
            </p>
            {f.link && (
              <Link
                href={f.link}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
              >
                {f.linkLabel}
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Footer CTA */}
      <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/40">
        <p className="text-[12px] text-[var(--muted-foreground)]">
          Vous pouvez relancer cette présentation depuis le tableau de bord à tout moment.
        </p>
        <button
          onClick={handleStartTour}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--foreground)] text-white text-[12px] font-medium hover:opacity-90 transition-all duration-200 flex-shrink-0 ml-4"
        >
          <Compass className="w-3.5 h-3.5" strokeWidth={1.8} />
          Lancer la visite guidée
        </button>
      </div>
    </motion.div>
  );
}
