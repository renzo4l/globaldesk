import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileDown,
  Flame,
  HardDrive,
  Home,
  Inbox,
  Layers,
  Loader2,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  FinalizationOutcome,
  KnowledgeArticle,
  PriorityLevel,
  ServiceOrder,
  SupportTier,
  SystemUser,
  Technician,
  TechnicianId,
  Ticket,
  TicketCategory,
  TicketChannel,
  TicketFilterState,
  TicketStatus,
  ZendeskViewId,
} from '../types/itsm';
import {
  calculateDashboardKpis,
  calculateZendeskViewCounts,
  filterTickets,
  filterTicketsByZendeskView,
  formatMinutesDuration,
  getNextPriorityTicketForPlay,
  getZendeskStatusBadgeMeta,
  SLA_POLICY_BY_PRIORITY,
} from '../utils/itilRules';
import {
  downloadConsolidatedOrdersPdf,
  downloadServiceOrderPdf,
} from '../utils/pdfExport';
import type { KbArticle } from './KnowledgeBaseManager';
import { LOGO_PATHS } from '../assets/logos';
import { useDebounce } from '../utils/useDebounce';
import {
  KpiCardsSkeleton,
  TicketTableSkeleton,
  WorkspaceModuleSkeleton,
} from './shared/SkeletonLoaders';

const LazyServiceOrderViewModal = lazy(() =>
  import('./ServiceOrderViewModal').then((m) => ({
    default: m.ServiceOrderViewModal,
  }))
);
const LazyUserManagementView = lazy(() =>
  import('./UserManagementView').then((m) => ({
    default: m.UserManagementView,
  }))
);
const LazyPerformanceAnalytics = lazy(() =>
  import('./PerformanceAnalytics').then((m) => ({
    default: m.PerformanceAnalytics,
  }))
);
const LazyKnowledgeBaseManager = lazy(() =>
  import('./KnowledgeBaseManager').then((m) => ({
    default: m.KnowledgeBaseManager,
  }))
);
const LazyAssetInventoryTab = lazy(() =>
  import('./AssetInventoryTab').then((m) => ({ default: m.AssetInventoryTab }))
);

export type WorkspaceToolTab =
  | 'home'
  | 'views'
  | 'performance'
  | 'orders'
  | 'kb'
  | 'assets'
  | 'users';

interface ZendeskViewDefinition {
  id: ZendeskViewId;
  label: string;
  shortDescription: string;
  group: 'prioridade' | 'filas_tecnicas' | 'monitoramento';
  isDanger?: boolean;
}

const ZENDESK_VIEWS: ZendeskViewDefinition[] = [
  {
    id: 'critical_unresolved',
    label: 'Incidentes Críticos Não Resolvidos',
    shortDescription: 'Chamados P1 com impacto crítico em aberto na operação',
    group: 'prioridade',
    isDanger: true,
  },
  {
    id: 'assigned_to_me',
    label: 'Atribuídos a Mim (Operador Ativo)',
    shortDescription: 'Fila direta sob responsabilidade do analista logado',
    group: 'prioridade',
  },
  {
    id: 'tier_n1_elias',
    label: 'Fila N1 - Suporte Geral (Elias)',
    shortDescription: 'Triagem inicial, estações de trabalho, MFA e acessos',
    group: 'filas_tecnicas',
  },
  {
    id: 'tier_n2_mauricio',
    label: 'Fila N2 - Infraestrutura & Redes (Mauricio)',
    shortDescription: 'Conectividade BGP/IPsec, switches PoE, servidores e storage',
    group: 'filas_tecnicas',
  },
  {
    id: 'tier_n3_alexandre',
    label: 'Fila N3 - Sistemas & Setor (Alexandre)',
    shortDescription: 'Coordenação técnica, ERP SAP S/4HANA, clusters e arquitetura',
    group: 'filas_tecnicas',
  },
  {
    id: 'pending_requester',
    label: 'Aguardando Resposta do Solicitante',
    shortDescription: 'Tickets pendentes de validação ou janela do colaborador',
    group: 'monitoramento',
  },
  {
    id: 'sla_at_risk',
    label: 'SLA Expirando em Breve / Risco de Quebra',
    shortDescription: 'Chamados com meta de resolução próxima do limite ou violada',
    group: 'monitoramento',
    isDanger: true,
  },
  {
    id: 'recently_resolved',
    label: 'Chamados Resolvidos Recentemente',
    shortDescription: 'Histórico de atendimentos concluídos pela equipe técnica',
    group: 'monitoramento',
  },
  {
    id: 'service_orders',
    label: 'Ordens de Serviço Emitidas',
    shortDescription: 'Documentos formais de O.S. arquivados no Global Desk',
    group: 'monitoramento',
  },
];

type SortColumn = 'status' | 'id' | 'title' | 'requester' | 'createdAt' | 'priority' | 'sla';

const renderZendeskStatusSquare = (status: TicketStatus) => {
  const meta = getZendeskStatusBadgeMeta(status);
  return (
    <span
      title={`Status: ${meta.label} (${meta.englishCode})`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-xs text-[11px] font-bold font-mono border shadow-2xs select-none shrink-0 ${meta.bgClass}`}
    >
      {meta.letter}
    </span>
  );
};

const renderChannelBadge = (channel?: TicketChannel) => {
  const ch = channel || 'Portal Web';
  const styles: Record<TicketChannel, string> = {
    'Portal Web': 'bg-slate-100 text-slate-700 border-slate-200',
    'E-mail': 'bg-blue-50 text-blue-700 border-blue-200',
    'Chat Interno': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Sistema: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${styles[ch]}`}
    >
      {ch}
    </span>
  );
};

const renderSlaAndPriorityCell = (ticket: Ticket) => {
  const rem = ticket.sla.resolutionRemainingMinutes;
  const pCode = SLA_POLICY_BY_PRIORITY[ticket.priority].code;

  const priorityColors: Record<PriorityLevel, string> = {
    Crítica: 'bg-red-100 text-red-800 border-red-300',
    Alta: 'bg-amber-100 text-amber-900 border-amber-300',
    Média: 'bg-blue-50 text-blue-700 border-blue-200',
    Baixa: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span
        title={`Prioridade ${ticket.priority} (${pCode})`}
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${priorityColors[ticket.priority]}`}
      >
        {pCode}
      </span>

      {ticket.status === 'Resolvido' ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-emerald-700">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          OK
        </span>
      ) : ticket.sla.health === 'breached' ? (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-mono font-semibold">
          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
          {formatMinutesDuration(rem)}
        </span>
      ) : ticket.sla.health === 'expiring_soon' ? (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-semibold">
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          {formatMinutesDuration(rem)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-600">
          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
          {formatMinutesDuration(rem)}
        </span>
      )}
    </div>
  );
};

interface TicketTableRowProps {
  ticket: Ticket;
  isSelected: boolean;
  technicians: Technician[];
  onToggleSelect: (ticketId: string) => void;
  onSelectTicket: (ticketId: string) => void;
  onAssignTechnician: (
    ticketId: string,
    techId: TechnicianId,
    newTier?: SupportTier,
    reason?: string
  ) => void;
  onRequestFinalizeTicket?: (ticket: Ticket) => void;
  onMouseEnterSubject: (ticket: Ticket, e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeaveSubject: () => void;
}

const TicketTableRow: React.FC<TicketTableRowProps> = React.memo(
  ({
    ticket,
    isSelected,
    technicians,
    onToggleSelect,
    onSelectTicket,
    onAssignTechnician,
    onRequestFinalizeTicket,
    onMouseEnterSubject,
    onMouseLeaveSubject,
  }) => {
    const internalCount = useMemo(
      () => ticket.notes.filter((n) => n.visibility === 'internal').length,
      [ticket.notes]
    );

    return (
      <tr
        className={`group transition-all duration-150 ${
          isSelected
            ? 'bg-blue-50/70 hover:bg-blue-50'
            : 'hover:bg-slate-50/90'
        }`}
      >
        <td className="py-2 pl-3 pr-1.5 align-middle">
          <input
            type="checkbox"
            aria-label={`Selecionar chamado ${ticket.id}`}
            checked={isSelected}
            onChange={() => onToggleSelect(ticket.id)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </td>

        <td className="py-2 px-1.5 align-middle">
          {renderZendeskStatusSquare(ticket.status)}
        </td>

        <td className="py-2 px-1.5 align-middle whitespace-nowrap">
          <button
            type="button"
            onClick={() => onSelectTicket(ticket.id)}
            className="font-mono text-[11px] font-bold text-slate-700 hover:text-blue-600 active:scale-[0.98] transition-all duration-150"
          >
            {ticket.id}
          </button>
        </td>

        <td className="py-2 px-2 align-middle max-w-[205px] xl:max-w-[235px]">
          <div
            onMouseEnter={(e) => onMouseEnterSubject(ticket, e)}
            onMouseLeave={onMouseLeaveSubject}
            className="space-y-0.5"
          >
            <button
              type="button"
              onClick={() => onSelectTicket(ticket.id)}
              className="font-semibold text-slate-900 group-hover:text-blue-600 hover:underline text-left line-clamp-1 block w-full"
            >
              {ticket.title}
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="truncate max-w-[155px] xl:max-w-[180px]">
                {ticket.description}
              </span>
              {internalCount > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold shrink-0">
                  <MessageSquare className="w-2.5 h-2.5" />
                  {internalCount}
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="py-2 px-1.5 align-middle whitespace-nowrap">
          {renderChannelBadge(ticket.channel)}
        </td>

        <td className="py-2 px-1.5 align-middle whitespace-nowrap">
          <span className="text-slate-700 font-medium text-[11px] block leading-tight">
            {ticket.category}
          </span>
          <span className="block text-[10px] text-slate-400 leading-tight">
            {ticket.type}
          </span>
        </td>

        <td className="py-2 px-1.5 align-middle whitespace-nowrap max-w-[135px]">
          <span className="font-semibold text-slate-800 text-[11px] truncate block leading-tight">
            {ticket.requesterName}
          </span>
          <span className="text-[10px] text-slate-500 truncate block leading-tight">
            {ticket.department}
          </span>
        </td>

        <td className="py-2 px-1.5 align-middle whitespace-nowrap font-mono text-[10px] text-slate-600">
          {ticket.createdAt}
        </td>

        <td className="py-2 px-1.5 align-middle whitespace-nowrap">
          <div className="flex items-center gap-1">
            <select
              aria-label={`Atribuir responsável para ${ticket.id}`}
              value={ticket.assigneeId}
              onChange={(e) =>
                onAssignTechnician(ticket.id, e.target.value as TechnicianId)
              }
              className="px-1.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:border-blue-400 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
            >
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name} ({tech.tier})
                </option>
              ))}
            </select>
          </div>
        </td>

        <td className="py-2 pl-1.5 pr-3 align-middle whitespace-nowrap text-right">
          <div className="flex items-center justify-end gap-1.5">
            {renderSlaAndPriorityCell(ticket)}
            {ticket.status !== 'Resolvido' && onRequestFinalizeTicket && (
              <button
                type="button"
                onClick={() => onRequestFinalizeTicket(ticket)}
                title="Finalizar chamado e emitir Ordem de Serviço (O.S.)"
                className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-600 hover:text-white active:scale-[0.98] transition-all duration-150"
              >
                O.S.
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }
);
TicketTableRow.displayName = 'TicketTableRow';

interface TechnicianDashboardProps {
  tickets: Ticket[];
  technicians: Technician[];
  systemUsers: SystemUser[];
  filters: TicketFilterState;
  serviceOrders: ServiceOrder[];
  knowledgeArticles: KnowledgeArticle[];
  kbArticles?: KbArticle[];
  isLoadingTickets?: boolean;
  onRefreshKb?: () => void;
  onLogout?: () => void;
  onUpdateFilters: (partial: Partial<TicketFilterState>) => void;
  onResetFilters: () => void;
  onSelectTicket: (ticketId: string) => void;
  onRequestFinalizeTicket?: (ticket: Ticket) => void;
  onAssignTechnician: (
    ticketId: string,
    techId: TechnicianId,
    newTier?: SupportTier,
    reason?: string
  ) => void;
  onUpdateStatus: (
    ticketId: string,
    newStatus: TicketStatus,
    actorName: string
  ) => void;
  onBulkUpdateStatus: (ticketIds: string[], newStatus: TicketStatus) => void;
  onBulkAssignTechnician: (ticketIds: string[], techId: TechnicianId) => void;
  onAddUser: (newUser: SystemUser, password?: string) => void;
  onUpdateUser?: (userId: string, updatedData: Partial<SystemUser> & { password?: string }) => void;
  onDeleteUser?: (userId: string) => void;
  onToggleUserStatus?: (userId: string) => void;
  activeTechActor: Technician;
  onChangeActiveTech?: (techId: TechnicianId) => void;
  onOpenNewTicketModal: () => void;
  onOpenGovernanceModal: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSimulateAlert: (type: 'new' | 'escalate' | 'status') => void;
  onNotify?: (notif: {
    type: 'status_changed' | 'order_finalized';
    title: string;
    message: string;
    soundType?: 'new_ticket' | 'escalation' | 'status_change';
  }) => void;
}

export const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({
  tickets,
  technicians,
  systemUsers = [],
  filters,
  serviceOrders = [],
  knowledgeArticles = [],
  kbArticles = [],
  isLoadingTickets = false,
  onRefreshKb = () => {},
  onLogout,
  onUpdateFilters,
  onResetFilters,
  onSelectTicket,
  onRequestFinalizeTicket,
  onAssignTechnician,
  onUpdateStatus,
  onBulkUpdateStatus,
  onBulkAssignTechnician,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus,
  activeTechActor,
  onChangeActiveTech,
  onOpenNewTicketModal,
  onOpenGovernanceModal,
  soundEnabled,
  onToggleSound,
  onSimulateAlert,
  onNotify,
}) => {
  // Active tool in Left Navigation Dock (Views / Fila de Tickets is active by default)
  const [activeTool, setActiveTool] = useState<WorkspaceToolTab>('views');
  // Active View inside the Collapsible Views Sidebar
  const [activeViewId, setActiveViewId] = useState<ZendeskViewId>('tier_n3_alexandre');
  const [isViewsPanelOpen, setIsViewsPanelOpen] = useState<boolean>(true);
  const [isRefreshingViews, setIsRefreshingViews] = useState<boolean>(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('Agora');

  // Bulk selection state
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    if (isAvatarMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarMenuOpen]);

  // Sorting & Pagination state for High-Density Table
  const [sortCol, setSortCol] = useState<SortColumn>('sla');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Hover Preview Popover state
  const [hoveredTicket, setHoveredTicket] = useState<{
    ticket: Ticket;
    top: number;
    left: number;
  } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Service Orders (O.S.) filter & PDF export state
  const [selectedOrderForView, setSelectedOrderForView] = useState<ServiceOrder | null>(null);
  const [osNumberSearch, setOsNumberSearch] = useState('');
  const [osGeneralSearch, setOsGeneralSearch] = useState('');
  const debouncedTicketSearch = useDebounce(filters.search, 220);
  const debouncedOsNumberSearch = useDebounce(osNumberSearch, 220);
  const debouncedOsGeneralSearch = useDebounce(osGeneralSearch, 220);
  const [osOutcomeFilter, setOsOutcomeFilter] = useState<FinalizationOutcome | 'Todos'>('Todos');
  const [exportingOsId, setExportingOsId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{
    message: string;
    type: 'info' | 'success' | 'error';
  } | null>(null);

  // Global search input ref for Ctrl+K shortcut
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Default view shows all unresolved or critical/assigned tickets clearly; let's initialize to 'critical_unresolved' or allow 'all' via filter
  const [showAllInView, setShowAllInView] = useState<boolean>(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clear selection when changing view
  const handleSelectZendeskView = (viewId: ZendeskViewId) => {
    setSelectedTicketIds([]);
    setCurrentPage(1);
    setShowAllInView(false);
    setActiveViewId(viewId);
    if (viewId === 'service_orders') {
      setActiveTool('orders');
    } else {
      setActiveTool('views');
    }
  };

  const handleRefreshViews = () => {
    setIsRefreshingViews(true);
    const now = new Date();
    const formatted = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setTimeout(() => {
      setIsRefreshingViews(false);
      setLastRefreshedTime(formatted);
    }, 350);
  };

  // Next Ticket Routing ("Reproduzir Fila / Play")
  const handlePlayNextTicket = () => {
    const nextTicket = getNextPriorityTicketForPlay(tickets);
    if (nextTicket) {
      onSelectTicket(nextTicket.id);
    }
  };

  // Computed KPIs and View Counts
  const kpis = useMemo(() => calculateDashboardKpis(tickets), [tickets]);

  const viewCounts = useMemo(
    () =>
      calculateZendeskViewCounts(
        tickets,
        activeTechActor.id,
        serviceOrders.length
      ),
    [tickets, activeTechActor.id, serviceOrders.length]
  );

  // Tickets filtered by active Zendesk View + topbar/inline filters (with debounced search)
  const debouncedFilters = useMemo(
    () => ({ ...filters, search: debouncedTicketSearch }),
    [filters, debouncedTicketSearch]
  );

  const viewFilteredTickets = useMemo(() => {
    const baseList = showAllInView
      ? tickets
      : filterTicketsByZendeskView(tickets, activeViewId, activeTechActor.id);
    return filterTickets(baseList, debouncedFilters);
  }, [tickets, showAllInView, activeViewId, activeTechActor.id, debouncedFilters]);

  // Sorted tickets for High-Density Table
  const sortedTickets = useMemo(() => {
    const priorityRank: Record<PriorityLevel, number> = {
      Crítica: 1,
      Alta: 2,
      Média: 3,
      Baixa: 4,
    };
    const statusRank: Record<TicketStatus, number> = {
      Novo: 1,
      'Em Atendimento': 2,
      'Aguardando Usuário': 3,
      Resolvido: 4,
    };

    const copy = [...viewFilteredTickets];
    copy.sort((a, b) => {
      let comparison = 0;
      switch (sortCol) {
        case 'status':
          comparison = statusRank[a.status] - statusRank[b.status];
          break;
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'requester':
          comparison = a.requesterName.localeCompare(b.requesterName);
          break;
        case 'createdAt':
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
        case 'priority':
          comparison = priorityRank[a.priority] - priorityRank[b.priority];
          break;
        case 'sla':
          comparison =
            a.sla.resolutionRemainingMinutes - b.sla.resolutionRemainingMinutes;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
    return copy;
  }, [viewFilteredTickets, sortCol, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / pageSize));
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTickets.slice(start, start + pageSize);
  }, [sortedTickets, currentPage]);

  const handleSortColumn = (col: SortColumn) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  // Bulk Selection Handlers
  const allVisibleSelected =
    paginatedTickets.length > 0 &&
    paginatedTickets.every((t) => selectedTicketIds.includes(t.id));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedTicketIds((prev) =>
        prev.filter((id) => !paginatedTickets.some((t) => t.id === id))
      );
    } else {
      const visibleIds = paginatedTickets.map((t) => t.id);
      setSelectedTicketIds((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    }
  };

  const handleToggleSelectTicket = useCallback((ticketId: string) => {
    setSelectedTicketIds((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  }, []);

  // Hover Preview Popover handlers
  const handleMouseEnterSubject = useCallback(
    (ticket: Ticket, e: React.MouseEvent<HTMLElement>) => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const popoverHeightEstimate = 270;
      const top =
        rect.bottom + popoverHeightEstimate > viewportHeight
          ? Math.max(16, rect.top - popoverHeightEstimate - 6)
          : rect.bottom + 6;
      const left = Math.min(window.innerWidth - 460, Math.max(72, rect.left));

      setHoveredTicket({ ticket, top, left });
    },
    []
  );

  const handleMouseLeaveSubject = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredTicket(null);
    }, 180);
  }, []);

  const handleMouseEnterPopover = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleMouseLeavePopover = () => {
    setHoveredTicket(null);
  };

  // Filtered Service Orders (with debounced search)
  const filteredOrders = useMemo(() => {
    return serviceOrders.filter((order) => {
      if (debouncedOsNumberSearch.trim()) {
        const osQuery = debouncedOsNumberSearch.toLowerCase().trim();
        if (!order.id.toLowerCase().includes(osQuery)) return false;
      }
      if (osOutcomeFilter !== 'Todos') {
        if (order.finalizationOutcome !== osOutcomeFilter) return false;
      }
      if (debouncedOsGeneralSearch.trim()) {
        const gQuery = debouncedOsGeneralSearch.toLowerCase().trim();
        const matchesGeneral =
          order.ticketId.toLowerCase().includes(gQuery) ||
          order.requesterName.toLowerCase().includes(gQuery) ||
          order.technicianName.toLowerCase().includes(gQuery) ||
          order.ticketTitle.toLowerCase().includes(gQuery) ||
          order.department.toLowerCase().includes(gQuery);
        if (!matchesGeneral) return false;
      }
      return true;
    });
  }, [
    serviceOrders,
    debouncedOsNumberSearch,
    osOutcomeFilter,
    debouncedOsGeneralSearch,
  ]);

  const handleExportPdf = (order: ServiceOrder) => {
    setExportingOsId(order.id);
    setExportStatus({
      message: `Simulando e gerando documento PDF formatado da O.S. ${order.id}...`,
      type: 'info',
    });

    setTimeout(() => {
      try {
        downloadServiceOrderPdf(order);
        setExportStatus({
          message: `Ordem de Serviço ${order.id} exportada com sucesso em PDF oficial!`,
          type: 'success',
        });
      } catch {
        setExportStatus({
          message: `Não foi possível gerar o PDF da O.S. ${order.id}.`,
          type: 'error',
        });
      } finally {
        setExportingOsId(null);
        setTimeout(() => setExportStatus(null), 4500);
      }
    }, 500);
  };

  const handleExportConsolidatedPdf = () => {
    if (filteredOrders.length === 0) return;
    setExportingOsId('consolidated');
    setExportStatus({
      message: `Compilando e gerando relatório PDF consolidado (${filteredOrders.length} registros)...`,
      type: 'info',
    });

    setTimeout(() => {
      try {
        downloadConsolidatedOrdersPdf(filteredOrders);
        setExportStatus({
          message: `Relatório consolidado com ${filteredOrders.length} O.S. exportado com sucesso!`,
          type: 'success',
        });
      } catch {
        setExportStatus({
          message: 'Erro ao gerar relatório consolidado em PDF.',
          type: 'error',
        });
      } finally {
        setExportingOsId(null);
        setTimeout(() => setExportStatus(null), 4500);
      }
    }, 600);
  };

  const activeViewMeta =
    ZENDESK_VIEWS.find((v) => v.id === activeViewId) || ZENDESK_VIEWS[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-900 select-none sm:select-auto">
      {/* =====================================================================
          ZONE A: GLOBAL LEFT NAVIGATION DOCK (Corporate Blue Console Dock)
         ===================================================================== */}
      <aside
        aria-label="Barra Lateral Global de Navegação Grupo Global"
        className="w-14 bg-blue-950 text-blue-100 flex flex-col items-center justify-between py-3 shrink-0 z-30 border-r border-blue-900"
      >
        {/* Top Brand & Primary Tool Icons */}
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => {
              setActiveTool('views');
              setShowAllInView(true);
            }}
            title="Grupo Global · Support Agent Workspace"
            className="w-10 h-10 rounded-lg bg-blue-900 hover:bg-blue-800 p-1 flex items-center justify-center transition-all mb-2 border border-blue-800 shadow-sm group"
          >
            <img src={LOGO_PATHS.icon} alt="Grupo Global" className="w-8 h-8 object-contain transition-transform group-hover:scale-105" />
          </button>

          {/* 1. Home / Dashboard de Métricas */}
          <button
            type="button"
            onClick={() => setActiveTool('home')}
            title="Home / Dashboard de Métricas e KPIs"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'home'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {activeTool === 'home' && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-400 rounded-r" />
            )}
            <Home className="w-4 h-4" />
          </button>

          {/* 2. Views / Fila de Tickets (Ativo por padrão) */}
          <button
            type="button"
            onClick={() => setActiveTool('views')}
            title="Views / Fila Operacional de Tickets"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'views'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {activeTool === 'views' && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-400 rounded-r" />
            )}
            <Inbox className="w-4 h-4" />
            {kpis.totalOpenTickets > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-[9px] font-mono font-bold text-white flex items-center justify-center">
                {kpis.totalOpenTickets}
              </span>
            )}
          </button>

          {/* 3. Relatórios / Performance Analytics */}
          <button
            type="button"
            onClick={() => setActiveTool('performance')}
            title="Relatórios & Performance Analytics (Recharts)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'performance'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {activeTool === 'performance' && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-400 rounded-r" />
            )}
            <BarChart3 className="w-4 h-4" />
          </button>

          {/* 4. Gestão de Ordens de Serviço (O.S.) */}
          <button
            type="button"
            onClick={() => setActiveTool('orders')}
            title="Gestão de Ordens de Serviço (O.S.)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'orders'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {activeTool === 'orders' && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-400 rounded-r" />
            )}
            <FileCheck className="w-4 h-4" />
            {serviceOrders.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-600 text-[9px] font-mono font-bold text-white flex items-center justify-center">
                {serviceOrders.length}
              </span>
            )}
          </button>

          {/* 5. Base de Conhecimento Interna */}
          <button
            type="button"
            onClick={() => setActiveTool('kb')}
            title="Base de Conhecimento Interna & Runbooks"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'kb'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {activeTool === 'kb' && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-400 rounded-r" />
            )}
            <BookOpen className="w-4 h-4" />
          </button>

          {/* 6. Gestão de Inventário & Ativos de TI (CMDB) */}
          <button
            type="button"
            onClick={() => setActiveTool('assets')}
            title="Inventário & Ativos de TI (CMDB / Patrimônio)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'assets'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {activeTool === 'assets' && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-400 rounded-r" />
            )}
            <HardDrive className="w-4 h-4" />
          </button>

          {/* 7. Gestão de Usuários */}
          <button
            type="button"
            onClick={() => setActiveTool('users')}
            title="Gestão de Usuários e Credenciais Corporativas"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'users'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {activeTool === 'users' && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-400 rounded-r" />
            )}
            <Users className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Dock Footer: Governance + Active Technician Avatar with Online Status */}
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            type="button"
            onClick={onOpenGovernanceModal}
            title="Matriz de Prioridade e Governança de SLA"
            className="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>

          {/* Active Operator Avatar & Online Badge */}
          <div
            ref={avatarMenuRef}
            className="relative"
            title={`Operador Ativo: ${activeTechActor.name} (${activeTechActor.tier}) · Status: Online`}
          >
            <button
              type="button"
              onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center border-2 border-slate-700 hover:border-blue-400 transition-colors cursor-pointer"
            >
              {activeTechActor.avatarInitials}
            </button>
            <span
              aria-label="Status Online"
              className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#172B2D] absolute -bottom-0.5 -right-0.5"
            />

            {/* Menu Popover do Avatar: Sair / Alternar */}
            {isAvatarMenuOpen && (
              <div className="absolute left-12 bottom-0 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900 truncate">{activeTechActor.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{activeTechActor.tier} · TI Grupo Global</div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool('users');
                      setIsAvatarMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Gestão de Usuários</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenGovernanceModal();
                      setIsAvatarMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Governança &amp; SLA</span>
                  </button>
                </div>

                {onLogout && (
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Sair da Conta (Logout)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT WORKSPACE CONTAINER (Global Topbar + Views Sidebar + Main Zone)
         ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ===================================================================
            ZONE B: BARRA DE AÇÕES SUPERIOR (GLOBAL TOPBAR)
           =================================================================== */}
        <header
          aria-label="Barra de Ações Superior do Agent Workspace"
          className="h-13 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shrink-0 z-20"
        >
          {/* Left: Workspace Title, Collapse Toggle & "+ Novo Chamado" (+ Add Zendesk style) */}
          <div className="flex items-center gap-2.5">
            {activeTool === 'views' && (
              <button
                type="button"
                onClick={() => setIsViewsPanelOpen(!isViewsPanelOpen)}
                title={
                  isViewsPanelOpen
                    ? 'Recolher painel de Visualizações (Views)'
                    : 'Expandir painel de Visualizações (Views)'
                }
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                {isViewsPanelOpen ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2.5 pr-2 border-r border-slate-200">
              <img
                src={LOGO_PATHS.white}
                alt="Grupo Global"
                className="h-6 object-contain bg-blue-700 px-2 py-0.5 rounded shadow-2xs"
              />
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Agent Workspace
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenNewTicketModal}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Novo Chamado</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool(activeTool === 'assets' ? 'views' : 'assets')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap border cursor-pointer ${
                activeTool === 'assets'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-blue-50/70 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              <HardDrive className={`w-3.5 h-3.5 ${activeTool === 'assets' ? 'text-white' : 'text-blue-600'}`} />
              <span>Inventário &amp; Ativos</span>
            </button>
          </div>

          {/* Center: Global Quick Search with Ctrl + K shortcut */}
          <div className="flex-1 max-w-md">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={globalSearchInputRef}
                id="global-desk-search"
                type="text"
                aria-label="Pesquisa rápida global de chamados"
                value={filters.search}
                onChange={(e) => {
                  onUpdateFilters({ search: e.target.value });
                  if (activeTool !== 'views') setActiveTool('views');
                }}
                className="w-full pl-8 pr-16 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
              {filters.search ? (
                <button
                  type="button"
                  onClick={() => onUpdateFilters({ search: '' })}
                  className="absolute right-2 text-slate-400 hover:text-slate-700 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 rounded absolute right-2 pointer-events-none">
                  Ctrl + K
                </kbd>
              )}
            </div>
          </div>

          {/* Right: Play Queue Routing, Status Counters, Active Analyst Switcher & Notifications */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Real-time status counter pills */}
            <div className="hidden xl:flex items-center gap-1.5 mr-1">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-semibold bg-red-50 text-red-700 border border-red-200">
                <Flame className="w-3 h-3 text-red-600" />
                P1: {kpis.criticalOpenCount}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                SLA: {kpis.slaCompliancePercent}%
              </span>
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              title={
                soundEnabled
                  ? 'Alertas sonoros ativos (clique para silenciar)'
                  : 'Alertas sonoros silenciados (clique para ativar)'
              }
              className={`p-1.5 rounded-md border transition-colors ${
                soundEnabled
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Test Notification Button */}
            <button
              type="button"
              onClick={() => onSimulateAlert('new')}
              title="Simular notificação de chamado em tempo real"
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-blue-600" />
            </button>

            {/* "Reproduzir Fila / Play" Button (Next Ticket Routing) */}
            <button
              type="button"
              onClick={handlePlayNextTicket}
              title="Puxar automaticamente o próximo chamado prioritário não resolvido da fila (Next Ticket Routing)"
              className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-300 rounded-md transition-colors inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              <span>Reproduzir Fila</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Encerrar sessão técnica"
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* ===================================================================
            MAIN 2-COLUMN WORKSPACE BODY (Collapsible Views + Operational Zone)
           =================================================================== */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* =================================================================
              ZONE C: PAINEL DE VISUALIZAÇÕES FILTRADAS ("VIEWS" - COLUNA ESQUERDA)
             ================================================================= */}
          {activeTool === 'views' && isViewsPanelOpen && (
            <aside
              aria-label="Painel de Visualizações Filtradas (Views)"
              className="w-60 bg-slate-50/90 border-r border-slate-200 flex flex-col shrink-0 h-full overflow-hidden animate-in slide-in-from-left duration-150"
            >
              {/* Views Header */}
              <div className="px-3.5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Visualizações (Views)
                  </h2>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Sincronizado: {lastRefreshedTime}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleRefreshViews}
                    title="Atualizar contadores das visualizações"
                    className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        isRefreshingViews ? 'animate-spin text-blue-600' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Hierarchical Views List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* All Tickets Overview Option */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTicketIds([]);
                      setCurrentPage(1);
                      setShowAllInView(true);
                    }}
                    className={`w-full px-2.5 py-2 rounded-md text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                      showAllInView
                        ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-200/70 font-medium'
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span>Todos os Chamados da Fila</span>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                        showAllInView
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tickets.length}
                    </span>
                  </button>
                </div>

                {/* Group 1: Triagem Prioritária & Operador */}
                <div className="space-y-1">
                  <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Foco Operacional
                  </div>
                  {ZENDESK_VIEWS.filter((v) => v.group === 'prioridade').map(
                    (view) => {
                      const isActive =
                        !showAllInView && activeViewId === view.id;
                      const count = viewCounts[view.id];
                      return (
                        <button
                          key={view.id}
                          type="button"
                          onClick={() => handleSelectZendeskView(view.id)}
                          className={`w-full px-2.5 py-2 rounded-md text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                              : 'text-slate-700 hover:bg-slate-200/70 font-medium'
                          }`}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            {view.isDanger && (
                              <Flame
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isActive ? 'text-white' : 'text-red-600'
                                }`}
                              />
                            )}
                            <span className="truncate">{view.label}</span>
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 ${
                              isActive
                                ? 'bg-blue-700 text-white'
                                : view.isDanger && count > 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Group 2: Filas por Nível e Analista (Elias N1, Mauricio N2, Alexandre N3) */}
                <div className="space-y-1">
                  <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Filas por Especialista (N1 / N2 / N3)
                  </div>
                  {ZENDESK_VIEWS.filter(
                    (v) => v.group === 'filas_tecnicas'
                  ).map((view) => {
                    const isActive =
                      !showAllInView && activeViewId === view.id;
                    const count = viewCounts[view.id];
                    return (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => handleSelectZendeskView(view.id)}
                        className={`w-full px-2.5 py-2 rounded-md text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-200/70 font-medium'
                        }`}
                      >
                        <span className="truncate">{view.label}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 ${
                            isActive
                              ? 'bg-blue-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Group 3: Acompanhamento de SLA, Pendentes, Resolvidos e O.S. */}
                <div className="space-y-1">
                  <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Controle de SLA &amp; Encerramento
                  </div>
                  {ZENDESK_VIEWS.filter((v) => v.group === 'monitoramento').map(
                    (view) => {
                      const isActive =
                        !showAllInView && activeViewId === view.id;
                      const count = viewCounts[view.id];
                      return (
                        <button
                          key={view.id}
                          type="button"
                          onClick={() => handleSelectZendeskView(view.id)}
                          className={`w-full px-2.5 py-2 rounded-md text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                              : 'text-slate-700 hover:bg-slate-200/70 font-medium'
                          }`}
                        >
                          <span className="truncate">{view.label}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 ${
                              isActive
                                ? 'bg-blue-700 text-white'
                                : view.isDanger && count > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Views Footer Legend for Zendesk Status Squares */}
              <div className="p-3 border-t border-slate-200 bg-white space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Legenda de Status de Chamados
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    {renderZendeskStatusSquare('Novo')}
                    <span className="truncate">Novo (New)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {renderZendeskStatusSquare('Em Atendimento')}
                    <span className="truncate">Aberto (Open)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {renderZendeskStatusSquare('Aguardando Usuário')}
                    <span className="truncate">Pendente</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {renderZendeskStatusSquare('Resolvido')}
                    <span className="truncate">Resolvido</span>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* =================================================================
              ZONE D: MAIN OPERATIONAL VIEWPORT (High-Density Queue or Active Tool)
             ================================================================= */}
          <main className="flex-1 flex flex-col min-w-0 h-full bg-white overflow-hidden">
            {/* TOOL 1: FILA DE TICKETS OPERACIONAL (DEFAULT ZENDESK TABLE) */}
            {activeTool === 'views' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-tab-switch">
                {/* Active View Header & Inline Filters */}
                <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex flex-col gap-3 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h1 className="text-base font-bold text-slate-900 tracking-tight">
                          {showAllInView
                            ? 'Todos os Chamados da Fila Corporativa'
                            : activeViewMeta.label}
                        </h1>
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {sortedTickets.length}{' '}
                          {sortedTickets.length === 1 ? 'ticket' : 'tickets'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {showAllInView
                          ? 'Visão consolidada de todos os chamados atribuídos entre Elias (N1), Mauricio (N2) e Alexandre (N3).'
                          : activeViewMeta.shortDescription}
                      </p>
                    </div>

                    {/* Quick Filter Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Filtrar por Status"
                        value={filters.status}
                        onChange={(e) =>
                          onUpdateFilters({
                            status: e.target.value as TicketStatus | 'Todos',
                          })
                        }
                        className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="Todos">Status: Todos</option>
                        <option value="Novo">[N] Novo</option>
                        <option value="Em Atendimento">[O] Em Atendimento</option>
                        <option value="Aguardando Usuário">
                          [P] Aguardando Usuário
                        </option>
                        <option value="Resolvido">[R] Resolvido</option>
                      </select>

                      <select
                        aria-label="Filtrar por Prioridade"
                        value={filters.priority}
                        onChange={(e) =>
                          onUpdateFilters({
                            priority: e.target.value as PriorityLevel | 'Todas',
                          })
                        }
                        className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="Todas">Prioridade: Todas</option>
                        <option value="Crítica">P1 · Crítica</option>
                        <option value="Alta">P2 · Alta</option>
                        <option value="Média">P3 · Média</option>
                        <option value="Baixa">P4 · Baixa</option>
                      </select>

                      <select
                        aria-label="Filtrar por Técnico"
                        value={filters.assigneeId}
                        onChange={(e) =>
                          onUpdateFilters({
                            assigneeId: e.target.value as
                              | TechnicianId
                              | 'Todos',
                          })
                        }
                        className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="Todos">Responsável: Todos</option>
                        <option value="elias">Elias (N1)</option>
                        <option value="mauricio">Mauricio (N2)</option>
                        <option value="alexandre">
                          Alexandre (N3 · Resp. Setor)
                        </option>
                      </select>

                      {(filters.status !== 'Todos' ||
                        filters.priority !== 'Todas' ||
                        filters.assigneeId !== 'Todos' ||
                        filters.search !== '') && (
                        <button
                          type="button"
                          onClick={onResetFilters}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200 transition-colors"
                        >
                          Limpar Filtros
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bulk Action Bar when 1+ tickets are selected */}
                  {selectedTicketIds.length > 0 && (
                    <div
                      role="region"
                      aria-label="Ações em Lote"
                      className="px-3.5 py-2 rounded-lg bg-blue-950 text-white flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-600 font-mono font-bold">
                          {selectedTicketIds.length}
                        </span>
                        <span className="font-semibold">
                          {selectedTicketIds.length === 1
                            ? 'chamado selecionado para ação em lote'
                            : 'chamados selecionados para ação em lote'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-400">Alterar Status:</span>
                        {(
                          [
                            'Em Atendimento',
                            'Aguardando Usuário',
                            'Resolvido',
                          ] as TicketStatus[]
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              onBulkUpdateStatus(selectedTicketIds, st);
                              setSelectedTicketIds([]);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-medium transition-colors"
                          >
                            {st}
                          </button>
                        ))}

                        <span className="text-slate-600 mx-1">|</span>
                        <span className="text-slate-400">Reatribuir a:</span>
                        {technicians.map((tech) => (
                          <button
                            key={tech.id}
                            type="button"
                            onClick={() => {
                              onBulkAssignTechnician(
                                selectedTicketIds,
                                tech.id
                              );
                              setSelectedTicketIds([]);
                            }}
                            className="px-2 py-1 rounded bg-blue-900/60 hover:bg-blue-700 text-blue-100 border border-blue-700 font-medium transition-colors"
                          >
                            {tech.name} ({tech.tier})
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setSelectedTicketIds([])}
                          className="ml-2 text-slate-400 hover:text-white underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* High-Density Ticket Queue Table */}
                <div className="flex-1 overflow-auto">
                  {isLoadingTickets && tickets.length === 0 ? (
                    <TicketTableSkeleton rows={10} />
                  ) : paginatedTickets.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-800">
                          Nenhum chamado encontrado nesta visualização
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Altere a View selecionada na coluna esquerda ou redefina os filtros ativos para visualizar toda a fila corporativa.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAllInView(true);
                          onResetFilters();
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                      >
                        Exibir Todos os Chamados ({tickets.length})
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none">
                        <tr>
                          <th className="py-2 pl-3 pr-1.5 w-7">
                            <input
                              type="checkbox"
                              aria-label="Selecionar todos os chamados da página"
                              checked={allVisibleSelected}
                              onChange={handleToggleSelectAll}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </th>
                          <th className="py-2 px-1.5 w-10">
                            <button
                              type="button"
                              onClick={() => handleSortColumn('status')}
                              className="inline-flex items-center gap-0.5 hover:text-slate-900"
                            >
                              <span>St</span>
                              <ArrowUpDown className="w-2.5 h-2.5" />
                            </button>
                          </th>
                          <th className="py-2 px-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSortColumn('id')}
                              className="inline-flex items-center gap-0.5 hover:text-slate-900"
                            >
                              <span>ID</span>
                              <ArrowUpDown className="w-2.5 h-2.5" />
                            </button>
                          </th>
                          <th className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => handleSortColumn('title')}
                              className="inline-flex items-center gap-1 hover:text-slate-900"
                            >
                              <span>Assunto / Descrição do Ticket</span>
                              <ArrowUpDown className="w-2.5 h-2.5" />
                            </button>
                          </th>
                          <th className="py-2 px-1.5 whitespace-nowrap">
                            Canal
                          </th>
                          <th className="py-2 px-1.5 whitespace-nowrap">
                            Categoria
                          </th>
                          <th className="py-2 px-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSortColumn('requester')}
                              className="inline-flex items-center gap-0.5 hover:text-slate-900"
                            >
                              <span>Solicitante</span>
                              <ArrowUpDown className="w-2.5 h-2.5" />
                            </button>
                          </th>
                          <th className="py-2 px-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSortColumn('createdAt')}
                              className="inline-flex items-center gap-0.5 hover:text-slate-900"
                            >
                              <span>Solicitado</span>
                              <ArrowUpDown className="w-2.5 h-2.5" />
                            </button>
                          </th>
                          <th className="py-2 px-1.5 whitespace-nowrap">
                            Responsável
                          </th>
                          <th className="py-2 pl-1.5 pr-3 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => handleSortColumn('sla')}
                              className="inline-flex items-center gap-0.5 hover:text-slate-900 ml-auto"
                            >
                              <span>SLA / Prioridade</span>
                              <ArrowUpDown className="w-2.5 h-2.5" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {paginatedTickets.map((ticket) => (
                          <TicketTableRow
                            key={ticket.id}
                            ticket={ticket}
                            isSelected={selectedTicketIds.includes(ticket.id)}
                            technicians={technicians}
                            onToggleSelect={handleToggleSelectTicket}
                            onSelectTicket={onSelectTicket}
                            onAssignTechnician={onAssignTechnician}
                            onRequestFinalizeTicket={onRequestFinalizeTicket}
                            onMouseEnterSubject={handleMouseEnterSubject}
                            onMouseLeaveSubject={handleMouseLeaveSubject}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Table Footer with Pagination & Quick Status Summary */}
                <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span>
                      Exibindo{' '}
                      <strong className="text-slate-900">
                        {paginatedTickets.length}
                      </strong>{' '}
                      de{' '}
                      <strong className="text-slate-900">
                        {sortedTickets.length}
                      </strong>{' '}
                      chamados
                    </span>
                    <span>·</span>
                    <span>
                      Página {currentPage} de {totalPages}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TOOL 2: HOME / DASHBOARD DE MÉTRICAS E EQUIPE */}
            {activeTool === 'home' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 animate-tab-switch">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900">
                      Resumo Executivo &amp; KPIs do Service Desk
                    </h1>
                    <p className="text-xs text-slate-500">
                      Monitoramento em tempo real da operação distribuída entre Elias (N1), Mauricio (N2) e Alexandre (N3).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTool('views')}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg active:scale-[0.98] transition-all duration-150 self-start"
                  >
                    Ir para Fila de Tickets (Views)
                  </button>
                </div>

                {/* KPI Strip */}
                {isLoadingTickets && tickets.length === 0 ? (
                  <KpiCardsSkeleton count={4} />
                ) : (
                <section
                  aria-label="Indicadores Chave de Desempenho"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover-lift transition-all duration-150">
                    <span className="text-xs font-medium text-slate-500">
                      Chamados em Aberto
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span
                        data-testid="kpi-open-tickets"
                        className="text-3xl font-bold font-mono text-slate-900"
                      >
                        {kpis.totalOpenTickets}
                      </span>
                      <span className="text-xs text-slate-500">
                        {kpis.totalResolvedTickets} resolvidos
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover-lift transition-all duration-150">
                    <span className="text-xs font-medium text-slate-500">
                      SLA Dentro do Prazo
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span
                        data-testid="kpi-sla-compliance"
                        className="text-3xl font-bold font-mono text-emerald-700"
                      >
                        {kpis.slaCompliancePercent}%
                      </span>
                      <span className="text-xs text-slate-500">
                        {kpis.expiringSoonCount} expirando em breve
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover-lift transition-all duration-150">
                    <span className="text-xs font-medium text-slate-500">
                      Incidentes Críticos (P1)
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span
                        data-testid="kpi-critical-tickets"
                        className="text-3xl font-bold font-mono text-red-600"
                      >
                        {kpis.criticalOpenCount}
                      </span>
                      <span className="text-xs text-slate-500">
                        {kpis.breachedOpenCount} com SLA excedido
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover-lift transition-all duration-150">
                    <span className="text-xs font-medium text-slate-500">
                      Tempo Médio de Resolução
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-bold font-mono text-blue-700">
                        {kpis.avgResolutionMinutes}m
                      </span>
                      <span className="text-xs text-emerald-700 font-medium">
                        {serviceOrders.length} O.S. emitidas
                      </span>
                    </div>
                  </div>
                </section>
                )}

                {/* Corporate Analysts Cards */}
                <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
                  <h2 className="text-sm font-bold text-slate-900">
                    Analistas Corporativos Ativos no Global Desk
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {technicians.map((tech) => {
                      const assignedOpen = tickets.filter(
                        (t) =>
                          t.assigneeId === tech.id && t.status !== 'Resolvido'
                      );
                      const criticalCount = assignedOpen.filter(
                        (t) => t.priority === 'Crítica'
                      ).length;

                      return (
                        <div
                          key={tech.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {tech.avatarInitials}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sm text-slate-900">
                                    {tech.name}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
                                    {tech.tier}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                  {tech.roleTitle}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">
                            {tech.specialty}
                          </p>
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-slate-700">
                              {assignedOpen.length} em aberto (
                              {criticalCount} P1)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const targetView: ZendeskViewId =
                                  tech.id === 'elias'
                                    ? 'tier_n1_elias'
                                    : tech.id === 'mauricio'
                                    ? 'tier_n2_mauricio'
                                    : 'tier_n3_alexandre';
                                handleSelectZendeskView(targetView);
                              }}
                              className="text-blue-600 font-semibold hover:underline"
                            >
                              Abrir Fila {tech.tier} →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* TOOL 3: RELATÓRIOS & PERFORMANCE OVERVIEW (RECHARTS) */}
            {activeTool === 'performance' && (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 animate-tab-switch">
                <Suspense fallback={<WorkspaceModuleSkeleton />}>
                  <LazyPerformanceAnalytics
                    tickets={tickets}
                    technicians={technicians}
                    activeTechId={activeTechActor.id}
                  />
                </Suspense>
              </div>
            )}

            {/* TOOL 4: GESTÃO DE ORDENS DE SERVIÇO (O.S.) */}
            {activeTool === 'orders' && (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 animate-tab-switch">
                <section
                  aria-label="Gestão de Ordens de Serviço (O.S.)"
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs"
                >
                  <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
                    {exportStatus && (
                      <div
                        role="status"
                        className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 ${
                          exportStatus.type === 'info'
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : exportStatus.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {exportStatus.type === 'info' ? (
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                          ) : exportStatus.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          )}
                          <span>{exportStatus.message}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExportStatus(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <img src={LOGO_PATHS.dark} alt="Grupo Global" className="h-6 object-contain" />
                          <span className="text-slate-300">|</span>
                          <FileCheck className="w-4 h-4 text-emerald-600" />
                          Ordens de Serviço (O.S.) Arquivadas
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Registros oficiais de encerramento técnico com geração de laudo PDF.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-mono text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                          Total de O.S.:{' '}
                          <strong className="text-slate-900">
                            {serviceOrders.length}
                          </strong>
                        </div>

                        {filteredOrders.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExportConsolidatedPdf}
                            disabled={exportingOsId !== null}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {exportingOsId === 'consolidated' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>
                              Exportar Relatório PDF ({filteredOrders.length})
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* O.S. Search & Filter Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label
                          htmlFor="search-os-number"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          Buscar pelo Número da O.S.
                        </label>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="search-os-number"
                            type="text"
                            value={osNumberSearch}
                            onChange={(e) => setOsNumberSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-blue-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono font-medium"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          Formato: OS-2026-0001
                        </span>
                      </div>

                      <div>
                        <label
                          htmlFor="filter-os-outcome"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          Filtrar por Desfecho da Finalização
                        </label>
                        <select
                          id="filter-os-outcome"
                          value={osOutcomeFilter}
                          onChange={(e) =>
                            setOsOutcomeFilter(
                              e.target.value as FinalizationOutcome | 'Todos'
                            )
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                        >
                          <option value="Todos">Todos os Desfechos</option>
                          <option value="concluido_sucesso">
                            Concluído com Sucesso
                          </option>
                          <option value="solucao_contorno">
                            Solução de Contorno (Workaround)
                          </option>
                          <option value="nao_concluido">
                            Encerrado sem Conclusão / Inviabilidade
                          </option>
                          <option value="cancelado_usuario">
                            Cancelado pelo Solicitante
                          </option>
                          <option value="fora_escopo">
                            Rejeitado / Fora do Escopo
                          </option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="search-os-general"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          Filtrar por Solicitante, Chamado ou Setor
                        </label>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="search-os-general"
                            type="text"
                            value={osGeneralSearch}
                            onChange={(e) => setOsGeneralSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl space-y-2">
                      <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        Nenhuma Ordem de Serviço encontrada
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Para gerar uma nova O.S., clique em &ldquo;Emitir O.S.&rdquo; em qualquer chamado da fila operacional ou dentro do painel lateral de detalhes do chamado.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                            <th className="py-2.5 px-3">Código O.S.</th>
                            <th className="py-2.5 px-3">Desfecho</th>
                            <th className="py-2.5 px-3">Chamado Origem</th>
                            <th className="py-2.5 px-3">Solicitante</th>
                            <th className="py-2.5 px-3">Técnico Executor</th>
                            <th className="py-2.5 px-3">Duração</th>
                            <th className="py-2.5 px-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.map((order) => (
                            <tr
                              key={order.id}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="py-3 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                                {order.id}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {order.outcomeLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-mono font-semibold text-slate-800">
                                  {order.ticketId}
                                </span>
                                <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                  {order.ticketTitle}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-semibold text-slate-900 block">
                                  {order.requesterName}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {order.department}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-semibold text-slate-800 block">
                                  {order.technicianName}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Nível {order.technicianTier}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-700">
                                {order.durationText}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleExportPdf(order)}
                                    disabled={exportingOsId === order.id}
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                                  >
                                    <FileDown className="w-3.5 h-3.5" />
                                    <span>Exportar PDF</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedOrderForView(order)
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors inline-flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Visualizar</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TOOL 5: BASE DE CONHECIMENTO INTERNA */}
            {activeTool === 'kb' && (
              <div className="flex-1 overflow-y-auto bg-slate-50 animate-tab-switch">
                <Suspense fallback={<WorkspaceModuleSkeleton />}>
                  <LazyKnowledgeBaseManager
                    articles={kbArticles}
                    currentTechName={activeTechActor.name}
                    onRefresh={onRefreshKb}
                  />
                </Suspense>
              </div>
            )}

            {/* TOOL 6: GESTÃO DE INVENTÁRIO & ATIVOS DE TI (CMDB) */}
            {activeTool === 'assets' && (
              <div className="flex-1 overflow-y-auto bg-slate-50 animate-tab-switch">
                <Suspense fallback={<WorkspaceModuleSkeleton />}>
                  <LazyAssetInventoryTab
                    users={systemUsers}
                    activeTechName={activeTechActor.fullName || activeTechActor.name}
                    onNotify={onNotify}
                  />
                </Suspense>
              </div>
            )}

            {/* TOOL 7: GESTÃO DE USUÁRIOS */}
            {activeTool === 'users' && (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 animate-tab-switch">
                <Suspense fallback={<WorkspaceModuleSkeleton />}>
                  <LazyUserManagementView
                    users={systemUsers}
                    onAddUser={onAddUser}
                    onUpdateUser={onUpdateUser}
                    onDeleteUser={onDeleteUser}
                    onToggleUserStatus={onToggleUserStatus}
                  />
                </Suspense>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* =====================================================================
          ZONE E: POPOVER DE PRÉ-VISUALIZAÇÃO NO HOVER (TICKET PREVIEW CARD)
         ===================================================================== */}
      {hoveredTicket && (
        <div
          role="dialog"
          aria-label={`Pré-visualização rápida do chamado ${hoveredTicket.ticket.id}`}
          onMouseEnter={handleMouseEnterPopover}
          onMouseLeave={handleMouseLeavePopover}
          style={{
            top: `${hoveredTicket.top}px`,
            left: `${hoveredTicket.left}px`,
          }}
          className="fixed z-50 w-[430px] bg-white rounded-xl border border-slate-200/90 shadow-2xl p-4 space-y-3 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Top Bar: Zendesk Status Badge + Protocol + Priority */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {renderZendeskStatusSquare(hoveredTicket.ticket.status)}
              <span className="font-bold text-slate-800">
                {hoveredTicket.ticket.status}
              </span>
              <span className="font-mono font-bold text-blue-600">
                {hoveredTicket.ticket.id}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {renderChannelBadge(hoveredTicket.ticket.channel)}
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                {SLA_POLICY_BY_PRIORITY[hoveredTicket.ticket.priority].code} ·{' '}
                {hoveredTicket.ticket.priority}
              </span>
            </div>
          </div>

          {/* Full Title & Initial Description */}
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 text-sm leading-snug">
              {hoveredTicket.ticket.title}
            </h4>
            <p className="text-slate-600 leading-relaxed line-clamp-3">
              {hoveredTicket.ticket.description}
            </p>
          </div>

          {/* Latest Technical Comment / Note Section */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
            {(() => {
              const latestNote =
                hoveredTicket.ticket.notes[
                  hoveredTicket.ticket.notes.length - 1
                ];
              return (
                <>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Último Comentário / Parecer Técnico</span>
                    <span>
                      {latestNote?.createdAt || hoveredTicket.ticket.createdAt}
                    </span>
                  </div>
                  {latestNote ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                        <span>{latestNote.authorName}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-mono ${
                            latestNote.visibility === 'internal'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {latestNote.visibility === 'internal'
                            ? 'Nota Interna'
                            : 'Resposta Pública'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {latestNote.content}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      Sem pareceres adicionais registrados. Aguardando atuação do analista responsável.
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Quick Actions Footer */}
          <div className="pt-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              Solicitante:{' '}
              <strong className="text-slate-800">
                {hoveredTicket.ticket.requesterName}
              </strong>
            </span>
            <div className="flex items-center gap-1.5">
              {hoveredTicket.ticket.assigneeId !== activeTechActor.id && (
                <button
                  type="button"
                  onClick={() => {
                    onAssignTechnician(
                      hoveredTicket.ticket.id,
                      activeTechActor.id,
                      activeTechActor.tier,
                      'Assumido via Popover Rápido no Agent Workspace'
                    );
                    setHoveredTicket(null);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 inline-flex items-center gap-1 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Atribuir a mim</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelectTicket(hoveredTicket.ticket.id);
                  setHoveredTicket(null);
                }}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Abrir detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização / Impressão da Ordem de Serviço */}
      <Suspense fallback={null}>
        <LazyServiceOrderViewModal
          order={selectedOrderForView}
          onClose={() => setSelectedOrderForView(null)}
        />
      </Suspense>
    </div>
  );
};
