'use client';

import { useState, useEffect } from 'react';
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  Folder,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { getFolders, MailFolder } from '@/lib/api';

interface FolderListProps {
  selectedFolderId: string;
  onFolderSelect: (folderId: string) => void;
}

const folderIcons: Record<string, typeof Inbox> = {
  'Inbox': Inbox,
  'Boîte de réception': Inbox,
  'Sent Items': Send,
  'Éléments envoyés': Send,
  'Drafts': FileText,
  'Brouillons': FileText,
  'Deleted Items': Trash2,
  'Éléments supprimés': Trash2,
  'Archive': Archive,
  'Junk Email': Trash2,
  'Courrier indésirable': Trash2,
};

export default function FolderList({ selectedFolderId, onFolderSelect }: FolderListProps) {
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const loadFolders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFolders();
      setFolders(data);

      const inbox = data.find(f => f.displayName === 'Inbox' || f.displayName === 'Boîte de réception');
      if (inbox) {
        setExpandedFolders(new Set([inbox.id]));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const toggleExpanded = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const rootFolders = folders.filter(f => !f.parentFolderId);

  const getChildFolders = (parentId: string) =>
    folders.filter(f => f.parentFolderId === parentId);

  const renderFolder = (folder: MailFolder, level = 0) => {
    const Icon = folderIcons[folder.displayName] || Folder;
    const hasChildren = folder.childFolderCount > 0;
    const childFolders = getChildFolders(folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            onFolderSelect(folder.id);
            if (hasChildren) {
              toggleExpanded(folder.id);
            }
          }}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-all duration-200
            ${isSelected
              ? 'bg-[var(--foreground)] text-white font-medium'
              : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
            }
          `}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 opacity-50" strokeWidth={2} />
              ) : (
                <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
              )}
            </span>
          ) : (
            <span className="w-4" />
          )}

          <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[var(--muted-foreground)]'}`} strokeWidth={1.8} />

          <span className="flex-1 text-left truncate">{folder.displayName}</span>

          {folder.unreadItemCount > 0 && (
            <span className={`
              text-[11px] font-medium min-w-[20px] text-center px-1.5 py-0.5 rounded-md
              ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}
            `}>
              {folder.unreadItemCount}
            </span>
          )}
        </button>

        {hasChildren && isExpanded && childFolders.length > 0 && (
          <div className="mt-0.5">
            {childFolders.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-[13px] text-[var(--destructive)] mb-3">{error}</div>
        <button
          onClick={loadFolders}
          className="flex items-center gap-2 text-[13px] text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
        >
          <RefreshCw className="w-3 h-3" strokeWidth={1.8} />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="py-2 space-y-0.5">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-widest text-[var(--muted-foreground)] uppercase">
          Dossiers
        </span>
        <button
          onClick={loadFolders}
          className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-all duration-200"
          title="Actualiser"
        >
          <RefreshCw className="w-3 h-3" strokeWidth={1.8} />
        </button>
      </div>

      {rootFolders.map(folder => renderFolder(folder))}
    </div>
  );
}
