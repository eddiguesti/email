'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const tabs = [
  { name: 'All Matches', href: '/dashboard/review/matches' },
  { name: 'Pending Review (60–85%)', href: '/dashboard/review/queue' },
  { name: 'Senders', href: '/dashboard/review/senders' },
  { name: 'Outlook Add-in', href: '/dashboard/review/addin' },
];

export default function ReviewNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-[var(--border)]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative px-4 py-3 text-[13px] font-medium transition-colors duration-200 ${
              isActive
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.name}
            {isActive && (
              <motion.span
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--foreground)] rounded-full"
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
