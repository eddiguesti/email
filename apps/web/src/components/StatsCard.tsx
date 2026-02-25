'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  description?: string;
}

export default function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  description,
}: StatsCardProps) {
  const changeColors = {
    positive: 'text-[var(--success)]',
    negative: 'text-[var(--destructive)]',
    neutral: 'text-[var(--muted-foreground)]',
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-400 ease-out">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-[var(--muted-foreground)]">{title}</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-[var(--foreground)]">{value}</p>
          {change && (
            <p className={`mt-1.5 text-[13px] ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
          {description && (
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">{description}</p>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--muted)]">
          <Icon className="w-5 h-5 text-[var(--muted-foreground)]" strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
