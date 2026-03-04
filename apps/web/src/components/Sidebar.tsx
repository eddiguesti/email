'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ScanSearch,
  Activity,
  CalendarDays,
  Compass,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const CONNECTED_SYSTEMS = [
  { name: 'Opera Cloud',    label: 'PMS',     color: 'bg-emerald-400' },
  { name: 'Microsoft 365',  label: 'Email',   color: 'bg-emerald-400' },
  { name: 'Salesforce CRM', label: 'CRM',     color: 'bg-emerald-400' },
  { name: 'Booking.com',    label: 'OTA',     color: 'bg-emerald-400' },
  { name: 'Expedia',        label: 'OTA',     color: 'bg-emerald-400' },
  { name: 'Amadeus GDS',    label: 'GDS',     color: 'bg-amber-400'   },
];

const navigation = [
  { name: 'Email Routing',  href: '/dashboard/review',   icon: ScanSearch      },
  { name: 'Calendar',       href: '/dashboard/calendar', icon: CalendarDays    },
  { name: 'Dashboard',      href: '/dashboard',          icon: LayoutDashboard },
  { name: 'Activity',       href: '/dashboard/activity', icon: Activity        },
  { name: 'Settings',       href: '/dashboard/settings', icon: Settings        },
  { name: 'Guide',          href: '/dashboard/tour',     icon: Compass         },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Error signing out');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed inset-y-0 left-0 z-50 w-[260px] bg-[var(--sidebar)] flex flex-col border-r border-[var(--border)]"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
          <Image src="/logo-small.svg" alt="Grand Azure Hotel" width={32} height={32} priority unoptimized />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            Grand Azure Hotel
          </h1>
          <p className="text-[11px] text-[var(--muted-foreground)] font-medium">
            Staff Portal
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              data-tour={item.name === 'Pipeline' ? 'nav-pipeline' : item.name === 'Calendrier' ? 'nav-calendar' : undefined}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                transition-all duration-200 ease-out
                ${isActive
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-muted)]'
                }
              `}
            >
              <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Connected systems */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
          Connected Systems
        </p>
        <div className="space-y-1">
          {CONNECTED_SYSTEMS.map(sys => (
            <div key={sys.name} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sys.color}`} />
              <span className="text-[11px] text-[var(--foreground)] flex-1 truncate">{sys.name}</span>
              <span className="text-[10px] text-[var(--muted-foreground)] font-medium">{sys.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User section */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--foreground)] font-medium text-xs">
            {user ? getInitials(user.displayName || user.email) : 'GA'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
              {user?.displayName || 'Grand Azure Hotel'}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">
              {user?.email || 'Admin'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-red-50 transition-all duration-200"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
