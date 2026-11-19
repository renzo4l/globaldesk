import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    AssetCategory,
    AssetCondition,
    AssetStatus,
    MovementType,
} from '@prisma/client';

/**
 * Middleware genérico de validação de payload (Zod).
 * Bloqueia campos não mapeados (.strict()) e retorna 400 Bad Request detalhado.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const firstIssue = result.error.issues[0];
            const fieldPath = firstIssue?.path?.join('.') || 'payload';
            const message = firstIssue?.message || 'Dados de entrada inválidos.';

            res.status(400).json({
                error: `Validação falhou (${fieldPath}): ${message}`,
                issues: result.error.issues.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                })),
            });
            return;
        }

        req.body = result.data;
        next();
    };
}

// ============================================================================
// 1. Schemas de Autenticação (/api/auth)
// ============================================================================
export const googleLoginSchema = z
    .object({
        idToken: z.string().trim().min(10, 'Token de identidade Google ausente ou inválido.'),
        expectedRole: z.enum(['collaborator', 'technician']).optional(),
    })
    .strict();

export const techLoginSchema = z
    .object({
        email: z
            .string()
            .trim()
            .email('Informe um endereço de e-mail corporativo válido.')
            .max(255),
        password: z
            .string()
            .min(1, 'A senha corporativa é obrigatória.')
            .max(255),
    })
    .strict();

// ============================================================================
// 2. Schemas de Chamados, Notas e Ordens de Serviço (/api/tickets)
// ============================================================================
export const createTicketSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(4, 'O título do chamado deve ter pelo menos 4 caracteres.')
            .max(300, 'O título excede o limite de 300 caracteres.'),
        description: z
            .string()
            .trim()
            .min(6, 'A descrição detalhada deve ter pelo menos 6 caracteres.')
            .max(10000, 'A descrição excede o limite de 10.000 caracteres.'),
        type: z
            .enum([
                'INCIDENTE',
                'REQUISICAO_SERVICO',
                'Incidente',
                'Requisição de Serviço',
            ])
            .optional(),
        category: z
            .enum([
                'Hardware',
                'Software',
                'Rede',
                'Acessos/Sistemas',
                'Telefonia',
            ])
            .optional(),
        department: z.string().trim().min(2).max(120).optional(),
        impact: z
            .enum([
                'ORGANIZACAO',
                'SETOR',
                'USUARIO_UNICO',
                'Organização',
                'Setor',
                'Usuário Único',
            ])
            .optional(),
        urgency: z
            .enum([
                'CRITICA',
                'ALTA',
                'MEDIA',
                'BAIXA',
                'Crítica',
                'Alta',
                'Média',
                'Baixa',
            ])
            .optional(),
        requesterName: z.string().trim().max(150).optional(),
        requesterEmail: z.string().trim().email().max(255).optional(),
    })
    .strict();

export const updateTicketSchema = z
    .object({
        status: z
            .enum([
                'NOVO',
                'EM_ATENDIMENTO',
                'AGUARDANDO_USUARIO',
                'RESOLVIDO',
                'Novo',
                'Em Atendimento',
                'Aguardando Usuário',
                'Resolvido',
            ])
            .optional(),
        tier: z.enum(['N1', 'N2', 'N3']).optional(),
        assigneeId: z.string().trim().min(1).max(100).optional(),
        actorName: z.string().trim().min(1).max(150).optional(),
        reason: z.string().trim().max(2000).optional(),
    })
    .strict();

export const createNoteSchema = z
    .object({
        visibility: z.enum(['PUBLIC', 'INTERNAL', 'public', 'internal']).optional(),
        category: z.string().trim().max(100).nullable().optional(),
        targetTechName: z.string().trim().max(150).nullable().optional(),
        commandSnippet: z.string().max(10000).nullable().optional(),
        content: z
            .string()
            .trim()
            .min(1, 'O conteúdo da nota não pode estar vazio.')
            .max(10000, 'O conteúdo da nota excede o limite de 10.000 caracteres.'),
        authorName: z.string().trim().max(150).optional(),
        authorRole: z.string().trim().max(100).optional(),
    })
    .strict();

export const finalizeTicketSchema = z
    .object({
        technicianId: z.string().trim().min(1).max(100).optional(),
        interventionType: z.string().trim().min(2).max(150),
        finalizationOutcome: z.enum([
            'concluido_sucesso',
            'solucao_contorno',
            'nao_concluido',
            'cancelado_usuario',
            'fora_escopo',
        ]),
        outcomeLabel: z.string().trim().min(2).max(150),
        solutionSummary: z
            .string()
            .trim()
            .min(5, 'O laudo técnico / resumo da solução é obrigatório.')
            .max(10000),
        nonCompletionReason: z.string().trim().max(5000).nullable().optional(),
        partsOrSupplies: z.string().trim().max(2000).nullable().optional(),
        clientAcceptance: z.string().trim().min(2).max(1000),
        startedAt: z.string().trim().min(1).max(100),
        finalizedAt: z.string().trim().min(1).max(100),
        durationText: z.string().trim().min(1).max(100),
        slaMet: z.boolean(),
    })
    .strict();

// ============================================================================
// 3. Schemas da Base de Conhecimento (/api/kb)
// ============================================================================
export const createKbSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(3, 'O título do artigo deve ter pelo menos 3 caracteres.')
            .max(300),
        category: z.string().trim().min(2).max(100),
        summary: z
            .string()
            .trim()
            .min(3, 'O resumo do artigo é obrigatório.')
            .max(1000),
        content: z
            .string()
            .trim()
            .min(5, 'O conteúdo do artigo é obrigatório.')
            .max(50000),
        tags: z.string().trim().max(500).optional(),
        authorName: z.string().trim().max(150).optional(),
        isPublished: z.boolean().optional(),
    })
    .strict();

export const updateKbSchema = createKbSchema.partial().strict();

// ============================================================================
// 4. Schemas de Gestão de Usuários (/api/users)
// ============================================================================
export const createUserSchema = z
    .object({
        id: z.string().trim().max(100).optional(),
        fullName: z.string().trim().min(3).max(150).optional(),
        name: z.string().trim().min(3).max(150).optional(),
        email: z.string().trim().email('E-mail corporativo inválido.').max(255),
        password: z
            .string()
            .min(8, 'A senha deve possuir no mínimo 8 caracteres.')
            .max(255)
            .optional(),
        role: z.string().trim().max(100).optional(),
        tier: z.enum(['N1', 'N2', 'N3']).nullable().optional(),
        department: z.string().trim().min(2).max(120).optional(),
        avatarInitials: z.string().trim().max(5).optional(),
        isGoogleVerified: z.boolean().optional(),
        googleAccountDomain: z.string().trim().max(120).optional(),
    })
    .strict();

export const updateUserSchema = z
    .object({
        fullName: z.string().trim().min(3).max(150).optional(),
        name: z.string().trim().min(3).max(150).optional(),
        email: z.string().trim().email('E-mail corporativo inválido.').max(255).optional(),
        password: z
            .string()
            .min(8, 'A senha deve possuir no mínimo 8 caracteres.')
            .max(255)
            .optional(),
        role: z.string().trim().max(100).optional(),
        tier: z.enum(['N1', 'N2', 'N3']).nullable().optional(),
        department: z.string().trim().min(2).max(120).optional(),
        avatarInitials: z.string().trim().max(5).optional(),
        status: z.enum(['Ativo', 'Suspenso']).optional(),
    })
    .strict();

// ============================================================================
// 5. Schemas de Inventário e Ativos de TI (/api/assets)
// ============================================================================
export const createAssetSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(2, 'O nome/identificação do ativo é obrigatório.')
            .max(200),
        brand: z.string().trim().min(1, 'A marca é obrigatória.').max(120),
        model: z.string().trim().min(1, 'O modelo é obrigatório.').max(120),
        serialNumber: z
            .string()
            .trim()
            .min(1, 'O número de série é obrigatório.')
            .max(120),
        category: z.nativeEnum(AssetCategory),
        condition: z.nativeEnum(AssetCondition).optional(),
        specifications: z.string().trim().max(5000).nullable().optional(),
        purchaseDate: z.string().trim().max(50).nullable().optional(),
        invoiceNumber: z.string().trim().max(100).nullable().optional(),
        supplier: z.string().trim().max(200).nullable().optional(),
        purchaseValue: z
            .union([z.number().nonnegative(), z.string()])
            .nullable()
            .optional(),
        warrantyUntil: z.string().trim().max(50).nullable().optional(),
        department: z.string().trim().min(2).max(120),
        location: z.string().trim().max(200).nullable().optional(),
        assignedToId: z.string().trim().max(100).nullable().optional(),
        notes: z.string().trim().max(5000).nullable().optional(),
        performedByName: z.string().trim().max(150).optional(),
        accessoriesIncluded: z.string().trim().max(1000).nullable().optional(),
        reason: z.string().trim().max(2000).nullable().optional(),
    })
    .strict();

export const moveAssetSchema = z
    .object({
        type: z.nativeEnum(MovementType),
        status: z.nativeEnum(AssetStatus).optional(),
        assignedToId: z.string().trim().max(100).nullable().optional(),
        toUserName: z.string().trim().max(150).nullable().optional(),
        toDepartment: z.string().trim().max(120).nullable().optional(),
        location: z.string().trim().max(200).nullable().optional(),
        conditionAtMoment: z.nativeEnum(AssetCondition),
        accessoriesIncluded: z.string().trim().max(1000).nullable().optional(),
        reason: z
            .string()
            .trim()
            .min(3, 'O motivo/justificativa da movimentação é obrigatório.')
            .max(3000),
        performedByName: z.string().trim().max(150).optional(),
    })
    .strict();

export const disposeAssetSchema = z
    .object({
        reason: z
            .string()
            .trim()
            .min(5, 'O laudo técnico condenatório é obrigatório.')
            .max(5000),
        disposalMethod: z.string().trim().min(2).max(200),
        conditionAtMoment: z.nativeEnum(AssetCondition).optional(),
        performedByName: z.string().trim().max(150).optional(),
    })
    .strict();

export const updateAssetSchema = z
    .object({
        name: z.string().trim().min(2).max(200).optional(),
        brand: z.string().trim().min(1).max(120).optional(),
        model: z.string().trim().min(1).max(120).optional(),
        serialNumber: z.string().trim().min(1).max(120).optional(),
        category: z.nativeEnum(AssetCategory).optional(),
        condition: z.nativeEnum(AssetCondition).optional(),
        specifications: z.string().trim().max(5000).nullable().optional(),
        purchaseDate: z.string().trim().max(50).nullable().optional(),
        invoiceNumber: z.string().trim().max(100).nullable().optional(),
        supplier: z.string().trim().max(200).nullable().optional(),
        purchaseValue: z
            .union([z.number().nonnegative(), z.string()])
            .nullable()
            .optional(),
        warrantyUntil: z.string().trim().max(50).nullable().optional(),
        department: z.string().trim().min(2).max(120).optional(),
        location: z.string().trim().max(200).nullable().optional(),
        notes: z.string().trim().max(5000).nullable().optional(),
    })
    .strict();
