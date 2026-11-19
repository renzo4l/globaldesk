import { Router } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireTechRole } from '../middleware/auth.middleware';
import {
    createKbSchema,
    updateKbSchema,
    validateBody,
} from '../schemas/validation.schemas';

export const kbRouter = Router();

// 1. Listar artigos da Base de Conhecimento (GET /api/kb)
// Colaboradores recebem exclusivamente artigos publicados (isPublished: true)
kbRouter.get('/', requireAuth, async (req, res) => {
    try {
        const isCollaborator = req.user?.role === UserRole.COLABORADOR;
        const articles = await prisma.knowledgeArticle.findMany({
            where: isCollaborator ? { isPublished: true } : undefined,
            orderBy: { updatedAt: 'desc' },
        });
        res.json(articles);
    } catch (error) {
        console.error('Erro ao listar artigos KB:', error);
        res.status(500).json({
            error: 'Erro ao listar artigos da Base de Conhecimento.',
        });
    }
});

// 2. Criar artigo (POST /api/kb) — Restrito à Equipe Técnica
kbRouter.post(
    '/',
    requireAuth,
    requireTechRole,
    validateBody(createKbSchema),
    async (req, res) => {
        try {
            const { title, category, summary, content, tags, authorName, isPublished } =
                req.body;
            const article = await prisma.knowledgeArticle.create({
                data: {
                    title,
                    category,
                    summary,
                    content,
                    tags: tags || '',
                    authorName: req.user?.name || authorName || 'Equipe Técnica',
                    isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
                },
            });
            res.status(201).json(article);
        } catch (error) {
            console.error('Erro ao criar artigo KB:', error);
            res.status(500).json({ error: 'Erro ao criar artigo.' });
        }
    }
);

// 3. Atualizar artigo (PUT /api/kb/:id) — Restrito à Equipe Técnica
kbRouter.put(
    '/:id',
    requireAuth,
    requireTechRole,
    validateBody(updateKbSchema),
    async (req, res) => {
        try {
            const id = String(req.params.id);
            const { title, category, summary, content, tags, isPublished } =
                req.body;
            const updated = await prisma.knowledgeArticle.update({
                where: { id },
                data: {
                    ...(title !== undefined && { title }),
                    ...(category !== undefined && { category }),
                    ...(summary !== undefined && { summary }),
                    ...(content !== undefined && { content }),
                    ...(tags !== undefined && { tags }),
                    ...(isPublished !== undefined && {
                        isPublished: Boolean(isPublished),
                    }),
                },
            });
            res.json(updated);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                return res.status(404).json({ error: 'Artigo não encontrado.' });
            }
            console.error('Erro ao atualizar artigo KB:', error);
            res.status(500).json({ error: 'Erro ao atualizar artigo.' });
        }
    }
);

// 4. Excluir artigo (DELETE /api/kb/:id) — Restrito à Equipe Técnica
kbRouter.delete('/:id', requireAuth, requireTechRole, async (req, res) => {
    try {
        await prisma.knowledgeArticle.delete({ where: { id: String(req.params.id) } });
        res.json({ message: 'Artigo removido.' });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            return res.status(404).json({ error: 'Artigo não encontrado.' });
        }
        console.error('Erro ao excluir artigo KB:', error);
        res.status(500).json({ error: 'Erro ao excluir artigo.' });
    }
});
