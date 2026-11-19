import {
    ImpactLevel,
    PriorityLevel,
    SupportTier,
    TicketStatus,
    TicketType,
    UrgencyLevel,
    UserRole,
} from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface OfficialTechPreset {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    tier: SupportTier;
    department: string;
    avatarInitials: string;
}

export const OFFICIAL_TECHS: Record<string, OfficialTechPreset> = {
    alexandre: {
        id: 'usr-alexandre',
        name: process.env.SUPERADMIN_NAME || 'Coordenação de TI',
        email: process.env.SUPERADMIN_EMAIL || 'admin@corporativo.com.br',
        role: UserRole.ADMIN,
        tier: SupportTier.N3,
        department: 'Engenharia & TI',
        avatarInitials: 'AT',
    },
};

export const OFFICIAL_TECH_IDS = new Set(
    Object.values(OFFICIAL_TECHS).map((tech) => tech.id)
);

/**
 * Remove o hash de senha antes de serializar objetos de usuário na API.
 */
export function sanitizeUser<T extends { passwordHash?: string | null }>(
    user: T | null | undefined
): Omit<T, 'passwordHash'> | null {
    if (!user) return null;
    const { passwordHash: _omitted, ...safeUser } = user;
    return safeUser;
}

/**
 * Normaliza o ID de chamado recebido via parâmetro de rota (garante prefixo # se for TICK-).
 */
export function normalizeTicketIdParam(rawId: string): string {
    const trimmed = decodeURIComponent(String(rawId || '')).trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith('#')) return trimmed;
    if (/^TICK-/i.test(trimmed)) return `#${trimmed}`;
    return trimmed;
}

export function normalizeStatus(raw?: string): TicketStatus | undefined {
    if (!raw) return undefined;
    const map: Record<string, TicketStatus> = {
        NOVO: TicketStatus.NOVO,
        Novo: TicketStatus.NOVO,
        EM_ATENDIMENTO: TicketStatus.EM_ATENDIMENTO,
        'Em Atendimento': TicketStatus.EM_ATENDIMENTO,
        AGUARDANDO_USUARIO: TicketStatus.AGUARDANDO_USUARIO,
        'Aguardando Usuário': TicketStatus.AGUARDANDO_USUARIO,
        RESOLVIDO: TicketStatus.RESOLVIDO,
        Resolvido: TicketStatus.RESOLVIDO,
    };
    return map[raw];
}

export function normalizePriority(raw?: string): PriorityLevel | undefined {
    if (!raw) return undefined;
    const map: Record<string, PriorityLevel> = {
        CRITICA: PriorityLevel.CRITICA,
        Crítica: PriorityLevel.CRITICA,
        ALTA: PriorityLevel.ALTA,
        Alta: PriorityLevel.ALTA,
        MEDIA: PriorityLevel.MEDIA,
        Média: PriorityLevel.MEDIA,
        BAIXA: PriorityLevel.BAIXA,
        Baixa: PriorityLevel.BAIXA,
    };
    return map[raw];
}

export function normalizeImpact(raw?: string): ImpactLevel {
    const map: Record<string, ImpactLevel> = {
        ORGANIZACAO: ImpactLevel.ORGANIZACAO,
        Organização: ImpactLevel.ORGANIZACAO,
        SETOR: ImpactLevel.SETOR,
        Setor: ImpactLevel.SETOR,
        USUARIO_UNICO: ImpactLevel.USUARIO_UNICO,
        'Usuário Único': ImpactLevel.USUARIO_UNICO,
    };
    return (raw && map[raw]) || ImpactLevel.SETOR;
}

export function normalizeUrgency(raw?: string): UrgencyLevel {
    const map: Record<string, UrgencyLevel> = {
        CRITICA: UrgencyLevel.CRITICA,
        Crítica: UrgencyLevel.CRITICA,
        ALTA: UrgencyLevel.ALTA,
        Alta: UrgencyLevel.ALTA,
        MEDIA: UrgencyLevel.MEDIA,
        Média: UrgencyLevel.MEDIA,
        BAIXA: UrgencyLevel.BAIXA,
        Baixa: UrgencyLevel.BAIXA,
    };
    return (raw && map[raw]) || UrgencyLevel.MEDIA;
}

export function normalizeType(raw?: string): TicketType {
    if (raw === 'REQUISICAO_SERVICO' || raw === 'Requisição de Serviço') {
        return TicketType.REQUISICAO_SERVICO;
    }
    return TicketType.INCIDENTE;
}

export function normalizeTier(raw?: string | null): SupportTier | undefined {
    if (!raw) return undefined;
    if (raw === 'N1' || raw === 'N2' || raw === 'N3') return raw as SupportTier;
    return undefined;
}

export function normalizeUserRole(rawRole?: string): UserRole {
    if (!rawRole) return UserRole.COLABORADOR;
    const str = String(rawRole);
    if (str.includes('N1')) return UserRole.ANALISTA_N1;
    if (str.includes('N2')) return UserRole.ANALISTA_N2;
    if (str.includes('N3')) return UserRole.ANALISTA_N3;
    if (str.toLowerCase().includes('admin')) return UserRole.ADMIN;
    return UserRole.COLABORADOR;
}

/**
 * Calcula a Prioridade Oficial ITIL v4 (Impacto x Urgência) e as metas de SLA em minutos.
 * Alinhado integralmente com as regras de governança ITIL v4 do frontend.
 */
export function calculateItilPriorityAndSla(impact: ImpactLevel, urgency: UrgencyLevel) {
    const priorityMatrix: Record<ImpactLevel, Record<UrgencyLevel, PriorityLevel>> = {
        [ImpactLevel.ORGANIZACAO]: {
            [UrgencyLevel.CRITICA]: PriorityLevel.CRITICA,
            [UrgencyLevel.ALTA]: PriorityLevel.CRITICA,
            [UrgencyLevel.MEDIA]: PriorityLevel.ALTA,
            [UrgencyLevel.BAIXA]: PriorityLevel.MEDIA,
        },
        [ImpactLevel.SETOR]: {
            [UrgencyLevel.CRITICA]: PriorityLevel.CRITICA,
            [UrgencyLevel.ALTA]: PriorityLevel.ALTA,
            [UrgencyLevel.MEDIA]: PriorityLevel.MEDIA,
            [UrgencyLevel.BAIXA]: PriorityLevel.BAIXA,
        },
        [ImpactLevel.USUARIO_UNICO]: {
            [UrgencyLevel.CRITICA]: PriorityLevel.ALTA,
            [UrgencyLevel.ALTA]: PriorityLevel.MEDIA,
            [UrgencyLevel.MEDIA]: PriorityLevel.BAIXA,
            [UrgencyLevel.BAIXA]: PriorityLevel.BAIXA,
        },
    };

    const priority = priorityMatrix[impact][urgency];

    let firstResponse = 240;
    let resolution = 1440;
    if (priority === PriorityLevel.CRITICA) {
        firstResponse = 15;
        resolution = 60;
    } else if (priority === PriorityLevel.ALTA) {
        firstResponse = 30;
        resolution = 240;
    } else if (priority === PriorityLevel.MEDIA) {
        firstResponse = 60;
        resolution = 480;
    }

    return { priority, firstResponse, resolution };
}

/**
 * Resolve ou auto-provisiona um técnico no banco a partir de seu ID ou slug ('alexandre', 'mauricio', 'elias').
 */
export async function resolveTechnicianUser(slugOrId?: string) {
    if (slugOrId) {
        const cleanSlug = slugOrId.replace(/^usr-/, '').toLowerCase();
        const preset = OFFICIAL_TECHS[cleanSlug];
        const lookupId = preset ? preset.id : slugOrId;

        const existing = await prisma.user.findUnique({ where: { id: lookupId } });
        if (existing) return existing;

        if (lookupId !== slugOrId) {
            const direct = await prisma.user.findUnique({ where: { id: slugOrId } });
            if (direct) return direct;
        }

        if (preset) {
            return prisma.user.upsert({
                where: { email: preset.email },
                update: {},
                create: {
                    id: preset.id,
                    name: preset.name,
                    email: preset.email,
                    role: preset.role,
                    tier: preset.tier,
                    department: preset.department,
                    avatarInitials: preset.avatarInitials,
                    isGoogleVerified: true,
                    googleAccountDomain: preset.email.split('@')[1] || 'corporativo.com.br',
                },
            });
        }
    }

    const firstTech = await prisma.user.findFirst({
        where: { role: { not: UserRole.COLABORADOR } },
    });
    if (firstTech) return firstTech;

    return prisma.user.findFirst();
}

export function extractTrailingSequenceNumber(codes: string[], minBaseline = 0): number {
    let maxNum = minBaseline;
    for (const code of codes) {
        const match = code.match(/(\d+)$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!Number.isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    }
    return maxNum;
}

export async function generateNextTicketId(): Promise<string> {
    const existing = await prisma.ticket.findMany({ select: { id: true } });
    const maxNum = extractTrailingSequenceNumber(
        existing.map((item) => item.id),
        1048
    );
    return `#TICK-2026-${String(maxNum + 1).padStart(4, '0')}`;
}

export async function generateNextServiceOrderId(): Promise<string> {
    const existing = await prisma.serviceOrder.findMany({ select: { id: true } });
    const maxNum = extractTrailingSequenceNumber(
        existing.map((item) => item.id),
        0
    );
    return `OS-2026-${String(maxNum + 1).padStart(4, '0')}`;
}

