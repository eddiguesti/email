'use client';

import { Download, ExternalLink, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const STEPS = [
  { step: 'Téléchargez le manifest avec le bouton ci-dessous', note: 'Fichier : lb-bot-manifest.xml' },
  { step: 'Ouvrez Outlook (application bureau, pas le navigateur)', note: null },
  { step: 'Dans le ruban Accueil, cliquez sur "Obtenir des compléments" (icône puzzle ou store)', note: 'Si absent : … → Obtenir des compléments' },
  { step: 'Dans la fenêtre qui s\'ouvre, cliquez sur "Mes compléments" en haut à gauche', note: null },
  { step: 'En bas sous "Compléments personnalisés", cliquez sur "+ Ajouter depuis un fichier…"', note: null },
  { step: 'Sélectionnez lb-bot-manifest.xml puis cliquez sur Installer', note: 'Acceptez l\'avertissement de sécurité si demandé' },
  { step: 'Ouvrez n\'importe quel email — le bouton "Classer l\'email" apparaît dans le ruban', note: null },
];

const FEATURES = [
  'Voir le dossier suggéré pour l\'email ouvert',
  'Approuver ou corriger la correspondance',
  'Classer l\'email dans KLEOS en un clic',
  'Déplacer l\'email dans un dossier Outlook',
  'Rechercher manuellement un dossier',
];

export default function AddinPage() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6 max-w-3xl">

      <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            Installation du complément Outlook
          </h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
            Accédez au classement IA directement depuis votre boîte mail
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Steps */}
          <ol className="space-y-4">
            {STEPS.map(({ step, note }, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="w-7 h-7 rounded-full bg-[var(--foreground)] text-white text-[12px] font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[14px] text-[var(--foreground)]">{step}</p>
                  {note && (
                    <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5 italic">{note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Download button */}
          <a
            href="/api/outlook-addin/manifest"
            download="lb-bot-manifest.xml"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium hover:opacity-90 transition-all duration-200"
          >
            <Download className="w-4 h-4" strokeWidth={1.8} />
            Télécharger le manifest
          </a>

          <a
            href="https://learn.microsoft.com/fr-fr/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-200 ml-4"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
            Guide Microsoft officiel
          </a>
        </div>
      </motion.div>

      {/* Features */}
      <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-4">
          Ce que vous pouvez faire depuis Outlook
        </h2>
        <div className="space-y-2.5">
          {FEATURES.map((feat, i) => (
            <div key={i} className="flex items-center gap-3">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={2} />
              <span className="text-[13px] text-[var(--muted-foreground)]">{feat}</span>
            </div>
          ))}
        </div>
      </motion.div>

    </motion.div>
  );
}
