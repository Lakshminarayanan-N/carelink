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
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Rate limiting for auth endpoints (brute-force defense)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login or registration attempts. Please try again later.' }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'CareLink Secure API' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 4000;

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      if (!process.env.VERCEL) {
        app.listen(port, () => console.log(`CareLink API listening on ${port}`));
      }
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message);
      if (!process.env.VERCEL) process.exit(1);
    });
} else if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`CareLink API listening on ${port} (database not configured)`));
}

export default app;
