import { Router } from 'express';
import mongoose from 'mongoose';
import MedicalRecord from '../models/MedicalRecord.js';
import Hospital from '../models/Hospital.js';
import RecordShare from '../models/RecordShare.js';
import User from '../models/User.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── GET /api/records ──────────────────────────────────────────────────────────
// STRICT ISOLATION:
// - Admin: can see all records across all hospitals
// - Hospital / Doctor: can ONLY see records belonging to their assigned hospital
//   (Records created at their hospital, or imported via approved transfers to their hospital)
//   CANNOT see any records belonging to other hospitals!
// - Patient: can ONLY see their own personal records
router.get('/', async (req, res, next) => {
  try {
    let filter;
    if (req.user.role === 'admin') {
      filter = {};
      if (req.query.hospitalId && mongoose.isValidObjectId(req.query.hospitalId)) {
        filter.hospital = req.query.hospitalId;
      }
      if (req.query.patientId && mongoose.isValidObjectId(req.query.patientId)) {
        filter.patient = req.query.patientId;
      }
    } else if (req.user.role === 'doctor' || req.user.role === 'hospital') {
      if (!req.user.hospital) {
        return res.status(403).json({ message: 'Your account is not assigned to a hospital.' });
      }
      // Strictly scoped to their own hospital
      filter = { hospital: req.user.hospital };
      if (req.query.patientId && mongoose.isValidObjectId(req.query.patientId)) {
        filter.patient = req.query.patientId;
      }
    } else {
      // Patient role
      filter = { patient: req.user.id };
    }

    const records = await MedicalRecord.find(filter)
      .populate('patient', 'name email phone dateOfBirth bloodType')
      .populate('doctor', 'name specialty')
      .populate('hospital', 'name')
      .populate('sourceHospital', 'name')
      .populate('importedBy', 'name role')
      .sort({ recordedAt: -1 });

    res.json({ records });
  } catch (error) { next(error); }
});

// ── POST /api/records ─────────────────────────────────────────────────────────
// Doctors, Hospital staff, and Admin can create records
router.post('/', allowRoles('doctor', 'hospital', 'admin'), async (req, res, next) => {
  try {
    const { patientId, title, category, summary, hospitalId } = req.body;
    if (!mongoose.isValidObjectId(patientId) || !title?.trim()) {
      return res.status(400).json({ message: 'A valid patient and record title are required.' });
    }

    const patient = await User.findOne({ _id: patientId, role: 'patient' }).select('_id');
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    let assignedHospital;
    let assignedDoctor = undefined;

    if (req.user.role === 'doctor' || req.user.role === 'hospital') {
      if (!req.user.hospital) {
        return res.status(403).json({ message: 'Your account is not assigned to a hospital.' });
      }
      // Strictly lock to their own hospital - CANNOT create for another hospital
      assignedHospital = req.user.hospital;
      if (req.user.role === 'doctor') {
        assignedDoctor = req.user.id;
      }
    } else {
      // Admin can assign to chosen hospital
      if (!mongoose.isValidObjectId(hospitalId)) {
        return res.status(400).json({ message: 'Choose the hospital responsible for this record.' });
      }
      const hosp = await Hospital.findById(hospitalId).select('_id');
      if (!hosp) return res.status(404).json({ message: 'Hospital not found.' });
      assignedHospital = hosp._id;
    }

    const record = await MedicalRecord.create({
      patient: patient.id,
      doctor: assignedDoctor,
      hospital: assignedHospital,
      title: title.trim(),
      category: category || 'Visit summary',
      summary: summary?.trim() || '',
      recordedAt: new Date(),
    });

    await record.populate([
      { path: 'patient', select: 'name email phone dateOfBirth bloodType' },
      { path: 'doctor', select: 'name specialty' },
      { path: 'hospital', select: 'name' },
    ]);

    res.status(201).json({ record });
  } catch (error) { next(error); }
});

export default router;
