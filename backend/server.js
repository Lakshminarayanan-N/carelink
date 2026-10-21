import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './src/routes/auth.js';
import doctorRoutes from './src/routes/doctors.js';
import appointmentRoutes from './src/routes/appointments.js';
import recordRoutes from './src/routes/records.js';
import hospitalRoutes from './src/routes/hospitals.js';
import shareRoutes from './src/routes/shares.js';
import adminRoutes from './src/routes/admin.js';

const app = express();

// Trust reverse proxy (Vercel serverless / edge proxy)
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://karthik6393609_db_user:dSDqWyWPiNMsuxx4@cluster0.ugxnxdj.mongodb.net/carelink?retryWrites=true&w=majority';

// Database connection manager for serverless and long-running environments
let dbPromise = null;
async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  if (!dbPromise) {
    dbPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    }).catch(err => {
      dbPromise = null;
      throw err;
    });
  }
  await dbPromise;
}

// Middleware: ensure database is connected before handling any route
app.use(async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('MongoDB connection failure:', err);
    next(err);
  }
});

// Rate limiting with trustProxy validation disabled to prevent serverless proxy crashes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { message: 'Too many authentication attempts. Please try again later.' }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CareLink Secure API',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting'
  });
});

app.use((err, _req, res, _next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong. Please try again.'
  });
});

const port = process.env.PORT || 4000;
if (!process.env.VERCEL) {
  ensureDb().then(() => {
    app.listen(port, () => console.log(`CareLink API listening on ${port}`));
  }).catch(err => {
    console.error('Failed to start server:', err.message);
  });
}

export default app;
