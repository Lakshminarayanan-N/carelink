import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const query = req.query.q?.trim();
    const hospitalId = req.query.hospitalId;
    const filter = { role: 'doctor', isActive: { $ne: false } };

    if (hospitalId && mongoose.isValidObjectId(hospitalId)) {
      filter.hospital = hospitalId;
    }

    if (query) {
      filter.$or = [
        { name: new RegExp(query, 'i') },
        { specialty: new RegExp(query, 'i') },
      ];
    }

    const doctors = await User.find(filter)
      .populate('hospital', 'name')
      .select('name specialty credentials hospital email phone')
      .limit(50)
      .sort({ name: 1 });

    res.json({
      doctors: doctors.map((doctor) => ({
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialty: doctor.specialty || 'General Practice',
        credentials: doctor.credentials || 'MD',
        hospitalId: doctor.hospital?._id?.toString(),
        hospitalName: doctor.hospital?.name || 'Affiliated Hospital',
      })),
    });
  } catch (error) { next(error); }
});

router.post('/', authenticate, allowRoles('admin', 'hospital'), async (req, res, next) => {
  try {
    const { name, email, password, specialty, credentials } = req.body;
    let targetHospitalId = req.body.hospitalId;

    if (req.user.role === 'hospital') {
      if (!req.user.hospital) return res.status(403).json({ message: 'Your account is not linked to a hospital.' });
      targetHospitalId = req.user.hospital;
    }

    if (!name || !email || !password || !specialty || !mongoose.isValidObjectId(targetHospitalId)) {
      return res.status(400).json({ message: 'Name, email, password, specialty, and hospital are required.' });
    }

    if (await User.exists({ email: email.toLowerCase().trim() })) {
      return res.status(409).json({ message: 'An account already exists with that email.' });
    }

    const hospital = await Hospital.findById(targetHospitalId).select('_id name');
    if (!hospital) return res.status(404).json({ message: 'Hospital not found.' });

    const doctor = await User.create({
      name,
      email: email.toLowerCase().trim(),
      specialty,
      credentials: credentials || 'MD',
      hospital: hospital.id,
      role: 'doctor',
      passwordHash: await bcrypt.hash(password, 12),
    });

    res.status(201).json({
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        credentials: doctor.credentials,
        hospitalName: hospital.name,
      },
    });
  } catch (error) { next(error); }
});

export default router;
