export type ImpactLevel = 'Organização' | 'Setor' | 'Usuário Único';

export type UrgencyLevel = 'Crítica' | 'Alta' | 'Média' | 'Baixa';

export type PriorityLevel = 'Crítica' | 'Alta' | 'Média' | 'Baixa';

export type TicketType = 'Incidente' | 'Requisição de Serviço';

export type TicketCategory =
  | 'Hardware'
  | 'Software'
  | 'Rede'
  | 'Acessos/Sistemas'
  | 'Telefonia';

export type TicketStatus =
  | 'Novo'
  | 'Em Atendimento'
  | 'Aguardando Usuário'
  | 'Resolvido';

export type SupportTier = 'N1' | 'N2' | 'N3';

export type TechnicianId = 'elias' | 'alexandre' | 'mauricio';

export type TicketChannel =
  | 'Portal Web'
  | 'E-mail'
  | 'Chat Interno'
  | 'Sistema';

export type GlobalDeskViewId =
  | 'critical_unresolved'
  | 'assigned_to_me'
  | 'tier_n1_elias'
  | 'tier_n2_mauricio'
  | 'tier_n3_alexandre'
  | 'pending_requester'
  | 'sla_at_risk'
  | 'recently_resolved'
  | 'service_orders';

export type ZendeskViewId = GlobalDeskViewId;

export type Department =
  | 'Financeiro & Contabilidade'
  | 'Recursos Humanos'
  | 'Operações & Logística'
  | 'Comercial & Vendas'
  | 'Engenharia & TI'
  | 'Jurídico & Compliance'
  | 'Diretoria Executiva'
  | 'Suprimentos & Compras'
  | 'Financeiro'
  | 'Comercial'
  | 'Operações'
  | 'Logística';

export interface Technician {
  id: TechnicianId;
  name: string;
  fullName: string;
  role: string;
  roleTitle: string;
  isLead: boolean;
  tier: SupportTier;
  specialty: string;
  specialties: string[];
  avatarInitials: string;
  avgResolutionMinutes: number;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  fileType: 'image' | 'log' | 'document' | 'text/plain' | string;
  previewNote?: string;
}

export type TechnicalNoteCategory =
  | 'diagnostico'
  | 'alinhamento'
  | 'handoff'
  | 'infraestrutura'
  | 'escalonamento';

export interface TicketNote {
  id: string;
  authorName: string;
  authorRole: string;
  visibility: 'public' | 'internal';
  category?: TechnicalNoteCategory;
  targetTechName?: string;
  commandSnippet?: string;
  content: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  actionType:
    | 'created'
    | 'assigned'
    | 'status_changed'
    | 'escalated'
    | 'note_added'
    | 'priority_recalculated'
    | 'order_generated';
  description: string;
}

export type SlaHealth =
  | 'healthy'
  | 'within_sla'
  | 'expiring_soon'
  | 'breached'
  | 'completed'
  | 'completed_on_time'
  | 'completed_late';

export interface SlaMetrics {
  firstResponseTargetMinutes: number;
  resolutionTargetMinutes: number;
  firstResponseRemainingMinutes: number;
  firstResponseElapsedMinutes?: number;
  resolutionRemainingMinutes: number;
  firstResponseMet: boolean;
  health: SlaHealth;
}

export interface Ticket {
  id: string; // e.g., #TICK-2026-1042
  title: string;
  description: string;
  type: TicketType;
  category: TicketCategory;
  channel?: TicketChannel;
  department: Department;
  requesterName: string;
  requesterEmail: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: PriorityLevel;
  status: TicketStatus;
  tier: SupportTier;
  assigneeId: TechnicianId;
  createdAt: string;
  updatedAt: string;
  sla: SlaMetrics;
  attachments: TicketAttachment[];
  notes: TicketNote[];
  auditTrail: AuditLogItem[];
}

export interface KnowledgeArticle {
  id: string;
  code: string;
  title: string;
  category: TicketCategory;
  summary: string;
  steps: string[];
  keywords: string[];
  estimatedTime: string;
  readTimeMinutes: number;
  helpfulCount: number;
  relatedType: TicketType;
}

export interface TicketFilterState {
  search: string;
  status: TicketStatus | 'Todos';
  priority: PriorityLevel | 'Todas';
  tier: SupportTier | 'Todos';
  assigneeId: TechnicianId | 'Todos';
  type: TicketType | 'Todos';
}

export type InterventionType =
  | 'Remoto'
  | 'Presencial'
  | 'Infraestrutura / Datacenter'
  | 'Configuração de Sistema'
  | 'Suporte Remoto'
  | 'Atendimento Presencial'
  | 'Configuração de Software'
  | 'Manutenção de Hardware'
  | 'Infraestrutura / Redes';

export type FinalizationOutcome =
  | 'concluido_sucesso'
  | 'solucao_contorno'
  | 'nao_concluido'
  | 'cancelado_usuario'
  | 'fora_escopo';

export interface ServiceOrder {
  id: string; // Ex: OS-2026-0001
  ticketId: string; // Ex: #TICK-2026-1049
  ticketTitle: string;
  ticketDescription: string;
  category: TicketCategory;
  requesterName: string;
  requesterEmail: string;
  department: Department;
  startedAt: string;
  finalizedAt: string;
  durationText: string;
  technicianId: TechnicianId;
  technicianName: string;
  technicianTier: SupportTier;
  interventionType: InterventionType;
  finalizationOutcome: FinalizationOutcome;
  outcomeLabel: string;
  solutionSummary: string;
  nonCompletionReason?: string;
  partsOrSupplies?: string;
  clientAcceptance: string;
  slaMet: boolean;
  createdAt: string;
}

export type SystemUserRole =
  | 'Maior Administrador'
  | 'Administrador de TI'
  | 'Analista N1 (Service Desk)'
  | 'Analista N2 (Infraestrutura/Redes)'
  | 'Analista N3 (Coordenação/Sistemas)'
  | 'Auditor / Governança'
  | 'Colaborador Corporativo'
  | 'Colaborador Solicitante';

export interface SystemUser {
  id: string;
  fullName: string;
  email: string;
  role: SystemUserRole;
  tier?: SupportTier;
  department: Department;
  isGoogleVerified: boolean;
  googleAccountDomain: string;
  createdAt: string;
  status: 'Ativo' | 'Suspenso';
  avatarInitials: string;
  isSuperAdmin?: boolean;
}

export type NotificationType =
  | 'ticket_created'
  | 'status_changed'
  | 'ticket_escalated'
  | 'order_finalized';

export interface SystemNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: string;
  priority?: PriorityLevel;
  tier?: SupportTier;
  timestamp: string;
  soundType?: 'new_ticket' | 'escalation' | 'status_change';
}

// ============================================================================
// Gestão de Inventário & Ativos de TI (CMDB / Asset Management)
// ============================================================================

export type AssetCategory =
  | 'COMPUTADOR'
  | 'NOTEBOOK'
  | 'MONITOR'
  | 'PERIFERICO'
  | 'IMPRESSORA'
  | 'REDE_SERVIDOR'
  | 'CELULAR_TABLET'
  | 'LICENCA_SOFTWARE'
  | 'OUTROS';

export type AssetStatus =
  | 'DISPONIVEL'
  | 'EM_USO'
  | 'MANUTENCAO'
  | 'BAIXADO_DESCARTADO';

export type AssetCondition = 'NOVO' | 'BOM' | 'DESGASTADO' | 'DEFEITUOSO';

export type MovementType =
  | 'AQUISICAO'
  | 'MOVIMENTACAO_ENTREGA'
  | 'DEVOLUCAO'
  | 'MANUTENCAO'
  | 'EXCLUSAO_BAIXA';

export interface AssetMovementRecord {
  id: string;
  termNumber: string; // Ex: TERM-2026-0001
  assetId: string;
  type: MovementType;
  fromUserName?: string | null;
  toUserName?: string | null;
  fromDepartment?: string | null;
  toDepartment?: string | null;
  performedByName: string;
  reason: string;
  conditionAtMoment: AssetCondition;
  accessoriesIncluded?: string | null;
  disposalMethod?: string | null;
  createdAt: string;
}

export interface ITAsset {
  id: string;
  assetTag: string; // Ex: PAT-2026-0001
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  category: AssetCategory;
  status: AssetStatus;
  condition: AssetCondition;
  specifications?: string | null;
  purchaseDate?: string | null;
  invoiceNumber?: string | null;
  supplier?: string | null;
  purchaseValue?: number | null;
  warrantyUntil?: string | null;
  department: string;
  location?: string | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    department: string;
  } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  movements: AssetMovementRecord[];
}
