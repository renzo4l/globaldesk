import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
    SAFE_USER_SELECT,
    requireAuth,
    requireTechRole,
} from '../middleware/auth.middleware';
import {
    OFFICIAL_TECH_IDS,
    normalizeTier,
    normalizeUserRole,
} from '../utils/itil.utils';
import {
    createUserSchema,
    updateUserSchema,
    validateBody,
} from '../schemas/validation.schemas';

export const usersRouter = Router();

// Todas as rotas do diretório de usuários são restritas à Equipe Técnica / Admin
usersRouter.use(requireAuth, requireTechRole);

// 1. Listar todos os usuários (GET /api/users) — omite passwordHash via SAFE_USER_SELECT
usersRouter.get('/', async (_req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: SAFE_USER_SELECT,
            orderBy: { name: 'asc' },
        });
        res.json(users);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// 2. Criar ou atualizar usuário (POST /api/users)
usersRouter.post('/', validateBody(createUserSchema), async (req, res) => {
    try {
        const {
            id,
            fullName,
            name,
            email,
            password,
            role: rawRole,
            tier: rawTier,
            department,
            avatarInitials,
            isGoogleVerified,
            googleAccountDomain,
        } = req.body;

        const cleanEmail = email.trim().toLowerCase();
        const displayName = String(
            fullName || name || 'Usuário Corporativo'
        ).trim();
        const prismaRole = normalizeUserRole(rawRole);
        const passwordHash =
            password && password.trim()
                ? await bcrypt.hash(password.trim(), 10)
                : undefined;

        const user = await prisma.user.upsert({
            where: { email: cleanEmail },
            update: {
                name: displayName,
                role: prismaRole,
                tier: normalizeTier(rawTier) || null,
                department: department || 'Operações',
                avatarInitials:
                    avatarInitials || displayName.slice(0, 2).toUpperCase(),
                ...(passwordHash ? { passwordHash } : {}),
            },
            create: {
                id: id || undefined,
                name: displayName,
                email: cleanEmail,
                passwordHash: passwordHash || null,
                role: prismaRole,
                tier: normalizeTier(rawTier) || null,
                department: department || 'Operações',
                avatarInitials:
                    avatarInitials || displayName.slice(0, 2).toUpperCase(),
                isGoogleVerified: Boolean(isGoogleVerified ?? true),
                googleAccountDomain:
                    googleAccountDomain ||
                    cleanEmail.split('@')[1] ||
                    'corporativo.com.br',
            },
            select: SAFE_USER_SELECT,
        });

        res.status(201).json(user);
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// 3. Atualizar usuário existente (PUT /api/users/:id)
usersRouter.put('/:id', validateBody(updateUserSchema), async (req, res) => {
    try {
        const id = String(req.params.id);
        const {
            fullName,
            name,
            email,
            password,
            role: rawRole,
            tier: rawTier,
            department,
            avatarInitials,
            status,
        } = req.body;

        const updateData: Prisma.UserUpdateInput = {};
        if (fullName || name)
            updateData.name = String(fullName || name).trim();
        if (email) updateData.email = String(email).trim().toLowerCase();
        if (department) updateData.department = department;
        if (avatarInitials) updateData.avatarInitials = avatarInitials;
        if (password && password.trim()) {
            updateData.passwordHash = await bcrypt.hash(password.trim(), 10);
        }

        if (rawRole) {
            updateData.role = normalizeUserRole(rawRole);
        }

        if (rawTier !== undefined) {
            updateData.tier = normalizeTier(rawTier) || null;
        }

        if (status) {
            updateData.status = status;
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
            select: SAFE_USER_SELECT,
        });

        res.json(updated);
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// 4. Alternar status do Usuário (PATCH /api/users/:id/status)
usersRouter.patch('/:id/status', async (req, res) => {
    try {
        const id = String(req.params.id);
        if (OFFICIAL_TECH_IDS.has(id)) {
            return res.status(403).json({
                error: 'Não é permitido suspender a conta Superadmin oficial do sistema.',
            });
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user)
            return res.status(404).json({ error: 'Usuário não encontrado' });

        const newStatus = user.status === 'Ativo' ? 'Suspenso' : 'Ativo';
        const updated = await prisma.user.update({
            where: { id },
            data: { status: newStatus },
            select: SAFE_USER_SELECT,
        });

        res.json(updated);
    } catch (error) {
        console.error('Erro ao alternar status do usuário:', error);
        res.status(500).json({ error: 'Erro ao alternar status do usuário' });
    }
});

// 5. Excluir Usuário (DELETE /api/users/:id)
usersRouter.delete('/:id', async (req, res) => {
    try {
        const id = String(req.params.id);

        // Impedir a exclusão de técnicos oficiais vitais para o sistema
        if (OFFICIAL_TECH_IDS.has(id)) {
            return res.status(403).json({
                error: 'Não é permitido excluir operadores técnicos oficiais do sistema.',
            });
        }

        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // Desvincular chamados ou ativos atribuídos e remover o usuário em transação atômica
        await prisma.$transaction(async (tx) => {
            await tx.ticket.updateMany({
                where: { assigneeId: id },
                data: { assigneeId: null },
            });

            await tx.asset.updateMany({
                where: { assignedToId: id },
                data: { assignedToId: null },
            });

            await tx.ticketNote.deleteMany({
                where: { authorId: id },
            });

            await tx.serviceOrder.deleteMany({
                where: { technicianId: id },
            });

            const fallbackAdmin = await tx.user.findFirst({
                where: { id: { not: id } },
            });
            if (fallbackAdmin) {
                await tx.ticket.updateMany({
                    where: { requesterId: id },
                    data: { requesterId: fallbackAdmin.id },
                });
            }

            await tx.user.delete({
                where: { id },
            });
        });

        res.json({ message: 'Usuário removido com sucesso.', id });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({
            error: 'Erro ao excluir usuário do banco de dados',
        });
    }
});
