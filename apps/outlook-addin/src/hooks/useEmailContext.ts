import { useState, useEffect, useCallback } from 'react';

export interface EmailInfo {
  messageId: string;
  internetMessageId: string;
  conversationId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  receivedAt: string;
  mailbox: string;
  hasAttachments: boolean;
}

export function useEmailContext() {
  const [emailInfo, setEmailInfo] = useState<EmailInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmailInfo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if Office.js is ready
      if (!Office?.context?.mailbox?.item) {
        throw new Error('No email selected');
      }

      const item = Office.context.mailbox.item;

      // Get email details
      const [messageId, conversationId, subject, from, dateReceived] = await Promise.all([
        new Promise<string>((resolve, reject) => {
          item.getItemIdAsync((result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              resolve(result.value);
            } else {
              reject(new Error(result.error?.message || 'Failed to get message ID'));
            }
          });
        }),
        new Promise<string>((resolve) => {
          if (item.conversationId) {
            resolve(item.conversationId);
          } else {
            resolve('');
          }
        }),
        new Promise<string>((resolve) => {
          resolve(item.subject || '');
        }),
        new Promise<{ displayName: string; emailAddress: string }>((resolve) => {
          if (item.from) {
            resolve({
              displayName: item.from.displayName || '',
              emailAddress: item.from.emailAddress || '',
            });
          } else {
            resolve({ displayName: '', emailAddress: '' });
          }
        }),
        new Promise<Date>((resolve) => {
          if (item.dateTimeCreated) {
            resolve(item.dateTimeCreated);
          } else {
            resolve(new Date());
          }
        }),
      ]);

      // Get mailbox email
      const mailbox = Office.context.mailbox.userProfile.emailAddress;

      // Get internet message ID if available
      let internetMessageId = '';
      try {
        internetMessageId = await new Promise<string>((resolve) => {
          item.internetMessageId;
          // internetMessageId is a property, not async
          resolve((item as any).internetMessageId || '');
        });
      } catch {
        // Ignore - not always available
      }

      const info: EmailInfo = {
        messageId,
        internetMessageId,
        conversationId,
        subject,
        sender: from.displayName || from.emailAddress,
        senderEmail: from.emailAddress,
        receivedAt: dateReceived.toISOString(),
        mailbox,
        hasAttachments: item.attachments?.length > 0,
      };

      setEmailInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get email info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailInfo();

    // Listen for item changes
    const handleItemChanged = () => {
      fetchEmailInfo();
    };

    if (Office?.context?.mailbox) {
      Office.context.mailbox.addHandlerAsync(
        Office.EventType.ItemChanged,
        handleItemChanged
      );
    }

    return () => {
      if (Office?.context?.mailbox) {
        Office.context.mailbox.removeHandlerAsync(
          Office.EventType.ItemChanged,
          handleItemChanged
        );
      }
    };
  }, [fetchEmailInfo]);

  return {
    emailInfo,
    loading,
    error,
    refresh: fetchEmailInfo,
  };
}
