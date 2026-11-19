import { Router } from 'express';
import {
    NoteVisibility,
    PriorityLevel,
    Prisma,
    SupportTier,
    TicketStatus,
    UserRole,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
    SAFE_USER_SELECT,
    requireAuth,
    requireTechRole,
} from '../middleware/auth.middleware';
import {
    calculateItilPriorityAndSla,
    generateNextServiceOrderId,
    generateNextTicketId,
    normalizeImpact,
    normalizePriority,
    normalizeStatus,
    normalizeTicketIdParam,
    normalizeTier,
    normalizeType,
    normalizeUrgency,
    resolveTechnicianUser,
} from '../utils/itil.utils';
import {
    createNoteSchema,
    createTicketSchema,
    finalizeTicketSchema,
    updateTicketSchema,
    validateBody,
} from '../schemas/validation.schemas';

export const ticketsRouter = Router();

function buildTicketInclude(isCollaborator = false): Prisma.TicketInclude {
    return {
        requester: { select: SAFE_USER_SELECT },
        assignee: { select: SAFE_USER_SELECT },
        sla: true,
        notes: {
            where: isCollaborator
                ? { visibility: NoteVisibility.PUBLIC }
                : undefined,
            include: { author: { select: SAFE_USER_SELECT } },
            orderBy: { createdAt: 'asc' },
        },
        auditTrail: { orderBy: { createdAt: 'desc' } },
        serviceOrder: true,
    };
}

// 1. Listar chamados com filtros (GET /api/tickets)
// Colaboradores visualizam exclusivamente seus próprios chamados e sem notas INTERNAL
ticketsRouter.get('/', requireAuth, async (req, res) => {
    try {
        const isCollaborator = req.user!.role === UserRole.COLABORADOR;
        const { status, priority, assigneeId, search } = req.query;
        const where: Prisma.TicketWhereInput = {};

        // Regra Zero-Trust: Colaborador vê apenas chamados abertos por ele mesmo
        if (isCollaborator) {
            where.requesterId = req.user!.id;
        }

        if (status && status !== 'Todos') {
            const mappedStatus = normalizeStatus(String(status));
            if (mappedStatus) where.status = mappedStatus;
        }
        if (priority && priority !== 'Todas') {
            const mappedPriority = normalizePriority(String(priority));
            if (mappedPriority) where.priority = mappedPriority;
        }
        if (!isCollaborator && assigneeId && assigneeId !== 'Todos') {
            const rawAssignee = String(assigneeId);
            const cleanSlug = rawAssignee.replace(/^usr-/, '').toLowerCase();
            where.OR = [
                { assigneeId: rawAssignee },
                { assigneeId: `usr-${cleanSlug}` },
            ];
        }
        if (search) {
            const searchStr = String(search);
            const searchClause: Prisma.TicketWhereInput[] = [
                { id: { contains: searchStr, mode: 'insensitive' } },
                { title: { contains: searchStr, mode: 'insensitive' } },
                { description: { contains: searchStr, mode: 'insensitive' } },
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchClause }];
                delete where.OR;
            } else {
                where.OR = searchClause;
            }
        }

        const tickets = await prisma.ticket.findMany({
            where,
            include: buildTicketInclude(isCollaborator),
            orderBy: { createdAt: 'desc' },
        });

        // Garantia dupla em memória de que nenhuma nota INTERNAL vaze para colaboradores
        const safeTickets = isCollaborator
            ? tickets.map((t) => ({
                  ...t,
                  notes: (t.notes || []).filter(
                      (n) => n.visibility === NoteVisibility.PUBLIC
                  ),
              }))
            : tickets;

        res.json(safeTickets);
    } catch (error) {
        console.error('Erro ao listar chamados:', error);
        res.status(500).json({ error: 'Erro ao listar chamados' });
    }
});

// 2. Criar Novo Chamado (POST /api/tickets)
// Força obrigatoriamente requesterId = req.user.id da sessão autenticada
ticketsRouter.post(
    '/',
    requireAuth,
    validateBody(createTicketSchema),
    async (req, res) => {
        try {
            const {
                title,
                description,
                type,
                category,
                department,
                impact: rawImpact,
                urgency: rawUrgency,
            } = req.body;

            const sessionUser = req.user!;
            const impact = normalizeImpact(rawImpact);
            const urgency = normalizeUrgency(rawUrgency);
            const ticketType = normalizeType(type);
            const { priority, firstResponse, resolution } =
                calculateItilPriorityAndSla(impact, urgency);

            const ticketId = await generateNextTicketId();

            // Roteamento Inteligente ITIL por Criticidade e Especialidade
            let targetTechSlug = 'elias';
            let targetTier: SupportTier = SupportTier.N1;
            if (priority === PriorityLevel.CRITICA) {
                targetTechSlug = 'alexandre';
                targetTier = SupportTier.N3;
            } else if (category === 'Rede' || category === 'Hardware') {
                targetTechSlug = 'mauricio';
                targetTier = SupportTier.N2;
            }

            const assignee = await resolveTechnicianUser(targetTechSlug);
            const isCollaborator = sessionUser.role === UserRole.COLABORADOR;

            const ticket = await prisma.ticket.create({
                data: {
                    id: ticketId,
                    title,
                    description,
                    type: ticketType,
                    category: category || 'Rede',
                    department: department || sessionUser.department || 'Operações',
                    impact,
                    urgency,
                    priority,
                    status: TicketStatus.NOVO,
                    tier: targetTier,
                    requesterId: sessionUser.id,
                    assigneeId: assignee?.id,
                    sla: {
                        create: {
                            firstResponseTargetMinutes: firstResponse,
                            firstResponseElapsedMinutes: 0,
                            resolutionTargetMinutes: resolution,
                            resolutionRemainingMinutes: resolution,
                            health: 'within_sla',
                        },
                    },
                    auditTrail: {
                        create: [
                            {
                                actorName: sessionUser.name,
                                actionType: 'created',
                                description: `Chamado registado com prioridade ${priority}.`,
                            },
                            {
                                actorName: 'Distribuidor Automático Global Desk',
                                actionType: 'assigned',
                                description: `Roteamento automático para ${assignee?.name || 'Fila Técnica'} (${targetTier}) com base na especialidade de ${category || 'TI'}.`,
                            },
                        ],
                    },
                },
                include: buildTicketInclude(isCollaborator),
            });

            res.status(201).json(ticket);
        } catch (error) {
            console.error('Erro ao criar chamado:', error);
            res.status(500).json({ error: 'Erro ao criar chamado' });
        }
    }
);

// 3. Adicionar Nota / Comentário (POST /api/tickets/:id/notes)
// Colaboradores só podem comentar em seus próprios chamados e sempre com visibilidade PUBLIC
ticketsRouter.post(
    '/:id/notes',
    requireAuth,
    validateBody(createNoteSchema),
    async (req, res) => {
        try {
            const id = normalizeTicketIdParam(String(req.params.id));
            const {
                visibility,
                category,
                targetTechName,
                commandSnippet,
                content,
            } = req.body;

            const sessionUser = req.user!;
            const isCollaborator = sessionUser.role === UserRole.COLABORADOR;

            const existingTicket = await prisma.ticket.findUnique({
                where: { id },
                include: { sla: true },
            });

            if (!existingTicket) {
                return res.status(404).json({ error: 'Chamado não encontrado.' });
            }

            if (isCollaborator && existingTicket.requesterId !== sessionUser.id) {
                return res.status(403).json({
                    error: 'Acesso proibido: você só tem permissão para interagir nos seus próprios chamados.',
                });
            }

            // Colaborador nunca pode registrar notas INTERNAL nem comandos técnicos
            const noteVisibility = isCollaborator
                ? NoteVisibility.PUBLIC
                : String(visibility).toUpperCase() === 'INTERNAL'
                  ? NoteVisibility.INTERNAL
                  : NoteVisibility.PUBLIC;

            const actor = sessionUser.name;
            const auditDesc =
                noteVisibility === NoteVisibility.INTERNAL
                    ? `Nota técnica interna (${category || 'Alinhamento'}${targetTechName ? ` ➔ ${targetTechName}` : ''}) registada.`
                    : isCollaborator
                      ? 'Mensagem enviada pelo solicitante no portal.'
                      : 'Resposta pública enviada ao solicitante.';

            const note = await prisma.$transaction(async (tx) => {
                const createdNote = await tx.ticketNote.create({
                    data: {
                        ticketId: id,
                        authorId: sessionUser.id,
                        visibility: noteVisibility,
                        category: isCollaborator ? null : category || null,
                        targetTechName: isCollaborator
                            ? null
                            : targetTechName || null,
                        commandSnippet: isCollaborator
                            ? null
                            : commandSnippet || null,
                        content,
                    },
                    include: {
                        author: { select: SAFE_USER_SELECT },
                    },
                });

                if (
                    !isCollaborator &&
                    noteVisibility === NoteVisibility.PUBLIC &&
                    existingTicket.sla &&
                    !existingTicket.sla.firstResponseMet
                ) {
                    const elapsedMinutes = Math.max(
                        1,
                        Math.round(
                            (Date.now() - existingTicket.createdAt.getTime()) /
                                60000
                        )
                    );
                    await tx.ticketSla.update({
                        where: { ticketId: id },
                        data: {
                            firstResponseMet: true,
                            firstResponseElapsedMinutes: elapsedMinutes,
                        },
                    });
                }

                await tx.ticketAuditTrail.create({
                    data: {
                        ticketId: id,
                        actorName: actor,
                        actionType: 'note_added',
                        description: auditDesc,
                    },
                });

                return createdNote;
            });

            res.status(201).json(note);
        } catch (error) {
            console.error('Erro ao registar nota:', error);
            res.status(500).json({ error: 'Erro interno ao salvar nota' });
        }
    }
);

// 4. Atualizar Status / Escalonamento / Responsável (PATCH /api/tickets/:id) — Restrito à Equipe Técnica
ticketsRouter.patch(
    '/:id',
    requireAuth,
    requireTechRole,
    validateBody(updateTicketSchema),
    async (req, res) => {
        try {
            const id = normalizeTicketIdParam(String(req.params.id));
            const { status, tier, assigneeId, actorName, reason } = req.body;
            const effectiveActor = req.user?.name || actorName || 'Sistema';

            const data: Prisma.TicketUncheckedUpdateInput = {};
            const normalizedStatus = normalizeStatus(status);
            if (normalizedStatus) data.status = normalizedStatus;

            const normalizedTier = normalizeTier(tier);
            if (normalizedTier) data.tier = normalizedTier;

            let assignedUser = null;
            if (assigneeId) {
                assignedUser = await resolveTechnicianUser(assigneeId);
                if (assignedUser) {
                    data.assigneeId = assignedUser.id;
                    if (!normalizedTier && assignedUser.tier) {
                        data.tier = assignedUser.tier;
                    }
                }
            }

            const updatedTicket = await prisma.$transaction(async (tx) => {
                const ticketAfterUpdate = await tx.ticket.update({
                    where: { id },
                    data,
                    include: { sla: true },
                });

                if (ticketAfterUpdate.sla) {
                    if (normalizedStatus === TicketStatus.RESOLVIDO) {
                        const slaHealth =
                            ticketAfterUpdate.sla.resolutionRemainingMinutes >= 0
                                ? 'completed_on_time'
                                : 'completed_late';
                        await tx.ticketSla.update({
                            where: { ticketId: id },
                            data: { health: slaHealth },
                        });
                    } else if (
                        normalizedStatus === TicketStatus.EM_ATENDIMENTO &&
                        !ticketAfterUpdate.sla.firstResponseMet
                    ) {
                        const elapsedMinutes = Math.max(
                            1,
                            Math.round(
                                (Date.now() -
                                    ticketAfterUpdate.createdAt.getTime()) /
                                    60000
                            )
                        );
                        await tx.ticketSla.update({
                            where: { ticketId: id },
                            data: {
                                firstResponseMet: true,
                                firstResponseElapsedMinutes: elapsedMinutes,
                            },
                        });
                    }
                }

                const auditEntries: Array<{
                    actionType: string;
                    description: string;
                }> = [];
                if (normalizedStatus) {
                    auditEntries.push({
                        actionType: 'status_changed',
                        description: `Status alterado para "${status}".`,
                    });
                }
                if (assignedUser) {
                    auditEntries.push({
                        actionType: normalizedTier ? 'escalated' : 'assigned',
                        description: `Atribuído para ${assignedUser.name} (${data.tier || assignedUser.tier || 'N1'})${reason ? ` — Motivo: ${reason}` : '.'}`,
                    });
                } else if (normalizedTier) {
                    auditEntries.push({
                        actionType: 'escalated',
                        description: `Escalonado para Nível ${normalizedTier}.${reason ? ` Parecer: ${reason}` : ''}`,
                    });
                }
                if (auditEntries.length === 0) {
                    auditEntries.push({
                        actionType: 'status_changed',
                        description: `Registo atualizado por ${effectiveActor}.`,
                    });
                }

                for (const entry of auditEntries) {
                    await tx.ticketAuditTrail.create({
                        data: {
                            ticketId: id,
                            actorName: effectiveActor,
                            actionType: entry.actionType,
                            description: entry.description,
                        },
                    });
                }

                return tx.ticket.findUniqueOrThrow({
                    where: { id },
                    include: buildTicketInclude(false),
                });
            });

            res.json(updatedTicket);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                return res
                    .status(404)
                    .json({ error: 'Chamado não encontrado.' });
            }
            console.error('Erro ao atualizar chamado:', error);
            res.status(500).json({ error: 'Erro ao atualizar chamado' });
        }
    }
);

// 5. Excluir Chamado (DELETE /api/tickets/:id) — Restrito à Equipe Técnica
ticketsRouter.delete('/:id', requireAuth, requireTechRole, async (req, res) => {
    try {
        const id = normalizeTicketIdParam(String(req.params.id));
        await prisma.ticket.delete({ where: { id } });
        res.json({ deleted: true, id });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            return res.status(404).json({ error: 'Chamado não encontrado.' });
        }
        console.error('Erro ao excluir chamado:', error);
        res.status(500).json({ error: 'Erro ao excluir chamado' });
    }
});

// 6. Finalizar Chamado e Emitir O.S. (POST /api/tickets/:id/finalize) — Restrito à Equipe Técnica
ticketsRouter.post(
    '/:id/finalize',
    requireAuth,
    requireTechRole,
    validateBody(finalizeTicketSchema),
    async (req, res) => {
        try {
            const id = normalizeTicketIdParam(String(req.params.id));
            const {
                technicianId,
                interventionType,
                finalizationOutcome,
                outcomeLabel,
                solutionSummary,
                nonCompletionReason,
                partsOrSupplies,
                clientAcceptance,
                startedAt,
                finalizedAt,
                durationText,
                slaMet,
            } = req.body;

            const existingOrder = await prisma.serviceOrder.findUnique({
                where: { ticketId: id },
                select: { id: true },
            });
            const osNumber =
                existingOrder?.id || (await generateNextServiceOrderId());
            const tech = await resolveTechnicianUser(
                technicianId || req.user?.id
            );
            const effectiveTechId = tech?.id || req.user!.id;
            const effectiveTechName = tech?.name || req.user!.name;

            const serviceOrder = await prisma.$transaction(async (tx) => {
                const existingTicket = await tx.ticket.update({
                    where: { id },
                    data: { status: TicketStatus.RESOLVIDO },
                    include: { sla: true },
                });

                if (existingTicket.sla) {
                    await tx.ticketSla.update({
                        where: { ticketId: id },
                        data: {
                            firstResponseMet: true,
                            health: slaMet
                                ? 'completed_on_time'
                                : 'completed_late',
                        },
                    });
                }

                const upsertedOrder = await tx.serviceOrder.upsert({
                    where: { ticketId: id },
                    update: {
                        technicianId: effectiveTechId,
                        interventionType,
                        finalizationOutcome,
                        outcomeLabel,
                        solutionSummary,
                        nonCompletionReason: nonCompletionReason || null,
                        partsOrSupplies: partsOrSupplies || null,
                        clientAcceptance,
                        startedAt,
                        finalizedAt,
                        durationText,
                        slaMet: Boolean(slaMet),
                    },
                    create: {
                        id: osNumber,
                        ticketId: id,
                        technicianId: effectiveTechId,
                        interventionType,
                        finalizationOutcome,
                        outcomeLabel,
                        solutionSummary,
                        nonCompletionReason: nonCompletionReason || null,
                        partsOrSupplies: partsOrSupplies || null,
                        clientAcceptance,
                        startedAt,
                        finalizedAt,
                        durationText,
                        slaMet: Boolean(slaMet),
                    },
                    include: {
                        technician: { select: SAFE_USER_SELECT },
                        ticket: {
                            include: {
                                requester: { select: SAFE_USER_SELECT },
                            },
                        },
                    },
                });

                await tx.ticketNote.create({
                    data: {
                        ticketId: id,
                        authorId: effectiveTechId,
                        visibility: NoteVisibility.PUBLIC,
                        content: `Ordem de Serviço ${upsertedOrder.id} emitida.\n\nDesfecho: ${outcomeLabel}\nTipo de Intervenção: ${interventionType}\nLaudo Técnico: ${solutionSummary}${nonCompletionReason ? `\nMotivo da Não-Conclusão / Inviabilidade: ${nonCompletionReason}` : ''}${partsOrSupplies ? `\nInsumos/Peças: ${partsOrSupplies}` : ''}\nAceite do Solicitante: ${clientAcceptance}`,
                    },
                });

                await tx.ticketAuditTrail.create({
                    data: {
                        ticketId: id,
                        actorName: effectiveTechName,
                        actionType: 'status_changed',
                        description: `Chamado finalizado (${outcomeLabel}). Ordem de Serviço ${upsertedOrder.id} emitida e arquivada.`,
                    },
                });

                return upsertedOrder;
            });

            res.status(201).json(serviceOrder);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                return res
                    .status(404)
                    .json({ error: 'Chamado não encontrado.' });
            }
            console.error('Erro ao emitir Ordem de Serviço:', error);
            res.status(500).json({ error: 'Erro ao emitir O.S.' });
        }
    }
);
