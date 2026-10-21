import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.get('/', async (req, res, next) => {
  try {
    const query = req.query.q?.trim();
    const filter = { role: 'doctor' };
    if (query) filter.$or = [{ name: new RegExp(query, 'i') }, { specialty: new RegExp(query, 'i') }];
    const doctors = await User.find(filter).select('name specialty credentials').limit(50).sort({ name: 1 });
    res.json({ doctors: doctors.map((doctor) => ({ id: doctor.id, name: doctor.name, specialty: doctor.specialty || 'General practice', credentials: doctor.credentials || 'MD' })) });
  } catch (error) { next(error); }
});
router.post('/', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const { name, email, password, specialty, credentials, hospitalId } = req.body;
    if (!name || !email || !password || !specialty || !mongoose.isValidObjectId(hospitalId)) return res.status(400).json({ message: 'Name, email, password, specialty, and hospital are required.' });
    const hospital = await Hospital.findById(hospitalId).select('_id');
    if (!hospital) return res.status(404).json({ message: 'Hospital not found.' });
    const bcrypt = await import('bcryptjs');
    const doctor = await User.create({ name, email, specialty, credentials, hospital: hospital.id, role: 'doctor', passwordHash: await bcrypt.default.hash(password, 12) });
    res.status(201).json({ doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty, credentials: doctor.credentials } });
  } catch (error) { next(error); }
});
export default router;
