import { Router } from 'express';
import Appointment from '../models/Appointment.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : req.user.role === 'doctor' ? { doctor: req.user.id } : { patient: req.user.id };
    const appointments = await Appointment.find(filter).populate('patient', 'name').populate('doctor', 'name specialty').sort({ date: 1 });
    res.json({ appointments });
  } catch (error) { next(error); }
});
router.post('/', allowRoles('patient'), async (req, res, next) => {
  try {
    const { doctorId, date, reason, type } = req.body;
    const when = new Date(date);
    if (!doctorId || Number.isNaN(when.getTime()) || when <= new Date()) return res.status(400).json({ message: 'Choose a clinician and a future appointment time.' });
    const appointment = await Appointment.create({ patient: req.user.id, doctor: doctorId, date: when, reason, type });
    await appointment.populate('doctor', 'name specialty');
    res.status(201).json({ appointment });
  } catch (error) { next(error); }
});
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const owns = req.user.role === 'admin' || (req.user.role === 'patient' && appointment.patient.equals(req.user.id)) || (req.user.role === 'doctor' && appointment.doctor.equals(req.user.id));
    if (!owns) return res.status(403).json({ message: 'You cannot update this appointment.' });
    if (appointment.status !== 'upcoming') return res.status(409).json({ message: 'Only upcoming appointments can be cancelled.' });
    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ appointment });
  } catch (error) { next(error); }
});
router.patch('/:id/status', allowRoles('doctor', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['upcoming', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Choose a valid appointment status.' });
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    if (req.user.role === 'doctor' && !appointment.doctor.equals(req.user.id)) return res.status(403).json({ message: 'You cannot update this appointment.' });
    appointment.status = status;
    await appointment.save();
    res.json({ appointment });
  } catch (error) { next(error); }
});
export default router;
