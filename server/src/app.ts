import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import materialRoutes from './routes/material.routes.js';
import canvasRoutes from './routes/canvas.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import marksRoutes from './routes/marks.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import communityRoutes from './routes/community.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import { apiLimiter } from './middleware/rateLimit.js';
import privacyRoutes from './routes/privacy.routes.js';
import publicRoutes from './routes/public.routes.js';

const app = express();
const CLIENT_ORIGINS = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use(helmet());
app.use(
  cors({
    origin: CLIENT_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'EduSphere API', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/calendar', scheduleRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Resource not found' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || (err.name === 'MulterError' || String(err.code || '').startsWith('LIMIT_') ? 400 : 500);
  console.error('[Error Handler]', { status, name: err.name || 'Error' });
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
