import { Router } from 'express';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── GET /api/appointments ─────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    let filter;
    if (req.user.role === 'admin') {
      filter = {};
    } else if (req.user.role === 'doctor') {
      filter = { doctor: req.user.id };
    } else if (req.user.role === 'hospital') {
      if (!req.user.hospital) return res.status(403).json({ message: 'Account not assigned to a hospital.' });
      // Only doctors belonging to this hospital
      const hospitalDoctors = await User.find({ hospital: req.user.hospital, role: { $in: ['doctor', 'hospital'] } }).distinct('_id');
      filter = { doctor: { $in: hospitalDoctors } };
    } else {
      // Patient
      filter = { patient: req.user.id };
    }

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialty hospital')
      .sort({ date: 1 });

    res.json({ appointments });
  } catch (error) { next(error); }
});

// ── POST /api/appointments ────────────────────────────────────────────────────
router.post('/', allowRoles('patient', 'hospital', 'admin'), async (req, res, next) => {
  try {
    const { doctorId, patientId, date, reason, type } = req.body;
    const when = new Date(date);
    if (!doctorId || Number.isNaN(when.getTime()) || when <= new Date()) {
      return res.status(400).json({ message: 'Choose a clinician and a future appointment time.' });
    }

    const targetPatientId = req.user.role === 'patient' ? req.user.id : patientId;
    if (!targetPatientId) {
      return res.status(400).json({ message: 'A patient is required for booking.' });
    }

    const appointment = await Appointment.create({
      patient: targetPatientId,
      doctor: doctorId,
      date: when,
      reason: reason?.trim() || '',
      type: type || 'Consultation',
    });

    await appointment.populate([
      { path: 'patient', select: 'name email phone' },
      { path: 'doctor', select: 'name specialty' },
    ]);

    res.status(201).json({ appointment });
  } catch (error) { next(error); }
});

// ── PATCH /api/appointments/:id/cancel ────────────────────────────────────────
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

    let allowed = req.user.role === 'admin' ||
      (req.user.role === 'patient' && appointment.patient.equals(req.user.id)) ||
      (req.user.role === 'doctor' && appointment.doctor.equals(req.user.id));

    if (!allowed && req.user.role === 'hospital' && req.user.hospital) {
      const doc = await User.findById(appointment.doctor).select('hospital');
      if (doc?.hospital?.equals(req.user.hospital)) allowed = true;
    }

    if (!allowed) return res.status(403).json({ message: 'You cannot update this appointment.' });
    if (appointment.status !== 'upcoming') return res.status(409).json({ message: 'Only upcoming appointments can be cancelled.' });

    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ appointment });
  } catch (error) { next(error); }
});

// ── PATCH /api/appointments/:id/status ────────────────────────────────────────
router.patch('/:id/status', allowRoles('doctor', 'hospital', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['upcoming', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Choose a valid appointment status.' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

    if (req.user.role === 'doctor' && !appointment.doctor.equals(req.user.id)) {
      return res.status(403).json({ message: 'You cannot update this appointment.' });
    }

    if (req.user.role === 'hospital') {
      const doc = await User.findById(appointment.doctor).select('hospital');
      if (!doc?.hospital?.equals(req.user.hospital)) {
        return res.status(403).json({ message: 'You cannot update appointments from another hospital.' });
      }
    }

    appointment.status = status;
    await appointment.save();
    res.json({ appointment });
  } catch (error) { next(error); }
});

export default router;
