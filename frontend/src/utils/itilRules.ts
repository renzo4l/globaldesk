import {
  GlobalDeskViewId,
  ImpactLevel,
  KnowledgeArticle,
  PriorityLevel,
  SlaHealth,
  SlaMetrics,
  Technician,
  TechnicianId,
  Ticket,
  TicketCategory,
  TicketFilterState,
  TicketStatus,
  UrgencyLevel,
  ZendeskViewId,
} from '../types/itsm';

/**
 * Official ITIL v4 Priority Matrix:
 * Crosses Impact (Organização, Setor, Usuário Único) × Urgency (Crítica, Alta, Média, Baixa)
 * to dynamically derive Priority (Crítica, Alta, Média, Baixa).
 */
export const ITIL_PRIORITY_MATRIX: Record<
  ImpactLevel,
  Record<UrgencyLevel, PriorityLevel>
> = {
  Organização: {
    Crítica: 'Crítica',
    Alta: 'Crítica',
    Média: 'Alta',
    Baixa: 'Média',
  },
  Setor: {
    Crítica: 'Crítica',
    Alta: 'Alta',
    Média: 'Média',
    Baixa: 'Baixa',
  },
  'Usuário Único': {
    Crítica: 'Alta',
    Alta: 'Média',
    Média: 'Baixa',
    Baixa: 'Baixa',
  },
};

export interface SlaTargetPolicy {
  priority: PriorityLevel;
  firstResponseTargetMinutes: number;
  resolutionTargetMinutes: number;
  firstResponseLabel: string;
  resolutionLabel: string;
  escalationRule: string;
  label: string;
  code: 'P1' | 'P2' | 'P3' | 'P4';
}

export const SLA_POLICY_BY_PRIORITY: Record<PriorityLevel, SlaTargetPolicy> = {
  Crítica: {
    priority: 'Crítica',
    firstResponseTargetMinutes: 15,
    resolutionTargetMinutes: 60,
    firstResponseLabel: '15 min',
    resolutionLabel: '1 hora',
    escalationRule: 'Escalonamento imediato para Alexandre (N3 · Resp. Setor)',
    label: '15m 1ª resp · 1h resolução',
    code: 'P1',
  },
  Alta: {
    priority: 'Alta',
    firstResponseTargetMinutes: 30,
    resolutionTargetMinutes: 240,
    firstResponseLabel: '30 min',
    resolutionLabel: '4 horas',
    escalationRule: 'Escalonamento automático N2 (Mauricio) se exceder 60 min',
    label: '30m 1ª resp · 4h resolução',
    code: 'P2',
  },
  Média: {
    priority: 'Média',
    firstResponseTargetMinutes: 60,
    resolutionTargetMinutes: 480,
    firstResponseLabel: '1 hora',
    resolutionLabel: '8 horas',
    escalationRule: 'Atendimento N1 (Elias) ou N2 (Mauricio) conforme categoria',
    label: '1h 1ª resp · 8h resolução',
    code: 'P3',
  },
  Baixa: {
    priority: 'Baixa',
    firstResponseTargetMinutes: 240,
    resolutionTargetMinutes: 1440,
    firstResponseLabel: '4 horas',
    resolutionLabel: '24 horas',
    escalationRule: 'Fluxo padrão de Requisição de Serviço N1 (Elias)',
    label: '4h 1ª resp · 24h resolução',
    code: 'P4',
  },
};

export function calculateItilPriority(
  impact: ImpactLevel,
  urgency: UrgencyLevel
): PriorityLevel {
  return ITIL_PRIORITY_MATRIX[impact][urgency];
}

export function evaluateSlaHealth(
  remainingMinutes: number,
  targetMinutes: number,
  isResolved: boolean
): SlaHealth {
  if (isResolved) {
    return 'completed';
  }
  if (remainingMinutes < 0) {
    return 'breached';
  }
  // Warning threshold: 25% of target time or <= 30 minutes remaining
  const threshold = Math.max(30, Math.round(targetMinutes * 0.25));
  if (remainingMinutes <= threshold) {
    return 'expiring_soon';
  }
  return 'healthy';
}

export function buildInitialSlaMetrics(priority: PriorityLevel): SlaMetrics {
  const policy = SLA_POLICY_BY_PRIORITY[priority];
  return {
    firstResponseTargetMinutes: policy.firstResponseTargetMinutes,
    resolutionTargetMinutes: policy.resolutionTargetMinutes,
    firstResponseRemainingMinutes: policy.firstResponseTargetMinutes,
    firstResponseElapsedMinutes: 0,
    resolutionRemainingMinutes: policy.resolutionTargetMinutes,
    firstResponseMet: false,
    health: evaluateSlaHealth(
      policy.resolutionTargetMinutes,
      policy.resolutionTargetMinutes,
      false
    ),
  };
}

export function formatMinutesDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const prefix = minutes < 0 ? '-' : '';

  if (hours === 0) {
    return `${prefix}${mins}m`;
  }
  if (mins === 0) {
    return `${prefix}${hours}h`;
  }
  return `${prefix}${hours}h ${mins}m`;
}

export function filterTickets(
  tickets: Ticket[],
  filters: TicketFilterState
): Ticket[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return tickets.filter((ticket) => {
    if (filters.status !== 'Todos' && ticket.status !== filters.status) {
      return false;
    }
    if (
      filters.priority !== 'Todas' &&
      ticket.priority !== filters.priority
    ) {
      return false;
    }
    if (filters.tier !== 'Todos' && ticket.tier !== filters.tier) {
      return false;
    }
    if (
      filters.assigneeId !== 'Todos' &&
      ticket.assigneeId !== filters.assigneeId
    ) {
      return false;
    }
    if (filters.type !== 'Todos' && ticket.type !== filters.type) {
      return false;
    }

    if (normalizedSearch.length > 0) {
      const searchable = [
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.requesterName,
        ticket.department,
        ticket.category,
        ticket.channel || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });
}

export function filterTicketsByGlobalDeskView(
  tickets: Ticket[],
  viewId: GlobalDeskViewId,
  activeTechId: TechnicianId
): Ticket[] {
  switch (viewId) {
    case 'critical_unresolved':
      return tickets.filter(
        (t) => t.status !== 'Resolvido' && t.priority === 'Crítica'
      );
    case 'assigned_to_me':
      return tickets.filter(
        (t) => t.status !== 'Resolvido' && t.assigneeId === activeTechId
      );
    case 'tier_n1_elias':
      return tickets.filter(
        (t) =>
          t.status !== 'Resolvido' &&
          (t.assigneeId === 'elias' || t.tier === 'N1')
      );
    case 'tier_n2_mauricio':
      return tickets.filter(
        (t) =>
          t.status !== 'Resolvido' &&
          (t.assigneeId === 'mauricio' || t.tier === 'N2')
      );
    case 'tier_n3_alexandre':
      return tickets.filter(
        (t) =>
          t.status !== 'Resolvido' &&
          (t.assigneeId === 'alexandre' || t.tier === 'N3')
      );
    case 'pending_requester':
      return tickets.filter((t) => t.status === 'Aguardando Usuário');
    case 'sla_at_risk':
      return tickets.filter(
        (t) =>
          t.status !== 'Resolvido' &&
          (t.sla.health === 'expiring_soon' || t.sla.health === 'breached')
      );
    case 'recently_resolved':
      return tickets.filter((t) => t.status === 'Resolvido');
    case 'service_orders':
      return tickets.filter((t) => t.status === 'Resolvido');
    default:
      return tickets;
  }
}

export const filterTicketsByZendeskView = filterTicketsByGlobalDeskView;

export function calculateGlobalDeskViewCounts(
  tickets: Ticket[],
  activeTechId: TechnicianId,
  serviceOrdersCount: number
): Record<GlobalDeskViewId, number> {
  return {
    critical_unresolved: filterTicketsByGlobalDeskView(
      tickets,
      'critical_unresolved',
      activeTechId
    ).length,
    assigned_to_me: filterTicketsByGlobalDeskView(
      tickets,
      'assigned_to_me',
      activeTechId
    ).length,
    tier_n1_elias: filterTicketsByGlobalDeskView(
      tickets,
      'tier_n1_elias',
      activeTechId
    ).length,
    tier_n2_mauricio: filterTicketsByGlobalDeskView(
      tickets,
      'tier_n2_mauricio',
      activeTechId
    ).length,
    tier_n3_alexandre: filterTicketsByGlobalDeskView(
      tickets,
      'tier_n3_alexandre',
      activeTechId
    ).length,
    pending_requester: filterTicketsByGlobalDeskView(
      tickets,
      'pending_requester',
      activeTechId
    ).length,
    sla_at_risk: filterTicketsByGlobalDeskView(
      tickets,
      'sla_at_risk',
      activeTechId
    ).length,
    recently_resolved: filterTicketsByGlobalDeskView(
      tickets,
      'recently_resolved',
      activeTechId
    ).length,
    service_orders: serviceOrdersCount,
  };
}

export const calculateZendeskViewCounts = calculateGlobalDeskViewCounts;

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  Crítica: 4,
  Alta: 3,
  Média: 2,
  Baixa: 1,
};

/**
 * Next Ticket Routing ("Reproduzir Fila / Play"):
 * Selects the highest priority unresolved ticket, breaking ties by lowest remaining SLA minutes.
 */
export function getNextPriorityTicketForPlay(
  tickets: Ticket[]
): Ticket | null {
  const unresolved = tickets.filter((t) => t.status !== 'Resolvido');
  if (unresolved.length === 0) return null;

  const sorted = [...unresolved].sort((a, b) => {
    const weightDiff =
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (weightDiff !== 0) return weightDiff;
    return (
      a.sla.resolutionRemainingMinutes - b.sla.resolutionRemainingMinutes
    );
  });

  return sorted[0] || null;
}

export interface GlobalDeskStatusBadgeMeta {
  letter: 'N' | 'O' | 'P' | 'R';
  label: TicketStatus;
  englishCode: 'New' | 'Open' | 'Pending' | 'Solved';
  bgClass: string;
}

export type ZendeskStatusBadgeMeta = GlobalDeskStatusBadgeMeta;

export function getGlobalDeskStatusBadgeMeta(
  status: TicketStatus
): GlobalDeskStatusBadgeMeta {
  switch (status) {
    case 'Novo':
      return {
        letter: 'N',
        label: 'Novo',
        englishCode: 'New',
        bgClass: 'bg-amber-500 text-white border-amber-600',
      };
    case 'Em Atendimento':
      return {
        letter: 'O',
        label: 'Em Atendimento',
        englishCode: 'Open',
        bgClass: 'bg-blue-600 text-white border-blue-700',
      };
    case 'Aguardando Usuário':
      return {
        letter: 'P',
        label: 'Aguardando Usuário',
        englishCode: 'Pending',
        bgClass: 'bg-purple-600 text-white border-purple-700',
      };
    case 'Resolvido':
      return {
        letter: 'R',
        label: 'Resolvido',
        englishCode: 'Solved',
        bgClass: 'bg-emerald-600 text-white border-emerald-700',
      };
  }
}

export const getZendeskStatusBadgeMeta = getGlobalDeskStatusBadgeMeta;

export interface DashboardKpis {
  totalOpenTickets: number;
  totalResolvedTickets: number;
  slaCompliancePercent: number;
  criticalOpenCount: number;
  expiringSoonCount: number;
  breachedOpenCount: number;
  avgResolutionMinutes: number;
}

export function calculateDashboardKpis(tickets: Ticket[]): DashboardKpis {
  const openTickets = tickets.filter((t) => t.status !== 'Resolvido');
  const resolvedTickets = tickets.filter((t) => t.status === 'Resolvido');

  const compliantTickets = tickets.filter(
    (t) => t.sla.health !== 'breached' && t.sla.resolutionRemainingMinutes >= 0
  );

  const slaCompliancePercent =
    tickets.length === 0
      ? 100
      : Math.round((compliantTickets.length / tickets.length) * 100);

  const criticalOpenCount = openTickets.filter(
    (t) => t.priority === 'Crítica'
  ).length;

  const expiringSoonCount = openTickets.filter(
    (t) => t.sla.health === 'expiring_soon'
  ).length;

  const breachedOpenCount = openTickets.filter(
    (t) => t.sla.health === 'breached'
  ).length;

  // Calculate average elapsed resolution minutes across tickets
  const elapsedSamples = tickets.map((t) => {
    const elapsed =
      t.sla.resolutionTargetMinutes - t.sla.resolutionRemainingMinutes;
    return Math.max(12, elapsed);
  });

  const avgResolutionMinutes =
    elapsedSamples.length === 0
      ? 0
      : Math.round(
          elapsedSamples.reduce((acc, curr) => acc + curr, 0) /
            elapsedSamples.length
        );

  return {
    totalOpenTickets: openTickets.length,
    totalResolvedTickets: resolvedTickets.length,
    slaCompliancePercent,
    criticalOpenCount,
    expiringSoonCount,
    breachedOpenCount,
    avgResolutionMinutes,
  };
}

export function searchKnowledgeArticles(
  articles: KnowledgeArticle[],
  query: string,
  categoryFilter?: TicketCategory | 'Todas'
): KnowledgeArticle[] {
  const normalized = query.trim().toLowerCase();

  return articles.filter((article) => {
    if (
      categoryFilter &&
      categoryFilter !== 'Todas' &&
      article.category !== categoryFilter
    ) {
      return false;
    }
    if (!normalized) {
      return true;
    }
    const text = [
      article.id,
      article.title,
      article.category,
      article.summary,
      ...article.steps,
    ]
      .join(' ')
      .toLowerCase();
    return text.includes(normalized);
  });
}

export function generateNextTicketProtocol(existingTickets: Ticket[]): string {
  const numbers = existingTickets
    .map((t) => {
      const match = t.id.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 1000;
    })
    .filter((n) => !Number.isNaN(n));

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 1048;
  return `#TICK-2026-${maxNumber + 1}`;
}

export interface CategoryChartDatum {
  category: TicketCategory;
  shortLabel: string;
  total: number;
  openCount: number;
  resolvedCount: number;
}

export function calculateTicketsPerCategory(
  tickets: Ticket[]
): CategoryChartDatum[] {
  const categories: TicketCategory[] = [
    'Acessos/Sistemas',
    'Rede',
    'Hardware',
    'Software',
    'Telefonia',
  ];

  const shortMap: Record<TicketCategory, string> = {
    'Acessos/Sistemas': 'Acessos',
    Rede: 'Rede',
    Hardware: 'Hardware',
    Software: 'Software',
    Telefonia: 'Telefonia',
  };

  return categories.map((category) => {
    const matching = tickets.filter((t) => t.category === category);
    const openCount = matching.filter((t) => t.status !== 'Resolvido').length;
    const resolvedCount = matching.filter(
      (t) => t.status === 'Resolvido'
    ).length;

    return {
      category,
      shortLabel: shortMap[category],
      total: matching.length,
      openCount,
      resolvedCount,
    };
  });
}

export interface TechnicianResolutionChartDatum {
  id: TechnicianId;
  name: string;
  tier: string;
  avgResolutionMinutes: number;
  activeTickets: number;
  totalAssigned: number;
}

export function calculateResolutionTimePerTechnician(
  tickets: Ticket[],
  technicians: Technician[]
): TechnicianResolutionChartDatum[] {
  return technicians.map((tech) => {
    const assigned = tickets.filter((t) => t.assigneeId === tech.id);
    const activeTickets = assigned.filter(
      (t) => t.status !== 'Resolvido'
    ).length;

    if (assigned.length === 0) {
      return {
        id: tech.id,
        name: tech.name,
        tier: tech.tier,
        avgResolutionMinutes: tech.avgResolutionMinutes,
        activeTickets: 0,
        totalAssigned: 0,
      };
    }

    const totalElapsed = assigned.reduce((sum, t) => {
      const elapsed =
        t.sla.resolutionTargetMinutes - t.sla.resolutionRemainingMinutes;
      return sum + Math.max(15, elapsed);
    }, 0);

    const dynamicAvg = Math.round(
      (totalElapsed / assigned.length + tech.avgResolutionMinutes) / 2
    );

    return {
      id: tech.id,
      name: `${tech.name} (${tech.tier})`,
      tier: tech.tier,
      avgResolutionMinutes: dynamicAvg,
      activeTickets,
      totalAssigned: assigned.length,
    };
  });
}

export interface ResolvedByTechnicianChartDatum {
  id: TechnicianId;
  name: string;
  tier: string;
  resolvedCount: number;
  openCount: number;
  totalTickets: number;
  resolutionRatePercent: number;
}

export function calculateResolvedTicketsPerTechnician(
  tickets: Ticket[],
  technicians: Technician[]
): ResolvedByTechnicianChartDatum[] {
  return technicians.map((tech) => {
    const assigned = tickets.filter((t) => t.assigneeId === tech.id);
    const resolvedCount = assigned.filter((t) => t.status === 'Resolvido').length;
    const openCount = assigned.length - resolvedCount;
    const resolutionRatePercent =
      assigned.length === 0
        ? 0
        : Math.round((resolvedCount / assigned.length) * 100);

    return {
      id: tech.id,
      name: tech.name,
      tier: tech.tier,
      resolvedCount,
      openCount,
      totalTickets: assigned.length,
      resolutionRatePercent,
    };
  });
}

export interface AvgResolutionTimePerCategoryChartDatum {
  category: TicketCategory;
  shortLabel: string;
  avgResolutionMinutes: number;
  formattedDuration: string;
  ticketsSampled: number;
  slaTargetMinutes: number;
}

export function calculateAvgResolutionTimePerCategory(
  tickets: Ticket[]
): AvgResolutionTimePerCategoryChartDatum[] {
  const categories: TicketCategory[] = [
    'Hardware',
    'Software',
    'Rede',
    'Acessos/Sistemas',
    'Telefonia',
  ];

  const shortMap: Record<TicketCategory, string> = {
    Hardware: 'Hardware',
    Software: 'Software',
    Rede: 'Rede',
    'Acessos/Sistemas': 'Acessos',
    Telefonia: 'Telefonia',
  };

  const defaultCategoryTarget: Record<TicketCategory, number> = {
    Hardware: 240,
    Software: 180,
    Rede: 120,
    'Acessos/Sistemas': 90,
    Telefonia: 120,
  };

  return categories.map((cat) => {
    const categoryTickets = tickets.filter((t) => t.category === cat);
    if (categoryTickets.length === 0) {
      return {
        category: cat,
        shortLabel: shortMap[cat],
        avgResolutionMinutes: 0,
        formattedDuration: '0m',
        ticketsSampled: 0,
        slaTargetMinutes: defaultCategoryTarget[cat],
      };
    }

    const elapsedValues = categoryTickets.map((t) => {
      const elapsed =
        t.sla.resolutionTargetMinutes - t.sla.resolutionRemainingMinutes;
      return Math.max(10, elapsed);
    });

    const avgMinutes = Math.round(
      elapsedValues.reduce((acc, curr) => acc + curr, 0) /
        elapsedValues.length
    );

    return {
      category: cat,
      shortLabel: shortMap[cat],
      avgResolutionMinutes: avgMinutes,
      formattedDuration: formatMinutesDuration(avgMinutes),
      ticketsSampled: categoryTickets.length,
      slaTargetMinutes: defaultCategoryTarget[cat],
    };
  });
}

export interface SlaComplianceBreakdown {
  totalTickets: number;
  compliantCount: number;
  breachedCount: number;
  atRiskCount: number;
  complianceRatePercent: number;
  complianceByPriority: {
    priority: PriorityLevel;
    code: string;
    total: number;
    compliant: number;
    ratePercent: number;
    targetText: string;
  }[];
}

export function calculateSlaComplianceBreakdown(
  tickets: Ticket[]
): SlaComplianceBreakdown {
  const total = tickets.length;
  if (total === 0) {
    return {
      totalTickets: 0,
      compliantCount: 0,
      breachedCount: 0,
      atRiskCount: 0,
      complianceRatePercent: 100,
      complianceByPriority: [
        { priority: 'Crítica', code: 'P1', total: 0, compliant: 0, ratePercent: 100, targetText: '1h' },
        { priority: 'Alta', code: 'P2', total: 0, compliant: 0, ratePercent: 100, targetText: '4h' },
        { priority: 'Média', code: 'P3', total: 0, compliant: 0, ratePercent: 100, targetText: '8h' },
        { priority: 'Baixa', code: 'P4', total: 0, compliant: 0, ratePercent: 100, targetText: '24h' },
      ],
    };
  }

  const compliant = tickets.filter(
    (t) => t.sla.health !== 'breached' && t.sla.resolutionRemainingMinutes >= 0
  );
  const breached = tickets.filter(
    (t) => t.sla.health === 'breached' || t.sla.resolutionRemainingMinutes < 0
  );
  const atRisk = tickets.filter(
    (t) => t.status !== 'Resolvido' && t.sla.health === 'expiring_soon'
  );

  const priorities: { priority: PriorityLevel; code: string; targetText: string }[] = [
    { priority: 'Crítica', code: 'P1', targetText: '1h' },
    { priority: 'Alta', code: 'P2', targetText: '4h' },
    { priority: 'Média', code: 'P3', targetText: '8h' },
    { priority: 'Baixa', code: 'P4', targetText: '24h' },
  ];

  const complianceByPriority = priorities.map((p) => {
    const list = tickets.filter((t) => t.priority === p.priority);
    const pass = list.filter(
      (t) => t.sla.health !== 'breached' && t.sla.resolutionRemainingMinutes >= 0
    );
    const rate = list.length === 0 ? 100 : Math.round((pass.length / list.length) * 100);
    return {
      priority: p.priority,
      code: p.code,
      total: list.length,
      compliant: pass.length,
      ratePercent: rate,
      targetText: p.targetText,
    };
  });

  return {
    totalTickets: total,
    compliantCount: compliant.length,
    breachedCount: breached.length,
    atRiskCount: atRisk.length,
    complianceRatePercent: Math.round((compliant.length / total) * 100),
    complianceByPriority,
  };
}


export type CollaboratorTicketTab =
  | 'todos'
  | 'abertos'
  | 'aguardando_resposta'
  | 'resolvidos';

export interface CollaboratorFriendlyStatusMeta {
  friendlyLabel: string;
  description: string;
  badgeClass: string;
  dotClass: string;
}

export function getCollaboratorFriendlyStatus(
  status: TicketStatus
): CollaboratorFriendlyStatusMeta {
  switch (status) {
    case 'Novo':
      return {
        friendlyLabel: 'Em Análise',
        description: 'Na fila de triagem da equipe técnica',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        dotClass: 'bg-blue-600',
      };
    case 'Em Atendimento':
      return {
        friendlyLabel: 'Em Atendimento',
        description: 'Analista atuando no diagnóstico',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dotClass: 'bg-indigo-600',
      };
    case 'Aguardando Usuário':
      return {
        friendlyLabel: 'Aguardando Você',
        description: 'Requer retorno ou validação do solicitante',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
        dotClass: 'bg-amber-500 animate-pulse',
      };
    case 'Resolvido':
      return {
        friendlyLabel: 'Concluído',
        description: 'Atendimento finalizado com laudo técnico',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-600',
      };
  }
}

export function filterCollaboratorTickets(
  tickets: Ticket[],
  tab: CollaboratorTicketTab,
  searchQuery: string,
  departmentFilter: string = 'Todos'
): Ticket[] {
  const normalized = searchQuery.trim().toLowerCase();

  return tickets.filter((ticket) => {
    if (departmentFilter !== 'Todos' && ticket.department !== departmentFilter) {
      return false;
    }

    if (tab === 'abertos') {
      if (ticket.status !== 'Novo' && ticket.status !== 'Em Atendimento') {
        return false;
      }
    } else if (tab === 'aguardando_resposta') {
      if (ticket.status !== 'Aguardando Usuário') {
        return false;
      }
    } else if (tab === 'resolvidos') {
      if (ticket.status !== 'Resolvido') {
        return false;
      }
    }

    if (normalized.length > 0) {
      const hay = [
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.category,
        ticket.department,
        ticket.requesterName,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(normalized)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Contextual Automatic Suggestion for NewTicketModal:
 * Scores Knowledge Base articles against the user's typed ticket subject/title and selected category,
 * returning up to `limit` relevant self-service articles to deflect avoidable tickets.
 */
export function suggestContextualArticlesForTicket(
  articles: KnowledgeArticle[],
  titleQuery: string,
  category?: TicketCategory,
  limit = 2
): KnowledgeArticle[] {
  const trimmed = titleQuery.trim().toLowerCase();
  if (trimmed.length < 3) {
    return [];
  }

  const tokens = trimmed
    .split(/\s+/)
    .map((tok) => tok.replace(/[^a-z0-9à-ú]/gi, ''))
    .filter((tok) => tok.length >= 3);

  const scored = articles
    .map((article) => {
      let score = 0;
      const titleLower = article.title.toLowerCase();
      const summaryLower = article.summary.toLowerCase();
      const stepsLower = article.steps.join(' ').toLowerCase();
      const categoryLower = article.category.toLowerCase();

      if (titleLower.includes(trimmed) || summaryLower.includes(trimmed)) {
        score += 10;
      }

      for (const token of tokens) {
        if (titleLower.includes(token)) score += 5;
        if (summaryLower.includes(token)) score += 3;
        if (stepsLower.includes(token)) score += 2;
        if (categoryLower.includes(token)) score += 2;
      }

      if (category && article.category === category && score > 0) {
        score += 3;
      }

      return { article, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.article.helpfulCount - a.article.helpfulCount);

  return scored.slice(0, limit).map((entry) => entry.article);
}

