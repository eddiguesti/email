# Plan d'Automatisation des Relances d'Honoraires Impayés

## Vue d'ensemble

Ce document décrit l'architecture pour automatiser le processus de relance des factures impayées en intégrant Kleos, Microsoft 365, et un système de tracking intelligent.

---

## Architecture du Système

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTÈME DE RELANCES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐              │
│  │   Import    │────▶│   Enrichment │────▶│   Vérification  │              │
│  │   Factures  │     │    Kleos     │     │    Paiements    │              │
│  └─────────────┘     └──────────────┘     └─────────────────┘              │
│         │                   │                      │                        │
│         ▼                   ▼                      ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    BASE DE DONNÉES RELANCES                      │       │
│  │  - Factures importées                                            │       │
│  │  - Historique des relances                                       │       │
│  │  - Statut paiement                                               │       │
│  │  - Contacts clients                                              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│         │                   │                      │                        │
│         ▼                   ▼                      ▼                        │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐              │
│  │  Génération │────▶│    Envoi     │────▶│   Escalation    │              │
│  │   Emails    │     │   (Graph)    │     │   Automatique   │              │
│  └─────────────┘     └──────────────┘     └─────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Modèle de Données

### Table: `unpaid_invoices`
```sql
CREATE TABLE unpaid_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants facture
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Références dossier
  client_reference VARCHAR(100),      -- "V. Réfs" (ex: 002SRD17001799)
  firm_reference VARCHAR(100),        -- "N. Réfs" (ex: 202122)
  case_name VARCHAR(500),             -- Nom du dossier
  kleos_case_id INTEGER,              -- ID Kleos si trouvé

  -- Client
  client_id UUID REFERENCES contacts(id),
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_salutation VARCHAR(50),      -- "Chère Madame", "Cher Monsieur", etc.
  kleos_identity_id INTEGER,          -- ID Kleos

  -- État
  status VARCHAR(50) DEFAULT 'pending',  -- pending, paid, contested, processing
  payment_received_at TIMESTAMP,
  payment_method VARCHAR(50),
  contested BOOLEAN DEFAULT FALSE,
  contested_reason TEXT,

  -- Import
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_from VARCHAR(100),         -- "kleos_export_2025-01.xlsx"

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recherches fréquentes
CREATE INDEX idx_unpaid_invoices_status ON unpaid_invoices(status);
CREATE INDEX idx_unpaid_invoices_client ON unpaid_invoices(client_id);
CREATE INDEX idx_unpaid_invoices_case ON unpaid_invoices(kleos_case_id);
```

### Table: `reminder_history`
```sql
CREATE TABLE reminder_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  invoice_id UUID REFERENCES unpaid_invoices(id) ON DELETE CASCADE,

  -- Relance
  reminder_number INTEGER NOT NULL,   -- 1ère, 2ème, 3ème...
  reminder_type VARCHAR(20) NOT NULL, -- 'email', 'phone', 'letter'
  sent_at TIMESTAMP DEFAULT NOW(),

  -- Email
  email_to VARCHAR(255),
  email_cc TEXT,                      -- JSON array
  email_subject VARCHAR(500),
  email_body TEXT,
  email_attachments TEXT,             -- JSON array of filenames
  graph_message_id VARCHAR(255),      -- ID du message envoyé

  -- Appel téléphonique
  phone_number VARCHAR(50),
  call_duration_minutes INTEGER,
  call_notes TEXT,
  call_result VARCHAR(50),            -- 'answered', 'voicemail', 'no_answer'

  -- Résultat
  response_received BOOLEAN DEFAULT FALSE,
  response_date TIMESTAMP,
  response_notes TEXT,
  payment_promise BOOLEAN DEFAULT FALSE,
  payment_promise_date DATE,

  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour tracking
CREATE INDEX idx_reminder_invoice ON reminder_history(invoice_id);
CREATE INDEX idx_reminder_number ON reminder_history(reminder_number);
```

### Table: `invoice_groups`
```sql
-- Pour les relances groupées (plusieurs factures, même dossier/client)
CREATE TABLE invoice_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants
  group_reference VARCHAR(100),       -- Référence groupe
  case_name VARCHAR(500),

  -- Client(s)
  primary_client_id UUID,
  client_emails TEXT,                 -- JSON array pour multi-destinataires

  -- Statistiques
  total_invoices INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoice_group_members (
  group_id UUID REFERENCES invoice_groups(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES unpaid_invoices(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, invoice_id)
);
```

---

## Phase 2: Import et Enrichissement

### Service d'Import de Factures

```typescript
// apps/api/src/services/invoice-import.ts

interface InvoiceImportRow {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  amount: number;
  clientReference: string;    // V. Réfs
  firmReference: string;      // N. Réfs
  caseName: string;
  clientName: string;
  clientEmail?: string;
}

export class InvoiceImportService {

  /**
   * Import depuis fichier Excel/CSV
   */
  async importFromFile(
    fileBuffer: Buffer,
    fileType: 'xlsx' | 'csv'
  ): Promise<ImportResult> {
    // 1. Parse le fichier
    const rows = await this.parseFile(fileBuffer, fileType);

    // 2. Valider les données
    const validated = await this.validateRows(rows);

    // 3. Enrichir avec Kleos
    const enriched = await this.enrichWithKleos(validated);

    // 4. Sauvegarder en base
    const imported = await this.saveToDatabase(enriched);

    return {
      total: rows.length,
      imported: imported.length,
      errors: validated.errors,
    };
  }

  /**
   * Enrichir avec données Kleos
   */
  private async enrichWithKleos(invoices: InvoiceImportRow[]) {
    for (const invoice of invoices) {
      // Rechercher le dossier par référence
      if (invoice.firmReference) {
        const cases = await searchKleosCases(invoice.firmReference);
        if (cases.length > 0) {
          invoice.kleosCaseId = cases[0].id;
        }
      }

      // Rechercher le client par nom/email
      if (invoice.clientName) {
        const contacts = await searchKleosContacts(invoice.clientName);
        if (contacts.length > 0) {
          invoice.kleosIdentityId = contacts[0].id;
          // Récupérer email et civilité
          const details = await getKleosContact(contacts[0].id);
          invoice.clientEmail = details.email;
          invoice.clientSalutation = this.determineSalutation(details);
        }
      }
    }
    return invoices;
  }

  /**
   * Déterminer la civilité appropriée
   */
  private determineSalutation(contact: KleosIdentity): string {
    if (contact.type === 'L') {
      return 'Mesdames, Messieurs';
    }

    switch (contact.gender) {
      case 'F': return 'Chère Madame';
      case 'M': return 'Cher Monsieur';
      default: return 'Chère Madame, Cher Monsieur';
    }
  }
}
```

---

## Phase 3: Génération des Relances

### Templates de Relance

```typescript
// apps/api/src/services/reminder-templates.ts

export const REMINDER_TEMPLATES = {
  // 1ère et 2ème relance - Email standard
  STANDARD: {
    subject: (invoice) =>
      `Relance - Facture n° ${invoice.invoiceNumber} du ${formatDate(invoice.invoiceDate)}`,

    body: (invoice, reminderNumber) => `
V. Réfs : ${invoice.clientReference}
N. Réfs : ${invoice.firmReference} – ${invoice.caseName}

${invoice.clientSalutation},

${reminderNumber === 1
  ? 'Nous nous permettons de revenir vers vous concernant'
  : 'Malgré notre précédent rappel, nous nous permettons de revenir vers vous concernant'
} notre facture n° ${invoice.invoiceNumber} d'un montant de ${formatAmount(invoice.amount)} € datée du ${formatDate(invoice.invoiceDate)}, non régularisée dans nos livres à ce jour, et dont vous trouverez copie en pièce jointe.

La confiant de nouveau à vos bons soins, nous vous remercions par avance de son règlement.

Avec nos remerciements anticipés,

Je vous prie de croire, ${invoice.clientSalutation}, en l'assurance de nos sentiments distingués.
    `.trim()
  },

  // 3ème relance et au-delà - Plus insistante
  URGENT: {
    subject: (invoice) =>
      `RAPPEL URGENT - Facture n° ${invoice.invoiceNumber} - ${formatAmount(invoice.amount)} €`,

    body: (invoice, reminderNumber) => `
V. Réfs : ${invoice.clientReference}
N. Réfs : ${invoice.firmReference} – ${invoice.caseName}

${invoice.clientSalutation},

Malgré nos précédentes relances, notre facture n° ${invoice.invoiceNumber} d'un montant de ${formatAmount(invoice.amount)} € datée du ${formatDate(invoice.invoiceDate)} demeure non régularisée dans nos livres à ce jour.

Vous en trouverez copie en pièce jointe.

Nous vous serions reconnaissants de bien vouloir nous faire parvenir votre règlement dans les meilleurs délais.

En cas de difficulté, nous vous invitons à prendre contact avec notre cabinet afin de convenir d'un échéancier.

Dans l'attente, je vous prie de croire, ${invoice.clientSalutation}, en l'assurance de nos sentiments distingués.
    `.trim()
  },

  // Relance groupée - Plusieurs factures
  GROUPED: {
    subject: (invoices) =>
      `Relance - ${invoices.length} factures impayées - Total: ${formatAmount(totalAmount(invoices))} €`,

    body: (invoices, group, reminderNumber) => {
      const invoiceList = invoices
        .map(i => `n° ${i.invoiceNumber} d'un montant de ${formatAmount(i.amount)} € datée du ${formatDate(i.invoiceDate)}`)
        .join(',\n');

      return `
V. Réfs : ${group.clientReferences.join('\n')}

N. Réfs : ${group.firmReference} – ${group.caseName}

${group.clientSalutation},

Malgré nos précédentes relances, nos factures :
${invoiceList},

Demeurent non régularisées dans nos livres à ce jour. Vous en trouverez copies en pièces jointes.

Les confiant de nouveau à vos bons soins, nous vous remercions par avance de vos règlements.

Avec nos remerciements anticipés,

Je vous prie de croire, ${group.clientSalutation}, en l'assurance de nos sentiments distingués.
      `.trim();
    }
  }
};
```

---

## Phase 4: Moteur de Relance Automatique

### Service de Relance

```typescript
// apps/api/src/services/reminder-engine.ts

interface ReminderConfig {
  // Délais entre relances (jours)
  delays: number[];  // [14, 14, 7, 7] = 1ère après 14j, 2ème après 28j, etc.

  // À partir de quelle relance déclencher un appel
  phoneCallAfterReminder: number;  // 3 = appeler après la 3ème relance

  // Grouper les factures du même dossier
  groupByCase: boolean;

  // Emails en copie
  ccEmails: string[];
}

export class ReminderEngine {

  /**
   * Exécuter le cycle de relances quotidien
   */
  async runDailyReminders(config: ReminderConfig): Promise<ReminderReport> {
    const report: ReminderReport = {
      processed: 0,
      emailsSent: 0,
      phoneCalls: 0,
      errors: [],
    };

    // 1. Vérifier les paiements reçus (Microsoft Graph - emails de confirmation bancaire)
    await this.checkRecentPayments();

    // 2. Récupérer les factures à relancer aujourd'hui
    const invoicesToRemind = await this.getInvoicesDueForReminder(config);

    // 3. Grouper si configuré
    const groups = config.groupByCase
      ? this.groupByCase(invoicesToRemind)
      : invoicesToRemind.map(i => [i]);

    // 4. Traiter chaque groupe
    for (const group of groups) {
      try {
        const reminderNumber = await this.getNextReminderNumber(group[0]);

        // Déterminer le template
        const template = reminderNumber >= 3
          ? REMINDER_TEMPLATES.URGENT
          : REMINDER_TEMPLATES.STANDARD;

        // Envoyer l'email
        if (group.length === 1) {
          await this.sendSingleReminder(group[0], reminderNumber, template);
        } else {
          await this.sendGroupedReminder(group, reminderNumber);
        }

        report.emailsSent++;

        // Planifier appel si nécessaire
        if (reminderNumber >= config.phoneCallAfterReminder) {
          await this.schedulePhoneCall(group[0]);
          report.phoneCalls++;
        }

        report.processed++;
      } catch (error) {
        report.errors.push({
          invoiceId: group[0].id,
          error: error.message,
        });
      }
    }

    return report;
  }

  /**
   * Vérifier les paiements récents (virements, chèques)
   */
  private async checkRecentPayments(): Promise<void> {
    // Rechercher dans les emails les confirmations de virement
    // Patterns: "virement reçu", "règlement de", "paiement facture"
    const recentEmails = await searchEmails({
      query: 'virement OR règlement OR paiement',
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });

    for (const email of recentEmails) {
      // Extraire les numéros de facture mentionnés
      const invoiceNumbers = this.extractInvoiceNumbers(email.body);

      // Marquer les factures comme payées
      for (const num of invoiceNumbers) {
        await this.markAsPaid(num, {
          method: 'detected_from_email',
          emailId: email.id,
          date: email.receivedAt,
        });
      }
    }
  }

  /**
   * Envoyer une relance via Microsoft Graph
   */
  private async sendSingleReminder(
    invoice: UnpaidInvoice,
    reminderNumber: number,
    template: ReminderTemplate
  ): Promise<void> {
    // Générer l'email
    const subject = template.subject(invoice);
    const body = template.body(invoice, reminderNumber);

    // Récupérer la facture PDF (si disponible dans Kleos ou en pièce jointe)
    const attachments = await this.getInvoiceAttachments(invoice);

    // Envoyer via Graph
    const messageId = await sendEmail({
      to: invoice.clientEmail,
      subject,
      body,
      attachments,
      saveToSentItems: true,
    });

    // Logger la relance
    await this.logReminder({
      invoiceId: invoice.id,
      reminderNumber,
      type: 'email',
      emailTo: invoice.clientEmail,
      emailSubject: subject,
      emailBody: body,
      graphMessageId: messageId,
    });
  }
}
```

---

## Phase 5: Interface Utilisateur

### Dashboard des Relances

```typescript
// Composant React pour le tableau de bord
interface ReminderDashboard {
  // Statistiques
  stats: {
    totalUnpaid: number;
    totalAmount: number;
    overdueCount: number;
    remindersSentToday: number;
    paymentsThisWeek: number;
  };

  // Liste des factures avec statut
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    dueDate: Date;
    daysPastDue: number;
    reminderCount: number;
    lastReminderDate: Date;
    nextReminderDate: Date;
    status: 'pending' | 'reminded' | 'paid' | 'contested';
  }>;

  // Actions
  actions: {
    sendReminder: (invoiceId: string) => Promise<void>;
    markAsPaid: (invoiceId: string) => Promise<void>;
    markAsContested: (invoiceId: string, reason: string) => Promise<void>;
    scheduleCall: (invoiceId: string) => Promise<void>;
    groupInvoices: (invoiceIds: string[]) => Promise<void>;
  };
}
```

### Workflow Visuel

```
┌────────────────────────────────────────────────────────────────────┐
│                    TABLEAU DE BORD RELANCES                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  12,450€ │  │    23    │  │     8    │  │     5    │           │
│  │  Impayés │  │ Factures │  │ > 30j    │  │ Relancés │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Factures à relancer aujourd'hui                              │   │
│  ├──────────┬──────────┬─────────┬───────────┬────────┬───────┤   │
│  │ N° Fact  │ Client   │ Montant │ Échéance  │ Relance│ Action│   │
│  ├──────────┼──────────┼─────────┼───────────┼────────┼───────┤   │
│  │ 31504    │ SMABTP   │  696 €  │ 10/10/25  │ 2ème   │ [📧]  │   │
│  │ 31133    │ ATR      │  315 €  │ 11/07/25  │ 3ème   │ [📧📞]│   │
│  │ 30919    │ BEMING   │  435 €  │ 30/05/25  │ 4ème   │ [📧📞]│   │
│  └──────────┴──────────┴─────────┴───────────┴────────┴───────┘   │
│                                                                     │
│  [Importer fichier]  [Relancer sélection]  [Exporter rapport]      │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Phase 6: Règles d'Escalation

### Configuration des Règles

```typescript
const ESCALATION_RULES = {
  // Délais par défaut
  firstReminder: 14,    // 14 jours après échéance
  secondReminder: 14,   // 14 jours après 1ère relance
  thirdReminder: 7,     // 7 jours après 2ème relance
  fourthReminder: 7,    // 7 jours après 3ème relance

  // Actions automatiques
  rules: [
    {
      trigger: { reminderCount: 3 },
      action: 'schedule_phone_call',
      notify: ['responsable@cabinet.fr'],
    },
    {
      trigger: { reminderCount: 4 },
      action: 'escalate_to_partner',
      notify: ['associe@cabinet.fr'],
    },
    {
      trigger: { daysPastDue: 90 },
      action: 'flag_for_legal',
      notify: ['contentieux@cabinet.fr'],
    },
  ],

  // Exceptions par client (certains clients ont des délais de paiement spéciaux)
  clientExceptions: {
    'SMABTP': { paymentDelay: 60 },  // SMABTP a 60 jours de délai
    'MAAF': { paymentDelay: 45 },
  },
};
```

---

## Intégration avec Kleos

### Points d'intégration

| Fonctionnalité | API Kleos | Utilisation |
|----------------|-----------|-------------|
| Recherche dossier | `GET /api/cases` | Enrichir les factures avec ID dossier |
| Détails dossier | `GET /api/cases/{id}` | Récupérer références, parties |
| Recherche contact | `GET /api/contacts` | Trouver le client |
| Détails contact | `GET /api/contacts/{id}` | Email, civilité, adresse |
| Dossiers par contact | `GET /api/cases/getCasesByInvolvedParty` | Lier client → dossiers |

### Limitations actuelles

L'API Kleos actuelle ne fournit pas:
- ❌ Liste des factures impayées
- ❌ Téléchargement des PDF de factures
- ❌ Statut de paiement des factures

**Solution**: Importer le fichier Excel exporté manuellement de Kleos, et l'enrichir avec les données contacts/dossiers via l'API.

---

## Prochaines Étapes

1. **Créer les tables de base de données** (migration SQL)
2. **Développer le service d'import** (Excel/CSV parser)
3. **Implémenter l'enrichissement Kleos** (recherche contacts/dossiers)
4. **Créer les templates d'email** (personnalisables)
5. **Développer le moteur de relance** (scheduler quotidien)
6. **Construire l'interface utilisateur** (dashboard React)
7. **Configurer les règles d'escalation** (notifications)
8. **Tests avec données réelles** (validation avec le cabinet)

---

## Questions pour le Cabinet

1. **Format du fichier d'export Kleos** - Quelles colonnes sont disponibles?
2. **Accès aux PDF des factures** - Sont-ils stockés dans Kleos ou ailleurs?
3. **Règles spécifiques par client** - Y a-t-il des exceptions connues?
4. **Validation humaine** - Faut-il approuver chaque relance avant envoi?
5. **Multi-destinataires** - Comment gérer les dossiers avec plusieurs clients?
