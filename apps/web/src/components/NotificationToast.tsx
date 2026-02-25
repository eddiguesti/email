'use client';

import { useState, useCallback } from 'react';
import { X, Mail, CheckCircle, ClipboardList, Bell } from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';

interface Toast {
  id: string;
  notification: Notification;
  visible: boolean;
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const handleNotification = useCallback((notification: Notification) => {
    const id = notification.id || crypto.randomUUID();

    setToasts((prev) => [
      ...prev,
      { id, notification, visible: true },
    ]);

    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
      );
    }, 5000);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5300);
  }, []);

  const { isConnected } = useNotifications({
    enabled: true,
    onNotification: handleNotification,
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'email_received':
        return <Mail className="w-4 h-4" strokeWidth={1.8} />;
      case 'email_processed':
        return <CheckCircle className="w-4 h-4" strokeWidth={1.8} />;
      case 'todo_created':
      case 'todo_updated':
        return <ClipboardList className="w-4 h-4" strokeWidth={1.8} />;
      default:
        return <Bell className="w-4 h-4" strokeWidth={1.8} />;
    }
  };

  const getAccentColor = (type: Notification['type']) => {
    switch (type) {
      case 'email_received':
        return 'border-l-[#0071e3]';
      case 'email_processed':
        return 'border-l-emerald-400';
      case 'todo_created':
        return 'border-l-purple-400';
      case 'todo_updated':
        return 'border-l-amber-400';
      default:
        return 'border-l-[var(--muted-foreground)]';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm">
      {toasts.map(({ id, notification, visible }) => (
        <div
          key={id}
          className={`
            transform transition-all duration-300 ease-out
            ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border-l-[3px] ${getAccentColor(notification.type)}
            p-4 flex items-start gap-3
          `}
        >
          <div className="flex-shrink-0 p-1.5 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)]">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--foreground)]">{notification.title}</p>
            <p className="text-[12px] text-[var(--muted-foreground)] truncate mt-0.5">{notification.message}</p>
          </div>
          <button
            onClick={() => dismissToast(id)}
            className="flex-shrink-0 p-1 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-all duration-200"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead } = useNotifications({
    enabled: true,
  });

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-xl transition-all duration-200"
      >
        <Bell className="w-5 h-5" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold leading-none text-white bg-[var(--destructive)] rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span
          className={`absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full ${
            isConnected ? 'bg-emerald-400' : 'bg-gray-300'
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-5 h-5 text-[var(--muted-foreground)]" strokeWidth={1.5} />
                  </div>
                  <p className="text-[13px] text-[var(--muted-foreground)]">Aucune notification</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={`px-5 py-3.5 border-b border-[var(--border)] last:border-b-0 cursor-pointer hover:bg-[var(--muted)] transition-all duration-200 ${
                      !notification.read ? 'bg-[var(--muted)]/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 ${!notification.read ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                        {notification.type === 'email_received' && <Mail className="w-4 h-4" strokeWidth={1.8} />}
                        {notification.type === 'email_processed' && <CheckCircle className="w-4 h-4" strokeWidth={1.8} />}
                        {(notification.type === 'todo_created' || notification.type === 'todo_updated') && <ClipboardList className="w-4 h-4" strokeWidth={1.8} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] ${!notification.read ? 'font-semibold' : 'font-medium'} text-[var(--foreground)]`}>
                          {notification.title}
                        </p>
                        <p className="text-[12px] text-[var(--muted-foreground)] truncate">{notification.message}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)] opacity-50 mt-1">
                          {new Date(notification.timestamp).toLocaleString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="flex-shrink-0 w-2 h-2 bg-[var(--accent)] rounded-full mt-1.5" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
