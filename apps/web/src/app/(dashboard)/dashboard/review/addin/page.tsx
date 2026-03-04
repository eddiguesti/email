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
  { step: 'Download the manifest using the button below', note: 'File: grand-azure-manifest.xml' },
  { step: 'Open Outlook (desktop app, not the browser)', note: null },
  { step: 'In the Home ribbon, click "Get Add-ins" (puzzle icon or store)', note: 'If not visible: … → Get Add-ins' },
  { step: 'In the window that opens, click "My Add-ins" at the top left', note: null },
  { step: 'Under "Custom Add-ins", click "+ Add from file…"', note: null },
  { step: 'Select grand-azure-manifest.xml then click Install', note: 'Accept the security warning if prompted' },
  { step: 'Open any email — the "Route Email" button appears in the ribbon', note: null },
];

const FEATURES = [
  'View the suggested booking for the open email',
  'Approve or correct the routing suggestion',
  'Route email to PMS in one click',
  'Move the email to an Outlook folder',
  'Manually search for a booking',
];

export default function AddinPage() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6 max-w-3xl">

      <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            Outlook Add-in Installation
          </h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
            Access AI email routing directly from your inbox
          </p>
        </div>

        <div className="p-6 space-y-6">
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

          <a
            href="/api/outlook-addin/manifest"
            download="grand-azure-manifest.xml"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium hover:opacity-90 transition-all duration-200"
          >
            <Download className="w-4 h-4" strokeWidth={1.8} />
            Download manifest
          </a>

          <a
            href="https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-200 ml-4"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
            Microsoft official guide
          </a>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-4">
          What you can do from Outlook
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
