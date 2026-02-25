/**
 * Azure Service Bus Queue Client
 * Handles job queuing for email processing and auto-send
 */

import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
  ProcessErrorArgs,
} from '@azure/service-bus';
import type { EmailProcessJob, AutoSendJob } from '../types/processing.js';

export interface QueueConfig {
  connectionString: string;
  emailProcessQueueName?: string;
  autoSendQueueName?: string;
}

export type JobHandler<T> = (job: T) => Promise<void>;

export class QueueClient {
  private client: ServiceBusClient;
  private emailProcessSender: ServiceBusSender;
  private autoSendSender: ServiceBusSender;
  private emailProcessQueueName: string;
  private autoSendQueueName: string;

  constructor(config: QueueConfig) {
    this.client = new ServiceBusClient(config.connectionString);
    this.emailProcessQueueName = config.emailProcessQueueName || 'email-process';
    this.autoSendQueueName = config.autoSendQueueName || 'auto-send';

    this.emailProcessSender = this.client.createSender(this.emailProcessQueueName);
    this.autoSendSender = this.client.createSender(this.autoSendQueueName);
  }

  // ============= Email Process Queue =============

  /**
   * Enqueue an email processing job
   */
  async enqueueEmailProcess(job: EmailProcessJob): Promise<void> {
    await this.emailProcessSender.sendMessages({
      body: job,
      messageId: job.idempotencyKey,
      contentType: 'application/json',
      subject: 'email-process',
      applicationProperties: {
        tenantId: job.tenantId,
        mailbox: job.mailbox,
        messageId: job.messageId,
      },
    });
  }

  /**
   * Enqueue multiple email processing jobs (batch)
   */
  async enqueueEmailProcessBatch(jobs: EmailProcessJob[]): Promise<void> {
    const messages = jobs.map((job) => ({
      body: job,
      messageId: job.idempotencyKey,
      contentType: 'application/json',
      subject: 'email-process',
      applicationProperties: {
        tenantId: job.tenantId,
        mailbox: job.mailbox,
        messageId: job.messageId,
      },
    }));

    // Service Bus has a limit, so batch in chunks
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await this.emailProcessSender.sendMessages(batch);
    }
  }

  /**
   * Start processing email jobs
   */
  startEmailProcessSubscription(
    handler: JobHandler<EmailProcessJob>,
    options?: {
      maxConcurrentCalls?: number;
      autoCompleteMessages?: boolean;
    }
  ): ServiceBusReceiver {
    const receiver = this.client.createReceiver(this.emailProcessQueueName, {
      receiveMode: 'peekLock',
    });

    receiver.subscribe(
      {
        processMessage: async (message: ServiceBusReceivedMessage) => {
          const job = message.body as EmailProcessJob;
          try {
            await handler(job);
            await receiver.completeMessage(message);
          } catch (error) {
            console.error('Error processing email job:', error);
            // Message will be automatically retried based on queue settings
            await receiver.abandonMessage(message);
          }
        },
        processError: async (args: ProcessErrorArgs) => {
          console.error('Queue error:', args.error);
        },
      },
      {
        maxConcurrentCalls: options?.maxConcurrentCalls ?? 5,
        autoCompleteMessages: options?.autoCompleteMessages ?? false,
      }
    );

    return receiver;
  }

  // ============= Auto-Send Queue =============

  /**
   * Schedule an auto-send job
   */
  async scheduleAutoSend(job: AutoSendJob): Promise<string> {
    const scheduledTime = new Date(job.scheduledFor);

    const sequenceNumber = await this.autoSendSender.scheduleMessages(
      {
        body: job,
        messageId: job.idempotencyKey,
        contentType: 'application/json',
        subject: 'auto-send',
        applicationProperties: {
          messageId: job.messageId,
          draftId: job.draftId,
          draftType: job.draftType,
        },
      },
      scheduledTime
    );

    return sequenceNumber.toString();
  }

  /**
   * Cancel a scheduled auto-send
   */
  async cancelAutoSend(sequenceNumber: string): Promise<boolean> {
    try {
      // Cast to any to work around strict typing with bigint
      await this.autoSendSender.cancelScheduledMessages(BigInt(sequenceNumber) as unknown as never);
      return true;
    } catch (error) {
      console.error('Failed to cancel scheduled message:', error);
      return false;
    }
  }

  /**
   * Start processing auto-send jobs
   */
  startAutoSendSubscription(
    handler: JobHandler<AutoSendJob>,
    options?: {
      maxConcurrentCalls?: number;
    }
  ): ServiceBusReceiver {
    const receiver = this.client.createReceiver(this.autoSendQueueName, {
      receiveMode: 'peekLock',
    });

    receiver.subscribe(
      {
        processMessage: async (message: ServiceBusReceivedMessage) => {
          const job = message.body as AutoSendJob;
          try {
            await handler(job);
            await receiver.completeMessage(message);
          } catch (error) {
            console.error('Error processing auto-send job:', error);
            await receiver.abandonMessage(message);
          }
        },
        processError: async (args: ProcessErrorArgs) => {
          console.error('Auto-send queue error:', args.error);
        },
      },
      {
        maxConcurrentCalls: options?.maxConcurrentCalls ?? 2,
        autoCompleteMessages: false,
      }
    );

    return receiver;
  }

  // ============= Dead Letter Queue =============

  /**
   * Get dead letter messages for inspection
   */
  async getDeadLetterMessages(
    queueName: 'email-process' | 'auto-send',
    maxMessages = 10
  ): Promise<ServiceBusReceivedMessage[]> {
    const actualQueueName =
      queueName === 'email-process' ? this.emailProcessQueueName : this.autoSendQueueName;

    const receiver = this.client.createReceiver(actualQueueName, {
      subQueueType: 'deadLetter',
      receiveMode: 'peekLock',
    });

    try {
      const messages = await receiver.receiveMessages(maxMessages, { maxWaitTimeInMs: 5000 });
      return messages;
    } finally {
      await receiver.close();
    }
  }

  /**
   * Requeue a dead letter message
   */
  async requeueDeadLetter(
    queueName: 'email-process' | 'auto-send',
    message: ServiceBusReceivedMessage
  ): Promise<void> {
    const actualQueueName =
      queueName === 'email-process' ? this.emailProcessQueueName : this.autoSendQueueName;

    // Get the dead letter receiver
    const dlReceiver = this.client.createReceiver(actualQueueName, {
      subQueueType: 'deadLetter',
      receiveMode: 'peekLock',
    });

    // Get the sender for the main queue
    const sender =
      queueName === 'email-process' ? this.emailProcessSender : this.autoSendSender;

    try {
      // Send to main queue
      await sender.sendMessages({
        body: message.body,
        messageId: `${message.messageId}-requeue-${Date.now()}`,
        contentType: message.contentType,
        subject: message.subject,
        applicationProperties: message.applicationProperties,
      });

      // Complete the dead letter message
      await dlReceiver.completeMessage(message);
    } finally {
      await dlReceiver.close();
    }
  }

  // ============= Lifecycle =============

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.emailProcessSender.close();
    await this.autoSendSender.close();
    await this.client.close();
  }
}

/**
 * Create queue client from environment variables
 */
export function createQueueClientFromEnv(): QueueClient {
  const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error('AZURE_SERVICE_BUS_CONNECTION_STRING environment variable is required');
  }

  return new QueueClient({
    connectionString,
    emailProcessQueueName: process.env.EMAIL_PROCESS_QUEUE_NAME,
    autoSendQueueName: process.env.AUTO_SEND_QUEUE_NAME,
  });
}
