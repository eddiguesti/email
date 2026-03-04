'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  type: 'email_received' | 'email_processed' | 'todo_created' | 'todo_updated' | 'system' | 'connected';
  title: string;
  message: string;
  timestamp: string;
  read?: boolean;
  metadata?: Record<string, unknown>;
}

interface UseNotificationsOptions {
  enabled?: boolean;
  onNotification?: (notification: Notification) => void;
}

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

/**
 * Manages a single SSE connection to the notifications stream.
 *
 * IMPORTANT: This hook must only be mounted ONCE at the layout level (e.g. the
 * dashboard layout). Mounting it in multiple components simultaneously will open
 * multiple SSE connections to the server — one per hook instance — because each
 * instance maintains its own EventSource ref. If you need notification data in a
 * child component, lift the state up and pass it down as props, or use a shared
 * context/store that calls this hook once at the root.
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, onNotification } = options;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      if (prev.some(n => n.id === notification.id)) return prev;
      return [notification, ...prev].slice(0, 50);
    });
    onNotification?.(notification);
  }, [onNotification]);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;

    try {
      // Session auth is cookie-based (withCredentials); no localStorage token needed.
      const url = new URL('/api/notifications/stream', apiUrl);

      eventSourceRef.current = new EventSource(url.toString(), {
        withCredentials: true,
      });

      eventSourceRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSourceRef.current.onerror = () => {
        setIsConnected(false);
        setError('Connexion perdue');

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
        const delay = Math.min(
          BASE_RECONNECT_MS * 2 ** reconnectAttemptsRef.current,
          MAX_RECONNECT_MS,
        );
        reconnectAttemptsRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
          // eslint-disable-next-line react-hooks/immutability
          connect();
        }, delay);
      };

      eventSourceRef.current.addEventListener('connected', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        console.log('SSE connected:', data);
      });

      eventSourceRef.current.addEventListener('email_received', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        addNotification({
          id: data.id || crypto.randomUUID(),
          type: 'email_received',
          title: data.title || 'Nouvel email',
          message: data.message,
          timestamp: data.timestamp,
          metadata: data.metadata,
        });
      });

      eventSourceRef.current.addEventListener('email_processed', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        addNotification({
          id: data.id || crypto.randomUUID(),
          type: 'email_processed',
          title: data.title || 'Email processed',
          message: data.message,
          timestamp: data.timestamp,
          metadata: data.metadata,
        });
      });

      eventSourceRef.current.addEventListener('todo_created', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        addNotification({
          id: data.id || crypto.randomUUID(),
          type: 'todo_created',
          title: data.title || 'New task',
          message: data.message,
          timestamp: data.timestamp,
          metadata: data.metadata,
        });
      });

      eventSourceRef.current.addEventListener('todo_updated', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        addNotification({
          id: data.id || crypto.randomUUID(),
          type: 'todo_updated',
          title: data.title || 'Task updated',
          message: data.message,
          timestamp: data.timestamp,
          metadata: data.metadata,
        });
      });

      eventSourceRef.current.addEventListener('system', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        addNotification({
          id: data.id || crypto.randomUUID(),
          type: 'system',
          title: data.title || 'Notification',
          message: data.message,
          timestamp: data.timestamp,
          metadata: data.metadata,
        });
      });
    } catch (err) {
      setError('Connection error');
      console.error('SSE connection error:', err);
    }
  }, [enabled, addNotification]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    notifications,
    isConnected,
    error,
    unreadCount: notifications.filter((n) => !n.read).length,
    connect,
    disconnect,
    clearNotifications,
    markAsRead,
    markAllAsRead,
  };
}
