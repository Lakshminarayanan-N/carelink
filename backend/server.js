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

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/shares', shareRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'CareLink API' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 4000;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => app.listen(port, () => console.log(`CareLink API listening on ${port}`)))
    .catch((error) => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
} else {
  app.listen(port, () => console.log(`CareLink API listening on ${port} (database not configured)`));
}
