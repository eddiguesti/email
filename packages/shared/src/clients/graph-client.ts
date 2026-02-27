/**
 * Microsoft Graph Client
 * Handles all Graph API operations: email fetch, attachments, subscriptions, sending
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type {
  GraphMessage,
  GraphAttachment,
  GraphFileAttachment,
  GraphSubscription,
  GraphSubscriptionRequest,
  GraphDraftMessage,
  GraphSearchRequest,
  GraphSearchResponse,
} from '../types/graph.js';

export interface GraphClientConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

export interface GraphTokenProvider {
  getAccessToken(): Promise<string>;
}

export class GraphClient {
  private client: Client;
  private config: GraphClientConfig;

  constructor(config: GraphClientConfig, tokenProvider?: GraphTokenProvider) {
    this.config = config;

    this.client = Client.init({
      authProvider: async (done) => {
        try {
          const token = tokenProvider
            ? await tokenProvider.getAccessToken()
            : await this.getAppToken();
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      },
    });
  }

  /**
   * Get app-only token using client credentials flow.
   * Retries up to 3 times on network errors or 429/503 responses,
   * with exponential backoff starting at 1 second.
   * Each attempt is bounded by a 30-second AbortController timeout.
   */
  private async getAppToken(): Promise<string> {
    const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429 || response.status === 503) {
          lastError = new Error(`Graph token endpoint returned ${response.status}`);
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
          continue;
        }

        if (!response.ok) {
          throw new Error(`Failed to get Graph token: HTTP ${response.status}`);
        }

        const data = await response.json() as { access_token: string };
        return data.access_token;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;
        // Do not retry on timeout or non-transient errors
        if ((error as Error).name === 'AbortError') break;
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError ?? new Error('Failed to get Graph token after retries');
  }

  // ============= Message Operations =============

  /**
   * Fetch a single message by ID
   */
  async getMessage(mailbox: string, messageId: string): Promise<GraphMessage> {
    const message = await this.client
      .api(`/users/${mailbox}/messages/${messageId}`)
      .select([
        'id',
        'createdDateTime',
        'receivedDateTime',
        'sentDateTime',
        'subject',
        'bodyPreview',
        'body',
        'importance',
        'conversationId',
        'conversationIndex',
        'internetMessageId',
        'hasAttachments',
        'isRead',
        'isDraft',
        'sender',
        'from',
        'toRecipients',
        'ccRecipients',
        'flag',
        'webLink',
      ])
      .get();

    return message as GraphMessage;
  }

  /**
   * Fetch message with attachments expanded
   */
  async getMessageWithAttachments(mailbox: string, messageId: string): Promise<GraphMessage> {
    const message = await this.client
      .api(`/users/${mailbox}/messages/${messageId}`)
      .expand('attachments')
      .get();

    return message as GraphMessage;
  }

  /**
   * Get all attachments for a message
   */
  async getAttachments(mailbox: string, messageId: string): Promise<GraphAttachment[]> {
    const response = await this.client
      .api(`/users/${mailbox}/messages/${messageId}/attachments`)
      .get();

    return response.value as GraphAttachment[];
  }

  /**
   * Get a single attachment with content
   */
  async getAttachment(
    mailbox: string,
    messageId: string,
    attachmentId: string
  ): Promise<GraphFileAttachment> {
    const attachment = await this.client
      .api(`/users/${mailbox}/messages/${messageId}/attachments/${attachmentId}`)
      .get();

    return attachment as GraphFileAttachment;
  }

  /**
   * Get attachment content as Buffer
   */
  async getAttachmentContent(
    mailbox: string,
    messageId: string,
    attachmentId: string
  ): Promise<{ buffer: Buffer; contentType: string; name: string }> {
    const attachment = await this.getAttachment(mailbox, messageId, attachmentId);

    if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') {
      throw new Error('Not a file attachment');
    }

    const buffer = Buffer.from(attachment.contentBytes, 'base64');
    return {
      buffer,
      contentType: attachment.contentType,
      name: attachment.name,
    };
  }

  /**
   * Get raw message as .eml format
   */
  async getMessageRaw(mailbox: string, messageId: string): Promise<Buffer> {
    const response = await this.client
      .api(`/users/${mailbox}/messages/${messageId}/$value`)
      .get();

    // Response is the raw MIME content
    if (typeof response === 'string') {
      return Buffer.from(response);
    }
    return response as Buffer;
  }

  /**
   * List recent inbox messages
   */
  async listInboxMessages(
    mailbox: string,
    options?: { top?: number; skip?: number; since?: string }
  ): Promise<{ messages: GraphMessage[]; nextLink?: string }> {
    let request = this.client
      .api(`/users/${mailbox}/mailFolders('Inbox')/messages`)
      .select([
        'id',
        'receivedDateTime',
        'subject',
        'sender',
        'from',
        'hasAttachments',
        'isRead',
        'isDraft',
        'conversationId',
        'importance',
      ])
      .orderby('receivedDateTime desc')
      .top(options?.top ?? 50);

    if (options?.skip) {
      request = request.skip(options.skip);
    }

    if (options?.since) {
      request = request.filter(`receivedDateTime ge ${options.since}`);
    }

    const response = await request.get();

    return {
      messages: response.value as GraphMessage[],
      nextLink: response['@odata.nextLink'],
    };
  }

  // ============= Thread Operations =============

  /**
   * Get all messages in a conversation
   */
  async getConversationMessages(
    mailbox: string,
    conversationId: string
  ): Promise<GraphMessage[]> {
    const response = await this.client
      .api(`/users/${mailbox}/messages`)
      .filter(`conversationId eq '${conversationId}'`)
      .orderby('receivedDateTime desc')
      .select(['id', 'subject', 'receivedDateTime', 'sender', 'from', 'bodyPreview'])
      .get();

    return response.value as GraphMessage[];
  }

  /**
   * Check if this is a first-contact email (no prior messages in thread from us)
   */
  async isFirstContact(mailbox: string, conversationId: string): Promise<boolean> {
    const messages = await this.getConversationMessages(mailbox, conversationId);

    // Check if any message in thread was sent by us (not received)
    const sentByUs = messages.some((msg) => {
      const senderEmail = msg.sender?.emailAddress?.address?.toLowerCase();
      return senderEmail === mailbox.toLowerCase();
    });

    return !sentByUs;
  }

  // ============= Draft & Send Operations =============

  /**
   * Create a draft reply to a message
   */
  async createReplyDraft(
    mailbox: string,
    messageId: string,
    content: { subject?: string; body: string; contentType?: 'text' | 'html' }
  ): Promise<GraphMessage> {
    // First create the reply draft
    const replyDraft = await this.client
      .api(`/users/${mailbox}/messages/${messageId}/createReply`)
      .post({});

    // Then update it with our content
    const updated = await this.client
      .api(`/users/${mailbox}/messages/${replyDraft.id}`)
      .update({
        body: {
          contentType: content.contentType || 'html',
          content: content.body,
        },
      });

    return updated as GraphMessage;
  }

  /**
   * Create a new draft message
   */
  async createDraft(mailbox: string, draft: GraphDraftMessage): Promise<GraphMessage> {
    const message = await this.client
      .api(`/users/${mailbox}/messages`)
      .post(draft);

    return message as GraphMessage;
  }

  /**
   * Update an existing draft
   */
  async updateDraft(
    mailbox: string,
    draftId: string,
    updates: Partial<GraphDraftMessage>
  ): Promise<GraphMessage> {
    const message = await this.client
      .api(`/users/${mailbox}/messages/${draftId}`)
      .update(updates);

    return message as GraphMessage;
  }

  /**
   * Send a draft message
   */
  async sendDraft(mailbox: string, draftId: string): Promise<void> {
    await this.client
      .api(`/users/${mailbox}/messages/${draftId}/send`)
      .post({});
  }

  /**
   * Send a new message directly
   */
  async sendMail(
    mailbox: string,
    message: GraphDraftMessage,
    saveToSentItems = true
  ): Promise<void> {
    await this.client.api(`/users/${mailbox}/sendMail`).post({
      message,
      saveToSentItems,
    });
  }

  // ============= Subscription Operations =============

  /**
   * Create a new subscription for inbox messages
   */
  async createSubscription(
    mailbox: string,
    notificationUrl: string,
    clientState: string,
    expirationMinutes = 4230 // Max is 4230 minutes (~3 days)
  ): Promise<GraphSubscription> {
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + expirationMinutes);

    const subscription: GraphSubscriptionRequest = {
      changeType: 'created',
      notificationUrl,
      resource: `/users/${mailbox}/mailFolders('Inbox')/messages`,
      expirationDateTime: expiration.toISOString(),
      clientState,
    };

    const result = await this.client.api('/subscriptions').post(subscription);
    return result as GraphSubscription;
  }

  /**
   * Renew an existing subscription
   */
  async renewSubscription(
    subscriptionId: string,
    expirationMinutes = 4230
  ): Promise<GraphSubscription> {
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + expirationMinutes);

    const result = await this.client.api(`/subscriptions/${subscriptionId}`).update({
      expirationDateTime: expiration.toISOString(),
    });

    return result as GraphSubscription;
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.client.api(`/subscriptions/${subscriptionId}`).delete();
  }

  /**
   * List all subscriptions
   */
  async listSubscriptions(): Promise<GraphSubscription[]> {
    const result = await this.client.api('/subscriptions').get();
    return result.value as GraphSubscription[];
  }

  // ============= Folder Operations =============

  /**
   * Move a message to a destination folder.
   * destinationId can be a folder ID or well-known name (e.g. "junkemail", "inbox").
   */
  async moveMessage(mailbox: string, messageId: string, destinationId: string): Promise<void> {
    await this.client
      .api(`/users/${mailbox}/messages/${messageId}/move`)
      .post({ destinationId });
  }

  /**
   * Find a top-level mail folder by display name. Returns null if not found.
   */
  async getMailFolderByName(
    mailbox: string,
    displayName: string
  ): Promise<{ id: string; displayName: string } | null> {
    const result = await this.client
      .api(`/users/${mailbox}/mailFolders`)
      .filter(`displayName eq '${displayName.replace(/'/g, "''")}'`)
      .select('id,displayName')
      .top(1)
      .get();

    return result.value?.[0]
      ? { id: result.value[0].id, displayName: result.value[0].displayName }
      : null;
  }

  /**
   * Create a folder. If parentFolderId is given, creates it as a child folder.
   */
  async createMailFolder(
    mailbox: string,
    displayName: string,
    parentFolderId?: string
  ): Promise<{ id: string; displayName: string }> {
    const endpoint = parentFolderId
      ? `/users/${mailbox}/mailFolders/${parentFolderId}/childFolders`
      : `/users/${mailbox}/mailFolders`;

    const result = await this.client.api(endpoint).post({ displayName });
    return { id: result.id, displayName: result.displayName };
  }

  /**
   * Find or create a named folder at the top level of the mailbox.
   */
  async findOrCreateFolder(mailbox: string, displayName: string): Promise<string> {
    const existing = await this.getMailFolderByName(mailbox, displayName);
    if (existing) return existing.id;
    const created = await this.createMailFolder(mailbox, displayName);
    return created.id;
  }

  // ============= Search Operations =============

  /**
   * Search messages using Graph Search API
   */
  async searchMessages(
    mailbox: string,
    query: string,
    options?: { from?: number; size?: number }
  ): Promise<GraphSearchResponse> {
    const searchRequest: GraphSearchRequest = {
      requests: [
        {
          entityTypes: ['message'],
          query: { queryString: query },
          from: options?.from ?? 0,
          size: options?.size ?? 25,
        },
      ],
    };

    const result = await this.client
      .api('/search/query')
      .header('ConsistencyLevel', 'eventual')
      .post(searchRequest);

    return result as GraphSearchResponse;
  }
}
