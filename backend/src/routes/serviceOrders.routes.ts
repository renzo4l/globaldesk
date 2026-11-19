import { Router } from 'express';
import { prisma } from '../lib/prisma';
import {
    SAFE_USER_SELECT,
    requireAuth,
    requireTechRole,
} from '../middleware/auth.middleware';

export const serviceOrdersRouter = Router();

// Todas as rotas de Ordens de Serviço são restritas à Equipe Técnica
serviceOrdersRouter.use(requireAuth, requireTechRole);

// Listar todas as Ordens de Serviço (GET /api/service-orders)
serviceOrdersRouter.get('/', async (_req, res) => {
    try {
        const orders = await prisma.serviceOrder.findMany({
            include: {
                technician: { select: SAFE_USER_SELECT },
                ticket: {
                    include: {
                        requester: { select: SAFE_USER_SELECT },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(orders);
    } catch (error) {
        console.error('Erro ao listar Ordens de Serviço:', error);
        res.status(500).json({ error: 'Erro ao listar O.S.' });
    }
});
