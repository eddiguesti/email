'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Mail, Shield, Zap, Play, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const { loginAsDemo, isDevMode } = useAuth();
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  const handleLogin = () => {
    window.location.href = '/api/auth/login?redirect=/dashboard/review';
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[420px]"
      >
        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-600 text-[13px]"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
            <span>{decodeURIComponent(error)}</span>
          </motion.div>
        )}

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex items-center gap-3 justify-center mb-10"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={40} height={40} priority />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              Brosset Techer
            </h1>
            <p className="text-[11px] text-[var(--muted-foreground)] font-medium">
              Gestion Interne
            </p>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">
            Bienvenue
          </h2>
          <p className="text-[15px] text-[var(--muted-foreground)] mt-2">
            Connectez-vous pour accéder au tableau de bord
          </p>
        </motion.div>

        {/* Login buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="space-y-3"
        >
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-[var(--primary)] text-white text-[15px] font-medium tracking-[-0.01em] hover:bg-[#333336] transition-colors duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <path d="M10 0H0V10H10V0Z" fill="#F25022" />
              <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
              <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
              <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
            </svg>
            Se connecter avec Microsoft
          </button>

          {isDevMode && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white text-[13px] text-[var(--muted-foreground)]">ou</span>
                </div>
              </div>

              <button
                onClick={loginAsDemo}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-[15px] font-medium tracking-[-0.01em] hover:bg-[#ebebed] transition-colors duration-200"
              >
                <Play className="w-4 h-4" />
                Mode démo
              </button>
            </>
          )}
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-12 pt-8 border-t border-[var(--border)]"
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: Mail, label: 'Classement intelligent' },
              { icon: Zap, label: 'Traitement instantané' },
              { icon: Shield, label: 'Sécurisé' },
            ].map((feature) => (
              <div key={feature.label} className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center mx-auto">
                  <feature.icon className="w-[18px] h-[18px] text-[var(--muted-foreground)]" strokeWidth={1.8} />
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-tight">{feature.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-[11px] text-[var(--muted-foreground)]">
            &copy; 2026 SELARL Brosset-Techer
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
