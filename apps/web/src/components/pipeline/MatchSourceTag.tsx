'use client';

import { MATCH_SOURCE_LABELS, MATCH_SOURCE_COLORS } from '@/types/pipeline';

interface Props {
  source: string | null;
}

export default function MatchSourceTag({ source }: Props) {
  if (!source) return <span className="text-[11px] text-[var(--muted-foreground)]">-</span>;

  const label = MATCH_SOURCE_LABELS[source] || source;
  const colorClass = MATCH_SOURCE_COLORS[source] || 'bg-gray-50 text-gray-500';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
