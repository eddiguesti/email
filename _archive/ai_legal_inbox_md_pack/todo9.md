# TODO9 — Attachment Extraction + Kelous/Kleos Integration

## Overview

Implement secure attachment handling from Microsoft Graph, AI-powered document classification, and seamless upload to Kelous/Kleos practice management system with matter association, retry logic, and full traceability.

---

## 9.1 Kelous/Kleos OAuth Integration

### 9.1.1 OAuth Configuration

```typescript
// packages/backend/src/config/kelous.config.ts
import { z } from "zod";

export const KelousConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  baseUrl: z.string().url(),
  authorizationEndpoint: z.string(),
  tokenEndpoint: z.string(),
  scopes: z.array(z.string()),
  redirectUri: z.string().url(),
});

export type KelousConfig = z.infer<typeof KelousConfigSchema>;

export const kelousConfig: KelousConfig = {
  clientId: process.env.KELOUS_CLIENT_ID!,
  clientSecret: process.env.KELOUS_CLIENT_SECRET!,
  baseUrl: process.env.KELOUS_API_URL || "https://api.kleos.wolterskluwer.com",
  authorizationEndpoint: "/oauth2/authorize",
  tokenEndpoint: "/oauth2/token",
  scopes: [
    "matters.read",
    "matters.write",
    "documents.read",
    "documents.write",
    "clients.read",
  ],
  redirectUri: `${process.env.BACKEND_URL}/api/kelous/callback`,
};
```

### 9.1.2 OAuth Flow Implementation

```typescript
// packages/backend/src/services/kelous/oauth.service.ts
import { db } from "../../db";
import { kelousConnections } from "../../db/schema";
import { eq } from "drizzle-orm";
import { kelousConfig } from "../../config/kelous.config";
import crypto from "crypto";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export class KelousOAuthService {
  /**
   * Generate authorization URL for user to connect Kelous account
   */
  generateAuthUrl(userId: string, firmId: string): string {
    const state = crypto.randomBytes(32).toString("hex");

    // Store state for verification
    this.storeOAuthState(state, userId, firmId);

    const params = new URLSearchParams({
      client_id: kelousConfig.clientId,
      redirect_uri: kelousConfig.redirectUri,
      response_type: "code",
      scope: kelousConfig.scopes.join(" "),
      state,
    });

    return `${kelousConfig.baseUrl}${kelousConfig.authorizationEndpoint}?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, state: string): Promise<{ userId: string; firmId: string }> {
    // Verify state
    const storedState = await this.verifyOAuthState(state);
    if (!storedState) {
      throw new Error("Invalid OAuth state");
    }

    const response = await fetch(`${kelousConfig.baseUrl}${kelousConfig.tokenEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${kelousConfig.clientId}:${kelousConfig.clientSecret}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: kelousConfig.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens: TokenResponse = await response.json();

    // Store connection
    await db.insert(kelousConnections).values({
      id: crypto.randomUUID(),
      userId: storedState.userId,
      firmId: storedState.firmId,
      accessToken: this.encryptToken(tokens.access_token),
      refreshToken: this.encryptToken(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope.split(" "),
      isActive: true,
      createdAt: new Date(),
    });

    return { userId: storedState.userId, firmId: storedState.firmId };
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(userId: string): Promise<string> {
    const connection = await db.query.kelousConnections.findFirst({
      where: eq(kelousConnections.userId, userId),
    });

    if (!connection) {
      throw new Error("No Kelous connection found. Please connect your account.");
    }

    // Check if token needs refresh (5 min buffer)
    if (connection.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      return this.refreshAccessToken(connection);
    }

    return this.decryptToken(connection.accessToken);
  }

  private async refreshAccessToken(connection: any): Promise<string> {
    const response = await fetch(`${kelousConfig.baseUrl}${kelousConfig.tokenEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${kelousConfig.clientId}:${kelousConfig.clientSecret}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.decryptToken(connection.refreshToken),
      }),
    });

    if (!response.ok) {
      // Mark connection as invalid
      await db
        .update(kelousConnections)
        .set({ isActive: false })
        .where(eq(kelousConnections.id, connection.id));

      throw new Error("Failed to refresh Kelous token. Please reconnect.");
    }

    const tokens: TokenResponse = await response.json();

    // Update stored tokens
    await db
      .update(kelousConnections)
      .set({
        accessToken: this.encryptToken(tokens.access_token),
        refreshToken: this.encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(kelousConnections.id, connection.id));

    return tokens.access_token;
  }

  private encryptToken(token: string): string {
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  private decryptToken(encryptedToken: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedToken.split(":");
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  private async storeOAuthState(state: string, userId: string, firmId: string): Promise<void> {
    // Store in Redis with 10 min expiry
    const redis = await getRedisClient();
    await redis.setex(
      `kelous_oauth_state:${state}`,
      600,
      JSON.stringify({ userId, firmId })
    );
  }

  private async verifyOAuthState(state: string): Promise<{ userId: string; firmId: string } | null> {
    const redis = await getRedisClient();
    const data = await redis.get(`kelous_oauth_state:${state}`);
    if (!data) return null;

    // Delete state after use
    await redis.del(`kelous_oauth_state:${state}`);
    return JSON.parse(data);
  }
}
```

---

## 9.2 Kelous API Client

### 9.2.1 API Client Implementation

```typescript
// packages/backend/src/services/kelous/client.ts
import { KelousOAuthService } from "./oauth.service";
import { kelousConfig } from "../../config/kelous.config";

export interface KelousClient {
  id: string;
  name: string;
  email?: string;
  reference?: string;
  matters?: KelousMatter[];
}

export interface KelousMatter {
  id: string;
  reference: string;
  description: string;
  clientId: string;
  clientName: string;
  status: "active" | "closed" | "archived";
  practiceArea?: string;
  responsibleLawyer?: string;
  createdAt: string;
}

export interface KelousDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  matterId: string;
  folderId?: string;
  uploadedBy: string;
  uploadedAt: string;
  metadata?: Record<string, any>;
}

export interface DocumentUploadRequest {
  matterId: string;
  folderId?: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
  metadata?: {
    sourceEmailId?: string;
    sourceThreadId?: string;
    documentType?: string;
    description?: string;
  };
}

export class KelousClient {
  private oauthService: KelousOAuthService;
  private userId: string;

  constructor(userId: string) {
    this.oauthService = new KelousOAuthService();
    this.userId = userId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    isFormData: boolean = false
  ): Promise<T> {
    const accessToken = await this.oauthService.getAccessToken(this.userId);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${kelousConfig.baseUrl}${path}`, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kelous API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Search for clients
   */
  async searchClients(query: string, limit: number = 20): Promise<KelousClient[]> {
    return this.request<KelousClient[]>(
      "GET",
      `/api/v1/clients?search=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  /**
   * Get client by ID
   */
  async getClient(clientId: string): Promise<KelousClient> {
    return this.request<KelousClient>("GET", `/api/v1/clients/${clientId}`);
  }

  /**
   * Search for matters
   */
  async searchMatters(
    query: string,
    options?: { clientId?: string; status?: string; limit?: number }
  ): Promise<KelousMatter[]> {
    const params = new URLSearchParams({
      search: query,
      limit: String(options?.limit || 20),
    });

    if (options?.clientId) params.set("clientId", options.clientId);
    if (options?.status) params.set("status", options.status);

    return this.request<KelousMatter[]>("GET", `/api/v1/matters?${params}`);
  }

  /**
   * Get matter by ID
   */
  async getMatter(matterId: string): Promise<KelousMatter> {
    return this.request<KelousMatter>("GET", `/api/v1/matters/${matterId}`);
  }

  /**
   * Get matters for a client
   */
  async getClientMatters(clientId: string): Promise<KelousMatter[]> {
    return this.request<KelousMatter[]>("GET", `/api/v1/clients/${clientId}/matters`);
  }

  /**
   * Get folder structure for a matter
   */
  async getMatterFolders(matterId: string): Promise<any[]> {
    return this.request<any[]>("GET", `/api/v1/matters/${matterId}/folders`);
  }

  /**
   * Upload document to matter
   */
  async uploadDocument(request: DocumentUploadRequest): Promise<KelousDocument> {
    const formData = new FormData();
    formData.append("file", new Blob([request.content]), request.fileName);
    formData.append("matterId", request.matterId);

    if (request.folderId) {
      formData.append("folderId", request.folderId);
    }

    if (request.metadata) {
      formData.append("metadata", JSON.stringify(request.metadata));
    }

    return this.request<KelousDocument>(
      "POST",
      `/api/v1/matters/${request.matterId}/documents`,
      formData,
      true
    );
  }

  /**
   * Get document metadata
   */
  async getDocument(documentId: string): Promise<KelousDocument> {
    return this.request<KelousDocument>("GET", `/api/v1/documents/${documentId}`);
  }

  /**
   * Check connection status
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request("GET", "/api/v1/me");
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 9.3 Attachment Extraction from Graph

### 9.3.1 Attachment Service

```typescript
// packages/backend/src/services/attachment.service.ts
import { Client } from "@microsoft/microsoft-graph-client";
import { getGraphClient } from "./graph/client";
import { db } from "../db";
import { attachments, emails } from "../db/schema";
import { eq } from "drizzle-orm";

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId?: string;
}

export interface AttachmentContent extends EmailAttachment {
  content: Buffer;
}

export class AttachmentService {
  private graphClient: Client;

  constructor(accessToken: string) {
    this.graphClient = getGraphClient(accessToken);
  }

  /**
   * List attachments for an email
   */
  async listAttachments(messageId: string): Promise<EmailAttachment[]> {
    const response = await this.graphClient
      .api(`/me/messages/${messageId}/attachments`)
      .select("id,name,contentType,size,isInline,contentId")
      .get();

    const items = response.value || [];

    // Store attachment metadata
    for (const att of items) {
      await db
        .insert(attachments)
        .values({
          id: crypto.randomUUID(),
          graphAttachmentId: att.id,
          emailId: messageId,
          name: att.name,
          contentType: att.contentType,
          size: att.size,
          isInline: att.isInline,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }

    return items.map((att: any) => ({
      id: att.id,
      name: att.name,
      contentType: att.contentType,
      size: att.size,
      isInline: att.isInline || false,
      contentId: att.contentId,
    }));
  }

  /**
   * Download attachment content
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<AttachmentContent> {
    const response = await this.graphClient
      .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
      .get();

    // Graph returns base64-encoded content for file attachments
    const content = Buffer.from(response.contentBytes, "base64");

    return {
      id: response.id,
      name: response.name,
      contentType: response.contentType,
      size: response.size,
      isInline: response.isInline || false,
      contentId: response.contentId,
      content,
    };
  }

  /**
   * Download all non-inline attachments for an email
   */
  async downloadAllAttachments(messageId: string): Promise<AttachmentContent[]> {
    const attachmentList = await this.listAttachments(messageId);

    // Filter out inline attachments (embedded images, etc.)
    const fileAttachments = attachmentList.filter((att) => !att.isInline);

    // Download in parallel with concurrency limit
    const results: AttachmentContent[] = [];
    const batchSize = 3;

    for (let i = 0; i < fileAttachments.length; i += batchSize) {
      const batch = fileAttachments.slice(i, i + batchSize);
      const downloads = await Promise.all(
        batch.map((att) => this.downloadAttachment(messageId, att.id))
      );
      results.push(...downloads);
    }

    return results;
  }

  /**
   * Get attachment metadata from database
   */
  async getStoredAttachments(emailId: string): Promise<any[]> {
    return db.query.attachments.findMany({
      where: eq(attachments.emailId, emailId),
    });
  }
}
```

---

## 9.4 Document Classification

### 9.4.1 AI Document Classifier

```typescript
// packages/backend/src/services/kelous/classifier.service.ts
import Anthropic from "@anthropic-ai/sdk";

export interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
  suggestedMatterKeywords: string[];
  summary: string;
  metadata: {
    hasSignature?: boolean;
    mentionedParties?: string[];
    mentionedDates?: string[];
    caseReferences?: string[];
  };
}

export type DocumentType =
  | "correspondence"
  | "contract"
  | "court_filing"
  | "pleading"
  | "evidence"
  | "memo"
  | "invoice"
  | "identification"
  | "property_document"
  | "witness_statement"
  | "expert_report"
  | "other";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  correspondence: "Correspondence",
  contract: "Contract/Agreement",
  court_filing: "Court Filing",
  pleading: "Pleading",
  evidence: "Evidence",
  memo: "Memorandum",
  invoice: "Invoice/Bill",
  identification: "ID Document",
  property_document: "Property Document",
  witness_statement: "Witness Statement",
  expert_report: "Expert Report",
  other: "Other",
};

export class DocumentClassifierService {
  private claude: Anthropic;

  constructor() {
    this.claude = new Anthropic();
  }

  /**
   * Classify a document based on its content and filename
   */
  async classifyDocument(
    fileName: string,
    contentType: string,
    textContent?: string, // Extracted text for PDFs/docs
    emailContext?: string
  ): Promise<DocumentClassification> {
    const response = await this.claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a legal document classifier for a law firm's practice management system.

Classify documents into these categories:
- correspondence: Letters, emails saved as files
- contract: Contracts, agreements, terms
- court_filing: Filed court documents with case numbers
- pleading: Complaints, answers, motions
- evidence: Photos, records, exhibits
- memo: Internal memos, research notes
- invoice: Bills, invoices, fee notes
- identification: Passports, IDs, company documents
- property_document: Deeds, leases, titles
- witness_statement: Witness statements, affidavits
- expert_report: Expert opinions, reports
- other: Anything that doesn't fit above

Extract:
- Keywords that could match to matter references
- Mentioned parties/names
- Key dates
- Case/matter references

Return JSON with DocumentClassification structure.`,
      messages: [
        {
          role: "user",
          content: `Classify this document:

Filename: ${fileName}
Content Type: ${contentType}

${textContent ? `Document text (first 2000 chars):\n${textContent.substring(0, 2000)}` : "No text content available"}

${emailContext ? `Email context:\n${emailContext}` : ""}

Return JSON only.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return this.defaultClassification(fileName);
    }

    try {
      return JSON.parse(content.text) as DocumentClassification;
    } catch {
      return this.defaultClassification(fileName);
    }
  }

  private defaultClassification(fileName: string): DocumentClassification {
    return {
      documentType: "other",
      confidence: 0.3,
      suggestedMatterKeywords: [],
      summary: `Document: ${fileName}`,
      metadata: {},
    };
  }

  /**
   * Extract text from common document types
   */
  async extractText(content: Buffer, contentType: string): Promise<string | null> {
    // For PDFs, use pdf-parse
    if (contentType === "application/pdf") {
      const pdfParse = require("pdf-parse");
      try {
        const data = await pdfParse(content);
        return data.text;
      } catch {
        return null;
      }
    }

    // For Word docs, use mammoth
    if (
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      contentType === "application/msword"
    ) {
      const mammoth = require("mammoth");
      try {
        const result = await mammoth.extractRawText({ buffer: content });
        return result.value;
      } catch {
        return null;
      }
    }

    // Plain text
    if (contentType.startsWith("text/")) {
      return content.toString("utf-8");
    }

    return null;
  }
}
```

---

## 9.5 Upload Orchestration Service

### 9.5.1 Kelous Upload Service

```typescript
// packages/backend/src/services/kelous/upload.service.ts
import { db } from "../../db";
import { kelousDocuments, attachments } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { KelousClient, DocumentUploadRequest } from "./client";
import { DocumentClassifierService, DocumentClassification } from "./classifier.service";
import { AttachmentService, AttachmentContent } from "../attachment.service";

export interface UploadRequest {
  emailId: string;
  threadId: string;
  attachmentId: string;
  matterId: string;
  folderId?: string;
  documentType?: string;
  customName?: string;
}

export interface UploadResult {
  success: boolean;
  kelousDocumentId?: string;
  error?: string;
  retryable?: boolean;
}

export interface BulkUploadRequest {
  emailId: string;
  threadId: string;
  matterId: string;
  folderId?: string;
  attachmentIds: string[]; // If empty, upload all non-inline attachments
}

export class KelousUploadService {
  private kelousClient: KelousClient;
  private classifier: DocumentClassifierService;

  constructor(userId: string) {
    this.kelousClient = new KelousClient(userId);
    this.classifier = new DocumentClassifierService();
  }

  /**
   * Upload a single attachment to Kelous
   */
  async uploadAttachment(
    request: UploadRequest,
    attachmentContent: AttachmentContent
  ): Promise<UploadResult> {
    try {
      // Check for duplicate (idempotency)
      const existing = await db.query.kelousDocuments.findFirst({
        where: and(
          eq(kelousDocuments.sourceAttachmentId, request.attachmentId),
          eq(kelousDocuments.matterId, request.matterId)
        ),
      });

      if (existing) {
        return {
          success: true,
          kelousDocumentId: existing.kelousDocumentId,
        };
      }

      // Extract text for classification
      const textContent = await this.classifier.extractText(
        attachmentContent.content,
        attachmentContent.contentType
      );

      // Classify document
      const classification = await this.classifier.classifyDocument(
        attachmentContent.name,
        attachmentContent.contentType,
        textContent || undefined
      );

      // Prepare upload request
      const uploadRequest: DocumentUploadRequest = {
        matterId: request.matterId,
        folderId: request.folderId,
        fileName: request.customName || attachmentContent.name,
        mimeType: attachmentContent.contentType,
        content: attachmentContent.content,
        metadata: {
          sourceEmailId: request.emailId,
          sourceThreadId: request.threadId,
          documentType: request.documentType || classification.documentType,
          description: classification.summary,
        },
      };

      // Upload to Kelous
      const kelousDoc = await this.kelousClient.uploadDocument(uploadRequest);

      // Store mapping
      await db.insert(kelousDocuments).values({
        id: crypto.randomUUID(),
        kelousDocumentId: kelousDoc.id,
        sourceAttachmentId: request.attachmentId,
        emailId: request.emailId,
        threadId: request.threadId,
        matterId: request.matterId,
        fileName: kelousDoc.name,
        documentType: classification.documentType,
        classification: classification,
        uploadedAt: new Date(),
        createdAt: new Date(),
      });

      return {
        success: true,
        kelousDocumentId: kelousDoc.id,
      };
    } catch (error: any) {
      const isRetryable =
        error.message?.includes("timeout") ||
        error.message?.includes("503") ||
        error.message?.includes("429");

      return {
        success: false,
        error: error.message,
        retryable: isRetryable,
      };
    }
  }

  /**
   * Upload multiple attachments with retry logic
   */
  async uploadBulk(
    request: BulkUploadRequest,
    accessToken: string
  ): Promise<Map<string, UploadResult>> {
    const attachmentService = new AttachmentService(accessToken);
    const results = new Map<string, UploadResult>();

    // Get attachments to upload
    let attachmentsToUpload: AttachmentContent[];

    if (request.attachmentIds.length > 0) {
      attachmentsToUpload = await Promise.all(
        request.attachmentIds.map((attId) =>
          attachmentService.downloadAttachment(request.emailId, attId)
        )
      );
    } else {
      attachmentsToUpload = await attachmentService.downloadAllAttachments(request.emailId);
    }

    // Upload each with retry
    for (const attachment of attachmentsToUpload) {
      let result: UploadResult;
      let attempts = 0;
      const maxAttempts = 3;

      do {
        attempts++;
        result = await this.uploadAttachment(
          {
            emailId: request.emailId,
            threadId: request.threadId,
            attachmentId: attachment.id,
            matterId: request.matterId,
            folderId: request.folderId,
          },
          attachment
        );

        if (!result.success && result.retryable && attempts < maxAttempts) {
          // Exponential backoff
          await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));
        }
      } while (!result.success && result.retryable && attempts < maxAttempts);

      results.set(attachment.id, result);
    }

    return results;
  }

  /**
   * Suggest matter based on email content and classification
   */
  async suggestMatter(
    emailContext: string,
    attachmentClassifications: DocumentClassification[]
  ): Promise<KelousMatter[]> {
    // Combine keywords from all classifications
    const allKeywords = new Set<string>();
    for (const classification of attachmentClassifications) {
      classification.suggestedMatterKeywords.forEach((k) => allKeywords.add(k));
      classification.metadata.mentionedParties?.forEach((p) => allKeywords.add(p));
      classification.metadata.caseReferences?.forEach((r) => allKeywords.add(r));
    }

    // Search Kelous for matching matters
    const keywordArray = Array.from(allKeywords);
    const searchQuery = keywordArray.slice(0, 5).join(" ");

    if (!searchQuery) {
      return [];
    }

    return this.kelousClient.searchMatters(searchQuery, { limit: 5, status: "active" });
  }
}
```

---

## 9.6 Database Schema

```typescript
// packages/backend/src/db/schema/kelous.ts
import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { users, emails, threads } from "./index";

export const kelousConnections = pgTable("kelous_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  firmId: uuid("firm_id").notNull(),

  // Encrypted tokens
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull(),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kelousDocuments = pgTable("kelous_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  kelousDocumentId: text("kelous_document_id").notNull(),

  // Source tracking
  sourceAttachmentId: text("source_attachment_id").notNull(),
  emailId: text("email_id").notNull(),
  threadId: uuid("thread_id").references(() => threads.id),

  // Kelous destination
  matterId: text("matter_id").notNull(),
  folderId: text("folder_id"),
  fileName: text("file_name").notNull(),

  // Classification
  documentType: text("document_type"),
  classification: jsonb("classification").$type<DocumentClassification>(),

  // Status
  uploadedAt: timestamp("uploaded_at").notNull(),
  syncStatus: text("sync_status").default("synced"), // synced, pending, error

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphAttachmentId: text("graph_attachment_id").notNull(),
  emailId: text("email_id").notNull(),

  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  isInline: boolean("is_inline").default(false),

  // Processing status
  isProcessed: boolean("is_processed").default(false),
  classificationResult: jsonb("classification_result").$type<DocumentClassification>(),

  createdAt: timestamp("created_at").defaultNow(),
});

// Indexes
export const kelousDocumentsIndexes = {
  emailIdx: index("idx_kelous_docs_email").on(kelousDocuments.emailId),
  matterIdx: index("idx_kelous_docs_matter").on(kelousDocuments.matterId),
  sourceAttIdx: index("idx_kelous_docs_source").on(kelousDocuments.sourceAttachmentId),
};
```

---

## 9.7 tRPC Procedures

```typescript
// packages/backend/src/trpc/routers/kelous.router.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { KelousOAuthService } from "../../services/kelous/oauth.service";
import { KelousClient } from "../../services/kelous/client";
import { KelousUploadService } from "../../services/kelous/upload.service";
import { AttachmentService } from "../../services/attachment.service";
import { DocumentClassifierService } from "../../services/kelous/classifier.service";

export const kelousRouter = router({
  // OAuth flow
  getAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const oauthService = new KelousOAuthService();
    return { url: oauthService.generateAuthUrl(ctx.user.id, ctx.user.firmId) };
  }),

  checkConnection: protectedProcedure.query(async ({ ctx }) => {
    try {
      const client = new KelousClient(ctx.user.id);
      const connected = await client.testConnection();
      return { connected };
    } catch {
      return { connected: false };
    }
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(kelousConnections)
      .set({ isActive: false })
      .where(eq(kelousConnections.userId, ctx.user.id));

    return { success: true };
  }),

  // Matter search
  searchMatters: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        clientId: z.string().optional(),
        limit: z.number().max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = new KelousClient(ctx.user.id);
      return client.searchMatters(input.query, {
        clientId: input.clientId,
        limit: input.limit,
      });
    }),

  getMatter: protectedProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = new KelousClient(ctx.user.id);
      return client.getMatter(input.matterId);
    }),

  getMatterFolders: protectedProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = new KelousClient(ctx.user.id);
      return client.getMatterFolders(input.matterId);
    }),

  // Attachment handling
  listAttachments: protectedProcedure
    .input(z.object({ emailId: z.string() }))
    .query(async ({ ctx, input }) => {
      const attachmentService = new AttachmentService(ctx.accessToken);
      return attachmentService.listAttachments(input.emailId);
    }),

  classifyAttachment: protectedProcedure
    .input(z.object({ emailId: z.string(), attachmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const attachmentService = new AttachmentService(ctx.accessToken);
      const classifier = new DocumentClassifierService();

      const attachment = await attachmentService.downloadAttachment(
        input.emailId,
        input.attachmentId
      );

      const textContent = await classifier.extractText(
        attachment.content,
        attachment.contentType
      );

      return classifier.classifyDocument(
        attachment.name,
        attachment.contentType,
        textContent || undefined
      );
    }),

  suggestMatter: protectedProcedure
    .input(z.object({ emailId: z.string(), threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const uploadService = new KelousUploadService(ctx.user.id);
      const attachmentService = new AttachmentService(ctx.accessToken);
      const classifier = new DocumentClassifierService();

      // Get email context
      const email = await db.query.emails.findFirst({
        where: eq(emails.graphMessageId, input.emailId),
      });

      // Classify attachments
      const attachments = await attachmentService.downloadAllAttachments(input.emailId);
      const classifications = await Promise.all(
        attachments.map(async (att) => {
          const text = await classifier.extractText(att.content, att.contentType);
          return classifier.classifyDocument(att.name, att.contentType, text || undefined);
        })
      );

      return uploadService.suggestMatter(
        `${email?.subject || ""} ${email?.bodyPreview || ""}`,
        classifications
      );
    }),

  // Upload
  uploadAttachment: protectedProcedure
    .input(
      z.object({
        emailId: z.string(),
        threadId: z.string().uuid(),
        attachmentId: z.string(),
        matterId: z.string(),
        folderId: z.string().optional(),
        documentType: z.string().optional(),
        customName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const uploadService = new KelousUploadService(ctx.user.id);
      const attachmentService = new AttachmentService(ctx.accessToken);

      const attachment = await attachmentService.downloadAttachment(
        input.emailId,
        input.attachmentId
      );

      const result = await uploadService.uploadAttachment(input, attachment);

      // Audit log
      await auditLog({
        userId: ctx.user.id,
        action: "document_uploaded",
        resourceType: "kelous_document",
        resourceId: result.kelousDocumentId || input.attachmentId,
        metadata: {
          matterId: input.matterId,
          success: result.success,
          error: result.error,
        },
      });

      return result;
    }),

  uploadBulk: protectedProcedure
    .input(
      z.object({
        emailId: z.string(),
        threadId: z.string().uuid(),
        matterId: z.string(),
        folderId: z.string().optional(),
        attachmentIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const uploadService = new KelousUploadService(ctx.user.id);

      const results = await uploadService.uploadBulk(input, ctx.accessToken);

      // Convert Map to array for response
      const resultArray = Array.from(results.entries()).map(([id, result]) => ({
        attachmentId: id,
        ...result,
      }));

      return resultArray;
    }),

  // Get upload history
  getUploadHistory: protectedProcedure
    .input(z.object({ threadId: z.string().uuid().optional(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const query = db.query.kelousDocuments.findMany({
        where: input.threadId ? eq(kelousDocuments.threadId, input.threadId) : undefined,
        orderBy: (docs, { desc }) => [desc(docs.uploadedAt)],
        limit: input.limit,
      });

      return query;
    }),
});
```

---

## 9.8 UI Components

### 9.8.1 Attachment Upload Panel

```typescript
// packages/add-in/src/components/Kelous/AttachmentUploadPanel.tsx
import React, { useState } from "react";
import { trpc } from "../../utils/trpc";
import { MatterSearch } from "./MatterSearch";
import { AttachmentList } from "./AttachmentList";
import { FolderSelector } from "./FolderSelector";
import { DOCUMENT_TYPE_LABELS } from "@lb-bot/shared";

interface AttachmentUploadPanelProps {
  emailId: string;
  threadId: string;
  onComplete: () => void;
}

export const AttachmentUploadPanel: React.FC<AttachmentUploadPanelProps> = ({
  emailId,
  threadId,
  onComplete,
}) => {
  const [selectedMatter, setSelectedMatter] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());

  const { data: attachments, isLoading } = trpc.kelous.listAttachments.useQuery({ emailId });
  const { data: suggestedMatters } = trpc.kelous.suggestMatter.useQuery({ emailId, threadId });
  const { data: folders } = trpc.kelous.getMatterFolders.useQuery(
    { matterId: selectedMatter! },
    { enabled: !!selectedMatter }
  );

  const uploadMutation = trpc.kelous.uploadBulk.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  const handleUpload = () => {
    if (!selectedMatter) return;

    uploadMutation.mutate({
      emailId,
      threadId,
      matterId: selectedMatter,
      folderId: selectedFolder || undefined,
      attachmentIds: Array.from(selectedAttachments),
    });
  };

  const toggleAttachment = (id: string) => {
    const newSelected = new Set(selectedAttachments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAttachments(newSelected);
  };

  const selectAll = () => {
    if (!attachments) return;
    const nonInline = attachments.filter((a) => !a.isInline);
    setSelectedAttachments(new Set(nonInline.map((a) => a.id)));
  };

  if (isLoading) {
    return <div className="loading">Loading attachments...</div>;
  }

  const nonInlineAttachments = attachments?.filter((a) => !a.isInline) || [];

  if (nonInlineAttachments.length === 0) {
    return <div className="no-attachments">No attachments to upload</div>;
  }

  return (
    <div className="attachment-upload-panel">
      <h3>Upload to Kelous</h3>

      <section className="matter-section">
        <label>Select Matter</label>
        {suggestedMatters && suggestedMatters.length > 0 && (
          <div className="suggested-matters">
            <span className="label">Suggested:</span>
            {suggestedMatters.slice(0, 3).map((matter) => (
              <button
                key={matter.id}
                className={`matter-chip ${selectedMatter === matter.id ? "selected" : ""}`}
                onClick={() => setSelectedMatter(matter.id)}
              >
                {matter.reference}
              </button>
            ))}
          </div>
        )}
        <MatterSearch
          onSelect={(matter) => setSelectedMatter(matter.id)}
          selected={selectedMatter}
        />
      </section>

      {selectedMatter && folders && (
        <section className="folder-section">
          <label>Destination Folder (optional)</label>
          <FolderSelector
            folders={folders}
            selected={selectedFolder}
            onSelect={setSelectedFolder}
          />
        </section>
      )}

      <section className="attachments-section">
        <div className="attachments-header">
          <label>Attachments ({nonInlineAttachments.length})</label>
          <button className="select-all-btn" onClick={selectAll}>
            Select All
          </button>
        </div>
        <AttachmentList
          attachments={nonInlineAttachments}
          selected={selectedAttachments}
          onToggle={toggleAttachment}
          emailId={emailId}
        />
      </section>

      <div className="upload-actions">
        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={
            !selectedMatter ||
            selectedAttachments.size === 0 ||
            uploadMutation.isPending
          }
        >
          {uploadMutation.isPending
            ? `Uploading (${uploadMutation.data?.length || 0}/${selectedAttachments.size})...`
            : `Upload ${selectedAttachments.size} File${selectedAttachments.size !== 1 ? "s" : ""}`}
        </button>
      </div>

      {uploadMutation.isError && (
        <div className="error-message">
          Upload failed: {uploadMutation.error.message}
        </div>
      )}
    </div>
  );
};
```

### 9.8.2 Keyboard Shortcuts

```typescript
// packages/add-in/src/hooks/useKelousKeyboard.ts
import { useEffect } from "react";
import { useStore } from "../store";

export function useKelousKeyboard() {
  const { openKelousPanel, selectedThread } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 'u' - Upload attachments to Kelous
      if (e.key === "u" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openKelousPanel(selectedThread);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedThread]);
}
```

---

## 9.9 Acceptance Criteria Checklist

### OAuth Connection
- [ ] Users can initiate Kelous OAuth flow
- [ ] Authorization code exchanged for tokens
- [ ] Tokens stored encrypted in database
- [ ] Token refresh works before expiry
- [ ] Connection status shown in UI
- [ ] Users can disconnect Kelous account

### Attachment Handling
- [ ] List attachments from email via Graph
- [ ] Download attachment content securely
- [ ] Filter out inline images
- [ ] Handle large attachments (up to 25MB)
- [ ] Proper error handling for missing attachments

### Document Classification
- [ ] AI classifies documents by type
- [ ] Extract text from PDFs and Word docs
- [ ] Suggest relevant matters based on content
- [ ] Classification confidence shown to user
- [ ] Users can override classification

### Upload to Kelous
- [ ] Upload documents to selected matter
- [ ] Optional folder selection
- [ ] Retry logic for transient failures
- [ ] Idempotency prevents duplicates
- [ ] Upload progress shown in UI
- [ ] Success/failure status per file

### Traceability
- [ ] Mapping stored: emailId/attachmentId -> kelousDocumentId
- [ ] Upload history viewable per thread
- [ ] Audit log captures all uploads
- [ ] Matter association tracked

---

## 9.10 Migration

```sql
-- Migration: 009_kelous_integration.sql
CREATE TABLE kelous_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  firm_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_attachment_id TEXT NOT NULL,
  email_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  is_inline BOOLEAN DEFAULT false,
  is_processed BOOLEAN DEFAULT false,
  classification_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kelous_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelous_document_id TEXT NOT NULL,
  source_attachment_id TEXT NOT NULL,
  email_id TEXT NOT NULL,
  thread_id UUID REFERENCES threads(id),
  matter_id TEXT NOT NULL,
  folder_id TEXT,
  file_name TEXT NOT NULL,
  document_type TEXT,
  classification JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kelous_conn_user ON kelous_connections(user_id);
CREATE INDEX idx_attachments_email ON attachments(email_id);
CREATE INDEX idx_kelous_docs_email ON kelous_documents(email_id);
CREATE INDEX idx_kelous_docs_matter ON kelous_documents(matter_id);
CREATE INDEX idx_kelous_docs_thread ON kelous_documents(thread_id);
CREATE UNIQUE INDEX idx_kelous_docs_unique ON kelous_documents(source_attachment_id, matter_id);
