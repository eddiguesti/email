/**
 * Microsoft Graph API Types
 */

export interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  clientState: string;
  notificationUrl: string;
  expirationDateTime: string;
  applicationId: string;
  creatorId: string;
}

export interface GraphWebhookNotification {
  value: GraphNotificationItem[];
  validationTokens?: string[];
}

export interface GraphNotificationItem {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
  clientState: string;
  tenantId: string;
}

export interface GraphMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  internetMessageId: string;
  subject: string;
  bodyPreview: string;
  importance: 'low' | 'normal' | 'high';
  parentFolderId: string;
  conversationId: string;
  conversationIndex: string;
  isDeliveryReceiptRequested: boolean;
  isReadReceiptRequested: boolean;
  isRead: boolean;
  isDraft: boolean;
  webLink: string;
  inferenceClassification: 'focused' | 'other';
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  sender: GraphEmailAddress;
  from: GraphEmailAddress;
  toRecipients: GraphEmailAddress[];
  ccRecipients: GraphEmailAddress[];
  bccRecipients: GraphEmailAddress[];
  replyTo: GraphEmailAddress[];
  flag: {
    flagStatus: 'notFlagged' | 'complete' | 'flagged';
  };
  attachments?: GraphAttachment[];
}

export interface GraphEmailAddress {
  emailAddress: {
    name: string;
    address: string;
  };
}

export interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  lastModifiedDateTime: string;
  '@odata.type': string;
  contentId?: string;
  contentLocation?: string;
  contentBytes?: string; // Base64 encoded for file attachments
}

export interface GraphFileAttachment extends GraphAttachment {
  '@odata.type': '#microsoft.graph.fileAttachment';
  contentBytes: string;
}

export interface GraphItemAttachment extends GraphAttachment {
  '@odata.type': '#microsoft.graph.itemAttachment';
  item: GraphMessage;
}

export interface GraphDraftMessage {
  subject: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  toRecipients: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  bccRecipients?: GraphEmailAddress[];
  importance?: 'low' | 'normal' | 'high';
  attachments?: Array<{
    '@odata.type': '#microsoft.graph.fileAttachment';
    name: string;
    contentType: string;
    contentBytes: string;
  }>;
}

export interface GraphSendMailRequest {
  message: GraphDraftMessage;
  saveToSentItems: boolean;
}

export interface GraphSubscriptionRequest {
  changeType: string;
  notificationUrl: string;
  resource: string;
  expirationDateTime: string;
  clientState: string;
}

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface GraphError {
  error: {
    code: string;
    message: string;
    innerError?: {
      date: string;
      'request-id': string;
      'client-request-id': string;
    };
  };
}

// Conversation thread info
export interface GraphConversation {
  id: string;
  topic: string;
  hasAttachments: boolean;
  lastDeliveredDateTime: string;
  uniqueSenders: string[];
  preview: string;
}

// Search types
export interface GraphSearchRequest {
  requests: Array<{
    entityTypes: ('message' | 'event' | 'drive' | 'driveItem' | 'list' | 'listItem' | 'site')[];
    query: {
      queryString: string;
    };
    from?: number;
    size?: number;
  }>;
}

export interface GraphSearchResponse {
  value: Array<{
    searchTerms: string[];
    hitsContainers: Array<{
      hits: Array<{
        hitId: string;
        rank: number;
        summary: string;
        resource: GraphMessage;
      }>;
      total: number;
      moreResultsAvailable: boolean;
    }>;
  }>;
}
