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
} from 'lucide-react';

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
    title: 'Tableau de bord',
    subtitle: "Vue d'ensemble en temps réel",
    description:
      "La page d'accueil de la plateforme. Elle concentre les métriques clés du pipeline email, les correspondances récentes, les dossiers les plus actifs et vos prochains rendez-vous.",
    features: [
      { icon: <BarChart3 className="w-4 h-4" strokeWidth={1.8} />, label: 'Statistiques 30 jours', detail: 'Emails traités, taux de classement, auto-classés et éléments à revoir.' },
      { icon: <Mail className="w-4 h-4" strokeWidth={1.8} />, label: 'Correspondances récentes', detail: 'Les derniers emails associés à un dossier Kleos avec leur score de confiance.' },
      { icon: <CalendarDays className="w-4 h-4" strokeWidth={1.8} />, label: 'Prochains rendez-vous', detail: 'Les 4 prochains événements de votre agenda Microsoft 365.' },
    ],
    link: '/dashboard',
    linkLabel: 'Ouvrir le tableau de bord',
    color: 'var(--primary)',
  },
  {
    number: '02',
    icon: <ScanSearch className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Revue Pipeline',
    subtitle: 'Toutes les correspondances email → dossier',
    description:
      "Le cœur du système. Chaque email entrant est analysé par l'IA et associé au dossier Kleos le plus probable. Cette section vous permet d'explorer l'ensemble du flux de traitement.",
    features: [
      { icon: <CheckCircle className="w-4 h-4" strokeWidth={1.8} />, label: 'Correspondances', detail: 'Liste complète de tous les emails traités et leur dossier associé. Filtrable par boîte mail, date, source.' },
      { icon: <Eye className="w-4 h-4" strokeWidth={1.8} />, label: 'File de revue', detail: 'Emails sous le seuil de confiance (85 %) qui attendent votre validation. Approuvez ou rejetez en un clic.' },
      { icon: <BarChart3 className="w-4 h-4" strokeWidth={1.8} />, label: 'Analytiques', detail: 'Graphiques détaillés : taux de classement quotidien, répartition des sources de matching.' },
      { icon: <Sliders className="w-4 h-4" strokeWidth={1.8} />, label: 'Tuning', detail: 'Ajustez les seuils de confiance par source (objet, expéditeur, contenu) pour affiner la précision.' },
    ],
    link: '/dashboard/review/matches',
    linkLabel: 'Voir les correspondances',
    color: 'var(--accent)',
  },
  {
    number: '03',
    icon: <Eye className="w-5 h-5" strokeWidth={1.8} />,
    title: 'File de revue',
    subtitle: 'Valider les classements incertains',
    description:
      "Quand l'IA n'est pas sûre à plus de 85 %, elle place l'email dans la file de revue pour que vous preniez la décision finale. Chaque validation améliore le modèle.",
    features: [
      { icon: <CheckCircle className="w-4 h-4" strokeWidth={1.8} />, label: 'Approuver', detail: "Confirmer l'association suggérée — l'email est classé dans Kleos." },
      { icon: <Mail className="w-4 h-4" strokeWidth={1.8} />, label: 'Rejeter', detail: "Indiquer que la suggestion est incorrecte — le modèle apprend de ce retour." },
      { icon: <ScanSearch className="w-4 h-4" strokeWidth={1.8} />, label: 'Contexte complet', detail: 'Objet, expéditeur, extrait du corps et score de confiance visible pour chaque élément.' },
    ],
    link: '/dashboard/review/queue',
    linkLabel: 'Ouvrir la file de revue',
    color: 'var(--warning)',
  },
  {
    number: '04',
    icon: <CalendarDays className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Calendrier',
    subtitle: 'Agenda Microsoft 365 + suggestions',
    description:
      'Visualisez vos rendez-vous directement depuis Microsoft 365. Le moteur IA détecte également les intentions de réunion dans vos emails et propose des créneaux à ajouter à votre agenda.',
    features: [
      { icon: <CalendarDays className="w-4 h-4" strokeWidth={1.8} />, label: 'Vue mois / semaine / agenda', detail: 'Naviguez entre les vues mensuelle, hebdomadaire et liste selon vos préférences.' },
      { icon: <Sparkles className="w-4 h-4" strokeWidth={1.8} />, label: 'Suggestions IA', detail: "Créneaux détectés automatiquement dans vos emails. Acceptez ou rejetez d'un clic." },
      { icon: <Bell className="w-4 h-4" strokeWidth={1.8} />, label: 'Détails événements', detail: 'Cliquez sur un événement pour voir lieu, lien de réunion en ligne, et détails complets.' },
    ],
    link: '/dashboard/calendar',
    linkLabel: 'Ouvrir le calendrier',
    color: 'var(--success)',
  },
  {
    number: '05',
    icon: <Activity className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Activité',
    subtitle: "Journal d'audit complet",
    description:
      "Consultez l'historique de toutes les actions effectuées sur la plateforme : approbations, rejets, modifications de paramètres, connexions. Filtrez par utilisateur ou par type d'action.",
    features: [
      { icon: <CheckCircle className="w-4 h-4" strokeWidth={1.8} />, label: 'Toutes les actions', detail: 'Approbations, rejets, brouillons générés, connexions, modifications.' },
      { icon: <Users className="w-4 h-4" strokeWidth={1.8} />, label: 'Filtre par utilisateur', detail: "Affichez uniquement vos actions ou toutes les actions de l'équipe." },
      { icon: <Activity className="w-4 h-4" strokeWidth={1.8} />, label: 'Horodatage précis', detail: 'Chaque entrée est datée à la seconde avec le compte utilisateur associé.' },
    ],
    link: '/dashboard/activity',
    linkLabel: "Voir l'activité",
    color: 'var(--foreground)',
  },
  {
    number: '06',
    icon: <Sparkles className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Assistant IA',
    subtitle: 'Recherche en langage naturel',
    description:
      "Cliquez sur l'icône ✦ en bas à droite de n'importe quelle page pour ouvrir l'assistant IA. Posez des questions sur vos emails en français naturel et obtenez des réponses instantanées.",
    features: [
      { icon: <MessageSquare className="w-4 h-4" strokeWidth={1.8} />, label: 'Questions libres', detail: '« Emails urgents du tribunal cette semaine », « Dossiers sans réponse depuis 3 jours ».' },
      { icon: <ScanSearch className="w-4 h-4" strokeWidth={1.8} />, label: 'Recherche sémantique', detail: "L'IA comprend le contexte juridique et retrouve les emails pertinents même sans mot-clé exact." },
      { icon: <Sparkles className="w-4 h-4" strokeWidth={1.8} />, label: 'Disponible partout', detail: 'Le panneau IA est accessible depuis toutes les pages du tableau de bord.' },
    ],
    link: null,
    linkLabel: null,
    color: 'var(--accent)',
  },
  {
    number: '07',
    icon: <Settings className="w-5 h-5" strokeWidth={1.8} />,
    title: 'Paramètres',
    subtitle: 'Configuration de la plateforme',
    description:
      'Gérez vos préférences, les connexions aux services externes (Microsoft 365, Kleos) et les règles de traitement des emails.',
    features: [
      { icon: <Settings className="w-4 h-4" strokeWidth={1.8} />, label: 'Préférences', detail: "Notifications, thème, langue et options d'affichage." },
      { icon: <Mail className="w-4 h-4" strokeWidth={1.8} />, label: 'Connexions', detail: 'Statut de la connexion Microsoft 365 et du compte Kleos.' },
    ],
    link: '/dashboard/settings',
    linkLabel: 'Ouvrir les paramètres',
    color: 'var(--muted-foreground)',
  },
];

export default function TourPage() {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-10 max-w-4xl"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-[var(--muted)] text-[var(--foreground)]">
            <Compass className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <h1 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">
            Guide de la plateforme
          </h1>
        </div>
        <p className="text-[14px] text-[var(--muted-foreground)] leading-relaxed max-w-2xl">
          Découvrez toutes les fonctionnalités de LB-Bot. Chaque section explique ce qu&apos;elle fait,
          comment s&apos;en servir, et vous donne accès direct à la page correspondante.
        </p>
      </motion.div>

      {/* Sections */}
      {sections.map((s) => (
        <motion.div
          key={s.number}
          variants={fadeUp}
          className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
        >
          {/* Section header */}
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
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                    {s.title}
                  </h2>
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

          {/* Feature breakdown */}
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

      {/* Footer tip */}
      <motion.div
        variants={fadeUp}
        className="p-5 rounded-2xl border border-dashed border-[var(--border)] text-center"
      >
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Ce guide est toujours accessible depuis l&apos;icône{' '}
          <Compass className="w-3.5 h-3.5 inline-block -mt-0.5" strokeWidth={1.8} /> dans la barre
          latérale.
        </p>
      </motion.div>
    </motion.div>
  );
}
