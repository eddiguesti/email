'use client';

import { MATCH_SOURCE_LABELS } from '@/types/pipeline';
import type { MatchLogFilters } from '@/types/pipeline';

interface Props {
  filters: MatchLogFilters;
  onChange: (filters: MatchLogFilters) => void;
}

const selectClasses = "px-3 py-2 text-[13px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200 appearance-none cursor-pointer";
const inputClasses = "px-3 py-2 text-[13px] rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200";
const labelClasses = "text-[11px] text-[var(--muted-foreground)] mb-1 block";

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
    if (v === 'to_review')         update({ matched: true,      reviewed: 'false' });
    else if (v === 'unclassified') update({ matched: false,     reviewed: undefined });
    else                           update({ matched: undefined, reviewed: undefined });
  };

  return (
    <div className="flex flex-wrap gap-4 p-5 bg-white rounded-2xl shadow-[var(--shadow-card)]">
      {/* Quick workflow preset */}
      <div>
        <label className={labelClasses}>Tâche rapide</label>
        <select
          value={quickFilter}
          onChange={(e) => applyQuickFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">Tous les emails</option>
          <option value="to_review">En attente de validation (60–85%)</option>
          <option value="unclassified">Sans dossier associé</option>
        </select>
      </div>

      {/* Matched filter — renamed to avoid confusion with "Classé" badge */}
      <div>
        <label className={labelClasses}>Dossier trouvé</label>
        <select
          value={filters.matched === undefined ? '' : String(filters.matched)}
          onChange={(e) => {
            const v = e.target.value;
            update({ matched: v === '' ? undefined : v === 'true' });
          }}
          className={selectClasses}
        >
          <option value="">Tous</option>
          <option value="true">Oui — dossier trouvé</option>
          <option value="false">Non — sans dossier</option>
        </select>
      </div>

      {/* Source */}
      <div>
        <label className={labelClasses}>Source de détection</label>
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
      </div>

      {/* Lawyer */}
      <div>
        <label className={labelClasses}>Avocat</label>
        <input
          type="text"
          placeholder="Rechercher..."
          value={filters.lawyer || ''}
          onChange={(e) => update({ lawyer: e.target.value || undefined })}
          className={`${inputClasses} w-36`}
        />
      </div>

      {/* Date range with labels */}
      <div>
        <label className={labelClasses}>Reçu après le</label>
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => update({ date_from: e.target.value || undefined })}
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Reçu avant le</label>
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => update({ date_to: e.target.value || undefined })}
          className={inputClasses}
        />
      </div>

      {/* Review status — renamed to avoid "À revoir" clash with confidence badge */}
      <div>
        <label className={labelClasses}>Statut de validation</label>
        <select
          value={filters.reviewed || ''}
          onChange={(e) => update({ reviewed: e.target.value || undefined })}
          className={selectClasses}
        >
          <option value="">Tous</option>
          <option value="false">Non validés</option>
          <option value="true">Déjà validés</option>
        </select>
      </div>
    </div>
  );
}
