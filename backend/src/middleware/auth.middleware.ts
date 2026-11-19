import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SupportTier, UserRole } from '@prisma/client';
import { ENV } from '../config/env';
import { prisma } from '../lib/prisma';

export interface SessionPayload {
    id: string;
    email: string;
    role: UserRole;
    tier?: SupportTier | null;
}

export interface AuthenticatedUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    tier: SupportTier | null;
    department: string;
    avatarInitials: string | null;
    status: string;
    isGoogleVerified: boolean;
    googleAccountDomain: string | null;
    createdAt: Date;
    updatedAt: Date;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

export const SAFE_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    tier: true,
    department: true,
    avatarInitials: true,
    status: true,
    isGoogleVerified: true,
    googleAccountDomain: true,
    createdAt: true,
    updatedAt: true,
} as const;

const TECH_ROLES = new Set<UserRole>([
    UserRole.ANALISTA_N1,
    UserRole.ANALISTA_N2,
    UserRole.ANALISTA_N3,
    UserRole.ADMIN,
]);

/**
 * Emite um JWT assinado dentro de um Cookie HttpOnly seguro contra ataques XSS.
 * A flag `secure` é controlada explicitamente por `COOKIE_SECURE` para suportar HTTP em rede interna (IIS).
 */
export function setAuthCookie(res: Response, user: SessionPayload): string {
    const isCookieSecure = process.env.COOKIE_SECURE === 'true';
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, tier: user.tier ?? null },
        ENV.JWT_SECRET,
        { expiresIn: '12h' }
    );

    res.cookie(ENV.SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isCookieSecure,
        sameSite: 'lax',
        maxAge: ENV.SESSION_MAX_AGE_MS,
        path: '/',
    });

    return token;
}

/**
 * Remove o cookie de sessão corporativa respeitando a mesma flag `COOKIE_SECURE`.
 */
export function clearAuthCookie(res: Response): void {
    const isCookieSecure = process.env.COOKIE_SECURE === 'true';
    res.clearCookie(ENV.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: isCookieSecure,
        sameSite: 'lax',
        path: '/',
    });
}

/**
 * Extrai e valida o payload do JWT presente exclusivamente no cookie HttpOnly da requisição.
 */
export function verifySessionCookie(req: Request): SessionPayload | null {
    const token = req.cookies?.[ENV.SESSION_COOKIE_NAME];
    if (!token || typeof token !== 'string') return null;

    try {
        return jwt.verify(token, ENV.JWT_SECRET) as SessionPayload;
    } catch {
        return null;
    }
}

/**
 * Middleware de Autenticação Zero-Trust:
 * Extrai o JWT exclusivamente do cookie HttpOnly, valida a assinatura,
 * consulta o usuário atualizado no PostgreSQL via Prisma e anexa `req.user`.
 */
export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const decoded = verifySessionCookie(req);
        if (!decoded || !decoded.id) {
            res.status(401).json({
                error: 'Não autenticado. Faça login para acessar este recurso.',
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: SAFE_USER_SELECT,
        });

        if (!user || user.status === 'Suspenso') {
            clearAuthCookie(res);
            res.status(401).json({
                error: 'Sessão inválida: conta não encontrada ou suspensa pelo administrador.',
            });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('[AuthMiddleware] Falha ao validar sessão:', error);
        res.status(401).json({ error: 'Sessão expirada ou inválida.' });
    }
}

/**
 * Middleware RBAC para rotas exclusivas da Equipe Técnica e Administração.
 * Bloqueia qualquer usuário com perfil COLABORADOR com status 403 Forbidden.
 */
export function requireTechRole(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (!req.user) {
        res.status(401).json({ error: 'Não autenticado.' });
        return;
    }

    if (req.user.role === UserRole.COLABORADOR || !TECH_ROLES.has(req.user.role)) {
        res.status(403).json({
            error: 'Acesso proibido: esta operação é restrita à Equipe Técnica e Administração de TI.',
        });
        return;
    }

    next();
}
