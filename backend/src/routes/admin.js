import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import Appointment from '../models/Appointment.js';
import MedicalRecord from '../models/MedicalRecord.js';
import RecordShare from '../models/RecordShare.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, allowRoles('admin'));

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  hospitalId: u.hospital?._id?.toString() || u.hospital?.toString(),
  hospitalName: u.hospital?.name,
  phone: u.phone, isActive: u.isActive, createdAt: u.createdAt,
});

// ── Dashboard stats ───────────────────────────────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try {
    const [patients, hospitals, doctors, appointments, records, pendingShares] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      Hospital.countDocuments(),
      User.countDocuments({ role: { $in: ['doctor', 'hospital'] } }),
      Appointment.countDocuments(),
      MedicalRecord.countDocuments(),
      RecordShare.countDocuments({ status: 'requested' }),
    ]);
    res.json({ stats: { patients, hospitals, doctors, appointments, records, pendingShares } });
  } catch (error) { next(error); }
});

// ── List all users ────────────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const { role, hospitalId, q } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (hospitalId && mongoose.isValidObjectId(hospitalId)) filter.hospital = hospitalId;
    if (q) filter.$or = [
      { name: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
    ];
    const users = await User.find(filter)
      .populate('hospital', 'name')
      .select('-passwordHash -loginAttempts -lockUntil')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ users: users.map(safeUser) });
  } catch (error) { next(error); }
});

// ── Create user (any role) ────────────────────────────────────────────────────
router.post('/users', async (req, res, next) => {
  try {
    const { name, email, password, role, hospitalId, phone, specialty, credentials } = req.body;
    if (!name || !email || !password || password.length < 8 || !role) {
      return res.status(400).json({ message: 'Name, email, password (min 8 chars) and role are required.' });
    }
    if (!['patient', 'doctor', 'hospital', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }
    if (await User.exists({ email: email.toLowerCase().trim() })) {
      return res.status(409).json({ message: 'An account already exists with that email.' });
    }

    let hospital;
    if (['doctor', 'hospital'].includes(role)) {
      if (!mongoose.isValidObjectId(hospitalId)) return res.status(400).json({ message: 'A valid hospital is required for this role.' });
      hospital = await Hospital.findById(hospitalId).select('_id name');
      if (!hospital) return res.status(404).json({ message: 'Hospital not found.' });
    }

    const user = await User.create({
      name, email, phone, specialty, credentials,
      role, hospital: hospital?._id,
      passwordHash: await bcrypt.hash(password, 12),
    });
    await user.populate('hospital', 'name');
    res.status(201).json({ user: safeUser(user) });
  } catch (error) { next(error); }
});

// ── Update user ───────────────────────────────────────────────────────────────
router.patch('/users/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const allowed = ['name', 'phone', 'role', 'isActive', 'specialty', 'credentials'];
    for (const key of allowed) if (key in req.body) user[key] = req.body[key];

    if (req.body.hospitalId !== undefined) {
      if (req.body.hospitalId === null || req.body.hospitalId === '') {
        user.hospital = undefined;
      } else {
        if (!mongoose.isValidObjectId(req.body.hospitalId)) return res.status(400).json({ message: 'Invalid hospital ID.' });
        const hospital = await Hospital.findById(req.body.hospitalId).select('_id');
        if (!hospital) return res.status(404).json({ message: 'Hospital not found.' });
        user.hospital = hospital._id;
      }
    }

    if (req.body.password) {
      if (req.body.password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      user.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    // Unlock account
    if (req.body.unlock) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
    }

    await user.save();
    await user.populate('hospital', 'name');
    res.json({ user: safeUser(user) });
  } catch (error) { next(error); }
});

// ── Delete user ───────────────────────────────────────────────────────────────
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted.' });
  } catch (error) { next(error); }
});

// ── All hospitals with member counts ─────────────────────────────────────────
router.get('/hospitals', async (_req, res, next) => {
  try {
    const hospitals = await Hospital.find().sort({ name: 1 });
    const counts = await User.aggregate([
      { $match: { hospital: { $exists: true } } },
      { $group: { _id: '$hospital', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    res.json({
      hospitals: hospitals.map((h) => ({
        id: h.id, name: h.name, createdAt: h.createdAt,
        memberCount: countMap[h.id] || 0,
      })),
    });
  } catch (error) { next(error); }
});

// ── All records (admin view) ──────────────────────────────────────────────────
router.get('/records', async (req, res, next) => {
  try {
    const { hospitalId, patientId } = req.query;
    const filter = {};
    if (hospitalId && mongoose.isValidObjectId(hospitalId)) filter.hospital = hospitalId;
    if (patientId && mongoose.isValidObjectId(patientId)) filter.patient = patientId;
    const records = await MedicalRecord.find(filter)
      .populate('patient', 'name email')
      .populate('doctor', 'name specialty')
      .populate('hospital', 'name')
      .populate('sourceHospital', 'name')
      .sort({ recordedAt: -1 })
      .limit(500);
    res.json({ records });
  } catch (error) { next(error); }
});

// ── All shares (admin view) ───────────────────────────────────────────────────
router.get('/shares', async (_req, res, next) => {
  try {
    const shares = await RecordShare.find()
      .populate('patient', 'name email')
      .populate('sourceHospital', 'name')
      .populate('targetHospital', 'name')
      .populate('requestedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ shares });
  } catch (error) { next(error); }
});

// ── All appointments (admin view) ─────────────────────────────────────────────
router.get('/appointments', async (req, res, next) => {
  try {
    const { hospitalId } = req.query;
    const filter = {};
    if (hospitalId && mongoose.isValidObjectId(hospitalId)) {
      // appointments for doctors in this hospital
      const doctors = await User.find({ hospital: hospitalId, role: { $in: ['doctor', 'hospital'] } }).distinct('_id');
      filter.doctor = { $in: doctors };
    }
    const appointments = await Appointment.find(filter)
      .populate('patient', 'name email')
      .populate('doctor', 'name specialty')
      .sort({ date: -1 })
      .limit(500);
    res.json({ appointments });
  } catch (error) { next(error); }
});

export default router;
