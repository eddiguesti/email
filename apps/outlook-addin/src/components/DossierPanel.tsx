import React, { useState, useRef } from 'react';
import {
  Button,
  Input,
  Spinner,
  Dropdown,
  Option,
  Badge,
} from '@fluentui/react-components';
import {
  CheckmarkCircleRegular,
  DocumentFolderRegular,
  ArchiveRegular,
  InfoRegular,
  SearchRegular,
  PersonAccountsRegular,
  GavelRegular,
  MailInboxRegular,
  DeleteRegular,
  ImportantRegular,
} from '@fluentui/react-icons';
import { useStore } from '../hooks/useStore';
import type { EmailInfo } from '../hooks/useEmailContext';
import ConfidenceBadge from './ConfidenceBadge';

interface FolderOption {
  name: string;
  label: string;
  icon: React.ReactElement;
}

const FOLDER_OPTIONS: FolderOption[] = [
  { name: 'LB - Clients',    label: 'Clients',              icon: <PersonAccountsRegular /> },
  { name: 'LB - e-Barreau',  label: 'e-Barreau',            icon: <GavelRegular /> },
  { name: 'LB - À revoir',   label: 'À revoir',             icon: <MailInboxRegular /> },
  { name: 'Junk',             label: 'Indésirables',         icon: <DeleteRegular /> },
];

interface DossierPanelProps {
  emailInfo: EmailInfo;
  status: any; // TODO: Type properly
}

export default function DossierPanel({ emailInfo, status }: DossierPanelProps) {
  const { approveDossier, fileToKleos, moveToFolder, searchKleos, loading } = useStore();
  const [selectedDossier, setSelectedDossier] = useState<string | null>(null);
  const [movingFolder, setMovingFolder] = useState<string | null>(null);
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ dossierId: string; dossierName: string; dossierRef: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [, setManualDossier] = useState<{ dossierId: string; dossierName: string; dossierRef: string } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchKleos(q);
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  };

  const handleSelectManual = async (dossier: { dossierId: string; dossierName: string; dossierRef: string }) => {
    setManualDossier(dossier);
    setSearchResults([]);
    setSearchQuery('');
    await approveDossier(emailInfo.mailbox, emailInfo.messageId, {
      dossierId: dossier.dossierId,
      dossierName: dossier.dossierName,
      dossierRef: dossier.dossierRef,
      confidence: 1,
      reasons: ['Sélection manuelle'],
      source: 'manual',
    });
  };

  const handleMoveToFolder = async (folderName: string) => {
    setMovingFolder(folderName);
    await moveToFolder(emailInfo.mailbox, emailInfo.messageId, folderName);
    setMovingFolder(null);
    setMovedTo(folderName);
  };

  const record = status?.record;
  const suggested = status?.suggestedDossier;
  const alternatives = status?.alternativeDossiers || [];
  const allDossiers = suggested ? [suggested, ...alternatives] : alternatives;

  const isApproved = record?.userApproved;
  const chosenDossier = record?.chosenDossierId;

  const handleApprove = async () => {
    const dossierId = selectedDossier || suggested?.dossierId;
    const dossier = allDossiers.find((d: any) => d.dossierId === dossierId);

    if (dossier) {
      await approveDossier(emailInfo.mailbox, emailInfo.messageId, dossier);
    }
  };

  const handleFile = async () => {
    if (chosenDossier) {
      const attachmentIds = status?.attachments?.map((a: any) => a.id) || [];
      await fileToKleos(emailInfo.mailbox, emailInfo.messageId, chosenDossier, attachmentIds);
    }
  };

  // Not yet processed
  if (!status?.found) {
    return (
      <div className="p-4">
        <div className="card animate-fade-in">
          <div className="flex items-center gap-2 text-gray-500">
            <Spinner size="tiny" />
            <span>Processing email...</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            This email is being analyzed. Please wait a moment.
          </p>
        </div>
      </div>
    );
  }

  // No matches found — show manual search
  if (!suggested && !isApproved) {
    return (
      <div className="p-4">
        <div className="card animate-fade-in">
          <div className="flex items-center gap-2 text-yellow-600 mb-3">
            <InfoRegular className="w-5 h-5" />
            <span className="font-medium">Aucun dossier trouvé automatiquement</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Recherchez et sélectionnez un dossier manuellement.
          </p>
          <Input
            placeholder="Nom du dossier, référence, partie..."
            value={searchQuery}
            onChange={(_, d) => handleSearch(d.value)}
            contentBefore={searchLoading ? <Spinner size="tiny" /> : <SearchRegular />}
            className="mb-2 w-full"
          />
          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden mt-1">
              {searchResults.map(r => (
                <button
                  key={r.dossierId}
                  onClick={() => handleSelectManual(r)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900 truncate">{r.dossierName}</div>
                  <div className="text-xs text-gray-500">{r.dossierRef}</div>
                </button>
              ))}
            </div>
          )}
          {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">Aucun résultat pour « {searchQuery} »</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Urgency banner — shown when sender flagged the email as high importance */}
      {emailInfo.importance === 'high' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
          <ImportantRegular className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm font-medium text-red-700">Email marqué urgent</span>
        </div>
      )}

      {/* Status Badge */}
      {record?.status && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Badge
            appearance="filled"
            color={
              record.status === 'FILED' || record.status === 'DONE'
                ? 'success'
                : record.status.includes('ERROR')
                  ? 'danger'
                  : 'brand'
            }
          >
            {record.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      )}

      {/* Suggested Dossier */}
      {suggested && !isApproved && (
        <div className="card card-hover animate-slide-up">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <DocumentFolderRegular className="w-5 h-5 text-brand-500" />
              <span className="font-medium">Suggested Dossier</span>
            </div>
            <ConfidenceBadge confidence={suggested.confidence} />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="font-medium text-gray-900">{suggested.dossierName}</div>
            <div className="text-sm text-gray-500">{suggested.dossierRef}</div>
          </div>

          {/* Reasons */}
          <div className="space-y-1 mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Match Reasons</div>
            {suggested.reasons.map((reason: string, idx: number) => (
              <div key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <CheckmarkCircleRegular className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
          </div>

          {/* Alternative Selection */}
          {alternatives.length > 0 && (
            <div className="mb-4">
              <Dropdown
                placeholder="Or select a different dossier..."
                onOptionSelect={(_, data) => setSelectedDossier(data.optionValue as string)}
              >
                {alternatives.map((alt: any) => (
                  <Option key={alt.dossierId} value={alt.dossierId} text={`${alt.dossierName} (${Math.round(alt.confidence * 100)}%)`}>
                    {alt.dossierName} ({Math.round(alt.confidence * 100)}%)
                  </Option>
                ))}
              </Dropdown>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              appearance="primary"
              onClick={handleApprove}
              disabled={loading}
              icon={loading ? <Spinner size="tiny" /> : undefined}
            >
              {selectedDossier ? 'Use Selected' : 'Approve'}
            </Button>
          </div>
        </div>
      )}

      {/* Approved Dossier */}
      {isApproved && (
        <div className="card card-hover animate-slide-up border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-3">
            <CheckmarkCircleRegular className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-700">Dossier Approved</span>
          </div>

          <div className="bg-green-50 rounded-lg p-3 mb-4">
            <div className="font-medium text-gray-900">{record.chosenDossierName}</div>
            <div className="text-sm text-gray-500">{chosenDossier}</div>
          </div>

          {/* File to Kleos Button */}
          {record.status !== 'FILED' && record.status !== 'DONE' && (
            <Button
              appearance="primary"
              onClick={handleFile}
              disabled={loading}
              icon={loading ? <Spinner size="tiny" /> : <ArchiveRegular />}
            >
              File to Kleos
            </Button>
          )}

          {(record.status === 'FILED' || record.status === 'DONE') && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckmarkCircleRegular className="w-5 h-5" />
              <span>Filed to Kleos</span>
            </div>
          )}
        </div>
      )}

      {/* Auto-file Notice */}
      {status?.canAutoFile && !isApproved && (
        <div className="text-xs text-gray-500 bg-blue-50 rounded p-2">
          High confidence match. This email can be auto-filed if enabled.
        </div>
      )}

      {/* ── Folder Classification ── */}
      {status?.found && (
        <div className="card animate-fade-in">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Déplacer vers un dossier
          </div>

          {movedTo ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckmarkCircleRegular className="w-4 h-4" />
              <span>Déplacé vers « {movedTo} »</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {FOLDER_OPTIONS.map(folder => (
                <Button
                  key={folder.name}
                  size="small"
                  appearance="outline"
                  onClick={() => handleMoveToFolder(folder.name)}
                  disabled={loading || movingFolder !== null}
                  icon={movingFolder === folder.name ? <Spinner size="tiny" /> : folder.icon}
                  className="justify-start text-left"
                >
                  {folder.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
