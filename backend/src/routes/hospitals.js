import { Router } from 'express';
import Hospital from '../models/Hospital.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const hospitals = await Hospital.find().select('name').sort({ name: 1 });
    res.json({ hospitals: hospitals.map((hospital) => ({ id: hospital.id, name: hospital.name })) });
  } catch (error) { next(error); }
});

router.post('/', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'A hospital name is required.' });
    const hospital = await Hospital.create({ name });
    res.status(201).json({ hospital: { id: hospital.id, name: hospital.name } });
  } catch (error) { next(error); }
});

export default router;
