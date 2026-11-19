import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env';
import { authRouter } from './routes/auth.routes';
import { ticketsRouter } from './routes/tickets.routes';
import { usersRouter } from './routes/users.routes';
import { serviceOrdersRouter } from './routes/serviceOrders.routes';
import { kbRouter } from './routes/kb.routes';
import { assetsRouter } from './routes/assets.routes';

const app = express();

// Confia no proxy reverso local (IIS + ARR) para extrair o IP real da estação via X-Forwarded-For
app.set('trust proxy', 1);

// ============================================================================
// 1. Blindagem de Cabeçalhos HTTP (Helmet)
// ============================================================================
app.use(helmet());

// ============================================================================
// 2. Política Estrita de CORS (Origin Validation + Credentials)
// ============================================================================
const allowedOrigins = new Set<string>(
    ENV.IS_PROD
        ? [ENV.FRONTEND_URL.trim()]
        : [
              ENV.FRONTEND_URL.trim(),
              'http://localhost:3000',
              'http://127.0.0.1:3000',
              'http://localhost:5173',
          ]
);

app.use(
    cors({
        origin: (origin, callback) => {
            // Permite requisições diretas do próprio servidor/healthchecks sem header Origin se não for browser cross-origin,
            // ou valida estritamente contra a whitelist configurada em FRONTEND_URL
            if (!origin || allowedOrigins.has(origin)) {
                callback(null, true);
            } else {
                callback(
                    new Error(
                        `Origem bloqueada pela política de CORS: ${origin}`
                    )
                );
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// ============================================================================
// 3. Rate Limiting Global da API (Proteção Anti-DoS / Scraping)
// ============================================================================
const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200, // 200 requisições por IP a cada 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Limite de requisições excedido para este endereço IP. Tente novamente mais tarde.',
    },
});

app.use('/api', globalApiLimiter);

// ============================================================================
// 4. Parsers de Cookies e JSON (Limite Estrito de 1MB contra DoS)
// ============================================================================
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// ============================================================================
// 5. Rota Pública de Health Check Corporativo
// ============================================================================
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'online',
        system: 'Global Desk API',
        environment: ENV.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// ============================================================================
// 6. Módulos de Rotas da API REST (Protegidos por RBAC / Zero-Trust)
// ============================================================================
app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/users', usersRouter);
app.use('/api/service-orders', serviceOrdersRouter);
app.use('/api/kb', kbRouter);
app.use('/api/assets', assetsRouter);

// ============================================================================
// 7. Tratamento Global de Rotas Inexistentes e Erros
// ============================================================================
app.use((_req, res) => {
    res.status(404).json({
        error: 'Endpoint não encontrado na Global Desk API.',
    });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err.message?.startsWith('Origem bloqueada pela política de CORS')) {
        res.status(403).json({ error: err.message });
        return;
    }
    if ((err as { type?: string }).type === 'entity.too.large') {
        res.status(413).json({
            error: 'Payload excede o limite máximo permitido de 1MB.',
        });
        return;
    }
    console.error('[Global Desk API] Erro não tratado:', err);
    res.status(500).json({
        error: 'Erro interno na Global Desk API.',
    });
});

app.listen(ENV.PORT, () => {
    console.log(
        `[Global Desk API] Servidor rodando em http://localhost:${ENV.PORT}`
    );
});
