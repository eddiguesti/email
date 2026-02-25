# Legal Inbox - Setup Guide

## Prerequisites

- Node.js 20+
- pnpm 8+
- Microsoft 365 account with admin access
- Azure Portal access

## Quick Start (Development)

```bash
# Install dependencies
pnpm install

# Start backend (port 3001)
cd packages/backend && pnpm dev

# Start worker (for background jobs)
cd packages/backend && pnpm worker

# Start add-in (port 3000)
cd packages/add-in && pnpm dev
```

## Azure AD Configuration

### 1. Register App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App Registrations**
3. Click **New Registration**
   - Name: `Legal Inbox`
   - Supported account types: **Accounts in any organizational directory**
   - Redirect URI: `https://localhost:3001/api/auth/msal/callback`

### 2. Configure API Permissions

Add these permissions (Application type: **Delegated**):

- `Mail.Read`
- `Mail.ReadWrite`
- `Mail.Send`
- `Calendars.ReadWrite`
- `User.Read`
- `openid`
- `profile`
- `offline_access`

Click **Grant admin consent**.

### 3. Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Copy the value (you won't see it again!)

### 4. Configure SSO for Office Add-in

1. Go to **Expose an API**
2. Set Application ID URI: `api://localhost:3000/{your-client-id}`
3. Add scope: `access_as_user`
4. Pre-authorized clients:
   - `ea5a67f6-b6f3-4338-b240-c655ddc3cc8e` (Office desktop)
   - `d3590ed6-52b3-4102-aeff-aad2292ab01c` (Office web)
   - `57fb890c-0dab-4253-a5e0-7188c88b2bb4` (Office iOS)
   - `bc59ab01-8403-45c6-8796-ac3ef710b3e3` (Office Android)

### 5. Update Environment Variables

Edit `packages/backend/.env`:

```env
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

## Sideload Add-in to Outlook

### Option 1: Outlook Web

1. Go to https://outlook.office.com
2. Click Settings (gear icon)
3. Select **Manage add-ins** or **Get Add-ins**
4. Choose **My add-ins** > **Add a custom add-in** > **From file**
5. Upload `packages/add-in/manifest.xml`

### Option 2: Outlook Desktop (Windows)

1. Open Outlook desktop
2. Go to **File** > **Manage Add-ins**
3. Click **+ Add-in** > **Add from file**
4. Select `packages/add-in/manifest.xml`

## Trust SSL Certificate (macOS)

```bash
# One-time setup to avoid browser warnings
sudo mkcert -install
```

## Production Deployment

```bash
# Build all packages
pnpm build

# Backend is in packages/backend/dist
# Add-in is in packages/add-in/dist
```

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Outlook Add-in    │────▶│    Backend API      │
│   (React + Vite)    │     │   (Fastify + tRPC)  │
└─────────────────────┘     └──────────┬──────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          ▼                            ▼                            ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Microsoft Graph   │     │    PostgreSQL       │     │      xAI Grok       │
│   (Email, Calendar) │     │    (Supabase)       │     │   (AI Triage/Draft) │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

## Support

For issues, contact your IT administrator or the development team.
