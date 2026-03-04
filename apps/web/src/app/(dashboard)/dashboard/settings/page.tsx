'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Globe,
  Shield,
  Save,
  Check,
  Loader2,
  Puzzle,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getUserPreferences, saveUserPreferences } from '@/lib/pipeline-api';
import { toast } from 'sonner';

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [urgentAlerts, setUrgentAlerts] = useState(true);
  const [language, setLanguage] = useState('fr');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getUserPreferences()
      .then(res => {
        if (res.preferences) {
          setEmailNotifications(res.preferences.email_notifications);
          setUrgentAlerts(res.preferences.urgent_alerts);
          setLanguage(res.preferences.language);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserPreferences({
        display_name: user?.displayName ?? null,
        email_notifications: emailNotifications,
        urgent_alerts: urgentAlerts,
        language,
      });
      toast.success('Settings saved');
    } catch {
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">Settings</h1>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
            Manage your preferences and account
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium disabled:opacity-40 hover:opacity-90 transition-all duration-200"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={1.8} />}
          Enregistrer
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile Section */}
        <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--muted)]">
              <User className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Profile</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--foreground)] flex items-center justify-center text-white text-[18px] font-medium">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="text-[15px] font-medium text-[var(--foreground)]">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-[13px] text-[var(--muted-foreground)]">
                  {user?.email || ''}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[12px] font-medium text-[var(--muted-foreground)]">Name</label>
                <input
                  type="text"
                  defaultValue={user?.displayName || ''}
                  disabled
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)] text-[13px] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[var(--muted-foreground)]">Email (monitored inbox)</label>
                <input
                  type="email"
                  defaultValue={user?.email || ''}
                  disabled
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)] text-[13px] cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Notifications Section */}
        <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--muted)]">
              <Bell className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Notifications</h2>

          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-[var(--foreground)]">Email notifications</p>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                  Receive emails for new routing events
                </p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  emailNotifications ? 'bg-[var(--foreground)]' : 'bg-gray-200'
                }`}
              >
                <motion.div
                  animate={{ x: emailNotifications ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-[var(--foreground)]">Urgent alerts</p>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                  Push notifications for urgent guest emails
                </p>
              </div>
              <button
                onClick={() => setUrgentAlerts(!urgentAlerts)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  urgentAlerts ? 'bg-[var(--foreground)]' : 'bg-gray-200'
                }`}
              >
                <motion.div
                  animate={{ x: urgentAlerts ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Language Section */}
        <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--muted)]">
              <Globe className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Language</h2>
          </div>
          <div className="p-6">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200"
            >
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </div>
        </motion.div>

        {/* Security Section */}
        <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--muted)]">
              <Shield className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Security</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50">
              <div className="flex items-center gap-3">
                <Check className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                <div>
                  <p className="text-[13px] font-medium text-emerald-700">Microsoft account connected</p>
                  <p className="text-[12px] text-emerald-600">Secure authentication active</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50">
              <p className="text-[13px] font-medium text-[var(--accent)] mb-0.5">Routing active</p>
              <p className="text-[12px] text-blue-600">
                The bot analyses and routes your emails to the correct department and booking in the PMS.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Outlook Add-in Section */}
        <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden lg:col-span-2">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--muted)]">
              <Puzzle className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Outlook Add-in</h2>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                Access AI email routing directly from your Outlook inbox
              </p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[var(--muted)] space-y-3">
                <p className="text-[13px] font-semibold text-[var(--foreground)]">Installation — Outlook Desktop</p>
                <ol className="space-y-2.5">
                  {[
                    { step: 'Download the manifest using the button on the right', note: 'File: grand-azure-manifest.xml' },
                    { step: 'Open Outlook (desktop app, not browser)', note: null },
                    { step: 'In the Home ribbon, click "Get Add-ins" (puzzle icon or store)', note: 'If not visible: … → Get Add-ins' },
                    { step: 'In the window that opens, click "My Add-ins" at the top left', note: null },
                    { step: 'Under "Custom Add-ins", click "+ Add from file…"', note: null },
                    { step: 'Select grand-azure-manifest.xml then click Install', note: 'Accept the security warning' },
                    { step: 'Open any email — the "Route Email" button appears in the ribbon', note: null },
                  ].map(({ step, note }, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[var(--foreground)] text-white text-[11px] font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[12px] text-[var(--muted-foreground)]">
                        {step}
                        {note && <span className="block text-[11px] text-[var(--muted-foreground)]/60 mt-0.5 italic">{note}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-[var(--border)] space-y-2">
                  <p className="text-[13px] font-medium text-[var(--foreground)]">Add-in features</p>
                  {[
                    'View the suggested booking for the open email',
                    'Generate an AI draft reply',
                    'Approve or reject the routing suggestion',
                    'Route email to PMS in one click',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" strokeWidth={2} />
                      <span className="text-[12px] text-[var(--muted-foreground)]">{feat}</span>
                    </div>
                  ))}
                </div>

                <a
                  href="/api/outlook-addin/manifest"
                  download="grand-azure-manifest.xml"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium hover:opacity-90 transition-all duration-200"
                >
                  <Download className="w-4 h-4" strokeWidth={1.8} />
                  Download manifest
                </a>

                <a
                  href="https://learn.microsoft.com/fr-fr/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--foreground)] text-[13px] hover:bg-[var(--muted)] transition-all duration-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Guide Microsoft
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
