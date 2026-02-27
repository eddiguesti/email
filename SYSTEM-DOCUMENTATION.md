# LB-BOT — System Documentation

> **SELARL Brosset-Techer** — AI-Powered Email Automation for Legal Firms
> Version: Beta 0.1 | Last updated: 2026-02-23

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Email Processing Pipeline](#2-email-processing-pipeline)
3. [8-Tier Matching Engine](#3-8-tier-matching-engine)
4. [API Endpoints (53 endpoints)](#4-api-endpoints)
5. [Web Application (Frontend)](#5-web-application)
6. [Kleos Integration](#6-kleos-integration)
7. [Invoice & Fee Reminder System](#7-invoice--fee-reminder-system)
8. [Calendar & Tasks](#8-calendar--tasks)
9. [Notifications (Real-Time SSE)](#9-notifications-real-time-sse)
10. [AI Features (xAI Grok)](#10-ai-features-xai-grok)
11. [Authentication & Security](#11-authentication--security)
12. [Data Types & Schema](#12-data-types--schema)
13. [Design System](#13-design-system)
14. [Environment Variables](#14-environment-variables)
15. [Deployment](#15-deployment)

---

## 1. Architecture Overview

### Monorepo Structure (pnpm + Turborepo)

```
LB-BOT/
├── apps/
│   ├── api/           → Azure Functions HTTP (53 endpoints)
│   ├── worker/        → Azure Functions Service Bus (email pipeline)
│   ├── web/           → Next.js 16 frontend (Vercel)
│   └── outlook-addin/ → Outlook plugin (WIP)
├── packages/
│   └── shared/        → Core logic, types, matching engine, templates
└── config/            → Environment files
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion, Recharts |
| API | Azure Functions v4 (Node.js/TypeScript) |
| Worker | Azure Functions (Service Bus trigger) |
| Database | Supabase (PostgreSQL) |
| Queue | Azure Service Bus |
| Storage | Azure Blob Storage (attachments) |
| Email | Microsoft Graph API (OAuth2) |
| AI | xAI Grok (classifier + search) |
| Legal Software | Kleos (dossier management) |
| Deployment | Vercel (frontend), Azure (API/Worker) |

### Data Flow

```
Outlook Inbox
    │
    ▼
Microsoft Graph Webhook → POST /api/webhook/graph
    │
    ▼
Azure Service Bus Queue (email-process)
    │
    ▼
Worker Pipeline:
    1. Fetch email + attachments
    2. Extract signals (RG numbers, entities, dates)
    3. Match to dossiers (8-tier engine)
    4. [Optional] Generate draft replies
    5. [Optional] File to Kleos
    │
    ▼
Supabase (match_logs, sender_history, conversation_threads)
    │
    ▼
Web Dashboard (real-time SSE notifications)
```

---

## 2. Email Processing Pipeline

### Worker Entry Point

- **Trigger**: Azure Service Bus queue (`email-process`)
- **File**: `apps/worker/src/functions/process-email.ts`
- **Max Retries**: 3
- **Read-Only Mode**: Configurable — when `true`, pipeline stops at MATCHED/READY_FOR_REVIEW (no Kleos filing)

### Processing States (17 total)

```
RECEIVED → FETCHING → FETCHED → EXTRACTING → EXTRACTED → MATCHING →
  ├─ MATCHED (confidence ≥ 85%) → READY_TO_FILE → FILING → FILED → DONE
  ├─ READY_FOR_REVIEW (confidence 50-84%) → [User action] → READY_TO_FILE → ...
  ├─ SKIPPED (spam/newsletter detected)
  ├─ ERROR_RETRYABLE (retry < 3)
  └─ ERROR_FATAL (retry exhausted)
```

### Stage 1: Fetch Email & Attachments

- Fetches full email from Microsoft Graph API
- Downloads all non-inline attachments
- Generates SHA256 content hash per attachment (deduplication)
- Uploads attachments to Azure Blob Storage
- Extracts text from PDFs (with OCR detection flag)
- Stores up to 10,000 characters of extracted text

### Stage 2: Signal Extraction

Extracted signals from email subject, body, and attachment text:

| Signal | Description |
|--------|------------|
| `rgNumbers` | Legal case numbers (e.g., "2024/RG/123") |
| `entities` | Named entities (PERSON, ORGANIZATION, JURISDICTION, DATE, MONEY, CLIENT_NAME, EXPERT_NAME) |
| `dates` | Date mentions |
| `senderDomain` | Sender's email domain |
| `senderEmail` | Sender email address |
| `recipientEmails` | All To + CC recipients |
| `subject` | Email subject |
| `bodyPreview` | First N characters of body |
| `bodyHash` | SHA256 hash of plain text body |
| `hasAttachments` | Boolean |
| `attachmentCount` | Number of attachments |
| `isReply` | True if reply (In-Reply-To header) |
| `isForward` | True if forwarded |
| `threadPosition` | Position in conversation thread |
| `language` | Detected language |
| `attachmentText` | Aggregated text from PDFs |

### Stage 3: 8-Tier Matching

See [Section 3](#3-8-tier-matching-engine) below.

### Stage 4: Draft Generation (Optional)

Template types:
- **reply**: Response to sender with dossier reference
- **client_transmittal**: Transmit documents to client with attachment list
- **fee_reminder_1/2/final**: Escalating payment reminders (3 levels)
- **leave_acknowledgement**: Auto-response for out-of-office emails

### Stage 5: File to Kleos (Optional)

- Fetches email as `.eml` (RFC822 format)
- Downloads selected attachments
- Creates documents in Kleos with metadata
- Generates content hash for deduplication (idempotency)
- Document naming: `{dossierRef}_{date}_{type}_{sender}_{subject}` (slugified)

### Audit Trail

Every processing record maintains a full audit trail:

```
PROCESSING_STARTED → EMAIL_RECEIVED → EMAIL_FETCHED → SIGNALS_EXTRACTED →
DOSSIERS_MATCHED → DOSSIER_APPROVED → DRAFT_INSERTED → FILED_TO_KLEOS →
PROCESSING_COMPLETED | PROCESSING_FAILED
```

---

## 3. 8-Tier Matching Engine

**File**: `packages/shared/src/matching/engine.ts`

Tiers are evaluated in priority order. The first tier to produce a match above threshold wins.

### Confidence Thresholds

| Band | Confidence | Action |
|------|-----------|--------|
| Auto-file | ≥ 85% | Automatically file to Kleos |
| Review | 60-84% | Sent to review queue for human validation |
| Low | < 60% | Flagged, no suggestion |
| No match | 0% | Not matched |

### Tier 0: Conversation Threading (98% confidence)

- **Source**: `conversation_thread`
- **Logic**: If email's `conversationId` matches a previously approved conversation, reuse the same dossier
- **Persistence**: `conversation_threads` table in Supabase

### Tier 1: Exact Dossier Reference (95% confidence)

- **Source**: `reference_exact`
- **Logic**: Extract dossier reference strings from email text (regex), exact match against knowledge base
- **Example**: Email contains "Dossier 2024/456" → matched

### Tier 2: RG Number Match (90% confidence)

- **Source**: `rg_match`
- **Logic**: Extract RG numbers from email and attachments, search Kleos for dossier with that RG
- **Example**: "RG 2024/789" found in email → Kleos returns matching dossier

### Tier 3: Sender History (70-90% confidence)

- **Source**: `sender_history`
- **Logic**: Look up sender email in history table, return most frequently matched dossier
- **Boost**: +5% if sender domain matches dossier contact domain
- **Persistence**: `sender_history` table in Supabase

### Tier 4: AI Classifier — Scoped then Global (85-92% confidence)

- **Source**: `ai_classifier_scoped` or `ai_classifier_global`
- **Model**: xAI Grok 4-1-fast-reasoning
- **Logic**:
  1. **Scoped**: Classify email against lawyer's open cases only
  2. **Global**: If scoped fails, classify against all knowledge base dossiers
- **Boost**: +5% if recipient email found in dossier contact list

### Tier 5: Knowledge Base Party Name Matching (75-85% confidence)

- **Source**: `kb_party_exact`, `kb_party_common`, or `kb_party_fuzzy`
- **Logic**:
  1. **Exact**: Party names match exactly (case-insensitive)
  2. **Common**: Fuzzy match using surname similarity (Levenshtein distance < 2)
  3. **Keyword**: Search dossier keyword list for terms in email

### Tier 6: Dossier Name Keyword Match (60% confidence)

- **Source**: `kb_keyword`
- **Logic**: Split dossier name into keywords, search for any in email subject/body

### Tier 7: Fallback Kleos Search (40% confidence)

- **Source**: `kleos_search`
- **Logic**: Extract key terms from email, search Kleos for matching dossiers
- **Last resort**: If all other tiers fail

### Global Boosts

- Lawyer match boost (sender/recipient is assigned lawyer)
- Firm admin dossier filter (reference "99999-ADMIN-000" excluded unless specifically matched)
- Recipient boost (+5% if recipient is registered contact in dossier)

### Knowledge Base Structure

```typescript
{
  dossiers: DossierKnowledge[],        // All known dossiers
  lawyersByEmail: Map<string, string>, // Lawyer email → name
  firmAdminDossiers: Set<string>,      // IDs to exclude
  commonParties: Map<string, number>,  // Party popularity index
  keywords: Map<string, Set<id>>,      // Keyword → dossier IDs
  mailboxMap: Map<mailbox, lawyerId>   // Mailbox ownership
}
```

---

## 4. API Endpoints

### Authentication (5 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/auth/login` | Redirect to Microsoft OAuth2 login |
| GET | `/api/auth/callback` | Handle OAuth callback, create session |
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/auth/refresh` | Refresh expired OAuth tokens |
| POST | `/api/auth/logout` | Logout and clear session |

### Email Management (2 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/emails` | List emails from Outlook folder (paginated) |
| GET | `/api/folders` | List all mail folders + subfolders |

### Search & Chat (3 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| POST | `/api/search` | Evidence-based email search with scoring |
| POST | `/api/chat` | Natural language conversational search |
| POST | `/api/ai/search` | xAI Grok-powered advanced search |

### Processing & Filing (5 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/status/{mailbox}/{messageId}` | Get processing status of an email |
| POST | `/api/approve` | Approve dossier match (user confirms) |
| POST | `/api/file` | File email + attachments to Kleos |
| POST | `/api/drafts/generate` | Generate draft email from templates |
| POST | `/api/drafts/insert` | Insert draft into Outlook |

### Kleos Integration (10 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/kleos/status` | Kleos connection status |
| GET | `/api/kleos/health` | Kleos API health check |
| GET | `/api/kleos/cases` | Search cases |
| GET | `/api/kleos/cases/{id}` | Get case details |
| GET | `/api/kleos/case-types` | Get all case types |
| GET | `/api/kleos/contacts` | Search contacts |
| GET | `/api/kleos/contacts/{id}` | Get contact details |
| GET | `/api/kleos/cases/{id}/folders` | Get document folders |
| GET | `/api/kleos/billing` | Get billing items |
| POST | `/api/kleos/billing/mark-billed` | Mark items as paid |

### Notifications (3 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/notifications/stream` | SSE real-time event stream |
| POST | `/api/notifications/send` | Internal: push notification |
| GET | `/api/notifications` | Get notification history |

### Invoices (12 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| POST | `/api/invoices/import` | Bulk import invoices (Excel/JSON) |
| GET | `/api/invoices` | List invoices (filtered, paginated) |
| GET | `/api/invoices/{id}` | Get invoice details + reminder history |
| PATCH | `/api/invoices/{id}` | Update invoice fields |
| POST | `/api/invoices/{id}/status` | Change invoice status |
| DELETE | `/api/invoices/{id}` | Delete invoice |
| GET | `/api/invoices/due` | Get invoices due for reminder |
| POST | `/api/invoices/{id}/remind` | Send payment reminder |
| GET | `/api/invoices/stats` | Invoice statistics |
| GET | `/api/invoices/templates` | Get reminder templates |
| GET | `/api/invoices/settings` | Get reminder settings |
| PUT | `/api/invoices/settings` | Update reminder settings |

### Calendar & Tasks (6 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/calendar/events` | Get calendar events |
| GET | `/api/calendar/tasks` | Get Microsoft To Do tasks |
| GET | `/api/calendar/calendars` | List all calendars |
| GET | `/api/calendar/unified` | Unified timeline (events + tasks + todos) |
| POST | `/api/calendar/events` | Create calendar event |
| POST | `/api/calendar/tasks` | Create To Do task |

### Todos (4 endpoints)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/todos` | List todos (filtered) |
| POST | `/api/todos` | Create todo (with email/dossier context) |
| PATCH | `/api/todos/{id}` | Update todo |
| DELETE | `/api/todos/{id}` | Delete todo |

### Graph Webhooks (1 endpoint)

| Method | Route | Description |
|--------|-------|------------|
| POST | `/api/webhook/graph` | Receive email arrival notifications from Microsoft |

### Subscriptions (1 endpoint)

| Method | Route | Description |
|--------|-------|------------|
| POST | `/api/subscriptions` | Manage Graph change notification subscriptions |

### Health (1 endpoint)

| Method | Route | Description |
|--------|-------|------------|
| GET | `/api/health` | API health check (Graph, Kleos, Storage) |

---

## 5. Web Application

### Framework & Stack

- **Next.js 16.1.1** (App Router)
- **React 19.2.3**
- **Tailwind CSS 4** with CSS custom properties
- **Framer Motion** for animations
- **Recharts** for charts
- **Lucide React** for icons
- **date-fns** for date formatting (French locale)
- **Sonner** for toast notifications

### Pages & Routes

| Route | Page | Description |
|-------|------|------------|
| `/login` | Login | Microsoft OAuth + demo mode |
| `/dashboard` | Dashboard | Quick stats, charts, recent matches, pipeline runs |
| `/dashboard/review` | Review Overview | Pipeline stats, match rate chart, source breakdown |
| `/dashboard/review/matches` | Matches | Full match log with filters, expandable details, approve/reject |
| `/dashboard/review/queue` | Review Queue | Items needing human review (60-85% confidence) |
| `/dashboard/review/senders` | Sender History | Recurring sender patterns and match history |
| `/dashboard/review/analytics` | Analytics | Daily trends, confidence distribution, source effectiveness |
| `/dashboard/review/tuning` | Tuning | Accuracy stats, threshold recommendations, false positives |
| `/dashboard/settings` | Settings | Profile, notification preferences, language |
| `/dashboard/invoices` | Invoices | Invoice management (placeholder) |

### Key Components

| Component | Description |
|-----------|------------|
| **Sidebar** | Fixed navigation (Dashboard, Review, Settings) with user profile |
| **AIChatPanel** | Floating AI chat for natural language email search |
| **MatchLogRow** | Expandable match detail row with draft reply generation |
| **FilterBar** | Multi-filter bar (mailbox, confidence, source, lawyer, dates) |
| **MatchRateChart** | Area chart showing daily match rate trends |
| **PipelineRunCard** | Card showing pipeline execution summary |
| **ReviewNav** | Tab navigation for review sub-pages |
| **ConfidenceBadge** | Color-coded confidence score display |
| **CategoryBadge** | Email category indicator |
| **MatchSourceTag** | Matching source label |
| **ReviewActions** | Approve/reject buttons |
| **NotificationToast** | Real-time SSE notification toasts |
| **StatsCard** | Reusable statistics card |
| **EmailList** | Email list with pagination |
| **FolderList** | Hierarchical folder tree |

### Features

1. **Real-time notifications** — SSE stream from `/api/notifications/stream`
2. **AI chat panel** — Natural language email search with Grok
3. **Match review workflow** — Approve/reject matches with one click
4. **Draft reply generation** — AI-generated responses with copy-to-clipboard
5. **Analytics dashboards** — Daily trends, confidence distribution, source effectiveness
6. **Tuning recommendations** — Threshold suggestions based on review accuracy
7. **Sender relationship tracking** — Historical sender-to-dossier patterns
8. **Responsive design** — Mobile-first with responsive breakpoints
9. **Dark/light mode** — CSS custom properties with theme support
10. **French localization** — All UI text in French

---

## 6. Kleos Integration

Kleos is the law firm's case management software. LB-BOT integrates with Kleos for:

### Reading Data

- **Search dossiers**: By name, reference, party name, RG number
- **Get case details**: Full case info including parties, dates, status
- **Search contacts**: Find contacts by name or email
- **Get document folders**: Hierarchical folder structure per dossier
- **Get billing items**: Timesheets and prestations for fee tracking

### Writing Data

- **Create documents**: File emails and attachments to specific dossier folders
- **Mark billing items**: Update billing status (NotBilled → Billed)

### Knowledge Base Sync

The matching engine builds a knowledge base from Kleos data:
- All open dossiers with parties, references, RG numbers
- Contact lists per dossier
- Lawyer assignments
- Keywords extracted from dossier names

---

## 7. Invoice & Fee Reminder System

### Features

- **Bulk import** from Excel or JSON
- **Invoice tracking** with status (pending, paid, disputed, written_off)
- **Automated reminders** with 3-level escalation:
  - Level 1: Friendly first reminder
  - Level 2: Firm second reminder
  - Level 3: Final notice before legal action
- **Email reminders** sent via SMTP
- **Reminder history** tracking per invoice
- **Statistics dashboard** (total unpaid, overdue count, due this week)
- **Configurable settings** (reminder intervals, templates)

### Invoice Fields

| Field | Description |
|-------|------------|
| invoiceNumber | Invoice reference |
| invoiceDate | Date issued |
| dueDate | Payment deadline |
| amount / currency | Amount owed |
| clientName / clientEmail | Client details |
| caseName / caseId | Linked Kleos dossier |
| status | pending, paid, disputed, written_off |
| reminderCount | Number of reminders sent |
| nextReminderAt | Scheduled next reminder |

---

## 8. Calendar & Tasks

### Calendar Integration

- **Read events** from Microsoft Outlook calendar
- **Create events** with attendees, location, all-day support
- **Unified timeline** merging calendar events + MS To Do tasks + local todos

### Todo Management

- **Create todos** linked to emails and dossiers
- **Priority levels**: low, normal, high, urgent
- **Status tracking**: pending, in_progress, completed, cancelled
- **Email context**: Optional link to originating email (messageId, subject, sender)
- **Dossier context**: Optional link to dossier (id, name, RG number)

---

## 9. Notifications (Real-Time SSE)

### Server-Sent Events Stream

- **Endpoint**: `GET /api/notifications/stream`
- **Events**: `email_received`, `email_processed`, `todo_created`, `todo_updated`, `system`
- **Heartbeat**: Every 30 seconds
- **Auto-reconnect**: 5-second delay on disconnect

### Notification Types

| Event | Description |
|-------|------------|
| `email_received` | New email arrived and queued for processing |
| `email_processed` | Email finished processing (matched/review/error) |
| `todo_created` | New todo created from email |
| `todo_updated` | Todo status changed |
| `system` | System-level notifications |

### Frontend Integration

- **NotificationToast**: Auto-dismiss after 5 seconds, color-coded
- **NotificationBell**: Dropdown menu showing recent notifications
- **Toast library**: Sonner for additional UI notifications

---

## 10. AI Features (xAI Grok)

### Email Classification (Tier 4)

- **Model**: Grok 4-1-fast-reasoning
- **Scoped classification**: Limited to lawyer's open cases
- **Global classification**: All knowledge base dossiers
- **Prompt**: Instructs AI to match based on parties, subject matter, legal concepts

### Conversational Search (`/api/chat`)

- Natural language queries about emails
- Pattern detection: attachment search, date search, sender search, dossier search
- Citation-based responses with relevance scores
- Follow-up question suggestions
- Prompt injection detection

### Advanced AI Search (`/api/ai/search`)

- xAI Grok understands search intent
- Translates natural language to Graph API search
- Categorizes emails (tribunals, confreres, clients, expertises, etc.)
- Returns structured JSON with search parameters

### Draft Reply Generation

- AI-powered email response drafting
- Confidence level and style match assessment
- Template-based with dynamic content injection

---

## 11. Authentication & Security

### Microsoft OAuth2

- **Scopes**: openid, profile, email, offline_access, User.Read, Mail.Read, Mail.ReadWrite, Mail.Send, Calendars.Read, Calendars.ReadWrite
- **Token storage**: Encrypted in Supabase (AES-256-GCM)
- **Session**: Base64url-encoded JSON token with 24-hour expiry
- **Cookie**: `lb_session` (httpOnly, secure)

### Security Measures

- **Prompt injection detection**: `containsPromptInjection()` utility
- **Input sanitization**: `sanitizeForPrompt()` for AI inputs
- **Webhook validation**: Client state verification for Graph webhooks
- **Internal service key**: For notification push API
- **CORS**: Configured per environment
- **Token encryption**: AES-256-GCM for stored OAuth tokens

### Route Protection

- Middleware checks authentication on all `/dashboard/*` routes
- Redirects to `/login` if session invalid
- Demo mode available for development (`NEXT_PUBLIC_DEV_MODE=true`)

---

## 12. Data Types & Schema

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `match_logs` | All email-to-dossier matches with confidence, source, review status |
| `sender_history` | Sender email → dossier mapping with frequency counts |
| `conversation_threads` | Conversation ID → dossier mapping for thread reuse |
| `pipeline_runs` | Pipeline execution records with stats |
| `users` | User accounts with OAuth tokens |
| `todos` | Task management with email/dossier context |
| `unpaid_invoices` | Invoice tracking with reminder scheduling |
| `reminder_history` | Log of sent payment reminders |
| `reminder_templates` | Customizable reminder email templates |
| `reminder_settings` | Reminder automation configuration |
| `user_preferences` | Per-user settings (notifications, language) |
| `notifications` | Notification history |

### Key Types

- **ProcessingRecord**: Full email processing state (17 statuses, audit trail, attachments, matches)
- **MatchResult**: Dossier match with confidence, source, reasons
- **ExtractedSignals**: RG numbers, entities, dates, thread position, language
- **DossierKnowledge**: Dossier info for matching (parties, references, keywords)
- **PipelineRun**: Execution summary (processed, matched, auto-filed, errors)
- **PipelineStats**: Aggregated statistics (overview, daily, by source, by mailbox)
- **AccuracyStats**: Review metrics (accuracy by source, threshold recommendations)

---

## 13. Design System

### Colors

| Variable | Light | Dark | Usage |
|----------|-------|------|-------|
| `--background` | #f3f6f9 | #0a0f1a | Page background |
| `--foreground` | #0a0f1a | #f3f6f9 | Primary text |
| `--card` | #ffffff | #131620 | Card background |
| `--primary` | #146ef5 | #146ef5 | Primary actions |
| `--accent-gold` | #d49a38 | #d49a38 | Premium accent |
| `--sidebar` | #0a0f1a | #0a0f1a | Sidebar background |
| `--border` | #e0e0e0 | #2a2d3a | Borders |
| `--muted` | #e8ecf0 | #1e2029 | Muted backgrounds |

### Typography

| Element | Style |
|---------|-------|
| Page titles | `text-2xl font-light tracking-[0.05em]` (Montserrat) |
| Section headers | `font-medium tracking-wide` |
| Stat values | `text-2xl font-light` |
| Body text | Inter 300-500 |
| Sidebar brand | Montserrat 300 |

### Fonts

- **Montserrat** (200, 300, 400, 500, 600) — Headings
- **Inter** (300, 400, 500) — Body text

### Border Radius

- `rounded` (4px) — Standard
- `rounded-full` — Avatars, badges, dots only

---

## 14. Environment Variables

### Azure AD (OAuth)

```
AZURE_TENANT_ID
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AUTH_REDIRECT_URI
FRONTEND_URL
```

### Supabase

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
```

### Azure Service Bus

```
AZURE_SERVICE_BUS_CONNECTION_STRING
EMAIL_PROCESS_QUEUE_NAME          (default: "email-process")
AUTO_SEND_QUEUE_NAME              (default: "auto-send")
```

### Azure Blob Storage

```
AZURE_BLOB_CONNECTION_STRING
AZURE_BLOB_CONTAINER              (default: "lbbot-attachments")
```

### Graph Webhook

```
WEBHOOK_URL
WEBHOOK_CLIENT_STATE
MONITORED_MAILBOXES               (comma-separated, optional)
```

### Session & Security

```
SESSION_SECRET
INTERNAL_SERVICE_KEY
```

### Kleos

```
KLEOS_API_URL
KLEOS_CLIENT_ID
KLEOS_CLIENT_SECRET
KLEOS_API_KEY
KLEOS_TIMEOUT                     (default: 30000)
KLEOS_RETRY_COUNT                 (default: 3)
```

### Firm Configuration

```
FIRM_NAME
FIRM_ADDRESS
FIRM_PHONE
FIRM_EMAIL
```

### Processing Automation

```
READ_ONLY_MODE                    (default: true)
AUTO_SEND_ENABLED                 (default: false)
AUTO_SEND_DELAY_MINUTES           (default: 5)
AUTO_APPROVE_CONFIDENCE_THRESHOLD (default: 0.85)
AUTO_GENERATE_DRAFTS              (default: true)
AUTO_SEND_BLOCKED_DOMAINS
```

### AI (xAI Grok)

```
XAI_API_KEY
XAI_API_URL                       (default: https://api.x.ai/v1/chat/completions)
XAI_MODEL                         (default: grok-4-1-fast-reasoning)
```

### Web Frontend

```
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_DEV_MODE              (default: false)
```

---

## 15. Deployment

### Local Development

```bash
pnpm install
pnpm dev          # Start all services
pnpm tunnel       # ngrok for webhooks (separate terminal)
```

### Production

| Service | Platform | URL |
|---------|----------|-----|
| Web | Vercel | https://app.laurencebrosset-avocats.fr |
| API | Azure Functions | Azure App Service |
| Worker | Azure Functions | Azure Service Bus trigger |
| Database | Supabase | Cloud PostgreSQL |
| Website | Webflow | https://www.laurencebrosset-avocats.fr |

### Vercel Deploy Command

```bash
mv turbo.json turbo.json.bak && vercel deploy --prod --force && mv turbo.json.bak turbo.json
```

### Build Commands

```bash
pnpm --filter @lb-bot/shared build    # Build shared package first
pnpm --filter web build                # Then build web
```

### Scripts Reference

| Command | Description |
|---------|------------|
| `pnpm dev` | Run all apps in parallel |
| `pnpm dev:api` | Run API only |
| `pnpm dev:worker` | Run worker only |
| `pnpm dev:web` | Run web frontend only |
| `pnpm build` | Build all apps |
| `pnpm test` | Run tests |
| `pnpm clean` | Remove dist + node_modules |
| `pnpm setup:subscription` | Register Graph webhook subscription |
| `pnpm upload:kb` | Upload knowledge base to Supabase |
| `pnpm dry-run` | Test email processing pipeline |

---

*Generated 2026-02-23 — SELARL Brosset-Techer / LB-BOT Beta 0.1*
