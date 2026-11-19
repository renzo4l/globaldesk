import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ENV } from '../config/env';
import {
    clearAuthCookie,
    requireAuth,
    setAuthCookie,
} from '../middleware/auth.middleware';
import { sanitizeUser } from '../utils/itil.utils';
import {
    googleLoginSchema,
    techLoginSchema,
    validateBody,
} from '../schemas/validation.schemas';

export const authRouter = Router();

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

/**
 * Rate Limiter estrito contra ataques de força bruta nas rotas de login:
 * Máximo de 10 tentativas a cada 15 minutos por IP.
 */
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Muitas tentativas de autenticação. Aguarde 15 minutos antes de tentar novamente.',
    },
});

// 1. Login Corporativo via Google Workspace (Colaboradores e Técnicos)
authRouter.post(
    '/google',
    authRateLimiter,
    validateBody(googleLoginSchema),
    async (req, res) => {
        try {
            const { idToken, expectedRole } = req.body;

            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: ENV.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email || payload.email_verified !== true) {
                return res.status(401).json({
                    error: 'Token Google inválido ou endereço de e-mail não verificado.',
                });
            }

            // Validação estrita do domínio Workspace (hd)
            if (
                !payload.hd ||
                payload.hd.toLowerCase() !== ENV.ALLOWED_DOMAIN.toLowerCase()
            ) {
                return res.status(403).json({
                    error: `Acesso bloqueado: utilize exclusivamente sua conta corporativa @${ENV.ALLOWED_DOMAIN}.`,
                });
            }

            const normalizedEmail = payload.email.trim().toLowerCase();
            let user = await prisma.user.findUnique({
                where: { email: normalizedEmail },
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        name: payload.name || normalizedEmail.split('@')[0],
                        email: normalizedEmail,
                        role: UserRole.COLABORADOR,
                        department: 'Geral',
                        isGoogleVerified: true,
                        googleAccountDomain: payload.hd,
                        avatarInitials: (payload.name || 'CO')
                            .slice(0, 2)
                            .toUpperCase(),
                    },
                });
            } else if (!user.isGoogleVerified) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        isGoogleVerified: true,
                        googleAccountDomain: payload.hd,
                    },
                });
            }

            if (user.status === 'Suspenso') {
                return res.status(403).json({
                    error: 'Esta conta encontra-se suspensa pelo administrador de TI.',
                });
            }

            // Se a solicitação veio explicitamente da aba técnica, validar cargo de técnico
            if (
                expectedRole === 'technician' &&
                user.role === UserRole.COLABORADOR
            ) {
                return res.status(403).json({
                    error: `A conta ${user.email} não possui permissão de Equipe Técnica. Entre pela aba Colaborador.`,
                });
            }

            setAuthCookie(res, {
                id: user.id,
                email: user.email,
                role: user.role,
                tier: user.tier,
            });

            res.json({ user: sanitizeUser(user) });
        } catch (error) {
            console.error('Erro na autenticação Google:', error);
            res.status(401).json({
                error: 'Falha na autenticação com o Google Workspace.',
            });
        }
    }
);

// 2. Login Direto de Técnicos (E-mail + Senha Corporativa)
authRouter.post(
    '/tech-login',
    authRateLimiter,
    validateBody(techLoginSchema),
    async (req, res) => {
        try {
            const { email, password } = req.body;
            const cleanEmail = email.trim().toLowerCase();
            const user = await prisma.user.findUnique({
                where: { email: cleanEmail },
            });

            if (!user || user.role === UserRole.COLABORADOR) {
                return res.status(401).json({
                    error: 'Credenciais técnicas inválidas ou sem permissão.',
                });
            }

            if (user.status === 'Suspenso') {
                return res.status(403).json({
                    error: 'Esta conta técnica encontra-se suspensa pelo administrador de TI.',
                });
            }

            // Validação estrita de senha via hash Bcrypt cadastrado no banco
            const isValid = user.passwordHash
                ? await bcrypt.compare(password, user.passwordHash)
                : false;

            if (!isValid) {
                return res.status(401).json({ error: 'Senha incorreta.' });
            }

            setAuthCookie(res, {
                id: user.id,
                email: user.email,
                role: user.role,
                tier: user.tier,
            });

            res.json({ user: sanitizeUser(user) });
        } catch (error) {
            console.error('Erro no login técnico:', error);
            res.status(500).json({ error: 'Erro interno no login.' });
        }
    }
);

// 3. Verificar Sessão Ativa ao Recarregar a Página (GET /api/auth/me)
authRouter.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// 4. Logout Seguro (POST /api/auth/logout)
authRouter.post('/logout', (_req, res) => {
    clearAuthCookie(res);
    res.json({ message: 'Sessão encerrada' });
});
