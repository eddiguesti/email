'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

interface TourContextValue {
  active: boolean;
  step: number;
  total: number;
  start: (fromStep?: number) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const LS_ACTIVE = 'lb_tour_active';
const LS_STEP   = 'lb_tour_step';
export const TOUR_TOTAL_STEPS = 7; // 0 = welcome, 6 = done

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [step,   setStep]   = useState(0);

  // Restore from localStorage on mount (user refreshed mid-tour)
  useEffect(() => {
    const wasActive = localStorage.getItem(LS_ACTIVE) === '1';
    const savedStep = parseInt(localStorage.getItem(LS_STEP) ?? '0', 10);
    if (wasActive) {
      setActive(true);
      setStep(isNaN(savedStep) ? 0 : savedStep);
    }
  }, []);

  const start = useCallback((fromStep = 0) => {
    setStep(fromStep);
    setActive(true);
    localStorage.setItem(LS_ACTIVE, '1');
    localStorage.setItem(LS_STEP, String(fromStep));
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    localStorage.removeItem(LS_ACTIVE);
    localStorage.removeItem(LS_STEP);
  }, []);

  const next = useCallback(() => {
    setStep(s => {
      const next = Math.min(s + 1, TOUR_TOTAL_STEPS - 1);
      localStorage.setItem(LS_STEP, String(next));
      return next;
    });
  }, []);

  const prev = useCallback(() => {
    setStep(s => {
      const prev = Math.max(s - 1, 0);
      localStorage.setItem(LS_STEP, String(prev));
      return prev;
    });
  }, []);

  return (
    <TourContext.Provider value={{ active, step, total: TOUR_TOTAL_STEPS, start, stop, next, prev }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
