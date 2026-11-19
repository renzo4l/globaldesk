import { PrismaClient } from '@prisma/client';

/**
 * Instância Singleton do PrismaClient para evitar múltiplas conexões
 * durante recarregamentos em ambiente de desenvolvimento (tsx watch).
 */
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

