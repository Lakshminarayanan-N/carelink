import { Router } from 'express';
import mongoose from 'mongoose';
import MedicalRecord from '../models/MedicalRecord.js';
import Hospital from '../models/Hospital.js';
import RecordShare from '../models/RecordShare.js';
import User from '../models/User.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    let filter;
    if (req.user.role === 'admin') {
      filter = {};
    } else if (req.user.role === 'doctor') {
      const importedShares = req.user.hospital
        ? await RecordShare.find({
          targetHospital: req.user.hospital,
          status: { $in: ['approved', 'revoked'] }
        }).distinct('_id')
        : [];
      filter = { $or: [
        { doctor: req.user.id },
        ...(importedShares.length ? [{ importedThrough: { $in: importedShares } }] : [])
      ] };
    } else {
      filter = { patient: req.user.id };
    }
    const records = await MedicalRecord.find(filter)
      .populate('doctor', 'name specialty')
      .populate('hospital', 'name')
      .populate('sourceHospital', 'name')
      .sort({ recordedAt: -1 });
    res.json({ records });
  } catch (error) { next(error); }
});
router.post('/', allowRoles('doctor', 'admin'), async (req, res, next) => {
  try {
    const { patientId, title, category, summary, hospitalId } = req.body;
    if (!mongoose.isValidObjectId(patientId) || !title?.trim()) return res.status(400).json({ message: 'A valid patient and record title are required.' });
    const patient = await User.findOne({ _id: patientId, role: 'patient' }).select('_id');
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });
    let hospital;
    if (req.user.role === 'doctor') {
      if (!req.user.hospital) return res.status(403).json({ message: 'Your clinician account is not assigned to a hospital.' });
      hospital = req.user.hospital;
    } else {
      if (!mongoose.isValidObjectId(hospitalId)) return res.status(400).json({ message: 'Choose the hospital responsible for this record.' });
      hospital = await Hospital.findById(hospitalId).select('_id');
      if (!hospital) return res.status(404).json({ message: 'Hospital not found.' });
    }
    const record = await MedicalRecord.create({ patient: patient.id, doctor: req.user.role === 'doctor' ? req.user.id : undefined, hospital, title, category, summary });
    res.status(201).json({ record });
  } catch (error) { next(error); }
});
export default router;
