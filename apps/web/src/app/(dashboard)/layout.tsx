'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import AIChatPanel from '@/components/AIChatPanel';
import OnboardingModal from '@/components/OnboardingModal';
import { useAuth } from '@/context/AuthContext';
import { getUserPreferences } from '@/lib/pipeline-api';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Check if the user has completed onboarding
  useEffect(() => {
    if (!user?.id) return;

    // Fast local check first — avoids modal flash on return visits
    const localKey = `lb_onboarded_${user.id}`;
    if (localStorage.getItem(localKey)) return;

    getUserPreferences()
      .then(res => {
        if (res.preferences?.onboarded) {
          localStorage.setItem(localKey, '1');
        } else {
          setShowOnboarding(true);
        }
      })
      .catch(() => {
        // On error, skip onboarding so it doesn't block the dashboard
      });
  }, [user?.id]);

  const handleOnboardingComplete = () => {
    if (user?.id) localStorage.setItem(`lb_onboarded_${user.id}`, '1');
    setShowOnboarding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)] mx-auto" />
          <p className="mt-4 text-[13px] text-[var(--muted-foreground)]">Chargement...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="pl-[260px]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="px-10 py-8 max-w-[1400px]"
        >
          {children}
        </motion.div>
      </main>
      <AIChatPanel />

      {/* First-login onboarding wizard */}
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
    </div>
  );
}
