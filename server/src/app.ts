import express, { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, queryOne, default as pool } from './config/db.js';
import resourceRoutes from './routes/resourceRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { aiInfo } from './utils/ai.js';
import { STORAGE_ROOT } from './utils/storage.js';

dotenv.config();

const app = express();

// Behind Vercel / a reverse proxy, so req.ip and rate limiting see the real client.
app.set('trust proxy', 1);

// Connect eagerly, but never exit on failure so /api/health can still answer.
connectDB().catch(err => {
    console.error('Database connection failure:', err.message);
});

// Ensure the database is reachable before handling data routes.
app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Request] ${req.method} ${req.path}`);
    }
    if (req.path === '/api/health') {
        next();
        return;
    }
    try {
        await connectDB();
        next();
    } catch (error: any) {
        console.error('Database connection await error:', error);
        res.status(500).json({ message: 'Database connection failed' });
    }
});

// CORS is open by default (public, read-mostly API). Set CORS_ORIGIN to a
// comma-separated allowlist to lock it down.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(o => o.trim()) } : {}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Locally-stored files (PDFs). The preview/download endpoints stream these with
// the right headers; this static mount keeps direct /files/... links working.
app.use('/files', express.static(STORAGE_ROOT, { maxAge: '1d', fallthrough: true }));

// Routes
app.use('/api/resources', resourceRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);

// Base route
app.get('/', (_req, res) => {
    res.send('UniArchive API is running...');
});

// Health Check
app.get('/api/health', async (_req, res) => {
    let dbState = 'disconnected';
    try {
        await queryOne('SELECT 1 AS ok');
        dbState = 'connected';
    } catch {
        dbState = 'error';
    }
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        dbState,
        // Which AI model the assistant will use (never the key), so a deploy can
        // be diagnosed from /api/health alone.
        ai: aiInfo()
    });
});

// Unknown API route -> JSON 404 (instead of Express' HTML default).
app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Not found' });
});

// Central error handler, so a thrown handler returns JSON rather than HTML.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Unhandled]', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 5000;

// Start the HTTP listener unless running as a serverless function.
// On Vercel the `backend` service imports this default export and invokes it
// per-request (entrypoint dist/app.js, see the repo-root vercel.json).
if (!process.env.VERCEL) {
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    let shuttingDown = false;

    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`\n${signal} received, shutting down...`);

        // `server.close()` only stops new connections: it waits for existing
        // keep-alive sockets to end.  The browser and the Vite dev proxy hold
        // those open, so the callback can never fire and the process hangs --
        // which is what makes `tsx watch` force-kill the child every 5s.
        // Drop idle sockets immediately, and keep a hard backstop so we always
        // exit promptly.
        const forceExit = setTimeout(() => {
            (server as any).closeAllConnections?.();
            process.exit(0);
        }, 2000);
        forceExit.unref();

        server.close(async () => {
            clearTimeout(forceExit);
            await pool.end().catch(() => {});
            process.exit(0);
        });
        (server as any).closeIdleConnections?.();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default app;
