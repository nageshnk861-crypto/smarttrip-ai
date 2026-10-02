import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import apiRouter from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api', apiRouter);

// Root Health & Info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'SmartTrip AI Travel Planner API Backend',
    status: 'running',
    routes: [
      '/api/trips',
      '/api/attractions',
      '/api/hotels',
      '/api/weather',
      '/api/ai',
      '/api/plan-trip',
    ],
  });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 SmartTrip Backend server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints mounted on http://localhost:${PORT}/api`);
});

export default app;
