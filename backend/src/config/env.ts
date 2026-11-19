import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const rawJwtSecret = process.env.JWT_SECRET || process.env.JWT_Secret;

if (process.env.NODE_ENV === 'production' && !rawJwtSecret) {
    throw new Error(
        '[FATAL] A variável de ambiente JWT_SECRET é obrigatória em produção.'
    );
}

export const ENV = {
    PORT: Number(process.env.PORT) || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_PROD: process.env.NODE_ENV === 'production',
    COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    JWT_SECRET: rawJwtSecret || crypto.randomBytes(32).toString('hex'),
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET:
        process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET_ID || '',
    ALLOWED_DOMAIN: process.env.WORKSPACE_DOMAIN || 'corporativo.com.br',
    SESSION_COOKIE_NAME: 'globaldesk_session',
    SESSION_MAX_AGE_MS: 12 * 60 * 60 * 1000, // 12 horas
} as const;
