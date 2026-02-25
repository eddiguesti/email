# Legal Inbox - Outlook → Azure → Kleos Integration

A production-ready system for AI-powered email triage and Kleos integration for law firms.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         OUTLOOK ADD-IN (Office.js)                       │
│   Dossier Panel │ Attachments │ Drafts │ Chat/Search Bubble             │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ REST API
┌──────────────────────────────────────────────────────────────────────────┐
│                      AZURE FUNCTIONS (API Layer)                         │
│  /webhook/graph │ /status │ /approve │ /file │ /search │ /chat          │
└──────────────────────────────────────────────────────────────────────────┘
         │                                           │
         ▼ Enqueue                                   ▼ Query
┌─────────────────────┐                   ┌─────────────────────────────────┐
│  AZURE SERVICE BUS  │                   │      AZURE TABLE STORAGE        │
│  email-process      │                   │  ProcessingRecords              │
│  auto-send          │                   │  ThreadMappings │ AuditLogs     │
└─────────────────────┘                   └─────────────────────────────────┘
         │
         ▼ Trigger
┌──────────────────────────────────────────────────────────────────────────┐
│                    WORKER (Service Bus Triggered)                        │
│    Fetch Email → Extract Signals → Match Dossier → Generate Drafts      │
└──────────────────────────────────────────────────────────────────────────┘
         │                                           │
         ▼                                           ▼
┌─────────────────────┐                   ┌─────────────────────────────────┐
│  MICROSOFT GRAPH    │                   │          KLEOS API              │
│  Read/Send Emails   │                   │  Search/Create Documents        │
└─────────────────────┘                   └─────────────────────────────────┘
```

## Features

- **Background Processing**: Email ingestion via Graph webhooks, always-on Azure worker
- **AI-Powered Matching**: Hierarchical dossier matching (thread memory → RG → sender → entities)
- **Kleos Integration**: Automatic filing of emails and attachments with Belgian legal naming conventions
- **Draft Generation**: Template-based drafts (reply, client transmittal, fee reminders)
- **Safe Auto-Send**: Strict policy for system-initiated emails only, prompt-injection prevention
- **Outlook Add-in**: Review suggestions, approve matches, insert drafts, evidence-based search/chat

## Project Structure

```
/api/               Azure Functions (HTTP triggers)
  /src/functions/   API endpoints
    webhook-graph.ts      Graph webhook receiver
    get-status.ts         Get processing status
    approve-dossier.ts    Approve dossier selection
    file-to-kleos.ts      File email/attachments
    generate-drafts.ts    Generate email drafts
    insert-draft.ts       Insert draft to Outlook
    search.ts             Search processed emails
    chat.ts               Evidence-based chat

/worker/            Azure Functions (Service Bus triggers)
  /src/functions/   Worker functions
    process-email.ts      Main email processor
    auto-send.ts          Scheduled send handler
  /src/pipeline/    Processing pipeline
    fetcher.ts           Email fetch from Graph
    extractor.ts         Signal extraction (RG numbers, entities)
    matcher.ts           Dossier matching
    drafter.ts           Draft generation

/add-in/            Outlook Add-in (Office.js)
  /src/taskpane/    React app
  /src/components/  UI components
  manifest.xml      Office add-in manifest

/shared/            Shared code
  /src/types/       TypeScript types
  /src/clients/     API clients (Graph, Kleos, Storage, Queue)
  /src/utils/       Utilities (extraction, sanitization, hashing)
  /src/templates/   Email templates (reply, transmittal, fee reminders)

/infra/             Infrastructure
  /scripts/         Setup and test scripts
  .env.template     Environment template

/browser/           Legacy browser client (preserved from previous version)
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Azure subscription with:
  - Storage Account (Table + Blob)
  - Service Bus namespace
  - (Optional) Application Insights
- Microsoft 365 tenant with:
  - Azure AD app registration
  - Exchange Online mailbox
- Kleos API access
- ngrok (for local webhook testing)

### 1. Clone and Install

```bash
git clone <repo-url>
cd lb-bot
pnpm install
```

### 2. Configure Environment

```bash
# Copy template
cp infra/.env.template .env

# Edit with your values
nano .env
```

Required variables:
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` - Azure AD app
- `AZURE_STORAGE_CONNECTION_STRING` - Storage account
- `AZURE_SERVICE_BUS_CONNECTION_STRING` - Service Bus
- `KLEOS_API_URL`, `KLEOS_API_KEY` - Kleos API
- `WEBHOOK_URL` - Your ngrok URL (e.g., https://your-domain.ngrok-free.app/api/webhook/graph)
- `WEBHOOK_CLIENT_STATE` - Random secret string
- `MONITORED_MAILBOXES` - Comma-separated mailbox addresses

### 3. Azure AD App Registration

1. Go to Azure Portal → Azure Active Directory → App registrations
2. Create new registration
3. Add API permissions (Application type):
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `User.Read.All`
4. Grant admin consent
5. Create client secret
6. Note the Application (client) ID and Directory (tenant) ID

### 4. Create Azure Resources

```bash
# Storage Account
az storage account create \
  --name lbbotstore \
  --resource-group your-rg \
  --location westeurope \
  --sku Standard_LRS

# Service Bus
az servicebus namespace create \
  --name lbbot-sb \
  --resource-group your-rg \
  --location westeurope \
  --sku Standard

# Create queues
az servicebus queue create --namespace-name lbbot-sb --name email-process --resource-group your-rg
az servicebus queue create --namespace-name lbbot-sb --name auto-send --resource-group your-rg
```

### 5. Start Local Development

```bash
# Terminal 1: Start ngrok tunnel
cd infra && chmod +x scripts/local-tunnel.sh && ./scripts/local-tunnel.sh

# Terminal 2: Copy API settings
cd api && cp local.settings.json.template local.settings.json
# Edit local.settings.json with your values

# Terminal 3: Start API
cd api && pnpm dev

# Terminal 4: Start Worker
cd worker && pnpm dev

# Terminal 5: Start Add-in
cd add-in && pnpm dev
```

### 6. Setup Graph Subscription

```bash
# After ngrok is running and API is started
pnpm setup:subscription
```

### 7. Sideload Outlook Add-in

1. Update `add-in/manifest.xml` with your ngrok URL
2. In Outlook Web: Settings → Manage add-ins → My add-ins → Add custom add-in → Add from file
3. Select `add-in/manifest.xml`

## Processing State Machine

```
RECEIVED → FETCHING → FETCHED → EXTRACTING → EXTRACTED → MATCHING → MATCHED
                                                               │
                              ┌────────────────────────────────┤
                              ▼                                ▼
                    READY_FOR_REVIEW ◄────────────────► READY_TO_FILE
                              │                                │
                              └──────────────┬─────────────────┘
                                             ▼
                                   FILING → FILED → DONE
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhook/graph` | Graph webhook receiver |
| GET | `/api/status/{mailbox}/{messageId}` | Get processing status |
| POST | `/api/approve` | Approve dossier selection |
| POST | `/api/file` | File to Kleos |
| POST | `/api/drafts/generate` | Generate drafts |
| POST | `/api/drafts/insert` | Insert draft to Outlook |
| POST | `/api/search` | Search emails |
| POST | `/api/chat` | Evidence-based chat |
| POST | `/api/subscriptions` | Manage Graph subscriptions |
| GET | `/api/health` | Health check |

## Security Considerations

### Prompt Injection Prevention

- Drafts are template-only; LLM can only fill controlled fields
- Auto-send blocked for first-contact emails
- Content scanning for injection patterns
- No inbound text dictates actions

### Auto-Send Safety

- System-initiated only (fee reminders, acknowledgements)
- Requires known thread for replies
- Confidence threshold (default 85%)
- 5-minute delay for cancellation
- Blocked domain list

## Testing

### Test Webhook

```bash
pnpm --filter @lb-bot/infra test:webhook
```

### End-to-End Test

1. Send an email to monitored mailbox
2. Open Outlook, select the email
3. Click "AI Triage" ribbon button
4. Verify dossier suggestion
5. Approve and file
6. Check Kleos for filed document

## Deployment

### Azure Functions

```bash
# Build
pnpm build

# Deploy API
cd api && func azure functionapp publish your-api-app

# Deploy Worker
cd worker && func azure functionapp publish your-worker-app
```

### Add-in

1. Build: `cd add-in && pnpm build`
2. Host `dist/` on HTTPS (Azure Blob static website, etc.)
3. Update manifest URLs
4. Deploy via Microsoft 365 admin center

## TODO (Kleos-specific)

- [ ] Update Kleos client with actual API endpoints when documentation available
- [ ] Implement Azure Cognitive Search for production search
- [ ] Add OCR integration for scanned PDFs
- [ ] Implement LLM draft enhancement (behind template interface)
- [ ] Add user authentication for add-in
- [ ] Create admin dashboard
- [ ] Add monitoring/alerting
- [ ] Implement dead-letter queue processing UI

## License

Proprietary - All rights reserved
