'use client';

import { MATCH_SOURCE_LABELS } from '@/types/pipeline';
import type { MatchLogFilters } from '@/types/pipeline';

interface Props {
  filters: MatchLogFilters;
  onChange: (filters: MatchLogFilters) => void;
}

const selectClasses = "px-3 py-2 text-[13px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200 appearance-none cursor-pointer";
const inputClasses = "px-3 py-2 text-[13px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200";

export default function FilterBar({ filters, onChange }: Props) {
  const update = (partial: Partial<MatchLogFilters>) => {
    onChange({ ...filters, ...partial, page: 1 });
  };

  // Derive quick-filter value from current filter state
  const quickFilter =
    filters.matched === true && filters.reviewed === 'false' ? 'to_review' :
    filters.matched === false ? 'unclassified' :
    '';

  const applyQuickFilter = (v: string) => {
    if (v === 'to_review')    update({ matched: true,      reviewed: 'false' });
    else if (v === 'unclassified') update({ matched: false, reviewed: undefined });
    else                      update({ matched: undefined, reviewed: undefined });
  };

  return (
    <div className="flex flex-wrap gap-2.5 p-5 bg-white rounded-2xl shadow-[var(--shadow-card)]">
      {/* Quick action preset — most common lawyer workflow */}
      <select
        value={quickFilter}
        onChange={(e) => applyQuickFilter(e.target.value)}
        className={selectClasses}
      >
        <option value="">Action : tous</option>
        <option value="to_review">À revoir</option>
        <option value="unclassified">À classer</option>
      </select>

      <select
        value={filters.matched === undefined ? '' : String(filters.matched)}
        onChange={(e) => {
          const v = e.target.value;
          update({ matched: v === '' ? undefined : v === 'true' });
        }}
        className={selectClasses}
      >
        <option value="">Tous</option>
        <option value="true">Classés</option>
        <option value="false">Non classés</option>
      </select>

      <select
        value={filters.source || ''}
        onChange={(e) => update({ source: e.target.value || undefined })}
        className={selectClasses}
      >
        <option value="">Toutes les sources</option>
        {Object.entries(MATCH_SOURCE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Avocat..."
        value={filters.lawyer || ''}
        onChange={(e) => update({ lawyer: e.target.value || undefined })}
        className={`${inputClasses} w-32`}
      />

      <input
        type="date"
        value={filters.date_from || ''}
        onChange={(e) => update({ date_from: e.target.value || undefined })}
        className={inputClasses}
      />

      <input
        type="date"
        value={filters.date_to || ''}
        onChange={(e) => update({ date_to: e.target.value || undefined })}
        className={inputClasses}
      />

      <select
        value={filters.reviewed || ''}
        onChange={(e) => update({ reviewed: e.target.value || undefined })}
        className={selectClasses}
      >
        <option value="">Revue: tous</option>
        <option value="true">Déjà revus</option>
        <option value="false">À revoir</option>
      </select>
    </div>
  );
}
