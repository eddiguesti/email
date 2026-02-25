'use client';

import { CATEGORY_LABELS, CATEGORY_STYLES } from '@/types/pipeline';

interface Props {
  color: string | null;
  label?: string | null;
}

export default function CategoryBadge({ color, label }: Props) {
  if (!color) return null;

  const style = CATEGORY_STYLES[color] || 'bg-gray-50 text-gray-500 border-gray-100';
  const text = label || CATEGORY_LABELS[color] || color;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        color === 'green' ? 'bg-emerald-400' :
        color === 'orange' ? 'bg-amber-400' :
        color === 'red' ? 'bg-red-400' :
        color === 'blue' ? 'bg-blue-400' :
        color === 'grey' ? 'bg-gray-300' :
        color === 'purple' ? 'bg-purple-400' : 'bg-gray-300'
      }`} />
      {text}
    </span>
  );
}
