import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileDown,
  FileText,
  History,
  Lock,
  MessageSquare,
  Paperclip,
  Send,
  ShieldAlert,
  Terminal,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  PriorityLevel,
  ServiceOrder,
  SupportTier,
  TechnicalNoteCategory,
  Technician,
  TechnicianId,
  Ticket,
  TicketNote,
  TicketStatus,
} from '../types/itsm';
import {
  formatMinutesDuration,
  SLA_POLICY_BY_PRIORITY,
} from '../utils/itilRules';
import { downloadClosedTicketPdf } from '../utils/pdfExport';
import { useAnimatedPresence } from '../utils/useAnimatedPresence';

interface TicketDetailDrawerProps {
  ticket: Ticket | null;
  technicians: Technician[];
  activeTechActor: Technician;
  viewerRole?: 'technician' | 'collaborator';
  onClose: () => void;
  onUpdateStatus: (ticketId: string, newStatus: TicketStatus, actorName: string) => void;
  onAssignTechnician: (
    ticketId: string,
    techId: TechnicianId,
    newTier?: SupportTier,
    reason?: string
  ) => void;
  onEscalateTier: (
    ticketId: string,
    targetTier: SupportTier,
    targetTechId: TechnicianId,
    reason: string
  ) => void;
  onAddNote: (
    ticketId: string,
    visibility: 'public' | 'internal',
    content: string,
    authorName: string,
    authorRole: string,
    category?: TechnicalNoteCategory,
    targetTechName?: string,
    commandSnippet?: string
  ) => void;
  onRequestFinalize?: (ticket: Ticket) => void;
  onDeleteTicket?: (ticketId: string) => void;
  isSuperAdmin?: boolean;
  serviceOrders?: ServiceOrder[];
}

const STATUS_OPTIONS: TicketStatus[] = [
  'Novo',
  'Em Atendimento',
  'Aguardando Usuário',
  'Resolvido',
];

const TIER_OPTIONS: SupportTier[] = ['N1', 'N2', 'N3'];

const TECHNICAL_CATEGORIES: { id: TechnicalNoteCategory; label: string }[] = [
  { id: 'alinhamento', label: 'Alinhamento Técnico' },
  { id: 'diagnostico', label: 'Diagnóstico & Causa Raiz' },
  { id: 'handoff', label: 'Repasse / Handoff' },
  { id: 'infraestrutura', label: 'Ação de Infraestrutura' },
  { id: 'escalonamento', label: 'Escalonamento Interno' },
];

export const TicketDetailDrawer: React.FC<TicketDetailDrawerProps> = ({
  ticket: ticketProp,
  technicians,
  activeTechActor,
  viewerRole = 'technician',
  onClose,
  onUpdateStatus,
  onAssignTechnician,
  onEscalateTier,
  onAddNote,
  onRequestFinalize,
  onDeleteTicket,
  isSuperAdmin = false,
  serviceOrders = [],
}) => {
  const { renderedValue: ticket, isClosing } = useAnimatedPresence(ticketProp, 180);
  const isTechnician = viewerRole === 'technician';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteVisibility, setNoteVisibility] = useState<'public' | 'internal'>(
    isTechnician ? 'internal' : 'public'
  );
  const [techCategory, setTechCategory] = useState<TechnicalNoteCategory>('alinhamento');
  const [targetRecipient, setTargetRecipient] = useState<string>('Toda a Equipe Técnica');
  const [showCommandInput, setShowCommandInput] = useState(false);
  const [commandSnippet, setCommandSnippet] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [activeSection, setActiveSection] = useState<'notes' | 'audit'>('notes');
  const [notesFilter, setNotesFilter] = useState<'all' | 'internal' | 'public'>('all');
  const [noteError, setNoteError] = useState('');
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  useEffect(() => {
    setConfirmDelete(false);
    setNoteContent('');
    setNoteError('');
    setCommandSnippet('');
    setShowCommandInput(false);
  }, [ticket?.id]);

  const assignedTech = useMemo(() => {
    if (!ticket) return technicians[0];
    return technicians.find((t) => t.id === ticket.assigneeId) || technicians[0];
  }, [ticket, technicians]);

  const slaPolicy = useMemo(() => {
    if (!ticket) return SLA_POLICY_BY_PRIORITY['Média'];
    return SLA_POLICY_BY_PRIORITY[ticket.priority];
  }, [ticket]);

  // Notes visible based on role and filter
  const visibleNotes = useMemo(() => {
    if (!ticket) return [];
    if (!isTechnician) {
      // Collaborator ONLY sees public notes
      return ticket.notes.filter((n) => n.visibility === 'public');
    }
    if (notesFilter === 'internal') {
      return ticket.notes.filter((n) => n.visibility === 'internal');
    }
    if (notesFilter === 'public') {
      return ticket.notes.filter((n) => n.visibility === 'public');
    }
    return ticket.notes;
  }, [ticket, isTechnician, notesFilter]);

  const counts = useMemo(() => {
    if (!ticket) return { total: 0, internal: 0, public: 0 };
    const internal = ticket.notes.filter((n) => n.visibility === 'internal').length;
    const pub = ticket.notes.filter((n) => n.visibility === 'public').length;
    return {
      total: isTechnician ? ticket.notes.length : pub,
      internal,
      public: pub,
    };
  }, [ticket, isTechnician]);

  useEffect(() => {
    if (!ticket) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ticket, onClose]);

  if (!ticket) return null;

  const handleCopySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteContent.trim();
    if (!trimmed) {
      setNoteError('O preenchimento do campo de mensagem é obrigatório.');
      return;
    }
    setNoteError('');
    const effectiveVisibility = isTechnician ? noteVisibility : 'public';
    const authorName = isTechnician
      ? `${activeTechActor.name} (${activeTechActor.tier})`
      : ticket.requesterName;
    const authorRole = isTechnician
      ? activeTechActor.role
      : `Solicitante · ${ticket.department}`;

    onAddNote(
      ticket.id,
      effectiveVisibility,
      trimmed,
      authorName,
      authorRole,
      isTechnician && effectiveVisibility === 'internal' ? techCategory : undefined,
      isTechnician && effectiveVisibility === 'internal' && targetRecipient !== 'Toda a Equipe Técnica'
        ? targetRecipient
        : undefined,
      isTechnician && effectiveVisibility === 'internal' && commandSnippet.trim()
        ? commandSnippet.trim()
        : undefined
    );

    setNoteContent('');
    setCommandSnippet('');
    setShowCommandInput(false);
  };

  const getPriorityStyle = (priority: PriorityLevel) => {
    switch (priority) {
      case 'Crítica':
        return 'text-red-700 bg-red-50 border-red-200/80';
      case 'Alta':
        return 'text-amber-800 bg-amber-50 border-amber-200/80';
      case 'Média':
        return 'text-blue-700 bg-blue-50 border-blue-200/80';
      case 'Baixa':
        return 'text-slate-700 bg-slate-100 border-slate-200/80';
    }
  };

  const getSlaBannerStyle = () => {
    switch (ticket.sla.health) {
      case 'breached':
        return {
          container: 'bg-red-50/70 border-red-200 text-red-900',
          bar: 'bg-red-600',
          label: 'SLA Violado — Ação Imediata Requerida',
          icon: <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />,
        };
      case 'expiring_soon':
        return {
          container: 'bg-amber-50/70 border-amber-200 text-amber-900',
          bar: 'bg-amber-500',
          label: 'SLA Expirando em Breve — Risco de Violação',
          icon: <Clock className="w-4 h-4 text-amber-600 shrink-0" />,
        };
      case 'completed_on_time':
        return {
          container: 'bg-emerald-50/60 border-emerald-200 text-emerald-900',
          bar: 'bg-emerald-600',
          label: 'SLA Cumprido Dentro da Meta',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
        };
      case 'completed_late':
        return {
          container: 'bg-slate-100 border-slate-300 text-slate-800',
          bar: 'bg-slate-600',
          label: 'Encerrado Após Vencimento do SLA',
          icon: <Clock className="w-4 h-4 text-slate-600 shrink-0" />,
        };
      default:
        return {
          container: 'bg-blue-50/40 border-blue-200/80 text-slate-900',
          bar: 'bg-blue-600',
          label: 'SLA Dentro do Prazo Operacional',
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />,
        };
    }
  };

  const slaVisual = getSlaBannerStyle();
  const elapsedResolution = Math.max(
    0,
    ticket.sla.resolutionTargetMinutes - ticket.sla.resolutionRemainingMinutes
  );
  const progressPercentage = Math.min(
    100,
    Math.max(8, Math.round((elapsedResolution / ticket.sla.resolutionTargetMinutes) * 100))
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-ticket-title"
    >
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <aside
        className={`relative w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden ${
          isClosing
            ? 'animate-out slide-out-to-right'
            : 'animate-in slide-in-from-right'
        } duration-200`}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/60">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
              <span className="font-mono font-semibold text-blue-600">
                {ticket.id}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700">{ticket.type}</span>
              <span aria-hidden="true">·</span>
              <span>{ticket.category}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded border ${getPriorityStyle(
                  ticket.priority
                )}`}
              >
                Prioridade {ticket.priority} ({slaPolicy.code})
              </span>
            </div>
            <h2
              id="drawer-ticket-title"
              className="text-base sm:text-lg font-semibold text-slate-900 leading-snug"
            >
              {ticket.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const matchingOs = serviceOrders?.find((so) => so.ticketId === ticket.id);
                downloadClosedTicketPdf(ticket, matchingOs);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs shrink-0"
              title="Exportar PDF com Log de Auditoria, O.S. e Interações"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>

            {isSuperAdmin && onDeleteTicket && (
              confirmDelete ? (
                <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                  <span className="text-[10px] text-red-700 font-bold px-1">Excluir?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteTicket(ticket.id);
                      setConfirmDelete(false);
                      onClose();
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-1.5 py-1 text-slate-600 hover:text-slate-900 rounded text-[11px]"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  title="Excluir ticket definitivamente (Permissão Maior Administrador)"
                  aria-label="Excluir ticket permanentemente"
                  className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel de detalhes do chamado"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* SLA & Service Level Management Box */}
          <section
            aria-label="Gestão de Nível de Serviço SLA"
            className={`p-4 rounded-xl border ${slaVisual.container}`}
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 font-medium text-sm">
                {slaVisual.icon}
                <span>{slaVisual.label}</span>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums">
                {ticket.status === 'Resolvido'
                  ? 'Concluído'
                  : ticket.sla.resolutionRemainingMinutes < 0
                  ? `Excedido em ${formatMinutesDuration(
                      Math.abs(ticket.sla.resolutionRemainingMinutes)
                    )}`
                  : `Restam ${formatMinutesDuration(
                      ticket.sla.resolutionRemainingMinutes
                    )}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
              <div className="bg-white/95 rounded-lg p-2.5 border border-slate-200/80">
                <div className="text-slate-500 mb-0.5">
                  SLA 1ª Resposta (Meta: {slaPolicy.firstResponseLabel})
                </div>
                <div className="font-mono font-semibold text-slate-900 flex items-center justify-between">
                  {ticket.sla.firstResponseMet ? (
                    <>
                      <span>
                        Realizado em {ticket.sla.firstResponseElapsedMinutes ?? 0}m
                      </span>
                      <span className="text-emerald-700 font-sans font-medium">
                        Atendido
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Meta: {slaPolicy.firstResponseLabel}</span>
                      <span className="text-amber-700 font-sans font-medium">
                        Pendente
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-white/95 rounded-lg p-2.5 border border-slate-200/80">
                <div className="text-slate-500 mb-0.5">
                  SLA Resolução Final (Meta: {slaPolicy.resolutionLabel})
                </div>
                <div className="font-mono font-semibold text-slate-900 flex items-center justify-between">
                  <span>
                    Consumido: {formatMinutesDuration(elapsedResolution)} /{' '}
                    {slaPolicy.resolutionLabel}
                  </span>
                  <span>{progressPercentage}%</span>
                </div>
              </div>
            </div>

            <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
              <div
                className={`h-full w-full origin-left transition-transform duration-200 ${slaVisual.bar}`}
                style={{ transform: `scaleX(${progressPercentage / 100})` }}
              />
            </div>
          </section>

          {/* Technician-Only Operational Controls: Status, Assignment, Support Level & Escalation */}
          {isTechnician && (
            <section
              aria-label="Atribuição e Escalonamento Técnico"
              className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="drawer-status-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Status do Chamado
                  </label>
                  <select
                    id="drawer-status-select"
                    value={ticket.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as TicketStatus;
                      if (newStatus === 'Resolvido' && onRequestFinalize) {
                        onRequestFinalize(ticket);
                      } else {
                        onUpdateStatus(
                          ticket.id,
                          newStatus,
                          activeTechActor.name
                        );
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="drawer-tech-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Analista Responsável
                  </label>
                  <select
                    id="drawer-tech-select"
                    value={ticket.assigneeId}
                    onChange={(e) =>
                      onAssignTechnician(
                        ticket.id,
                        e.target.value as TechnicianId,
                        undefined,
                        'Reatribuição direta pelo painel de comando'
                      )
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} {tech.isLead ? '(Resp. N3)' : `(${tech.tier})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="drawer-tier-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nível de Atendimento
                  </label>
                  <select
                    id="drawer-tier-select"
                    value={ticket.tier}
                    onChange={(e) =>
                      onEscalateTier(
                        ticket.id,
                        e.target.value as SupportTier,
                        ticket.assigneeId,
                        `Ajuste funcional de nível para ${e.target.value}`
                      )
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {TIER_OPTIONS.map((tier) => (
                      <option key={tier} value={tier}>
                        Nível {tier}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  Ações Rápidas de Atribuição e Escalonamento
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      ticket.assigneeId === 'elias' && ticket.tier === 'N1'
                    }
                    onClick={() =>
                      onEscalateTier(
                        ticket.id,
                        'N1',
                        'elias',
                        'Retornado para Fila N1 (Elias) para atendimento de rotina'
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                  >
                    Atribuir Elias (N1)
                  </button>

                  <button
                    type="button"
                    disabled={
                      ticket.assigneeId === 'mauricio' && ticket.tier === 'N2'
                    }
                    onClick={() =>
                      onEscalateTier(
                        ticket.id,
                        'N2',
                        'mauricio',
                        'Escalonamento técnico N2 para Mauricio (Infraestrutura & Redes)'
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    Escalonar N2 · Mauricio
                  </button>

                  <button
                    type="button"
                    disabled={
                      ticket.assigneeId === 'alexandre' && ticket.tier === 'N3'
                    }
                    onClick={() =>
                      onEscalateTier(
                        ticket.id,
                        'N3',
                        'alexandre',
                        'Escalonamento N3 para Alexandre (Responsável do Setor)'
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                    Escalonar N3 · Alexandre (Resp. Setor)
                  </button>

                  {ticket.status === 'Resolvido' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const matchingOs = serviceOrders?.find((so) => so.ticketId === ticket.id);
                        downloadClosedTicketPdf(ticket, matchingOs);
                      }}
                      className="ml-auto px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
                    >
                      <FileDown className="w-4 h-4" />
                      Exportar PDF do Chamado Fechado &amp; Auditoria
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (onRequestFinalize) {
                          onRequestFinalize(ticket);
                        } else {
                          onUpdateStatus(
                            ticket.id,
                            'Resolvido',
                            activeTechActor.name
                          );
                        }
                      }}
                      className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Finalizar Chamado &amp; Emitir O.S.
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Requester, Priority Matrix Context & Description */}
          <section className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-y border-slate-200 py-3">
              <div>
                <span className="text-slate-500 block">Solicitante</span>
                <span className="font-semibold text-slate-900 truncate block">
                  {ticket.requesterName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Setor Solicitante</span>
                <span className="font-semibold text-slate-900 truncate block">
                  {ticket.department}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Impacto × Urgência</span>
                <span className="font-semibold text-slate-900 block">
                  {ticket.impact} × {ticket.urgency}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Responsável Atual</span>
                <span className="font-semibold text-slate-900 flex items-center gap-1 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  {assignedTech.name} ({ticket.tier})
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-800 mb-1.5">
                Descrição Detalhada do Chamado
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                {ticket.description}
              </p>
            </div>

            {ticket.attachments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  Evidências e Anexos ({ticket.attachments.length})
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {ticket.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-mono font-medium text-slate-900 truncate">
                            {att.fileName}
                          </div>
                          {att.previewNote && (
                            <div className="text-slate-500 mt-0.5">
                              {att.previewNote}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-slate-500 shrink-0">
                        {att.fileSize}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section Switcher: Comunicação & Linha do Tempo de Auditoria */}
          <section className="space-y-4 pt-2 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveSection('notes')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeSection === 'notes'
                      ? 'bg-white text-blue-600 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comunicação &amp; Notas ({counts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('audit')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeSection === 'audit'
                      ? 'bg-white text-blue-600 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Histórico &amp; Auditoria ({ticket.auditTrail.length})
                </button>
              </div>

              {/* Technician Sub-Filters */}
              {isTechnician && activeSection === 'notes' && (
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setNotesFilter('all')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      notesFilter === 'all'
                        ? 'bg-slate-200 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({counts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesFilter('internal')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                      notesFilter === 'internal'
                        ? 'bg-amber-100 text-amber-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3 h-3 text-amber-700" />
                    Canal Técnico ({counts.internal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesFilter('public')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                      notesFilter === 'public'
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3 text-blue-600" />
                    Solicitante ({counts.public})
                  </button>
                </div>
              )}
            </div>

            {activeSection === 'notes' ? (
              <div className="space-y-4">
                {/* Note Composer */}
                <form
                  onSubmit={handleNoteSubmit}
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${
                    isTechnician && noteVisibility === 'internal'
                      ? 'bg-amber-50/30 border-amber-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {isTechnician ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                          <button
                            type="button"
                            onClick={() => setNoteVisibility('internal')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                              noteVisibility === 'internal'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Nota Interna entre Técnicos
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoteVisibility('public')}
                            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                              noteVisibility === 'public'
                                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Resposta ao Solicitante
                          </button>
                        </div>

                        <span className="text-xs text-slate-600">
                          Operador ativo:{' '}
                          <strong className="text-slate-900 font-semibold">
                            {activeTechActor.name} ({activeTechActor.tier})
                          </strong>
                        </span>
                      </div>

                      {noteVisibility === 'internal' && (
                        <div className="p-3 bg-white/90 rounded-lg border border-amber-200/90 space-y-2.5 text-xs">
                          <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Parâmetros de Comunicação Interna (Confidencial Service Desk)</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label
                                htmlFor="tech-category-select"
                                className="block font-medium text-slate-700 mb-1"
                              >
                                Finalidade Técnica da Nota
                              </label>
                              <select
                                id="tech-category-select"
                                value={techCategory}
                                onChange={(e) =>
                                  setTechCategory(e.target.value as TechnicalNoteCategory)
                                }
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                              >
                                {TECHNICAL_CATEGORIES.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor="tech-target-select"
                                className="block font-medium text-slate-700 mb-1"
                              >
                                Analista Destinatário
                              </label>
                              <select
                                id="tech-target-select"
                                value={targetRecipient}
                                onChange={(e) => setTargetRecipient(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                              >
                                <option value="Toda a Equipe Técnica">Toda a Equipe Técnica</option>
                                <option value="Alexandre (N3)">Alexandre (N3 - Resp. Setor)</option>
                                <option value="Mauricio (N2)">Mauricio (N2 - Infraestrutura)</option>
                                <option value="Elias (N1)">Elias (N1 - Atendimento)</option>
                              </select>
                            </div>
                          </div>

                          <div className="pt-1 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setShowCommandInput(!showCommandInput)}
                              className="text-amber-800 hover:text-amber-950 font-medium flex items-center gap-1 transition-colors text-xs"
                            >
                              <Terminal className="w-3.5 h-3.5 text-amber-700" />
                              {showCommandInput
                                ? 'Remover comando / log da nota'
                                : '+ Anexar comando de terminal ou log técnico'}
                            </button>
                            <span className="text-slate-500 text-[11px]">
                              Visível apenas para Elias, Alexandre e Mauricio
                            </span>
                          </div>

                          {showCommandInput && (
                            <div className="pt-2 border-t border-amber-100">
                              <label
                                htmlFor="tech-command-textarea"
                                className="block font-medium text-slate-700 mb-1"
                              >
                                Linhas de Comando / Snippet de Diagnóstico (Monospace)
                              </label>
                              <textarea
                                id="tech-command-textarea"
                                rows={2}
                                value={commandSnippet}
                                onChange={(e) => setCommandSnippet(e.target.value)}
                                className="w-full font-mono text-xs bg-slate-900 text-slate-100 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-400 border border-slate-800"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-slate-800">
                      Adicionar Informação ao Chamado (como {ticket.requesterName})
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="ticket-note-textarea"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      {isTechnician && noteVisibility === 'internal'
                        ? 'Parecer Técnico ou Mensagem entre Analistas'
                        : 'Mensagem ao Solicitante do Chamado'}
                    </label>
                    <textarea
                      id="ticket-note-textarea"
                      rows={3}
                      value={noteContent}
                      onChange={(e) => {
                        setNoteContent(e.target.value);
                        if (noteError) setNoteError('');
                      }}
                      className={`w-full text-xs sm:text-sm rounded-lg border p-2.5 focus:outline-none focus:ring-2 ${
                        isTechnician && noteVisibility === 'internal'
                          ? 'bg-white border-amber-300 focus:ring-amber-500 text-slate-900'
                          : 'bg-white border-slate-300 focus:ring-blue-600 text-slate-900'
                      }`}
                    />
                    {noteError && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{noteError}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">
                      {isTechnician && noteVisibility === 'internal'
                        ? 'Sigilo garantido: nota técnica oculta para o usuário solicitante.'
                        : 'Registro gravado no histórico público do chamado.'}
                    </span>
                    <button
                      type="submit"
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs ${
                        isTechnician && noteVisibility === 'internal'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isTechnician
                        ? `Salvar ${
                            noteVisibility === 'internal'
                              ? 'Nota Técnica Interna'
                              : 'Resposta ao Solicitante'
                          }`
                        : 'Enviar Mensagem'}
                    </button>
                  </div>
                </form>

                {/* Notes List */}
                {visibleNotes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                    Nenhum registro de comunicação encontrado para os filtros selecionados.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleNotes.map((note: TicketNote) => {
                      const isInternal = note.visibility === 'internal';
                      return (
                        <div
                          key={note.id}
                          className={`rounded-xl border transition-all text-xs sm:text-sm ${
                            isInternal
                              ? 'bg-amber-50/40 border-amber-300/80 shadow-xs'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* Note Header */}
                          <div
                            className={`px-3.5 py-2.5 rounded-t-xl border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
                              isInternal
                                ? 'bg-amber-100/60 border-amber-200 text-amber-950'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900">
                                {note.authorName}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">{note.authorRole}</span>
                              {isInternal && (
                                <>
                                  <span
                                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white tracking-wide uppercase flex items-center gap-1"
                                  >
                                    <Lock className="w-3 h-3" />
                                    {note.category
                                      ? TECHNICAL_CATEGORIES.find((c) => c.id === note.category)?.label || note.category
                                      : 'Nota Técnica Interna'}
                                  </span>

                                  {note.targetTechName && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-200/80 text-amber-900 flex items-center gap-1">
                                      <Users className="w-3 h-3 text-amber-800" />
                                      Destino: {note.targetTechName}
                                    </span>
                                  )}
                                </>
                              )}
                              {!isInternal && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">
                                  Resposta Pública ao Solicitante
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-slate-500 tabular-nums">
                              {note.createdAt}
                            </span>
                          </div>

                          {/* Note Body */}
                          <div className="p-3.5 space-y-2.5">
                            <p className="text-slate-800 leading-relaxed whitespace-pre-line">
                              {note.content}
                            </p>

                            {/* Command Snippet Block */}
                            {note.commandSnippet && (
                              <div className="mt-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 p-3 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                                  <span className="font-mono flex items-center gap-1 text-amber-400">
                                    <Terminal className="w-3.5 h-3.5" />
                                    Comandos Executados / Log de Diagnóstico
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopySnippet(note.id, note.commandSnippet!)
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans flex items-center gap-1 transition-colors"
                                  >
                                    {copiedSnippetId === note.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        Copiado
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 text-slate-300" />
                                        Copiar
                                      </>
                                    )}
                                  </button>
                                </div>
                                <pre className="font-mono text-xs overflow-x-auto text-emerald-300 py-1 leading-normal selection:bg-emerald-900 selection:text-white">
                                  {note.commandSnippet}
                                </pre>
                              </div>
                            )}

                            {isInternal && (
                              <div className="pt-2 border-t border-amber-200/50 flex items-center justify-between text-[11px] text-amber-900/80 font-medium">
                                <span className="flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-amber-700" />
                                  Canal Restrito aos Técnicos (Invisível ao solicitante)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Audit Trail List */
              <div className="space-y-2.5">
                {ticket.auditTrail.map((event, idx) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white text-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-mono font-semibold text-blue-700 shrink-0 mt-0.5">
                      {ticket.auditTrail.length - idx}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-slate-900">
                          {event.actor}
                        </span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {event.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
};
