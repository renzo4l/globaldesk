/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, LogOut } from 'lucide-react';
import { api } from './services/api';
import {
  Department,
  FinalizationOutcome,
  ImpactLevel,
  InterventionType,
  ServiceOrder,
  SupportTier,
  SystemNotification,
  SystemUser,
  TechnicianId,
  Ticket,
  TicketAttachment,
  TicketCategory,
  TicketFilterState,
  TicketStatus,
  TicketType,
  UrgencyLevel,
} from './types/itsm';
import {
  INITIAL_TICKETS,
  KNOWLEDGE_BASE_ARTICLES,
  TECHNICIANS,
} from './data/mockData';
import {
  buildInitialSlaMetrics,
  calculateItilPriority,
  evaluateSlaHealth,
  generateNextTicketProtocol,
} from './utils/itilRules';
import {
  mapServerOrderToFrontend,
  mapServerTicketToFrontend,
  mapServerUserToFrontend,
  mergeKnowledgeArticles,
} from './utils/mappers';
import { soundEffects } from './utils/soundEffects';
import type { PrefillTicketDraft } from './components/NewTicketModal';
import type { CustomOsSigners } from './utils/pdfExport';
import { LOGO_PATHS } from './assets/logos';
import { LoginScreen } from './components/LoginScreen';
import type { KbArticle } from './components/KnowledgeBaseManager';
import { WorkspaceModuleSkeleton } from './components/shared/SkeletonLoaders';

const LazyTechnicianDashboard = lazy(() =>
  import('./components/TechnicianDashboard').then((m) => ({
    default: m.TechnicianDashboard,
  }))
);
const LazySelfServicePortal = lazy(() =>
  import('./components/SelfServicePortal').then((m) => ({
    default: m.SelfServicePortal,
  }))
);
const LazyTicketDetailDrawer = lazy(() =>
  import('./components/TicketDetailDrawer').then((m) => ({
    default: m.TicketDetailDrawer,
  }))
);
const LazyItilGovernanceModal = lazy(() =>
  import('./components/ItilGovernanceModal').then((m) => ({
    default: m.ItilGovernanceModal,
  }))
);
const LazyNewTicketModal = lazy(() =>
  import('./components/NewTicketModal').then((m) => ({
    default: m.NewTicketModal,
  }))
);
const LazyFinalizeTicketModal = lazy(() =>
  import('./components/FinalizeTicketModal').then((m) => ({
    default: m.FinalizeTicketModal,
  }))
);
const LazyNotificationToastContainer = lazy(() =>
  import('./components/NotificationToastContainer').then((m) => ({
    default: m.NotificationToastContainer,
  }))
);

const STORAGE_KEY = 'global_desk_tickets_v4';
const OS_STORAGE_KEY = 'global_desk_service_orders_v3';
const USERS_STORAGE_KEY = 'global_desk_users_v1';

const INITIAL_SYSTEM_USERS: SystemUser[] = [
  {
    id: 'usr-alexandre',
    fullName: 'Coordenação de TI',
    email: 'admin@corporativo.com.br',
    role: 'Administrador de TI',
    tier: 'N3',
    department: 'Engenharia & TI',
    isGoogleVerified: true,
    googleAccountDomain:
      (import.meta.env.VITE_WORKSPACE_DOMAIN || 'corporativo.com.br').trim(),
    createdAt: 'Novembro 2024',
    status: 'Ativo',
    avatarInitials: 'AT',
    isSuperAdmin: true,
  },
];

const DEFAULT_FILTERS: TicketFilterState = {
  search: '',
  status: 'Todos',
  priority: 'Todas',
  tier: 'Todos',
  assigneeId: 'Todos',
  type: 'Todos',
};

function resolveIsolatedArea(): 'technician' | 'collaborator' {
  if (typeof window === 'undefined') return 'collaborator';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  if (
    path.startsWith('/tecnico') ||
    path.startsWith('/admin') ||
    hash.includes('tecnico') ||
    search.includes('tecnico')
  ) {
    return 'technician';
  }
  return 'collaborator';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [kbArticles, setKbArticles] = useState<KbArticle[]>([]);

  const isTechRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/tecnico') ||
      window.location.pathname.startsWith('/admin'));

  const [activeView, setActiveView] = useState<'technician' | 'collaborator'>(
    resolveIsolatedArea
  );
  const [activeTechId, setActiveTechId] = useState<TechnicianId>('alexandre');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [prefillTicketDraft, setPrefillTicketDraft] =
    useState<PrefillTicketDraft | null>(null);
  const [ticketToFinalize, setTicketToFinalize] = useState<Ticket | null>(null);
  const [filters, setFilters] = useState<TicketFilterState>(DEFAULT_FILTERS);

  const mergedKnowledgeArticles = useMemo(
    () => mergeKnowledgeArticles(KNOWLEDGE_BASE_ARTICLES, kbArticles),
    [kbArticles]
  );

  const fetchKb = async () => {
    try {
      const list = await api.getKbArticles();
      if (Array.isArray(list)) {
        setKbArticles(list);
      }
    } catch (e) {
      console.error('Erro ao carregar base de conhecimento:', e);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Erro no logout:', e);
    }
    setCurrentUser(null);
  };

  // Redirecionamento automático para Login caso qualquer chamada retorne 401 Unauthorized
  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setSelectedTicketId(null);
    };
    window.addEventListener('globaldesk:unauthorized', handleUnauthorized);
    return () =>
      window.removeEventListener('globaldesk:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    api
      .getCurrentSession()
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
          const isTech = data.user.role !== 'COLABORADOR';
          if (isTech) {
            setActiveView('technician');
            if (!window.location.pathname.startsWith('/tecnico')) {
              window.history.pushState({}, '', '/tecnico');
            }
            if (data.user.email?.includes('elias')) setActiveTechId('elias');
            else if (data.user.email?.includes('mauricio'))
              setActiveTechId('mauricio');
            else if (data.user.email?.includes('alexandre'))
              setActiveTechId('alexandre');
          } else {
            setActiveView('collaborator');
            if (window.location.pathname.startsWith('/tecnico')) {
              window.history.pushState({}, '', '/');
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleOpenNewTicketModal = (draft?: PrefillTicketDraft) => {
    setPrefillTicketDraft(draft || null);
    setIsNewTicketModalOpen(true);
  };

  const [tickets, setTickets] = useState<Ticket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_TICKETS;
  });

  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>(() => {
    try {
      const saved = localStorage.getItem(OS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_SYSTEM_USERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    } catch {
      // ignore storage errors
    }
  }, [tickets]);

  useEffect(() => {
    try {
      localStorage.setItem(OS_STORAGE_KEY, JSON.stringify(serviceOrders));
    } catch {
      // ignore storage errors
    }
  }, [serviceOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(systemUsers));
    } catch {
      // ignore storage errors
    }
  }, [systemUsers]);

  const fetchTicketsAndOrders = useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingTickets(true);
    const isTech = currentUser.role !== 'COLABORADOR';
    try {
      const [serverTickets, serverOrders, serverUsers] = await Promise.all([
        api.getTickets(),
        isTech ? api.getServiceOrders().catch(() => []) : Promise.resolve([]),
        isTech ? api.getUsers().catch(() => []) : Promise.resolve([]),
      ]);

      if (isTech && Array.isArray(serverUsers) && serverUsers.length > 0) {
        setSystemUsers(serverUsers.map(mapServerUserToFrontend));
      }

      if (Array.isArray(serverTickets)) {
        setTickets((prev) => {
          const prevAttachmentsById = new Map(
            prev.map((t) => [t.id, t.attachments])
          );
          return serverTickets.map((raw: any) => {
            const mapped = mapServerTicketToFrontend(raw);
            if (
              mapped.attachments.length === 0 &&
              prevAttachmentsById.has(mapped.id)
            ) {
              return {
                ...mapped,
                attachments: prevAttachmentsById.get(mapped.id) || [],
              };
            }
            return mapped;
          });
        });
      }

      if (isTech && Array.isArray(serverOrders)) {
        setServiceOrders(serverOrders.map(mapServerOrderToFrontend));
      }
    } catch (err) {
      console.error('Falha ao sincronizar tickets/OS:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchTicketsAndOrders();
      fetchKb();
    }
  }, [currentUser?.id, currentUser?.role]);

  const handleToggleUserStatus = async (userId: string) => {
    try {
      const updated = await api.toggleUserStatus(userId);
      setSystemUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                status: updated.status === 'Suspenso' ? 'Suspenso' : 'Ativo',
              }
            : u
        )
      );
    } catch (err) {
      console.error('Erro ao alternar status do usuário:', err);
    }
  };

  const handleAddUser = (newUser: SystemUser, password?: string) => {
    setSystemUsers((prev) => [newUser, ...prev]);
    api
      .createUser({
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        password,
        role: newUser.role,
        tier: newUser.tier,
        department: newUser.department,
        avatarInitials: newUser.avatarInitials,
      })
      .then(() => fetchTicketsAndOrders())
      .catch((err) => console.error('Erro ao criar usuário no backend:', err));
  };

  const handleUpdateUser = (
    userId: string,
    updatedData: Partial<SystemUser> & { password?: string }
  ) => {
    setSystemUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updatedData } : u))
    );
    api
      .updateUser(userId, {
        fullName: updatedData.fullName,
        email: updatedData.email,
        password: updatedData.password,
        role: updatedData.role,
        tier: updatedData.tier,
        department: updatedData.department,
        avatarInitials: updatedData.avatarInitials,
        status: updatedData.status,
      })
      .then(() => fetchTicketsAndOrders())
      .catch((err) =>
        console.error('Erro ao atualizar usuário no backend:', err)
      );
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.deleteUser(userId);
      setSystemUsers((prev) => prev.filter((u) => u.id !== userId));
      fetchTicketsAndOrders();
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      alert(err.message || 'Erro ao excluir usuário');
    }
  };

  useEffect(() => {
    const handleLocationChange = () => {
      setActiveView(resolveIsolatedArea());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    soundEffects.isSoundEnabled()
  );

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEffects.setSoundEnabled(next);
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const addNotification = (
    notif: Omit<SystemNotification, 'id' | 'timestamp'>
  ) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const newNotif: SystemNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: timeStr,
    };

    if (notif.soundType) {
      soundEffects.playNotificationSound(notif.soundType);
    }

    setNotifications((prev) => [newNotif, ...prev.slice(0, 3)]);
  };

  const handleSimulateRealTimeAlert = (type: 'new' | 'escalate' | 'status') => {
    const existingIds = tickets.map((t) => t.id);
    const fallbackProtocols =
      existingIds.length > 0
        ? existingIds
        : ['#TICK-2026-1048', '#TICK-2026-1047', '#TICK-2026-1040'];
    const targetTicketId =
      fallbackProtocols[Math.floor(Math.random() * fallbackProtocols.length)];

    if (type === 'new') {
      addNotification({
        type: 'ticket_created',
        title: `Novo Alerta Operacional: ${targetTicketId}`,
        message:
          'Monitoramento reportou anomalia crítica de latência no barramento corporativo.',
        ticketId: targetTicketId,
        priority: 'Crítica',
        tier: 'N3',
        soundType: 'new_ticket',
      });
    } else if (type === 'escalate') {
      addNotification({
        type: 'ticket_escalated',
        title: 'Chamado Escalonado para Nível 3 (N3)',
        message:
          'Incidente reatribuído para Alexandre (N3 · Resp. Setor) por criticidade sistêmica.',
        ticketId: targetTicketId,
        tier: 'N3',
        priority: 'Crítica',
        soundType: 'escalation',
      });
    } else {
      addNotification({
        type: 'status_changed',
        title: 'Alteração de Status de Atendimento',
        message: `Chamado ${targetTicketId} teve status atualizado por Elias (N1).`,
        ticketId: targetTicketId,
        soundType: 'status_change',
      });
    }
  };

  const activeTechActor =
    TECHNICIANS.find((t) => t.id === activeTechId) || TECHNICIANS[0];

  const selectedTicket =
    tickets.find((t) => t.id === selectedTicketId) || null;

  const handleUpdateFilters = (partial: Partial<TicketFilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleUpdateStatus = (
    ticketId: string,
    newStatus: TicketStatus,
    actorName: string
  ) => {
    const target = tickets.find((t) => t.id === ticketId);

    api
      .updateTicket(ticketId, {
        status: newStatus,
        actorName,
        reason: `Status alterado de "${target?.status || 'anterior'}" para "${newStatus}".`,
      })
      .catch(() => {});

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId || t.status === newStatus) return t;
        const isResolved = newStatus === 'Resolvido';
        const updatedHealth = evaluateSlaHealth(
          t.sla.resolutionRemainingMinutes,
          t.sla.resolutionTargetMinutes,
          isResolved
        );
        return {
          ...t,
          status: newStatus,
          updatedAt: 'Agora',
          sla: {
            ...t.sla,
            health: updatedHealth,
          },
          auditTrail: [
            {
              id: `aud-${Date.now()}`,
              timestamp: 'Agora',
              actor: actorName,
              actionType: 'status_changed',
              description: `Status alterado de "${t.status}" para "${newStatus}".`,
            },
            ...t.auditTrail,
          ],
        };
      })
    );

    addNotification({
      type: 'status_changed',
      title: `Status Atualizado: ${ticketId}`,
      message: `Status do chamado alterado para "${newStatus}" por ${actorName}.`,
      ticketId,
      priority: target?.priority,
      tier: target?.tier,
      soundType: 'status_change',
    });
  };

  const handleBulkUpdateStatus = (
    ticketIds: string[],
    newStatus: TicketStatus
  ) => {
    if (ticketIds.length === 0) return;
    const idSet = new Set(ticketIds);

    Promise.allSettled(
      ticketIds.map((id) =>
        api.updateTicket(id, {
          status: newStatus,
          actorName: activeTechActor.name,
          reason: `Atualização em lote: status alterado para "${newStatus}".`,
        })
      )
    );

    setTickets((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id) || t.status === newStatus) return t;
        const isResolved = newStatus === 'Resolvido';
        return {
          ...t,
          status: newStatus,
          updatedAt: 'Agora',
          sla: {
            ...t.sla,
            health: evaluateSlaHealth(
              t.sla.resolutionRemainingMinutes,
              t.sla.resolutionTargetMinutes,
              isResolved
            ),
          },
          auditTrail: [
            {
              id: `aud-bulk-${Date.now()}-${t.id}`,
              timestamp: 'Agora',
              actor: activeTechActor.name,
              actionType: 'status_changed',
              description: `Atualização em lote: status alterado para "${newStatus}".`,
            },
            ...t.auditTrail,
          ],
        };
      })
    );

    addNotification({
      type: 'status_changed',
      title: `Ação em Lote (${ticketIds.length} chamados)`,
      message: `Status alterado para "${newStatus}" por ${activeTechActor.name}.`,
      soundType: 'status_change',
    });
  };

  const handleBulkAssignTechnician = (
    ticketIds: string[],
    techId: TechnicianId
  ) => {
    if (ticketIds.length === 0) return;
    const targetTech =
      TECHNICIANS.find((t) => t.id === techId) || TECHNICIANS[0];
    const idSet = new Set(ticketIds);

    Promise.allSettled(
      ticketIds.map((id) =>
        api.updateTicket(id, {
          assigneeId: techId,
          tier: targetTech.tier,
          actorName: activeTechActor.name,
          reason: `Reatribuição em lote para ${targetTech.name} (${targetTech.tier}).`,
        })
      )
    );

    setTickets((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id)) return t;
        return {
          ...t,
          assigneeId: techId,
          tier: targetTech.tier,
          updatedAt: 'Agora',
          auditTrail: [
            {
              id: `aud-bulk-assign-${Date.now()}-${t.id}`,
              timestamp: 'Agora',
              actor: activeTechActor.name,
              actionType: 'assigned',
              description: `Reatribuição em lote para ${targetTech.name} (${targetTech.tier}).`,
            },
            ...t.auditTrail,
          ],
        };
      })
    );

    addNotification({
      type: 'ticket_escalated',
      title: `Reatribuição em Lote (${ticketIds.length} chamados)`,
      message: `Chamados atribuídos para ${targetTech.name} (${targetTech.tier}).`,
      tier: targetTech.tier,
      soundType: 'status_change',
    });
  };

  const handleConfirmFinalize = async (data: {
    ticketId: string;
    osNumber: string;
    technicianId: TechnicianId;
    technicianName: string;
    technicianTier: SupportTier;
    startedAt: string;
    finalizedAt: string;
    durationText: string;
    interventionType: InterventionType;
    finalizationOutcome: FinalizationOutcome;
    outcomeLabel: string;
    solutionSummary: string;
    nonCompletionReason?: string;
    partsOrSupplies?: string;
    clientAcceptance: string;
    customSigners?: CustomOsSigners;
  }) => {
    const targetTicket = tickets.find((t) => t.id === data.ticketId);
    if (!targetTicket) return;

    const isSlaMet = targetTicket.sla.resolutionRemainingMinutes >= 0;

    try {
      const createdOrder = await api.finalizeTicket(data.ticketId, {
        technicianId: data.technicianId || activeTechActor.id,
        interventionType: data.interventionType,
        finalizationOutcome: data.finalizationOutcome,
        outcomeLabel: data.outcomeLabel,
        solutionSummary: data.solutionSummary,
        nonCompletionReason: data.nonCompletionReason,
        partsOrSupplies: data.partsOrSupplies,
        clientAcceptance: data.clientAcceptance,
        startedAt: data.startedAt,
        finalizedAt: data.finalizedAt,
        durationText: data.durationText,
        slaMet: isSlaMet,
      });

      const fullOrder: ServiceOrder = {
        id: createdOrder.id,
        ticketId: targetTicket.id,
        ticketTitle: targetTicket.title,
        ticketDescription: targetTicket.description,
        category: targetTicket.category,
        requesterName: targetTicket.requesterName,
        requesterEmail: targetTicket.requesterEmail,
        department: targetTicket.department,
        startedAt: data.startedAt,
        finalizedAt: data.finalizedAt,
        durationText: data.durationText,
        technicianId: data.technicianId,
        technicianName: data.technicianName,
        technicianTier: data.technicianTier,
        interventionType: data.interventionType,
        finalizationOutcome: data.finalizationOutcome,
        outcomeLabel: data.outcomeLabel,
        solutionSummary: data.solutionSummary,
        nonCompletionReason: data.nonCompletionReason,
        partsOrSupplies: data.partsOrSupplies,
        clientAcceptance: data.clientAcceptance,
        slaMet: isSlaMet,
        createdAt: data.finalizedAt,
      };

      setServiceOrders((prev) => [
        fullOrder,
        ...prev.filter((o) => o.id !== fullOrder.id),
      ]);
      setTicketToFinalize(null);
      await fetchTicketsAndOrders();

      const { downloadServiceOrderPdf } = await import('./utils/pdfExport');
      await downloadServiceOrderPdf(fullOrder, data.customSigners);

      addNotification({
        type: 'order_finalized',
        title: `Ordem de Serviço Emitida: ${fullOrder.id}`,
        message: `Chamado ${data.ticketId} encerrado (${data.outcomeLabel}). PDF gerado com sucesso.`,
        ticketId: data.ticketId,
        soundType: 'status_change',
      });
    } catch (err) {
      console.error(
        'Erro ao finalizar chamado na API, aplicando fallback local:',
        err
      );
      const fallbackOrder: ServiceOrder = {
        id: data.osNumber,
        ticketId: targetTicket.id,
        ticketTitle: targetTicket.title,
        ticketDescription: targetTicket.description,
        category: targetTicket.category,
        requesterName: targetTicket.requesterName,
        requesterEmail: targetTicket.requesterEmail,
        department: targetTicket.department,
        startedAt: data.startedAt,
        finalizedAt: data.finalizedAt,
        durationText: data.durationText,
        technicianId: data.technicianId,
        technicianName: data.technicianName,
        technicianTier: data.technicianTier,
        interventionType: data.interventionType,
        finalizationOutcome: data.finalizationOutcome,
        outcomeLabel: data.outcomeLabel,
        solutionSummary: data.solutionSummary,
        nonCompletionReason: data.nonCompletionReason,
        partsOrSupplies: data.partsOrSupplies,
        clientAcceptance: data.clientAcceptance,
        slaMet: isSlaMet,
        createdAt: data.finalizedAt,
      };

      setTickets((prev) =>
        prev.map((t) =>
          t.id === data.ticketId
            ? {
                ...t,
                status: 'Resolvido',
                updatedAt: 'Agora',
                sla: {
                  ...t.sla,
                  health: evaluateSlaHealth(
                    t.sla.resolutionRemainingMinutes,
                    t.sla.resolutionTargetMinutes,
                    true
                  ),
                },
                auditTrail: [
                  {
                    id: `aud-os-${Date.now()}`,
                    timestamp: 'Agora',
                    actor: data.technicianName,
                    actionType: 'order_generated',
                    description: `Ordem de Serviço ${fallbackOrder.id} emitida (${data.outcomeLabel}). Chamado finalizado.`,
                  },
                  ...t.auditTrail,
                ],
              }
            : t
        )
      );
      setServiceOrders((prev) => [
        fallbackOrder,
        ...prev.filter((o) => o.id !== fallbackOrder.id),
      ]);
      setTicketToFinalize(null);
      const { downloadServiceOrderPdf } = await import('./utils/pdfExport');
      await downloadServiceOrderPdf(fallbackOrder, data.customSigners);

      addNotification({
        type: 'order_finalized',
        title: `Ordem de Serviço Emitida: ${fallbackOrder.id}`,
        message: `Chamado ${data.ticketId} encerrado (${data.outcomeLabel}). PDF gerado com sucesso.`,
        ticketId: data.ticketId,
        soundType: 'status_change',
      });
    }
  };

  const handleAssignTechnician = (
    ticketId: string,
    techId: TechnicianId,
    newTier?: SupportTier,
    reason?: string
  ) => {
    const targetTech =
      TECHNICIANS.find((t) => t.id === techId) || TECHNICIANS[0];
    const targetTicket = tickets.find((t) => t.id === ticketId);
    const effectiveTier = newTier || targetTech.tier;

    api
      .updateTicket(ticketId, {
        assigneeId: techId,
        tier: effectiveTier,
        actorName: activeTechActor.name,
        reason: reason || 'Reatribuição direta na interface',
      })
      .catch(() => {});

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        return {
          ...t,
          assigneeId: techId,
          tier: effectiveTier,
          updatedAt: 'Agora',
          auditTrail: [
            {
              id: `aud-${Date.now()}-a`,
              timestamp: 'Agora',
              actor: activeTechActor.name,
              actionType: 'assigned',
              description: `Atribuído para ${targetTech.name} (${effectiveTier})${
                reason ? ` — Motivo: ${reason}` : '.'
              }`,
            },
            ...t.auditTrail,
          ],
        };
      })
    );

    if (newTier && newTier !== targetTicket?.tier) {
      addNotification({
        type: 'ticket_escalated',
        title: `Reatribuição & Escalonamento: ${ticketId}`,
        message: `Atribuído para ${targetTech.name} (${effectiveTier})${
          reason ? ` — Motivo: ${reason}` : '.'
        }`,
        ticketId,
        tier: effectiveTier,
        priority: targetTicket?.priority,
        soundType: 'escalation',
      });
    } else {
      addNotification({
        type: 'status_changed',
        title: `Reatribuição Técnica: ${ticketId}`,
        message: `Atribuído para ${targetTech.name} (${effectiveTier}).`,
        ticketId,
        tier: effectiveTier,
        soundType: 'status_change',
      });
    }
  };

  const handleEscalateTier = (
    ticketId: string,
    targetTier: SupportTier,
    targetTechId: TechnicianId,
    reason: string
  ) => {
    const targetTech =
      TECHNICIANS.find((t) => t.id === targetTechId) || TECHNICIANS[0];
    const targetTicket = tickets.find((t) => t.id === ticketId);

    api
      .updateTicket(ticketId, {
        assigneeId: targetTechId,
        tier: targetTier,
        actorName: activeTechActor.name,
        reason,
      })
      .catch(() => {});

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        return {
          ...t,
          tier: targetTier,
          assigneeId: targetTechId,
          updatedAt: 'Agora',
          auditTrail: [
            {
              id: `aud-${Date.now()}-e`,
              timestamp: 'Agora',
              actor: activeTechActor.name,
              actionType: 'escalated',
              description: `Escalonado para Nível ${targetTier} atribuído a ${targetTech.name}. Parecer: ${reason}`,
            },
            ...t.auditTrail,
          ],
        };
      })
    );

    addNotification({
      type: 'ticket_escalated',
      title: `Chamado Escalonado: ${ticketId} ➔ Nível ${targetTier}`,
      message: `Escalonado para ${targetTech.name} (${targetTier}). Parecer: ${reason}`,
      ticketId,
      tier: targetTier,
      priority: targetTicket?.priority,
      soundType: 'escalation',
    });
  };

  const handleAddNote = async (
    ticketId: string,
    visibility: 'public' | 'internal',
    content: string,
    authorName: string,
    authorRole: string,
    category?: import('./types/itsm').TechnicalNoteCategory,
    targetTechName?: string,
    commandSnippet?: string
  ) => {
    try {
      await api.addNote(ticketId, {
        authorName,
        authorRole,
        visibility: visibility === 'internal' ? 'INTERNAL' : 'PUBLIC',
        category,
        targetTechName,
        commandSnippet,
        content,
      });

      const serverTickets = await api.getTickets();
      if (Array.isArray(serverTickets)) {
        setTickets(serverTickets.map(mapServerTicketToFrontend));
      }

      addNotification({
        type: 'status_changed',
        title:
          visibility === 'internal'
            ? 'Nota Técnica Registada'
            : 'Resposta Enviada',
        message: `Comentário adicionado ao chamado ${ticketId} por ${authorName}.`,
        ticketId,
        soundType: 'status_change',
      });
    } catch (err) {
      console.error(
        'Erro ao gravar nota na API, aplicando fallback local:',
        err
      );
      const fallbackNote = {
        id: `note-${Date.now()}`,
        authorName,
        authorRole,
        visibility,
        category,
        targetTechName,
        commandSnippet,
        content,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                updatedAt: 'Agora',
                notes: [...t.notes, fallbackNote],
                auditTrail: [
                  {
                    id: `aud-note-${Date.now()}`,
                    timestamp: 'Agora',
                    actor: authorName,
                    actionType: 'note_added',
                    description:
                      visibility === 'internal'
                        ? `Nota técnica interna (${category || 'Alinhamento'}) registada.`
                        : 'Resposta pública enviada ao solicitante.',
                  },
                  ...t.auditTrail,
                ],
              }
            : t
        )
      );
    }
  };

  const handleDeleteTicket = (ticketId: string) => {
    api.deleteTicket(ticketId).catch(() => {});
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    if (selectedTicketId === ticketId) {
      setSelectedTicketId(null);
    }
    addNotification({
      type: 'status_changed',
      title: `Chamado Excluído: ${ticketId}`,
      message: `O registro ${ticketId} foi removido por ${activeTechActor.name}.`,
      ticketId,
      soundType: 'status_change',
    });
  };

  const handleCreateTicket = async (data: {
    title: string;
    description: string;
    type: TicketType;
    category: TicketCategory;
    department: Department;
    impact: ImpactLevel;
    urgency: UrgencyLevel;
    attachments: TicketAttachment[];
    requesterName?: string;
    requesterEmail?: string;
  }) => {
    const priority = calculateItilPriority(data.impact, data.urgency);
    const initialSla = buildInitialSlaMetrics(priority);
    const newId = generateNextTicketProtocol(tickets);

    let assignedTech: (typeof TECHNICIANS)[number] = TECHNICIANS[1]; // Elias N1 default
    let assignedTier: SupportTier = 'N1';

    if (priority === 'Crítica') {
      assignedTech = TECHNICIANS[0]; // Alexandre N3
      assignedTier = 'N3';
    } else if (data.category === 'Rede' || data.category === 'Hardware') {
      assignedTech = TECHNICIANS[2]; // Mauricio N2
      assignedTier = 'N2';
    }

    try {
      const created = await api.createTicket({
        title: data.title,
        description: data.description,
        type:
          data.type === 'Requisição de Serviço'
            ? 'REQUISICAO_SERVICO'
            : 'INCIDENTE',
        category: data.category,
        department: data.department,
        impact:
          data.impact === 'Organização'
            ? 'ORGANIZACAO'
            : data.impact === 'Setor'
              ? 'SETOR'
              : 'USUARIO_UNICO',
        urgency:
          data.urgency === 'Crítica'
            ? 'CRITICA'
            : data.urgency === 'Alta'
              ? 'ALTA'
              : data.urgency === 'Média'
                ? 'MEDIA'
                : 'BAIXA',
        requesterName: data.requesterName || currentUser?.name,
        requesterEmail: data.requesterEmail || currentUser?.email,
      });

      if (data.attachments && data.attachments.length > 0) {
        setTickets((prev) => [
          {
            ...mapServerTicketToFrontend(created),
            attachments: data.attachments,
          },
          ...prev.filter((t) => t.id !== created.id),
        ]);
      }

      await fetchTicketsAndOrders();
      setSelectedTicketId(created.id);

      addNotification({
        type: 'ticket_created',
        title: `Novo Chamado Aberto: ${created.id}`,
        message: `${data.title} (${data.department}) · Prioridade ${priority}`,
        ticketId: created.id,
        priority,
        tier: assignedTier,
        soundType: 'new_ticket',
      });
      return;
    } catch (err) {
      console.error(
        'Erro ao submeter chamado à API, salvando localmente:',
        err
      );
    }

    const newTicket: Ticket = {
      id: newId,
      title: data.title,
      description: data.description,
      type: data.type,
      category: data.category,
      channel: 'Portal Web',
      department: data.department,
      requesterName:
        data.requesterName || currentUser?.name || 'Mariana Siqueira',
      requesterEmail:
        data.requesterEmail ||
        currentUser?.email ||
        'mariana.siqueira@corporativo.com.br',
      impact: data.impact,
      urgency: data.urgency,
      priority,
      status: 'Novo',
      tier: assignedTier,
      assigneeId: assignedTech.id,
      createdAt: 'Agora',
      updatedAt: 'Agora',
      sla: initialSla,
      attachments: data.attachments,
      notes: [],
      auditTrail: [
        {
          id: `aud-${Date.now()}-c`,
          timestamp: 'Agora',
          actor: data.requesterName || 'Colaborador Solicitante',
          actionType: 'created',
          description: `Chamado registrado no Global Desk com Prioridade ${priority} (${data.impact} × ${data.urgency}).`,
        },
        {
          id: `aud-${Date.now()}-r`,
          timestamp: 'Agora',
          actor: 'Distribuidor Automático Global Desk',
          actionType: 'assigned',
          description: `Roteamento automático para ${assignedTech.name} (${assignedTier}) com base na especialidade de ${data.category}.`,
        },
      ],
    };

    setTickets((prev) => [newTicket, ...prev]);
    setSelectedTicketId(newTicket.id);

    addNotification({
      type: 'ticket_created',
      title: `Novo Chamado Aberto: ${newId}`,
      message: `${data.title} (${data.department}) · Prioridade ${priority}`,
      ticketId: newId,
      priority,
      tier: assignedTier,
      soundType: 'new_ticket',
    });
  };

  const isTechnicianArea = activeView === 'technician';

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-300 font-medium text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Verificando sessão corporativa...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        initialTab={isTechRoute ? 'technician' : 'collaborator'}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role !== 'COLABORADOR') {
            setActiveView('technician');
            if (!window.location.pathname.startsWith('/tecnico')) {
              window.history.pushState({}, '', '/tecnico');
            }
            if (user.email?.includes('elias')) setActiveTechId('elias');
            else if (user.email?.includes('mauricio'))
              setActiveTechId('mauricio');
            else if (user.email?.includes('alexandre'))
              setActiveTechId('alexandre');
          } else {
            setActiveView('collaborator');
            if (window.location.pathname.startsWith('/tecnico')) {
              window.history.pushState({}, '', '/');
            }
          }
        }}
      />
    );
  }

  // Bloqueio de acesso: colaborador na rota técnica
  if (isTechRoute && currentUser.role === 'COLABORADOR') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-6 h-6 rotate-180" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            Acesso Restrito à Equipe de TI
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
            Sua conta (
            <strong className="text-slate-700">{currentUser.email}</strong>)
            possui perfil de Colaborador e não tem permissão para acessar o
            console técnico.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/');
                setActiveView('collaborator');
              }}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Ir para o Autoatendimento
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      {isTechnicianArea ? (
        <Suspense fallback={<WorkspaceModuleSkeleton />}>
          <LazyTechnicianDashboard
            tickets={tickets}
            technicians={TECHNICIANS}
            systemUsers={systemUsers}
            filters={filters}
            serviceOrders={serviceOrders}
            knowledgeArticles={mergedKnowledgeArticles}
            kbArticles={kbArticles}
            isLoadingTickets={isLoadingTickets}
            onRefreshKb={fetchKb}
            onLogout={handleLogout}
            onUpdateFilters={handleUpdateFilters}
            onResetFilters={handleResetFilters}
            onSelectTicket={(id) => setSelectedTicketId(id)}
            onRequestFinalizeTicket={(ticket) => setTicketToFinalize(ticket)}
            onAssignTechnician={handleAssignTechnician}
            onUpdateStatus={handleUpdateStatus}
            onBulkUpdateStatus={handleBulkUpdateStatus}
            onBulkAssignTechnician={handleBulkAssignTechnician}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onToggleUserStatus={handleToggleUserStatus}
            activeTechActor={activeTechActor}
            onChangeActiveTech={(id) => setActiveTechId(id)}
            onOpenNewTicketModal={() => handleOpenNewTicketModal()}
            onOpenGovernanceModal={() => setIsGovernanceOpen(true)}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            onSimulateAlert={handleSimulateRealTimeAlert}
            onNotify={addNotification}
          />
        </Suspense>
      ) : (
        <>
          {/* Collaborator Area Minimalist Header (Portal do Colaborador Grupo Global) */}
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={LOGO_PATHS.dark}
                  alt="Grupo Global"
                  className="h-8 object-contain"
                />
                <div>
                  <span className="font-bold text-base tracking-tight text-slate-900 leading-none block">
                    Grupo Global
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase block">
                    Central de Ajuda &amp; Autoatendimento
                  </span>
                </div>
              </div>
            </div>

            <nav
              aria-label="Navegação da Central de Ajuda"
              className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium text-slate-600"
            >
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('section-service-catalog')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
              >
                Catálogo de Serviços
              </button>
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('section-knowledge-base')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
              >
                Base de Conhecimento
              </button>
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('section-my-tickets')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
              >
                Meus Chamados ({tickets.length})
              </button>
              <button
                type="button"
                onClick={() => setIsGovernanceOpen(true)}
                className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
              >
                Matriz de SLA
              </button>
            </nav>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenNewTicketModal()}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Enviar Solicitação
              </button>

              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <span
                  className="hidden sm:inline-block text-xs font-semibold text-slate-700 truncate max-w-[140px]"
                  title={currentUser?.name || currentUser?.email}
                >
                  {currentUser?.name || currentUser?.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                  title="Encerrar sessão"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
            <Suspense fallback={<WorkspaceModuleSkeleton />}>
              <LazySelfServicePortal
                articles={mergedKnowledgeArticles}
                tickets={tickets}
                technicians={TECHNICIANS}
                isLoadingTickets={isLoadingTickets}
                onSelectTicket={(id) => setSelectedTicketId(id)}
                onOpenNewTicketModal={handleOpenNewTicketModal}
              />
            </Suspense>
          </main>

          <footer className="border-t border-slate-200/80 bg-white px-6 py-4 mt-12">
            <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <img
                  src={LOGO_PATHS.icon}
                  alt="Grupo Global"
                  className="w-4 h-4 object-contain inline-block"
                />
                Grupo Global Help Center · Portal Corporativo Exclusivo do
                Colaborador
              </span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsGovernanceOpen(true)}
                  className="hover:text-blue-600 transition-colors font-medium"
                >
                  Consultar Matriz de Prioridade &amp; Acordos de Nível de
                  Serviço (SLA)
                </button>
              </div>
            </div>
          </footer>
        </>
      )}

      <Suspense fallback={null}>
        {/* Role-Aware Lateral Ticket Detail Drawer */}
        <LazyTicketDetailDrawer
          ticket={selectedTicket}
          technicians={TECHNICIANS}
          activeTechActor={activeTechActor}
          viewerRole={activeView}
          serviceOrders={serviceOrders}
          onClose={() => setSelectedTicketId(null)}
          onUpdateStatus={handleUpdateStatus}
          onAssignTechnician={handleAssignTechnician}
          onEscalateTier={handleEscalateTier}
          onAddNote={handleAddNote}
          onRequestFinalize={(ticket) => setTicketToFinalize(ticket)}
          onDeleteTicket={handleDeleteTicket}
          isSuperAdmin={activeTechActor.isLead}
        />

        {/* Pop-up Card Inteligente de Abertura de Novo Chamado */}
        <LazyNewTicketModal
          isOpen={isNewTicketModalOpen}
          onClose={() => {
            setIsNewTicketModalOpen(false);
            setPrefillTicketDraft(null);
          }}
          onCreateTicket={handleCreateTicket}
          initialDraft={prefillTicketDraft}
          articles={mergedKnowledgeArticles}
          defaultRequester={
            currentUser
              ? {
                  name: currentUser.name,
                  email: currentUser.email,
                  department: currentUser.department,
                }
              : null
          }
        />

        {/* Pop-up Card de Finalização de Chamado & Emissão de O.S. */}
        <LazyFinalizeTicketModal
          isOpen={ticketToFinalize !== null}
          ticket={ticketToFinalize}
          technicians={TECHNICIANS}
          activeTechActor={activeTechActor}
          nextOsNumber={serviceOrders.length + 1}
          onClose={() => setTicketToFinalize(null)}
          onConfirmFinalize={handleConfirmFinalize}
        />

        {/* SLA & Priority Governance Reference Modal */}
        <LazyItilGovernanceModal
          isOpen={isGovernanceOpen}
          onClose={() => setIsGovernanceOpen(false)}
          technicians={TECHNICIANS}
        />

        {/* Real-time Toast Notifications with Web Audio Chimes */}
        <LazyNotificationToastContainer
          notifications={notifications}
          onDismiss={handleDismissNotification}
          onSelectTicket={(id) => setSelectedTicketId(id)}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
        />
      </Suspense>
    </div>
  );
}
