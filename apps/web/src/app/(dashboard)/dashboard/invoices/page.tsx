'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  Upload,
  Search,
  Mail,
  Phone,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  ChevronDown,
  RefreshCw,
  Eye,
  Send,
  Ban,
  DollarSign,
  FileText,
  Calendar,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  amount: number;
  currency: string;
  client_name: string;
  client_email?: string;
  client_reference?: string;
  firm_reference?: string;
  case_name?: string;
  status: 'pending' | 'reminded' | 'paid' | 'partial' | 'contested' | 'processing' | 'written_off' | 'legal';
  reminder_count: number;
  last_reminder_at?: string;
  next_reminder_at?: string;
  phone_call_required: boolean;
}

interface InvoiceStats {
  pending: { count: number; amount: number };
  reminded: { count: number; amount: number };
  paid: { count: number; amount: number };
  contested: { count: number; amount: number };
  dueToday: { count: number; amount: number };
  overdue: { count: number; amount: number };
  total: { count: number; amount: number };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'En attente', color: 'bg-amber-50 text-amber-600', icon: Clock },
  reminded: { label: 'Relancé', color: 'bg-blue-50 text-[var(--accent)]', icon: Mail },
  paid: { label: 'Payé', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle },
  partial: { label: 'Partiel', color: 'bg-orange-50 text-orange-600', icon: DollarSign },
  contested: { label: 'Contesté', color: 'bg-red-50 text-red-500', icon: XCircle },
  processing: { label: 'En cours', color: 'bg-purple-50 text-purple-600', icon: RefreshCw },
  written_off: { label: 'Passé en perte', color: 'bg-gray-50 text-gray-500', icon: Ban },
  legal: { label: 'Contentieux', color: 'bg-red-50 text-red-500', icon: AlertTriangle },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
};

function InvoicesPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center mb-5">
        <Receipt className="w-7 h-7 text-[var(--muted-foreground)]" strokeWidth={1.5} />
      </div>
      <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-2">Factures impayées</h2>
      <p className="text-[13px] text-[var(--muted-foreground)] max-w-md">
        Cette fonctionnalité sera disponible prochainement. La gestion des relances nécessite la connexion au serveur de messagerie.
      </p>
    </div>
  );
}

export default function InvoicesPage() {
  if (!API_BASE) return <InvoicesPlaceholder />;
  return <InvoicesContent />;
}

function InvoicesContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('next_reminder_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Invoice | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        sortBy,
        sortOrder,
      });
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`${API_BASE}/invoices?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();
      setInvoices(data.invoices || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, statusFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/invoices/stats`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [fetchInvoices, fetchStats]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map((i) => i.id)));
    }
  };

  const handleSelectInvoice = (id: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInvoices(newSelected);
  };

  const handleSendReminder = async (invoiceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/invoices/${invoiceId}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to send reminder');
      toast.success('Relance envoyée');
      fetchInvoices();
      fetchStats();
    } catch (error) {
      toast.error('Erreur lors de l\'envoi de la relance');
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/invoices/${invoiceId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'paid' }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      toast.success('Facture marquée comme payée');
      fetchInvoices();
      fetchStats();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleBulkReminder = async () => {
    if (selectedInvoices.size === 0) {
      toast.warning('Sélectionnez des factures');
      return;
    }
    // Fire all reminder requests in parallel instead of one-by-one.
    const results = await Promise.allSettled(
      [...selectedInvoices].map(id =>
        fetch(`${API_BASE}/invoices/${id}/remind`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })
      )
    );
    const sent = results.filter(r => r.status === 'fulfilled').length;
    toast.success(`${sent} relance(s) envoyée(s)`);
    setSelectedInvoices(new Set());
    fetchInvoices();
    fetchStats();
  };

  const formatAmount = (amount: number) =>
    amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const getDaysOverdue = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-light tracking-[-0.02em] text-[var(--foreground)]">Factures impayées</h1>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">Gestion des relances et suivi des paiements</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-[13px] font-medium hover:bg-[var(--foreground)]/5 transition-all duration-200"
          >
            <Upload className="w-4 h-4" strokeWidth={1.8} />
            Importer
          </button>
          <button
            onClick={handleBulkReminder}
            disabled={selectedInvoices.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all duration-200"
          >
            <Send className="w-4 h-4" strokeWidth={1.8} />
            Relancer ({selectedInvoices.size})
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'En attente', count: stats.pending.count, amount: stats.pending.amount, color: 'text-amber-500', filter: 'pending' },
            { label: 'Relancées', count: stats.reminded.count, amount: stats.reminded.amount, color: 'text-[var(--accent)]', filter: 'reminded' },
            { label: 'À relancer', count: stats.dueToday.count, amount: stats.dueToday.amount, color: 'text-orange-500', filter: '' },
            { label: 'En retard', count: stats.overdue.count, amount: stats.overdue.amount, color: 'text-red-400', filter: '' },
            { label: 'Payées', count: stats.paid.count, amount: stats.paid.amount, color: 'text-emerald-500', filter: 'paid' },
            { label: 'Contestées', count: stats.contested.count, amount: stats.contested.amount, color: 'text-red-400', filter: 'contested' },
          ].map((stat) => (
            <div
              key={stat.label}
              onClick={() => stat.filter && setStatusFilter(stat.filter === statusFilter ? '' : stat.filter)}
              className={`bg-white rounded-2xl shadow-[var(--shadow-card)] p-4 cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-300 ${
                stat.filter === statusFilter ? 'ring-2 ring-[var(--foreground)]' : ''
              }`}
            >
              <p className="text-[12px] text-[var(--muted-foreground)]">{stat.label}</p>
              <p className="text-[24px] font-light tracking-tight text-[var(--foreground)]">{stat.count}</p>
              <p className={`text-[11px] ${stat.color}`}>{formatAmount(stat.amount)} €</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={1.8} />
          <input
            type="text"
            placeholder="Rechercher par numéro, client, dossier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[var(--muted)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-3 rounded-xl bg-[var(--muted)] text-[13px] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all duration-200"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" strokeWidth={1.8} />
        </div>
        <button
          onClick={() => { fetchInvoices(); fetchStats(); }}
          className="p-3 rounded-xl bg-[var(--muted)] hover:bg-[var(--foreground)]/5 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--muted-foreground)] ${loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
        </button>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-5 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <th
                  className="px-5 py-4 text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('invoice_number')}
                >
                  <div className="flex items-center gap-1">Facture <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-5 py-4 text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Client</th>
                <th
                  className="px-5 py-4 text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-1">Montant <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-5 py-4 text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Statut</th>
                <th
                  className="px-5 py-4 text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('next_reminder_at')}
                >
                  <div className="flex items-center gap-1">Prochaine relance <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-5 py-4 text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Relances</th>
                <th className="px-5 py-4 text-right text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {invoices.map((invoice, index) => {
                  const status = statusConfig[invoice.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const daysOverdue = getDaysOverdue(invoice.due_date);

                  return (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)] transition-all duration-200"
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={() => handleSelectInvoice(invoice.id)}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[13px] font-medium text-[var(--foreground)]">{invoice.invoice_number}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">{formatDate(invoice.invoice_date)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[13px] font-medium text-[var(--foreground)]">{invoice.client_name}</p>
                        {invoice.case_name && (
                          <p className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[200px]">{invoice.case_name}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[13px] font-semibold text-[var(--foreground)]">{formatAmount(invoice.amount)} €</p>
                        {daysOverdue !== null && daysOverdue > 0 && (
                          <p className="text-[11px] text-red-400">+{daysOverdue} jours</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium ${status.color}`}>
                          <StatusIcon className="w-3 h-3" strokeWidth={1.8} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {invoice.next_reminder_at ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[var(--muted-foreground)]" strokeWidth={1.8} />
                            <span className="text-[13px] text-[var(--foreground)]">{formatDate(invoice.next_reminder_at)}</span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-[var(--muted-foreground)]">-</span>
                        )}
                        {invoice.phone_call_required && (
                          <span className="flex items-center gap-1 text-[11px] text-orange-500 mt-1">
                            <Phone className="w-3 h-3" strokeWidth={1.8} />
                            Appel requis
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--foreground)]">{invoice.reminder_count}</span>
                          {invoice.last_reminder_at && (
                            <span className="text-[11px] text-[var(--muted-foreground)]">({formatDate(invoice.last_reminder_at)})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowDetailModal(invoice)}
                            className="p-2 rounded-lg hover:bg-[var(--foreground)]/5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-all duration-200"
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4" strokeWidth={1.8} />
                          </button>
                          {['pending', 'reminded'].includes(invoice.status) && (
                            <>
                              <button
                                onClick={() => handleSendReminder(invoice.id)}
                                className="p-2 rounded-lg hover:bg-blue-50 text-[var(--accent)] transition-all duration-200"
                                title="Envoyer relance"
                              >
                                <Mail className="w-4 h-4" strokeWidth={1.8} />
                              </button>
                              <button
                                onClick={() => handleMarkAsPaid(invoice.id)}
                                className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-all duration-200"
                                title="Marquer payé"
                              >
                                <CheckCircle className="w-4 h-4" strokeWidth={1.8} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted-foreground)]">Page {page} sur {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-[var(--muted)] hover:bg-[var(--foreground)]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-[12px]"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-[var(--muted)] hover:bg-[var(--foreground)]/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-[12px]"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {!loading && invoices.length === 0 && (
          <div className="px-5 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-6 h-6 text-[var(--muted-foreground)]" strokeWidth={1.5} />
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--foreground)] mb-1.5">Aucune facture</h3>
            <p className="text-[13px] text-[var(--muted-foreground)] mb-5">
              Importez des factures impayées pour commencer le suivi des relances.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium hover:opacity-90 transition-all duration-200"
            >
              <Upload className="w-4 h-4" strokeWidth={1.8} />
              Importer des factures
            </button>
          </div>
        )}
      </motion.div>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onSuccess={() => { setShowImportModal(false); fetchInvoices(); fetchStats(); }}
          />
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && (
          <InvoiceDetailModal
            invoice={showDetailModal}
            onClose={() => setShowDetailModal(null)}
            onUpdate={() => { fetchInvoices(); fetchStats(); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE}/invoices/import`, { method: 'POST', credentials: 'include', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      toast.success(`${data.imported} facture(s) importée(s)`);
      if (data.errors?.length > 0) toast.warning(`${data.errors.length} erreur(s) lors de l'import`);
      onSuccess();
    } catch (error) {
      toast.error('Erreur lors de l\'import');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-[var(--shadow-modal)]"
      >
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)] mb-5">Importer des factures</h2>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
            dragActive ? 'border-[var(--foreground)] bg-[var(--muted)]' : 'border-[var(--border)]'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-6 h-6 text-[var(--muted-foreground)] animate-spin mb-3" />
              <p className="text-[13px] text-[var(--muted-foreground)]">Import en cours...</p>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-[var(--muted-foreground)] mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-[14px] font-medium text-[var(--foreground)] mb-1">Glissez un fichier Excel ici</p>
              <p className="text-[12px] text-[var(--muted-foreground)] mb-4">ou</p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--foreground)] text-white text-[13px] font-medium cursor-pointer hover:opacity-90 transition-all duration-200">
                <FileText className="w-4 h-4" strokeWidth={1.8} />
                Choisir un fichier
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-4 p-4 bg-[var(--muted)] rounded-xl">
          <p className="text-[12px] font-medium text-[var(--foreground)] mb-2">Format attendu:</p>
          <ul className="text-[11px] text-[var(--muted-foreground)] space-y-1">
            <li>N° Facture, Date, Échéance, Montant</li>
            <li>Client, Email, V. Réfs, N. Réfs</li>
            <li>Dossier (optionnel)</li>
          </ul>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-[13px] font-medium hover:bg-[var(--foreground)]/5 transition-all duration-200"
          >
            Annuler
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InvoiceDetailModal({
  invoice,
  onClose,
  onUpdate,
}: {
  invoice: Invoice;
  onClose: () => void;
  onUpdate: () => void;
}) {
  type ReminderHistoryItem = { id: string; reminder_type: string; reminder_number: number; sent_at: string; email_to?: string };
  const [reminderHistory, setReminderHistory] = useState<ReminderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(`${API_BASE}/invoices/${invoice.id}`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setReminderHistory(data.reminderHistory || []);
        }
      } catch (error) {
        console.error('Error fetching invoice details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [invoice.id]);

  const status = statusConfig[invoice.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const formatAmount = (amount: number) =>
    amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-[var(--shadow-modal)] max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Facture {invoice.invoice_number}</h2>
            <p className="text-[13px] text-[var(--muted-foreground)]">{invoice.client_name}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium ${status.color}`}>
            <StatusIcon className="w-3.5 h-3.5" strokeWidth={1.8} />
            {status.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[var(--muted)] rounded-xl p-4">
            <p className="text-[12px] text-[var(--muted-foreground)]">Montant</p>
            <p className="text-[24px] font-light tracking-tight text-[var(--foreground)]">{formatAmount(invoice.amount)} €</p>
          </div>
          <div className="bg-[var(--muted)] rounded-xl p-4">
            <p className="text-[12px] text-[var(--muted-foreground)]">Relances envoyées</p>
            <p className="text-[24px] font-light tracking-tight text-[var(--foreground)]">{invoice.reminder_count}</p>
          </div>
        </div>

        <div className="space-y-0 mb-6">
          {[
            { label: 'Date facture', value: formatDate(invoice.invoice_date) },
            ...(invoice.due_date ? [{ label: 'Échéance', value: formatDate(invoice.due_date) }] : []),
            ...(invoice.client_email ? [{ label: 'Email', value: invoice.client_email }] : []),
            ...(invoice.firm_reference ? [{ label: 'N. Réfs', value: invoice.firm_reference }] : []),
            ...(invoice.case_name ? [{ label: 'Dossier', value: invoice.case_name }] : []),
          ].map((item) => (
            <div key={item.label} className="flex justify-between py-3 border-b border-[var(--border)]">
              <span className="text-[13px] text-[var(--muted-foreground)]">{item.label}</span>
              <span className="text-[13px] text-[var(--foreground)]">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="text-[14px] font-medium text-[var(--foreground)] mb-3">Historique des relances</h3>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-[var(--muted-foreground)] animate-spin" />
            </div>
          ) : reminderHistory.length > 0 ? (
            <div className="space-y-2">
              {reminderHistory.map((reminder) => (
                <div key={reminder.id} className="flex items-center gap-3 p-3 bg-[var(--muted)] rounded-xl">
                  {reminder.reminder_type === 'email' ? (
                    <Mail className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.8} />
                  ) : (
                    <Phone className="w-4 h-4 text-emerald-500" strokeWidth={1.8} />
                  )}
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-[var(--foreground)]">Relance #{reminder.reminder_number}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">{formatDate(reminder.sent_at)}</p>
                  </div>
                  {reminder.email_to && (
                    <span className="text-[11px] text-[var(--muted-foreground)]">{reminder.email_to}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted-foreground)] py-4 text-center">Aucune relance envoyée</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-[13px] font-medium hover:bg-[var(--foreground)]/5 transition-all duration-200"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
