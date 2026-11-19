import {
  Department,
  FinalizationOutcome,
  ImpactLevel,
  InterventionType,
  KnowledgeArticle,
  ServiceOrder,
  SupportTier,
  SystemUser,
  SystemUserRole,
  TechnicianId,
  Ticket,
  TicketCategory,
  TicketStatus,
  UrgencyLevel,
} from '../types/itsm';
import { KbArticle } from '../components/KnowledgeBaseManager';
import { formatTicketTimestamp } from './formatters';
import { buildInitialSlaMetrics } from './itilRules';

/**
 * Converte um registro de usuário vindo do PostgreSQL/Prisma para o modelo SystemUser do frontend.
 */
export function mapServerUserToFrontend(u: any): SystemUser {
  let roleName: SystemUserRole = 'Colaborador Solicitante';
  if (u.role === 'ANALISTA_N1') roleName = 'Analista N1 (Service Desk)';
  else if (u.role === 'ANALISTA_N2') roleName = 'Analista N2 (Infraestrutura/Redes)';
  else if (u.role === 'ANALISTA_N3') roleName = 'Analista N3 (Coordenação/Sistemas)';
  else if (u.role === 'ADMIN') roleName = 'Administrador de TI';
  else if (u.role === 'COLABORADOR') roleName = 'Colaborador Solicitante';

  return {
    id: u.id,
    fullName: u.name,
    email: u.email,
    role: roleName,
    tier: u.tier || undefined,
    department: u.department || 'Engenharia & TI',
    isGoogleVerified: Boolean(u.isGoogleVerified),
    googleAccountDomain:
      u.googleAccountDomain ||
      (import.meta.env.VITE_WORKSPACE_DOMAIN || 'corporativo.com.br').trim(),
    createdAt: u.createdAt
      ? new Date(u.createdAt).toLocaleDateString('pt-BR')
      : 'Recente',
    status: u.status === 'Suspenso' ? 'Suspenso' : 'Ativo',
    avatarInitials:
      u.avatarInitials || (u.name ? u.name.slice(0, 2).toUpperCase() : 'US'),
    isSuperAdmin: u.role === 'ADMIN' || u.id === 'usr-alexandre',
  };
}

/**
 * Converte um chamado vindo do PostgreSQL/Prisma para o modelo Ticket do frontend.
 */
export function mapServerTicketToFrontend(raw: any): Ticket {
  if (raw.requesterName && Array.isArray(raw.attachments)) {
    return raw as Ticket;
  }

  const impactMap: Record<string, ImpactLevel> = {
    ORGANIZACAO: 'Organização',
    SETOR: 'Setor',
    USUARIO_UNICO: 'Usuário Único',
  };
  const urgencyMap: Record<string, UrgencyLevel> = {
    CRITICA: 'Crítica',
    ALTA: 'Alta',
    MEDIA: 'Média',
    BAIXA: 'Baixa',
  };
  const priorityMap: Record<string, Ticket['priority']> = {
    CRITICA: 'Crítica',
    ALTA: 'Alta',
    MEDIA: 'Média',
    BAIXA: 'Baixa',
  };
  const statusMap: Record<string, TicketStatus> = {
    NOVO: 'Novo',
    EM_ATENDIMENTO: 'Em Atendimento',
    AGUARDANDO_USUARIO: 'Aguardando Usuário',
    RESOLVIDO: 'Resolvido',
  };
  const assigneeMap: Record<string, TechnicianId> = {
    'usr-mauricio': 'mauricio',
    'usr-alexandre': 'alexandre',
    'usr-elias': 'elias',
    mauricio: 'mauricio',
    alexandre: 'alexandre',
    elias: 'elias',
  };

  const mappedPriority = priorityMap[raw.priority] || 'Média';
  const defaultSla = buildInitialSlaMetrics(mappedPriority);

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    type:
      raw.type === 'REQUISICAO_SERVICO' || raw.type === 'Requisição de Serviço'
        ? 'Requisição de Serviço'
        : 'Incidente',
    category: (raw.category as TicketCategory) || 'Rede',
    channel: 'Portal Web',
    department: (raw.department as Department) || 'Operações',
    requesterName:
      raw.requester?.name || raw.requesterName || 'Colaborador Solicitante',
    requesterEmail:
      raw.requester?.email ||
      raw.requesterEmail ||
      'colaborador@corporativo.com.br',
    impact: impactMap[raw.impact] || raw.impact || 'Setor',
    urgency: urgencyMap[raw.urgency] || raw.urgency || 'Média',
    priority: mappedPriority,
    status: statusMap[raw.status] || raw.status || 'Novo',
    tier: (raw.tier as SupportTier) || 'N1',
    assigneeId: assigneeMap[raw.assigneeId] || 'alexandre',
    createdAt: formatTicketTimestamp(raw.createdAt, 'Agora'),
    updatedAt: formatTicketTimestamp(raw.updatedAt, 'Agora'),
    sla: raw.sla
      ? {
          firstResponseTargetMinutes: raw.sla.firstResponseTargetMinutes,
          firstResponseElapsedMinutes: raw.sla.firstResponseElapsedMinutes ?? 0,
          firstResponseRemainingMinutes: Math.max(
            0,
            raw.sla.firstResponseTargetMinutes -
              (raw.sla.firstResponseElapsedMinutes ?? 0)
          ),
          firstResponseMet: Boolean(raw.sla.firstResponseMet),
          resolutionTargetMinutes: raw.sla.resolutionTargetMinutes,
          resolutionRemainingMinutes: raw.sla.resolutionRemainingMinutes,
          health: raw.sla.health || 'within_sla',
        }
      : defaultSla,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    notes: [...(raw.notes || [])]
      .sort((a: any, b: any) => {
        const ta = Date.parse(a.createdAt || '');
        const tb = Date.parse(b.createdAt || '');
        if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
        return 0;
      })
      .map((n: any) => {
        const rawAuthorRole = n.author?.role || n.authorRole || 'Equipe Técnica';
        const friendlyRole =
          rawAuthorRole === 'COLABORADOR' || rawAuthorRole === 'Colaborador'
            ? 'Colaborador'
            : rawAuthorRole;
        return {
          ...n,
          id: n.id,
          authorName: n.author?.name || n.authorName || 'Analista',
          authorRole: friendlyRole,
          visibility: n.visibility ? String(n.visibility).toLowerCase() : 'public',
          category: n.category || undefined,
          targetTechName: n.targetTechName || undefined,
          commandSnippet: n.commandSnippet || undefined,
          content: n.content,
          createdAt: formatTicketTimestamp(n.createdAt, 'Agora'),
        };
      }),
    auditTrail: (raw.auditTrail || []).map((a: any) => ({
      ...a,
      id: a.id,
      actor: a.actorName || a.actor || 'Sistema',
      actionType: a.actionType || 'created',
      description: a.description,
      timestamp: a.timestamp || formatTicketTimestamp(a.createdAt, 'Agora'),
    })),
  };
}

/**
 * Converte uma Ordem de Serviço vinda do PostgreSQL/Prisma para o modelo ServiceOrder do frontend.
 */
export function mapServerOrderToFrontend(o: any): ServiceOrder {
  return {
    id: o.id,
    ticketId: o.ticketId,
    ticketTitle: o.ticketTitle || o.ticket?.title || 'Chamado de Suporte',
    ticketDescription: o.ticketDescription || o.ticket?.description || '',
    category: (o.category || o.ticket?.category || 'Rede') as TicketCategory,
    requesterName:
      o.requesterName || o.ticket?.requester?.name || 'Colaborador Solicitante',
    requesterEmail:
      o.requesterEmail ||
      o.ticket?.requester?.email ||
      'colaborador@corporativo.com.br',
    department: (o.department ||
      o.ticket?.department ||
      'Operações') as Department,
    startedAt: o.startedAt,
    finalizedAt: o.finalizedAt,
    durationText: o.durationText,
    technicianId: (o.technicianId?.replace(/^usr-/, '') ||
      'mauricio') as TechnicianId,
    technicianName:
      o.technicianName || o.technician?.name || 'Técnico Responsável',
    technicianTier: (o.technicianTier ||
      o.technician?.tier ||
      'N3') as SupportTier,
    interventionType: o.interventionType as InterventionType,
    finalizationOutcome: o.finalizationOutcome as FinalizationOutcome,
    outcomeLabel: o.outcomeLabel,
    solutionSummary: o.solutionSummary,
    nonCompletionReason: o.nonCompletionReason || undefined,
    partsOrSupplies: o.partsOrSupplies || undefined,
    clientAcceptance: o.clientAcceptance,
    slaMet: Boolean(o.slaMet),
    createdAt: o.createdAt
      ? new Date(o.createdAt).toLocaleString('pt-BR')
      : o.finalizedAt,
  };
}

/**
 * Converte artigos publicados na Base de Conhecimento do PostgreSQL (KbArticle)
 * para o formato KnowledgeArticle do Portal de Autoatendimento e os mescla com a base padrão.
 */
export function mergeKnowledgeArticles(
  staticArticles: KnowledgeArticle[],
  dbArticles: KbArticle[]
): KnowledgeArticle[] {
  const categoryMap: Record<string, TicketCategory> = {
    'Rede & VPN': 'Rede',
    'Hardware & Impressoras': 'Hardware',
    'Sistemas & ERP': 'Software',
    'E-mail & Workspace': 'Acessos/Sistemas',
    'Acessos & Senhas': 'Acessos/Sistemas',
  };

  const mappedDb: KnowledgeArticle[] = dbArticles
    .filter((art) => art.isPublished)
    .map((art, index) => {
      const steps = art.content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const keywords = art.tags
        ? art.tags
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        : art.title.toLowerCase().split(/\s+/);

      return {
        id: art.id,
        code: `KB-DB-${String(index + 1).padStart(2, '0')}`,
        title: art.title,
        category: categoryMap[art.category] || 'Rede',
        summary: art.summary,
        steps: steps.length > 0 ? steps : [art.content],
        keywords,
        estimatedTime: '3 min',
        readTimeMinutes: 3,
        helpfulCount: 15,
        relatedType: 'Incidente',
      };
    });

  return [...mappedDb, ...staticArticles];
}

