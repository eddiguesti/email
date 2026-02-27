'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/context/AuthContext';
import { TourProvider } from '@/context/TourContext';
import { getUserPreferences } from '@/lib/pipeline-api';
import { Loader2 } from 'lucide-react';

// Lazy-load heavy panels — excluded from the initial JS bundle so first-load
// JavaScript is smaller. AIChatPanel is hidden on mount; OnboardingModal only
// appears for first-time users.
const AIChatPanel     = dynamic(() => import('@/components/AIChatPanel'),    { ssr: false });
const OnboardingModal = dynamic(() => import('@/components/OnboardingModal'), { ssr: false });
const TourOverlay     = dynamic(() => import('@/components/TourOverlay'),     { ssr: false });

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
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
    <TourProvider>
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="pl-[260px]">
          <div className="flex items-center justify-end px-10 pt-6 pb-2">
            <NotificationBell compact />
          </div>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="px-10 py-4 max-w-[1400px]"
          >
            {children}
          </motion.div>
        </main>
        <AIChatPanel />
        <TourOverlay />

        {/* First-login onboarding wizard */}
        {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      </div>
    </TourProvider>
  );
}
