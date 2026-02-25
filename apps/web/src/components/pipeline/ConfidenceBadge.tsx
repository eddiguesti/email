'use client';

import { getConfidenceBand, CONFIDENCE_BAND_COLORS } from '@/types/pipeline';

interface Props {
  confidence: number | null;
  matched: boolean;
}

export default function ConfidenceBadge({ confidence, matched }: Props) {
  const band = getConfidenceBand(confidence, matched);
  const colorClass = CONFIDENCE_BAND_COLORS[band];
  const label = confidence !== null ? `${Math.round(confidence * 100)}%` : 'N/A';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
