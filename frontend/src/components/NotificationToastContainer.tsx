import React, { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  Bell,
  FileCheck,
  PlusCircle,
  RefreshCw,
  Volume2,
  X,
} from 'lucide-react';
import { SystemNotification } from '../types/itsm';

interface NotificationToastContainerProps {
  notifications: SystemNotification[];
  onDismiss: (id: string) => void;
  onSelectTicket?: (ticketId: string) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  notifications,
  onDismiss,
  onSelectTicket,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificações em Tempo Real do Service Desk"
      className="fixed top-16 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {notifications.map((notif) => (
        <ToastItem
          key={notif.id}
          notification={notif}
          onDismiss={onDismiss}
          onSelectTicket={onSelectTicket}
        />
      ))}
    </div>
  );
};

interface ToastItemProps {
  notification: SystemNotification;
  onDismiss: (id: string) => void;
  onSelectTicket?: (ticketId: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({
  notification,
  onDismiss,
  onSelectTicket,
}) => {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Auto-dismiss after 6 seconds without resetting when parent re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current(notification.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification.id]);

  const getStyleConfig = () => {
    switch (notification.type) {
      case 'ticket_created':
        return {
          icon: <PlusCircle className="w-4 h-4 text-blue-600 shrink-0" />,
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          badgeText: 'NOVO CHAMADO',
          borderClass: 'border-blue-300 ring-1 ring-blue-100',
        };
      case 'ticket_escalated':
        return {
          icon: <ArrowUpRight className="w-4 h-4 text-purple-600 shrink-0" />,
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
          badgeText: 'CHAMADO ESCALONADO',
          borderClass: 'border-purple-300 ring-1 ring-purple-100',
        };
      case 'status_changed':
        return {
          icon: <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          badgeText: 'STATUS ATUALIZADO',
          borderClass: 'border-emerald-300 ring-1 ring-emerald-100',
        };
      case 'order_finalized':
        return {
          icon: <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          badgeText: 'O.S. EMITIDA',
          borderClass: 'border-emerald-300 ring-1 ring-emerald-100',
        };
      default:
        return {
          icon: <Bell className="w-4 h-4 text-slate-600 shrink-0" />,
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          badgeText: 'SERVICE DESK',
          borderClass: 'border-slate-300',
        };
    }
  };

  const config = getStyleConfig();

  return (
    <div
      role="alert"
      className={`pointer-events-auto bg-white/95 backdrop-blur-md rounded-xl p-3.5 shadow-xl border ${config.borderClass} transition-all duration-200 animate-in slide-in-from-top-3 fade-in overflow-hidden relative`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {config.icon}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${config.badgeClass}`}
          >
            {config.badgeText}
          </span>
          {notification.priority && (
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                notification.priority === 'Crítica'
                  ? 'bg-red-100 text-red-800'
                  : notification.priority === 'Alta'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {notification.priority}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-slate-400 font-mono">
            {notification.timestamp}
          </span>
          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            aria-label="Fechar notificação"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <h4 className="text-xs font-bold text-slate-900 leading-snug">
          {notification.title}
        </h4>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {notification.message}
        </p>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Volume2 className="w-3 h-3 text-blue-500 shrink-0" />
          <span>Alerta em tempo real</span>
        </div>

        {notification.ticketId && onSelectTicket && (
          <button
            type="button"
            onClick={() => {
              if (notification.ticketId) {
                onSelectTicket(notification.ticketId);
              }
              onDismiss(notification.id);
            }}
            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-md transition-colors"
          >
            Ver Chamado
          </button>
        )}
      </div>

      {/* Visual countdown progress line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 overflow-hidden">
        <div className="h-full bg-blue-600 animate-[shrink_6s_linear_forwards]" />
      </div>
    </div>
  );
};
